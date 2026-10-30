import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Clôture du compte : la base vérifie les dépendances et anonymise (en tant que l'utilisateur),
 * puis l'accès de connexion est désactivé. Traces financières et comptes rendus conservés.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ confirm: z.string().max(20) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("request_account_deletion", { _confirm: data.confirm });
    if (error) throw new Error(error.message);
    const res = { status: String((result as { status?: string } | null)?.status ?? "") };
    if (res.status === "DELETED") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.auth.admin.updateUserById(context.userId, { ban_duration: "876000h" });
    }
    return res;
  });

/**
 * Départ sans démarche du membre (conflit, sans nouvelles) : le Bureau clôture le compte.
 * Les droits sont vérifiés par la base (bureau_close_account, en tant que l'appelant) ;
 * la désactivation de connexion n'a lieu qu'après cette vérification réussie.
 */
export const closeMemberAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ profileId: z.string().uuid(), reason: z.string().trim().min(5).max(500), confirm: z.string().max(20) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("bureau_close_account", {
      _profile_id: data.profileId, _reason: data.reason, _confirm: data.confirm,
    });
    if (error) throw new Error(error.message);
    const r = (result ?? {}) as { status?: string; projects?: number; tasks?: number; dogs?: number; open_reimbursements?: number };
    if (r.status === "CLOSED" || r.status === "ALREADY_CLOSED") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.auth.admin.updateUserById(data.profileId, { ban_duration: "876000h" });
    }
    return {
      status: String(r.status ?? ""),
      projects: Number(r.projects ?? 0),
      tasks: Number(r.tasks ?? 0),
      dogs: Number(r.dogs ?? 0),
      openReimbursements: Number(r.open_reimbursements ?? 0),
    };
  });
