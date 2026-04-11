import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Zakladna Vysker",
    short_name: "Zakladna",
    description: "Kiosk aplikace pro dochazku a rezervace Zakladny.",
    start_url: "/work/zakladna?source=pwa",
    scope: "/work/zakladna",
    display: "standalone",
    orientation: "any",
    background_color: "#f2ede3",
    theme_color: "#f2ede3",
    icons: [
      {
        src: "/pwa/zakladna-icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/pwa/zakladna-maskable.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
