"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface WalletEvent {
  delta: number;
  reason: string;
  created_at: number;
  category: string;
}

interface WalletData {
  balance: number;
  summary: Record<string, { spent: number; earned: number }>;
  events: WalletEvent[];
  cloud: {
    instances: { project_id: string; slug: string; hourly_rate: number; deployed_at: number | null }[];
    hourlyTotal: number;
    runwayHours: number | null;
  };
}

const CAT_ICON: Record<string, string> = {
  生成: "⚛",
  打包: "🤖",
  云服务: "☁️",
  充值奖励: "🎁",
  退款: "↩",
  其他: "·",
};

export default function WalletPage() {
  const [data, setData] = useState<WalletData | null>(null);
  const [moreEvents, setMoreEvents] = useState<WalletEvent[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [code, setCode] = useState("");
  const [redeemMsg, setRedeemMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/wallet");
    if (res.status === 401) {
      location.href = "/login";
      return;
    }
    if (res.ok) {
      setData(await res.json());
      setMoreEvents([]);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const events = data ? [...data.events, ...moreEvents] : [];

  async function loadMore() {
    if (!events.length || loadingMore) return;
    setLoadingMore(true);
    const res = await fetch(`/api/wallet?before=${events[events.length - 1].created_at}`);
    if (res.ok) {
      const d = (await res.json()) as WalletData;
      setMoreEvents((m) => [...m, ...d.events]);
    }
    setLoadingMore(false);
  }

  async function redeem() {
    if (!code.trim() || busy) return;
    setBusy(true);
    setRedeemMsg(null);
    const res = await fetch("/api/credits/redeem", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) {
      setRedeemMsg({ ok: true, text: `+${d.amount} 积分已到账` });
      setCode("");
      window.dispatchEvent(new Event("credits-changed"));
      load();
    } else {
      setRedeemMsg({ ok: false, text: d.error ?? "兑换失败" });
    }
    setBusy(false);
  }

  async function stopInstance(projectId: string) {
    await fetch(`/api/projects/${projectId}/cloud`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "stop" }),
    });
    load();
  }

  const spentTotal = data ? Object.values(data.summary).reduce((s, v) => s + v.spent, 0) : 0;

  return (
    <div className="flex-1 flex flex-col">
      <main className="flex-1 max-w-3xl w-full mx-auto px-6 pb-16">
        <header className="mt-8 mb-6">
          <p className="font-mono text-xs tracking-[0.25em] text-muted mb-2">AI WALLET</p>
          <h1 className="text-2xl font-bold">AI 钱包</h1>
        </header>

        {!data ? (
          <p className="text-muted text-sm">加载中…</p>
        ) : (
          <div className="flex flex-col gap-5">
            {/* 余额与兑换 */}
            <div className="card p-5 flex items-center gap-6 flex-wrap">
              <div>
                <p className="text-muted text-xs">当前余额</p>
                <p className="text-3xl font-bold mt-1">
                  {data.balance} <span className="text-sm font-normal text-muted">积分</span>
                </p>
                {data.cloud.runwayHours !== null && (
                  <p className="text-xs text-amber mt-1">
                    云实例耗费 {data.cloud.hourlyTotal} 积分/小时 · 余额可续航约 {data.cloud.runwayHours} 小时
                  </p>
                )}
              </div>
              <div className="ml-auto flex items-center gap-2">
                <input
                  className="input px-3 py-2 text-sm font-mono w-56"
                  placeholder="FUSION-XXXX-XXXX"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && redeem()}
                />
                <button className="btn-primary px-4 py-2 text-sm" onClick={redeem} disabled={busy || !code.trim()}>
                  兑换
                </button>
              </div>
              {redeemMsg && (
                <p className={`w-full text-sm ${redeemMsg.ok ? "text-good" : "text-bad"}`}>{redeemMsg.text}</p>
              )}
            </div>

            {/* 运行中云实例 */}
            {data.cloud.instances.length > 0 && (
              <div className="card p-5">
                <p className="font-semibold text-sm mb-3">☁️ 运行中的云实例</p>
                {data.cloud.instances.map((i) => (
                  <div key={i.slug} className="flex items-center gap-3 py-2 border-t border-line text-sm">
                    <span className="text-good animate-pulse">●</span>
                    <a href={`/c/${i.slug}`} target="_blank" rel="noopener" className="font-mono text-accent hover:underline">
                      /c/{i.slug}
                    </a>
                    <span className="text-muted text-xs">{i.hourly_rate} 积分/小时</span>
                    <Link href={`/project/${i.project_id}`} className="text-xs text-muted hover:text-ink ml-auto">
                      工作台 ↗
                    </Link>
                    <button className="btn-ghost px-2.5 py-1 text-xs text-muted hover:text-bad" onClick={() => stopInstance(i.project_id)}>
                      停止
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 分类汇总 */}
            <div className="card p-5">
              <p className="font-semibold text-sm mb-3">消费构成(累计消耗 {spentTotal} 积分)</p>
              <div className="flex flex-col gap-2">
                {Object.entries(data.summary)
                  .sort((a, b) => b[1].spent - a[1].spent)
                  .map(([cat, v]) => (
                    <div key={cat} className="flex items-center gap-3 text-sm">
                      <span className="w-24 shrink-0">
                        {CAT_ICON[cat] ?? "·"} {cat}
                      </span>
                      <div className="flex-1 h-2 bg-bg-deep rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent/70"
                          style={{ width: spentTotal ? `${Math.round((v.spent / spentTotal) * 100)}%` : 0 }}
                        />
                      </div>
                      <span className="text-muted text-xs w-28 text-right">
                        -{v.spent}{v.earned ? ` / +${v.earned}` : ""}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* 流水 */}
            <div className="card p-5">
              <p className="font-semibold text-sm mb-3">流水明细</p>
              {events.length === 0 ? (
                <p className="text-muted text-sm">还没有任何记录。</p>
              ) : (
                <div className="flex flex-col">
                  {events.map((e, i) => (
                    <div key={i} className="flex items-center gap-3 py-2 border-t border-line text-sm">
                      <span className="w-20 shrink-0 text-xs text-muted">{e.category}</span>
                      <span className="font-mono text-xs text-muted flex-1 truncate" title={e.reason}>
                        {e.reason}
                      </span>
                      <span className="text-xs text-muted">{new Date(e.created_at).toLocaleString("zh-CN")}</span>
                      <span className={`font-mono w-14 text-right ${e.delta >= 0 ? "text-good" : "text-ink"}`}>
                        {e.delta >= 0 ? `+${e.delta}` : e.delta}
                      </span>
                    </div>
                  ))}
                  {events.length >= 50 && (
                    <button className="btn-ghost px-3 py-1.5 text-xs mt-3 self-center" onClick={loadMore} disabled={loadingMore}>
                      {loadingMore ? "加载中…" : "加载更多"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
