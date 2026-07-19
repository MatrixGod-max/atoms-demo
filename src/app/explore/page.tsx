import Link from "next/link";
import { getUser } from "@/lib/auth";
import { galleryApps, appUrl } from "@/lib/gallery";
import AppCard from "@/components/AppCard";

export const dynamic = "force-dynamic";

export const metadata = { title: "展厅 — Quark" };

export default async function Explore() {
  const user = await getUser();
  const apps = galleryApps(12);

  return (
    <div className="flex-1 flex flex-col">
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl w-full mx-auto">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-wide">
          <span className="text-accent text-xl">⚛</span> Quark
        </Link>
        <div className="flex items-center gap-3 text-sm">
          {user ? (
            <Link href="/dashboard" className="btn-primary px-4 py-2">
              进入工作台
            </Link>
          ) : (
            <Link href="/register" className="btn-primary px-4 py-2">
              免费注册
            </Link>
          )}
        </div>
      </nav>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 pb-16">
        <header className="mt-6 mb-8">
          <p className="font-mono text-xs tracking-[0.25em] text-muted mb-2">GALLERY</p>
          <h1 className="text-2xl font-bold">展厅</h1>
          <p className="text-muted text-sm mt-2 max-w-lg leading-relaxed">
            这里的每个应用都由智能体生成并发布。打开体验,或者 Remix 一份到你的工作台,在它的基础上继续创造。
          </p>
        </header>

        {apps.length === 0 ? (
          <div className="card p-10 text-center text-muted text-sm">
            展厅还空着。<Link href="/" className="text-accent hover:underline">去生成第一个应用</Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {apps.map((app) => (
              <AppCard key={app.slug} app={app} url={appUrl(app.slug)} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
