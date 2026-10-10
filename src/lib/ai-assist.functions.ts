import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Assistant contextuel. Les données sont lues AVEC LA SESSION DE L'UTILISATEUR (RLS),
 * jamais avec un accès privilégié : l'IA ne voit que ce que la personne voit déjà.
 * Le résultat est une proposition, à relire / modifier / valider côté interface.
 */
const Input = z.object({
  action: z.enum(["SUMMARY", "REPLY", "INCONSISTENCIES", "MINUTES"]),
  type: z.enum(["project", "help_request", "task", "form"]),
  id: z.string().uuid(),
  instruction: z.string().max(500).optional(),
});

const ACTION_PROMPT: Record<string, string> = {
  SUMMARY: "Résume clairement l'objet en 5 à 8 lignes, puis liste les prochaines étapes visibles.",
  REPLY: "Rédige un brouillon de réponse courtoise et bienveillante, signée « L'équipe La Voix du Chien ». C'est un brouillon qui sera relu.",
  INCONSISTENCIES: "Liste uniquement des ALERTES / HYPOTHÈSES : informations manquantes, dates incohérentes, doublons possibles, statuts contradictoires. Formule chaque point comme une hypothèse à vérifier, jamais comme une certitude. Si rien, dis-le.",
  MINUTES: "Prépare une trame de compte rendu : contexte, points abordés, décisions à prendre (à valider par les personnes concernées), actions et responsables à confirmer.",
};

const SYSTEM = `Tu es l'assistant de l'association française La Voix du Chien. Tu réponds en français simple.
Tu es une aide, jamais une autorité : tu ne prends aucune décision, tu ne poses aucun diagnostic vétérinaire, médical ou juridique,
et tu signales toute incertitude. N'invente aucune information absente des données fournies.
Il n'existe aucun classement ni score entre membres : n'en propose jamais.`;

async function loadContext(supabase: any, type: string, id: string): Promise<string> {
  if (type === "project") {
    const { data } = await supabase.from("projects")
      .select("title, description, status, priority, start_date, deadline, why, for_whom, objective, done_steps, next_steps, current_needs")
      .eq("id", id).maybeSingle();
    if (!data) return "";
    const { data: tasks } = await supabase.from("tasks").select("title, status, deadline, needs_help").eq("project_id", id).limit(40);
    return JSON.stringify({ projet: data, taches: tasks ?? [] });
  }
  if (type === "help_request") {
    const { data } = await supabase.from("help_requests").select("*").eq("id", id).maybeSingle();
    if (!data) return "";
    const { user_id: _u, ...rest } = data as Record<string, unknown>;
    return JSON.stringify({ demande: rest });
  }
  if (type === "task") {
    const { data } = await supabase.from("tasks")
      .select("title, description, status, priority, deadline, started_at, submitted_at, completed_at, rejection_reason, needs_help, team_label")
      .eq("id", id).maybeSingle();
    return data ? JSON.stringify({ tache: data }) : "";
  }
  // form : réponses visibles par l'utilisateur (RLS), sans e-mail ni nom
  const { data: form } = await supabase.from("forms").select("title, purpose, kind").eq("id", id).maybeSingle();
  if (!form) return "";
  const { data: rs } = await supabase.from("form_responses").select("answers, created_at").eq("form_id", id).limit(100);
  return JSON.stringify({ formulaire: form, reponses: rs ?? [] });
}

export const runAiAssist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }): Promise<{ text: string }> => {
    const ctx = await loadContext(context.supabase, data.type, data.id);
    if (!ctx) throw new Error("Élément introuvable ou non autorisé pour votre compte.");

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Assistant indisponible : configuration manquante.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        instructions: SYSTEM,
        reasoning: { effort: "low" },
        input: [{ role: "user", content: [{ type: "input_text",
          text: `${ACTION_PROMPT[data.action]}${data.instruction ? `\nConsigne : ${data.instruction}` : ""}\n\nDonnées autorisées :\n${ctx.slice(0, 12000)}` }] }],
      }),
    });
    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Trop de demandes, réessayez dans une minute.");
      if (res.status === 402) throw new Error("Crédits IA épuisés : rechargez l'espace de travail pour continuer.");
      throw new Error(`L'assistant n'a pas pu répondre (${res.status}). ${detail.slice(0, 200)}`);
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "", text = "";
    while (true) {
      const c = await reader.read();
      if (c.done) break;
      buf += dec.decode(c.value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const l of lines) {
        if (!l.startsWith("data:")) continue;
        const p = l.slice(5).trim();
        if (!p || p === "[DONE]") continue;
        try {
          const ev = JSON.parse(p) as { type?: string; delta?: string; response?: { output_text?: string } };
          if (ev.type === "response.output_text.delta" && typeof ev.delta === "string") text += ev.delta;
          else if (ev.type === "response.completed" && ev.response?.output_text && !text) text = ev.response.output_text;
        } catch { /* fragment ignoré */ }
      }
    }
    if (!text) throw new Error("Réponse vide, réessayez.");
    return { text };
  });
