import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { ApiError, api } from "../api/client";
import { Badge, Button, Input, useToast } from "../components/ui";

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
  const { toast } = useToast();

  async function loadData() {
    setLoading(true);
    try {
      const me = await api<DeveloperMe>("/v1/auth/me");
      const [loadedOrganization, loadedMembers, loadedReceived] = await Promise.all([
        api<OrganizationInfo>("/v1/organizations/me"),
        api<OrganizationMember[]>("/v1/organizations/members"),
        api<OrganizationInvitation[]>("/v1/organizations/invitations/received"),
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
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to load organization data", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

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

  const canManageOrganization = currentUser?.role === "owner" || currentUser?.role === "admin";
  const editableRoles =
    currentUser?.role === "owner"
      ? (["owner", "admin", "member"] as const)
      : (["admin", "member"] as const);

  return (
    <div className="space-y-6">
      <div className="animate-fade-in-up">
        <h1 className="font-display text-2xl font-bold text-strong">
          Organization Admin
        </h1>
        {organization ? (
          <div className="text-sm text-subtle mt-1">
            <p>{organization.name}</p>
            <p className="font-mono text-xs mt-0.5">
              Organization ID: {organization.public_id}
            </p>
          </div>
        ) : (
          <p className="text-sm text-subtle mt-1">
            Invite team members and manage organization access.
          </p>
        )}
      </div>

      {canManageOrganization ? (
        <div className="bg-surface border border-border rounded-xl p-5 animate-fade-in-up">
          <h2 className="text-sm font-semibold text-strong mb-1">Invite User</h2>
          <p className="text-xs text-subtle mb-4">
            Invitations work only for emails that already have a registered account.
          </p>
          <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
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
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl p-5 animate-fade-in-up">
          <h2 className="text-sm font-semibold text-strong mb-1">Invite User</h2>
          <p className="text-xs text-subtle">
            Only organization owners and admins can send invitations.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface border border-border rounded-xl p-5 animate-fade-in-up">
          <h2 className="text-sm font-semibold text-strong mb-3">Organization Members</h2>
          {loading ? (
            <p className="text-xs text-subtle">Loading members...</p>
          ) : members.length === 0 ? (
            <p className="text-xs text-subtle">No members found.</p>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="rounded-lg border border-border bg-canvas/40 px-3 py-2 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-strong">
                      {member.name}
                      {currentUser?.id === member.id ? " (You)" : ""}
                    </p>
                    <p className="text-xs text-subtle font-mono truncate">{member.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={member.role === "owner" ? "live" : member.role === "admin" ? "active" : "default"}>
                      {member.role}
                    </Badge>
                    {canManageOrganization && currentUser?.id !== member.id && (
                      <select
                        className="bg-surface border border-border rounded px-2 py-1 text-xs text-body"
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
        </div>

        {canManageOrganization && (
          <div className="bg-surface border border-border rounded-xl p-5 animate-fade-in-up">
            <h2 className="text-sm font-semibold text-strong mb-3">Pending Invitations (Sent)</h2>
            {loading ? (
              <p className="text-xs text-subtle">Loading invitations...</p>
            ) : sentInvitations.length === 0 ? (
              <p className="text-xs text-subtle">No pending invitations sent.</p>
            ) : (
              <div className="space-y-2">
                {sentInvitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="rounded-lg border border-border bg-canvas/40 px-3 py-2 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-strong truncate">{invitation.invitee_email}</p>
                      <p className="text-xs text-subtle">
                        Expires {new Date(invitation.expires_at).toLocaleString()}
                      </p>
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
          </div>
        )}
      </div>

      <div className="bg-surface border border-border rounded-xl p-5 animate-fade-in-up">
        <h2 className="text-sm font-semibold text-strong mb-3">Invitations For You</h2>
        {loading ? (
          <p className="text-xs text-subtle">Loading invitations...</p>
        ) : receivedInvitations.length === 0 ? (
          <p className="text-xs text-subtle">No pending invitations to accept.</p>
        ) : (
          <div className="space-y-2">
            {receivedInvitations.map((invitation) => (
              <div
                key={invitation.id}
                className="rounded-lg border border-border bg-canvas/40 px-3 py-2 flex items-center justify-between gap-3"
              >
                <div>
                  <p className="text-sm text-strong">Organization Invitation</p>
                  <p className="text-xs text-subtle">
                    Expires {new Date(invitation.expires_at).toLocaleString()}
                  </p>
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
      </div>
    </div>
  );
}
