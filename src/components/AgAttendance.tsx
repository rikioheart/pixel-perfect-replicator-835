import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Printer, Search, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { memberFullName } from "@/lib/members";
import { filterByName } from "@/lib/name-search";
import { formatParisDateTime } from "@/lib/places";
import { AG_QUORUM, agTally, type AgAttendanceStatus } from "@/lib/statutes";

const STATUS_LABEL: Record<AgAttendanceStatus, string> = {
  PRESENT: "Présent",
  REPRESENTED: "Représenté",
  EXCUSED: "Excusé",
};

type Row = { member_id: string; status: AgAttendanceStatus; proxy_holder_id: string | null };

/** Émargement nominatif d'une AG du registre : présents, représentés (mandataire présent), excusés. Bureau seul (RLS). */
export function AgAttendance() {
  const qc = useQueryClient();
  const [recordId, setRecordId] = useState<string>("");
  const [search, setSearch] = useState("");
  // Feuille repliée par défaut pour alléger la page ; ouverte d'office depuis le raccourci de la Console.
  const [sheetOpen, setSheetOpen] = useState(false);
  useEffect(() => {
    if (window.location.hash === "#emargement") setSheetOpen(true);
  }, []);

  const { data: ags = [] } = useQuery({
    queryKey: ["ag-records"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("governance_records")
        .select("id, title, meeting_at, meeting_date")
        .eq("kind", "AG")
        .order("meeting_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const current = recordId || ags[0]?.id || "";

  const { data: members = [] } = useQuery({
    queryKey: ["ag-members"],
    queryFn: async () => {
      const [profiles, roles, fns] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, display_name, first_name, last_name")
          .eq("membership_status", "ACTIVE")
          .is("deleted_at", null),
        supabase.from("user_roles").select("user_id, roles(code)"),
        supabase
          .from("member_functions")
          .select("user_id, function_type")
          .eq("active", true)
          .eq("function_type", "FOUNDER"),
      ]);
      if (profiles.error) throw profiles.error;
      const bureau = new Set(
        (roles.data ?? [])
          .filter((r) => (r.roles as { code?: string } | null)?.code === "ADMIN_BUREAU")
          .map((r) => r.user_id),
      );
      const founders = new Set([
        ...(roles.data ?? [])
          .filter((r) => (r.roles as { code?: string } | null)?.code === "MEMBRE_FONDATEUR")
          .map((r) => r.user_id),
        ...(fns.data ?? []).map((f) => f.user_id),
      ]);
      return (profiles.data ?? [])
        .map((p) => ({
          id: p.id,
          name: memberFullName(p),
          bureau: bureau.has(p.id),
          founder: founders.has(p.id),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "fr"));
    },
  });

  const { data: rows = [] } = useQuery({
    queryKey: ["ag-attendance", current],
    enabled: Boolean(current),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ag_attendance")
        .select("member_id, status, proxy_holder_id")
        .eq("record_id", current);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const refresh = () => void qc.invalidateQueries({ queryKey: ["ag-attendance", current] });
  const set = useMutation({
    mutationFn: async (input: {
      memberId: string;
      status: AgAttendanceStatus | null;
      proxy?: string | null;
    }) => {
      if (input.status === null) {
        const { error } = await supabase
          .from("ag_attendance")
          .delete()
          .eq("record_id", current)
          .eq("member_id", input.memberId);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("ag_attendance").upsert(
        {
          record_id: current,
          member_id: input.memberId,
          status: input.status,
          proxy_holder_id: input.proxy ?? null,
        },
        { onConflict: "record_id,member_id" },
      );
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const byMember = useMemo(() => new Map(rows.map((r) => [r.member_id, r])), [rows]);
  const core = useMemo(
    () => new Set(members.filter((m) => m.bureau || m.founder).map((m) => m.id)),
    [members],
  );
  const tally = agTally(rows, core);
  const presents = members.filter((m) => byMember.get(m.id)?.status === "PRESENT");
  const shown = filterByName(members, search);
  const nameOf = (id: string | null) => members.find((m) => m.id === id)?.name ?? "—";
  const selectedAg = ags.find((a) => a.id === current);

  return (
    <section id="emargement" aria-labelledby="ag-att-title" className="mb-6 scroll-mt-20 space-y-3 print:mt-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="ag-att-title" className="flex items-center gap-2 font-display text-lg">
          <UserCheck className="size-5 text-primary" aria-hidden /> Émargement de l'Assemblée
          générale
        </h2>
        {current ? (
          <Button
            size="sm"
            variant="outline"
            className="print:hidden"
            onClick={() => {
              setSheetOpen(true);
              window.setTimeout(() => window.print(), 50);
            }}
          >
            <Printer className="mr-1 size-4" aria-hidden /> Imprimer la feuille
          </Button>
        ) : null}
      </div>

      {ags.length === 0 ? (
        <p className="panel p-4 text-sm text-muted-foreground">
          Créez d'abord l'AG dans le registre ci-dessous (type « Assemblée générale ») pour ouvrir
          son émargement.
        </p>
      ) : (
        <>
          <div className="panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center print:hidden">
            <select
              aria-label="Assemblée générale"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm sm:w-72"
              value={current}
              onChange={(e) => setRecordId(e.target.value)}
            >
              {ags.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un adhérent"
                aria-label="Rechercher un adhérent"
                className="pl-9"
              />
            </div>
          </div>

          <div className="panel flex flex-wrap items-center gap-3 p-4 text-sm" role="status">
            {selectedAg ? (
              <span className="font-medium">
                {selectedAg.title} ·{" "}
                {formatParisDateTime(selectedAg.meeting_at ?? selectedAg.meeting_date)}
              </span>
            ) : null}
            <span>{tally.present} présent(s)</span>
            <span>{tally.represented} représenté(s)</span>
            <span>{tally.excused} excusé(s)</span>
            <span className="text-muted-foreground">
              dont {tally.core} membre(s) du Bureau ou fondateur(s)
            </span>
            <Badge
              className={
                tally.quorum
                  ? "ml-auto"
                  : "ml-auto border-transparent bg-warning text-warning-foreground hover:bg-warning"
              }
            >
              {tally.quorum ? "Quorum atteint" : `Quorum : ${tally.counted}/${AG_QUORUM}`}
            </Badge>
            <Progress
              value={Math.min(100, (tally.counted / AG_QUORUM) * 100)}
              aria-label={`Quorum : ${tally.counted} présent(s) ou représenté(s) sur ${AG_QUORUM} requis`}
              className="h-2 w-full"
            />
            <p className="w-full text-xs text-muted-foreground">
              Calcul automatique : présents + représentés, les excusés ne comptent pas (quorum statutaire : {AG_QUORUM}).
            </p>
          </div>

          <Button
            variant="outline"
            className="w-full justify-center print:hidden"
            aria-expanded={sheetOpen}
            onClick={() => setSheetOpen((v) => !v)}
          >
            {sheetOpen ? "Replier la feuille d'émargement" : `Ouvrir la feuille d'émargement (${members.length} adhérent(s))`}
          </Button>
          {sheetOpen ? (
          <>

          <div className="panel overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="p-3 font-medium">Adhérent</th>
                  <th className="p-3 font-medium">Émargement</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((m) => {
                  const r = byMember.get(m.id);
                  return (
                    <tr key={m.id} className="border-b border-border/60 last:border-0">
                      <td className="p-3 align-top">
                        <span className="font-medium">{m.name}</span>
                        <span className="ml-2 inline-flex gap-1">
                          {m.bureau ? <Badge variant="secondary">Bureau</Badge> : null}
                          {m.founder ? <Badge variant="outline">Fondateur</Badge> : null}
                        </span>
                        {r?.status === "REPRESENTED" ? (
                          <p className="text-xs text-muted-foreground">
                            Pouvoir donné à {nameOf(r.proxy_holder_id)}
                          </p>
                        ) : null}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap items-center gap-1 print:hidden">
                          {(["PRESENT", "EXCUSED"] as const).map((s) => (
                            <Button
                              key={s}
                              size="sm"
                              variant={r?.status === s ? "default" : "outline"}
                              className="h-8 px-2 text-xs"
                              aria-pressed={r?.status === s}
                              disabled={set.isPending}
                              onClick={() =>
                                set.mutate({ memberId: m.id, status: r?.status === s ? null : s })
                              }
                            >
                              {STATUS_LABEL[s]}
                            </Button>
                          ))}
                          <select
                            aria-label={`Pouvoir de ${m.name}`}
                            className={`h-8 rounded-md border border-input px-2 text-xs ${r?.status === "REPRESENTED" ? "bg-primary text-primary-foreground" : "bg-background"}`}
                            value={r?.status === "REPRESENTED" ? (r.proxy_holder_id ?? "") : ""}
                            disabled={set.isPending}
                            onChange={(e) =>
                              set.mutate(
                                e.target.value
                                  ? { memberId: m.id, status: "REPRESENTED", proxy: e.target.value }
                                  : { memberId: m.id, status: null },
                              )
                            }
                          >
                            <option value="">Représenté par…</option>
                            {presents
                              .filter((p) => p.id !== m.id)
                              .map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                          </select>
                        </div>
                        <span className="hidden text-xs print:inline">
                          {r ? STATUS_LABEL[r.status] : "Absent"}
                          {r?.status === "PRESENT" ? " · signature : ________________" : ""}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {shown.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Aucun adhérent ne correspond.</p>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground print:hidden">
            Seuls les adhérents à l'adhésion active sont listés. Un pouvoir se donne à une personne
            déjà émargée présente ; si elle repart, ses pouvoirs sont retirés. Chaque émargement est
            inscrit dans l'historique.
          </p>
          </>
          ) : null}
        </>
      )}
    </section>
  );
}
