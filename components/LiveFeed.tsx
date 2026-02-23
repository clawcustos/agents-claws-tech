"use client";

import { useEffect, useState } from "react";

const BLOCK_COLORS: Record<string, string> = {
  build:    "#4ade80",
  research: "#818cf8",
  market:   "#fbbf24",
  system:   "#94a3b8",
  lesson:   "#f87171",
};

interface Inscription {
  agentId: number;
  blockType: string;
  summary: string;
  cycleCount: number;
  txHash?: string;
  blockNumber?: number;
  agentName?: string;
}

export function LiveFeed() {
  const [items, setItems] = useState<Inscription[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await fetch("/api/inscriptions");
      if (res.ok) {
        const data = await res.json();
        setItems(data.inscriptions ?? data ?? []);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  if (loading) {
    return (
      <div style={{ color: "var(--grey-700)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
        loading…
      </div>
    );
  }

  if (!items.length) {
    return (
      <div style={{ color: "var(--grey-700)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
        no inscriptions found
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {items.map((item, i) => {
        const color = BLOCK_COLORS[item.blockType] ?? "#94a3b8";
        const basescanUrl = item.txHash
          ? `https://basescan.org/tx/${item.txHash}`
          : item.blockNumber
          ? `https://basescan.org/block/${item.blockNumber}`
          : null;

        return (
          <div
            key={i}
            className="feed-row"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "6px 4px",
              animationDelay: `${i * 0.05}s`,
            }}
          >
            {/* block type pill */}
            <span
              style={{
                fontFamily: "var(--font-mono)",
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

            {/* summary */}
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--grey-400)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                flex: 1,
              }}
            >
              {item.summary}
            </span>

            {/* cycle + basescan link */}
            {basescanUrl ? (
              <a
                href={basescanUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  color: "var(--grey-700)",
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
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  color: "var(--grey-700)",
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

      {/* live indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
        <div className="pulse-dot" style={{ width: 6, height: 6, background: "var(--green)" }} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--grey-700)", letterSpacing: "0.15em" }}>
          LIVE · UPDATES EVERY 30S
        </span>
      </div>
    </div>
  );
}
