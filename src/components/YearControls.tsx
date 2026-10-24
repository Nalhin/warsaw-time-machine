'use client';

import { ArrowLeftRight, Check, ChevronDown, ChevronLeft, ChevronRight, Columns2, Pause, Play, RectangleHorizontal, SeparatorVertical } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';

import { useMessages } from '@/components/LocaleProvider';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { MapState } from '@/lib/state';
import { cn } from '@/lib/utils';
import { YEAR_KEYS, YEARS, type YearKey } from '@/lib/years';

function YearStepper({ value, onChange, label }: { value: YearKey; onChange(v: YearKey): void; label: string }) {
  const t = useMessages();
  const c = t.controls;
  const i = YEAR_KEYS.indexOf(value);
  const prev = YEAR_KEYS[i - 1];
  const next = YEAR_KEYS[i + 1];
  return (
    <div className="flex items-center">
      <Button
        variant="ghost"
        size="icon-sm"
        className="rounded-full"
        disabled={!prev}
        onClick={() => prev && onChange(prev)}
        aria-label={prev ? `${c.previousYear}: ${t.years[prev].long}` : c.previousYear}
      >
        <ChevronLeft />
      </Button>
      <YearSelect value={value} onChange={onChange} label={label} />
      <Button
        variant="ghost"
        size="icon-sm"
        className="rounded-full"
        disabled={!next}
        onClick={() => next && onChange(next)}
        aria-label={next ? `${c.nextYear}: ${t.years[next].long}` : c.nextYear}
      >
        <ChevronRight />
      </Button>
    </div>
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
  const t = useMessages();
  return (
    <DropdownMenu.Root modal={modal}>
      <DropdownMenu.Trigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`${label}: ${t.years[value].long}`}
          className={cn('h-8 gap-1 rounded-full pr-2 pl-3 font-semibold tabular-nums data-[state=open]:bg-muted', className)}
        >
          {t.years[value].label}
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={8}
          collisionPadding={10}
          className="glass-strong z-[1200] max-h-[min(70vh,var(--radix-dropdown-menu-content-available-height))] min-w-48 overflow-y-auto overscroll-contain rounded-xl p-1 text-sm text-foreground duration-150 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <DropdownMenu.Label className="px-2.5 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">{label}</DropdownMenu.Label>
          <DropdownMenu.RadioGroup value={value} onValueChange={(v) => onChange(v as YearKey)}>
            {YEARS.map((y) => (
              <DropdownMenu.RadioItem
                key={y.key}
                value={y.key}
                className="flex cursor-pointer items-center gap-3 rounded-lg py-1.5 pr-2 pl-2.5 outline-none select-none data-[highlighted]:bg-muted data-[state=checked]:text-gold"
              >
                <span className="w-16 font-semibold tabular-nums">{t.years[y.key].label}</span>
                <span className="flex-1 text-xs text-muted-foreground">{t.years[y.key].era}</span>
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
  playing,
  togglePlay,
}: {
  state: MapState;
  setYear(y: YearKey): void;
  setSide(side: 0 | 1, y: YearKey): void;
  swap(): void;
  toggleCompare(): void;
  toggleHorizontal(): void;
  playing: boolean;
  togglePlay(): void;
}) {
  const t = useMessages();
  const c = t.controls;
  const compare = state.swipe;
  return (
    <nav
      aria-label={c.nav}
      className="glass fixed inset-x-2.5 bottom-[calc(28px+env(safe-area-inset-bottom))] z-[1000] mx-auto flex w-fit max-w-[calc(100%-20px)] items-center gap-1 rounded-full p-1 xl:top-3 xl:bottom-auto"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn('rounded-full', playing && 'text-gold')}
            onClick={togglePlay}
            aria-label={playing ? c.pause : c.play}
            aria-pressed={playing}
          >
            {playing ? <Pause className="fill-current" /> : <Play className="fill-current" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{playing ? c.pause : c.play}</TooltipContent>
      </Tooltip>
      {compare ? (
        <>
          <YearSelect value={compare[0]} onChange={(y) => setSide(0, y)} label={state.horizontal ? c.topSide : c.leftSide} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="rounded-full" onClick={swap} aria-label={c.swapSides}>
                <ArrowLeftRight />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{c.swapSides}</TooltipContent>
          </Tooltip>
          <YearSelect value={compare[1]} onChange={(y) => setSide(1, y)} label={state.horizontal ? c.bottomSide : c.rightSide} />
        </>
      ) : (
        <YearStepper value={state.year} onChange={setYear} label={c.year} />
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={compare ? 'ghost' : 'outline'}
            size="sm"
            className="h-8 rounded-full px-2 sm:px-2.5"
            onClick={toggleCompare}
            aria-label={compare ? c.showOne : c.compareTwo}
          >
            {compare ? <RectangleHorizontal /> : <Columns2 />}
            {compare ? c.oneYear : c.compare}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{compare ? c.showOne : c.compareTwo}</TooltipContent>
      </Tooltip>
      {compare && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 rounded-full px-2 sm:px-2.5"
              onClick={toggleHorizontal}
              aria-label={state.horizontal ? c.verticalDivider : c.horizontalDivider}
            >
              <SeparatorVertical className={cn('transition-transform duration-300', !state.horizontal && 'rotate-90')} />
              <span className="hidden sm:inline">{state.horizontal ? c.vertical : c.horizontal}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{state.horizontal ? c.verticalDivider : c.horizontalDivider}</TooltipContent>
        </Tooltip>
      )}
    </nav>
  );
}
