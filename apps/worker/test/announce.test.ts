import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { shouldAnnounce, shouldReannounce } from "../src/announce";

const NOW = Date.parse("2026-10-28T12:00:00.000Z");
const minutesAgo = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

describe("shouldAnnounce (A-06, D07)", () => {
  it.each([
    [0, "notify"],
    [30, "notify"],
    [31, "log"],
    [360, "log"],
    [361, "store"],
    [60 * 24 * 40, "store"],
  ])("a quake %i minutes old is %s", (minutes, expected) => {
    expect(shouldAnnounce(minutesAgo(minutes), NOW)).toBe(expected);
  });

  it("never gets louder as the quake gets older (property)", () => {
    const rank = { notify: 2, log: 1, store: 0 } as const;
    fc.assert(
      fc.property(fc.nat(10 * 24 * 60), fc.nat(10 * 24 * 60), (a, b) => {
        const [younger, older] = a <= b ? [a, b] : [b, a];
        expect(rank[shouldAnnounce(minutesAgo(older), NOW)]).toBeLessThanOrEqual(
          rank[shouldAnnounce(minutesAgo(younger), NOW)],
        );
      }),
      { seed: 133, numRuns: 100 },
    );
  });
});

describe("shouldReannounce (BRIEF A2 revision rule)", () => {
  it.each([
    ["tsunami flag false to true", { magnitude: 5, tsunamiPotential: false }, { magnitude: 5, tsunamiPotential: true }, true],
    ["tsunami flag unknown to false", { magnitude: 5, tsunamiPotential: null }, { magnitude: 5, tsunamiPotential: false }, true],
    ["magnitude +0.5", { magnitude: 5, tsunamiPotential: false }, { magnitude: 5.5, tsunamiPotential: false }, true],
    ["magnitude -0.5", { magnitude: 5.6, tsunamiPotential: false }, { magnitude: 5.1, tsunamiPotential: false }, true],
    ["magnitude +0.3 within one side", { magnitude: 5, tsunamiPotential: false }, { magnitude: 5.3, tsunamiPotential: false }, false],
    ["magnitude crossing 4.5 upwards", { magnitude: 4.4, tsunamiPotential: false }, { magnitude: 4.6, tsunamiPotential: false }, true],
    ["magnitude crossing 4.5 downwards", { magnitude: 4.6, tsunamiPotential: false }, { magnitude: 4.4, tsunamiPotential: false }, true],
    ["depth-only revision", { magnitude: 5, tsunamiPotential: false }, { magnitude: 5, tsunamiPotential: false }, false],
  ])("%s gives %s", (_label, previous, next, expected) => {
    expect(shouldReannounce(previous, next, 4.5)).toBe(expected);
  });

  it("is false for small magnitude moves that stay on one side of the threshold (property)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 50, max: 90 }), fc.integer({ min: -4, max: 4 }), (tenths, delta) => {
        const previous = { magnitude: tenths / 10, tsunamiPotential: false };
        const next = { magnitude: (tenths + delta) / 10, tsunamiPotential: false };
        expect(shouldReannounce(previous, next, 4.5)).toBe(false);
      }),
      { seed: 133, numRuns: 100 },
    );
  });
});
