interface ResolveKitWordmarkProps {
  className?: string;
  resolveClassName?: string;
  kitClassName?: string;
}

export default function ResolveKitWordmark({
  className = "",
  resolveClassName = "text-strong",
  kitClassName = "text-strong",
}: ResolveKitWordmarkProps) {
  return (
    <span
      className={`inline-flex items-end leading-none ${className}`.trim()}
      style={{ fontFamily: "Inter, 'Mona Sans', 'Avenir Next', 'Segoe UI', sans-serif" }}
      aria-label="RESOLVEkit"
    >
      <span className={`text-[20px] font-normal uppercase tracking-[0.2em] ${resolveClassName}`.trim()}>RESOLVE</span>
      <span className={`ml-[0.12em] text-[10px] font-normal tracking-[0.2em] ${kitClassName}`.trim()}>kit</span>
    </span>
  );
}
