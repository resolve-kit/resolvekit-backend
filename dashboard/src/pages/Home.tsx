import { Link } from "react-router-dom";

import { Button } from "../components/ui";

const VALUE_POINTS = [
  {
    title: "Multi-App Control Plane",
    description:
      "Configure LLM behavior, limits, tools, API keys, and auditing across every app in one backend.",
  },
  {
    title: "Team Organization Workflows",
    description:
      "Use organizations, invitations, and role-based access so product teams can work on the same apps safely.",
  },
  {
    title: "Production Session Infrastructure",
    description:
      "Run managed chat sessions, WebSocket tickets, and observability with policy controls for enterprise deployments.",
  },
];

const PLATFORM_STEPS = [
  "Create your organization and app workspace",
  "Connect your model/provider and set governance limits",
  "Register callable functions and playbooks",
  "Ship SDK-connected experiences with audit visibility",
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
                iOS App Agent Platform
              </p>
              <h1 className="font-display text-4xl md:text-6xl font-semibold text-strong leading-[1.05]">
                Backend Platform for Production AI App Teams
              </h1>
              <p className="mt-5 text-base md:text-lg text-subtle max-w-2xl">
                Playbook is the control layer for shipping AI-powered mobile apps: configure model behavior,
                register tools, enforce limits, and collaborate across teams under one secure organization.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/login">
                  <Button size="md">Start Building</Button>
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
            <p className="text-xs uppercase tracking-[0.2em] text-accent mb-4">How It Works</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {PLATFORM_STEPS.map((step, idx) => (
                <div key={step} className="rounded-xl bg-canvas/50 border border-border px-4 py-3">
                  <p className="text-xs text-dim">Step {idx + 1}</p>
                  <p className="text-sm text-body mt-1">{step}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-6 border-t border-border flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-subtle">Need pricing for your team size and volume profile?</p>
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
