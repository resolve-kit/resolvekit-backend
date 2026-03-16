import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { siteUrl } from "@/lib/site";
import { dashboardLoginUrl, dashboardRegisterUrl, feedbackIssuesUrl } from "@/lib/urls";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "See ResolveKit pricing for launch-stage teams using in-product issue resolution to reduce repeat support load with approvals, traceability, and operator control.",
  alternates: {
    canonical: "/pricing",
  },
  openGraph: {
    title: "ResolveKit Pricing",
    description:
      "See ResolveKit pricing for launch-stage teams using in-product issue resolution to reduce repeat support load with approvals, traceability, and operator control.",
    url: `${siteUrl}/pricing`,
  },
  twitter: {
    title: "ResolveKit Pricing",
    description:
      "See ResolveKit pricing for launch-stage teams using in-product issue resolution to reduce repeat support load with approvals, traceability, and operator control.",
  },
};

const PLAN = {
  name: "Launch Partner Access",
  price: "EUR 0",
  period: "/for now",
  description:
    "Full platform access for early teams using ResolveKit to reduce repeat support load inside the product while we tighten the workflow with live operator feedback.",
  features: [
    "1 workspace for product, support, and engineering",
    "Unlimited operator seats",
    "Unlimited embedded app surfaces",
    "Product-aware answers grounded in docs, flows, and screenshots",
    "Approved actions with configurable human approval steps",
    "Trace logs across prompts, tool calls, and session decisions",
    "Prompt, scope, and policy controls per workflow",
  ],
};

const fitPoints = [
  "Teams with repeatable user issues such as login trouble, billing confusion, onboarding blockers, and settings mistakes.",
  "Buyers who want resolution to happen in-product before a ticket hits support.",
  "Operators who need approvals, traceability, and clear control when an agent can take action on a customer account.",
];

const valuePoints = [
  {
    title: "Reduce avoidable support volume",
    description:
      "ResolveKit is for teams trying to cut ticket load from known, explainable issues instead of sending every user into queue-based support.",
  },
  {
    title: "Resolve issues where they happen",
    description:
      "Users get product-aware guidance and approved actions inside the app, at the failing moment, with less back-and-forth and less abandonment.",
  },
  {
    title: "Keep automation commercially safe",
    description:
      "Approvals, trace logs, and operator controls are built into the workflow so teams can automate confidently without losing accountability.",
  },
];

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 pb-20 pt-10 md:pb-24">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex items-end leading-none"
          aria-label="RESOLVEkit"
          style={{ fontFamily: "Inter, 'Mona Sans', 'Avenir Next', 'Segoe UI', sans-serif" }}
        >
          <span className="text-[20px] font-normal uppercase tracking-[0.2em] text-[#0d2f57]">RESOLVE</span>
          <span className="ml-[0.12em] text-[10px] font-normal tracking-[0.2em] text-black">kit</span>
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

      <section className="mt-12 animate-fade-up">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Pricing</p>
          <h1 className="mt-2 text-4xl font-semibold leading-tight md:text-5xl">
            Early pricing for teams using ResolveKit to resolve issues before they become tickets
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            There is one plan right now. It is intentionally simple: full platform access for early teams with real
            support volume, while we keep tightening in-product resolution, approvals, and operator control with live
            customer feedback.
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            This is not a vague beta giveaway. It is launch-stage commercial access for teams willing to put the
            product into real workflows and tell us where the system needs to get sharper.
          </p>
        </div>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
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
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Commercial terms</p>
              <div className="mt-2 flex items-end gap-1">
                <span className="text-4xl font-semibold">{PLAN.price}</span>
                <span className="pb-1 text-sm text-muted-foreground">{PLAN.period}</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                No seat cap and no platform fee during the launch period. In return, we expect real usage, sharp
                feedback, and direct product signal from the team running it.
              </p>
              <div className="mt-5 space-y-2 text-xs leading-relaxed text-muted-foreground">
                <p>Best fit: product-led software teams with enough support volume to care about resolution rate and operator load.</p>
                <p>Not for: teams looking for a generic chat widget with no need for approvals, traces, or workflow control.</p>
              </div>
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

        <Card className="animate-fade-up p-6 shadow-none md:p-7">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Who this offer is for</p>
          <h2 className="mt-2 text-2xl font-semibold leading-tight">Built for early teams solving real support load</h2>
          <div className="mt-5 space-y-4">
            {fitPoints.map((point) => (
              <p key={point} className="border-l border-border pl-4 text-sm leading-relaxed text-muted-foreground">
                {point}
              </p>
            ))}
          </div>
        </Card>
      </section>

      <section className="mt-12">
        <div className="grid gap-6 lg:grid-cols-3">
          {valuePoints.map((point) => (
            <Card key={point.title} className="animate-fade-up p-6 shadow-none md:p-7">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Outcome</p>
              <h3 className="mt-2 text-xl font-semibold leading-tight">{point.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{point.description}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <Card className="p-6 md:p-8 animate-fade-up">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Launch-stage working model</p>
          <h3 className="mt-2 text-2xl font-semibold">You get full access. We expect concrete product feedback.</h3>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            If your team finds a weak guardrail, a missing approval boundary, a traceability gap, or a support flow
            that should resolve in-product but does not, send it directly. That feedback is part of the deal during
            the launch period and feeds the roadmap immediately.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a href={feedbackIssuesUrl} target="_blank" rel="noreferrer">
              <Button variant="outline">Open GitHub issues</Button>
            </a>
            <a href={dashboardRegisterUrl}>
              <Button>Start Free</Button>
            </a>
          </div>
        </Card>
      </section>
    </main>
  );
}
