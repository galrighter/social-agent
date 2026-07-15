import { prisma } from "./prisma";
import {
  computeDashboardStats,
  regularPlayerKeys,
  type DashboardStats,
  type TransactionForStats,
} from "./stats";
import { rangeToBounds, type DateRange } from "./dateRange";

export interface RangeStats {
  stats: DashboardStats;
  /**
   * מפתחות השחקנים ה"קבועים" — 10+ משחקים ב*כל התקופה* (לא רק בטווח שנבחר).
   * הדשבורד מסתיר מזדמנים לפי הקבוצה הזו, כך ששחקן קבוע לא נעלם בטווח קצר.
   */
  regularKeys: Set<string>;
}

/**
 * טעינת *כל* העסקאות מה־DB וחישוב סטטיסטיקות הדשבורד.
 * הסינון לטווח נעשה בתוך המנוע לפי תאריך תחילת המשחק — לא לפי occurredAt של
 * השורה — כדי שמשחק שהתחיל לפני הטווח לא ייספר, ו־redeem מאוחר שמשויך למשחק
 * בטווח כן ייספר. התיקונים וההחרגות כבר מיושמים על effectiveAmount/excludedFromStats
 * בזמן הייבוא, כך שהמנוע קורא אותם ישירות.
 * מחזיר גם את קבוצת ה"קבועים" — המחושבת על *כל* העסקאות, ללא סינון טווח.
 */
export async function statsForRange(range: DateRange): Promise<RangeStats> {
  const bounds = rangeToBounds(range);
  const rows = await prisma.transaction.findMany({
    select: {
      id: true,
      playerName: true,
      phone: true,
      type: true,
      rawAmount: true,
      effectiveAmount: true,
      occurredAt: true,
      excludedFromStats: true,
    },
  });
  const txs: TransactionForStats[] = rows.map((r) => ({
    id: r.id,
    playerName: r.playerName,
    phone: r.phone,
    type: r.type,
    rawAmount: r.rawAmount,
    effectiveAmount: r.effectiveAmount,
    occurredAt: r.occurredAt,
    excludedFromStats: r.excludedFromStats,
  }));
  return {
    stats: computeDashboardStats(txs, bounds),
    regularKeys: regularPlayerKeys(txs),
  };
}

/** האם יש בכלל נתונים במסד. */
export async function hasAnyTransactions(): Promise<boolean> {
  const count = await prisma.transaction.count();
  return count > 0;
}
