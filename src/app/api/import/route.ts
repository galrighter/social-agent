import { NextRequest, NextResponse } from "next/server";
import { importExcelBuffer } from "@/lib/importService";
import {
  decryptWorkbook,
  PasswordRequiredError,
  WrongPasswordError,
} from "@/lib/officeCrypto";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "לא נבחר קובץ" }, { status: 400 });
    }
    // הסיסמה אופציונלית — נדרשת רק לקבצים מוגנים, ומשמשת בזיכרון בלבד.
    const passwordField = formData.get("password");
    const password = typeof passwordField === "string" && passwordField !== "" ? passwordField : null;

    const buffer = await decryptWorkbook(Buffer.from(await file.arrayBuffer()), password);
    const summary = await importExcelBuffer(buffer, file.name);
    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof PasswordRequiredError) {
      return NextResponse.json(
        { error: "הקובץ מוגן בסיסמה — הזן את סיסמת הקובץ כדי לייבא אותו", passwordRequired: true },
        { status: 400 }
      );
    }
    if (error instanceof WrongPasswordError) {
      return NextResponse.json(
        { error: "הסיסמה שגויה — נסה שוב", passwordRequired: true, wrongPassword: true },
        { status: 400 }
      );
    }
    console.error("Import failed:", error);
    return NextResponse.json(
      { error: "הייבוא נכשל — ודא שהקובץ הוא Excel תקין" },
      { status: 500 }
    );
  }
}
