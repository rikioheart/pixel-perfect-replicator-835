import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { useUserPreferences, TEXT_SIZES, DEFAULT_VIEWS, THEMES, SIGNATURES } from "@/lib/user-preferences";

export const Route = createFileRoute("/_authenticated/my-space")({
  head: () => ({
    meta: [
      { title: "Mes préférences — La Voix du Chien" },
      {
        name: "description",
        content:
          "Préférences d’affichage, d’accessibilité et de notifications de votre espace.",
      },
      { property: "og:title", content: "Mes préférences — La Voix du Chien" },
      {
        property: "og:description",
        content: "Personnalisez la lecture et les notifications de votre espace associatif.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MySpacePage,
});

const TABS: [string, string][] = [
  ["PREFERENCES", "Affichage & accessibilité"],
  ["COMPTE", "Notifications"],
];

function MySpacePage() {
  const [tab, setTab] = useState("PREFERENCES");
  const { preferences, save } = useUserPreferences();

  return (
    <AppShell
      title="Mes préférences"
      subtitle="Votre confort de lecture et vos notifications"
    >
      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map(([key, label]) => (
          <Button
            key={key}
            size="sm"
            variant={tab === key ? "default" : "outline"}
            className="rounded-md"
            onClick={() => setTab(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      {tab === "PREFERENCES" && (
        <div className="max-w-xl space-y-5">
          <div className="space-y-2">
            <Label>Thème</Label>
            <Select value={preferences.theme} onValueChange={(value) => save.mutate({ theme: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {THEMES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium leading-none">Signature de couleur</legend>
            <p className="text-sm text-muted-foreground">
              Elle s'applique au thème clair comme au thème sombre.
            </p>
            <RadioGroup
              value={preferences.signature}
              onValueChange={(value) => save.mutate({ signature: value })}
              className="grid gap-3 sm:grid-cols-2"
            >
              {SIGNATURES.map((option) => {
                const selected = preferences.signature === option.value;
                return (
                  <Label
                    key={option.value}
                    htmlFor={`signature-${option.value}`}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-3 font-normal transition-colors hover:bg-accent",
                      selected && "border-primary",
                    )}
                  >
                    <RadioGroupItem id={`signature-${option.value}`} value={option.value} className="mt-1" />
                    <span className="min-w-0 space-y-2">
                      <span className="block font-medium text-foreground">{option.label}</span>
                      <span className="block text-xs text-muted-foreground">{option.hint}</span>
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
                    </span>
                  </Label>
                );
              })}
            </RadioGroup>
          </fieldset>
          <div className="space-y-2">
            <Label>Taille du texte</Label>
            <Select
              value={preferences.text_size}
              onValueChange={(value) => save.mutate({ text_size: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEXT_SIZES.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Affichage par défaut des listes</Label>
            <Select
              value={preferences.default_view}
              onValueChange={(value) => save.mutate({ default_view: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEFAULT_VIEWS.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="contrast">Contraste renforcé</Label>
            <Switch
              id="contrast"
              checked={preferences.high_contrast}
              onCheckedChange={(checked) => save.mutate({ high_contrast: checked })}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="motion">Réduire les animations</Label>
            <Switch
              id="motion"
              checked={preferences.reduced_motion}
              onCheckedChange={(checked) => save.mutate({ reduced_motion: checked })}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="spacing">Espacement confortable</Label>
            <Switch
              id="spacing"
              checked={preferences.comfortable_spacing}
              onCheckedChange={(checked) => save.mutate({ comfortable_spacing: checked })}
            />
          </div>



        </div>
      )}

      {tab === "COMPTE" && (
        <div className="max-w-xl space-y-5">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="in-app">Notifications dans l'application</Label>
            <Switch
              id="in-app"
              checked={preferences.notify_in_app}
              onCheckedChange={(checked) => save.mutate({ notify_in_app: checked })}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="email">Notifications par e-mail</Label>
            <Switch
              id="email"
              checked={preferences.notify_email}
              onCheckedChange={(checked) => save.mutate({ notify_email: checked })}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="reminders">Rappels avant mes rendez-vous</Label>
            <Switch
              id="reminders"
              checked={preferences.notify_reminders}
              onCheckedChange={(checked) => save.mutate({ notify_reminders: checked })}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="updates">Afficher « Ce que nous construisons ensemble » sur mon accueil</Label>
            <Switch
              id="updates"
              checked={preferences.show_association_updates}
              onCheckedChange={(checked) => save.mutate({ show_association_updates: checked })}
            />
          </div>
        </div>
      )}
    </AppShell>
  );
}
