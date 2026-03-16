import type { Metadata } from "next";

import { UseCasePage } from "@/components/use-case-page";
import { siteUrl } from "@/lib/site";

const title = "AI Support With Approvals";
const description =
  "Use ResolveKit for AI support with approvals so teams can automate customer-facing help without losing operator control, traceability, or escalation boundaries.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/use-cases/ai-support-with-approvals",
  },
  openGraph: {
    type: "website",
    title: `${title} | ResolveKit`,
    description,
    url: `${siteUrl}/use-cases/ai-support-with-approvals`,
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
  url: `${siteUrl}/use-cases/ai-support-with-approvals`,
  description,
};

export default function AiSupportWithApprovalsPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <UseCasePage
        eyebrow="Use case"
        title="AI support with approvals for teams that need automation without losing control"
        description="ResolveKit is built for teams that want an AI support agent to do useful work, but not at the cost of operator visibility or risk control. Approvals are part of the support motion, not a bolt-on afterthought."
        intro="If your support automation can touch customer state, explain an account issue, or trigger product actions, the question is not just whether the model can answer. The question is whether the workflow stays commercially safe when the model is wrong, uncertain, or operating in a sensitive moment."
        problemTitle="Most AI support tools force a bad tradeoff"
        problemPoints={[
          "Either the assistant is too weak to do anything beyond generic deflection, or it is powerful enough to be risky without good approval boundaries.",
          "Teams often lack a clean policy layer for what can auto-run, what should stop for consent, and what must always route to a human.",
          "When something does go wrong, operators may not have a clear trace of what the assistant saw, proposed, or executed.",
        ]}
        fitTitle="ResolveKit makes approvals part of the operating model"
        fitPoints={[
          "Approval requirements can be tied to the action, the workflow, and the product context instead of handled informally.",
          "The assistant can explain what it wants to do and why before any sensitive step runs.",
          "Operators can review session traces afterward to understand what happened and refine the policy boundary.",
        ]}
        highlights={[
          {
            title: "Safer automation rollout",
            description:
              "Teams can start with tighter approval boundaries and loosen them only where the workflow is proven and acceptable.",
          },
          {
            title: "Clearer operator trust",
            description:
              "Approvals, traces, and visible action paths give support and product teams something concrete to trust and refine.",
          },
          {
            title: "Less policy improvisation",
            description:
              "Instead of deciding case by case in Slack or internal docs, the workflow itself carries the approval logic.",
          },
        ]}
        sections={[
          {
            eyebrow: "Where approvals matter",
            title: "Examples of support actions that should not be a black box",
            points: [
              "Refreshing entitlements, resending account flows, or changing account-linked state that affects the user experience.",
              "Support actions that may reveal sensitive information or have billing, access, or security implications.",
              "Any step where the team wants a human-in-the-loop boundary before the action executes in a customer-facing session.",
            ],
          },
          {
            eyebrow: "What ResolveKit adds",
            title: "Control without killing usefulness",
            points: [
              "The assistant can still explain the issue, recommend a next step, and propose the action path without blindly auto-running everything.",
              "Approval checkpoints keep the workflow transparent instead of burying risk behind vague promises of 'guardrails'.",
              "Trace data helps support, product, and engineering review the exact session rather than argue over hypotheticals.",
            ],
          },
        ]}
        ctaTitle="Ship AI support that stays useful under real operator scrutiny"
        ctaText="If your team needs support automation that can do more than answer FAQs, approvals should be part of the product design from the beginning. ResolveKit is built for that operating model."
      />
    </>
  );
}
