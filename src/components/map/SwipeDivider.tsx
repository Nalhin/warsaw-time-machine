import type L from 'leaflet';
import { ChevronsLeftRight } from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';

import { cn } from '@/lib/utils';

/**
 * Draggable vertical divider for compare mode. The left year pane is clipped to the part left
 * of the divider and the right pane to the part right of it. Clip coordinates are in Leaflet layer
 * points, so they are recomputed whenever the map moves.
 */
export function SwipeDivider({
  map,
  ratio,
  onRatio,
  leftLabel,
  rightLabel,
  showHint,
  onDragStart,
}: {
  map: L.Map;
  ratio: number;
  onRatio(r: number): void;
  leftLabel: string;
  rightLabel: string;
  showHint: boolean;
  onDragStart(): void;
}) {
  const [x, setX] = useState(() => map.getSize().x * ratio);
  const [dragging, setDragging] = useState(false);
  const ratioRef = useRef(ratio);
  ratioRef.current = ratio;

  // Clip both panes; re-run on every map move.
  useEffect(() => {
    const left = map.getPane('yearLeft')!;
    const right = map.getPane('yearRight')!;
    const update = () => {
      const size = map.getSize();
      const px = Math.round(size.x * ratioRef.current);
      setX(px);
      const nw = map.containerPointToLayerPoint([0, 0]);
      const se = map.containerPointToLayerPoint(size);
      const mid = nw.x + px;
      const poly = (x0: number, x1: number) =>
        `polygon(${x0}px ${nw.y}px, ${x1}px ${nw.y}px, ${x1}px ${se.y}px, ${x0}px ${se.y}px)`;
      left.style.clipPath = poly(nw.x, mid);
      right.style.clipPath = poly(mid, se.x);
    };
    update();
    map.on('move zoomend viewreset resize', update);
    return () => {
      map.off('move zoomend viewreset resize', update);
      left.style.clipPath = '';
      right.style.clipPath = '';
    };
  }, [map, ratio]);

  const fromEvent = (e: RPointerEvent) => {
    const rect = map.getContainer().getBoundingClientRect();
    onRatio(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)));
  };
  const handlers = {
    onPointerDown: (e: RPointerEvent<HTMLElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(true);
      onDragStart();
      fromEvent(e);
    },
    onPointerMove: (e: RPointerEvent) => dragging && fromEvent(e),
    onPointerUp: () => setDragging(false),
    onPointerCancel: () => setDragging(false),
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-[800]" style={{ ['--x' as string]: `${x}px` }}>
      {/* wide invisible hit area around the line */}
      <div
        className="pointer-events-auto absolute inset-y-0 left-[var(--x)] -ml-3 w-6 cursor-ew-resize touch-none"
        {...handlers}
      >
        <div className="absolute inset-y-0 left-[11px] w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,.25),0_0_12px_rgba(0,0,0,.4)]" />
      </div>

      <button
        type="button"
        role="slider"
        aria-label="Compare divider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(ratio * 100)}
        title="Drag to compare · double-click to centre"
        className={cn(
          'pointer-events-auto absolute top-1/2 left-[var(--x)] -mt-[22px] -ml-[22px] grid size-11 cursor-ew-resize touch-none place-items-center rounded-full bg-white text-neutral-900 shadow-lg ring-1 ring-black/10 transition-transform',
          dragging && 'scale-110',
        )}
        onDoubleClick={() => onRatio(0.5)}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 0.1 : 0.02;
          if (e.key === 'ArrowLeft') onRatio(Math.max(0, ratio - step));
          else if (e.key === 'ArrowRight') onRatio(Math.min(1, ratio + step));
          else if (e.key === 'Home') onRatio(0);
          else if (e.key === 'End') onRatio(1);
          else return;
          e.preventDefault();
        }}
        {...handlers}
      >
        <ChevronsLeftRight className="size-5" />
      </button>

      {showHint && (
        <span className="absolute top-1/2 left-[var(--x)] mt-8 -translate-x-1/2 animate-pulse rounded-full bg-white px-3 py-1 text-xs font-semibold whitespace-nowrap text-neutral-900 shadow-lg">
          Drag to compare
        </span>
      )}

      <span className="year-tag right-[calc(100%-var(--x)+14px)]">{leftLabel}</span>
      <span className="year-tag left-[calc(var(--x)+14px)]">{rightLabel}</span>
    </div>
  );
}
