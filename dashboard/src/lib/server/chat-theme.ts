const CHAT_THEME_TOKEN_KEYS = [
  "screenBackground",
  "titleText",
  "statusText",
  "composerBackground",
  "composerText",
  "composerPlaceholder",
  "userBubbleBackground",
  "userBubbleText",
  "assistantBubbleBackground",
  "assistantBubbleText",
  "loaderBubbleBackground",
  "loaderDotActive",
  "loaderDotInactive",
  "toolCardBackground",
  "toolCardBorder",
  "toolCardTitle",
  "toolCardBody",
] as const;

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

const DEFAULT_CHAT_THEME = {
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
} as const;

export function defaultChatTheme() {
  return structuredClone(DEFAULT_CHAT_THEME);
}

function invalidTheme(message: string): never {
  throw new Error(message);
}

function normalizePalette(mode: "light" | "dark", rawPalette: Record<string, unknown>) {
  const unknownKeys = Object.keys(rawPalette).filter((key) => !CHAT_THEME_TOKEN_KEYS.includes(key as (typeof CHAT_THEME_TOKEN_KEYS)[number]));
  if (unknownKeys.length > 0) {
    invalidTheme(`Palette '${mode}' has unknown keys: ${unknownKeys.sort().join(", ")}`);
  }

  const missingKeys = CHAT_THEME_TOKEN_KEYS.filter((key) => !(key in rawPalette));
  if (missingKeys.length > 0) {
    invalidTheme(`Palette '${mode}' is missing keys: ${missingKeys.join(", ")}`);
  }

  const normalized: Record<string, string> = {};
  for (const key of CHAT_THEME_TOKEN_KEYS) {
    const value = rawPalette[key];
    if (typeof value !== "string") {
      invalidTheme(`Palette '${mode}' key '${key}' must be a string`);
    }
    if (!HEX_COLOR_RE.test(value)) {
      invalidTheme(`Palette '${mode}' key '${key}' must be #RRGGBB or #RRGGBBAA`);
    }
    normalized[key] = value.toUpperCase();
  }

  return normalized;
}

export function normalizeChatTheme(rawTheme: unknown) {
  if (!rawTheme || typeof rawTheme !== "object") {
    invalidTheme("Theme must be an object with light and dark palettes");
  }
  const theme = rawTheme as Record<string, unknown>;

  const light = theme.light;
  if (!light || typeof light !== "object") {
    invalidTheme("Theme must include 'light' palette");
  }

  const dark = theme.dark;
  if (!dark || typeof dark !== "object") {
    invalidTheme("Theme must include 'dark' palette");
  }

  return {
    light: normalizePalette("light", light as Record<string, unknown>),
    dark: normalizePalette("dark", dark as Record<string, unknown>),
  };
}
