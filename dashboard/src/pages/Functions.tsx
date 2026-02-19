import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api/client";

interface Fn {
  id: string;
  name: string;
  description: string;
  description_override: string | null;
  parameters_schema: Record<string, unknown>;
  is_active: boolean;
  timeout_seconds: number;
}

export default function Functions() {
  const { appId } = useParams();
  const [functions, setFunctions] = useState<Fn[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [overrideText, setOverrideText] = useState("");

  useEffect(() => {
    api<Fn[]>(`/v1/apps/${appId}/functions`).then(setFunctions);
  }, [appId]);

  async function toggleActive(fn: Fn) {
    const updated = await api<Fn>(`/v1/apps/${appId}/functions/${fn.id}`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: !fn.is_active }),
    });
    setFunctions(functions.map((f) => (f.id === fn.id ? updated : f)));
  }

  function startEditOverride(fn: Fn) {
    setEditingId(fn.id);
    setOverrideText(fn.description_override || "");
  }

  async function saveOverride(fn: Fn) {
    const updated = await api<Fn>(`/v1/apps/${appId}/functions/${fn.id}`, {
      method: "PATCH",
      body: JSON.stringify({ description_override: overrideText || null }),
    });
    setFunctions(functions.map((f) => (f.id === fn.id ? updated : f)));
    setEditingId(null);
  }

  async function clearOverride(fn: Fn) {
    const updated = await api<Fn>(`/v1/apps/${appId}/functions/${fn.id}`, {
      method: "PATCH",
      body: JSON.stringify({ description_override: null }),
    });
    setFunctions(functions.map((f) => (f.id === fn.id ? updated : f)));
    setEditingId(null);
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link to="/apps" className="text-blue-600 hover:underline text-sm">&larr; Apps</Link>
        <h1 className="text-2xl font-bold">Registered Functions</h1>
      </div>

      <div className="space-y-3">
        {functions.map((fn) => (
          <div
            key={fn.id}
            className={`bg-white rounded-lg shadow p-4 ${!fn.is_active ? "opacity-50" : ""}`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h2 className="font-mono font-medium">{fn.name}</h2>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    fn.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {fn.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <button
                onClick={() => toggleActive(fn)}
                className="text-sm text-blue-600 hover:underline"
              >
                {fn.is_active ? "Deactivate" : "Activate"}
              </button>
            </div>

            {/* Description section */}
            <div className="mb-2">
              <p className="text-xs text-gray-400 mb-1">SDK Description:</p>
              <p className="text-sm text-gray-600">{fn.description}</p>
            </div>

            {/* Override section */}
            {editingId === fn.id ? (
              <div className="mb-2 border rounded p-3 bg-gray-50">
                <label className="block text-xs text-gray-500 mb-1">LLM Description Override:</label>
                <textarea
                  value={overrideText}
                  onChange={(e) => setOverrideText(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Override the description the LLM sees..."
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => saveOverride(fn)}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                  >
                    Save
                  </button>
                  {fn.description_override && (
                    <button
                      onClick={() => clearOverride(fn)}
                      className="text-red-600 px-3 py-1 rounded text-sm hover:underline"
                    >
                      Clear Override
                    </button>
                  )}
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-gray-500 px-3 py-1 rounded text-sm hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="mb-2">
                {fn.description_override ? (
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <p className="text-xs text-purple-600 mb-1">LLM Override:</p>
                      <p className="text-sm text-purple-800 bg-purple-50 rounded px-2 py-1">{fn.description_override}</p>
                    </div>
                    <button
                      onClick={() => startEditOverride(fn)}
                      className="text-xs text-blue-600 hover:underline mt-3"
                    >
                      Edit
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => startEditOverride(fn)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    + Add description override
                  </button>
                )}
              </div>
            )}

            <div className="flex gap-4 text-xs text-gray-500">
              <span>Timeout: {fn.timeout_seconds}s</span>
            </div>
            {Object.keys(fn.parameters_schema).length > 0 && (
              <pre className="mt-2 bg-gray-50 rounded p-2 text-xs overflow-auto max-h-32">
                {JSON.stringify(fn.parameters_schema, null, 2)}
              </pre>
            )}
          </div>
        ))}
        {functions.length === 0 && (
          <p className="text-gray-500 text-center py-8">
            No functions registered. Functions are registered by the iOS SDK.
          </p>
        )}
      </div>
    </div>
  );
}
