import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { MemberForm } from "@/components/MemberForm";
import { useAuth } from "@/hooks/useAuth";
import { emptyMemberForm } from "@/lib/member-schema";
import { createMember } from "@/lib/members.functions";

export const Route = createFileRoute("/_authenticated/members/new")({
  head: () => ({
    meta: [
      { title: "Nouvel adhérent — La Voix du Chien" },
      {
        name: "description",
        content:
          "Créer une fiche adhérent complète : identité, coordonnées, type d'adhésion, statut et niveau d'implication.",
      },
      { property: "og:title", content: "Nouvel adhérent — La Voix du Chien" },
      {
        property: "og:description",
        content: "Ajout d'un membre au CRM de l'association La Voix du Chien.",
      },
    ],
  }),
  component: NewMemberPage,
});

function NewMemberPage() {
  const { isBureau } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const create = useServerFn(createMember);

  if (!isBureau) {
    return (
      <AppShell title="Nouvel adhérent">
        <p className="text-sm text-muted-foreground">
          Seul le Bureau peut créer une fiche adhérent.
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Nouvel adhérent"
      subtitle="Créer une fiche complète et un accès à l'espace membre"
      actions={
        <Button asChild variant="ghost" size="sm" className="gap-2">
          <Link to="/members">
            <ArrowLeft className="size-4" /> Adhérents
          </Link>
        </Button>
      }
    >
      <div className="panel max-w-3xl p-6">
        <MemberForm
          initialValues={emptyMemberForm}
          submitLabel="Créer l'adhérent"
          onCancel={() => void navigate({ to: "/members" })}
          onSubmit={async (values) => {
            try {
              const result = await create({ data: values });
              await queryClient.invalidateQueries({ queryKey: ["members"] });
              toast.success("Adhérent créé.");
              void navigate({ to: "/members/$memberId", params: { memberId: result.id } });
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Création impossible.");
            }
          }}
        />
      </div>
    </AppShell>
  );
}
