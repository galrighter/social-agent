import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * שער כניסה פשוט. פרטי ההתחברות נקראים ממשתני סביבה בשרת בלבד
 * (PLAYGAMES_USER / PLAYGAMES_PASSWORD) — לעולם לא בקוד המקור (הריפו ציבורי).
 * אם אין סיסמה מוגדרת — השער כבוי (פיתוח מקומי).
 *
 * הגיינג נעשה בצד השרת (עמודים + API) ולא ב־middleware, כי redirect() מייצר
 * Location יחסי שנפתר מול הדומיין הציבורי — בעוד redirect/rewrite של middleware
 * מאחורי proxy מייצרים URL עם ה־host הפנימי (localhost) והדף לא נטען.
 */
export const SESSION_COOKIE = "pg_session";

export function authConfigured(): boolean {
  return Boolean(process.env.PLAYGAMES_PASSWORD);
}

/** טוקן העוגייה — גיבוב של הפרטים, כך שהסיסמה עצמה לעולם לא נשמרת בעוגייה. */
export async function sessionToken(): Promise<string> {
  const user = process.env.PLAYGAMES_USER ?? "";
  const pass = process.env.PLAYGAMES_PASSWORD ?? "";
  const data = new TextEncoder().encode(`playgames:v1:${user}:${pass}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function credentialsMatch(user: string, pass: string): boolean {
  return user === (process.env.PLAYGAMES_USER ?? "") && pass === (process.env.PLAYGAMES_PASSWORD ?? "");
}

/** האם הבקשה הנוכחית מאומתת (או שהשער כבוי). */
export async function isAuthed(): Promise<boolean> {
  if (!authConfigured()) return true;
  const jar = await cookies();
  const cookie = jar.get(SESSION_COOKIE)?.value;
  if (!cookie) return false;
  return cookie === (await sessionToken());
}

/** לשימוש בעמודי שרת — מפנה ל־/login אם לא מאומת. */
export async function requireAuth(): Promise<void> {
  if (!(await isAuthed())) redirect("/login");
}
