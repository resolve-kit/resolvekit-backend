import { useCallback, useEffect, useState } from "react";

import { api } from "../api/client";

export type KnowledgeBaseStatus = {
  enabled: boolean;
  code: "ok" | "kb_auth_misconfigured" | "kb_service_unavailable";
  detail: string;
};

const DEFAULT_STATUS: KnowledgeBaseStatus = {
  enabled: false,
  code: "kb_service_unavailable",
  detail: "Checking knowledge base integration status...",
};

export function useKnowledgeBaseStatus() {
  const [status, setStatus] = useState<KnowledgeBaseStatus>(DEFAULT_STATUS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await api<KnowledgeBaseStatus>("/v1/knowledge-bases/status");
      setStatus(payload);
    } catch {
      setStatus({
        enabled: false,
        code: "kb_service_unavailable",
        detail: "Knowledge base service is unavailable.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    status,
    loading,
    refresh,
  };
}
