interface MetricTileProps {
  label: string;
  value: string | number;
  hint?: string;
  trend?: "up" | "down" | "neutral";
}

export function MetricTile({ label, value, hint, trend }: MetricTileProps) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3.5 shadow-card">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted">{label}</p>
      <div className="mt-1.5 flex items-baseline gap-2">
        <p className="font-display text-2xl font-semibold tracking-tight text-strong">{value}</p>
        {trend === "up" && <span className="text-[11px] font-semibold text-success">↑</span>}
        {trend === "down" && <span className="text-[11px] font-semibold text-danger">↓</span>}
      </div>
      {hint && <p className="mt-1 text-[11.5px] text-subtle">{hint}</p>}
    </div>
  );
}
