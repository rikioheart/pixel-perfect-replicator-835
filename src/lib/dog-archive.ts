/** Fiches chien : actives vs archivées (archivage non destructif, historique conservé). */
export function splitArchivedDogs<T extends { archived_at?: string | null }>(dogs: T[]) {
  return {
    active: dogs.filter((d) => !d.archived_at),
    archived: dogs.filter((d) => Boolean(d.archived_at)),
  };
}
