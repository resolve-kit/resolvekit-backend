import Link from "next/link";

import { HeroChatPreview } from "@/components/hero-chat-preview";
import { MissionRail } from "@/components/sections/mission-rail";
import { ProofGrid } from "@/components/sections/proof-grid";
import { SdkFlow } from "@/components/sections/sdk-flow";
import { ToolApprovalStrip } from "@/components/sections/tool-approval-strip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { dashboardLoginUrl, dashboardRegisterUrl, feedbackIssuesUrl, iosSdkRepoUrl, nextjsSdkNpmUrl } from "@/lib/urls";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-6xl px-6 pb-20 pt-10">
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
            ResolveKit embeds a product-aware support agent in your app so users can fix blockers in the moment.
            Ground the assistant in your docs, flows, screenshots, and approved tools, then let it explain the issue,
            take the right action, and keep your team out of repetitive ticket triage.
          </p>
          <div className="mt-6 grid max-w-2xl gap-3 border-l border-[#d3dce5] pl-4 text-sm leading-relaxed text-[#516475] sm:grid-cols-3 sm:gap-6 sm:pl-5">
            <p>Reduce preventable support volume by resolving known issues at the point of failure.</p>
            <p>Give product, CX, and engineering one control plane for prompts, guardrails, and trace data.</p>
            <p>Ship automation with approvals, audit trails, and version-aware policies already built in.</p>
          </div>
          <p className="mt-4 text-sm text-[#6b7785]">Free for now. We want feedback from teams solving real support load.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={dashboardRegisterUrl}>
              <Button>Start Free</Button>
            </a>
            <Link href="/pricing">
              <Button variant="outline">See plan details</Button>
            </Link>
            <a href={iosSdkRepoUrl} target="_blank" rel="noreferrer">
              <Button variant="outline">iOS SDK GitHub</Button>
            </a>
            <a href={nextjsSdkNpmUrl} target="_blank" rel="noreferrer">
              <Button variant="outline">Next.js SDK npm</Button>
            </a>
            <a href={feedbackIssuesUrl} target="_blank" rel="noreferrer">
              <Button variant="ghost">Share feedback</Button>
            </a>
          </div>
        </div>
        <HeroChatPreview />
      </section>

      <MissionRail />
      <SdkFlow />
      <ToolApprovalStrip />
      <ProofGrid />

      <section className="mt-12">
        <Card className="animate-fade-up border-[#d6dee6] bg-[#f7f9fb] p-6 shadow-none md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-xs uppercase tracking-[0.2em] text-[#6b7785]">Operator command</p>
              <h2 className="mt-2 text-2xl font-semibold text-[#10273f]">
                Control prompts, functions, limits, and session traces from one dashboard
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[#4b5f72]">
                Keep the assistant commercially useful and operationally safe across every app surface while still
                adapting to platform, version, live session context, and the vision mode you allow.
              </p>
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
