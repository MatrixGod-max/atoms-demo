"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* Minimal typings for the Web Speech API (not in lib.dom for all TS configs). */
interface SpeechResultEvent {
  resultIndex: number;
  results: { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string } } };
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

export type SpeechState = "unsupported" | "idle" | "listening";

/** Real voice input via the browser's Web Speech API (zh-CN). Final results are appended via onText. */
export function useSpeech(onText: (text: string) => void) {
  const [state, setState] = useState<SpeechState>("idle");
  const [error, setError] = useState("");
  const recRef = useRef<Recognition | null>(null);
  const onTextRef = useRef(onText);
  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      // Defer so the lint-guarded "no sync setState in effect" cascade is avoided.
      const t = setTimeout(() => setState("unsupported"), 0);
      return () => clearTimeout(t);
    }
    const rec = new Ctor();
    rec.lang = "zh-CN";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) onTextRef.current(r[0].transcript);
      }
    };
    rec.onerror = (e) => {
      setError(
        e.error === "not-allowed"
          ? "麦克风权限被拒绝,请在浏览器设置中允许"
          : e.error === "no-speech"
            ? "没有听到声音,请再试一次"
            : `语音识别出错(${e.error})`
      );
      setState("idle");
    };
    rec.onend = () => setState((s) => (s === "listening" ? "idle" : s));
    recRef.current = rec;
    return () => {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try {
        rec.stop();
      } catch {
        // already stopped
      }
    };
  }, []);

  const toggle = useCallback(() => {
    const rec = recRef.current;
    if (!rec) return;
    setError("");
    if (state === "listening") {
      setState("idle");
      rec.stop();
    } else {
      try {
        rec.start();
        setState("listening");
      } catch {
        setError("语音启动失败,请重试");
      }
    }
  }, [state]);

  return { state, error, toggle };
}
