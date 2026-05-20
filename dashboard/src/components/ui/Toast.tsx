import { useToast, type ToastType } from "./useToast";

const severityConfig: Record<ToastType, { rail: string; iconBg: string; iconBorder: string; icon: React.ReactNode }> = {
  success: {
    rail: "bg-success",
    iconBg: "bg-success-subtle",
    iconBorder: "border-success-dim",
    icon: (
      <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-success">
        <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm3.03 4.97-4 4a.75.75 0 0 1-1.06 0l-1.5-1.5a.75.75 0 1 1 1.06-1.06l.97.97 3.47-3.47a.75.75 0 1 1 1.06 1.06Z" />
      </svg>
    ),
  },
  error: {
    rail: "bg-danger",
    iconBg: "bg-danger-subtle",
    iconBorder: "border-danger-dim",
    icon: (
      <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-danger">
        <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm-1 4a1 1 0 1 1 2 0v3a1 1 0 1 1-2 0V5Zm1 7a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />
      </svg>
    ),
  },
  info: {
    rail: "bg-accent",
    iconBg: "bg-accent-subtle",
    iconBorder: "border-accent-dim",
    icon: (
      <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-accent">
        <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm0 3a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm-1 4h1v4H7V8Z" />
      </svg>
    ),
  },
};

export function ToastContainer() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => {
        const cfg = severityConfig[t.type];
        return (
          <div
            key={t.id}
            className="animate-toast-in pointer-events-auto relative overflow-hidden rounded-xl border border-border bg-surface shadow-[0_12px_28px_-16px_rgba(7,31,66,0.45)] w-[360px]"
            style={{ display: "grid", gridTemplateColumns: "28px 1fr auto", gap: "12px", padding: "12px 14px" }}
          >
            {/* Left severity rail */}
            <span className={`absolute inset-y-0 left-0 w-[3px] rounded-l-xl ${cfg.rail}`} />
            {/* Icon tile */}
            <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border ${cfg.iconBg} ${cfg.iconBorder}`}>
              {cfg.icon}
            </span>
            {/* Body */}
            <div className="min-w-0">
              <div className="text-[13px] font-bold leading-snug text-strong">{t.message}</div>
            </div>
            {/* Close */}
            <button
              onClick={() => dismiss(t.id)}
              className="flex-shrink-0 self-start text-muted transition-opacity hover:text-body"
              aria-label="Dismiss"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
