import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const params = request.nextUrl.searchParams;
  const search = params.get("search")?.trim();
  const type = params.get("type")?.trim();
  const from = params.get("from")?.trim();
  const to = params.get("to")?.trim();
  const amount = params.get("amount")?.trim();
  const batchId = params.get("batchId")?.trim();
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const pageSize = Math.min(200, Math.max(10, Number(params.get("pageSize") ?? 50) || 50));

  const where: Prisma.TransactionWhereInput = {};
  if (search) where.playerName = { contains: search };
  if (type === "payment" || type === "redeem" || type === "unknown") where.type = type;
  if (batchId) where.importBatchId = batchId;
  if (amount && !isNaN(Number(amount))) where.rawAmount = Number(amount);
  if (from || to) {
    where.occurredAt = {};
    if (from) where.occurredAt.gte = new Date(`${from}T00:00:00.000Z`);
    if (to) where.occurredAt.lte = new Date(`${to}T23:59:59.999Z`);
  }

  const [total, rows] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({ total, page, pageSize, rows });
}
