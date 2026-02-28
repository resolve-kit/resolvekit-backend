import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Spinner } from "./Spinner";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "success" | "warning";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-white border border-accent hover:bg-accent-hover hover:border-accent-hover hover:-translate-y-0.5 shadow-[0_10px_24px_-16px_rgba(13,88,214,0.65)]",
  secondary:
    "bg-surface text-body border border-border-2 hover:bg-surface-2 hover:text-strong",
  ghost:
    "bg-transparent text-body border border-transparent hover:bg-surface-2 hover:border-border-2",
  danger:
    "bg-danger text-white border border-danger hover:brightness-95",
  outline:
    "bg-transparent text-body border border-border-2 hover:bg-surface-2 hover:border-border-2",
  success:
    "bg-success text-white border border-success hover:brightness-95",
  warning:
    "bg-warning text-white border border-warning hover:brightness-95",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs rounded-md gap-1.5",
  md: "h-10 px-4 text-sm rounded-lg gap-2",
  lg: "h-12 px-6 text-base rounded-xl gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  loading,
  icon,
  children,
  disabled,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={loading || disabled}
      className={`inline-flex items-center justify-center font-semibold tracking-tight transition-all duration-200 ${variantClasses[variant]} ${sizeClasses[size]} disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 ${className}`}
      {...props}
    >
      {loading ? <Spinner size="sm" /> : icon}
      {children}
    </button>
  );
}
