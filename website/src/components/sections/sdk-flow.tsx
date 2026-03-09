"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Card } from "@/components/ui/card";
import { iosSdkRepoUrl, nextjsSdkNpmUrl } from "@/lib/urls";

type Platform = "ios" | "nextjs";
type IosStepId = "define-functions" | "configure-runtime" | "embed-chat";
type NextjsStepId = "install" | "token-route" | "embed-widget";
type StepId = IosStepId | NextjsStepId;

interface IntegrationStep {
  id: StepId;
  label: string;
  title: string;
  summary: string;
  lifecyclePhase: string;
  lifecycleDetails: string[];
  code: string;
  notes: string[];
}

const IOS_STEPS: IntegrationStep[] = [
  {
    id: "define-functions",
    label: "Step 1",
    title: "Define tool functions with @ResolveKit",
    summary:
      "Attach the @ResolveKit macro to any struct conforming to ResolveKitFunction. The macro generates the JSON schema and invocation glue automatically.",
    lifecyclePhase: "Function Source",
    lifecycleDetails: [
      "Runtime resolves inline functions + function packs.",
      "Function names must stay unique across all sources.",
    ],
    code: `import ResolveKitCore

@ResolveKit(name: "set_lights", description: "Turn lights on or off in a room", timeout: 30)
struct SetLights: ResolveKitFunction {
    func perform(room: String, on: Bool) async throws -> Bool {
        // your implementation
        return on
    }
}

@ResolveKit(name: "get_weather", description: "Get current weather for a city", timeout: 10)
struct GetWeather: ResolveKitFunction {
    func perform(city: String) async throws -> String {
        "\\(city): sunny, 22°C"
    }
}`,
    notes: [
      "Use stable snake_case names — the backend stores tools by function name.",
      "Each function must be async throws and implemented on a struct.",
    ],
  },
  {
    id: "configure-runtime",
    label: "Step 2",
    title: "Configure ResolveKitRuntime with app context",
    summary:
      "Wire ResolveKitConfiguration to your existing auth, device identity, and app context so each session is personalized and eligibility-aware.",
    lifecyclePhase: "Session Startup",
    lifecycleDetails: [
      "start() checks SDK compatibility and syncs function definitions.",
      "Session payload includes client info, llm_context, and entitlements.",
    ],
    code: `import ResolveKitUI

let runtime = ResolveKitRuntime(
    configuration: ResolveKitConfiguration(
        baseURL: URL(string: "https://agent.resolvekit.app")!,
        apiKeyProvider: { tokenStore.resolveKitAPIKey },
        deviceIDProvider: { deviceService.stableID },
        llmContextProvider: {
            [
                "account_mode": .string(session.accountMode),
                "location": .string(session.cityName),
                "network": .object([
                    "type": .string(network.type),
                    "quality": .string(network.quality)
                ])
            ]
        },
        functions: [SetLights.self, GetWeather.self]
    )
)`,
    notes: [
      "Use llmContextProvider for context that should directly shape LLM behavior.",
      "The SDK sends platform, app version, and SDK diagnostics automatically.",
    ],
  },
  {
    id: "embed-chat",
    label: "Step 3",
    title: "Embed ResolveKitChatView in SwiftUI",
    summary:
      "Attach the runtime to your UI. The SDK handles streaming responses, the tool-approval checklist, and the message composer lifecycle.",
    lifecyclePhase: "Turn Loop",
    lifecycleDetails: [
      "sendMessage pushes a turn over WebSocket (SSE fallback supported).",
      "Tool requests are batched — user approves or declines before execution.",
    ],
    code: `import SwiftUI
import ResolveKitUI

struct ContentView: View {
    @StateObject private var runtime = ResolveKitRuntime(
        configuration: ResolveKitConfiguration(
            baseURL: URL(string: "https://agent.resolvekit.app")!,
            apiKeyProvider: { tokenStore.resolveKitAPIKey },
            functions: [SetLights.self, GetWeather.self]
        )
    )

    var body: some View {
        ResolveKitChatView(runtime: runtime)
    }
}`,
    notes: [
      "ResolveKitChatView calls runtime.start() automatically on appear.",
      "Call runtime.sendMessage / approveToolCallBatch directly for custom UIs.",
    ],
  },
];

const NEXTJS_STEPS: IntegrationStep[] = [
  {
    id: "install",
    label: "Step 1",
    title: "Install the package and set env vars",
    summary:
      "Add @resolvekit/nextjs from npm, then configure your API key and agent URL in .env.local.",
    lifecyclePhase: "Project Setup",
    lifecycleDetails: [
      "RESOLVEKIT_API_KEY stays server-side only.",
      "NEXT_PUBLIC_RESOLVEKIT_AGENT_URL is exposed to the browser.",
    ],
    code: `# Install
npm install @resolvekit/nextjs

# .env.local
RESOLVEKIT_API_KEY=rk_live_...
NEXT_PUBLIC_RESOLVEKIT_AGENT_URL=https://agent.resolvekit.app`,
    notes: [
      "Get your API key from the dashboard under App → API Keys.",
      "Never expose RESOLVEKIT_API_KEY to the browser — keep it server-side.",
    ],
  },
  {
    id: "token-route",
    label: "Step 2",
    title: "Add the client token route",
    summary:
      "Create a Next.js Route Handler that issues short-lived tokens to authenticated browser clients. ResolveKit never sees your API key directly.",
    lifecyclePhase: "Auth Handshake",
    lifecycleDetails: [
      "Browser fetches a short-lived token — not the raw API key.",
      "authorizeRequest lets you gate access by session, role, or plan.",
    ],
    code: `// app/api/resolvekit/client-token/route.ts
import { createResolveKitClientTokenHandler } from "@resolvekit/nextjs/server";

const handler = createResolveKitClientTokenHandler({
  agentBaseUrl: process.env.NEXT_PUBLIC_RESOLVEKIT_AGENT_URL!,
  resolveApiKey: () => process.env.RESOLVEKIT_API_KEY,
  authorizeRequest: async (req) => {
    // return true to allow, false to reject
    const session = await getServerSession(req);
    return Boolean(session?.user);
  },
});

export const POST = handler;`,
    notes: [
      "authorizeRequest receives the raw Next.js Request — check cookies, headers, or session.",
      "Omit authorizeRequest only for public/unauthenticated chat surfaces.",
    ],
  },
  {
    id: "embed-widget",
    label: "Step 3",
    title: "Embed ResolveKitWidget in your app",
    summary:
      "Wrap your layout with ResolveKitProvider and drop in ResolveKitWidget. The SDK fetches a token from your route, opens a session, and handles the full chat lifecycle.",
    lifecyclePhase: "Turn Loop",
    lifecycleDetails: [
      "Provider fetches a token from your /api/resolvekit/client-token route.",
      "Widget renders a floating launcher — no extra styling needed.",
    ],
    code: `// components/resolvekit-chat.tsx
"use client";

import {
  ResolveKitProvider,
  ResolveKitWidget,
  createClientTokenAuthProvider,
} from "@resolvekit/nextjs";
import { useMemo } from "react";

export function ResolveKitChat() {
  const authProvider = useMemo(
    () => createClientTokenAuthProvider({
      endpoint: "/api/resolvekit/client-token",
    }),
    []
  );

  return (
    <ResolveKitProvider configuration={{
      baseUrl: process.env.NEXT_PUBLIC_RESOLVEKIT_AGENT_URL!,
      authProvider,
      deviceIdPersistence: "localStorage",
    }}>
      <ResolveKitWidget launcherLabel="Need help?" />
    </ResolveKitProvider>
  );
}`,
    notes: [
      "Add <ResolveKitChat /> to your root layout to make it available site-wide.",
      "Use ResolveKitRuntime directly for headless or custom chat UI scenarios.",
    ],
  },
];

export function SdkFlow() {
  const [platform, setPlatform] = useState<Platform>("ios");
  const [iosStepId, setIosStepId] = useState<IosStepId>("define-functions");
  const [nextjsStepId, setNextjsStepId] = useState<NextjsStepId>("install");

  const steps = platform === "ios" ? IOS_STEPS : NEXTJS_STEPS;
  const activeStepId = platform === "ios" ? iosStepId : nextjsStepId;

  const activeStep = useMemo(
    () => steps.find((s) => s.id === activeStepId) ?? steps[0],
    [steps, activeStepId],
  );

  function setActiveStepId(id: StepId) {
    if (platform === "ios") setIosStepId(id as IosStepId);
    else setNextjsStepId(id as NextjsStepId);
  }

  return (
    <section className="mt-12">
      <Card className="p-6 md:p-8 animate-fade-up">
        {/* Platform picker */}
        <div className="flex items-center gap-2 mb-6">
          <button
            type="button"
            onClick={() => setPlatform("ios")}
            className={`rounded-full border px-3.5 py-1 text-xs font-semibold transition-colors ${
              platform === "ios"
                ? "border-primary bg-primary text-white"
                : "border-border bg-white/70 text-muted-foreground hover:border-primary/40"
            }`}
          >
            iOS
          </button>
          <button
            type="button"
            onClick={() => setPlatform("nextjs")}
            className={`rounded-full border px-3.5 py-1 text-xs font-semibold transition-colors ${
              platform === "nextjs"
                ? "border-primary bg-primary text-white"
                : "border-border bg-white/70 text-muted-foreground hover:border-primary/40"
            }`}
          >
            Next.js
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">How To Integrate</p>
            <h3 className="mt-2 text-2xl font-semibold leading-tight">
              {platform === "ios"
                ? "Integrate ResolveKit iOS SDK in 3 steps"
                : "Integrate ResolveKit Next.js SDK in 3 steps"}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-xl">
              {platform === "ios"
                ? "Based on the real resolvekit-ios-sdk APIs and runtime lifecycle."
                : "Based on the real @resolvekit/nextjs package APIs and Next.js App Router."}
            </p>

            <div className="mt-5 space-y-2">
              {steps.map((step) => {
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
          {platform === "ios" ? (
            <Link
              href={iosSdkRepoUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-semibold text-primary hover:opacity-85"
            >
              Get iOS SDK on GitHub
            </Link>
          ) : (
            <Link
              href={nextjsSdkNpmUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-semibold text-primary hover:opacity-85"
            >
              Get Next.js SDK on npm
            </Link>
          )}
        </div>
      </Card>
    </section>
  );
}
