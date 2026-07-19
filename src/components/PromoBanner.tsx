"use client";

import { useSyncExternalStore } from "react";

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
  if (dismissed) return null;

  return (
    <div className="relative bg-[#2563eb] text-white text-sm flex items-center justify-center gap-3 px-10 py-2">
      <span className="opacity-90">🏷</span>
      <span>
        领取你的 <strong>26 美元免费积分</strong>,立即开始使用 Cloud &amp; AI 进行构建。
      </span>
      <button
        type="button"
        className="px-3 py-0.5 rounded-full bg-white text-[#2563eb] text-xs font-semibold hover:bg-white/90 transition-colors"
        title="即将推出"
      >
        领取 ↗
      </button>
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
