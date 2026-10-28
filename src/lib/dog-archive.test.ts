import { describe, expect, it } from "vitest";
import { splitArchivedDogs } from "./dog-archive";

describe("archivage des fiches chien", () => {
  it("retire une fiche archivée des chiens actifs sans la perdre", () => {
    const { active, archived } = splitArchivedDogs([
      { id: "a", archived_at: null },
      { id: "b", archived_at: "2026-10-27T10:00:00Z" },
    ]);
    expect(active.map((d) => d.id)).toEqual(["a"]);
    expect(archived.map((d) => d.id)).toEqual(["b"]);
  });
});
