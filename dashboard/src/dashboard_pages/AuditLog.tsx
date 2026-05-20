import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { api } from "../api/client";
import { Button, PageSpinner, SegmentControl } from "../components/ui";

interface AuditEvent {
  id: string;
  actor_email: string;
  event_type: string;
  entity_id: string | null;
  entity_name: string | null;
  diff: {
    before: Record<string, unknown>;
    after: Record<string, unknown>;
    api_key_rotated?: boolean;
  } | null;
  ip_address: string | null;
  created_at: string;
}

interface AuditPage {
  events: AuditEvent[];
  next_cursor: string | null;
}

type SeverityLevel = "info" | "write" | "elevate" | "destructive";

const EVENT_SEVERITY: Record<string, SeverityLevel> = {
  "config.llm.updated": "write",
  "config.prompt.updated": "write",
  "config.limits.updated": "write",
  "apikey.created": "elevate",
  "apikey.revoked": "destructive",
  "function.activated": "write",
  "function.deactivated": "write",
  "function.override_set": "write",
};

const EVENT_VERB: Record<string, string> = {
  "config.llm.updated": "updated LLM config",
  "config.prompt.updated": "updated agent prompt",
  "config.limits.updated": "updated limits config",
  "apikey.created": "created API key",
  "apikey.revoked": "revoked API key",
  "function.activated": "activated function",
  "function.deactivated": "deactivated function",
  "function.override_set": "set function override",
};

const SEVERITY_RAIL: Record<SeverityLevel, string> = {
  info: "bg-muted/35",
  write: "bg-accent",
  elevate: "bg-warning",
  destructive: "bg-danger",
};

const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "config", label: "Config" },
  { value: "apikey", label: "API Keys" },
  { value: "function", label: "Functions" },
];

function getDiffChanges(diff: NonNullable<AuditEvent["diff"]>): string[] {
  const changes: string[] = [];
  if (diff.api_key_rotated) changes.push("API key rotated");
  for (const key of Object.keys({ ...diff.before, ...diff.after })) {
    if (key === "api_key_rotated") continue;
    const before = diff.before?.[key];
    const after = diff.after?.[key];
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      changes.push(key);
    }
  }
  return changes;
}

function DiffCards({ diff }: { diff: NonNullable<AuditEvent["diff"]> }) {
  const beforeStr = JSON.stringify(diff.before ?? {}, null, 2);
  const afterStr = JSON.stringify(diff.after ?? {}, null, 2);
  return (
    <div className="mt-3 grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
      <div className="overflow-hidden rounded-lg border border-danger-dim/40" style={{ background: "rgba(208,61,67,0.04)" }}>
        <div className="border-b border-danger-dim/40 bg-danger-subtle px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-danger">
          Before
        </div>
        <pre className="p-3 font-mono text-[11.5px] leading-[1.55] text-body overflow-x-auto">{beforeStr}</pre>
      </div>
      <div className="overflow-hidden rounded-lg border border-success-dim/40" style={{ background: "rgba(15,143,99,0.04)" }}>
        <div className="border-b border-success-dim/40 bg-success-subtle px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-success">
          After
        </div>
        <pre className="p-3 font-mono text-[11.5px] leading-[1.55] text-body overflow-x-auto">{afterStr}</pre>
      </div>
    </div>
  );
}

function AuditRow({ event }: { event: AuditEvent }) {
  const [expanded, setExpanded] = useState(false);
  const severity = EVENT_SEVERITY[event.event_type] ?? "info";
  const verb = EVENT_VERB[event.event_type] ?? event.event_type;
  const diffChanges = event.diff ? getDiffChanges(event.diff) : [];

  const ts = new Date(event.created_at);
  const timeStr = ts.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const dateStr = ts.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <>
      <div
        className="relative flex cursor-pointer items-center gap-4 border-b border-border py-3 px-5 transition-colors hover:bg-surface-2 last:border-0"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Severity rail */}
        <span className={`absolute inset-y-0 left-0 w-1 rounded-l-none ${SEVERITY_RAIL[severity]}`} style={{ borderRadius: "2px" }} />

        {/* Actor sentence */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-1.5 text-[13px]">
            <span className="font-semibold text-strong">{event.actor_email}</span>
            <span className="text-body">{verb}</span>
            {event.entity_name && (
              <span className="rounded border border-border bg-surface-2 px-1.5 font-mono text-[11.5px] font-semibold text-headline">
                {event.entity_name}
              </span>
            )}
          </div>
          {diffChanges.length > 0 && !expanded && (
            <div className="mt-0.5 text-[11px] text-muted">
              Changed: {diffChanges.slice(0, 3).join(", ")}
              {diffChanges.length > 3 && ` +${diffChanges.length - 3} more`}
            </div>
          )}
        </div>

        {/* Right meta */}
        <div className="flex flex-shrink-0 flex-col items-end gap-0.5">
          {event.ip_address && (
            <span className="font-mono text-[11px] text-muted">{event.ip_address}</span>
          )}
          <span className="font-mono text-[11px] text-muted whitespace-nowrap">
            {dateStr} · {timeStr}
          </span>
        </div>

        {/* Chevron */}
        <svg
          className={`h-4 w-4 flex-shrink-0 text-muted transition-transform ${expanded ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>

      {expanded && event.diff && (
        <div
          className="border-b border-border px-5 pb-4"
          style={{ background: "linear-gradient(180deg, var(--color-surface-2,#edf4fb), var(--color-surface,#fff))" }}
        >
          <div className="grid grid-cols-4 gap-3 pt-3 pb-2">
            {[
              { k: "Event", v: event.event_type },
              { k: "Entity ID", v: event.entity_id ?? "—" },
              { k: "IP Address", v: event.ip_address ?? "—" },
              { k: "Event ID", v: event.id },
            ].map(({ k, v }) => (
              <div key={k}>
                <div className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-muted">{k}</div>
                <div className="mt-0.5 font-mono text-[11.5px] font-semibold text-strong truncate">{v}</div>
              </div>
            ))}
          </div>
          <DiffCards diff={event.diff} />
        </div>
      )}
    </>
  );
}

export default function AuditLog() {
  const { appId } = useParams<{ appId: string }>();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [filter, setFilter] = useState("all");

  const buildUrl = useCallback(
    (cursor?: string) => {
      const params = new URLSearchParams({ limit: "50" });
      if (filter !== "all") params.set("event_type_prefix", filter);
      if (cursor) params.set("cursor", cursor);
      return `/v1/apps/${appId}/audit-events?${params.toString()}`;
    },
    [appId, filter]
  );

  useEffect(() => {
    setIsLoading(true);
    setEvents([]);
    setNextCursor(null);
    api<AuditPage>(buildUrl())
      .then((data) => {
        setEvents(data.events);
        setNextCursor(data.next_cursor);
      })
      .finally(() => setIsLoading(false));
  }, [buildUrl]);

  async function loadMore() {
    if (!nextCursor) return;
    setIsLoadingMore(true);
    try {
      const data = await api<AuditPage>(buildUrl(nextCursor));
      setEvents((prev) => [...prev, ...data.events]);
      setNextCursor(data.next_cursor);
    } finally {
      setIsLoadingMore(false);
    }
  }

  function exportCsv() {
    const rows = [
      ["timestamp", "actor", "event_type", "entity_name", "ip_address"].join(","),
      ...events.map((e) =>
        [e.created_at, e.actor_email, e.event_type, e.entity_name ?? "", e.ip_address ?? ""].join(",")
      ),
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-${appId}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      {/* Header */}
      <div className="glass-panel mb-5 flex items-center justify-between rounded-2xl px-5 py-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-strong">Audit Log</h1>
          <p className="mt-0.5 text-sm text-subtle">Configuration and key changes for this app.</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          Export CSV
        </Button>
      </div>

      {/* Filter chips */}
      <div className="mb-4 flex items-center gap-3">
        <SegmentControl
          options={FILTER_OPTIONS}
          value={filter}
          onChange={setFilter}
        />
        <span className="font-mono text-[11px] text-muted">
          {events.length} events
        </span>
      </div>

      {/* Event list */}
      {isLoading ? (
        <PageSpinner />
      ) : events.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface py-16 text-center">
          <p className="text-sm text-subtle">No audit events match this filter.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
          {events.map((event) => (
            <AuditRow key={event.id} event={event} />
          ))}

          {nextCursor && (
            <div className="border-t border-border px-5 py-3">
              <Button variant="ghost" size="sm" onClick={loadMore} loading={isLoadingMore}>
                Load 50 more
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
