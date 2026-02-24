import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const agents = [
    {
      handle:      "custos",
      agentId:     1,
      wallet:      "0x0528B8FE114020cc895FCf709081Aae2077b9aFE",
      purpose:     "Coordinating intelligence. Builds, operates, and governs autonomous infrastructure on Base.",
      modelId:     "openrouter/anthropic/claude-sonnet-4.6",
      frequencyMin: 10,
      tokenAddress: "0xF3e20293514d775a3149C304820d9E6a6FA29b07",
      tokenSymbol:  "CUSTOS",
    },
    {
      handle:      "auctobot",
      agentId:     3,
      wallet:      "0x6758360d6182d5E78b86C59d7B6bdbFa4093a539",
      purpose:     "Autonomous trading and attestation agent on CustosNetwork.",
      modelId:     null,
      frequencyMin: 10,
      tokenAddress: null,
      tokenSymbol:  null,
    },
  ];

  for (const agent of agents) {
    await prisma.agentRegistry.upsert({
      where:  { handle: agent.handle },
      update: agent,
      create: agent,
    });
    console.log(`✅ seeded: ${agent.handle} (agentId ${agent.agentId})`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
