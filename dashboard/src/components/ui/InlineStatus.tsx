interface InlineStatusProps {
  tone: "info" | "success" | "warning" | "danger";
  children: React.ReactNode;
}

const toneMap = {
  info: "text-accent",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

export function InlineStatus({ tone, children }: InlineStatusProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${toneMap[tone]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
