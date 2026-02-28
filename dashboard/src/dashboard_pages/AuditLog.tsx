import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { api } from "../api/client";
import { Button, PageSpinner } from "../components/ui";

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

const EVENT_TYPE_LABELS: Record<string, string> = {
  "config.llm.updated": "LLM config updated",
  "config.prompt.updated": "Prompt updated",
  "config.limits.updated": "Limits updated",
  "apikey.created": "API key created",
  "apikey.revoked": "API key revoked",
  "function.activated": "Function activated",
  "function.deactivated": "Function deactivated",
  "function.override_set": "Function override set",
};

function groupByDay(events: AuditEvent[]): [string, AuditEvent[]][] {
  const groups: Record<string, AuditEvent[]> = {};
  for (const event of events) {
    const day = new Date(event.created_at).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    if (!groups[day]) groups[day] = [];
    groups[day].push(event);
  }
  return Object.entries(groups);
}

function DiffView({ diff }: { diff: NonNullable<AuditEvent["diff"]> }) {
  const [expanded, setExpanded] = useState(false);
  const changes: string[] = [];

  if (diff.api_key_rotated) changes.push("API key rotated");
  for (const key of Object.keys({ ...diff.before, ...diff.after })) {
    if (key === "api_key_rotated") continue;
    const before = diff.before?.[key];
    const after = diff.after?.[key];
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      changes.push(`${key}: ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
    }
  }

  if (changes.length === 0) return null;

  return (
    <div className="mt-1">
      {expanded ? (
        <div className="text-xs text-muted font-mono space-y-0.5 mt-1">
          {changes.map((change) => (
            <div key={change}>{change}</div>
          ))}
          <button onClick={() => setExpanded(false)} className="text-accent hover:text-accent-hover mt-1">
            collapse
          </button>
        </div>
      ) : (
        <div className="text-xs text-muted">
          {changes.slice(0, 2).join(" · ")}
          {changes.length > 2 && " · "}
          <button onClick={() => setExpanded(true)} className="text-accent hover:text-accent-hover">
            {changes.length > 2 ? `+${changes.length - 2} more` : "expand diff"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function AuditLog() {
  const { appId } = useParams<{ appId: string }>();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");

  const buildUrl = useCallback(
    (cursor?: string) => {
      const params = new URLSearchParams({ limit: "50" });
      if (typeFilter !== "all") params.set("event_type", typeFilter);
      if (cursor) params.set("cursor", cursor);
      return `/v1/apps/${appId}/audit-events?${params.toString()}`;
    },
    [appId, typeFilter]
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
      ...events.map((event) =>
        [
          event.created_at,
          event.actor_email,
          event.event_type,
          event.entity_name || "",
          event.ip_address || "",
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `audit-${appId}-${Date.now()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading) return <PageSpinner />;

  const grouped = groupByDay(events);

  return (
    <div>
      <div className="glass-panel rounded-2xl px-4 py-3 flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-strong tracking-tight">Audit Log</h1>
          <p className="text-sm text-subtle mt-1">All configuration and key changes for this app.</p>
        </div>
        <div className="flex gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-body focus:outline-none focus:border-accent"
          >
            <option value="all">All events</option>
            <option value="config.llm.updated">LLM config</option>
            <option value="config.prompt.updated">Prompt</option>
            <option value="config.limits.updated">Limits</option>
            <option value="apikey.created">API key created</option>
            <option value="apikey.revoked">API key revoked</option>
            <option value="function.activated">Function activated</option>
            <option value="function.deactivated">Function deactivated</option>
          </select>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            Export CSV
          </Button>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-16 text-subtle">
          <p className="text-sm">No audit events yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([day, dayEvents]) => (
            <div key={day}>
              <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">{day}</p>
              <div className="space-y-1">
                {dayEvents.map((event) => (
                  <div key={event.id} className="flex gap-4 py-2.5 border-b border-border last:border-0">
                    <span className="text-xs text-muted font-mono flex-shrink-0 w-12">
                      {new Date(event.created_at).toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-sm font-medium text-body">
                          {EVENT_TYPE_LABELS[event.event_type] ?? event.event_type}
                        </span>
                        {event.entity_name && <span className="text-xs font-mono text-dim">{event.entity_name}</span>}
                        <span className="text-xs text-muted">{event.actor_email}</span>
                      </div>
                      {event.diff && <DiffView diff={event.diff} />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {nextCursor && (
            <div className="flex justify-center pt-2">
              <Button variant="ghost" size="sm" onClick={loadMore} loading={isLoadingMore}>
                Load more
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
