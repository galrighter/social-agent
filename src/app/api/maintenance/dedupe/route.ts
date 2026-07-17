import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildIdentityKey } from "@/lib/importExcel";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * ניקוי כפילויות-זהות קיימות: עסקאות שהן אותה עסקה בדיוק (שם/טלפון/סוג/סכום/
 * תאריך-עד-שנייה) ונכנסו יותר מפעם אחת (בגלל הבדל בעמודת ההערות ביצוא חוזר).
 * לכל קבוצת זהות נשמרת שורה אחת פעילה — המוקדמת ביותר; היתר מסומנות
 * `dedupeExcluded` (וגם `excludedFromStats`) כדי לצאת מכל החישובים.
 *
 * הפיך: ביטול ההחרגה = איפוס `dedupeExcluded` והרצת reapply. אינו מוחק נתונים.
 * Idempotent: הרצה חוזרת לא תחריג שורות נוספות.
 */
export async function POST() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const txs = await prisma.transaction.findMany({
    orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      playerName: true,
      phone: true,
      type: true,
      rawAmount: true,
      occurredAt: true,
      dedupeExcluded: true,
    },
  });

  const seen = new Set<string>();
  const duplicateKeys = new Set<string>();
  const toExclude: string[] = [];

  for (const t of txs) {
    const key = buildIdentityKey(t);
    if (!seen.has(key)) {
      seen.add(key);
      continue;
    }
    // שורה זו היא כפילות של שורה מוקדמת יותר שכבר נשמרה כפעילה
    duplicateKeys.add(key);
    if (!t.dedupeExcluded) toExclude.push(t.id);
  }

  if (toExclude.length > 0) {
    await prisma.transaction.updateMany({
      where: { id: { in: toExclude } },
      data: { dedupeExcluded: true, excludedFromStats: true },
    });
  }

  return NextResponse.json({
    totalTransactions: txs.length,
    duplicateIdentityGroups: duplicateKeys.size,
    rowsExcludedNow: toExclude.length,
  });
}
