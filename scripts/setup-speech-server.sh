#!/usr/bin/env bash
# Fusion 语音转写服务(faster-whisper)一次性安装(幂等)。在平台本机执行,远程操作全部经 ssh:
#   bash scripts/setup-speech-server.sh
# 产出(214 上):
#   ~/fusion-speech/venv + server.py      FastAPI /transcribe(token 鉴权)+ /health
#   /etc/fusion-speech.env                SPEECH_TOKEN / WHISPER_MODEL / 代理(600 权限)
#   fusion-speech.service                 systemd,Restart=always,端口 8022
# 模型:faster-whisper small(int8,CPU——不占用 GPU 驻留模型);首次启动经 214 代理自
# HF 下载(~460MB,HF_HOME 固定在 ~/fusion-speech/hf-cache);换模型改 WHISPER_MODEL 后重启。
# 本脚本同时把 SPEECH_SERVICE_URL/TOKEN 写入本地 .env 与 .env.production(gitignored,不打印值)。
set -euo pipefail

HOST="${SPEECH_HOST:-ubuntu@10.234.201.214}"
PORT=8022

# ---- token:本地已有则复用,否则生成;绝不打印 ----
TOKEN="$(grep -s '^SPEECH_SERVICE_TOKEN=' .env.production | head -1 | cut -d= -f2- || true)"
if [ -z "$TOKEN" ]; then
  TOKEN="$(openssl rand -hex 24)"
fi

echo "== [1/4] 部署服务代码与虚拟环境($HOST)"
ssh "$HOST" 'bash -s' <<'REMOTE'
set -euo pipefail
BASE="$HOME/fusion-speech"
mkdir -p "$BASE/hf-cache"
cd "$BASE"
if [ ! -x venv/bin/python ]; then python3 -m venv venv; fi
./venv/bin/pip install -q -i https://pypi.tuna.tsinghua.edu.cn/simple -U pip
./venv/bin/pip install -q -i https://pypi.tuna.tsinghua.edu.cn/simple "faster-whisper>=1.1" fastapi "uvicorn[standard]" python-multipart

cat > server.py <<'PYEOF'
"""Fusion 语音转写:faster-whisper(CPU int8),平台专用(x-speech-token 鉴权)。"""
import io
import os
import time

from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from faster_whisper import WhisperModel

MODEL_NAME = os.environ.get("WHISPER_MODEL", "small")
THREADS = int(os.environ.get("WHISPER_THREADS", "8"))
TOKEN = os.environ.get("SPEECH_TOKEN", "")
MAX_BYTES = 5 * 1024 * 1024

model = WhisperModel(MODEL_NAME, device="cpu", compute_type="int8", cpu_threads=THREADS)
app = FastAPI()


@app.get("/health")
def health():
    return {"ok": True, "model": MODEL_NAME}


@app.post("/transcribe")
async def transcribe(audio: UploadFile = File(...), x_speech_token: str = Header(default="")):
    if not TOKEN or x_speech_token != TOKEN:
        raise HTTPException(status_code=401, detail="bad token")
    data = await audio.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="audio too large")
    if len(data) < 200:
        raise HTTPException(status_code=400, detail="audio too short")
    t0 = time.time()
    try:
        segments, _info = model.transcribe(
            io.BytesIO(data),
            language="zh",
            beam_size=1,
            vad_filter=True,
            initial_prompt="以下是简体中文普通话的内容。",
        )
        text = "".join(s.text for s in segments).strip()
    except Exception as exc:  # 解码失败等
        raise HTTPException(status_code=422, detail=f"decode/transcribe failed: {exc}") from exc
    return {"text": text, "duration_ms": int((time.time() - t0) * 1000)}
PYEOF
echo "server.py 就绪"
REMOTE

echo "== [2/4] 写入服务环境(token 不回显)与 systemd 单元"
printf 'SPEECH_TOKEN=%s\nWHISPER_MODEL=small\nWHISPER_THREADS=8\nhttp_proxy=http://127.0.0.1:7890\nhttps_proxy=http://127.0.0.1:7890\nHTTP_PROXY=http://127.0.0.1:7890\nHTTPS_PROXY=http://127.0.0.1:7890\n' "$TOKEN" \
  | ssh "$HOST" 'sudo tee /etc/fusion-speech.env >/dev/null && sudo chmod 600 /etc/fusion-speech.env'

ssh "$HOST" 'sudo tee /etc/systemd/system/fusion-speech.service >/dev/null' <<UNIT
[Unit]
Description=Fusion speech transcription (faster-whisper)
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/fusion-speech
EnvironmentFile=/etc/fusion-speech.env
Environment=HF_HOME=/home/ubuntu/fusion-speech/hf-cache
ExecStart=/home/ubuntu/fusion-speech/venv/bin/uvicorn server:app --host 0.0.0.0 --port $PORT
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT

echo "== [3/4] 启动服务(首次启动会下载模型,~460MB 经代理)"
ssh "$HOST" 'sudo systemctl daemon-reload && sudo systemctl enable --now fusion-speech && sleep 2 && sudo systemctl is-active fusion-speech'

echo "== [4/4] 本地 env 写入(.env / .env.production,gitignored)"
for f in .env .env.production; do
  [ -f "$f" ] || touch "$f"
  grep -q '^SPEECH_SERVICE_URL=' "$f" || printf 'SPEECH_SERVICE_URL=http://10.234.201.214:%s\n' "$PORT" >> "$f"
  grep -q '^SPEECH_SERVICE_TOKEN=' "$f" || printf 'SPEECH_SERVICE_TOKEN=%s\n' "$TOKEN" >> "$f"
done

echo "== 完成。健康检查(模型加载完成前可能 connection refused,稍候重试):"
echo "   curl -fsS http://10.234.201.214:$PORT/health"
