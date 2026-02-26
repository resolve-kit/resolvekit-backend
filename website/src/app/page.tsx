import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { dashboardLoginUrl } from "@/lib/urls";

const VALUE_POINTS = [
  {
    title: "Product-Native Assistant",
    description:
      "Deliver an assistant that sounds like your product team and understands your app, not a generic chatbot.",
  },
  {
    title: "Scoped + Controlled Responses",
    description:
      "Set open or strict scope, define guardrails, and keep answers focused on your product experience.",
  },
  {
    title: "Context-Enriched Every Turn",
    description:
      "Combine docs, workflows, tools, platform details, and custom session data so each answer is truly relevant.",
  },
];

const CONFIG_PILLARS = [
  {
    title: "Product Context Prompt",
    description:
      "Define your product, capabilities, and assistant behavior so responses match your brand and support standards.",
  },
  {
    title: "Scope Mode",
    description:
      "Choose `open` for broad help or `strict` to reject requests that are outside your product domain.",
  },
  {
    title: "Knowledge Bases",
    description:
      "Connect docs, FAQs, and troubleshooting content so answers stay grounded in approved sources.",
  },
  {
    title: "Playbooks",
    description:
      "Build repeatable resolution flows with clear tool steps to drive consistent, high-quality support.",
  },
  {
    title: "Functions + Eligibility",
    description:
      "Expose actions and gate them by platform, app version, entitlements, and capabilities.",
  },
  {
    title: "Session LLM Context",
    description:
      "Pass per-session fields like location, network quality, account state, or plan tier for tailored responses.",
  },
];

const PLATFORM_STEPS = [
  "Identify intent and scope before generating a response",
  "Load the most relevant docs and support workflows for that request",
  "Blend product context, user platform, and session signals into one answer",
  "Execute eligible tools when needed and keep a full trace of decisions",
];

export default function HomePage() {
  return (
    <main className="mx-auto max-w-6xl px-6 pb-20 pt-12">
      <header className="flex items-center justify-between">
        <p className="text-sm tracking-[0.2em] uppercase text-muted-foreground">Playbook</p>
        <div className="flex gap-3">
          <Link href="/pricing">
            <Button variant="ghost">Pricing</Button>
          </Link>
          <a href={dashboardLoginUrl}>
            <Button variant="outline">Sign In</Button>
          </a>
        </div>
      </header>

      <section className="mt-16 max-w-3xl animate-fade-up">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Configurable Assistant Platform
        </p>
        <h1 className="text-5xl font-semibold leading-[1.04]">
          Configure the Assistant Your App Actually Needs
        </h1>
        <p className="mt-5 text-lg text-muted-foreground">
          Playbook gives teams full control over how their assistant behaves: what it can answer, which tools it can use,
          what context it sees, and how it adapts by platform and user session.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href={dashboardLoginUrl}>
            <Button>Configure Your Assistant</Button>
          </a>
          <Link href="/pricing">
            <Button variant="outline">View Pricing</Button>
          </Link>
        </div>
      </section>

      <section className="mt-12 grid gap-4 md:grid-cols-3">
        {VALUE_POINTS.map((item, idx) => (
          <Card
            key={item.title}
            className={`p-5 animate-fade-up ${idx === 1 ? "[animation-delay:120ms]" : idx === 2 ? "[animation-delay:240ms]" : ""}`}
          >
            <h2 className="text-lg font-semibold">{item.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{item.description}</p>
          </Card>
        ))}
      </section>

      <section className="mt-12">
        <Card className="p-6 md:p-8 animate-fade-up">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">What You Can Configure</p>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {CONFIG_PILLARS.map((pillar) => (
              <div key={pillar.title} className="rounded-xl border border-border bg-background/70 px-4 py-3">
                <p className="text-sm font-semibold">{pillar.title}</p>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{pillar.description}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="mt-12">
        <Card className="p-6 md:p-8 animate-fade-up">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">How It Works Per Turn</p>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {PLATFORM_STEPS.map((step, idx) => (
              <div key={step} className="rounded-xl border border-border bg-background/70 px-4 py-3">
                <p className="text-xs text-muted-foreground">Step {idx + 1}</p>
                <p className="mt-1 text-sm">{step}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 border-t border-border pt-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Launch in one app and scale consistent assistant behavior across mobile, web, dashboard, and TV experiences.
            </p>
            <Link href="/pricing">
              <Button variant="outline">Go To Pricing</Button>
            </Link>
          </div>
        </Card>
      </section>
    </main>
  );
}
