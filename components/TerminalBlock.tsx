"use client";

import { useState } from "react";

const COMMAND = "npx create-custos-agent";

export function TerminalBlock() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(COMMAND);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div
      style={{
        background: "var(--black-elevated, #0a0a0a)",
        border: "1px solid #1a1a1a",
        borderRadius: 10,
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        maxWidth: 480,
        width: "100%",
      }}
    >
      {/* prompt */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            color: "#4a4a4a",
            flexShrink: 0,
          }}
        >
          $
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            color: "var(--green, #22c55e)",
            letterSpacing: "0.02em",
          }}
        >
          {COMMAND}
        </span>
        <span className="typing-cursor" />
      </div>

      {/* copy button */}
      <button
        onClick={copy}
        style={{
          background: "transparent",
          border: "1px solid #2a2a2a",
          borderRadius: 6,
          padding: "4px 10px",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: copied ? "var(--green, #22c55e)" : "#4a4a4a",
          cursor: "pointer",
          letterSpacing: "0.1em",
          transition: "all 0.15s",
          flexShrink: 0,
          whiteSpace: "nowrap",
        }}
      >
        {copied ? "copied ✓" : "copy"}
      </button>
    </div>
  );
}
