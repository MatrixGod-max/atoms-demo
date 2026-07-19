import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import PromptLauncher from "@/components/PromptLauncher";
import ProjectCard, { type ProjectSummary } from "@/components/ProjectCard";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await getUser();
  if (!user) redirect("/login");

  const projects = db
    .prepare(
      `SELECT p.id, p.name, p.slug, p.published_version_id, p.updated_at,
              (SELECT COUNT(*) FROM app_versions v WHERE v.project_id = p.id) AS version_count
       FROM projects p WHERE p.user_id = ? ORDER BY p.updated_at DESC`
    )
    .all(user.id)
    .map((row) => ({ ...row })) as unknown as ProjectSummary[];

  return (
    <div className="flex-1 flex flex-col">
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl w-full mx-auto">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-wide">
          <span className="text-accent text-xl">⚛</span> Quark
        </Link>
        <div className="flex items-center gap-3 text-sm text-muted">
          <span>{user.name}</span>
          <LogoutButton />
        </div>
      </nav>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 pb-16">
        <section className="max-w-2xl mx-auto mt-8 mb-12">
          <h1 className="font-semibold text-xl mb-4 text-center">今天想构建什么?</h1>
          <PromptLauncher loggedIn compact />
        </section>

        <section>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-semibold">我的项目</h2>
            <span className="font-mono text-xs text-muted">{projects.length} 个</span>
          </div>
          {projects.length === 0 ? (
            <div className="card p-10 text-center text-muted text-sm">
              还没有项目。在上方描述你的想法,让智能体开始构建第一个应用。
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
