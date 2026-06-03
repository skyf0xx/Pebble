import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from "@tailwindcss/vite"
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    allowedHosts: true,
    // Bind IPv4 + IPv6 (not just ::1) so Tailscale's proxy to 127.0.0.1 connects;
    // an IPv6-only bind makes `tailscale serve` 502 with "connection refused".
    host: true,
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // The OpenUI generative-UI renderer pulls in charts/markdown/syntax
        // libs, pushing a chunk past workbox's 2 MiB default precache ceiling.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      manifest: {
        name: 'Pebble',
        short_name: 'Pebble',
        theme_color: '#C1654A',
        background_color: '#fef8f3',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
          { src: '/favicon.png', sizes: '192x192', type: 'image/png' },
          { src: '/favicon.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
