import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type MemberOption = {
  id: string;
  name: string;
  category: "BUREAU" | "PRO" | "PARTENAIRE" | "PARTICULIER";
  company?: string | null;
};

const CATEGORY_LABEL: Record<MemberOption["category"], string> = {
  BUREAU: "Bureau",
  PRO: "Professionnel",
  PARTENAIRE: "Partenaire",
  PARTICULIER: "Particulier",
};

function categoryOf(membershipType: string | null, accessLevel: string | null): MemberOption["category"] {
  const value = `${membershipType ?? ""} ${accessLevel ?? ""}`.toUpperCase();
  if (value.includes("BUREAU") || value.includes("ADMIN")) return "BUREAU";
  if (value.includes("PARTENAIRE") || value.includes("PARTNER")) return "PARTENAIRE";
  if (value.includes("PRO")) return "PRO";
  return "PARTICULIER";
}

export function useMemberOptions() {
  return useQuery({
    queryKey: ["member-options"],
    queryFn: async (): Promise<MemberOption[]> => {
      const [{ data: profiles }, { data: pros }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,display_name,first_name,last_name,membership_type,access_level")
          .order("display_name"),
        supabase.from("pro_details").select("profile_id,company_name"),
      ]);
      const companies = new Map((pros ?? []).map((p) => [p.profile_id, p.company_name]));
      return (profiles ?? []).map((p) => ({
        id: p.id,
        name:
          p.display_name ||
          [p.first_name, p.last_name].filter(Boolean).join(" ").trim() ||
          "Membre",
        category: categoryOf(p.membership_type, p.access_level),
        company: companies.get(p.id) ?? null,
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
  const { data: members = [] } = useMemberOptions();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<"ALL" | MemberOption["category"]>("ALL");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return members.filter((m) => {
      if (category !== "ALL" && m.category !== category) return false;
      if (!term) return true;
      return `${m.name} ${m.company ?? ""}`.toLowerCase().includes(term);
    });
  }, [members, search, category]);

  const toggle = (id: string) => {
    if (single) {
      onChange(selected.includes(id) ? [] : [id]);
      return;
    }
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1">
        {(["ALL", "BUREAU", "PRO", "PARTENAIRE", "PARTICULIER"] as const).map((value) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={category === value ? "default" : "outline"}
            className="h-7 px-2 text-xs"
            onClick={() => setCategory(value)}
          >
            {value === "ALL" ? "Tous" : CATEGORY_LABEL[value]}
          </Button>
        ))}
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Rechercher un membre…"
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
                <button type="button" onClick={() => toggle(id)} aria-label="Retirer ce membre">
                  <X className="size-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      ) : null}
      <div className="max-h-48 overflow-y-auto rounded-md border border-border">
        {filtered.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">Aucun membre trouvé.</p>
        ) : (
          filtered.map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() => toggle(member.id)}
              className={cn(
                "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted",
                selected.includes(member.id) && "bg-muted",
              )}
            >
              <span className="min-w-0 truncate">
                {member.name}
                {member.company ? (
                  <span className="text-muted-foreground"> · {member.company}</span>
                ) : null}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {CATEGORY_LABEL[member.category]}
                </Badge>
                {selected.includes(member.id) ? <Check className="size-4 text-primary" /> : null}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
