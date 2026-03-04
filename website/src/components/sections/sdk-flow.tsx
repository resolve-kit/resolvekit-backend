"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Card } from "@/components/ui/card";
import { iosSdkRepoUrl } from "@/lib/urls";

type IntegrationStepId = "define-functions" | "configure-runtime" | "embed-chat";

interface IntegrationStep {
  id: IntegrationStepId;
  label: string;
  title: string;
  summary: string;
  lifecyclePhase: string;
  lifecycleDetails: string[];
  code: string;
  notes: string[];
}

const INTEGRATION_STEPS: IntegrationStep[] = [
  {
    id: "define-functions",
    label: "Step 1",
    title: "Define your tool functions with @ResolveKit",
    summary:
      "Author typed app actions as ResolveKit functions. The macro generates schema and invocation glue used by the backend and runtime.",
    lifecyclePhase: "Function Source",
    lifecycleDetails: [
      "Runtime resolves inline functions + function packs.",
      "Function names must stay unique across all sources.",
    ],
    code: `import PlaybookCore

@ResolveKit(name: "set_lights", description: "Turn lights on or off in a room", timeout: 30)
struct SetLights: PlaybookFunction {
    func perform(room: String, on: Bool) async throws -> String {
        let brightness = on ? 100 : 0
        return "Set \\(room) lights to \\(brightness)%"
    }
}

@ResolveKit(name: "get_weather", description: "Get current weather for a city", timeout: 10)
struct GetWeather: PlaybookFunction {
    func perform(city: String) async throws -> String {
        "\\(city): sunny, 22°C"
    }
}`,
    notes: [
      "Use stable snake_case names because backend stores tools by function name.",
      "Each function must be async throws and implemented on a struct.",
    ],
  },
  {
    id: "configure-runtime",
    label: "Step 2",
    title: "Configure PlaybookRuntime with app context providers",
    summary:
      "Wire PlaybookConfiguration to your existing auth, device identity, and app context so each session is personalized and eligibility-aware.",
    lifecyclePhase: "Session Startup",
    lifecycleDetails: [
      "start() checks SDK compatibility and syncs function definitions.",
      "Then creates session payload with client/llm_context/entitlements/capabilities.",
    ],
    code: `import PlaybookUI

let runtime = PlaybookRuntime(
    configuration: PlaybookConfiguration(
        baseURL: URL(string: "https://your-backend.example.com")!,
        apiKeyProvider: { tokenStore.playbookAPIKey },
        deviceIDProvider: { deviceService.stableID },
        llmContextProvider: {
            [
                "location": .string(session.cityName),
                "network": .object([
                    "type": .string(network.type),
                    "quality": .string(network.quality)
                ]),
                "account_mode": .string(session.accountMode)
            ]
        },
        entitlementsProvider: { account.isPro ? ["pro"] : ["free"] },
        capabilitiesProvider: { capabilityService.currentCapabilities },
        functionPacks: [SupportPack.self],
        functions: [SetLights.self, GetWeather.self]
    )
)`,
    notes: [
      "Use llmContextProvider for context that should directly shape LLM behavior.",
      "The SDK sends platform/app/SDK diagnostics automatically in client context.",
    ],
  },
  {
    id: "embed-chat",
    label: "Step 3",
    title: "Embed PlaybookChatView in SwiftUI",
    summary:
      "Attach runtime to your UI and let the SDK handle streaming responses, tool approval checklist, and message composer lifecycle.",
    lifecyclePhase: "Turn Loop",
    lifecycleDetails: [
      "sendMessage pushes turn over WebSocket (or SSE fallback).",
      "Tool requests are batched, then user approves or declines execution.",
    ],
    code: `import SwiftUI
import PlaybookUI

struct ContentView: View {
    @StateObject private var runtime = PlaybookRuntime(
        configuration: PlaybookConfiguration(
            baseURL: URL(string: "https://your-backend.example.com")!,
            apiKeyProvider: { tokenStore.playbookAPIKey },
            functionPacks: [SupportPack.self]
        )
    )

    var body: some View {
        PlaybookChatView(runtime: runtime)
    }
}`,
    notes: [
      "PlaybookChatView starts runtime automatically and handles approval UI.",
      "You can still call runtime.sendMessage / approveToolCallBatch directly in custom UIs.",
    ],
  },
];

export function SdkFlow() {
  const [activeStepId, setActiveStepId] = useState<IntegrationStepId>("define-functions");

  const activeStep = useMemo(
    () => INTEGRATION_STEPS.find((step) => step.id === activeStepId) ?? INTEGRATION_STEPS[0],
    [activeStepId],
  );

  return (
    <section className="mt-12">
      <Card className="p-6 md:p-8 animate-fade-up">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">How To Integrate</p>
            <h3 className="mt-2 text-2xl font-semibold leading-tight">Integrate ResolveKit iOS SDK in 3 steps</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-xl">
              This walkthrough is based on the real `resolvekit-ios-sdk` APIs and runtime lifecycle.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              iOS SDK is available now. Android, Next.js, React, React Native, and Flutter SDKs are coming soon.
            </p>

            <div className="mt-5 space-y-2">
              {INTEGRATION_STEPS.map((step) => {
                const isActive = step.id === activeStep.id;
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setActiveStepId(step.id)}
                    aria-pressed={isActive}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                      isActive
                        ? "border-primary/45 bg-primary/10"
                        : "border-border bg-white/55 hover:border-primary/35 hover:bg-white/75"
                    }`}
                  >
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{step.label}</p>
                    <p className="mt-1 text-sm font-semibold">{step.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{step.summary}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-[#f7fbff] p-4 shadow-card">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Active snippet</p>
                <p className="mt-1 text-sm font-semibold">{activeStep.title}</p>
              </div>
              <span className="rounded-full border border-border bg-white px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                {activeStep.lifecyclePhase}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {activeStep.lifecycleDetails.map((detail) => (
                <span
                  key={detail}
                  className="rounded-full border border-border bg-white/80 px-2 py-1 text-[10px] text-muted-foreground"
                >
                  {detail}
                </span>
              ))}
            </div>

            <pre className="mt-3 overflow-x-auto rounded-xl border border-border bg-white p-3 text-[11px] leading-relaxed text-foreground">
              {activeStep.code}
            </pre>

            <div className="mt-3 space-y-1">
              {activeStep.notes.map((note) => (
                <p key={note} className="text-xs text-muted-foreground">
                  • {note}
                </p>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5">
          <Link
            href={iosSdkRepoUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-semibold text-primary hover:opacity-85"
          >
            Get iOS SDK on GitHub
          </Link>
        </div>
      </Card>
    </section>
  );
}
