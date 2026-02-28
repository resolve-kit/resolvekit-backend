import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { ApiError, api } from "../api/client";
import { PageHeader } from "../components/layout/PageHeader";
import { Badge, Button, DataPanel, Input, MetricTile, SectionCard, Select, useToast } from "../components/ui";
import { useOnboarding } from "../context/OnboardingContext";

interface OrganizationMember {
  id: string;
  email: string;
  name: string;
  role: "owner" | "admin" | "member";
  created_at: string;
}

interface OrganizationInvitation {
  id: string;
  organization_id: string;
  inviter_developer_id: string;
  invitee_developer_id: string;
  invitee_email: string;
  status: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

interface OrganizationInfo {
  id: string;
  name: string;
  public_id: string;
  created_at: string;
}

interface DeveloperMe {
  id: string;
  email: string;
  name: string;
  role: "owner" | "admin" | "member";
  organization_id: string;
  created_at: string;
}

interface LlmProviderCatalogItem {
  id: string;
  name: string;
  custom_base_url: boolean;
}

interface OrganizationLlmProfile {
  id: string;
  organization_id: string;
  name: string;
  provider: string;
  has_api_key: boolean;
  api_base: string | null;
  created_at: string;
  updated_at: string;
}

type OrganizationView = "llm-setup" | "team-management";

export default function OrganizationAdmin() {
  const [inviteEmail, setInviteEmail] = useState("");
  const [organization, setOrganization] = useState<OrganizationInfo | null>(null);
  const [currentUser, setCurrentUser] = useState<DeveloperMe | null>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [sentInvitations, setSentInvitations] = useState<OrganizationInvitation[]>([]);
  const [receivedInvitations, setReceivedInvitations] = useState<OrganizationInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [cancelingInvitationId, setCancelingInvitationId] = useState<string | null>(null);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);
  const [providerCatalog, setProviderCatalog] = useState<LlmProviderCatalogItem[]>([]);
  const [llmProfiles, setLlmProfiles] = useState<OrganizationLlmProfile[]>([]);
  const [llmProfileName, setLlmProfileName] = useState("");
  const [llmProvider, setLlmProvider] = useState("openai");
  const [llmApiKey, setLlmApiKey] = useState("");
  const [llmApiBase, setLlmApiBase] = useState("");
  const [creatingLlmProfile, setCreatingLlmProfile] = useState(false);
  const [deletingLlmProfileId, setDeletingLlmProfileId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<OrganizationView>("team-management");
  const hasInitializedDefaultView = useRef(false);
  const { toast } = useToast();
  const { refresh } = useOnboarding();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const me = await api<DeveloperMe>("/v1/auth/me");
      const [loadedOrganization, loadedMembers, loadedReceived, loadedProviders, loadedProfiles] = await Promise.all([
        api<OrganizationInfo>("/v1/organizations/me"),
        api<OrganizationMember[]>("/v1/organizations/members"),
        api<OrganizationInvitation[]>("/v1/organizations/invitations/received"),
        api<LlmProviderCatalogItem[]>("/v1/organizations/llm/providers"),
        api<OrganizationLlmProfile[]>("/v1/organizations/llm-profiles"),
      ]);
      let loadedSent: OrganizationInvitation[] = [];
      if (me.role === "owner" || me.role === "admin") {
        loadedSent = await api<OrganizationInvitation[]>("/v1/organizations/invitations/sent");
      }

      setCurrentUser(me);
      setOrganization(loadedOrganization);
      setMembers(loadedMembers);
      setSentInvitations(loadedSent);
      setReceivedInvitations(loadedReceived);
      setProviderCatalog(loadedProviders);
      setLlmProfiles(loadedProfiles);
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to load organization data", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (loading || hasInitializedDefaultView.current) return;
    setActiveView(llmProfiles.length === 0 ? "llm-setup" : "team-management");
    hasInitializedDefaultView.current = true;
  }, [loading, llmProfiles.length]);

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviteLoading(true);
    try {
      await api<OrganizationInvitation>("/v1/organizations/invitations", {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail }),
      });
      setInviteEmail("");
      toast("Invitation sent", "success");
      await loadData();
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to send invitation", "error");
    } finally {
      setInviteLoading(false);
    }
  }

  async function cancelInvitation(invitationId: string) {
    setCancelingInvitationId(invitationId);
    try {
      await api(`/v1/organizations/invitations/${invitationId}`, {
        method: "DELETE",
      });
      toast("Invitation canceled", "info");
      await loadData();
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to cancel invitation", "error");
    } finally {
      setCancelingInvitationId(null);
    }
  }

  async function acceptInvitation(invitationId: string) {
    setAcceptingId(invitationId);
    try {
      await api<OrganizationInvitation>(`/v1/organizations/invitations/${invitationId}/accept`, {
        method: "POST",
      });
      toast("Invitation accepted", "success");
      await loadData();
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to accept invitation", "error");
    } finally {
      setAcceptingId(null);
    }
  }

  async function updateMemberRole(memberId: string, role: "owner" | "admin" | "member") {
    setUpdatingRoleId(memberId);
    try {
      await api<OrganizationMember>(`/v1/organizations/members/${memberId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      toast("Member role updated", "success");
      await loadData();
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to update member role", "error");
    } finally {
      setUpdatingRoleId(null);
    }
  }

  async function createLlmProfile(e: FormEvent) {
    e.preventDefault();
    if (!llmProfileName.trim() || !llmProvider.trim() || !llmApiKey.trim()) return;

    const hadNoProfiles = llmProfiles.length === 0;
    setCreatingLlmProfile(true);
    try {
      await api<OrganizationLlmProfile>("/v1/organizations/llm-profiles", {
        method: "POST",
        body: JSON.stringify({
          name: llmProfileName.trim(),
          provider: llmProvider.trim(),
          api_key: llmApiKey.trim(),
          api_base: llmApiBase.trim() || null,
        }),
      });
      setLlmProfileName("");
      setLlmApiKey("");
      setLlmApiBase("");
      toast("LLM profile created", "success");
      await loadData();
      await refresh();
      if (hadNoProfiles) {
        setActiveView("team-management");
      }
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to create LLM profile", "error");
    } finally {
      setCreatingLlmProfile(false);
    }
  }

  async function deleteLlmProfile(profileId: string) {
    setDeletingLlmProfileId(profileId);
    try {
      await api(`/v1/organizations/llm-profiles/${profileId}`, {
        method: "DELETE",
      });
      toast("LLM profile removed", "info");
      await loadData();
      await refresh();
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to delete LLM profile", "error");
    } finally {
      setDeletingLlmProfileId(null);
    }
  }

  const canManageOrganization = currentUser?.role === "owner" || currentUser?.role === "admin";
  const editableRoles =
    currentUser?.role === "owner"
      ? (["owner", "admin", "member"] as const)
      : (["admin", "member"] as const);
  const selectedLlmProvider = providerCatalog.find((provider) => provider.id === llmProvider);
  const memberCount = loading ? "..." : members.length;
  const profileCount = loading ? "..." : llmProfiles.length;
  const sentInvitationCount = loading ? "..." : sentInvitations.length;
  const receivedInvitationCount = loading ? "..." : receivedInvitations.length;
  const headerSubtitle = organization
    ? `Manage teammates and shared LLM credentials for ${organization.name}.`
    : "Manage team access and shared LLM provider credentials.";
  const llmViewActive = activeView === "llm-setup";
  const teamViewActive = activeView === "team-management";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Organization Workspace"
        title="Organization Admin"
        subtitle={headerSubtitle}
        rightSlot={
          organization ? (
            <Badge variant="default">Org ID: {organization.public_id}</Badge>
          ) : undefined
        }
      />

      <section className="grid grid-cols-2 gap-3 animate-fade-in-up delay-50 xl:grid-cols-4">
        <MetricTile label="LLM Profiles" value={profileCount} hint="Shared provider credentials" />
        <MetricTile label="Team Members" value={memberCount} hint="Users in this organization" />
        <MetricTile label="Sent Invites" value={canManageOrganization ? sentInvitationCount : "-"} hint="Pending invitations" />
        <MetricTile label="Invites For You" value={receivedInvitationCount} hint="Pending invites to accept" />
      </section>

      <section className="animate-fade-in-up delay-100">
        <div className="flex gap-1 overflow-x-auto border-b border-border pb-1">
          <button
            type="button"
            onClick={() => setActiveView("llm-setup")}
            className={`relative whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors ${
              llmViewActive ? "text-strong" : "text-subtle hover:text-body"
            }`}
          >
            LLM Setup
            {llmViewActive && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full bg-accent" />}
          </button>
          <button
            type="button"
            onClick={() => setActiveView("team-management")}
            className={`relative whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors ${
              teamViewActive ? "text-strong" : "text-subtle hover:text-body"
            }`}
          >
            Team Management
            {teamViewActive && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full bg-accent" />}
          </button>
        </div>
        <p className="mt-2 text-xs text-subtle">
          {llmViewActive
            ? "Configure provider credentials once, then use them across apps and knowledge bases."
            : "Invite teammates, set roles, and manage pending invitations."}
        </p>
      </section>

      {llmViewActive && (
        <SectionCard
          title="Organization LLM Profiles"
          subtitle="Set provider credentials once here. Individual app pages pick model settings from these profiles."
          className="animate-fade-in-up delay-150"
        >
        {!canManageOrganization && (
          <div className="mb-4 rounded-lg border border-border bg-surface-2 px-3 py-2">
            <p className="text-xs text-subtle">Only organization owners and admins can create or delete provider profiles.</p>
          </div>
        )}

        {canManageOrganization && (
          <form onSubmit={createLlmProfile} className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Input
              label="Profile Name"
              value={llmProfileName}
              onChange={(e) => setLlmProfileName(e.target.value)}
              placeholder="OpenAI Prod"
              required
            />
            <Select label="Provider" value={llmProvider} onChange={(e) => setLlmProvider(e.target.value)}>
              {providerCatalog.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </Select>
            <Input
              label="API Key"
              type="password"
              value={llmApiKey}
              onChange={(e) => setLlmApiKey(e.target.value)}
              placeholder="sk-..."
              required
            />
            <div className="flex items-end">
              <Button type="submit" className="w-full" loading={creatingLlmProfile}>
                Add Profile
              </Button>
            </div>

            <p className="text-xs text-subtle md:col-span-4">
              API keys are validated with a live provider request before a profile is saved.
            </p>

            {selectedLlmProvider?.custom_base_url && (
              <div className="md:col-span-4">
                <Input
                  label="API Base URL (optional)"
                  value={llmApiBase}
                  onChange={(e) => setLlmApiBase(e.target.value)}
                  placeholder="https://api.example.com/v1"
                  mono
                />
              </div>
            )}
          </form>
        )}

        <div className="mt-4">
          <DataPanel
            title="Configured Profiles"
            subtitle="These credentials are reusable across app config and Knowledge Base embeddings."
          >
            {loading ? (
              <p className="text-xs text-subtle">Loading LLM profiles...</p>
            ) : llmProfiles.length === 0 ? (
              <p className="text-xs text-subtle">No LLM profiles configured yet.</p>
            ) : (
              <div className="space-y-2">
                {llmProfiles.map((profile) => (
                  <div
                    key={profile.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-canvas/40 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-strong">{profile.name}</p>
                      <p className="text-xs text-subtle">{profile.provider}</p>
                      {profile.api_base && <p className="truncate font-mono text-xs text-dim">{profile.api_base}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={profile.has_api_key ? "active" : "revoked"} dot>
                        API key {profile.has_api_key ? "set" : "missing"}
                      </Badge>
                      {canManageOrganization && (
                        <Button
                          size="sm"
                          variant="outline"
                          loading={deletingLlmProfileId === profile.id}
                          onClick={() => {
                            void deleteLlmProfile(profile.id);
                          }}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DataPanel>
        </div>
      </SectionCard>
      )}

      {teamViewActive && (
        <SectionCard
          title="Team Access Management"
          subtitle="Invite teammates, set roles, review pending invitations, and accept invites sent to you."
          className="animate-fade-in-up delay-150"
        >
        {canManageOrganization ? (
          <DataPanel title="Invite User" subtitle="Invitations work only for emails that already registered an account.">
            <form onSubmit={handleInvite} className="flex flex-col gap-3 sm:flex-row">
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teammate@example.com"
                className="flex-1"
                required
              />
              <Button type="submit" loading={inviteLoading}>
                Invite
              </Button>
            </form>
          </DataPanel>
        ) : (
          <DataPanel title="Invite User">
            <p className="text-xs text-subtle">Only organization owners and admins can send invitations.</p>
          </DataPanel>
        )}

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <DataPanel title="Organization Members">
            {loading ? (
              <p className="text-xs text-subtle">Loading members...</p>
            ) : members.length === 0 ? (
              <p className="text-xs text-subtle">No members found.</p>
            ) : (
              <div className="space-y-2">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-canvas/40 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-strong">
                        {member.name}
                        {currentUser?.id === member.id ? " (You)" : ""}
                      </p>
                      <p className="truncate font-mono text-xs text-subtle">{member.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={member.role === "owner" ? "live" : member.role === "admin" ? "active" : "default"}>
                        {member.role}
                      </Badge>
                      {canManageOrganization && currentUser?.id !== member.id && (
                        <select
                          className="rounded border border-border bg-surface px-2 py-1 text-xs text-body"
                          value={member.role}
                          disabled={
                            updatingRoleId === member.id ||
                            (currentUser?.role === "admin" && member.role === "owner")
                          }
                          onChange={(e) => {
                            void updateMemberRole(
                              member.id,
                              e.target.value as "owner" | "admin" | "member",
                            );
                          }}
                        >
                          {editableRoles.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DataPanel>

          {canManageOrganization && (
            <DataPanel title="Pending Invitations (Sent)">
              {loading ? (
                <p className="text-xs text-subtle">Loading invitations...</p>
              ) : sentInvitations.length === 0 ? (
                <p className="text-xs text-subtle">No pending invitations sent.</p>
              ) : (
                <div className="space-y-2">
                  {sentInvitations.map((invitation) => (
                    <div
                      key={invitation.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-canvas/40 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-strong">{invitation.invitee_email}</p>
                        <p className="text-xs text-subtle">Expires {new Date(invitation.expires_at).toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="live">Pending</Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          loading={cancelingInvitationId === invitation.id}
                          onClick={() => {
                            void cancelInvitation(invitation.id);
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </DataPanel>
          )}
        </div>

        <div className="mt-4">
          <DataPanel title="Invitations For You">
            {loading ? (
              <p className="text-xs text-subtle">Loading invitations...</p>
            ) : receivedInvitations.length === 0 ? (
              <p className="text-xs text-subtle">No pending invitations to accept.</p>
            ) : (
              <div className="space-y-2">
                {receivedInvitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-canvas/40 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm text-strong">Organization Invitation</p>
                      <p className="text-xs text-subtle">Expires {new Date(invitation.expires_at).toLocaleString()}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      loading={acceptingId === invitation.id}
                      onClick={() => {
                        void acceptInvitation(invitation.id);
                      }}
                    >
                      Accept
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </DataPanel>
        </div>
      </SectionCard>
      )}
    </div>
  );
}
