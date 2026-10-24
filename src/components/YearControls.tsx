'use client';

import { ArrowLeftRight, Columns2, Square } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { MapState } from '@/lib/state';
import { YEARS, type YearKey } from '@/lib/years';

function YearToggle({ value, onChange, label }: { value: YearKey; onChange(v: YearKey): void; label: string }) {
  return (
    <ToggleGroup
      type="single"
      size="sm"
      spacing={0}
      value={value}
      onValueChange={(v) => v && onChange(v as YearKey)}
      aria-label={label}
      className="rounded-full"
    >
      {YEARS.map((y) => (
        <ToggleGroupItem
          key={y.key}
          value={y.key}
          title={y.long}
          className="h-8 rounded-full! px-2.5 font-semibold tabular-nums sm:px-3 text-muted-foreground data-[state=on]:bg-foreground data-[state=on]:text-background"
        >
          {y.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export function YearControls({
  state,
  setYear,
  setSide,
  swap,
  toggleCompare,
}: {
  state: MapState;
  setYear(y: YearKey): void;
  setSide(side: 0 | 1, y: YearKey): void;
  swap(): void;
  toggleCompare(): void;
}) {
  const compare = state.swipe;
  return (
    <nav
      aria-label="Map years"
      className="glass fixed inset-x-2.5 bottom-[calc(28px+env(safe-area-inset-bottom))] z-[1000] mx-auto flex w-fit max-w-[calc(100%-20px)] items-center gap-1 rounded-full p-1 sm:top-3 sm:bottom-auto"
    >
      {compare ? (
        <>
          <YearToggle value={compare[0]} onChange={(y) => setSide(0, y)} label="Left side" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="rounded-full" onClick={swap} aria-label="Swap sides">
                <ArrowLeftRight />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Swap sides (S)</TooltipContent>
          </Tooltip>
          <YearToggle value={compare[1]} onChange={(y) => setSide(1, y)} label="Right side" />
        </>
      ) : (
        <YearToggle value={state.year} onChange={setYear} label="Year" />
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
        <TooltipContent>{compare ? 'Show one year' : 'Compare two years'} (C)</TooltipContent>
      </Tooltip>
    </nav>
  );
}
