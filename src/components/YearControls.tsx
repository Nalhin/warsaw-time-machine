'use client';

import { ArrowLeftRight, Check, ChevronDown, Columns2, SeparatorVertical, Square } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';

import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { MapState } from '@/lib/state';
import { cn } from '@/lib/utils';
import { YEARS, yearDef, type YearKey } from '@/lib/years';

function YearToggle({
  value,
  onChange,
  label,
  className,
}: {
  value: YearKey;
  onChange(v: YearKey): void;
  label: string;
  className?: string;
}) {
  return (
    <ToggleGroup
      type="single"
      size="sm"
      spacing={0}
      value={value}
      onValueChange={(v) => v && onChange(v as YearKey)}
      aria-label={label}
      className={cn('rounded-full', className)}
    >
      {YEARS.map((y) => (
        <ToggleGroupItem
          key={y.key}
          value={y.key}
          title={y.long}
          className="h-8 rounded-full! px-2 font-semibold tabular-nums sm:px-3 text-muted-foreground data-[state=on]:bg-foreground data-[state=on]:text-background"
        >
          {y.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export function YearSelect({
  value,
  onChange,
  label,
  className,
  modal = false,
}: {
  value: YearKey;
  onChange(v: YearKey): void;
  label: string;
  className?: string;
  modal?: boolean;
}) {
  return (
    <DropdownMenu.Root modal={modal}>
      <DropdownMenu.Trigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`${label}: ${yearDef(value).long}`}
          className={cn('h-8 gap-1 rounded-full pr-2 pl-3 font-semibold tabular-nums data-[state=open]:bg-muted', className)}
        >
          {yearDef(value).label}
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={8}
          collisionPadding={10}
          className="glass-strong z-[1200] min-w-48 rounded-xl p-1 text-sm text-foreground duration-150 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <DropdownMenu.Label className="px-2.5 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">{label}</DropdownMenu.Label>
          <DropdownMenu.RadioGroup value={value} onValueChange={(v) => onChange(v as YearKey)}>
            {YEARS.map((y) => (
              <DropdownMenu.RadioItem
                key={y.key}
                value={y.key}
                className="flex cursor-pointer items-center gap-3 rounded-lg py-1.5 pr-2 pl-2.5 outline-none select-none data-[highlighted]:bg-muted data-[state=checked]:text-gold"
              >
                <span className="w-11 font-semibold tabular-nums">{y.label}</span>
                <span className="flex-1 text-xs text-muted-foreground">{y.era}</span>
                <DropdownMenu.ItemIndicator>
                  <Check className="size-4" />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function YearControls({
  state,
  setYear,
  setSide,
  swap,
  toggleCompare,
  toggleHorizontal,
}: {
  state: MapState;
  setYear(y: YearKey): void;
  setSide(side: 0 | 1, y: YearKey): void;
  swap(): void;
  toggleCompare(): void;
  toggleHorizontal(): void;
}) {
  const compare = state.swipe;
  return (
    <nav
      aria-label="Map years"
      className="glass fixed inset-x-2.5 bottom-[calc(28px+env(safe-area-inset-bottom))] z-[1000] mx-auto flex w-fit max-w-[calc(100%-20px)] items-center gap-1 rounded-full p-1 sm:top-3 sm:bottom-auto"
    >
      {compare ? (
        <>
          <YearSelect value={compare[0]} onChange={(y) => setSide(0, y)} label={state.horizontal ? 'Top side' : 'Left side'} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="rounded-full" onClick={swap} aria-label="Swap sides">
                <ArrowLeftRight />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Swap sides</TooltipContent>
          </Tooltip>
          <YearSelect value={compare[1]} onChange={(y) => setSide(1, y)} label={state.horizontal ? 'Bottom side' : 'Right side'} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-full"
                onClick={toggleHorizontal}
                aria-label={state.horizontal ? 'Vertical divider' : 'Horizontal divider'}
              >
                <SeparatorVertical className={cn('transition-transform duration-300', state.horizontal && 'rotate-90')} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{state.horizontal ? 'Vertical divider' : 'Horizontal divider'}</TooltipContent>
          </Tooltip>
        </>
      ) : (
        <>
          <YearToggle value={state.year} onChange={setYear} label="Year" className="hidden md:flex" />
          <YearSelect value={state.year} onChange={setYear} label="Year" className="md:hidden" />
        </>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={compare ? 'ghost' : 'outline'}
            size="sm"
            className="h-8 rounded-full px-2 sm:px-2.5"
            onClick={toggleCompare}
            aria-pressed={!!compare}
            aria-label={compare ? 'Show one year' : 'Compare two years'}
          >
            {compare ? <Square /> : <Columns2 />}
            <span className={compare ? 'hidden sm:inline' : ''}>{compare ? 'One year' : 'Compare'}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{compare ? 'Show one year' : 'Compare two years'}</TooltipContent>
      </Tooltip>
    </nav>
  );
}
