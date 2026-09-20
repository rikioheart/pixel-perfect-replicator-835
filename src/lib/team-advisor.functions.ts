import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  situation: z.string().min(20).max(4000),
});

export type Recommendation = {
  title: string;
  priority: "HAUTE" | "MOYENNE" | "BASSE";
  why: string;
  first_step: string;
  owner_hint: string;
};

export type TeamAdvice = {
  summary: string;
  recommendations: Recommendation[];
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    recommendations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          priority: { type: "string", enum: ["HAUTE", "MOYENNE", "BASSE"] },
          why: { type: "string" },
          first_step: { type: "string" },
          owner_hint: { type: "string" },
        },
        required: ["title", "priority", "why", "first_step", "owner_hint"],
      },
    },
  },
  required: ["summary", "recommendations"],
} as const;

const SYSTEM = `Tu es un conseiller en organisation d'une association française (La Voix du Chien).
Le Bureau décrit un besoin ou un blocage. Tu réponds en français, de façon concrète et bienveillante.
Produis un court résumé de la situation puis 3 à 6 recommandations d'amélioration du travail d'équipe,
classées de la plus prioritaire à la moins prioritaire. Chaque recommandation contient une action
réalisable en moins de deux semaines par des bénévoles, la raison, la toute première étape et le type
de personne à qui la confier (Bureau, professionnel, bénévole particulier…).`;

/**
 * Analyse une description libre d'un besoin/blocage et renvoie des
 * recommandations priorisées. Réservé au Bureau.
 */
export const generateTeamAdvice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }): Promise<TeamAdvice> => {
    const { data: isBureau } = await context.supabase.rpc("is_bureau", {
      _user_id: context.userId,
    });
    if (!isBureau) throw new Error("Accès réservé au Bureau.");

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Assistant indisponible : configuration manquante.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        instructions: SYSTEM,
        input: [
          {
            role: "user",
            content: [{ type: "input_text", text: data.situation }],
          },
        ],
        reasoning: { effort: "low" },
        text: {
          format: {
            type: "json_schema",
            name: "team_advice",
            strict: true,
            schema: SCHEMA,
          },
        },
      }),
    });

    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Trop de demandes, réessayez dans une minute.");
      if (res.status === 402) {
        throw new Error("Crédits IA épuisés : rechargez l'espace de travail pour continuer.");
      }
      throw new Error(`L'assistant n'a pas pu répondre (${res.status}). ${detail.slice(0, 200)}`);
    }

    // Lecture SSE : on accumule le texte final.
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const event = JSON.parse(payload) as {
            type?: string;
            delta?: string;
            response?: { output_text?: string };
          };
          if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
            text += event.delta;
          } else if (event.type === "response.completed" && event.response?.output_text) {
            if (!text) text = event.response.output_text;
          }
        } catch {
          // fragment non-JSON, ignoré
        }
      }
    }

    let parsed: TeamAdvice;
    try {
      parsed = JSON.parse(text) as TeamAdvice;
    } catch {
      throw new Error("Réponse de l'assistant illisible, réessayez.");
    }
    if (!Array.isArray(parsed.recommendations)) parsed.recommendations = [];

    const order = { HAUTE: 0, MOYENNE: 1, BASSE: 2 } as const;
    parsed.recommendations = parsed.recommendations
      .slice(0, 8)
      .sort((a, b) => (order[a.priority] ?? 3) - (order[b.priority] ?? 3));

    return parsed;
  });
