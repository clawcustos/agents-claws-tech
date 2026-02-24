import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 60;

// GET /api/agents — list all registered agents, sorted by agentId asc
export async function GET() {
  try {
    const agents = await prisma.agentRegistry.findMany({
      orderBy: { agentId: "asc" },
    });
    return NextResponse.json({ agents });
  } catch (err) {
    console.error("[api/agents] error:", err);
    return NextResponse.json({ agents: [] }, { status: 500 });
  }
}
