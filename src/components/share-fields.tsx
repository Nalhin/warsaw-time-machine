'use client';

import { ArrowLeftRight } from 'lucide-react';

import { useMessages } from '@/components/locale-provider';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { YearSelect } from '@/components/year-controls';
import type { Side, SwipeYears } from '@/lib/state';
import type { YearKey } from '@/lib/years';

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

interface YearPairProps {
  years: SwipeYears;
  sides: [string, string];
  onSide(side: Side, year: YearKey): void;
  onSwap(): void;
}

export function YearPair({ years, sides, onSide, onSwap }: YearPairProps) {
  const m = useMessages().share;
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{m.years}</span>
        <Button variant="ghost" size="icon-xs" onClick={onSwap} aria-label={m.swapYears} title={m.swapYears}>
          <ArrowLeftRight />
        </Button>
      </div>
      {years.map((year, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-12 shrink-0 text-xs text-muted-foreground">{sides[i]}</span>
          <YearSelect
            value={year}
            onChange={(y) => onSide(i as Side, y)}
            label={m.sideYear(sides[i])}
            className="flex-1 justify-between rounded-md border border-input bg-input/30"
            isModal
          />
        </div>
      ))}
    </div>
  );
}
