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
          style={{ fontFamily: "Inter, 'Mona Sans', 'Avenir Next', 'Segoe UI', sans-serif" }}
        >
          <span className="text-[20px] font-normal uppercase tracking-[0.2em] text-[#0d2f57]">RESOLVE</span>
          <span className="ml-[0.12em] text-[10px] font-normal tracking-[0.2em] text-black">kit</span>
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

      <section className="mt-12 grid items-start gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,430px)]">
        <div className="max-w-3xl animate-fade-up">
          <h1 className="text-5xl font-semibold leading-[1.02] tracking-tight">
            Embedded LLM Support Agent That Can Actually Act
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
            Developers integrate the ResolveKit SDK into mobile or web apps. Users get embedded chat. Your LLM agent
            understands the app, including screen layout and flow from docs, guide images, and submitted screenshots,
            explains fixes clearly, and can invoke approved on-device functions to resolve issues.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">Free (for now). Pay us in feedback.</p>
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
        <Card className="p-6 md:p-8 animate-fade-up">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Operator Command</p>
              <h2 className="mt-2 text-2xl font-semibold">Control prompts, functions, limits, and session traces from one dashboard</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Keep assistant behavior consistent across every app surface while still adapting to platform, version,
                real-time session context, and knowledge-base vision mode (OCR-safe or full multimodal).
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
