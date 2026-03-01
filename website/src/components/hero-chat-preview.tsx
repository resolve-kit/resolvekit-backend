"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Card } from "@/components/ui/card";

type TimelineState = "triage" | "proposal" | "approval" | "running" | "result" | "followup";

const STEPS: TimelineState[] = [
  "triage",
  "proposal",
  "approval",
  "running",
  "result",
  "followup",
];

const INTERVAL_MS = 1700;

function statusFor(step: TimelineState): { label: string; className: string } {
  if (step === "approval") return { label: "Waiting approval", className: "bg-[#fff7ea] text-[#935f16]" };
  if (step === "running") return { label: "Executing", className: "bg-[#edf3ff] text-[#2059b6]" };
  if (step === "result" || step === "followup") return { label: "Completed", className: "bg-[#ebf9f4] text-[#1b7a61]" };
  return { label: "Context loading", className: "bg-muted text-muted-foreground" };
}

export function HeroChatPreview() {
  const [index, setIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const step = STEPS[index] ?? "triage";
  const status = useMemo(() => statusFor(step), [step]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % STEPS.length);
    }, INTERVAL_MS);

    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.scrollTo({ top: containerRef.current.scrollHeight, behavior: "smooth" });
  }, [step]);

  return (
    <Card className="relative h-[570px] overflow-hidden border-primary/35 bg-card/95 p-4 animate-fade-up [animation-delay:100ms]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary/10 to-transparent" />

      <div className="relative flex items-center justify-between border-b border-border pb-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Live Command Trace</p>
          <p className="text-sm font-semibold">Embedded SDK Support Session</p>
        </div>
        <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${status.className}`}>{status.label}</span>
      </div>

      <div ref={containerRef} className="relative mt-4 h-[382px] overflow-y-auto space-y-3 pr-1">
        <div className="flex justify-end">
          <div className="max-w-[87%] rounded-xl border border-primary/35 bg-primary/10 px-3 py-2 text-sm animate-fade-up">
            <p className="text-[10px] uppercase tracking-widest text-primary">user</p>
            <p className="mt-1 leading-relaxed">I opened the assistant chat and the timeline is still loading forever.</p>
          </div>
        </div>

        <div className="flex justify-start">
          <div className="max-w-[87%] rounded-xl border border-border bg-white/70 px-3 py-2 text-sm animate-fade-up">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">agent</p>
            <p className="mt-1 leading-relaxed text-muted-foreground">
              I checked app context: iOS 17.4, timeline index drift, and recent sync lag in activity history.
            </p>
          </div>
        </div>

        {(step === "proposal" || step === "approval" || step === "running" || step === "result" || step === "followup") && (
          <div className="flex justify-start">
            <div className="max-w-[87%] rounded-xl border border-border bg-white/70 px-3 py-2 text-sm animate-fade-up">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">agent</p>
              <p className="mt-1 leading-relaxed">
                I can run <span className="font-mono text-[12px]">reindex_activity_timeline</span> on-device and refresh your timeline index.
              </p>
            </div>
          </div>
        )}

        {(step === "approval" || step === "running" || step === "result" || step === "followup") && (
          <div className="rounded-xl border-2 border-[#e3bc78] bg-[#fff7ea] px-3 py-3 text-xs animate-fade-up">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.22em] text-[#8f6020]">Function call approval</p>
              <span className="rounded-full bg-[#f4dfbb] px-2 py-0.5 text-[10px] text-[#8f6020]">
                {step === "approval" ? "Awaiting user" : "Approved"}
              </span>
            </div>
            <p className="mt-1 font-mono text-[12px] text-[#53370f]">reindex_activity_timeline({`{window:"last_14_days"}`})</p>
            <div className="mt-2 flex gap-2">
              <span className="rounded-md bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground">Approve</span>
              <span className="rounded-md border border-[#d7bd93] px-2 py-1 text-[11px] text-[#744f1a]">Deny</span>
            </div>
          </div>
        )}

        {(step === "running" || step === "result" || step === "followup") && (
          <div className="rounded-xl border border-border bg-[#edf3ff] px-3 py-2 text-xs font-mono animate-fade-up">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#2059b6]">tool call</p>
            <p className="mt-1">name: reset_sync_cursor</p>
            <p className="text-muted-foreground">status: {step === "running" ? "running" : "ok"}</p>
          </div>
        )}

        {(step === "result" || step === "followup") && (
          <div className="rounded-xl border border-[#94d8c7] bg-[#ebf9f4] px-3 py-2 text-xs font-mono animate-fade-up">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#1b7a61]">tool result</p>
            <p className="mt-1 text-[#205b4c]">{`{"status":"ok","replayed_jobs":14,"next_sync":"queued"}`}</p>
          </div>
        )}

        {step === "followup" && (
          <div className="flex justify-start">
            <div className="max-w-[87%] rounded-xl border border-border bg-white/70 px-3 py-2 text-sm animate-fade-up">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">agent</p>
              <p className="mt-1 leading-relaxed">Done. Timeline index refresh finished. Is timeline loading in the app now?</p>
            </div>
          </div>
        )}
      </div>

      <div className="relative mt-3 border-t border-border pt-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-lg border border-border bg-white/65 px-3 py-2 text-sm text-muted-foreground">
            Ask about an in-app issue...
          </div>
          <span className="inline-flex rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Send</span>
        </div>
      </div>
    </Card>
  );
}
