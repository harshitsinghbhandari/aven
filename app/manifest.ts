import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aven",
    short_name: "Aven",
    description: "Voice native operational memory for small teams",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#f4f0e8",
    theme_color: "#171714",
    orientation: "portrait",
    icons: [{ src: "/aven-logo.png", sizes: "900x900", type: "image/png", purpose: "any" }],
  };
}
