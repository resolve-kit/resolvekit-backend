type AlertSeverity = "info" | "success" | "warning" | "danger";

interface InlineAlertProps {
  severity?: AlertSeverity;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

const config: Record<AlertSeverity, { bg: string; border: string; text: string; iconBg: string; icon: React.ReactNode }> = {
  info: {
    bg: "bg-accent-subtle",
    border: "border-accent-dim",
    text: "text-[#0a3b8b]",
    iconBg: "bg-white/50",
    icon: (
      <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
        <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm0 3a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm-1 4h1v4H7V8Z" />
      </svg>
    ),
  },
  success: {
    bg: "bg-success-subtle",
    border: "border-success-dim",
    text: "text-[#0a5f43]",
    iconBg: "bg-white/50",
    icon: (
      <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
        <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm3.03 4.97-4 4a.75.75 0 0 1-1.06 0l-1.5-1.5a.75.75 0 1 1 1.06-1.06l.97.97 3.47-3.47a.75.75 0 1 1 1.06 1.06Z" />
      </svg>
    ),
  },
  warning: {
    bg: "bg-warning-subtle",
    border: "border-warning-dim",
    text: "text-[#6a4a16]",
    iconBg: "bg-white/50",
    icon: (
      <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
        <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566ZM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5Zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z" />
      </svg>
    ),
  },
  danger: {
    bg: "bg-danger-subtle",
    border: "border-danger-dim",
    text: "text-[#6a262b]",
    iconBg: "bg-white/50",
    icon: (
      <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
        <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm-1 4a1 1 0 1 1 2 0v3a1 1 0 1 1-2 0V5Zm1 7a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />
      </svg>
    ),
  },
};

export function InlineAlert({ severity = "info", title, children, action, className = "" }: InlineAlertProps) {
  const c = config[severity];
  return (
    <div className={`grid gap-3.5 rounded-xl border p-3.5 ${c.bg} ${c.border} ${c.text} ${className}`}
      style={{ gridTemplateColumns: "32px 1fr auto" }}>
      <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${c.iconBg} flex-shrink-0`}>
        {c.icon}
      </span>
      <div>
        <div className="text-[13.5px] font-bold leading-snug">{title}</div>
        {children && <div className="mt-0.5 text-[12.5px] leading-[1.55]">{children}</div>}
      </div>
      {action && <div className="flex items-start">{action}</div>}
    </div>
  );
}
