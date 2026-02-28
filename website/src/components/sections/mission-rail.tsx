import { Card } from "@/components/ui/card";

const VALUE_POINTS = [
  {
    title: "Product-aware by default",
    description:
      "Agents are grounded in app behavior, docs, troubleshooting paths, and language rules before every response.",
  },
  {
    title: "SDK-embedded assistance",
    description:
      "Developers ship chat inside mobile/web surfaces with one SDK and one backend control plane.",
  },
  {
    title: "Tool execution with consent",
    description:
      "Agent proposes on-device actions, asks for approval, and records the full execution trace.",
  },
];

export function MissionRail() {
  return (
    <section className="mt-12 grid gap-4 md:grid-cols-3">
      {VALUE_POINTS.map((item, idx) => (
        <Card
          key={item.title}
          className={`p-5 animate-fade-up ${idx === 1 ? "[animation-delay:90ms]" : idx === 2 ? "[animation-delay:180ms]" : ""}`}
        >
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Mission {idx + 1}</p>
          <h2 className="mt-2 text-lg font-semibold leading-tight">{item.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
        </Card>
      ))}
    </section>
  );
}
