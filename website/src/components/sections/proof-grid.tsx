import { Card } from "@/components/ui/card";

const PROOF_CARDS = [
  {
    label: "Buyer value",
    title: "Lower ticket volume without hiding the work",
    text: "Teams can see which issues were resolved in-product, which actions were taken, and where escalation is still required.",
  },
  {
    label: "Operations",
    title: "Tune behavior without another release cycle",
    text: "Update prompts, functions, limits, and environment-specific rules from one dashboard instead of waiting on app updates.",
  },
  {
    label: "Guardrails",
    title: "Policies can block the wrong action before it runs",
    text: "Function eligibility can be scoped by platform, app version, session fields, and explicit approval requirements.",
  },
  {
    label: "Product awareness",
    title: "The agent understands what the user is actually seeing",
    text: "Ingest guide images and screenshots alongside docs so the assistant can reason about UI layout, steps, and breakpoints with less guesswork.",
  },
];

export function ProofGrid() {
  return (
    <section className="mt-12 grid gap-4 md:grid-cols-2">
      {PROOF_CARDS.map((item, idx) => (
        <Card
          key={item.title}
          className={`animate-fade-up border-[#d6dee6] bg-[#fbfcfd] p-5 shadow-none ${idx % 2 ? "[animation-delay:120ms]" : ""}`}
        >
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#6b7785]">{item.label}</p>
          <h3 className="mt-2 text-xl font-semibold text-[#10273f]">{item.title}</h3>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-[#4b5f72]">{item.text}</p>
        </Card>
      ))}
    </section>
  );
}
