import Link from "next/link";
import { getUser } from "@/lib/auth";
import { galleryApps, appUrl } from "@/lib/gallery";
import PromptLauncher from "@/components/PromptLauncher";
import AppCard from "@/components/AppCard";

export const dynamic = "force-dynamic";

const STAGES = [
  {
    tag: "01 · PLANNER",
    name: "规划",
    desc: "理解你的想法,产出克制务实的产品规格:定位、核心功能、视觉方向。",
  },
  {
    tag: "02 · ENGINEER",
    name: "构建",
    desc: "把规格实现为一个自包含的网页应用,代码逐行流式呈现,全程可见。",
  },
  {
    tag: "03 · REVIEWER",
    name: "评审",
    desc: "检查交互完整性与代码质量,发现会导致不可用的问题时直接修复。",
  },
];

const FEATURES = [
  ["实时预览", "生成完成即刻在沙箱中运行,真实可交互。"],
  ["对话式迭代", "继续说需求,智能体在现有版本上修改。"],
  ["版本回滚", "每次生成都是一个版本,随时切换回任意版本。"],
  ["一键发布", "获得公开链接,任何人无需登录即可访问你的应用。"],
];

export default async function Home() {
  const user = await getUser();
  const featured = galleryApps(3);
  return (
    <div className="flex-1 flex flex-col">
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl w-full mx-auto">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-wide">
          <span className="text-accent text-xl">⚛</span> Quark
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/resources" className="text-muted hover:text-ink px-2 py-2">
            资源中心
          </Link>
          {user ? (
            <Link href="/dashboard" className="btn-primary px-4 py-2">
              进入工作台
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn-ghost px-4 py-2">
                登录
              </Link>
              <Link href="/register" className="btn-primary px-4 py-2">
                免费注册
              </Link>
            </>
          )}
        </div>
      </nav>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6">
        <section className="relative flex flex-col items-center text-center pt-16 pb-20">
          <div className="orbit orbit-a w-[540px] h-[540px] max-w-[92vw] max-h-[92vw] top-[-40px]">
            <span className="q bg-accent" />
          </div>
          <div className="orbit orbit-b w-[380px] h-[380px] max-w-[70vw] max-h-[70vw] top-[-20px]">
            <span className="q bg-amber" />
          </div>

          <p className="font-mono text-xs tracking-[0.25em] text-muted mb-6">
            AGENT-DRIVEN APP BUILDER · ATOMS 笔试 DEMO
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight">
            把一句话
            <span className="text-accent">,</span>
            变成一个应用
          </h1>
          <p className="text-muted mt-5 max-w-xl leading-relaxed">
            万物由原子构成,原子由夸克构成。Quark 是一支微型智能体团队 ——
            规划、构建、评审、发布,几分钟内交付一个可运行的网页应用。
          </p>
          <div className="w-full max-w-2xl mt-10">
            <PromptLauncher loggedIn={!!user} />
          </div>
        </section>

        <section className="pb-16">
          <div className="grid sm:grid-cols-3 gap-4">
            {STAGES.map((s) => (
              <div key={s.tag} className="card p-5 text-left">
                <p className="font-mono text-[11px] tracking-[0.2em] text-amber">{s.tag}</p>
                <h3 className="font-semibold mt-2">{s.name}</h3>
                <p className="text-sm text-muted mt-2 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="pb-16">
          <div className="grid sm:grid-cols-4 gap-4">
            {FEATURES.map(([title, desc]) => (
              <div key={title} className="border-t border-line pt-4">
                <h4 className="text-sm font-semibold">{title}</h4>
                <p className="text-xs text-muted mt-1.5 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {featured.length > 0 && (
          <section className="pb-20">
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
      </main>

      <footer className="border-t border-line py-6 text-center text-xs text-muted">
        Quark · ROOT 全栈笔试作品 · 灵感致敬{" "}
        <a href="https://atoms.dev" className="text-accent hover:underline" target="_blank" rel="noreferrer">
          atoms.dev
        </a>
      </footer>
    </div>
  );
}
