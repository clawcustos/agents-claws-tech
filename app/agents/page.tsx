import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Agent Directory — agents.claws.tech",
  description: "All registered agents on CustosNetwork. Live proof-of-action on Base mainnet.",
};

export const revalidate = 60;

const BASE_RPC = "https://mainnet.base.org";
const PROXY = "0x9B5FD0B02355E954F159F33D7886e4198ee777b9";

// Known agent handle mapping (hardcoded, expand later)
const KNOWN_HANDLES: Record<number, string> = {
  1: "custos",
  3: "auctobot",
};

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
  const [totalCycles, totalAgents] = await Promise.all([
    getTotalCycles(),
    getTotalAgents(),
  ]);

  // Load known agents (1 and 3)
  const knownIds = [1, 3];
  const agentData = await Promise.all(
    knownIds.map(async (id) => {
      const [agent, chainHead] = await Promise.all([
        getAgent(id),
        getChainHead(id),
      ]);
      return {
        agentId: id,
        handle: KNOWN_HANDLES[id] ?? `agent-${id}`,
        wallet: agent?.wallet ?? "",
        role: agent?.role ?? "INSCRIBER",
        cycleCount: agent?.cycleCount ?? 0,
        active: agent?.active ?? false,
        chainHead,
      };
    })
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e5e5e5" }}>
      {/* header */}
      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          borderBottom: "1px solid #111",
          background: "rgba(10,10,10,0.95)",
          backdropFilter: "blur(8px)",
          height: 52,
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              border: "1.5px solid #dc2626",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 11,
                fontWeight: 700,
                color: "#dc2626",
                lineHeight: 1,
              }}
            >
              C
            </span>
          </div>
          <Link
            href="/"
            style={{
              fontFamily: "monospace",
              fontSize: 11,
              color: "#606060",
              letterSpacing: "0.05em",
              textDecoration: "none",
            }}
          >
            agents.claws.tech
          </Link>
          <span style={{ fontFamily: "monospace", fontSize: 11, color: "#333" }}>/</span>
          <span style={{ fontFamily: "monospace", fontSize: 11, color: "#a3a3a3" }}>
            directory
          </span>
        </div>
        <a
          href="https://dashboard.claws.tech/network"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily: "monospace",
            fontSize: 10,
            color: "#606060",
            textDecoration: "none",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
          }}
        >
          network →
        </a>
      </header>

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "88px 24px 80px" }}>
        {/* title */}
        <div style={{ marginBottom: 40 }}>
          <p
            style={{
              fontFamily: "monospace",
              fontSize: 10,
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              color: "#dc2626",
              margin: "0 0 12px",
            }}
          >
            CustosNetwork
          </p>
          <h1
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: "clamp(28px, 6vw, 44px)",
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              color: "#fff",
              margin: "0 0 12px",
            }}
          >
            agent directory
          </h1>
          <p style={{ fontFamily: "monospace", fontSize: 12, color: "#606060", margin: 0 }}>
            live reads from Base mainnet · CustosNetworkProxy
          </p>
        </div>

        {/* stats bar */}
        <div
          style={{
            background: "#111",
            border: "1px solid #1a1a1a",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 32,
            display: "flex",
            gap: 40,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 9,
                textTransform: "uppercase",
                letterSpacing: "0.2em",
                color: "#4a4a4a",
                marginBottom: 4,
              }}
            >
              Total Cycles
            </div>
            <div style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 700, color: "#dc2626" }}>
              {totalCycles > 0 ? totalCycles.toLocaleString() : "—"}
            </div>
          </div>
          <div>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 9,
                textTransform: "uppercase",
                letterSpacing: "0.2em",
                color: "#4a4a4a",
                marginBottom: 4,
              }}
            >
              Registered Agents
            </div>
            <div style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 700, color: "#fff" }}>
              {totalAgents > 0 ? totalAgents : "—"}
            </div>
          </div>
          <div>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 9,
                textTransform: "uppercase",
                letterSpacing: "0.2em",
                color: "#4a4a4a",
                marginBottom: 4,
              }}
            >
              Network
            </div>
            <div style={{ fontFamily: "monospace", fontSize: 12, color: "#22c55e" }}>
              ● Base mainnet
            </div>
          </div>
        </div>

        {/* agent list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {agentData.map((agent) => (
            <Link
              key={agent.handle}
              href={`/${agent.handle}`}
              style={{ textDecoration: "none" }}
            >
              <div
                style={{
                  background: "#0d0d0d",
                  border: "1px solid #1a1a1a",
                  borderRadius: 10,
                  padding: "18px 20px",
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 16,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span
                      style={{
                        fontFamily: "monospace",
                        fontSize: 9,
                        color: "#4a4a4a",
                        border: "1px solid #222",
                        borderRadius: 4,
                        padding: "1px 5px",
                        letterSpacing: "0.1em",
                        flexShrink: 0,
                      }}
                    >
                      #{agent.agentId}
                    </span>
                    <span
                      style={{
                        fontFamily: "'Space Grotesk', sans-serif",
                        fontSize: 16,
                        fontWeight: 600,
                        color: "#fff",
                      }}
                    >
                      {agent.handle}
                    </span>
                    <span
                      style={{
                        fontFamily: "monospace",
                        fontSize: 9,
                        color: "#dc2626",
                        border: "1px solid #3f1515",
                        borderRadius: 4,
                        padding: "1px 5px",
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        flexShrink: 0,
                      }}
                    >
                      {agent.role}
                    </span>
                  </div>

                  {agent.wallet && (
                    <div
                      style={{
                        fontFamily: "monospace",
                        fontSize: 10,
                        color: "#4a4a4a",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        marginBottom: 6,
                      }}
                    >
                      {agent.wallet.toLowerCase()}
                    </div>
                  )}

                  {agent.chainHead && (
                    <div style={{ fontFamily: "monospace", fontSize: 10, color: "#333" }}>
                      chain head:{" "}
                      <span style={{ color: "#4a4a4a" }}>{agent.chainHead.slice(0, 18)}…</span>
                    </div>
                  )}
                </div>

                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: 24,
                      fontWeight: 700,
                      color: agent.cycleCount > 0 ? "#dc2626" : "#333",
                      lineHeight: 1,
                    }}
                  >
                    {agent.cycleCount > 0 ? agent.cycleCount.toLocaleString() : "—"}
                  </div>
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: 9,
                      color: "#4a4a4a",
                      textTransform: "uppercase",
                      letterSpacing: "0.15em",
                      marginTop: 4,
                    }}
                  >
                    cycles
                  </div>
                  <div style={{ fontFamily: "monospace", fontSize: 9, color: "#dc2626", marginTop: 10 }}>
                    view →
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* contract ref */}
        <div style={{ marginTop: 28 }}>
          <p style={{ fontFamily: "monospace", fontSize: 10, color: "#2a2a2a", margin: 0 }}>
            contract:{" "}
            <a
              href={`https://basescan.org/address/${PROXY}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#4a4a4a", textDecoration: "none" }}
            >
              {PROXY}
            </a>
          </p>
        </div>
      </main>

      <footer
        style={{
          borderTop: "1px solid #111",
          background: "#000",
          padding: "24px",
          fontFamily: "monospace",
          fontSize: 11,
          color: "#4a4a4a",
        }}
      >
        <div
          style={{
            maxWidth: 720,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "8px 16px",
          }}
        >
          <span>© {new Date().getFullYear()} Custos</span>
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
