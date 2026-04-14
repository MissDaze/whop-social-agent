import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { db } from "@/lib/db";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const media = await db.sampleMedia.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(media);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, url, thumbnailUrl, mediaType, platform } = await req.json() as {
    title: string;
    url: string;
    thumbnailUrl?: string;
    mediaType?: string;
    platform?: string;
  };

  if (!title || !url) {
    return NextResponse.json({ error: "title and url are required" }, { status: 400 });
  }

  const media = await db.sampleMedia.create({
    data: {
      userId: user.id,
      title,
      url,
      thumbnailUrl: thumbnailUrl ?? null,
      mediaType: mediaType ?? "video",
      platform: platform ?? null,
      isActive: true,
    },
  });
  return NextResponse.json(media);
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, isActive, title } = await req.json() as { id: string; isActive?: boolean; title?: string };
  const updated = await db.sampleMedia.update({
    where: { id },
    data: {
      ...(isActive !== undefined ? { isActive } : {}),
      ...(title !== undefined ? { title } : {}),
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json() as { id: string };
  await db.sampleMedia.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
