import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { logAudit } from "@/lib/mindmap-actions";
import { slugify } from "@/lib/domain";
import {
  CONFIG_FAMILIES,
  fetchConfigOptions,
  type ConfigOption,
} from "@/lib/config-options";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({
    meta: [
      { title: "Paramétrage — La Voix du Chien" },
      {
        name: "description",
        content:
          "Configurer sans coder : catégories, statuts, niveaux d'accès, rôles projet, fonctions associatives, visibilités et règles de fidélité.",
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

function SettingsPage() {
  const { isBureau, user } = useAuth();
  const queryClient = useQueryClient();
  const [family, setFamily] = useState(CONFIG_FAMILIES[0]!.family);
  const [draft, setDraft] = useState({ label: "", code: "", description: "" });

  const { data: options } = useQuery({
    queryKey: ["config-options", family],
    enabled: isBureau,
    queryFn: () => fetchConfigOptions(family),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["config-options"] });

  const createOption = useMutation({
    mutationFn: async () => {
      const label = draft.label.trim();
      if (label.length < 2) throw new Error("Le libellé est obligatoire.");
      const code = (draft.code.trim() || slugify(label).replace(/-/g, "_")).toUpperCase();
      const max = Math.max(0, ...(options ?? []).map((o) => o.sort_order));
      const { data, error } = await supabase
        .from("config_options")
        .insert({
          family,
          code,
          label,
          description: draft.description.trim() || null,
          sort_order: max + 10,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      await logAudit({
        actorId: user?.id ?? null,
        action: "CONFIG_OPTION_CREATED",
        entityType: "config_option",
        entityId: data.id,
        newValues: { family, code, label },
      });
    },
    onSuccess: async () => {
      setDraft({ label: "", code: "", description: "" });
      toast.success("Option ajoutée.");
      await invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateOption = useMutation({
    mutationFn: async ({ option, patch }: { option: ConfigOption; patch: Partial<ConfigOption> }) => {
      const { error } = await supabase.from("config_options").update(patch).eq("id", option.id);
      if (error) throw new Error(error.message);
      await logAudit({
        actorId: user?.id ?? null,
        action: "CONFIG_OPTION_UPDATED",
        entityType: "config_option",
        entityId: option.id,
        oldValues: { label: option.label, is_active: option.is_active, sort_order: option.sort_order },
        newValues: patch as Record<string, unknown>,
        metadata: { family: option.family, code: option.code },
      });
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteOption = useMutation({
    mutationFn: async (option: ConfigOption) => {
      if (option.is_system) throw new Error("Option système : désactivez-la plutôt que la supprimer.");
      const { error } = await supabase.from("config_options").delete().eq("id", option.id);
      if (error) throw new Error(error.message);
      await logAudit({
        actorId: user?.id ?? null,
        action: "CONFIG_OPTION_DELETED",
        entityType: "config_option",
        entityId: option.id,
        oldValues: { family: option.family, code: option.code, label: option.label },
      });
    },
    onSuccess: async () => {
      toast.success("Option supprimée.");
      await invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isBureau) {
    return (
      <AppShell title="Paramétrage" subtitle="Accès réservé au Bureau">
        <p className="text-sm text-muted-foreground">
          Seul le Bureau peut faire évoluer le référentiel de l'association.
        </p>
      </AppShell>
    );
  }

  const current = CONFIG_FAMILIES.find((f) => f.family === family)!;

  return (
    <AppShell
      title="Paramétrage de l'association"
      subtitle="Faire évoluer les catégories, statuts, niveaux et fonctions sans réécrire l'application"
    >
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <nav className="panel h-fit p-2">
          {CONFIG_FAMILIES.map((f) => (
            <button
              key={f.family}
              type="button"
              onClick={() => setFamily(f.family)}
              className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${
                f.family === family ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              {f.label}
            </button>
          ))}
        </nav>

        <div className="space-y-4">
          <div className="panel space-y-1 p-4">
            <div className="flex items-center gap-2">
              <Settings2 className="size-4 text-muted-foreground" />
              <h2 className="text-lg">{current.label}</h2>
            </div>
            <p className="text-sm text-muted-foreground">{current.hint}</p>
          </div>

          <div className="panel space-y-3 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Ajouter une option
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="opt-label">Libellé</Label>
                <Input
                  id="opt-label"
                  value={draft.label}
                  onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                  placeholder="Ex. Référent bénévoles"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="opt-code">Code technique (optionnel)</Label>
                <Input
                  id="opt-code"
                  value={draft.code}
                  onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                  placeholder="Généré automatiquement"
                />
              </div>
            </div>
            <Textarea
              rows={2}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="À quoi sert cette option ? (facultatif)"
            />
            <Button onClick={() => createOption.mutate()} disabled={createOption.isPending}>
              <Plus className="mr-2 size-4" /> Ajouter
            </Button>
          </div>

          <div className="panel divide-y divide-border">
            {(options ?? []).length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Aucune option dans cette famille.</p>
            ) : (
              options?.map((option) => (
                <div key={option.id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-[200px] flex-1 space-y-1">
                    <Input
                      value={option.label}
                      onChange={(e) =>
                        updateOption.mutate({ option, patch: { label: e.target.value } })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      {option.code}
                      {option.description ? ` · ${option.description}` : ""}
                    </p>
                  </div>
                  <div className="w-24 space-y-1">
                    <Label className="text-xs text-muted-foreground">Ordre</Label>
                    <Input
                      type="number"
                      value={option.sort_order}
                      onChange={(e) =>
                        updateOption.mutate({
                          option,
                          patch: { sort_order: Number(e.target.value) || 0 },
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={option.is_active}
                      onCheckedChange={(checked) =>
                        updateOption.mutate({ option, patch: { is_active: checked } })
                      }
                    />
                    <span className="text-xs text-muted-foreground">
                      {option.is_active ? "Active" : "Masquée"}
                    </span>
                  </div>
                  {option.is_system ? (
                    <Badge variant="outline">Système</Badge>
                  ) : (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteOption.mutate(option)}
                      aria-label={`Supprimer ${option.label}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
