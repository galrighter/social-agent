import { describe, expect, it } from "vitest";
import {
  defaultRange,
  previousMonthRange,
  rangeToBounds,
  rangeToDates,
  resolveRange,
  yearToDateRange,
} from "@/lib/dateRange";

describe("טווח תאריכים ברירת מחדל (Asia/Jerusalem)", () => {
  it("מתחילת החודש הנוכחי ועד היום", () => {
    // 14.7.2026 12:00 UTC = 15:00 בישראל
    const now = new Date("2026-07-14T12:00:00Z");
    expect(defaultRange(now)).toEqual({ from: "2026-07-01", to: "2026-07-14" });
  });

  it("חוצה חצות לפי שעון ישראל, לא לפי UTC", () => {
    // 31.7.2026 21:30 UTC = 1.8.2026 00:30 בישראל (UTC+3)
    const now = new Date("2026-07-31T21:30:00Z");
    expect(defaultRange(now)).toEqual({ from: "2026-08-01", to: "2026-08-01" });
  });

  it("חודש קודם — כולל מעבר שנה", () => {
    const now = new Date("2026-01-10T12:00:00Z");
    expect(previousMonthRange(now)).toEqual({ from: "2025-12-01", to: "2025-12-31" });
  });

  it("מתחילת השנה", () => {
    const now = new Date("2026-07-14T12:00:00Z");
    expect(yearToDateRange(now)).toEqual({ from: "2026-01-01", to: "2026-07-14" });
  });

  it("resolveRange נופל לברירת המחדל על ערכים לא תקינים", () => {
    const now = new Date("2026-07-14T12:00:00Z");
    const { range, isDefault } = resolveRange("לא-תאריך", "2026-07-10", now);
    expect(isDefault).toBe(true);
    expect(range).toEqual({ from: "2026-07-01", to: "2026-07-14" });
  });

  it("resolveRange מכבד טווח מפורש ו'כל התקופה'", () => {
    const explicit = resolveRange("2024-01-01", "2024-12-31");
    expect(explicit.isDefault).toBe(false);
    expect(explicit.range).toEqual({ from: "2024-01-01", to: "2024-12-31" });

    const all = resolveRange("all", null);
    expect(all.allTime).toBe(true);
  });

  it("גבולות הסינון: מ־00:00 ועד 23:59:59.999", () => {
    const { fromDate, toDate } = rangeToDates({ from: "2026-07-01", to: "2026-07-14" });
    expect(fromDate.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(toDate.toISOString()).toBe("2026-07-14T23:59:59.999Z");
  });

  it("rangeToBounds: [from 00:00, exclusive start-of-next-day)", () => {
    const { fromDate, toExclusive } = rangeToBounds({ from: "2026-07-01", to: "2026-07-15" });
    expect(fromDate.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(toExclusive.toISOString()).toBe("2026-07-16T00:00:00.000Z");
  });

  it("rangeToBounds: to בסוף חודש גולש נכון לחודש הבא", () => {
    const { toExclusive } = rangeToBounds({ from: "2026-07-01", to: "2026-07-31" });
    expect(toExclusive.toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });
});
