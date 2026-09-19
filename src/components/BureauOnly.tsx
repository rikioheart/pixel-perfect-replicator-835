import { AppShell } from "@/components/AppShell";

/** Écran affiché à la place d'une page réservée au Bureau. */
export function BureauOnly({ title }: { title: string }) {
  return (
    <AppShell title={title} subtitle="Accès réservé aux membres du Bureau">
      <div className="panel max-w-xl space-y-2 p-6">
        <p className="text-sm text-muted-foreground">
          Cette page est réservée aux membres du Bureau. Si vous pensez qu'il s'agit d'une erreur,
          contactez un membre du Bureau pour qu'il vous attribue le rôle correspondant.
        </p>
      </div>
    </AppShell>
  );
}
