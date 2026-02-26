import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost" | "outline";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const STYLES: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:opacity-95 shadow-panel",
  ghost:
    "bg-transparent text-foreground hover:bg-muted",
  outline:
    "bg-background text-foreground border border-border hover:bg-muted",
};

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-all",
        STYLES[variant],
        className,
      )}
      {...props}
    />
  );
}
