/** Statistiques stratégiques : calculées en base (bureau_statistics), mises en forme ici. */
import { accountsCsvLines, type AnnualAccounts } from "./annual-accounts";

export type PartnerPass = { name: string; source: "PRO" | "BUREAU"; tampons: number; personnes: number };
export type StatsSeries = { mois: string; adherents: number; taches: number; participations: number; tampons: number };
export type BureauStats = {
  members: { particuliers_actifs: number; pros_bienfaiteurs: number; en_attente: number; nouveaux: number };
  life: { activites: number; evenements: number; inscriptions: number; presences_validees: number; participants_uniques: number };
  projects: {
    en_cours: number;
    en_preparation: number;
    en_pause: number;
    termines: number;
    crees: number;
    avancement_moyen: number;
    taches_realisees: number;
    taches_ouvertes: number;
    taches_en_retard: number;
  };
  volunteers: { benevoles_engages: number; propositions: number; propositions_acceptees: number; demandes_aide: number; taches_benevoles_realisees: number };
  pass: { tampons: number; beneficiaires: number; cartes: number; automatiques: number; par_partenaire: PartnerPass[] };
  series: StatsSeries[];
};

export type StatSection = { title: string; rows: [string, string | number][] };

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Périodes proposées ; l'exercice suit l'année civile (modifiable avec les dates libres). */
export function periodPresets(today = new Date()) {
  const y = today.getFullYear();
  const yearAgo = new Date(today);
  yearAgo.setFullYear(y - 1);
  yearAgo.setDate(yearAgo.getDate() + 1);
  return [
    { key: "current", label: `Exercice ${y}`, from: `${y}-01-01`, to: `${y}-12-31` },
    { key: "previous", label: `Exercice ${y - 1}`, from: `${y - 1}-01-01`, to: `${y - 1}-12-31` },
    { key: "rolling", label: "12 derniers mois", from: iso(yearAgo), to: iso(today) },
  ] as const;
}

/** Regroupement thématique, partagé par l'écran et la fiche Bilan de l'exercice. */
export function statSections(s: BureauStats): StatSection[] {
  return [
    {
      title: "Membres & réseau",
      rows: [
        ["Particuliers actifs", s.members.particuliers_actifs],
        ["Professionnels bienfaiteurs actifs", s.members.pros_bienfaiteurs],
        ["Nouvelles inscriptions sur la période", s.members.nouveaux],
        ["Adhésions en attente de validation", s.members.en_attente],
      ],
    },
    {
      title: "Activités & événements",
      rows: [
        ["Activités organisées", s.life.activites],
        ["Événements organisés", s.life.evenements],
        ["Inscriptions", s.life.inscriptions],
        ["Présences validées", s.life.presences_validees],
        ["Personnes différentes inscrites", s.life.participants_uniques],
      ],
    },
    {
      title: "Projets & tâches",
      rows: [
        ["Projets en cours", s.projects.en_cours],
        ["Projets en préparation", s.projects.en_preparation],
        ["Projets en pause", s.projects.en_pause],
        ["Projets terminés", s.projects.termines],
        ["Projets lancés sur la période", s.projects.crees],
        ["Avancement moyen des projets", `${s.projects.avancement_moyen} %`],
        ["Tâches réalisées sur la période", s.projects.taches_realisees],
        ["Tâches ouvertes", s.projects.taches_ouvertes],
        ["Tâches dont l'échéance est passée", s.projects.taches_en_retard],
      ],
    },
    {
      title: "Engagement bénévole",
      rows: [
        ["Personnes engagées (tâches réalisées ou aide acceptée)", s.volunteers.benevoles_engages],
        ["Propositions d'aide reçues", s.volunteers.propositions],
        ["Propositions d'aide acceptées", s.volunteers.propositions_acceptees],
        ["Demandes d'aide", s.volunteers.demandes_aide],
        ["Tâches bénévoles réalisées", s.volunteers.taches_benevoles_realisees],
      ],
    },
    {
      title: "Pass Terrain & fidélité",
      rows: [
        ["Tampons attribués", s.pass.tampons],
        ["Personnes ayant reçu au moins un tampon", s.pass.beneficiaires],
        ["Tampons attribués automatiquement (participations)", s.pass.automatiques],
        ["Pass ouverts (total)", s.pass.cartes],
      ],
    },
  ];
}

const csvCell = (v: string | number) => {
  const text = String(v);
  // Neutralise les formules à l'ouverture dans un tableur.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[";\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** Export CSV (séparateur « ; » pour les tableurs français). */
export function bilanCsv(s: BureauStats, from: string, to: string, accounts?: AnnualAccounts | null) {
  const lines: string[] = [`Bilan de l'exercice;du ${from} au ${to}`, ""];
  if (accounts) lines.push(...accountsCsvLines(accounts, from, to));
  for (const section of statSections(s)) {
    lines.push(csvCell(section.title));
    for (const [label, value] of section.rows) lines.push(`${csvCell(label)};${csvCell(value)}`);
    lines.push("");
  }
  lines.push("Pass Terrain par partenaire;Tampons;Personnes");
  for (const p of s.pass.par_partenaire) lines.push(`${csvCell(p.name)};${p.tampons};${p.personnes}`);
  return lines.join("\n");
}
