import type { Metadata } from "next";

import { UseCasePage } from "@/components/use-case-page";
import { siteUrl } from "@/lib/site";

const title = "Reduce Support Tickets In App";
const description =
  "Use ResolveKit to reduce support tickets in-app by resolving repeatable issues where they happen, with product context, approved actions, and operator-visible traces.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/use-cases/reduce-support-tickets-in-app",
  },
  openGraph: {
    type: "website",
    title: `${title} | ResolveKit`,
    description,
    url: `${siteUrl}/use-cases/reduce-support-tickets-in-app`,
  },
  twitter: {
    card: "summary",
    title: `${title} | ResolveKit`,
    description,
  },
};

const schema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: `ResolveKit ${title}`,
  url: `${siteUrl}/use-cases/reduce-support-tickets-in-app`,
  description,
};

export default function ReduceSupportTicketsInAppPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <UseCasePage
        eyebrow="Use case"
        title="Reduce support tickets in-app by resolving the repeatable cases earlier"
        description="Most support queues are inflated by issues that are known, explainable, and often fixable without a human ever opening the ticket. ResolveKit is designed to cut that avoidable volume inside the product itself."
        intro="This is not about hiding support behind a chatbot. It is about handling the known paths better: account confusion, onboarding blockers, settings mistakes, entitlement mismatches, and similar issues that do not need a fresh manual investigation every time."
        problemTitle="Queue volume is often a product-resolution problem, not just a staffing problem"
        problemPoints={[
          "Support volume grows when users cannot understand what went wrong or what to do next inside the product.",
          "Teams keep paying human operators to rediscover the same causes because context and action paths are not available at the point of failure.",
          "Help centers and generic assistants may deflect some questions, but they usually do not reduce the cases that actually require product-aware handling.",
        ]}
        fitTitle="ResolveKit reduces ticket creation by resolving known blockers upstream"
        fitPoints={[
          "The assistant can identify the likely issue using product context rather than only a user-written symptom description.",
          "Approved actions can clear repeatable problems immediately instead of forcing the case into a support queue.",
          "Escalations carry forward context and traces, so the remaining tickets are cleaner and faster to handle.",
        ]}
        highlights={[
          {
            title: "Less repetitive queue work",
            description:
              "The support team spends less time on the same known blockers and more time on the cases that genuinely require human judgment.",
          },
          {
            title: "Better resolution timing",
            description:
              "Users get help in the exact session where the issue occurs, which lowers abandonment and reduces the delay between problem and fix.",
          },
          {
            title: "Higher-quality escalations",
            description:
              "When a human does need to step in, the case arrives with captured context, action history, and operator-relevant trace data.",
          },
        ]}
        sections={[
          {
            eyebrow: "Good fit issues",
            title: "The types of tickets that are often preventable",
            points: [
              "Login, verification, and access confusion where the root cause is already knowable inside the app flow.",
              "Entitlement, subscription, or feature-access mismatches that can be explained and sometimes corrected with an approved action.",
              "Onboarding and settings blockers where the user needs context-aware help rather than another generic article link.",
            ],
          },
          {
            eyebrow: "What makes the difference",
            title: "Why reducing tickets in-app is more than adding a chatbot",
            points: [
              "The assistant has to understand the product moment, not just the question typed into chat.",
              "The workflow has to support allowed actions, approvals, and traceability so teams can trust the outcome.",
              "The remaining support queue has to get cleaner as more cases resolve upstream, not just hide failure behind a nicer chat interface.",
            ],
          },
        ]}
        ctaTitle="Cut avoidable support volume where the issue starts"
        ctaText="If the same support tickets keep showing up because the product has no effective in-app resolution layer, ResolveKit is built to reduce that repeat load without sacrificing operator control."
      />
    </>
  );
}
