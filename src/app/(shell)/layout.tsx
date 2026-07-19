import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import PromoBanner from "@/components/PromoBanner";
import Sidebar from "@/components/Sidebar";

export const dynamic = "force-dynamic";

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  const projectCount = user
    ? (db.prepare("SELECT COUNT(*) AS c FROM projects WHERE user_id = ?").get(user.id) as { c: number }).c
    : 0;

  return (
    <div className="min-h-dvh flex flex-col">
      <PromoBanner />
      <div className="flex-1 flex flex-col sm:flex-row">
        <Sidebar user={user ? { name: user.name } : null} projectCount={projectCount} />
        <main className="flex-1 min-w-0 flex flex-col">{children}</main>
      </div>
    </div>
  );
}
