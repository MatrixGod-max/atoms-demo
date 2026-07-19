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
  -d "{\"email\":\"$EMAIL\",\"password\":\"smoke123\"}" | grep -q '"ok":true' || fail "register"

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
  -d "{\"email\":\"m-$EMAIL\",\"password\":\"smoke123\"}" | grep -q '"ok":true' || fail "register second account"
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

step "unauthenticated dashboard access is redirected"
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/dashboard")
[ "$CODE" = "307" ] || [ "$CODE" = "302" ] || fail "dashboard should redirect, got $CODE"

echo "SMOKE OK"
