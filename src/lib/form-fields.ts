/** Questions de formulaire natif : stockées en JSON dans forms.fields, réponses envoyées en texte. */
export const FIELD_TYPES = ["short", "long", "single", "multiple", "yesno", "date", "email", "number"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  short: "Texte court",
  long: "Texte long",
  single: "Choix unique",
  multiple: "Choix multiple",
  yesno: "Oui / non",
  date: "Date",
  email: "E-mail",
  number: "Nombre",
};

export type FormField = { label: string; required: boolean; long?: boolean; type?: FieldType; options?: string[] };

/** Anciens formulaires (sans type) : « long » ⇒ texte long, sinon texte court. */
export function fieldType(f: FormField): FieldType {
  if (f.type && FIELD_TYPES.includes(f.type)) return f.type;
  return f.long ? "long" : "short";
}

export const needsOptions = (t: FieldType) => t === "single" || t === "multiple";

/** Nettoie les questions avant enregistrement ; lève une erreur lisible si une question est incomplète. */
export function normalizeFields(fields: FormField[]): FormField[] {
  const out = fields
    .map((f) => ({ ...f, label: f.label.trim(), options: (f.options ?? []).map((o) => o.trim()).filter(Boolean) }))
    .filter((f) => f.label.length > 0)
    .slice(0, 30);
  const labels = new Set<string>();
  for (const f of out) {
    const t = fieldType(f);
    if (labels.has(f.label)) throw new Error(`La question « ${f.label} » apparaît deux fois.`);
    labels.add(f.label);
    if (needsOptions(t) && f.options.length < 2) throw new Error(`« ${f.label} » : indiquez au moins deux choix.`);
  }
  return out.map((f) => {
    const t = fieldType(f);
    return { label: f.label, required: f.required, type: t, long: t === "long", ...(needsOptions(t) ? { options: f.options } : {}) };
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Message d'erreur pour une réponse, ou null si elle est valable. */
export function validateAnswer(f: FormField, value: string | undefined): string | null {
  const v = (value ?? "").trim();
  if (!v) return f.required ? `« ${f.label} » est obligatoire.` : null;
  const t = fieldType(f);
  if (t === "email" && !EMAIL_RE.test(v)) return `« ${f.label} » : adresse e-mail invalide.`;
  if (t === "number" && Number.isNaN(Number(v.replace(",", ".")))) return `« ${f.label} » : indiquez un nombre.`;
  if (t === "date" && Number.isNaN(Date.parse(v))) return `« ${f.label} » : date invalide.`;
  if (t === "yesno" && v !== "Oui" && v !== "Non") return `« ${f.label} » : répondez oui ou non.`;
  if (t === "single" && !(f.options ?? []).includes(v)) return `« ${f.label} » : choix invalide.`;
  return null;
}
