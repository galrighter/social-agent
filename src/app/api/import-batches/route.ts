import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const batches = await prisma.importBatch.findMany({
    orderBy: { uploadedAt: "desc" },
    take: 50,
  });
  return NextResponse.json(batches);
}
