interface TraceMarkProps {
  size?: number;
  className?: string;
  animated?: boolean;
  variant?: "prompt" | "trace" | "resolved";
}

export default function TraceMark({
  size = 24,
  className = "",
  animated = false,
  variant = "prompt",
}: TraceMarkProps) {
  if (variant === "trace") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 64 64"
        fill="currentColor"
        width={size}
        height={size}
        className={className}
        role="img"
        aria-label="ResolveKit"
      >
        <rect x="10" y="14" width="44" height="8" rx="4" />
        <rect x="10" y="28" width="24" height="8" rx="4" opacity="0.65" />
        <rect x="10" y="42" width="35" height="8" rx="4" />
      </svg>
    );
  }

  if (variant === "resolved") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 64 64"
        fill="currentColor"
        width={size}
        height={size}
        className={className}
        role="img"
        aria-label="ResolveKit"
      >
        <rect x="10" y="14" width="44" height="8" rx="4" />
        <rect x="10" y="28" width="28" height="8" rx="4" opacity="0.55" />
        <rect x="10" y="42" width="14" height="14" rx="4" />
      </svg>
    );
  }

  // Default: prompt-trace (canonical mark)
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="currentColor"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="ResolveKit"
    >
      {/* Vertical cursor/prompt bar */}
      <rect
        x="10"
        y="14"
        width="8"
        height="36"
        rx="4"
        className={animated ? "animate-cursor-blink" : undefined}
      />
      {/* Top trace line */}
      <rect
        x="24"
        y="18"
        width="30"
        height="8"
        rx="4"
        className={animated ? "animate-trace-stagger" : undefined}
      />
      {/* Bottom trace line (dimmer) */}
      <rect
        x="24"
        y="38"
        width="22"
        height="8"
        rx="4"
        opacity="0.65"
        className={animated ? "animate-trace-stagger delay-150" : undefined}
      />
    </svg>
  );
}
