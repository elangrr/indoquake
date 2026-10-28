import type { MetadataRoute } from "next";
import { NAV_ITEMS, SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return NAV_ITEMS.map((item) => ({
    url: `${SITE_URL}${item.href === "/" ? "" : item.href}`,
    changeFrequency: item.href === "/" ? "always" : "daily",
  }));
}
