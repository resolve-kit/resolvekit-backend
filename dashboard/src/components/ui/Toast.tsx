import { useToast } from "./useToast";

const typeClasses = {
  success: "bg-success-subtle border-success-dim text-success",
  error: "bg-danger-subtle border-danger-dim text-danger",
  info: "bg-accent-subtle border-accent-dim text-accent",
};

export function ToastContainer() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`animate-toast-in pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg text-sm min-w-[280px] max-w-sm ${typeClasses[toast.type]}`}
        >
          <span className="mt-0.5 inline-flex h-2.5 w-2.5 rounded-full bg-current" />
          <span className="flex-1 leading-snug">{toast.message}</span>
          <button
            onClick={() => dismiss(toast.id)}
            className="opacity-60 hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5"
            aria-label="Dismiss"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
