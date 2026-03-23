import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["logo.svg"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        navigateFallbackDenylist: [/^\/login/, /^\/logout/],
      },
      manifest: {
        name: "PullPilot",
        short_name: "PullPilot",
        description: "Docker Homelab Updater",
        theme_color: "#ffffff",
        background_color: "#f8fafc",
        display: "standalone",
        orientation: "portrait",
        icons: [
          {
            src: "logo.svg",
            sizes: "any",
            type: "image/svg+xml",
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
