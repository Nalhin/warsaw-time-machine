'use client';

import { Check, Layers, MapPin, Type } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';

import { useMessages } from '@/components/locale-provider';
import { MENU_ITEM_CLASS, MenuContent, ToolButton } from '@/components/toolbar';

interface LayersMenuProps {
  showLabels: boolean;
  onShowLabelsChange(value: boolean): void;
  showPins: boolean;
  onShowPinsChange(value: boolean): void;
}

export function LayersMenu({ showLabels, onShowLabelsChange, showPins, onShowPinsChange }: LayersMenuProps) {
  const t = useMessages();
  const items = [
    { icon: Type, label: t.map.streetNames, isChecked: showLabels, onChange: onShowLabelsChange },
    { icon: MapPin, label: t.map.places, isChecked: showPins, onChange: onShowPinsChange },
  ];

  return (
    <DropdownMenu.Root modal={false}>
      <ToolButton isMenuTrigger label={t.map.layers}>
        <Layers />
      </ToolButton>
      <MenuContent label={t.map.layers} side="left" align="start" className="min-w-48">
        {items.map(({ icon: Icon, label, isChecked, onChange }) => (
          <DropdownMenu.CheckboxItem
            key={label}
            checked={isChecked}
            onCheckedChange={onChange}
            onSelect={(e) => e.preventDefault()}
            className={MENU_ITEM_CLASS}
          >
            <Icon className="size-4 text-muted-foreground" />
            <span className="flex-1">{label}</span>
            <DropdownMenu.ItemIndicator>
              <Check className="size-4" />
            </DropdownMenu.ItemIndicator>
          </DropdownMenu.CheckboxItem>
        ))}
      </MenuContent>
    </DropdownMenu.Root>
  );
}
