import type L from 'leaflet';
import { ImageOff } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useMessages } from '@/components/locale-provider';
import { Button } from '@/components/ui/button';
import { coverageOverlap, intersect, MIN_OVERLAP, yearDef, type Box, type YearKey } from '@/lib/years';

function toBox(b: L.LatLngBounds): Box {
  return [
    [b.getSouth(), b.getWest()],
    [b.getNorth(), b.getEast()],
  ];
}

interface CoverageNoticeProps {
  map: L.Map;
  years: YearKey[];
}

export function CoverageNotice({ map, years }: CoverageNoticeProps) {
  const t = useMessages();
  const key = years.join(',');
  const [missing, setMissing] = useState<YearKey[]>([]);

  useEffect(() => {
    const keys = key.split(',') as YearKey[];
    const check = () => {
      const view = toBox(map.getBounds());
      const next = keys.filter((k) => coverageOverlap(view, yearDef(k).coverage) < MIN_OVERLAP);
      setMissing((prev) => (prev.join(',') === next.join(',') ? prev : next));
    };
    check();
    map.on('moveend', check);
    return () => {
      map.off('moveend', check);
    };
  }, [map, key]);

  if (!missing.length) return null;

  const goToCoverage = () => {
    const target = key
      .split(',')
      .map((k) => yearDef(k as YearKey).coverage)
      .reduce(intersect);
    map.flyToBounds(target, { padding: [24, 24], duration: 0.8 });
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="glass-strong fixed top-[30%] left-1/2 z-[950] flex -translate-x-1/2 animate-in items-center gap-3 rounded-full py-1.5 pr-1.5 pl-4 text-[13px] whitespace-nowrap text-foreground/90 duration-300 fade-in slide-in-from-top-2"
    >
      <ImageOff className="size-4 shrink-0 text-gold" />
      <span>{t.map.noCoverage(missing)}</span>
      <Button size="sm" className="rounded-full" onClick={goToCoverage}>
        {t.map.backToCoverage}
      </Button>
    </div>
  );
}
