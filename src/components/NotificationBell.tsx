import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, CheckCheck, PawPrint } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useNotifications, type AppNotification } from "@/hooks/useNotifications";

function formatWhen(iso: string) {
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const openNotification = async (notification: AppNotification) => {
    if (!notification.is_read) await markRead(notification.id);
    setOpen(false);
    if (notification.link_url) {
      void navigate({ to: notification.link_url });
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="relative gap-2" aria-label="Notifications">
          <Bell className="size-4" />
          <span className="hidden sm:inline">Alertes</span>
          {unreadCount > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Notifications</SheetTitle>
          <SheetDescription>
            {unreadCount > 0
              ? `${unreadCount} alerte${unreadCount > 1 ? "s" : ""} non lue${unreadCount > 1 ? "s" : ""}`
              : "Tout est à jour."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex justify-end px-4 pb-2">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            disabled={unreadCount === 0}
            onClick={() => void markAllRead()}
          >
            <CheckCheck className="size-4" /> Tout marquer comme lu
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-2 px-4 pb-6">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground">
                <PawPrint className="size-8 opacity-40" />
                Aucune notification pour le moment.
              </div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => void openNotification(notification)}
                  className={cn(
                    "w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted",
                    notification.is_read ? "border-border bg-card" : "border-primary/40 bg-primary/5",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{notification.title}</p>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {formatWhen(notification.created_at)}
                    </span>
                  </div>
                  {notification.message ? (
                    <p className="mt-1 text-sm text-muted-foreground">{notification.message}</p>
                  ) : null}
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
