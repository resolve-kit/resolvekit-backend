import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { dashboardRegisterUrl, feedbackIssuesUrl } from "@/lib/urls";

type BulletSection = {
  eyebrow: string;
  title: string;
  points: string[];
};

type Highlight = {
  title: string;
  description: string;
};

type UseCasePageProps = {
  eyebrow: string;
  title: string;
  description: string;
  intro: string;
  problemTitle: string;
  problemPoints: string[];
  fitTitle: string;
  fitPoints: string[];
  highlights: Highlight[];
  sections: BulletSection[];
  ctaTitle: string;
  ctaText: string;
  children?: ReactNode;
};

export function UseCasePage({
  eyebrow,
  title,
  description,
  intro,
  problemTitle,
  problemPoints,
  fitTitle,
  fitPoints,
  highlights,
  sections,
  ctaTitle,
  ctaText,
  children,
}: UseCasePageProps) {
  return (
    <main className="mx-auto max-w-6xl px-6 pb-20 pt-10 md:pb-24">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          className="rounded-full border border-[#d6dee6] bg-white px-4 py-2 text-sm font-medium text-[#10273f] transition hover:border-[#a6bdd4]"
        >
          ResolveKit
        </Link>
        <div className="flex flex-wrap gap-2 text-sm text-[#5d6f80]">
          <Link href="/pricing" className="rounded-full px-3 py-2 transition hover:bg-white/65 hover:text-[#10273f]">
            Pricing
          </Link>
          <a href={feedbackIssuesUrl} target="_blank" rel="noreferrer" className="rounded-full px-3 py-2 transition hover:bg-white/65 hover:text-[#10273f]">
            Feedback
          </a>
        </div>
      </header>

      <section className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)] lg:items-start">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.2em] text-[#6b7785]">{eyebrow}</p>
          <h1 className="mt-2 text-4xl font-semibold leading-tight text-[#10273f] md:text-5xl">{title}</h1>
          <p className="mt-4 text-base leading-relaxed text-[#4b5f72]">{description}</p>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[#5d6f80]">{intro}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={dashboardRegisterUrl}>
              <Button>Start Free</Button>
            </a>
            <Link href="/pricing">
              <Button variant="outline">See pricing</Button>
            </Link>
          </div>
        </div>

        <Card className="border-[#d6dee6] bg-[#fbfcfd] p-6 shadow-none md:p-7">
          <p className="text-xs uppercase tracking-[0.2em] text-[#6b7785]">Why teams look for this</p>
          <h2 className="mt-2 text-2xl font-semibold leading-tight text-[#10273f]">{problemTitle}</h2>
          <div className="mt-5 space-y-4">
            {problemPoints.map((point) => (
              <p key={point} className="border-l border-[#d3dce5] pl-4 text-sm leading-relaxed text-[#4b5f72]">
                {point}
              </p>
            ))}
          </div>
        </Card>
      </section>

      <section className="mt-16">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.2em] text-[#6b7785]">Why ResolveKit fits</p>
          <h2 className="mt-2 text-3xl font-semibold leading-tight text-[#10273f]">{fitTitle}</h2>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {fitPoints.map((point, idx) => (
            <div key={point} className={`rounded-2xl border border-[#d6dee6] px-5 py-5 ${idx === 1 ? "bg-[#f7f9fb]" : "bg-[#fbfcfd]"}`}>
              <p className="text-sm leading-relaxed text-[#4b5f72]">{point}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <div className="grid gap-6 lg:grid-cols-3">
          {highlights.map((item) => (
            <Card key={item.title} className="border-[#d6dee6] p-6 shadow-none md:p-7">
              <p className="text-xs uppercase tracking-[0.2em] text-[#6b7785]">What changes</p>
              <h3 className="mt-2 text-xl font-semibold leading-tight text-[#10273f]">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[#4b5f72]">{item.description}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-16 grid gap-8 lg:grid-cols-2">
        {sections.map((section) => (
          <Card key={section.title} className="border-[#d6dee6] p-6 shadow-none md:p-7">
            <p className="text-xs uppercase tracking-[0.2em] text-[#6b7785]">{section.eyebrow}</p>
            <h2 className="mt-2 text-2xl font-semibold leading-tight text-[#10273f]">{section.title}</h2>
            <div className="mt-5 space-y-3">
              {section.points.map((point) => (
                <p key={point} className="border-l border-[#d3dce5] pl-4 text-sm leading-relaxed text-[#4b5f72]">
                  {point}
                </p>
              ))}
            </div>
          </Card>
        ))}
      </section>

      {children}

      <section className="mt-16">
        <Card className="border-[#d6dee6] p-6 shadow-none md:p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-[#6b7785]">Next step</p>
          <h2 className="mt-2 text-3xl font-semibold leading-tight text-[#10273f]">{ctaTitle}</h2>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[#4b5f72]">{ctaText}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href={dashboardRegisterUrl}>
              <Button>Start Free</Button>
            </a>
            <Link href="/pricing">
              <Button variant="outline">View pricing</Button>
            </Link>
          </div>
        </Card>
      </section>
    </main>
  );
}
