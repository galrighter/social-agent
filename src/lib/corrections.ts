import { normalizeName, normalizePhone } from "./normalize";
import { toIsoSecond, type TxType } from "./importExcel";

export interface CorrectionRule {
  id?: string;
  name: string;
  enabled: boolean;
  matchPlayerName?: string | null;
  matchPhone?: string | null;
  matchType?: string | null;
  matchOccurredAt?: string | null; // ISO עד שנייה
  matchRawAmount?: number | null;
  effectiveAmount?: number | null;
  excludeFromStats: boolean;
  note?: string | null;
}

export interface CorrectableTx {
  playerName: string;
  phone: string | null;
  type: TxType | string;
  rawAmount: number;
  occurredAt: Date;
}

export interface CorrectionOutcome {
  effectiveAmount: number;
  excludedFromStats: boolean;
  appliedCorrections: string[];
}

function isoSecondsEqual(a: string, b: string): boolean {
  // תומך גם ב"2024-03-23 23:33:21" וגם ב"2024-03-23T23:33:21"
  return a.replace(" ", "T").slice(0, 19) === b.replace(" ", "T").slice(0, 19);
}

/** האם תיקון נתונים חל על עסקה — כל תנאי match שמוגדר חייב להתקיים. */
export function correctionMatches(rule: CorrectionRule, tx: CorrectableTx): boolean {
  if (!rule.enabled) return false;
  if (rule.matchPlayerName != null && rule.matchPlayerName !== "") {
    if (normalizeName(rule.matchPlayerName) !== normalizeName(tx.playerName)) return false;
  }
  if (rule.matchPhone != null && rule.matchPhone !== "") {
    if (normalizePhone(rule.matchPhone) !== normalizePhone(tx.phone)) return false;
  }
  if (rule.matchType != null && rule.matchType !== "") {
    if (rule.matchType !== tx.type) return false;
  }
  if (rule.matchOccurredAt != null && rule.matchOccurredAt !== "") {
    if (!isoSecondsEqual(rule.matchOccurredAt, toIsoSecond(tx.occurredAt))) return false;
  }
  if (rule.matchRawAmount != null) {
    if (Math.abs(rule.matchRawAmount - tx.rawAmount) > 1e-9) return false;
  }
  return true;
}

/** החלת כל התיקונים הפעילים על עסקה — מחזיר effectiveAmount והחרגה. */
export function applyCorrections(
  tx: CorrectableTx,
  rules: CorrectionRule[]
): CorrectionOutcome {
  let effectiveAmount = tx.rawAmount;
  let excludedFromStats = false;
  const appliedCorrections: string[] = [];

  for (const rule of rules) {
    if (!correctionMatches(rule, tx)) continue;
    appliedCorrections.push(rule.name);
    if (rule.effectiveAmount != null) effectiveAmount = rule.effectiveAmount;
    if (rule.excludeFromStats) excludedFromStats = true;
  }

  return { effectiveAmount, excludedFromStats, appliedCorrections };
}

/**
 * תיקוני ברירת המחדל (seed) — ניקוי טעות ההקלדה מ־23.3.2024:
 * payment של 2500 שאמור היה להיות 25, ו־redeem של ‎-2475 שנרשם רק כדי לאזן אותה.
 */
export const SEED_CORRECTIONS: CorrectionRule[] = [
  {
    name: "תיקון 23.3.2024 – תשלום 2500 ← 25",
    enabled: true,
    matchPlayerName: "Lidor Horovitz",
    matchType: "payment",
    matchOccurredAt: "2024-03-23T23:33:21",
    matchRawAmount: 2500,
    effectiveAmount: 25,
    excludeFromStats: false,
    note: "טעות הקלדה: הוקלד 2500 במקום 25",
  },
  {
    name: "תיקון 23.3.2024 – החרגת איזון -2475",
    enabled: true,
    matchPlayerName: "Lidor Horovitz",
    matchType: "redeem",
    matchOccurredAt: "2024-03-23T23:34:43",
    matchRawAmount: -2475,
    effectiveAmount: null,
    excludeFromStats: true,
    note: "שורת איזון לטעות ההקלדה — מוחרגת מהסטטיסטיקות",
  },
];
