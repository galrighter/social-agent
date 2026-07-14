import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const batches = await prisma.importBatch.findMany({
    orderBy: { uploadedAt: "desc" },
    take: 50,
  });
  return NextResponse.json(batches);
}
