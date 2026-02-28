import { Card } from "@/components/ui/card";

const APPROVAL_STATES = [
  {
    title: "Propose",
    detail: "Agent explains why a function call can resolve the issue.",
    stateClass: "border-[#9dbcf6] bg-[#edf3ff]",
  },
  {
    title: "Approve",
    detail: "User explicitly allows or denies execution from inside chat.",
    stateClass: "border-[#e7bf75] bg-[#fff7ea]",
  },
  {
    title: "Resolve",
    detail: "SDK action runs, result is returned, and audit trace is captured.",
    stateClass: "border-[#95d9c8] bg-[#ebf9f4]",
  },
];

export function ToolApprovalStrip() {
  return (
    <section className="mt-12">
      <Card className="p-6 md:p-8 animate-fade-up">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Trust and Control</p>
        <h3 className="mt-2 text-2xl font-semibold leading-tight">Function execution is always user-visible and approval-gated</h3>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
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
