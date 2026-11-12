import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { BadgeCheck, ChevronDown, CircleHelp, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  HIDDEN_PERMISSION_MODULES,
  PERMISSION_MODULE_LABEL,
  fetchPermissions,
  fetchRolePermissions,
  groupByModule,
} from "@/lib/permissions";
import {
  ROLE_SHORT_LABEL,
  defaultGrantsFor,
  defaultState,
  sortRoles,
} from "@/lib/permission-defaults";
import { humanizeError } from "@/lib/user-messages";

export const Route = createFileRoute("/_authenticated/admin/permissions")({
  head: () => ({
    meta: [
      { title: "Permissions — La Voix du Chien" },
      {
        name: "description",
        content:
          "Architecture de permissions par thème : qui peut faire quoi, rôle par rôle, avec historique de chaque modification.",
      },
      { property: "og:title", content: "Permissions — La Voix du Chien" },
      {
        property: "og:description",
        content: "Attribuer finement chaque droit à chaque rôle de l'association.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PermissionsPage,
});

type Role = { id: string; code: string; name: string };

function PermissionsPage() {
  const { isBureau } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [resetRole, setResetRole] = useState<Role | null>(null);

  const { data: rawRoles = [] } = useQuery({
    queryKey: ["roles"],
    enabled: isBureau,
    queryFn: async () => {
      const { data, error } = await supabase.from("roles").select("id, code, name").order("code");
      if (error) throw new Error(error.message);
      return (data ?? []) as Role[];
    },
  });
  const roles = useMemo(() => sortRoles(rawRoles), [rawRoles]);

  const { data: permissions = [] } = useQuery({
    queryKey: ["permissions"],
    enabled: isBureau,
    queryFn: fetchPermissions,
  });

  const { data: links = [] } = useQuery({
    queryKey: ["role-permissions"],
    enabled: isBureau,
    queryFn: fetchRolePermissions,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
    void queryClient.invalidateQueries({ queryKey: ["my-permissions"] });
  };

  // Chaque écriture est journalisée par la base (déclencheur), jamais par l'interface.
  const toggle = useMutation({
    mutationFn: async (input: { role: Role; permissionId: string; granted: boolean }) => {
      if (input.role.code === "ADMIN_BUREAU")
        throw new Error("Le Bureau conserve toutes les permissions.");
      if (input.granted) {
        const { error } = await supabase
          .from("role_permissions")
          .insert({ role_id: input.role.id, permission_id: input.permissionId });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from("role_permissions")
          .delete()
          .eq("role_id", input.role.id)
          .eq("permission_id", input.permissionId);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: refresh,
    onError: (error: Error) => toast.error(humanizeError(error)),
  });

  const toggleScope = useMutation({
    mutationFn: async (input: {
      roleId: string;
      permissionId: string;
      requiresProfessional: boolean;
    }) => {
      const { error } = await supabase
        .from("role_permissions")
        .update({ requires_professional: input.requiresProfessional })
        .eq("role_id", input.roleId)
        .eq("permission_id", input.permissionId);
      if (error) throw new Error(error.message);
    },
    onSuccess: refresh,
    onError: (error: Error) => toast.error(humanizeError(error)),
  });

  const reset = useMutation({
    mutationFn: async (role: Role) => {
      const grants = defaultGrantsFor(role.code);
      if (!grants) return;
      const byCode = new Map(permissions.map((p) => [p.code, p.id]));
      const wanted = new Map(
        grants
          .filter((g) => byCode.has(g.code))
          .map((g) => [byCode.get(g.code)!, g.requiresProfessional]),
      );
      const current = links.filter((l) => l.role_id === role.id);
      const toRemove = current
        .filter((l) => !wanted.has(l.permission_id))
        .map((l) => l.permission_id);
      if (toRemove.length) {
        const { error } = await supabase
          .from("role_permissions")
          .delete()
          .eq("role_id", role.id)
          .in("permission_id", toRemove);
        if (error) throw new Error(error.message);
      }
      const currentIds = new Set(current.map((l) => l.permission_id));
      const toAdd = [...wanted].filter(([id]) => !currentIds.has(id));
      if (toAdd.length) {
        const { error } = await supabase.from("role_permissions").insert(
          toAdd.map(([id, pro]) => ({
            role_id: role.id,
            permission_id: id,
            requires_professional: pro,
          })),
        );
        if (error) throw new Error(error.message);
      }
      for (const l of current) {
        const pro = wanted.get(l.permission_id);
        if (pro !== undefined && pro !== l.requires_professional) {
          const { error } = await supabase
            .from("role_permissions")
            .update({ requires_professional: pro })
            .eq("role_id", role.id)
            .eq("permission_id", l.permission_id);
          if (error) throw new Error(error.message);
        }
      }
    },
    onSuccess: () => {
      toast.success("Droits par défaut rétablis.");
      setResetRole(null);
      refresh();
    },
    onError: (error: Error) => toast.error(humanizeError(error)),
  });

  const linkMap = useMemo(
    () => new Map(links.map((l) => [`${l.role_id}:${l.permission_id}`, l])),
    [links],
  );

  const term = search.trim().toLowerCase();
  const modules = useMemo(() => {
    const shown = permissions.filter((p) => !HIDDEN_PERMISSION_MODULES.has(p.module));
    const filtered = term
      ? shown.filter((p) =>
          `${p.name} ${p.code} ${p.description ?? ""}`.toLowerCase().includes(term),
        )
      : shown;
    return groupByModule(filtered);
  }, [permissions, term]);

  if (!isBureau) {
    return (
      <AppShell title="Permissions" subtitle="Accès réservé au Bureau">
        <p className="text-sm text-muted-foreground">
          Seul le Bureau peut faire évoluer l'architecture des permissions.
        </p>
      </AppShell>
    );
  }

  const shownRoles = roleFilter === "ALL" ? roles : roles.filter((r) => r.id === roleFilter);
  const selectedRole =
    roleFilter === "ALL" ? null : (roles.find((r) => r.id === roleFilter) ?? null);
  const gaps = (role: Role) =>
    permissions.filter((p) => {
      const link = linkMap.get(`${role.id}:${p.id}`);
      const actual = !link ? "none" : link.requires_professional ? "pro" : "granted";
      return actual !== defaultState(role.code, p.code);
    }).length;

  return (
    <AppShell
      title="Architecture des permissions"
      subtitle="Un droit = une action précise, attribuée à un rôle"
    >
      <div className="space-y-4">
        <HowItWorks />

        <div className="panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une permission"
              aria-label="Rechercher une permission"
              className="pl-9"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="sm:w-56" aria-label="Filtrer par rôle">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous les rôles</SelectItem>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedRole && selectedRole.code !== "ADMIN_BUREAU" ? (
          <div className="panel flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
            <span className="text-muted-foreground">
              {gaps(selectedRole) === 0
                ? `« ${selectedRole.name} » suit les droits par défaut.`
                : `« ${selectedRole.name} » s'écarte des droits par défaut sur ${gaps(selectedRole)} point(s), marqués d'un point.`}
            </span>
            {gaps(selectedRole) > 0 ? (
              <Button size="sm" variant="outline" onClick={() => setResetRole(selectedRole)}>
                Rétablir les droits par défaut
              </Button>
            ) : null}
          </div>
        ) : null}

        {modules.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune permission ne correspond à « {search} ».
          </p>
        ) : (
          <Accordion
            type="multiple"
            key={term ? "search" : "browse"}
            defaultValue={term ? modules.map(([m]) => m) : []}
            className="panel divide-y divide-border px-0"
          >
            {modules.map(([module, modulePermissions]) => {
              const grantedCount = selectedRole
                ? modulePermissions.filter((p) => linkMap.has(`${selectedRole.id}:${p.id}`)).length
                : null;
              return (
                <AccordionItem key={module} value={module} className="border-0">
                  <AccordionTrigger className="px-4 hover:no-underline">
                    <span className="flex items-center gap-2">
                      {PERMISSION_MODULE_LABEL[module] ?? module}
                      <Badge variant="outline">
                        {grantedCount === null
                          ? modulePermissions.length
                          : `${grantedCount}/${modulePermissions.length}`}
                      </Badge>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pb-0">
                    <div className="overflow-x-auto">
                      <table
                        className={`w-full text-sm ${shownRoles.length > 2 ? "min-w-[760px]" : ""}`}
                      >
                        <thead>
                          <tr className="border-y border-border text-left text-xs text-muted-foreground">
                            <th className="p-3 font-medium">Permission</th>
                            {shownRoles.map((role) => (
                              <th
                                key={role.id}
                                className="p-3 text-center font-medium"
                                title={role.name}
                              >
                                {ROLE_SHORT_LABEL[role.code] ?? role.name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {modulePermissions.map((permission) => (
                            <tr
                              key={permission.id}
                              className="border-b border-border/60 last:border-0"
                            >
                              <td className="p-3">
                                <p>{permission.name}</p>
                                <p className="text-xs text-muted-foreground">{permission.code}</p>
                              </td>
                              {shownRoles.map((role) => {
                                const link = linkMap.get(`${role.id}:${permission.id}`);
                                const actual = !link
                                  ? "none"
                                  : link.requires_professional
                                    ? "pro"
                                    : "granted";
                                const differs = actual !== defaultState(role.code, permission.code);
                                const locked = role.code === "ADMIN_BUREAU";
                                return (
                                  <td key={role.id} className="p-3 text-center align-top">
                                    <div className="flex flex-col items-center gap-1">
                                      <div className="flex items-center gap-1">
                                        <Switch
                                          checked={Boolean(link)}
                                          aria-label={`${permission.name} pour ${role.name}`}
                                          disabled={locked || toggle.isPending}
                                          onCheckedChange={(next) =>
                                            toggle.mutate({
                                              role,
                                              permissionId: permission.id,
                                              granted: next,
                                            })
                                          }
                                        />
                                        {differs ? (
                                          <span
                                            className="size-1.5 rounded-full bg-primary"
                                            title="Différent du réglage par défaut"
                                            aria-label="Différent du réglage par défaut"
                                          />
                                        ) : null}
                                      </div>
                                      {link && !locked ? (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            toggleScope.mutate({
                                              roleId: role.id,
                                              permissionId: permission.id,
                                              requiresProfessional: !link.requires_professional,
                                            })
                                          }
                                          className={`rounded-full px-2 py-0.5 text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                            link.requires_professional
                                              ? "bg-primary-tint text-primary"
                                              : "text-muted-foreground hover:text-foreground"
                                          }`}
                                          aria-pressed={link.requires_professional}
                                          title="Réserver ce droit aux professionnels validés"
                                        >
                                          {link.requires_professional ? "Pros validés" : "Tous"}
                                        </button>
                                      ) : null}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}

        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" />
          Chaque modification est inscrite dans l'
          <Link to="/admin/audit" className="underline underline-offset-2">
            historique
          </Link>
          .
        </p>
      </div>

      <AlertDialog open={resetRole !== null} onOpenChange={(open) => !open && setResetRole(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rétablir les droits par défaut ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les droits du rôle « {resetRole?.name} » reviendront au réglage prévu par les statuts.
              Chaque changement sera inscrit dans l'historique.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reset.isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={reset.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (resetRole) reset.mutate(resetRole);
              }}
            >
              Rétablir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function HowItWorks() {
  return (
    <Collapsible className="panel">
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 p-4 text-left text-sm font-medium">
        <span className="flex items-center gap-2">
          <CircleHelp className="size-4 text-primary" /> Comment ça marche ?
        </span>
        <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 border-t border-border px-4 pb-4 pt-3 text-sm text-muted-foreground">
        <div>
          <p className="font-medium text-foreground">Le principe</p>
          <p>
            Chaque membre reçoit un ou plusieurs rôles (Bureau, Fondateur, Bienfaiteur, Apprenant,
            Soutien, Particulier…). Ses droits sont la somme des droits de ses rôles. Les rôles
            s'attribuent dans « Rôles & habilitations ».
          </p>
        </div>
        <div>
          <p className="font-medium text-foreground">Modifier une permission</p>
          <p>
            Ouvrez un thème, puis activez ou coupez l'interrupteur du rôle concerné. « Tous » ou «
            Pros validés » précise si le droit vaut pour tout le rôle ou seulement pour les
            professionnels validés par le Bureau. Un point signale un écart avec le réglage par
            défaut ; filtrez sur un rôle pour le rétablir.
          </p>
        </div>
        <div>
          <p className="flex items-center gap-1.5 font-medium text-foreground">
            <BadgeCheck className="size-4" /> Règles de sécurité
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Le Bureau garde toujours tous les droits ; sa colonne est verrouillée.</li>
            <li>
              Les finances et la validation des adhésions exigent en plus d'être au Bureau : donner
              ces droits à un autre rôle n'ouvre rien.
            </li>
            <li>Les règles sont appliquées par la base de données, pas seulement par l'écran.</li>
            <li>Chaque changement est daté et attribué dans l'historique.</li>
          </ul>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
