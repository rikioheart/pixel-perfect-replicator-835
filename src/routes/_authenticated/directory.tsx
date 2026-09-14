import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, MapPin, Briefcase, Mail } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/directory")({
  head: () => ({
    meta: [
      { title: "Annuaire des adhérents — La Voix du Chien" },
      {
        name: "description",
        content:
          "L'annuaire du réseau : adhérents, professionnels et partenaires, filtrables par catégorie et département.",
      },
      { property: "og:title", content: "Annuaire des adhérents — La Voix du Chien" },
      {
        property: "og:description",
        content: "Retrouvez les compétences du réseau par spécialité, ville et département.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DirectoryPage,
});

const CATEGORIES: [string, string][] = [
  ["ALL", "Tout le réseau"],
  ["PRO", "Professionnels"],
  ["PARTICULIER", "Particuliers"],
  ["PARTENAIRE", "Partenaires"],
];

function DirectoryPage() {
  const { isBureau } = useAuth();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [department, setDepartment] = useState("ALL");

  const { data, isLoading } = useQuery({
    queryKey: ["directory"],
    queryFn: async () => {
      const [profiles, pros] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id, display_name, first_name, last_name, email, city, department, bio, membership_type, membership_status, public_visibility",
          )
          .eq("membership_status", "ACTIVE")
          .order("display_name", { ascending: true }),
        supabase.from("pro_details").select("profile_id, company_name, professional_category, website_url"),
      ]);
      const proMap = new Map((pros.data ?? []).map((p) => [p.profile_id, p]));
      return (profiles.data ?? []).map((p) => ({
        ...p,
        pro: proMap.get(p.id) ?? null,
      }));
    },
  });

  const departments = useMemo(
    () => Array.from(new Set((data ?? []).map((p) => p.department).filter(Boolean))).sort() as string[],
    [data],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data ?? []).filter((person) => {
      if (!isBureau && !person.public_visibility) return false;
      const type = (person.membership_type ?? "").toUpperCase();
      if (category === "PRO" && !type.includes("PRO")) return false;
      if (category === "PARTENAIRE" && !type.includes("PARTENAIRE")) return false;
      if (category === "PARTICULIER" && (type.includes("PRO") || type.includes("PARTENAIRE"))) return false;
      if (department !== "ALL" && person.department !== department) return false;
      if (!term) return true;
      return `${person.display_name ?? ""} ${person.city ?? ""} ${person.pro?.company_name ?? ""} ${
        person.pro?.professional_category ?? ""
      } ${person.bio ?? ""}`
        .toLowerCase()
        .includes(term);
    });
  }, [data, search, category, department, isBureau]);

  return (
    <AppShell
      title="Annuaire du réseau"
      subtitle="Les personnes et les compétences de l'association, filtrables par catégorie et territoire."
      actions={
        isBureau ? (
          <Link to="/admin/import">
            <Button size="sm" variant="outline" className="rounded-full">
              Importer un fichier CSV
            </Button>
          </Link>
        ) : undefined
      }
    >
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs">Recherche</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nom, structure, spécialité, ville"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Catégorie</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Département</Label>
          <Select value={department} onValueChange={setDepartment}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous</SelectItem>
              {departments.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement de l'annuaire…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Aucun profil trouvé"
          message="Affinez votre recherche, ou invitez de nouveaux adhérents à rejoindre le réseau."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((person) => (
            <article key={person.id} className="rounded-xl border border-border bg-card p-5">
              <h2 className="font-display text-base font-bold">
                {person.display_name ?? `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim() ||
                  "Adhérent"}
              </h2>
              {person.pro?.company_name ? (
                <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Briefcase className="size-3.5" /> {person.pro.company_name}
                  {person.pro.professional_category ? ` · ${person.pro.professional_category}` : ""}
                </p>
              ) : null}
              {person.city || person.department ? (
                <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="size-3.5" /> {[person.city, person.department].filter(Boolean).join(" · ")}
                </p>
              ) : null}
              {person.bio ? <p className="mt-3 line-clamp-3 text-sm">{person.bio}</p> : null}
              <div className="mt-4 flex flex-wrap gap-2">
                {isBureau ? (
                  <Link to="/members/$memberId" params={{ memberId: person.id }}>
                    <Button size="sm" variant="outline" className="rounded-full">
                      Voir la fiche
                    </Button>
                  </Link>
                ) : null}
                {person.pro ? (
                  <Link to="/professionals/$proId" params={{ proId: person.id }}>
                    <Button size="sm" variant="outline" className="rounded-full">
                      Fiche pro
                    </Button>
                  </Link>
                ) : null}
                {isBureau && person.email ? (
                  <a href={`mailto:${person.email}`}>
                    <Button size="sm" variant="ghost" className="rounded-full">
                      <Mail className="mr-2 size-4" /> Contacter
                    </Button>
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </AppShell>
  );
}
