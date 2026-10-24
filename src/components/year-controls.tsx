'use client';

import { ArrowLeftRight, Check, ChevronDown, ChevronLeft, ChevronRight, Columns2, Pause, Play, RectangleHorizontal, SeparatorVertical } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';

import { useMessages } from '@/components/locale-provider';
import { MENU_ITEM_CLASS, MenuContent } from '@/components/toolbar';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { MapState, Side } from '@/lib/state';
import { cn } from '@/lib/utils';
import { stepYear, YEARS, type YearKey } from '@/lib/years';

interface YearPickerProps {
  value: YearKey;
  onChange(value: YearKey): void;
  label: string;
}

function YearStepper({ value, onChange, label }: YearPickerProps) {
  const t = useMessages();
  const c = t.controls;
  const prev = stepYear(value, -1);
  const next = stepYear(value, 1);
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

interface YearSelectProps extends YearPickerProps {
  className?: string;
  isModal?: boolean;
}

export function YearSelect({ value, onChange, label, className, isModal = false }: YearSelectProps) {
  const t = useMessages();
  return (
    <DropdownMenu.Root modal={isModal}>
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
      <MenuContent
        label={label}
        className="max-h-[min(70vh,var(--radix-dropdown-menu-content-available-height))] min-w-48 overflow-y-auto overscroll-contain"
      >
        <DropdownMenu.RadioGroup value={value} onValueChange={(v) => onChange(v as YearKey)}>
          {YEARS.map((y) => (
            <DropdownMenu.RadioItem key={y.key} value={y.key} className={cn(MENU_ITEM_CLASS, 'data-[state=checked]:text-gold')}>
              <span className="w-16 font-semibold tabular-nums">{t.years[y.key].label}</span>
              <span className="flex-1 text-xs text-muted-foreground">{t.years[y.key].era}</span>
              <DropdownMenu.ItemIndicator>
                <Check className="size-4" />
              </DropdownMenu.ItemIndicator>
            </DropdownMenu.RadioItem>
          ))}
        </DropdownMenu.RadioGroup>
      </MenuContent>
    </DropdownMenu.Root>
  );
}

interface YearControlsProps {
  state: MapState;
  setYear(year: YearKey): void;
  setSide(side: Side, year: YearKey): void;
  swap(): void;
  toggleCompare(): void;
  toggleHorizontal(): void;
  isPlaying: boolean;
  togglePlay(): void;
}

export function YearControls({
  state,
  setYear,
  setSide,
  swap,
  toggleCompare,
  toggleHorizontal,
  isPlaying,
  togglePlay,
}: YearControlsProps) {
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
            className={cn('rounded-full', isPlaying && 'text-gold')}
            onClick={togglePlay}
            aria-label={isPlaying ? c.pause : c.play}
            aria-pressed={isPlaying}
          >
            {isPlaying ? <Pause className="fill-current" /> : <Play className="fill-current" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{isPlaying ? c.pause : c.play}</TooltipContent>
      </Tooltip>
      {compare ? (
        <>
          <YearSelect value={compare[0]} onChange={(y) => setSide(0, y)} label={state.isHorizontal ? c.topSide : c.leftSide} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="rounded-full" onClick={swap} aria-label={c.swapSides}>
                <ArrowLeftRight />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{c.swapSides}</TooltipContent>
          </Tooltip>
          <YearSelect value={compare[1]} onChange={(y) => setSide(1, y)} label={state.isHorizontal ? c.bottomSide : c.rightSide} />
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
              aria-label={state.isHorizontal ? c.verticalDivider : c.horizontalDivider}
            >
              <SeparatorVertical className={cn('transition-transform duration-300', !state.isHorizontal && 'rotate-90')} />
              <span className="hidden sm:inline">{state.isHorizontal ? c.vertical : c.horizontal}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{state.isHorizontal ? c.verticalDivider : c.horizontalDivider}</TooltipContent>
        </Tooltip>
      )}
    </nav>
  );
}
