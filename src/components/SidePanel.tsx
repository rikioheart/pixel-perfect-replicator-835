import type { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/**
 * Panneau latéral générique (style Monday / ClickUp) :
 * s'ouvre sur le côté droit, garde la page visible derrière.
 */
export function SidePanel({
  open,
  onOpenChange,
  title,
  description,
  footer,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-lg"
      >
        <SheetHeader className="border-b border-border bg-card px-6 py-4 text-left">
          <SheetTitle>{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">{children}</div>
        {footer ? (
          <div className="flex justify-end gap-2 border-t border-border bg-card px-6 py-4">
            {footer}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
