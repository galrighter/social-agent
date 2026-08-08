import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import officeCrypto from "officecrypto-tool";
import {
  decryptWorkbook,
  isEncryptedWorkbook,
  PasswordRequiredError,
  WrongPasswordError,
} from "@/lib/officeCrypto";
import { parseWorkbook } from "@/lib/importExcel";

const ROWS = [
  { שם: "דני כהן", פלאפון: "0529876543", סוג: "payment", סכום: 50, תאריך: "2024-03-23 20:15:00" },
  { שם: "דני כהן", פלאפון: "0529876543", סוג: "redeem", סכום: -75, תאריך: "2024-03-24 01:00:00" },
];

const PASSWORD = "סוד-123";

function plainWorkbook(): Buffer {
  const sheet = XLSX.utils.json_to_sheet(ROWS);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "גיליון1");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/** `agile` הוא ברירת המחדל של Excel מודרני, `standard` של גרסאות ישנות יותר. */
const ENCRYPTIONS: Array<["agile" | "standard", () => Buffer]> = [
  ["agile", () => officeCrypto.encrypt(plainWorkbook(), { password: PASSWORD })],
  ["standard", () => officeCrypto.encrypt(plainWorkbook(), { password: PASSWORD, type: "standard" })],
];

describe("קבצים מוגני סיסמה", () => {
  it("קובץ רגיל אינו מזוהה כמוצפן וחוזר כמות שהוא", async () => {
    const buffer = plainWorkbook();
    expect(isEncryptedWorkbook(buffer)).toBe(false);
    await expect(decryptWorkbook(buffer)).resolves.toBe(buffer);
  });

  it("קלט שאינו Excel כלל לא מפיל את הזיהוי", () => {
    expect(isEncryptedWorkbook(Buffer.from("שם,סכום\nדני,50\n"))).toBe(false);
    expect(isEncryptedWorkbook(Buffer.alloc(0))).toBe(false);
  });

  for (const [label, encrypt] of ENCRYPTIONS) {
    describe(`הצפנת ${label}`, () => {
      it("מזוהה כמוצפן ונפתח עם הסיסמה הנכונה", async () => {
        const encrypted = encrypt();
        expect(isEncryptedWorkbook(encrypted)).toBe(true);

        const decrypted = await decryptWorkbook(encrypted, PASSWORD);
        const result = parseWorkbook(decrypted);
        expect(result.totalRows).toBe(2);
        expect(result.invalidRows).toBe(0);
        expect(result.rows[0].playerName).toBe("דני כהן");
        expect(result.rows[1].rawAmount).toBe(-75);
      });

      it("ללא סיסמה זורק PasswordRequiredError", async () => {
        await expect(decryptWorkbook(encrypt())).rejects.toBeInstanceOf(PasswordRequiredError);
        await expect(decryptWorkbook(encrypt(), "")).rejects.toBeInstanceOf(PasswordRequiredError);
      });

      it("סיסמה שגויה זורקת WrongPasswordError", async () => {
        await expect(decryptWorkbook(encrypt(), "סיסמה-אחרת")).rejects.toBeInstanceOf(
          WrongPasswordError
        );
      });
    });
  }
});
