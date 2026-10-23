import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { downloadIcs, googleCalendarUrl, type AgendaItem } from "@/lib/calendar-export";

/** « Ajouter à mon agenda » : copie ponctuelle, pas de synchronisation. */
export function AddToAgenda({ item }: { item: AgendaItem }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm"><CalendarPlus className="mr-1.5 size-4" aria-hidden />Ajouter à mon agenda</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem asChild>
          <a href={googleCalendarUrl(item)} target="_blank" rel="noopener noreferrer">Google Agenda</a>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => downloadIcs(item)}>Apple, Outlook ou autre (fichier .ics)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
