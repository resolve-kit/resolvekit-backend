export const designTokens = {
  semantic: {
    canvas: "--cmd-bg",
    surface1: "--cmd-surface-1",
    surface2: "--cmd-surface-2",
    surface3: "--cmd-surface-3",
    textPrimary: "--cmd-foreground",
    textSecondary: "--cmd-muted-text",
    textTertiary: "--cmd-quiet-text",
    borderSoft: "--cmd-border-soft",
    borderStrong: "--cmd-border-strong",
    accent: "--cmd-accent",
    accentHover: "--cmd-accent-hover",
    success: "--cmd-success",
    warning: "--cmd-warning",
    danger: "--cmd-danger",
  },
  motion: {
    fast: "140ms",
    base: "260ms",
    slow: "420ms",
  },
} as const;
