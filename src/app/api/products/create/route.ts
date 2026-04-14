import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, description, price, imageUrl, whopUrl } = await req.json() as {
    name: string;
    description?: string;
    price?: string;
    imageUrl?: string;
    whopUrl?: string;
  };

  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  // If user has a Whop API key, try to create the product via Whop API
  if (user.whopApiKey) {
    try {
      const res = await fetch("https://api.whop.com/api/v5/products", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${user.whopApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, description }),
      });
      if (res.ok) {
        const whopProduct = await res.json() as { id: string; name: string; description?: string };
        const product = await db.whopProduct.upsert({
          where: { userId_whopId: { userId: user.id, whopId: whopProduct.id } },
          update: { name: whopProduct.name, description: whopProduct.description ?? null, imageUrl: imageUrl ?? null, whopUrl: whopUrl ?? null },
          create: {
            userId: user.id,
            whopId: whopProduct.id,
            name: whopProduct.name,
            description: whopProduct.description ?? null,
            price: price ?? null,
            imageUrl: imageUrl ?? null,
            whopUrl: whopUrl ?? null,
          },
        });
        return NextResponse.json(product);
      }
    } catch { /* fall through to manual create */ }
  }

  // Manual entry without Whop API
  const product = await db.whopProduct.create({
    data: {
      userId: user.id,
      whopId: `manual_${Date.now()}`,
      name,
      description: description ?? null,
      price: price ?? null,
      imageUrl: imageUrl ?? null,
      whopUrl: whopUrl ?? null,
    },
  });
  return NextResponse.json(product);
}
