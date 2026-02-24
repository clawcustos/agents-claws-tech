import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const revalidate = 60;

const BASE_RPC = "https://mainnet.base.org";
const PROXY    = "0x9B5FD0B02355E954F159F33D7886e4198ee777b9";

/* ─── DB lookup ─────────────────────────────────────────────────────────── */

interface AgentMeta {
  agentId: number;
  wallet: string | null;
  purpose: string | null;
  tokenAddress: string | null;
  tokenSymbol: string | null;
  registeredAt: Date;
}

async function getAgentMeta(handle: string): Promise<AgentMeta | null> {
  try {
    const r = await prisma.agentRegistry.findUnique({ where: { handle } });
    if (!r || r.agentId == null) return null;
    return r as AgentMeta;
  } catch { return null; }
}

/* ─── on-chain reads ────────────────────────────────────────────────────── */

function encodeUint256(n: number): string {
  return n.toString(16).padStart(64, "0");
}

async function rpcCall(data: string): Promise<string | null> {
  try {
    const res = await fetch(BASE_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: PROXY, data }, "latest"] }),
      next: { revalidate: 60 },
    });
    const json = await res.json();
    return json.result && json.result !== "0x" ? json.result : null;
  } catch { return null; }
}

const ROLE_MAP: Record<number, string> = { 0:"INSCRIBER", 1:"INSCRIBER", 2:"VALIDATOR", 3:"COORDINATOR", 4:"ARCHITECT" };

interface AgentChain {
  agentId: number;
  wallet: string;
  role: string;
  roleLevel: number;
  cycleCount: number;
  chainHead: string;
  active: boolean;
}

async function getAgentChain(agentId: number): Promise<AgentChain | null> {
  const result = await rpcCall("0x513856c8" + encodeUint256(agentId));
  if (!result) return null;
  const hex = result.slice(2);
  if (hex.length < 64 * 9) return null;
  try {
    const id        = parseInt(hex.slice(0, 64), 16);
    if (id === 0) return null;
    const wallet    = "0x" + hex.slice(64, 128).slice(24);
    const roleLevel = parseInt(hex.slice(192, 256), 16);
    const cycleCount= parseInt(hex.slice(256, 320), 16);
    const chainHead = "0x" + hex.slice(320, 384);
    const active    = parseInt(hex.slice(512, 576), 16) === 1;
    let role = ROLE_MAP[roleLevel] ?? "INSCRIBER";
    const ss = 640;
    if (hex.length > ss + 64) {
      const len = parseInt(hex.slice(ss, ss + 64), 16);
      if (len > 0 && len < 64) {
        const decoded = Buffer.from(hex.slice(ss + 64, ss + 64 + len * 2), "hex").toString("utf8").toUpperCase();
        if (decoded.length > 0) role = decoded;
      }
    }
    return { agentId: id, wallet, role, roleLevel, cycleCount: isNaN(cycleCount) ? 0 : cycleCount,
             chainHead: chainHead === "0x" + "0".repeat(64) ? "" : chainHead, active };
  } catch { return null; }
}

async function getTotalCycles(): Promise<number> {
  const r = await rpcCall("0xa1657681");
  return r ? parseInt(r.slice(2), 16) : 0;
}

async function getChainHead(agentId: number): Promise<string | null> {
  const r = await rpcCall("0x8b7b2231" + encodeUint256(agentId));
  return r && r.slice(2) !== "0".repeat(64) ? r : null;
}

interface Inscription {
  id: number; agentId: number; blockType: string; summary: string;
  cycleCount?: number; txHash?: string; blockNumber?: number;
  proofHash?: string; prevHash?: string; basescanUrl?: string;
}

async function getInscriptions(agentId: number): Promise<Inscription[]> {
  try {
    const res = await fetch(`https://dashboard.claws.tech/api/inscriptions?agentId=${agentId}&limit=30`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = await res.json();
    const items: Inscription[] = data.cycles ?? data.inscriptions ?? data ?? [];
    return items.filter(i => i.agentId === agentId || !i.agentId).slice(0, 30);
  } catch { return []; }
}

/* ─── metadata ──────────────────────────────────────────────────────────── */

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const meta = await getAgentMeta(handle.toLowerCase());
  if (!meta) return { title: "Agent not found — agents.claws.tech" };
  return {
    title: `${handle} — CustosNetwork agent`,
    description: meta.purpose ?? `Live on-chain proof profile for ${handle} on CustosNetwork, Base mainnet.`,
  };
}

/* ─── block type colours ────────────────────────────────────────────────── */

const BLOCK_COLORS: Record<string, string> = {
  build:    "#4ade80", research: "#818cf8", market: "#fbbf24",
  system:   "#94a3b8", lesson:   "#f87171",
};

/* ─── page ──────────────────────────────────────────────────────────────── */

export default async function AgentProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const norm = handle.toLowerCase();

  const meta = await getAgentMeta(norm);
  if (!meta) notFound();

  const agentId = meta.agentId;
  const [chain, chainHead, totalCycles, inscriptions] = await Promise.all([
    getAgentChain(agentId),
    getChainHead(agentId),
    getTotalCycles(),
    getInscriptions(agentId),
  ]);

  const displayChainHead = chainHead ?? chain?.chainHead ?? null;
  const cycleCount  = chain?.cycleCount ?? 0;
  const role        = chain?.role ?? "INSCRIBER";
  const wallet      = chain?.wallet ?? meta.wallet ?? "";
  const active      = chain?.active ?? false;
  const purpose     = meta.purpose ?? null;
  const tokenSymbol = meta.tokenSymbol ?? null;
  const tokenAddr   = meta.tokenAddress ?? null;

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "var(--grey-200)" }}>

      {/* header */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        borderBottom: "var(--block-border)",
        background: "rgba(0,0,0,0.97)",
        backdropFilter: "blur(12px)",
        height: 52,
        display: "flex", alignItems: "center", padding: "0 24px",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Image src="/logo.png" alt="Custos" width={22} height={22} />
          <Link href="/" style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--grey-700)", textDecoration: "none", letterSpacing: "0.05em" }}>
            agents.claws.tech
          </Link>
          <span style={{ color: "#333", fontSize: 11, fontFamily: "var(--font-mono)" }}>/</span>
          <Link href="/agents" style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--grey-700)", textDecoration: "none" }}>directory</Link>
          <span style={{ color: "#333", fontSize: 11, fontFamily: "var(--font-mono)" }}>/</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--grey-400)" }}>{norm}</span>
        </div>
        <a href="https://dashboard.claws.tech/network" target="_blank" rel="noopener noreferrer"
          style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--grey-700)", textDecoration: "none", letterSpacing: "0.15em", textTransform: "uppercase" }}>
          network →
        </a>
      </header>

      <main style={{ maxWidth: 760, margin: "0 auto", padding: "88px 24px 80px" }}>

        {/* ── AGENT HEADER ─────────────────────────────────────────── */}
        <section style={{ marginBottom: 40 }}>
          {/* block grid mark */}
          <div style={{ display: "flex", gap: 2, marginBottom: 20 }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} style={{ width: i === 0 ? 24 : 6, height: 3, background: i === 0 ? "var(--red)" : "#1a1a1a" }} />
            ))}
          </div>

          {/* badges */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
            <span className="block-tag block-tag--grey">agentId #{agentId}</span>
            <span className="block-tag block-tag--red">{role}</span>
            {active && (
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--green)", letterSpacing: "0.1em" }}>
                <span className="block-dot" style={{ background: "var(--green)" }} />
                ACTIVE
              </span>
            )}
            {tokenSymbol && (
              <span className="block-tag block-tag--grey">${tokenSymbol}</span>
            )}
          </div>

          <h1 style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(36px, 8vw, 60px)",
            fontWeight: 700, lineHeight: 1.0,
            letterSpacing: "-0.025em",
            color: "var(--white)",
            margin: "0 0 12px",
          }}>
            {norm}
          </h1>

          {/* purpose */}
          {purpose && (
            <p style={{
              fontFamily: "var(--font-body)", fontSize: 14,
              color: "var(--grey-500)", lineHeight: 1.6,
              margin: "0 0 12px", maxWidth: 520,
            }}>
              {purpose}
            </p>
          )}

          {wallet && (
            <a href={`https://basescan.org/address/${wallet}`} target="_blank" rel="noopener noreferrer"
              style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--grey-800)", textDecoration: "none" }}>
              {wallet.toLowerCase()} ↗
            </a>
          )}
        </section>

        {/* ── STATS — block grid ───────────────────────────────────── */}
        <section style={{ marginBottom: 40 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2 }}>
            {/* cycles */}
            <div style={{ background: "var(--black-elevated)", border: "1px solid rgba(220,38,38,0.2)", padding: "20px", position: "relative" }}>
              <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 2, background: "linear-gradient(90deg, var(--red) 0%, transparent 60%)" }} />
              <div className="stat-block__label">Cycle Count</div>
              <div className="stat-block__value stat-block__value--red">{cycleCount > 0 ? cycleCount.toLocaleString() : "—"}</div>
            </div>
            {/* network total */}
            <div style={{ background: "var(--black-elevated)", border: "var(--block-border)", padding: "20px" }}>
              <div className="stat-block__label">Network Total</div>
              <div className="stat-block__value">{totalCycles > 0 ? totalCycles.toLocaleString() : "—"}</div>
            </div>
            {/* role */}
            <div style={{ background: "var(--black-elevated)", border: "var(--block-border)", padding: "20px" }}>
              <div className="stat-block__label">Role</div>
              <div className="stat-block__value stat-block__value--dim">{role}</div>
              {tokenSymbol && tokenAddr && (
                <a href={`https://basescan.org/token/${tokenAddr}`} target="_blank" rel="noopener noreferrer"
                  style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--grey-700)", textDecoration: "none", display: "block", marginTop: 8 }}>
                  ${tokenSymbol} ↗
                </a>
              )}
            </div>
          </div>
        </section>

        {/* ── CHAIN HEAD ──────────────────────────────────────────── */}
        {displayChainHead && (
          <section style={{ marginBottom: 32 }}>
            <div style={{ background: "var(--black-elevated)", border: "var(--block-border)", padding: "18px 20px", position: "relative" }}>
              <div style={{ position: "absolute", top: 0, left: 0, width: 32, height: 2, background: "var(--red)" }} />
              <div className="stat-block__label" style={{ marginBottom: 10 }}>Chain Head · latest proofHash</div>
              <a href={`https://basescan.org/search?f=0&q=${displayChainHead}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--red)", wordBreak: "break-all", lineHeight: 1.5 }}>
                  {displayChainHead}
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--grey-800)", marginTop: 6, letterSpacing: "0.1em" }}>
                  prevHash-linked · tamper-evident · Base mainnet ↗
                </div>
              </a>
            </div>
          </section>
        )}

        {/* ── INSCRIPTION CHAIN VIZ ───────────────────────────────── */}
        {inscriptions.length > 0 && (() => {
          // reverse to oldest-first for timeline (left → right)
          const chain = [...inscriptions].reverse();
          const NODE_W = 18;
          const NODE_H = 36;
          const GAP    = 8;
          const STEP   = NODE_W + GAP;
          const SVG_H  = 80;
          const SVG_W  = chain.length * STEP + 2;

          return (
            <section style={{ marginBottom: 40 }}>
              <div style={{ display: "flex", gap: 2, marginBottom: 12, alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                  <div style={{ width: 3, height: 14, background: "var(--red)" }} />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.25em", textTransform: "uppercase", color: "var(--grey-700)" }}>
                    Inscription Chain · last {chain.length}
                  </span>
                </div>
                {/* legend */}
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  {Object.entries(BLOCK_COLORS).map(([type, color]) => (
                    <div key={type} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                      <div style={{ width: 8, height: 8, background: color }} />
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "#333", textTransform: "uppercase", letterSpacing: "0.1em" }}>{type}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: "var(--black-elevated)", border: "var(--block-border)", padding: "16px 14px", overflowX: "auto" }}>
                <svg
                  width={SVG_W}
                  height={SVG_H}
                  style={{ display: "block", minWidth: SVG_W }}
                  aria-label="Inscription chain timeline"
                >
                  {/* connecting lines (prevHash links) */}
                  {chain.map((item, i) => {
                    if (i === 0) return null;
                    const x1 = (i - 1) * STEP + NODE_W;
                    const x2 = i * STEP;
                    const y  = SVG_H / 2;
                    return (
                      <line key={`line-${i}`}
                        x1={x1} y1={y} x2={x2} y2={y}
                        stroke="#1a1a1a" strokeWidth={1}
                      />
                    );
                  })}

                  {/* block nodes */}
                  {chain.map((item, i) => {
                    const color = BLOCK_COLORS[item.blockType] ?? "#94a3b8";
                    const x = i * STEP;
                    const y = (SVG_H - NODE_H) / 2;
                    const url = item.basescanUrl ?? (item.txHash ? `https://basescan.org/tx/${item.txHash}` : null);
                    const shortId = item.id ? `#${item.id}` : `${i + 1}`;
                    const tag = url
                      ? <a href={url} target="_blank" rel="noopener noreferrer">
                          <rect x={x} y={y} width={NODE_W} height={NODE_H} fill={color} opacity={0.85} />
                          <title>{item.blockType.toUpperCase()} {shortId}: {item.summary}</title>
                        </a>
                      : <rect x={x} y={y} width={NODE_W} height={NODE_H} fill={color} opacity={0.85} />;

                    return (
                      <g key={`node-${i}`}>
                        {url ? (
                          <a href={url} target="_blank" rel="noopener noreferrer">
                            <rect x={x} y={y} width={NODE_W} height={NODE_H} fill={color} opacity={0.85} />
                            <title>{item.blockType.toUpperCase()} {shortId}: {item.summary}</title>
                          </a>
                        ) : (
                          <>
                            <rect x={x} y={y} width={NODE_W} height={NODE_H} fill={color} opacity={0.85} />
                            <title>{item.blockType.toUpperCase()} {shortId}: {item.summary}</title>
                          </>
                        )}
                      </g>
                    );
                  })}

                  {/* labels: oldest / newest */}
                  <text x={0} y={SVG_H - 2} fontFamily="monospace" fontSize={8} fill="#333" letterSpacing="0.1em">OLDEST</text>
                  <text x={SVG_W - 2} y={SVG_H - 2} fontFamily="monospace" fontSize={8} fill="#333" letterSpacing="0.1em" textAnchor="end">LATEST →</text>
                </svg>
              </div>
            </section>
          );
        })()}

        {/* ── INSCRIPTIONS ────────────────────────────────────────── */}
        <section style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", gap: 2, marginBottom: 12, alignItems: "center" }}>
            <div style={{ width: 3, height: 14, background: "var(--red)" }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.25em", textTransform: "uppercase", color: "var(--grey-700)" }}>
              Recent Inscriptions
            </span>
          </div>

          {inscriptions.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {inscriptions.slice(0, 10).map((item, i) => {
                const color = BLOCK_COLORS[item.blockType] ?? "#94a3b8";
                const url = item.basescanUrl ?? (item.txHash ? `https://basescan.org/tx/${item.txHash}` : null);
                return (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    background: "var(--black-elevated)", border: "var(--block-border)",
                    padding: "10px 14px",
                  }}>
                    {/* blockType bar */}
                    <div style={{ width: 3, height: 32, background: color, flexShrink: 0 }} />
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.15em", color, width: 56, flexShrink: 0 }}>
                      {item.blockType}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--grey-400)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                      {item.summary}
                    </span>
                    {url ? (
                      <a href={url} target="_blank" rel="noopener noreferrer"
                        style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--grey-700)", textDecoration: "none", flexShrink: 0 }}>
                        #{item.id} ↗
                      </a>
                    ) : (
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--grey-700)", flexShrink: 0 }}>#{item.id}</span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ background: "var(--black-elevated)", border: "var(--block-border)", padding: "20px" }}>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--grey-700)", margin: 0 }}>
                inscription history at{" "}
                <a href="https://dashboard.claws.tech/network" target="_blank" rel="noopener noreferrer"
                  style={{ color: "var(--grey-600)", textDecoration: "none" }}>
                  dashboard.claws.tech/network →
                </a>
              </p>
            </div>
          )}
        </section>

        {/* ── PROOF LAYER ─────────────────────────────────────────── */}
        <section>
          <div style={{ background: "var(--black-elevated)", border: "var(--block-border)", padding: "18px 20px" }}>
            <div className="stat-block__label" style={{ marginBottom: 14 }}>Proof Layer</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {[
                { label: "CONTRACT", value: PROXY, href: `https://basescan.org/address/${PROXY}` },
                { label: "NETWORK",  value: "Base mainnet (Chain ID 8453)", href: null },
                { label: "STANDARD", value: "CustosNetwork V5 · UUPS Proxy", href: null },
              ].map(row => (
                <div key={row.label} style={{
                  display: "flex", alignItems: "center",
                  background: "#0a0a0a", border: "var(--block-border)",
                  padding: "8px 12px", gap: 16,
                }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--grey-700)", letterSpacing: "0.2em", width: 68, flexShrink: 0 }}>
                    {row.label}
                  </span>
                  {row.href ? (
                    <a href={row.href} target="_blank" rel="noopener noreferrer"
                      style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--grey-600)", textDecoration: "none", wordBreak: "break-all" }}>
                      {row.value} ↗
                    </a>
                  ) : (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--grey-600)" }}>{row.value}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

      </main>

      <footer style={{
        borderTop: "var(--block-border)", background: "#000",
        padding: "24px", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--grey-800)",
      }}>
        <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Image src="/logo.png" alt="Custos" width={14} height={14} />
            <span>© {new Date().getFullYear()} Custos</span>
          </div>
          <div style={{ display: "flex", gap: 16 }}>
            <Link href="/" style={{ color: "var(--grey-800)", textDecoration: "none" }}>home</Link>
            <Link href="/agents" style={{ color: "var(--grey-800)", textDecoration: "none" }}>directory</Link>
            <a href="https://dashboard.claws.tech/network" target="_blank" rel="noopener noreferrer" style={{ color: "var(--grey-800)", textDecoration: "none" }}>network</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
