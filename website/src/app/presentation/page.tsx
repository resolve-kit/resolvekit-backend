import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getPresentationMediaPath } from "@/lib/presentation-access";
import { cn } from "@/lib/utils";
import { dashboardLoginUrl } from "@/lib/urls";


import { PresentationNav } from "./nav";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ResolveKit | Presentation",
  description:
    "ResolveKit presentation: product thesis, go-to-market, and competitive landscape for the embedded AI support category.",
};

const SYNERGIES = [
  {
    label: "Inference",
    title: "Nexos.ai as the inference backbone",
    text: "Nexos.ai, the group's primary inference provider, is a natural infrastructure partner. The stack can run natively against the same provider already powering Tesonet products — no new vendor, lower latency, shared cost base.",
  },
  {
    label: "Ecosystem",
    title: "One SDK. Every Tesonet product.",
    text: "Tesonet operates multiple consumer and B2B products. A standardized embedded support layer gives every product in the portfolio the same best-in-class support UX — with shared infrastructure, shared tooling, and compounding network effects.",
  },
] as const;

const TAM_FRAMES = [
  {
    frame: "Agentic AI",
    current: "$5–7B",
    projection: "$47–52B",
    cagr: "~46%",
    source: "MarketsandMarkets / Precedence",
  },
  {
    frame: "AI Customer Service",
    current: "$12–13B",
    projection: "$47–84B",
    cagr: "23–26%",
    source: "MarketsandMarkets / Grand View Research",
  },
  {
    frame: "Customer Service Software (total)",
    current: "$50B",
    projection: "$95B",
    cagr: "11%",
    source: "Mordor Intelligence",
  },
] as const;

const MARKET_STATS = [
  {
    title: "80%",
    text: "of common customer service issues resolved autonomously by 2029 — Gartner, March 2025",
  },
  {
    title: "40%",
    text: "of enterprise apps will have task-specific AI agents by 2026, up from <5% today — Gartner, August 2025",
  },
  {
    title: "33%",
    text: "of enterprise software will have agentic AI capabilities by 2028 (vs <1% in 2024) — Gartner",
  },
  {
    title: "91%",
    text: "of customer service leaders are under pressure to implement AI in 2026 — Gartner survey, Feb 2026",
  },
] as const;

const MARKET_SIGNALS = [
  {
    title: "$0.50 vs $6.00",
    text: "Cost per AI interaction vs human agent — a 12x difference that makes the economics compelling at scale.",
  },
  {
    title: "$80B",
    text: "Projected contact center labor savings by 2026 — Gartner (2023).",
  },
] as const;

const PRODUCT_GAPS = [
  {
    eyebrow: "Context gap",
    question: "Does it know what screen the user is on?",
    text: "Their chatbot retrieves from a help center. ResolveKit is embedded in the product — it sees the app state, the user's current flow, visual context, and real product docs. That's the difference between a guess and a diagnosis.",
  },
  {
    eyebrow: "Action gap",
    question: "Can it take action in the product?",
    text: "Their chatbot describes the next step. ResolveKit does the next step — via approved tools, inside the app, with a trace. That moves the product from answer engine to resolution engine.",
  },
  {
    eyebrow: "Operator gap",
    question: "Do you have a trace of what it decided and why?",
    text: "Their chatbot is a black box. ResolveKit gives traces, approvals, prompt controls, and rollout governance. Once teams care about what the AI does in production, that's not optional.",
  },
] as const;

const GTM_STEPS = [
  {
    phase: "Land",
    title: "Developers install the SDK to solve an immediate support bottleneck",
    text: "The first win is fast: ship embedded support inside the app, reduce back-and-forth, and show real product-aware resolution quickly.",
  },
  {
    phase: "Expand",
    title: "Support and product teams adopt the command layer",
    text: "Once the agent is live, prompts, approvals, traces, multilingual behavior, and model controls become cross-functional operating surface area.",
  },
  {
    phase: "Standardize",
    title: "ResolveKit becomes infrastructure across apps, flows, and teams",
    text: "The wedge grows from one use case to the control plane for every in-product support experience the company owns.",
  },
] as const;

const PRICE_TRACKS = [
  {
    label: "Freemium",
    title: "PostHog-style entry point",
    text: "A generous free tier removes adoption friction and lets engineering teams prove value before budget conversations start.",
  },
  {
    label: "Usage",
    title: "Meter after the workflow is real",
    text: "Charge when teams depend on higher-volume resolution, more apps, or deeper operational controls rather than at install time.",
  },
  {
    label: "Enterprise",
    title: "Expand on governance and reliability",
    text: "Enterprise value comes from auditability, advanced controls, compliance expectations, and production-grade rollout support.",
  },
] as const;

const COMPETITORS = [
  {
    name: "Intercom Fin",
    rate: "$0.99 per resolution",
    strength: "Distribution, helpdesk breadth, and strong category mindshare.",
    gap: "Widget and suite gravity are powerful, but deeper product integration is not the default wedge.",
  },
  {
    name: "Zendesk AI Agents",
    rate: "As low as $1.50 per automated resolution",
    strength: "Incumbent helpdesk footprint and service org familiarity.",
    gap: "Best for teams already centered on ticketing; less opinionated about embedded product behavior.",
  },
  {
    name: "Lorikeet",
    rate: "$0.80-$0.95 per chat/email/SMS resolution",
    strength: "Action-taking orientation and transparent resolution pricing.",
    gap: "CX-team-first motion; not positioned around developer-owned in-product deployment.",
  },
  {
    name: "Decagon",
    rate: "Custom; per-conversation or per-resolution",
    strength: "Strong enterprise workflows, omnichannel reach, and operating-procedure tooling.",
    gap: "Enterprise sales motion is heavier than a self-serve developer wedge.",
  },
  {
    name: "Sierra",
    rate: "Custom outcome-based pricing",
    strength: "Premium enterprise positioning and managed-service depth.",
    gap: "Great for large brands, less natural for fast-moving product teams that want ownership and speed.",
  },
] as const;

const DEMOS = [
  {
    title: "Embedded support inside the product",
    text: "The assistant lives where the problem happens, which shortens diagnosis and makes follow-through feel native instead of bolted on.",
    fileName: "MOV_6069.mp4",
    aspect: "portrait",
  },
  {
    title: "",
    text: "",
    fileName: "MOV_2877.mp4",
    aspect: "portrait",
  },
  {
    title: "Command center and LLM control",
    text: "The control plane is where teams tune prompts, models, limits, traces, and rollout behavior once usage becomes operationally important.",
    fileName: "ResolveKit_console_llms.mp4",
    aspect: "landscape",
  },
] as const;

const headingStyle = {
  fontFamily: "\"Iowan Old Style\", \"Palatino Linotype\", \"Book Antiqua\", serif",
};

function PlatformMarks() {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-2.5 text-[#6e6458]">
      <span
        aria-label="Apple platforms"
        title="Apple platforms"
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#d8cab8] bg-white/72"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
          <path d="M16.365 12.295c.028 3.007 2.63 4.009 2.659 4.021-.022.071-.415 1.422-1.367 2.817-.823 1.206-1.676 2.408-3.021 2.433-1.321.025-1.747-.783-3.259-.783-1.513 0-1.986.758-3.235.808-1.298.05-2.286-1.302-3.116-2.503-1.697-2.455-2.994-6.938-1.253-9.962.865-1.502 2.41-2.454 4.088-2.479 1.274-.024 2.476.858 3.258.858.781 0 2.246-1.061 3.783-.905.644.027 2.452.261 3.611 1.956-.093.058-2.155 1.257-2.148 3.739Zm-2.108-6.164c.691-.839 1.157-2.007 1.03-3.164-.996.04-2.202.664-2.917 1.502-.641.742-1.203 1.93-1.051 3.065 1.111.086 2.246-.564 2.938-1.403Z" />
        </svg>
      </span>
      <span
        aria-label="Android"
        title="Android"
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#d8cab8] bg-white/72"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
          <path d="M7.19 8.06 5.75 5.55l.87-.5 1.46 2.53a10.16 10.16 0 0 1 7.84 0l1.46-2.53.87.5-1.44 2.51A8.86 8.86 0 0 1 20 14.5V18a1 1 0 0 1-1 1h-1v3a1 1 0 0 1-2 0v-3H8v3a1 1 0 0 1-2 0v-3H5a1 1 0 0 1-1-1v-3.5a8.86 8.86 0 0 1 3.19-6.44ZM9 12a.75.75 0 1 0 0-1.5A.75.75 0 0 0 9 12Zm6 0a.75.75 0 1 0 0-1.5A.75.75 0 0 0 15 12Z" />
        </svg>
      </span>
      <span
        aria-label="Web"
        title="Web"
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#d8cab8] bg-white/72"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 stroke-current" fill="none" strokeWidth="1.8" aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M3.8 9.5h16.4M3.8 14.5h16.4M12 3.5c2.5 2.3 4 5.27 4 8.5s-1.5 6.2-4 8.5c-2.5-2.3-4-5.27-4-8.5s1.5-6.2 4-8.5Z" />
        </svg>
      </span>
      <span
        aria-label="Desktop"
        title="Desktop"
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#d8cab8] bg-white/72"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 stroke-current" fill="none" strokeWidth="1.8" aria-hidden="true">
          <rect x="4" y="5" width="16" height="11" rx="2" />
          <path d="M9 19h6M12 16v3" />
        </svg>
      </span>
    </div>
  );
}

function SectionHeading({
  index,
  eyebrow,
  title,
  text,
}: {
  index: string;
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <div className="lg:sticky lg:top-28">
      <p className="text-[11px] uppercase tracking-[0.28em] text-[#6d665c]">{eyebrow}</p>
      <div className="mt-3 flex items-start gap-4">
        <span className="text-xs font-semibold tracking-[0.3em] text-[#9e927f]">{index}</span>
        <div className="max-w-xl">
          <h2 className="text-3xl font-semibold leading-[0.98] text-[#171412] md:text-5xl" style={headingStyle}>
            {title}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[#544c45] md:text-lg">{text}</p>
        </div>
      </div>
    </div>
  );
}

function InsightCard({
  title,
  text,
  className,
}: {
  title: string;
  text: string;
  className?: string;
}) {
  return (
    <Card className={cn("border-[#d7ccbb] bg-[rgba(255,251,245,0.9)] p-5", className)}>
      <h3 className="text-lg font-semibold leading-tight text-[#171412]">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-[#5d544b]">{text}</p>
    </Card>
  );
}

function WhyNowCard({
  className,
  columns = false,
}: {
  className?: string;
  columns?: boolean;
}) {
  return (
    <Card
      className={cn(
        "border-[#d7ccbb] bg-[linear-gradient(180deg,rgba(255,251,245,0.98),rgba(245,238,228,0.96))] p-5 text-[#1d2436]",
        className,
      )}
    >
      <p className="text-[10px] uppercase tracking-[0.28em] text-[#b08b52]">Why now</p>
      <div className={cn("mt-4 gap-3", columns ? "grid lg:grid-cols-3" : "space-y-4")}>
        <div className="rounded-2xl border border-[#ded2c1] bg-[rgba(255,255,255,0.68)] p-4">
          <p className="text-4xl font-semibold text-[#1e2d4a]">$250M</p>
          <p className="mt-2 text-base leading-relaxed text-[#5b5249]">
            Intercom announced a $250M financing in March 2026 around the Customer Agent story. Capital is validating
            the category, but the product surface is still open.
          </p>
        </div>
        <div className="rounded-2xl border border-[#ded2c1] bg-[rgba(255,255,255,0.68)] p-4">
          <p className="text-base font-semibold text-[#1e2d4a]">Category shift</p>
          <p className="mt-2 text-base leading-relaxed text-[#5b5249]">
            Support is moving from deflection software to agents that can diagnose, act, and confirm resolution.
          </p>
        </div>
        <div className="rounded-2xl border border-[#ded2c1] bg-[rgba(255,255,255,0.68)] p-4">
          <p className="text-base font-semibold text-[#1e2d4a]">ResolveKit wedge</p>
          <p className="mt-2 text-base leading-relaxed text-[#5b5249]">
            If developer experience is great and pricing stays fair, ResolveKit remains relevant even as chat UI
            becomes a commodity.
          </p>
        </div>
      </div>
    </Card>
  );
}

function DemoCard({
  title,
  text,
  src,
  aspect = "portrait",
  className,
}: {
  title: string;
  text: string;
  src: string;
  aspect?: "portrait" | "landscape";
  className?: string;
}) {
  return (
    <Card className={cn("overflow-hidden border-[#cfc3b2] bg-[#151210] text-[#f6efe4]", className)}>
      <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(218,162,74,0.28),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0))] p-5">
        <p className="text-[10px] uppercase tracking-[0.28em] text-[#d0b58a]">Demo</p>
        <h3 className="mt-2 text-xl font-semibold leading-tight">{title}</h3>
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-[#8f8375]">{text}</p>
      </div>
      <div className="bg-[#0e0c0b] p-3 sm:p-4">
        <video
          controls
          playsInline
          preload="metadata"
          className={cn(
            "w-full rounded-[1.2rem] border border-white/10 bg-black object-contain shadow-[0_24px_60px_-30px_rgba(0,0,0,0.9)]",
            aspect === "landscape" ? "aspect-video" : "aspect-[9/16]",
          )}
        >
          <source src={src} type="video/mp4" />
          Your browser does not support inline video playback for this demo.
        </video>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#aa9f91]">
          <p className="leading-relaxed">If inline playback is unsupported in your browser, open the direct demo file.</p>
          <a
            href={src}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-[11px] text-[#f4eddf] transition hover:border-white/20 hover:bg-white/10"
          >
            {src}
          </a>
        </div>
      </div>
    </Card>
  );
}

export default function PresentationPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f6f0e7_0%,#efe6d9_52%,#ede7df_100%)] text-[#171412]">
      <div className="mx-auto max-w-[1360px] px-4 pb-16 pt-4 sm:px-6 sm:pb-24 sm:pt-6 lg:px-8">
        <PresentationNav />

        <section className="grid gap-6 pt-8 lg:grid-cols-[minmax(0,1.1fr)_380px] lg:gap-8 lg:pt-12">
          <Card className="overflow-hidden border-[#d6c7b4] bg-[linear-gradient(145deg,rgba(255,251,245,0.98),rgba(243,235,224,0.96))] p-6 sm:p-8 lg:p-10">
            <div className="max-w-4xl animate-fade-up">
              <p className="text-[11px] uppercase tracking-[0.34em] text-[#7d7365]">ResolveKit thesis</p>
              <h1 className="mt-4 max-w-5xl text-4xl font-semibold leading-[0.92] tracking-[-0.04em] text-[#171412] sm:text-6xl lg:text-[5.6rem]" style={headingStyle}>
                Everyone has a chatbot.
                <br />
                The wedge now is embedded resolution.
              </h1>
              <p className="mt-6 max-w-3xl text-base leading-relaxed text-[#584f47] sm:text-lg">
                ResolveKit is an SDK with a multimodal knowledge base for products that want more than a widget. The
                assistant lives inside the app, understands the user&apos;s flow, can reason over product docs and visual
                context, can propose approved actions, and gives operators a live trace of what the model saw, decided,
                and executed.
              </p>
              <PlatformMarks />
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#product">
                  <Button className="bg-[#171412] text-white hover:bg-[#2b241d] hover:text-white">See the product case</Button>
                </a>
                <a href="#competition">
                  <Button variant="outline" className="border-[#bcae99] bg-white/70">
                    See the market map
                  </Button>
                </a>
                <a href={dashboardLoginUrl}>
                  <Button variant="ghost" className="bg-transparent">
                    Open dashboard
                  </Button>
                </a>
              </div>
            </div>
          </Card>

          <DemoCard
            title={DEMOS[0].title}
            text={DEMOS[0].text}
            src={getPresentationMediaPath(DEMOS[0].fileName)}
            aspect={DEMOS[0].aspect}
            className="animate-fade-up [animation-delay:120ms]"
          />
        </section>

        <section
          id="product"
          className="mt-8 grid gap-6 scroll-mt-28 rounded-[2rem] border border-[#d8ccbc] bg-[rgba(255,250,243,0.74)] p-4 sm:p-6 lg:mt-10 lg:grid-cols-[minmax(220px,0.54fr)_minmax(0,1.46fr)] lg:gap-8 lg:p-8"
        >
          <SectionHeading
            index="01"
            eyebrow="What the product is"
            title="Everyone has a chatbot. Ask them these three questions."
            text="Most support products now ship an AI box. The surface alone is no longer a moat. ResolveKit wins on the three dimensions where that box comes up short — and where the switch becomes obvious."
          />
          <div className="space-y-4">
            <Card className="border-[#d6c7b4] bg-[linear-gradient(145deg,rgba(255,251,245,0.98),rgba(243,235,224,0.96))] p-7 sm:p-8">
              <p className="text-[10px] uppercase tracking-[0.28em] text-[#9e7c4a]">The case</p>
              <blockquote
                className="mt-4 text-2xl font-semibold leading-snug text-[#171412] sm:text-3xl"
                style={headingStyle}
              >
                A chatbot tells users what to do. ResolveKit does it for them — from inside the app, with the context
                of what they were actually trying to accomplish.
              </blockquote>
            </Card>

            <div className="grid gap-4 xl:grid-cols-3">
              {PRODUCT_GAPS.map((gap) => (
                <Card key={gap.eyebrow} className="border-[#d7ccbb] bg-[rgba(255,251,245,0.9)] p-5">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-[#b08b52]">{gap.eyebrow}</p>
                  <h3 className="mt-3 text-xl font-semibold leading-tight text-[#171412]">{gap.question}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#5d544b]">{gap.text}</p>
                </Card>
              ))}
            </div>

            <WhyNowCard columns />
          </div>
        </section>

        <section
          id="validation"
          className="mt-8 grid gap-6 scroll-mt-28 rounded-[2rem] border border-[#d8ccbc] bg-[rgba(255,250,243,0.74)] p-4 sm:p-6 lg:mt-10 lg:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.28fr)] lg:gap-10 lg:p-8"
        >
          <SectionHeading
            index="02"
            eyebrow="Validation"
            title="Won Surfshark's internal AI hackathon. Production interest followed."
            text="The demo was built for a Surfshark internal hackathon, placed first, and the team is now evaluating production deployment. Early signal that the problem is real and the product works."
          />
          <div className="space-y-4">
            <Card className="border-[#3a2e1a] bg-[#1a1209] p-7 text-[#f6efe4]">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-[#3d3020] bg-white/5 p-5">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-[#d0b58a]">Hackathon</p>
                  <p className="mt-3 text-6xl font-semibold text-[#e8a838]" style={headingStyle}>1st</p>
                  <p className="mt-2 text-lg font-semibold leading-tight text-[#f5f0e8]">Surfshark internal hackathon</p>
                  <p className="mt-2 text-sm leading-relaxed text-[#a89880]">
                    Won Surfshark&apos;s internal AI hackathon. The demo competed against other internal projects.
                  </p>
                </div>
                <div className="rounded-2xl border border-[#3d3020] bg-white/5 p-5">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-[#d0b58a]">What came next</p>
                  <p className="mt-3 text-xl font-semibold leading-tight text-[#f5f0e8]">
                    Surfshark is evaluating production deployment
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-[#a89880]">
                    The team that ran the hackathon is interested in shipping it. First real signal the problem is worth
                    solving.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="border-[#d4c7b6] bg-[rgba(255,252,247,0.94)] p-6">
              <p className="text-[10px] uppercase tracking-[0.28em] text-[#977c57]">Possible synergies</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {SYNERGIES.map((s) => (
                  <div key={s.label} className="rounded-2xl border border-[#ded2c1] bg-[rgba(255,255,255,0.68)] p-4">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-[#b08b52]">{s.label}</p>
                    <h3 className="mt-2 text-lg font-semibold text-[#1e2d4a]">{s.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#5b5249]">{s.text}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </section>

        <section
          id="gtm"
          className="mt-8 grid gap-6 scroll-mt-28 rounded-[2rem] border border-[#d6cab9] bg-[linear-gradient(180deg,rgba(255,252,247,0.82),rgba(242,234,222,0.92))] p-4 sm:p-6 lg:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.28fr)] lg:gap-10 lg:p-8"
        >
          <SectionHeading
            index="03"
            eyebrow="Go-to-market"
            title="Lead with developers, prove value in-product, then expand where the workflow gets sticky."
            text="The right motion is freemium, product-led, and usage-aware. A PostHog-style entry point wins the first install. The control plane, approvals, traces, and multi-app rollout create the expansion path once teams trust the product in production."
          />
          <div className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-3">
              {GTM_STEPS.map((step) => (
                <Card key={step.phase} className="border-[#d7c8b6] bg-white/80 p-5">
                  <p className="text-[10px] uppercase tracking-[0.26em] text-[#8e816f]">{step.phase}</p>
                  <h3 className="mt-3 text-lg font-semibold leading-tight text-[#171412]">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#5d544c]">{step.text}</p>
                </Card>
              ))}
            </div>

            <div className="space-y-4">
              <Card className="border-[#d7ccbb] bg-[linear-gradient(180deg,rgba(255,251,245,0.98),rgba(245,238,228,0.96))] p-5 text-[#1d2436]">
                <p className="text-[10px] uppercase tracking-[0.28em] text-[#b08b52]">Pricing motion</p>
                <div className="mt-4 grid gap-3 xl:grid-cols-3">
                  {PRICE_TRACKS.map((track) => (
                    <div key={track.label} className="rounded-2xl border border-[#ded2c1] bg-[rgba(255,255,255,0.72)] p-4">
                      <p className="text-[10px] uppercase tracking-[0.24em] text-[#b08b52]">{track.label}</p>
                      <h3 className="mt-2 text-lg font-semibold text-[#1e2d4a]">{track.title}</h3>
                      <p className="mt-2 text-base leading-relaxed text-[#5b5249]">{track.text}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-base leading-relaxed text-[#5b5249]">
                  The strategic point is simple: if the onboarding path is lightweight, the developer surface is
                  excellent, and the pricing curve feels fair, ResolveKit can win installs before a heavy sales process
                  ever begins.
                </p>
              </Card>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)] xl:gap-6">
          <DemoCard
            title={DEMOS[1].title}
            text={DEMOS[1].text}
            src={getPresentationMediaPath(DEMOS[1].fileName)}
            aspect={DEMOS[1].aspect}
            className="bg-[#120f0d]"
          />
          <DemoCard
            title={DEMOS[2].title}
            text={DEMOS[2].text}
            src={getPresentationMediaPath(DEMOS[2].fileName)}
            aspect={DEMOS[2].aspect}
            className="border-[#cdbda8] shadow-[0_28px_90px_-45px_rgba(24,18,14,0.55)]"
          />
        </section>

        <section
          id="market"
          className="mt-8 grid gap-6 scroll-mt-28 rounded-[2rem] border border-[#d8ccbc] bg-[rgba(255,250,243,0.74)] p-4 sm:p-6 lg:mt-10 lg:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.28fr)] lg:gap-10 lg:p-8"
        >
          <SectionHeading
            index="04"
            eyebrow="Market"
            title="A $50B software category is shifting from deflection to resolution."
            text="The customer service software market is large and well-funded. The interesting motion is not that the market exists — it is that the underlying model is changing: from ticket management and chat deflection to agents that diagnose, act, and confirm resolution. That shift is where the category is being repriced."
          />
          <details className="group self-start">
            <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl border border-[#d7ccbb] bg-[rgba(255,251,245,0.9)] px-5 py-3 [&::-webkit-details-marker]:hidden">
              <span className="text-sm font-medium text-[#5d544b]">View market data &amp; analysis</span>
              <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-[#9e927f] transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <div className="mt-4 space-y-4">
              <Card className="overflow-hidden border-[#d2c5b5] bg-white/88 p-0">
                <div className="border-b border-[#e0d5c7] px-5 py-4">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-[#897b6a]">Market sizing frames</p>
                  <p className="mt-2 text-sm leading-relaxed text-[#5f554b]">
                    Three framing options depending on how investors want to anchor the opportunity.
                  </p>
                </div>
                <div className="divide-y divide-[#e9dfd3]">
                  <div className="grid gap-3 px-5 py-3 md:grid-cols-[minmax(0,1.4fr)_100px_120px_80px_minmax(0,1fr)] md:gap-4">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-[#8d7e6b]">Frame</p>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-[#8d7e6b]">2024/2025</p>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-[#8d7e6b]">2030</p>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-[#8d7e6b]">CAGR</p>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-[#8d7e6b]">Source</p>
                  </div>
                  {TAM_FRAMES.map((row) => (
                    <div key={row.frame} className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1.4fr)_100px_120px_80px_minmax(0,1fr)] md:gap-4">
                      <p className="text-sm font-medium text-[#2a241d]">{row.frame}</p>
                      <p className="text-sm text-[#5b5248]">{row.current}</p>
                      <p className="text-sm text-[#5b5248]">{row.projection}</p>
                      <p className="text-sm text-[#5b5248]">{row.cagr}</p>
                      <p className="text-sm text-[#5b5248]">{row.source}</p>
                    </div>
                  ))}
                </div>
                <div className="border-t border-[#e0d5c7] bg-[rgba(250,245,235,0.8)] px-5 py-4">
                  <p className="text-sm leading-relaxed text-[#5b5248]">
                    <span className="font-semibold text-[#2a241d]">Recommended frame:</span> Agentic AI (~46% CAGR) is the most defensible framing for a resolution-first product.
                  </p>
                </div>
              </Card>

              <div className="grid gap-4 sm:grid-cols-2">
                {MARKET_STATS.map((stat) => (
                  <InsightCard key={stat.title} title={stat.title} text={stat.text} />
                ))}
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
                <Card className="border-[#d4c7b6] bg-[rgba(255,252,247,0.94)] p-6 text-[#2f2a25]">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-[#977c57]">The gap</p>
                  <h3 className="mt-3 text-2xl font-semibold leading-tight text-[#24324c]" style={headingStyle}>
                    No analyst report isolates &ldquo;embedded in-product support SDK&rdquo; as its own market category — that category doesn&apos;t exist yet.
                  </h3>
                  <p className="mt-3 max-w-3xl text-base leading-relaxed text-[#4a4138]">
                    That is both the opportunity and the challenge. The TAM numbers above describe the market ResolveKit sits inside. The embedded SDK layer — where the assistant lives in the app, sees product context, and can take approved action — is an emerging wedge within that market. ResolveKit&apos;s bet is to own that layer before it becomes a named category.
                  </p>
                </Card>

                <div className="space-y-4">
                  {MARKET_SIGNALS.map((signal) => (
                    <InsightCard key={signal.title} title={signal.title} text={signal.text} />
                  ))}
                </div>
              </div>
            </div>
          </details>
        </section>

        <section
          id="competition"
          className="mt-8 grid gap-6 scroll-mt-28 rounded-[2rem] border border-[#d8cdbf] bg-[rgba(251,247,240,0.82)] p-4 sm:p-6 lg:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.28fr)] lg:gap-10 lg:p-8"
        >
          <SectionHeading
            index="05"
            eyebrow="Competition"
            title="The market is crowded with chat surfaces. The durable wedge is ownership of product context and action."
            text="There are real competitors, real budgets, and increasingly mature pricing models. But most vendors still optimize around the helpdesk, not the in-product experience. ResolveKit’s opening is to own the embedded layer that makes the assistant both more useful and more persistent."
          />
          <div className="space-y-4">
            <Card className="overflow-hidden border-[#d2c5b5] bg-white/88 p-0">
              <div className="border-b border-[#e0d5c7] px-5 py-4">
                <p className="text-[10px] uppercase tracking-[0.28em] text-[#897b6a]">Public pricing snapshot</p>
                <p className="mt-2 text-sm leading-relaxed text-[#5f554b]">
                  Public pricing and pricing-language references captured on March 12, 2026.
                </p>
              </div>
              <div className="divide-y divide-[#e9dfd3]">
                {COMPETITORS.map((competitor) => (
                  <div key={competitor.name} className="grid gap-3 px-5 py-4 md:grid-cols-[180px_170px_minmax(0,1fr)_minmax(0,1fr)] md:gap-4">
                    <div>
                      <p className="text-base font-semibold text-[#171412]">{competitor.name}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.22em] text-[#8d7e6b]">Rate</p>
                      <p className="mt-1 text-sm font-medium text-[#2a241d]">{competitor.rate}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.22em] text-[#8d7e6b]">Strength</p>
                      <p className="mt-1 text-sm leading-relaxed text-[#5b5248]">{competitor.strength}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.22em] text-[#8d7e6b]">Gap vs. ResolveKit</p>
                      <p className="mt-1 text-sm leading-relaxed text-[#5b5248]">{competitor.gap}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
              <Card className="border-[#d4c7b6] bg-[rgba(255,252,247,0.94)] p-6 text-[#2f2a25]">
                <p className="text-[10px] uppercase tracking-[0.28em] text-[#977c57]">ResolveKit position</p>
                <h3 className="mt-3 text-2xl font-semibold leading-tight text-[#24324c]" style={headingStyle}>
                  Chat is the commodity. Integration depth is the product.
                </h3>
                <p className="mt-3 max-w-3xl text-base leading-relaxed text-[#4a4138]">
                  If every vendor can generate decent conversational output, the question becomes: who owns the real
                  workflow? ResolveKit wins where teams want the assistant embedded in the app, connected to actual
                  product behavior, governed with approvals, and priced in a way that does not punish early adoption.
                </p>
              </Card>

              <Card className="border-[#d4c7b6] bg-[rgba(255,252,247,0.92)] p-5">
                <p className="text-[10px] uppercase tracking-[0.28em] text-[#8e816f]">What matters</p>
                <ul className="mt-4 space-y-3 text-base leading-relaxed text-[#463d35]">
                  <li>Developer experience has to feel faster than buying a helpdesk.</li>
                  <li>Pricing has to feel fair before the workflow is proven.</li>
                  <li>Once the integration goes deeper, stickiness improves naturally.</li>
                </ul>
              </Card>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
