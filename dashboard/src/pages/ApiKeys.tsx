import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api/client";

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
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);

  useEffect(() => {
    api<ApiKeyInfo[]>(`/v1/apps/${appId}/api-keys`).then(setKeys);
  }, [appId]);

  async function createKey() {
    const res = await api<ApiKeyCreated>(`/v1/apps/${appId}/api-keys`, {
      method: "POST",
      body: JSON.stringify({ label: newLabel }),
    });
    setNewKey(res.raw_key);
    setKeys([res, ...keys]);
    setNewLabel("");
  }

  async function revokeKey(id: string) {
    await api(`/v1/apps/${appId}/api-keys/${id}`, { method: "DELETE" });
    setKeys(keys.map((k) => (k.id === id ? { ...k, is_active: false } : k)));
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link to="/apps" className="text-blue-600 hover:underline text-sm">&larr; Apps</Link>
        <h1 className="text-2xl font-bold">API Keys</h1>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6 flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">Label</label>
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Production key"
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={createKey}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
        >
          Generate Key
        </button>
      </div>

      {newKey && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-sm font-medium text-green-800 mb-1">New API Key (shown only once):</p>
          <code className="text-sm bg-white px-2 py-1 rounded border block break-all">{newKey}</code>
          <button onClick={() => setNewKey(null)} className="text-sm text-green-700 mt-2 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="space-y-2">
        {keys.map((k) => (
          <div
            key={k.id}
            className={`bg-white rounded-lg shadow p-4 flex items-center justify-between ${
              !k.is_active ? "opacity-50" : ""
            }`}
          >
            <div>
              <span className="font-mono text-sm">{k.key_prefix}...</span>
              {k.label && <span className="ml-2 text-sm text-gray-500">{k.label}</span>}
              <span
                className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                  k.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                }`}
              >
                {k.is_active ? "Active" : "Revoked"}
              </span>
            </div>
            {k.is_active && (
              <button onClick={() => revokeKey(k.id)} className="text-sm text-red-600 hover:underline">
                Revoke
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
