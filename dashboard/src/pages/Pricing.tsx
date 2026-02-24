import { Link } from "react-router-dom";

import { Button } from "../components/ui";

const PLANS = [
  {
    name: "Monthly",
    price: "€20",
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
    price: "€200",
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
    originalPrice: "€240",
    savingsLabel: "Save €40/year (17%)",
  },
];

export default function Pricing() {
  return (
    <div className="min-h-screen bg-canvas text-body">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="font-display font-semibold text-strong tracking-tight">
            Playbook
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/">
              <Button variant="ghost" size="sm">Overview</Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" size="sm">Sign In</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[56rem] h-[56rem] rounded-full bg-accent/15 blur-3xl" />
          <div className="absolute top-44 left-16 w-64 h-64 rounded-full bg-warning/10 blur-3xl" />
        </div>

        <section className="relative max-w-6xl mx-auto px-6 pt-16 pb-10">
          <p className="text-xs uppercase tracking-[0.2em] text-accent mb-4">Pricing</p>
          <h1 className="font-display text-4xl md:text-5xl font-semibold text-strong leading-tight">
            Pricing for LLM App Support
          </h1>
          <p className="mt-4 text-base text-subtle max-w-2xl">
            Build in-app technical support with the same core feature set on monthly or annual billing. VAT is added on top of listed prices.
          </p>
        </section>

        <section className="relative max-w-6xl mx-auto px-6 pb-14">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PLANS.map((plan, idx) => (
              <article
                key={plan.name}
                className={`rounded-2xl border p-6 animate-fade-in-up ${
                  plan.highlighted
                    ? "bg-accent-subtle border-accent-dim shadow-glow-accent"
                    : "bg-surface border-border"
                } ${idx === 1 ? "delay-100" : ""}`}
              >
                <h2 className="text-xl font-semibold text-strong">{plan.name}</h2>
                <p className="text-sm text-subtle mt-1">{plan.description}</p>
                {plan.originalPrice && plan.savingsLabel ? (
                  <div className="mt-4 flex items-center gap-3">
                    <span className="text-sm text-subtle line-through">
                      {plan.originalPrice}
                      <span className="ml-1">/year + VAT</span>
                    </span>
                    <span className="rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                      {plan.savingsLabel}
                    </span>
                  </div>
                ) : null}
                <div className="mt-4 flex items-end gap-1">
                  <span className="text-3xl font-display font-semibold text-strong">{plan.price}</span>
                  <span className="text-sm text-subtle pb-1">{plan.period}</span>
                </div>
                <ul className="mt-5 space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="text-sm text-body flex items-start gap-2">
                      <span className="text-accent mt-0.5">•</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  <Link to="/login" className="block">
                    <Button
                      variant={plan.highlighted ? "primary" : "outline"}
                      className="w-full"
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="relative max-w-6xl mx-auto px-6 pb-20">
          <div className="rounded-2xl border border-border bg-surface p-6 md:p-8">
            <h3 className="text-xl font-semibold text-strong">What Every Plan Includes</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
              <div className="rounded-xl border border-border bg-canvas/40 px-4 py-3 text-sm text-subtle">
                iOS SDK integration with PlaybookRuntime and embedded support chat
              </div>
              <div className="rounded-xl border border-border bg-canvas/40 px-4 py-3 text-sm text-subtle">
                Function registration, tool-call orchestration, and approval workflow
              </div>
              <div className="rounded-xl border border-border bg-canvas/40 px-4 py-3 text-sm text-subtle">
                Dashboard controls for prompts, playbooks, limits, and organization teams
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
