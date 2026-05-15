import type { Metadata } from "next";
import { spaceGrotesk, geistMono, instrumentSerif } from "@/lib/fonts";
import "./globals.css";
import Cursor from "@/components/Cursor";

const SITE_URL = "https://fedbench.kevinmurphywebdev.com";
const TITLE = "fedbench — LLM eval harness for grounded Q&A";
const DESCRIPTION =
  "Replay viewer for fedbench's 21 verified Q&A pairs across two federal corpora (Medicare, OSHA). Each run shows retrieved chunks, the agent's grounded answer, deterministic citation check, and Opus-4.7 judge verdict.";

/* Reuse the main portfolio's /og route so every property in the trilogy
 * shares one canvas. Per-property query string distinguishes them. */
const OG_IMAGE = `https://kevinmurphywebdev.com/og?title=${encodeURIComponent(
  "fedbench",
)}&subtitle=${encodeURIComponent(
  "LLM eval harness for grounded Q&A. 21 verified pairs, deterministic citation check, Opus-4.7 judge.",
)}&eyebrow=${encodeURIComponent("DEMO — FEDBENCH")}`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "Kevin Murphy",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: TITLE }],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
    creator: "@midimurphdesigns",
    site: "@midimurphdesigns",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${geistMono.variable} ${instrumentSerif.variable}`}
    >
      <body><Cursor />{children}</body>
    </html>
  );
}
