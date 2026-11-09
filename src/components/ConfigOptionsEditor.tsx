import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { logAudit } from "@/lib/mindmap-actions";
import { slugify } from "@/lib/domain";
import { fetchConfigOptions, type ConfigOption } from "@/lib/config-options";

/**
 * Éditeur d'une famille d'options (Bureau) : ajout, renommage, ordre manuel, désactivation.
 * Le code reste fixe : renommer ou désactiver ne casse jamais les fiches existantes.
 */
export function ConfigOptionsEditor({ family, addPlaceholder = "Ex. Référent bénévoles" }: { family: string; addPlaceholder?: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState({ label: "", code: "", description: "" });

  const { data: options } = useQuery({
    queryKey: ["config-options", family],
    queryFn: () => fetchConfigOptions(family),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["config-options"] });

  const createOption = useMutation({
    mutationFn: async () => {
      const label = draft.label.trim();
      if (label.length < 2) throw new Error("Le libellé est obligatoire.");
      const code = (draft.code.trim() || slugify(label).replace(/-/g, "_")).toUpperCase();
      if ((options ?? []).some((o) => o.code === code)) throw new Error("Ce code existe déjà dans cette famille.");
      const max = Math.max(0, ...(options ?? []).map((o) => o.sort_order));
      const { data, error } = await supabase
        .from("config_options")
        .insert({ family, code, label, description: draft.description.trim() || null, sort_order: max + 10 })
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
      if (!confirm(`Supprimer « ${option.label} » ? Préférez « Masquée » si des fiches l'utilisent déjà.`)) throw new Error("__cancel");
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
    onError: (e: Error) => {
      if (e.message !== "__cancel") toast.error(e.message);
    },
  });

  return (
    <div className="space-y-4">
      <div className="panel space-y-3 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ajouter une option</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor={`opt-label-${family}`}>Libellé</Label>
            <Input
              id={`opt-label-${family}`}
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              placeholder={addPlaceholder}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`opt-code-${family}`}>Code technique (facultatif)</Label>
            <Input
              id={`opt-code-${family}`}
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
          aria-label="Description de l'option"
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
                  key={`${option.id}-${option.label}`}
                  defaultValue={option.label}
                  aria-label={`Libellé de ${option.code}`}
                  onBlur={(e) => {
                    const label = e.target.value.trim();
                    if (label.length >= 2 && label !== option.label) updateOption.mutate({ option, patch: { label } });
                    else e.target.value = option.label;
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  {option.code}
                  {option.description ? ` · ${option.description}` : ""}
                </p>
              </div>
              <div className="w-24 space-y-1">
                <Label className="text-xs text-muted-foreground" htmlFor={`ord-${option.id}`}>
                  Ordre
                </Label>
                <Input
                  id={`ord-${option.id}`}
                  key={`${option.id}-${option.sort_order}`}
                  type="number"
                  defaultValue={option.sort_order}
                  onBlur={(e) => {
                    const sort_order = Number(e.target.value) || 0;
                    if (sort_order !== option.sort_order) updateOption.mutate({ option, patch: { sort_order } });
                  }}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={option.is_active}
                  aria-label={`Activer ${option.label}`}
                  onCheckedChange={(checked) => updateOption.mutate({ option, patch: { is_active: checked } })}
                />
                <span className="text-xs text-muted-foreground">{option.is_active ? "Active" : "Masquée"}</span>
              </div>
              {option.is_system ? (
                <Badge variant="outline">Système</Badge>
              ) : (
                <Button size="icon" variant="ghost" onClick={() => deleteOption.mutate(option)} aria-label={`Supprimer ${option.label}`}>
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
