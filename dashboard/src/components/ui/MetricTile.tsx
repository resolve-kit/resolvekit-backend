interface MetricTileProps {
  label: string;
  value: string | number;
  hint?: string;
}

export function MetricTile({ label, value, hint }: MetricTileProps) {
  return (
    <div className="rounded-xl border border-border bg-surface-2 px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.2em] text-subtle">{label}</p>
      <p className="mt-1 text-xl font-semibold text-strong">{value}</p>
      {hint && <p className="mt-1 text-xs text-subtle">{hint}</p>}
    </div>
  );
}
