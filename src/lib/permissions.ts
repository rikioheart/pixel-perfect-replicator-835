import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type Permission = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  module: string;
  action: string;
};

/** Libellés des modules de l'architecture de permissions. */
export const PERMISSION_MODULE_LABEL: Record<string, string> = {
  members: "Adhérents",
  profiles: "Profils",
  projects: "Projets",
  tasks: "Tâches",
  events: "Événements",
  activities: "Activités",
  partners: "Partenaires",
  finance: "Finances",
  reimbursements: "Remboursements",
  loyalty: "Fidélité",
  terrain: "Terrain",
  documents: "Documents",
  mindmap: "Mindmap",
  settings: "Paramétrage",
  users: "Utilisateurs",
  audit: "Journal",
};

export const PERMISSION_MODULE_ORDER = Object.keys(PERMISSION_MODULE_LABEL);

/** Modules retirés de l'interface (droits conservés en base, jamais proposés à l'écran). */
export const HIDDEN_PERMISSION_MODULES = new Set(["terrain"]);

export async function fetchPermissions(): Promise<Permission[]> {
  const { data, error } = await supabase
    .from("permissions")
    .select("id, code, name, description, module, action")
    .order("module")
    .order("code");
  if (error) throw new Error(error.message);
  return (data ?? []) as Permission[];
}

export type RolePermissionLink = {
  role_id: string;
  permission_id: string;
  requires_professional: boolean;
};

export async function fetchRolePermissions(): Promise<RolePermissionLink[]> {
  const { data, error } = await supabase
    .from("role_permissions")
    .select("role_id, permission_id, requires_professional");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export function groupByModule(permissions: Permission[]) {
  const groups = new Map<string, Permission[]>();
  for (const permission of permissions) {
    const list = groups.get(permission.module) ?? [];
    list.push(permission);
    groups.set(permission.module, list);
  }
  return [...groups.entries()].sort(
    (a, b) => PERMISSION_MODULE_ORDER.indexOf(a[0]) - PERMISSION_MODULE_ORDER.indexOf(b[0]),
  );
}

/**
 * Permissions effectives de l'utilisateur connecté (union de ses rôles).
 * Le Bureau conserve un accès complet quoi qu'il arrive.
 */
export function useMyPermissions() {
  const { user, isBureau, isPro } = useAuth();
  const query = useQuery({
    queryKey: ["my-permissions", user?.id, isPro],
    enabled: Boolean(user?.id),
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role_permissions:roles(role_permissions(requires_professional, permissions(code)))")
        .eq("user_id", user!.id);
      if (error) throw new Error(error.message);
      const codes = new Set<string>();
      for (const row of (data ?? []) as unknown as {
        role_permissions: {
          role_permissions: { requires_professional: boolean; permissions: { code: string } | null }[];
        } | null;
      }[]) {
        for (const rp of row.role_permissions?.role_permissions ?? []) {
          // Miroir de has_permission : un droit « pro » ne vaut que pour un pro validé.
          if (rp.requires_professional && !isPro) continue;
          if (rp.permissions?.code) codes.add(rp.permissions.code);
        }
      }
      return [...codes];
    },
  });

  const codes = query.data ?? [];
  const can = (code: string) => isBureau || codes.includes(code);
  /** Droit sensible : Bureau ET permission explicite, comme bureau_has_permission en base. */
  const has = (code: string) => isBureau && codes.includes(code);
  return { ...query, codes, can, has };
}

export type FinanceRights = {
  ready: boolean;
  viewGlobal: boolean;
  create: boolean;
  update: boolean;
  validateReimbursements: boolean;
  markPaid: boolean;
  validateMembers: boolean;
};

/** Droits financiers et d'adhésion effectifs ; la base reste la frontière réelle (RLS + déclencheurs). */
export function useSensitiveRights(): FinanceRights {
  const { rolesReady, isBureau } = useAuth();
  const { has, isSuccess, isError } = useMyPermissions();
  const ready = rolesReady && (!isBureau || isSuccess || isError);
  return {
    ready,
    viewGlobal: has("finance.view_global"),
    create: has("finance.create"),
    update: has("finance.update"),
    validateReimbursements: has("reimbursements.validate"),
    markPaid: has("reimbursements.mark_paid"),
    validateMembers: has("members.validate"),
  };
}
