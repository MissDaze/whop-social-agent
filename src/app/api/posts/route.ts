import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const all = req.nextUrl.searchParams.get("all") === "true";
  const posts = await db.scheduledPost.findMany({
    where: { userId: user.id, ...(all ? {} : { status: "pending" }) },
    include: { product: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json(posts);
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, action, content } = await req.json() as { id: string; action: string; content?: string };
  const statusMap: Record<string, string> = { approve: "approved", reject: "rejected" };
  const updated = await db.scheduledPost.update({
    where: { id },
    data: {
      status: action === "edit" ? "approved" : (statusMap[action] ?? action),
      ...(content ? { content } : {}),
    },
  });
  return NextResponse.json(updated);
}
