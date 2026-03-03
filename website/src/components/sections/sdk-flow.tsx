import { Card } from "@/components/ui/card";
import Link from "next/link";

interface IntegrationStep {
  label: string;
  title: string;
  summary: string;
  snippet: string;
}

const INTEGRATION_STEPS: IntegrationStep[] = [
  {
    label: "Step 1",
    title: "Define approved app functions",
    summary: "Annotate actions with @ResolveKit so the SDK can register schemas with your backend.",
    snippet: "@ResolveKit(name: \"set_lights\") struct SetLights: PlaybookFunction { ... }",
  },
  {
    label: "Step 2",
    title: "Configure runtime",
    summary: "Provide backend URL, API key provider, and your function list in PlaybookConfiguration.",
    snippet: "let runtime = PlaybookRuntime(configuration: PlaybookConfiguration(...))",
  },
  {
    label: "Step 3",
    title: "Mount chat view",
    summary: "Render PlaybookChatView(runtime:) in SwiftUI and the session/approval loop is handled for you.",
    snippet: "PlaybookChatView(runtime: runtime)",
  },
];

export function SdkFlow() {
  return (
    <section className="mt-12">
      <Card className="p-6 md:p-8 animate-fade-up">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">How To Integrate</p>
          <h3 className="mt-2 text-2xl font-semibold leading-tight">Integrate ResolveKit iOS SDK in 3 simple steps</h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Start with function definitions, wire runtime config, then render chat. Full examples live in the SDK repo.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            iOS SDK is available now. Android, Next.js, React, React Native, and Flutter SDKs are coming soon.
          </p>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {INTEGRATION_STEPS.map((step) => (
            <div key={step.label} className="rounded-xl border border-border bg-white/65 p-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{step.label}</p>
              <p className="mt-1 text-sm font-semibold">{step.title}</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{step.summary}</p>
              <code className="mt-3 block rounded-lg border border-border bg-white px-2.5 py-2 text-[11px] text-foreground">
                {step.snippet}
              </code>
            </div>
          ))}
        </div>

        <div className="mt-5">
          <Link
            href="https://github.com/Nights-Are-Late/resolvekit-ios-sdk"
            target="_blank"
            rel="noreferrer"
            className="text-sm font-semibold text-primary hover:opacity-85"
          >
            Open full SDK integration guide
          </Link>
        </div>
      </Card>
    </section>
  );
}
