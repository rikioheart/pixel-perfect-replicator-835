import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useId, useState, type ReactNode } from "react";
import { Bell, Eye, Palette, RotateCcw, Type, Volume2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { playNotificationChime } from "@/lib/notification-sound";
import {
  COMFORT_DEFAULTS,
  DEFAULT_VIEWS,
  FONTS,
  LETTER_SPACINGS,
  LINE_SPACINGS,
  READING_DEFAULTS,
  READING_WIDTHS,
  SIGNATURES,
  TEXT_SCALES,
  THEMES,
  effectiveTextScale,
  useUserPreferences,
  type PreferencesPatch,
} from "@/lib/user-preferences";

export const Route = createFileRoute("/_authenticated/my-space")({
  head: () => ({
    meta: [
      { title: "Mes préférences — La Voix du Chien" },
      {
        name: "description",
        content: "Apparence, lecture, confort et notifications de votre espace membre.",
      },
      { property: "og:title", content: "Mes préférences — La Voix du Chien" },
      {
        property: "og:description",
        content: "Personnalisez l'apparence, la lecture, le confort et les notifications de votre espace associatif.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MySpacePage,
});

const FAMILIES = [
  { value: "APPARENCE", label: "Apparence", icon: Palette },
  { value: "LECTURE", label: "Lecture et typographie", icon: Type },
  { value: "CONFORT", label: "Confort et concentration", icon: Eye },
  { value: "NOTIFICATIONS", label: "Notifications et organisation", icon: Bell },
] as const;

const VIEW_HINTS: Record<string, string> = {
  LIST: "Une ligne par élément, facile à parcourir",
  CARDS: "Des cartes avec description et avancement",
  KANBAN: "Des colonnes par étape d'avancement",
};

function MySpacePage() {
  const [family, setFamily] = useState<string>("APPARENCE");
  const { preferences, save } = useUserPreferences();
  const set = (patch: PreferencesPatch) => save.mutate(patch);

  // Aperçu des polices : chargées seulement quand on ouvre la famille « Lecture ».
  useEffect(() => {
    if (family !== "LECTURE") return;
    for (const font of FONTS) {
      if (!font.href || document.getElementById(`lvdc-font-preview-${font.value}`)) continue;
      const link = document.createElement("link");
      link.id = `lvdc-font-preview-${font.value}`;
      link.rel = "stylesheet";
      link.href = font.href;
      document.head.appendChild(link);
    }
  }, [family]);

  const [deviceReducedMotion, setDeviceReducedMotion] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setDeviceReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return (
    <AppShell title="Mes préférences" subtitle="Votre espace, à votre façon : chaque réglage s'applique tout de suite">
      <Tabs value={family} onValueChange={setFamily}>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <TabsList aria-label="Familles de préférences" className="justify-start">
            {FAMILIES.map((f) => (
              <TabsTrigger key={f.value} value={f.value} className="gap-2">
                <f.icon className="size-4" aria-hidden="true" />
                {f.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
            {save.isPending ? "Enregistrement…" : save.isError ? "Dernier réglage non enregistré" : "Enregistré automatiquement"}
          </p>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 max-w-2xl">
            <TabsContent value="APPARENCE" className="mt-0 space-y-6">
              <Field label="Thème" hint="Automatique suit le réglage clair ou sombre de votre appareil.">
                {(id, hintId) => (
                  <Select value={preferences.theme} onValueChange={(theme) => set({ theme })}>
                    <SelectTrigger id={id} aria-describedby={hintId}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {THEMES.map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>

              <ChoiceCards
                legend="Signature de couleur"
                hint="Elle s'applique au thème clair comme au thème sombre."
                name="signature"
                value={preferences.signature}
                onChange={(signature) => set({ signature })}
                options={SIGNATURES.map((option) => ({
                  value: option.value,
                  label: option.label,
                  hint: option.hint,
                  extra: (
                    <span className="flex gap-1.5" aria-hidden>
                      <span
                        className={cn(
                          "size-6 rounded-full border",
                          option.value === "BLEU_NUIT" ? "bg-brand-nuit" : "bg-brand-bordeaux",
                        )}
                      />
                      <span className="size-6 rounded-full border bg-brand-cream" />
                      <span className="size-6 rounded-full border bg-brand-sand" />
                      <span className="size-6 rounded-full border bg-sage" />
                      <span className="size-6 rounded-full border bg-gold" />
                    </span>
                  ),
                }))}
              />

              <ChoiceCards
                legend="Affichage par défaut"
                hint="Vue proposée en premier sur la page Projets, la seule qui offre ces trois présentations. Vous pouvez toujours changer de vue sur place."
                name="default-view"
                value={preferences.default_view}
                onChange={(default_view) => set({ default_view })}
                columns={3}
                options={DEFAULT_VIEWS.map(([value, label]) => ({ value, label, hint: VIEW_HINTS[value] ?? "" }))}
              />
            </TabsContent>

            <TabsContent value="LECTURE" className="mt-0 space-y-6">
              <ChoiceCards
                legend="Police de lecture"
                hint="Atkinson Hyperlegible et Lexend sont des polices libres (licence SIL OFL), téléchargées seulement si vous les choisissez."
                name="font"
                value={preferences.font_family}
                onChange={(font_family) => set({ font_family })}
                columns={3}
                options={FONTS.map((font) => ({
                  value: font.value,
                  label: font.label,
                  hint: font.hint,
                  extra: (
                    <span className="block text-lg" style={{ fontFamily: `${font.family}, sans-serif` }} aria-hidden>
                      Aa Il1 0O
                    </span>
                  ),
                }))}
              />

              <Field label="Taille du texte" hint="Jusqu'à 200 %. Au-delà de 150 %, le menu se range derrière le bouton « Menu » pour laisser la place au contenu.">
                {(id, hintId) => (
                  <Select
                    value={String(effectiveTextScale(preferences))}
                    onValueChange={(value) => set({ text_scale: Number(value) })}
                  >
                    <SelectTrigger id={id} aria-describedby={hintId}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEXT_SCALES.map(([value, label]) => (
                        <SelectItem key={value} value={String(value)}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>

              <SelectField
                label="Interlignage"
                value={preferences.line_spacing}
                options={LINE_SPACINGS}
                onChange={(line_spacing) => set({ line_spacing })}
              />
              <SelectField
                label="Espacement des lettres et des mots"
                value={preferences.letter_spacing}
                options={LETTER_SPACINGS}
                onChange={(letter_spacing) => set({ letter_spacing })}
              />
              <SelectField
                label="Largeur des lignes de texte"
                hint="Des lignes plus courtes se lisent avec moins d'effort ; les cartes et tableaux gardent leur taille."
                value={preferences.reading_width}
                options={READING_WIDTHS}
                onChange={(reading_width) => set({ reading_width })}
              />
              <SwitchRow
                label="Plus d'espace entre les paragraphes"
                checked={preferences.paragraph_spacing === "WIDE"}
                onChange={(checked) => set({ paragraph_spacing: checked ? "WIDE" : "NORMAL" })}
              />

              <Button variant="outline" className="gap-2" onClick={() => set(READING_DEFAULTS)}>
                <RotateCcw className="size-4" aria-hidden="true" /> Rétablir la lecture par défaut
              </Button>
            </TabsContent>

            <TabsContent value="CONFORT" className="mt-0 space-y-6">
              <p className="text-sm text-muted-foreground">
                Ces réglages servent seulement votre confort : aucune information de santé ne vous est demandée ni enregistrée.
              </p>
              <SwitchRow
                label="Contraste renforcé"
                hint="Textes plus foncés (ou plus clairs en thème sombre), contours de champs et focus plus visibles, liens soulignés."
                checked={preferences.high_contrast}
                onChange={(high_contrast) => set({ high_contrast })}
              />
              <SwitchRow
                label="Réduire les animations"
                hint={
                  deviceReducedMotion
                    ? "Votre appareil demande déjà moins d'animations : c'est respecté automatiquement, même sans ce réglage."
                    : "Supprime les mouvements, fondus et défilements animés."
                }
                checked={preferences.reduced_motion}
                onChange={(reduced_motion) => set({ reduced_motion })}
              />
              <SwitchRow
                label="Interface plus aérée"
                hint="Plus d'espace entre les éléments et des zones à toucher plus grandes."
                checked={preferences.comfortable_spacing}
                onChange={(comfortable_spacing) => set({ comfortable_spacing })}
              />
              <SwitchRow
                label="Mode épuré"
                hint="Surfaces unies, sans ombres, illustrations décoratives ni animations, pour moins de distractions."
                checked={preferences.calm_mode}
                onChange={(calm_mode) => set({ calm_mode })}
              />
              <SwitchRow
                label="Mode focus"
                hint="Le menu se range derrière le bouton « Menu » et la page se centre sur ce que vous faites. Toutes les pages restent accessibles, et un bouton « Quitter le mode focus » reste visible."
                checked={preferences.focus_mode}
                onChange={(focus_mode) => set({ focus_mode })}
              />
              <Button variant="outline" className="gap-2" onClick={() => set(COMFORT_DEFAULTS)}>
                <RotateCcw className="size-4" aria-hidden="true" /> Rétablir le confort par défaut
              </Button>
            </TabsContent>

            <TabsContent value="NOTIFICATIONS" className="mt-0 space-y-6">
              <SwitchRow
                label="Notifications dans l'application"
                hint="Commentaires, tâches, validations, inscriptions… dans la cloche « Alertes »."
                checked={preferences.notify_in_app}
                onChange={(notify_in_app) => set({ notify_in_app })}
              />
              <SwitchRow
                label="Rappels avant mes rendez-vous"
                hint={
                  preferences.notify_in_app
                    ? "Deux jours puis la veille d'une sortie ou d'un événement où vous êtes inscrit, et avant l'échéance de vos tâches."
                    : "Les rappels arrivent dans la cloche « Alertes » : activez d'abord les notifications dans l'application."
                }
                checked={preferences.notify_reminders}
                disabled={!preferences.notify_in_app}
                onChange={(notify_reminders) => set({ notify_reminders })}
              />
              <SwitchRow
                label="Son discret à l'arrivée d'une notification"
                hint={
                  preferences.notify_in_app
                    ? "Deux notes douces, quand l'application est ouverte. Votre navigateur peut le bloquer tant que vous n'avez pas encore cliqué dans la page."
                    : "Activez d'abord les notifications dans l'application."
                }
                checked={preferences.notification_sound}
                disabled={!preferences.notify_in_app}
                onChange={(notification_sound) => set({ notification_sound })}
                action={
                  <Button variant="ghost" size="sm" className="gap-2" onClick={playNotificationChime}>
                    <Volume2 className="size-4" aria-hidden="true" /> Écouter le son
                  </Button>
                }
              />
              <SwitchRow
                label="Afficher « Ce que nous construisons ensemble » sur mon accueil"
                hint="Les nouvelles de l'association en bas de votre page d'accueil."
                checked={preferences.show_association_updates}
                onChange={(show_association_updates) => set({ show_association_updates })}
              />
              <p className="rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground">
                Notifications par e-mail : la plateforme n'en envoie pas pour l'instant. Ce réglage apparaîtra ici le jour où elles existeront.
              </p>
            </TabsContent>
          </div>

          <PreviewPanel />
        </div>
      </Tabs>
    </AppShell>
  );
}

/** Aperçu vivant : de vrais composants partagés, qui suivent immédiatement les réglages. */
function PreviewPanel() {
  return (
    <section aria-labelledby="apercu-titre" className="panel space-y-4 p-4 lg:sticky lg:top-4">
      <div>
        <h2 id="apercu-titre" className="text-base">
          Aperçu
        </h2>
        <p className="text-xs text-muted-foreground">Exemple fictif, pour voir vos réglages appliqués.</p>
      </div>
      <div inert className="space-y-3" aria-hidden="true">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg">Balade collective</h3>
          <Badge>Inscriptions ouvertes</Badge>
        </div>
        <p className="text-sm">
          Rendez-vous à l'entrée du parc. Chaque chien avance à son rythme, avec ses humains.
        </p>
        <p className="text-sm text-muted-foreground">Samedi matin · 8 places restantes</p>
        <Progress value={60} />
        <Input placeholder="Un mot pour l'équipe (facultatif)" />
        <div className="flex flex-wrap gap-2">
          <Button size="sm">Je participe</Button>
          <Button size="sm" variant="outline">
            Plus tard
          </Button>
          <Button size="sm" variant="link">
            Détails
          </Button>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Switch checked aria-label="Exemple activé" />
          <Switch checked={false} aria-label="Exemple désactivé" />
          <span>Rappel la veille</span>
        </div>
      </div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string, hintId?: string) => ReactNode }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children(id, hintId)}
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function SelectField({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label} hint={hint}>
      {(id, hintId) => (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger id={id} aria-describedby={hintId}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map(([optionValue, optionLabel]) => (
              <SelectItem key={optionValue} value={optionValue}>
                {optionLabel}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </Field>
  );
}

function SwitchRow({
  label,
  hint,
  checked,
  disabled,
  onChange,
  action,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  action?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="space-y-1">
      <div className="flex items-start justify-between gap-4">
        <Label htmlFor={id} className={cn("pt-0.5 leading-snug", disabled && "text-muted-foreground")}>
          {label}
        </Label>
        <Switch
          id={id}
          checked={checked}
          disabled={disabled}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onCheckedChange={onChange}
        />
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="pr-14 text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {action}
    </div>
  );
}

function ChoiceCards({
  legend,
  hint,
  name,
  value,
  onChange,
  options,
  columns = 2,
}: {
  legend: string;
  hint?: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; hint: string; extra?: ReactNode }[];
  columns?: 2 | 3;
}) {
  const hintId = `${name}-hint`;
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium leading-none">{legend}</legend>
      {hint ? (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
      <RadioGroup
        value={value}
        onValueChange={onChange}
        aria-describedby={hint ? hintId : undefined}
        className={cn("grid gap-3", columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}
      >
        {options.map((option) => {
          const selected = value === option.value;
          const optionId = `${name}-${option.value}`;
          return (
            <Label
              key={option.value}
              htmlFor={optionId}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-3 font-normal transition-colors hover:bg-accent motion-reduce:transition-none",
                selected && "border-2 border-primary",
              )}
            >
              <RadioGroupItem id={optionId} value={option.value} className="mt-1" />
              <span className="min-w-0 space-y-2">
                <span className="block font-medium text-foreground">{option.label}</span>
                <span className="block text-xs text-muted-foreground">{option.hint}</span>
                {option.extra}
              </span>
            </Label>
          );
        })}
      </RadioGroup>
    </fieldset>
  );
}
