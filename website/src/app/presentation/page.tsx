import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getPresentationMediaPath } from "@/lib/presentation-access";
import { cn } from "@/lib/utils";


import { PresentationNav } from "./nav";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ResolveKit | Presentation",
  description:
    "ResolveKit business case: embedded AI support that resolves problems inside the product, not outside it.",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

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
    text: "AI interactions are already dramatically cheaper than human support, which is why the category economics are shifting so quickly.",
  },
  {
    title: "$80B",
    text: "Projected contact center labor savings by 2026, showing why buyers are actively repricing support around automation.",
  },
] as const;

const SUPPORT_SURFACES = [
  {
    label: "Legacy support surface",
    title: "Explains after the workflow breaks.",
    points: [
      "Context arrives after the user has already left the exact product step.",
      "It can explain or escalate, but it rarely acts inside the product itself.",
    ],
  },
  {
    label: "In-app resolution surface",
    title: "Resolves while the workflow is still live.",
    points: [
      "ResolveKit sees app state while the problem is still happening.",
      "Approved action happens inside the product, with traces and controls.",
    ],
  },
] as const;

const GTM_STEPS = [
  {
    phase: "Install",
    title: "Developers ship one embedded resolution workflow",
    text: "The wedge starts with one painful support moment where speed and product context matter immediately.",
  },
  {
    phase: "Prove",
    title: "The team proves that in-app resolution changes outcomes",
    text: "Once the workflow is live, the product can show faster resolution, lower support drag, and better operator visibility.",
  },
  {
    phase: "Expand",
    title: "The command layer becomes infrastructure across products",
    text: "After one workflow works, prompts, approvals, traces, and rollout controls become a shared operating layer.",
  },
] as const;

const PRICE_TRACKS = [
  {
    label: "Freemium",
    title: "PostHog-style entry point",
    text: "A generous free tier removes friction and lets teams prove value before procurement gets involved.",
  },
  {
    label: "Usage",
    title: "Meter after the workflow is real",
    text: "Charge once teams depend on real resolution volume and deeper controls, not at install time.",
  },
  {
    label: "Enterprise",
    title: "Expand on governance and reliability",
    text: "Enterprise value comes from governance, reliability, compliance, and rollout support.",
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
    fileName: "MOV_2877.mp4",
    aspect: "portrait",
  },
  {
    title: "Resolution flow inside the user journey",
    text: "The important shift is not prettier chat. It is support operating while the user is still inside the workflow that caused the issue.",
    fileName: "MOV_6069.mp4",
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
    <div className="mt-5 flex flex-wrap items-center gap-2 text-[#6e6458]">
      <span
        aria-label="Apple platforms"
        title="Apple platforms"
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#d8cab8] bg-white/58"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
          <path d="M16.365 12.295c.028 3.007 2.63 4.009 2.659 4.021-.022.071-.415 1.422-1.367 2.817-.823 1.206-1.676 2.408-3.021 2.433-1.321.025-1.747-.783-3.259-.783-1.513 0-1.986.758-3.235.808-1.298.05-2.286-1.302-3.116-2.503-1.697-2.455-2.994-6.938-1.253-9.962.865-1.502 2.41-2.454 4.088-2.479 1.274-.024 2.476.858 3.258.858.781 0 2.246-1.061 3.783-.905.644.027 2.452.261 3.611 1.956-.093.058-2.155 1.257-2.148 3.739Zm-2.108-6.164c.691-.839 1.157-2.007 1.03-3.164-.996.04-2.202.664-2.917 1.502-.641.742-1.203 1.93-1.051 3.065 1.111.086 2.246-.564 2.938-1.403Z" />
        </svg>
      </span>
      <span
        aria-label="Android"
        title="Android"
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#d8cab8] bg-white/58"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
          <path d="M7.19 8.06 5.75 5.55l.87-.5 1.46 2.53a10.16 10.16 0 0 1 7.84 0l1.46-2.53.87.5-1.44 2.51A8.86 8.86 0 0 1 20 14.5V18a1 1 0 0 1-1 1h-1v3a1 1 0 0 1-2 0v-3H8v3a1 1 0 0 1-2 0v-3H5a1 1 0 0 1-1-1v-3.5a8.86 8.86 0 0 1 3.19-6.44ZM9 12a.75.75 0 1 0 0-1.5A.75.75 0 0 0 9 12Zm6 0a.75.75 0 1 0 0-1.5A.75.75 0 0 0 15 12Z" />
        </svg>
      </span>
      <span
        aria-label="Web"
        title="Web"
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#d8cab8] bg-white/58"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 stroke-current" fill="none" strokeWidth="1.8" aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M3.8 9.5h16.4M3.8 14.5h16.4M12 3.5c2.5 2.3 4 5.27 4 8.5s-1.5 6.2-4 8.5c-2.5-2.3-4-5.27-4-8.5s1.5-6.2 4-8.5Z" />
        </svg>
      </span>
      <span
        aria-label="Desktop"
        title="Desktop"
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#d8cab8] bg-white/58"
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
  className,
}: {
  index: string;
  eyebrow: string;
  title: string;
  text?: string;
  className?: string;
}) {
  return (
    <div className={cn("lg:sticky lg:top-28", className)}>
      <p className="text-[11px] uppercase tracking-[0.28em] text-[#6d665c]">{eyebrow}</p>
      <div className="mt-3 flex items-start gap-4">
        <span className="text-xs font-semibold tracking-[0.3em] text-[#9e927f]">{index}</span>
        <div className="max-w-xl">
          <h2 className="text-3xl font-semibold leading-[0.98] text-[#171412] md:text-5xl" style={headingStyle}>
            {title}
          </h2>
          {text && <p className="mt-4 text-base leading-relaxed text-[#544c45] md:text-lg">{text}</p>}
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
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#f4eddf] transition hover:border-white/20 hover:bg-white/10"
          >
            Open direct file
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
                Support is moving into the product.
                <br />
                ResolveKit is the embedded resolution layer.
              </h1>
              <p className="mt-6 max-w-3xl text-base leading-relaxed text-[#584f47] sm:text-lg">
                ResolveKit is an SDK for products that want support to happen where the problem happens. It lives inside
                the app, understands context, can trigger approved actions, and gives teams full visibility into what the
                system saw, decided, and did.
              </p>
              <PlatformMarks />
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#product">
                  <Button className="bg-[#171412] text-white hover:bg-[#2b241d] hover:text-white">Read the shift</Button>
                </a>
                <a href="#economics">
                  <Button variant="outline" className="border-[#bcae99] bg-white/64 hover:bg-white/82">
                    See unit economics
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
            eyebrow="What changes"
            title="Most support tools explain the issue. ResolveKit resolves it in-product."
            text="The shift is from support that explains to support that resolves."
          />
          <div className="space-y-4">
            <Card className="overflow-hidden border-[#d7ccbb] bg-[linear-gradient(135deg,rgba(255,251,245,0.98),rgba(244,236,226,0.94))] p-0">
              <div className="border-b border-[#e6d9c8] px-6 py-5">
                <p className="text-[10px] uppercase tracking-[0.3em] text-[#b08b52]">Category shift</p>
                <h3 className="mt-4 text-3xl font-semibold leading-[0.96] text-[#1d1915] md:text-4xl" style={headingStyle}>
                  The future is in-app resolution.
                </h3>
              </div>
              <div className="grid gap-px bg-[#e6d9c8] sm:grid-cols-2">
                {SUPPORT_SURFACES.map((surface, index) => (
                  <div key={surface.label} className={cn("bg-[rgba(255,250,243,0.96)] p-6", index === 1 && "bg-[rgba(249,244,236,0.98)]")}>
                    <p className="text-[10px] uppercase tracking-[0.28em] text-[#8d7652]">{surface.label}</p>
                    <h3 className="mt-3 text-xl font-semibold leading-tight text-[#171412]">{surface.title}</h3>
                    <ul className="mt-4 space-y-3 text-sm leading-relaxed text-[#5a5148]">
                      {surface.points.map((point) => (
                        <li key={point} className="flex gap-3">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#b08b52]" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
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
            index="02"
            eyebrow="Go-to-market"
            title="The wedge starts with one embedded workflow."
            text="The adoption path is simple: install into one painful support moment, prove resolution in-product, then expand as workflow ownership compounds."
          />
          <div className="space-y-4">
            <Card className="overflow-hidden border-[#d7ccbb] bg-[linear-gradient(180deg,rgba(255,251,245,0.98),rgba(245,238,228,0.96))] p-0 text-[#1d2436]">
              <div className="border-b border-[#e0d5c7] px-6 py-5">
                <p className="text-[10px] uppercase tracking-[0.28em] text-[#b08b52]">Wedge motion</p>
                <p className="mt-3 max-w-3xl text-lg leading-relaxed text-[#4f473f]">Ship one workflow. Prove it. Expand from there.</p>
              </div>
              <div className="grid gap-px bg-[#e0d5c7] xl:grid-cols-3">
                {GTM_STEPS.map((step, index) => (
                  <div key={step.phase} className="bg-[rgba(255,252,247,0.94)] p-6">
                    <div className="flex items-center gap-3 text-[#8e816f]">
                      <span className="text-[10px] uppercase tracking-[0.28em]">{step.phase}</span>
                      <span className="h-px flex-1 bg-[#ddd1c0]" />
                      <span className="text-xs font-semibold">{`0${index + 1}`}</span>
                    </div>
                    <h3 className="mt-4 text-xl font-semibold leading-tight text-[#171412]">{step.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-[#5d544c]">{step.text}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="border-[#d7ccbb] bg-white/84 p-5">
              <p className="text-[10px] uppercase tracking-[0.28em] text-[#8e816f]">Commercial motion</p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {PRICE_TRACKS.map((track) => (
                  <div key={track.label} className="rounded-2xl border border-[#e2d6c7] bg-[rgba(248,244,238,0.84)] p-4">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-[#b08b52]">{track.label}</p>
                    <p className="mt-2 text-sm font-semibold text-[#1e2d4a]">{track.title}</p>
                  </div>
                ))}
              </div>
            </Card>
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
          className="mt-8 grid min-h-[220px] gap-6 scroll-mt-28 rounded-[2rem] border border-[#d8ccbc] bg-[rgba(255,250,243,0.74)] p-4 sm:p-6 lg:mt-10 lg:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.28fr)] lg:gap-10 lg:p-8"
        >
          <SectionHeading
            index="03"
            eyebrow="Market"
            title="A large software category is being repriced around resolution."
            text="The important shift is not that the market exists. It is that buyers are moving from ticketing and deflection toward diagnosis, action, and confirmed resolution."
          />
          <div className="space-y-4">
            <Card className="border-[#d4c7b6] bg-[rgba(255,252,247,0.94)] p-6 text-[#2f2a25]">
              <p className="text-[10px] uppercase tracking-[0.28em] text-[#977c57]">What matters now</p>
              <h3 className="mt-3 text-2xl font-semibold leading-tight text-[#24324c]" style={headingStyle}>
                The category is real, and the embedded layer is still open.
              </h3>
              <p className="mt-3 max-w-3xl text-base leading-relaxed text-[#4a4138]">
                Buyers are moving from ticketing and deflection toward diagnosis, action, and confirmed resolution inside the product.
              </p>
            </Card>

            <details className="group self-start">
              <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl border border-[#d7ccbb] bg-[rgba(255,251,245,0.9)] px-5 py-4 transition hover:border-[#bea989] hover:bg-white/94 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bea989] [&::-webkit-details-marker]:hidden">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-[#897b6a]">Market data</p>
                  <p className="mt-1 text-sm font-medium text-[#2a241d]">Show sizing and signals</p>
                </div>
                <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-[#9e927f] transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </summary>
              <div className="mt-4 space-y-4">
                <Card className="overflow-hidden border-[#d2c5b5] bg-white/88 p-0">
                  <div className="border-b border-[#e0d5c7] px-5 py-4">
                    <p className="text-[10px] uppercase tracking-[0.28em] text-[#897b6a]">Market sizing frames</p>
                    <p className="mt-2 text-sm leading-relaxed text-[#5f554b]">
                      Three simple ways to size the opportunity.
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
                      <span className="font-semibold text-[#2a241d]">Recommended frame:</span> Agentic AI is the cleanest way to frame a resolution-first product.
                    </p>
                  </div>
                </Card>

                <div className="grid gap-4 sm:grid-cols-2">
                  {[...MARKET_STATS.slice(0, 2), ...MARKET_SIGNALS].map((item) => (
                    <InsightCard key={item.title} title={item.title} text={item.text} />
                  ))}
                </div>
              </div>
            </details>
          </div>
        </section>

        <section
          id="competition"
          className="mt-8 grid gap-6 scroll-mt-28 rounded-[2rem] border border-[#d8cdbf] bg-[rgba(251,247,240,0.82)] p-4 sm:p-6 lg:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.28fr)] lg:gap-10 lg:p-8"
        >
          <SectionHeading
            index="04"
            eyebrow="Competition"
            title="Incumbents own helpdesks. ResolveKit owns the in-product workflow."
            text="There are real competitors and real budgets in this category. The difference is that most vendors still optimize around the helpdesk, not the product experience itself."
          />
          <div className="space-y-4">
            <Card className="overflow-hidden border-[#d4c7b6] bg-[rgba(255,252,247,0.94)] p-0 text-[#2f2a25]">
              <div className="border-b border-[#e0d5c7] px-6 py-5">
                <p className="text-[10px] uppercase tracking-[0.28em] text-[#977c57]">ResolveKit position</p>
                <p className="mt-3 max-w-3xl text-2xl font-semibold leading-tight text-[#24324c]" style={headingStyle}>
                  Incumbents sell helpdesk automation. ResolveKit owns in-app resolution.
                </p>
              </div>

              <div className="grid gap-px bg-[#e0d5c7] sm:grid-cols-2">
                <div className="bg-[rgba(255,252,247,0.96)] px-6 py-5">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-[#8d7e6b]">Public band</p>
                  <p className="mt-3 text-lg font-semibold text-[#24324c]" style={headingStyle}>
                    Public band: $0.80-$1.50+
                  </p>
                </div>
                <div className="bg-[rgba(249,244,236,0.98)] px-6 py-5">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-[#8d7e6b]">ResolveKit target</p>
                  <p className="mt-3 text-lg font-semibold text-[#24324c]" style={headingStyle}>
                    ResolveKit target: $0.20
                  </p>
                </div>
              </div>
            </Card>

            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl border border-[#d2c5b5] bg-white/88 px-5 py-4 transition hover:border-[#bea989] hover:bg-white/94 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bea989] [&::-webkit-details-marker]:hidden">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-[#897b6a]">Competition</p>
                  <p className="mt-1 text-sm font-medium text-[#2a241d]">Show public competitor snapshot</p>
                </div>
                <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-[#9e927f] transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </summary>

              <Card className="mt-4 overflow-hidden border-[#d2c5b5] bg-white/88 p-0">
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
            </details>
          </div>
        </section>

        <section
          id="economics"
          className="mt-8 grid gap-6 scroll-mt-28 rounded-[2rem] border border-[#d8ccbc] bg-[linear-gradient(180deg,rgba(255,252,247,0.82),rgba(244,236,225,0.92))] p-4 sm:p-6 xl:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.28fr)] xl:gap-10 xl:p-8"
        >
          <SectionHeading
            index="05"
            eyebrow="Unit economics"
            title="Price far below incumbents. Keep margin structurally high."
            text="Built on Gemini 2.5 Flash-Lite. A demanding conversation still stays under two cents to deliver, which leaves unusual room to price aggressively without breaking the model."
            className="lg:static xl:sticky xl:top-28"
          />
          <div className="space-y-4">
            <Card className="overflow-hidden border-[#c9bcae] bg-[#1b1713] p-0 text-[#f6efe4] shadow-[0_30px_80px_-45px_rgba(18,12,8,0.85)]">
              <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(226,169,81,0.18),transparent_34%),linear-gradient(180deg,#3a2f24_0%,#241d17_68%,#1b1713_100%)] px-6 py-6">
                <p className="text-[10px] uppercase tracking-[0.28em] text-[#d0b58a]">Business case</p>
                <h3 className="mt-3 max-w-4xl text-3xl font-semibold leading-[0.98] text-[#f8f1e7] md:text-4xl" style={headingStyle}>
                  A demanding conversation costs under two cents to deliver.
                </h3>
                <p className="mt-4 max-w-3xl text-base leading-relaxed text-[#dbcdbd]">
                  The delivery cost is measured in cents. Most sessions land much lower. Model cost is not the bottleneck.
                </p>
              </div>
              <div className="grid gap-px bg-white/10 md:grid-cols-3">
                <div className="bg-[#16120f] px-6 py-5">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-[#d0b58a]">Price target</p>
                  <p className="mt-3 text-5xl font-semibold text-white" style={headingStyle}>$0.20</p>
                  <p className="mt-3 text-sm leading-relaxed text-[#aa9f91]">Undercuts the $0.99 Intercom Fin benchmark while still leaving strong delivery margin.</p>
                </div>
                <div className="bg-[#1b1713] px-6 py-5">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-[#d0b58a]">10-turn ceiling</p>
                  <p className="mt-3 text-5xl font-semibold text-white" style={headingStyle}>$0.016</p>
                  <p className="mt-3 text-sm leading-relaxed text-[#aa9f91]">A high-end session with KB retrieval, tool calls, and multimodal content still stays below $0.02.</p>
                </div>
                <div className="bg-[#16120f] px-6 py-5">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-[#d0b58a]">Typical session</p>
                  <p className="mt-3 text-5xl font-semibold text-white" style={headingStyle}>~$0.005</p>
                  <p className="mt-3 text-sm leading-relaxed text-[#aa9f91]">Most sessions land much lower, which means the delivery profile improves further once the workflow is real.</p>
                </div>
              </div>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-[#d7ccbb] bg-white/84 p-5">
                <p className="text-[10px] uppercase tracking-[0.24em] text-[#8e816f]">Delivery margin floor</p>
                <p className="mt-3 text-3xl font-semibold text-[#1e2d4a]" style={headingStyle}>10×</p>
                <p className="mt-2 text-sm leading-relaxed text-[#5d544b]">
                  At $0.20 per resolution, the delivery cost is one-tenth the price even in the heavier case.
                </p>
              </Card>
              <Card className="border-[#d7ccbb] bg-white/84 p-5">
                <p className="text-[10px] uppercase tracking-[0.24em] text-[#8e816f]">Market position</p>
                <p className="mt-3 text-3xl font-semibold text-[#1e2d4a]" style={headingStyle}>$0.20 vs $0.99</p>
                <p className="mt-2 text-sm leading-relaxed text-[#5d544b]">
                  Price below incumbents, keep margin structurally high, and preserve room to scale usage.
                </p>
              </Card>
            </div>

            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between rounded-2xl border border-[#d2c5b5] bg-white/88 px-5 py-4 transition hover:border-[#bea989] hover:bg-white/94 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bea989] [&::-webkit-details-marker]:hidden">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-[#897b6a]">Assumptions</p>
                  <p className="mt-1 text-sm font-medium text-[#2a241d]">Show cost build</p>
                </div>
                <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-[#9e927f] transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </summary>

              <Card className="mt-4 overflow-hidden border-[#d2c5b5] bg-white/90 p-0">
                <div className="border-b border-[#e0d5c7] px-6 py-5">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-[#897b6a]">How $0.02 is reached</p>
                  <p className="mt-2 text-sm leading-relaxed text-[#5f554b]">
                    10-turn session · KB retrieval every turn · one tool call · one screenshot. Gemini 2.5 Flash-Lite, no caching assumed.
                  </p>
                </div>

                <div className="space-y-5 px-6 py-5">
                  <div>
                    <p className="mb-3 text-[10px] uppercase tracking-[0.22em] text-[#8d7e6b]">Model tokens</p>
                    <div className="space-y-2">
                      <div className="flex items-baseline justify-between">
                        <span className="text-sm text-[#4a4138]">80,000 input tokens <span className="text-xs text-[#8d7e6b]">@ $0.10 / 1M</span></span>
                        <span className="tabular-nums text-sm font-semibold text-[#1e2d4a]">$0.0080</span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-sm text-[#4a4138]">4,000 output tokens <span className="text-xs text-[#8d7e6b]">@ $0.40 / 1M</span></span>
                        <span className="tabular-nums text-sm font-semibold text-[#1e2d4a]">$0.0016</span>
                      </div>
                      <div className="flex items-baseline justify-between border-t border-[#ede5d8] pt-2">
                        <span className="text-xs text-[#8d7e6b]">Model subtotal</span>
                        <span className="tabular-nums text-sm font-semibold text-[#1e2d4a]">$0.0096</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="mb-3 text-[10px] uppercase tracking-[0.22em] text-[#8d7e6b]">Infrastructure</p>
                    <div className="space-y-2">
                      <div className="flex items-baseline justify-between">
                        <span className="text-sm text-[#4a4138]">KB vector search <span className="text-xs text-[#8d7e6b]">10 round-trips</span></span>
                        <span className="tabular-nums text-sm font-semibold text-[#1e2d4a]">$0.0006</span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-sm text-[#4a4138]">Database <span className="text-xs text-[#8d7e6b]">reads + session writes</span></span>
                        <span className="tabular-nums text-sm font-semibold text-[#1e2d4a]">$0.0025</span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-sm text-[#4a4138]">Compute + event writes <span className="text-xs text-[#8d7e6b]">streaming + trace</span></span>
                        <span className="tabular-nums text-sm font-semibold text-[#1e2d4a]">$0.0033</span>
                      </div>
                      <div className="flex items-baseline justify-between border-t border-[#ede5d8] pt-2">
                        <span className="text-xs text-[#8d7e6b]">Infrastructure subtotal</span>
                        <span className="tabular-nums text-sm font-semibold text-[#1e2d4a]">$0.0064</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-[#d2c5b5] bg-[rgba(30,45,74,0.06)] px-4 py-4">
                    <span className="text-sm font-semibold text-[#2a241d]">Total (10-turn ceiling)</span>
                    <span className="tabular-nums text-2xl font-semibold text-[#1e2d4a]" style={headingStyle}>$0.016</span>
                  </div>

                  <p className="text-xs leading-relaxed text-[#8d7e6b]">
                    Most sessions land much lower. A typical 3–5 turn interaction is ~$0.005, and at $0.20 per resolution
                    the 10× delivery margin still holds in the heavier case.
                  </p>
                </div>
              </Card>
            </details>
          </div>
        </section>

        <section
          id="relevance"
          className="mt-8 grid gap-6 scroll-mt-28 rounded-[2rem] border border-[#d8ccbc] bg-[rgba(250,246,239,0.86)] p-4 sm:p-6 lg:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.28fr)] lg:gap-10 lg:p-8"
        >
          <SectionHeading
            index="06"
            eyebrow="Durability"
            title="The moat is workflow ownership."
            text="Better chat will spread. Embedded control is harder to replace."
          />
          <Card className="border-[#d4c7b6] bg-[rgba(255,252,247,0.94)] p-6 text-[#2f2a25]">
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#977c57]">PMF half-life</p>
            <h3 className="mt-3 text-2xl font-semibold leading-tight text-[#24324c]" style={headingStyle}>
              Chat quality improves everywhere. Embedded workflow control does not.
            </h3>
            <p className="mt-3 max-w-3xl text-base leading-relaxed text-[#4a4138]">
              Embedded context plus approved action. That is the durable layer once teams depend on workflow ownership.
            </p>
          </Card>
        </section>
      </div>
    </main>
  );
}
