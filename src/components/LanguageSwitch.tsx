'use client';

import { Check } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { DropdownMenu } from 'radix-ui';

import { useLocale, useMessages } from '@/components/LocaleProvider';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { LOCALES, localePath, stripLocale } from '@/lib/i18n';
import { MESSAGES } from '@/lib/messages';

export function LanguageSwitch() {
  const locale = useLocale();
  const t = useMessages();
  const path = stripLocale(usePathname() ?? '/');

  return (
    <DropdownMenu.Root modal={false}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenu.Trigger asChild>
            <Button
              variant="outline"
              size="icon-lg"
              className="glass-strong rounded-xl text-xs font-semibold data-[state=open]:bg-muted"
              aria-label={`${t.language}: ${t.languageName}`}
            >
              {locale.toUpperCase()}
            </Button>
          </DropdownMenu.Trigger>
        </TooltipTrigger>
        <TooltipContent side="left">{t.language}</TooltipContent>
      </Tooltip>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="left"
          align="start"
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
