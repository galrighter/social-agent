import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSeedCorrections } from "@/lib/importService";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

export async function DELETE() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "זמין רק בסביבת פיתוח" }, { status: 403 });
  }
  await prisma.transaction.deleteMany();
  await prisma.importBatch.deleteMany();
  await prisma.dataCorrection.deleteMany();
  await ensureSeedCorrections();
  return NextResponse.json({ ok: true });
}
