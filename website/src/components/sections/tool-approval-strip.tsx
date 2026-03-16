import { Card } from "@/components/ui/card";

const APPROVAL_STATES = [
  {
    title: "Define policy",
    detail: "Choose which actions can auto-run, which must wait for consent, and which should stay unavailable by default.",
    stateClass: "border-[#d6dee6] bg-[#f7f9fb]",
  },
  {
    title: "Explain action",
    detail: "The agent states what it wants to do, why it matters, and what the user should expect next.",
    stateClass: "border-[#d8e2ec] bg-[#f3f7fa]",
  },
  {
    title: "Collect approval",
    detail: "Sensitive steps stop inside chat until the user explicitly approves the action.",
    stateClass: "border-[#e4dcc9] bg-[#fbf8f0]",
  },
  {
    title: "Record outcome",
    detail: "Execution results, payloads, and final status are written to the session trace for review.",
    stateClass: "border-[#d7e4de] bg-[#f2f8f4]",
  },
];

export function ToolApprovalStrip() {
  return (
    <section className="mt-12">
      <Card className="animate-fade-up border-[#d6dee6] bg-[#f9fbfc] p-6 shadow-none md:p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-[#6b7785]">Control and guardrails</p>
        <h3 className="mt-2 max-w-3xl text-2xl font-semibold leading-tight text-[#10273f]">
          Approved automation for fixes that should move fast, with friction only where risk justifies it
        </h3>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#4b5f72]">
          ResolveKit lets you automate the safe path, require consent on the sensitive path, and keep an auditable
          record of both.
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {APPROVAL_STATES.map((item, idx) => (
            <div key={item.title} className={`border px-4 py-4 ${item.stateClass}`}>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#6b7785]">Step {idx + 1}</p>
              <p className="mt-1 text-base font-semibold text-[#10273f]">{item.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-[#4b5f72]">{item.detail}</p>
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}
