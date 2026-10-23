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
/** Découpe un CSV en respectant guillemets, séparateurs et retours à la ligne entre guillemets. */
export function splitCsv(text: string, sep: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === sep) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

export function parseHelloAssoCsv(text: string): HelloAssoRow[] {
  const clean = text.replace(/^\uFEFF/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const sep = firstLine.includes(";") ? ";" : firstLine.includes("\t") ? "\t" : ",";
  const rows = splitCsv(clean, sep);
  if (rows.length < 2) return [];
  const norm = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const head = rows[0]!.map(norm);
  const idx = (k: string) => head.indexOf(k);
  const toIso = (d: string) => {
    const m = d.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
    return /^\d{4}-\d{2}-\d{2}/.test(d.trim()) ? d.trim().slice(0, 10) : "";
  };
  const toAmount = (s: string) => {
    const n = Number(s.replace(/[\s\u00a0€]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };
  return rows.slice(1).map((c) => {
    const g = (k: string) => (idx(k) >= 0 ? (c[idx(k)] ?? "").trim() : "");
    return { id: g("id"), email: g("email").toLowerCase(), prenom: g("prenom"), nom: g("nom"), debut: toIso(g("debut")), fin: toIso(g("fin")),
      montant: toAmount(g("montant")) };
  }).filter((r) => r.email || r.id);
}
