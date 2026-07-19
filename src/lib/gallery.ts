import { db } from "./db";

export interface GalleryApp {
  slug: string;
  name: string;
  summary: string;
  updated_at: number;
  platform: "web" | "mobile";
}

export function galleryApps(limit: number): GalleryApp[] {
  const rows = db
    .prepare(
      `SELECT p.slug, p.name, p.updated_at, p.platform, v.spec
       FROM projects p JOIN app_versions v ON v.id = p.published_version_id
       WHERE p.slug IS NOT NULL AND p.published_version_id IS NOT NULL AND p.in_gallery = 1
       ORDER BY p.updated_at DESC LIMIT ?`
    )
    .all(limit) as { slug: string; name: string; updated_at: number; platform: "web" | "mobile"; spec: string | null }[];
  return rows.map((r) => {
    let summary = "";
    try {
      summary = r.spec ? (JSON.parse(r.spec).summary ?? "") : "";
    } catch {
      // keep empty summary on malformed spec
    }
    return { slug: r.slug, name: r.name, summary, updated_at: r.updated_at, platform: r.platform };
  });
}

/** Published apps for a user's public profile. Published implies publicly reachable, so in_gallery is not required. */
export function userPublishedApps(userId: string, limit = 24): GalleryApp[] {
  const rows = db
    .prepare(
      `SELECT p.slug, p.name, p.updated_at, p.platform, v.spec
       FROM projects p JOIN app_versions v ON v.id = p.published_version_id
       WHERE p.slug IS NOT NULL AND p.published_version_id IS NOT NULL AND p.user_id = ?
       ORDER BY p.updated_at DESC LIMIT ?`
    )
    .all(userId, limit) as { slug: string; name: string; updated_at: number; platform: "web" | "mobile"; spec: string | null }[];
  return rows.map((r) => {
    let summary = "";
    try {
      summary = r.spec ? (JSON.parse(r.spec).summary ?? "") : "";
    } catch {
      // keep empty summary on malformed spec
    }
    return { slug: r.slug, name: r.name, summary, updated_at: r.updated_at, platform: r.platform };
  });
}

export function appUrl(slug: string): string {
  const appsOrigin = process.env.NEXT_PUBLIC_APPS_ORIGIN;
  return appsOrigin ? `${appsOrigin}/${slug}` : `/p/${slug}`;
}
