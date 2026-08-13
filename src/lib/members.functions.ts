import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { memberFormSchema, updateMemberSchema } from "@/lib/member-schema";

export const createMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => memberFormSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isBureau } = await context.supabase.rpc("is_bureau", {
      _user_id: context.userId,
    });
    if (!isBureau) throw new Error("Accès réservé au Bureau.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const tempPassword = `Lvdc-${crypto.randomUUID()}`;
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: tempPassword,
      email_confirm: true,
    });
    if (createError || !created.user) {
      throw new Error(createError?.message ?? "Impossible de créer le compte adhérent.");
    }

    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: created.user.id,
      first_name: data.first_name,
      last_name: data.last_name,
      display_name: `${data.first_name} ${data.last_name}`.trim(),
      email: data.email,
      phone: data.phone || null,
      city: data.city || null,
      department: data.department || null,
      bio: data.bio || null,
      membership_type: data.membership_type,
      membership_status: data.membership_status,
      involvement_level: data.involvement_level || null,
      membership_date: data.membership_date || null,
      public_visibility: data.public_visibility,
    });
    if (profileError) throw new Error(profileError.message);

    return { id: created.user.id };
  });

export const updateMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateMemberSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isBureau } = await context.supabase.rpc("is_bureau", {
      _user_id: context.userId,
    });
    if (!isBureau && context.userId !== data.id) {
      throw new Error("Accès refusé.");
    }

    const { error } = await context.supabase
      .from("profiles")
      .update({
        first_name: data.first_name,
        last_name: data.last_name,
        display_name: `${data.first_name} ${data.last_name}`.trim(),
        email: data.email,
        phone: data.phone || null,
        city: data.city || null,
        department: data.department || null,
        bio: data.bio || null,
        membership_type: data.membership_type,
        membership_status: data.membership_status,
        involvement_level: data.involvement_level || null,
        membership_date: data.membership_date || null,
        public_visibility: data.public_visibility,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    return { id: data.id };
  });
