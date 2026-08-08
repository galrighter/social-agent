import officeCrypto from "officecrypto-tool";

/**
 * תמיכה בקובצי Excel מוגני סיסמה.
 *
 * קובץ Office מוצפן אינו ZIP רגיל אלא מעטפת CFB/OLE2 שבתוכה החבילה המוצפנת,
 * ולכן `XLSX.read` נכשל עליו. כאן מזהים את המעטפת, מפענחים עם הסיסמה שהמשתמש
 * הזין ומחזירים buffer רגיל שהמפענח הרגיל יודע לקרוא.
 *
 * הסיסמה משמשת בזיכרון בלבד — היא לא נשמרת במסד, לא נכתבת ללוג ולא חוזרת ללקוח.
 */

/** חתימת קובץ CFB/OLE2 — המעטפת של קובצי Office מוצפנים (וגם של xls ישן). */
const CFB_SIGNATURE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

/** הקובץ מוצפן ולא סופקה סיסמה. */
export class PasswordRequiredError extends Error {
  constructor() {
    super("הקובץ מוגן בסיסמה");
    this.name = "PasswordRequiredError";
  }
}

/** סופקה סיסמה אך היא אינה מתאימה לקובץ. */
export class WrongPasswordError extends Error {
  constructor() {
    super("הסיסמה שגויה");
    this.name = "WrongPasswordError";
  }
}

/**
 * האם הקובץ מוגן בסיסמה. בודקים תחילה את חתימת ה־CFB, כי `isEncrypted` של
 * הספרייה מנסה לפרסר את הקובץ ועלול לזרוק על קלט שאינו CFB (למשל xlsx/csv רגיל).
 */
export function isEncryptedWorkbook(buffer: Buffer): boolean {
  if (buffer.length < CFB_SIGNATURE.length) return false;
  if (!buffer.subarray(0, CFB_SIGNATURE.length).equals(CFB_SIGNATURE)) return false;
  try {
    return officeCrypto.isEncrypted(buffer);
  } catch {
    // מעטפת CFB שאיננו יודעים לפרסר — לא מוצפנת מבחינתנו, המפענח הרגיל ינסה.
    return false;
  }
}

/**
 * מחזיר buffer קריא: קובץ לא מוצפן חוזר כמות שהוא, קובץ מוצפן מפוענח בעזרת
 * הסיסמה. זורק `PasswordRequiredError` כשחסרה סיסמה ו־`WrongPasswordError`
 * כשהיא שגויה, כדי שה־API יוכל לבקש מהמשתמש סיסמה במקום להיכשל כללית.
 */
export async function decryptWorkbook(
  buffer: Buffer,
  password?: string | null
): Promise<Buffer> {
  if (!isEncryptedWorkbook(buffer)) return buffer;
  if (!password) throw new PasswordRequiredError();

  try {
    const decrypted = await officeCrypto.decrypt(buffer, { password });
    return Buffer.isBuffer(decrypted) ? decrypted : Buffer.from(decrypted);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/password is incorrect/i.test(message)) throw new WrongPasswordError();
    throw error;
  }
}
