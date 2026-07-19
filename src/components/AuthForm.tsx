"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { launchProject } from "@/lib/launch";

function AuthFormInner({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [account, setAccount] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (mode === "register" && !username.trim() && !email.trim()) {
      setError("用户名与邮箱至少填写一项");
      return;
    }
    setBusy(true);
    setError("");
    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(mode === "register" ? { username, email, password, name } : { account, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "请求失败,请重试");
      setBusy(false);
      return;
    }
    // Continue an interrupted flow: template start, Remix click, or a landing-page idea typed before signing up.
    if (params.get("next") === "template" && params.get("tpl")) {
      const tplRes = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ templateId: params.get("tpl") }),
      });
      const data = await tplRes.json().catch(() => ({}));
      if (tplRes.ok) {
        router.push(`/project/${data.id}`);
        return;
      }
    }
    if (params.get("next") === "remix" && params.get("slug")) {
      const remixRes = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ remixSlug: params.get("slug") }),
      });
      const data = await remixRes.json().catch(() => ({}));
      if (remixRes.ok) {
        router.push(`/project/${data.id}`);
        return;
      }
    }
    if (params.get("next") === "fuse" && params.get("a") && params.get("b")) {
      router.push(`/fuse?a=${encodeURIComponent(params.get("a")!)}&b=${encodeURIComponent(params.get("b")!)}`);
      return;
    }
    if (params.get("next") === "launch") {
      const boot = sessionStorage.getItem("quark_boot");
      if (boot) {
        sessionStorage.removeItem("quark_boot");
        let prompt = boot;
        let platform: "web" | "mobile" = "web";
        let research = false;
        let team = false;
        let theme: string | null = null;
        let connectors: string[] = [];
        let mode: "fast" | "mixed" | "deep" = "fast";
        let goal: string | null = null;
        let engine: "single" | "project" = "project";
        try {
          const parsed = JSON.parse(boot);
          if (parsed.prompt) {
            prompt = parsed.prompt;
            platform = parsed.platform === "mobile" ? "mobile" : "web";
            research = !!parsed.research;
            team = !!parsed.team;
            theme = typeof parsed.theme === "string" ? parsed.theme : null;
            if (Array.isArray(parsed.connectors)) connectors = parsed.connectors;
            if (parsed.mode === "mixed" || parsed.mode === "deep") mode = parsed.mode;
            if (typeof parsed.goal === "string" && parsed.goal.trim()) goal = parsed.goal;
            if (parsed.engine === "single") engine = "single";
          }
        } catch {
          // legacy plain-string boot value
        }
        const result = await launchProject(prompt, platform, { research, team, theme, connectors, mode, goal, engine });
        if ("id" in result) {
          router.push(`/project/${result.id}`);
          return;
        }
      }
    }
    router.push("/dashboard");
  }

  const isRegister = mode === "register";
  const switchQuery = params.toString() ? `?${params.toString()}` : "";

  return (
    <div className="flex-1 flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center justify-center gap-2 font-semibold text-lg mb-8">
          <span className="text-accent text-2xl">☀</span> Fusion
        </Link>
        <form className="card p-6 flex flex-col gap-4" onSubmit={submit}>
          <h1 className="font-semibold text-lg">{isRegister ? "创建账号" : "欢迎回来"}</h1>
          {isRegister ? (
            <>
              <label className="flex flex-col gap-1.5 text-sm">
                用户名
                <input
                  className="input px-3 py-2"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="2-20 位字母/数字/中文/下划线"
                  maxLength={20}
                  autoComplete="username"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                邮箱
                <input
                  className="input px-3 py-2"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
                <span className="text-xs text-muted">用户名与邮箱至少填一项,均可用于登录</span>
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                昵称
                <input
                  className="input px-3 py-2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="怎么称呼你(可选,默认同用户名)"
                  maxLength={40}
                  autoComplete="nickname"
                />
              </label>
            </>
          ) : (
            <label className="flex flex-col gap-1.5 text-sm">
              账号
              <input
                className="input px-3 py-2"
                required
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                placeholder="用户名或邮箱"
                autoComplete="username"
              />
            </label>
          )}
          <label className="flex flex-col gap-1.5 text-sm">
            密码
            <input
              className="input px-3 py-2"
              type="password"
              required
              minLength={10}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isRegister ? "至少 10 位,含字母与数字" : "输入密码"}
              autoComplete={isRegister ? "new-password" : "current-password"}
            />
          </label>
          {error && <p className="text-bad text-sm">{error}</p>}
          <button className="btn-primary py-2.5 text-sm" type="submit" disabled={busy}>
            {busy ? "处理中…" : isRegister ? "注册并开始" : "登录"}
          </button>
          <p className="text-xs text-muted text-center">
            {isRegister ? (
              <>
                已有账号?
                <Link href={`/login${switchQuery}`} className="text-accent hover:underline ml-1">
                  去登录
                </Link>
              </>
            ) : (
              <>
                还没有账号?
                <Link href={`/register${switchQuery}`} className="text-accent hover:underline ml-1">
                  免费注册
                </Link>
              </>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  return (
    <Suspense>
      <AuthFormInner mode={mode} />
    </Suspense>
  );
}
