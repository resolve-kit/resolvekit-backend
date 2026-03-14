import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const dashboardRoot = path.resolve(import.meta.dirname, "..");

function readDashboardFile(relativePath: string): string {
  return readFileSync(path.join(dashboardRoot, relativePath), "utf8");
}

describe("ResolveKit dashboard integration source wiring", () => {
  it("uses the Next.js SDK package and server-only API key env", () => {
    const packageJson = readDashboardFile("package.json");
    const envExample = readDashboardFile("../.env.example");

    expect(packageJson).toContain('"@resolvekit/nextjs": "^1.0.4"');
    expect(packageJson).not.toContain('"@resolvekit/sdk"');

    expect(envExample).toContain("RESOLVEKIT_KEY=iaa_your_key_here");
    expect(envExample).toContain("RESOLVEKIT_SERVER_AGENT_BASE_URL=");
    expect(envExample).not.toContain("NEXT_PUBLIC_RESOLVEKIT_KEY=iaa_your_key_here");
    expect(envExample).not.toContain("RESOLVEKIT_WEB_SDK_PATH=../resolvekit-web-sdk");
  });

  it("uses the published Next.js SDK without custom local-package aliasing", () => {
    const nextConfig = readDashboardFile("next.config.ts");

    expect(nextConfig).not.toContain("resolveLinkedPackageRoot");
    expect(nextConfig).not.toContain("resolveAlias");
    expect(nextConfig).not.toContain("transpilePackages");
  });

  it("annotates the primary dashboard actions with ResolveKitAction metadata", () => {
    const expectations = [
      {
        file: "src/dashboard_pages/Apps.tsx",
        snippets: ['import { ResolveKitAction } from "@resolvekit/nextjs/react";', 'actionId="create-app-btn"', 'actionId="create-app-submit"'],
      },
      {
        file: "src/dashboard_pages/ApiKeys.tsx",
        snippets: ['import { ResolveKitAction } from "@resolvekit/nextjs/react";', 'actionId="generate-api-key-btn"'],
      },
      {
        file: "src/dashboard_pages/Playbooks.tsx",
        snippets: ['import { ResolveKitAction } from "@resolvekit/nextjs/react";', 'actionId="new-playbook-btn"'],
      },
      {
        file: "src/dashboard_pages/AgentPrompt.tsx",
        snippets: ['import { ResolveKitAction } from "@resolvekit/nextjs/react";', 'actionId="save-agent-prompt-btn"'],
      },
      {
        file: "src/dashboard_pages/LlmConfig.tsx",
        snippets: ['import { ResolveKitAction } from "@resolvekit/nextjs/react";', 'actionId="save-llm-config-btn"'],
      },
      {
        file: "src/dashboard_pages/KnowledgeBases.tsx",
        snippets: ['import { ResolveKitAction } from "@resolvekit/nextjs/react";', 'actionId="add-knowledge-base-btn"'],
      },
    ];

    for (const expectation of expectations) {
      const source = readDashboardFile(expectation.file);
      for (const snippet of expectation.snippets) {
        expect(source, `${expectation.file} should contain ${snippet}`).toContain(snippet);
      }
    }
  });
});
