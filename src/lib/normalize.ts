/** נרמול שם: הסרת רווחים כפולים, אותיות קטנות (לשמות באנגלית). */
export function normalizeName(name: string | null | undefined): string {
  if (!name) return "";
  return String(name).trim().replace(/\s+/g, " ").toLowerCase();
}

/** נרמול טלפון: ספרות בלבד, קידומת בינלאומית 972 מומרת ל־0. */
export function normalizePhone(phone: string | number | null | undefined): string {
  if (phone === null || phone === undefined) return "";
  let digits = String(phone).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("972")) digits = "0" + digits.slice(3);
  // מספר ישראלי שאיבד את ה־0 המוביל בגלל המרה למספר באקסל
  if (digits.length === 9 && digits.startsWith("5")) digits = "0" + digits;
  return digits;
}

/** מפתח שחקן: טלפון מנורמל אם קיים, אחרת שם מנורמל. */
export function playerKeyOf(name: string, phone: string | number | null | undefined): string {
  const p = normalizePhone(phone);
  if (p) return `p:${p}`;
  return `n:${normalizeName(name)}`;
}
