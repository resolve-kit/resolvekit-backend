import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import { api, ApiError } from "../api/client";
import { Badge, Button, PageSpinner } from "../components/ui";

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
          <div key={index} className="px-3 py-2 bg-canvas border-b border-border last:border-0">
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
            <details key={key} className="text-xs font-mono bg-canvas border border-border rounded p-2">
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

  const filteredSessions = sessions.filter((session) => {
    const matchesStatus = statusFilter === "all" || session.status === statusFilter;
    const matchesSearch =
      !search ||
      session.id.startsWith(search) ||
      (session.device_id && session.device_id.toLowerCase().includes(search.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  if (isLoading) return <PageSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-strong">Chat Sessions</h1>
          <p className="text-sm text-subtle mt-1">View conversation history from your iOS app users.</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by session ID or device ID..."
          className="flex-1 bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-body focus:outline-none focus:border-accent placeholder:text-muted"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-body focus:outline-none focus:border-accent"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="closed">Closed</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-1 space-y-2">
          {filteredSessions.map((session) => (
            <button
              key={session.id}
              onClick={() => loadMessages(session.id)}
              className={`w-full text-left bg-surface border rounded-xl p-3 text-sm transition-all hover:border-border-2 ${
                selectedId === session.id ? "border-accent/40 bg-accent-subtle" : "border-border"
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
            <p className="text-subtle text-sm text-center py-8">No sessions match your filters.</p>
          )}

          {hasMore && (
            <Button variant="ghost" size="sm" onClick={loadMore} loading={isLoadingMore} className="w-full">
              Load more
            </Button>
          )}
        </div>

        <div className="col-span-2 bg-surface border border-border rounded-xl flex flex-col min-h-[500px] overflow-hidden">
          {selectedSession ? (
            <>
              <div className="px-4 py-3 border-b border-border flex-shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs text-dim">{selectedSession.id}</span>
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

                    return (
                      <div key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                            isUser
                              ? "bg-accent-subtle border border-accent-dim text-body"
                              : isTool
                              ? "bg-canvas border border-border text-dim w-full max-w-full"
                              : "bg-surface-2 border border-border text-body"
                          }`}
                        >
                          <p
                            className={`text-[10px] uppercase tracking-widest mb-1.5 ${
                              isUser ? "text-accent" : isTool ? "text-warning" : "text-subtle"
                            }`}
                          >
                            {message.role}
                          </p>
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
