import * as XLSX from "xlsx";
import { createHash } from "node:crypto";
import { normalizeName, normalizePhone, playerKeyOf } from "./normalize";

export type TxType = "payment" | "redeem" | "unknown";

export interface ParsedRow {
  playerName: string;
  phone: string | null;
  playerKey: string;
  type: TxType;
  rawAmount: number;
  occurredAt: Date;
  rawDateText: string | null;
  notes: string | null;
  rowHash: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  totalRows: number;
  invalidRows: number;
  errors: string[];
}

/** מיפוי שמות עמודות בעברית (ואנגלית) לשדות. */
const HEADER_MAP: Record<string, string> = {
  "שם": "name",
  "שם שחקן": "name",
  "שם מלא": "name",
  "name": "name",
  "פלאפון": "phone",
  "טלפון": "phone",
  "נייד": "phone",
  "phone": "phone",
  "סוג": "type",
  "type": "type",
  "סכום": "amount",
  "amount": "amount",
  "תאריך": "date",
  "date": "date",
  "הערות": "notes",
  "הערה": "notes",
  "notes": "notes",
};

function normalizeHeader(header: string): string | null {
  const key = String(header).trim().toLowerCase();
  return HEADER_MAP[key] ?? null;
}

/** המרת תאריך סריאלי של Excel לתאריך (שעון קיר, נשמר כ־UTC). */
export function excelSerialToDate(serial: number): Date {
  // עידן האקסל: 1899-12-30 (כולל באג שנת 1900 המובנה בפורמט)
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  return new Date(ms);
}

const DMY_RE =
  /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
const YMD_RE =
  /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;

/** המרת ערך תאריך מהאקסל (מספר סריאלי, טקסט או Date) לתאריך תקין. */
export function parseExcelDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date && !isNaN(value.getTime())) {
    // ספריית xlsx מחזירה Date לפי שעון קיר — משמרים אותו כ־UTC
    return new Date(
      Date.UTC(
        value.getFullYear(),
        value.getMonth(),
        value.getDate(),
        value.getHours(),
        value.getMinutes(),
        value.getSeconds()
      )
    );
  }
  if (typeof value === "number" && isFinite(value)) {
    return excelSerialToDate(value);
  }
  const text = String(value).trim();
  let m = text.match(YMD_RE);
  if (m) {
    return new Date(
      Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0))
    );
  }
  m = text.match(DMY_RE);
  if (m) {
    let year = +m[3];
    if (year < 100) year += 2000;
    return new Date(
      Date.UTC(year, +m[2] - 1, +m[1], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0))
    );
  }
  const parsed = new Date(text);
  if (!isNaN(parsed.getTime())) return parsed;
  return null;
}

/** המרת ערך סכום למספר (תומך בפסיקים, סימן ₪ ורווחים). */
export function parseAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return isFinite(value) ? value : null;
  const cleaned = String(value)
    .replace(/[₪,\s]/g, "")
    .replace(/−/g, "-");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return isFinite(n) ? n : null;
}

/** קביעת סוג השורה לפי עמודת "סוג" והסכום. */
export function resolveType(typeText: unknown, amount: number): TxType {
  const t = String(typeText ?? "").trim().toLowerCase();
  if (t === "payment" || t === "תשלום" || t === "כניסה") return "payment";
  if (t === "redeem" || t === "זכייה" || t === "משיכה") return "redeem";
  if (amount > 0) return "payment";
  if (amount < 0) return "redeem";
  return "unknown";
}

/** ISO עד שנייה — הבסיס היציב ל־rowHash ולהתאמת תיקונים. */
export function toIsoSecond(date: Date): string {
  return date.toISOString().slice(0, 19);
}

/**
 * rowHash יציב: שם מנורמל + טלפון מנורמל + סוג + סכום + תאריך ISO עד שנייה + הערות.
 * אותה שורה תמיד תקבל אותו hash — גם בהעלאה חוזרת של אותו קובץ.
 */
export function buildRowHash(input: {
  playerName: string;
  phone: string | number | null | undefined;
  type: TxType;
  rawAmount: number;
  occurredAt: Date;
  notes: string | null | undefined;
}): string {
  const parts = [
    normalizeName(input.playerName),
    normalizePhone(input.phone),
    input.type,
    String(input.rawAmount),
    toIsoSecond(input.occurredAt),
    String(input.notes ?? "").trim(),
  ].join("|");
  return createHash("sha256").update(parts, "utf8").digest("hex");
}

type RawRecord = Record<string, unknown>;

function mapRecord(record: RawRecord): RawRecord {
  const mapped: RawRecord = {};
  for (const [key, value] of Object.entries(record)) {
    const field = normalizeHeader(key);
    if (field && mapped[field] === undefined) mapped[field] = value;
  }
  return mapped;
}

function isEmptyRecord(record: RawRecord): boolean {
  return Object.values(record).every(
    (v) => v === null || v === undefined || String(v).trim() === ""
  );
}

/** קריאת כל הגיליונות בקובץ Excel והמרתם לשורות עסקה מנורמלות. */
export function parseWorkbook(buffer: Buffer | ArrayBuffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const rows: ParsedRow[] = [];
  const errors: string[] = [];
  let totalRows = 0;
  let invalidRows = 0;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const records = XLSX.utils.sheet_to_json<RawRecord>(sheet, {
      defval: null,
      raw: true,
    });

    for (const [index, rawRecord] of records.entries()) {
      if (isEmptyRecord(rawRecord)) continue;
      totalRows++;

      const record = mapRecord(rawRecord);
      const name = String(record.name ?? "").trim();
      const amount = parseAmount(record.amount);
      const occurredAt = parseExcelDate(record.date);

      if (!name || amount === null || !occurredAt) {
        invalidRows++;
        errors.push(
          `גיליון "${sheetName}" שורה ${index + 2}: ` +
            (!name ? "חסר שם" : amount === null ? "סכום לא תקין" : "תאריך לא תקין")
        );
        continue;
      }

      const type = resolveType(record.type, amount);
      const phoneNormalized = normalizePhone(record.phone as string | number | null);
      const notes =
        record.notes === null || record.notes === undefined
          ? null
          : String(record.notes).trim() || null;

      rows.push({
        playerName: name,
        phone: phoneNormalized || null,
        playerKey: playerKeyOf(name, record.phone as string | number | null),
        type,
        rawAmount: amount,
        occurredAt,
        rawDateText:
          typeof record.date === "string" ? record.date : null,
        notes,
        rowHash: buildRowHash({
          playerName: name,
          phone: record.phone as string | number | null,
          type,
          rawAmount: amount,
          occurredAt,
          notes,
        }),
      });
    }
  }

  return { rows, totalRows, invalidRows, errors };
}

export interface ImportPlan {
  toInsert: ParsedRow[];
  skippedDuplicates: number;
}

/**
 * תכנון ייבוא מול hashes קיימים: שורה שכבר קיימת (או כפולה בתוך הקובץ)
 * מדולגת — לעולם לא מתעדכנת ולא נמחקת.
 */
export function planImport(rows: ParsedRow[], existingHashes: Set<string>): ImportPlan {
  const toInsert: ParsedRow[] = [];
  const seen = new Set(existingHashes);
  let skippedDuplicates = 0;

  for (const row of rows) {
    if (seen.has(row.rowHash)) {
      skippedDuplicates++;
      continue;
    }
    seen.add(row.rowHash);
    toInsert.push(row);
  }

  return { toInsert, skippedDuplicates };
}
