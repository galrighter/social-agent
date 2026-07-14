import { prisma } from "./prisma";
import { computeStats, type DashboardStats, type StatsTx } from "./stats";
import { rangeToDates, type DateRange } from "./dateRange";

/** טעינת עסקאות בטווח וחישוב סטטיסטיקות הדשבורד. */
export async function statsForRange(range: DateRange): Promise<DashboardStats> {
  const { fromDate, toDate } = rangeToDates(range);
  const rows = await prisma.transaction.findMany({
    where: { occurredAt: { gte: fromDate, lte: toDate } },
    select: {
      playerKey: true,
      playerName: true,
      type: true,
      effectiveAmount: true,
      occurredAt: true,
      excludedFromStats: true,
    },
  });
  const txs: StatsTx[] = rows;
  return computeStats(txs);
}

/** האם יש בכלל נתונים במסד. */
export async function hasAnyTransactions(): Promise<boolean> {
  const count = await prisma.transaction.count();
  return count > 0;
}
