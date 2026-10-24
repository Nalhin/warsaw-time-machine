'use client';

import { Check, ChevronDown, Languages } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { DropdownMenu } from 'radix-ui';

import { useLocale, useMessages } from '@/components/LocaleProvider';
import { PANEL_WIDTH } from '@/components/PlacePanel';
import { LOCALES, localePath, stripLocale } from '@/lib/i18n';
import { MESSAGES } from '@/lib/messages';
import { cn } from '@/lib/utils';

export function LanguageSwitch({ shifted }: { shifted: boolean }) {
  const locale = useLocale();
  const t = useMessages();
  const path = stripLocale(usePathname() ?? '/');

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={`${t.language}: ${t.languageName}`}
          style={{ ['--pw' as string]: `${PANEL_WIDTH}px` }}
          className={cn(
            'glass fixed top-[calc(12px+env(safe-area-inset-top))] right-3 z-[1000] flex h-11 items-center gap-1.5 rounded-full pr-2.5 pl-3.5 text-sm font-semibold transition-[right] duration-300 data-[state=open]:bg-muted',
            shifted && 'sm:right-[calc(var(--pw)+38px)]',
          )}
        >
          <Languages className="size-4 opacity-80" />
          {locale.toUpperCase()}
          <ChevronDown className="size-3.5 opacity-60" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          collisionPadding={10}
          className="glass-strong z-[1200] min-w-40 rounded-xl p-1 text-sm text-foreground duration-150 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <DropdownMenu.Label className="px-2.5 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">
            {t.language}
          </DropdownMenu.Label>
          {LOCALES.map((l) => (
            <DropdownMenu.Item key={l} asChild>
              <a
                href={localePath(l, path)}
                hrefLang={l}
                lang={l}
                aria-current={l === locale ? 'true' : undefined}
                onClick={(e) => {
                  if (l === locale) return void e.preventDefault();
                  e.currentTarget.search = location.search;
                }}
                className="flex cursor-pointer items-center gap-3 rounded-lg py-1.5 pr-2 pl-2.5 outline-none select-none data-[highlighted]:bg-muted"
              >
                <span className="w-6 text-xs font-semibold text-muted-foreground">{l.toUpperCase()}</span>
                <span className="flex-1">{MESSAGES[l].languageName}</span>
                {l === locale && <Check className="size-4" />}
              </a>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
