import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { ownedProject } from "@/lib/projects";
import { parseStoredFiles } from "@/lib/projectFiles";
import { createZip } from "@/lib/zip";

export const dynamic = "force-dynamic";

function exportReadme(name: string, isProject: boolean, isMobile: boolean): string {
  const dev = isProject
    ? `## 本地开发

\`\`\`bash
npm install
npm run dev     # vite 开发服务器,热更新
npm run build   # 产出 dist/ 静态站点
\`\`\`
`
    : `## 本地运行

纯静态单文件应用:直接用浏览器打开 index.html,或任意静态服务器托管。
`;
  const mobile = isMobile
    ? `
## 打包为原生应用(Capacitor)

平台云端不打原生包;本地打 APK/IPA 的路径:

\`\`\`bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npm run build
npx cap add android          # iOS 需 macOS: npx cap add ios
npx cap sync
npx cap open android         # Android Studio 中构建 APK
\`\`\`

capacitor.config.json 已随工程导出(webDir 指向 dist/)。
`
    : "";
  return `# ${name}

由 ☀ Fusion 聚变生成的${isMobile ? "移动" : "网页"}应用${isProject ? "(多文件 React 工程)" : ""}。

${dev}${mobile}
> 说明:平台注入的 window.quark.storage(云存储)与 connectors 仅在 Fusion 发布环境可用;
> 导出后应用会自动回退到 localStorage / 降级逻辑。
`;
}

const EXPORT_PACKAGE_JSON = (name: string) =>
  JSON.stringify(
    {
      name: name
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40) || "fusion-app",
      private: true,
      type: "module",
      scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
      dependencies: { react: "^19.0.0", "react-dom": "^19.0.0" },
      devDependencies: { vite: "^6.0.0", "@vitejs/plugin-react": "^4.3.0" },
    },
    null,
    2
  ) + "\n";

const VITE_CONFIG = `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({ plugins: [react()] });
`;

const CAPACITOR_CONFIG = (name: string) =>
  JSON.stringify(
    { appId: "dev.fusion.app", appName: name.slice(0, 30) || "FusionApp", webDir: "dist", server: { androidScheme: "https" } },
    null,
    2
  ) + "\n";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  const project = ownedProject(user.id, id);
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  if (!project.current_version_id) return NextResponse.json({ error: "还没有可导出的版本" }, { status: 400 });

  const version = db
    .prepare("SELECT html, files FROM app_versions WHERE id = ?")
    .get(project.current_version_id) as { html: string; files: string | null };
  const sources = parseStoredFiles(version.files);
  const isProject = !!sources;
  const isMobile = project.platform === "mobile";

  const out: Record<string, string> = {};
  if (sources) {
    for (const [p, content] of Object.entries(sources)) out[p] = content;
    out["package.json"] = EXPORT_PACKAGE_JSON(project.name);
    out["vite.config.js"] = VITE_CONFIG;
  } else {
    out["index.html"] = version.html;
  }
  out["README.md"] = exportReadme(project.name, isProject, isMobile);
  if (isMobile) out["capacitor.config.json"] = CAPACITOR_CONFIG(project.name);

  const zip = createZip(out);
  const filename = `${(project.slug ?? project.id).replace(/[^\w-]/g, "")}-export.zip`;
  return new Response(new Uint8Array(zip), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
