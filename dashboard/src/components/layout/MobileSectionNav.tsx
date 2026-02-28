import type { ReactNode } from "react";

interface MobileSectionNavProps {
  children: ReactNode;
}

export function MobileSectionNav({ children }: MobileSectionNavProps) {
  return (
    <div className="md:hidden mb-4 rounded-xl border border-border bg-surface px-3 py-2 overflow-x-auto">
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}
