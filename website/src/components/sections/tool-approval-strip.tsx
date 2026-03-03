import { Card } from "@/components/ui/card";

const APPROVAL_STATES = [
  {
    title: "Set policy",
    detail: "Developers mark each function as approval-required or auto-run for safe read-only/info fetch actions.",
    stateClass: "border-[#b6b6e5] bg-[#f1f0ff]",
  },
  {
    title: "Propose",
    detail: "Agent explains why a function call can resolve the issue.",
    stateClass: "border-[#9dbcf6] bg-[#edf3ff]",
  },
  {
    title: "Approve",
    detail: "Sensitive actions pause for explicit user approval directly inside chat.",
    stateClass: "border-[#e7bf75] bg-[#fff7ea]",
  },
  {
    title: "Resolve",
    detail: "Approved or auto-run actions execute, then results and trace data are recorded.",
    stateClass: "border-[#95d9c8] bg-[#ebf9f4]",
  },
];

export function ToolApprovalStrip() {
  return (
    <section className="mt-12">
      <Card className="p-6 md:p-8 animate-fade-up">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Trust and Control</p>
        <h3 className="mt-2 text-2xl font-semibold leading-tight">Per-function approval policy with full execution visibility</h3>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Keep approvals where risk exists and skip unnecessary prompts for low-risk info retrieval functions.
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {APPROVAL_STATES.map((item, idx) => (
            <div key={item.title} className={`rounded-xl border px-4 py-4 ${item.stateClass}`}>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Phase {idx + 1}</p>
              <p className="mt-1 text-base font-semibold">{item.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.detail}</p>
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}
