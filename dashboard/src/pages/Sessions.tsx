import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { AppNav, Badge, PageSpinner } from "../components/ui";

interface Session {
  id: string;
  device_id: string | null;
  status: string;
  last_activity_at: string;
  created_at: string;
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

function statusVariant(
  status: string
): "active" | "expired" | "closed" | "default" {
  if (status === "active") return "active";
  if (status === "expired") return "expired";
  if (status === "closed") return "closed";
  return "default";
}

export default function Sessions() {
  const { appId } = useParams();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    api<Session[]>(`/v1/apps/${appId}/sessions`)
      .then(setSessions)
      .finally(() => setIsLoading(false));
  }, [appId]);

  async function loadMessages(sessionId: string) {
    setSelectedId(sessionId);
    setMessagesLoading(true);
    try {
      const msgs = await api<Message[]>(
        `/v1/apps/${appId}/sessions/${sessionId}/messages`
      );
      setMessages(msgs);
    } finally {
      setMessagesLoading(false);
    }
  }

  const selectedSession = sessions.find((s) => s.id === selectedId);

  if (isLoading) return <PageSpinner />;

  return (
    <div>
      <AppNav appId={appId!} />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-strong">
            Chat Sessions
          </h1>
          <p className="text-sm text-subtle mt-1">
            View conversation history from your iOS app users
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Session list */}
        <div className="col-span-1 space-y-2">
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => loadMessages(s.id)}
              className={`w-full text-left bg-surface border rounded-xl p-3 text-sm transition-all hover:border-border-2 ${
                selectedId === s.id
                  ? "border-accent/40 bg-accent-subtle"
                  : "border-border"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-xs text-dim">
                  {s.id.slice(0, 8)}...
                </span>
                <Badge variant={statusVariant(s.status)} dot>
                  {s.status}
                </Badge>
              </div>
              {s.device_id && (
                <p className="text-xs text-subtle truncate mb-1">
                  {s.device_id}
                </p>
              )}
              <p className="text-xs text-muted">
                {new Date(s.last_activity_at).toLocaleString()}
              </p>
            </button>
          ))}
          {sessions.length === 0 && (
            <p className="text-subtle text-sm text-center py-8">
              No sessions yet.
            </p>
          )}
        </div>

        {/* Message pane */}
        <div className="col-span-2 bg-surface border border-border rounded-xl flex flex-col min-h-[400px] overflow-hidden">
          {selectedSession ? (
            <>
              {/* Pane header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-subtle">Session</span>
                  <span className="font-mono text-xs text-dim">
                    {selectedSession.id}
                  </span>
                </div>
                <Badge variant={statusVariant(selectedSession.status)} dot>
                  {selectedSession.status}
                </Badge>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messagesLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="w-5 h-5 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-dim text-center text-sm py-8">
                    No messages in this session.
                  </p>
                ) : (
                  messages.map((m) => {
                    const isUser = m.role === "user";
                    const isTool = m.role === "tool";

                    return (
                      <div
                        key={m.id}
                        className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                            isUser
                              ? "bg-accent-subtle border border-accent-dim text-body"
                              : isTool
                                ? "bg-canvas border border-border text-dim font-mono w-full max-w-full"
                                : "bg-surface-2 border border-border text-body"
                          }`}
                        >
                          <p
                            className={`text-[10px] uppercase tracking-widest mb-1.5 ${
                              isUser
                                ? "text-accent"
                                : isTool
                                  ? "text-warning"
                                  : "text-subtle"
                            }`}
                          >
                            {m.role}
                          </p>
                          {m.content && (
                            <p className="leading-relaxed whitespace-pre-wrap">
                              {m.content}
                            </p>
                          )}
                          {m.tool_calls && (
                            <pre className="text-xs overflow-auto mt-1 text-dim">
                              {JSON.stringify(m.tool_calls, null, 2)}
                            </pre>
                          )}
                          {m.tool_call_id && (
                            <p className="text-xs text-muted mt-1 font-mono">
                              call_id: {m.tool_call_id}
                            </p>
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
