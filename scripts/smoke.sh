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
timeout 120 curl -fsS -N -b "$JAR" "$BASE_URL/api/jobs/$JOB/stream" | grep -q '"type":"version"' || fail "no version event"

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

step "mobile project: PWA artifact"
MPROJ=$(curl -fsS -b "$JAR" -X POST "$BASE_URL/api/projects" \
  -H 'content-type: application/json' -d '{"prompt":"smoke 移动应用","platform":"mobile"}' | sed -E 's/.*"id":"([^"]+)".*/\1/')
MJOB=$(curl -fsS -b "$JAR" -X POST "$BASE_URL/api/projects/$MPROJ/generate" \
  -H 'content-type: application/json' -d '{"prompt":"smoke 移动应用"}' | sed -E 's/.*"jobId":"([^"]+)".*/\1/')
timeout 120 curl -fsS -N -b "$JAR" "$BASE_URL/api/jobs/$MJOB/stream" | grep -q '"type":"version"' || fail "mobile generate"
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

step "unauthenticated dashboard access is redirected"
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/dashboard")
[ "$CODE" = "307" ] || [ "$CODE" = "302" ] || fail "dashboard should redirect, got $CODE"

echo "SMOKE OK"
