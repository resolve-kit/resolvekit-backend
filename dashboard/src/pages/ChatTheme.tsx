import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { api, ApiError } from "../api/client";
import { Button, PageSpinner, useToast } from "../components/ui";

type ThemeMode = "light" | "dark";

type ChatThemePalette = {
  screenBackground: string;
  titleText: string;
  statusText: string;
  composerBackground: string;
  composerText: string;
  composerPlaceholder: string;
  userBubbleBackground: string;
  userBubbleText: string;
  assistantBubbleBackground: string;
  assistantBubbleText: string;
  loaderBubbleBackground: string;
  loaderDotActive: string;
  loaderDotInactive: string;
  toolCardBackground: string;
  toolCardBorder: string;
  toolCardTitle: string;
  toolCardBody: string;
};

type ChatTheme = {
  light: ChatThemePalette;
  dark: ChatThemePalette;
};

const TOKEN_LABELS: Record<keyof ChatThemePalette, string> = {
  screenBackground: "Screen Background",
  titleText: "Title Text",
  statusText: "Status Text",
  composerBackground: "Composer Background",
  composerText: "Composer Text",
  composerPlaceholder: "Composer Placeholder",
  userBubbleBackground: "User Bubble Background",
  userBubbleText: "User Bubble Text",
  assistantBubbleBackground: "Assistant Bubble Background",
  assistantBubbleText: "Assistant Bubble Text",
  loaderBubbleBackground: "Loader Bubble Background",
  loaderDotActive: "Loader Dot Active",
  loaderDotInactive: "Loader Dot Inactive",
  toolCardBackground: "Tool Card Background",
  toolCardBorder: "Tool Card Border",
  toolCardTitle: "Tool Card Title",
  toolCardBody: "Tool Card Body",
};

const TOKEN_KEYS = Object.keys(TOKEN_LABELS) as (keyof ChatThemePalette)[];
const HEX_RE = /^#(?:[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;

const DEFAULT_THEME: ChatTheme = {
  light: {
    screenBackground: "#F7F7FA",
    titleText: "#111827",
    statusText: "#4B5563",
    composerBackground: "#FFFFFF",
    composerText: "#111827",
    composerPlaceholder: "#9CA3AF",
    userBubbleBackground: "#DBEAFE",
    userBubbleText: "#1E3A8A",
    assistantBubbleBackground: "#E5E7EB",
    assistantBubbleText: "#111827",
    loaderBubbleBackground: "#E5E7EB",
    loaderDotActive: "#374151",
    loaderDotInactive: "#9CA3AF",
    toolCardBackground: "#FFFFFFCC",
    toolCardBorder: "#D1D5DB",
    toolCardTitle: "#111827",
    toolCardBody: "#374151",
  },
  dark: {
    screenBackground: "#0B0C10",
    titleText: "#E5E7EB",
    statusText: "#9CA3AF",
    composerBackground: "#111318",
    composerText: "#E5E7EB",
    composerPlaceholder: "#6B7280",
    userBubbleBackground: "#1E3A8A99",
    userBubbleText: "#DBEAFE",
    assistantBubbleBackground: "#1F2937",
    assistantBubbleText: "#E5E7EB",
    loaderBubbleBackground: "#1F2937",
    loaderDotActive: "#E5E7EB",
    loaderDotInactive: "#6B7280",
    toolCardBackground: "#111318CC",
    toolCardBorder: "#374151",
    toolCardTitle: "#E5E7EB",
    toolCardBody: "#9CA3AF",
  },
};

function normalizeHex(value: string): string {
  return value.trim().toUpperCase();
}

function isValidHex(value: string): boolean {
  return HEX_RE.test(value);
}

function toRgbHex(value: string): string {
  return value.length >= 7 ? value.slice(0, 7) : "#000000";
}

export default function ChatTheme() {
  const { appId } = useParams<{ appId: string }>();
  const { toast } = useToast();

  const [theme, setTheme] = useState<ChatTheme | null>(null);
  const [savedTheme, setSavedTheme] = useState<ChatTheme | null>(null);
  const [activeMode, setActiveMode] = useState<ThemeMode>("light");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    api<ChatTheme>(`/v1/apps/${appId}/chat-theme`)
      .then((data) => {
        if (cancelled) return;
        setTheme(data);
        setSavedTheme(data);
      })
      .catch((err: unknown) => {
        toast(err instanceof ApiError ? err.detail : "Failed to load chat theme", "error");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [appId, toast]);

  const palette = theme?.[activeMode] ?? null;

  const fieldErrors = useMemo(() => {
    if (!palette) return {};
    return TOKEN_KEYS.reduce<Record<string, string>>((acc, key) => {
      if (!isValidHex(palette[key])) {
        acc[key] = "Use #RRGGBB or #RRGGBBAA";
      }
      return acc;
    }, {});
  }, [palette]);

  const hasValidationErrors = Object.keys(fieldErrors).length > 0;
  const isDirty = JSON.stringify(theme) !== JSON.stringify(savedTheme);

  function updateToken(key: keyof ChatThemePalette, value: string) {
    if (!theme) return;
    const next = normalizeHex(value);
    setTheme({
      ...theme,
      [activeMode]: {
        ...theme[activeMode],
        [key]: next,
      },
    });
  }

  function resetToken(key: keyof ChatThemePalette) {
    if (!theme) return;
    setTheme({
      ...theme,
      [activeMode]: {
        ...theme[activeMode],
        [key]: DEFAULT_THEME[activeMode][key],
      },
    });
  }

  function resetCurrentMode() {
    if (!theme) return;
    setTheme({
      ...theme,
      [activeMode]: { ...DEFAULT_THEME[activeMode] },
    });
  }

  function resetAll() {
    setTheme({
      light: { ...DEFAULT_THEME.light },
      dark: { ...DEFAULT_THEME.dark },
    });
  }

  async function saveTheme() {
    if (!theme || hasValidationErrors) return;
    setIsSaving(true);
    try {
      const normalized: ChatTheme = {
        light: TOKEN_KEYS.reduce((acc, key) => {
          acc[key] = normalizeHex(theme.light[key]);
          return acc;
        }, {} as ChatThemePalette),
        dark: TOKEN_KEYS.reduce((acc, key) => {
          acc[key] = normalizeHex(theme.dark[key]);
          return acc;
        }, {} as ChatThemePalette),
      };
      const updated = await api<ChatTheme>(`/v1/apps/${appId}/chat-theme`, {
        method: "PUT",
        body: JSON.stringify(normalized),
      });
      setTheme(updated);
      setSavedTheme(updated);
      toast("Chat theme saved", "success");
    } catch (err: unknown) {
      toast(err instanceof ApiError ? err.detail : "Failed to save chat theme", "error");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading || !palette) return <PageSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-strong">Chat Theme</h1>
          <p className="text-sm text-subtle mt-1">
            Configure chat colors for light and dark modes with a live preview.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={resetAll}>
            Reset All
          </Button>
          <Button
            variant="primary"
            size="md"
            loading={isSaving}
            disabled={!isDirty || hasValidationErrors}
            onClick={saveTheme}
          >
            Save Theme
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <Button
          size="sm"
          variant={activeMode === "light" ? "primary" : "outline"}
          onClick={() => setActiveMode("light")}
        >
          Light
        </Button>
        <Button
          size="sm"
          variant={activeMode === "dark" ? "primary" : "outline"}
          onClick={() => setActiveMode("dark")}
        >
          Dark
        </Button>
        <Button size="sm" variant="ghost" onClick={resetCurrentMode}>
          Reset {activeMode}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 bg-surface border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-strong mb-4">
            {activeMode === "light" ? "Light" : "Dark"} Palette
          </h2>
          <div className="space-y-3">
            {TOKEN_KEYS.map((key) => (
              <div key={key} className="grid grid-cols-12 gap-2 items-center">
                <label className="col-span-4 text-xs text-subtle">{TOKEN_LABELS[key]}</label>
                <input
                  type="color"
                  value={toRgbHex(palette[key])}
                  onChange={(e) => updateToken(key, e.target.value)}
                  className="col-span-2 h-9 w-full rounded border border-border bg-transparent cursor-pointer"
                />
                <input
                  type="text"
                  value={palette[key]}
                  onChange={(e) => updateToken(key, e.target.value)}
                  className={`col-span-4 bg-surface-2 border rounded-lg px-3 py-2 text-xs font-mono text-body focus:outline-none focus:border-accent ${
                    fieldErrors[key] ? "border-danger" : "border-border"
                  }`}
                />
                <Button size="sm" variant="ghost" onClick={() => resetToken(key)}>
                  Reset
                </Button>
                {fieldErrors[key] && (
                  <p className="col-span-12 text-xs text-danger">{fieldErrors[key]}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div
            className="rounded-xl border overflow-hidden"
            style={{
              borderColor: palette.toolCardBorder,
              backgroundColor: palette.screenBackground,
            }}
          >
            <div
              className="px-4 py-3 border-b"
              style={{
                borderColor: palette.toolCardBorder,
                backgroundColor: palette.composerBackground,
              }}
            >
              <p className="text-sm font-semibold" style={{ color: palette.titleText }}>
                Playbook
              </p>
              <p className="text-xs" style={{ color: palette.statusText }}>
                State: active
              </p>
            </div>

            <div className="p-4 space-y-3 min-h-[280px]">
              <div className="flex justify-end">
                <div
                  className="max-w-[75%] rounded-2xl px-3 py-2 text-sm border"
                  style={{
                    backgroundColor: palette.userBubbleBackground,
                    color: palette.userBubbleText,
                    borderColor: palette.toolCardBorder,
                  }}
                >
                  Show me account limits
                </div>
              </div>
              <div className="flex justify-start">
                <div
                  className="max-w-[75%] rounded-2xl px-3 py-2 text-sm border"
                  style={{
                    backgroundColor: palette.assistantBubbleBackground,
                    color: palette.assistantBubbleText,
                    borderColor: palette.toolCardBorder,
                  }}
                >
                  You can update limits in the Limits tab.
                </div>
              </div>
              <div className="flex justify-start">
                <div
                  className="rounded-2xl px-3 py-2 border inline-flex items-center gap-1.5"
                  style={{
                    backgroundColor: palette.loaderBubbleBackground,
                    borderColor: palette.toolCardBorder,
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: palette.loaderDotActive }}
                  />
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: palette.loaderDotInactive }}
                  />
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: palette.loaderDotInactive }}
                  />
                </div>
              </div>
              <div
                className="rounded-xl border px-3 py-2"
                style={{
                  backgroundColor: palette.toolCardBackground,
                  borderColor: palette.toolCardBorder,
                }}
              >
                <p className="text-xs font-semibold" style={{ color: palette.toolCardTitle }}>
                  Tool Requests
                </p>
                <p className="text-xs mt-1" style={{ color: palette.toolCardBody }}>
                  Running tool call preview state.
                </p>
              </div>
            </div>

            <div
              className="border-t p-3"
              style={{
                borderColor: palette.toolCardBorder,
                backgroundColor: palette.composerBackground,
              }}
            >
              <div
                className="rounded-lg border px-3 py-2 text-sm"
                style={{
                  borderColor: palette.toolCardBorder,
                  color: palette.composerPlaceholder,
                }}
              >
                Message
              </div>
              <p className="text-xs mt-2" style={{ color: palette.composerText }}>
                Composer text
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
