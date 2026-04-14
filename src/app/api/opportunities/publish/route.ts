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

  const approved = await db.opportunity.findMany({
    where: { userId: user.id, replyStatus: "approved" },
    orderBy: { createdAt: "asc" },
  });

  const toolset = new ComposioToolSet({ apiKey: process.env.COMPOSIO_API_KEY });
  const results = [];

  for (const opp of approved) {
    if (!opp.suggestedReply) {
      results.push({ id: opp.id, status: "skipped", reason: "no reply" });
      continue;
    }
    try {
      // Extract Reddit post ID from URL
      const match = opp.sourceUrl.match(/comments\/([a-z0-9]+)\//i);
      const postId = match?.[1] ?? opp.externalId;

      if (!postId) {
        results.push({ id: opp.id, status: "skipped", reason: "no post ID" });
        continue;
      }

      await toolset.executeAction({
        action: "REDDIT_CREATE_REDDIT_COMMENT",
        params: { link_id: `t3_${postId}`, text: opp.suggestedReply },
        connectedAccountId: user.redditAccountId,
      });

      await db.opportunity.update({
        where: { id: opp.id },
        data: { replyStatus: "replied", repliedAt: new Date() },
      });
      results.push({ id: opp.id, status: "replied" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await db.opportunity.update({
        where: { id: opp.id },
        data: { replyStatus: "failed" },
      });
      results.push({ id: opp.id, status: "failed", error: msg });
    }
  }

  await db.agentRunLog.create({
    data: {
      userId: user.id,
      runType: "publish_opportunities",
      status: "success",
      message: `Published ${results.filter((r) => r.status === "replied").length}/${approved.length} opportunity replies`,
    },
  });

  return NextResponse.json({ results });
}
