import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',

      // importante para DEV (localhost) também registrar PWA
      devOptions: {
        enabled: true
      },

      // limpa caches antigos quando atualizar
      workbox: {
        cleanupOutdatedCaches: true
      },

      includeAssets: [
        'icons/apple-touch-icon.png',
        'icons/icon-32x32.png'
      ],

      manifest: {
        name: 'Frota - MS Silos e Secadores',
        short_name: 'Frota MS',

        // 👇 força “nova versão” do app para caches teimosos
        id: '/frota-ms-v2',
        start_url: '/?v=2',
        scope: '/',

        display: 'standalone',
        theme_color: '#ffffff',
        background_color: '#ffffff',

        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/icons/maskable-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: '/icons/maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
  ]
})
