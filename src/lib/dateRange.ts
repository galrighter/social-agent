export const IL_TIMEZONE = "Asia/Jerusalem";

export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
}

/** התאריך הנוכחי (שנה/חודש/יום) לפי אזור הזמן של ישראל. */
export function israelToday(now: Date = new Date()): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function ymd(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** ברירת המחדל: מהיום הראשון של החודש הנוכחי ועד היום, לפי Asia/Jerusalem. */
export function defaultRange(now: Date = new Date()): DateRange {
  const { y, m, d } = israelToday(now);
  return { from: ymd(y, m, 1), to: ymd(y, m, d) };
}

/** חודש קודם: מה־1 עד היום האחרון של החודש שעבר. */
export function previousMonthRange(now: Date = new Date()): DateRange {
  const { y, m } = israelToday(now);
  const prevY = m === 1 ? y - 1 : y;
  const prevM = m === 1 ? 12 : m - 1;
  const lastDay = new Date(Date.UTC(prevY, prevM, 0)).getUTCDate();
  return { from: ymd(prevY, prevM, 1), to: ymd(prevY, prevM, lastDay) };
}

/** מתחילת השנה עד היום. */
export function yearToDateRange(now: Date = new Date()): DateRange {
  const { y, m, d } = israelToday(now);
  return { from: ymd(y, 1, 1), to: ymd(y, m, d) };
}

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidYmd(value: string | null | undefined): value is string {
  if (!value) return false;
  const m = value.match(YMD_RE);
  if (!m) return false;
  const date = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return (
    date.getUTCFullYear() === +m[1] &&
    date.getUTCMonth() === +m[2] - 1 &&
    date.getUTCDate() === +m[3]
  );
}

/**
 * גבולות הסינון בפועל: מ־from בשעה 00:00:00 ועד to בשעה 23:59:59.999.
 * הזמנים במסד נשמרים כשעון קיר ישראלי (ב־UTC), ולכן הגבולות נבנים ב־UTC.
 */
export function rangeToDates(range: DateRange): { fromDate: Date; toDate: Date } {
  const [fy, fm, fd] = range.from.split("-").map(Number);
  const [ty, tm, td] = range.to.split("-").map(Number);
  return {
    fromDate: new Date(Date.UTC(fy, fm - 1, fd, 0, 0, 0, 0)),
    toDate: new Date(Date.UTC(ty, tm - 1, td, 23, 59, 59, 999)),
  };
}

/**
 * גבולות חצי־פתוחים לסינון משחקים: [fromDate, toExclusive).
 * fromDate = from בשעה 00:00 (Asia/Jerusalem, נשמר כ־UTC).
 * toExclusive = תחילת היום שאחרי to (00:00), כדי ש־to יהיה כולל־יום־מלא.
 * הזמנים במסד הם שעון־קיר ישראלי מאוחסן כ־UTC — לכן הגבולות נבנים ב־UTC.
 */
export function rangeToBounds(range: DateRange): { fromDate: Date; toExclusive: Date } {
  const [fy, fm, fd] = range.from.split("-").map(Number);
  const [ty, tm, td] = range.to.split("-").map(Number);
  return {
    fromDate: new Date(Date.UTC(fy, fm - 1, fd, 0, 0, 0, 0)),
    // td + 1 גולש נכון לחודש/שנה הבאים דרך Date.UTC
    toExclusive: new Date(Date.UTC(ty, tm - 1, td + 1, 0, 0, 0, 0)),
  };
}

/** פענוח query params — נופל חזרה לברירת המחדל אם הערכים חסרים/לא תקינים. */
export function resolveRange(
  fromParam: string | null | undefined,
  toParam: string | null | undefined,
  now: Date = new Date()
): { range: DateRange; isDefault: boolean; allTime: boolean } {
  if (fromParam === "all" || toParam === "all") {
    return { range: { from: "1970-01-01", to: "2099-12-31" }, isDefault: false, allTime: true };
  }
  if (isValidYmd(fromParam) && isValidYmd(toParam)) {
    return { range: { from: fromParam, to: toParam }, isDefault: false, allTime: false };
  }
  return { range: defaultRange(now), isDefault: true, allTime: false };
}
