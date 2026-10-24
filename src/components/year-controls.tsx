'use client';

import {
  ArrowLeftRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns2,
  History,
  Pause,
  Play,
  RectangleHorizontal,
  SeparatorVertical,
  type LucideIcon,
} from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { useEffect, useRef } from 'react';

import { useMessages } from '@/components/locale-provider';
import { MENU_ITEM_CLASS, MenuContent } from '@/components/toolbar';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PLAYBACK_SPEEDS, VIEW_MODES, type MapState, type PlaybackSpeed, type Side, type ViewMode } from '@/lib/state';
import { cn } from '@/lib/utils';
import { stepYear, YEAR_KEYS, YEARS, type YearKey } from '@/lib/years';

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

const MODE_ICONS: Record<ViewMode, LucideIcon> = {
  compare: Columns2,
  year: RectangleHorizontal,
  timelapse: History,
};

function Divider() {
  return <span aria-hidden className="mx-0.5 h-6 w-px shrink-0 bg-border" />;
}

interface ModeSwitchProps {
  value: ViewMode;
  onChange(mode: ViewMode): void;
}

function ModeSwitch({ value, onChange }: ModeSwitchProps) {
  const c = useMessages().controls;
  return (
    <ToggleGroup
      type="single"
      spacing={1}
      value={value}
      onValueChange={(v) => v && onChange(v as ViewMode)}
      aria-label={c.mode}
      className="glass rounded-full p-1"
    >
      {VIEW_MODES.map((mode) => {
        const Icon = MODE_ICONS[mode];
        return (
          <Tooltip key={mode}>
            <TooltipTrigger asChild>
              <ToggleGroupItem
                value={mode}
                aria-label={c.modeHints[mode]}
                className="h-8 gap-1.5 rounded-full px-3 text-[0.8rem] aria-checked:bg-foreground aria-checked:text-background [&_svg:not([class*='size-'])]:size-3.5"
              >
                <Icon />
                {c.modes[mode]}
              </ToggleGroupItem>
            </TooltipTrigger>
            <TooltipContent>{c.modeHints[mode]}</TooltipContent>
          </Tooltip>
        );
      })}
    </ToggleGroup>
  );
}

interface CompareControlsProps {
  state: MapState;
  setSide(side: Side, year: YearKey): void;
  swap(): void;
  toggleHorizontal(): void;
}

function CompareControls({ state, setSide, swap, toggleHorizontal }: CompareControlsProps) {
  const c = useMessages().controls;
  const [left, right] = state.swipe;
  return (
    <>
      <YearSelect value={left} onChange={(y) => setSide(0, y)} label={state.isHorizontal ? c.topSide : c.leftSide} />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" className="rounded-full" onClick={swap} aria-label={c.swapSides}>
            <ArrowLeftRight />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{c.swapSides}</TooltipContent>
      </Tooltip>
      <YearSelect value={right} onChange={(y) => setSide(1, y)} label={state.isHorizontal ? c.bottomSide : c.rightSide} />
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
    </>
  );
}

interface TimelapseControlsProps {
  year: YearKey;
  setYear(year: YearKey): void;
  isPlaying: boolean;
  togglePlay(): void;
  speed: PlaybackSpeed;
  setSpeed(speed: PlaybackSpeed): void;
}

function TimelapseControls({ year, setYear, isPlaying, togglePlay, speed, setSpeed }: TimelapseControlsProps) {
  const t = useMessages();
  const c = t.controls;
  const strip = useRef<HTMLDivElement>(null);
  const prev = stepYear(year, -1);
  const next = stepYear(year, 1);
  const nextSpeed = PLAYBACK_SPEEDS[(PLAYBACK_SPEEDS.indexOf(speed) + 1) % PLAYBACK_SPEEDS.length];

  useEffect(() => {
    const el = strip.current;
    const active = el?.querySelector<HTMLElement>('[aria-current]');
    if (!el || !active) return;
    el.scrollTo({ left: active.offsetLeft - (el.clientWidth - active.offsetWidth) / 2, behavior: 'smooth' });
  }, [year]);

  const stepButton = (target: YearKey | undefined, label: string, Icon: LucideIcon) => (
    <Button
      variant="ghost"
      size="icon-sm"
      className="hidden rounded-full sm:inline-flex"
      disabled={!target}
      onClick={() => target && setYear(target)}
      aria-label={target ? `${label}: ${t.years[target].long}` : label}
    >
      <Icon />
    </Button>
  );

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn('shrink-0 rounded-full', isPlaying && 'text-gold')}
            onClick={togglePlay}
            aria-label={isPlaying ? c.pause : c.play}
            aria-pressed={isPlaying}
          >
            {isPlaying ? <Pause className="fill-current" /> : <Play className="fill-current" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{isPlaying ? c.pause : c.play}</TooltipContent>
      </Tooltip>
      <div className="flex min-w-0 flex-1 items-center">
        {stepButton(prev, c.previousYear, ChevronLeft)}
        <div
          ref={strip}
          role="group"
          aria-label={c.year}
          className="relative flex min-w-0 flex-1 gap-0.5 overflow-x-auto overscroll-x-contain [mask-image:linear-gradient(to_right,transparent,#000_20px,#000_calc(100%-20px),transparent)] px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {YEAR_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              aria-current={key === year ? 'true' : undefined}
              aria-label={t.years[key].long}
              onClick={() => setYear(key)}
              className={cn(
                'h-8 shrink-0 rounded-full px-3 text-sm whitespace-nowrap text-muted-foreground tabular-nums transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60',
                key === year && 'bg-gold font-semibold text-gold-foreground hover:text-gold-foreground',
              )}
            >
              {t.years[key].label}
            </button>
          ))}
        </div>
        {stepButton(next, c.nextYear, ChevronRight)}
      </div>
      <Divider />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 rounded-full px-2.5 text-gold tabular-nums"
            onClick={() => setSpeed(nextSpeed)}
            aria-label={`${c.speed}: ${speed}×`}
          >
            {speed}×
          </Button>
        </TooltipTrigger>
        <TooltipContent>{c.speed}</TooltipContent>
      </Tooltip>
    </>
  );
}

interface YearControlsProps {
  state: MapState;
  setMode(mode: ViewMode): void;
  setYear(year: YearKey): void;
  setSide(side: Side, year: YearKey): void;
  swap(): void;
  toggleHorizontal(): void;
  isPlaying: boolean;
  togglePlay(): void;
  speed: PlaybackSpeed;
  setSpeed(speed: PlaybackSpeed): void;
}

export function YearControls({ state, setMode, setYear, setSide, swap, toggleHorizontal, isPlaying, togglePlay, speed, setSpeed }: YearControlsProps) {
  const c = useMessages().controls;
  const isTimelapse = state.mode === 'timelapse';
  return (
    <nav
      aria-label={c.nav}
      className={cn(
        'fixed inset-x-2.5 bottom-[calc(28px+env(safe-area-inset-bottom))] z-[1000] mx-auto flex flex-col items-center gap-1.5 xl:top-3 xl:bottom-auto',
        isTimelapse ? 'max-w-3xl' : 'w-fit max-w-[calc(100%-20px)]',
      )}
    >
      <ModeSwitch value={state.mode} onChange={setMode} />
      <div className={cn('glass flex max-w-full items-center gap-1 rounded-full p-1', isTimelapse && 'w-full')}>
        {state.mode === 'compare' && (
          <CompareControls state={state} setSide={setSide} swap={swap} toggleHorizontal={toggleHorizontal} />
        )}
        {state.mode === 'year' && <YearStepper value={state.year} onChange={setYear} label={c.year} />}
        {isTimelapse && (
          <TimelapseControls
            year={state.year}
            setYear={setYear}
            isPlaying={isPlaying}
            togglePlay={togglePlay}
            speed={speed}
            setSpeed={setSpeed}
          />
        )}
      </div>
    </nav>
  );
}
