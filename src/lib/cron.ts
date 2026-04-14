/**
 * Cron worker — runs scheduled agent tasks for all users.
 * Spawned as a separate process by the Next.js custom server
 * or as a Railway cron job hitting /api/cron endpoints.
 */
import cron from "node-cron";
import { db } from "@/lib/db";
import { callOpenRouter } from "@/lib/openrouter";
import { ComposioToolSet } from "composio-core";

const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY!;

interface RedditChild {
  data?: {
    id?: string;
    title?: string;
    selftext?: string;
    subreddit?: string;
    author?: string;
    permalink?: string;
  };
}

async function log(userId: string, runType: string, status: string, message: string) {
  await db.agentRunLog.create({ data: { userId, runType, status, message } });
}

// ── Hunt opportunities every 6 hours ─────────────────────────────────────────
async function huntForUser(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user?.redditAccountId) return;

  const products = await db.whopProduct.findMany({ where: { userId } });
  const productNames = products.map((p) => p.name).join(", ") || "Whop courses";
  const subreddits = ["entrepreneur", "startups", "SideProject", "passive_income"];
  const queries = [`best ${productNames}`, "anyone recommend", "looking for help with"];
  const toolset = new ComposioToolSet({ apiKey: COMPOSIO_API_KEY });
  const found: Array<{ id: string; text: string; url: string; author: string; subreddit: string }> = [];

  for (const query of queries.slice(0, 2)) {
    for (const sub of subreddits.slice(0, 2)) {
      try {
        const result = await toolset.executeAction({
          action: "REDDIT_SEARCH_REDDIT",
          params: { query: `${query} subreddit:${sub}`, limit: 5, sort: "new" },
          connectedAccountId: user.redditAccountId,
        });
        const data = result as Record<string, unknown>;
        const children: RedditChild[] =
          (data?.search_results as Record<string, unknown>)?.data
            ? ((data.search_results as Record<string, unknown>).data as Record<string, unknown>)?.children as RedditChild[] ?? []
            : (data?.data as Record<string, unknown>)?.children as RedditChild[] ?? [];

        for (const child of children) {
          const post = child?.data;
          if (!post?.id || !post?.title) continue;
          found.push({
            id: post.id,
            text: `${post.title} ${post.selftext ?? ""}`.trim(),
            url: `https://reddit.com${post.permalink ?? ""}`,
            author: post.author ?? "unknown",
            subreddit: post.subreddit ?? sub,
          });
        }
      } catch { /* continue */ }
    }
  }

  const unique = [...new Map(found.map((f) => [f.id, f])).values()].slice(0, 10);
  let saved = 0;
  for (const post of unique) {
    const exists = await db.opportunity.findFirst({ where: { userId, externalId: post.id } });
    if (exists) continue;
    let reply = "";
    try {
      reply = await callOpenRouter(user.openRouterKey, [
        { role: "system", content: "Helpful Reddit community manager for Whop creator." },
        { role: "user", content: `Products: ${productNames}\nComment: "${post.text.slice(0, 200)}"\nWrite a brief helpful reply (max 200 chars).` },
      ]);
    } catch { /* skip */ }
    await db.opportunity.create({
      data: { userId, platform: "reddit", sourceUrl: post.url, externalId: post.id, authorName: post.author, originalText: post.text.slice(0, 1000), subreddit: post.subreddit, suggestedReply: reply || null, replyStatus: "pending" },
    });
    saved++;
  }
  await log(userId, "cron_hunt", "success", `Found ${saved} new opportunities`);
}

// ── Generate posts every 12 hours ────────────────────────────────────────────
async function generateForUser(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return;

  const products = await db.whopProduct.findMany({ where: { userId }, take: 1 });
  const product = products[0];
  const productContext = product ? `Product: "${product.name}". ${product.description ?? ""}` : "Whop community";

  const platforms: Array<"reddit" | "twitter"> = ["reddit", "twitter"];
  for (const platform of platforms) {
    try {
      const prompt = platform === "reddit"
        ? `Generate 1 Reddit post JSON: { "title": string, "body": string, "subreddit": string }. Context: ${productContext}. Value-first, not salesy. ONLY JSON.`
        : `Generate 1 tweet (max 280 chars) promoting: ${productContext}. ONLY the tweet text.`;

      const raw = await callOpenRouter(user.openRouterKey, [
        { role: "system", content: "Social media manager for Whop creator." },
        { role: "user", content: prompt },
      ]);
      const clean = raw.replace(/```(?:json)?/g, "").replace(/```/g, "").trim();
      let content = clean;
      let subreddit: string | null = null;

      if (platform === "reddit") {
        try {
          const parsed = JSON.parse(clean) as Record<string, string>;
          subreddit = parsed.subreddit ?? "entrepreneur";
          content = JSON.stringify(parsed);
        } catch { /* use raw */ }
      }

      await db.scheduledPost.create({
        data: { userId, platform, content, subreddit, productId: product?.id ?? null, status: "pending" },
      });
    } catch { /* continue */ }
  }
  await log(userId, "cron_generate", "success", "Generated posts for review");
}

// ── Monitor comments every 4 hours ───────────────────────────────────────────
async function monitorForUser(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user?.redditAccountId) return;

  const postedPosts = await db.scheduledPost.findMany({
    where: { userId, platform: "reddit", status: "posted" },
    take: 3,
  });
  if (!postedPosts.length) return;

  const toolset = new ComposioToolSet({ apiKey: COMPOSIO_API_KEY });
  let saved = 0;

  for (const post of postedPosts) {
    if (!post.externalId) continue;
    try {
      const result = await toolset.executeAction({
        action: "REDDIT_GET_REDDIT_POST_COMMENTS",
        params: { post_id: post.externalId, limit: 10 },
        connectedAccountId: user.redditAccountId!,
      });
      const data = result as Record<string, unknown>;
      const comments =
        ((data?.comments as Record<string, unknown>)?.data as Record<string, unknown>)?.children as Array<{ data?: { id?: string; author?: string; body?: string } }> ?? [];

      for (const child of comments) {
        const c = child?.data;
        if (!c?.id || !c?.body) continue;
        const exists = await db.postComment.findFirst({ where: { userId, externalCommentId: c.id } });
        if (exists) continue;

        let reply = "";
        try {
          reply = await callOpenRouter(user.openRouterKey, [
            { role: "system", content: "Helpful Reddit reply writer for Whop creator." },
            { role: "user", content: `Comment: "${c.body}"\nWrite a brief, genuine reply (max 200 chars).` },
          ]);
        } catch { /* skip */ }

        await db.postComment.create({
          data: { userId, postId: post.id, platform: "reddit", externalCommentId: c.id, authorName: c.author ?? null, commentText: c.body, suggestedReply: reply || null, replyStatus: "pending" },
        });
        saved++;
      }
    } catch { /* continue */ }
  }
  await log(userId, "cron_monitor", "success", `Found ${saved} new comments`);
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function runForAllUsers(fn: (userId: string) => Promise<void>, jobName: string) {
  const users = await db.user.findMany({ where: { onboarded: true } });
  console.log(`[cron] ${jobName}: running for ${users.length} users`);
  for (const user of users) {
    try {
      await fn(user.id);
    } catch (e) {
      console.error(`[cron] ${jobName} failed for ${user.id}:`, e);
    }
  }
}

export function startCron() {
  // Hunt every 6 hours
  cron.schedule("0 */6 * * *", () => runForAllUsers(huntForUser, "hunt"));
  // Generate every 12 hours
  cron.schedule("0 */12 * * *", () => runForAllUsers(generateForUser, "generate"));
  // Monitor every 4 hours
  cron.schedule("0 */4 * * *", () => runForAllUsers(monitorForUser, "monitor"));

  console.log("[cron] Scheduled jobs started");
}
