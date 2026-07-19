import {
  S3Client,
  CreateBucketCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteBucketCommand,
  PutBucketWebsiteCommand,
  PutBucketPolicyCommand,
  PutPublicAccessBlockCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";

const REGION = process.env.AWS_REGION || "us-west-1";
export const RESOURCE_BUCKET = process.env.QUARK_RESOURCE_BUCKET || "quark-res-981861585685";

let client: S3Client | undefined;
function s3(): S3Client {
  return (client ??= new S3Client({ region: REGION }));
}

async function bucketExists(bucket: string): Promise<boolean> {
  try {
    await s3().send(new HeadBucketCommand({ Bucket: bucket }));
    return true;
  } catch {
    return false;
  }
}

function createBucketConfig(bucket: string) {
  // us-east-1 must omit the location constraint
  return REGION === "us-east-1"
    ? new CreateBucketCommand({ Bucket: bucket })
    : new CreateBucketCommand({
        Bucket: bucket,
        CreateBucketConfiguration: { LocationConstraint: REGION as never },
      });
}

/** Private resource-library bucket: each template gets its own key. */
export async function uploadTemplateResource(templateId: string, html: string): Promise<{ bucket: string; key: string }> {
  if (!(await bucketExists(RESOURCE_BUCKET))) {
    await s3().send(createBucketConfig(RESOURCE_BUCKET));
  }
  const key = `templates/${templateId}.html`;
  await s3().send(
    new PutObjectCommand({ Bucket: RESOURCE_BUCKET, Key: key, Body: html, ContentType: "text/html; charset=utf-8" })
  );
  return { bucket: RESOURCE_BUCKET, key };
}

/** Dedicated public website bucket per deployment. Returns the website URL. */
export async function deployToS3Website(bucket: string, html: string): Promise<string> {
  await s3().send(createBucketConfig(bucket));
  await s3().send(
    new PutPublicAccessBlockCommand({
      Bucket: bucket,
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: false,
        BlockPublicPolicy: false,
        IgnorePublicAcls: false,
        RestrictPublicBuckets: false,
      },
    })
  );
  await s3().send(
    new PutBucketPolicyCommand({
      Bucket: bucket,
      Policy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Sid: "PublicRead",
            Effect: "Allow",
            Principal: "*",
            Action: "s3:GetObject",
            Resource: `arn:aws:s3:::${bucket}/*`,
          },
        ],
      }),
    })
  );
  await s3().send(
    new PutBucketWebsiteCommand({
      Bucket: bucket,
      WebsiteConfiguration: { IndexDocument: { Suffix: "index.html" }, ErrorDocument: { Key: "index.html" } },
    })
  );
  await s3().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: "index.html",
      Body: html,
      ContentType: "text/html; charset=utf-8",
      CacheControl: "no-cache",
    })
  );
  return `http://${bucket}.s3-website-${REGION}.amazonaws.com`;
}

export async function removeS3Website(bucket: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket, Key: "index.html" })).catch(() => {});
  await s3().send(new DeleteBucketCommand({ Bucket: bucket }));
}
