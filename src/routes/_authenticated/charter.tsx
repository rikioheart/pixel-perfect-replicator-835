import { createFileRoute } from "@tanstack/react-router";
import { HeartHandshake } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CHARTER_TAGLINE, PRINCIPLES } from "@/lib/philosophy";

export const Route = createFileRoute("/_authenticated/charter")({
  head: () => ({
    meta: [
      { title: "Notre manière de travailler — La Voix du Chien" },
      {
        name: "description",
        content:
          "Les principes de coopération de La Voix du Chien et la façon dont la plateforme les traduit concrètement.",
      },
      { property: "og:title", content: "Notre manière de travailler — La Voix du Chien" },
      {
        property: "og:description",
        content: "Ensemble, progressivement, chacun à son niveau — et rien ne se perd.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CharterPage,
});

function CharterPage() {
  return (
    <AppShell title="Notre manière de travailler" subtitle={CHARTER_TAGLINE}>
      <div className="mb-4 flex items-start gap-3 rounded-lg border border-border bg-secondary/40 p-4">
        <HeartHandshake className="mt-0.5 size-5 shrink-0 text-primary" />
        <p className="text-sm text-muted-foreground">
          Cette plateforme est un outil de coopération, pas une couche administrative
          supplémentaire. Chaque principe ci-dessous correspond à une fonction concrète : rien
          n'est obligatoire pour « faire joli », tout sert à avancer ensemble.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {PRINCIPLES.map((principle, index) => (
          <Card key={principle.title}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-baseline gap-2 text-base">
                <span className="font-display text-primary">{index + 1}.</span>
                {principle.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>{principle.body}</p>
              <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                Dans la plateforme : {principle.concrete}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
