import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { db } from "@/lib/db";
import { callOpenRouter } from "@/lib/openrouter";
import { ComposioToolSet } from "composio-core";

interface RedditComment {
  data?: {
    id?: string;
    author?: string;
    body?: string;
    link_id?: string;
    permalink?: string;
  };
}

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!user.redditAccountId) {
    return NextResponse.json({ error: "Reddit account not connected" }, { status: 400 });
  }

  // Get posted Reddit posts
  const postedPosts = await db.scheduledPost.findMany({
    where: { userId: user.id, platform: "reddit", status: "posted" },
  });

  if (!postedPosts.length) {
    return NextResponse.json({ comments: [], message: "No posted Reddit posts to monitor" });
  }

  const toolset = new ComposioToolSet({ apiKey: process.env.COMPOSIO_API_KEY });
  const newComments = [];

  for (const post of postedPosts.slice(0, 5)) {
    if (!post.externalId) continue;
    try {
      const result = await toolset.executeAction({
        action: "REDDIT_GET_REDDIT_POST_COMMENTS",
        params: { post_id: post.externalId, limit: 10 },
        connectedAccountId: user.redditAccountId,
      });

      const data = result as Record<string, unknown>;
      const comments: RedditComment[] =
        (data?.comments as Record<string, unknown>)?.data
          ? ((data.comments as Record<string, unknown>).data as Record<string, unknown>)?.children as RedditComment[] ?? []
          : (data?.data as Record<string, unknown>)?.children as RedditComment[] ?? [];

      for (const child of comments) {
        const c = child?.data;
        if (!c?.id || !c?.body) continue;

        // Skip already stored
        const exists = await db.postComment.findFirst({
          where: { userId: user.id, externalCommentId: c.id },
        });
        if (exists) continue;

        // Generate AI reply suggestion
        let suggestedReply = "";
        try {
          suggestedReply = await callOpenRouter(user.openRouterKey, [
            { role: "system", content: "You reply helpfully to Reddit comments on behalf of a Whop creator. Keep replies friendly, brief, under 200 chars." },
            { role: "user", content: `Comment: "${c.body}"\n\nWrite a helpful reply.` },
          ]);
        } catch { /* skip */ }

        const comment = await db.postComment.create({
          data: {
            userId: user.id,
            postId: post.id,
            platform: "reddit",
            externalCommentId: c.id,
            authorName: c.author ?? null,
            commentText: c.body,
            suggestedReply: suggestedReply || null,
            replyStatus: "pending",
          },
        });
        newComments.push(comment);
      }
    } catch {
      // continue
    }
  }

  await db.agentRunLog.create({
    data: {
      userId: user.id,
      runType: "monitor",
      status: "success",
      message: `Found ${newComments.length} new comments`,
    },
  });

  return NextResponse.json({ comments: newComments });
}
