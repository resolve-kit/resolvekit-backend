import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = {
  agentConfig: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  organizationLlmProviderProfile: {
    findUnique: vi.fn(),
  },
  auditEvent: {
    createMany: vi.fn(),
  },
};

vi.mock("./prisma", () => ({
  prisma,
}));

describe("config-service LLM normalization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unstable google latest aliases before persisting app config", async () => {
    prisma.agentConfig.findUnique.mockResolvedValue({
      id: "cfg_1",
      appId: "app_1",
      systemPrompt: "prompt",
      scopeMode: "strict",
      llmProfileId: "profile_1",
      llmModel: "gemini-flash-lite-latest",
      kbVisionMode: "ocr_safe",
      temperature: 0.2,
      maxTokens: 256,
      maxToolRounds: 4,
      sessionTtlMinutes: 30,
      maxContextMessages: 20,
      llmProvider: "openai",
      llmApiKeyEncrypted: null,
      llmApiBase: null,
    });
    prisma.organizationLlmProviderProfile.findUnique.mockResolvedValue({
      id: "profile_1",
      organizationId: "org_1",
      provider: "google",
    });
    const { updateConfigWithAudit } = await import("./config-service");

    await expect(
      updateConfigWithAudit({
        appId: "app_1",
        organizationId: "org_1",
        actorEmail: "dev@example.com",
        updates: {
          llmProfileId: "profile_1",
          llmModel: "gemini-flash-lite-latest",
        },
      }),
    ).rejects.toThrow("Selected model 'gemini-flash-lite-latest' is not a stable provider model id");

    expect(prisma.agentConfig.update).not.toHaveBeenCalled();
  });
});
