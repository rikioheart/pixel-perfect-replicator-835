import { parseDocument } from 'htmlparser2';
import type { AnyNode } from 'domhandler';

export type WordPressArticle = { id: number; title: string; excerpt: string; date: string; url: string; source: 'site' };

function text(nodes: AnyNode[]): string {
  return nodes.map((n) => ('data' in n && n.type === 'text' ? n.data : 'children' in n ? text(n.children as AnyNode[]) : '')).join('');
}

/** Converts WordPress HTML into plain text — remote HTML is never rendered. */
export function plainText(html: string) {
  return text(parseDocument(html ?? '').children as AnyNode[]).replace(/\s+/g, ' ').replace(/\[…\]|\[&hellip;\]/g, '…').trim();
}

export function parseWordPressPosts(raw: unknown): WordPressArticle[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((p) => {
    const url = String(p?.link ?? '');
    if (!/^https:\/\/lavoixduchien\.fr\//.test(url)) return [];
    return [{ id: Number(p.id), title: plainText(p?.title?.rendered ?? ''), excerpt: plainText(p?.excerpt?.rendered ?? '').replace(/^Blog La voix du chien\s+—\s+\S+\s+\d{4}\s*/i, ''), date: String(p.date ?? ''), url, source: 'site' as const }];
  });
}

export type Guide = { slug: string; title: string; lead: string; body: string[]; sections: { title: string; items?: string[]; text?: string }[] };

/** Guides éducatifs repris du prototype (contenu associatif, sans source externe). */
export const GUIDES: Guide[] = [
  {
    slug: 'comprendre-signaux-chien', title: 'Observer les signaux du chien sans conclure trop vite',
    lead: 'Le comportement visible ne suffit pas toujours à comprendre l’état interne du chien.',
    body: ['Un geste isolé ne possède pas nécessairement une signification unique. Notez ce qui se passe juste avant et juste après, la distance, les personnes présentes, le milieu et l’historique connu.', 'Distinguez ce qui a été observé (le chien détourne la tête) de l’interprétation (il serait mal à l’aise) et de l’hypothèse à vérifier.'],
    sections: [
      { title: 'Une grille simple pour observer', items: ['Décrire le contexte et les événements qui précèdent.', 'Décrire le comportement visible sans intention supposée.', 'Observer les autres indices corporels et la possibilité pour le chien de s’éloigner.', 'Comparer les situations plutôt que conclure d’une seule scène.', 'Demander un avis compétent si la situation présente un risque ou une difficulté persistante.'] },
      { title: 'Ce que l’on ne peut pas conclure automatiquement', text: 'Une posture ou un mouvement unique ne permet pas à lui seul de poser un diagnostic ni d’affirmer une émotion avec certitude.' },
    ],
  },
  {
    slug: 'balades-collectives', title: 'Préparer une balade collective respectueuse',
    lead: 'Une sortie réussie repose sur des attentes réalistes et la possibilité de prendre de la distance.',
    body: ['Avant de participer, vérifiez la distance, le terrain, la durée, la taille du groupe et la façon dont les chiens circuleront. Demandez si des adaptations sont possibles.'],
    sections: [
      { title: 'Avant la sortie', items: ['Clarifier les besoins du chien et les situations qu’il trouve difficiles.', 'Prévoir de l’eau, un équipement adapté et une possibilité de s’éloigner du groupe.', 'Vérifier les conditions d’accès au site et les règles locales.', 'Ne pas présumer que les interactions directes entre chiens sont nécessaires.'] },
      { title: 'Pendant la sortie', text: 'Permettre une pause ou un départ anticipé est préférable à maintenir la participation à tout prix.' },
    ],
  },
  {
    slug: 'sources-et-limites', title: 'Comment lire une information canine en ligne',
    lead: 'Une information convaincante n’est pas forcément une conclusion solidement établie.',
    body: ['Un bon contenu explique la question étudiée, le type de preuve, les limites et ce qui reste incertain. Le ton assuré ou le nombre de partages ne sont pas des preuves.'],
    sections: [
      { title: 'Quelques questions utiles', items: ['Qui a écrit le contenu et quelles sont ses compétences ?', 'Les sources sont-elles accessibles ?', 'Les résultats sont-ils présentés avec leurs limites ?', 'Les observations sont-elles séparées des interprétations ?', 'La date de publication est-elle indiquée ?'] },
      { title: 'Santé et risques', text: 'Pour la santé, la douleur ou les risques de morsure, privilégiez un avis individualisé auprès du professionnel approprié.' },
    ],
  },
];
