import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { db } from "@/lib/db";
import { callOpenRouter } from "@/lib/openrouter";
import { ComposioToolSet } from "composio-core";

interface RedditChild {
  data?: {
    id?: string;
    title?: string;
    selftext?: string;
    subreddit?: string;
    url?: string;
    author?: string;
    permalink?: string;
  };
}

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!user.redditAccountId) {
    return NextResponse.json({ error: "Reddit account not connected" }, { status: 400 });
  }

  const products = await db.whopProduct.findMany({ where: { userId: user.id } });
    const productNames = products.map((p: { name: string }) => p.name).join(", ") || "online courses, communities, tools";

  const subreddits = ["entrepreneur", "startups", "SideProject", "passive_income", "digitalmarketing", "ecommerce"];
  const queries = [
    `looking for ${productNames}`,
    "anyone recommend a course",
    "best community for",
    "need help with",
    "recommend a tool",
  ];

  const toolset = new ComposioToolSet({ apiKey: process.env.COMPOSIO_API_KEY });
  const found: Array<{ id: string; text: string; url: string; author: string; subreddit: string }> = [];

  for (const query of queries.slice(0, 3)) {
    for (const subreddit of subreddits.slice(0, 3)) {
      try {
        const result = await toolset.executeAction({
          action: "REDDIT_SEARCH_REDDIT",
          params: { query: `${query} subreddit:${subreddit}`, limit: 5, sort: "new" },
          connectedAccountId: user.redditAccountId,
        });

        // Handle both possible response shapes
        const data = result as Record<string, unknown>;
        const children: RedditChild[] =
          (data?.search_results as Record<string, unknown>)?.data
            ? ((data.search_results as Record<string, unknown>).data as Record<string, unknown>)?.children as RedditChild[] ?? []
            : (data?.data as Record<string, unknown>)?.children as RedditChild[] ?? [];

        for (const child of children) {
          const post = child?.data;
          if (!post?.id || !post?.title) continue;
          const text = `${post.title} ${post.selftext ?? ""}`.trim();
          found.push({
            id: post.id,
            text,
            url: `https://reddit.com${post.permalink ?? ""}`,
            author: post.author ?? "unknown",
            subreddit: post.subreddit ?? subreddit,
          });
        }
      } catch {
        // continue
      }
    }
  }

  if (!found.length) {
    return NextResponse.json({ opportunities: [], message: "No posts found" });
  }

  // Deduplicate
  const unique = [...new Map(found.map((f) => [f.id, f])).values()].slice(0, 20);

  const productContext = products.length
    ? `Products: ${products.map((p: { name: string; description?: string | null }) => `"${p.name}" (${p.description ?? "Whop product"})`).join("; ")}`
    : "Generic Whop community/courses";

  // Ask AI to score and generate replies
  const scorePrompt = `${productContext}

Reddit posts to evaluate:
${unique.map((p, i) => `[${i}] r/${p.subreddit} - ${p.text.slice(0, 200)}`).join("\n")}

For each post that is a genuine opportunity to helpfully promote the products above, return a JSON array of objects: { "index": number, "reply": string (helpful, non-spammy reply, max 300 chars) }. Only include posts worth replying to. Return ONLY JSON.`;

  let aiReplies: Array<{ index: number; reply: string }> = [];
  try {
    const raw = await callOpenRouter(user.openRouterKey, [
      { role: "system", content: "You are a helpful Reddit community manager. Be genuine and value-first." },
      { role: "user", content: scorePrompt },
    ]);
    const clean = raw.replace(/```(?:json)?/g, "").replace(/```/g, "").trim();
    aiReplies = JSON.parse(clean) as Array<{ index: number; reply: string }>;
  } catch {
    // fallback: treat all as opportunities with empty replies
    aiReplies = unique.map((_, i) => ({ index: i, reply: "" }));
  }

  const saved = [];
  for (const { index, reply } of aiReplies) {
    const post = unique[index];
    if (!post) continue;

    // Skip if already stored
    const existing = await db.opportunity.findFirst({
      where: { userId: user.id, externalId: post.id },
    });
    if (existing) continue;

    const opp = await db.opportunity.create({
      data: {
        userId: user.id,
        platform: "reddit",
        sourceUrl: post.url,
        externalId: post.id,
        authorName: post.author,
        originalText: post.text.slice(0, 1000),
        subreddit: post.subreddit,
        suggestedReply: reply || null,
        replyStatus: "pending",
      },
    });
    saved.push(opp);
  }

  await db.agentRunLog.create({
    data: {
      userId: user.id,
      runType: "hunt",
      status: "success",
      message: `Found ${saved.length} new opportunities from ${unique.length} scanned posts`,
    },
  });

  return NextResponse.json({ opportunities: saved, scanned: unique.length });
}
