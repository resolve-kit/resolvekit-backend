import type { Metadata } from "next";

import { UseCasePage } from "@/components/use-case-page";
import { siteUrl } from "@/lib/site";

const title = "In-App Customer Support";
const description =
  "Use ResolveKit for in-app customer support that resolves repeatable product issues where they happen, with approvals, traceability, and operator control.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/use-cases/in-app-customer-support",
  },
  openGraph: {
    type: "website",
    title: `${title} | ResolveKit`,
    description,
    url: `${siteUrl}/use-cases/in-app-customer-support`,
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
  url: `${siteUrl}/use-cases/in-app-customer-support`,
  description,
};

export default function InAppCustomerSupportPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <UseCasePage
        eyebrow="Use case"
        title="In-app customer support that resolves issues where the user gets stuck"
        description="In-app customer support only matters if it helps users move forward inside the failing moment. ResolveKit embeds a product-aware support layer in the app so repeatable blockers can be explained, approved actions can run when allowed, and support teams inherit a usable trace when escalation is still needed."
        intro="This is for product teams that are tired of forcing users out to help centers, generic chat widgets, or ticket queues just to solve the same account, billing, onboarding, and settings problems over and over again."
        problemTitle="Most in-app support still behaves like a lightweight intake form"
        problemPoints={[
          "Users ask for help inside the product, but the support layer still lacks route, version, entitlement, and workflow context.",
          "Support teams end up re-triaging the same issues because the chat surface did not actually resolve anything.",
          "A generic assistant can deflect simple questions, but it usually cannot explain the exact blocker or move the user through the next safe step.",
        ]}
        fitTitle="ResolveKit turns in-app support into a resolution surface"
        fitPoints={[
          "The assistant can understand the product context around the issue instead of answering from static documentation alone.",
          "Teams can connect approved actions so support can become actual resolution instead of endless explanation.",
          "Operators keep control through policy, approvals, and trace logs rather than trusting a black-box widget.",
        ]}
        highlights={[
          {
            title: "Fewer avoidable tickets",
            description:
              "Repeatable blockers can be handled where they happen, reducing the number of cases that reach queue-based support in the first place.",
          },
          {
            title: "A better user moment",
            description:
              "Instead of leaving the app to search documentation or wait for support, the user gets guidance and allowed actions in the same workflow.",
          },
          {
            title: "Cleaner support handoffs",
            description:
              "When a human still needs to step in, the escalation can include context and trace data rather than a blank-slate ticket.",
          },
        ]}
        sections={[
          {
            eyebrow: "Common scenarios",
            title: "Where in-app customer support usually pays off first",
            points: [
              "Account access and verification flows where users are stuck but the issue can often be explained or resolved immediately.",
              "Subscription, billing, and entitlement confusion where the user needs a product-aware answer and sometimes an approved sync or refresh.",
              "Onboarding and settings blockers where contextual guidance is better than sending the user to a generic help article.",
            ],
          },
          {
            eyebrow: "Operational reality",
            title: "What the team can actually verify afterward",
            points: [
              "What route or screen the user was on, what policy version applied, and what context the assistant used to answer.",
              "What the assistant proposed, whether approval was required, and what action actually ran inside the session.",
              "Whether the issue resolved in-product or still required escalation to a human operator.",
            ],
          },
        ]}
        ctaTitle="Make in-app support do more than collect a ticket"
        ctaText="If your team already has repeatable support issues inside the product, the real opportunity is to resolve more of them before they become queue work. ResolveKit is built for that layer."
      />
    </>
  );
}
