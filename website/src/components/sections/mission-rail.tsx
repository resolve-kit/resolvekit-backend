import { Card } from "@/components/ui/card";

const VALUE_POINTS = [
  {
    title: "Product-aware by default",
    description:
      "Agents are grounded in app behavior, docs, troubleshooting paths, and visual references so they understand UI layout from guide images and screenshots.",
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
          <h2 className="text-lg font-semibold leading-tight">{item.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
        </Card>
      ))}
    </section>
  );
}
