/**
 * Contact rapide (menu « Créer », Bureau) : une fiche sans compte, jamais un compte ni une adhésion.
 * Personnes (particulier, professionnel) → people ; organisations → partners ou mairies.
 */
export const CONTACT_KINDS = ["PARTICULIER", "PROFESSIONNEL", "PARTENAIRE", "MAIRIE"] as const;
export type ContactKind = (typeof CONTACT_KINDS)[number];

export const CONTACT_KIND_LABEL: Record<ContactKind, string> = {
  PARTICULIER: "Particulier",
  PROFESSIONNEL: "Professionnel",
  PARTENAIRE: "Partenaire",
  MAIRIE: "Mairie & institution",
};

export type ContactForm = {
  firstName: string;
  lastName: string;
  organization: string;
  contactPerson: string;
  email: string;
  phone: string;
  city: string;
  notes: string;
};

export const EMPTY_CONTACT: ContactForm = {
  firstName: "", lastName: "", organization: "", contactPerson: "", email: "", phone: "", city: "", notes: "",
};

export const isOrganization = (kind: ContactKind) => kind === "PARTENAIRE" || kind === "MAIRIE";

const clean = (v: string) => v.trim() || null;

/** Message à afficher si le minimum manque, sinon null. */
export function contactProblem(kind: ContactKind, f: ContactForm): string | null {
  if (isOrganization(kind)) {
    if (f.organization.trim().length < 2) return "Indiquez le nom de la structure.";
  } else if (!f.firstName.trim() && !f.lastName.trim()) {
    return "Indiquez au moins un prénom ou un nom.";
  }
  const email = f.email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Cette adresse e-mail ne semble pas complète.";
  return null;
}

export type ContactInsert =
  | { table: "people"; row: { first_name: string | null; last_name: string | null; display_name: string | null; email: string | null; phone: string | null; city: string | null; notes: string | null; contact_type: "PARTICULIER" | "PROFESSIONNEL"; organization: string | null; created_by: string | null } }
  | { table: "partners"; row: { name: string; type: string; contact: string | null; active: boolean } }
  | { table: "mairies"; row: { organization: string; city: string | null; contact_person: string | null; email: string | null; phone: string | null; notes: string | null; status: string } };

/** Ligne à insérer : uniquement les champs remplis, rien d'inventé. */
export function buildContactInsert(kind: ContactKind, f: ContactForm, createdBy: string | null): ContactInsert {
  if (kind === "PARTENAIRE") {
    const contact = [f.contactPerson, f.email, f.phone].map((v) => v.trim()).filter(Boolean).join(" · ");
    return { table: "partners", row: { name: f.organization.trim(), type: "ENTREPRISE", contact: contact || null, active: true } };
  }
  if (kind === "MAIRIE") {
    return {
      table: "mairies",
      row: {
        organization: f.organization.trim(), city: clean(f.city), contact_person: clean(f.contactPerson),
        email: clean(f.email), phone: clean(f.phone), notes: clean(f.notes), status: "PROSPECT",
      },
    };
  }
  const display = [f.firstName, f.lastName].map((v) => v.trim()).filter(Boolean).join(" ");
  return {
    table: "people",
    row: {
      first_name: clean(f.firstName), last_name: clean(f.lastName), display_name: display || null,
      email: clean(f.email)?.toLowerCase() ?? null, phone: clean(f.phone), city: clean(f.city), notes: clean(f.notes),
      contact_type: kind, organization: kind === "PROFESSIONNEL" ? clean(f.organization) : null, created_by: createdBy,
    },
  };
}
