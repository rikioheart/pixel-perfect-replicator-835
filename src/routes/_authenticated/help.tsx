import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BookOpen, IdCard, LifeBuoy, Plus, Check, X, Trash2, Pencil } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { SidePanel } from "@/components/SidePanel";
import { MemberPicker } from "@/components/MemberPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { notifyBureau } from "@/lib/collab-notify";

export const Route = createFileRoute("/_authenticated/help")({
  head: () => ({
    meta: [
      { title: "Centre d'aide — La Voix du Chien" },
      {
        name: "description",
        content:
          "Guides pratiques par module et fiches de poste : comprendre son rôle et utiliser la plateforme.",
      },
      { property: "og:title", content: "Centre d'aide — La Voix du Chien" },
      {
        property: "og:description",
        content: "Les guides de la plateforme et les fiches de poste de chaque membre.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HelpCenterPage,
});

const MODULES: [string, string][] = [
  ["PROJETS", "Projets & tâches"],
  ["ACTIVITES", "Activités & événements"],
  ["FIDELITE", "Fidélité"],
  ["ADHERENTS", "Adhérents"],
  ["FINANCE", "Finances"],
  ["BUREAU", "Bureau & validation"],
  ["AUTRE", "Autre"],
];

const VISIBILITIES: [string, string][] = [
  ["ALL", "Tous les adhérents"],
  ["PRO_BUREAU", "Professionnels et Bureau"],
  ["BUREAU", "Bureau uniquement"],
];

const ROLE_SCOPES = ["PARTICULIER", "PROFESSIONNEL", "BUREAU"];

const emptyGuide = {
  id: "",
  title: "",
  module: "AUTRE",
  role_scopes: ["PARTICULIER"] as string[],
  summary: "",
  content: "",
  visibility: "ALL",
};

function HelpCenterPage() {
  const { user, isBureau } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"GUIDES" | "SHEETS">("GUIDES");
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("ALL");
  const [guide, setGuide] = useState<typeof emptyGuide | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheet, setSheet] = useState({
    member_id: "",
    role_title: "",
    responsibilities: "",
    daily_actions: "",
    notes: "",
    visibility: "PRO_BUREAU",
  });

  const { data: guides = [] } = useQuery({
    queryKey: ["help-guides"],
    queryFn: async () => {
      const { data } = await supabase
        .from("help_guides")
        .select("*")
        .order("module", { ascending: true })
        .order("title", { ascending: true });
      return data ?? [];
    },
  });

  const { data: sheets = [] } = useQuery({
    queryKey: ["job-sheets"],
    queryFn: async () => {
      const { data } = await supabase
        .from("job_sheets")
        .select("*, profiles:member_id(display_name)")
        .order("role_title", { ascending: true });
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return guides.filter(
      (item) =>
        (moduleFilter === "ALL" || item.module === moduleFilter) &&
        (!term ||
          item.title.toLowerCase().includes(term) ||
          (item.summary ?? "").toLowerCase().includes(term)),
    );
  }, [guides, moduleFilter, search]);

  const saveGuide = useMutation({
    mutationFn: async (value: typeof emptyGuide) => {
      if (value.title.trim().length < 3) throw new Error("Donnez un titre au guide.");
      if (value.content.trim().length < 10) throw new Error("Le contenu doit faire au moins 10 caractères.");
      const payload = {
        title: value.title.trim(),
        module: value.module,
        role_scopes: value.role_scopes,
        summary: value.summary || null,
        content: value.content,
        visibility: value.visibility,
        status: isBureau ? "PUBLISHED" : "PENDING",
        author_id: user!.id,
      };
      if (value.id) {
        const { error } = await supabase.from("help_guides").update(payload).eq("id", value.id);
        if (error) throw error;
        return;
      }
      const { data, error } = await supabase.from("help_guides").insert(payload).select("id").single();
      if (error) throw error;
      if (!isBureau) {
        await notifyBureau({
          senderId: user!.id,
          kind: "HELP_GUIDE_PROPOSED",
          title: "Nouveau guide proposé",
          message: value.title,
          linkUrl: "/help",
          entityType: "help_guide",
          entityId: data.id,
        });
      }
    },
    onSuccess: () => {
      toast.success(isBureau ? "Guide publié." : "Guide envoyé au Bureau pour validation.");
      setGuide(null);
      queryClient.invalidateQueries({ queryKey: ["help-guides"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reviewGuide = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("help_guides")
        .update({ status, reviewed_by: user!.id })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Guide mis à jour.");
      queryClient.invalidateQueries({ queryKey: ["help-guides"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeGuide = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("help_guides").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Guide supprimé.");
      queryClient.invalidateQueries({ queryKey: ["help-guides"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveSheet = useMutation({
    mutationFn: async () => {
      if (!sheet.member_id) throw new Error("Sélectionnez le membre concerné.");
      if (sheet.role_title.trim().length < 3) throw new Error("Précisez l'intitulé du poste.");
      const { error } = await supabase.from("job_sheets").insert({
        member_id: sheet.member_id,
        role_title: sheet.role_title.trim(),
        responsibilities: sheet.responsibilities || null,
        daily_actions: sheet.daily_actions || null,
        notes: sheet.notes || null,
        visibility: sheet.visibility,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fiche de poste publiée.");
      setSheetOpen(false);
      setSheet({
        member_id: "",
        role_title: "",
        responsibilities: "",
        daily_actions: "",
        notes: "",
        visibility: "PRO_BUREAU",
      });
      queryClient.invalidateQueries({ queryKey: ["job-sheets"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell
      title="Centre d'aide"
      subtitle="Les guides de la plateforme, module par module, et les fiches de poste de chacun."
      actions={
        <div className="flex flex-wrap gap-2">
          <Link to="/help-requests">
            <Button variant="outline" size="sm" className="rounded-full">
              <LifeBuoy className="mr-2 size-4" /> Demandes d'aide
            </Button>
          </Link>
          {tab === "GUIDES" ? (
            <Button size="sm" className="rounded-full" onClick={() => setGuide({ ...emptyGuide })}>
              <Plus className="mr-2 size-4" /> {isBureau ? "Nouveau guide" : "Proposer un guide"}
            </Button>
          ) : isBureau ? (
            <Button size="sm" className="rounded-full" onClick={() => setSheetOpen(true)}>
              <Plus className="mr-2 size-4" /> Nouvelle fiche de poste
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="mb-5 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={tab === "GUIDES" ? "default" : "outline"}
          className="rounded-full"
          onClick={() => setTab("GUIDES")}
        >
          <BookOpen className="mr-2 size-4" /> Guides
        </Button>
        <Button
          size="sm"
          variant={tab === "SHEETS" ? "default" : "outline"}
          className="rounded-full"
          onClick={() => setTab("SHEETS")}
        >
          <IdCard className="mr-2 size-4" /> Fiches de poste
        </Button>
      </div>

      {tab === "GUIDES" ? (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-2">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher un guide"
            />
            <Select value={moduleFilter} onValueChange={setModuleFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous les modules</SelectItem>
                {MODULES.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              title="Aucun guide pour l'instant"
              message="Les guides expliquent comment utiliser chaque module. Chacun peut en proposer un."
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {filtered.map((item) => (
                <article key={item.id} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-display text-base font-bold">{item.title}</h2>
                      <p className="text-xs text-muted-foreground">
                        {MODULES.find(([code]) => code === item.module)?.[1] ?? item.module}
                        {item.status !== "PUBLISHED" ? " · en attente de validation" : ""}
                      </p>
                    </div>
                    {isBureau ? (
                      <div className="flex gap-1">
                        {item.status !== "PUBLISHED" ? (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => reviewGuide.mutate({ id: item.id, status: "PUBLISHED" })}
                            >
                              <Check className="size-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => reviewGuide.mutate({ id: item.id, status: "REFUSED" })}
                            >
                              <X className="size-4" />
                            </Button>
                          </>
                        ) : null}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() =>
                            setGuide({
                              id: item.id,
                              title: item.title,
                              module: item.module,
                              role_scopes: item.role_scopes ?? ["PARTICULIER"],
                              summary: item.summary ?? "",
                              content: item.content ?? "",
                              visibility: item.visibility,
                            })
                          }
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => removeGuide.mutate(item.id)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  {item.summary ? <p className="mt-2 text-sm text-muted-foreground">{item.summary}</p> : null}
                  <p className="mt-3 whitespace-pre-wrap text-sm">{item.content}</p>
                </article>
              ))}
            </div>
          )}
        </>
      ) : sheets.length === 0 ? (
        <EmptyState
          title="Aucune fiche de poste"
          message="Une fiche de poste décrit le rôle d'un membre : responsabilités et actions du quotidien."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {sheets.map((item) => {
            const member = item.profiles as { display_name: string | null } | null;
            return (
              <article key={item.id} className="rounded-xl border border-border bg-card p-5">
                <h2 className="font-display text-base font-bold">{item.role_title}</h2>
                <p className="text-xs text-muted-foreground">{member?.display_name ?? "Adhérent"}</p>
                {item.responsibilities ? (
                  <p className="mt-3 whitespace-pre-wrap text-sm">{item.responsibilities}</p>
                ) : null}
                {item.daily_actions ? (
                  <p className="mt-3 rounded-lg bg-muted/60 p-3 text-xs whitespace-pre-wrap">
                    Au quotidien : {item.daily_actions}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      <SidePanel
        open={Boolean(guide)}
        onOpenChange={(open) => !open && setGuide(null)}
        title={guide?.id ? "Modifier le guide" : "Nouveau guide"}
        description={
          isBureau
            ? "Le guide est publié immédiatement pour les rôles concernés."
            : "Votre proposition est envoyée au Bureau avant publication."
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setGuide(null)}>
              Annuler
            </Button>
            <Button onClick={() => guide && saveGuide.mutate(guide)} disabled={saveGuide.isPending}>
              Enregistrer
            </Button>
          </div>
        }
      >
        {guide ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="guide-title">Titre</Label>
              <Input
                id="guide-title"
                value={guide.title}
                onChange={(event) => setGuide({ ...guide, title: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Module concerné</Label>
              <Select value={guide.module} onValueChange={(value) => setGuide({ ...guide, module: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODULES.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Rôles concernés</Label>
              <div className="flex flex-wrap gap-2">
                {ROLE_SCOPES.map((scope) => {
                  const active = guide.role_scopes.includes(scope);
                  return (
                    <Button
                      key={scope}
                      type="button"
                      size="sm"
                      variant={active ? "default" : "outline"}
                      className="rounded-full"
                      onClick={() =>
                        setGuide({
                          ...guide,
                          role_scopes: active
                            ? guide.role_scopes.filter((value) => value !== scope)
                            : [...guide.role_scopes, scope],
                        })
                      }
                    >
                      {scope.charAt(0) + scope.slice(1).toLowerCase()}
                    </Button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="guide-summary">Résumé</Label>
              <Input
                id="guide-summary"
                value={guide.summary}
                onChange={(event) => setGuide({ ...guide, summary: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guide-content">Contenu</Label>
              <Textarea
                id="guide-content"
                rows={10}
                value={guide.content}
                onChange={(event) => setGuide({ ...guide, content: event.target.value })}
              />
            </div>
            {isBureau ? (
              <div className="space-y-2">
                <Label>Visibilité</Label>
                <Select
                  value={guide.visibility}
                  onValueChange={(value) => setGuide({ ...guide, visibility: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VISIBILITIES.map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </>
        ) : null}
      </SidePanel>

      <SidePanel
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Nouvelle fiche de poste"
        description="Décrire un rôle, c'est permettre à chacun de savoir où il agit."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSheetOpen(false)}>
              Annuler
            </Button>
            <Button onClick={() => saveSheet.mutate()} disabled={saveSheet.isPending}>
              Publier
            </Button>
          </div>
        }
      >
        <div className="space-y-2">
          <MemberPicker
            label="Membre concerné"
            selected={sheet.member_id ? [sheet.member_id] : []}
            onChange={(ids) => setSheet({ ...sheet, member_id: ids[0] ?? "" })}
            single
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sheet-title">Intitulé du poste</Label>
          <Input
            id="sheet-title"
            value={sheet.role_title}
            onChange={(event) => setSheet({ ...sheet, role_title: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sheet-resp">Responsabilités</Label>
          <Textarea
            id="sheet-resp"
            rows={5}
            value={sheet.responsibilities}
            onChange={(event) => setSheet({ ...sheet, responsibilities: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sheet-daily">Actions au quotidien</Label>
          <Textarea
            id="sheet-daily"
            rows={4}
            value={sheet.daily_actions}
            onChange={(event) => setSheet({ ...sheet, daily_actions: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Visibilité</Label>
          <Select value={sheet.visibility} onValueChange={(value) => setSheet({ ...sheet, visibility: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VISIBILITIES.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </SidePanel>
    </AppShell>
  );
}
