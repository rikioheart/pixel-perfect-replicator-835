import { createFileRoute } from "@tanstack/react-router";

/**
 * TEMPORARY one-off route: resets the two demo accounts' passwords via the
 * Auth Admin API so GoTrue hashes them with its own algorithm. Delete this
 * file after the reset succeeds.
 */
export const Route = createFileRoute("/api/public/reset-demo")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Simple guard so it only runs when explicitly invoked with the secret.
        const secret = request.headers.get("x-reset-secret");
        if (secret !== process.env["RESET_DEMO_SECRET"]) {
          return new Response("forbidden", { status: 403 });
        }

        const body = await request.json() as {
          users: { id: string; password: string }[];
        };

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const results = [];
        for (const u of body.users) {
          const { error } = await supabaseAdmin.auth.admin.updateUserById(u.id, {
            password: u.password,
          });
          results.push({ id: u.id, ok: !error, error: error?.message ?? null });
        }
        return Response.json({ results });
      },
    },
  },
});
