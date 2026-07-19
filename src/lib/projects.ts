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
}

export function ownedProject(userId: string, projectId: string): ProjectRow | undefined {
  return db.prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?").get(projectId, userId) as
    | ProjectRow
    | undefined;
}
