import { Link } from "react-router-dom";

import { Button } from "../components/ui";

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

export default function Home() {
  return (
    <div className="min-h-screen bg-canvas text-body">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="font-display font-semibold text-strong tracking-tight">
            Playbook
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/pricing">
              <Button variant="ghost" size="sm">Pricing</Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" size="sm">Sign In</Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-28 left-1/2 -translate-x-1/2 w-[52rem] h-[52rem] rounded-full bg-accent/15 blur-3xl" />
            <div className="absolute top-32 right-10 w-72 h-72 rounded-full bg-success/10 blur-3xl" />
          </div>

          <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-16">
            <div className="max-w-3xl animate-fade-in-up">
              <p className="text-xs uppercase tracking-[0.2em] text-accent mb-4">
                Configurable Assistant Platform
              </p>
              <h1 className="font-display text-4xl md:text-6xl font-semibold text-strong leading-[1.05]">
                Configure the Assistant Your App Actually Needs
              </h1>
              <p className="mt-5 text-base md:text-lg text-subtle max-w-2xl">
                Playbook gives teams full control over how their assistant behaves: what it can answer, which tools it can use,
                what context it sees, and how it adapts by platform and user session.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/login">
                  <Button size="md">Configure Your Assistant</Button>
                </Link>
                <Link to="/pricing">
                  <Button variant="outline" size="md">View Pricing</Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 pb-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {VALUE_POINTS.map((item, idx) => (
              <article
                key={item.title}
                className={`rounded-2xl border border-border bg-surface p-5 animate-fade-in-up ${idx === 1 ? "delay-100" : idx === 2 ? "delay-200" : ""}`}
              >
                <h2 className="text-lg font-semibold text-strong">{item.title}</h2>
                <p className="mt-2 text-sm text-subtle leading-relaxed">{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 pb-20">
          <div className="rounded-2xl border border-border bg-surface p-6 md:p-8 animate-fade-in-up">
            <p className="text-xs uppercase tracking-[0.2em] text-accent mb-4">What You Can Configure</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {CONFIG_PILLARS.map((pillar) => (
                <div key={pillar.title} className="rounded-xl bg-canvas/50 border border-border px-4 py-3">
                  <p className="text-sm font-semibold text-strong">{pillar.title}</p>
                  <p className="text-sm text-subtle mt-1 leading-relaxed">{pillar.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 pb-20">
          <div className="rounded-2xl border border-border bg-surface p-6 md:p-8 animate-fade-in-up">
            <p className="text-xs uppercase tracking-[0.2em] text-accent mb-4">How It Works Per Turn</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {PLATFORM_STEPS.map((step, idx) => (
                <div key={step} className="rounded-xl bg-canvas/50 border border-border px-4 py-3">
                  <p className="text-xs text-dim">Step {idx + 1}</p>
                  <p className="text-sm text-body mt-1">{step}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-6 border-t border-border flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-subtle">Launch in one app and scale consistent assistant behavior across mobile, web, dashboard, and TV experiences.</p>
              <Link to="/pricing">
                <Button variant="outline" size="sm">Go To Pricing</Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
