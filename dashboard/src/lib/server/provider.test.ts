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

  it("returns curated pricing for stable non-openrouter models without requiring network", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(lookupModelPricing("openai", "gpt-4o")).resolves.toMatchObject({
      input_per_million_usd: expect.any(Number),
      output_per_million_usd: expect.any(Number),
      source: "catalog",
    });
    await expect(lookupModelPricing("google", "gemini-2.0-flash-lite")).resolves.toMatchObject({
      input_per_million_usd: expect.any(Number),
      output_per_million_usd: expect.any(Number),
      source: "catalog",
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
