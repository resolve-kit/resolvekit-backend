import { NextRequest, NextResponse } from "next/server";

import { getDeveloperFromRequest } from "@/lib/server/auth";
import { getOwnedAppOrNull } from "@/lib/server/apps";
import { getOrCreateConfig, getSelectedProfile, updateConfigWithAudit } from "@/lib/server/config-service";
import { detail, readJson } from "@/lib/server/http";
import { configOut } from "@/lib/server/serializers";

export const dynamic = "force-dynamic";

type AgentConfigUpdatePayload = {
  system_prompt?: string;
  scope_mode?: "open" | "strict";
  llm_profile_id?: string | null;
  llm_model?: string | null;
  kb_vision_mode?: "ocr_safe" | "multimodal";
  temperature?: number;
  max_tokens?: number;
  max_tool_rounds?: number;
  session_ttl_minutes?: number;
  max_context_messages?: number;
};

export async function GET(request: NextRequest, context: { params: Promise<{ appId: string }> }) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");

  const { appId } = await context.params;
  const app = await getOwnedAppOrNull(appId, developer);
  if (!app) return detail(404, "App not found");

  const cfg = await getOrCreateConfig(app.id);
  const profile = await getSelectedProfile(app.organizationId, cfg.llmProfileId);
  return NextResponse.json(configOut(cfg, profile));
}

export async function PUT(request: NextRequest, context: { params: Promise<{ appId: string }> }) {
  const developer = await getDeveloperFromRequest(request);
  if (!developer) return detail(401, "Invalid token");

  const { appId } = await context.params;
  const app = await getOwnedAppOrNull(appId, developer);
  if (!app) return detail(404, "App not found");

  const body = await readJson<AgentConfigUpdatePayload>(request);
  if (!body) return detail(422, "Invalid config payload");

  try {
    const updated = await updateConfigWithAudit({
      appId: app.id,
      organizationId: app.organizationId,
      actorEmail: developer.email,
      updates: {
        ...(typeof body.system_prompt === "string" ? { systemPrompt: body.system_prompt } : {}),
        ...(body.scope_mode === "open" || body.scope_mode === "strict" ? { scopeMode: body.scope_mode } : {}),
        ...(Object.prototype.hasOwnProperty.call(body, "llm_profile_id") ? { llmProfileId: body.llm_profile_id ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(body, "llm_model") ? { llmModel: body.llm_model ?? undefined } : {}),
        ...(Object.prototype.hasOwnProperty.call(body, "kb_vision_mode")
          ? { kbVisionMode: body.kb_vision_mode as "ocr_safe" | "multimodal" | undefined }
          : {}),
        ...(typeof body.temperature === "number" ? { temperature: body.temperature } : {}),
        ...(typeof body.max_tokens === "number" ? { maxTokens: body.max_tokens } : {}),
        ...(typeof body.max_tool_rounds === "number" ? { maxToolRounds: body.max_tool_rounds } : {}),
        ...(typeof body.session_ttl_minutes === "number" ? { sessionTtlMinutes: body.session_ttl_minutes } : {}),
        ...(typeof body.max_context_messages === "number" ? { maxContextMessages: body.max_context_messages } : {}),
      },
    });

    const profile = await getSelectedProfile(app.organizationId, updated.llmProfileId);
    return NextResponse.json(configOut(updated, profile));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update config";
    if (message === "LLM model is required") return detail(422, message);
    if (message === "LLM profile not found") return detail(404, message);
    if (message === "KB vision mode must be one of: ocr_safe, multimodal") return detail(422, message);
    if (message.includes("does not support multimodal vision")) return detail(422, message);
    if (message.includes("is not OCR compatible")) return detail(422, message);
    return detail(400, message);
  }
}
