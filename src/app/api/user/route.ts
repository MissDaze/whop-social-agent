import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { db } from "@/lib/db";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(user);
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json() as Record<string, string | boolean>;
  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      ...(body.openRouterKey !== undefined && { openRouterKey: String(body.openRouterKey) }),
      ...(body.whopApiKey !== undefined && { whopApiKey: String(body.whopApiKey) }),
      ...(body.redditAccountId !== undefined && { redditAccountId: String(body.redditAccountId) }),
      ...(body.twitterConnectionToken !== undefined && { twitterConnectionToken: String(body.twitterConnectionToken) }),
      ...(body.onboarded !== undefined && { onboarded: Boolean(body.onboarded) }),
    },
  });
  return NextResponse.json(updated);
}
