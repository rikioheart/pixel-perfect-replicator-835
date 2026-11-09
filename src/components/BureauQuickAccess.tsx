import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, QrCode, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PASS_ACCESS_KEY, fetchPassAccess } from "@/components/PassAccessPanel";
import { validatorSource } from "@/lib/pass-access";
import { AG_QUORUM, agTally, type AgAttendanceStatus } from "@/lib/statutes";
import { Progress } from "@/components/ui/progress";

/** Deux gestes de terrain mis en avant sur la Console : valider un pass, émarger l'AG (quorum calculé). */
export function BureauQuickAccess() {
  const access = useQuery({ queryKey: PASS_ACCESS_KEY, queryFn: fetchPassAccess });
  const source = access.data ? validatorSource(access.data) : null;

  const ag = useQuery({
    queryKey: ["console-ag-quorum"],
    queryFn: async () => {
      const { data: rec, error } = await supabase
        .from("governance_records")
        .select("id, title")
        .eq("kind", "AG")
        .order("meeting_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!rec) return null;
      const { data: rows, error: e2 } = await supabase.from("ag_attendance").select("member_id, status").eq("record_id", rec.id);
      if (e2) throw e2;
      return { title: rec.title, tally: agTally((rows ?? []) as { member_id: string; status: AgAttendanceStatus }[], new Set()) };
    },
  });

  const passTo = source === "PRO" ? "/espace-pro" : "/loyalty";
  const passHint =
    source === null
      ? "Activez d'abord votre statut de valideur (règles à accepter)."
      : "Scanner le QR, saisir le code court ou chercher un nom.";
  const counted = ag.data?.tally.counted ?? 0;

  const tile =
    "panel flex min-h-24 items-center gap-4 p-4 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <section aria-label="Accès rapides terrain et Assemblée générale" className="mb-6 grid gap-3 md:grid-cols-2">
      <Link to={passTo} className={tile}>
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <QrCode className="size-6" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-lg">{source === null ? "Activer la validation du pass" : "Valider un pass"}</span>
          <span className="block text-sm text-muted-foreground">{passHint}</span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      </Link>

      <Link to="/admin/gouvernance" hash="emargement" className={tile}>
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <UserCheck className="size-6" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 space-y-1">
          <span className="block font-display text-lg">Émargement de l'AG</span>
          {ag.isError ? (
            <span className="block text-sm text-destructive">Émargement indisponible.</span>
          ) : ag.data === null ? (
            <span className="block text-sm text-muted-foreground">Créez l'AG dans le registre pour ouvrir la feuille.</span>
          ) : (
            <>
              <span className="block truncate text-sm text-muted-foreground">
                {ag.data?.title ?? "…"} · {ag.data?.tally.quorum ? "quorum atteint" : `quorum ${counted}/${AG_QUORUM}`}
              </span>
              <Progress value={Math.min(100, (counted / AG_QUORUM) * 100)} aria-label={`Quorum : ${counted} sur ${AG_QUORUM}`} className="h-2" />
            </>
          )}
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </section>
  );
}
