import { describe, expect, it } from "vitest";
import { notificationLabel } from "./notification-types";

describe("notificationLabel", () => {
  it("traduit les rappels d'échéance", () => {
    expect(notificationLabel("TASK_DEADLINE")).toBe("Échéance proche");
  });
  it("n'affiche jamais un code technique inconnu", () => {
    expect(notificationLabel("SOMETHING_NEW")).toBe("Information");
  });
});
