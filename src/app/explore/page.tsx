import { redirect } from "next/navigation";

export default function ExploreRedirect() {
  redirect("/resources?tab=discover");
}
