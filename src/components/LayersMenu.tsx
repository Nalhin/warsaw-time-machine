'use client';

import { Check, Layers, MapPin, Type } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';

import { useMessages } from '@/components/LocaleProvider';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function LayersMenu({
  labels,
  onLabels,
  pins,
  onPins,
}: {
  labels: boolean;
  onLabels(v: boolean): void;
  pins: boolean;
  onPins(v: boolean): void;
}) {
  const t = useMessages();
  const items = [
    { icon: Type, label: t.map.streetNames, checked: labels, onChange: onLabels },
    { icon: MapPin, label: t.map.places, checked: pins, onChange: onPins },
  ];

  return (
    <DropdownMenu.Root modal={false}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenu.Trigger asChild>
            <Button
              variant="outline"
              size="icon-lg"
              className="glass-strong rounded-xl data-[state=open]:bg-muted"
              aria-label={t.map.layers}
            >
              <Layers />
            </Button>
          </DropdownMenu.Trigger>
        </TooltipTrigger>
        <TooltipContent side="left">{t.map.layers}</TooltipContent>
      </Tooltip>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="left"
          align="start"
          sideOffset={8}
          collisionPadding={10}
          className="glass-strong z-[1200] min-w-48 rounded-xl p-1 text-sm text-foreground duration-150 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <DropdownMenu.Label className="px-2.5 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">
            {t.map.layers}
          </DropdownMenu.Label>
          {items.map(({ icon: Icon, label, checked, onChange }) => (
            <DropdownMenu.CheckboxItem
              key={label}
              checked={checked}
              onCheckedChange={onChange}
              onSelect={(e) => e.preventDefault()}
              className="flex cursor-pointer items-center gap-3 rounded-lg py-1.5 pr-2 pl-2.5 outline-none select-none data-[highlighted]:bg-muted"
            >
              <Icon className="size-4 text-muted-foreground" />
              <span className="flex-1">{label}</span>
              <DropdownMenu.ItemIndicator>
                <Check className="size-4" />
              </DropdownMenu.ItemIndicator>
            </DropdownMenu.CheckboxItem>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
