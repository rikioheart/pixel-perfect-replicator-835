/** Export comptable simple : colonnes documentées, aucun plan comptable imposé. */
export const EXPORT_COLUMNS = ["date", "type", "categorie", "montant", "personne", "projet", "activite", "reference", "justificatif", "statut", "mode_paiement", "note"] as const;
export type ExportRow = Record<(typeof EXPORT_COLUMNS)[number], string>;

type Entry = {
  entry_date: string; direction: string; category: string; amount: number | string; status: string;
  external_ref?: string | null; receipt_url?: string | null; payment_method?: string | null; internal_note?: string | null; description?: string | null;
  people?: { display_name?: string | null; first_name?: string | null; last_name?: string | null } | null;
  projects?: { title?: string | null } | null; activities?: { title?: string | null } | null;
};

export function buildRows(entries: Entry[]): ExportRow[] {
  return entries.map((e) => ({
    date: e.entry_date,
    type: e.direction === "RECETTE" ? "Recette" : "Dépense",
    categorie: e.category,
    montant: Number(e.amount).toFixed(2).replace(".", ","),
    personne: e.people ? (e.people.display_name || [e.people.first_name, e.people.last_name].filter(Boolean).join(" ")) ?? "" : "",
    projet: e.projects?.title ?? "",
    activite: e.activities?.title ?? "",
    reference: e.external_ref ?? "",
    justificatif: e.receipt_url ?? "",
    statut: e.status,
    mode_paiement: e.payment_method ?? "",
    note: e.description ?? "",
  }));
}

const csvCell = (v: string) => (/[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
// Neutralise les formules (=, +, -, @) à l'ouverture dans un tableur.
const safe = (v: string) => (/^[=+\-@]/.test(v) ? `'${v}` : v);

export function toCsv(rows: ExportRow[]): string {
  return [EXPORT_COLUMNS.join(";"), ...rows.map((r) => EXPORT_COLUMNS.map((c) => csvCell(safe(r[c]))).join(";"))].join("\r\n");
}
export function toTsv(rows: ExportRow[]): string {
  return [EXPORT_COLUMNS.join("\t"), ...rows.map((r) => EXPORT_COLUMNS.map((c) => safe(r[c]).replace(/[\t\n\r]/g, " ")).join("\t"))].join("\n");
}

export type HelloAssoRow = { id: string; email: string; prenom: string; nom: string; debut: string; fin: string; montant: number };

/** Lit un CSV (séparateur ; ou ,) avec en-têtes id, email, prenom, nom, debut, fin, montant. */
export function parseHelloAssoCsv(text: string): HelloAssoRow[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const sep = lines[0]!.includes(";") ? ";" : ",";
  const norm = (s: string) => s.trim().replace(/^"|"$/g, "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const head = lines[0]!.split(sep).map(norm);
  const idx = (k: string) => head.indexOf(k);
  const toIso = (d: string) => { const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : d.slice(0, 10); };
  return lines.slice(1).map((l) => {
    const c = l.split(sep).map((x) => x.trim().replace(/^"|"$/g, ""));
    const g = (k: string) => (idx(k) >= 0 ? c[idx(k)] ?? "" : "");
    return { id: g("id"), email: g("email"), prenom: g("prenom"), nom: g("nom"), debut: toIso(g("debut")), fin: toIso(g("fin")),
      montant: Number(g("montant").replace(",", ".")) || 0 };
  }).filter((r) => r.email || r.id);
}
