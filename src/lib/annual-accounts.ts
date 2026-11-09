/**
 * Comptes annuels d'une association loi 1901 (comptabilité de trésorerie) calculés depuis le grand livre
 * (finance_entries). Calcul déterministe : aucune IA, aucune autre source additionnée.
 */

export type Direction = "RECETTE" | "DEPENSE";

/** Catégories proposées à la saisie du grand livre, avec leur libellé. Les anciennes restent lisibles. */
export const LEDGER_CATEGORIES: Record<Direction, { code: string; label: string }[]> = {
  RECETTE: [
    { code: "ADHESION", label: "Cotisations" },
    { code: "DON", label: "Dons" },
    { code: "MECENAT", label: "Mécénat" },
    { code: "SUBVENTION", label: "Subventions" },
    { code: "ACTIVITE", label: "Activités" },
    { code: "FORMATION", label: "Formations" },
    { code: "VENTE", label: "Ventes de produits" },
    { code: "CONTRIBUTION", label: "Participations libres" },
    { code: "AUTRE_RECETTE", label: "Autre recette" },
  ],
  DEPENSE: [
    { code: "MATERIEL", label: "Achats de matériel" },
    { code: "ACHAT", label: "Fournitures et petits achats" },
    { code: "DEPLACEMENT", label: "Frais de déplacement" },
    { code: "REMBOURSEMENT", label: "Notes de frais remboursées" },
    { code: "FRAIS_ACTIVITE", label: "Frais d'activité" },
    { code: "FRAIS_PROJET", label: "Frais de projet" },
    { code: "FONCTIONNEMENT", label: "Fonctionnement (assurance, banque, hébergement)" },
    { code: "AUTRE_DEPENSE", label: "Autre dépense" },
  ],
};

const LEGACY_LABEL: Record<string, string> = { LOCATION_TERRAIN: "Location (ancien)" };

export function categoryLabel(code: string): string {
  for (const list of Object.values(LEDGER_CATEGORIES)) {
    const hit = list.find((c) => c.code === code);
    if (hit) return hit.label;
  }
  return LEGACY_LABEL[code] ?? code.replace(/_/g, " ").toLowerCase();
}

/** Rubriques du compte de résultat présenté à l'AG, dans l'ordre d'affichage. */
export const INCOME_RUBRICS = [
  { key: "cotisations", label: "Cotisations des membres", codes: ["ADHESION"] },
  { key: "dons", label: "Dons et mécénat", codes: ["DON", "MECENAT", "CONTRIBUTION"] },
  { key: "subventions", label: "Subventions", codes: ["SUBVENTION"] },
  { key: "activites", label: "Produits des activités", codes: ["ACTIVITE", "FORMATION", "VENTE", "LOCATION_TERRAIN"] },
  { key: "autres", label: "Autres produits", codes: ["AUTRE_RECETTE"] },
] as const;

export const EXPENSE_RUBRICS = [
  { key: "materiel", label: "Achats de matériel et fournitures", codes: ["MATERIEL", "ACHAT"] },
  { key: "deplacements", label: "Frais de déplacement et notes de frais", codes: ["DEPLACEMENT", "REMBOURSEMENT"] },
  { key: "activites", label: "Frais des activités et projets", codes: ["FRAIS_ACTIVITE", "FRAIS_PROJET"] },
  { key: "fonctionnement", label: "Frais de fonctionnement", codes: ["FONCTIONNEMENT"] },
  { key: "autres", label: "Autres charges", codes: ["AUTRE_DEPENSE"] },
] as const;

/** Statuts comptés comme réalisés (encaissé ou payé). « À recevoir » et « À payer » restent des engagements. */
export const REALIZED_STATUSES = new Set(["RECU", "PAYE", "TRANSMIS"]);
const PENDING_STATUSES = new Set(["A_RECEVOIR", "A_PAYER"]);

export type LedgerEntry = { entry_date: string; direction: string; category: string; amount: number | string; status: string };
export type RubricLine = { key: string; label: string; amount: number };
export type ResultKind = "EXCEDENT" | "DEFICIT" | "EQUILIBRE";
export type AnnualAccounts = {
  income: RubricLine[];
  expenses: RubricLine[];
  totalIncome: number;
  totalExpenses: number;
  result: number;
  kind: ResultKind;
  pendingIncome: number;
  pendingExpenses: number;
  entries: number;
};

const round = (n: number) => Math.round(n * 100) / 100;

function rubricFor(direction: Direction, category: string): string {
  const list = direction === "RECETTE" ? INCOME_RUBRICS : EXPENSE_RUBRICS;
  return list.find((r) => (r.codes as readonly string[]).includes(category))?.key ?? "autres";
}

export function annualAccounts(entries: LedgerEntry[], from: string, to: string): AnnualAccounts {
  const sums = { RECETTE: new Map<string, number>(), DEPENSE: new Map<string, number>() };
  let pendingIncome = 0;
  let pendingExpenses = 0;
  let counted = 0;
  for (const e of entries) {
    const day = e.entry_date.slice(0, 10);
    if (day < from || day > to) continue;
    if (e.direction !== "RECETTE" && e.direction !== "DEPENSE") continue;
    const amount = Number(e.amount);
    if (!Number.isFinite(amount)) continue;
    if (PENDING_STATUSES.has(e.status)) {
      if (e.direction === "RECETTE") pendingIncome += amount;
      else pendingExpenses += amount;
      continue;
    }
    if (!REALIZED_STATUSES.has(e.status)) continue; // annulé ou inconnu : exclu
    const key = rubricFor(e.direction, e.category);
    sums[e.direction].set(key, (sums[e.direction].get(key) ?? 0) + amount);
    counted += 1;
  }
  const income = INCOME_RUBRICS.map((r) => ({ key: r.key, label: r.label, amount: round(sums.RECETTE.get(r.key) ?? 0) }));
  const expenses = EXPENSE_RUBRICS.map((r) => ({ key: r.key, label: r.label, amount: round(sums.DEPENSE.get(r.key) ?? 0) }));
  const totalIncome = round(income.reduce((t, l) => t + l.amount, 0));
  const totalExpenses = round(expenses.reduce((t, l) => t + l.amount, 0));
  const result = round(totalIncome - totalExpenses);
  return {
    income,
    expenses,
    totalIncome,
    totalExpenses,
    result,
    kind: result > 0 ? "EXCEDENT" : result < 0 ? "DEFICIT" : "EQUILIBRE",
    pendingIncome: round(pendingIncome),
    pendingExpenses: round(pendingExpenses),
    entries: counted,
  };
}

export const euroFr = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

export function resultLabel(a: Pick<AnnualAccounts, "kind" | "result">): string {
  if (a.kind === "EQUILIBRE") return "Résultat à l'équilibre";
  return `${a.kind === "EXCEDENT" ? "Excédent" : "Déficit"} de ${euroFr(Math.abs(a.result))}`;
}

/** Résolutions soumises au vote de l'AG ordinaire (approbation, affectation, quitus). */
export function agResolutions(a: Pick<AnnualAccounts, "kind" | "result">, from: string, to: string): { title: string; text: string }[] {
  const period = `du ${frDay(from)} au ${frDay(to)}`;
  const allocation =
    a.kind === "EXCEDENT"
      ? `L'Assemblée générale décide d'affecter l'excédent de ${euroFr(a.result)} au report à nouveau (fonds associatif).`
      : a.kind === "DEFICIT"
        ? `L'Assemblée générale décide d'imputer le déficit de ${euroFr(Math.abs(a.result))} sur le report à nouveau (fonds associatif).`
        : "Le résultat étant à l'équilibre, aucune affectation n'est nécessaire.";
  return [
    { title: "1. Approbation des comptes", text: `L'Assemblée générale, après avoir entendu le rapport financier du trésorier, approuve les comptes de l'exercice ${period}.` },
    { title: "2. Affectation du résultat", text: allocation },
    { title: "3. Quitus au trésorier", text: "L'Assemblée générale donne quitus au trésorier pour sa gestion de l'exercice écoulé." },
  ];
}

function frDay(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

const cell = (v: string | number) => {
  const text = String(v);
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[";\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
const num = (n: number) => n.toFixed(2).replace(".", ",");

/** Lignes CSV (séparateur « ; ») du compte de résultat et des résolutions, pour l'export du bilan. */
export function accountsCsvLines(a: AnnualAccounts, from: string, to: string): string[] {
  const lines = ["Compte de résultat (comptabilité de trésorerie);Montant (€)", "Recettes"];
  for (const l of a.income) lines.push(`${cell(l.label)};${num(l.amount)}`);
  lines.push(`Total des recettes;${num(a.totalIncome)}`, "Dépenses");
  for (const l of a.expenses) lines.push(`${cell(l.label)};${num(l.amount)}`);
  lines.push(`Total des dépenses;${num(a.totalExpenses)}`);
  lines.push(`${cell(resultLabel(a))};${num(a.result)}`);
  lines.push(`Restant à encaisser (non compris);${num(a.pendingIncome)}`, `Restant à payer (non compris);${num(a.pendingExpenses)}`, "");
  lines.push("Résolutions soumises au vote;Pour;Contre;Abstention");
  for (const r of agResolutions(a, from, to)) lines.push(`${cell(`${r.title} — ${r.text}`)};;;`);
  lines.push("");
  return lines;
}
