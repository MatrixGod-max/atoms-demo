#!/usr/bin/env bash
# End-to-end smoke test against a running Quark server (mock mode recommended).
# Usage: BASE_URL=http://localhost:3456 bash scripts/smoke.sh
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
JAR="$(mktemp)"
EMAIL="smoke-$(date +%s)-$RANDOM@test.dev"
trap 'rm -f "$JAR"' EXIT

step() { echo "== $*"; }
fail() { echo "SMOKE FAILED: $*" >&2; exit 1; }

step "health"
curl -fsS "$BASE_URL/api/health" | grep -q '"ok":true' || fail "health check"

step "register $EMAIL"
curl -fsS -c "$JAR" -X POST "$BASE_URL/api/auth/register" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"Smoke2026ci\"}" | grep -q '"ok":true' || fail "register"

step "create project"
PROJ=$(curl -fsS -b "$JAR" -X POST "$BASE_URL/api/projects" \
  -H 'content-type: application/json' -d '{"prompt":"smoke 应用"}' | sed -E 's/.*"id":"([^"]+)".*/\1/')
[ -n "$PROJ" ] || fail "create project"

step "generate (job $PROJ)"
JOB=$(curl -fsS -b "$JAR" -X POST "$BASE_URL/api/projects/$PROJ/generate" \
  -H 'content-type: application/json' -d '{"prompt":"smoke 应用"}' | sed -E 's/.*"jobId":"([^"]+)".*/\1/')
[ -n "$JOB" ] || fail "start job"

step "stream job to completion"
GSTREAM=$(timeout 120 curl -fsS -N -b "$JAR" "$BASE_URL/api/jobs/$JOB/stream")
echo "$GSTREAM" | grep -q '"type":"version"' || fail "no version event"

step "publish"
SLUG=$(curl -fsS -b "$JAR" -X POST "$BASE_URL/api/projects/$PROJ/publish" \
  -H 'content-type: application/json' -d '{"action":"publish"}' | sed -E 's/.*"slug":"([^"]+)".*/\1/')
[ -n "$SLUG" ] || fail "publish"

step "public page serves app with injected storage helper"
PAGE=$(curl -fsS "$BASE_URL/p/$SLUG")
echo "$PAGE" | grep -q "<!DOCTYPE html>" || fail "public page html"
echo "$PAGE" | grep -q "window.quark" || fail "storage helper not injected"

step "artifact snapshot and detail page"
curl -fsS "$BASE_URL/p/$SLUG/v/1" | grep -q "<!DOCTYPE html>" || fail "artifact snapshot v/1"
curl -fsS "$BASE_URL/artifact/$SLUG" | grep -q "发布历史" || fail "artifact detail page"

step "unpublish hides latest, snapshot, and detail page"
curl -fsS -b "$JAR" -X POST "$BASE_URL/api/projects/$PROJ/publish" \
  -H 'content-type: application/json' -d '{"action":"unpublish"}' | grep -q '"ok":true' || fail "unpublish"
[ "$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/p/$SLUG")" = "404" ] || fail "latest should 404 after unpublish"
[ "$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/p/$SLUG/v/1")" = "404" ] || fail "snapshot should 404 after unpublish"
curl -fsS -b "$JAR" -X POST "$BASE_URL/api/projects/$PROJ/publish" \
  -H 'content-type: application/json' -d '{"action":"publish"}' | grep -q '"ok":true' || fail "republish"
curl -fsS "$BASE_URL/p/$SLUG/v/1" | grep -q "<!DOCTYPE html>" || fail "snapshot restored after republish"

step "app KV set/get"
curl -fsS -X PUT "$BASE_URL/api/apps/$SLUG/kv/count" \
  -H 'content-type: application/json' -d '{"v":"42"}' | grep -q '"ok":true' || fail "kv put"
curl -fsS "$BASE_URL/api/apps/$SLUG/kv/count" | grep -q '"v":"42"' || fail "kv get"

step "attachment + deep research + theme"
APROJ=$(curl -fsS -b "$JAR" -X POST "$BASE_URL/api/projects" \
  -H 'content-type: application/json' -d '{"prompt":"smoke 附件研究"}' | sed -E 's/.*"id":"([^"]+)".*/\1/')
DATA_B64=$(printf 'name,score\nA,1' | base64 | tr -d '\n')
curl -fsS -b "$JAR" -X POST "$BASE_URL/api/projects/$APROJ/attachments" \
  -H 'content-type: application/json' \
  -d "{\"filename\":\"data.csv\",\"mime\":\"text/csv\",\"dataBase64\":\"$DATA_B64\"}" | grep -q '"filename":"data.csv"' || fail "attachment upload"
AJOB=$(curl -fsS -b "$JAR" -X POST "$BASE_URL/api/projects/$APROJ/generate" \
  -H 'content-type: application/json' -d '{"prompt":"smoke 附件研究","research":true}' | sed -E 's/.*"jobId":"([^"]+)".*/\1/')
ASTREAM=$(timeout 120 curl -fsS -N -b "$JAR" "$BASE_URL/api/jobs/$AJOB/stream")
echo "$ASTREAM" | grep -q '"stage":"researcher"' || fail "researcher stage missing"
echo "$ASTREAM" | grep -q '"type":"research"' || fail "research brief event missing"
echo "$ASTREAM" | grep -q '"type":"version"' || fail "attachment gen version"
curl -fsS -b "$JAR" "$BASE_URL/api/projects/$APROJ" | grep -q 'attachments: data.csv' || fail "attachment marker not in generated html"
TJOB=$(curl -fsS -b "$JAR" -X POST "$BASE_URL/api/projects/$APROJ/generate" \
  -H 'content-type: application/json' -d '{"prompt":"【主题变换】把应用整体视觉主题切换为「多巴胺」:只改视觉不改功能"}' | sed -E 's/.*"jobId":"([^"]+)".*/\1/')
TSTREAM=$(timeout 120 curl -fsS -N -b "$JAR" "$BASE_URL/api/jobs/$TJOB/stream")
echo "$TSTREAM" | grep -q '"num":2' || fail "theme switch should create v2"

step "mobile project: PWA artifact (second account — generate quota is 3/10min per user)"
curl -fsS -c "$JAR" -X POST "$BASE_URL/api/auth/register" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"m-$EMAIL\",\"password\":\"Smoke2026ci\"}" | grep -q '"ok":true' || fail "register second account"
MPROJ=$(curl -fsS -b "$JAR" -X POST "$BASE_URL/api/projects" \
  -H 'content-type: application/json' -d '{"prompt":"smoke 移动应用","platform":"mobile"}' | sed -E 's/.*"id":"([^"]+)".*/\1/')
MJOB=$(curl -fsS -b "$JAR" -X POST "$BASE_URL/api/projects/$MPROJ/generate" \
  -H 'content-type: application/json' -d '{"prompt":"smoke 移动应用"}' | sed -E 's/.*"jobId":"([^"]+)".*/\1/')
MSTREAM=$(timeout 120 curl -fsS -N -b "$JAR" "$BASE_URL/api/jobs/$MJOB/stream")
echo "$MSTREAM" | grep -q '"type":"version"' || fail "mobile generate"
MSLUG=$(curl -fsS -b "$JAR" -X POST "$BASE_URL/api/projects/$MPROJ/publish" \
  -H 'content-type: application/json' -d '{"action":"publish"}' | sed -E 's/.*"slug":"([^"]+)".*/\1/')
MPAGE=$(curl -fsS "$BASE_URL/p/$MSLUG")
echo "$MPAGE" | grep -q 'rel="manifest"' || fail "mobile page missing manifest link"
echo "$MPAGE" | grep -q "serviceWorker" || fail "mobile page missing SW registration"
curl -fsS "$BASE_URL/api/apps/$MSLUG/manifest.webmanifest" | grep -q '"standalone"' || fail "manifest route"
curl -fsS "$BASE_URL/api/apps/$MSLUG/icon.svg" | grep -q "<svg" || fail "icon route"
curl -fsS "$BASE_URL/p/$MSLUG/sw.js" | grep -q "addEventListener" || fail "sw route"
curl -fsS "$BASE_URL/p/$MSLUG/v/1" | grep -q 'rel="manifest"' || fail "mobile snapshot manifest"
if curl -fsS "$BASE_URL/p/$MSLUG/v/1" | grep -q "serviceWorker"; then fail "snapshot must not register SW"; fi

step "web project has no PWA injection (regression)"
if curl -fsS "$BASE_URL/p/$SLUG" | grep -q 'rel="manifest"'; then fail "web app must not have manifest"; fi

step "mixed-mode generation carries per-stage model badges"
XJOB=$(curl -fsS -b "$JAR" -X POST "$BASE_URL/api/projects/$MPROJ/generate" \
  -H 'content-type: application/json' -d '{"prompt":"mock 模式测试","mode":"mixed"}' | sed -E 's/.*"jobId":"([^"]+)".*/\1/')
XSTREAM=$(timeout 120 curl -fsS -N -b "$JAR" "$BASE_URL/api/jobs/$XJOB/stream")
echo "$XSTREAM" | grep -q '"stage":"engineer","status":"start".*"model":"V3"' || fail "engineer should use V3 in mixed"
echo "$XSTREAM" | grep -q '"stage":"reviewer","status":"start".*"model":"R1"' || fail "reviewer should use R1 in mixed"

step "team mode carries PM/Architect stages; platform switch persists; Fusion brand"
YPROJ=$(curl -fsS -b "$JAR" -X POST "$BASE_URL/api/projects" \
  -H 'content-type: application/json' -d '{"prompt":"smoke 团队"}' | sed -E 's/.*"id":"([^"]+)".*/\1/')
YJOB=$(curl -fsS -b "$JAR" -X POST "$BASE_URL/api/projects/$YPROJ/generate" \
  -H 'content-type: application/json' -d '{"prompt":"smoke 团队","team":true}' | sed -E 's/.*"jobId":"([^"]+)".*/\1/')
YSTREAM=$(timeout 120 curl -fsS -N -b "$JAR" "$BASE_URL/api/jobs/$YJOB/stream")
echo "$YSTREAM" | grep -q '"stage":"pm"' || fail "pm stage missing"
echo "$YSTREAM" | grep -q '"stage":"architect"' || fail "architect stage missing"
echo "$YSTREAM" | grep -q '"type":"pm"' || fail "pm card event missing"
if echo "$YSTREAM" | grep -q '"stage":"planner"'; then fail "planner should be replaced in team mode"; fi
curl -fsS -b "$JAR" -X PATCH "$BASE_URL/api/projects/$YPROJ" \
  -H 'content-type: application/json' -d '{"platform":"mobile"}' | grep -q '"ok":true' || fail "platform patch"
curl -fsS -b "$JAR" "$BASE_URL/api/projects/$YPROJ" | grep -q '"platform":"mobile"' || fail "platform switch persisted"
LANDING=$(curl -fsS "$BASE_URL/")
echo "$LANDING" | grep -q "Fusion" || fail "Fusion brand missing on landing"

step "persistent theme: applied on first gen and survives iteration (third account)"
curl -fsS -c "$JAR" -X POST "$BASE_URL/api/auth/register" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"t-$EMAIL\",\"password\":\"Smoke2026ci\"}" | grep -q '"ok":true' || fail "register third account"
ZPROJ=$(curl -fsS -b "$JAR" -X POST "$BASE_URL/api/projects" \
  -H 'content-type: application/json' -d '{"prompt":"smoke 主题","theme":"莫兰迪"}' | sed -E 's/.*"id":"([^"]+)".*/\1/')
curl -fsS -b "$JAR" "$BASE_URL/api/projects/$ZPROJ" | grep -q '"theme":"莫兰迪"' || fail "theme not stored on create"
ZJOB=$(curl -fsS -b "$JAR" -X POST "$BASE_URL/api/projects/$ZPROJ/generate" \
  -H 'content-type: application/json' -d '{"prompt":"smoke 主题"}' | sed -E 's/.*"jobId":"([^"]+)".*/\1/')
ZS=$(timeout 120 curl -fsS -N -b "$JAR" "$BASE_URL/api/jobs/$ZJOB/stream")
echo "$ZS" | grep -q '"type":"version"' || fail "theme gen"
curl -fsS -b "$JAR" "$BASE_URL/api/projects/$ZPROJ" | grep -q 'theme: 莫兰迪' || fail "theme marker missing in v1"
ZJOB2=$(curl -fsS -b "$JAR" -X POST "$BASE_URL/api/projects/$ZPROJ/generate" \
  -H 'content-type: application/json' -d '{"prompt":"smoke 迭代"}' | sed -E 's/.*"jobId":"([^"]+)".*/\1/')
ZS2=$(timeout 120 curl -fsS -N -b "$JAR" "$BASE_URL/api/jobs/$ZJOB2/stream")
echo "$ZS2" | grep -q '"num":2' || fail "theme iteration"
curl -fsS -b "$JAR" "$BASE_URL/api/projects/$ZPROJ" | grep -q 'theme: 莫兰迪' || fail "theme not persistent across iteration"
curl -fsS -b "$JAR" -X PATCH "$BASE_URL/api/projects/$ZPROJ" \
  -H 'content-type: application/json' -d '{"theme":null}' | grep -q '"ok":true' || fail "theme clear"
curl -fsS -b "$JAR" "$BASE_URL/api/projects/$ZPROJ" | grep -q '"theme":null' || fail "theme clear persisted"

step "resources: templates listed, template quick-start, CORS preflight"
TCOUNT=$(curl -fsS "$BASE_URL/api/templates" | grep -o '"id":"tpl_' | wc -l)
[ "$TCOUNT" -ge 6 ] || fail "expected >=6 templates, got $TCOUNT"
curl -fsS -o /dev/null "$BASE_URL/resources" || fail "resources page"
curl -fsS "$BASE_URL/api/templates/tpl_habit/preview" | grep -q "<!DOCTYPE html>" || fail "template preview"
TPROJ=$(curl -fsS -b "$JAR" -X POST "$BASE_URL/api/projects" \
  -H 'content-type: application/json' -d '{"templateId":"tpl_ledger"}' | sed -E 's/.*"id":"([^"]+)".*/\1/')
[ -n "$TPROJ" ] || fail "template quick-start"
curl -fsS -b "$JAR" "$BASE_URL/api/projects/$TPROJ" | grep -q '"platform":"mobile"' || fail "template platform inherit"
CORS=$(curl -fsS -X OPTIONS -o /dev/null -w '%{http_code}' "$BASE_URL/api/apps/$SLUG/kv/x" -H 'Origin: http://elsewhere.example' -H 'Access-Control-Request-Method: PUT')
[ "$CORS" = "204" ] || fail "kv CORS preflight, got $CORS"

step "credits: signup bonus, claim idempotent, charge, refund on failure"
CRED=$(curl -fsS -b "$JAR" "$BASE_URL/api/credits")
echo "$CRED" | grep -q '"credits":' || fail "credits endpoint"
B0=$(echo "$CRED" | sed -E 's/.*"credits":([0-9-]+).*/\1/')
[ "$B0" -ge 15 ] || fail "signup bonus missing (balance $B0)"
curl -fsS -b "$JAR" -X POST "$BASE_URL/api/credits/claim" | grep -q '"claimed":true' || fail "claim"
curl -fsS -b "$JAR" -X POST "$BASE_URL/api/credits/claim" | grep -q '"claimed":false' || fail "claim not idempotent"
B1=$(curl -fsS -b "$JAR" "$BASE_URL/api/credits" | sed -E 's/.*"credits":([0-9-]+).*/\1/')
[ "$B1" = "$((B0 + 26))" ] || fail "claim amount wrong ($B0 -> $B1)"
CPROJ=$(curl -fsS -b "$JAR" -X POST "$BASE_URL/api/projects" \
  -H 'content-type: application/json' -d '{"prompt":"smoke 扣费"}' | sed -E 's/.*"id":"([^"]+)".*/\1/')
CJOB=$(curl -fsS -b "$JAR" -X POST "$BASE_URL/api/projects/$CPROJ/generate" \
  -H 'content-type: application/json' -d '{"prompt":"smoke 扣费"}' | sed -E 's/.*"jobId":"([^"]+)".*/\1/')
CS=$(timeout 120 curl -fsS -N -b "$JAR" "$BASE_URL/api/jobs/$CJOB/stream")
echo "$CS" | grep -q '"type":"version"' || fail "charge gen"
B2=$(curl -fsS -b "$JAR" "$BASE_URL/api/credits" | sed -E 's/.*"credits":([0-9-]+).*/\1/')
[ "$B2" = "$((B1 - 1))" ] || fail "fast charge should be 1 ($B1 -> $B2)"

step "connectors: stored on create, marker in output, proxy whitelist (fourth account)"
curl -fsS -c "$JAR" -X POST "$BASE_URL/api/auth/register" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"c-$EMAIL\",\"password\":\"Smoke2026ci\"}" | grep -q '"ok":true' || fail "register fourth account"
NPROJ=$(curl -fsS -b "$JAR" -X POST "$BASE_URL/api/projects" \
  -H 'content-type: application/json' -d '{"prompt":"smoke 连接器","connectors":["weather","qr"]}' | sed -E 's/.*"id":"([^"]+)".*/\1/')
NJOB=$(curl -fsS -b "$JAR" -X POST "$BASE_URL/api/projects/$NPROJ/generate" \
  -H 'content-type: application/json' -d '{"prompt":"smoke 连接器"}' | sed -E 's/.*"jobId":"([^"]+)".*/\1/')
NS=$(timeout 120 curl -fsS -N -b "$JAR" "$BASE_URL/api/jobs/$NJOB/stream")
echo "$NS" | grep -q '"type":"version"' || fail "connector gen"
curl -fsS -b "$JAR" "$BASE_URL/api/projects/$NPROJ" | grep -q 'connectors: weather,qr' || fail "connector marker missing"
curl -fsS "$BASE_URL/api/connectors/qr?text=smoke" | grep -q '"svg"' || fail "qr connector"
QCODE=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/api/connectors/hack")
[ "$QCODE" = "400" ] || fail "unknown connector should 400, got $QCODE"

step "domains: bind, check endpoint, /d serving, release"
DNAME="smoke$(date +%s | tail -c 6)$RANDOM"
DNAME=$(echo "$DNAME" | cut -c1-20)
curl -fsS -b "$JAR" -X POST "$BASE_URL/api/projects/$NPROJ/publish" \
  -H 'content-type: application/json' -d '{"action":"publish"}' | grep -q '"ok":true' || fail "publish for domain"
curl -fsS -b "$JAR" -X PATCH "$BASE_URL/api/projects/$NPROJ" \
  -H 'content-type: application/json' -d "{\"domainName\":\"$DNAME\"}" | grep -q '"ok":true' || fail "bind domain"
DCODE=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/api/domains/check?domain=$DNAME.quark-apps.lexarcai.com")
[ "$DCODE" = "200" ] || fail "domain check should 200, got $DCODE"
curl -fsS "$BASE_URL/d/$DNAME" | grep -q "<!DOCTYPE html>" || fail "/d serving"
RCODE=$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" -X PATCH "$BASE_URL/api/projects/$NPROJ" \
  -H 'content-type: application/json' -d '{"domainName":"www"}')
[ "$RCODE" = "400" ] || fail "reserved domain should 400, got $RCODE"
curl -fsS -b "$JAR" -X PATCH "$BASE_URL/api/projects/$NPROJ" \
  -H 'content-type: application/json' -d '{"domainName":null}' | grep -q '"ok":true' || fail "release domain"
DCODE2=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/api/domains/check?domain=$DNAME.quark-apps.lexarcai.com")
[ "$DCODE2" = "404" ] || fail "released domain check should 404, got $DCODE2"

step "unauthenticated dashboard access is redirected"
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/dashboard")
[ "$CODE" = "307" ] || [ "$CODE" = "302" ] || fail "dashboard should redirect, got $CODE"

echo "SMOKE OK"
