import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      registerType: "prompt",

      /*
       * We explicitly register the service worker
       * through useRegisterSW().
       */
      injectRegister: null,

      includeAssets: ["favicon.ico", "apple-touch-icon.png", "mask-icon.svg"],

      manifest: {
        id: "/",
        name: "Marhaba - Find Your Perfect Stay",
        short_name: "Marhaba",

        description:
          "Book unique homes, apartments, and experiences across Libya",

        theme_color: "#1a1a2e",
        background_color: "#f7f6f2",

        display: "standalone",
        orientation: "portrait",

        start_url: "/",
        scope: "/",

        categories: ["travel", "lifestyle", "shopping"],

        icons: [
          {
            src: "/icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-512x512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },

      workbox: {
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,

        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],

        globIgnores: ["**/heic2any-*.js"],

        navigateFallbackDenylist: [/^\/api\//],

        runtimeCaching: [
          {
            /*
             * NEVER cache authentication or
             * private user information.
             */
            urlPattern:
              /^https:\/\/api\.mar-haba\.ly\/api\/v1\/(auth|bookings|users).*/i,

            handler: "NetworkOnly",
          },

          {
            /*
             * Public listing data.
             */
            urlPattern: /^https:\/\/api\.mar-haba\.ly\/api\/v1\/listings$/i,

            handler: "NetworkFirst",

            options: {
              cacheName: "marhaba-listings",

              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60,
              },

              networkTimeoutSeconds: 5,

              cacheableResponse: {
                statuses: [0, 200],
              },
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
            if (id.includes("react")) return "react-vendor";
            if (id.includes("mapbox-gl")) return "mapbox";
            if (id.includes("heic2any")) return "heic2any";
            if (id.includes("workbox")) return "workbox";
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
