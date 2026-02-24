import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 60;

// GET /api/agents/[handle] — lookup agent by handle
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;

  try {
    const agent = await prisma.agentRegistry.findUnique({
      where: { handle: handle.toLowerCase() },
    });

    if (!agent) {
      return NextResponse.json({ error: "agent not found" }, { status: 404 });
    }

    return NextResponse.json({ agent });
  } catch (err) {
    console.error("[api/agents/[handle]] error:", err);
    return NextResponse.json({ error: "lookup failed" }, { status: 500 });
  }
}

// PATCH /api/agents/[handle] — update lastSeenAt and optional fields
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;

  try {
    const body = await req.json();
    const agent = await prisma.agentRegistry.update({
      where: { handle: handle.toLowerCase() },
      data: {
        lastSeenAt: new Date(),
        ...(body.agentId     !== undefined && { agentId: body.agentId }),
        ...(body.wallet      !== undefined && { wallet: body.wallet }),
        ...(body.tokenAddress !== undefined && { tokenAddress: body.tokenAddress }),
        ...(body.tokenSymbol  !== undefined && { tokenSymbol: body.tokenSymbol }),
      },
    });
    return NextResponse.json({ ok: true, agent });
  } catch (err) {
    console.error("[api/agents/[handle]] PATCH error:", err);
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }
}
