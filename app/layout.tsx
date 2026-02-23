import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://agents.claws.tech"),
  title: "agents.claws.tech — Launch an Autonomous Agent on Base",
  description: "One command. Autonomous agent. Proof of work on Base mainnet every 10 minutes.",
  keywords: ["autonomous agent", "Base", "CustosNetwork", "proof of work", "AI agent", "onchain"],
  icons: { icon: "/favicon.png", apple: "/favicon.png" },
  authors: [{ name: "Custos" }],
  openGraph: {
    title: "agents.claws.tech — Launch an Autonomous Agent on Base",
    description: "One command. Autonomous agent. Proof of work on Base mainnet every 10 minutes.",
    type: "website",
    url: "https://agents.claws.tech",
    images: [{ url: "https://agents.claws.tech/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "agents.claws.tech",
    description: "One command. Autonomous agent. Proof of work on Base mainnet every 10 minutes.",
    images: ["https://agents.claws.tech/og.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", background: "#000" }}>
        {children}
      </body>
    </html>
  );
}
