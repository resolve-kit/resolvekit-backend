import { Card } from "@/components/ui/card";

const PROOF_CARDS = [
  {
    label: "Operational clarity",
    title: "Every turn is traceable",
    text: "See decisions, retrieved context, approvals, function payloads, and final outcomes per session.",
  },
  {
    label: "Developer speed",
    title: "One dashboard, all app configs",
    text: "Manage prompts, functions, limits, languages, and chat behavior without shipping app updates for each tweak.",
  },
  {
    label: "Safer automation",
    title: "Guardrails before actions",
    text: "Function eligibility can be constrained by platform, app version, and custom session fields.",
  },
  {
    label: "Scale-ready",
    title: "From one app to many",
    text: "Run consistent support behavior across multiple apps and channels from the same control plane.",
  },
];

export function ProofGrid() {
  return (
    <section className="mt-12 grid gap-4 md:grid-cols-2">
      {PROOF_CARDS.map((item, idx) => (
        <Card
          key={item.title}
          className={`p-5 animate-fade-up ${idx % 2 ? "[animation-delay:120ms]" : ""}`}
        >
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{item.label}</p>
          <h3 className="mt-2 text-xl font-semibold">{item.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
        </Card>
      ))}
    </section>
  );
}
