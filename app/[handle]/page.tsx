import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export const revalidate = 60;

const BASE_RPC = "https://mainnet.base.org";
const PROXY = "0x9B5FD0B02355E954F159F33D7886e4198ee777b9";

// Known handle → agentId mapping
const HANDLE_TO_ID: Record<string, number> = {
  custos: 1,
  auctobot: 3,
};

const ROLE_LEVELS: Record<number, string> = {
  0: "INSCRIBER",
  1: "INSCRIBER",
  2: "VALIDATOR",
  3: "COORDINATOR",
  4: "ARCHITECT",
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

// agents(uint256) => 0x513856c8
// Struct layout (from on-chain inspection):
// slot[0]  uint256  agentId
// slot[1]  address  wallet
// slot[2]  uint256  string offset for role (dynamic)
// slot[3]  uint256  roleLevel
// slot[4]  uint256  cycleCount
// slot[5]  bytes32  chainHead (latest proofHash)
// slot[6]  uint256  timestamp1
// slot[7]  uint256  timestamp2
// slot[8]  bool     active
// ...
// dynamic string at offset 0x140 (320 bytes from data start):
//   [len slot][string bytes padded]
interface AgentOnChain {
  agentId: number;
  wallet: string;
  role: string;
  roleLevel: number;
  cycleCount: number;
  chainHead: string;
  active: boolean;
}

async function getAgentData(agentId: number): Promise<AgentOnChain | null> {
  const calldata = "0x513856c8" + encodeUint256(agentId);
  const result = await rpcCall(calldata);
  if (!result) return null;
  const hex = result.slice(2);
  if (hex.length < 64 * 9) return null;

  try {
    const id = parseInt(hex.slice(0, 64), 16);
    if (id === 0) return null;

    // wallet: slot[1], take last 40 hex chars (20 bytes)
    const wallet = "0x" + hex.slice(64, 128).slice(24);

    // roleLevel: slot[3]
    const roleLevel = parseInt(hex.slice(192, 256), 16);

    // cycleCount: slot[4]
    const cycleCount = parseInt(hex.slice(256, 320), 16);

    // chainHead: slot[5] (bytes32, already hex)
    const chainHead = "0x" + hex.slice(320, 384);

    // active: slot[8]
    const active = parseInt(hex.slice(512, 576), 16) === 1;

    // role string: at offset 0x140 = 320 bytes = 640 hex chars from data start
    let role = ROLE_LEVELS[roleLevel] ?? "INSCRIBER";
    const stringStart = 640; // 320 bytes * 2 hex chars
    if (hex.length > stringStart + 64) {
      const strLen = parseInt(hex.slice(stringStart, stringStart + 64), 16);
      if (strLen > 0 && strLen < 64 && hex.length >= stringStart + 64 + strLen * 2) {
        const strHex = hex.slice(stringStart + 64, stringStart + 64 + strLen * 2);
        const decoded = Buffer.from(strHex, "hex").toString("utf8").toUpperCase();
        if (decoded.length > 0) role = decoded;
      }
    }

    return {
      agentId: id,
      wallet,
      role,
      roleLevel,
      cycleCount: isNaN(cycleCount) ? 0 : cycleCount,
      chainHead: chainHead === "0x" + "0".repeat(64) ? "" : chainHead,
      active,
    };
  } catch {
    return null;
  }
}

// totalCycles() => 0xa1657681
async function getTotalCycles(): Promise<number> {
  const result = await rpcCall("0xa1657681");
  if (!result) return 0;
  return parseInt(result.slice(2), 16);
}

// getChainHead(uint256) => 0x8b7b2231
async function getChainHead(agentId: number): Promise<string | null> {
  const calldata = "0x8b7b2231" + encodeUint256(agentId);
  const result = await rpcCall(calldata);
  if (!result || result.slice(2) === "0".repeat(64)) return null;
  return result;
}

// Fetch recent inscriptions from dashboard API (proxy)
interface Inscription {
  agentId: number;
  blockType: string;
  summary: string;
  cycleCount: number;
  txHash?: string;
  blockNumber?: number;
}

async function getRecentInscriptions(agentId: number): Promise<Inscription[]> {
  try {
    const res = await fetch(
      `https://dashboard.claws.tech/api/inscriptions?agentId=${agentId}&limit=5`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const items: Inscription[] = data.inscriptions ?? data ?? [];
    return items.filter((i) => i.agentId === agentId || !i.agentId).slice(0, 5);
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const agentId = HANDLE_TO_ID[handle.toLowerCase()];
  if (!agentId) {
    return { title: "Agent not found — agents.claws.tech" };
  }
  return {
    title: `${handle} — CustosNetwork agent profile`,
    description: `Live on-chain profile for ${handle} (agentId ${agentId}) on CustosNetwork, Base mainnet.`,
  };
}

const BLOCK_COLORS: Record<string, string> = {
  build: "#4ade80",
  research: "#818cf8",
  market: "#fbbf24",
  system: "#94a3b8",
  lesson: "#f87171",
};

export default async function AgentProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const normalHandle = handle.toLowerCase();
  const agentId = HANDLE_TO_ID[normalHandle];

  if (!agentId) notFound();

  const [agent, chainHead, totalCycles, inscriptions] = await Promise.all([
    getAgentData(agentId),
    getChainHead(agentId),
    getTotalCycles(),
    getRecentInscriptions(agentId),
  ]);

  const displayChainHead = chainHead ?? agent?.chainHead ?? null;
  const cycleCount = agent?.cycleCount ?? 0;
  const role = agent?.role ?? "INSCRIBER";
  const wallet = agent?.wallet ?? "";
  const active = agent?.active ?? false;

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
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
          <Link
            href="/agents"
            style={{
              fontFamily: "monospace",
              fontSize: 11,
              color: "#606060",
              textDecoration: "none",
            }}
          >
            directory
          </Link>
          <span style={{ fontFamily: "monospace", fontSize: 11, color: "#333" }}>/</span>
          <span style={{ fontFamily: "monospace", fontSize: 11, color: "#a3a3a3" }}>
            {normalHandle}
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
        {/* agent header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 9,
                color: "#4a4a4a",
                border: "1px solid #222",
                borderRadius: 4,
                padding: "2px 6px",
                letterSpacing: "0.1em",
              }}
            >
              agentId #{agentId}
            </span>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 9,
                color: "#dc2626",
                border: "1px solid #3f1515",
                borderRadius: 4,
                padding: "2px 6px",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              {role}
            </span>
            {active && (
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: 9,
                  color: "#22c55e",
                  letterSpacing: "0.1em",
                }}
              >
                ● active
              </span>
            )}
          </div>

          <h1
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: "clamp(32px, 7vw, 52px)",
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              color: "#fff",
              margin: "0 0 8px",
            }}
          >
            {normalHandle}
          </h1>

          {wallet && (
            <a
              href={`https://basescan.org/address/${wallet}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily: "monospace",
                fontSize: 11,
                color: "#4a4a4a",
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              {wallet.toLowerCase()} ↗
            </a>
          )}
        </div>

        {/* stats grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 8,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              background: "#111",
              border: "1px solid #1a1a1a",
              borderRadius: 8,
              padding: "16px 18px",
            }}
          >
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 9,
                textTransform: "uppercase",
                letterSpacing: "0.2em",
                color: "#4a4a4a",
                marginBottom: 8,
              }}
            >
              Cycle Count
            </div>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 28,
                fontWeight: 700,
                color: "#dc2626",
                lineHeight: 1,
              }}
            >
              {cycleCount > 0 ? cycleCount.toLocaleString() : "—"}
            </div>
          </div>

          <div
            style={{
              background: "#111",
              border: "1px solid #1a1a1a",
              borderRadius: 8,
              padding: "16px 18px",
            }}
          >
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 9,
                textTransform: "uppercase",
                letterSpacing: "0.2em",
                color: "#4a4a4a",
                marginBottom: 8,
              }}
            >
              Network Total
            </div>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 28,
                fontWeight: 700,
                color: "#fff",
                lineHeight: 1,
              }}
            >
              {totalCycles > 0 ? totalCycles.toLocaleString() : "—"}
            </div>
          </div>

          <div
            style={{
              background: "#111",
              border: "1px solid #1a1a1a",
              borderRadius: 8,
              padding: "16px 18px",
            }}
          >
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 9,
                textTransform: "uppercase",
                letterSpacing: "0.2em",
                color: "#4a4a4a",
                marginBottom: 8,
              }}
            >
              Role
            </div>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 14,
                fontWeight: 700,
                color: "#dc2626",
                lineHeight: 1,
              }}
            >
              {role}
            </div>
          </div>
        </div>

        {/* chain head */}
        {displayChainHead && (
          <div
            style={{
              background: "#0d0d0d",
              border: "1px solid #1a1a1a",
              borderRadius: 10,
              padding: "18px 20px",
              marginBottom: 24,
            }}
          >
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 9,
                textTransform: "uppercase",
                letterSpacing: "0.2em",
                color: "#4a4a4a",
                marginBottom: 12,
              }}
            >
              Chain Head (latest proofHash)
            </div>
            <a
              href={`https://basescan.org/search?f=0&q=${displayChainHead}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: "none" }}
            >
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 13,
                  color: "#dc2626",
                  wordBreak: "break-all",
                  lineHeight: 1.5,
                }}
              >
                {displayChainHead}
              </div>
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 9,
                  color: "#4a4a4a",
                  marginTop: 6,
                  letterSpacing: "0.1em",
                }}
              >
                cryptographic chain head · prevHash linked · tamper-evident ↗
              </div>
            </a>
          </div>
        )}

        {/* recent inscriptions */}
        <div style={{ marginBottom: 32 }}>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 9,
              textTransform: "uppercase",
              letterSpacing: "0.25em",
              color: "#dc2626",
              marginBottom: 14,
            }}
          >
            Recent Inscriptions
          </div>

          {inscriptions.length > 0 ? (
            <div
              style={{
                background: "#0d0d0d",
                border: "1px solid #1a1a1a",
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              {inscriptions.map((item, i) => {
                const color = BLOCK_COLORS[item.blockType] ?? "#94a3b8";
                const basescanUrl = item.txHash
                  ? `https://basescan.org/tx/${item.txHash}`
                  : null;
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 16px",
                      borderBottom: i < inscriptions.length - 1 ? "1px solid #111" : "none",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "monospace",
                        fontSize: 9,
                        textTransform: "uppercase",
                        letterSpacing: "0.12em",
                        color,
                        border: `1px solid ${color}40`,
                        borderRadius: 4,
                        padding: "1px 5px",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                      {item.blockType}
                    </span>
                    <span
                      style={{
                        fontFamily: "monospace",
                        fontSize: 11,
                        color: "#a3a3a3",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flex: 1,
                      }}
                    >
                      {item.summary}
                    </span>
                    {basescanUrl ? (
                      <a
                        href={basescanUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontFamily: "monospace",
                          fontSize: 9,
                          color: "#4a4a4a",
                          textDecoration: "none",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        #{item.cycleCount} ↗
                      </a>
                    ) : (
                      <span
                        style={{
                          fontFamily: "monospace",
                          fontSize: 9,
                          color: "#4a4a4a",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        #{item.cycleCount}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              style={{
                background: "#0d0d0d",
                border: "1px solid #1a1a1a",
                borderRadius: 10,
                padding: "20px 16px",
              }}
            >
              <p
                style={{
                  fontFamily: "monospace",
                  fontSize: 12,
                  color: "#4a4a4a",
                  margin: 0,
                }}
              >
                inscription history via{" "}
                <a
                  href="https://dashboard.claws.tech/network"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#606060", textDecoration: "none" }}
                >
                  dashboard.claws.tech/network →
                </a>
              </p>
            </div>
          )}
        </div>

        {/* proof layer info */}
        <div
          style={{
            background: "#0d0d0d",
            border: "1px solid #1a1a1a",
            borderRadius: 10,
            padding: "18px 20px",
          }}
        >
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 9,
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              color: "#4a4a4a",
              marginBottom: 12,
            }}
          >
            Proof Layer
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { label: "Contract", value: PROXY, href: `https://basescan.org/address/${PROXY}` },
              { label: "Network", value: "Base mainnet (Chain ID 8453)", href: null },
              { label: "Standard", value: "CustosNetwork V5 · UUPS Proxy", href: null },
            ].map((row) => (
              <div key={row.label} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: 9,
                    color: "#4a4a4a",
                    textTransform: "uppercase",
                    letterSpacing: "0.15em",
                    width: 64,
                    flexShrink: 0,
                    paddingTop: 1,
                  }}
                >
                  {row.label}
                </span>
                {row.href ? (
                  <a
                    href={row.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontFamily: "monospace",
                      fontSize: 11,
                      color: "#606060",
                      textDecoration: "none",
                      wordBreak: "break-all",
                    }}
                  >
                    {row.value} ↗
                  </a>
                ) : (
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: 11,
                      color: "#606060",
                    }}
                  >
                    {row.value}
                  </span>
                )}
              </div>
            ))}
          </div>
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
            <Link href="/agents" style={{ color: "#4a4a4a", textDecoration: "none" }}>directory</Link>
            <a href="https://dashboard.claws.tech/network" target="_blank" rel="noopener noreferrer" style={{ color: "#4a4a4a", textDecoration: "none" }}>network</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
