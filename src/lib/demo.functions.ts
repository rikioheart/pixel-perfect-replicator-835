import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * One-off helper: reset the demo accounts' passwords through the Auth Admin
 * API so GoTrue hashes them with its own algorithm. Needed because hashes
 * written directly into auth.users.encrypted_password were not accepted by
 * GoTrue at login.
 */
export const resetDemoPasswords = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({
      bureauId: z.string().uuid(),
      memberId: z.string().uuid(),
      bureauPassword: z.string().min(8),
      memberPassword: z.string().min(8),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [bureau, member] = await Promise.all([
      supabaseAdmin.auth.admin.updateUserById(data.bureauId, {
        password: data.bureauPassword,
      }),
      supabaseAdmin.auth.admin.updateUserById(data.memberId, {
        password: data.memberPassword,
      }),
    ]);

    return {
      bureau: { ok: !bureau.error, error: bureau.error?.message ?? null },
      member: { ok: !member.error, error: member.error?.message ?? null },
    };
  });
