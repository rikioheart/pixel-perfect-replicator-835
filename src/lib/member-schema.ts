import { z } from "zod";

export const MEMBERSHIP_TYPES = [
  "PARTICULIER",
  "PROFESSIONNEL",
  "BUREAU",
  "BENEVOLE",
  "PARTENAIRE",
] as const;

export const MEMBERSHIP_STATUSES = ["PENDING", "ACTIVE", "SUSPENDED", "INACTIVE"] as const;

export const INVOLVEMENT_LEVELS = ["OCCASIONNEL", "REGULIER", "INTENSIF"] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { message: `Maximum ${max} caractères.` })
    .optional()
    .or(z.literal(""));

export const memberFormSchema = z.object({
  first_name: z
    .string()
    .trim()
    .min(1, { message: "Le prénom est obligatoire." })
    .max(80, { message: "Maximum 80 caractères." }),
  last_name: z
    .string()
    .trim()
    .min(1, { message: "Le nom est obligatoire." })
    .max(80, { message: "Maximum 80 caractères." }),
  email: z
    .string()
    .trim()
    .email({ message: "Adresse e-mail invalide." })
    .max(255, { message: "Maximum 255 caractères." }),
  phone: optionalText(30).refine(
    (value) => !value || /^[0-9+().\-\s]{6,30}$/.test(value),
    { message: "Numéro de téléphone invalide." },
  ),
  city: optionalText(80),
  department: optionalText(80),
  bio: optionalText(1000),
  membership_type: z.enum(MEMBERSHIP_TYPES),
  membership_status: z.enum(MEMBERSHIP_STATUSES),
  involvement_level: z.enum(INVOLVEMENT_LEVELS).optional().or(z.literal("")),
  membership_date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Date invalide (AAAA-MM-JJ)." })
    .optional()
    .or(z.literal("")),
  public_visibility: z.boolean(),
});

export type MemberFormValues = z.infer<typeof memberFormSchema>;

export const emptyMemberForm: MemberFormValues = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  city: "",
  department: "",
  bio: "",
  membership_type: "PARTICULIER",
  membership_status: "PENDING",
  involvement_level: "",
  membership_date: "",
  public_visibility: false,
};

export const updateMemberSchema = memberFormSchema.extend({
  id: z.string().uuid({ message: "Identifiant adhérent invalide." }),
});

export const INVOLVEMENT_LABEL: Record<string, string> = {
  OCCASIONNEL: "Occasionnel",
  REGULIER: "Régulier",
  INTENSIF: "Intensif",
};
