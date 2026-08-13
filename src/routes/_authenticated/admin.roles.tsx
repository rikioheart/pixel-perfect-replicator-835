import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
/** Fonctions statutaires uniques dans l'association. */
const UNIQUE_FUNCTIONS = ["PRESIDENT", "SECRETARY", "TREASURER"];

type Pending =
  | { kind: "role.assign"; userId: string; userName: string; roleId: string; roleName: string }
  | { kind: "role.revoke"; userId: string; userName: string; assignmentId: string; roleName: string }
  | { kind: "function.assign"; userId: string; userName: string; functionType: string }
  | { kind: "function.revoke"; userId: string; userName: string; functionId: string; functionType: string };

function RolesPage() {
  const { isBureau, user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);

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
    void queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
  };

  const bureauRoleCount = useMemo(
    () =>
      (assignments ?? []).filter(
        (a) => (a.roles as { code?: string } | null)?.code === "ADMIN_BUREAU",
      ).length,
    [assignments],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return members ?? [];
    return (members ?? []).filter((m) =>
      `${memberFullName(m)} ${m.email ?? ""}`.toLowerCase().includes(term),
    );
  }, [members, search]);

  const logAction = async (
    action: string,
    userId: string,
    values: Record<string, unknown>,
    summary: string,
  ) => {
    await supabase.from("audit_logs").insert({
      actor_id: user?.id ?? null,
      action,
      entity_type: action.startsWith("role") ? "user_roles" : "member_functions",
      entity_id: userId,
      new_values: values as never,
      metadata: { summary } as never,
    });
  };

  const mutation = useMutation({
    mutationFn: async (task: Pending) => {
      if (task.kind === "role.assign") {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: task.userId, role_id: task.roleId, assigned_by: user?.id ?? null });
        if (error)
          throw new Error(
            error.message.includes("duplicate") ? "Ce rôle est déjà attribué." : error.message,
          );
        await logAction(
          "role.assign",
          task.userId,
          { role_id: task.roleId },
          `Rôle « ${task.roleName} » attribué à ${task.userName}`,
        );
        return `Rôle « ${task.roleName} » attribué.`;
      }
      if (task.kind === "role.revoke") {
        const { error } = await supabase.from("user_roles").delete().eq("id", task.assignmentId);
        if (error) throw new Error(error.message);
        await logAction(
          "role.revoke",
          task.userId,
          { assignment_id: task.assignmentId },
          `Rôle « ${task.roleName} » retiré à ${task.userName}`,
        );
        return `Rôle « ${task.roleName} » retiré.`;
      }
      if (task.kind === "function.assign") {
        const { error } = await supabase
          .from("member_functions")
          .insert({ user_id: task.userId, function_type: task.functionType, active: true });
        if (error) throw new Error(error.message);
        await logAction(
          "function.assign",
          task.userId,
          { function_type: task.functionType },
          `Fonction « ${MEMBER_FUNCTION_LABEL[task.functionType]} » attribuée à ${task.userName}`,
        );
        return "Fonction ajoutée.";
      }
      const { error } = await supabase
        .from("member_functions")
        .update({ active: false, end_date: new Date().toISOString().slice(0, 10) })
        .eq("id", task.functionId);
      if (error) throw new Error(error.message);
      await logAction(
        "function.revoke",
        task.userId,
        { function_id: task.functionId },
        `Fonction « ${MEMBER_FUNCTION_LABEL[task.functionType]} » clôturée pour ${task.userName}`,
      );
      return "Fonction clôturée.";
    },
    onSuccess: (message) => {
      toast.success(message);
      invalidate();
      setPending(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!isBureau) {
    return (
      <AppShell title="Rôles & habilitations" subtitle="Accès réservé au Bureau">
        <p className="text-sm text-muted-foreground">
          Cette page est réservée aux membres du Bureau.
        </p>
      </AppShell>
    );
  }

  /** Validations métier avant ouverture de la confirmation. */
  const request = (task: Pending) => {
    if (task.kind === "role.assign") {
      const already = (assignments ?? []).some(
        (a) => a.user_id === task.userId && a.role_id === task.roleId,
      );
      if (already) {
        toast.error("Ce rôle est déjà attribué à cet adhérent.");
        return;
      }
    }
    if (task.kind === "role.revoke") {
      const isAdminRole = (assignments ?? []).find((a) => a.id === task.assignmentId);
      const code = (isAdminRole?.roles as { code?: string } | null)?.code;
      if (code === "ADMIN_BUREAU" && bureauRoleCount <= 1) {
        toast.error("Impossible : au moins un administrateur du Bureau doit rester en place.");
        return;
      }
      if (code === "ADMIN_BUREAU" && task.userId === user?.id) {
        toast.error("Vous ne pouvez pas retirer votre propre rôle d'administrateur.");
        return;
      }
    }
    if (task.kind === "function.assign") {
      const duplicate = (functions ?? []).some(
        (f) => f.user_id === task.userId && f.function_type === task.functionType,
      );
      if (duplicate) {
        toast.error("Cette fonction est déjà active pour cet adhérent.");
        return;
      }
      if (UNIQUE_FUNCTIONS.includes(task.functionType)) {
        const holder = (functions ?? []).find((f) => f.function_type === task.functionType);
        if (holder) {
          const name = memberFullName(
            (members ?? []).find((m) => m.id === holder.user_id) ?? { display_name: null },
          );
          toast.error(
            `La fonction « ${MEMBER_FUNCTION_LABEL[task.functionType]} » est déjà occupée par ${name}. Clôturez-la d'abord.`,
          );
          return;
        }
      }
    }
    setPending(task);
  };

  const confirmText = (task: Pending) => {
    switch (task.kind) {
      case "role.assign":
        return `Attribuer le rôle « ${task.roleName} » à ${task.userName} ?`;
      case "role.revoke":
        return `Retirer le rôle « ${task.roleName} » à ${task.userName} ?`;
      case "function.assign":
        return `Attribuer la fonction « ${MEMBER_FUNCTION_LABEL[task.functionType]} » à ${task.userName} ?`;
      default:
        return `Clôturer la fonction « ${MEMBER_FUNCTION_LABEL[task.functionType]} » de ${task.userName} ?`;
    }
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
          const name = memberFullName(member);
          return (
            <div key={member.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{name}</p>
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
                      memberRoles.map((a) => {
                        const roleName = (a.roles as { name?: string } | null)?.name ?? "Rôle";
                        return (
                          <Badge key={a.id} className="gap-1">
                            {roleName}
                            <button
                              onClick={() =>
                                request({
                                  kind: "role.revoke",
                                  userId: member.id,
                                  userName: name,
                                  assignmentId: a.id,
                                  roleName,
                                })
                              }
                              aria-label={`Retirer le rôle ${roleName}`}
                            >
                              <X className="size-3" />
                            </button>
                          </Badge>
                        );
                      })
                    )}
                  </div>
                  <Select
                    value=""
                    onValueChange={(value) => {
                      const role = (roles ?? []).find((r) => r.id === value);
                      if (!role) return;
                      request({
                        kind: "role.assign",
                        userId: member.id,
                        userName: name,
                        roleId: role.id,
                        roleName: role.name,
                      });
                    }}
                  >
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
                            onClick={() =>
                              request({
                                kind: "function.revoke",
                                userId: member.id,
                                userName: name,
                                functionId: f.id,
                                functionType: f.function_type,
                              })
                            }
                            aria-label="Clôturer la fonction"
                          >
                            <X className="size-3" />
                          </button>
                        </Badge>
                      ))
                    )}
                  </div>
                  <Select
                    value=""
                    onValueChange={(value) =>
                      request({
                        kind: "function.assign",
                        userId: member.id,
                        userName: name,
                        functionType: value,
                      })
                    }
                  >
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

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer l'habilitation</AlertDialogTitle>
            <AlertDialogDescription>
              {pending ? confirmText(pending) : null} Cette action est tracée dans le journal
              d'activité.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={mutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (pending) mutation.mutate(pending);
              }}
            >
              {mutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

export default RolesPage;
