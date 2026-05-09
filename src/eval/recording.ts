/**
 * Recording + replay for the eval runner.
 *
 * The agent and the judge are the only two API-cost surfaces of the
 * harness. Everything else — citation-check, refusal-detect,
 * aggregation, the comparison report — is pure code. Capturing the
 * agent + judge outputs from a real run lets anyone replay the same
 * eval offline, no API key required, in about a second per corpus.
 *
 * Recording shape: one JSONL line per Q&A pair, with the agent's full
 * AgentAnswer and (when the pair was scored) the JudgeResult. The
 * replay store looks up by pair id; missing ids fall through cleanly
 * (the replay run skips that pair the way a network failure would).
 *
 * Why this is in the harness rather than a separate tool: the
 * recording's source of truth is the live eval runner. Putting the
 * record/replay pair next to the runner means they can't drift.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import type { AgentAnswer } from "../agent/answer.ts";
import type { JudgeResult } from "./judge.ts";

export type RecordedPair = {
  pairId: string;
  agent: AgentAnswer;
  judge: JudgeResult | null;
};

export type RecordingStore = {
  /** Resolve the agent's answer for a pair, either by calling live or by replay. */
  getAgent(pairId: string, runLive: () => Promise<AgentAnswer>): Promise<AgentAnswer>;
  /** Resolve the judge's verdict for a pair, either by calling live or by replay. */
  getJudge(
    pairId: string,
    runLive: () => Promise<JudgeResult>,
  ): Promise<JudgeResult>;
  /** Called once after the run completes. Lets a recording store flush to disk. */
  finalize(): void;
};

/**
 * Live store — every call goes to the real API, and outputs are
 * captured into an in-memory buffer that finalize() writes to a
 * recording file.
 */
export function createLiveStore(recordingPath: string | null): RecordingStore {
  const buffer: RecordedPair[] = [];
  const buffered = new Map<string, RecordedPair>();

  function ensureRecord(pairId: string): RecordedPair {
    let rec = buffered.get(pairId);
    if (!rec) {
      // Placeholder — real fields land as the live calls return.
      rec = {
        pairId,
        agent: undefined as unknown as AgentAnswer,
        judge: null,
      };
      buffered.set(pairId, rec);
      buffer.push(rec);
    }
    return rec;
  }

  return {
    async getAgent(pairId, runLive) {
      const result = await runLive();
      ensureRecord(pairId).agent = result;
      return result;
    },
    async getJudge(pairId, runLive) {
      const result = await runLive();
      ensureRecord(pairId).judge = result;
      return result;
    },
    finalize() {
      if (!recordingPath) return;
      mkdirSync(dirname(recordingPath), { recursive: true });
      const lines = buffer
        .filter((rec) => rec.agent !== undefined)
        .map((rec) => JSON.stringify(rec))
        .join("\n");
      writeFileSync(recordingPath, lines + "\n");
      console.log(`\n✓ wrote ${buffer.length} recorded pairs → ${recordingPath}`);
    },
  };
}

/**
 * Replay store — every call returns the recorded value for the pair.
 * The runLive callbacks are NEVER invoked, so a replay run requires
 * no API key. If a pair id is missing from the recording, getAgent()
 * throws so the runner can surface that the recording is stale.
 */
export function createReplayStore(recordingPath: string): RecordingStore {
  if (!existsSync(recordingPath)) {
    throw new Error(
      `recording not found at ${recordingPath}. Run \`bun run eval:record --corpus <id>\` to produce one (requires ANTHROPIC_API_KEY), or pick a different --corpus.`,
    );
  }
  const raw = readFileSync(recordingPath, "utf8");
  const byId = new Map<string, RecordedPair>();
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const rec = JSON.parse(trimmed) as RecordedPair;
    byId.set(rec.pairId, rec);
  }

  return {
    async getAgent(pairId) {
      const rec = byId.get(pairId);
      if (!rec) {
        throw new Error(
          `replay: no recorded answer for "${pairId}". The recording at ${recordingPath} is stale relative to the eval set; re-record with \`bun run eval:record --corpus <id>\`.`,
        );
      }
      return rec.agent;
    },
    async getJudge(pairId) {
      const rec = byId.get(pairId);
      if (!rec || rec.judge === null) {
        throw new Error(
          `replay: no recorded judge verdict for "${pairId}". Either the live run skipped the judge for this pair, or the recording is stale.`,
        );
      }
      return rec.judge;
    },
    finalize() {
      // No-op for replay.
    },
  };
}

export function getRecordingPath(corpusId: string): string {
  // Recordings live alongside the eval set so they ship with the repo
  // and version with the questions they correspond to.
  return resolve(import.meta.dir, "..", "..", "eval", "recordings", `${corpusId}.jsonl`);
}
