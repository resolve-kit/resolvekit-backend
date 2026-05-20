interface ResolveKitWordmarkProps {
  className?: string;
  resolveClassName?: string;
  kitClassName?: string;
}

export default function ResolveKitWordmark({
  className = "",
  resolveClassName = "text-strong",
  kitClassName = "text-dim",
}: ResolveKitWordmarkProps) {
  return (
    <span
      className={`inline-flex items-baseline leading-none ${className}`.trim()}
      style={{ fontFamily: "'Mona Sans', 'Avenir Next', 'Segoe UI', sans-serif" }}
      aria-label="RESOLVEkit"
    >
      <span
        className={`text-[20px] font-medium uppercase tracking-[0.18em] ${resolveClassName}`.trim()}
        style={{ marginRight: "-0.16em" }}
      >
        RESOLVE
      </span>
      <span
        className={`text-[10px] font-normal tracking-[0.16em] ${kitClassName}`.trim()}
        style={{ marginLeft: "0.42em" }}
      >
        kit
      </span>
    </span>
  );
}
