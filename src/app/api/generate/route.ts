import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { db } from "@/lib/db";
import { callOpenRouter } from "@/lib/openrouter";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { platform, productId, count = 3 } = await req.json() as {
    platform: "reddit" | "twitter" | "tiktok";
    productId?: string;
    count?: number;
  };

  const product = productId
    ? await db.whopProduct.findFirst({ where: { id: productId, userId: user.id } })
    : null;

  const media = await db.sampleMedia.findMany({
    where: { userId: user.id, isActive: true },
    take: 3,
  });

  const productContext = product
    ? `Product: "${product.name}". Description: ${product.description ?? "N/A"}. Price: ${product.price ?? "N/A"}. URL: ${product.whopUrl ?? "N/A"}.`
    : "Promote a Whop community/product.";

  const mediaContext = media.length
    ? `Sample media available: ${media.map((m: { title: string }) => m.title).join(", ")}.`
    : "";

  const platformInstructions: Record<string, string> = {
    reddit: `Generate ${count} Reddit posts (JSON array). Each object: { "title": string (max 300 chars), "body": string (max 500 chars), "subreddit": string (a relevant subreddit without r/) }. Posts should be helpful/value-first, not salesy. Subtle promo only.`,
    twitter: `Generate ${count} tweets (JSON array of strings). Each max 280 chars. Engaging, punchy, include relevant hashtags. Subtle product mention.`,
    tiktok: `Generate ${count} TikTok video scripts (JSON array). Each object: { "hook": string (first 3 seconds), "body": string (main content), "cta": string (call to action) }. Short, energetic, trend-aware.`,
  };

  const systemPrompt = `You are a social media marketing expert for Whop creators. ${productContext} ${mediaContext}`;
  const userPrompt = `${platformInstructions[platform] ?? platformInstructions.twitter}\n\nReturn ONLY valid JSON, no markdown, no explanation.`;

  let raw = "";
  try {
    raw = await callOpenRouter(user.openRouterKey, [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }

  // Parse the JSON out
  let parsed: unknown;
  try {
    // Strip markdown code fences if present
    const clean = raw.replace(/```(?:json)?/g, "").replace(/```/g, "").trim();
    parsed = JSON.parse(clean);
  } catch {
    return NextResponse.json({ error: "Failed to parse AI response", raw }, { status: 500 });
  }

  // Save to DB
  const posts = Array.isArray(parsed) ? parsed : [parsed];
  const saved = [];
  for (const p of posts) {
    const content =
      platform === "reddit"
        ? JSON.stringify(p)
        : platform === "twitter"
        ? String(p)
        : JSON.stringify(p);
    const subreddit =
      platform === "reddit" && typeof p === "object" && p !== null
        ? (p as Record<string, string>).subreddit
        : undefined;
    const post = await db.scheduledPost.create({
      data: {
        userId: user.id,
        platform,
        content,
        subreddit: subreddit ?? null,
        productId: productId ?? null,
        status: "pending",
      },
    });
    saved.push(post);
  }

  await db.agentRunLog.create({
    data: {
      userId: user.id,
      runType: "generate",
      status: "success",
      message: `Generated ${saved.length} ${platform} posts`,
    },
  });

  return NextResponse.json({ posts: saved });
}
