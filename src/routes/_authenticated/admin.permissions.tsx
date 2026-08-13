import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { logAudit } from "@/lib/mindmap-actions";
import {
  PERMISSION_MODULE_LABEL,
  fetchPermissions,
  fetchRolePermissions,
  groupByModule,
} from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/admin/permissions")({
  head: () => ({
    meta: [
      { title: "Permissions — La Voix du Chien" },
      {
        name: "description",
        content:
          "Architecture de permissions par module : adhérents, projets, tâches, finances, fidélité, terrain, documents et paramétrage.",
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

function PermissionsPage() {
  const { isBureau, user } = useAuth();
  const queryClient = useQueryClient();

  const { data: roles = [] } = useQuery({
    queryKey: ["roles"],
    enabled: isBureau,
    queryFn: async () => {
      const { data, error } = await supabase.from("roles").select("id, code, name").order("code");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

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

  const toggle = useMutation({
    mutationFn: async ({
      roleId,
      roleCode,
      permissionId,
      permissionCode,
      granted,
    }: {
      roleId: string;
      roleCode: string;
      permissionId: string;
      permissionCode: string;
      granted: boolean;
    }) => {
      if (roleCode === "ADMIN_BUREAU" && !granted) {
        throw new Error("Le Bureau conserve toutes les permissions.");
      }
      if (granted) {
        const { error } = await supabase
          .from("role_permissions")
          .insert({ role_id: roleId, permission_id: permissionId });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from("role_permissions")
          .delete()
          .eq("role_id", roleId)
          .eq("permission_id", permissionId);
        if (error) throw new Error(error.message);
      }
      await logAudit({
        actorId: user?.id ?? null,
        action: granted ? "PERMISSION_GRANTED" : "PERMISSION_REVOKED",
        entityType: "role_permission",
        entityId: roleId,
        newValues: { role: roleCode, permission: permissionCode, granted },
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["role-permissions"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  if (!isBureau) {
    return (
      <AppShell title="Permissions" subtitle="Accès réservé au Bureau">
        <p className="text-sm text-muted-foreground">
          Seul le Bureau peut faire évoluer l'architecture des permissions.
        </p>
      </AppShell>
    );
  }

  const linked = new Set(links.map((l) => `${l.role_id}:${l.permission_id}`));
  const modules = groupByModule(permissions);

  return (
    <AppShell
      title="Architecture des permissions"
      subtitle="Un droit = une action précise, attribuable à chaque rôle indépendamment du niveau d'accès"
    >
      <div className="space-y-4">
        <div className="panel flex flex-wrap items-center gap-3 p-4 text-sm text-muted-foreground">
          <ShieldCheck className="size-4 text-primary" />
          <span>
            {permissions.length} permissions réparties sur {modules.length} modules ·{" "}
            {roles.length} rôles.
          </span>
        </div>

        {modules.map(([module, modulePermissions]) => (
          <section key={module} className="panel overflow-x-auto">
            <div className="flex items-center gap-2 border-b border-border p-4">
              <KeyRound className="size-4 text-muted-foreground" />
              <h2 className="text-base">{PERMISSION_MODULE_LABEL[module] ?? module}</h2>
              <Badge variant="outline">{modulePermissions.length}</Badge>
            </div>
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="p-3">Permission</th>
                  {roles.map((role) => (
                    <th key={role.id} className="p-3 text-center font-medium">
                      {role.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modulePermissions.map((permission) => (
                  <tr key={permission.id} className="border-b border-border/60 last:border-0">
                    <td className="p-3">
                      <p>{permission.name}</p>
                      <p className="text-xs text-muted-foreground">{permission.code}</p>
                    </td>
                    {roles.map((role) => {
                      const checked = linked.has(`${role.id}:${permission.id}`);
                      return (
                        <td key={role.id} className="p-3 text-center">
                          <Switch
                            checked={checked}
                            aria-label={`${permission.code} pour ${role.name}`}
                            disabled={role.code === "ADMIN_BUREAU"}
                            onCheckedChange={(next) =>
                              toggle.mutate({
                                roleId: role.id,
                                roleCode: role.code,
                                permissionId: permission.id,
                                permissionCode: permission.code,
                                granted: next,
                              })
                            }
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
