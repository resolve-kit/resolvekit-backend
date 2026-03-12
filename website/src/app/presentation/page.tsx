import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { dashboardLoginUrl, dashboardRegisterUrl } from "@/lib/urls";

export const metadata: Metadata = {
  title: "ResolveKit | Presentation",
  description:
    "ResolveKit presentation: product thesis, go-to-market, and competitive landscape for the embedded AI support category.",
};

const SECTION_LINKS = [
  { href: "#product", label: "What It Is" },
  { href: "#gtm", label: "Go-to-market" },
  { href: "#competition", label: "Competition" },
] as const;

const PRODUCT_POINTS = [
  {
    title: "Everyone has a chatbot.",
    text: "Most support products now ship an AI box. That surface alone is no longer a moat.",
  },
  {
    title: "ResolveKit closes the context gap.",
    text: "ResolveKit is an SDK with a multimodal knowledge base, so the agent is embedded into the product and grounded in UI state, screenshots, docs, and real app flows instead of generic help-center retrieval alone.",
  },
  {
    title: "ResolveKit closes the action gap.",
    text: "Approved tools let the assistant do the fix, not just describe the next step. That moves the product from answer engine to resolution engine.",
  },
  {
    title: "Deeper integration compounds stickiness.",
    text: "Once the assistant is wired into app surfaces, operator controls, approvals, traces, and backend actions, it is materially harder to rip out than a widget-first bot.",
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
    src: "/presentation/MOV_6069.mp4",
    aspect: "portrait",
  },
  {
    title: "Operator-grade mobile workflow",
    text: "ResolveKit is not just a chat UI. It is a product surface that can carry context, approvals, and guided action cleanly on mobile.",
    src: "/presentation/MOV_2877.mp4",
    aspect: "portrait",
  },
  {
    title: "Command center and LLM control",
    text: "The control plane is where teams tune prompts, models, limits, traces, and rollout behavior once usage becomes operationally important.",
    src: "/presentation/ResolveKit_console_llms.mp4",
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
        <header className="sticky top-3 z-40">
          <div className="rounded-[1.6rem] border border-[#d7ccbb]/90 bg-[rgba(250,245,236,0.92)] px-4 py-3 shadow-card backdrop-blur md:px-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/"
                  className="inline-flex items-end leading-none"
                  aria-label="RESOLVEkit"
                  style={{ fontFamily: "\"Mona Sans\", \"Avenir Next\", sans-serif" }}
                >
                  <span className="text-[20px] font-normal uppercase tracking-[0.2em] text-[#0d2f57]">RESOLVE</span>
                  <span className="ml-[0.12em] text-[10px] font-normal tracking-[0.2em] text-black">kit</span>
                </Link>
                <span className="hidden h-4 w-px bg-[#c9baa5] lg:block" />
                <p className="text-[11px] uppercase tracking-[0.24em] text-[#7b7165]">Category brief</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {SECTION_LINKS.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="rounded-full border border-[#d5c7b4] bg-white/70 px-3 py-1.5 text-xs font-semibold tracking-[0.14em] text-[#5b5249] transition hover:border-[#111] hover:text-[#111]"
                  >
                    {link.label}
                  </a>
                ))}
                <a href={dashboardRegisterUrl} className="hidden sm:block">
                  <Button className="bg-[#121212] text-white hover:bg-[#24211d] hover:text-white">Start Free</Button>
                </a>
              </div>
            </div>
          </div>
        </header>

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

          <Card className="border-[#d7ccbb] bg-[linear-gradient(180deg,rgba(255,251,245,0.98),rgba(245,238,228,0.96))] p-5 text-[#1d2436] animate-fade-up [animation-delay:120ms]">
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#b08b52]">Why now</p>
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-[#ded2c1] bg-[rgba(255,255,255,0.68)] p-4">
                <p className="text-4xl font-semibold text-[#1e2d4a]">$250M</p>
                <p className="mt-2 text-base leading-relaxed text-[#5b5249]">
                  Intercom announced a $250M financing in March 2026 around the Customer Agent story. Capital is
                  validating the category, but the product surface is still open.
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
        </section>

        <section
          id="product"
          className="mt-8 grid gap-6 scroll-mt-28 rounded-[2rem] border border-[#d8ccbc] bg-[rgba(255,250,243,0.74)] p-4 sm:p-6 lg:mt-10 lg:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.28fr)] lg:gap-10 lg:p-8"
        >
          <SectionHeading
            index="01"
            eyebrow="What the product is"
            title="A support agent that is part of the product, not bolted onto it."
            text="The differentiator is not that ResolveKit can answer questions. The differentiator is that it sits inside the workflow, sees more context, can take approved action, and leaves behind an operator-grade command trace."
          />
          <div className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-2">
              {PRODUCT_POINTS.map((point, index) => (
                <InsightCard
                  key={point.title}
                  title={point.title}
                  text={point.text}
                  className={index === 0 ? "xl:col-span-2" : ""}
                />
              ))}
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              {DEMOS.slice(0, 2).map((demo) => (
                <DemoCard key={demo.src} title={demo.title} text={demo.text} src={demo.src} aspect={demo.aspect} />
              ))}
            </div>
          </div>
        </section>

        <section
          id="gtm"
          className="mt-8 grid gap-6 scroll-mt-28 rounded-[2rem] border border-[#d6cab9] bg-[linear-gradient(180deg,rgba(255,252,247,0.82),rgba(242,234,222,0.92))] p-4 sm:p-6 lg:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.28fr)] lg:gap-10 lg:p-8"
        >
          <SectionHeading
            index="02"
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

              <DemoCard title={DEMOS[2].title} text={DEMOS[2].text} src={DEMOS[2].src} aspect={DEMOS[2].aspect} />
            </div>
          </div>
        </section>

        <section
          id="competition"
          className="mt-8 grid gap-6 scroll-mt-28 rounded-[2rem] border border-[#d8cdbf] bg-[rgba(251,247,240,0.82)] p-4 sm:p-6 lg:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.28fr)] lg:gap-10 lg:p-8"
        >
          <SectionHeading
            index="03"
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
