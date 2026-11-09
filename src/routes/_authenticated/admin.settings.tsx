import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, Settings2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ConfigOptionsEditor } from "@/components/ConfigOptionsEditor";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { CONFIG_CATEGORIES, CONFIG_FAMILIES, fetchConfigOptions } from "@/lib/config-options";
import { foldText } from "@/lib/name-search";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({
    meta: [
      { title: "Paramétrage — La Voix du Chien" },
      {
        name: "description",
        content:
          "Configurer sans coder : catégories, statuts, niveaux d'accès, rôles projet, fonctions associatives, visibilités et types d'activités.",
      },
      { property: "og:title", content: "Paramétrage — La Voix du Chien" },
      {
        property: "og:description",
        content: "Le référentiel évolutif de l'association, modifiable par le Bureau.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

const familyMeta = (family: string) => CONFIG_FAMILIES.find((f) => f.family === family);

function SettingsPage() {
  const { isBureau } = useAuth();
  const [family, setFamily] = useState(CONFIG_CATEGORIES[0]!.families[0]!);
  const [search, setSearch] = useState("");

  // Toutes les options, pour retrouver instantanément une valeur sans parcourir les familles.
  const { data: all = [] } = useQuery({
    queryKey: ["config-options", "ALL"],
    enabled: isBureau,
    queryFn: () => fetchConfigOptions(),
  });

  const term = foldText(search);
  const matches = useMemo(() => {
    if (!term) return null;
    const families = CONFIG_FAMILIES.filter((f) => foldText(`${f.label} ${f.hint}`).includes(term));
    const options = all.filter((o) => foldText(`${o.label} ${o.code} ${o.description ?? ""}`).includes(term)).slice(0, 30);
    return { families, options };
  }, [term, all]);

  if (!isBureau) {
    return (
      <AppShell title="Paramétrage" subtitle="Accès réservé au Bureau">
        <p className="text-sm text-muted-foreground">Seul le Bureau peut faire évoluer le référentiel de l'association.</p>
      </AppShell>
    );
  }

  const current = familyMeta(family);
  const open = (f: string) => {
    setFamily(f);
    setSearch("");
  };

  return (
    <AppShell title="Paramétrage de l'association" subtitle="Catégories, statuts, niveaux et types, sans réécrire l'application">
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une option"
              aria-label="Rechercher une option"
              className="pl-9"
            />
          </div>
          <nav className="panel h-fit space-y-3 p-2" aria-label="Familles de paramètres">
            {CONFIG_CATEGORIES.map((cat) => (
              <div key={cat.label}>
                <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{cat.label}</p>
                {cat.families.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => open(f)}
                    aria-current={f === family && !matches ? "page" : undefined}
                    className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${
                      f === family && !matches ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    }`}
                  >
                    {familyMeta(f)?.label ?? f}
                  </button>
                ))}
              </div>
            ))}
          </nav>
        </div>

        <div className="space-y-4">
          {matches ? (
            <div className="panel space-y-3 p-4" role="region" aria-label="Résultats de recherche">
              <p className="text-sm font-medium">Résultats pour « {search} »</p>
              {matches.families.length === 0 && matches.options.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune option ne correspond.</p>
              ) : (
                <ul className="divide-y divide-border text-sm">
                  {matches.families.map((f) => (
                    <li key={f.family}>
                      <button type="button" className="flex w-full flex-col py-2 text-left hover:text-primary" onClick={() => open(f.family)}>
                        <span className="font-medium">{f.label}</span>
                        <span className="text-xs text-muted-foreground">Famille · {f.hint}</span>
                      </button>
                    </li>
                  ))}
                  {matches.options.map((o) => (
                    <li key={o.id}>
                      <button type="button" className="flex w-full flex-col py-2 text-left hover:text-primary" onClick={() => open(o.family)}>
                        <span className="font-medium">
                          {o.label}
                          {o.is_active ? "" : " (masquée)"}
                        </span>
                        <span className="text-xs text-muted-foreground">{familyMeta(o.family)?.label ?? o.family}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <>
              <div className="panel space-y-1 p-4">
                <div className="flex items-center gap-2">
                  <Settings2 className="size-4 text-muted-foreground" aria-hidden />
                  <h2 className="text-lg">{current?.label ?? family}</h2>
                </div>
                <p className="text-sm text-muted-foreground">{current?.hint}</p>
              </div>
              <ConfigOptionsEditor key={family} family={family} />
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
