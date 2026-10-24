import type { Metadata } from 'next';
import Link from 'next/link';

import { AppShell } from '@/components/app-shell';
import { MESSAGES } from '@/lib/messages';
import { SITE_NAME } from '@/lib/site';

export { viewport } from '@/components/app-shell';

export const metadata: Metadata = { title: `${MESSAGES.en.spot.notFound} | ${SITE_NAME}` };

export default function NotFound() {
  return (
    <AppShell locale="en">
      <div className="sheet fixed top-1/2 left-1/2 z-[1200] -translate-1/2 rounded-[3px] px-6 py-5 text-center">
        <h1 className="font-heading text-xl font-semibold tracking-tight">{MESSAGES.en.spot.notFound}</h1>
        <p lang="pl" className="mt-1 text-sm text-muted-foreground">
          {MESSAGES.pl.spot.notFound}
        </p>
        <p className="mt-3 flex justify-center gap-4 text-sm">
          <Link href="/" className="text-gold underline underline-offset-2">
            {MESSAGES.en.spot.backToMap}
          </Link>
          <Link href="/pl" hrefLang="pl" lang="pl" className="text-gold underline underline-offset-2">
            {MESSAGES.pl.spot.backToMap}
          </Link>
        </p>
      </div>
    </AppShell>
  );
}
