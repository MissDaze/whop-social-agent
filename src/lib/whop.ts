export const WHOP_CLIENT_ID = process.env.WHOP_CLIENT_ID!;
export const WHOP_CLIENT_SECRET = process.env.WHOP_CLIENT_SECRET!;
// Use server-side env var for redirect URI so it's not baked in at build time
export const WHOP_REDIRECT_URI = `${process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`;

export async function exchangeCodeForToken(code: string): Promise<{
  access_token: string;
  refresh_token?: string;
  user_id?: string;
}> {
  const res = await fetch("https://api.whop.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: WHOP_CLIENT_ID,
      client_secret: WHOP_CLIENT_SECRET,
      code,
      redirect_uri: WHOP_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Whop token exchange failed: ${err}`);
  }
  return res.json();
}

export async function getWhopUser(accessToken: string): Promise<{
  id: string;
  email?: string;
  username?: string;
  profile_pic_url?: string;
}> {
  const res = await fetch("https://api.whop.com/api/v5/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Failed to fetch Whop user");
  const data = await res.json() as { id: string; email?: string; username?: string; profile_pic_url?: string };
  return data;
}

export function getWhopOAuthUrl(state?: string): string {
  const params = new URLSearchParams({
    client_id: WHOP_CLIENT_ID,
    redirect_uri: WHOP_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    ...(state ? { state } : {}),
  });
  return `https://whop.com/oauth?${params.toString()}`;
}
