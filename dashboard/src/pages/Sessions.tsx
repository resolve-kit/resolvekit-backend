import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api/client";

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
  tool_calls: Record<string, unknown> | null;
  tool_call_id: string | null;
  created_at: string;
}

export default function Sessions() {
  const { appId } = useParams();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    api<Session[]>(`/v1/apps/${appId}/sessions`).then(setSessions);
  }, [appId]);

  async function loadMessages(sessionId: string) {
    setSelectedId(sessionId);
    const msgs = await api<Message[]>(`/v1/apps/${appId}/sessions/${sessionId}/messages`);
    setMessages(msgs);
  }

  const statusColor: Record<string, string> = {
    active: "bg-green-100 text-green-700",
    expired: "bg-yellow-100 text-yellow-700",
    closed: "bg-gray-100 text-gray-500",
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link to="/apps" className="text-blue-600 hover:underline text-sm">&larr; Apps</Link>
        <h1 className="text-2xl font-bold">Chat Sessions</h1>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-1 space-y-2">
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => loadMessages(s.id)}
              className={`w-full text-left bg-white rounded-lg shadow p-3 text-sm ${
                selectedId === s.id ? "ring-2 ring-blue-500" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs">{s.id.slice(0, 8)}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor[s.status] || "bg-gray-100"}`}>
                  {s.status}
                </span>
              </div>
              {s.device_id && <p className="text-xs text-gray-500 mt-1">{s.device_id}</p>}
              <p className="text-xs text-gray-400 mt-1">{new Date(s.last_activity_at).toLocaleString()}</p>
            </button>
          ))}
          {sessions.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-4">No sessions yet.</p>
          )}
        </div>

        <div className="col-span-2 bg-white rounded-lg shadow p-4 min-h-[400px]">
          {selectedId ? (
            <div className="space-y-3">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`text-sm p-2 rounded ${
                    m.role === "user" ? "bg-blue-50" : m.role === "assistant" ? "bg-gray-50" : "bg-yellow-50"
                  }`}
                >
                  <span className="font-medium text-xs uppercase text-gray-500">{m.role}</span>
                  {m.content && <p className="mt-1">{m.content}</p>}
                  {m.tool_calls && (
                    <pre className="mt-1 text-xs overflow-auto">{JSON.stringify(m.tool_calls, null, 2)}</pre>
                  )}
                  {m.tool_call_id && (
                    <p className="text-xs text-gray-400 mt-1">call_id: {m.tool_call_id}</p>
                  )}
                </div>
              ))}
              {messages.length === 0 && (
                <p className="text-gray-400 text-center py-8">No messages in this session.</p>
              )}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">Select a session to view messages.</p>
          )}
        </div>
      </div>
    </div>
  );
}
