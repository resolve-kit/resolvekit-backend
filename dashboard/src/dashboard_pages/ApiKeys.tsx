import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import {
  Badge,
  Button,
  ConfirmDialog,
  Input,
  PageSpinner,
  useToast,
} from "../components/ui";
import { useOnboarding } from "../context/OnboardingContext";

interface ApiKeyInfo {
  id: string;
  key_prefix: string;
  label: string;
  is_active: boolean;
  created_at: string;
}

interface ApiKeyCreated extends ApiKeyInfo {
  raw_key: string;
}

export default function ApiKeys() {
  const { appId } = useParams();
  const { toast } = useToast();
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newLabel, setNewLabel] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const { refresh } = useOnboarding();

  useEffect(() => {
    setIsLoading(true);
    api<ApiKeyInfo[]>(`/v1/apps/${appId}/api-keys`)
      .then(setKeys)
      .finally(() => setIsLoading(false));
  }, [appId]);

  async function createKey() {
    setIsGenerating(true);
    try {
      const res = await api<ApiKeyCreated>(`/v1/apps/${appId}/api-keys`, {
        method: "POST",
        body: JSON.stringify({ label: newLabel }),
      });
      setNewKey(res.raw_key);
      setKeys([res, ...keys]);
      setNewLabel("");
      toast("API key generated", "success");
      await refresh();
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to generate key", "error");
    } finally {
      setIsGenerating(false);
    }
  }

  async function revokeKey(id: string) {
    await api(`/v1/apps/${appId}/api-keys/${id}`, { method: "DELETE" });
    setKeys(keys.map((k) => (k.id === id ? { ...k, is_active: false } : k)));
    toast("API key revoked", "info");
    await refresh();
  }

  async function copyKey() {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(newKey);
      toast("Copied to clipboard!", "success");
    } catch {
      toast("Failed to copy", "error");
    }
  }

  const keyToRevoke = keys.find((k) => k.id === confirmRevokeId);

  if (isLoading) return <PageSpinner />;

  return (
    <div>
      <div className="glass-panel rounded-2xl px-4 py-3 flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-strong tracking-tight">
            API Keys
          </h1>
          <p className="text-sm text-subtle mt-1">
            Manage SDK authentication keys for your iOS app
          </p>
        </div>
      </div>

      {/* Generate form */}
      <div className="glass-panel rounded-xl p-4 mb-6">
        <h2 className="text-xs font-semibold text-subtle uppercase tracking-wider mb-3">
          Generate New Key
        </h2>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <Input
              label="Label (optional)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. Production, TestFlight"
              onKeyDown={(e) => e.key === "Enter" && createKey()}
            />
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={createKey}
            loading={isGenerating}
          >
            Generate Key
          </Button>
        </div>
      </div>

      {/* New key reveal */}
      {newKey && (
        <div className="bg-success-subtle border border-success-dim rounded-xl p-4 mb-6">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="text-sm font-semibold text-success mb-1">
                New API Key — Copy now, shown only once
              </p>
              <p className="text-xs text-success/70">
                Store this key securely. You won't be able to see it again.
              </p>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <code className="flex-1 bg-canvas border border-success-dim rounded-lg px-3 py-2 text-sm font-mono text-body break-all">
              {newKey}
            </code>
            <Button variant="outline" size="sm" onClick={copyKey}>
              Copy
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setNewKey(null)}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Keys list */}
      <div className="space-y-2">
        {keys.map((k) => (
          <div
            key={k.id}
            className={`glass-panel rounded-xl px-4 py-3 flex items-center justify-between transition-opacity ${
              !k.is_active ? "opacity-50" : ""
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="font-mono text-sm text-dim">
                {k.key_prefix}...
              </span>
              {k.label && (
                <span className="text-sm text-subtle truncate">{k.label}</span>
              )}
              <Badge variant={k.is_active ? "active" : "revoked"} dot>
                {k.is_active ? "Active" : "Revoked"}
              </Badge>
            </div>
            {k.is_active && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmRevokeId(k.id)}
                className="flex-shrink-0 text-danger border-danger-dim hover:bg-danger-subtle"
              >
                Revoke
              </Button>
            )}
          </div>
        ))}

        {keys.length === 0 && (
          <div className="text-center py-12 text-subtle">
            <p className="text-sm">No API keys yet. Generate one above.</p>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmRevokeId !== null}
        title="Revoke API Key"
        description={`Revoke "${keyToRevoke?.label || keyToRevoke?.key_prefix}"? The iOS SDK will immediately lose access. This cannot be undone.`}
        confirmLabel="Revoke Key"
        confirmVariant="danger"
        onConfirm={() => revokeKey(confirmRevokeId!)}
        onCancel={() => setConfirmRevokeId(null)}
      />
    </div>
  );
}
