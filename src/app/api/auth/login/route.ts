import { getWhopOAuthUrl } from "@/lib/whop";
import { NextResponse } from "next/server";

export async function GET() {
  const url = getWhopOAuthUrl();
  return NextResponse.redirect(url);
}
