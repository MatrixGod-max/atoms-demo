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

step "app KV set/get"
curl -fsS -X PUT "$BASE_URL/api/apps/$SLUG/kv/count" \
  -H 'content-type: application/json' -d '{"v":"42"}' | grep -q '"ok":true' || fail "kv put"
curl -fsS "$BASE_URL/api/apps/$SLUG/kv/count" | grep -q '"v":"42"' || fail "kv get"

step "unauthenticated dashboard access is redirected"
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/dashboard")
[ "$CODE" = "307" ] || [ "$CODE" = "302" ] || fail "dashboard should redirect, got $CODE"

echo "SMOKE OK"
