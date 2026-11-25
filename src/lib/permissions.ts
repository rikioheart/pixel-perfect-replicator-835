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
 * Permissions effectives du compte, calculées par la même règle que la base.
 * Les retraits individuels priment sur les rôles, y compris pour le Bureau.
 */
export function useMyPermissions() {
  const { user, isBureau, isPro } = useAuth();
  const query = useQuery({
    queryKey: ["my-permissions", user?.id, isPro],
    enabled: Boolean(user?.id),
    staleTime: 60_000,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.rpc("my_permission_codes");
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => row.code);
    },
  });

  const codes = user && query.isSuccess ? query.data : [];
  const can = (code: string) => codes.includes(code);
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
