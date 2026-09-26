import { NextRequest, NextResponse } from "next/server";
import { getRunStatus } from "@/lib/runStore";

export async function GET(req: NextRequest) {
  const runId = req.nextUrl.searchParams.get("runId");
  if (!runId) {
    return NextResponse.json({ error: "runId required" }, { status: 400 });
  }

  const record = getRunStatus(runId);
  if (!record) {
    return NextResponse.json({ status: "unknown" });
  }

  return NextResponse.json(record);
}