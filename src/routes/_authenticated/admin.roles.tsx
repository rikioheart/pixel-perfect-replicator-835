import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronRight, Loader2, Search, ShieldCheck, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { withContacts } from "@/lib/profile-columns";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { SidePanel } from "@/components/SidePanel";
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
import {
  ASSOCIATION_FUNCTIONS,
  MEMBERSHIP_STATUS_LABEL,
  MEMBER_FUNCTION_LABEL,
  PROJECT_FUNCTIONS,
  UNIQUE_FUNCTIONS,
  memberFullName,
} from "@/lib/members";
import { ROLE_SHORT_LABEL, sortRoles } from "@/lib/permission-defaults";
import { useConfigOptions } from "@/lib/config-options";
import { logAudit } from "@/lib/mindmap-actions";

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
        content: "Gestion des habilitations et des fonctions de l'association.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RolesPage,
});

type Member = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  membership_status: string | null;
  membership_type: string | null;
  access_level: string | null;
  involvement_level: string | null;
  email?: string | null;
};
type Assignment = {
  id: string;
  user_id: string;
  role_id: string;
  roles: { code?: string; name?: string } | null;
};
type MemberFunction = {
  id: string;
  user_id: string;
  function_type: string;
  scope_type: string | null;
  scope_id: string | null;
};

type Pending =
  | { kind: "role.assign"; userId: string; userName: string; roleId: string; roleName: string }
  | {
      kind: "role.revoke";
      userId: string;
      userName: string;
      assignmentId: string;
      roleName: string;
    }
  | { kind: "function.assign"; userId: string; userName: string; functionType: string }
  | {
      kind: "function.revoke";
      userId: string;
      userName: string;
      functionId: string;
      functionType: string;
    };

const fnLabel = (type: string) => MEMBER_FUNCTION_LABEL[type] ?? type;

function RolesPage() {
  const { isBureau, user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [functionFilter, setFunctionFilter] = useState("ALL");
  const [openId, setOpenId] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);

  const { data: members = [] } = useQuery({
    queryKey: ["rbac-members"],
    enabled: isBureau,
    queryFn: async () =>
      (await withContacts(
        (
          await supabase
            .from("profiles")
            .select(
              "id, first_name, last_name, display_name, membership_status, membership_type, access_level, involvement_level",
            )
            .is("deleted_at", null)
            .order("last_name", { ascending: true })
        ).data ?? [],
      )) as Member[],
  });

  const { data: rawRoles = [] } = useQuery({
    queryKey: ["rbac-roles"],
    enabled: isBureau,
    queryFn: async () =>
      (await supabase.from("roles").select("id, code, name, description").order("code")).data ?? [],
  });
  const roles = useMemo(() => sortRoles(rawRoles), [rawRoles]);

  const { data: assignments = [] } = useQuery({
    queryKey: ["rbac-assignments"],
    enabled: isBureau,
    queryFn: async () =>
      ((await supabase.from("user_roles").select("id, user_id, role_id, roles(code, name)")).data ??
        []) as Assignment[],
  });

  const { data: functions = [] } = useQuery({
    queryKey: ["rbac-functions"],
    enabled: isBureau,
    queryFn: async () =>
      ((
        await supabase
          .from("member_functions")
          .select("id, user_id, function_type, scope_type, scope_id")
          .eq("active", true)
      ).data ?? []) as MemberFunction[],
  });

  const projectIds = useMemo(
    () => [
      ...new Set(
        functions.filter((f) => f.scope_type === "PROJECT" && f.scope_id).map((f) => f.scope_id!),
      ),
    ],
    [functions],
  );
  const { data: projectTitles = {} } = useQuery({
    queryKey: ["rbac-project-titles", projectIds],
    enabled: isBureau && projectIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id, title").in("id", projectIds);
      return Object.fromEntries((data ?? []).map((p) => [p.id, p.title as string]));
    },
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["rbac-assignments"] });
    void queryClient.invalidateQueries({ queryKey: ["rbac-functions"] });
    void queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
  };

  const bureauRoleCount = assignments.filter((a) => a.roles?.code === "ADMIN_BUREAU").length;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return members.filter((m) => {
      if (term && !`${memberFullName(m)} ${m.email ?? ""}`.toLowerCase().includes(term))
        return false;
      if (roleFilter !== "ALL") {
        const has = assignments.some((a) => a.user_id === m.id && a.role_id === roleFilter);
        if (roleFilter === "NONE" ? assignments.some((a) => a.user_id === m.id) : !has)
          return false;
      }
      if (
        functionFilter !== "ALL" &&
        !functions.some((f) => f.user_id === m.id && f.function_type === functionFilter)
      )
        return false;
      return true;
    });
  }, [members, search, roleFilter, functionFilter, assignments, functions]);

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
        if (error)
          throw new Error(
            error.code === "23505"
              ? `La fonction « ${fnLabel(task.functionType)} » est déjà occupée. Clôturez-la d'abord.`
              : error.message,
          );
        await logAction(
          "function.assign",
          task.userId,
          { function_type: task.functionType },
          `Fonction « ${fnLabel(task.functionType)} » attribuée à ${task.userName}`,
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
        `Fonction « ${fnLabel(task.functionType)} » clôturée pour ${task.userName}`,
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
    if (
      task.kind === "role.assign" &&
      assignments.some((a) => a.user_id === task.userId && a.role_id === task.roleId)
    ) {
      toast.error("Ce rôle est déjà attribué à cet adhérent.");
      return;
    }
    if (task.kind === "role.revoke") {
      const code = assignments.find((a) => a.id === task.assignmentId)?.roles?.code;
      if (code === "ADMIN_BUREAU" && bureauRoleCount <= 1) {
        toast.error("Impossible : au moins un membre du Bureau doit rester en place.");
        return;
      }
      if (code === "ADMIN_BUREAU" && task.userId === user?.id) {
        toast.error("Vous ne pouvez pas retirer votre propre rôle Bureau.");
        return;
      }
    }
    if (task.kind === "function.assign") {
      if (
        functions.some((f) => f.user_id === task.userId && f.function_type === task.functionType)
      ) {
        toast.error("Cette fonction est déjà active pour cet adhérent.");
        return;
      }
      if (UNIQUE_FUNCTIONS.includes(task.functionType)) {
        const holder = functions.find((f) => f.function_type === task.functionType);
        if (holder) {
          const name = memberFullName(
            members.find((m) => m.id === holder.user_id) ?? { display_name: null },
          );
          toast.error(
            `La fonction « ${fnLabel(task.functionType)} » est déjà occupée par ${name}. Clôturez-la d'abord.`,
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
        return `Attribuer la fonction « ${fnLabel(task.functionType)} » à ${task.userName} ?`;
      default:
        return `Clôturer la fonction « ${fnLabel(task.functionType)} » de ${task.userName} ?`;
    }
  };

  const openMember = members.find((m) => m.id === openId) ?? null;

  return (
    <AppShell title="Rôles & habilitations" subtitle="Qui peut faire quoi dans l'association">
      <div className="space-y-4">
        <div className="panel flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un membre (nom, e-mail)"
              aria-label="Rechercher un membre"
              className="pl-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:flex">
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="lg:w-48" aria-label="Filtrer par rôle">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous les rôles</SelectItem>
                <SelectItem value="NONE">Sans rôle</SelectItem>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={functionFilter} onValueChange={setFunctionFilter}>
              <SelectTrigger className="lg:w-48" aria-label="Filtrer par fonction">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Toutes les fonctions</SelectItem>
                {ASSOCIATION_FUNCTIONS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {fnLabel(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="panel overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="p-3 font-medium">Membre</th>
                <th className="hidden p-3 font-medium md:table-cell">Rôles</th>
                <th className="hidden p-3 font-medium lg:table-cell">Fonctions</th>
                <th className="hidden p-3 font-medium sm:table-cell">Adhésion</th>
                <th className="w-8 p-3" aria-hidden />
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => {
                const memberRoles = assignments.filter((a) => a.user_id === m.id);
                const memberFns = functions.filter((f) => f.user_id === m.id);
                return (
                  <tr
                    key={m.id}
                    className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-muted/40"
                    onClick={() => setOpenId(m.id)}
                  >
                    <td className="p-3">
                      <button
                        type="button"
                        className="text-left font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenId(m.id);
                        }}
                      >
                        {memberFullName(m)}
                      </button>
                      <p className="text-xs text-muted-foreground">{m.email ?? "—"}</p>
                      <p className="mt-1 text-xs text-muted-foreground md:hidden">
                        {memberRoles
                          .map((a) => ROLE_SHORT_LABEL[a.roles?.code ?? ""] ?? a.roles?.name)
                          .join(" · ") || "Aucun rôle"}
                      </p>
                    </td>
                    <td className="hidden p-3 md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {memberRoles.length === 0 ? (
                          <span className="text-xs text-muted-foreground">Aucun</span>
                        ) : (
                          memberRoles.map((a) => (
                            <Badge key={a.id} variant="secondary">
                              {ROLE_SHORT_LABEL[a.roles?.code ?? ""] ?? a.roles?.name}
                            </Badge>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="hidden p-3 text-xs text-muted-foreground lg:table-cell">
                      {memberFns.map((f) => fnLabel(f.function_type)).join(" · ") || "—"}
                    </td>
                    <td className="hidden p-3 sm:table-cell">
                      <Badge variant="outline">
                        {MEMBERSHIP_STATUS_LABEL[m.membership_status ?? ""] ??
                          m.membership_status ??
                          "—"}
                      </Badge>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      <ChevronRight className="size-4" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              Aucun membre ne correspond à ces critères.
            </p>
          ) : null}
        </div>

        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" />
          {filtered.length} membre(s). Les droits de chaque rôle se règlent dans{" "}
          <Link to="/admin/permissions" className="underline underline-offset-2">
            Permissions
          </Link>
          .
        </p>
      </div>

      <SidePanel
        open={openMember !== null}
        onOpenChange={(open) => !open && setOpenId(null)}
        title={openMember ? memberFullName(openMember) : ""}
        {...(openMember?.email ? { description: openMember.email } : {})}
      >
        {openMember ? (
          <MemberDetail
            member={openMember}
            roles={roles}
            assignments={assignments.filter((a) => a.user_id === openMember.id)}
            functions={functions.filter((f) => f.user_id === openMember.id)}
            projectTitles={projectTitles}
            onRequest={request}
          />
        ) : null}
      </SidePanel>

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer l'habilitation</AlertDialogTitle>
            <AlertDialogDescription>
              {pending ? confirmText(pending) : null} Cette action est inscrite dans l'historique.
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

function MemberDetail({
  member,
  roles,
  assignments,
  functions,
  projectTitles,
  onRequest,
}: {
  member: Member;
  roles: { id: string; code: string; name: string; description: string | null }[];
  assignments: Assignment[];
  functions: MemberFunction[];
  projectTitles: Record<string, string>;
  onRequest: (task: Pending) => void;
}) {
  const name = memberFullName(member);
  const associationFns = functions.filter((f) => !PROJECT_FUNCTIONS.includes(f.function_type));
  const projectFns = functions.filter((f) => PROJECT_FUNCTIONS.includes(f.function_type));
  const available = roles.filter((r) => !assignments.some((a) => a.role_id === r.id));
  const availableFns = ASSOCIATION_FUNCTIONS.filter(
    (t) => !functions.some((f) => f.function_type === t),
  );

  return (
    <div className="space-y-6">
      <section>
        <SectionTitle>Rôles système</SectionTitle>
        <div className="mb-2 flex flex-wrap gap-2">
          {assignments.length === 0 ? (
            <span className="text-sm text-muted-foreground">Aucun rôle</span>
          ) : (
            assignments.map((a) => {
              const roleName = a.roles?.name ?? "Rôle";
              return (
                <Badge key={a.id} className="gap-1">
                  {roleName}
                  <button
                    type="button"
                    onClick={() =>
                      onRequest({
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
        {available.length > 0 ? (
          <Select
            value=""
            onValueChange={(value) => {
              const role = roles.find((r) => r.id === value);
              if (role)
                onRequest({
                  kind: "role.assign",
                  userId: member.id,
                  userName: name,
                  roleId: role.id,
                  roleName: role.name,
                });
            }}
          >
            <SelectTrigger aria-label="Attribuer un rôle">
              <SelectValue placeholder="Attribuer un rôle" />
            </SelectTrigger>
            <SelectContent>
              {available.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {member.membership_type === "PROFESSIONNEL" ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Professionnel : le rôle « Membre bienfaiteur » lui ouvre les outils pro une fois son
            adhésion validée par le Bureau.
          </p>
        ) : null}
      </section>

      <section>
        <SectionTitle>Fonctions associatives</SectionTitle>
        <div className="mb-2 flex flex-wrap gap-2">
          {associationFns.length === 0 ? (
            <span className="text-sm text-muted-foreground">Aucune fonction</span>
          ) : (
            associationFns.map((f) => (
              <Badge key={f.id} variant="secondary" className="gap-1">
                {fnLabel(f.function_type)}
                <button
                  type="button"
                  onClick={() =>
                    onRequest({
                      kind: "function.revoke",
                      userId: member.id,
                      userName: name,
                      functionId: f.id,
                      functionType: f.function_type,
                    })
                  }
                  aria-label={`Clôturer la fonction ${fnLabel(f.function_type)}`}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))
          )}
        </div>
        {availableFns.length > 0 ? (
          <Select
            value=""
            onValueChange={(value) =>
              onRequest({
                kind: "function.assign",
                userId: member.id,
                userName: name,
                functionType: value,
              })
            }
          >
            <SelectTrigger aria-label="Ajouter une fonction">
              <SelectValue placeholder="Ajouter une fonction" />
            </SelectTrigger>
            <SelectContent>
              {availableFns.map((type) => (
                <SelectItem key={type} value={type}>
                  {fnLabel(type)}
                  {UNIQUE_FUNCTIONS.includes(type) ? " (unique)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </section>

      {projectFns.length > 0 ? (
        <section>
          <SectionTitle>Responsabilités de projet</SectionTitle>
          <ul className="space-y-1 text-sm">
            {projectFns.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{fnLabel(f.function_type)}</Badge>
                {f.scope_type === "PROJECT" && f.scope_id ? (
                  <Link
                    to="/projects/$projectId"
                    params={{ projectId: f.scope_id }}
                    className="text-muted-foreground underline underline-offset-2"
                  >
                    {projectTitles[f.scope_id] ?? "Voir le projet"}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-muted-foreground">Se gèrent depuis la page du projet.</p>
        </section>
      ) : null}

      <MemberLevels
        memberId={member.id}
        memberName={name}
        accessLevel={member.access_level ?? "STANDARD"}
        involvementLevel={member.involvement_level ?? null}
      />
    </div>
  );
}

/**
 * Niveau d'accès et niveau d'implication sont volontairement séparés du rôle
 * et des fonctions associatives : ils se cumulent sans s'écraser.
 */
function MemberLevels({
  memberId,
  memberName,
  accessLevel,
  involvementLevel,
}: {
  memberId: string;
  memberName: string;
  accessLevel: string;
  involvementLevel: string | null;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const access = useConfigOptions("ACCESS_LEVEL");
  const involvement = useConfigOptions("INVOLVEMENT_LEVEL");

  const save = async (patch: { access_level?: string; involvement_level?: string }) => {
    const { error } = await supabase.from("profiles").update(patch).eq("id", memberId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAudit({
      actorId: user?.id ?? null,
      action: "MEMBER_LEVEL_UPDATED",
      entityType: "profile",
      entityId: memberId,
      newValues: patch,
      metadata: { member_name: memberName },
    });
    toast.success("Niveau mis à jour.");
    await queryClient.invalidateQueries({ queryKey: ["rbac-members"] });
  };

  return (
    <section className="grid gap-4 sm:grid-cols-2">
      <div>
        <SectionTitle>Niveau d'accès</SectionTitle>
        <Select value={accessLevel} onValueChange={(value) => save({ access_level: value })}>
          <SelectTrigger aria-label="Niveau d'accès">
            <SelectValue placeholder="Niveau d'accès" />
          </SelectTrigger>
          <SelectContent>
            {access.options.map((option) => (
              <SelectItem key={option.id} value={option.code}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <SectionTitle>Niveau d'implication</SectionTitle>
        <Select
          value={involvementLevel ?? ""}
          onValueChange={(value) => save({ involvement_level: value })}
        >
          <SelectTrigger aria-label="Niveau d'implication">
            <SelectValue placeholder="Niveau d'implication" />
          </SelectTrigger>
          <SelectContent>
            {involvement.options.map((option) => (
              <SelectItem key={option.id} value={option.code}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </section>
  );
}
