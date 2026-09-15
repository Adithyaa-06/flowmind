import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/inngest/client";

export async function POST(req: NextRequest) {
  const { nodes, edges } = await req.json();

  const result = await inngest.send({
    name: "workflow/run",
    data: { nodes, edges },
  });

  return NextResponse.json({ eventId: result.ids[0] });
}