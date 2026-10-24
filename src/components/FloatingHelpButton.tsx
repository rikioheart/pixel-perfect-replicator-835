import { Link } from "@tanstack/react-router";
import { HandHeart, LifeBuoy, Lightbulb, Sparkles, type LucideIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type Entry = { to: string; title: string; text: string; icon: LucideIcon };

/** Une seule porte d'aide, discrète, sur toutes les pages connectées. */
export function FloatingHelpButton() {
  const { isBureau } = useAuth();
  const entries: Entry[] = [
    { to: "/help", title: "Guides pratiques", text: "Comprendre une page ou une démarche, pas à pas.", icon: LifeBuoy },
    { to: "/help-requests", title: "Demander un coup de main", text: "Un membre de l'association vous répond.", icon: HandHeart },
    { to: "/proposals", title: "Proposer une idée", text: "Partager une envie ou une amélioration.", icon: Lightbulb },
    ...(isBureau ? [{ to: "/admin/advisor", title: "Conseiller d'équipe", text: "Repérer les compétences utiles à un projet.", icon: Sparkles }] : []),
  ];
  return (
    <Sheet>
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
          {entries.map((e) => (
            <li key={e.to}>
              <SheetClose asChild>
                <Link to={e.to} className="flex gap-3 rounded-xl border border-border p-3 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <e.icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                  <span>
                    <span className="block font-medium">{e.title}</span>
                    <span className="block text-sm text-muted-foreground">{e.text}</span>
                  </span>
                </Link>
              </SheetClose>
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
