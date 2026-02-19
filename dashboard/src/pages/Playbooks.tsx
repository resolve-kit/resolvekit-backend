import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api/client";

interface PlaybookFn {
  function_id: string;
  function_name: string;
  step_order: number;
  step_description: string | null;
}

interface Playbook {
  id: string;
  app_id: string;
  name: string;
  description: string;
  instructions: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  functions: PlaybookFn[];
}

interface PlaybookListItem {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  function_count: number;
}

interface AppFunction {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
}

export default function Playbooks() {
  const { appId } = useParams();
  const [playbooks, setPlaybooks] = useState<PlaybookListItem[]>([]);
  const [selected, setSelected] = useState<Playbook | null>(null);
  const [appFunctions, setAppFunctions] = useState<AppFunction[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formInstructions, setFormInstructions] = useState("");
  const [formActive, setFormActive] = useState(true);

  // Steps editor
  const [steps, setSteps] = useState<PlaybookFn[]>([]);

  useEffect(() => {
    loadPlaybooks();
    api<AppFunction[]>(`/v1/apps/${appId}/functions`).then(setAppFunctions);
  }, [appId]);

  async function loadPlaybooks() {
    const list = await api<PlaybookListItem[]>(`/v1/apps/${appId}/playbooks`);
    setPlaybooks(list);
  }

  async function selectPlaybook(id: string) {
    const pb = await api<Playbook>(`/v1/apps/${appId}/playbooks/${id}`);
    setSelected(pb);
    setSteps(pb.functions);
    setEditMode(false);
  }

  function startEdit() {
    if (!selected) return;
    setFormName(selected.name);
    setFormDesc(selected.description);
    setFormInstructions(selected.instructions);
    setFormActive(selected.is_active);
    setEditMode(true);
  }

  function startCreate() {
    setSelected(null);
    setFormName("");
    setFormDesc("");
    setFormInstructions("");
    setFormActive(true);
    setSteps([]);
    setShowCreate(true);
    setEditMode(false);
  }

  async function handleCreate() {
    const pb = await api<Playbook>(`/v1/apps/${appId}/playbooks`, {
      method: "POST",
      body: JSON.stringify({
        name: formName,
        description: formDesc,
        instructions: formInstructions,
        is_active: formActive,
      }),
    });
    setShowCreate(false);
    await loadPlaybooks();
    await selectPlaybook(pb.id);
  }

  async function handleUpdate() {
    if (!selected) return;
    await api<Playbook>(`/v1/apps/${appId}/playbooks/${selected.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: formName,
        description: formDesc,
        instructions: formInstructions,
        is_active: formActive,
      }),
    });
    setEditMode(false);
    await loadPlaybooks();
    await selectPlaybook(selected.id);
  }

  async function handleDelete(id: string) {
    await api(`/v1/apps/${appId}/playbooks/${id}`, { method: "DELETE" });
    setSelected(null);
    await loadPlaybooks();
  }

  async function saveSteps() {
    if (!selected) return;
    const body = steps.map((s) => ({
      function_id: s.function_id,
      step_order: s.step_order,
      step_description: s.step_description,
    }));
    const pb = await api<Playbook>(`/v1/apps/${appId}/playbooks/${selected.id}/functions`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    setSelected(pb);
    setSteps(pb.functions);
    await loadPlaybooks();
  }

  function addStep() {
    const activeFns = appFunctions.filter((f) => f.is_active);
    if (activeFns.length === 0) return;
    const nextOrder = steps.length > 0 ? Math.max(...steps.map((s) => s.step_order)) + 1 : 1;
    setSteps([...steps, {
      function_id: activeFns[0].id,
      function_name: activeFns[0].name,
      step_order: nextOrder,
      step_description: null,
    }]);
  }

  function removeStep(idx: number) {
    setSteps(steps.filter((_, i) => i !== idx));
  }

  function updateStep(idx: number, field: keyof PlaybookFn, value: string | number | null) {
    const updated = [...steps];
    if (field === "function_id") {
      const fn = appFunctions.find((f) => f.id === value);
      updated[idx] = { ...updated[idx], function_id: value as string, function_name: fn?.name || "" };
    } else {
      updated[idx] = { ...updated[idx], [field]: value };
    }
    setSteps(updated);
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link to="/apps" className="text-blue-600 hover:underline text-sm">&larr; Apps</Link>
        <h1 className="text-2xl font-bold">Playbooks</h1>
        <button
          onClick={startCreate}
          className="ml-auto bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
        >
          New Playbook
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h2 className="font-medium mb-3">Create Playbook</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Name</label>
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="VPN Troubleshooting"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Description (dashboard only)</label>
              <input
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="Guides the agent through VPN issues"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">LLM Instructions</label>
              <textarea
                value={formInstructions}
                onChange={(e) => setFormInstructions(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
                rows={4}
                placeholder="When the user reports VPN connectivity issues, follow these steps..."
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formActive}
                onChange={(e) => setFormActive(e.target.checked)}
                id="create-active"
              />
              <label htmlFor="create-active" className="text-sm">Active</label>
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreate} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
                Create
              </button>
              <button onClick={() => setShowCreate(false)} className="text-gray-500 px-4 py-2 rounded text-sm hover:underline">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {/* Playbook list */}
        <div className="space-y-2">
          {playbooks.map((pb) => (
            <button
              key={pb.id}
              onClick={() => selectPlaybook(pb.id)}
              className={`w-full text-left bg-white rounded-lg shadow p-3 hover:ring-2 hover:ring-blue-300 transition ${
                selected?.id === pb.id ? "ring-2 ring-blue-500" : ""
              } ${!pb.is_active ? "opacity-50" : ""}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{pb.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  pb.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                }`}>
                  {pb.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              {pb.description && <p className="text-xs text-gray-500 mt-1">{pb.description}</p>}
              <p className="text-xs text-gray-400 mt-1">{pb.function_count} function{pb.function_count !== 1 ? "s" : ""}</p>
            </button>
          ))}
          {playbooks.length === 0 && !showCreate && (
            <p className="text-gray-500 text-center py-8 text-sm">No playbooks yet.</p>
          )}
        </div>

        {/* Detail / edit pane */}
        {selected && (
          <div className="col-span-2 bg-white rounded-lg shadow p-4">
            {editMode ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Name</label>
                  <input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Description</label>
                  <input
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">LLM Instructions</label>
                  <textarea
                    value={formInstructions}
                    onChange={(e) => setFormInstructions(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm"
                    rows={4}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formActive}
                    onChange={(e) => setFormActive(e.target.checked)}
                    id="edit-active"
                  />
                  <label htmlFor="edit-active" className="text-sm">Active</label>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleUpdate} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
                    Save
                  </button>
                  <button onClick={() => setEditMode(false)} className="text-gray-500 px-4 py-2 rounded text-sm hover:underline">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-medium">{selected.name}</h2>
                  <div className="flex gap-2">
                    <button onClick={startEdit} className="text-sm text-blue-600 hover:underline">Edit</button>
                    <button onClick={() => handleDelete(selected.id)} className="text-sm text-red-600 hover:underline">Delete</button>
                  </div>
                </div>
                {selected.description && (
                  <p className="text-sm text-gray-600 mb-3">{selected.description}</p>
                )}
                <div className="mb-4">
                  <h3 className="text-xs text-gray-500 mb-1">LLM Instructions</h3>
                  <pre className="bg-gray-50 rounded p-3 text-sm whitespace-pre-wrap">{selected.instructions || "(none)"}</pre>
                </div>
              </>
            )}

            {/* Steps editor */}
            <div className="border-t pt-4 mt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-sm">Function Steps</h3>
                <button onClick={addStep} className="text-sm text-blue-600 hover:underline">+ Add Step</button>
              </div>
              {steps.length === 0 && (
                <p className="text-gray-400 text-sm">No functions assigned to this playbook yet.</p>
              )}
              <div className="space-y-2">
                {steps.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-2 bg-gray-50 rounded p-2">
                    <input
                      type="number"
                      value={step.step_order}
                      onChange={(e) => updateStep(idx, "step_order", parseInt(e.target.value) || 0)}
                      className="w-16 border rounded px-2 py-1 text-sm"
                      title="Order"
                    />
                    <select
                      value={step.function_id}
                      onChange={(e) => updateStep(idx, "function_id", e.target.value)}
                      className="flex-1 border rounded px-2 py-1 text-sm"
                    >
                      {appFunctions.filter((f) => f.is_active).map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                    <input
                      value={step.step_description || ""}
                      onChange={(e) => updateStep(idx, "step_description", e.target.value || null)}
                      placeholder="Step note (optional)"
                      className="flex-1 border rounded px-2 py-1 text-sm"
                    />
                    <button onClick={() => removeStep(idx)} className="text-red-500 hover:text-red-700 px-1">
                      &times;
                    </button>
                  </div>
                ))}
              </div>
              {steps.length > 0 && (
                <button
                  onClick={saveSteps}
                  className="mt-3 bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
                >
                  Save Steps
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
