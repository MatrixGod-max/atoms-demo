import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/auth";
import { ownedProject } from "@/lib/projects";
import Builder from "@/components/Builder";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) redirect("/login");
  const { id } = await params;
  if (!ownedProject(user.id, id)) notFound();
  return <Builder projectId={id} />;
}
