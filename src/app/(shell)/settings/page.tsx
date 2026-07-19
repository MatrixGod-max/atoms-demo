import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import SettingsForm from "@/components/SettingsForm";

export const dynamic = "force-dynamic";

export const metadata = { title: "用户设置 — Fusion" };

export default async function SettingsPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex-1 max-w-2xl w-full mx-auto px-6 pb-16">
      <h1 className="font-serif-display font-bold text-2xl mt-10 mb-6">用户设置</h1>
      <SettingsForm name={user.name} email={user.email} isDemo={user.isDemo} />
    </div>
  );
}
