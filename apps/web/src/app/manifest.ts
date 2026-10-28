import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Indoquake",
    short_name: "Indoquake",
    lang: "id",
    start_url: "/",
    display: "browser",
    background_color: "#eef0ee",
    theme_color: "#121517",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
