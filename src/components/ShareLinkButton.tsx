import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Link2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export type ShareEntity = "project" | "event" | "document";

function newToken() {
  return crypto.randomUUID().replace(/-/g, "") + Math.random().toString(36).slice(2, 8);
}

/**
 * Crée un lien de consultation publique (sans compte) vers un projet, un
 * événement ou un document : utile pour un partenaire ou une mairie.
 */
export function ShareLinkButton({
  entityType,
  entityId,
  defaultLabel,
}: {
  entityType: ShareEntity;
  entityId: string;
  defaultLabel?: string;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState("30");
  const queryKey = ["public-shares", entityType, entityId];

  const { data: shares = [] } = useQuery({
    queryKey,
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public_shares")
        .select("*")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .eq("revoked", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const create = useMutation({
    mutationFn: async () => {
      const token = newToken();
      const parsed = Number(days);
      const expires =
        Number.isFinite(parsed) && parsed > 0
          ? new Date(Date.now() + parsed * 86400000).toISOString()
          : null;
      const { error } = await supabase.from("public_shares").insert({
        token,
        entity_type: entityType,
        entity_id: entityId,
        label: defaultLabel ?? null,
        expires_at: expires,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
      await navigator.clipboard?.writeText(`${origin}/partage/${token}`).catch(() => {});
      return token;
    },
    onSuccess: () => {
      toast.success("Lien de partage créé et copié.");
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("public_shares").update({ revoked: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lien désactivé.");
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Link2 className="size-4" /> Partager
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Partager vers l'extérieur</DialogTitle>
          <DialogDescription>
            Le lien donne une page de consultation en lecture seule, sans compte ni données
            personnelles.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="share-days">Validité (en jours, 0 = sans limite)</Label>
            <Input
              id="share-days"
              inputMode="numeric"
              value={days}
              onChange={(e) => setDays(e.target.value)}
            />
          </div>
          <Button onClick={() => create.mutate()} disabled={create.isPending} className="w-full">
            Créer un lien de consultation
          </Button>

          {shares.length ? (
            <ul className="space-y-2">
              {shares.map((share) => (
                <li
                  key={share.id}
                  className="flex items-center gap-2 rounded-md border border-border p-2 text-xs"
                >
                  <span className="min-w-0 flex-1 truncate">{`${origin}/partage/${share.token}`}</span>
                  <span className="text-muted-foreground">{share.view_count} vues</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Copier le lien"
                    className="size-7"
                    onClick={() => {
                      void navigator.clipboard?.writeText(`${origin}/partage/${share.token}`);
                      toast.success("Lien copié.");
                    }}
                  >
                    <Copy className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Désactiver le lien"
                    className="size-7"
                    onClick={() => revoke.mutate(share.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
