import type { MetadataRoute } from "next";
import { PROVINCE_TABLE } from "@indoquake/regions/meta";
import { NAV_ITEMS, SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...NAV_ITEMS.map((item) => ({
      url: SITE_URL + (item.href === "/" ? "" : item.href),
      changeFrequency: item.href === "/" ? ("always" as const) : ("daily" as const),
    })),
    ...PROVINCE_TABLE.map((province) => ({
      url: SITE_URL + "/provinsi/" + province.slug,
      changeFrequency: "daily" as const,
    })),
  ];
}
