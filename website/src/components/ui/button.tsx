import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost" | "outline";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const STYLES: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground border border-primary shadow-card hover:-translate-y-0.5 hover:shadow-panel",
  ghost:
    "bg-transparent text-foreground border border-transparent hover:border-border hover:bg-white/55",
  outline:
    "bg-card text-foreground border border-border hover:border-primary/40 hover:bg-primary/5",
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold tracking-tight transition-all duration-200",
        STYLES[variant],
        className,
      )}
      {...props}
    />
  );
}
