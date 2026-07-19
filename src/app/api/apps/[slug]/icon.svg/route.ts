export const dynamic = "force-static";

const ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#0d0e1c"/>
  <g fill="none" stroke="#8b7cff" stroke-width="20">
    <ellipse cx="256" cy="256" rx="192" ry="80" transform="rotate(28 256 256)"/>
    <ellipse cx="256" cy="256" rx="192" ry="80" transform="rotate(-28 256 256)"/>
  </g>
  <circle cx="256" cy="256" r="48" fill="#8b7cff"/>
  <circle cx="400" cy="168" r="26" fill="#ffb454"/>
</svg>`;

export async function GET() {
  return new Response(ICON, {
    headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=86400" },
  });
}
