#!/usr/bin/env python3
"""
Parse the fetched PDFs for a given corpus into the per-page .txt
files the chunker reads. Output format:

    === PAGE 1 ===
    <page-1 extracted text>

    === PAGE 2 ===
    <page-2 extracted text>

    ...

Usage:
    python3 scripts/parse-pdfs.py [--corpus <id>]

Defaults to FEDBENCH_CORPUS env var or "medicare". Reads the manifest
at corpus/sources.json (legacy) or corpus/sources.<id>.json (named
corpora) to discover document IDs and filenames; reads PDFs from
corpus/raw/ (legacy) or corpus/raw/<id>/; writes <doc>.txt files into
.corpus-cache/ (legacy) or .corpus-cache/<id>/.

Why Python and not TypeScript: pypdf is the most reliable PDF text
extractor in the Python ecosystem and has no Bun/TS equivalent of
comparable quality. The parse step is one-shot, runs locally during
corpus setup, and never executes inside the eval loop — keeping it
in Python is a deliberate impedance match.
"""

import argparse
import json
import os
import sys
from pathlib import Path

try:
    import pypdf
except ImportError:
    print("missing pypdf — install with: pip install pypdf", file=sys.stderr)
    sys.exit(1)


REPO_ROOT = Path(__file__).resolve().parent.parent


def resolve_paths(corpus_id: str) -> dict:
    """Mirror src/corpus/paths.ts: legacy layout for medicare, namespaced for everything else."""
    legacy_manifest = REPO_ROOT / "corpus" / "sources.json"
    if corpus_id == "medicare" and legacy_manifest.exists():
        return {
            "manifest": legacy_manifest,
            "raw_dir": REPO_ROOT / "corpus" / "raw",
            "cache_dir": REPO_ROOT / ".corpus-cache",
        }
    return {
        "manifest": REPO_ROOT / "corpus" / f"sources.{corpus_id}.json",
        "raw_dir": REPO_ROOT / "corpus" / "raw" / corpus_id,
        "cache_dir": REPO_ROOT / ".corpus-cache" / corpus_id,
    }


def parse_corpus(corpus_id: str) -> int:
    paths = resolve_paths(corpus_id)
    if not paths["manifest"].exists():
        print(f"manifest not found: {paths['manifest']}", file=sys.stderr)
        return 1
    if not paths["raw_dir"].exists():
        print(f"raw dir not found: {paths['raw_dir']}. Run: bun run corpus:fetch --corpus {corpus_id}", file=sys.stderr)
        return 1

    paths["cache_dir"].mkdir(parents=True, exist_ok=True)

    manifest = json.loads(paths["manifest"].read_text())
    documents = manifest["documents"]

    print(f"fedbench parse [{corpus_id}] — {len(documents)} documents")
    print("─────────────────────────────────────────────────────")

    for doc in documents:
        pdf_path = paths["raw_dir"] / doc["filename"]
        out_path = paths["cache_dir"] / f"{doc['id']}.txt"
        if not pdf_path.exists():
            print(f"  ✗ {doc['id']}: PDF missing at {pdf_path}", file=sys.stderr)
            continue
        reader = pypdf.PdfReader(str(pdf_path))
        sections = []
        for i, page in enumerate(reader.pages, start=1):
            text = page.extract_text() or ""
            sections.append(f"=== PAGE {i} ===\n{text}")
        out_path.write_text("\n\n".join(sections))
        print(f"  ✓ {doc['id']}: {len(reader.pages)} pages → {out_path.name}")

    print("─────────────────────────────────────────────────────")
    print(f"✓ parsed into {paths['cache_dir']}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Parse fedbench corpus PDFs to per-page text")
    parser.add_argument("--corpus", default=os.environ.get("FEDBENCH_CORPUS", "medicare"))
    args = parser.parse_args()
    return parse_corpus(args.corpus)


if __name__ == "__main__":
    sys.exit(main())
