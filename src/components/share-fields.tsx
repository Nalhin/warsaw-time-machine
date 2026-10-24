'use client';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

export function Field({ label, children }: FieldProps) {
  return (
    <div className="grid gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

interface ChoiceOption<T extends string> {
  key: T;
  label: string;
  hint?: string;
}

interface ChoiceProps<T extends string> {
  value: T;
  onChange(value: T): void;
  options: ChoiceOption<T>[];
  label: string;
}

export function Choice<T extends string>({ value, onChange, options, label }: ChoiceProps<T>) {
  return (
    <ToggleGroup
      type="single"
      size="sm"
      variant="outline"
      spacing={0}
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      aria-label={label}
      className="w-full"
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o.key}
          value={o.key}
          className="h-auto min-h-8 min-w-0 flex-1 shrink flex-col gap-0 px-1 py-1 text-xs leading-tight data-[state=on]:bg-foreground data-[state=on]:text-background"
        >
          {o.label}
          {o.hint && <span className="text-[10px] opacity-60">{o.hint}</span>}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
