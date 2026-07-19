"use client";

import { useState, useSyncExternalStore } from "react";

const KEY = "quark_banner_dismissed";
let listeners: (() => void)[] = [];
const subscribe = (l: () => void) => {
  listeners.push(l);
  return () => {
    listeners = listeners.filter((x) => x !== l);
  };
};
const getSnapshot = () => sessionStorage.getItem(KEY) === "1";
// Hidden during SSR/hydration; appears after mount unless previously dismissed.
const getServerSnapshot = () => true;

export default function PromoBanner() {
  const dismissed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  if (dismissed) return null;

  async function claim() {
    if (busy) return;
    setBusy(true);
    const res = await fetch("/api/credits/claim", { method: "POST" });
    if (res.status === 401) {
      location.href = "/register";
      return;
    }
    const data = await res.json().catch(() => ({}));
    setMsg(data.claimed ? `已到账 +26,余额 ${data.credits} 积分 🎉` : data.message || "已领取过啦");
    window.dispatchEvent(new Event("credits-changed"));
    setBusy(false);
  }

  return (
    <div className="relative bg-[#2563eb] text-white text-sm flex items-center justify-center gap-3 px-10 py-2">
      <span className="opacity-90">🏷</span>
      <span>
        {msg || (
          <>
            领取你的 <strong>26 免费积分</strong>,立即开始用智能体团队构建。
          </>
        )}
      </span>
      {!msg && (
        <button
          type="button"
          className="px-3 py-0.5 rounded-full bg-white text-[#2563eb] text-xs font-semibold hover:bg-white/90 transition-colors"
          onClick={claim}
          disabled={busy}
        >
          {busy ? "…" : "领取 ↗"}
        </button>
      )}
      <button
        type="button"
        aria-label="关闭横幅"
        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/80 hover:text-white"
        onClick={() => {
          sessionStorage.setItem(KEY, "1");
          listeners.forEach((l) => l());
        }}
      >
        ×
      </button>
    </div>
  );
}
