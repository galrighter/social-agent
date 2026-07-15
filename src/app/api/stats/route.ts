import { NextRequest, NextResponse } from "next/server";
import { resolveRange } from "@/lib/dateRange";
import { statsForRange } from "@/lib/statsService";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const { range, isDefault, allTime } = resolveRange(
    params.get("from"),
    params.get("to")
  );
  const stats = await statsForRange(range);

  return NextResponse.json({ range, isDefault, allTime, stats });
}
