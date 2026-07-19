import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import PlanCards from "@/components/PlanCards";

export const dynamic = "force-dynamic";

export const metadata = { title: "套餐 — Fusion" };

export default async function PlanPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex-1 max-w-4xl w-full mx-auto px-6 pb-16">
      <h1 className="font-serif-display font-bold text-2xl mt-10 mb-2">套餐</h1>
      <p className="text-sm text-muted mb-6">选择适合你的档位。演示环境,升级不产生真实扣费。</p>
      <PlanCards current={user.plan} isDemo={user.isDemo} />
    </div>
  );
}
