/**
 * POST /api/cron?job=hunt|generate|monitor
 * Protected by CRON_SECRET header — call from Railway cron or external scheduler.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { callOpenRouter } from "@/lib/openrouter";
import { ComposioToolSet } from "composio-core";

const CRON_SECRET = process.env.CRON_SECRET;
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

function checkSecret(req: NextRequest) {
  if (!CRON_SECRET) return true; // no secret set = allow (dev)
  return req.headers.get("x-cron-secret") === CRON_SECRET;
}

export async function POST(req: NextRequest) {
  if (!checkSecret(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const job = req.nextUrl.searchParams.get("job") ?? "hunt";
  const users = await db.user.findMany({ where: { onboarded: true } });

  let processed = 0;
  for (const user of users) {
    try {
      if (job === "hunt" && user.redditAccountId) {
        const products = await db.whopProduct.findMany({ where: { userId: user.id } });
        const productNames = products.map((p) => p.name).join(", ") || "Whop courses";
        const toolset = new ComposioToolSet({ apiKey: COMPOSIO_API_KEY });
        const found: Array<{ id: string; text: string; url: string; author: string; subreddit: string }> = [];

        for (const query of [`best ${productNames}`, "recommend", "looking for"]) {
          for (const sub of ["entrepreneur", "startups", "SideProject"]) {
            try {
              const result = await toolset.executeAction({
                action: "REDDIT_SEARCH_REDDIT",
                params: { query: `${query} subreddit:${sub}`, limit: 5, sort: "new" },
                connectedAccountId: user.redditAccountId!,
              });
              const data = result as Record<string, unknown>;
              const children: RedditChild[] =
                (data?.search_results as Record<string, unknown>)?.data
                  ? ((data.search_results as Record<string, unknown>).data as Record<string, unknown>)?.children as RedditChild[] ?? []
                  : (data?.data as Record<string, unknown>)?.children as RedditChild[] ?? [];
              for (const child of children) {
                const post = child?.data;
                if (!post?.id || !post?.title) continue;
                found.push({ id: post.id, text: `${post.title} ${post.selftext ?? ""}`.trim(), url: `https://reddit.com${post.permalink ?? ""}`, author: post.author ?? "unknown", subreddit: post.subreddit ?? sub });
              }
            } catch { /* continue */ }
          }
        }

        const unique = [...new Map(found.map((f) => [f.id, f])).values()].slice(0, 10);
        for (const post of unique) {
          const exists = await db.opportunity.findFirst({ where: { userId: user.id, externalId: post.id } });
          if (exists) continue;
          let reply = "";
          try {
            reply = await callOpenRouter(user.openRouterKey, [
              { role: "system", content: "Helpful Reddit community manager." },
              { role: "user", content: `Products: ${productNames}\nPost: "${post.text.slice(0, 200)}"\nWrite brief helpful reply (max 200 chars).` },
            ]);
          } catch { /* skip */ }
          await db.opportunity.create({
            data: { userId: user.id, platform: "reddit", sourceUrl: post.url, externalId: post.id, authorName: post.author, originalText: post.text.slice(0, 1000), subreddit: post.subreddit, suggestedReply: reply || null, replyStatus: "pending" },
          });
        }
        processed++;
      } else if (job === "generate") {
        const products = await db.whopProduct.findMany({ where: { userId: user.id }, take: 1 });
        const product = products[0];
        const ctx = product ? `Product: "${product.name}". ${product.description ?? ""}` : "Whop community";
        for (const platform of ["reddit", "twitter"] as const) {
          const prompt = platform === "reddit"
            ? `Generate 1 Reddit post JSON: { "title": string, "body": string, "subreddit": string }. Context: ${ctx}. Value-first. ONLY JSON.`
            : `Generate 1 tweet (max 280 chars) for: ${ctx}. ONLY tweet text.`;
          try {
            const raw = await callOpenRouter(user.openRouterKey, [
              { role: "system", content: "Social media manager for Whop creator." },
              { role: "user", content: prompt },
            ]);
            const clean = raw.replace(/```(?:json)?/g, "").replace(/```/g, "").trim();
            let content = clean;
            let subreddit: string | null = null;
            if (platform === "reddit") {
              try { const p = JSON.parse(clean) as Record<string, string>; subreddit = p.subreddit ?? null; content = JSON.stringify(p); } catch { /* use raw */ }
            }
            await db.scheduledPost.create({ data: { userId: user.id, platform, content, subreddit, productId: product?.id ?? null, status: "pending" } });
          } catch { /* continue */ }
        }
        processed++;
      }
    } catch (e) {
      console.error(`Cron ${job} failed for user ${user.id}:`, e);
    }
  }

  await db.agentRunLog.create({
    data: { userId: users[0]?.id ?? "system", runType: `cron_${job}`, status: "success", message: `Processed ${processed}/${users.length} users` },
  }).catch(() => {});

  return NextResponse.json({ job, processed, total: users.length });
}
