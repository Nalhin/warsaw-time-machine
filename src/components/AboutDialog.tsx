'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Kbd } from '@/components/ui/kbd';

export function AboutDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          title="About this map"
          className="glass fixed top-[calc(12px+env(safe-area-inset-top))] left-3 z-[1000] flex items-center gap-2.5 rounded-full py-1.5 pr-1.5 pl-1.5 sm:pr-4"
        >
          <span className="grid size-[30px] place-items-center rounded-full bg-gold font-heading text-[17px] font-semibold text-gold-foreground">
            W
          </span>
          <span className="hidden font-heading text-base font-semibold whitespace-nowrap sm:inline">
            Warsaw <span className="font-medium text-muted-foreground">1935 · 1945 · today</span>
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-48px)] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">Warsaw 1935 · 1945 · today</DialogTitle>
          <DialogDescription>
            Three aerial photos of the same city: a photomap from 1935, an aerial survey from 1945 taken after the
            wartime destruction, and a recent one.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm leading-relaxed text-foreground/85 [&_a]:text-gold [&_a]:underline-offset-2 [&_h3]:mt-5 [&_h3]:mb-1.5 [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:tracking-[0.1em] [&_h3]:text-muted-foreground [&_h3]:uppercase">
          <p>
            Drag the white divider to compare two years. Pick the year for each side in the bar. Each pin marks a place
            where we have a pre-war photograph. It opens the original, an AI-restored version, and a photo of the same
            spot today.
          </p>
          <p className="rounded-xl border border-ai/25 bg-ai/10 px-3.5 py-3">
            <strong>About the AI versions:</strong> each one is always a real archival photo. Real-ESRGAN increases its
            resolution and DDColor adds colour. <em>The colours are the model's guess, not historical fact.</em> No
            historical scenes are generated from scratch.
          </p>
          <h3>Shortcuts</h3>
          <ul className="space-y-1.5">
            <li>
              <Kbd>1</Kbd> <Kbd>2</Kbd> <Kbd>3</Kbd> show 1935 / 1945 / today (the right side in compare mode)
            </li>
            <li>
              <Kbd>Shift</Kbd> + <Kbd>1</Kbd> <Kbd>2</Kbd> <Kbd>3</Kbd> set the left side
            </li>
            <li>
              <Kbd>C</Kbd> toggle compare · <Kbd>S</Kbd> swap sides · <Kbd>[</Kbd> <Kbd>]</Kbd> move the divider
            </li>
          </ul>
          <h3>Sources</h3>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Aerial photos:{' '}
              <a href="https://mapa.um.warszawa.pl" target="_blank" rel="noopener">
                City of Warsaw
              </a>{' '}
              (1935 photomap, 1945 and 2025 orthophotos)
            </li>
            <li>Photographs: Wikimedia Commons and archives. The author, licence and link are given under each photo.</li>
            <li>Street names: © OpenStreetMap, © CARTO</li>
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
