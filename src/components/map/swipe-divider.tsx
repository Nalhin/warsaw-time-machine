import type L from 'leaflet';
import { ChevronsLeftRight, ChevronsUpDown } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent } from 'react';

import { useMessages } from '@/components/locale-provider';
import { cn } from '@/lib/utils';

const YEAR_TAG_CLASS =
  'absolute top-[calc(108px+env(safe-area-inset-top))] rounded-full border border-border bg-[rgb(17_18_20/0.8)] px-2.5 py-0.5 text-[13px] font-semibold whitespace-nowrap tabular-nums';

function clipRect(x0: number, y0: number, x1: number, y1: number) {
  return `polygon(${x0}px ${y0}px, ${x1}px ${y0}px, ${x1}px ${y1}px, ${x0}px ${y1}px)`;
}

interface SwipeDividerProps {
  map: L.Map;
  ratio: number;
  onRatio(ratio: number): void;
  isHorizontal: boolean;
  leftLabel: string;
  rightLabel: string;
  showHint: boolean;
  onDragStart(): void;
}

export function SwipeDivider({
  map,
  ratio,
  onRatio,
  isHorizontal,
  leftLabel,
  rightLabel,
  showHint,
  onDragStart,
}: SwipeDividerProps) {
  const t = useMessages();
  const [pos, setPos] = useState(() => {
    const size = map.getSize();
    return (isHorizontal ? size.y : size.x) * ratio;
  });
  const [isDragging, setIsDragging] = useState(false);
  const ratioRef = useRef(ratio);
  ratioRef.current = ratio;

  useEffect(() => {
    const left = map.getPane('yearLeft')!;
    const right = map.getPane('yearRight')!;
    const update = () => {
      const size = map.getSize();
      const px = Math.round((isHorizontal ? size.y : size.x) * ratioRef.current);
      setPos(px);
      const nw = map.containerPointToLayerPoint([0, 0]);
      const se = map.containerPointToLayerPoint(size);
      if (isHorizontal) {
        const mid = nw.y + px;
        left.style.clipPath = clipRect(nw.x, nw.y, se.x, mid);
        right.style.clipPath = clipRect(nw.x, mid, se.x, se.y);
      } else {
        const mid = nw.x + px;
        left.style.clipPath = clipRect(nw.x, nw.y, mid, se.y);
        right.style.clipPath = clipRect(mid, nw.y, se.x, se.y);
      }
    };
    update();
    map.on('move zoomend viewreset resize', update);
    return () => {
      map.off('move zoomend viewreset resize', update);
      left.style.clipPath = '';
      right.style.clipPath = '';
    };
  }, [map, ratio, isHorizontal]);

  const fromEvent = (e: RPointerEvent) => {
    const rect = map.getContainer().getBoundingClientRect();
    const r = isHorizontal ? (e.clientY - rect.top) / rect.height : (e.clientX - rect.left) / rect.width;
    onRatio(Math.min(1, Math.max(0, r)));
  };
  const handlers = {
    onPointerDown: (e: RPointerEvent<HTMLElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDragging(true);
      onDragStart();
      fromEvent(e);
    },
    onPointerMove: (e: RPointerEvent) => isDragging && fromEvent(e),
    onPointerUp: () => setIsDragging(false),
    onPointerCancel: () => setIsDragging(false),
  };

  const [back, forward] = isHorizontal ? ['ArrowUp', 'ArrowDown'] : ['ArrowLeft', 'ArrowRight'];
  const onKeyDown = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 0.1 : 0.02;
    if (e.key === back) onRatio(Math.max(0, ratio - step));
    else if (e.key === forward) onRatio(Math.min(1, ratio + step));
    else if (e.key === 'Home') onRatio(0);
    else if (e.key === 'End') onRatio(1);
    else return;
    e.preventDefault();
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-[800]" style={{ ['--pos' as string]: `${pos}px` }}>
      <div
        className={cn(
          'pointer-events-auto absolute touch-none',
          isHorizontal
            ? 'inset-x-0 top-[var(--pos)] -mt-3 h-6 cursor-ns-resize'
            : 'inset-y-0 left-[var(--pos)] -ml-3 w-6 cursor-ew-resize',
        )}
        {...handlers}
      >
        <div
          className={cn(
            'absolute bg-white shadow-[0_0_0_1px_rgba(0,0,0,.25),0_0_12px_rgba(0,0,0,.4)]',
            isHorizontal ? 'inset-x-0 top-[11px] h-0.5' : 'inset-y-0 left-[11px] w-0.5',
          )}
        />
      </div>

      <button
        type="button"
        role="slider"
        aria-label={t.map.divider}
        aria-orientation={isHorizontal ? 'vertical' : 'horizontal'}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(ratio * 100)}
        title={t.map.dragToCompare}
        className={cn(
          'pointer-events-auto absolute -mt-[22px] -ml-[22px] grid size-11 touch-none place-items-center rounded-full bg-white text-neutral-900 shadow-lg ring-1 ring-black/10 transition-transform',
          isHorizontal ? 'top-[var(--pos)] left-1/2 cursor-ns-resize' : 'top-1/2 left-[var(--pos)] cursor-ew-resize',
          isDragging && 'scale-110',
        )}
        onKeyDown={onKeyDown}
        {...handlers}
      >
        {isHorizontal ? <ChevronsUpDown className="size-5" /> : <ChevronsLeftRight className="size-5" />}
      </button>

      {showHint && (
        <span
          className={cn(
            'absolute mt-8 -translate-x-1/2 animate-pulse rounded-full bg-white px-3 py-1 text-xs font-semibold whitespace-nowrap text-neutral-900 shadow-lg',
            isHorizontal ? 'top-[var(--pos)] left-1/2' : 'top-1/2 left-[var(--pos)]',
          )}
        >
          {t.map.dragToCompare}
        </span>
      )}

      {isHorizontal ? (
        <>
          <span className={cn(YEAR_TAG_CLASS, 'top-auto bottom-[calc(100%-var(--pos)+14px)] left-3.5')}>{leftLabel}</span>
          <span className={cn(YEAR_TAG_CLASS, 'top-[calc(var(--pos)+14px)] left-3.5')}>{rightLabel}</span>
        </>
      ) : (
        <>
          <span className={cn(YEAR_TAG_CLASS, 'right-[calc(100%-var(--pos)+14px)] xl:top-[calc(160px+env(safe-area-inset-top))]')}>{leftLabel}</span>
          <span className={cn(YEAR_TAG_CLASS, 'left-[calc(var(--pos)+14px)] xl:top-[calc(160px+env(safe-area-inset-top))]')}>{rightLabel}</span>
        </>
      )}
    </div>
  );
}
