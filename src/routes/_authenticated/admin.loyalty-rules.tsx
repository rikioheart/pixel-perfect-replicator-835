import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, RefreshCw, Stamp, Trash2 } from "lucide-react";
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
import { useConfigOptions } from "@/lib/config-options";
import {
  LOYALTY_SCOPES,
  LOYALTY_SCOPE_LABEL,
  MEMBERSHIP_TYPES,
  fetchLoyaltyRules,
  recomputeLoyaltyAll,
  type LoyaltyRule,
} from "@/lib/loyalty-rules";

export const Route = createFileRoute("/_authenticated/admin/loyalty-rules")({
  head: () => ({
    meta: [
      { title: "Règles de fidélité — La Voix du Chien" },
      {
        name: "description",
        content:
          "Moteur de fidélité paramétrable : barèmes de tampons par activité ou événement, éligibilités et paliers de récompense.",
      },
      { property: "og:title", content: "Règles de fidélité — La Voix du Chien" },
      {
        property: "og:description",
        content: "Attribution automatique des tampons dès qu'une participation est validée.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoyaltyRulesPage,
});

const EMPTY = {
  label: "",
  description: "",
  scope: "ACTIVITY_TYPE",
  match_code: "",
  stamps_given: 1,
  tier_threshold: "",
  reward_label: "",
  eligible: [] as string[],
};

function LoyaltyRulesPage() {
  const { isBureau, user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(EMPTY);
  const activityTypes = useConfigOptions("ACTIVITY_TYPE");

  const { data: rules = [] } = useQuery({
    queryKey: ["loyalty-rules"],
    enabled: isBureau,
    queryFn: fetchLoyaltyRules,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["loyalty-rules"] });

  const create = useMutation({
    mutationFn: async () => {
      const label = draft.label.trim();
      if (label.length < 3) throw new Error("Le libellé de la règle est obligatoire.");
      const isTier = draft.scope === "TIER";
      if (isTier && Number(draft.tier_threshold) <= 0) {
        throw new Error("Indiquez le seuil de tampons du palier.");
      }
      if (!isTier && draft.stamps_given <= 0) {
        throw new Error("Une règle d'attribution doit donner au moins 1 tampon.");
      }
      if (draft.scope === "ACTIVITY_TYPE" && !draft.match_code) {
        throw new Error("Choisissez le type d'activité concerné.");
      }
      const { data, error } = await supabase
        .from("loyalty_rules")
        .insert({
          code: slugify(label).replace(/-/g, "_").toUpperCase(),
          label,
          description: draft.description.trim() || null,
          scope: draft.scope,
          match_code: draft.scope === "ACTIVITY_TYPE" ? draft.match_code : null,
          stamps_given: isTier ? 0 : draft.stamps_given,
          tier_threshold: isTier ? Number(draft.tier_threshold) : null,
          reward_label: isTier ? draft.reward_label.trim() || null : null,
          eligible_membership_types: draft.eligible,
          priority: isTier ? 900 : (rules.length + 1) * 10,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      await logAudit({
        actorId: user?.id ?? null,
        action: "LOYALTY_RULE_CREATED",
        entityType: "loyalty_rule",
        entityId: data.id,
        newValues: { label, scope: draft.scope, stamps: draft.stamps_given },
      });
    },
    onSuccess: async () => {
      setDraft(EMPTY);
      toast.success("Règle ajoutée.");
      await invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ rule, patch }: { rule: LoyaltyRule; patch: Partial<LoyaltyRule> }) => {
      const { error } = await supabase.from("loyalty_rules").update(patch).eq("id", rule.id);
      if (error) throw new Error(error.message);
      await logAudit({
        actorId: user?.id ?? null,
        action: "LOYALTY_RULE_UPDATED",
        entityType: "loyalty_rule",
        entityId: rule.id,
        oldValues: { stamps_given: rule.stamps_given, is_active: rule.is_active },
        newValues: patch as Record<string, unknown>,
      });
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const recompute = useMutation({
    mutationFn: recomputeLoyaltyAll,
    onSuccess: async (granted) => {
      toast.success(
        granted > 0
          ? `Recalcul global terminé : ${granted} tampon(s) attribué(s).`
          : "Recalcul global terminé : toutes les cartes étaient à jour.",
      );
      await queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (rule: LoyaltyRule) => {
      const { error } = await supabase.from("loyalty_rules").delete().eq("id", rule.id);
      if (error) throw new Error(error.message);
      await logAudit({
        actorId: user?.id ?? null,
        action: "LOYALTY_RULE_DELETED",
        entityType: "loyalty_rule",
        entityId: rule.id,
        oldValues: { label: rule.label, scope: rule.scope },
      });
    },
    onSuccess: async () => {
      toast.success("Règle supprimée.");
      await invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isBureau) {
    return (
      <AppShell title="Règles de fidélité" subtitle="Accès réservé au Bureau">
        <p className="text-sm text-muted-foreground">
          Seul le Bureau peut faire évoluer les barèmes de fidélité.
        </p>
      </AppShell>
    );
  }

  const isTier = draft.scope === "TIER";
  const tiers = rules.filter((r) => r.scope === "TIER");
  const grants = rules.filter((r) => r.scope !== "TIER");

  return (
    <AppShell
      title="Moteur de fidélité"
      subtitle="Barèmes, éligibilités et paliers appliqués automatiquement à chaque participation validée"
    >
      <div className="space-y-4">
        <div className="panel space-y-3 p-4">
          <div className="flex items-center gap-2">
            <Stamp className="size-4 text-primary" />
            <p className="text-sm font-medium">Nouvelle règle</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="rule-label">Libellé</Label>
              <Input
                id="rule-label"
                value={draft.label}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                placeholder="Ex. 2 tampons par atelier"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rule-scope">Portée</Label>
              <select
                id="rule-scope"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={draft.scope}
                onChange={(e) => setDraft({ ...draft, scope: e.target.value })}
              >
                {LOYALTY_SCOPES.map((scope) => (
                  <option key={scope.value} value={scope.value}>
                    {scope.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                {LOYALTY_SCOPES.find((s) => s.value === draft.scope)?.hint}
              </p>
            </div>
            {draft.scope === "ACTIVITY_TYPE" ? (
              <div className="space-y-1">
                <Label htmlFor="rule-type">Type d'activité</Label>
                <select
                  id="rule-type"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={draft.match_code}
                  onChange={(e) => setDraft({ ...draft, match_code: e.target.value })}
                >
                  <option value="">Choisir…</option>
                  {activityTypes.options.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {isTier ? (
              <>
                <div className="space-y-1">
                  <Label htmlFor="rule-threshold">Seuil de tampons</Label>
                  <Input
                    id="rule-threshold"
                    type="number"
                    min={1}
                    value={draft.tier_threshold}
                    onChange={(e) => setDraft({ ...draft, tier_threshold: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="rule-reward">Récompense</Label>
                  <Input
                    id="rule-reward"
                    value={draft.reward_label}
                    onChange={(e) => setDraft({ ...draft, reward_label: e.target.value })}
                    placeholder="Ex. Séance offerte"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-1">
                <Label htmlFor="rule-stamps">Tampons attribués</Label>
                <Input
                  id="rule-stamps"
                  type="number"
                  min={1}
                  value={draft.stamps_given}
                  onChange={(e) => setDraft({ ...draft, stamps_given: Number(e.target.value) || 1 })}
                />
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Éligibilité (aucun choix = tous les adhérents)
            </Label>
            <div className="flex flex-wrap gap-2 pt-1">
              {MEMBERSHIP_TYPES.map((type) => {
                const active = draft.eligible.includes(type);
                return (
                  <Button
                    key={type}
                    type="button"
                    size="sm"
                    variant={active ? "default" : "outline"}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        eligible: active
                          ? draft.eligible.filter((t) => t !== type)
                          : [...draft.eligible, type],
                      })
                    }
                  >
                    {type}
                  </Button>
                );
              })}
            </div>
          </div>

          <Textarea
            rows={2}
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder="À quoi sert cette règle ? (facultatif)"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => create.mutate()} disabled={create.isPending}>
              <Plus className="mr-2 size-4" /> Ajouter la règle
            </Button>
            <Button
              variant="outline"
              onClick={() => recompute.mutate()}
              disabled={recompute.isPending}
            >
              <RefreshCw className="mr-2 size-4" />
              {recompute.isPending ? "Recalcul en cours…" : "Recalculer toutes les cartes"}
            </Button>
            <span className="text-xs text-muted-foreground">
              Rejoue les barèmes sur toutes les participations validées, sans doublon.
            </span>
          </div>
        </div>

        <RuleList
          title="Barèmes d'attribution"
          empty="Aucun barème actif : aucune attribution automatique."
          rules={grants}
          onToggle={(rule, is_active) => update.mutate({ rule, patch: { is_active } })}
          onStamps={(rule, stamps_given) => update.mutate({ rule, patch: { stamps_given } })}
          onDelete={(rule) => remove.mutate(rule)}
        />
        <RuleList
          title="Paliers et récompenses"
          empty="Aucun palier configuré."
          rules={tiers}
          onToggle={(rule, is_active) => update.mutate({ rule, patch: { is_active } })}
          onDelete={(rule) => remove.mutate(rule)}
        />
      </div>
    </AppShell>
  );
}

function RuleList({
  title,
  empty,
  rules,
  onToggle,
  onStamps,
  onDelete,
}: {
  title: string;
  empty: string;
  rules: LoyaltyRule[];
  onToggle: (rule: LoyaltyRule, active: boolean) => void;
  onStamps?: (rule: LoyaltyRule, stamps: number) => void;
  onDelete: (rule: LoyaltyRule) => void;
}) {
  return (
    <section className="panel divide-y divide-border">
      <p className="p-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      {rules.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">{empty}</p>
      ) : (
        rules.map((rule) => (
          <div key={rule.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-[220px] flex-1">
              <p className="text-sm">{rule.label ?? rule.code}</p>
              <p className="text-xs text-muted-foreground">
                {LOYALTY_SCOPE_LABEL[rule.scope] ?? rule.scope}
                {rule.match_code ? ` · ${rule.match_code}` : ""}
                {rule.description ? ` · ${rule.description}` : ""}
              </p>
            </div>
            {rule.scope === "TIER" ? (
              <Badge variant="secondary">
                {rule.tier_threshold} tampons → {rule.reward_label ?? "récompense"}
              </Badge>
            ) : (
              <div className="w-28">
                <Label className="text-xs text-muted-foreground">Tampons</Label>
                <Input
                  type="number"
                  min={1}
                  value={rule.stamps_given}
                  onChange={(e) => onStamps?.(rule, Number(e.target.value) || 1)}
                />
              </div>
            )}
            {rule.eligible_membership_types.length > 0 ? (
              <Badge variant="outline">{rule.eligible_membership_types.join(", ")}</Badge>
            ) : (
              <Badge variant="outline">Tous</Badge>
            )}
            <div className="flex items-center gap-2">
              <Switch
                checked={rule.is_active}
                onCheckedChange={(checked) => onToggle(rule, checked)}
                aria-label={`Activer ${rule.label ?? rule.code}`}
              />
              <span className="text-xs text-muted-foreground">
                {rule.is_active ? "Active" : "Suspendue"}
              </span>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onDelete(rule)}
              aria-label={`Supprimer ${rule.label ?? rule.code}`}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))
      )}
    </section>
  );
}
