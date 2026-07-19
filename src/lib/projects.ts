import { db } from "./db";

export interface ProjectRow {
  id: string;
  user_id: string;
  name: string;
  slug: string | null;
  current_version_id: string | null;
  published_version_id: string | null;
  created_at: number;
  updated_at: number;
  goal: string | null;
  goal_active: number;
  goal_round: number;
  goal_rounds: number;
  goal_status: string | null;
  acceptance: string | null;
  fused_from: string | null;
  engine: "single" | "project";
  platform: "web" | "mobile";
}

export function ownedProject(userId: string, projectId: string): ProjectRow | undefined {
  return db.prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?").get(projectId, userId) as
    | ProjectRow
    | undefined;
}
