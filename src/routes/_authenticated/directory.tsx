import { DirectoryTabs } from "@/components/DirectoryTabs";
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
import { withContacts } from "@/lib/profile-columns";
import { useAuth } from "@/hooks/useAuth";
import { EntityPeek } from "@/components/EntityPeek";
import { DirectoryDogs } from "@/components/DirectoryDogs";

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
  validateSearch: (search: Record<string, unknown>): { vue?: "pros" | "chiens" } =>
    search["vue"] === "chiens" ? { vue: "chiens" } : search["vue"] === "pros" ? { vue: "pros" } : {},
  component: DirectoryPage,
});

function DirectoryPage() {
  const { isBureau } = useAuth();
  const [search, setSearch] = useState("");
  const { vue } = Route.useSearch();
  const category = vue === "chiens" ? "CHIENS" : vue === "pros" ? "PRO" : "PARTICULIER";
  const [department, setDepartment] = useState("ALL");

  const { data, isLoading } = useQuery({
    queryKey: ["directory"],
    queryFn: async () => {
      const [profiles, pros] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id, display_name, first_name, last_name, city, department, bio, membership_type, membership_status, public_visibility",
          )
          .eq("membership_status", "ACTIVE")
          .order("display_name", { ascending: true }),
        supabase.from("pro_details").select("profile_id, company_name, professional_category, website_url"),
      ]);
      const proMap = new Map((pros.data ?? []).map((p) => [p.profile_id, p]));
      return (await withContacts(profiles.data ?? [])).map((p) => ({
        ...p,
        pro: proMap.get(p.id) ?? null,
      }));
    },
  });

  // Projets visibles, filtrés par la RLS (can_view_project).
  const { data: links } = useQuery({
    queryKey: ["directory-links"],
    queryFn: async () => {
      const { data: members } = await supabase
        .from("project_members")
        .select("user_id, project_id, projects(title)");
      return { members: members ?? [] };
    },
  });
  const projectsOf = useMemo(() => {
    const map = new Map<string, { id: string; title: string }[]>();
    for (const m of links?.members ?? []) {
      const title = (m.projects as { title?: string } | null)?.title;
      if (!m.user_id || !title) continue;
      const list = map.get(m.user_id) ?? [];
      if (!list.some((p) => p.id === m.project_id)) list.push({ id: m.project_id, title });
      map.set(m.user_id, list);
    }
    return map;
  }, [links]);
  const departments = useMemo(
    () => Array.from(new Set((data ?? []).map((p) => p.department).filter(Boolean))).sort() as string[],
    [data],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data ?? []).filter((person) => {
      if (!isBureau && !person.public_visibility) return false;
      const type = (person.membership_type ?? "").toUpperCase();
      // Une vue par public (bandeau de l'annuaire) ; les structures partenaires ont leur page.
      if (category === "PRO" ? !type.includes("PRO") : type.includes("PRO") || type.includes("PARTENAIRE")) return false;
      if (department !== "ALL" && person.department !== department) return false;
      if (!term) return true;
      return `${person.display_name ?? ""} ${person.city ?? ""} ${person.pro?.company_name ?? ""} ${
        person.pro?.professional_category ?? ""
      } ${person.bio ?? ""}`
        .toLowerCase()
        .includes(term);
    });
  }, [data, search, department, isBureau, category]);

  return (
    <AppShell
      title="Réseau & annuaire"
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
      <DirectoryTabs current={category === "CHIENS" ? "chiens" : category === "PRO" ? "pros" : "particuliers"} />
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs" htmlFor="dir-search">Recherche</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="dir-search"
              className="pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={category === "CHIENS" ? "Nom, race, foyer" : "Nom, structure, spécialité, ville"}
            />
          </div>
        </div>
        {category !== "CHIENS" ? (
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
        ) : null}
      </div>

      {category === "CHIENS" ? (
        <DirectoryDogs search={search} />
      ) : (
        <>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Chargement de l'annuaire…</p>
          ) : filtered.length === 0 ? (
            <EmptyState
              title="Aucun profil trouvé"
              message="Affinez votre recherche, ou invitez de nouveaux adhérents à rejoindre le réseau."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((person) => {
                const name =
                  person.display_name || `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim() || "Adhérent";
                const personProjects = projectsOf.get(person.id) ?? [];
                return (
                  <article key={person.id} className="rounded-xl border border-border bg-card p-5">
                    <h2 className="font-display text-base font-bold">
                      <EntityPeek type={person.pro ? "professional" : "person"} id={person.id}>{name}</EntityPeek>
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
                    {personProjects.length > 0 ? (
                      <ul aria-label="Projets" className="mt-3 flex flex-wrap gap-1.5">
                        {personProjects.slice(0, 3).map((p) => (
                          <li key={p.id}>
                            <Link to="/projects/$projectId" params={{ projectId: p.id }} className="rounded-full bg-muted px-2.5 py-0.5 text-xs hover:underline">
                              {p.title}
                            </Link>
                          </li>
                        ))}
                        {personProjects.length > 3 ? <li className="text-xs text-muted-foreground">+{personProjects.length - 3}</li> : null}
                      </ul>
                    ) : null}
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
                );
              })}
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
