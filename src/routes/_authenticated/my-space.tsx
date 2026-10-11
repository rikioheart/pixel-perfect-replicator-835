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
import { useUserPreferences, TEXT_SIZES, DEFAULT_VIEWS } from "@/lib/user-preferences";

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
