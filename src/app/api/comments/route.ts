import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = req.nextUrl.searchParams.get("status");
  const comments = await db.postComment.findMany({
    where: { userId: user.id, ...(status ? { replyStatus: status } : {}) },
    include: { post: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json(comments);
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, action, suggestedReply } = await req.json() as {
    id: string;
    action: "approve" | "reject" | "edit";
    suggestedReply?: string;
  };

  const statusMap: Record<string, string> = { approve: "approved", reject: "rejected" };
  const updated = await db.postComment.update({
    where: { id },
    data: {
      replyStatus: action === "edit" ? "approved" : (statusMap[action] ?? action),
      ...(suggestedReply !== undefined ? { suggestedReply } : {}),
    },
  });
  return NextResponse.json(updated);
}
