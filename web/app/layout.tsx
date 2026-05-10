import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "fedbench — LLM eval harness for grounded Q&A",
  description:
    "Replay viewer for fedbench's 21 verified Q&A pairs across two federal corpora (Medicare, OSHA). Each run shows retrieved chunks, the agent's grounded answer, deterministic citation check, and Opus-4.7 judge verdict.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
