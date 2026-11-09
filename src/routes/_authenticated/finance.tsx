import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { REIMBURSEMENT_LABEL, allowedReimbursementActions, balancesByMember, euro, financeErrorMessage, summarizeReimbursements } from "@/lib/finance-status";
import { useSensitiveRights } from "@/lib/permissions";
import { PROFILE_COLUMNS } from "@/lib/profile-columns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Receipt } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BureauConsoleTabs } from "@/components/BureauConsoleTabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const TITLE = "Remboursements & Notes de frais";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({
    meta: [
      { title: `${TITLE} — La Voix du Chien` },
      { name: "description", content: "Traitement par le Bureau des dépenses engagées par les membres et bénévoles : notes de frais, validation et paiement." },
      { property: "og:title", content: `${TITLE} — La Voix du Chien` },
      { property: "og:description", content: "Notes de frais des membres et bénévoles : à décider, à payer, payées." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FinancePage,
});

/** Circuit « reimbursements » uniquement : la comptabilité générale est dans Comptabilité & Grand livre. */
function FinancePage() {
  const { user } = useAuth();
  const rights = useSensitiveRights();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const allowed = rights.viewGlobal || rights.validateReimbursements || rights.markPaid;
  useEffect(() => {
    if (rights.ready && !allowed) {
      toast.info("Vos demandes et paiements sont dans « Paiements & remboursements ».");
      void navigate({ to: "/reimbursements", replace: true });
    }
  }, [rights.ready, allowed, navigate]);

  const { data: reimbursements = [], isError: reimbError } = useQuery({
    queryKey: ["reimbursements", "all"],
    enabled: allowed,
    queryFn: async () => {
      const { data, error } = await supabase.from("reimbursements").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const personIds = [...new Set(reimbursements.map((r) => r.person_id))];
  const { data: names = {} } = useQuery({
    queryKey: ["finance-names", personIds.join(",")],
    enabled: allowed && personIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select(PROFILE_COLUMNS).in("id", personIds);
      if (error) throw error;
      const out: Record<string, string> = {};
      for (const p of (data ?? []) as unknown as { id: string; first_name?: string | null; last_name?: string | null }[]) out[p.id] = [p.first_name, p.last_name].filter(Boolean).join(" ") || "Membre";
      return out;
    },
  });
  const nameOf = (id: string | null) => (id ? names[id] ?? "Membre" : "—");
  const balances = balancesByMember(reimbursements);

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("reimbursements").update({ status }).eq("id", id);
      if (error) throw new Error(financeErrorMessage(error.message));
    },
    onSuccess: () => {
      toast.success("Demande mise à jour.");
      void queryClient.invalidateQueries({ queryKey: ["reimbursements"] });
    },
    onError: (error: Error) => { toast.error(error.message); void queryClient.invalidateQueries({ queryKey: ["reimbursements"] }); },
  });

  const rsum = summarizeReimbursements(reimbursements);
  if (!rights.ready || !allowed) return <AppShell title={TITLE}><p className="text-sm text-muted-foreground">{rights.ready ? "Redirection vers votre espace personnel…" : "Vérification de vos droits…"}</p></AppShell>;

  return (
    <AppShell title={TITLE} subtitle="Dépenses avancées par les membres et bénévoles pour l'association : décider, payer, suivre.">
      <BureauConsoleTabs />
      <div className="grid gap-3 sm:grid-cols-3">
        {[["À décider", rsum.pending], ["Approuvé, à payer", rsum.approved], ["Payé", rsum.paid]].map(([l, v]) => (
          <div key={l as string} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{l}</p>
            <p className="text-xl font-semibold">{reimbError ? "—" : euro(v as number)}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Les membres déposent leurs notes de frais depuis « Paiements ». Une fois payée, inscrivez la dépense au grand livre (catégorie « Notes de frais remboursées ») pour qu'elle figure au bilan.</p>

      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base"><Receipt className="size-4" aria-hidden /> Notes de frais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {reimbError ? (
            <p className="text-destructive">Notes de frais indisponibles (chargement ou droits).</p>
          ) : reimbursements.length === 0 ? (
            <p className="text-muted-foreground">Aucune demande enregistrée.</p>
          ) : (
            reimbursements.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-2 last:border-0">
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.label} <span className="font-normal text-muted-foreground">· {nameOf(item.person_id)}</span></p>
                  <p className="text-xs text-muted-foreground">
                    {euro(Number(item.amount))} · {new Date(item.created_at).toLocaleDateString("fr-FR")}
                    {item.receipt_url ? <> · <a className="underline" href={item.receipt_url} target="_blank" rel="noreferrer">justificatif</a></> : null}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  <Badge variant={item.status === "PAID" ? "default" : "outline"}>{REIMBURSEMENT_LABEL[item.status] ?? item.status}</Badge>
                  {item.person_id === user?.id ? <span className="text-xs text-muted-foreground">Votre demande : traitée par un autre membre</span> : null}
                  {allowedReimbursementActions(item.status, user?.id, item.person_id, { validate: rights.validateReimbursements, markPaid: rights.markPaid }).map((next) => (
                    <Button key={next} size="sm" variant={next === "REJECTED" ? "ghost" : "outline"} disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: item.id, status: next })}>
                      {next === "APPROVED" ? "Approuver" : next === "PAID" ? "Marquer payé" : "Refuser"}
                    </Button>
                  ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader className="pb-2"><CardTitle className="text-base">Solde par membre</CardTitle></CardHeader>
        <CardContent className="text-sm">
          {reimbError ? <p className="text-destructive">Soldes indisponibles.</p> : balances.length === 0 ? <p className="text-muted-foreground">Aucun solde en cours.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-xs text-muted-foreground"><tr><th className="py-1 pr-3 font-normal">Membre</th><th className="py-1 pr-3 font-normal">À décider</th><th className="py-1 pr-3 font-normal">Reste à payer</th><th className="py-1 font-normal">Payé</th></tr></thead>
                <tbody>{balances.map((b) => (
                  <tr key={b.personId} className="border-t border-border">
                    <td className="py-2 pr-3 font-medium">{nameOf(b.personId)}</td>
                    <td className="py-2 pr-3">{euro(b.pending)}</td>
                    <td className="py-2 pr-3 font-semibold">{euro(b.toPay)}</td>
                    <td className="py-2">{euro(b.paid)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
