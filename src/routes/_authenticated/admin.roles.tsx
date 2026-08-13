import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MEMBER_FUNCTION_LABEL, memberFullName } from "@/lib/members";

export const Route = createFileRoute("/_authenticated/admin/roles")({
  head: () => ({
    meta: [
      { title: "Rôles & habilitations — La Voix du Chien" },
      {
        name: "description",
        content:
          "Attribuer les rôles système et les fonctions associatives aux adhérents de La Voix du Chien.",
      },
      { property: "og:title", content: "Rôles & habilitations — La Voix du Chien" },
      {
        property: "og:description",
        content: "Gestion fine des habilitations et des fonctions du Bureau.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RolesPage,
});

const FUNCTION_TYPES = Object.keys(MEMBER_FUNCTION_LABEL);

function RolesPage() {
  const { isBureau, user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: members } = useQuery({
    queryKey: ["rbac-members"],
    enabled: isBureau,
    queryFn: async () =>
      (
        await supabase
          .from("profiles")
          .select("id, first_name, last_name, display_name, email, membership_status")
          .order("created_at", { ascending: true })
      ).data ?? [],
  });

  const { data: roles } = useQuery({
    queryKey: ["rbac-roles"],
    enabled: isBureau,
    queryFn: async () =>
      (await supabase.from("roles").select("id, code, name, description").order("code")).data ?? [],
  });

  const { data: assignments } = useQuery({
    queryKey: ["rbac-assignments"],
    enabled: isBureau,
    queryFn: async () =>
      (await supabase.from("user_roles").select("id, user_id, role_id, roles(code, name)")).data ??
      [],
  });

  const { data: functions } = useQuery({
    queryKey: ["rbac-functions"],
    enabled: isBureau,
    queryFn: async () =>
      (
        await supabase
          .from("member_functions")
          .select("id, user_id, function_type, active")
          .eq("active", true)
      ).data ?? [],
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["rbac-assignments"] });
    void queryClient.invalidateQueries({ queryKey: ["rbac-functions"] });
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return members ?? [];
    return (members ?? []).filter((m) =>
      `${memberFullName(m)} ${m.email ?? ""}`.toLowerCase().includes(term),
    );
  }, [members, search]);

  if (!isBureau) {
    return (
      <AppShell title="Rôles & habilitations" subtitle="Accès réservé au Bureau">
        <p className="text-sm text-muted-foreground">
          Cette page est réservée aux membres du Bureau.
        </p>
      </AppShell>
    );
  }

  const addRole = async (userId: string, roleId: string) => {
    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role_id: roleId, assigned_by: user?.id ?? null });
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Rôle déjà attribué." : error.message);
      return;
    }
    await supabase.from("audit_logs").insert({
      actor_id: user?.id ?? null,
      action: "role.assign",
      entity_type: "user_roles",
      entity_id: userId,
      new_values: { role_id: roleId },
    });
    toast.success("Rôle attribué.");
    invalidate();
  };

  const removeRole = async (assignmentId: string, userId: string) => {
    const { error } = await supabase.from("user_roles").delete().eq("id", assignmentId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("audit_logs").insert({
      actor_id: user?.id ?? null,
      action: "role.revoke",
      entity_type: "user_roles",
      entity_id: userId,
      old_values: { assignment_id: assignmentId },
    });
    toast.success("Rôle retiré.");
    invalidate();
  };

  const addFunction = async (userId: string, functionType: string) => {
    const { error } = await supabase
      .from("member_functions")
      .insert({ user_id: userId, function_type: functionType, active: true });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Fonction ajoutée.");
    invalidate();
  };

  const endFunction = async (id: string) => {
    const { error } = await supabase
      .from("member_functions")
      .update({ active: false, end_date: new Date().toISOString().slice(0, 10) })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Fonction clôturée.");
    invalidate();
  };

  return (
    <AppShell
      title="Rôles & habilitations"
      subtitle="Qui peut faire quoi dans le cockpit associatif"
      actions={
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un adhérent"
          className="w-56"
        />
      }
    >
      <div className="space-y-4">
        {filtered.map((member) => {
          const memberRoles = (assignments ?? []).filter((a) => a.user_id === member.id);
          const memberFunctions = (functions ?? []).filter((f) => f.user_id === member.id);
          return (
            <div key={member.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{memberFullName(member)}</p>
                  <p className="text-xs text-muted-foreground">{member.email ?? "—"}</p>
                </div>
                <Badge variant="outline">{member.membership_status}</Badge>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <ShieldCheck className="size-3.5" /> Rôles système
                  </p>
                  <div className="mb-2 flex flex-wrap gap-2">
                    {memberRoles.length === 0 ? (
                      <span className="text-sm text-muted-foreground">Aucun rôle</span>
                    ) : (
                      memberRoles.map((a) => (
                        <Badge key={a.id} className="gap-1">
                          {(a.roles as { name?: string } | null)?.name ?? "Rôle"}
                          <button
                            onClick={() => void removeRole(a.id, member.id)}
                            aria-label="Retirer le rôle"
                          >
                            <X className="size-3" />
                          </button>
                        </Badge>
                      ))
                    )}
                  </div>
                  <Select onValueChange={(value) => void addRole(member.id, value)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Attribuer un rôle" />
                    </SelectTrigger>
                    <SelectContent>
                      {(roles ?? []).map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Fonctions associatives
                  </p>
                  <div className="mb-2 flex flex-wrap gap-2">
                    {memberFunctions.length === 0 ? (
                      <span className="text-sm text-muted-foreground">Aucune fonction</span>
                    ) : (
                      memberFunctions.map((f) => (
                        <Badge key={f.id} variant="secondary" className="gap-1">
                          {MEMBER_FUNCTION_LABEL[f.function_type] ?? f.function_type}
                          <button
                            onClick={() => void endFunction(f.id)}
                            aria-label="Clôturer la fonction"
                          >
                            <X className="size-3" />
                          </button>
                        </Badge>
                      ))
                    )}
                  </div>
                  <Select onValueChange={(value) => void addFunction(member.id, value)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Ajouter une fonction" />
                    </SelectTrigger>
                    <SelectContent>
                      {FUNCTION_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {MEMBER_FUNCTION_LABEL[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun adhérent trouvé.</p>
        ) : null}
      </div>

      <div className="mt-8 rounded-lg border border-border bg-muted/40 p-4">
        <p className="text-sm font-medium">Référentiel des rôles</p>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          {(roles ?? []).map((role) => (
            <li key={role.id}>
              <span className="font-medium text-foreground">{role.name}</span> — {role.description}
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}

export default RolesPage;
