"use client";

import * as React from "react";
import { Check, ClipboardCopy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CopyableCode({
  code,
  className,
  label = "Copy",
}: {
  code: string;
  className?: string;
  label?: string;
}) {
  const [copied, setCopied] = React.useState(false);

  function copy() {
    navigator.clipboard
      .writeText(code)
      .then(() => {
        setCopied(true);
        toast.success("Copied to clipboard");
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => toast.error("Couldn't copy"));
  }

  return (
    <div className={cn("relative group", className)}>
      <pre className="text-[11px] leading-5 p-3 pr-10 border border-[var(--color-border)] bg-white/[0.02] overflow-x-auto">
        {code}
      </pre>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-1 top-1 size-7 opacity-60 hover:opacity-100"
        onClick={copy}
        aria-label={label}
      >
        {copied ? <Check className="size-3" /> : <ClipboardCopy className="size-3" />}
      </Button>
    </div>
  );
}
