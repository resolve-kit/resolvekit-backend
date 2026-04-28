import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const dashboardRoot = path.resolve(import.meta.dirname, "..");

function readDashboardFile(relativePath: string): string {
  return readFileSync(path.join(dashboardRoot, relativePath), "utf8");
}

describe("ResolveKit dashboard integration source wiring", () => {
  it("keeps the OSS dashboard free of the proprietary Next.js SDK package", () => {
    const packageJson = readDashboardFile("package.json");
    const envExample = readDashboardFile("../.env.example");

    expect(packageJson).not.toContain('"@resolvekit/nextjs"');
    expect(packageJson).not.toContain('"@resolvekit/sdk"');

    expect(envExample).not.toContain("RESOLVEKIT_NEXTJS_SDK_PATH=");
    expect(envExample).not.toContain("NEXT_PUBLIC_RESOLVEKIT_ENABLED=");
    expect(envExample).not.toContain("RESOLVEKIT_KEY=");
    expect(envExample).not.toContain("NEXT_PUBLIC_RESOLVEKIT_AGENT_BASE_URL=");
  });

  it("removes the proprietary token route from the OSS dashboard", () => {
    const routeFile = path.join(dashboardRoot, "src/app/api/resolvekit/token/route.ts");

    expect(() => readFileSync(routeFile, "utf8")).toThrow();
  });
});
