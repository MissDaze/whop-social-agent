import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import OnboardingClient from "./OnboardingClient";

export default async function OnboardingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/");
  if (user.onboarded) redirect("/dashboard");
  return <OnboardingClient userId={user.id} />;
}
