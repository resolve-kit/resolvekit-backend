import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import { api, ApiError } from "../api/client";
import { Badge, Button, PageSpinner } from "../components/ui";
import { PageHeader } from "../components/layout/PageHeader";

interface Session {
  id: string;
  device_id: string | null;
  status: string;
  last_activity_at: string;
  created_at: string;
  client_context?: Record<string, string | null>;
  llm_context?: Record<string, unknown>;
}

interface Message {
  id: string;
  sequence_number: number;
  role: string;
  content: string | null;
  tool_calls: Array<Record<string, unknown>> | Record<string, unknown> | null;
  tool_call_id: string | null;
  created_at: string;
}

type ToolCallRecord = {
  id?: unknown;
  function?: {
    name?: unknown;
    arguments?: unknown;
  };
};

type KbSearchCall = {
  callId: string | null;
  query: string | null;
  topK: number | null;
};

type KbSearchResult = {
  query: string | null;
  resultsCount: number | null;
  error: string | null;
};

function statusVariant(status: string): "active" | "expired" | "closed" | "default" {
  if (status === "active") return "active";
  if (status === "expired") return "expired";
  if (status === "closed") return "closed";
  return "default";
}

const PAGE_SIZE = 25;

function ToolCallCard({ calls }: { calls: unknown }) {
  const [expanded, setExpanded] = useState(false);
  const arr = Array.isArray(calls) ? calls : [calls];

  return (
    <div className="border border-border rounded-lg overflow-hidden text-xs font-mono">
      {arr.map((call, index) => {
        const record = call as Record<string, unknown>;
        const fnRecord = record?.function as Record<string, unknown> | undefined;
        const name = (fnRecord?.name as string) ?? "tool_call";
        const args = fnRecord?.arguments;

        return (
          <div key={index} className="border-b border-border bg-surface px-3 py-2 last:border-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-accent font-semibold">-&gt; {name}</span>
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-muted hover:text-body transition-colors"
              >
                {expanded ? "collapse" : "expand"}
              </button>
            </div>
            {expanded && Boolean(args) && (
              <pre className="text-dim overflow-auto max-h-40 mt-1">
                {typeof args === "string" ? args : JSON.stringify(args, null, 2)}
              </pre>
            )}
          </div>
        );
      })}
    </div>
  );
}

function parseToolArguments(args: unknown): Record<string, unknown> | null {
  if (!args) return null;
  if (typeof args === "string") {
    try {
      const parsed = JSON.parse(args);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  return typeof args === "object" ? (args as Record<string, unknown>) : null;
}

function extractKbSearchCalls(calls: unknown): KbSearchCall[] {
  if (!calls) return [];
  const arr = Array.isArray(calls) ? calls : [calls];
  const kbCalls: KbSearchCall[] = [];

  for (const rawCall of arr) {
    const record = (rawCall ?? {}) as ToolCallRecord;
    const fn = record.function ?? {};
    if (fn.name !== "kb_search") continue;

    const args = parseToolArguments(fn.arguments);
    const queryRaw = args?.query;
    const topKRaw = args?.top_k;

    const query = typeof queryRaw === "string" && queryRaw.trim() ? queryRaw.trim() : null;
    const topK =
      typeof topKRaw === "number"
        ? topKRaw
        : typeof topKRaw === "string" && topKRaw.trim() && !Number.isNaN(Number(topKRaw))
        ? Number(topKRaw)
        : null;

    kbCalls.push({
      callId: typeof record.id === "string" ? record.id : null,
      query,
      topK,
    });
  }

  return kbCalls;
}

function parseKbSearchResult(content: string | null): KbSearchResult | null {
  if (!content) return null;
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const query = typeof parsed.query === "string" && parsed.query.trim() ? parsed.query.trim() : null;
    const items = parsed.items;
    const resultsCount = Array.isArray(items) ? items.length : null;
    const error = typeof parsed.error === "string" && parsed.error.trim() ? parsed.error.trim() : null;
    return { query, resultsCount, error };
  } catch {
    return null;
  }
}

function KnowledgeBaseQueryCard({
  calls,
  resultByCallId,
}: {
  calls: KbSearchCall[];
  resultByCallId: Map<string, Message>;
}) {
  if (!calls.length) return null;

  return (
    <div className="mb-2 space-y-2">
      {calls.map((call, index) => {
        const resultMessage = call.callId ? resultByCallId.get(call.callId) ?? null : null;
        const parsedResult = parseKbSearchResult(resultMessage?.content ?? null);

        return (
          <div key={call.callId ?? `kb-call-${index}`} className="border border-warning/30 bg-warning/5 rounded-lg p-2.5">
            <p className="text-[10px] uppercase tracking-widest text-warning mb-1.5">Knowledge Base Query</p>
            <div className="text-xs space-y-1">
              <p className="text-body break-words">
                <span className="text-subtle">query:</span> {call.query ?? parsedResult?.query ?? "(missing)"}
              </p>
              {call.topK !== null && (
                <p className="text-muted">
                  <span className="text-subtle">top_k:</span> {call.topK}
                </p>
              )}
              {call.callId && (
                <p className="text-muted font-mono">
                  <span className="text-subtle">call_id:</span> {call.callId}
                </p>
              )}
              {parsedResult && parsedResult.resultsCount !== null && (
                <p className="text-muted">
                  <span className="text-subtle">results:</span> {parsedResult.resultsCount}
                </p>
              )}
              {parsedResult?.error && (
                <p className="text-danger">
                  <span className="text-subtle">error:</span> {parsedResult.error}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function isScalar(value: unknown): value is string | number | boolean {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function LLMContextCard({ context }: { context: Record<string, unknown> }) {
  const scalarEntries = Object.entries(context).filter(([, value]) => isScalar(value));
  const complexEntries = Object.entries(context).filter(
    ([, value]) => value !== null && value !== undefined && !isScalar(value)
  );

  if (scalarEntries.length === 0 && complexEntries.length === 0) {
    return null;
  }

  return (
    <div className="mt-2">
      <p className="text-[10px] uppercase tracking-widest text-subtle mb-1.5">Custom Context</p>
      {scalarEntries.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {scalarEntries.map(([key, value]) => (
            <span key={key} className="text-xs text-muted font-mono">
              {key}: {String(value)}
            </span>
          ))}
        </div>
      )}
      {complexEntries.length > 0 && (
        <div className="space-y-1">
          {complexEntries.map(([key, value]) => (
            <details key={key} className="rounded border border-border bg-surface-2 p-2 text-xs font-mono">
              <summary className="cursor-pointer text-muted">{key}</summary>
              <pre className="text-dim overflow-auto max-h-44 mt-2 whitespace-pre-wrap">
                {JSON.stringify(value, null, 2)}
              </pre>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sessions() {
  const { appId } = useParams<{ appId: string }>();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isMobileThreadOpen, setIsMobileThreadOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setIsLoading(true);
    api<Session[]>(`/v1/apps/${appId}/sessions?limit=${PAGE_SIZE + 1}`)
      .then((data) => {
        setHasMore(data.length > PAGE_SIZE);
        setSessions(data.slice(0, PAGE_SIZE));
      })
      .finally(() => setIsLoading(false));
  }, [appId]);

  useEffect(() => {
    setSelectedId(null);
    setIsMobileThreadOpen(false);
  }, [appId]);

  async function loadMore() {
    if (!sessions.length) return;
    setIsLoadingMore(true);
    const last = sessions[sessions.length - 1];
    try {
      const data = await api<Session[]>(
        `/v1/apps/${appId}/sessions?limit=${PAGE_SIZE + 1}&before=${last.created_at}`
      );
      setHasMore(data.length > PAGE_SIZE);
      setSessions((prev) => [...prev, ...data.slice(0, PAGE_SIZE)]);
    } finally {
      setIsLoadingMore(false);
    }
  }

  const loadMessages = useCallback(
    async (sessionId: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setSelectedId(sessionId);
      setMessages([]);
      setMessagesError(null);
      setMessagesLoading(true);

      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }

      try {
        const loadedMessages = await api<Message[]>(
          `/v1/apps/${appId}/sessions/${sessionId}/messages`,
          { signal: controller.signal }
        );
        setMessages(loadedMessages);

        const session = sessions.find((entry) => entry.id === sessionId);
        if (session?.status === "active") {
          pollRef.current = setInterval(async () => {
            try {
              const updated = await api<Message[]>(`/v1/apps/${appId}/sessions/${sessionId}/messages`);
              setMessages(updated);
            } catch {
              // Polling should not disrupt the current view.
            }
          }, 10000);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        setMessagesError(err instanceof ApiError ? err.detail : "Failed to load messages");
      } finally {
        setMessagesLoading(false);
      }
    },
    [appId, sessions]
  );

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const selectedSession = sessions.find((session) => session.id === selectedId);
  const toolResultByCallId = useMemo(() => {
    const map = new Map<string, Message>();
    for (const message of messages) {
      if (message.role === "tool_result" && message.tool_call_id) {
        map.set(message.tool_call_id, message);
      }
    }
    return map;
  }, [messages]);

  const filteredSessions = sessions.filter((session) => {
    const matchesStatus = statusFilter === "all" || session.status === statusFilter;
    const matchesSearch =
      !search ||
      session.id.startsWith(search) ||
      (session.device_id && session.device_id.toLowerCase().includes(search.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  if (isLoading) return <PageSpinner />;

  const showListPane = !isMobileThreadOpen;
  const showThreadPane = isMobileThreadOpen;

  return (
    <div>
      <PageHeader
        eyebrow="Conversations"
        title="Chat Sessions"
        subtitle="Inspect user conversations, tool calls, and outcomes from SDK-embedded support."
      />

      <div className="glass-panel mb-4 rounded-2xl border border-border/70 p-3 md:p-4">
        <div className="grid gap-2 md:grid-cols-[1fr_220px]">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by session ID or device ID..."
            className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-body placeholder:text-muted focus:border-accent focus:outline-none"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-body focus:border-accent focus:outline-none"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
            <option value="expired">Expired</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className={`space-y-2 xl:col-span-1 ${showListPane ? "block" : "hidden xl:block"}`}>
          {filteredSessions.map((session) => (
            <button
              key={session.id}
              onClick={() => {
                void loadMessages(session.id);
                if (window.innerWidth < 1280) setIsMobileThreadOpen(true);
              }}
              className={`w-full rounded-xl border p-3 text-left text-sm transition-all hover:-translate-y-0.5 hover:border-border-2 hover:shadow-card ${
                selectedId === session.id
                  ? "border-accent-dim bg-accent-subtle"
                  : "border-border bg-surface"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-xs text-dim">{session.id.slice(0, 8)}...</span>
                <Badge variant={statusVariant(session.status)} dot>
                  {session.status}
                </Badge>
              </div>
              {session.device_id && <p className="text-xs text-subtle truncate mb-1">{session.device_id}</p>}
              <p className="text-xs text-muted">{new Date(session.last_activity_at).toLocaleString()}</p>
            </button>
          ))}

          {filteredSessions.length === 0 && (
            <p className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-subtle">
              No sessions match your filters.
            </p>
          )}

          {hasMore && (
            <Button variant="ghost" size="sm" onClick={loadMore} loading={isLoadingMore} className="w-full">
              Load more
            </Button>
          )}
        </div>

        <div
          className={`glass-panel xl:col-span-2 min-h-[520px] flex-col overflow-hidden rounded-2xl border border-border/70 ${
            showThreadPane ? "flex" : "hidden xl:flex"
          }`}
        >
          {selectedSession ? (
            <>
              <div className="px-4 py-3 border-b border-border flex-shrink-0">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsMobileThreadOpen(false)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface text-subtle xl:hidden"
                      aria-label="Back to session list"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <span className="truncate font-mono text-xs text-dim">{selectedSession.id}</span>
                  </div>
                  <Badge variant={statusVariant(selectedSession.status)} dot>
                    {selectedSession.status}
                  </Badge>
                </div>
                {selectedSession.client_context && (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(selectedSession.client_context)
                      .filter(([, value]) => value)
                      .map(([key, value]) => (
                        <span key={key} className="text-xs text-muted font-mono">
                          {key}: {value}
                        </span>
                      ))}
                  </div>
                )}
                {selectedSession.llm_context && <LLMContextCard context={selectedSession.llm_context} />}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messagesLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="w-5 h-5 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                  </div>
                ) : messagesError ? (
                  <div className="text-center py-8">
                    <p className="text-danger text-sm mb-2">{messagesError}</p>
                    <Button variant="outline" size="sm" onClick={() => loadMessages(selectedSession.id)}>
                      Retry
                    </Button>
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-dim text-center text-sm py-8">No messages in this session.</p>
                ) : (
                  messages.map((message) => {
                    const isUser = message.role === "user";
                    const isTool = message.role === "tool";
                    const kbSearchCalls = extractKbSearchCalls(message.tool_calls);

                    return (
                      <div key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[92%] rounded-xl px-3 py-2 text-sm shadow-card sm:max-w-[82%] ${
                            isUser
                              ? "bg-accent-subtle border border-accent-dim text-body"
                            : isTool
                              ? "w-full max-w-full border border-border bg-surface text-dim"
                              : "border border-border bg-surface-2 text-body"
                          }`}
                        >
                          <p
                            className={`text-[10px] uppercase tracking-widest mb-1.5 ${
                              isUser ? "text-accent" : isTool ? "text-warning" : "text-subtle"
                            }`}
                          >
                            {message.role}
                          </p>
                          {kbSearchCalls.length > 0 && (
                            <KnowledgeBaseQueryCard calls={kbSearchCalls} resultByCallId={toolResultByCallId} />
                          )}
                          {message.content && <p className="leading-relaxed whitespace-pre-wrap">{message.content}</p>}
                          {message.tool_calls && <ToolCallCard calls={message.tool_calls} />}
                          {message.tool_call_id && (
                            <p className="text-xs text-muted mt-1 font-mono">call_id: {message.tool_call_id}</p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-subtle text-sm">
              Select a session to view messages
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
