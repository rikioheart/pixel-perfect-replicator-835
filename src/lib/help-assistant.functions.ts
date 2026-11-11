import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  HELP_ANSWER_SCHEMA,
  HELP_SYSTEM_PROMPT,
  buildGuideContext,
  guidesForViewer,
  parseHelpAnswer,
  trimConversation,
  type HelpAnswer,
  type HelpGuide,
} from "@/lib/help-assistant";

const Input = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .min(1)
    .max(40),
});

/**
 * Assistant du Centre d'aide. Les guides sont lus AVEC LA SESSION DE L'UTILISATEUR (RLS),
 * puis filtrés à nouveau par profil : l'IA ne reçoit que les guides publiés qu'il peut lire,
 * et la question. Aucune donnée de profil, de foyer ou de chien n'est envoyée.
 */
export const askHelpAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }): Promise<HelpAnswer> => {
    const { supabase, userId } = context;
    const turns = trimConversation(data.messages);
    if (turns.at(-1)?.role !== "user") throw new Error("Posez votre question.");

    const [bureau, pro, rows] = await Promise.all([
      supabase.rpc("is_bureau", { _user_id: userId }),
      supabase.rpc("is_professional", { _user_id: userId }),
      supabase
        .from("help_guides")
        .select("id, title, module, summary, content, visibility, status")
        .eq("status", "PUBLISHED")
        .order("title"),
    ]);
    if (rows.error) throw new Error("Impossible de lire les guides pour le moment.");
    const guides: HelpGuide[] = guidesForViewer(rows.data ?? [], {
      isBureau: bureau.data === true,
      isPro: pro.data === true,
    });
    if (guides.length === 0) {
      return {
        answer:
          "Aucun guide n'est encore disponible pour votre profil. Pour une question précise, passez par l'Entraide ou écrivez au Bureau.",
        covered: false,
        guides: [],
      };
    }

    const { generateResponse, GatewayError, RateLimitError, PaymentRequiredError } = await import(
      "@lovable.dev/ai-gateway"
    );
    try {
      const response = await generateResponse({
        model: "openai/gpt-6-astra",
        instructions: `${HELP_SYSTEM_PROMPT}\n\nGuides disponibles :\n${buildGuideContext(guides)}`,
        input: turns.map((t) => ({ role: t.role, content: t.content })),
        reasoning: { effort: "low" },
        text: {
          format: { type: "json_schema", name: "help_answer", strict: true, schema: HELP_ANSWER_SCHEMA as never },
        },
      });
      let raw = "";
      for (const item of response.output ?? []) {
        if (item.type !== "message") continue;
        for (const part of item.content ?? []) {
          if (part.type === "output_text") raw += part.text;
          if (part.type === "refusal") throw new Error("L'assistant ne peut pas répondre à cette question.");
        }
      }
      if (!raw) throw new Error("Réponse vide, réessayez.");
      const answer = parseHelpAnswer(raw, guides);
      if (!answer.answer) throw new Error("Réponse vide, réessayez.");
      return answer;
    } catch (error) {
      if (error instanceof RateLimitError) throw new Error("Beaucoup de questions en ce moment : réessayez dans une minute.");
      if (error instanceof PaymentRequiredError)
        throw new Error("L'assistant est momentanément indisponible. Réessayez plus tard, ou passez par l'Entraide.");
      if (error instanceof GatewayError) {
        console.error("help-assistant gateway error", error.code, error.ids);
        throw new Error("L'assistant n'a pas pu répondre. Réessayez dans un instant.");
      }
      throw error;
    }
  });
