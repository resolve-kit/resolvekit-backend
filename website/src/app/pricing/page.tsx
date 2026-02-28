import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { dashboardLoginUrl, dashboardRegisterUrl, feedbackIssuesUrl } from "@/lib/urls";

const PLAN = {
  name: "Operator Launch",
  price: "EUR 0",
  period: "/for now",
  description:
    "Use the full platform while we iterate with your product team. We keep shipping fast if you keep sharing sharp feedback.",
  features: [
    "1 organization workspace",
    "Infinite collaborators",
    "Unlimited apps with embedded SDK chat",
    "Agent prompt + scope controls",
    "Function approval workflows with trace logs",
    "Knowledge-base driven support answers",
  ],
};

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 pb-20 pt-10 md:pb-24">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="text-sm uppercase tracking-[0.22em] text-muted-foreground">
          Playbook
        </Link>
        <div className="flex flex-wrap gap-3">
          <Link href="/">
            <Button variant="ghost">Overview</Button>
          </Link>
          <a href={dashboardLoginUrl}>
            <Button variant="outline">Sign In</Button>
          </a>
        </div>
      </header>

      <section className="mt-12 grid items-start gap-6 animate-fade-up lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Pricing</p>
          <h1 className="mt-2 text-4xl font-semibold leading-tight md:text-5xl">Pricing for Embedded LLM Agent Support</h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            One plan for now: full product access while we harden reliability and ship fast with partner feedback.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full border border-border bg-white/65 px-3 py-1 text-xs font-semibold text-muted-foreground">
              Full platform unlocked
            </span>
            <span className="rounded-full border border-border bg-white/65 px-3 py-1 text-xs font-semibold text-muted-foreground">
              Priority support loop
            </span>
            <span className="rounded-full border border-border bg-white/65 px-3 py-1 text-xs font-semibold text-muted-foreground">
              No paid tier yet
            </span>
          </div>
        </div>
        <Card className="p-5 md:p-6">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Launch access</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            We are intentionally simple while we scale: one launch plan, fast product iteration, direct operator feedback.
          </p>
          <a href={dashboardRegisterUrl} className="mt-4 block">
            <Button className="w-full">Start Free</Button>
          </a>
        </Card>
      </section>

      <section className="mt-10">
        <Card className="overflow-visible p-0 animate-fade-up">
          <div className="grid gap-0 lg:grid-cols-[1fr_260px]">
            <div className="p-6 md:p-8">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Current plan</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">{PLAN.name}</h2>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">{PLAN.description}</p>
              <ul className="mt-5 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                {PLAN.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 rounded-lg border border-border bg-white/60 px-3 py-2.5">
                    <span className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-[11px] font-bold text-primary">
                      +
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="border-t border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(236,244,255,0.9))] p-6 lg:border-l lg:border-t-0">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Price</p>
              <div className="mt-2 flex items-end gap-1">
                <span className="text-4xl font-semibold">{PLAN.price}</span>
                <span className="pb-1 text-sm text-muted-foreground">{PLAN.period}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">No seat limits, no platform fee during launch period.</p>
              <div className="mt-6 space-y-2">
                <a href={dashboardRegisterUrl}>
                  <Button className="w-full">Start Free</Button>
                </a>
                <a href={feedbackIssuesUrl} target="_blank" rel="noreferrer">
                  <Button variant="outline" className="w-full">
                    Give Feedback
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </Card>
      </section>

      <section className="mt-12">
        <Card className="p-6 md:p-8 animate-fade-up">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Feedback exchange</p>
          <h3 className="mt-2 text-2xl font-semibold">You get the platform, we get precise product signal</h3>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Found a broken flow, missing function guardrail, or confusing UX in your operator journey? Open a GitHub
            issue and we treat it as high-priority product input.
          </p>
          <div className="mt-5">
            <a href={feedbackIssuesUrl} target="_blank" rel="noreferrer">
              <Button variant="outline">Open GitHub issues</Button>
            </a>
          </div>
        </Card>
      </section>
    </main>
  );
}
