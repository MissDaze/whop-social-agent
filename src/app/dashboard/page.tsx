import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/");
  if (!user.onboarded) redirect("/onboarding");
  return <DashboardClient user={user} />;
}
