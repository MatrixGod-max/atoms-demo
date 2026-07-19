import { NextResponse } from "next/server";
import { db, now } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { jobRunner } from "@/lib/jobs";

export const dynamic = "force-dynamic";

/** Task center: the user's active jobs across projects + last-24h outcomes. */
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const jobs = jobRunner.activeJobsForUser(user.id).map((j) => ({
    id: j.id,
    projectId: j.project_id,
    projectName: j.project_name,
    status: j.status,
    stage: j.stage,
    mode: j.mode,
    position: j.status === "queued" ? jobRunner.queuePosition(j.id) : 0,
    createdAt: j.created_at,
  }));

  const recent = (
    db
      .prepare(
        `SELECT j.project_id, p.name AS project_name, j.status, j.error, j.updated_at
         FROM jobs j JOIN projects p ON p.id = j.project_id
         WHERE j.user_id = ? AND j.status IN ('done','error') AND j.updated_at > ?
         ORDER BY j.updated_at DESC LIMIT 10`
      )
      .all(user.id, now() - 24 * 3600 * 1000) as {
      project_id: string;
      project_name: string;
      status: "done" | "error";
      error: string | null;
      updated_at: number;
    }[]
  ).map((r) => ({
    projectId: r.project_id,
    projectName: r.project_name,
    status: r.status,
    error: r.error ?? undefined,
    finishedAt: r.updated_at,
  }));

  return NextResponse.json({ jobs, recent });
}
