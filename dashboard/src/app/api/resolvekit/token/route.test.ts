import { beforeEach, describe, expect, it, vi } from "vitest";

const handler = vi.fn(async (request: Request) => new Response(`proxied:${request.method}`));
const createResolveKitClientTokenHandler = vi.fn((options: unknown) => handler);
const getDeveloperFromRequest = vi.fn(async (): Promise<{ id: string } | null> => ({ id: "dev_123" }));

vi.mock("@resolvekit/nextjs/server", () => ({
  createResolveKitClientTokenHandler,
}));

vi.mock("@/lib/server/auth", () => ({
  getDeveloperFromRequest,
}));

describe("resolvekit token route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.NEXT_PUBLIC_RESOLVEKIT_AGENT_BASE_URL = "http://agent.example";
    process.env.NEXT_PUBLIC_DASHBOARD_URL = "https://console.resolvekit.app";
    process.env.IAA_CORS_ALLOWED_ORIGINS = "http://localhost:3000,https://console.resolvekit.app";
    process.env.RESOLVEKIT_KEY = "rk_secret";
  });

  it("creates a force-dynamic POST handler backed by the server API key and dashboard auth", async () => {
    const route = await import("./route");

    expect(route.dynamic).toBe("force-dynamic");
    expect(createResolveKitClientTokenHandler).toHaveBeenCalledTimes(1);

    const options = createResolveKitClientTokenHandler.mock.calls[0]?.[0] as
      | {
          agentBaseUrl: string;
          resolveApiKey: () => string | null | undefined;
          allowedOrigins: string[];
          authorizeRequest: (context: { request: Request }) => Promise<boolean | Response> | boolean | Response;
        }
      | undefined;
    expect(options).toBeDefined();
    if (!options) {
      throw new Error("ResolveKit token handler was not configured");
    }
    expect(options.agentBaseUrl).toBe("http://agent.example");
    expect(options.resolveApiKey()).toBe("rk_secret");
    expect(options.allowedOrigins).toEqual(["http://localhost:3000", "https://console.resolvekit.app"]);
    await expect(options.authorizeRequest({ request: new Request("http://localhost/api/resolvekit/token") })).resolves.toBe(
      true,
    );
    getDeveloperFromRequest.mockResolvedValueOnce(null);
    await expect(options.authorizeRequest({ request: new Request("http://localhost/api/resolvekit/token") })).resolves.toBe(
      false,
    );

    const response = await route.POST(new Request("http://localhost/api/resolvekit/token", { method: "POST" }));
    expect(handler).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("proxied:POST");
  });
});
