/** Texte comparable : minuscules, sans accents ni espaces superflus. */
export function foldText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Filtre par nom et prénom, dans n'importe quel ordre (« camus mar » trouve « Marie Camus »). */
export function filterByName<T extends { name: string }>(items: T[], query: string): T[] {
  const words = foldText(query).split(" ").filter(Boolean);
  if (words.length === 0) return items;
  return items.filter((item) => {
    const name = foldText(item.name);
    return words.every((w) => name.includes(w));
  });
}
