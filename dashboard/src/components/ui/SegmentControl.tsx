interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentControl<T extends string>({ options, value, onChange, className = "" }: SegmentControlProps<T>) {
  return (
    <div className={`inline-flex items-center gap-0.5 rounded-[10px] border border-border bg-surface-2 p-[3px] ${className}`}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-[7px] px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
            value === opt.value
              ? "bg-surface text-strong shadow-[0_1px_2px_rgba(7,31,66,0.08)]"
              : "text-subtle hover:text-body"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
