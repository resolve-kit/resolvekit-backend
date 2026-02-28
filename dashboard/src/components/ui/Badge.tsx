type BadgeVariant =
  | "active"
  | "inactive"
  | "expired"
  | "closed"
  | "revoked"
  | "live"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "default";

interface BadgeProps {
  variant?: BadgeVariant;
  dot?: boolean;
  children: React.ReactNode;
}

const variantClasses: Record<BadgeVariant, string> = {
  active: "bg-success-subtle text-success border border-success-dim",
  inactive: "bg-surface-2 text-subtle border border-border",
  expired: "bg-warning-subtle text-warning border border-warning-dim",
  closed: "bg-surface-2 text-dim border border-border",
  revoked: "bg-danger-subtle text-danger border border-danger-dim",
  live: "bg-accent-subtle text-accent border border-accent-dim",
  success: "bg-success-subtle text-success border border-success-dim",
  warning: "bg-warning-subtle text-warning border border-warning-dim",
  danger: "bg-danger-subtle text-danger border border-danger-dim",
  info: "bg-accent-subtle text-accent border border-accent-dim",
  neutral: "bg-surface-2 text-subtle border border-border",
  default: "bg-surface-2 text-dim border border-border",
};

export function Badge({ variant = "default", dot, children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold tracking-[0.02em] ${variantClasses[variant]}`}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" />}
      {children}
    </span>
  );
}
