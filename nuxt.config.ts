// Dealtrace: één app voor telefoon en laptop (ADR-020). Zie Bouwplan-Dealtrace.md, hoofdstuk 13.
export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  devtools: { enabled: false },
  ssr: true,
  components: [{ path: '~/components', pathPrefix: false }],
  css: ['~/assets/css/dealtrace.css', '~/assets/css/aanvulling.css'],
  app: {
    head: {
      htmlAttrs: { lang: 'nl' },
      title: 'Dealtrace',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#0a0a0a' },
        // PWA (P27, 8.14): één manifest, staand, iOS-meta's.
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black' },
        { name: 'apple-mobile-web-app-title', content: 'Dealtrace' },
      ],
      link: [
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'apple-touch-icon', href: '/iconen/dealtrace-180.png' },
      ],
    },
  },
  runtimeConfig: {
    // Verbinding van de app: de beperkte rol dealtrace_app (valt onder RLS).
    databaseUrl: process.env.DATABASE_URL || 'postgresql://dealtrace_app:dealtrace_app@127.0.0.1:5432/dealtrace',
    sessieGeheim: process.env.SESSIE_GEHEIM || 'lokaal-ontwikkelgeheim-niet-voor-productie-gebruiken',
    // Eigen geheim voor het werk-in-cookie van de founder (P02); halfjaarlijks roteren.
    orgWisselGeheim: process.env.ORG_WISSEL_SECRET || 'lokaal-orgwissel-niet-voor-productie-gebruiken',
    authModus: process.env.AUTH_MODUS || 'ontwikkel', // 'ontwikkel' tot P27 inloggen met code bouwt
    aiProvider: process.env.AI_PROVIDER || 'mock',
    anthropicSleutel: process.env.ANTHROPIC_API_KEY || '',
    // Online (Netlify) staat de hele site achter één toegangswachtwoord, tot P27
    // inloggen met een code per mail bouwt. Lokaal is het leeg en dus uit.
    toegangswachtwoord: process.env.TOEGANGSWACHTWOORD || '',
    online: process.env.NETLIFY === 'true' || process.env.DEALTRACE_ONLINE === 'true',
    public: {
      authModus: process.env.AUTH_MODUS || 'ontwikkel',
    },
  },
  typescript: { strict: true },
})
