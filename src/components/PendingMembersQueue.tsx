import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/domain";

/** File des adhésions en attente : validation explicite par le Bureau (la base refuse les autres). */
export function PendingMembersQueue() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["pending-members"],
    queryFn: async () =>
      (
        await supabase
          .from("profiles")
          .select("id, display_name, first_name, last_name, membership_type, created_at")
          .eq("membership_status", "PENDING")
          .order("created_at", { ascending: true })
      ).data ?? [],
  });
  const validate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("profiles").update({ membership_status: "ACTIVE" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Adhésion validée.");
      void qc.invalidateQueries({ queryKey: ["pending-members"] });
      void qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="panel space-y-3 p-4" aria-labelledby="pending-members-title">
      <div className="flex items-center justify-between gap-2">
        <h2 id="pending-members-title" className="flex items-center gap-2 font-display text-lg">
          <UserCheck className="size-4" aria-hidden /> Adhésions à valider
        </h2>
        <Badge variant={data.length ? "default" : "secondary"}>{data.length}</Badge>
      </div>
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune demande en attente. Merci pour l'accueil des nouveaux membres.</p>
      ) : (
        <ul className="divide-y divide-border">
          {data.map((m) => {
            const name = m.display_name || [m.first_name, m.last_name].filter(Boolean).join(" ") || "Nouveau compte";
            return (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div>
                  <Link to="/members/$memberId" params={{ memberId: m.id }} className="font-medium hover:underline">{name}</Link>
                  <p className="text-xs text-muted-foreground">
                    {m.membership_type === "PROFESSIONNEL" ? "Professionnel" : "Particulier"} · demande du {formatDate(m.created_at)}
                  </p>
                </div>
                <Button size="sm" onClick={() => validate.mutate(m.id)} disabled={validate.isPending}>Valider l'adhésion</Button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">Pour un professionnel, vérifiez aussi sa carte dans « Professionnels ». Un paiement HelloAsso n'active jamais un compte seul.</p>
    </section>
  );
}
