import { loadAllRows, aggregates, type EvalRow } from "@/lib/data";
import { QuestionExplorer } from "./QuestionExplorer";

export default function Page() {
  const rows = loadAllRows();
  const agg = aggregates(rows);

  return (
    <main className="min-h-screen px-6 py-12 max-w-4xl mx-auto">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight mb-2">fedbench</h1>
        <p className="text-sm leading-6 text-[rgb(var(--muted))] max-w-2xl">
          An open-source LLM eval harness for grounded Q&amp;A. The agent reads federal documents
          and answers questions about them; this site replays the 21 verified Q&amp;A pairs across two
          public corpora — three Medicare publications and three OSHA workplace-safety publications.
        </p>
        <p className="text-xs mt-3 text-[rgb(var(--muted))]">
          Source:{" "}
          <a className="underline" href="https://github.com/midimurphdesigns/fedbench">
            github.com/midimurphdesigns/fedbench
          </a>
        </p>
      </header>

      <section className="mb-10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <Stat label="Total pairs" value={String(agg.total)} />
        <Stat
          label="Faithful"
          value={`${agg.faithful}/${agg.inCorpus}`}
          hint="agent answered AND judge confirmed citation supports the claim"
        />
        <Stat
          label="OOC refusals"
          value={`${agg.refusedCorrectly}/${agg.outOfCorpus}`}
          hint="agent correctly refused on out-of-corpus questions"
        />
        <Stat label="Total cost" value={`$${agg.totalCostUSD.toFixed(4)}`} />
      </section>

      <QuestionExplorer rows={rows} />

      <footer className="mt-16 pt-8 border-t border-white/10 text-xs text-[rgb(var(--muted))]">
        Replay viewer over recorded eval runs — no API keys, no model calls. Real outputs from
        Sonnet 4.6 (agent) and Opus 4.7 (judge), captured during{" "}
        <code>bun run eval --record</code>.
      </footer>
    </main>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border border-white/10 p-3" title={hint}>
      <div className="text-[rgb(var(--muted))]">{label}</div>
      <div className="text-lg mt-1">{value}</div>
    </div>
  );
}
