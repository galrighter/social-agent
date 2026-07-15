import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, authConfigured, sessionToken } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  // שער כבוי כשאין סיסמה מוגדרת (פיתוח מקומי)
  if (!authConfigured()) return NextResponse.next();

  const { pathname } = req.nextUrl;
  // עמוד ההתחברות וה־API שלו פתוחים תמיד
  if (pathname === "/login" || pathname === "/api/login") return NextResponse.next();

  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const expected = await sessionToken();
  if (cookie && cookie === expected) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // מגן על הכול חוץ מנכסים סטטיים; ההחרגות של /login ו־/api/login נעשות בקוד
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|ico|webp|css|js)$).*)",
  ],
};
