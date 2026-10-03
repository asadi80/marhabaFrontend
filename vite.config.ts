import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      registerType: "autoUpdate",

      // You are registering the service worker manually
      // through useRegisterSW().
      injectRegister: null,

      // IMPORTANT:
      // Do not run the PWA service worker during normal Vite development.
      // Use "npm run build && npm run preview" when you want to test
      // the production PWA locally.
      devOptions: {
        enabled: false,
      },

      includeAssets: [
        "favicon.svg",
        "apple-touch-icon.png",
        "mask-icon.svg",
      ],

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

        screenshots: [
          {
            src: "/screenshot-wide.png",
            sizes: "1280x720",
            type: "image/png",
            form_factor: "wide",
            label: "Marhaba on desktop",
          },
          {
            src: "/screenshot-narrow.png",
            sizes: "540x720",
            type: "image/png",
            form_factor: "narrow",
            label: "Marhaba on mobile",
          },
        ],
      },

      workbox: {
        // Remove old precache versions.
        cleanupOutdatedCaches: true,

        // Automatically activate the newest service worker.
        skipWaiting: true,
        clientsClaim: true,

        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,

        globPatterns: [
          "**/*.{js,css,html,ico,png,svg,woff,woff2}",
        ],

        globIgnores: [
          "**/heic2any-*.js",
          "**/mapbox-*.js",
        ],

        // Never use the PWA fallback for API requests.
        navigateFallbackDenylist: [/^\/api\//],

        runtimeCaching: [
          {
            // PRIVATE DATA
            // Never cache authentication, bookings, users, or messages.
            urlPattern:
              /^https:\/\/api\.mar-haba\.ly\/api\/v1\/(auth|bookings|users|messages).*$/i,

            handler: "NetworkOnly",
          },

          {
            // PUBLIC LISTINGS
            // Network first means users normally get fresh data.
            urlPattern:
              /^https:\/\/api\.mar-haba\.ly\/api\/v1\/listings(\?.*)?$/i,

            handler: "NetworkFirst",

            options: {
              cacheName: "marhaba-listings-v1",

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

          {
            // MAPBOX CODE
            // Cache after first use.
            urlPattern: ({ url }) =>
              url.pathname.includes("/assets/mapbox-"),

            handler: "CacheFirst",

            options: {
              cacheName: "marhaba-mapbox-code-v1",

              expiration: {
                maxEntries: 5,
              },

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
            if (id.includes("react-router")) {
              return "react-router";
            }

            if (id.includes("mapbox-gl")) {
              return "mapbox";
            }

            if (id.includes("heic2any")) {
              return "heic2any";
            }

            if (id.includes("workbox")) {
              return "workbox";
            }

            if (id.includes("react")) {
              return "react-vendor";
            }

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