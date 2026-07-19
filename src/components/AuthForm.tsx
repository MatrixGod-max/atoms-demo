"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { launchProject } from "./PromptLauncher";

function AuthFormInner({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "请求失败,请重试");
      setBusy(false);
      return;
    }
    // If the user typed an idea on the landing page before signing up, launch it now.
    if (params.get("next") === "launch") {
      const boot = sessionStorage.getItem("quark_boot");
      if (boot) {
        sessionStorage.removeItem("quark_boot");
        const id = await launchProject(boot);
        if (id) {
          router.push(`/project/${id}`);
          return;
        }
      }
    }
    router.push("/dashboard");
  }

  const isRegister = mode === "register";
  const switchQuery = params.get("next") === "launch" ? "?next=launch" : "";

  return (
    <div className="flex-1 flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center justify-center gap-2 font-semibold text-lg mb-8">
          <span className="text-accent text-2xl">⚛</span> Quark
        </Link>
        <form className="card p-6 flex flex-col gap-4" onSubmit={submit}>
          <h1 className="font-semibold text-lg">{isRegister ? "创建账号" : "欢迎回来"}</h1>
          {isRegister && (
            <label className="flex flex-col gap-1.5 text-sm">
              昵称
              <input
                className="input px-3 py-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="怎么称呼你(可选)"
                maxLength={40}
              />
            </label>
          )}
          <label className="flex flex-col gap-1.5 text-sm">
            邮箱
            <input
              className="input px-3 py-2"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            密码
            <input
              className="input px-3 py-2"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isRegister ? "至少 6 位" : "输入密码"}
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
