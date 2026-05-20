import type { ReactNode } from "react";

type ErrorPageVariant = "not-found" | "server-error" | "permission-denied";

interface ErrorPageProps {
  variant?: ErrorPageVariant;
  title?: string;
  description?: string;
  action?: ReactNode;
  requiredRole?: string;
}

function NotFoundGlyph() {
  return (
    <svg viewBox="0 0 64 64" fill="currentColor" width={80} height={80} aria-hidden>
      {/* Vertical prompt bar */}
      <rect x="10" y="14" width="8" height="36" rx="4" />
      {/* Top trace line — intact */}
      <rect x="24" y="18" width="30" height="8" rx="4" />
      {/* Bottom bar — drifted/broken */}
      <rect x="24" y="38" width="22" height="8" rx="4" opacity="0.35"
        style={{ animation: "rk-tilt 4s ease-in-out infinite" }}
      />
    </svg>
  );
}

function ServerErrorGlyph() {
  return (
    <svg viewBox="0 0 64 64" fill="currentColor" width={80} height={80} aria-hidden>
      {/* Vertical prompt bar — danger tinted */}
      <rect x="10" y="14" width="8" height="36" rx="4" />
      {/* Top trace */}
      <rect x="24" y="18" width="30" height="8" rx="4" />
      {/* Danger dot on bottom */}
      <rect x="24" y="38" width="22" height="8" rx="4" opacity="0.4" />
      <circle cx="47" cy="42" r="6" fill="currentColor" className="text-danger" />
    </svg>
  );
}

const VARIANT_CONFIG: Record<ErrorPageVariant, {
  code: string;
  defaultTitle: string;
  defaultDesc: string;
  glyphClass: string;
  Glyph: React.FC;
}> = {
  "not-found": {
    code: "404",
    defaultTitle: "Page not found",
    defaultDesc: "This route doesn't exist or was moved.",
    glyphClass: "text-accent/40",
    Glyph: NotFoundGlyph,
  },
  "server-error": {
    code: "503",
    defaultTitle: "Service unavailable",
    defaultDesc: "Something went wrong on our end. Try refreshing.",
    glyphClass: "text-danger/40",
    Glyph: ServerErrorGlyph,
  },
  "permission-denied": {
    code: "403",
    defaultTitle: "Access denied",
    defaultDesc: "You don't have permission to view this page.",
    glyphClass: "text-warning/50",
    Glyph: NotFoundGlyph,
  },
};

export function ErrorPage({ variant = "not-found", title, description, action, requiredRole }: ErrorPageProps) {
  const cfg = VARIANT_CONFIG[variant];

  if (variant === "permission-denied") {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-6">
        <div
          className="w-full max-w-lg rounded-[20px] border border-warning-dim p-7"
          style={{ background: "linear-gradient(180deg, #fffaee, #fff3dc)" }}
        >
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[14px] bg-warning text-white">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7">
                <path d="M12 1C8.676 1 6 3.676 6 7v1H4v15h16V8h-2V7c0-3.324-2.676-6-6-6Zm0 2c2.276 0 4 1.724 4 4v1H8V7c0-2.276 1.724-4 4-4Zm0 9a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z" />
              </svg>
            </div>
            <div>
              <h2 className="font-display text-[19px] font-semibold leading-snug text-[#3d2800]" style={{ letterSpacing: "-0.018em" }}>
                {title ?? cfg.defaultTitle}
              </h2>
              <p className="mt-1 text-[13px] leading-[1.55] text-[#5e4517]">
                {description ?? cfg.defaultDesc}
              </p>
              {requiredRole && (
                <p className="mt-2 font-mono text-[11.5px] font-semibold text-warning">
                  Requires role: {requiredRole}
                </p>
              )}
              {action && <div className="mt-4">{action}</div>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[500px] items-center justify-center p-6">
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-[20px] border border-border px-12 py-16 text-center"
        style={{ background: "linear-gradient(180deg, #f9fcff, #edf4fb)" }}
      >
        {/* Blueprint grid overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              "linear-gradient(rgba(50,84,128,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(50,84,128,0.06) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="relative">
          <p className="font-mono text-[13px] font-bold uppercase tracking-[0.18em] text-muted">{cfg.code}</p>
          <div className={`mx-auto mt-4 mb-5 ${cfg.glyphClass}`}>
            <cfg.Glyph />
          </div>
          <h1
            className="font-display text-[38px] font-semibold leading-tight text-strong"
            style={{ letterSpacing: "-0.032em" }}
          >
            {title ?? cfg.defaultTitle}
          </h1>
          <p className="mx-auto mt-3 max-w-xs text-[14px] leading-[1.6] text-dim">
            {description ?? cfg.defaultDesc}
          </p>
          {action && <div className="mt-6 flex items-center justify-center gap-2.5">{action}</div>}
        </div>
      </div>
    </div>
  );
}
