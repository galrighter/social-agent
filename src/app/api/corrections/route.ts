import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSeedCorrections, reapplyCorrectionsToAll } from "@/lib/importService";

export const runtime = "nodejs";

export async function GET() {
  await ensureSeedCorrections();
  const corrections = await prisma.dataCorrection.findMany({
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(corrections);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  // עדכון מצב פעיל/כבוי לתיקון קיים
  if (body.id && typeof body.enabled === "boolean" && !body.name) {
    const updated = await prisma.dataCorrection.update({
      where: { id: body.id },
      data: { enabled: body.enabled },
    });
    const affected = await reapplyCorrectionsToAll();
    return NextResponse.json({ correction: updated, affectedTransactions: affected });
  }

  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "חסר שם לתיקון" }, { status: 400 });
  }

  const created = await prisma.dataCorrection.create({
    data: {
      name: body.name,
      enabled: body.enabled ?? true,
      matchPlayerName: body.matchPlayerName || null,
      matchPhone: body.matchPhone || null,
      matchType: body.matchType || null,
      matchOccurredAt: body.matchOccurredAt || null,
      matchRawAmount:
        body.matchRawAmount === undefined || body.matchRawAmount === null || body.matchRawAmount === ""
          ? null
          : Number(body.matchRawAmount),
      effectiveAmount:
        body.effectiveAmount === undefined || body.effectiveAmount === null || body.effectiveAmount === ""
          ? null
          : Number(body.effectiveAmount),
      excludeFromStats: Boolean(body.excludeFromStats),
      note: body.note || null,
    },
  });

  const affected = await reapplyCorrectionsToAll();
  return NextResponse.json({ correction: created, affectedTransactions: affected });
}
