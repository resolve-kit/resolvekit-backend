import { useCallback, useEffect, useState } from "react";
import { Button } from "./Button";

type ConfirmVariant = "danger" | "primary" | "outline";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  confirmVariant?: ConfirmVariant;
  dialogId?: string;
  confirmButtonId?: string;
  cancelButtonId?: string;
  confirmTextRequired?: string;
  confirmTextLabel?: string;
  confirmTextPlaceholder?: string;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  confirmVariant = "danger",
  dialogId,
  confirmButtonId,
  cancelButtonId,
  confirmTextRequired,
  confirmTextLabel = "Type to confirm",
  confirmTextPlaceholder,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [loading, setLoading] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const requiresTypedConfirm = Boolean(confirmTextRequired);
  const typedConfirmMatches = !requiresTypedConfirm || confirmText.trim() === (confirmTextRequired ?? "");

  const handleConfirm = useCallback(async () => {
    if (loading || !typedConfirmMatches) return;
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  }, [loading, onConfirm, typedConfirmMatches]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
      if (event.key === "Enter") {
        event.preventDefault();
        if (!loading && typedConfirmMatches) {
          void handleConfirm();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel, handleConfirm, loading, typedConfirmMatches]);

  useEffect(() => {
    if (open) {
      setConfirmText("");
      setLoading(false);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div data-resolvekit-id={dialogId} className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/28 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-md glass-panel rounded-2xl p-6 animate-fade-in-up">
        <p className="text-[10px] uppercase tracking-[0.2em] text-subtle">Confirm action</p>
        <h2 className="mt-2 font-display text-lg font-semibold text-strong">{title}</h2>
        {description && <p className="mt-2 text-sm text-subtle leading-relaxed">{description}</p>}
        {requiresTypedConfirm && (
          <div className="mt-4">
            <label className="mb-1 block text-xs font-medium text-subtle">
              {confirmTextLabel}
              <span className="ml-1 font-mono text-strong">"{confirmTextRequired}"</span>
            </label>
            <input
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder={confirmTextPlaceholder ?? confirmTextRequired}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-body focus:border-accent focus:outline-none"
            />
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <Button data-resolvekit-id={cancelButtonId} variant="ghost" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            data-resolvekit-id={confirmButtonId}
            variant={confirmVariant}
            onClick={handleConfirm}
            loading={loading}
            disabled={!typedConfirmMatches}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
