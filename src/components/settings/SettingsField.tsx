interface SettingsFieldProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

export function SettingsField({
  label,
  description,
  children,
}: SettingsFieldProps) {
  return (
    <div className="flex flex-col gap-1 border-b border-[var(--ui-border-subtle)] py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1 sm:pr-4">
        <div className="text-sm text-[var(--ui-text-secondary)]">{label}</div>
        {description && (
          <div className="mt-0.5 text-xs text-[var(--ui-text-faint)]">{description}</div>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

const inputClass =
  "rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface)] px-2.5 py-1.5 text-sm text-[var(--ui-text)] outline-none focus:border-[var(--ui-hover-strong)]";

export function TextInput({
  value,
  onChange,
  className = "",
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`${inputClass} ${className}`}
    />
  );
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
  className = "w-24",
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`${inputClass} ${className}`}
    />
  );
}

export function SelectInput<T extends string>({
  value,
  onChange,
  options,
  className = "w-36",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={`${inputClass} ${className}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-[var(--ui-panel)]">
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function ToggleInput({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition-colors ${
        checked ? "bg-blue-500" : "bg-[var(--ui-toggle-off)]"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
          checked ? "translate-x-5" : ""
        }`}
      />
    </button>
  );
}
