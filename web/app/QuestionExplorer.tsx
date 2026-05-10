"use client";

import { useState } from "react";
import type { EvalRow } from "@/lib/data";

type Filter = "all" | "medicare" | "osha" | "in-corpus" | "out-of-corpus";

export function QuestionExplorer({ rows }: { rows: EvalRow[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(rows[0]?.pair.id ?? null);

  const filtered = rows.filter((r) => {
    if (filter === "all") return true;
    if (filter === "medicare") return r.pair.corpus === "medicare";
    if (filter === "osha") return r.pair.corpus === "osha";
    if (filter === "in-corpus") return r.pair.inCorpus;
    if (filter === "out-of-corpus") return !r.pair.inCorpus;
    return true;
  });

  const selected = rows.find((r) => r.pair.id === selectedId) ?? null;

  return (
    <section>
      <div className="flex flex-wrap gap-2 mb-4 text-xs">
        {(["all", "medicare", "osha", "in-corpus", "out-of-corpus"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 border ${
              filter === f
                ? "border-[rgb(var(--accent))] text-[rgb(var(--accent))]"
                : "border-white/10 text-[rgb(var(--muted))] hover:border-white/30"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
        <ul className="space-y-1 text-xs max-h-[60vh] overflow-y-auto pr-2 border-r border-white/5">
          {filtered.map((row) => {
            const isSelected = row.pair.id === selectedId;
            const verdict = row.recording.judge?.verdict;
            const verdictColor =
              verdict === "faithful"
                ? "text-[rgb(var(--pass))]"
                : verdict === "unsupported"
                  ? "text-[rgb(var(--fail))]"
                  : "text-[rgb(var(--muted))]";
            return (
              <li key={row.pair.id}>
                <button
                  onClick={() => setSelectedId(row.pair.id)}
                  className={`block w-full text-left p-2 ${
                    isSelected ? "bg-white/5 border-l-2 border-[rgb(var(--accent))]" : "border-l-2 border-transparent hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] text-[rgb(var(--muted))]">
                      {row.pair.id}
                    </span>
                    <span className={`text-[10px] uppercase ${verdictColor}`}>
                      {row.pair.inCorpus
                        ? (verdict ?? "n/a")
                        : row.recording.agent.refused
                          ? "refused"
                          : "answered"}
                    </span>
                  </div>
                  <div className="mt-1 line-clamp-2">{row.pair.question}</div>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="text-xs leading-5">
          {selected ? <RecordView row={selected} /> : <p>Select a question.</p>}
        </div>
      </div>
    </section>
  );
}

function RecordView({ row }: { row: EvalRow }) {
  const { pair, recording } = row;
  const { agent, judge } = recording;

  return (
    <article className="space-y-5">
      <section>
        <div className="text-[10px] uppercase tracking-wider text-[rgb(var(--muted))] mb-1">
          Question · {pair.corpus} · {pair.inCorpus ? "in corpus" : "out of corpus"}
        </div>
        <div className="text-sm">{pair.question}</div>
        {pair.expectedAnswer && pair.inCorpus && (
          <div className="mt-2 text-[rgb(var(--muted))]">
            <span className="text-[10px] uppercase tracking-wider">Expected · </span>
            {pair.expectedAnswer}
          </div>
        )}
      </section>

      <section>
        <div className="text-[10px] uppercase tracking-wider text-[rgb(var(--muted))] mb-2">
          BM25 retrieved chunks
        </div>
        <ol className="space-y-2">
          {agent.retrievedChunks.slice(0, 3).map((rc, i) => (
            <li key={i} className="border border-white/10 p-3">
              <div className="text-[10px] text-[rgb(var(--muted))] mb-1">
                {rc.chunk.document} · page {rc.chunk.page}
                {rc.score !== undefined && (
                  <span className="ml-2">score {rc.score.toFixed(3)}</span>
                )}
              </div>
              <div className="line-clamp-4">{rc.chunk.text}</div>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <div className="text-[10px] uppercase tracking-wider text-[rgb(var(--muted))] mb-2">
          Agent answer · {agent.model}
          {agent.rungName && ` · rung ${agent.rungName}`}
          {" · "}
          {agent.latencyMs}ms · ${agent.costUSD.toFixed(4)}
        </div>
        <div className="border border-white/10 p-3 whitespace-pre-wrap">
          {agent.refused ? (
            <span className="text-[rgb(var(--muted))]">[refused] {agent.answer}</span>
          ) : (
            agent.answer
          )}
        </div>
        {agent.claimedCitation && (
          <div className="mt-2 text-[rgb(var(--muted))]">
            <span className="text-[10px] uppercase tracking-wider">Claimed citation · </span>
            {agent.claimedCitation.document}, page {agent.claimedCitation.page}
            {pair.citation && (
              <>
                {" · "}
                <span className="text-[10px] uppercase tracking-wider">Expected · </span>
                {pair.citation.document}, page {pair.citation.page}
              </>
            )}
          </div>
        )}
      </section>

      {judge && (
        <section>
          <div className="text-[10px] uppercase tracking-wider text-[rgb(var(--muted))] mb-2">
            LLM-as-judge · {judge.judgeModel} · {judge.latencyMs}ms · ${judge.costUSD.toFixed(4)}
          </div>
          <div className="border border-white/10 p-3">
            <div
              className={`text-xs uppercase tracking-wider mb-2 ${
                judge.verdict === "faithful"
                  ? "text-[rgb(var(--pass))]"
                  : judge.verdict === "unsupported"
                    ? "text-[rgb(var(--fail))]"
                    : ""
              }`}
            >
              {judge.verdict}
            </div>
            <div>{judge.rationale}</div>
          </div>
        </section>
      )}
    </article>
  );
}
