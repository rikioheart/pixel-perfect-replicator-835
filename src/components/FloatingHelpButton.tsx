import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Heart, LifeBuoy, Lightbulb, MessageCircleQuestion, Sparkles, type LucideIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { HelpWizard } from "@/components/HelpWizard";

type Entry = { to: string; title: string; text: string; icon: LucideIcon };

const itemClass =
  "flex w-full gap-3 rounded-xl border border-border p-3 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function EntryBody({ title, text, icon: Icon }: Omit<Entry, "to">) {
  return (
    <>
      <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
      <span>
        <span className="block font-medium">{title}</span>
        <span className="block text-sm text-muted-foreground">{text}</span>
      </span>
    </>
  );
}

/** Une seule porte d'aide, discrète, sur toutes les pages connectées. */
export function FloatingHelpButton() {
  const { isBureau } = useAuth();
  const [open, setOpen] = useState(false);
  const [helping, setHelping] = useState(false);
  const before: Entry[] = [
    { to: "/help", title: "Guides pratiques", text: "Comprendre une page ou une démarche, pas à pas.", icon: LifeBuoy },
    { to: "/help-requests", title: "Demander un coup de main", text: "Vous avez besoin d'aide : un membre vous répond.", icon: MessageCircleQuestion },
  ];
  const after: Entry[] = [
    { to: "/proposals", title: "Proposer une idée", text: "Partager une envie ou une amélioration.", icon: Lightbulb },
    ...(isBureau ? [{ to: "/admin/advisor", title: "Conseiller d'équipe", text: "Repérer les compétences utiles à un projet.", icon: Sparkles }] : []),
  ];
  const link = (e: Entry) => (
    <li key={e.to}>
      <SheetClose asChild>
        <Link to={e.to} className={itemClass}><EntryBody {...e} /></Link>
      </SheetClose>
    </li>
  );
  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            size="icon"
            className="fixed bottom-24 right-4 z-30 size-12 rounded-full shadow-lg md:bottom-6 md:right-6"
            aria-label="Aide et entraide"
          >
            <LifeBuoy className="size-5" aria-hidden />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[88vw] sm:max-w-sm">
          <SheetHeader className="text-left">
            <SheetTitle>Aide & entraide</SheetTitle>
            <SheetDescription>Que souhaitez-vous faire ?</SheetDescription>
          </SheetHeader>
          <ul className="mt-6 space-y-2">
            {before.map(link)}
            <li>
              <button
                type="button"
                className={itemClass}
                onClick={() => { setOpen(false); setHelping(true); }}
              >
                <EntryBody title="Je veux aider" text="Proposer vos compétences ou du temps sur un projet associatif." icon={Heart} />
              </button>
            </li>
            {after.map(link)}
          </ul>
        </SheetContent>
      </Sheet>
      <HelpWizard open={helping} onOpenChange={setHelping} />
    </>
  );
}
