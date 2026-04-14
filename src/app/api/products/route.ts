import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { db } from "@/lib/db";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const products = await db.whopProduct.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json(products);
}

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.whopApiKey) return NextResponse.json({ error: "No Whop API key set" }, { status: 400 });

  const res = await fetch("https://api.whop.com/api/v2/products", {
    headers: { Authorization: `Bearer ${user.whopApiKey}`, "Content-Type": "application/json" },
  });
  if (!res.ok) return NextResponse.json({ error: "Whop API error" }, { status: 500 });

  const data = await res.json() as { data?: Record<string, unknown>[] };
  const products = data.data ?? [];

  for (const p of products) {
    const whopId = p.id as string;
    const name = (p.title as string) || (p.name as string) || "Product";
    const description = (p.headline as string) || (p.description as string) || null;
    const imageUrl = (p.image_url as string) || null;
    const route = p.route as string | undefined;
    const whopUrl = route ? `https://whop.com/${route}` : `https://whop.com/hub/${whopId}`;
    await db.whopProduct.upsert({
      where: { userId_whopId: { userId: user.id, whopId } },
      create: { userId: user.id, whopId, name, description, price: null, imageUrl, whopUrl },
      update: { name, description, imageUrl, whopUrl },
    });
  }

  return NextResponse.json({ synced: products.length });
}
