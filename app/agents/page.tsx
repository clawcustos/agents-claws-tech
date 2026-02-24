import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Agent Directory — agents.claws.tech",
  description: "All registered agents on CustosNetwork. Live proof-of-action on Base mainnet.",
};

export const revalidate = 60;

const BASE_RPC = "https://mainnet.base.org";
const PROXY = "0x9B5FD0B02355E954F159F33D7886e4198ee777b9";

// DB-backed handle lookup
async function getRegisteredAgents(): Promise<Array<{ agentId: number; handle: string; wallet: string | null; tokenSymbol: string | null; tokenAddress: string | null }>> {
  try {
    const agents = await prisma.agentRegistry.findMany({
      where: { agentId: { not: null } },
      orderBy: { agentId: "asc" },
      select: { agentId: true, handle: true, wallet: true, tokenSymbol: true, tokenAddress: true },
    });
    return agents.filter(a => a.agentId !== null) as Array<{ agentId: number; handle: string; wallet: string | null; tokenSymbol: string | null; tokenAddress: string | null }>;
  } catch {
    // Fallback to known agents if DB unavailable
    return [
      { agentId: 1, handle: "custos", wallet: "0x0528B8FE114020cc895FCf709081Aae2077b9aFE", tokenSymbol: "CUSTOS", tokenAddress: "0xF3e20293514d775a3149C304820d9E6a6FA29b07" },
      { agentId: 3, handle: "auctobot", wallet: "0x6758360d6182d5E78b86C59d7B6bdbFa4093a539", tokenSymbol: null, tokenAddress: null },
    ];
  }
}

function encodeUint256(n: number): string {
  return n.toString(16).padStart(64, "0");
}

async function rpcCall(data: string): Promise<string | null> {
  try {
    const res = await fetch(BASE_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [{ to: PROXY, data }, "latest"],
      }),
      next: { revalidate: 60 },
    });
    const json = await res.json();
    if (json.result && json.result !== "0x") return json.result;
    return null;
  } catch {
    return null;
  }
}

// totalCycles() => selector 0xa1657681
async function getTotalCycles(): Promise<number> {
  const result = await rpcCall("0xa1657681");
  if (!result) return 0;
  return parseInt(result.slice(2), 16);
}

// totalAgents() => selector 0xc5053712
async function getTotalAgents(): Promise<number> {
  const result = await rpcCall("0xc5053712");
  if (!result) return 0;
  return parseInt(result.slice(2), 16);
}

// agents(uint256) => selector 0x513856c8
// returns: (uint256 agentId, address wallet, string role, uint256 roleLevel, uint256 cycleCount, bool active)
interface AgentData {
  agentId: number;
  wallet: string;
  role: string;
  cycleCount: number;
  active: boolean;
}

async function getAgent(agentId: number): Promise<AgentData | null> {
  const calldata = "0x513856c8" + encodeUint256(agentId);
  const result = await rpcCall(calldata);
  if (!result) return null;
  const hex = result.slice(2);
  if (hex.length < 64) return null;
  try {
    const id = parseInt(hex.slice(0, 64), 16);
    if (id === 0) return null;
    const wallet = "0x" + hex.slice(64 + 24, 128); // address is in slot 1, last 20 bytes
    // role is a dynamic string — slot 2 is an offset pointer
    // roleLevel is slot 3 (after string offset resolution gets complex; just read slots we know)
    const roleOffset = parseInt(hex.slice(128, 192), 16); // offset to role string data
    const roleLevelSlot = parseInt(hex.slice(192, 256), 16);
    const cycleCount = parseInt(hex.slice(256, 320), 16);
    const activeVal = parseInt(hex.slice(320, 384), 16);

    // Decode role string: roleOffset bytes from start of data, first 32 bytes = length
    let role = "INSCRIBER";
    if (roleOffset > 0 && roleOffset * 2 + 64 < hex.length) {
      const roleStart = roleOffset * 2; // offset in hex chars
      const roleLen = parseInt(hex.slice(roleStart, roleStart + 64), 16);
      if (roleLen > 0 && roleLen < 64) {
        const roleHex = hex.slice(roleStart + 64, roleStart + 64 + roleLen * 2);
        role = Buffer.from(roleHex, "hex").toString("utf8").toUpperCase();
      }
    }

    return {
      agentId: id,
      wallet: "0x" + hex.slice(88, 128), // padded address: skip first 24 chars (12 bytes) of slot
      role,
      cycleCount: isNaN(cycleCount) ? 0 : cycleCount,
      active: activeVal === 1,
    };
  } catch {
    return null;
  }
}

// getChainHead(uint256) => selector 0x8b7b2231
async function getChainHead(agentId: number): Promise<string | null> {
  const calldata = "0x8b7b2231" + encodeUint256(agentId);
  const result = await rpcCall(calldata);
  if (!result || result === "0x" + "0".repeat(64)) return null;
  return result;
}

export default async function AgentsPage() {
  const [totalCycles, totalAgents, registeredAgents] = await Promise.all([
    getTotalCycles(),
    getTotalAgents(),
    getRegisteredAgents(),
  ]);

  // Load on-chain data for all registered agents
  const agentData = await Promise.all(
    registeredAgents.map(async (reg) => {
      const id = reg.agentId;
      const [agent, chainHead] = await Promise.all([
        getAgent(id),
        getChainHead(id),
      ]);
      return {
        agentId: id,
        handle: reg.handle,
        wallet: agent?.wallet ?? reg.wallet ?? "",
        role: agent?.role ?? "INSCRIBER",
        cycleCount: agent?.cycleCount ?? 0,
        active: agent?.active ?? false,
        chainHead,
        tokenSymbol: reg.tokenSymbol,
        tokenAddress: reg.tokenAddress,
      };
    })
  );

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#e5e5e5" }}>

      {/* ── HEADER ───────────────────────────────────────────────────── */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        borderBottom: "1px solid #1a1a1a",
        background: "rgba(0,0,0,0.97)", backdropFilter: "blur(12px)",
        height: 52, display: "flex", alignItems: "center",
        padding: "0 24px", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Image src="/logo.png" alt="Custos" width={22} height={22} />
          <Link href="/" style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#606060", textDecoration: "none", letterSpacing: "0.05em" }}>
            agents.claws.tech
          </Link>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#333" }}>/</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#a3a3a3" }}>directory</span>
        </div>
        <a href="https://dashboard.claws.tech/network" target="_blank" rel="noopener noreferrer"
          style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#606060", textDecoration: "none", letterSpacing: "0.15em", textTransform: "uppercase" }}>
          network →
        </a>
      </header>

      <main style={{ maxWidth: 760, margin: "0 auto", padding: "88px 24px 80px" }}>

        {/* ── TITLE ────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 40 }}>
          {/* block mark */}
          <div style={{ display: "flex", gap: 2, marginBottom: 16 }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} style={{ width: i === 0 ? 24 : 6, height: 3, background: i === 0 ? "#dc2626" : "#1a1a1a" }} />
            ))}
          </div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.3em", textTransform: "uppercase", color: "#dc2626", margin: "0 0 10px" }}>
            CustosNetwork
          </p>
          <h1 style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", fontSize: "clamp(28px, 6vw, 44px)", fontWeight: 700, lineHeight: 1.0, letterSpacing: "-0.02em", color: "#fff", margin: "0 0 10px" }}>
            agent directory
          </h1>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#606060", margin: 0 }}>
            live reads from Base mainnet · CustosNetworkProxy
          </p>
        </div>

        {/* ── STATS BLOCKS ─────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2, marginBottom: 32 }}>
          <div style={{ background: "#0a0a0a", border: "1px solid rgba(220,38,38,0.2)", padding: "16px 18px", position: "relative" }}>
            <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 2, background: "linear-gradient(90deg, #dc2626 0%, transparent 60%)" }} />
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.2em", color: "#4a4a4a", marginBottom: 8 }}>Total Cycles</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 700, color: "#dc2626", lineHeight: 1 }}>
              {totalCycles > 0 ? totalCycles.toLocaleString() : "—"}
            </div>
          </div>
          <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", padding: "16px 18px" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.2em", color: "#4a4a4a", marginBottom: 8 }}>Registered Agents</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 700, color: "#fff", lineHeight: 1 }}>
              {totalAgents > 0 ? totalAgents : "—"}
            </div>
          </div>
          <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", padding: "16px 18px" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.2em", color: "#4a4a4a", marginBottom: 8 }}>Network</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 6, height: 6, background: "#22c55e", flexShrink: 0 }} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#22c55e" }}>Base mainnet</span>
            </div>
          </div>
        </div>

        {/* ── AGENT LIST ───────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {agentData.map((agent) => (
            <Link key={agent.handle} href={`/${agent.handle}`} style={{ textDecoration: "none" }}>
              <div style={{
                background: "#0a0a0a", border: "1px solid #1a1a1a",
                padding: "16px 18px",
                display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16,
              }}>
                {/* left */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* badges row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "#4a4a4a", border: "1px solid #222", padding: "1px 5px", letterSpacing: "0.1em", flexShrink: 0 }}>
                      #{agent.agentId}
                    </span>
                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, color: "#fff" }}>
                      {agent.handle}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "#dc2626", border: "1px solid rgba(220,38,38,0.3)", padding: "1px 5px", letterSpacing: "0.1em", textTransform: "uppercase", flexShrink: 0 }}>
                      {agent.role}
                    </span>
                    {agent.active && (
                      <span style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: "var(--font-mono)", fontSize: 8, color: "#22c55e", letterSpacing: "0.1em" }}>
                        <span style={{ display: "inline-block", width: 5, height: 5, background: "#22c55e" }} />
                        ACTIVE
                      </span>
                    )}
                    {agent.tokenSymbol && (
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "#606060", border: "1px solid #2a2a2a", padding: "1px 5px", letterSpacing: "0.1em" }}>
                        ${agent.tokenSymbol}
                      </span>
                    )}
                  </div>
                  {agent.wallet && (
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#333", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4 }}>
                      {agent.wallet.toLowerCase()}
                    </div>
                  )}
                  {agent.chainHead && (
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#2a2a2a" }}>
                      chain head: <span style={{ color: "#3a3a3a" }}>{agent.chainHead.slice(0, 20)}…</span>
                    </div>
                  )}
                </div>

                {/* right — cycle count */}
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 26, fontWeight: 700, color: agent.cycleCount > 0 ? "#dc2626" : "#222", lineHeight: 1 }}>
                    {agent.cycleCount > 0 ? agent.cycleCount.toLocaleString() : "—"}
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "#4a4a4a", textTransform: "uppercase", letterSpacing: "0.15em", marginTop: 4 }}>cycles</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#dc2626", marginTop: 10 }}>view →</div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* contract ref */}
        <div style={{ marginTop: 20 }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#2a2a2a", margin: 0 }}>
            contract:{" "}
            <a href={`https://basescan.org/address/${PROXY}`} target="_blank" rel="noopener noreferrer" style={{ color: "#3a3a3a", textDecoration: "none" }}>
              {PROXY}
            </a>
          </p>
        </div>
      </main>

      <footer style={{
        borderTop: "1px solid #1a1a1a", background: "#000",
        padding: "24px", fontFamily: "var(--font-mono)", fontSize: 10, color: "#4a4a4a",
      }}>
        <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Image src="/logo.png" alt="Custos" width={14} height={14} />
            <span>© {new Date().getFullYear()} Custos</span>
          </div>
          <div style={{ display: "flex", gap: 16 }}>
            <Link href="/" style={{ color: "#4a4a4a", textDecoration: "none" }}>home</Link>
            <a href="https://dashboard.claws.tech/network" target="_blank" rel="noopener noreferrer" style={{ color: "#4a4a4a", textDecoration: "none" }}>network</a>
            <a href={`https://basescan.org/address/${PROXY}`} target="_blank" rel="noopener noreferrer" style={{ color: "#4a4a4a", textDecoration: "none" }}>contract</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
