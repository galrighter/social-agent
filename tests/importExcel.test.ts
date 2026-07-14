import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  buildRowHash,
  parseWorkbook,
  planImport,
  parseExcelDate,
  parseAmount,
  resolveType,
} from "@/lib/importExcel";

function makeWorkbookBuffer(
  rows: Array<Record<string, unknown>>,
  sheetName = "גיליון1"
): Buffer {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

const SAMPLE_ROWS = [
  { שם: "Lidor Horovitz", פלאפון: "0501234567", סוג: "payment", סכום: 25, תאריך: "2024-03-23 20:00:00" },
  { שם: "דני כהן", פלאפון: "0529876543", סוג: "payment", סכום: 50, תאריך: "2024-03-23 20:15:00" },
  { שם: "דני כהן", פלאפון: "0529876543", סוג: "redeem", סכום: -75, תאריך: "2024-03-24 01:00:00" },
];

describe("ייבוא Excel", () => {
  it("קורא שורות עם עמודות בעברית", () => {
    const result = parseWorkbook(makeWorkbookBuffer(SAMPLE_ROWS));
    expect(result.totalRows).toBe(3);
    expect(result.invalidRows).toBe(0);
    expect(result.rows).toHaveLength(3);
    expect(result.rows[0].playerName).toBe("Lidor Horovitz");
    expect(result.rows[0].type).toBe("payment");
    expect(result.rows[2].type).toBe("redeem");
    expect(result.rows[2].rawAmount).toBe(-75);
  });

  it("ייבוא אותו קובץ פעמיים לא מכפיל שורות", () => {
    const buffer = makeWorkbookBuffer(SAMPLE_ROWS);
    const persistedHashes = new Set<string>(); // מדמה את מסד הנתונים

    const first = parseWorkbook(buffer);
    const firstPlan = planImport(first.rows, persistedHashes);
    expect(firstPlan.toInsert).toHaveLength(3);
    expect(firstPlan.skippedDuplicates).toBe(0);
    for (const row of firstPlan.toInsert) persistedHashes.add(row.rowHash);

    const second = parseWorkbook(buffer);
    const secondPlan = planImport(second.rows, persistedHashes);
    expect(secondPlan.toInsert).toHaveLength(0);
    expect(secondPlan.skippedDuplicates).toBe(3);
  });

  it("קובץ חדש עם שורות ישנות וחדשות — רק החדשות נוספות", () => {
    const persistedHashes = new Set<string>();
    const first = parseWorkbook(makeWorkbookBuffer(SAMPLE_ROWS));
    for (const row of planImport(first.rows, persistedHashes).toInsert) {
      persistedHashes.add(row.rowHash);
    }

    const withNewRow = [
      ...SAMPLE_ROWS,
      { שם: "יוסי לוי", פלאפון: "0541112222", סוג: "payment", סכום: 25, תאריך: "2024-03-30 21:00:00" },
    ];
    const second = parseWorkbook(makeWorkbookBuffer(withNewRow));
    const plan = planImport(second.rows, persistedHashes);
    expect(plan.toInsert).toHaveLength(1);
    expect(plan.toInsert[0].playerName).toBe("יוסי לוי");
    expect(plan.skippedDuplicates).toBe(3);
  });

  it("rowHash יציב — אותה שורה תמיד מקבלת אותו hash", () => {
    const input = {
      playerName: "Lidor Horovitz",
      phone: "0501234567",
      type: "payment" as const,
      rawAmount: 25,
      occurredAt: new Date(Date.UTC(2024, 2, 23, 23, 33, 21)),
      notes: null,
    };
    const a = buildRowHash(input);
    const b = buildRowHash({ ...input });
    expect(a).toBe(b);

    // נרמול: רווחים מיותרים ואותיות גדולות לא משנים את ה-hash
    const c = buildRowHash({ ...input, playerName: "  lidor   HOROVITZ " });
    expect(c).toBe(a);

    // שינוי סכום משנה את ה-hash
    const d = buildRowHash({ ...input, rawAmount: 50 });
    expect(d).not.toBe(a);
  });

  it("מדלג על שורות ריקות וסופר שורות לא תקינות", () => {
    const rows = [
      { שם: "דני", פלאפון: null, סוג: "payment", סכום: 25, תאריך: "2024-01-01 20:00" },
      { שם: null, פלאפון: null, סוג: null, סכום: null, תאריך: null }, // ריקה — מדולגת
      { שם: "בלי תאריך", פלאפון: null, סוג: "payment", סכום: 25, תאריך: "לא תאריך" },
    ];
    const result = parseWorkbook(makeWorkbookBuffer(rows));
    expect(result.totalRows).toBe(2);
    expect(result.rows).toHaveLength(1);
    expect(result.invalidRows).toBe(1);
  });

  it("תומך בתאריך Excel סריאלי ובטקסט", () => {
    // 45374 = 2024-03-23
    const fromSerial = parseExcelDate(45374);
    expect(fromSerial?.toISOString().slice(0, 10)).toBe("2024-03-23");

    const fromText = parseExcelDate("23/03/2024 23:33:21");
    expect(fromText?.toISOString()).toBe("2024-03-23T23:33:21.000Z");

    const fromIso = parseExcelDate("2024-03-23 23:33:21");
    expect(fromIso?.toISOString()).toBe("2024-03-23T23:33:21.000Z");
  });

  it("ממיר סכומים עם פסיקים וסימן שקל", () => {
    expect(parseAmount("1,250")).toBe(1250);
    expect(parseAmount("₪25")).toBe(25);
    expect(parseAmount(-75)).toBe(-75);
    expect(parseAmount("abc")).toBeNull();
  });

  it("קובע סוג לפי עמודת סוג ולפי סימן הסכום", () => {
    expect(resolveType("payment", 25)).toBe("payment");
    expect(resolveType("redeem", -100)).toBe("redeem");
    expect(resolveType(null, 25)).toBe("payment");
    expect(resolveType(null, -100)).toBe("redeem");
    expect(resolveType(null, 0)).toBe("unknown");
  });
});
