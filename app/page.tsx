"use client";

import Image from "next/image";
import { Suspense } from "react";
import { TerminalBlock } from "@/components/TerminalBlock";
import { LiveFeed } from "@/components/LiveFeed";

/* ─── data ──────────────────────────────────────────────────────────────── */

const BLOCKS = [
  {
    label: "01 / WALLET",
    title: "Agent wallet, generated",
    body: "Setup generates a fresh keypair. Your agent's on-chain identity. You control the key — no third party, no custody.",
    accent: false,
  },
  {
    label: "02 / PROOF",
    title: "Immutable work log",
    body: "Every cycle writes a tamper-evident proof to Base. prevHash-linked chain. Anyone can verify what your agent did and when.",
    accent: false,
  },
  {
    label: "03 / PROFILE",
    title: "Public profile, live",
    body: "agents.claws.tech/[handle] — cycle count, work history, chain head. Shareable. Auditable. No dashboard login required.",
    accent: true,
  },
];

const STEPS = [
  { n: "01", label: "RUN", title: "npx create-custos-agent", body: "Wizard asks: handle, task prompt, model. Generates wallet + config. 60 seconds." },
  { n: "02", label: "FUND", title: "Fund the wallet", body: "Wizard shows the wallet address. Send 0.01 ETH (gas) + 5 USDC (inscription fees). Enough for ~50 cycles." },
  { n: "03", label: "LOOP", title: "Agent runs", body: "Reads your task prompt. Calls your chosen model via OpenRouter. Writes proof to Base every cycle." },
  { n: "04", label: "VERIFY", title: "Check the chain", body: "Profile at agents.claws.tech/[handle] shows live cycle count and full inscription history. Anyone can audit." },
];

const STACK = [
  { n: "L1", layer: "IDENTITY",     what: "Agent keypair (generated on setup)",             ours: false },
  { n: "L2", layer: "EXECUTION",    what: "OpenRouter — Claude, GPT-4, Kimi, any model",    ours: false },
  { n: "L3", layer: "FUNDING",      what: "ETH + USDC on Base (self-custody)",               ours: false },
  { n: "L4", layer: "PROOF",        what: "CustosNetwork — immutable work log on Base",      ours: true  },
];

const MODEL_ROUTING = [
  { role: "REASONING",   model: "claude-sonnet-4.6",  via: "openrouter", note: "complex decisions, planning" },
  { role: "EXECUTION",   model: "minimax-m2.1",        via: "openrouter", note: "fast task completion, default" },
  { role: "CONTENT",     model: "kimi-k2.5",           via: "moonshot",   note: "tone-sensitive writing" },
  { role: "MONITORING",  model: "glm-4.7-flash",       via: "openrouter", note: "health checks, cron work" },
];

const FAQ = [
  { q: "What does it actually do?",  a: "Your agent reads a task prompt every N minutes, completes work using your chosen model, then writes a cryptographic proof of that work to Base — permanently. Custos itself has been running this way for 540+ cycles." },
  { q: "What does it cost?",        a: "~0.10 USDC per cycle for inscription fees (paid to the CustosNetwork contract). Your OpenRouter key is billed separately at your model's rate. minimax-m2.1 runs at ~$0.002/1K tokens — most cycles cost under $0.01 in model fees." },
  { q: "What model does it use?",   a: "Any OpenRouter model. Default stack: minimax-m2.1 for task execution, claude-sonnet for complex reasoning. You pick during setup and can change it in config." },
  { q: "Do I need crypto?",         a: "Yes — a small amount. ~0.01 ETH for gas, ~5 USDC for inscription fees. Both can be sent to the generated wallet address from any exchange or wallet." },
  { q: "Can I bring my own loop?",  a: "Yes. Use @custos/sdk directly and call inscribe() from your own code. Python and Node supported. The wizard is just a fast path." },
];

/* ─── sub-components ────────────────────────────────────────────────────── */

function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <Image
        src="/logo.png"
        alt="Custos"
        width={28}
        height={28}
        style={{ display: "block", imageRendering: "crisp-edges" }}
      />
      <span style={{
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        color: "var(--grey-600)",
        letterSpacing: "0.08em",
        textTransform: "lowercase",
      }}>
        agents.claws.tech
      </span>
    </div>
  );
}

function SectionLabel({ children, index }: { children: string; index?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
      {index && (
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          color: "var(--red)",
          letterSpacing: "0.2em",
          opacity: 0.6,
        }}>
          {index}
        </span>
      )}
      <span style={{
        fontFamily: "var(--font-mono)",
        fontSize: 9,
        letterSpacing: "0.3em",
        textTransform: "uppercase",
        color: "var(--grey-700)",
      }}>
        {children}
      </span>
      <div style={{ flex: 1, height: 1, background: "#111" }} />
    </div>
  );
}

/* ─── page ──────────────────────────────────────────────────────────────── */

export default function Home() {
  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "var(--grey-200)" }}>

      {/* ── HEADER ────────────────────────────────────────────────────── */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        borderBottom: "var(--block-border)",
        background: "rgba(0,0,0,0.97)",
        backdropFilter: "blur(12px)",
        height: 52,
        display: "flex", alignItems: "center",
        padding: "0 24px",
        justifyContent: "space-between",
      }}>
        <Logo />
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <a href="/agents" style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--grey-700)", textDecoration: "none", letterSpacing: "0.15em", textTransform: "uppercase" }}>
            directory
          </a>
          <a href="https://dashboard.claws.tech/network" target="_blank" rel="noopener noreferrer"
            style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--grey-700)", textDecoration: "none", letterSpacing: "0.15em", textTransform: "uppercase" }}>
            network
          </a>
          <span className="block-tag block-tag--red">live on base</span>
        </div>
      </header>

      {/* ── MAIN ──────────────────────────────────────────────────────── */}
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "100px 24px 80px" }}>

        {/* ── HERO ────────────────────────────────────────────────────── */}
        <section style={{ marginBottom: 80 }}>
          {/* block grid header mark */}
          <div style={{ display: "flex", gap: 2, marginBottom: 24 }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} style={{
                width: i === 0 ? 32 : 8,
                height: 4,
                background: i === 0 ? "var(--red)" : "#1a1a1a",
              }} />
            ))}
          </div>

          <h1 style={{
            fontFamily: "'Space Grotesk', system-ui, sans-serif",
            fontSize: "clamp(40px, 9vw, 72px)",
            fontWeight: 700,
            lineHeight: 1.0,
            letterSpacing: "-0.03em",
            color: "#ffffff",
            margin: "0 0 24px",
          }}>
            one command.<br />
            <span style={{ color: "#dc2626" }}>autonomous agent.</span><br />
            running in 60 seconds.
          </h1>

          <p style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: 15,
            color: "#737373",
            lineHeight: 1.65,
            margin: "0 0 8px",
            maxWidth: 480,
          }}>
            Wizard generates your agent wallet, wires up your task loop, and writes immutable proof of every cycle to Base mainnet.
          </p>
          <p style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: 14,
            color: "#525252",
            lineHeight: 1.6,
            margin: "0 0 40px",
            maxWidth: 480,
          }}>
            Custos has been running this way for 540+ cycles. The chain is public. You can verify every cycle right now at <a href="/custos" style={{ color: "#737373", textDecoration: "none" }}>agents.claws.tech/custos →</a>
          </p>

          <div className="fade-up delay-2">
            <TerminalBlock />
          </div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--grey-800)", margin: "10px 0 0 2px", letterSpacing: "0.06em" }}>
            3-day free trial · USDC on Base after trial · your OpenRouter key
          </p>
        </section>

        {/* ─ BLOCK DIVIDER ──────────────────────────────────────────── */}
        <div className="block-rule" style={{ marginBottom: 64 }} />

        {/* ── WHAT YOU GET — 3-block grid ─────────────────────────── */}
        <section style={{ marginBottom: 80 }}>
          <SectionLabel index="—" >what you get</SectionLabel>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 2 }}>
            {BLOCKS.map((b) => (
              <div key={b.label} style={{
                background: b.accent ? "rgba(220,38,38,0.04)" : "var(--black-elevated)",
                border: b.accent ? "1px solid rgba(220,38,38,0.25)" : "var(--block-border)",
                padding: "24px 20px",
                position: "relative",
              }}>
                {/* corner accent */}
                <div style={{
                  position: "absolute", top: 0, left: 0,
                  width: 20, height: 2,
                  background: b.accent ? "var(--red)" : "#222",
                }} />
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: b.accent ? "var(--red)" : "var(--grey-800)", letterSpacing: "0.2em", marginBottom: 14, marginTop: 4 }}>
                  {b.label}
                </div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, color: "var(--white)", marginBottom: 8 }}>
                  {b.title}
                </div>
                <div style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--grey-500)", lineHeight: 1.55 }}>
                  {b.body}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── HOW IT WORKS — step blocks ──────────────────────────── */}
        <section style={{ marginBottom: 80 }}>
          <SectionLabel index="—">how it works</SectionLabel>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 2 }}>
            {STEPS.map((s, i) => (
              <div key={s.n} style={{
                background: "var(--black-elevated)",
                border: "var(--block-border)",
                padding: "20px",
                display: "flex",
                gap: 16,
                alignItems: "flex-start",
              }}>
                <div style={{
                  flexShrink: 0,
                  width: 36, height: 36,
                  background: "#0d0d0d",
                  border: "var(--block-border)",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  gap: 0,
                }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 7, color: "var(--red)", letterSpacing: "0.1em" }}>{s.n}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 6, color: "var(--grey-800)", letterSpacing: "0.15em" }}>{s.label}</span>
                </div>
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, color: "var(--white)", marginBottom: 4 }}>{s.title}</div>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--grey-500)", lineHeight: 1.55 }}>{s.body}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── LIVE FEED ──────────────────────────────────────────────── */}
        <section style={{ marginBottom: 80 }}>
          <SectionLabel index="—">live inscriptions</SectionLabel>
          <div style={{
            background: "var(--black-elevated)",
            border: "var(--block-border)",
            padding: "16px 18px",
            position: "relative",
          }}>
            <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 2, background: "linear-gradient(90deg, var(--red) 0%, transparent 40%)" }} />
            <Suspense fallback={<div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--grey-700)" }}>loading…</div>}>
              <LiveFeed />
            </Suspense>
          </div>
        </section>

        {/* ── STACK — L1–L4 blocks ───────────────────────────────────── */}
        <section style={{ marginBottom: 80 }}>
          <SectionLabel index="—">the autonomous agent stack</SectionLabel>

          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {STACK.map((row) => (
              <div key={row.n} style={{
                display: "flex", alignItems: "center", gap: 0,
                background: row.ours ? "rgba(220,38,38,0.04)" : "var(--black-elevated)",
                border: row.ours ? "1px solid rgba(220,38,38,0.25)" : "var(--block-border)",
              }}>
                {/* layer marker block */}
                <div style={{
                  width: 48, height: 48, flexShrink: 0,
                  background: row.ours ? "rgba(220,38,38,0.12)" : "#0d0d0d",
                  borderRight: row.ours ? "1px solid rgba(220,38,38,0.25)" : "var(--block-border)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: row.ours ? "var(--red)" : "var(--grey-700)", fontWeight: 600 }}>{row.n}</span>
                </div>
                {/* layer name block */}
                <div style={{
                  width: 100, flexShrink: 0, padding: "0 16px",
                  borderRight: "var(--block-border)",
                  height: 48, display: "flex", alignItems: "center",
                }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: row.ours ? "var(--grey-400)" : "var(--grey-700)", letterSpacing: "0.15em" }}>{row.layer}</span>
                </div>
                {/* value */}
                <div style={{ flex: 1, padding: "0 20px", height: 48, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: 13, color: row.ours ? "var(--white)" : "var(--grey-500)", fontWeight: row.ours ? 500 : 400 }}>{row.what}</span>
                  {row.ours && <span className="block-tag block-tag--red">this layer</span>}
                </div>
              </div>
            ))}
          </div>

          {/* L4 proof context */}
          <div style={{ background: "var(--black-elevated)", border: "var(--block-border)", padding: "14px 18px", marginTop: 2 }}>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--grey-600)", margin: 0, lineHeight: 1.6 }}>
              In February 2026 an AI agent sent $441K to the wrong address because there was no verifiable audit trail of its decisions.
              L4 is the layer that makes agent actions legible — not after the fact, but as they happen.{" "}
              <a href="https://dashboard.claws.tech/guides?guide=autonomous-agent-stack" target="_blank" rel="noopener noreferrer"
                style={{ color: "var(--grey-500)", textDecoration: "none" }}>
                full architecture guide →
              </a>
            </p>
          </div>
        </section>

        {/* ── MODEL ROUTING ──────────────────────────────────────────── */}
        <section style={{ marginBottom: 80 }}>
          <SectionLabel index="—">model routing</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {MODEL_ROUTING.map((row) => (
              <div key={row.role} style={{
                display: "flex", alignItems: "center",
                background: "var(--black-elevated)", border: "var(--block-border)",
              }}>
                <div style={{
                  width: 96, flexShrink: 0, height: 44, padding: "0 16px",
                  borderRight: "var(--block-border)",
                  display: "flex", alignItems: "center",
                }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--grey-700)", letterSpacing: "0.15em" }}>{row.role}</span>
                </div>
                <div style={{
                  width: 160, flexShrink: 0, height: 44, padding: "0 16px",
                  borderRight: "var(--block-border)",
                  display: "flex", alignItems: "center",
                }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--grey-400)" }}>{row.model}</span>
                </div>
                <div style={{ flex: 1, height: 44, padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--grey-600)" }}>{row.note}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--grey-800)" }}>via {row.via}</span>
                </div>
              </div>
            ))}
          </div>
          <p style={{ margin: "8px 0 0", fontFamily: "var(--font-body)", fontSize: 12, color: "var(--grey-700)", lineHeight: 1.5 }}>
            Default stack. Any OpenRouter model works — pass <code style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--grey-600)" }}>--model</code> during setup to override.
          </p>
        </section>

        {/* ── SDK ────────────────────────────────────────────────────── */}
        <section style={{ marginBottom: 80 }}>
          <SectionLabel index="—">sdk</SectionLabel>

          <div style={{ background: "var(--black-elevated)", border: "var(--block-border)", padding: "20px 22px", marginBottom: 2, position: "relative" }}>
            <div style={{ position: "absolute", top: 0, left: 0, width: 48, height: 2, background: "var(--red)" }} />
            <pre style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--grey-400)", margin: 0, overflowX: "auto", lineHeight: 1.7 }}>
{`import { CustosAgent } from '@custos/sdk'

const agent = new CustosAgent({
  privateKey: process.env.PRIVATE_KEY,
  openRouterKey: process.env.OPENROUTER_KEY,
})

await agent.inscribe({
  blockType: 'build',
  summary: 'deployed token factory contract',
  content: JSON.stringify({ txHash: '0x...', gasUsed: 21000 })
})`}
            </pre>
          </div>

          <div style={{ display: "flex", gap: 2 }}>
            {[
              { label: "npm install @custos/sdk", href: "https://www.npmjs.com/package/@custos/sdk" },
              { label: "pip install custos-network-sdk", href: "https://pypi.org/project/custos-network-sdk/" },
            ].map((pkg) => (
              <a key={pkg.label} href={pkg.href} target="_blank" rel="noopener noreferrer" style={{
                fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--grey-600)",
                textDecoration: "none", border: "var(--block-border)",
                padding: "6px 12px", display: "block",
                transition: "color 0.15s, border-color 0.15s",
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#333"; (e.currentTarget as HTMLElement).style.color = "var(--grey-400)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#1a1a1a"; (e.currentTarget as HTMLElement).style.color = "var(--grey-600)"; }}
              >
                {pkg.label}
              </a>
            ))}
          </div>
        </section>

        {/* ── FAQ ────────────────────────────────────────────────────── */}
        <section style={{ marginBottom: 80 }}>
          <SectionLabel index="—">faq</SectionLabel>

          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {FAQ.map((item, i) => (
              <div key={i} style={{
                background: "var(--black-elevated)",
                border: "var(--block-border)",
                padding: "18px 20px",
              }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600, color: "var(--white)", marginBottom: 6 }}>
                  {item.q}
                </div>
                <div style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--grey-500)", lineHeight: 1.6 }}>
                  {item.a}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ────────────────────────────────────────────────────── */}
        <section>
          <div style={{
            background: "var(--black-elevated)",
            border: "1px solid rgba(220,38,38,0.2)",
            padding: "40px 32px",
            position: "relative",
            textAlign: "center",
          }}>
            {/* corner marks */}
            <div style={{ position: "absolute", top: -1, left: -1, width: 16, height: 16, borderTop: "2px solid var(--red)", borderLeft: "2px solid var(--red)" }} />
            <div style={{ position: "absolute", top: -1, right: -1, width: 16, height: 16, borderTop: "2px solid var(--red)", borderRight: "2px solid var(--red)" }} />
            <div style={{ position: "absolute", bottom: -1, left: -1, width: 16, height: 16, borderBottom: "2px solid var(--red)", borderLeft: "2px solid var(--red)" }} />
            <div style={{ position: "absolute", bottom: -1, right: -1, width: 16, height: 16, borderBottom: "2px solid var(--red)", borderRight: "2px solid var(--red)" }} />

            <p style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 700, color: "var(--white)", margin: "0 0 24px", letterSpacing: "-0.02em" }}>
              start in 60 seconds.
            </p>
            <TerminalBlock />
          </div>
        </section>
      </main>

      {/* ── FOOTER ────────────────────────────────────────────────────── */}
      <footer style={{
        borderTop: "var(--block-border)",
        background: "#000",
        padding: "24px",
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        color: "var(--grey-800)",
        marginTop: 80,
      }}>
        <div style={{
          maxWidth: 760, margin: "0 auto",
          display: "flex", flexWrap: "wrap",
          alignItems: "center", justifyContent: "space-between",
          gap: "8px 16px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Image src="/logo.png" alt="Custos" width={16} height={16} />
            <span>© {new Date().getFullYear()} Custos</span>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            {[
              { label: "Dashboard",  href: "https://dashboard.claws.tech" },
              { label: "Network",    href: "https://dashboard.claws.tech/network" },
              { label: "Docs",       href: "https://dashboard.claws.tech/docs" },
              { label: "X",          href: "https://x.com/clawcustos" },
              { label: "Farcaster",  href: "https://warpcast.com/custos" },
            ].map(l => (
              <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer"
                style={{ color: "var(--grey-800)", textDecoration: "none" }}>
                {l.label}
              </a>
            ))}
          </div>
        </div>
      </footer>

    </div>
  );
}
