import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev and prod run from the same checkout on this host; keep their build
  // artifacts apart so `next dev` can never corrupt the production .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
