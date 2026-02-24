import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/agents/register
// Called by the create-custos-agent wizard after successful CustosNetwork inscription
// Body: { handle, agentId, wallet, purpose, modelId, frequencyMin, tokenAddress, tokenSymbol }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { handle, agentId, wallet, purpose, modelId, frequencyMin, tokenAddress, tokenSymbol } = body;

    if (!handle || typeof handle !== "string") {
      return NextResponse.json({ error: "handle required" }, { status: 400 });
    }

    // Validate handle format
    if (!/^[a-z0-9-]{2,24}$/.test(handle)) {
      return NextResponse.json({ error: "invalid handle format" }, { status: 400 });
    }

    const agent = await prisma.agentRegistry.upsert({
      where: { handle },
      update: {
        agentId:     agentId     ?? undefined,
        wallet:      wallet      ?? undefined,
        purpose:     purpose     ?? undefined,
        modelId:     modelId     ?? undefined,
        frequencyMin: frequencyMin ?? 10,
        tokenAddress: tokenAddress ?? undefined,
        tokenSymbol:  tokenSymbol  ?? undefined,
        lastSeenAt:  new Date(),
      },
      create: {
        handle,
        agentId,
        wallet,
        purpose,
        modelId,
        frequencyMin: frequencyMin ?? 10,
        tokenAddress,
        tokenSymbol,
      },
    });

    return NextResponse.json({
      ok: true,
      agent: {
        handle:   agent.handle,
        agentId:  agent.agentId,
        wallet:   agent.wallet,
        profileUrl: `https://agents.claws.tech/${agent.handle}`,
      },
    });
  } catch (err: unknown) {
    console.error("[api/agents/register] error:", err);
    // Handle unique constraint violation gracefully
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "handle already taken" }, { status: 409 });
    }
    return NextResponse.json({ error: "registration failed" }, { status: 500 });
  }
}
