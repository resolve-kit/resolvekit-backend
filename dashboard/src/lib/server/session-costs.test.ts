import { describe, expect, it } from "vitest";

import { summarizeSessionCostRows, type SessionUsageRow } from "./session-costs";

describe("summarizeSessionCostRows", () => {
  it("aggregates totals, breakdowns, and warnings across categories", async () => {
    const rows: SessionUsageRow[] = [
      {
        session_id: "session-1",
        provider: "openai",
        model: "gpt-4o",
        operation: "assistant_completion",
        input_tokens: 1_500,
        output_tokens: 300,
        image_count: 0,
        event_count: 1,
      },
      {
        session_id: "session-1",
        provider: "openai",
        model: "gpt-4o-mini",
        operation: "router_classification",
        input_tokens: 200,
        output_tokens: 20,
        image_count: 0,
        event_count: 1,
      },
      {
        session_id: "session-1",
        provider: "unknown",
        model: "custom-model",
        operation: "kb_context_search",
        input_tokens: 400,
        output_tokens: 0,
        image_count: 0,
        event_count: 2,
      },
    ];

    const summary = await summarizeSessionCostRows(rows, async (provider, model) => {
      if (provider === "openai" && model === "gpt-4o") {
        return {
          input_per_million_usd: 5,
          output_per_million_usd: 15,
          image_per_thousand_usd: null,
          source: "test",
        };
      }
      if (provider === "openai" && model === "gpt-4o-mini") {
        return {
          input_per_million_usd: 0.15,
          output_per_million_usd: 0.6,
          image_per_thousand_usd: null,
          source: "test",
        };
      }
      return null;
    });

    expect(summary.input_tokens).toBe(2_100);
    expect(summary.output_tokens).toBe(320);
    expect(summary.image_count).toBe(0);
    expect(summary.event_count).toBe(4);
    expect(summary.unpriced_event_count).toBe(2);
    expect(summary.partial).toBe(true);
    expect(summary.warnings).toContain("Pricing missing for 2 usage events.");
    expect(summary.breakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "assistant",
          provider: "openai",
          model: "gpt-4o",
          event_count: 1,
        }),
        expect.objectContaining({
          category: "router",
          provider: "openai",
          model: "gpt-4o-mini",
          event_count: 1,
        }),
        expect.objectContaining({
          category: "kb_context",
          provider: "unknown",
          model: "custom-model",
          event_count: 2,
        }),
      ]),
    );
    expect(summary.estimated_cost_usd).toBeGreaterThan(0);
  });
});
