import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken, getWhopUser } from "@/lib/whop";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/?error=no_code", req.url));

  try {
    const tokenData = await exchangeCodeForToken(code);
    const whopUser = await getWhopUser(tokenData.access_token);

    const user = await db.user.upsert({
      where: { whopUserId: whopUser.id },
      create: {
        whopUserId: whopUser.id,
        whopAccessToken: tokenData.access_token,
        whopRefreshToken: tokenData.refresh_token ?? null,
        email: whopUser.email ?? null,
        name: whopUser.username ?? null,
        image: whopUser.profile_pic_url ?? null,
      },
      update: {
        whopAccessToken: tokenData.access_token,
        whopRefreshToken: tokenData.refresh_token ?? null,
        email: whopUser.email ?? null,
        name: whopUser.username ?? null,
        image: whopUser.profile_pic_url ?? null,
      },
    });

    const session = await createSession(user.id);
    const cookieStore = await cookies();
    cookieStore.set("session", session, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });

    return NextResponse.redirect(new URL("/dashboard", req.url));
  } catch (e) {
    console.error("Auth callback error:", e);
    return NextResponse.redirect(new URL("/?error=auth_failed", req.url));
  }
}
