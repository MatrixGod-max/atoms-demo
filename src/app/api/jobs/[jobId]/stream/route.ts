import { getUser } from "@/lib/auth";
import { jobRunner } from "@/lib/jobs";

export const dynamic = "force-dynamic";

const PING_MS = 15_000;

export async function GET(_req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const user = await getUser();
  if (!user) return Response.json({ error: "未登录" }, { status: 401 });
  const { jobId } = await ctx.params;
  const job = jobRunner.getJob(jobId);
  if (!job || job.user_id !== user.id) {
    return Response.json({ error: "任务不存在" }, { status: 404 });
  }

  const encoder = new TextEncoder();
  let closed = false;
  let detach = () => {};
  let ping: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const write = (text: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          closed = true;
        }
      };
      const send = (payload: string) => write(`data: ${payload}\n\n`);
      const finish = () => {
        if (closed) return;
        write("data: [DONE]\n\n");
        closed = true;
        clearInterval(ping);
        detach();
        controller.close();
      };

      const live = jobRunner.getLive(jobId);
      if (!live) {
        // Process restarted or the buffer was retired: report the terminal DB state.
        send(JSON.stringify({ type: "job_state", status: job.status, error: job.error ?? undefined }));
        finish();
        return;
      }

      const sub = jobRunner.subscribe(jobId, (payload) => {
        send(payload);
        if (payload.includes('"job_state"')) {
          const parsed = JSON.parse(payload);
          if (parsed.type === "job_state" && (parsed.status === "done" || parsed.status === "error")) finish();
        }
      });
      detach = sub.detach;
      for (const payload of sub.replay) send(payload);
      if (sub.done) {
        finish();
        return;
      }
      ping = setInterval(() => write(": ping\n\n"), PING_MS);
    },
    cancel() {
      closed = true;
      clearInterval(ping);
      detach();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
