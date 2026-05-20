import TraceMark from "../TraceMark";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-10 text-center">
      <div className="mx-auto mb-5 flex items-center justify-center text-accent/30">
        <TraceMark size={80} variant="prompt" />
      </div>
      <p className="text-sm font-semibold text-strong">{title}</p>
      <p className="mt-1 text-sm text-subtle">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
