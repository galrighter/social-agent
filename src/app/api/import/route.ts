import { NextRequest, NextResponse } from "next/server";
import { importExcelBuffer } from "@/lib/importService";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "לא נבחר קובץ" }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const summary = await importExcelBuffer(buffer, file.name);
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Import failed:", error);
    return NextResponse.json(
      { error: "הייבוא נכשל — ודא שהקובץ הוא Excel תקין" },
      { status: 500 }
    );
  }
}
