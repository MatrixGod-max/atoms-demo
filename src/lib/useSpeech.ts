"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SpeechState = "unsupported" | "idle" | "listening" | "transcribing";

const MAX_RECORD_MS = 60_000;
const MIN_RECORD_MS = 300;

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

/**
 * 语音输入:MediaRecorder 录音 → 平台 /api/speech/transcribe(自托管 whisper)转写。
 * v11 的 Web Speech API 实现依赖 Google 语音服务,在国内网络必然 network 报错,已整体替换;
 * 录音经平台转写后即弃,不落盘。接口保持 { state, error, toggle } 不变。
 */
export function useSpeech(onText: (text: string) => void) {
  const [state, setState] = useState<SpeechState>("idle");
  const [error, setError] = useState("");
  const onTextRef = useRef(onText);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  useEffect(() => {
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      const t = setTimeout(() => setState("unsupported"), 0);
      return () => clearTimeout(t);
    }
    return () => {
      // 卸载时终止录音与麦克风占用
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") {
        rec.onstop = null;
        rec.stop();
        rec.stream.getTracks().forEach((tr) => tr.stop());
      }
      if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    };
  }, []);

  const finishRecording = useCallback(async () => {
    const rec = recorderRef.current;
    if (!rec) return;
    recorderRef.current = null;
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    rec.stream.getTracks().forEach((tr) => tr.stop());
    const elapsed = Date.now() - startedAtRef.current;
    const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
    chunksRef.current = [];
    if (elapsed < MIN_RECORD_MS || blob.size < 200) {
      setState("idle");
      return; // 误触,静默忽略
    }
    setState("transcribing");
    try {
      const form = new FormData();
      form.append("audio", blob, "voice.webm");
      const res = await fetch("/api/speech/transcribe", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `转写失败(${res.status})`);
      } else if (data.text) {
        onTextRef.current(data.text);
      } else {
        setError("没有识别到内容,请靠近麦克风再试");
      }
    } catch {
      setError("网络错误,转写失败");
    }
    setState("idle");
  }, []);

  const toggle = useCallback(async () => {
    setError("");
    if (state === "transcribing") return;
    if (state === "listening") {
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") rec.stop(); // onstop → finishRecording
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMimeType();
      const rec = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => void finishRecording();
      recorderRef.current = rec;
      startedAtRef.current = Date.now();
      rec.start(1000);
      setState("listening");
      maxTimerRef.current = setTimeout(() => {
        const r = recorderRef.current;
        if (r && r.state !== "inactive") r.stop();
      }, MAX_RECORD_MS);
    } catch (err) {
      const name = (err as Error)?.name;
      setError(
        name === "NotAllowedError" || name === "SecurityError"
          ? "麦克风权限被拒绝,请在浏览器设置中允许"
          : name === "NotFoundError"
            ? "没有检测到麦克风设备"
            : "无法启动录音,请重试"
      );
      setState("idle");
    }
  }, [state, finishRecording]);

  return { state, error, toggle };
}
