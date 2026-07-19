"use client";

import { useState } from "react";
import PromptCard from "./PromptCard";

const AVATARS = ["🐻", "🐥", "🐨", "🐷", "🐼", "🐬", "🐢", "🦄"];
const AVATAR_BG = ["#fde8d7", "#fdf3c8", "#e8e4dc", "#fbd9e6", "#e3e9f7", "#d7e9fb", "#d9f2e5", "#e9defb"];

export default function HomeHero({ userName, loggedIn }: { userName: string | null; loggedIn: boolean }) {
  const [noticeVisible, setNoticeVisible] = useState(true);

  return (
    <section className="flex flex-col items-center pt-12 pb-10 px-6">
      {noticeVisible && (
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-bg-deep border border-line text-xs text-muted mb-8">
          <span>Notice</span>
          <span>·</span>
          <span className="text-ink/80">⚙ GPT-5.6 Sol is now available</span>
          <button
            type="button"
            aria-label="关闭通知"
            className="ml-1 hover:text-ink"
            onClick={() => setNoticeVisible(false)}
          >
            ×
          </button>
        </div>
      )}

      <div className="flex -space-x-1.5 mb-6">
        {AVATARS.map((a, i) => (
          <span
            key={a}
            className="w-10 h-10 rounded-full border-2 border-bg flex items-center justify-center text-lg"
            style={{ background: AVATAR_BG[i] }}
          >
            {a}
          </span>
        ))}
      </div>

      <h1 className="font-serif-display text-3xl sm:text-4xl font-bold text-center mb-10">
        {userName ? (
          <>你想创造什么,{userName}?</>
        ) : (
          <>你想创造什么?</>
        )}
      </h1>

      <div className="w-full max-w-2xl">
        <PromptCard loggedIn={loggedIn} />
      </div>
    </section>
  );
}
