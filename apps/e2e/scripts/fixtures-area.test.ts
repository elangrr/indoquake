import { describe, expect, it } from "vitest";
import { describeLocation } from "../../../packages/regions/src/lookup";
import { quakes } from "../support/fixtures";

// The mocked fixtures carry literal server assignments; they must equal what the server would assign.
describe("mocked fixtures match the server assignment (R137)", () => {
  it.each(quakes(0).map((event) => [event.regionName, event] as const))("%s", (_region, event) => {
    const area = describeLocation(event.latitude, event.longitude);
    expect({
      areaKind: event.areaKind,
      provinceSlug: event.provinceSlug,
      nearestProvinceSlug: event.nearestProvinceSlug,
      nearestProvinceKm: event.nearestProvinceKm,
      zone: event.zone,
    }).toEqual({
      areaKind: area?.kind,
      provinceSlug: area?.provinceSlug,
      nearestProvinceSlug: area?.nearestProvinceSlug,
      nearestProvinceKm: area?.nearestProvinceKm,
      zone: area?.zone,
    });
  });
});
