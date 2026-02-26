"use client";

import { useEffect, useRef, useState } from "react";

import { Card } from "@/components/ui/card";

const STEP_DURATION_MS = 1800;
const TOTAL_STEPS = 9;

function toolStatusLabel(step: number): string {
  if (step < 3) return "Idle";
  if (step === 3) return "Needs approval";
  if (step === 4) return "Approved";
  if (step === 5) return "Running";
  if (step >= 6) return "Completed";
  return "Idle";
}

function toolStatusClass(step: number): string {
  if (step < 3) return "bg-muted text-muted-foreground";
  if (step === 3) return "bg-amber-500/15 text-amber-700";
  if (step === 4) return "bg-primary/10 text-primary";
  if (step === 5) return "bg-sky-500/15 text-sky-700";
  return "bg-emerald-500/15 text-emerald-700";
}

export function HeroChatPreview() {
  const [step, setStep] = useState(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const showProposal = step >= 2;
  const showFunctionCall = step >= 3;
  const approvalPending = step === 3;
  const approvalClicked = step === 4;
  const showApprovalCard = approvalPending || approvalClicked;
  const running = step === 5;
  const completed = step >= 6;
  const showFollowUp = step >= 7;
  const showUserConfirm = step >= 8;

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setStep((current) => (current + 1) % TOTAL_STEPS);
    }, STEP_DURATION_MS);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [step]);

  return (
    <Card className="relative flex h-[560px] flex-col overflow-hidden border-primary/35 bg-card/95 p-4 shadow-panel animate-fade-up [animation-delay:120ms]">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Live Preview</p>
          <p className="text-sm font-semibold">In-App Support Chat</p>
        </div>
        <div className="rounded-full border border-border bg-background px-2 py-1 font-mono text-[10px] text-muted-foreground">
          session: a1f3c8d9
        </div>
      </div>

      <div
        ref={scrollRef}
        className="mt-4 h-[360px] min-h-[360px] max-h-[360px] space-y-3 overflow-y-auto pr-1"
      >
        <div className="flex justify-end">
          <div className="max-w-[88%] rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm animate-fade-up">
            <p className="text-[10px] uppercase tracking-widest text-primary">user</p>
            <p className="mt-1 leading-relaxed">
              I opened the assistant chat because my activity timeline is blank after the latest run sync.
            </p>
          </div>
        </div>

        {!showProposal ? (
          <div className="flex justify-start">
            <div className="max-w-[88%] rounded-xl border border-border bg-background px-3 py-2 text-sm animate-fade-up">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">assistant</p>
              <p className="mt-1 flex items-center gap-2 text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/70 animate-pulse" />
                thinking...
              </p>
            </div>
          </div>
        ) : null}

        {showProposal ? (
          <div className="flex justify-start">
            <div className="max-w-[88%] rounded-xl border border-border bg-background px-3 py-2 text-sm animate-fade-up">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">assistant</p>
              <p className="mt-1 leading-relaxed">
                I can run a function call to rebuild the timeline index and trigger a background refresh.
              </p>
            </div>
          </div>
        ) : null}

        {showFunctionCall ? (
          <div className="rounded-xl border border-border bg-background/80 px-3 py-2 text-xs font-mono animate-fade-up">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">function call</p>
              <span className={`rounded-full px-2 py-0.5 text-[10px] ${toolStatusClass(step)}`}>{toolStatusLabel(step)}</span>
            </div>
            <p className="mt-1 text-foreground">reindex_activity_timeline</p>
            <p className="mt-1 text-muted-foreground">{`{"workspace":"activity_feed","window":"last_30_days"}`}</p>
          </div>
        ) : null}

        {showApprovalCard ? (
          <div
            className={`rounded-xl px-3 py-2 animate-fade-up transition-all ${
              approvalPending
                ? "border-2 border-amber-500/60 bg-amber-500/15 shadow-[0_0_0_2px_rgba(245,158,11,0.15)]"
                : "border-2 border-primary/60 bg-primary/10 shadow-[0_0_0_2px_rgba(14,165,233,0.18)]"
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Approval Required</p>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] ${
                  approvalPending ? "bg-amber-500/20 text-amber-800" : "bg-primary/20 text-primary"
                }`}
              >
                {approvalPending ? "Waiting for user" : "Approved"}
              </span>
            </div>
            <p className="mt-1 text-sm font-semibold">Allow assistant to run reindex_activity_timeline?</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {approvalPending
                ? "This refreshes timeline metadata and requests a safe cache rebuild."
                : "User approved. Executing function..."}
            </p>
            <div className="mt-3 flex gap-2">
              <span
                className={`relative inline-flex rounded-md px-2 py-1 text-xs font-medium ${
                  approvalPending
                    ? "bg-primary text-primary-foreground"
                    : "bg-primary text-primary-foreground scale-95 shadow-[0_0_0_4px_rgba(14,165,233,0.22)]"
                }`}
              >
                {approvalClicked ? (
                  <span className="absolute inset-0 rounded-md bg-primary/30 animate-ping" />
                ) : null}
                Approve
              </span>
              <span className="inline-flex rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
                Deny
              </span>
            </div>
          </div>
        ) : null}

        {running ? (
          <div className="flex justify-start">
            <div className="max-w-[88%] rounded-xl border border-border bg-background px-3 py-2 text-sm animate-fade-up">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">assistant</p>
              <p className="mt-1 flex items-center gap-2 leading-relaxed">
                <span className="h-2 w-2 rounded-full bg-sky-600 animate-pulse" />
                Running it now and rebuilding your timeline cache...
              </p>
            </div>
          </div>
        ) : null}

        {completed ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-mono animate-fade-up">
            <p className="text-[10px] uppercase tracking-widest text-emerald-700">tool result</p>
            <p className="mt-1 text-foreground">{`{"status":"ok","reindexed_items":127,"refresh_job":"queued"}`}</p>
          </div>
        ) : null}

        {showFollowUp ? (
          <div className="flex justify-start">
            <div className="max-w-[88%] rounded-xl border border-border bg-background px-3 py-2 text-sm animate-fade-up">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">assistant</p>
              <p className="mt-1 leading-relaxed">
                Done. I reindexed the activity timeline and pushed a refresh. Is timeline loading in the app now?
              </p>
            </div>
          </div>
        ) : null}

        {showUserConfirm ? (
          <div className="flex justify-end">
            <div className="max-w-[88%] rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm animate-fade-up">
              <p className="text-[10px] uppercase tracking-widest text-primary">user</p>
              <p className="mt-1 leading-relaxed">Yep, it is back. Thanks.</p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-3 border-t border-border pt-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
            Type your message...
          </div>
          <span className="inline-flex rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
            Send
          </span>
        </div>
      </div>

    </Card>
  );
}
