import { Link } from "@tanstack/react-router";
import { Stamp, UserRound } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { profileCompletion, useLoyaltySnapshot } from "@/lib/home-config";

/** Compteur de fidélité toujours visible, avec progression vers le palier suivant. */
export function LoyaltyCardMini() {
  const { user } = useAuth();
  const { data } = useLoyaltySnapshot(user?.id);
  const stamps = data?.stamps ?? 0;
  const next = data?.nextThreshold ?? null;
  const percent = next ? Math.min(100, Math.round((stamps / next) * 100)) : 100;

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs uppercase tracking-wide">Ma fidélité</span>
        <Stamp className="size-4" />
      </div>
      <p className="mt-2 font-display text-3xl">{stamps} tampons</p>
      <Progress className="mt-3" value={percent} />
      <p className="mt-2 text-xs text-muted-foreground">
        {next
          ? `Encore ${next - stamps} tampon(s) avant « ${data?.nextReward ?? "le palier suivant"} »`
          : "Tous les paliers connus sont atteints. Bravo !"}
      </p>
      <Button asChild size="sm" variant="ghost" className="mt-2 px-0">
        <Link to="/loyalty">Voir ma carte</Link>
      </Button>
    </div>
  );
}

/** Encourage chacun à compléter sa fiche, sans culpabiliser. */
export function ProfileCompletionCard() {
  const { profile } = useAuth();
  const { percent, missing } = profileCompletion(profile);

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs uppercase tracking-wide">Mon profil</span>
        <UserRound className="size-4" />
      </div>
      <p className="mt-2 font-display text-3xl">{percent}%</p>
      <Progress className="mt-3" value={percent} />
      <p className="mt-2 text-xs text-muted-foreground">
        {missing.length === 0
          ? "Votre fiche est complète, merci !"
          : `Il reste à renseigner : ${missing.slice(0, 3).join(", ")}`}
      </p>
      <Button asChild size="sm" variant="ghost" className="mt-2 px-0">
        <Link to="/profile">Compléter ma fiche</Link>
      </Button>
    </div>
  );
}
