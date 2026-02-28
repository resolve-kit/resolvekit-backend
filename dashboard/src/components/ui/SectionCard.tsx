import type { ReactNode } from "react";

interface SectionCardProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SectionCard({ title, subtitle, actions, children, className = "" }: SectionCardProps) {
  return (
    <section className={`glass-panel relative overflow-hidden rounded-2xl border border-border/70 p-4 shadow-card md:p-5 ${className}`}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(34,96,196,0.05),transparent_36%,rgba(0,0,0,0)_78%)]" />
      {(title || subtitle || actions) && (
        <div className="relative z-10 mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-lg font-semibold text-strong">{title}</h2>}
            {subtitle && <p className="mt-1 text-sm text-subtle">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className="relative z-10">{children}</div>
    </section>
  );
}
