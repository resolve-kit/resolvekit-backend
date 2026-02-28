export function functionOut(fn: {
  id: string;
  appId: string;
  name: string;
  description: string;
  descriptionOverride: string | null;
  parametersSchema: unknown;
  isActive: boolean;
  timeoutSeconds: number;
  availability: unknown;
  requiredEntitlements: unknown;
  requiredCapabilities: unknown;
  source: string;
  packName: string | null;
  createdAt: Date;
}) {
  return {
    id: fn.id,
    app_id: fn.appId,
    name: fn.name,
    description: fn.description,
    description_override: fn.descriptionOverride,
    parameters_schema: fn.parametersSchema,
    is_active: fn.isActive,
    timeout_seconds: fn.timeoutSeconds,
    availability: fn.availability,
    required_entitlements: fn.requiredEntitlements,
    required_capabilities: fn.requiredCapabilities,
    source: fn.source,
    pack_name: fn.packName,
    created_at: fn.createdAt,
  };
}

export function sessionOut(session: {
  id: string;
  appId: string;
  deviceId: string | null;
  status: string;
  lastActivityAt: Date;
  createdAt: Date;
  clientContext: unknown;
  llmContext: unknown;
  locale: string;
}) {
  return {
    id: session.id,
    app_id: session.appId,
    device_id: session.deviceId,
    client_context: session.clientContext,
    llm_context: session.llmContext,
    locale: session.locale,
    chat_title: "Support Chat",
    message_placeholder: "Message",
    initial_message: "Hello! How can I help you today?",
    status: session.status,
    last_activity_at: session.lastActivityAt,
    created_at: session.createdAt,
    ws_url: null,
    chat_capability_token: null,
    reused_active_session: false,
  };
}

export function messageOut(message: {
  id: string;
  sessionId: string;
  sequenceNumber: number;
  role: string;
  content: string | null;
  toolCalls: unknown;
  toolCallId: string | null;
  tokenCount: number | null;
  createdAt: Date;
}) {
  return {
    id: message.id,
    session_id: message.sessionId,
    sequence_number: message.sequenceNumber,
    role: message.role,
    content: message.content,
    tool_calls: message.toolCalls,
    tool_call_id: message.toolCallId,
    token_count: message.tokenCount,
    created_at: message.createdAt,
  };
}

export function auditEventOut(event: {
  id: string;
  appId: string;
  actorEmail: string;
  eventType: string;
  entityId: string | null;
  entityName: string | null;
  diff: unknown;
  ipAddress: string | null;
  createdAt: Date;
}) {
  return {
    id: event.id,
    app_id: event.appId,
    actor_email: event.actorEmail,
    event_type: event.eventType,
    entity_id: event.entityId,
    entity_name: event.entityName,
    diff: event.diff,
    ip_address: event.ipAddress,
    created_at: event.createdAt,
  };
}

export function playbookListOut(playbook: {
  id: string;
  appId: string;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: Date;
}, functionCount: number) {
  return {
    id: playbook.id,
    app_id: playbook.appId,
    name: playbook.name,
    description: playbook.description,
    is_active: playbook.isActive,
    created_at: playbook.createdAt,
    function_count: functionCount,
  };
}

export function playbookOut(playbook: {
  id: string;
  appId: string;
  name: string;
  description: string;
  instructions: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  playbookFunctions: Array<{
    functionId: string;
    stepOrder: number;
    stepDescription: string | null;
    function?: { name: string } | null;
  }>;
}) {
  return {
    id: playbook.id,
    app_id: playbook.appId,
    name: playbook.name,
    description: playbook.description,
    instructions: playbook.instructions,
    is_active: playbook.isActive,
    created_at: playbook.createdAt,
    updated_at: playbook.updatedAt,
    functions: playbook.playbookFunctions
      .sort((a, b) => a.stepOrder - b.stepOrder)
      .map((item) => ({
        function_id: item.functionId,
        function_name: item.function?.name ?? "",
        step_order: item.stepOrder,
        step_description: item.stepDescription,
      })),
  };
}

export function configOut(
  cfg: {
    id: string;
    appId: string;
    systemPrompt: string;
    scopeMode: string;
    llmProfileId: string | null;
    llmModel: string;
    temperature: number;
    maxTokens: number;
    maxToolRounds: number;
    sessionTtlMinutes: number;
    maxContextMessages: number;
  },
  profile: {
    name: string;
    provider: string;
    apiKeyEncrypted: string;
    apiBase: string | null;
  } | null,
) {
  return {
    id: cfg.id,
    app_id: cfg.appId,
    system_prompt: cfg.systemPrompt,
    scope_mode: cfg.scopeMode,
    llm_profile_id: cfg.llmProfileId,
    llm_profile_name: profile?.name ?? null,
    llm_provider: profile?.provider ?? null,
    llm_model: cfg.llmModel,
    has_llm_api_key: Boolean(profile?.apiKeyEncrypted),
    llm_api_base: profile?.apiBase ?? null,
    temperature: cfg.temperature,
    max_tokens: cfg.maxTokens,
    max_tool_rounds: cfg.maxToolRounds,
    session_ttl_minutes: cfg.sessionTtlMinutes,
    max_context_messages: cfg.maxContextMessages,
  };
}

export function organizationOut(org: {
  id: string;
  name: string;
  publicId: string;
  createdAt: Date;
}) {
  return {
    id: org.id,
    name: org.name,
    public_id: org.publicId,
    created_at: org.createdAt,
  };
}

export function invitationOut(invitation: {
  id: string;
  organizationId: string;
  inviterDeveloperId: string;
  inviteeDeveloperId: string;
  inviteeEmail: string;
  status: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: invitation.id,
    organization_id: invitation.organizationId,
    inviter_developer_id: invitation.inviterDeveloperId,
    invitee_developer_id: invitation.inviteeDeveloperId,
    invitee_email: invitation.inviteeEmail,
    status: invitation.status,
    expires_at: invitation.expiresAt,
    accepted_at: invitation.acceptedAt,
    created_at: invitation.createdAt,
  };
}

export function memberOut(member: {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: Date;
}) {
  return {
    id: member.id,
    email: member.email,
    name: member.name,
    role: member.role,
    created_at: member.createdAt,
  };
}

export function llmProfileOut(profile: {
  id: string;
  organizationId: string;
  name: string;
  provider: string;
  apiKeyEncrypted: string;
  apiBase: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: profile.id,
    organization_id: profile.organizationId,
    name: profile.name,
    provider: profile.provider,
    has_api_key: Boolean(profile.apiKeyEncrypted),
    api_base: profile.apiBase,
    created_at: profile.createdAt,
    updated_at: profile.updatedAt,
  };
}
