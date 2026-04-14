import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { db } from "@/lib/db";
import { ComposioToolSet } from "composio-core";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const approved = await db.scheduledPost.findMany({
    where: { userId: user.id, status: "approved" },
    orderBy: { createdAt: "asc" },
  });

  const results = [];

  for (const post of approved) {
    try {
      if (post.platform === "reddit" && user.redditAccountId) {
        const toolset = new ComposioToolSet({ apiKey: process.env.COMPOSIO_API_KEY });
        let title = post.content;
        let body = "";
        try {
          const p = JSON.parse(post.content) as { title?: string; body?: string };
          title = p.title ?? title;
          body = p.body ?? "";
        } catch { /* use raw */ }
        await toolset.executeAction({
          action: "REDDIT_CREATE_REDDIT_POST",
          params: { subreddit: post.subreddit ?? "entrepreneur", title: title.slice(0, 300), kind: "self", text: body || title },
          connectedAccountId: user.redditAccountId,
        });
        await db.scheduledPost.update({ where: { id: post.id }, data: { status: "posted", postedAt: new Date() } });
        results.push({ id: post.id, platform: "reddit", status: "posted" });
      } else if (post.platform === "twitter" && user.twitterConnectionToken) {
        const res = await fetch("https://api.twitter.com/2/tweets", {
          method: "POST",
          headers: { Authorization: `Bearer ${user.twitterConnectionToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ text: post.content.slice(0, 280) }),
        });
        const tweetData = await res.json() as { data?: { id?: string } };
        await db.scheduledPost.update({ where: { id: post.id }, data: { status: "posted", postedAt: new Date(), externalId: tweetData.data?.id } });
        results.push({ id: post.id, platform: "twitter", status: "posted" });
      } else if (post.platform === "tiktok") {
        await db.scheduledPost.update({ where: { id: post.id }, data: { status: "posted", postedAt: new Date(), errorMsg: "Post manually on TikTok" } });
        results.push({ id: post.id, platform: "tiktok", status: "manual" });
      } else {
        results.push({ id: post.id, platform: post.platform, status: "skipped" });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await db.scheduledPost.update({ where: { id: post.id }, data: { status: "failed", errorMsg: msg } });
      results.push({ id: post.id, status: "failed", error: msg });
    }
  }

  return NextResponse.json({ published: results });
}
