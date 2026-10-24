'use client';

import { DropdownMenu } from 'radix-ui';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export const MENU_ITEM_CLASS =
  'flex cursor-pointer items-center gap-3 rounded-lg py-1.5 pr-2 pl-2.5 outline-none select-none data-[highlighted]:bg-muted';

interface ToolButtonProps extends React.ComponentProps<typeof Button> {
  label: string;
  isMenuTrigger?: boolean;
}

export function ToolButton({ label, isMenuTrigger = false, className, ...props }: ToolButtonProps) {
  const button = (
    <Button
      variant="outline"
      size="icon-lg"
      aria-label={label}
      className={cn('glass-strong rounded-xl data-[state=open]:bg-muted', className)}
      {...props}
    />
  );
  return (
    <Tooltip>
      <TooltipTrigger asChild>{isMenuTrigger ? <DropdownMenu.Trigger asChild>{button}</DropdownMenu.Trigger> : button}</TooltipTrigger>
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
  );
}

interface MenuContentProps extends React.ComponentProps<typeof DropdownMenu.Content> {
  label: string;
}

export function MenuContent({ label, className, children, ...props }: MenuContentProps) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        sideOffset={8}
        collisionPadding={10}
        className={cn(
          'glass-strong z-[1200] rounded-xl p-1 text-sm text-foreground duration-150 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          className,
        )}
        {...props}
      >
        <DropdownMenu.Label className="px-2.5 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">{label}</DropdownMenu.Label>
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}
