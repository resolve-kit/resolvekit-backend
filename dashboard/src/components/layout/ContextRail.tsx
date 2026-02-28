import type { ReactNode } from "react";

interface ContextRailProps {
  children: ReactNode;
}

export function ContextRail({ children }: ContextRailProps) {
  return <aside className="hidden 2xl:block w-72 flex-shrink-0">{children}</aside>;
}
