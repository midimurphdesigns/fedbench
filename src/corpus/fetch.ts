/**
 * Fetch the corpus documents listed in corpus/sources.json into corpus/raw/,
 * verifying each file's SHA-256 against the manifest. Idempotent: a file
 * already on disk with the right checksum is left alone.
 *
 *   bun run corpus:fetch
 *
 * Exit codes:
 *   0 — every document is present and verified
 *   1 — a fetch failed, or a downloaded file did not match the expected checksum
 */

import { resolve } from "node:path";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";

type CorpusDocument = {
  id: string;
  title: string;
  publisher: string;
  url: string;
  sha256: string;
  filename: string;
  bytes: number;
  scope: string;
};

type Manifest = {
  documents: CorpusDocument[];
};

const ROOT = resolve(import.meta.dir, "..", "..");
const RAW_DIR = resolve(ROOT, "corpus", "raw");
const MANIFEST_PATH = resolve(ROOT, "corpus", "sources.json");

// Same UA used during initial sourcing — some publisher CDNs reject
// curl-shaped User-Agent strings. This is browser-shaped, not a forge.
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 fedbench/0.0.1";

async function sha256(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function fileMatches(path: string, expected: string): Promise<boolean> {
  try {
    await stat(path);
  } catch {
    return false;
  }
  const bytes = await readFile(path);
  // Slice into a fresh ArrayBuffer so the digest call sees the right type
  // even when readFile returns a Buffer that backs onto a shared pool.
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const actual = await sha256(buffer);
  return actual === expected;
}

async function fetchDocument(doc: CorpusDocument): Promise<{ ok: true } | { ok: false; reason: string }> {
  const dest = resolve(RAW_DIR, doc.filename);

  if (await fileMatches(dest, doc.sha256)) {
    console.log(`  ✓ ${doc.id} — already present and verified`);
    return { ok: true };
  }

  console.log(`  ↓ ${doc.id} — fetching ${doc.url}`);
  let response: Response;
  try {
    response = await fetch(doc.url, { headers: { "User-Agent": USER_AGENT } });
  } catch (err) {
    return { ok: false, reason: `network error: ${(err as Error).message}` };
  }

  if (!response.ok) {
    return { ok: false, reason: `HTTP ${response.status} ${response.statusText}` };
  }

  const buffer = await response.arrayBuffer();
  const actual = await sha256(buffer);

  if (actual !== doc.sha256) {
    return {
      ok: false,
      reason: `checksum mismatch: expected ${doc.sha256}, got ${actual}. The upstream document may have been updated; verify the change is intentional, then update sources.json with the new SHA-256.`,
    };
  }

  await writeFile(dest, new Uint8Array(buffer));
  console.log(`    saved ${dest} (${buffer.byteLength.toLocaleString()} bytes)`);
  return { ok: true };
}

async function main(): Promise<void> {
  await mkdir(RAW_DIR, { recursive: true });

  const manifestText = await readFile(MANIFEST_PATH, "utf8");
  const manifest = JSON.parse(manifestText) as Manifest;

  console.log(`fedbench corpus — ${manifest.documents.length} documents`);
  console.log("─────────────────────────────────────────────────────");

  const failures: Array<{ id: string; reason: string }> = [];

  for (const doc of manifest.documents) {
    const result = await fetchDocument(doc);
    if (!result.ok) {
      failures.push({ id: doc.id, reason: result.reason });
    }
  }

  console.log("─────────────────────────────────────────────────────");

  if (failures.length > 0) {
    console.error(`\n✗ ${failures.length} document(s) failed:`);
    for (const failure of failures) {
      console.error(`  - ${failure.id}: ${failure.reason}`);
    }
    process.exit(1);
  }

  console.log(`✓ All ${manifest.documents.length} documents present and verified.`);
}

main().catch((err) => {
  console.error("Corpus fetch failed:", err);
  process.exit(1);
});
