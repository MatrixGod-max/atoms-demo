import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/**
 * 语音转写代理:浏览器录音(webm/opus 等)→ 自托管 faster-whisper 服务(214)。
 * 音频只透传不落盘;SPEECH_MOCK=1 返回固定文本(测试/CI)。
 */
const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
const ALLOWED_PREFIXES = ["audio/webm", "audio/ogg", "audio/mp4", "audio/wav", "audio/x-wav", "audio/mpeg"];
const UPSTREAM_TIMEOUT_MS = 15_000;

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const rl = rateLimit(`speech:${user.id}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: `转写过于频繁,请 ${rl.retryAfterSec} 秒后再试` }, { status: 429 });
  }

  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof File)) return NextResponse.json({ error: "缺少音频" }, { status: 400 });
  if (audio.size > MAX_AUDIO_BYTES) return NextResponse.json({ error: "录音过大(上限 5MB)" }, { status: 413 });
  if (audio.size < 200) return NextResponse.json({ error: "录音太短,请再试一次" }, { status: 400 });
  const type = audio.type || "audio/webm";
  if (!ALLOWED_PREFIXES.some((p) => type.startsWith(p))) {
    return NextResponse.json({ error: `不支持的音频格式(${type})` }, { status: 415 });
  }

  if (process.env.SPEECH_MOCK === "1") {
    return NextResponse.json({ text: "mock 语音转写结果" });
  }

  const upstream = process.env.SPEECH_SERVICE_URL;
  const token = process.env.SPEECH_SERVICE_TOKEN;
  if (!upstream || !token) {
    return NextResponse.json({ error: "语音服务未启用(未配置 SPEECH_SERVICE_URL)" }, { status: 503 });
  }

  const fwd = new FormData();
  fwd.append("audio", audio, audio.name || "audio.webm");
  try {
    const res = await fetch(`${upstream.replace(/\/$/, "")}/transcribe`, {
      method: "POST",
      headers: { "x-speech-token": token },
      body: fwd,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: res.status === 422 ? "音频无法识别,请重录" : `语音服务错误(${res.status})` },
        { status: 502 }
      );
    }
    const data = (await res.json()) as { text?: string };
    return NextResponse.json({ text: (data.text ?? "").trim() });
  } catch {
    return NextResponse.json({ error: "语音服务超时或不可达" }, { status: 504 });
  }
}
