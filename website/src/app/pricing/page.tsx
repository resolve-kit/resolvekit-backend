import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { dashboardLoginUrl } from "@/lib/urls";

const PLANS = [
  {
    name: "Monthly",
    price: "EUR 20",
    period: "/month + VAT",
    description: "Flexible billing for app teams launching AI support quickly.",
    features: [
      "1 organization",
      "Up to 20 team members",
      "Unlimited apps and support assistants",
      "Docs/FAQ-guided responses via prompts and playbooks",
      "Tool approvals, session logs, and audit visibility",
    ],
    cta: "Choose Monthly",
    highlighted: false,
    originalPrice: null,
    savingsLabel: null,
  },
  {
    name: "Yearly",
    price: "EUR 200",
    period: "/year + VAT",
    description: "Best value for long-term, production support operations.",
    features: [
      "Up to 20 team members",
      "Unlimited apps and support assistants",
      "Docs/FAQ-guided responses via prompts and playbooks",
      "Tool approvals, session logs, and audit visibility",
      "Annual billing at discounted effective monthly rate",
    ],
    cta: "Choose Yearly",
    highlighted: true,
    originalPrice: "EUR 240",
    savingsLabel: "Save EUR 40/year (17%)",
  },
];

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 pb-20 pt-12">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
          Playbook
        </Link>
        <div className="flex gap-3">
          <Link href="/">
            <Button variant="ghost">Overview</Button>
          </Link>
          <a href={dashboardLoginUrl}>
            <Button variant="outline">Sign In</Button>
          </a>
        </div>
      </header>

      <section className="mt-16">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Pricing</p>
        <h1 className="text-4xl font-semibold">Pricing for LLM App Support</h1>
        <p className="mt-3 text-muted-foreground">
          Build in-app technical support with the same core feature set on monthly or annual billing.
          VAT is added on top of listed prices.
        </p>
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-2">
        {PLANS.map((plan, idx) => (
          <Card
            key={plan.name}
            className={`p-6 ${plan.highlighted ? "border-primary/50 bg-primary/5" : ""} ${idx === 1 ? "animate-fade-up [animation-delay:120ms]" : "animate-fade-up"}`}
          >
            <h2 className="text-xl font-semibold">{plan.name}</h2>
            <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
            {plan.originalPrice && plan.savingsLabel ? (
              <div className="mt-4 flex items-center gap-3">
                <span className="text-sm text-muted-foreground line-through">
                  {plan.originalPrice}
                  <span className="ml-1">/year + VAT</span>
                </span>
                <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-700">
                  {plan.savingsLabel}
                </span>
              </div>
            ) : null}
            <div className="mt-4 flex items-end gap-1">
              <span className="text-3xl font-semibold">{plan.price}</span>
              <span className="text-sm text-muted-foreground pb-1">{plan.period}</span>
            </div>
            <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
              {plan.features.map((feature) => (
                <li key={feature}>• {feature}</li>
              ))}
            </ul>
            <div className="mt-6">
              <a href={dashboardLoginUrl} className="block">
                <Button variant={plan.highlighted ? "primary" : "outline"} className="w-full">
                  {plan.cta}
                </Button>
              </a>
            </div>
          </Card>
        ))}
      </section>

      <section className="mt-12">
        <Card className="p-6 md:p-8">
          <h3 className="text-xl font-semibold">What Every Plan Includes</h3>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-background/70 px-4 py-3 text-sm text-muted-foreground">
              iOS SDK integration with PlaybookRuntime and embedded support chat
            </div>
            <div className="rounded-xl border border-border bg-background/70 px-4 py-3 text-sm text-muted-foreground">
              Function registration, tool-call orchestration, and approval workflow
            </div>
            <div className="rounded-xl border border-border bg-background/70 px-4 py-3 text-sm text-muted-foreground">
              Dashboard controls for prompts, playbooks, limits, and organization teams
            </div>
          </div>
        </Card>
      </section>
    </main>
  );
}
