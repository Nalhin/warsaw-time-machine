import { ChevronsLeftRight, Maximize2 } from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/lib/utils';

/**
 * Before/after photo slider. With a mouse the divider follows the pointer (no dragging needed).
 * On touch, or with the keyboard, a transparent range input over the image does the work.
 */
export function CompareSlider({
  before,
  after,
  beforeLabel,
  afterLabel,
  alt,
  onExpand,
  className,
}: {
  before: string;
  after: string;
  beforeLabel: string;
  afterLabel: string;
  alt: string;
  onExpand?: () => void;
  className?: string;
}) {
  const [pos, setPos] = useState(50);

  return (
    <div
      // keeps the mobile drawer from treating a slider drag as a sheet drag
      data-vaul-no-drag
      className={cn('relative aspect-[4/3] overflow-hidden rounded-xl bg-neutral-800 select-none', className)}
      style={{ ['--pos' as string]: `${pos}%` }}
      onPointerMove={(e) => {
        if (e.pointerType !== 'mouse') return;
        const r = e.currentTarget.getBoundingClientRect();
        setPos(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)));
      }}
    >
      <img src={after} alt={`${alt}: ${afterLabel}`} draggable={false} className="absolute inset-0 size-full object-cover" />
      <div className="absolute inset-0 [clip-path:inset(0_calc(100%-var(--pos))_0_0)]">
        <img src={before} alt={`${alt}: ${beforeLabel}`} draggable={false} className="absolute inset-0 size-full object-cover" />
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-[var(--pos)] -ml-px w-0.5 bg-white shadow-[0_0_10px_rgba(0,0,0,.5)]">
        <span className="absolute top-1/2 left-1/2 grid size-9 -translate-1/2 place-items-center rounded-full bg-white text-neutral-900 shadow-lg">
          <ChevronsLeftRight className="size-4" />
        </span>
      </div>
      <span className="photo-tag left-2.5">{beforeLabel}</span>
      <span className="photo-tag right-2.5">{afterLabel}</span>
      <input
        type="range"
        min={0}
        max={100}
        step={0.5}
        value={pos}
        onChange={(e) => setPos(+e.target.value)}
        aria-label={`Compare ${beforeLabel} with ${afterLabel}`}
        className="peer absolute inset-0 size-full cursor-ew-resize touch-pan-y opacity-0"
      />
      {onExpand && (
        <button
          type="button"
          onClick={onExpand}
          aria-label="Full screen"
          title="Full screen"
          className="absolute top-2.5 right-2.5 grid size-8 place-items-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80"
        >
          <Maximize2 className="size-4" />
        </button>
      )}
    </div>
  );
}
