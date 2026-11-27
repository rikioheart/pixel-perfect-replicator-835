export const PROFESSIONAL_QUALITY_LABEL: Record<string, string> = {
  PENDING: "En attente du Bureau",
  VALIDATED: "Professionnel validé",
  REFUSED: "Demande non retenue",
  SUSPENDED: "Qualité professionnelle suspendue",
};

export function professionalRequestProblem(company: string, activity: string, siret: string): string | null {
  if (!company.trim()) return "Indiquez le nom de votre structure.";
  if (!activity.trim()) return "Indiquez votre activité professionnelle.";
  if (siret.trim() && !/^\d{14}$/.test(siret.replace(/\s/g, ""))) return "Le SIRET doit comporter 14 chiffres.";
  return null;
}

export function directoryQualityMatches(category: string, membershipType: string, professional: boolean): boolean {
  if (category === "PRO") return professional;
  return membershipType === "PARTICULIER" || (membershipType !== "PROFESSIONNEL" && membershipType !== "PARTENAIRE");
}