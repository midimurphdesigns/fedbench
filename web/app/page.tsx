import { ExternalLink, Github } from "lucide-react";

import { Toaster } from "@/components/ui/sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CopyableCode } from "@/components/copyable-code";
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
          <h1 className="text-3xl font-semibold tracking-tight mb-2">fedbench</h1>
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

        <Card className="mt-16">
          <CardHeader>
            <h2 className="text-base font-semibold">Run it locally on your own corpus</h2>
            <p className="text-xs leading-5 text-[var(--color-muted-foreground)]">
              The hosted viewer replays the verified Q&amp;A set. To run the full eval (BM25
              retrieval + Sonnet 4.6 agent + Opus 4.7 judge) against your own questions, clone
              the repo and add an Anthropic API key. Each eval run costs about $0.025/pair.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <CopyableCode code={INSTALL_SNIPPET} />
            <p className="text-xs leading-5 text-[var(--color-muted-foreground)]">
              To swap in your own corpus: drop PDFs into <code>corpus/raw/</code>, run{" "}
              <code>bun run corpus:fetch</code> + <code>bun run corpus:chunk</code>, then write
              your Q&amp;A pairs into <code>eval/questions.jsonl</code>. The harness scores
              hallucination, citation accuracy, and refusal discipline as first-class metrics.
            </p>
          </CardContent>
        </Card>

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
    <section className="mb-10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
      <Stat label="Total pairs" value={String(agg.total)} />
      <Stat
        label="Faithful"
        value={`${agg.faithful}/${agg.inCorpus}`}
        hint="Agent answered AND judge confirmed citation supports the claim"
      />
      <Stat
        label="OOC refusals"
        value={`${agg.refusedCorrectly}/${agg.outOfCorpus}`}
        hint="Agent correctly refused on out-of-corpus questions"
      />
      <Stat label="Total cost" value={`$${agg.totalCostUSD.toFixed(4)}`} />
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const inner = (
    <Card>
      <CardContent className="p-3">
        <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-muted-foreground)]">
          {label}
        </p>
        <p className="mt-1 text-lg tabular-nums">{value}</p>
      </CardContent>
    </Card>
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
