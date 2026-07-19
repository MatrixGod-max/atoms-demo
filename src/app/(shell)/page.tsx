import Link from "next/link";
import { getUser } from "@/lib/auth";
import { galleryApps, appUrl } from "@/lib/gallery";
import HomeHero from "@/components/HomeHero";
import AppCard from "@/components/AppCard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getUser();
  const featured = galleryApps(3);
  return (
    <div className="flex-1 flex flex-col">
      <HomeHero userName={user?.name ?? null} loggedIn={!!user} />

      {featured.length > 0 && (
        <section className="max-w-4xl w-full mx-auto px-6 pb-16">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-semibold">来自资源中心</h2>
            <Link href="/resources" className="text-xs text-accent hover:underline">
              全部 →
            </Link>
          </div>
          <div className="grid sm:grid-cols-3 gap-5">
            {featured.map((app) => (
              <AppCard key={app.slug} app={app} url={appUrl(app.slug)} />
            ))}
          </div>
        </section>
      )}

      <footer className="mt-auto border-t border-line py-5 text-center text-xs text-muted">
        Atoms Demo · 灵感致敬{" "}
        <a href="https://atoms.dev" className="text-accent hover:underline" target="_blank" rel="noreferrer">
          atoms.dev
        </a>
      </footer>
    </div>
  );
}
