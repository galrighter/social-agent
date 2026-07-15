const ilsWhole = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });

/** יחידת הניקוד המוצגת (במקום מטבע). */
export const POINTS_UNIT = "נק'";

/** נקודות עם פסיקים, בלי שברים: 487,577 נק' */
export function formatILS(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? "-" : "";
  return `${sign}${ilsWhole.format(Math.abs(rounded))} ${POINTS_UNIT}`;
}

/** נקודות חתום לרווח/הפסד: ‎+1,234 נק' / ‎-1,234 נק' */
export function formatILSSigned(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded > 0 ? "+" : rounded < 0 ? "-" : "";
  return `${sign}${ilsWhole.format(Math.abs(rounded))} ${POINTS_UNIT}`;
}

/** ממוצע נקודות בלי מינוס, ספרה אחת אחרי הנקודה: 52.5 נק' */
export function formatILSAvg(amount: number, digits = 1): string {
  const abs = Math.abs(amount);
  const formatted = new Intl.NumberFormat("he-IL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(abs);
  return `${formatted} ${POINTS_UNIT}`;
}

/** מספר עשרוני עם ספרה אחת או שתיים לפי הצורך. */
export function formatDecimal(value: number, digits = 1): string {
  return new Intl.NumberFormat("he-IL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

/** מספר שלם עם פסיקים. */
export function formatInt(value: number): string {
  return ilsWhole.format(Math.round(value));
}

/** תאריך קצר לתצוגה: 23.3.2024 (הזמנים נשמרים כשעון קיר ב־UTC). */
export function formatShortDate(date: Date): string {
  return `${date.getUTCDate()}.${date.getUTCMonth() + 1}.${date.getUTCFullYear()}`;
}

/** תאריך + שעה: 23.3.2024 23:33 */
export function formatDateTime(date: Date): string {
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  return `${formatShortDate(date)} ${hh}:${mm}`;
}

/** תאריך YYYY-MM-DD לפורמט תצוגה 1.7.2026 */
export function formatYmdDisplay(value: string): string {
  const [y, m, d] = value.split("-").map(Number);
  return `${d}.${m}.${y}`;
}

const HEBREW_MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

/** חודש yyyy-MM לתצוגה בעברית: "מרץ 2024" */
export function formatMonth(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return `${HEBREW_MONTHS[m - 1]} ${y}`;
}

/** חודש קצר לגרפים: "3/24" */
export function formatMonthShort(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return `${m}/${String(y).slice(2)}`;
}

export const HEBREW_WEEKDAYS = [
  "ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת",
];

/** שם יום בשבוע בעברית לפי אינדקס (0 = ראשון). */
export function weekdayName(day: number): string {
  return `יום ${HEBREW_WEEKDAYS[day]}`;
}
