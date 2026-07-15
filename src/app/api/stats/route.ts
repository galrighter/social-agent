import { NextRequest, NextResponse } from "next/server";
import { resolveRange } from "@/lib/dateRange";
import { statsForRange } from "@/lib/statsService";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const params = request.nextUrl.searchParams;
  const { range, isDefault, allTime } = resolveRange(
    params.get("from"),
    params.get("to")
  );
  const stats = await statsForRange(range);

  return NextResponse.json({ range, isDefault, allTime, stats });
}
