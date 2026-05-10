"use client";

import * as React from "react";
import { CheckCircle2, FileQuestion, Filter, ShieldAlert, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { EvalRow } from "@/lib/data";
import { cn } from "@/lib/utils";

type FilterKey = "all" | "medicare" | "osha" | "in-corpus" | "out-of-corpus";

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "medicare", label: "Medicare" },
  { key: "osha", label: "OSHA" },
  { key: "in-corpus", label: "In corpus" },
  { key: "out-of-corpus", label: "Out of corpus" },
];

export function QuestionExplorer({ rows }: { rows: EvalRow[] }) {
  const [filter, setFilter] = React.useState<FilterKey>("all");
  const [selectedId, setSelectedId] = React.useState<string | null>(rows[0]?.pair.id ?? null);

  const filtered = React.useMemo(
    () =>
      rows.filter((r) => {
        if (filter === "all") return true;
        if (filter === "medicare") return r.pair.corpus === "medicare";
        if (filter === "osha") return r.pair.corpus === "osha";
        if (filter === "in-corpus") return r.pair.inCorpus;
        if (filter === "out-of-corpus") return !r.pair.inCorpus;
        return true;
      }),
    [filter, rows],
  );

  const selected = rows.find((r) => r.pair.id === selectedId) ?? null;

  function handleListKey(e: React.KeyboardEvent<HTMLUListElement>) {
    if (filtered.length === 0) return;
    const currentIdx = filtered.findIndex((r) => r.pair.id === selectedId);
    let nextIdx = currentIdx;
    if (e.key === "ArrowDown") nextIdx = Math.min(filtered.length - 1, currentIdx + 1);
    else if (e.key === "ArrowUp") nextIdx = Math.max(0, currentIdx - 1);
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = filtered.length - 1;
    else return;
    e.preventDefault();
    const next = filtered[nextIdx];
    if (next) setSelectedId(next.pair.id);
  }

  return (
    <section>
      <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterKey)} className="mb-4">
        <div className="flex items-center gap-2 mb-2 text-[10px] font-mono uppercase tracking-wider text-[var(--color-muted-foreground)]">
          <Filter className="size-3" />
          Filters
        </div>
        <TabsList className="flex flex-wrap">
          {FILTERS.map((f) => (
            <TabsTrigger key={f.key} value={f.key}>
              {f.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
        <div>
          <p
            className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-muted-foreground)] mb-2"
            id="question-list-label"
          >
            {filtered.length} pair{filtered.length === 1 ? "" : "s"}
          </p>
          {filtered.length === 0 ? (
            <Alert>
              <AlertDescription className="space-y-2">
                <p>No pairs match this filter.</p>
                <Button size="sm" variant="outline" onClick={() => setFilter("all")}>
                  Reset filter
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <ScrollArea className="h-[60vh] md:h-[65vh] pr-2">
              <ul
                role="listbox"
                aria-labelledby="question-list-label"
                aria-activedescendant={selectedId ? `q-${selectedId}` : undefined}
                tabIndex={0}
                onKeyDown={handleListKey}
                className="space-y-1 focus:outline-none"
              >
                {filtered.map((row) => (
                  <QuestionListItem
                    key={row.pair.id}
                    row={row}
                    selected={row.pair.id === selectedId}
                    onSelect={() => setSelectedId(row.pair.id)}
                  />
                ))}
              </ul>
            </ScrollArea>
          )}
        </div>

        <div className="text-xs leading-5">
          {selected ? (
            <RecordView row={selected} />
          ) : (
            <Alert>
              <AlertDescription>Select a question on the left.</AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </section>
  );
}

function ChunkCard({ chunk }: { chunk: { chunk: { document: string; page: number; text: string }; score?: number } }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="border border-[var(--color-border)] p-3">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
          {chunk.chunk.document} · page {chunk.chunk.page}
          {chunk.score !== undefined && <> · score {chunk.score.toFixed(3)}</>}
        </span>
      </div>
      <p
        className={cn(
          "text-xs leading-5",
          !open && "line-clamp-4",
        )}
      >
        {chunk.chunk.text}
      </p>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-2 inline-flex items-center text-[10px] font-mono uppercase tracking-wider text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
      >
        {open ? "Collapse" : "Show full"}
      </button>
    </div>
  );
}

function QuestionListItem({
  row,
  selected,
  onSelect,
}: {
  row: EvalRow;
  selected: boolean;
  onSelect: () => void;
}) {
  const verdict = row.recording.judge?.verdict;
  const refusedOoC = !row.pair.inCorpus && row.recording.agent.refused;
  const wronglyAnsweredOoC = !row.pair.inCorpus && !row.recording.agent.refused;

  let badge: React.ReactNode;
  if (verdict === "faithful") badge = <Badge variant="success">faithful</Badge>;
  else if (verdict === "unsupported") badge = <Badge variant="destructive">unsupported</Badge>;
  else if (refusedOoC) badge = <Badge variant="success">refused</Badge>;
  else if (wronglyAnsweredOoC) badge = <Badge variant="destructive">answered</Badge>;
  else badge = <Badge variant="muted">n/a</Badge>;

  return (
    <li id={`q-${row.pair.id}`} role="option" aria-selected={selected}>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "block w-full text-left p-2 transition-colors border-l-2",
          selected
            ? "bg-white/5 border-[var(--color-primary)]"
            : "border-transparent hover:bg-white/5 hover:border-white/20",
        )}
      >
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="font-mono text-[10px] text-[var(--color-muted-foreground)]">
            {row.pair.id} · {row.pair.corpus}
          </span>
          {badge}
        </div>
        <p className="text-xs leading-snug line-clamp-2">{row.pair.question}</p>
      </button>
    </li>
  );
}

function RecordView({ row }: { row: EvalRow }) {
  const { pair, recording } = row;
  const { agent, judge } = recording;

  const claimedDoc = agent.claimedCitation?.document;
  const claimedPage = agent.claimedCitation?.page;
  const expectedDoc = pair.citation?.document;
  const expectedPage = pair.citation?.page;
  const hasMismatch =
    pair.inCorpus &&
    expectedDoc !== undefined &&
    claimedDoc !== undefined &&
    (claimedDoc !== expectedDoc || claimedPage !== expectedPage);

  return (
    <article className="space-y-4">
      <div className="sticky top-0 z-10 -mx-1 px-1 py-2 bg-[var(--color-background)]/95 backdrop-blur border-b border-[var(--color-border)]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
            {pair.id}
          </span>
          <Badge variant="muted">{pair.corpus}</Badge>
          <Badge variant={pair.inCorpus ? "accent" : "warning"}>
            {pair.inCorpus ? "in corpus" : "out of corpus"}
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileQuestion className="size-4 text-[var(--color-primary)]" />
            <h3 className="text-sm font-semibold">Question</h3>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm leading-6">{pair.question}</p>
          {pair.expectedAnswer && pair.inCorpus && (
            <p className="text-xs text-[var(--color-muted-foreground)] leading-5">
              <span className="font-mono uppercase tracking-wider text-[10px] mr-2">expected</span>
              {pair.expectedAnswer}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold">BM25 retrieved chunks</h3>
          <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-muted-foreground)]">
            top {Math.min(3, agent.retrievedChunks.length)} of {agent.retrievedChunks.length}
          </p>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2">
            {agent.retrievedChunks.slice(0, 3).map((rc, i) => (
              <li key={i}>
                <ChunkCard chunk={rc} />
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">Agent answer</h3>
            {agent.refused && <Badge variant="muted">refused</Badge>}
          </div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-muted-foreground)]">
            {agent.model}
            {agent.rungName && ` · rung ${agent.rungName}`} · {agent.latencyMs}ms · $
            {agent.costUSD.toFixed(4)}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className={cn("text-xs leading-5 whitespace-pre-wrap", agent.refused && "text-[var(--color-muted-foreground)] italic")}>
            {agent.answer}
          </p>
          {agent.claimedCitation && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={hasMismatch ? "warning" : "muted"}>
                claimed · {agent.claimedCitation.document}, p{agent.claimedCitation.page}
              </Badge>
              {pair.citation && (
                <Badge variant="muted">
                  expected · {pair.citation.document}, p{pair.citation.page}
                </Badge>
              )}
            </div>
          )}
          {hasMismatch && (
            <Alert variant="warning">
              <ShieldAlert className="size-4" />
              <AlertDescription>
                Claimed citation differs from the verified expected citation. Deterministic
                citation-check would catch this before judge runs.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {judge && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold">LLM-as-judge</h3>
              {judge.verdict === "faithful" ? (
                <Badge variant="success">
                  <CheckCircle2 className="size-3" />
                  {judge.verdict}
                </Badge>
              ) : judge.verdict === "unsupported" ? (
                <Badge variant="destructive">
                  <XCircle className="size-3" />
                  {judge.verdict}
                </Badge>
              ) : (
                <Badge variant="warning">{judge.verdict}</Badge>
              )}
            </div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-muted-foreground)]">
              {judge.judgeModel} · {judge.latencyMs}ms · ${judge.costUSD.toFixed(4)}
            </p>
          </CardHeader>
          <CardContent>
            <p className="text-xs leading-5">{judge.rationale}</p>
          </CardContent>
        </Card>
      )}
    </article>
  );
}
