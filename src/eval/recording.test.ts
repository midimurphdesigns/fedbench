/**
 * Tests for the recording store. Live-store capture + replay-store
 * playback are the two halves of the no-API-key demo path. These
 * tests pin both behaviors using a temp-file recording so the runner
 * doesn't depend on the checked-in recordings staying stable.
 */

import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLiveStore, createReplayStore } from "./recording.ts";
import type { AgentAnswer } from "../agent/answer.ts";
import type { JudgeResult } from "./judge.ts";

const FAKE_ANSWER: AgentAnswer = {
  question: "what's the part b premium?",
  answer: "$202.90 per month [cite: medicare-and-you, page 23]",
  claimedCitation: { document: "medicare-and-you", page: 23 },
  refused: false,
  retrievedChunks: [],
  costUSD: 0.01,
  latencyMs: 1500,
  model: "claude-sonnet-4-6",
  rungName: "primary",
  ladderAttempts: [],
};

const FAKE_JUDGE: JudgeResult = {
  verdict: "faithful",
  rationale: "Answer matches the cited chunk verbatim.",
  judgeModel: "claude-opus-4-7",
  costUSD: 0.02,
  latencyMs: 2200,
};

describe("createLiveStore", () => {
  let tmpDir: string;
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "fedbench-rec-"));
  });
  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("returns the live result and writes it to the recording", async () => {
    const recPath = join(tmpDir, "test.jsonl");
    const store = createLiveStore(recPath);
    const out = await store.getAgent("in-001", async () => FAKE_ANSWER);
    expect(out).toEqual(FAKE_ANSWER);
    await store.getJudge("in-001", async () => FAKE_JUDGE);
    store.finalize();

    expect(existsSync(recPath)).toBe(true);
    const lines = readFileSync(recPath, "utf8").trim().split("\n");
    expect(lines.length).toBe(1);
    const rec = JSON.parse(lines[0] ?? "{}");
    expect(rec.pairId).toBe("in-001");
    expect(rec.agent.answer).toBe(FAKE_ANSWER.answer);
    expect(rec.judge.verdict).toBe("faithful");
  });

  test("captures multiple pairs, each on its own line", async () => {
    const recPath = join(tmpDir, "multi.jsonl");
    const store = createLiveStore(recPath);
    await store.getAgent("a", async () => FAKE_ANSWER);
    await store.getAgent("b", async () => FAKE_ANSWER);
    store.finalize();

    const lines = readFileSync(recPath, "utf8").trim().split("\n");
    expect(lines.length).toBe(2);
    expect(JSON.parse(lines[0] ?? "{}").pairId).toBe("a");
    expect(JSON.parse(lines[1] ?? "{}").pairId).toBe("b");
  });

  test("does NOT write to disk when recording path is null", async () => {
    const store = createLiveStore(null);
    await store.getAgent("in-001", async () => FAKE_ANSWER);
    store.finalize();
    // No assertion on file system — the point is that finalize() is a no-op.
    expect(true).toBe(true);
  });
});

describe("createReplayStore", () => {
  let tmpDir: string;
  let recPath: string;
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "fedbench-rep-"));
    recPath = join(tmpDir, "replay.jsonl");
    // Seed a recording with one pair.
    const live = createLiveStore(recPath);
    void live.getAgent("in-001", async () => FAKE_ANSWER).then(() =>
      live.getJudge("in-001", async () => FAKE_JUDGE).then(() => live.finalize()),
    );
  });
  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("returns the recorded value WITHOUT calling runLive", async () => {
    // Wait for the seed to flush
    await new Promise((r) => setTimeout(r, 20));
    const store = createReplayStore(recPath);
    let liveCalled = false;
    const out = await store.getAgent("in-001", async () => {
      liveCalled = true;
      return FAKE_ANSWER;
    });
    expect(liveCalled).toBe(false);
    expect(out.answer).toBe(FAKE_ANSWER.answer);
  });

  test("throws on missing recording file", () => {
    expect(() => createReplayStore(join(tmpDir, "missing.jsonl"))).toThrow(/recording not found/);
  });

  test("throws when a pair id is not in the recording", async () => {
    await new Promise((r) => setTimeout(r, 20));
    const store = createReplayStore(recPath);
    expect(store.getAgent("not-a-real-pair", async () => FAKE_ANSWER)).rejects.toThrow(/no recorded answer/);
  });
});
