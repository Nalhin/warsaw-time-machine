'use client';

import { useMessages } from '@/components/LocaleProvider';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { AUTHOR, GITHUB_URL, SITE_NAME } from '@/lib/site';

function GithubLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.08 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

function XLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function AboutDialog() {
  const t = useMessages();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          title={t.about.trigger}
          className="glass fixed top-[calc(12px+env(safe-area-inset-top))] left-3 z-[1000] flex h-11 items-center rounded-full px-4 text-sm font-semibold"
        >
          <span className="whitespace-nowrap">{t.about.label}</span>
        </button>
      </DialogTrigger>
      <DialogContent aria-describedby={undefined} className="max-h-[calc(100dvh-48px)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{SITE_NAME}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 text-sm leading-relaxed text-foreground/85 [&_a]:text-gold [&_a]:underline-offset-2 hover:[&_a]:underline">
          {t.about.story.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          <Separator className="my-1" />
          <ul className="grid gap-1 text-muted-foreground">
            <li>
              {t.about.aerial}{' '}
              <a href="https://mapa.um.warszawa.pl" target="_blank" rel="noopener">
                {t.about.city}
              </a>
            </li>
            <li>{t.about.photos}</li>
          </ul>
        </div>

        <DialogFooter className="grid gap-3 sm:grid-cols-2 sm:justify-normal">
          <Button size="lg" className="h-11 text-base" asChild>
            <a href={AUTHOR.x} target="_blank" rel="noopener me">
              <XLogo className="size-4" />
              {t.about.followX}
            </a>
          </Button>
          <Button size="lg" variant="outline" className="h-11 text-base" asChild>
            <a href={GITHUB_URL} target="_blank" rel="noopener">
              <GithubLogo className="size-4" />
              {t.about.contribute}
            </a>
          </Button>
          <p className="text-center text-xs text-muted-foreground sm:col-span-2">
            {t.about.madeBy}{' '}
            <a href={AUTHOR.website} target="_blank" rel="noopener me" className="text-gold underline-offset-2 hover:underline">
              {AUTHOR.name}
            </a>
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
