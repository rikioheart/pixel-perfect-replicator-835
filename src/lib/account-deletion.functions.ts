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
    const res = result as { status: string; blockers?: unknown };
    if (res.status === "DELETED") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.auth.admin.updateUserById(context.userId, { ban_duration: "876000h" });
    }
    return res;
  });
