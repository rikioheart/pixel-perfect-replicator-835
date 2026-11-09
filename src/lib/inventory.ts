/**
 * Inventaire associatif — règles partagées par l'interface.
 * La base reste l'autorité : guard_inventory_reservation (verrou + pic de réservation) et
 * guard_inventory_stock refusent toute surréservation ou sortie sous les réservations actives.
 * Ces fonctions ne servent qu'à prévenir l'utilisateur avant l'envoi.
 */

export const INVENTORY_TYPES = [
  { value: "MATERIEL", label: "Matériel associatif" },
  { value: "EQUIPEMENT", label: "Objets & équipements" },
  { value: "CONSOMMABLE", label: "Consommables" },
  { value: "VENTE", label: "Produits destinés à la vente" },
] as const;
export type InventoryType = (typeof INVENTORY_TYPES)[number]["value"];

export const INVENTORY_CONDITIONS = [
  { value: "NEUF", label: "Neuf" },
  { value: "BON", label: "Bon état" },
  { value: "USAGE", label: "Usagé" },
  { value: "A_REPARER", label: "À réparer / contrôler" },
] as const;

export const RESERVATION_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "En cours",
  RETURNED: "Rendu",
  CANCELLED: "Annulé",
};

export const typeLabel = (value: string | null | undefined) =>
  INVENTORY_TYPES.find((t) => t.value === value)?.label ?? "Type non précisé";
export const conditionLabel = (value: string | null | undefined) =>
  INVENTORY_CONDITIONS.find((c) => c.value === value)?.label ?? null;

/** Seules les réservations ACTIVE consomment du stock ; RETURNED et CANCELLED le libèrent. */
export const reservationCounts = (status: string) => status === "ACTIVE";

/** Quantité disponible = stock courant − quantité réservée (jamais négative à l'affichage). */
export const availableQuantity = (stock: number, reserved: number) => Math.max(0, stock - reserved);

export type ItemDraft = {
  name: string;
  type: string;
  quantity: string;
  unit_price?: string;
  document_url?: string;
};

/** Champs strictement nécessaires : désignation, type, quantité. Le reste est facultatif. */
export function validateItemDraft(d: ItemDraft): string | null {
  if (d.name.trim().length < 2) return "La désignation est obligatoire.";
  if (!INVENTORY_TYPES.some((t) => t.value === d.type)) return "Choisissez un type.";
  const q = Number(d.quantity);
  if (!Number.isInteger(q) || q < 0) return "La quantité doit être un nombre entier positif ou nul.";
  if (d.unit_price && d.unit_price.trim() !== "") {
    const p = Number(d.unit_price.replace(",", "."));
    if (!Number.isFinite(p) || p < 0) return "Le prix doit être un montant positif.";
  }
  if (d.document_url && d.document_url.trim() !== "" && !/^https?:\/\//i.test(d.document_url.trim()))
    return "Le lien doit commencer par https://";
  return null;
}

export type ReservationDraft = {
  projectId: string;
  quantity: number;
  startDate: string;
  endDate: string | null;
};

/** Contrôle préalable côté interface ; la base revérifie sous verrou au moment de l'écriture. */
export function validateReservationDraft(d: ReservationDraft, available: number): string | null {
  if (!d.projectId) return "Choisissez un projet.";
  if (!Number.isInteger(d.quantity) || d.quantity <= 0) return "La quantité doit être d'au moins 1.";
  if (!d.startDate) return "Indiquez la date de début.";
  if (d.endDate && d.endDate < d.startDate) return "La date de fin précède la date de début.";
  if (d.quantity > available)
    return `Stock insuffisant : ${available} disponible(s) sur cette période.`;
  return null;
}

/** Entrée (+) ou sortie (−) de stock : entier non nul. */
export function movementChange(kind: "IN" | "OUT", quantity: string): number | null {
  const q = Number(quantity);
  if (!Number.isInteger(q) || q <= 0) return null;
  return kind === "IN" ? q : -q;
}

/** Visibilité d'une fiche de matériel (appliquée par la base : can_see_inventory). */
export const INVENTORY_VISIBILITY = [
  { value: "BUREAU", label: "Privé Bureau", short: "Privé Bureau" },
  { value: "PROS", label: "Visible aux professionnels bienfaiteurs", short: "Pros" },
  { value: "MEMBERS", label: "Visible à tous les adhérents", short: "Adhérents" },
] as const;
export type InventoryVisibility = (typeof INVENTORY_VISIBILITY)[number]["value"];
export const visibilityLabel = (v: string | null | undefined) =>
  INVENTORY_VISIBILITY.find((x) => x.value === v)?.short ?? "Privé Bureau";
