import { supabase } from "@/integrations/supabase/client";

/** Notifie une liste de membres (doublons et auto-notification exclus). */
export async function notifyMembers({
  recipients,
  senderId,
  kind,
  title,
  message,
  linkUrl,
  entityType,
  entityId,
}: {
  recipients: (string | null | undefined)[];
  senderId?: string | null;
  kind: string;
  title: string;
  message?: string | null;
  linkUrl?: string | null;
  entityType?: string | null;
  entityId?: string | null;
}) {
  const unique = Array.from(
    new Set(recipients.filter((id): id is string => Boolean(id) && id !== senderId)),
  );
  if (unique.length === 0) return;
  await supabase.from("in_app_notifications").insert(
    unique.map((recipient_id) => ({
      recipient_id,
      sender_id: senderId ?? null,
      kind,
      title,
      message: message ?? null,
      link_url: linkUrl ?? null,
      entity_type: entityType ?? null,
      entity_id: entityId ?? null,
    })),
  );
}

/** Notifie tous les membres du bureau (ajout/modification à surveiller). */
export async function notifyBureau(params: {
  senderId?: string | null;
  kind: string;
  title: string;
  message?: string | null;
  linkUrl?: string | null;
  entityType?: string | null;
  entityId?: string | null;
}) {
  const { data } = await supabase
    .from("user_roles")
    .select("user_id, roles!inner(code)")
    .in("roles.code", ["BUREAU", "ADMIN", "PRESIDENT", "SECRETAIRE", "TRESORIER"]);
  await notifyMembers({ ...params, recipients: (data ?? []).map((r) => r.user_id) });
}
