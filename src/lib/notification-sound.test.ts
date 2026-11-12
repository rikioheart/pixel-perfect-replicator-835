import { beforeEach, describe, expect, it } from "vitest";
import { newUnreadToChime, resetChimeTracking } from "./notification-sound";

describe("Son de notification", () => {
  beforeEach(() => resetChimeTracking());

  it("ne sonne pas pour les notifications déjà présentes à l'ouverture", () => {
    expect(newUnreadToChime(["a", "b"])).toEqual([]);
  });

  it("sonne une seule fois pour une nouvelle notification, même vue par deux zones de l'écran", () => {
    newUnreadToChime(["a"]);
    expect(newUnreadToChime(["c", "a"])).toEqual(["c"]);
    expect(newUnreadToChime(["c", "a"])).toEqual([]);
  });

  it("garde le suivi pour le même compte et repart de zéro pour un autre compte", () => {
    resetChimeTracking("user-1");
    newUnreadToChime(["a"]);
    resetChimeTracking("user-1");
    expect(newUnreadToChime(["a", "b"])).toEqual(["b"]);
    resetChimeTracking("user-2");
    expect(newUnreadToChime(["a", "b", "c"])).toEqual([]);
  });
});
