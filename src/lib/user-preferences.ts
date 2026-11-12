import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type UserPreferences = {
  user_id: string;
  /** Ancienne taille en 3 paliers, conservée pour compatibilité : l'application lit text_scale. */
  text_size: string;
  text_scale: number;
  font_family: string;
  line_spacing: string;
  letter_spacing: string;
  paragraph_spacing: string;
  reading_width: string;
  high_contrast: boolean;
  reduced_motion: boolean;
  comfortable_spacing: boolean;
  calm_mode: boolean;
  focus_mode: boolean;
  default_view: string;
  notify_email: boolean;
  notify_in_app: boolean;
  notify_reminders: boolean;
  notification_sound: boolean;
  show_association_updates: boolean;
  theme: string;
  signature: string;
};

export type PreferencesPatch = Partial<Omit<UserPreferences, "user_id">>;

export const DEFAULT_PREFERENCES: Omit<UserPreferences, "user_id"> = {
  text_size: "NORMAL",
  text_scale: 100,
  font_family: "PLEX",
  line_spacing: "NORMAL",
  letter_spacing: "NORMAL",
  paragraph_spacing: "NORMAL",
  reading_width: "FULL",
  high_contrast: false,
  reduced_motion: false,
  comfortable_spacing: false,
  calm_mode: false,
  focus_mode: false,
  default_view: "LIST",
  notify_email: true,
  notify_in_app: true,
  notify_reminders: true,
  notification_sound: false,
  show_association_updates: true,
  theme: "SYSTEM",
  signature: "BORDEAUX",
};

/** Réglages de lecture remis à zéro par « Rétablir la lecture par défaut ». */
export const READING_DEFAULTS: PreferencesPatch = {
  text_scale: 100,
  font_family: "PLEX",
  line_spacing: "NORMAL",
  letter_spacing: "NORMAL",
  paragraph_spacing: "NORMAL",
  reading_width: "FULL",
};

/** Réglages de confort remis à zéro par « Rétablir le confort par défaut ». */
export const COMFORT_DEFAULTS: PreferencesPatch = {
  high_contrast: false,
  reduced_motion: false,
  comfortable_spacing: false,
  calm_mode: false,
  focus_mode: false,
};

export const THEMES: [string, string][] = [
  ["SYSTEM", "Automatique (selon l'appareil)"],
  ["LIGHT", "Clair"],
  ["DARK", "Sombre"],
];

/** Signature visuelle de l'espace membre, indépendante du thème clair/sombre. */
export const SIGNATURES: { value: string; label: string; hint: string }[] = [
  { value: "BORDEAUX", label: "Bordeaux", hint: "Chaleureux, la couleur historique de l'association" },
  { value: "BLEU_NUIT", label: "Bleu nuit", hint: "Plus calme, le bordeaux en touche complémentaire" },
];

/** Classe posée sur le document pour une signature (aucune pour Bordeaux, la signature par défaut). */
export function signatureClass(signature: string): string | null {
  return signature === "BLEU_NUIT" ? "sig-bleu-nuit" : null;
}

/** Paliers de taille du texte, jusqu'à 200 % (WCAG 1.4.4). */
export const TEXT_SCALES: [number, string][] = [
  [100, "100 % (par défaut)"],
  [112, "112 %"],
  [125, "125 %"],
  [150, "150 %"],
  [175, "175 %"],
  [200, "200 %"],
];

/** Polices : IBM Plex Sans par défaut ; les deux autres (licence SIL OFL) ne sont chargées que si on les choisit. */
export const FONTS: { value: string; label: string; hint: string; family: string; href: string | null }[] = [
  { value: "PLEX", label: "IBM Plex Sans", hint: "La police de l'association, titres en Libre Baskerville", family: '"IBM Plex Sans"', href: null },
  {
    value: "ATKINSON",
    label: "Atkinson Hyperlegible",
    hint: "Lettres très distinctes les unes des autres",
    family: '"Atkinson Hyperlegible"',
    href: "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap",
  },
  {
    value: "LEXEND",
    label: "Lexend",
    hint: "Formes simples et lettres plus espacées",
    family: '"Lexend"',
    href: "https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700&display=swap",
  },
];

export const LINE_SPACINGS: [string, string][] = [
  ["NORMAL", "Normal"],
  ["RELAXED", "Aéré"],
  ["LOOSE", "Très aéré"],
];

export const LETTER_SPACINGS: [string, string][] = [
  ["NORMAL", "Normal"],
  ["WIDE", "Légèrement espacé"],
  ["WIDER", "Espacé"],
];

export const PARAGRAPH_SPACINGS: [string, string][] = [
  ["NORMAL", "Normal"],
  ["WIDE", "Plus d'espace entre les paragraphes"],
];

export const READING_WIDTHS: [string, string][] = [
  ["FULL", "Toute la largeur disponible"],
  ["COMFORTABLE", "Lignes moyennes (environ 70 caractères)"],
  ["NARROW", "Lignes courtes (environ 60 caractères)"],
];

/** Vues proposées par la page Projets (seule page qui offre les trois). */
export const DEFAULT_VIEWS: [string, string][] = [
  ["LIST", "Liste"],
  ["CARDS", "Cartes"],
  ["KANBAN", "Kanban"],
];

/** Vue de départ de la page Projets selon la préférence (Liste si la valeur est inconnue). */
export function projectsViewFor(defaultView: string | undefined): "LIST" | "CARDS" | "KANBAN" {
  return defaultView === "CARDS" || defaultView === "KANBAN" ? defaultView : "LIST";
}

/** Toutes les classes que les préférences peuvent poser sur le document (retirées hors espace membre). */
export const PREFERENCE_CLASSES = [
  "dark",
  "sig-bleu-nuit",
  "prefs-high-contrast",
  "prefs-reduced-motion",
  "prefs-comfortable",
  "prefs-calm",
  "prefs-focus",
  "prefs-font-atkinson",
  "prefs-font-lexend",
  "prefs-text-large",
  "prefs-text-xlarge",
  "prefs-line-relaxed",
  "prefs-line-loose",
  "prefs-letter-wide",
  "prefs-letter-wider",
  "prefs-paragraph-wide",
  "prefs-measure-comfortable",
  "prefs-measure-narrow",
] as const;

/** Taille de texte effective, bornée aux paliers autorisés (100 % à 200 %). */
export function effectiveTextScale(prefs: Pick<UserPreferences, "text_scale">): number {
  const scale = Number(prefs.text_scale);
  if (!Number.isFinite(scale)) return 100;
  return Math.min(200, Math.max(100, scale));
}

/** Navigation compacte (menu derrière un bouton) : mode focus, ou texte agrandi à 150 % et plus. */
export function usesCompactNavigation(prefs: Pick<UserPreferences, "focus_mode" | "text_scale">): boolean {
  return prefs.focus_mode || effectiveTextScale(prefs) >= 150;
}

/** Classes à poser sur le document pour un jeu de préférences (hors thème sombre, qui dépend de l'appareil). */
export function preferenceClasses(prefs: Omit<UserPreferences, "user_id">): string[] {
  const scale = effectiveTextScale(prefs);
  const classes: (string | false | null)[] = [
    signatureClass(prefs.signature),
    prefs.high_contrast && "prefs-high-contrast",
    prefs.reduced_motion && "prefs-reduced-motion",
    prefs.comfortable_spacing && "prefs-comfortable",
    prefs.calm_mode && "prefs-calm",
    prefs.focus_mode && "prefs-focus",
    prefs.font_family === "ATKINSON" && "prefs-font-atkinson",
    prefs.font_family === "LEXEND" && "prefs-font-lexend",
    scale >= 125 && "prefs-text-large",
    scale >= 150 && "prefs-text-xlarge",
    prefs.line_spacing === "RELAXED" && "prefs-line-relaxed",
    prefs.line_spacing === "LOOSE" && "prefs-line-loose",
    prefs.letter_spacing === "WIDE" && "prefs-letter-wide",
    prefs.letter_spacing === "WIDER" && "prefs-letter-wider",
    prefs.paragraph_spacing === "WIDE" && "prefs-paragraph-wide",
    prefs.reading_width === "COMFORTABLE" && "prefs-measure-comfortable",
    prefs.reading_width === "NARROW" && "prefs-measure-narrow",
  ];
  return classes.filter((c): c is string => typeof c === "string");
}

function queryKeyFor(userId: string | undefined) {
  return ["user-preferences", userId] as const;
}

export function useUserPreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const key = queryKeyFor(user?.id);

  const query = useQuery({
    queryKey: key,
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return { ...DEFAULT_PREFERENCES, ...((data as Partial<UserPreferences> | null) ?? {}), user_id: user!.id } as UserPreferences;
    },
  });

  // Application immédiate : la valeur est posée tout de suite, puis enregistrée ; en cas d'échec on revient en arrière.
  const save = useMutation({
    mutationFn: async (patch: PreferencesPatch) => {
      const current = queryClient.getQueryData<UserPreferences>(key);
      const next = { ...DEFAULT_PREFERENCES, ...(current ?? {}), ...patch, user_id: user!.id };
      const { error } = await supabase.from("user_preferences").upsert(next, { onConflict: "user_id" });
      if (error) throw error;
      return next;
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<UserPreferences>(key);
      queryClient.setQueryData<UserPreferences>(key, {
        ...DEFAULT_PREFERENCES,
        ...(previous ?? {}),
        ...patch,
        user_id: user?.id ?? "",
      });
      return { previous };
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      toast.error("Ce réglage n'a pas pu être enregistré. Vérifiez votre connexion puis réessayez.");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  return {
    preferences: query.data ?? { user_id: user?.id ?? "", ...DEFAULT_PREFERENCES },
    isLoading: query.isLoading,
    save,
  };
}

const FONT_LINK_ID = "lvdc-reading-font";

/** Charge la police choisie à la demande (aucun téléchargement pour IBM Plex Sans, déjà chargée). */
function loadReadingFont(fontFamily: string) {
  const font = FONTS.find((f) => f.value === fontFamily);
  const existing = document.getElementById(FONT_LINK_ID) as HTMLLinkElement | null;
  if (!font?.href) return;
  if (existing?.href === font.href) return;
  const link = existing ?? document.createElement("link");
  link.id = FONT_LINK_ID;
  link.rel = "stylesheet";
  link.href = font.href;
  if (!existing) document.head.appendChild(link);
}

/** Applique les préférences sur le document (lecture, confort, thème, signature). */
export function useApplyPreferences() {
  const { preferences } = useUserPreferences();
  const classes = preferenceClasses(preferences).join(" ");
  const scale = effectiveTextScale(preferences);
  const { theme, font_family } = preferences;

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => root.classList.toggle("dark", resolveDark(theme, media.matches));
    loadReadingFont(font_family);
    root.style.fontSize = scale === 100 ? "" : `${scale}%`;
    for (const name of PREFERENCE_CLASSES) if (name !== "dark") root.classList.remove(name);
    if (classes) root.classList.add(...classes.split(" "));
    apply();
    media.addEventListener("change", apply);
    // Les réglages ne valent que pour l'espace membre : la page publique garde son rendu.
    return () => {
      media.removeEventListener("change", apply);
      root.classList.remove(...PREFERENCE_CLASSES);
      root.style.fontSize = "";
    };
  }, [classes, scale, theme, font_family]);
}

/** Thème effectif : choix explicite, sinon réglage de l'appareil. */
export function resolveDark(theme: string, systemDark: boolean): boolean {
  return theme === "DARK" || (theme === "SYSTEM" && systemDark);
}
