import { Link } from "@tanstack/react-router";
import { HeartHandshake } from "lucide-react";
import { CHARTER_TAGLINE } from "@/lib/philosophy";
import { Button } from "@/components/ui/button";

export function CharterBanner() {
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-lg border border-border bg-secondary/40 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <HeartHandshake className="mt-0.5 size-5 shrink-0 text-primary" />
        <div>
          <p className="font-medium">{CHARTER_TAGLINE}</p>
          <p className="text-sm text-muted-foreground">
            Signaler un blocage ou avancer par petits pas fait partie du fonctionnement normal.
          </p>
        </div>
      </div>
      <Button asChild variant="outline" size="sm" className="shrink-0">
        <Link to="/charter">Notre manière de travailler</Link>
      </Button>
    </div>
  );
}
