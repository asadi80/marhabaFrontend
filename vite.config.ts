import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null, // registered via useRegisterSW()

      devOptions: { enabled: true },

      includeAssets: ["favicon.svg", "apple-touch-icon.png", "mask-icon.svg"],

      manifest: {
        id: "/",
        name: "Marhaba - Find Your Perfect Stay",
        short_name: "Marhaba",
        description:
          "Book unique homes, apartments, and experiences across Libya",

        lang: "en",
       

        theme_color: "#1a1a2e",
        background_color: "#f7f6f2",

        display: "standalone",
        start_url: "/",
        scope: "/",

        categories: ["travel", "lifestyle", "shopping"],

        icons: [
          { src: "/icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icon-512x512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],

        screenshots: [
          { src: "/screenshot-wide.png", sizes: "1280x720", type: "image/png", form_factor: "wide", label: "Marhaba on desktop" },
          { src: "/screenshot-narrow.png", sizes: "540x720", type: "image/png", form_factor: "narrow", label: "Marhaba on mobile" },
        ],
      },

      workbox: {
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        globIgnores: ["**/heic2any-*.js", "**/mapbox-*.js"],

        navigateFallbackDenylist: [/^\/api\//],

        runtimeCaching: [
          {
            // Private data: never cache.
            urlPattern:
              /^https:\/\/api\.mar-haba\.ly\/api\/v1\/(auth|bookings|users|messages).*/i,
            handler: "NetworkOnly",
          },
          {
            // Public listings, with or without query string.
            urlPattern: /^https:\/\/api\.mar-haba\.ly\/api\/v1\/listings(\?.*)?$/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "marhaba-listings",
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 },
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Map code: cached on first use instead of at install.
            urlPattern: ({ url }) => url.pathname.includes("/assets/mapbox-"),
            handler: "CacheFirst",
            options: {
              cacheName: "marhaba-mapbox-code",
              expiration: { maxEntries: 5 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],

  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes("node_modules")) {
            if (id.includes("react-router")) return "react-router";
            if (id.includes("mapbox-gl")) return "mapbox";
            if (id.includes("heic2any")) return "heic2any";
            if (id.includes("workbox")) return "workbox";
            if (id.includes("react")) return "react-vendor";
            return "vendor";
          }
        },
      },
    },
    sourcemap: false,
    minify: "esbuild",
    chunkSizeWarningLimit: 500,
  },
});