import type { Metadata } from "next";
import Link from "next/link";

import { HeroChatPreview } from "@/components/hero-chat-preview";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { siteName, siteUrl } from "@/lib/site";
import { dashboardLoginUrl, dashboardRegisterUrl, feedbackIssuesUrl, iosSdkRepoUrl, nextjsSdkNpmUrl } from "@/lib/urls";

const homeTitle = "In-app support that helps users get unstuck";
const homeDescription =
  "ResolveKit helps users find features, understand functionality, and resolve product issues inside the app with product context, approvals, and operator control.";

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

const steps = [
  "User asks inside the app",
  "Agent sees product context",
  "Agent explains or guides the next step",
  "Approved actions run when useful",
];

const outcomes = [
  {
    title: "Feature discovery",
    description: "Help users find where something lives and how to use it without leaving the app.",
  },
  {
    title: "Functionality guidance",
    description: "Explain why something is not working and what the user should do next in plain language.",
  },
  {
    title: "Safer action-taking",
    description: "Run allowed actions with approvals and leave a trace operators can review later.",
  },
];

const proof = [
  {
    label: "For users",
    title: "Less confusion in the moment",
    text: "Help appears where the issue happens, so users do not need to bounce to a help center or wait for support.",
  },
  {
    label: "For operators",
    title: "Visible, reviewable support flows",
    text: "Operators can inspect context, action paths, approval checkpoints, and outcomes instead of trusting a black box.",
  },
  {
    label: "For teams",
    title: "Fewer repetitive tickets",
    text: "Resolve repeatable questions and workflow confusion earlier so the support queue gets cleaner.",
  },
];

const useCases = [
  {
    href: "/use-cases/in-app-customer-support",
    title: "In-app customer support",
    description: "Resolve product confusion where the user gets stuck.",
  },
  {
    href: "/use-cases/ai-support-with-approvals",
    title: "AI support with approvals",
    description: "Useful automation without losing control.",
  },
  {
    href: "/use-cases/reduce-support-tickets-in-app",
    title: "Reduce support tickets in app",
    description: "Handle repeatable issues before they become queue work.",
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
    <main className="mx-auto max-w-6xl px-6 pb-24 pt-10 md:pt-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

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
            <Button variant="outline">Dashboard</Button>
          </a>
        </div>
      </header>

      <section className="mt-14 grid gap-12 lg:grid-cols-[minmax(0,1.02fr)_420px] lg:items-center">
        <div className="max-w-3xl animate-fade-up">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#6b7785]">Mobile-first in-app support</p>
          <h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-[0.98] tracking-[-0.04em] text-[#10273f] sm:text-6xl">
            Help users find features, fix confusion, and get unstuck without leaving the app.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#4b5f72]">
            ResolveKit adds an in-app support agent that understands product context, guides users through functionality,
            and can take approved actions when needed.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={dashboardRegisterUrl}>
              <Button>Start Free</Button>
            </a>
            <Link href="/pricing">
              <Button variant="outline">See pricing</Button>
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-sm text-[#5d6f80]">
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
        <div className="animate-fade-up-delay animate-float-soft">
          <HeroChatPreview />
        </div>
      </section>

      <section className="mt-14 grid gap-4 md:grid-cols-3">
        {outcomes.map((item, idx) => (
          <div
            key={item.title}
            className={`rounded-2xl border border-[#d6dee6] px-5 py-5 transition duration-300 hover:-translate-y-1 hover:border-[#a6bdd4] hover:shadow-[0_14px_40px_rgba(29,65,105,0.08)] ${idx === 1 ? "bg-[#f7f9fb]" : "bg-[#fbfcfd]"}`}
          >
            <p className="text-base font-semibold text-[#10273f]">{item.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-[#4b5f72]">{item.description}</p>
          </div>
        ))}
      </section>

      <section className="mt-20 grid gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-start">
        <div className="max-w-xl">
          <p className="text-xs uppercase tracking-[0.2em] text-[#6b7785]">How it works</p>
          <h2 className="mt-2 text-3xl font-semibold leading-tight text-[#10273f]">
            Clear support flow. Lower cognitive load.
          </h2>
          <div className="mt-6 space-y-3">
            {steps.map((step) => (
              <p key={step} className="border-l border-[#d3dce5] pl-4 text-sm leading-relaxed text-[#4b5f72]">
                {step}
              </p>
            ))}
          </div>
        </div>
        <Card className="border-[#d6dee6] bg-[#fbfcfd] p-6 shadow-none md:p-7">
          <p className="text-xs uppercase tracking-[0.2em] text-[#6b7785]">Why it matters</p>
          <h3 className="mt-2 text-2xl font-semibold leading-tight text-[#10273f]">
            Most support tools deflect. ResolveKit helps users move forward.
          </h3>
          <p className="mt-4 text-sm leading-relaxed text-[#4b5f72]">
            The goal is not a prettier chatbot. The goal is to help users understand the product, find the right
            functionality, and resolve repeatable problems inside the moment where they happen.
          </p>
        </Card>
      </section>

      <section className="mt-20">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.2em] text-[#6b7785]">Proof</p>
          <h2 className="mt-2 text-3xl font-semibold leading-tight text-[#10273f]">
            Useful for users. Reviewable for teams.
          </h2>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {proof.map((item) => (
            <Card key={item.title} className="border-[#d6dee6] p-6 shadow-none transition duration-300 hover:-translate-y-1 hover:border-[#a6bdd4] hover:shadow-[0_14px_40px_rgba(29,65,105,0.08)]">
              <p className="text-xs uppercase tracking-[0.2em] text-[#6b7785]">{item.label}</p>
              <h3 className="mt-2 text-xl font-semibold text-[#10273f]">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[#4b5f72]">{item.text}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-20">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.2em] text-[#6b7785]">Use cases</p>
          <h2 className="mt-2 text-3xl font-semibold leading-tight text-[#10273f]">
            Start with the support problem you actually have.
          </h2>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {useCases.map((item, idx) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-2xl border border-[#d6dee6] px-5 py-5 transition duration-300 hover:-translate-y-1 hover:border-[#a6bdd4] hover:shadow-[0_14px_40px_rgba(29,65,105,0.08)] ${idx === 1 ? "bg-[#f7f9fb]" : "bg-[#fbfcfd]"}`}
            >
              <p className="text-base font-semibold text-[#10273f]">{item.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-[#4b5f72]">{item.description}</p>
              <p className="mt-4 text-sm font-medium text-[#214d76]">Read more →</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-20">
        <Card className="border-[#d6dee6] bg-[#f7f9fb] p-6 shadow-none md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-xs uppercase tracking-[0.2em] text-[#6b7785]">Getting live</p>
              <h2 className="mt-2 text-2xl font-semibold text-[#10273f]">Start in one flow. Expand from there.</h2>
              <p className="mt-3 text-sm leading-relaxed text-[#4b5f72]">
                Pick the in-app moment where users get stuck most often, ship there first, and expand after the team
                trusts the flow.
              </p>
            </div>
            <div className="flex gap-3">
              <a href={dashboardRegisterUrl}>
                <Button>Start Free</Button>
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
