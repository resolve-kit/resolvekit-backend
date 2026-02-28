import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

interface FieldWrapperProps {
  label?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

function FieldWrapper({ label, hint, error, children }: FieldWrapperProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-semibold uppercase tracking-[0.14em] text-subtle">{label}</label>}
      {children}
      {(error || hint) && <p className={`text-xs ${error ? "text-danger" : "text-subtle"}`}>{error || hint}</p>}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  mono?: boolean;
}

export function Input({ label, hint, error, mono, className = "", ...props }: InputProps) {
  const base =
    "w-full rounded-lg border bg-surface px-3 py-2.5 text-sm text-body shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] placeholder:text-muted transition-colors focus:border-accent focus:bg-surface focus:outline-none disabled:cursor-not-allowed disabled:opacity-50";
  const errorClass = error ? "border-danger" : "border-border";
  const monoClass = mono ? "font-mono text-xs" : "";

  return (
    <FieldWrapper label={label} hint={hint} error={error}>
      <input className={`${base} ${errorClass} ${monoClass} ${className}`} {...props} />
    </FieldWrapper>
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  mono?: boolean;
}

export function Textarea({ label, hint, error, mono, className = "", ...props }: TextareaProps) {
  const base =
    "w-full resize-none rounded-lg border bg-surface px-3 py-2.5 text-sm text-body shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] placeholder:text-muted transition-colors focus:border-accent focus:bg-surface focus:outline-none disabled:opacity-50";
  const errorClass = error ? "border-danger" : "border-border";
  const monoClass = mono ? "font-mono text-xs" : "";

  return (
    <FieldWrapper label={label} hint={hint} error={error}>
      <textarea className={`${base} ${errorClass} ${monoClass} ${className}`} {...props} />
    </FieldWrapper>
  );
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

export function Select({ label, hint, error, children, className = "", ...props }: SelectProps) {
  const base =
    "w-full cursor-pointer rounded-lg border bg-surface px-3 py-2.5 text-sm text-body shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] transition-colors focus:border-accent focus:bg-surface focus:outline-none disabled:opacity-50";
  const errorClass = error ? "border-danger" : "border-border";

  return (
    <FieldWrapper label={label} hint={hint} error={error}>
      <select className={`${base} ${errorClass} ${className}`} {...props}>
        {children}
      </select>
    </FieldWrapper>
  );
}
