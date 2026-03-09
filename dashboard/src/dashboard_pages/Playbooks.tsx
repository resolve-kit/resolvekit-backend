import { useEffect, useState } from "react";
import { ResolveKitAction } from "@resolvekit/nextjs/react";
import { useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import {
  Badge,
  Button,
  ConfirmDialog,
  Input,
  PageSpinner,
  Select,
  Textarea,
  useToast,
} from "../components/ui";
import OnboardingTipCard from "../components/OnboardingTipCard";

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
  const { toast } = useToast();
  const [playbooks, setPlaybooks] = useState<PlaybookListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<Playbook | null>(null);
  const [appFunctions, setAppFunctions] = useState<AppFunction[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formInstructions, setFormInstructions] = useState("");
  const [formActive, setFormActive] = useState(true);

  // Steps editor
  const [steps, setSteps] = useState<PlaybookFn[]>([]);
  const [isSavingSteps, setIsSavingSteps] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      api<PlaybookListItem[]>(`/v1/apps/${appId}/playbooks`).then(setPlaybooks),
      api<AppFunction[]>(`/v1/apps/${appId}/functions`).then(setAppFunctions),
    ]).finally(() => setIsLoading(false));
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
    try {
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
      toast("Playbook created", "success");
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to create playbook", "error");
    }
  }

  async function handleUpdate() {
    if (!selected) return;
    try {
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
      toast("Playbook updated", "success");
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to update playbook", "error");
    }
  }

  async function handleDelete(id: string) {
    await api(`/v1/apps/${appId}/playbooks/${id}`, { method: "DELETE" });
    setSelected(null);
    setConfirmDeleteId(null);
    await loadPlaybooks();
    toast("Playbook deleted", "info");
  }

  async function saveSteps() {
    if (!selected) return;
    setIsSavingSteps(true);
    try {
      const body = steps.map((s) => ({
        function_id: s.function_id,
        step_order: s.step_order,
        step_description: s.step_description,
      }));
      const pb = await api<Playbook>(
        `/v1/apps/${appId}/playbooks/${selected.id}/functions`,
        { method: "PUT", body: JSON.stringify(body) }
      );
      setSelected(pb);
      setSteps(pb.functions);
      await loadPlaybooks();
      toast("Steps saved", "success");
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to save steps", "error");
    } finally {
      setIsSavingSteps(false);
    }
  }

  function addStep() {
    const activeFns = appFunctions.filter((f) => f.is_active);
    if (activeFns.length === 0) return;
    const nextOrder =
      steps.length > 0 ? Math.max(...steps.map((s) => s.step_order)) + 1 : 1;
    setSteps([
      ...steps,
      {
        function_id: activeFns[0].id,
        function_name: activeFns[0].name,
        step_order: nextOrder,
        step_description: null,
      },
    ]);
  }

  function removeStep(idx: number) {
    setSteps(steps.filter((_, i) => i !== idx));
  }

  function updateStep(
    idx: number,
    field: keyof PlaybookFn,
    value: string | number | null
  ) {
    const updated = [...steps];
    if (field === "function_id") {
      const fn = appFunctions.find((f) => f.id === value);
      updated[idx] = {
        ...updated[idx],
        function_id: value as string,
        function_name: fn?.name || "",
      };
    } else {
      updated[idx] = { ...updated[idx], [field]: value };
    }
    setSteps(updated);
  }

  const playbookToDelete = playbooks.find((p) => p.id === confirmDeleteId) ||
    (selected?.id === confirmDeleteId ? selected : null);

  if (isLoading) return <PageSpinner />;

  return (
    <div>
      <div className="glass-panel rounded-2xl px-4 py-3 flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-strong tracking-tight">
            Playbooks
          </h1>
          <p className="text-sm text-subtle mt-1">
            Define guided workflows that orchestrate function sequences
          </p>
        </div>
        <ResolveKitAction
          as={Button}
          actionId="new-playbook-btn"
          actionRole="action"
          description="Open form to create a new playbook"
          variant="primary"
          size="md"
          onClick={startCreate}
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          }
        >
          New Playbook
        </ResolveKitAction>
      </div>
      <OnboardingTipCard tipId="playbooks_tip" fallbackRoute={`/apps/${appId}/playbooks`} />

      {/* Create form */}
      {showCreate && (
        <div
          className="bg-surface border border-accent/30 rounded-xl p-5 mb-6"
          style={{ boxShadow: "var(--shadow-glow-accent)" }}
        >
          <h2 className="text-sm font-semibold text-strong mb-4">
            Create Playbook
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="VPN Troubleshooting"
              />
              <Input
                label="Description (dashboard only)"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="Guides the agent through VPN issues"
              />
            </div>
            <Textarea
              label="LLM Instructions"
              value={formInstructions}
              onChange={(e) => setFormInstructions(e.target.value)}
              rows={4}
              placeholder="When the user reports VPN connectivity issues, follow these steps..."
            />
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="create-active"
                checked={formActive}
                onChange={(e) => setFormActive(e.target.checked)}
                className="w-4 h-4 rounded border-border bg-surface accent-accent"
              />
              <label htmlFor="create-active" className="text-sm text-body">
                Active
              </label>
            </div>
            <div className="flex gap-2">
              <Button variant="primary" size="sm" onClick={handleCreate}>
                Create
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </Button>
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
              className={`w-full text-left bg-surface border rounded-xl p-3 transition-all hover:border-border-2 ${
                selected?.id === pb.id
                  ? "border-accent/40 bg-accent-subtle"
                  : "border-border"
              } ${!pb.is_active ? "opacity-60" : ""}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm text-strong truncate pr-2">
                  {pb.name}
                </span>
                <Badge variant={pb.is_active ? "active" : "inactive"} dot>
                  {pb.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
              {pb.description && (
                <p className="text-xs text-subtle mt-1 truncate">
                  {pb.description}
                </p>
              )}
              <p className="text-xs text-muted mt-1">
                {pb.function_count} function
                {pb.function_count !== 1 ? "s" : ""}
              </p>
            </button>
          ))}
          {playbooks.length === 0 && !showCreate && (
            <p className="text-subtle text-center py-8 text-sm">
              No playbooks yet.
            </p>
          )}
        </div>

        {/* Detail / edit pane */}
        {selected && (
          <div className="col-span-2 glass-panel rounded-xl overflow-hidden">
            {editMode ? (
              <div className="p-5 space-y-4">
                <h3 className="text-sm font-semibold text-strong">
                  Edit Playbook
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                  <Input
                    label="Description"
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                  />
                </div>
                <Textarea
                  label="LLM Instructions"
                  value={formInstructions}
                  onChange={(e) => setFormInstructions(e.target.value)}
                  rows={4}
                />
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="edit-active"
                    checked={formActive}
                    onChange={(e) => setFormActive(e.target.checked)}
                    className="w-4 h-4 rounded border-border bg-surface accent-accent"
                  />
                  <label htmlFor="edit-active" className="text-sm text-body">
                    Active
                  </label>
                </div>
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" onClick={handleUpdate}>
                    Save
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditMode(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* Pane header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                  <div className="flex items-center gap-2.5">
                    <h2 className="font-semibold text-strong text-base">
                      {selected.name}
                    </h2>
                    <Badge variant={selected.is_active ? "active" : "inactive"} dot>
                      {selected.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={startEdit}>
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmDeleteId(selected.id)}
                      className="text-danger border-danger-dim hover:bg-danger-subtle"
                    >
                      Delete
                    </Button>
                  </div>
                </div>

                <div className="p-5 space-y-5">
                  <div className="space-y-4">
                    {selected.description && (
                      <p className="text-sm text-subtle">
                        {selected.description}
                      </p>
                    )}
                    <div>
                      <h3 className="text-xs text-muted uppercase tracking-wider mb-2">
                        LLM Instructions
                      </h3>
                      <pre className="bg-canvas border border-border rounded-lg p-3 text-sm text-body whitespace-pre-wrap font-body">
                        {selected.instructions || "(none)"}
                      </pre>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs text-muted uppercase tracking-wider">
                        Function Steps
                      </h3>
                    </div>

                    <div className="space-y-2 mb-4">
                      {steps.length === 0 && (
                        <p className="text-subtle text-sm text-center py-4">
                          No function steps assigned yet.
                        </p>
                      )}
                      {steps.map((step, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-3 bg-surface-2 border border-border rounded-xl p-3"
                        >
                          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-accent-subtle border border-accent-dim text-accent text-xs flex items-center justify-center font-mono font-medium">
                            {idx + 1}
                          </div>

                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <Select
                              value={step.function_id}
                              onChange={(e) =>
                                updateStep(idx, "function_id", e.target.value)
                              }
                            >
                              {appFunctions
                                .filter((f) => f.is_active)
                                .map((f) => (
                                  <option key={f.id} value={f.id}>
                                    {f.name}
                                  </option>
                                ))}
                            </Select>
                            <Input
                              value={step.step_description || ""}
                              onChange={(e) =>
                                updateStep(
                                  idx,
                                  "step_description",
                                  e.target.value || null
                                )
                              }
                              placeholder="Step note (optional)"
                            />
                          </div>

                          <button
                            onClick={() => removeStep(idx)}
                            className="flex-shrink-0 text-muted hover:text-danger transition-colors mt-1.5"
                            title="Remove step"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={addStep}
                        icon={
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                        }
                        disabled={
                          appFunctions.filter((f) => f.is_active).length === 0
                        }
                      >
                        Add Step
                      </Button>
                      {steps.length > 0 && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={saveSteps}
                          loading={isSavingSteps}
                        >
                          Save Steps
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Delete Playbook"
        description={`Delete "${playbookToDelete?.name}"? This will permanently remove the playbook and its function assignments.`}
        confirmLabel="Delete Playbook"
        confirmVariant="danger"
        onConfirm={() => handleDelete(confirmDeleteId!)}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
