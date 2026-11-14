import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { demoAddDog, demoRegister, demoStepsState, initialDemo } from "./first-steps-demo";

const draft = { name: "Senna", breed: "", birth_date: "" };

describe("démonstration du parcours « Mon premier chien & sortie »", () => {
  it("démarre comme un nouvel adhérent actif sans chien ni sortie : la carte s'affiche", () => {
    expect(demoStepsState(initialDemo())).toMatchObject({ visible: true, doneCount: 0 });
  });

  it("refuse un nom de chien trop court, comme le vrai parcours", () => {
    expect(demoAddDog(initialDemo(), { ...draft, name: " S " }).ok).toBe(false);
  });

  it("présenter le chien coche l'étape 1 et crée le foyer fictif", () => {
    const r = demoAddDog(initialDemo(), draft);
    expect(r.ok && r.state.householdCreated).toBe(true);
    expect(r.ok && demoStepsState(r.state)).toMatchObject({ dogDone: true, doneCount: 1, visible: true });
  });

  it("l'inscription simulée demande d'abord un chien", () => {
    expect(demoRegister(initialDemo()).ok).toBe(false);
  });

  it("les deux étapes faites, la carte disparaît", () => {
    const withDog = demoAddDog(initialDemo(), draft);
    if (!withDog.ok) throw new Error("chien refusé");
    const done = demoRegister(withDog.state);
    expect(done.ok && demoStepsState(done.state).visible).toBe(false);
  });

  it("la démonstration n'utilise jamais la base de données", () => {
    for (const file of ["src/lib/first-steps-demo.ts", "src/components/FirstStepsDemo.tsx"]) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(/integrations\/supabase|\.insert\(|\.rpc\(|\.update\(|\.from\(/);
    }
  });
});
