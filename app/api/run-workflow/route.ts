import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import { setRunStatus } from "@/lib/runStore";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  const { nodes, edges } = await req.json();
  const runId = randomUUID();

  setRunStatus(runId, { status: "running" });

  await inngest.send({
    name: "workflow/run",
    data: { runId, nodes, edges },
  });

  return NextResponse.json({ runId });
}