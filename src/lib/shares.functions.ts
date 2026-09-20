import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const TokenSchema = z.object({ token: z.string().min(10).max(80) });

export type SharedPayload = {
  entityType: "project" | "event" | "document";
  label: string | null;
  title: string;
  description: string | null;
  meta: { label: string; value: string }[];
  url: string | null;
};

/**
 * Résout un lien de partage public (consultation en lecture seule, sans compte).
 * Volontairement limité : seuls les champs non sensibles sont renvoyés.
 */
export const getSharedEntity = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => TokenSchema.parse(input))
  .handler(async ({ data }): Promise<SharedPayload | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: share } = await supabaseAdmin
      .from("public_shares")
      .select("*")
      .eq("token", data.token)
      .maybeSingle();

    if (!share || share.revoked) return null;
    if (share.expires_at && new Date(share.expires_at).getTime() < Date.now()) return null;

    await supabaseAdmin
      .from("public_shares")
      .update({ view_count: (share.view_count ?? 0) + 1 })
      .eq("id", share.id);

    const fmt = (value: string | null | undefined) =>
      value ? new Date(value).toLocaleDateString("fr-FR", { dateStyle: "long" }) : "—";

    if (share.entity_type === "project") {
      const { data: row } = await supabaseAdmin
        .from("projects")
        .select("title, description, status, deadline, progress_percent")
        .eq("id", share.entity_id)
        .maybeSingle();
      if (!row) return null;
      return {
        entityType: "project",
        label: share.label,
        title: row.title,
        description: row.description,
        meta: [
          { label: "Statut", value: row.status },
          { label: "Échéance", value: fmt(row.deadline) },
          { label: "Avancement", value: `${row.progress_percent ?? 0} %` },
        ],
        url: null,
      };
    }

    if (share.entity_type === "event") {
      const { data: row } = await supabaseAdmin
        .from("events")
        .select("title, description, location, start_date, end_date, status")
        .eq("id", share.entity_id)
        .maybeSingle();
      if (!row) return null;
      return {
        entityType: "event",
        label: share.label,
        title: row.title,
        description: row.description,
        meta: [
          { label: "Date", value: fmt(row.start_date) },
          { label: "Lieu", value: row.location ?? "—" },
          { label: "Statut", value: row.status },
        ],
        url: null,
      };
    }

    const { data: row } = await supabaseAdmin
      .from("documents")
      .select("title, category, url, created_at")
      .eq("id", share.entity_id)
      .maybeSingle();
    if (!row) return null;
    return {
      entityType: "document",
      label: share.label,
      title: row.title,
      description: null,
      meta: [
        { label: "Catégorie", value: row.category ?? "Non classé" },
        { label: "Ajouté le", value: fmt(row.created_at) },
      ],
      url: row.url,
    };
  });
