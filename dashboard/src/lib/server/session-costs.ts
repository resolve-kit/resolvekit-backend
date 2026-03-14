import { Prisma } from "@prisma/client";

import { KBServiceError, kbUsageSummary } from "./kb-service";
import { prisma } from "./prisma";
import { lookupModelPricing, type ModelPricing } from "./provider";

export type SessionUsageRow = {
  session_id: string;
  provider: string;
  model: string;
  operation: string;
  input_tokens: number;
  output_tokens: number;
  image_count: number;
  event_count: number;
};

export type SessionCostBreakdown = {
  category: string;
  provider: string;
  model: string;
  operation: string;
  estimated_cost_usd: number;
  input_tokens: number;
  output_tokens: number;
  image_count: number;
  event_count: number;
  unpriced_event_count: number;
  pricing: ModelPricing | null;
};

export type SessionCostSummary = {
  estimated_cost_usd: number;
  input_tokens: number;
  output_tokens: number;
  image_count: number;
  event_count: number;
  unpriced_event_count: number;
  partial: boolean;
  warnings: string[];
  breakdown: SessionCostBreakdown[];
};

export type DashboardActorContext = {
  orgId: string;
  actorId: string;
  actorRole: string;
};

type CoreUsageQueryRow = {
  session_id: string | null;
  provider: string;
  model: string;
  operation: string;
  input_tokens: number | string | null;
  output_tokens: number | string | null;
  image_count: number | string | null;
  event_count: number | string | null;
};

const EMPTY_SUMMARY: SessionCostSummary = {
  estimated_cost_usd: 0,
  input_tokens: 0,
  output_tokens: 0,
  image_count: 0,
  event_count: 0,
  unpriced_event_count: 0,
  partial: false,
  warnings: [],
  breakdown: [],
};

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function modelKey(provider: string, model: string): string {
  return `${provider.trim().toLowerCase()}::${model.trim()}`;
}

function estimateCostUsd(
  row: Pick<SessionUsageRow, "input_tokens" | "output_tokens" | "image_count" | "event_count">,
  pricing: ModelPricing | null,
): { cost: number; unpriced: boolean } {
  const inputCost = pricing?.input_per_million_usd != null
    ? (row.input_tokens / 1_000_000) * pricing.input_per_million_usd
    : 0;
  const outputCost = pricing?.output_per_million_usd != null
    ? (row.output_tokens / 1_000_000) * pricing.output_per_million_usd
    : 0;
  const imageCost = pricing?.image_per_thousand_usd != null
    ? (row.image_count / 1_000) * pricing.image_per_thousand_usd
    : 0;
  const unpriced = (
    (row.input_tokens > 0 && pricing?.input_per_million_usd == null)
    || (row.output_tokens > 0 && pricing?.output_per_million_usd == null)
    || (row.image_count > 0 && pricing?.image_per_thousand_usd == null)
  );
  return {
    cost: inputCost + outputCost + imageCost,
    unpriced,
  };
}

export function costCategoryForOperation(operation: string): string {
  const normalized = operation.trim().toLowerCase();
  if (normalized === "assistant_completion") return "assistant";
  if (normalized === "router_classification") return "router";
  if (normalized === "tool_description_generation") return "tool_description";
  if (normalized.startsWith("kb_context") || normalized.startsWith("kb_query") || normalized.startsWith("kb_search")) {
    return "kb_context";
  }
  if (normalized.includes("embedding")) return "embeddings";
  return "other";
}

export async function summarizeSessionCostRows(
  rows: SessionUsageRow[],
  resolvePricing: (provider: string, model: string) => Promise<ModelPricing | null> = lookupModelPricing,
  warnings: string[] = [],
): Promise<SessionCostSummary> {
  if (rows.length === 0) {
    return {
      ...EMPTY_SUMMARY,
      warnings: [...warnings],
      partial: warnings.length > 0,
    };
  }

  const pricingByKey = new Map<string, ModelPricing | null>();
  const uniqueModels = new Map<string, { provider: string; model: string }>();
  for (const row of rows) {
    const key = modelKey(row.provider, row.model);
    if (!uniqueModels.has(key)) uniqueModels.set(key, { provider: row.provider, model: row.model });
  }
  await Promise.all(
    Array.from(uniqueModels.entries()).map(async ([key, value]) => {
      pricingByKey.set(key, await resolvePricing(value.provider, value.model));
    }),
  );

  let totalEstimatedCostUsd = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalImageCount = 0;
  let totalEventCount = 0;
  let totalUnpricedEvents = 0;
  const breakdownAgg = new Map<string, SessionCostBreakdown>();

  for (const row of rows) {
    totalInputTokens += row.input_tokens;
    totalOutputTokens += row.output_tokens;
    totalImageCount += row.image_count;
    totalEventCount += row.event_count;

    const pricing = pricingByKey.get(modelKey(row.provider, row.model)) ?? null;
    const cost = estimateCostUsd(row, pricing);
    totalEstimatedCostUsd += cost.cost;
    if (cost.unpriced) totalUnpricedEvents += row.event_count;

    const category = costCategoryForOperation(row.operation);
    const aggKey = `${category}::${row.provider}::${row.model}::${row.operation}`;
    const current = breakdownAgg.get(aggKey);
    if (current) {
      current.estimated_cost_usd += cost.cost;
      current.input_tokens += row.input_tokens;
      current.output_tokens += row.output_tokens;
      current.image_count += row.image_count;
      current.event_count += row.event_count;
      current.unpriced_event_count += cost.unpriced ? row.event_count : 0;
    } else {
      breakdownAgg.set(aggKey, {
        category,
        provider: row.provider,
        model: row.model,
        operation: row.operation,
        estimated_cost_usd: cost.cost,
        input_tokens: row.input_tokens,
        output_tokens: row.output_tokens,
        image_count: row.image_count,
        event_count: row.event_count,
        unpriced_event_count: cost.unpriced ? row.event_count : 0,
        pricing,
      });
    }
  }

  const finalWarnings = [...warnings];
  if (totalUnpricedEvents > 0) {
    finalWarnings.push(`Pricing missing for ${totalUnpricedEvents.toLocaleString()} usage events.`);
  }

  return {
    estimated_cost_usd: totalEstimatedCostUsd,
    input_tokens: totalInputTokens,
    output_tokens: totalOutputTokens,
    image_count: totalImageCount,
    event_count: totalEventCount,
    unpriced_event_count: totalUnpricedEvents,
    partial: finalWarnings.length > 0,
    warnings: finalWarnings,
    breakdown: Array.from(breakdownAgg.values()).sort(
      (a, b) => b.estimated_cost_usd - a.estimated_cost_usd || b.input_tokens - a.input_tokens,
    ),
  };
}

export async function loadCoreSessionUsageRows(
  organizationId: string,
  appId: string,
  sessionIds: string[],
): Promise<SessionUsageRow[]> {
  if (sessionIds.length === 0) return [];

  const rows = await prisma.$queryRaw<CoreUsageQueryRow[]>(Prisma.sql`
    SELECT
      session_id,
      provider,
      model,
      operation,
      COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
      COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
      COALESCE(SUM(image_count), 0)::bigint AS image_count,
      COUNT(*)::bigint AS event_count
    FROM llm_usage_events
    WHERE organization_id = ${organizationId}::uuid
      AND app_id = ${appId}::uuid
      AND session_id IN (${Prisma.join(sessionIds.map((id) => Prisma.sql`${id}::uuid`))})
    GROUP BY session_id, provider, model, operation
  `);

  return rows
    .filter((row): row is CoreUsageQueryRow & { session_id: string } => typeof row.session_id === "string")
    .map((row) => ({
      session_id: row.session_id,
      provider: row.provider,
      model: row.model,
      operation: row.operation,
      input_tokens: toNumber(row.input_tokens),
      output_tokens: toNumber(row.output_tokens),
      image_count: toNumber(row.image_count),
      event_count: toNumber(row.event_count),
    }));
}

export async function loadSessionCostSummariesForSessions(
  organizationId: string,
  appId: string,
  sessionIds: string[],
): Promise<Map<string, SessionCostSummary>> {
  const rows = await loadCoreSessionUsageRows(organizationId, appId, sessionIds);
  const rowsBySession = new Map<string, SessionUsageRow[]>();
  for (const row of rows) {
    const current = rowsBySession.get(row.session_id) ?? [];
    current.push(row);
    rowsBySession.set(row.session_id, current);
  }

  const output = new Map<string, SessionCostSummary>();
  await Promise.all(
    sessionIds.map(async (sessionId) => {
      output.set(sessionId, await summarizeSessionCostRows(rowsBySession.get(sessionId) ?? []));
    }),
  );
  return output;
}

export async function loadKbSessionUsageRows(
  actor: DashboardActorContext,
  appId: string,
  sessionId: string,
  fromTs: Date,
  toTs: Date,
): Promise<{ rows: SessionUsageRow[]; warnings: string[] }> {
  try {
    const payload = await kbUsageSummary(
      {
        orgId: actor.orgId,
        actorId: actor.actorId,
        actorRole: actor.actorRole,
      },
      {
        from_ts: fromTs.toISOString(),
        to_ts: toTs.toISOString(),
        app_id: appId,
        session_id: sessionId,
      },
    );

    const items = Array.isArray(payload.items) ? payload.items : [];
    const rows: SessionUsageRow[] = [];
    let sessionAwareRows = 0;

    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      const rowSessionId = typeof record.session_id === "string" ? record.session_id : null;
      if (rowSessionId) {
        sessionAwareRows += 1;
        if (rowSessionId !== sessionId) continue;
      }

      rows.push({
        session_id: rowSessionId ?? sessionId,
        provider: typeof record.provider === "string" && record.provider.trim() ? record.provider : "unknown",
        model: typeof record.model === "string" && record.model.trim() ? record.model : "unknown",
        operation: typeof record.operation === "string" && record.operation.trim() ? record.operation : "kb_context_search",
        input_tokens: toNumber(record.input_tokens),
        output_tokens: toNumber(record.output_tokens),
        image_count: toNumber(record.image_count),
        event_count: toNumber(record.event_count),
      });
    }

    if (items.length > 0 && sessionAwareRows === 0) {
      return {
        rows: [],
        warnings: ["Knowledge base usage is not yet session-attributed; KB cost excluded from this session total."],
      };
    }

    return { rows, warnings: [] };
  } catch (error) {
    if (error instanceof KBServiceError) {
      return {
        rows: [],
        warnings: [`Knowledge base usage unavailable: ${error.message}`],
      };
    }
    return {
      rows: [],
      warnings: ["Knowledge base usage unavailable"],
    };
  }
}
