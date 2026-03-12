import { describe, expect, it } from "vitest";

import { googleModelsToData, isProviderModelAllowedForPersistence } from "./provider";

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
});
