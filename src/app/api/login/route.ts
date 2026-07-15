import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, authConfigured, credentialsMatch, sessionToken } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const username = String(body.username ?? "");
  const password = String(body.password ?? "");

  if (!authConfigured() || credentialsMatch(username, password)) {
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, await sessionToken(), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30, // 30 יום
    });
    return res;
  }

  return NextResponse.json(
    { ok: false, error: "שם משתמש או סיסמה שגויים" },
    { status: 401 }
  );
}
