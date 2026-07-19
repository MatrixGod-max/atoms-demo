import FuseClient from "./FuseClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "聚变 — Fusion" };

export default async function FusePage({ searchParams }: { searchParams: Promise<{ a?: string; b?: string }> }) {
  const { a, b } = await searchParams;
  return <FuseClient a={a ?? ""} b={b ?? ""} />;
}
