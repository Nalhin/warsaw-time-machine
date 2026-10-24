import type L from 'leaflet';
import { ImageOff } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useMessages } from '@/components/LocaleProvider';
import { Button } from '@/components/ui/button';
import { yearDef, type Box, type YearKey } from '@/lib/years';

const MIN_OVERLAP = 0.1;

const area = ([[s, w], [n, e]]: Box) => Math.max(0, n - s) * Math.max(0, e - w);

const intersect = ([[s1, w1], [n1, e1]]: Box, [[s2, w2], [n2, e2]]: Box): Box => [
  [Math.max(s1, s2), Math.max(w1, w2)],
  [Math.min(n1, n2), Math.min(e1, e2)],
];

const overlap = (view: Box, cov: Box) => area(intersect(view, cov)) / Math.min(area(view), area(cov));

const toBox = (b: L.LatLngBounds): Box => [
  [b.getSouth(), b.getWest()],
  [b.getNorth(), b.getEast()],
];

export function CoverageNotice({ map, years }: { map: L.Map; years: YearKey[] }) {
  const t = useMessages();
  const key = years.join(',');
  const [missing, setMissing] = useState<YearKey[]>([]);

  useEffect(() => {
    const keys = key.split(',') as YearKey[];
    const check = () => {
      const view = toBox(map.getBounds());
      const next = keys.filter((k) => overlap(view, yearDef(k).coverage) < MIN_OVERLAP);
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
