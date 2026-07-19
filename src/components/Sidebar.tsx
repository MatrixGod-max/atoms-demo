"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import UserMenu, { type MenuUser } from "./UserMenu";

const NAV = [
  ["/", "⌂", "首页"],
  ["/resources", "❖", "资源"],
  ["/dashboard", "▤", "我的项目"],
] as const;

export default function Sidebar({
  user,
  projectCount,
}: {
  user: MenuUser | null;
  projectCount: number;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [events, setEvents] = useState<{ delta: number; reason: string; created_at: number }[]>([]);
  const [ledgerOpen, setLedgerOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const loadCredits = async () => {
      const res = await fetch("/api/credits");
      if (res.ok) {
        const d = await res.json();
        setCredits(d.credits);
        setEvents(d.events ?? []);
      }
    };
    loadCredits();
    window.addEventListener("credits-changed", loadCredits);
    return () => window.removeEventListener("credits-changed", loadCredits);
  }, [user]);

  const reasonLabel = (r: string) =>
    r === "signup" ? "注册赠送" : r === "banner" ? "横幅领取" : r.startsWith("refund") ? "失败返还" : r.startsWith("generate") ? `生成消耗(${r.split(":")[1] ?? ""})` : r.startsWith("plan:") ? "套餐升级奖励" : r.startsWith("redeem") ? "兑换码" : r;

  const nav = (
    <nav className="flex flex-col gap-0.5 px-2">
      {NAV.map(([href, icon, label]) => {
        const target = href === "/dashboard" && !user ? "/login" : href;
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={target}
            onClick={() => setDrawerOpen(false)}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
              active ? "bg-line/60 text-ink font-medium" : "text-ink/80 hover:bg-bg/80"
            }`}
            title={label}
          >
            <span className="w-4 text-center">{icon}</span>
            {!collapsed && <span>{label}</span>}
          </Link>
        );
      })}
    </nav>
  );

  const body = (
    <>
      <div className={`flex items-center px-4 py-4 ${collapsed ? "justify-center" : "justify-between"}`}>
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="text-lg">⚛</span>
          {!collapsed && <span>Fusion</span>}
        </Link>
        <button
          type="button"
          aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
          className="hidden sm:block text-muted hover:text-ink text-sm"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? "▸" : "◫"}
        </button>
      </div>

      {!collapsed && (
        <div className="px-3 mb-3">
          <button
            type="button"
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-bg border border-line text-sm hover:bg-bg-deep transition-colors"
            title="工作区"
          >
            <span className="w-6 h-6 rounded-md bg-accent/80 text-white text-xs font-semibold flex items-center justify-center">
              {(user?.name ?? "G")[0].toUpperCase()}
            </span>
            <span className="flex-1 text-left truncate">{user?.name ?? "Guest"}&rsquo;s Fusion</span>
            <span className="text-[10px] text-muted">▾</span>
          </button>
        </div>
      )}

      {nav}

      <div className="flex-1 flex items-center justify-center px-4">
        {!collapsed && user && projectCount === 0 && (
          <p className="text-xs text-muted text-center leading-relaxed">
            还没有项目
            <br />
            点击&ldquo;首页&rdquo;开始。
          </p>
        )}
      </div>

      {!collapsed && (
        <div className="px-3 pb-3 flex flex-col gap-2">
          <button type="button" className="card rounded-xl px-3.5 py-3 text-left flex items-center gap-3 hover:bg-bg-deep transition-colors" title="即将推出">
            <span className="text-base">👥</span>
            <span className="flex-1">
              <span className="block text-sm font-medium">加入我们的社区</span>
              <span className="block text-xs text-muted mt-0.5">最多可赚取 25 积分</span>
            </span>
            <span className="text-muted text-xs">›</span>
          </button>
          {user && credits !== null && (
            <div className="card rounded-xl px-3.5 py-3">
              <button type="button" className="w-full text-left flex items-center gap-3" onClick={() => setLedgerOpen(!ledgerOpen)}>
                <span className="text-base">🪙</span>
                <span className="flex-1">
                  <span className="block text-sm font-medium">积分余额</span>
                  <span className="block text-xs text-muted mt-0.5">生成按模式消耗,失败自动返还</span>
                </span>
                <span className="text-sm font-semibold">{credits}</span>
              </button>
              {ledgerOpen && (
                <div className="mt-2 pt-2 border-t border-line max-h-40 overflow-y-auto flex flex-col gap-1">
                  {events.length === 0 && <span className="text-xs text-muted">暂无明细</span>}
                  {events.map((e, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-muted">{reasonLabel(e.reason)}</span>
                      <span className={e.delta > 0 ? "text-good" : "text-muted"}>{e.delta > 0 ? `+${e.delta}` : e.delta}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {!user && (
            <button type="button" className="card rounded-xl px-3.5 py-3 text-left flex items-center gap-3 hover:bg-bg-deep transition-colors" title="注册即送 20 积分">
              <span className="text-base">🎁</span>
              <span className="flex-1">
                <span className="block text-sm font-medium">获取免费积分</span>
                <span className="block text-xs text-muted mt-0.5">注册即送 20 积分</span>
              </span>
              <span className="text-muted text-xs">›</span>
            </button>
          )}
          {user ? (
            <UserMenu user={user} />
          ) : (
            <div className="flex items-center gap-3 px-1 pt-1 text-xs text-muted">
              <Link href="/login" className="hover:text-ink">登录</Link>
              <Link href="/register" className="hover:text-ink">注册</Link>
            </div>
          )}
        </div>
      )}
    </>
  );

  return (
    <>
      {/* mobile top bar */}
      <div className="sm:hidden flex items-center justify-between px-4 py-3 border-b border-line bg-bg-deep">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="text-lg">☀</span> Fusion
        </Link>
        <button type="button" aria-label="打开菜单" className="text-xl px-1" onClick={() => setDrawerOpen(true)}>
          ☰
        </button>
      </div>

      {/* mobile drawer */}
      {drawerOpen && (
        <div className="sm:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-bg-deep border-r border-line flex flex-col overflow-y-auto">
            {body}
          </aside>
        </div>
      )}

      {/* desktop sidebar */}
      <aside
        className={`max-sm:hidden flex flex-col border-r border-line bg-bg-deep transition-[width] duration-150 ${
          collapsed ? "w-14" : "w-60"
        } shrink-0 sticky top-0 h-dvh overflow-y-auto`}
      >
        {body}
      </aside>
    </>
  );
}
