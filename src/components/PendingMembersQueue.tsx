import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/domain";
import { useSensitiveRights } from "@/lib/permissions";
import { membershipDecisionMessage, type MembershipDecisionResult } from "@/lib/membership-decision";

/**
 * File unique des adhésions en attente. La décision passe par decide_membership :
 * droit members.validate vérifié en base, transition PENDING -> ACTIVE/REFUSED verrouillée, acteur et date journalisés.
 */
export function PendingMembersQueue() {
  const qc = useQueryClient();
  const rights = useSensitiveRights();
  const { data = [], isError } = useQuery({
    queryKey: ["pending-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, first_name, last_name, membership_type, created_at")
        .eq("membership_status", "PENDING")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
  const validate = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "ACTIVE" | "REFUSED" }) => {
      const { data, error } = await supabase.rpc("decide_membership", { _profile_id: id, _decision: status });
      const result = membershipDecisionMessage(error?.message ?? null, (data ?? null) as MembershipDecisionResult | null, status);
      if (!result.ok) throw new Error(result.message);
      return result.message;
    },
    onSuccess: (message) => {
      toast.success(message);
      void qc.invalidateQueries({ queryKey: ["pending-members"] });
      void qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      void qc.invalidateQueries({ queryKey: ["pending-members"] });
    },
  });

  return (
    <section className="panel space-y-3 p-4" aria-labelledby="pending-members-title">
      <div className="flex items-center justify-between gap-2">
        <h2 id="pending-members-title" className="flex items-center gap-2 font-display text-lg">
          <UserCheck className="size-4" aria-hidden /> Adhésions à valider
        </h2>
        <Badge variant={data.length ? "default" : "secondary"}>{isError ? "—" : data.length}</Badge>
      </div>
      {isError ? (
        <p className="text-sm text-destructive">Demandes indisponibles pour le moment. Réessayez plus tard.</p>
      ) : data.length === 0 ? (
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
                {rights.validateMembers ? (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => validate.mutate({ id: m.id, status: "ACTIVE" })} disabled={validate.isPending}>Valider l'adhésion</Button>
                    <Button size="sm" variant="outline" disabled={validate.isPending}
                      onClick={() => { if (window.confirm(`Refuser la demande de ${name} ?`)) validate.mutate({ id: m.id, status: "REFUSED" }); }}>
                      Refuser
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">Droit « valider les adhésions » requis</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">Chaque décision est enregistrée dans le journal d'activité et la personne est prévenue. Pour demander des compléments, ouvrez la fiche et contactez la personne. Pour un professionnel, vérifiez aussi sa carte dans « Fiches professionnelles ». Un paiement HelloAsso n'active jamais un compte seul.</p>
    </section>
  );
}
