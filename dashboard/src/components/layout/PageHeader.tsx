import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  rightSlot?: ReactNode;
}

export function PageHeader({ eyebrow, title, subtitle, rightSlot }: PageHeaderProps) {
  return (
    <header className="glass-panel relative mb-6 overflow-hidden rounded-[1.6rem] border border-border/70 px-4 py-4 shadow-card animate-fade-in-up md:px-5 md:py-5">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(34,96,196,0.06),transparent_36%,rgba(0,0,0,0)_80%)]" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="relative z-10">
          {eyebrow && <p className="text-[10px] uppercase tracking-[0.2em] text-accent">{eyebrow}</p>}
          <h1 className="mt-1 font-display text-[1.55rem] font-semibold tracking-tight text-strong md:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1 max-w-3xl text-sm text-subtle">{subtitle}</p>}
        </div>
        <div className="relative z-10 w-full sm:w-auto">
          <div className="flex justify-start sm:justify-end">{rightSlot}</div>
        </div>
      </div>
    </header>
  );
}
