import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { db } from "@/lib/db";
import { ComposioToolSet } from "composio-core";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!user.redditAccountId) {
    return NextResponse.json({ error: "Reddit account not connected" }, { status: 400 });
  }

  const approved = await db.postComment.findMany({
    where: { userId: user.id, replyStatus: "approved" },
    orderBy: { createdAt: "asc" },
  });

  const toolset = new ComposioToolSet({ apiKey: process.env.COMPOSIO_API_KEY });
  const results = [];

  for (const comment of approved) {
    if (!comment.suggestedReply || !comment.externalCommentId) {
      results.push({ id: comment.id, status: "skipped" });
      continue;
    }
    try {
      await toolset.executeAction({
        action: "REDDIT_CREATE_REDDIT_COMMENT",
        params: { link_id: `t1_${comment.externalCommentId}`, text: comment.suggestedReply },
        connectedAccountId: user.redditAccountId,
      });
      await db.postComment.update({
        where: { id: comment.id },
        data: { replyStatus: "replied", repliedAt: new Date() },
      });
      results.push({ id: comment.id, status: "replied" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await db.postComment.update({
        where: { id: comment.id },
        data: { replyStatus: "failed" },
      });
      results.push({ id: comment.id, status: "failed", error: msg });
    }
  }

  return NextResponse.json({ results });
}
