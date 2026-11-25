import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  QUALITY_LABEL,
  availableQualities,
  filterMembers,
  normalizeQualities,
  type MemberOption,
  type Quality,
} from "@/lib/member-picker";

export type { MemberOption } from "@/lib/member-picker";

/** Adhérents actifs visibles, avec toutes leurs qualités (calculées et filtrées par la base). */
export function useMemberOptions() {
  const { user, rolesReady, isBureau, isPro } = useAuth();
  return useQuery({
    queryKey: ["member-options", user?.id, isBureau, isPro],
    enabled: Boolean(user) && rolesReady,
    queryFn: async (): Promise<MemberOption[]> => {
      const { data, error } = await supabase.rpc("picker_people");
      if (error) throw error;
      return (data ?? []).map((p) => ({
        id: p.id,
        name: p.name || "Membre",
        company: p.company ?? null,
        qualities: normalizeQualities(p.qualities),
      }));
    },
  });
}

export function MemberPicker({
  label = "Membres concernés",
  selected,
  onChange,
  single = false,
}: {
  label?: string;
  selected: string[];
  onChange: (ids: string[]) => void;
  single?: boolean;
}) {
  const { data: members = [], isPending, isError, refetch } = useMemberOptions();
  const [search, setSearch] = useState("");
  const [qualities, setQualities] = useState<Quality[]>([]);

  const chips = useMemo(() => availableQualities(members), [members]);
  const filtered = useMemo(() => filterMembers(members, qualities, search), [members, qualities, search]);

  const toggle = (id: string) => {
    if (single) {
      onChange(selected.includes(id) ? [] : [id]);
      return;
    }
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };
  const toggleQuality = (q: Quality) =>
    setQualities((current) => (current.includes(q) ? current.filter((x) => x !== q) : [...current, q]));

  return (
    <div className="min-w-0 space-y-2">
      <Label>{label}</Label>
      {chips.length > 1 ? (
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filtrer par qualité (plusieurs choix possibles)">
          <Button
            type="button"
            size="sm"
            variant={qualities.length === 0 ? "default" : "outline"}
            className="h-7 px-2 text-xs"
            aria-pressed={qualities.length === 0}
            onClick={() => setQualities([])}
          >
            Tous
          </Button>
          {chips.map((q) => (
            <Button
              key={q}
              type="button"
              size="sm"
              variant={qualities.includes(q) ? "default" : "outline"}
              className="h-7 px-2 text-xs"
              aria-pressed={qualities.includes(q)}
              onClick={() => toggleQuality(q)}
            >
              {QUALITY_LABEL[q]}
            </Button>
          ))}
        </div>
      ) : null}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          className="pl-9"
          placeholder="Rechercher un nom ou une structure…"
          aria-label="Rechercher un membre"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {selected.length ? (
        <div className="flex flex-wrap gap-1">
          {selected.map((id) => {
            const member = members.find((m) => m.id === id);
            return (
              <Badge key={id} variant="secondary" className="gap-1">
                {member?.name ?? "Membre"}
                <button type="button" onClick={() => toggle(id)} aria-label={`Retirer ${member?.name ?? "ce membre"}`}>
                  <X className="size-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      ) : null}
      <div className="max-h-48 overflow-y-auto rounded-md border border-border">
        {isError ? (
          <div className="space-y-2 p-3 text-sm text-muted-foreground" role="alert">
            <p>Les personnes n’ont pas pu être chargées.</p>
            <Button type="button" size="sm" variant="outline" onClick={() => void refetch()}>Réessayer</Button>
          </div>
        ) : isPending ? (
          <p className="p-3 text-sm text-muted-foreground" role="status">Chargement…</p>
        ) : filtered.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">Personne ne correspond pour l'instant.</p>
        ) : (
          filtered.map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() => toggle(member.id)}
              aria-pressed={selected.includes(member.id)}
              className={cn(
                "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted",
                selected.includes(member.id) && "bg-muted",
              )}
            >
              <span className="min-w-0 truncate">
                {member.name}
                {member.company ? <span className="text-muted-foreground"> · {member.company}</span> : null}
              </span>
              <span className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                {member.qualities.map((q) => (
                  <Badge key={q} variant="outline" className="text-[10px]">
                    {QUALITY_LABEL[q]}
                  </Badge>
                ))}
                {selected.includes(member.id) ? <Check className="size-4 text-primary" aria-hidden="true" /> : null}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
