interface EmptyStateProps {
  title: string;
  description: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-8 text-center">
      <div className="mx-auto mb-3 h-10 w-10 rounded-xl border border-border bg-surface-2" />
      <p className="text-sm font-semibold text-strong">{title}</p>
      <p className="mt-1 text-sm text-subtle">{description}</p>
    </div>
  );
}
