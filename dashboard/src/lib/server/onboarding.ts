import { prisma } from "./prisma";
import { ORG_ADMIN_ROLES } from "./authorization";
import type { AuthDeveloper } from "./auth";

type OnboardingStep = {
  id: string;
  title: string;
  description: string;
  route: string;
  is_complete: boolean;
  is_blocked: boolean;
  blocked_reason: string | null;
};

type OnboardingTip = {
  id: string;
  title: string;
  description: string;
  route: string;
};

function computeRequiredOnboardingSteps(params: {
  has_org_profile: boolean;
  has_target_app: boolean;
  has_model_selection: boolean;
  has_active_api_key: boolean;
  has_active_function: boolean;
  can_manage_org: boolean;
  target_app_id?: string | null;
}): OnboardingStep[] {
  const targetRoute = params.target_app_id ? `/apps/${params.target_app_id}` : "/apps";

  return [
    {
      id: "org_llm_provider",
      title: "Set up organization LLM provider",
      description: "Add provider credentials at organization level so apps can reuse them.",
      route: "/organization",
      is_complete: params.has_org_profile,
      is_blocked: !params.has_org_profile && !params.can_manage_org,
      blocked_reason: !params.has_org_profile && !params.can_manage_org
        ? "Ask an organization owner or admin to configure the LLM provider first."
        : null,
    },
    {
      id: "create_app",
      title: "Create your first app",
      description: "Create the app workspace where agent behavior and SDK integration are configured.",
      route: "/apps",
      is_complete: params.has_target_app,
      is_blocked: false,
      blocked_reason: null,
    },
    {
      id: "select_model",
      title: "Select app model",
      description: "Pick the organization profile and model this app should use for conversations.",
      route: params.target_app_id ? `${targetRoute}/llm` : "/apps",
      is_complete: params.has_model_selection,
      is_blocked: false,
      blocked_reason: null,
    },
    {
      id: "generate_app_api_key",
      title: "Generate app API key",
      description: "Create an app API key the SDK will use to authenticate with backend endpoints.",
      route: params.target_app_id ? `${targetRoute}/api-keys` : "/apps",
      is_complete: params.has_active_api_key,
      is_blocked: false,
      blocked_reason: null,
    },
    {
      id: "integrate_sdk_register_functions",
      title: "Integrate SDK and register functions",
      description: "Integrate the SDK in your app and verify at least one active function appears.",
      route: params.target_app_id ? `${targetRoute}/functions` : "/apps",
      is_complete: params.has_active_function,
      is_blocked: false,
      blocked_reason: null,
    },
  ];
}

function buildOptionalTips(targetAppId: string | null): OnboardingTip[] {
  const targetRoute = targetAppId ? `/apps/${targetAppId}` : "/apps";
  return [
    {
      id: "agent_prompt_tip",
      title: "Tip: tune agent prompt",
      description: "Use Agent Prompt to define guardrails, tone, and scope so answers stay product-focused.",
      route: targetAppId ? `${targetRoute}/agent` : "/apps",
    },
    {
      id: "playbooks_tip",
      title: "Tip: use playbooks for guided flows",
      description: "Playbooks orchestrate function sequences so the assistant follows reliable, repeatable workflows.",
      route: targetAppId ? `${targetRoute}/playbooks` : "/apps",
    },
    {
      id: "knowledge_bases_tip",
      title: "Tip: assign knowledge bases",
      description: "Knowledge bases ground answers in your docs and reduce hallucinations for support and product Q&A.",
      route: "/knowledge-bases",
    },
  ];
}

export async function resolveOnboardingState(developer: AuthDeveloper) {
  if (!developer.organizationId) {
    throw new Error("Developer must belong to an organization");
  }

  const organization = await prisma.organization.findUnique({ where: { id: developer.organizationId } });
  if (!organization) {
    throw new Error("Organization not found");
  }

  let targetApp = null as Awaited<ReturnType<typeof prisma.app.findUnique>>;
  let dirty = false;

  if (organization.onboardingTargetAppId) {
    const candidate = await prisma.app.findUnique({ where: { id: organization.onboardingTargetAppId } });
    if (candidate && candidate.organizationId === organization.id) {
      targetApp = candidate;
    }
  }

  if (!targetApp) {
    targetApp = await prisma.app.findFirst({
      where: { organizationId: organization.id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    const nextTargetId = targetApp?.id ?? null;
    if (organization.onboardingTargetAppId !== nextTargetId) {
      await prisma.organization.update({
        where: { id: organization.id },
        data: { onboardingTargetAppId: nextTargetId },
      });
      dirty = true;
    }
  }

  const hasOrgProfile = Boolean(await prisma.organizationLlmProviderProfile.findFirst({
    where: { organizationId: organization.id },
    select: { id: true },
  }));

  let hasModelSelection = false;
  let hasActiveApiKey = false;
  let hasActiveFunction = false;

  if (targetApp) {
    const config = await prisma.agentConfig.findUnique({ where: { appId: targetApp.id } });
    hasModelSelection = Boolean(config?.llmProfileId && config.llmModel && config.llmModel.trim());

    hasActiveApiKey = Boolean(await prisma.apiKey.findFirst({
      where: { appId: targetApp.id, isActive: true },
      select: { id: true },
    }));

    hasActiveFunction = Boolean(await prisma.registeredFunction.findFirst({
      where: { appId: targetApp.id, isActive: true },
      select: { id: true },
    }));
  }

  const canManageOrg = ORG_ADMIN_ROLES.has(developer.role);
  const requiredSteps = computeRequiredOnboardingSteps({
    has_org_profile: hasOrgProfile,
    has_target_app: Boolean(targetApp),
    has_model_selection: hasModelSelection,
    has_active_api_key: hasActiveApiKey,
    has_active_function: hasActiveFunction,
    can_manage_org: canManageOrg,
    target_app_id: targetApp?.id ?? null,
  });

  const allRequiredComplete = requiredSteps.every((step) => step.is_complete);
  if (allRequiredComplete && !organization.onboardingCompletedAt) {
    await prisma.organization.update({
      where: { id: organization.id },
      data: { onboardingCompletedAt: new Date() },
    });
    dirty = true;
  }

  const refreshed = dirty
    ? await prisma.organization.findUnique({ where: { id: organization.id } })
    : organization;

  return {
    organization_id: organization.id,
    is_complete: Boolean(refreshed?.onboardingCompletedAt),
    should_show: !refreshed?.onboardingCompletedAt,
    can_reset: canManageOrg,
    target_app_id: targetApp?.id ?? null,
    target_app_name: targetApp?.name ?? null,
    required_steps: requiredSteps,
    optional_tips: buildOptionalTips(targetApp?.id ?? null),
  };
}
