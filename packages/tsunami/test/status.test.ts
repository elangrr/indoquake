import { describe, expect, it } from "vitest";
import { tsunamiStatusFromPotential } from "../src/status";

describe("tsunamiStatusFromPotential", () => {
  it("maps true to potential threat", () => {
    const info = tsunamiStatusFromPotential(true);
    expect(info.status).toBe("potential");
    expect(info.label).toContain("BERPOTENSI");
    expect(info.source).toBe("BMKG");
  });

  it("maps false to no threat", () => {
    const info = tsunamiStatusFromPotential(false);
    expect(info.status).toBe("no-threat");
    expect(info.label).toContain("TIDAK BERPOTENSI");
  });

  it("maps null to unknown", () => {
    const info = tsunamiStatusFromPotential(null);
    expect(info.status).toBe("unknown");
  });

  it("never declares a tsunami itself", () => {
    for (const value of [true, false, null]) {
      const info = tsunamiStatusFromPotential(value);
      expect(info.source).toBe("BMKG");
      expect(info.description.toLowerCase()).toContain("bmkg");
    }
  });
});
