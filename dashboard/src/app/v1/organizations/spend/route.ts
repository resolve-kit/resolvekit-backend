import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { getDeveloperFromRequest } from "@/lib/server/auth";
import { detail } from "@/lib/server/http";
import { KBServiceError, kbList, kbUsageSummary } from "@/lib/server/kb-service";
import { coerceDbNumber } from "@/lib/server/numbers";
import { lookupModelPricing, type ModelPricing } from "@/lib/server/provider";
import { prisma } from "@/lib/server/prisma";

export const dynamic = "force-dynamic";

type UsageRow = {
  app_id: string | null;
  knowledge_base_id: string | null;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  image_count: number;
  event_count: number;
};

function parseOptionalIsoDate(raw: string | null): Date | null {
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function modelKey(provider: string, model: string): string {
  return `${provider.trim().toLowerCase()}::${model.trim()}`;
}

function estimateCostUsd(row: UsageRow, pricing: ModelPricing | null): { cost: number; unpriced: boolean } {
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

export async function GET(request: NextRequest) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");
  if (!developer.organizationId) return detail(404, "Organization not found");

  const now = new Date();
  const toTs = parseOptionalIsoDate(request.nextUrl.searchParams.get("to_ts")) ?? now;
  const fromTs = parseOptionalIsoDate(request.nextUrl.searchParams.get("from_ts"))
    ?? new Date(toTs.getTime() - (30 * 24 * 60 * 60 * 1000));
  if (toTs <= fromTs) {
    return detail(422, "to_ts must be greater than from_ts");
  }

  const warnings: string[] = [];
  const usageRows: UsageRow[] = [];

  const coreGroups = await prisma.$queryRaw<Array<{
    app_id: string | null;
    provider: string;
    model: string;
    input_tokens: number | string | null;
    output_tokens: number | string | null;
    image_count: number | string | null;
    event_count: number | string | null;
  }>>(Prisma.sql`
    SELECT
      app_id,
      provider,
      model,
      COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
      COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
      COALESCE(SUM(image_count), 0)::bigint AS image_count,
      COUNT(*)::bigint AS event_count
    FROM llm_usage_events
    WHERE organization_id = ${developer.organizationId}::uuid
      AND created_at >= ${fromTs}
      AND created_at < ${toTs}
    GROUP BY app_id, provider, model
  `);
  for (const row of coreGroups) {
    usageRows.push({
      app_id: row.app_id,
      knowledge_base_id: null,
      provider: row.provider,
      model: row.model,
      input_tokens: coerceDbNumber(row.input_tokens),
      output_tokens: coerceDbNumber(row.output_tokens),
      image_count: coerceDbNumber(row.image_count),
      event_count: coerceDbNumber(row.event_count),
    });
  }

  try {
    const kbPayload = await kbUsageSummary(
      {
        orgId: developer.organizationId,
        actorId: developer.id,
        actorRole: developer.role,
      },
      {
        from_ts: fromTs.toISOString(),
        to_ts: toTs.toISOString(),
      },
    );

    const kbItems = Array.isArray(kbPayload.items) ? kbPayload.items : [];
    for (const item of kbItems) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      usageRows.push({
        app_id: typeof record.app_id === "string" ? record.app_id : null,
        knowledge_base_id: typeof record.knowledge_base_id === "string" ? record.knowledge_base_id : null,
        provider: typeof record.provider === "string" && record.provider.trim() ? record.provider : "unknown",
        model: typeof record.model === "string" && record.model.trim() ? record.model : "unknown",
        input_tokens: coerceDbNumber(record.input_tokens),
        output_tokens: coerceDbNumber(record.output_tokens),
        image_count: coerceDbNumber(record.image_count),
        event_count: coerceDbNumber(record.event_count),
      });
    }
  } catch (error) {
    if (error instanceof KBServiceError) {
      warnings.push(`Knowledge base usage unavailable: ${error.message}`);
    } else {
      warnings.push("Knowledge base usage unavailable");
    }
  }

  const pricingByModelKey = new Map<string, ModelPricing | null>();
  const uniqueModels = new Map<string, { provider: string; model: string }>();
  for (const row of usageRows) {
    const key = modelKey(row.provider, row.model);
    if (!uniqueModels.has(key)) {
      uniqueModels.set(key, { provider: row.provider, model: row.model });
    }
  }
  await Promise.all(
    Array.from(uniqueModels.entries()).map(async ([key, value]) => {
      const pricing = await lookupModelPricing(value.provider, value.model);
      pricingByModelKey.set(key, pricing);
    }),
  );

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalImageCount = 0;
  let totalEventCount = 0;
  let totalEstimatedCostUsd = 0;
  let totalUnpricedEvents = 0;

  const appAgg = new Map<string, UsageRow & { estimated_cost_usd: number; unpriced_event_count: number }>();
  const modelAgg = new Map<
    string,
    UsageRow & { estimated_cost_usd: number; unpriced_event_count: number; pricing: ModelPricing | null }
  >();
  const kbAgg = new Map<string, UsageRow & { estimated_cost_usd: number; unpriced_event_count: number }>();

  for (const row of usageRows) {
    totalInputTokens += row.input_tokens;
    totalOutputTokens += row.output_tokens;
    totalImageCount += row.image_count;
    totalEventCount += row.event_count;

    const key = modelKey(row.provider, row.model);
    const pricing = pricingByModelKey.get(key) ?? null;
    const cost = estimateCostUsd(row, pricing);
    totalEstimatedCostUsd += cost.cost;
    if (cost.unpriced) {
      totalUnpricedEvents += row.event_count;
    }

    const appKey = row.app_id ?? "__unassigned__";
    const appCurrent = appAgg.get(appKey);
    if (appCurrent) {
      appCurrent.input_tokens += row.input_tokens;
      appCurrent.output_tokens += row.output_tokens;
      appCurrent.image_count += row.image_count;
      appCurrent.event_count += row.event_count;
      appCurrent.estimated_cost_usd += cost.cost;
      appCurrent.unpriced_event_count += cost.unpriced ? row.event_count : 0;
    } else {
      appAgg.set(appKey, {
        ...row,
        app_id: row.app_id,
        knowledge_base_id: null,
        estimated_cost_usd: cost.cost,
        unpriced_event_count: cost.unpriced ? row.event_count : 0,
      });
    }

    const modelCurrent = modelAgg.get(key);
    if (modelCurrent) {
      modelCurrent.input_tokens += row.input_tokens;
      modelCurrent.output_tokens += row.output_tokens;
      modelCurrent.image_count += row.image_count;
      modelCurrent.event_count += row.event_count;
      modelCurrent.estimated_cost_usd += cost.cost;
      modelCurrent.unpriced_event_count += cost.unpriced ? row.event_count : 0;
    } else {
      modelAgg.set(key, {
        ...row,
        app_id: null,
        knowledge_base_id: null,
        pricing,
        estimated_cost_usd: cost.cost,
        unpriced_event_count: cost.unpriced ? row.event_count : 0,
      });
    }

    if (row.knowledge_base_id) {
      const kbCurrent = kbAgg.get(row.knowledge_base_id);
      if (kbCurrent) {
        kbCurrent.input_tokens += row.input_tokens;
        kbCurrent.output_tokens += row.output_tokens;
        kbCurrent.image_count += row.image_count;
        kbCurrent.event_count += row.event_count;
        kbCurrent.estimated_cost_usd += cost.cost;
        kbCurrent.unpriced_event_count += cost.unpriced ? row.event_count : 0;
      } else {
        kbAgg.set(row.knowledge_base_id, {
          ...row,
          app_id: null,
          estimated_cost_usd: cost.cost,
          unpriced_event_count: cost.unpriced ? row.event_count : 0,
        });
      }
    }
  }

  const appIds = Array.from(
    new Set(
      Array.from(appAgg.values())
        .map((row) => row.app_id)
        .filter((appId): appId is string => Boolean(appId)),
    ),
  );
  const apps = appIds.length > 0
    ? await prisma.app.findMany({
      where: { organizationId: developer.organizationId, id: { in: appIds } },
      select: { id: true, name: true },
    })
    : [];
  const appNameById = new Map<string, string>(apps.map((app) => [app.id, app.name]));

  const kbNameById = new Map<string, string>();
  const kbIds = Array.from(kbAgg.keys());
  if (kbIds.length > 0) {
    try {
      const payload = await kbList({
        orgId: developer.organizationId,
        actorId: developer.id,
        actorRole: developer.role,
      });
      const items = Array.isArray(payload.items) ? payload.items : [];
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const record = item as Record<string, unknown>;
        const kbId = typeof record.id === "string" ? record.id : "";
        const name = typeof record.name === "string" ? record.name.trim() : "";
        if (kbId && name) kbNameById.set(kbId, name);
      }
    } catch (error) {
      if (error instanceof KBServiceError) {
        warnings.push(`Knowledge base names unavailable: ${error.message}`);
      } else {
        warnings.push("Knowledge base names unavailable");
      }
    }
  }

  if (totalUnpricedEvents > 0) {
    warnings.push(`Pricing missing for ${totalUnpricedEvents.toLocaleString()} usage events.`);
  }

  return NextResponse.json({
    from_ts: fromTs.toISOString(),
    to_ts: toTs.toISOString(),
    currency: "USD",
    totals: {
      estimated_cost_usd: totalEstimatedCostUsd,
      input_tokens: totalInputTokens,
      output_tokens: totalOutputTokens,
      image_count: totalImageCount,
      event_count: totalEventCount,
      unpriced_event_count: totalUnpricedEvents,
    },
    by_app: Array.from(appAgg.values())
      .map((row) => ({
        app_id: row.app_id,
        app_name: row.app_id ? (appNameById.get(row.app_id) ?? row.app_id) : "Unassigned",
        estimated_cost_usd: row.estimated_cost_usd,
        input_tokens: row.input_tokens,
        output_tokens: row.output_tokens,
        image_count: row.image_count,
        event_count: row.event_count,
        unpriced_event_count: row.unpriced_event_count,
      }))
      .sort((a, b) => b.estimated_cost_usd - a.estimated_cost_usd || b.input_tokens - a.input_tokens),
    by_model: Array.from(modelAgg.values())
      .map((row) => ({
        provider: row.provider,
        model: row.model,
        pricing: row.pricing,
        estimated_cost_usd: row.estimated_cost_usd,
        input_tokens: row.input_tokens,
        output_tokens: row.output_tokens,
        image_count: row.image_count,
        event_count: row.event_count,
        unpriced_event_count: row.unpriced_event_count,
      }))
      .sort((a, b) => b.estimated_cost_usd - a.estimated_cost_usd || b.input_tokens - a.input_tokens),
    by_knowledge_base: Array.from(kbAgg.values())
      .map((row) => ({
        knowledge_base_id: row.knowledge_base_id,
        knowledge_base_name: row.knowledge_base_id ? (kbNameById.get(row.knowledge_base_id) ?? row.knowledge_base_id) : "Unknown",
        estimated_cost_usd: row.estimated_cost_usd,
        input_tokens: row.input_tokens,
        output_tokens: row.output_tokens,
        image_count: row.image_count,
        event_count: row.event_count,
        unpriced_event_count: row.unpriced_event_count,
      }))
      .sort((a, b) => b.estimated_cost_usd - a.estimated_cost_usd || b.input_tokens - a.input_tokens),
    warnings,
  });
}
