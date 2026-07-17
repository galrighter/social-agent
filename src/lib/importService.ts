import { prisma } from "./prisma";
import { parseWorkbook, planImport, buildIdentityKey } from "./importExcel";
import { applyCorrections, SEED_CORRECTIONS, type CorrectionRule } from "./corrections";

export interface ImportSummary {
  batchId: string;
  fileName: string;
  totalRows: number;
  insertedRows: number;
  skippedDuplicateRows: number;
  invalidRows: number;
  correctionRows: number;
  errors: string[];
}

/** מוודא שתיקוני ברירת המחדל קיימים במסד (idempotent). */
export async function ensureSeedCorrections(): Promise<void> {
  for (const rule of SEED_CORRECTIONS) {
    await prisma.dataCorrection.upsert({
      where: { name: rule.name },
      update: {},
      create: {
        name: rule.name,
        enabled: rule.enabled,
        matchPlayerName: rule.matchPlayerName ?? null,
        matchPhone: rule.matchPhone ?? null,
        matchType: rule.matchType ?? null,
        matchOccurredAt: rule.matchOccurredAt ?? null,
        matchRawAmount: rule.matchRawAmount ?? null,
        effectiveAmount: rule.effectiveAmount ?? null,
        excludeFromStats: rule.excludeFromStats,
        note: rule.note ?? null,
      },
    });
  }
}

export async function loadEnabledCorrections(): Promise<CorrectionRule[]> {
  const rows = await prisma.dataCorrection.findMany({ where: { enabled: true } });
  return rows.map((r) => ({ ...r, enabled: true }));
}

/** ייבוא קובץ Excel: פענוח, דילוג על כפילויות לפי rowHash, החלת תיקונים והכנסה. */
export async function importExcelBuffer(
  buffer: Buffer,
  fileName: string
): Promise<ImportSummary> {
  await ensureSeedCorrections();
  const corrections = await loadEnabledCorrections();

  const parsed = parseWorkbook(buffer);

  // זיהוי כפילויות לפי מפתח-זהות (ללא הערות), לא לפי rowHash — כדי שיצוא חוזר
  // של אותה עסקה עם הערה שונה/ריקה יזוהה ולא ייכנס פעמיים.
  const existing = await prisma.transaction.findMany({
    select: {
      playerName: true,
      phone: true,
      type: true,
      rawAmount: true,
      occurredAt: true,
    },
  });
  const existingIdentityKeys = new Set(existing.map((e) => buildIdentityKey(e)));

  const plan = planImport(parsed.rows, existingIdentityKeys);

  let correctionRows = 0;
  const rowsToCreate = plan.toInsert.map((row) => {
    const outcome = applyCorrections(row, corrections);
    if (outcome.appliedCorrections.length > 0) correctionRows++;
    return {
      rowHash: row.rowHash,
      playerKey: row.playerKey,
      playerName: row.playerName,
      phone: row.phone,
      type: row.type,
      rawAmount: row.rawAmount,
      effectiveAmount: outcome.effectiveAmount,
      occurredAt: row.occurredAt,
      rawDateText: row.rawDateText,
      notes: row.notes,
      sourceFileName: fileName,
      excludedFromStats: outcome.excludedFromStats,
    };
  });

  const batch = await prisma.$transaction(async (tx) => {
    const createdBatch = await tx.importBatch.create({
      data: {
        fileName,
        totalRows: parsed.totalRows,
        insertedRows: rowsToCreate.length,
        skippedDuplicateRows: plan.skippedDuplicates,
        invalidRows: parsed.invalidRows,
        correctionRows,
      },
    });
    if (rowsToCreate.length > 0) {
      await tx.transaction.createMany({
        data: rowsToCreate.map((r) => ({ ...r, importBatchId: createdBatch.id })),
      });
    }
    return createdBatch;
  });

  return {
    batchId: batch.id,
    fileName,
    totalRows: parsed.totalRows,
    insertedRows: rowsToCreate.length,
    skippedDuplicateRows: plan.skippedDuplicates,
    invalidRows: parsed.invalidRows,
    correctionRows,
    errors: parsed.errors,
  };
}

/** החלה מחדש של כל התיקונים על כל העסקאות (אחרי שינוי/הוספת תיקון). */
export async function reapplyCorrectionsToAll(): Promise<number> {
  const corrections = await loadEnabledCorrections();
  const transactions = await prisma.transaction.findMany();
  let updated = 0;

  for (const tx of transactions) {
    const outcome = applyCorrections(
      {
        playerName: tx.playerName,
        phone: tx.phone,
        type: tx.type,
        rawAmount: tx.rawAmount,
        occurredAt: tx.occurredAt,
      },
      corrections
    );
    // החרגת כפילות (dedupeExcluded) גוברת תמיד — reapply של תיקונים לעולם לא
    // מבטל אותה, אחרת כפל-הספירה היה חוזר בשקט בהוספת/שינוי כל תיקון.
    const targetExcluded = outcome.excludedFromStats || tx.dedupeExcluded;
    if (
      outcome.effectiveAmount !== tx.effectiveAmount ||
      targetExcluded !== tx.excludedFromStats
    ) {
      await prisma.transaction.update({
        where: { id: tx.id },
        data: {
          effectiveAmount: outcome.effectiveAmount,
          excludedFromStats: targetExcluded,
        },
      });
      updated++;
    }
  }

  return updated;
}
