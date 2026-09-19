import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/domain";
import {
  MEMBERSHIP_STATUS_LABEL,
  MEMBERSHIP_TYPE_LABEL,
  memberFullName,
} from "@/lib/members";
import { useAuth } from "@/hooks/useAuth";
import { BureauOnly } from "@/components/BureauOnly";

export const Route = createFileRoute("/_authenticated/members/")({
  head: () => ({
    meta: [
      { title: "Adhérents — La Voix du Chien" },
      {
        name: "description",
        content:
          "Annuaire CRM des adhérents de La Voix du Chien : recherche, statut d'adhésion, type de membre et territoire.",
      },
      { property: "og:title", content: "Adhérents — La Voix du Chien" },
      {
        property: "og:description",
        content: "Recherchez et suivez les adhérents, professionnels et bénévoles de l'association.",
      },
    ],
  }),
  component: MembersPage,
});

function MembersPage() {
  const { isBureau, loading: authLoading } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");

  const { data: members, isLoading } = useQuery({
    queryKey: ["members"],
    queryFn: async () =>
      (
        await supabase
          .from("profiles")
          .select("*")
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (members ?? []).filter((member) => {
      if (statusFilter !== "ALL" && member.membership_status !== statusFilter) return false;
      if (typeFilter !== "ALL" && member.membership_type !== typeFilter) return false;
      if (!needle) return true;
      return [
        memberFullName(member),
        member.email,
        member.city,
        member.department,
        member.phone,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [members, search, statusFilter, typeFilter]);

  if (!authLoading && !isBureau) return <BureauOnly title="Adhérents" />;

  return (
    <AppShell
      title="Adhérents"
      subtitle="Le CRM des membres, professionnels et bénévoles de l'association"
      actions={
        <Button asChild size="sm">
          <Link to="/members/new">Nouvel adhérent</Link>
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-64 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Rechercher un nom, e-mail, ville, département…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous les statuts</SelectItem>
              {Object.entries(MEMBERSHIP_STATUS_LABEL).map(([code, label]) => (
                <SelectItem key={code} value={code}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous les types</SelectItem>
              {Object.entries(MEMBERSHIP_TYPE_LABEL).map(([code, label]) => (
                <SelectItem key={code} value={code}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <p className="text-sm text-muted-foreground">
          {isLoading ? "Chargement…" : `${filtered.length} adhérent(s) affiché(s)`}
        </p>

        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Territoire</th>
                <th className="px-4 py-3">Adhésion</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((member) => (
                <tr key={member.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3 font-medium">{memberFullName(member)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{member.email ?? "—"}</td>
                  <td className="px-4 py-3">
                    {MEMBERSHIP_TYPE_LABEL[member.membership_type] ?? member.membership_type}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={member.membership_status === "ACTIVE" ? "default" : "secondary"}
                    >
                      {MEMBERSHIP_STATUS_LABEL[member.membership_status] ??
                        member.membership_status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {[member.city, member.department].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(member.membership_date ?? member.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link to="/members/$memberId" params={{ memberId: member.id }}>
                        Fiche
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
              {!isLoading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    Aucun adhérent ne correspond à cette recherche.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
