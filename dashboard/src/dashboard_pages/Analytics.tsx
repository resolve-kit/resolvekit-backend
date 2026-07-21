import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { api } from "../api/client";
import { PageSpinner } from "../components/ui";
import { PageHeader } from "../components/layout/PageHeader";

interface DailyPoint {
  date: string;
  total: number;
  resolved: number;
  escalated: number;
}

interface AnalyticsSummary {
  total_sessions: number;
  resolved_sessions: number;
  escalated_sessions: number;
  abandoned_sessions: number;
  resolution_rate: number;
  escalation_rate: number;
  avg_csat: number | null;
  csat_response_count: number;
  csat_distribution: Array<{ rating: number; count: number }>;
  daily: DailyPoint[];
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function StatTile({ label, value, sublabel }: { label: string; value: string; sublabel?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-card">
      <p className="text-[10px] uppercase tracking-widest text-subtle">{label}</p>
      <p className="mt-1 font-mono text-2xl font-semibold text-strong">{value}</p>
      {sublabel && <p className="mt-0.5 text-xs text-muted">{sublabel}</p>}
    </div>
  );
}

function DailyChart({ daily }: { daily: DailyPoint[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const width = 640;
  const height = 220;
  const padding = { top: 12, right: 12, bottom: 24, left: 12 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const maxTotal = Math.max(1, ...daily.map((d) => d.total));
  const stepX = daily.length > 1 ? plotWidth / (daily.length - 1) : 0;

  const points = (key: "resolved" | "escalated") =>
    daily
      .map((d, i) => {
        const x = padding.left + i * stepX;
        const y = padding.top + plotHeight - (d[key] / maxTotal) * plotHeight;
        return `${x},${y}`;
      })
      .join(" ");

  if (daily.length === 0) {
    return <p className="py-10 text-center text-sm text-subtle">No session activity in this range.</p>;
  }

  const hovered = hoverIndex !== null ? daily[hoverIndex] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        onMouseLeave={() => setHoverIndex(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const relX = ((e.clientX - rect.left) / rect.width) * width - padding.left;
          const idx = stepX > 0 ? Math.round(relX / stepX) : 0;
          setHoverIndex(Math.min(daily.length - 1, Math.max(0, idx)));
        }}
      >
        <line
          x1={padding.left}
          y1={padding.top + plotHeight}
          x2={width - padding.right}
          y2={padding.top + plotHeight}
          stroke="var(--color-border)"
          strokeWidth={1}
        />
        <polyline
          points={points("resolved")}
          fill="none"
          stroke="var(--color-success)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points={points("escalated")}
          fill="none"
          stroke="var(--color-danger)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {hoverIndex !== null && (
          <line
            x1={padding.left + hoverIndex * stepX}
            y1={padding.top}
            x2={padding.left + hoverIndex * stepX}
            y2={padding.top + plotHeight}
            stroke="var(--color-border-2)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}
      </svg>
      {hovered && (
        <div className="pointer-events-none absolute left-2 top-2 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-xs shadow-card">
          <p className="font-mono text-muted">{hovered.date}</p>
          <p className="text-success">resolved: {hovered.resolved}</p>
          <p className="text-danger">escalated: {hovered.escalated}</p>
        </div>
      )}
      <div className="mt-2 flex items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-success" /> Resolved (AI)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-danger" /> Escalated
        </span>
      </div>
    </div>
  );
}

export default function Analytics() {
  const { appId } = useParams<{ appId: string }>();
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rangeDays, setRangeDays] = useState(30);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    const to = new Date();
    const from = new Date(to.getTime() - rangeDays * 24 * 60 * 60 * 1000);
    api<AnalyticsSummary>(
      `/v1/apps/${appId}/analytics?from=${from.toISOString()}&to=${to.toISOString()}`
    )
      .then(setData)
      .catch(() => setError("Failed to load analytics"))
      .finally(() => setIsLoading(false));
  }, [appId, rangeDays]);

  const maxDistCount = useMemo(
    () => Math.max(1, ...(data?.csat_distribution.map((row) => row.count) ?? [])),
    [data]
  );

  if (isLoading) return <PageSpinner />;

  return (
    <div>
      <PageHeader
        eyebrow="Insights"
        title="Analytics"
        subtitle="Resolution rate, escalation rate, and CSAT for support conversations."
      />

      <div className="glass-panel mb-4 flex items-center justify-between rounded-2xl border border-border/70 p-3 md:p-4">
        <select
          value={rangeDays}
          onChange={(e) => setRangeDays(Number(e.target.value))}
          className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-body focus:border-accent focus:outline-none"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {data && (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Total Sessions" value={data.total_sessions.toLocaleString()} />
            <StatTile
              label="Resolution Rate"
              value={formatPercent(data.resolution_rate)}
              sublabel={`${data.resolved_sessions.toLocaleString()} resolved by AI`}
            />
            <StatTile
              label="Escalation Rate"
              value={formatPercent(data.escalation_rate)}
              sublabel={`${data.escalated_sessions.toLocaleString()} escalated to human`}
            />
            <StatTile
              label="Avg CSAT"
              value={data.avg_csat !== null ? data.avg_csat.toFixed(1) : "—"}
              sublabel={`${data.csat_response_count.toLocaleString()} responses`}
            />
          </div>

          <div className="mb-4 grid gap-4 xl:grid-cols-3">
            <div className="glass-panel rounded-2xl border border-border/70 p-4 xl:col-span-2">
              <p className="mb-3 text-[10px] uppercase tracking-widest text-subtle">Daily Sessions</p>
              <DailyChart daily={data.daily} />
            </div>

            <div className="glass-panel rounded-2xl border border-border/70 p-4">
              <p className="mb-3 text-[10px] uppercase tracking-widest text-subtle">CSAT Distribution</p>
              {data.csat_distribution.length === 0 ? (
                <p className="py-8 text-center text-sm text-subtle">No feedback submitted yet.</p>
              ) : (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((rating) => {
                    const row = data.csat_distribution.find((r) => r.rating === rating);
                    const count = row?.count ?? 0;
                    return (
                      <div key={rating} className="flex items-center gap-2">
                        <span className="w-6 font-mono text-xs text-muted">{rating}★</span>
                        <div className="h-2 flex-1 rounded-full bg-surface-2">
                          <div
                            className="h-2 rounded-full bg-accent"
                            style={{ width: `${(count / maxDistCount) * 100}%` }}
                          />
                        </div>
                        <span className="w-6 text-right font-mono text-xs text-muted">{count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
