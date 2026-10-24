'use client';

import { Check } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { DropdownMenu } from 'radix-ui';

import { useLocale, useMessages } from '@/components/locale-provider';
import { MENU_ITEM_CLASS, MenuContent, ToolButton } from '@/components/toolbar';
import { LOCALES, localePath, stripLocale } from '@/lib/i18n';
import { MESSAGES } from '@/lib/messages';

export function LanguageSwitch() {
  const locale = useLocale();
  const t = useMessages();
  const path = stripLocale(usePathname() ?? '/');

  return (
    <DropdownMenu.Root modal={false}>
      <ToolButton isMenuTrigger label={t.language} aria-label={`${t.language}: ${t.languageName}`} className="text-xs font-semibold">
        {locale.toUpperCase()}
      </ToolButton>
      <MenuContent label={t.language} side="left" align="start" className="min-w-40">
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
              className={MENU_ITEM_CLASS}
            >
              <span className="w-6 text-xs font-semibold text-muted-foreground">{l.toUpperCase()}</span>
              <span className="flex-1">{MESSAGES[l].languageName}</span>
              {l === locale && <Check className="size-4" />}
            </a>
          </DropdownMenu.Item>
        ))}
      </MenuContent>
    </DropdownMenu.Root>
  );
}
