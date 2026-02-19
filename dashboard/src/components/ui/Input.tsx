import type { ReactNode, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from "react";

interface FieldWrapperProps {
  label?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

function FieldWrapper({ label, hint, error, children }: FieldWrapperProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-medium text-subtle">{label}</label>
      )}
      {children}
      {(error || hint) && (
        <p className={`text-xs ${error ? "text-danger" : "text-subtle"}`}>
          {error || hint}
        </p>
      )}
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
    "w-full bg-surface border rounded-lg px-3 py-2 text-sm text-body placeholder:text-muted focus:outline-none focus:border-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const errorClass = error ? "border-danger" : "border-border";
  const monoClass = mono ? "font-mono text-xs" : "";

  return (
    <FieldWrapper label={label} hint={hint} error={error}>
      <input
        className={`${base} ${errorClass} ${monoClass} ${className}`}
        {...props}
      />
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
    "w-full bg-surface border rounded-lg px-3 py-2 text-sm text-body placeholder:text-muted focus:outline-none focus:border-accent transition-colors resize-none disabled:opacity-50";
  const errorClass = error ? "border-danger" : "border-border";
  const monoClass = mono ? "font-mono text-xs" : "";

  return (
    <FieldWrapper label={label} hint={hint} error={error}>
      <textarea
        className={`${base} ${errorClass} ${monoClass} ${className}`}
        {...props}
      />
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
    "w-full bg-surface border rounded-lg px-3 py-2 text-sm text-body focus:outline-none focus:border-accent transition-colors disabled:opacity-50 cursor-pointer";
  const errorClass = error ? "border-danger" : "border-border";

  return (
    <FieldWrapper label={label} hint={hint} error={error}>
      <select className={`${base} ${errorClass} ${className}`} {...props}>
        {children}
      </select>
    </FieldWrapper>
  );
}
