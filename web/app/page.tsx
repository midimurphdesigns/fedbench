import { ExternalLink, Github } from "lucide-react";

import { Toaster } from "@/components/ui/sonner";
import { CopyableCode } from "@/components/copyable-code";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { aggregates, loadAllRows, type Aggregates } from "@/lib/data";
import { QuestionExplorer } from "./QuestionExplorer";

const INSTALL_SNIPPET = `git clone https://github.com/midimurphdesigns/fedbench.git
cd fedbench
bun install
cp .env.example .env       # add ANTHROPIC_API_KEY
bun run eval               # runs all 21 pairs, scores them
bun run eval:replay        # replays the recorded run, no key needed`;

export default function Page() {
  const rows = loadAllRows();
  const agg = aggregates(rows);

  return (
    <TooltipProvider delayDuration={200}>
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:p-2 focus:bg-[var(--color-popover)] focus:border focus:border-[var(--color-primary)] focus:text-xs">
        Skip to content
      </a>
      <main id="content" className="min-h-screen px-4 py-12 sm:px-6 max-w-5xl mx-auto">
        <header className="mb-10">
          <h1 className="type-display text-5xl mb-3">fedbench</h1>
          <p className="text-sm leading-6 text-[var(--color-muted-foreground)] max-w-2xl">
            An open-source LLM eval harness for grounded Q&amp;A. The agent reads federal
            documents and answers questions about them; this site replays the 21 verified Q&amp;A
            pairs across two public corpora — three Medicare publications and three OSHA
            workplace-safety publications.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-muted-foreground)]">
            <a
              href="https://github.com/midimurphdesigns/fedbench"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 underline-offset-4 hover:text-[var(--color-foreground)] hover:underline"
            >
              <Github className="size-3.5" />
              github.com/midimurphdesigns/fedbench
            </a>
            <a
              href="https://kevinmurphywebdev.com/blog/building-fedbench"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 underline-offset-4 hover:text-[var(--color-foreground)] hover:underline"
            >
              <ExternalLink className="size-3.5" />
              Read the blog post
            </a>
          </div>
        </header>

        <StatGrid agg={agg} />

        <QuestionExplorer rows={rows} />

        <section className="mt-16 border-t border-[var(--color-border)] pt-10">
          <Eyebrow className="mb-3">Run it locally</Eyebrow>
          <h2 className="text-2xl tracking-tight mb-3">Bring your own corpus</h2>
          <p className="text-sm leading-6 text-[var(--color-muted-foreground)] max-w-2xl mb-6">
            The hosted viewer replays the verified Q&amp;A set. To run the full eval (BM25
            retrieval + Sonnet 4.6 agent + Opus 4.7 judge) against your own questions, clone
            the repo and add an Anthropic API key. Each eval run costs about $0.025/pair.
          </p>
          <CopyableCode code={INSTALL_SNIPPET} />
          <p className="mt-6 text-sm leading-6 text-[var(--color-muted-foreground)] max-w-2xl">
            To swap in your own corpus: drop PDFs into <code className="font-mono text-xs">corpus/raw/</code>, run{" "}
            <code className="font-mono text-xs">bun run corpus:fetch</code> +{" "}
            <code className="font-mono text-xs">bun run corpus:chunk</code>, then write
            your Q&amp;A pairs into <code className="font-mono text-xs">eval/questions.jsonl</code>. The harness scores
            hallucination, citation accuracy, and refusal discipline as first-class metrics.
          </p>
        </section>

        <footer className="mt-12 pt-8 border-t border-[var(--color-border)] text-xs text-[var(--color-muted-foreground)]">
          Replay viewer over recorded eval runs — no API keys, no model calls. Real outputs from
          Sonnet 4.6 (agent) and Opus 4.7 (judge), captured during{" "}
          <code>bun run eval --record</code>.
        </footer>

        <Toaster position="top-right" />
      </main>
    </TooltipProvider>
  );
}

function StatGrid({ agg }: { agg: Aggregates }) {
  return (
    <section className="mb-10 border-y border-[var(--color-border)] py-6 grid grid-cols-2 sm:grid-cols-4 divide-x divide-[var(--color-border)]">
      <Stat label="Total pairs" value={String(agg.total)} weight="meta" />
      <Stat
        label="Faithful"
        value={`${agg.faithful}/${agg.inCorpus}`}
        weight="headline"
        hint="Agent answered AND judge confirmed citation supports the claim"
      />
      <Stat
        label="OOC refusals"
        value={`${agg.refusedCorrectly}/${agg.outOfCorpus}`}
        weight="headline"
        hint="Agent correctly refused on out-of-corpus questions"
      />
      <Stat label="Total cost" value={`$${agg.totalCostUSD.toFixed(4)}`} weight="meta" />
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
  weight = "meta",
}: {
  label: string;
  value: string;
  hint?: string;
  weight?: "meta" | "headline";
}) {
  const inner = (
    <div className="px-5 first:pl-0">
      <Eyebrow>{label}</Eyebrow>
      <p
        className={
          weight === "headline"
            ? "mt-2 text-2xl tabular-nums tracking-tight text-[var(--color-foreground)]"
            : "mt-2 text-lg tabular-nums text-[var(--color-muted-foreground)]"
        }
      >
        {value}
      </p>
    </div>
  );
  if (!hint) return inner;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="cursor-help">{inner}</div>
      </TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  );
}
