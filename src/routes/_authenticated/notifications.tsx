import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BellRing, CheckCheck, ExternalLink, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NOTIFICATION_TYPES, notificationLabel } from "@/lib/notification-types";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — La Voix du Chien" },
      {
        name: "description",
        content:
          "Toutes vos notifications internes : validations de tâches, retours du Bureau et informations de l'association.",
      },
      { property: "og:title", content: "Notifications — La Voix du Chien" },
      {
        property: "og:description",
        content: "Historique complet de vos notifications internes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications-page", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("in_app_notifications")
        .select("*")
        .eq("recipient_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["notifications-page"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const markAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("in_app_notifications")
        .update({ is_read: true })
        .eq("recipient_id", user!.id)
        .eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Toutes les notifications sont lues.");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleRead = useMutation({
    mutationFn: async ({ id, isRead }: { id: string; isRead: boolean }) => {
      const { error } = await supabase
        .from("in_app_notifications")
        .update({ is_read: isRead })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("in_app_notifications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const unread = notifications.filter((n) => !n.is_read).length;

  return (
    <AppShell
      title="Notifications"
      subtitle={`${unread} non lue${unread > 1 ? "s" : ""}`}
      actions={
        <Button size="sm" variant="outline" className="gap-2" onClick={() => markAll.mutate()} disabled={!unread}>
          <CheckCheck className="size-4" /> Tout marquer comme lu
        </Button>
      }
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : notifications.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune notification.</p>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <Card key={notification.id} className={cn(!notification.is_read && "border-primary/50")}>
              <CardContent className="flex items-start gap-3 p-4 text-sm">
                <BellRing
                  className={cn("mt-0.5 size-4", notification.is_read ? "text-muted-foreground" : "text-primary")}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{notification.title}</p>
                    <Badge variant="outline">{notification.kind}</Badge>
                  </div>
                  {notification.message ? (
                    <p className="text-muted-foreground">{notification.message}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(notification.created_at).toLocaleString("fr-FR", {
                      dateStyle: "long",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      toggleRead.mutate({ id: notification.id, isRead: !notification.is_read })
                    }
                  >
                    {notification.is_read ? "Non lu" : "Lu"}
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => remove.mutate(notification.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
