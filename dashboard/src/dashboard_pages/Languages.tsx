import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { Button, Input, PageSpinner, Textarea, useToast } from "../components/ui";

type LocalizationTexts = {
  chat_title: string;
  message_placeholder: string;
  initial_message: string;
};

type LocaleInfo = {
  code: string;
  language: string;
  local_name: string;
};

type LocaleRow = {
  locale: LocaleInfo;
  defaults: LocalizationTexts;
  effective: LocalizationTexts;
  overrides: LocalizationTexts | null;
};

type LocalizationsResponse = {
  locales: LocaleRow[];
};

export default function Languages() {
  const { appId } = useParams();
  const { toast } = useToast();
  const [rows, setRows] = useState<LocaleRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, LocalizationTexts>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    api<LocalizationsResponse>(`/v1/apps/${appId}/chat-localizations`)
      .then((res) => {
        setRows(res.locales);
        const next: Record<string, LocalizationTexts> = {};
        res.locales.forEach((row) => {
          next[row.locale.code] = { ...row.effective };
        });
        setDrafts(next);
      })
      .finally(() => setLoading(false));
  }, [appId]);

  const isDirty = useMemo(
    () =>
      rows.some((row) => {
        const draft = drafts[row.locale.code];
        if (!draft) return false;
        return (
          draft.chat_title !== row.effective.chat_title ||
          draft.message_placeholder !== row.effective.message_placeholder ||
          draft.initial_message !== row.effective.initial_message
        );
      }),
    [rows, drafts]
  );

  const visibleRows = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const ordered = [...rows].sort((a, b) => {
      if (a.locale.code === "en") return -1;
      if (b.locale.code === "en") return 1;
      return a.locale.language.localeCompare(b.locale.language);
    });
    if (!normalized) return ordered;
    return ordered.filter((row) => {
      const haystack = `${row.locale.code} ${row.locale.language} ${row.locale.local_name}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [rows, search]);

  function setField(code: string, field: keyof LocalizationTexts, value: string) {
    setDrafts((prev) => ({
      ...prev,
      [code]: {
        ...prev[code],
        [field]: value,
      },
    }));
  }

  function resetLocale(code: string) {
    const row = rows.find((item) => item.locale.code === code);
    if (!row) return;
    setDrafts((prev) => ({
      ...prev,
      [code]: { ...row.defaults },
    }));
  }

  async function save() {
    const overrides: Record<string, LocalizationTexts> = {};
    rows.forEach((row) => {
      const code = row.locale.code;
      const draft = drafts[code];
      if (!draft) return;
      if (
        draft.chat_title !== row.defaults.chat_title ||
        draft.message_placeholder !== row.defaults.message_placeholder ||
        draft.initial_message !== row.defaults.initial_message
      ) {
        overrides[code] = draft;
      }
    });

    setSaving(true);
    try {
      const res = await api<LocalizationsResponse>(`/v1/apps/${appId}/chat-localizations`, {
        method: "PUT",
        body: JSON.stringify({ overrides }),
      });
      setRows(res.locales);
      const next: Record<string, LocalizationTexts> = {};
      res.locales.forEach((row) => {
        next[row.locale.code] = { ...row.effective };
      });
      setDrafts(next);
      toast("Language texts saved", "success");
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to save language texts", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <PageSpinner />;

  return (
    <div>
      <div className="glass-panel rounded-2xl px-4 py-3 flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-strong tracking-tight">Localization</h1>
          <p className="text-sm text-subtle mt-1">
            Customize chat title, message placeholder, and initial message per language.
          </p>
        </div>
        <Button variant="primary" onClick={save} loading={saving} disabled={!isDirty}>
          Save Changes
        </Button>
      </div>

      <div className="space-y-3">
        <Input
          label="Search language"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Type code or language (e.g. en, german, deutsch)"
        />
        {visibleRows.map((row) => {
          const code = row.locale.code;
          const draft = drafts[code] || row.effective;
          return (
            <div key={code} className="glass-panel rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-medium text-strong">
                    {row.locale.language} ({row.locale.code})
                  </p>
                  <p className="text-xs text-subtle">{row.locale.local_name}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => resetLocale(code)}>
                  Reset to defaults
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  label="Chat title"
                  value={draft.chat_title}
                  onChange={(e) => setField(code, "chat_title", e.target.value)}
                />
                <Input
                  label="Message placeholder"
                  value={draft.message_placeholder}
                  onChange={(e) => setField(code, "message_placeholder", e.target.value)}
                />
              </div>
              <div className="mt-3">
                <Textarea
                  label="Initial message"
                  rows={2}
                  value={draft.initial_message}
                  onChange={(e) => setField(code, "initial_message", e.target.value)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
