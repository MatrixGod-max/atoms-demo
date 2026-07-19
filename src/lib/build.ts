/**
 * 工程模式构建器:esbuild 把多文件源树打包为自包含单 HTML(维持"禁外链"契约)。
 * 虚拟文件系统插件从内存 files map 供源;裸导入仅放行 react 白名单(真实 node_modules)。
 */
import * as esbuild from "esbuild";
import path from "node:path";
import type { ProjectFiles } from "./projectFiles";

export interface BuildError {
  file: string;
  line: number | null;
  text: string;
}

export interface BuildResult {
  ok: boolean;
  html?: string;
  errors?: BuildError[];
  meta: { files: number; bundleBytes: number };
}

export const DEP_WHITELIST = ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"];

const MAX_BUNDLE_BYTES = 1_500_000;
const VFS = "quark-vfs";

function loaderFor(p: string): esbuild.Loader {
  const ext = p.split(".").pop()?.toLowerCase();
  if (ext === "jsx") return "jsx";
  if (ext === "ts") return "ts";
  if (ext === "tsx") return "tsx";
  if (ext === "css") return "css";
  if (ext === "json") return "json";
  if (ext === "svg") return "text";
  return "js";
}

/** Resolve a relative import against the virtual tree (adds ./index and extension guessing). */
function resolveVirtual(files: ProjectFiles, importer: string, spec: string): string | null {
  const base = spec.startsWith(".") ? path.posix.join(path.posix.dirname(importer), spec) : spec.replace(/^\//, "");
  const candidates = [base, ...["js", "jsx", "ts", "tsx", "css", "json", "svg"].map((e) => `${base}.${e}`), `${base}/index.js`, `${base}/index.jsx`, `${base}/index.ts`, `${base}/index.tsx`];
  for (const c of candidates) {
    const clean = c.replace(/^\.\//, "");
    if (files[clean] !== undefined) return clean;
  }
  return null;
}

function vfsPlugin(files: ProjectFiles): esbuild.Plugin {
  return {
    name: VFS,
    setup(build) {
      // Bare imports: whitelist goes to the real node_modules, anything else is a structured error.
      build.onResolve({ filter: /^[^./]/ }, (args) => {
        // Whitelist applies to app code only; deps' own transitive imports
        // (e.g. react-dom -> scheduler) resolve normally.
        if (args.namespace !== VFS) return undefined;
        if (DEP_WHITELIST.includes(args.path)) return undefined; // esbuild resolves from node_modules
        return {
          errors: [
            {
              text: `依赖 "${args.path}" 不在白名单内(可用:${DEP_WHITELIST.slice(0, 4).join(", ")});请改用白名单依赖或内联实现`,
            },
          ],
        };
      });
      build.onResolve({ filter: /^\.|^\// }, (args) => {
        // Only virtual-tree importers are ours; real-FS files (whitelisted deps'
        // internals) must keep esbuild's normal resolution.
        if (args.namespace !== VFS) return undefined;
        const resolved = resolveVirtual(files, args.importer, args.path);
        if (!resolved) return { errors: [{ text: `找不到本地模块 "${args.path}"(自 ${args.importer})` }] };
        return { path: resolved, namespace: VFS };
      });
      build.onLoad({ filter: /.*/, namespace: VFS }, (args) => ({
        contents: files[args.path],
        loader: loaderFor(args.path),
        resolveDir: process.cwd(), // whitelist deps resolve from the platform's node_modules
      }));
    },
  };
}

function mapErrors(errors: esbuild.Message[]): BuildError[] {
  return errors.slice(0, 8).map((e) => ({
    file: e.location?.file?.replace(`${VFS}:`, "") ?? "unknown",
    line: e.location?.line ?? null,
    text: e.text.slice(0, 300),
  }));
}

const SCRIPT_TAG = /<script\s+[^>]*src=["']([^"']+)["'][^>]*>\s*<\/script>/gi;
const LINK_TAG = /<link\s+[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*\/?>|<link\s+[^>]*href=["']([^"']+)["'][^>]*rel=["']stylesheet["'][^>]*\/?>/gi;

function isLocalRef(ref: string): boolean {
  return !/^(https?:)?\/\//i.test(ref) && !ref.startsWith("data:");
}

/** Bundle the project into one self-contained HTML document. */
export async function buildProject(files: ProjectFiles): Promise<BuildResult> {
  const meta = { files: Object.keys(files).length, bundleBytes: 0 };
  const indexHtml = files["index.html"];
  if (!indexHtml) return { ok: false, errors: [{ file: "index.html", line: null, text: "缺少入口文件 index.html" }], meta };

  // Collect local script entries + stylesheet links from index.html.
  const scriptRefs: string[] = [];
  for (const m of indexHtml.matchAll(SCRIPT_TAG)) if (isLocalRef(m[1])) scriptRefs.push(m[1]);
  const cssRefs: string[] = [];
  for (const m of indexHtml.matchAll(LINK_TAG)) {
    const ref = m[1] ?? m[2];
    if (ref && isLocalRef(ref)) cssRefs.push(ref);
  }

  let js = "";
  let cssFromJs = "";
  if (scriptRefs.length) {
    const entries: string[] = [];
    for (const ref of scriptRefs) {
      const resolved = resolveVirtual(files, "index.html", ref.startsWith(".") || ref.startsWith("/") ? ref : `./${ref}`);
      if (!resolved) {
        return { ok: false, errors: [{ file: "index.html", line: null, text: `<script src="${ref}"> 指向的文件不存在` }], meta };
      }
      entries.push(resolved);
    }
    try {
      const result = await esbuild.build({
        entryPoints: entries.map((e) => `${VFS}:${e}`),
        plugins: [
          {
            name: "entry",
            setup(b) {
              b.onResolve({ filter: new RegExp(`^${VFS}:`) }, (args) => ({
                path: args.path.slice(VFS.length + 1),
                namespace: VFS,
              }));
            },
          },
          vfsPlugin(files),
        ],
        bundle: true,
        write: false,
        format: "iife",
        platform: "browser",
        target: "es2018",
        jsx: "automatic",
        // Browsers have no `process`; this also tree-shakes react to the prod build.
        define: { "process.env.NODE_ENV": '"production"' },
        minify: true,
        logLevel: "silent",
        outdir: "out",
      });
      for (const f of result.outputFiles ?? []) {
        if (f.path.endsWith(".css")) cssFromJs += f.text;
        else js += f.text;
      }
    } catch (err) {
      const e = err as { errors?: esbuild.Message[] };
      return {
        ok: false,
        errors: e.errors?.length ? mapErrors(e.errors) : [{ file: "unknown", line: null, text: String(err).slice(0, 300) }],
        meta,
      };
    }
  }

  let css = "";
  for (const ref of cssRefs) {
    const resolved = resolveVirtual(files, "index.html", ref.startsWith(".") || ref.startsWith("/") ? ref : `./${ref}`);
    if (!resolved) {
      return { ok: false, errors: [{ file: "index.html", line: null, text: `<link href="${ref}"> 指向的样式文件不存在` }], meta };
    }
    css += `${files[resolved]}\n`;
  }

  // Assemble: strip local script/link tags, inline bundle + styles.
  let html = indexHtml
    .replace(SCRIPT_TAG, (tag, src) => (isLocalRef(src) ? "" : tag))
    .replace(LINK_TAG, (tag, a, b) => (isLocalRef(a ?? b ?? "") ? "" : tag));
  const allCss = css + cssFromJs;
  const styleBlock = allCss ? `<style>\n${allCss}</style>` : "";
  const scriptBlock = js ? `<script>\n${js}</script>` : "";
  if (styleBlock) {
    html = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${styleBlock}</head>`) : styleBlock + html;
  }
  if (scriptBlock) {
    html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${scriptBlock}</body>`) : html + scriptBlock;
  }

  meta.bundleBytes = Buffer.byteLength(html, "utf8");
  if (meta.bundleBytes > MAX_BUNDLE_BYTES) {
    return {
      ok: false,
      errors: [{ file: "index.html", line: null, text: `构建产物 ${Math.round(meta.bundleBytes / 1024)}KB 超过上限 ${MAX_BUNDLE_BYTES / 1024}KB` }],
      meta,
    };
  }
  return { ok: true, html, meta };
}

/** Human-readable error block for the Engineer repair prompt. */
export function formatBuildErrors(errors: BuildError[]): string {
  return errors.map((e) => `- ${e.file}${e.line ? `:${e.line}` : ""} ${e.text}`).join("\n");
}
