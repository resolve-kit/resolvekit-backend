import type { Metadata } from "next";
import Link from "next/link";

import { HeroChatPreview } from "@/components/hero-chat-preview";
import { MissionRail } from "@/components/sections/mission-rail";
import { ProofGrid } from "@/components/sections/proof-grid";
import { SdkFlow } from "@/components/sections/sdk-flow";
import { ToolApprovalStrip } from "@/components/sections/tool-approval-strip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { siteName, siteUrl } from "@/lib/site";
import { dashboardLoginUrl, dashboardRegisterUrl, feedbackIssuesUrl, iosSdkRepoUrl, nextjsSdkNpmUrl } from "@/lib/urls";

const homeTitle = "Resolve Product Issues Before They Hit Support";
const homeDescription =
  "ResolveKit embeds a product-aware support agent in your app so users can fix common blockers in the moment, with approvals, audit trails, and centralized operator control.";

export const metadata: Metadata = {
  title: homeTitle,
  description: homeDescription,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    title: homeTitle,
    description: homeDescription,
    url: siteUrl,
  },
  twitter: {
    card: "summary",
    title: homeTitle,
    description: homeDescription,
  },
};

const supportScenarios = [
  {
    title: "Account access and verification",
    description:
      "Explain sign-in failures, identify missing verification steps, resend approved recovery flows, or route the case with full context when identity checks are required.",
  },
  {
    title: "Billing, plan, and entitlement confusion",
    description:
      "Answer plan questions in the moment, clarify why a feature is unavailable, and trigger approved sync or refresh actions when access should already be active.",
  },
  {
    title: "Onboarding and workflow blockers",
    description:
      "Spot where a user is stuck, reference the exact screen or step, and guide them forward with product-aware instructions instead of a generic help article.",
  },
];

const controlPoints = [
  "Choose which actions can run automatically, which require approval, and which should always stop for a human.",
  "Review session traces with prompts, tool calls, and decision points tied to the app version and policy in effect.",
  "Keep support, product, and engineering aligned on what the agent can explain, change, and escalate.",
];

const operatorVisibilityPoints = [
  {
    title: "What the user was doing when they got stuck",
    description:
      "Session context can include app version, platform, screen or route, recent steps, and the policy version governing the reply.",
  },
  {
    title: "What the agent explained, proposed, and ran",
    description:
      "Operators can review the prompt path, allowed function calls, approval checkpoints, and final result instead of trusting a black-box answer.",
  },
  {
    title: "Which cases resolved in-product vs. escalated",
    description:
      "Resolved sessions stay attached to the action trace. Escalated sessions carry the captured context forward so humans do not restart discovery from zero.",
  },
];

const workflowComparison = [
  {
    label: "Before",
    title: "Generic widget or help center deflection",
    points: [
      "The user describes a symptom without product context, so support starts by reconstructing the situation.",
      "Answers lean on static docs and generic troubleshooting instead of the exact state of the account or workflow.",
      "If a fix requires action, the case usually becomes a ticket and waits for manual triage.",
    ],
  },
  {
    label: "After",
    title: "ResolveKit inside the failing moment",
    points: [
      "The assistant sees the live product context around the blocker and can explain the likely issue in plain language.",
      "Approved actions can run in-product, while sensitive steps stop for consent or handoff according to policy.",
      "Support and product teams inherit a trace of what was seen, suggested, approved, executed, and still unresolved.",
    ],
  },
];

const teamGets = [
  {
    title: "An in-product resolution surface",
    description:
      "Users can understand the issue and move forward without leaving the workflow that is already failing.",
  },
  {
    title: "An operator-visible command trail",
    description:
      "Every meaningful step can be reviewed later, including context, policy gates, tool calls, and outcomes.",
  },
  {
    title: "A safer automation boundary",
    description:
      "Your team decides what can auto-run, what requires approval, and what always routes to a human.",
  },
];

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: siteName,
  url: siteUrl,
  sameAs: [iosSdkRepoUrl, nextjsSdkNpmUrl, feedbackIssuesUrl],
};

const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: siteName,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: siteUrl,
  description: homeDescription,
  publisher: {
    "@type": "Organization",
    name: siteName,
    url: siteUrl,
  },
  offers: {
    "@type": "Offer",
    url: `${siteUrl}/pricing`,
    price: "0",
    priceCurrency: "EUR",
    availability: "https://schema.org/InStock",
  },
};

export default function HomePage() {
  const structuredData = [organizationSchema, softwareApplicationSchema];

  return (
    <main className="mx-auto max-w-6xl px-6 pb-20 pt-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex items-end leading-none"
          aria-label="RESOLVEkit"
          style={{ fontFamily: "'Avenir Next', 'Segoe UI', 'Helvetica Neue', sans-serif" }}
        >
          <span className="text-[20px] font-medium uppercase tracking-[0.18em] text-[#12385f]">RESOLVE</span>
          <span className="ml-[0.16em] text-[10px] font-medium tracking-[0.24em] text-[#3d4d5d]">kit</span>
        </Link>
        <div className="flex flex-wrap gap-3">
          <Link href="/pricing">
            <Button variant="ghost">Pricing</Button>
          </Link>
          <a href={dashboardLoginUrl}>
            <Button variant="outline">Dashboard Sign In</Button>
          </a>
        </div>
      </header>

      <section className="mt-12 grid items-start gap-10 lg:grid-cols-[minmax(0,1.08fr)_minmax(320px,430px)]">
        <div className="max-w-3xl animate-fade-up">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#6b7785]">
            In-product issue resolution for software teams
          </p>
          <h1 className="mt-4 text-5xl font-semibold leading-[0.98] tracking-[-0.04em] text-[#10273f] sm:text-6xl">
            Resolve user issues inside the product before they become support tickets.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#4b5f72]">
            ResolveKit embeds a product-aware support agent in your app so users can fix common blockers in the moment.
            Ground the assistant in your docs, product flows, screenshots, and approved tools, then let it explain
            what is wrong, guide the user through the right next step, or take an allowed action without sending the
            case straight into support triage.
          </p>
          <div className="mt-6 grid max-w-2xl gap-3 border-l border-[#d3dce5] pl-4 text-sm leading-relaxed text-[#516475] sm:grid-cols-3 sm:gap-6 sm:pl-5">
            <p>Resolve known issues at the point of failure, like access confusion, stuck onboarding, and settings mistakes.</p>
            <p>Give product, CX, and engineering one place to manage prompts, tools, policies, and escalation boundaries.</p>
            <p>Ship automation with approvals, session traces, and version-aware controls already built in.</p>
          </div>
          <p className="mt-4 text-sm text-[#6b7785]">Free for now. We want feedback from teams solving real support load.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={dashboardRegisterUrl}>
              <Button>Start Free</Button>
            </a>
            <Link href="/pricing">
              <Button variant="outline">See plan details</Button>
            </Link>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[#5d6f80]">
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-[#7b8895]">SDKs and resources</span>
            <a href={iosSdkRepoUrl} target="_blank" rel="noreferrer" className="transition-colors hover:text-[#10273f]">
              iOS SDK GitHub
            </a>
            <a href={nextjsSdkNpmUrl} target="_blank" rel="noreferrer" className="transition-colors hover:text-[#10273f]">
              Next.js SDK npm
            </a>
            <a href={feedbackIssuesUrl} target="_blank" rel="noreferrer" className="transition-colors hover:text-[#10273f]">
              Share feedback
            </a>
          </div>
          <div className="mt-8 grid gap-3 rounded-3xl border border-[#d6dee6] bg-[#f7f9fb] p-4 text-sm text-[#4b5f72] sm:grid-cols-[auto_1fr] sm:items-start sm:gap-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6b7785]">Best for</p>
            <p className="leading-relaxed">
              Product, support, and engineering teams shipping apps with repeatable issues such as login and
              verification trouble, billing or entitlement confusion, onboarding drop-off, settings mistakes, and
              workflow blockers that can often be explained or resolved without opening a ticket.
            </p>
          </div>
        </div>
        <HeroChatPreview />
      </section>

      <MissionRail />

      <section className="mt-16 grid gap-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-start">
        <div className="max-w-xl">
          <p className="text-xs uppercase tracking-[0.2em] text-[#6b7785]">What operators can verify</p>
          <h2 className="mt-2 text-3xl font-semibold leading-tight text-[#10273f]">
            Proof that the agent handled a product issue, not just a chat conversation
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-[#4b5f72]">
            ResolveKit is more credible than a generic support widget because the work stays inspectable. The team can
            see what the user encountered, what the assistant believed was happening, what action path was opened, and
            whether the issue actually resolved inside the app.
          </p>
          <div className="mt-6 grid gap-3">
            {operatorVisibilityPoints.map((item) => (
              <div key={item.title} className="border-l border-[#d3dce5] pl-4">
                <p className="text-sm font-semibold text-[#10273f]">{item.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-[#4b5f72]">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
        <Card className="animate-fade-up border-[#d6dee6] bg-[#fbfcfd] p-6 shadow-none md:p-7">
          <p className="text-xs uppercase tracking-[0.2em] text-[#6b7785]">Operator view</p>
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-[#d6dee6] bg-white px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[#10273f]">Session: onboarding paywall mismatch</p>
                <span className="rounded-full bg-[#ebf9f4] px-2 py-1 text-[11px] font-semibold text-[#1b7a61]">
                  Resolved in product
                </span>
              </div>
              <div className="mt-3 grid gap-3 text-sm text-[#4b5f72] sm:grid-cols-2">
                <p>
                  <span className="font-semibold text-[#10273f]">Seen by agent:</span> iOS 18.2, paywall route,
                  active subscription, stale entitlement cache, version 1.14.3
                </p>
                <p>
                  <span className="font-semibold text-[#10273f]">Trace:</span> explained entitlement mismatch,
                  proposed refresh, approval not required, sync action executed, success recorded
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-[#d6dee6] bg-[#f7f9fb] px-4 py-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#6b7785]">Context captured</p>
                <p className="mt-2 text-sm leading-relaxed text-[#4b5f72]">
                  Route, app version, platform, policy version, and recent user state
                </p>
              </div>
              <div className="rounded-2xl border border-[#d6dee6] bg-[#f7f9fb] px-4 py-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#6b7785]">Action path</p>
                <p className="mt-2 text-sm leading-relaxed text-[#4b5f72]">
                  Explain, propose tool, request consent if needed, execute, log outcome
                </p>
              </div>
              <div className="rounded-2xl border border-[#d6dee6] bg-[#f7f9fb] px-4 py-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#6b7785]">Escalation payload</p>
                <p className="mt-2 text-sm leading-relaxed text-[#4b5f72]">
                  If unresolved, support receives the trace instead of restarting intake
                </p>
              </div>
            </div>
          </div>
        </Card>
      </section>

      <section className="mt-16 grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
        <div className="max-w-xl">
          <p className="text-xs uppercase tracking-[0.2em] text-[#6b7785]">Why teams buy</p>
          <h2 className="mt-2 text-3xl font-semibold leading-tight text-[#10273f]">
            A clearer path from user issue to resolved outcome
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-[#4b5f72]">
            The value is not just an embedded chat surface. It is a product-aware agent that understands the failing
            moment, proposes the right fix, applies guardrails before action, and leaves an operator-visible trace your
            team can trust.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-[#4b5f72]">
            Buyers evaluating ResolveKit usually want to know two things: whether it can solve real support scenarios
            in-product, and whether their team stays in control when automation touches customer accounts. That is the
            bar this workflow is built around.
          </p>
          <div className="mt-6 grid gap-3">
            {supportScenarios.map((scenario) => (
              <div key={scenario.title} className="rounded-2xl border border-[#d6dee6] bg-[#f7f9fb] px-4 py-3">
                <p className="text-sm font-semibold text-[#10273f]">{scenario.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-[#4b5f72]">{scenario.description}</p>
              </div>
            ))}
          </div>
        </div>
        <ProofGrid />
      </section>

      <section className="mt-16">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.2em] text-[#6b7785]">Support workflow shift</p>
          <h2 className="mt-2 text-3xl font-semibold leading-tight text-[#10273f]">
            From generic deflection to product-aware resolution
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-[#4b5f72]">
            Buyers do not need another chat box attached to documentation. They need a support layer that can identify
            the failing moment, resolve the repeatable path inside the product, and leave behind evidence their team
            can operate against.
          </p>
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {workflowComparison.map((column, idx) => (
            <Card
              key={column.label}
              className={`border-[#d6dee6] p-6 shadow-none ${idx === 0 ? "bg-[#fbfcfd]" : "bg-[#f4f8fc]"}`}
            >
              <p className="text-xs uppercase tracking-[0.2em] text-[#6b7785]">{column.label}</p>
              <h3 className="mt-2 text-2xl font-semibold text-[#10273f]">{column.title}</h3>
              <div className="mt-4 space-y-3">
                {column.points.map((point) => (
                  <p key={point} className="border-l border-[#d3dce5] pl-4 text-sm leading-relaxed text-[#4b5f72]">
                    {point}
                  </p>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-16 grid gap-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-start">
        <div className="max-w-xl">
          <p className="text-xs uppercase tracking-[0.2em] text-[#6b7785]">How it works in practice</p>
          <h2 className="mt-2 text-3xl font-semibold leading-tight text-[#10273f]">
            Automate the obvious path, pause on the sensitive one
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-[#4b5f72]">
            ResolveKit is designed for operationally real support flows. The assistant can explain what it sees,
            request approval where risk matters, execute approved actions, and keep a full record of what happened.
          </p>
          <div className="mt-6 space-y-3">
            {controlPoints.map((point) => (
              <p
                key={point}
                className="border-l border-[#d3dce5] pl-4 text-sm leading-relaxed text-[#4b5f72]"
              >
                {point}
              </p>
            ))}
          </div>
        </div>
        <ToolApprovalStrip />
      </section>

      <section className="mt-16">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.2em] text-[#6b7785]">What your team gets</p>
          <h2 className="mt-2 text-3xl font-semibold leading-tight text-[#10273f]">
            A buyer-facing package that is operationally concrete
          </h2>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {teamGets.map((item, idx) => (
            <div
              key={item.title}
              className={`rounded-2xl border border-[#d6dee6] bg-[#fbfcfd] px-5 py-5 ${idx === 1 ? "bg-[#f7f9fb]" : ""}`}
            >
              <p className="text-base font-semibold text-[#10273f]">{item.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-[#4b5f72]">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.2em] text-[#6b7785]">Getting live</p>
          <h2 className="mt-2 text-3xl font-semibold leading-tight text-[#10273f]">
            Start with the app surface you already own
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-[#4b5f72]">
            Keep the destination for SDK buyers, but place it after the value case. Teams evaluating ResolveKit can
            see how the agent behaves first, then review the iOS and Next.js integration path when they are ready to
            implement.
          </p>
        </div>
      </section>
      <SdkFlow />

      <section className="mt-12">
        <Card className="animate-fade-up border-[#d6dee6] bg-[#f7f9fb] p-6 shadow-none md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-xs uppercase tracking-[0.2em] text-[#6b7785]">Operator command</p>
              <h2 className="mt-2 text-2xl font-semibold text-[#10273f]">
                Control prompts, functions, limits, and session traces from one dashboard
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[#4b5f72]">
                Keep the assistant commercially useful and operationally safe across every app surface. Define what it
                can explain, which tools it may call, when approval is required, and what trace data operators can
                review afterward across platform, app version, and live session context.
              </p>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-[#5d6f80]">
                <a href={iosSdkRepoUrl} target="_blank" rel="noreferrer" className="transition-colors hover:text-[#10273f]">
                  iOS SDK
                </a>
                <a href={nextjsSdkNpmUrl} target="_blank" rel="noreferrer" className="transition-colors hover:text-[#10273f]">
                  Next.js SDK
                </a>
                <a href={feedbackIssuesUrl} target="_blank" rel="noreferrer" className="transition-colors hover:text-[#10273f]">
                  Feedback
                </a>
              </div>
            </div>
            <div className="flex gap-3">
              <a href={dashboardLoginUrl}>
                <Button>Open Dashboard</Button>
              </a>
              <Link href="/pricing">
                <Button variant="outline">Pricing</Button>
              </Link>
            </div>
          </div>
        </Card>
      </section>
    </main>
  );
}
