/**
 * Assistant du Centre d'aide : règles pures, partagées par la fonction serveur et les tests.
 * L'assistant ne s'appuie que sur les guides publiés que la personne peut déjà lire.
 */

export type HelpGuide = {
  id: string;
  title: string;
  module: string;
  summary: string | null;
  content: string;
  visibility: string;
};

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type HelpAnswer = {
  answer: string;
  covered: boolean;
  guides: { id: string; title: string }[];
};

/** Visibilités autorisées : particulier = ALL ; pro = ALL + PRO_BUREAU ; Bureau = toutes. */
export function allowedVisibilities(viewer: { isBureau: boolean; isPro: boolean }): string[] {
  if (viewer.isBureau) return ["ALL", "PRO_BUREAU", "BUREAU"];
  if (viewer.isPro) return ["ALL", "PRO_BUREAU"];
  return ["ALL"];
}

/** Garde uniquement les guides publiés et lisibles pour ce profil (double contrôle après la RLS). */
export function guidesForViewer<T extends { visibility: string; status?: string }>(
  guides: T[],
  viewer: { isBureau: boolean; isPro: boolean },
): T[] {
  const allowed = allowedVisibilities(viewer);
  return guides.filter((g) => (g.status ?? "PUBLISHED") === "PUBLISHED" && allowed.includes(g.visibility));
}

export const HELP_SYSTEM_PROMPT = `Tu es l'assistant du Centre d'aide de l'association française La Voix du Chien.
Tu aides les adhérents à utiliser la plateforme, en français simple, bienveillant et concis.

Règles impératives :
1. Réponds UNIQUEMENT à partir des guides fournis ci-dessous (balises <guide>). Ce sont tes seules sources.
2. N'invente jamais une procédure, un bouton, une page, un délai ou une règle qui n'est pas écrit dans ces guides. Ne suppose rien.
3. Si la question n'est pas couverte (ou seulement en partie), dis-le clairement, mets "covered" à false, et oriente vers le module d'entraide (page « Entraide », /help-requests) ou un message au Bureau.
4. Ne demande, ne répète et ne mentionne aucune donnée personnelle (nom, e-mail, téléphone, adresse, santé, informations sur un adhérent ou un chien précis). Si la question en contient, ignore-les.
5. Tu n'es pas une autorité : aucun conseil vétérinaire, médical, juridique ou financier personnel.
6. Il n'existe aucun classement ni score entre membres.
7. Dans "guide_refs", liste les références (G1, G2…) des guides réellement utilisés pour répondre, du plus utile au moins utile (3 au maximum). Liste vide si aucun guide ne couvre la question.
8. "answer" : quelques phrases ou une courte liste à puces en Markdown. N'y écris pas de liens ni de références G1/G2 : les liens vers les guides sont ajoutés automatiquement.`;

/** Contexte documentaire : uniquement titre, résumé et contenu des guides, avec une référence courte. */
export function buildGuideContext(guides: HelpGuide[]): string {
  return guides
    .map(
      (g, i) =>
        `<guide ref="G${i + 1}" titre="${g.title.replace(/"/g, "'")}">\n${g.summary ? `Résumé : ${g.summary}\n` : ""}${g.content}\n</guide>`,
    )
    .join("\n\n");
}

export const HELP_ANSWER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "covered", "guide_refs"],
  properties: {
    answer: { type: "string" },
    covered: { type: "boolean" },
    guide_refs: { type: "array", items: { type: "string" } },
  },
} as const;

/** Transforme la sortie JSON du modèle en réponse sûre : seuls des guides fournis peuvent être cités. */
export function parseHelpAnswer(raw: string, guides: HelpGuide[]): HelpAnswer {
  let parsed: { answer?: unknown; covered?: unknown; guide_refs?: unknown };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { answer: raw.trim(), covered: false, guides: [] };
  }
  const answer = typeof parsed.answer === "string" ? parsed.answer.trim() : "";
  const refs = Array.isArray(parsed.guide_refs) ? parsed.guide_refs : [];
  const cited: { id: string; title: string }[] = [];
  for (const ref of refs) {
    const m = typeof ref === "string" ? ref.trim().match(/^G(\d+)$/i) : null;
    const g = m ? guides[Number(m[1]) - 1] : undefined;
    if (g && !cited.some((c) => c.id === g.id)) cited.push({ id: g.id, title: g.title });
    if (cited.length >= 3) break;
  }
  const covered = parsed.covered === true && cited.length > 0;
  return { answer, covered, guides: covered ? cited : [] };
}

/** Historique envoyé à l'IA : derniers échanges seulement, textes tronqués. */
export function trimConversation(turns: ChatTurn[], maxTurns = 8, maxChars = 1500): ChatTurn[] {
  return turns
    .filter((t) => t.content.trim())
    .slice(-maxTurns)
    .map((t) => ({ role: t.role, content: t.content.slice(0, maxChars) }));
}
