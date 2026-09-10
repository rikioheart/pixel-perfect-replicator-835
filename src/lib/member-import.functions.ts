import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const rowSchema = z.object({
  email: z.string().email(),
  first_name: z.string().optional().default(""),
  last_name: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  city: z.string().optional().default(""),
  department: z.string().optional().default(""),
  membership_type: z.string().optional().default("PARTICULIER"),
  membership_status: z.string().optional().default("ACTIVE"),
  membership_date: z.string().optional().default(""),
  bio: z.string().optional().default(""),
});

const inputSchema = z.object({
  fileName: z.string().min(1),
  updateExisting: z.boolean().default(false),
  rows: z.array(rowSchema).min(1).max(1000),
});

export const importMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isBureau } = await context.supabase.rpc("is_bureau", { _user_id: context.userId });
    if (!isBureau) throw new Error("Accès réservé au Bureau.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: { email: string; reason: string }[] = [];

    for (const row of data.rows) {
      const email = row.email.trim().toLowerCase();
      const profileFields = {
        first_name: row.first_name || null,
        last_name: row.last_name || null,
        display_name: `${row.first_name} ${row.last_name}`.trim() || email,
        email,
        phone: row.phone || null,
        city: row.city || null,
        department: row.department || null,
        bio: row.bio || null,
        membership_type: row.membership_type || "PARTICULIER",
        membership_status: row.membership_status || "ACTIVE",
        membership_date: row.membership_date || null,
      };

      const { data: existing } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (existing) {
        if (!data.updateExisting) {
          skipped += 1;
          continue;
        }
        const { error } = await supabaseAdmin.from("profiles").update(profileFields).eq("id", existing.id);
        if (error) errors.push({ email, reason: error.message });
        else updated += 1;
        continue;
      }

      const { data: account, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: `Lvdc-${crypto.randomUUID()}`,
        email_confirm: true,
      });
      if (authError || !account.user) {
        errors.push({ email, reason: authError?.message ?? "Compte non créé" });
        continue;
      }
      const { error } = await supabaseAdmin
        .from("profiles")
        .upsert({ id: account.user.id, ...profileFields }, { onConflict: "id" });
      if (error) errors.push({ email, reason: error.message });
      else created += 1;
    }

    await supabaseAdmin.from("member_imports").insert({
      file_name: data.fileName,
      created_count: created,
      updated_count: updated,
      skipped_count: skipped,
      errors,
      imported_by: context.userId,
    });

    return { created, updated, skipped, errors };
  });
