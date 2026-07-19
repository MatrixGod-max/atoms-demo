"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export interface MenuUser {
  id: string;
  name: string;
  email: string;
  plan: string;
  isDemo: boolean;
}

type ThemeMode = "light" | "dark" | "system";

const THEME_KEY = "fusion-theme";
const PLAN_LABEL: Record<string, string> = { free: "Free", pro: "Pro", max: "Max" };

function applyTheme(mode: ThemeMode) {
  const dark = mode === "dark" || (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  if (dark) document.documentElement.dataset.theme = "dark";
  else delete document.documentElement.dataset.theme;
}

export default function UserMenu({ user }: { user: MenuUser }) {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [redeemMsg, setRedeemMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") setThemeMode(stored);
  }, []);

  useEffect(() => {
    if (themeMode !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [themeMode]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const setTheme = (mode: ThemeMode) => {
    setThemeMode(mode);
    localStorage.setItem(THEME_KEY, mode);
    applyTheme(mode);
  };

  const submitRedeem = async () => {
    if (!code.trim() || redeeming) return;
    setRedeeming(true);
    setRedeemMsg(null);
    try {
      const res = await fetch("/api/credits/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const d = await res.json();
      if (res.ok) {
        setRedeemMsg({ ok: true, text: `+${d.amount} 积分已到账` });
        setCode("");
        window.dispatchEvent(new Event("credits-changed"));
      } else {
        setRedeemMsg({ ok: false, text: d.error ?? "兑换失败" });
      }
    } catch {
      setRedeemMsg({ ok: false, text: "网络错误,请重试" });
    } finally {
      setRedeeming(false);
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  const itemCls = "text-left px-3 py-1.5 text-xs rounded-md hover:bg-accent-soft flex items-center gap-2";

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-bg-deep transition-colors text-left"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="w-6 h-6 rounded-md bg-accent/80 text-white text-xs font-semibold flex items-center justify-center">
          {user.name[0]?.toUpperCase() ?? "?"}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-xs font-medium truncate">{user.name}</span>
          <span className="block text-[10px] text-muted">{PLAN_LABEL[user.plan] ?? user.plan} 套餐</span>
        </span>
        <span className="text-[10px] text-muted">▴</span>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-2 card p-1.5 z-30 flex flex-col">
          <div className="px-3 py-2 border-b border-line mb-1">
            <span className="block text-xs font-medium truncate">{user.name}</span>
            <span className="block text-xs text-muted truncate">{user.email}</span>
          </div>
          <Link href="/settings" className={itemCls} onClick={() => setOpen(false)}>
            <span className="w-4 text-center">⚙</span>用户设置
          </Link>
          <Link href="/plan" className={itemCls} onClick={() => setOpen(false)}>
            <span className="w-4 text-center">✦</span>套餐
            <span className="ml-auto text-[10px] text-muted">{PLAN_LABEL[user.plan] ?? user.plan}</span>
          </Link>
          <Link href={`/u/${user.id}`} className={itemCls} onClick={() => setOpen(false)}>
            <span className="w-4 text-center">◉</span>个人主页
          </Link>
          <div className="px-3 py-1.5 text-xs flex items-center gap-2">
            <span className="w-4 text-center">◐</span>外观
            <span className="ml-auto flex gap-0.5">
              {(
                [
                  ["light", "浅色"],
                  ["dark", "深色"],
                  ["system", "系统"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  className={`px-1.5 py-0.5 rounded text-[10px] ${
                    themeMode === mode ? "bg-accent-soft text-accent font-medium" : "text-muted hover:text-ink"
                  }`}
                  onClick={() => setTheme(mode)}
                >
                  {label}
                </button>
              ))}
            </span>
          </div>
          <button
            type="button"
            className={itemCls}
            onClick={() => {
              setOpen(false);
              setRedeemMsg(null);
              setRedeemOpen(true);
            }}
          >
            <span className="w-4 text-center">🎁</span>兑换
          </button>
          <div className="border-t border-line mt-1 pt-1">
            <button type="button" className={`${itemCls} w-full text-muted hover:text-ink`} onClick={logout}>
              <span className="w-4 text-center">↩</span>退出登录
            </button>
          </div>
        </div>
      )}

      {redeemOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setRedeemOpen(false)} />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="card p-5 w-72 pointer-events-auto">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">兑换积分</span>
                <button type="button" className="text-muted hover:text-ink text-sm" onClick={() => setRedeemOpen(false)} aria-label="关闭">
                  ✕
                </button>
              </div>
              <input
                className="input w-full px-3 py-2 text-sm font-mono"
                placeholder="FUSION-XXXX-XXXX"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitRedeem()}
                autoFocus
              />
              {redeemMsg && (
                <p className={`mt-2 text-xs ${redeemMsg.ok ? "text-good" : "text-bad"}`}>{redeemMsg.text}</p>
              )}
              <button
                type="button"
                className="btn-primary w-full mt-3 px-3 py-2 text-sm"
                disabled={redeeming || !code.trim()}
                onClick={submitRedeem}
              >
                {redeeming ? "兑换中…" : "兑换"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
