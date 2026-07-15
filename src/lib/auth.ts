/**
 * שער כניסה פשוט. פרטי ההתחברות נקראים ממשתני סביבה בשרת בלבד
 * (PLAYGAMES_USER / PLAYGAMES_PASSWORD) — לעולם לא בקוד המקור (הריפו ציבורי).
 * אם אין סיסמה מוגדרת — השער כבוי (פיתוח מקומי).
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
