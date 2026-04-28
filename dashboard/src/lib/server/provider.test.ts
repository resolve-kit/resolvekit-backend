import { describe, expect, it, vi } from "vitest";

import { googleModelsToData, isProviderModelAllowedForPersistence, lookupModelPricing } from "./provider";

describe("provider model normalization", () => {
  it("rejects unstable google latest aliases for persistence", () => {
    expect(isProviderModelAllowedForPersistence("google", "gemini-flash-lite-latest")).toBe(false);
    expect(isProviderModelAllowedForPersistence("google", "gemini-2.0-flash")).toBe(true);
    expect(isProviderModelAllowedForPersistence("openai", "gpt-4o")).toBe(true);
  });

  it("filters unstable google latest aliases from live model discovery", () => {
    const models = googleModelsToData(
      {
        models: [
          {
            name: "models/gemini-flash-lite-latest",
            displayName: "Gemini Flash Lite Latest",
            supportedGenerationMethods: ["generateContent"],
          },
          {
            name: "models/gemini-2.0-flash-lite",
            displayName: "Gemini 2.0 Flash Lite",
            supportedGenerationMethods: ["generateContent"],
          },
        ],
      },
      "chat",
    );

    expect(models).toEqual([
      {
        id: "gemini-2.0-flash-lite",
        name: "Gemini 2.0 Flash Lite",
      },
    ]);
  });

  it("resolves non-openrouter pricing through the runtime pricing endpoint", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        provider: "gemini",
        model: "gemini-2.5-flash-lite",
        pricing: {
          input_per_million_usd: 0.1,
          output_per_million_usd: 0.4,
          image_per_thousand_usd: null,
          source: "litellm",
        },
      }),
    } as Response);

    await expect(lookupModelPricing("gemini", "gemini/gemini-2.5-flash-lite")).resolves.toEqual({
      input_per_million_usd: 0.1,
      output_per_million_usd: 0.4,
      image_per_thousand_usd: null,
      source: "litellm",
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [requestUrl] = fetchSpy.mock.calls[0];
    expect(String(requestUrl)).toContain("/v1/pricing/model");
    expect(String(requestUrl)).toContain("provider=gemini");
    expect(String(requestUrl)).toContain("model=gemini-2.5-flash-lite");

    fetchSpy.mockRestore();
  });

  it("preserves a path-prefixed runtime base url for pricing lookups", async () => {
    const previousServerAgentBaseUrl = process.env.RESOLVEKIT_SERVER_AGENT_BASE_URL;
    process.env.RESOLVEKIT_SERVER_AGENT_BASE_URL = "https://support.example.com/agent";

    vi.resetModules();
    const { lookupModelPricing: lookupModelPricingWithPrefix } = await import("./provider");

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        provider: "gemini",
        model: "gemini-2.5-flash-lite",
        pricing: {
          input_per_million_usd: 0.1,
          output_per_million_usd: 0.4,
          image_per_thousand_usd: null,
          source: "litellm",
        },
      }),
    } as Response);

    await expect(lookupModelPricingWithPrefix("gemini", "gemini/gemini-2.5-flash-lite")).resolves.toEqual({
      input_per_million_usd: 0.1,
      output_per_million_usd: 0.4,
      image_per_thousand_usd: null,
      source: "litellm",
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [requestUrl] = fetchSpy.mock.calls[0];
    expect(String(requestUrl)).toContain("https://support.example.com/agent/v1/pricing/model");

    fetchSpy.mockRestore();
    process.env.RESOLVEKIT_SERVER_AGENT_BASE_URL = previousServerAgentBaseUrl;
  });

  it("uses the OpenRouter catalog for openrouter pricing", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "google/gemini-2.5-flash-lite",
            name: "Gemini 2.5 Flash Lite",
            pricing: {
              prompt: "0.0000001",
              completion: "0.0000004",
            },
          },
        ],
      }),
    } as Response);

    await expect(lookupModelPricing("openrouter", "google/gemini-2.5-flash-lite")).resolves.toEqual({
      input_per_million_usd: 0.1,
      output_per_million_usd: 0.4,
      image_per_thousand_usd: null,
      source: "openrouter",
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [requestUrl] = fetchSpy.mock.calls[0];
    expect(String(requestUrl)).toBe("https://openrouter.ai/api/v1/models");

    fetchSpy.mockRestore();
  });
});
