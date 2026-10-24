'use client';

import { ArrowLeftRight, Check, ChevronDown, Columns2, Pause, Play, RectangleHorizontal, SeparatorVertical } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';

import { useMessages } from '@/components/LocaleProvider';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { MapState } from '@/lib/state';
import { cn } from '@/lib/utils';
import { YEARS, type YearKey } from '@/lib/years';

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
  const t = useMessages();
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
          title={t.years[y.key].long}
          className="h-8 rounded-full! px-2 font-semibold tabular-nums sm:px-3 text-muted-foreground data-[state=on]:bg-foreground data-[state=on]:text-background"
        >
          {t.years[y.key].label}
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
                <span className="w-11 font-semibold tabular-nums">{t.years[y.key].label}</span>
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
      className="glass fixed inset-x-2.5 bottom-[calc(28px+env(safe-area-inset-bottom))] z-[1000] mx-auto flex w-fit max-w-[calc(100%-20px)] items-center gap-1 rounded-full p-1 sm:top-3 sm:bottom-auto"
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
        <>
          <YearToggle value={state.year} onChange={setYear} label={c.year} className="hidden md:flex" />
          <YearSelect value={state.year} onChange={setYear} label={c.year} className="md:hidden" />
        </>
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
