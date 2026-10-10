import { Link } from "@tanstack/react-router";
import {
  CalendarDays,
  CalendarRange,
  FilePlus2,
  FolderPlus,
  HandHeart,
  Lightbulb,
  ListPlus,
  MapPin,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useMyPermissions } from "@/lib/permissions";

type CreateAction = {
  label: string;
  to: string;
  icon: typeof Plus;
  permission?: string;
  bureauOnly?: boolean;
  proOnly?: boolean;
};

const ACTIONS: CreateAction[] = [
  { label: "Projet", to: "/projects", icon: FolderPlus, permission: "projects.create" },
  { label: "Tâche", to: "/tasks", icon: ListPlus, permission: "tasks.create" },
  { label: "Activité", to: "/activities", icon: CalendarDays, permission: "activities.create" },
  { label: "Événement", to: "/events", icon: CalendarRange, permission: "events.create" },
  { label: "Document", to: "/documents", icon: FilePlus2, permission: "documents.upload" },
  { label: "Proposition", to: "/proposals", icon: Lightbulb },
  { label: "Demande d’aide", to: "/help-requests", icon: HandHeart },
  { label: "Réservation de terrain", to: "/terrain", icon: MapPin, proOnly: true },
];

export function QuickCreateMenu() {
  const { isBureau, profile } = useAuth();
  const { can } = useMyPermissions();
  const isPro = (profile?.membership_type ?? "").toUpperCase().includes("PRO");
  const actions = ACTIONS.filter((action) => {
    if (action.bureauOnly && !isBureau) return false;
    if (action.proOnly && !isBureau && !isPro) return false;
    if (action.permission && !isBureau && !can(action.permission)) return false;
    return true;
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="gap-2" aria-label="Créer ou proposer">
          <Plus className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Créer</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Créer ou proposer</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {actions.map((action) => (
          <DropdownMenuItem key={action.label} asChild className="min-h-11">
            <Link to={action.to}>
              <action.icon aria-hidden="true" />
              {action.label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}