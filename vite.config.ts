// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  vite: { plugins: [VitePWA({
    strategies: 'generateSW', filename: 'sw.js', registerType: 'autoUpdate', injectRegister: null,
    manifest: false, devOptions: { enabled: false },
    workbox: {
      globPatterns: ['**/*.{js,css,png,jpg,woff2}'],
      additionalManifestEntries: [{url:'/offline.html', revision:'1'}],
      navigateFallback: '/offline.html', navigateFallbackDenylist: [/^\/~oauth/, /^\/api/],
      runtimeCaching: [{ urlPattern: ({request, url}) => request.mode === 'navigate' && !url.pathname.startsWith('/~oauth') && !url.pathname.startsWith('/api'), handler: 'NetworkFirst', options: {cacheName:'lvdc-public-navigation', networkTimeoutSeconds:4, expiration:{maxEntries:8,maxAgeSeconds:86400}} }],
      cleanupOutdatedCaches: true,
    },
  })] },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
