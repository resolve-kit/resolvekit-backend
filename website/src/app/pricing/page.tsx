import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { dashboardLoginUrl, feedbackIssuesUrl } from "@/lib/urls";

const FREE_FOR_NOW_LABEL = "Free (for now)";
const FEEDBACK_LABEL = "Pay us in feedback";

const PLANS = [
  {
    name: FREE_FOR_NOW_LABEL,
    price: "EUR 0",
    period: "/for now",
    description: "Use the full assistant platform while we polish the rough edges with your feedback.",
    features: [
      "1 organization",
      "Up to 20 team members",
      "Unlimited apps and support assistants",
      "Docs/FAQ-guided responses via prompts and playbooks",
      "Tool approvals, session logs, and audit visibility",
      "Direct product influence through feedback issues",
    ],
    cta: "Start Free",
    highlighted: true,
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
          <span className="font-medium text-foreground">{FREE_FOR_NOW_LABEL}</span> and {FEEDBACK_LABEL}. You get the
          platform, we get blunt GitHub issues, and everybody wins.
        </p>
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-1">
        {PLANS.map((plan) => (
          <Card
            key={plan.name}
            className={`p-6 ${plan.highlighted ? "border-primary/50 bg-primary/5" : ""} animate-fade-up`}
          >
            <h2 className="text-xl font-semibold">{plan.name}</h2>
            <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
            <div className="mt-4 flex items-end gap-1">
              <span className="text-3xl font-semibold">{plan.price}</span>
              <span className="text-sm text-muted-foreground pb-1">{plan.period}</span>
            </div>
            <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
              {plan.features.map((feature) => (
                <li key={feature}>• {feature}</li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href={dashboardLoginUrl}>
                <Button variant="primary">{plan.cta}</Button>
              </a>
              <a href={feedbackIssuesUrl} target="_blank" rel="noreferrer">
                <Button variant="outline">Give Feedback</Button>
              </a>
            </div>
          </Card>
        ))}
      </section>

      <section className="mt-12">
        <Card className="p-6 md:p-8">
          <h3 className="text-xl font-semibold">How To Pay Us Back</h3>
          <p className="mt-3 text-sm text-muted-foreground">
            Found a bug? Missing something? Weird edge case? Open a GitHub issue and we will treat it like rent.
          </p>
          <div className="mt-4">
            <a href={feedbackIssuesUrl} target="_blank" rel="noreferrer">
              <Button variant="outline">Open a GitHub Issue</Button>
            </a>
          </div>
        </Card>
      </section>
    </main>
  );
}
