import type { ReactNode } from "react";

interface DataPanelProps {
  title: string;
  subtitle?: string;
  rightSlot?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function DataPanel({ title, subtitle, rightSlot, children, className = "" }: DataPanelProps) {
  return (
    <div className={`relative overflow-hidden rounded-xl border border-border/80 bg-surface p-4 shadow-card ${className}`}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(34,96,196,0.05),transparent_42%)]" />
      <div className="relative z-10 mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-strong">{title}</p>
          {subtitle && <p className="text-xs text-subtle mt-0.5">{subtitle}</p>}
        </div>
        {rightSlot}
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}
