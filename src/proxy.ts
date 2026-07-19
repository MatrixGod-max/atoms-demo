import { NextResponse, type NextRequest } from "next/server";

const APPS_HOST = process.env.APPS_HOST || "quark-apps.lexarcai.com";
const PLATFORM_ORIGIN = process.env.PLATFORM_ORIGIN || "https://quark.lexarcai.com";
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function proxy(req: NextRequest) {
  const host = (req.headers.get("host") || "").toLowerCase();
  const { pathname } = req.nextUrl;

  // Published-apps origin: isolated from the platform. Serves only apps, artifact snapshots, and their KV API.
  if (host === APPS_HOST) {
    if (pathname.startsWith("/api/apps/")) return NextResponse.next();
    const short = pathname.match(/^\/([a-z0-9]{4,16})(\/v\/[0-9]{1,4}|\/sw\.js)?$/);
    if (short) return NextResponse.rewrite(new URL(`/p/${short[1]}${short[2] ?? ""}`, req.url));
    if (/^\/p\/[a-z0-9]+(\/v\/[0-9]{1,4}|\/sw\.js)?$/.test(pathname)) return NextResponse.next();
    return NextResponse.redirect(PLATFORM_ORIGIN, 302);
  }

  // Platform origin: legacy /p/* links permanently move to the apps origin (prod only).
  if (process.env.APPS_REDIRECT === "1" && /^\/p\/[a-z0-9]+(\/v\/[0-9]{1,4})?$/.test(pathname)) {
    return NextResponse.redirect(`https://${APPS_HOST}${pathname.slice(2)}`, 301);
  }

  // CSRF guard: browser-issued mutations must come from our own origin.
  if (MUTATING.has(req.method) && pathname.startsWith("/api/")) {
    const origin = req.headers.get("origin");
    if (origin) {
      let originHost = "";
      try {
        originHost = new URL(origin).host.toLowerCase();
      } catch {
        // "null" or malformed origin stays empty and is rejected
      }
      if (originHost !== host) {
        return NextResponse.json({ error: "跨站请求被拒绝" }, { status: 403 });
      }
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
