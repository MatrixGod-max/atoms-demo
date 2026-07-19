"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const TIERS = [
  {
    id: "free",
    name: "Free 免费版",
    price: "¥0",
    perks: ["注册赠送 20 积分", "快速模式生成", "发布到公开画廊"],
  },
  {
    id: "pro",
    name: "Pro 专业版",
    price: "¥49/月(演示)",
    perks: ["升级奖励 +100 积分", "深度思考模式", "自定义域名绑定"],
  },
  {
    id: "max",
    name: "Max 旗舰版",
    price: "¥199/月(演示)",
    perks: ["升级奖励 +400 积分", "团队协作智能体", "全部 Pro 权益"],
  },
] as const;

export default function PlanCards({ current, isDemo }: { current: string; isDemo: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const choose = async (plan: string) => {
    if (busy) return;
    setBusy(plan);
    setMsg(null);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const d = await res.json();
      if (res.ok) {
        setMsg({ ok: true, text: d.bonus > 0 ? `已切换套餐,+${d.bonus} 积分已到账` : "已切换套餐" });
        window.dispatchEvent(new Event("credits-changed"));
        router.refresh();
      } else {
        setMsg({ ok: false, text: d.error ?? "操作失败" });
      }
    } catch {
      setMsg({ ok: false, text: "网络错误,请重试" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="grid sm:grid-cols-3 gap-4">
        {TIERS.map((t) => {
          const active = t.id === current;
          return (
            <div key={t.id} className={`card p-6 flex flex-col ${active ? "border-accent" : ""}`}>
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-semibold">{t.name}</h2>
                {active && <span className="spec-chip px-2 py-0.5 text-[10px] text-accent">当前套餐</span>}
              </div>
              <p className="font-mono text-sm text-muted mb-4">{t.price}</p>
              <ul className="flex flex-col gap-1.5 text-xs text-muted flex-1 mb-5">
                {t.perks.map((p) => (
                  <li key={p} className="flex gap-1.5">
                    <span className="text-good">✓</span>
                    {p}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className={`${active ? "btn-ghost" : "btn-primary"} px-4 py-2 text-sm`}
                disabled={active || isDemo || busy !== null}
                onClick={() => choose(t.id)}
              >
                {active ? "使用中" : busy === t.id ? "切换中…" : t.id === "free" ? "切换" : "升级"}
              </button>
            </div>
          );
        })}
      </div>
      {msg && <p className={`mt-4 text-sm ${msg.ok ? "text-good" : "text-bad"}`}>{msg.text}</p>}
      {isDemo && <p className="mt-4 text-xs text-muted">演示账号只读,注册即可体验完整功能。</p>}
    </div>
  );
}
