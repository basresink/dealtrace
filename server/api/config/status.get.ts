// GET /api/config/status: laat zien in welke modus de app draait en of sleutels bestaan,
// zonder de sleutels zelf (bouwplan 12, 13.5).
export default defineEventHandler(() => {
  const c = useRuntimeConfig()
  return {
    authModus: c.authModus,
    aiProvider: c.aiProvider,
    sleutels: { anthropic: Boolean(c.anthropicSleutel), hubspot: Boolean(process.env.HUBSPOT_CLIENT_ID && process.env.HUBSPOT_CLIENT_SECRET) },
    crmModus: process.env.CRM_MODUS === 'http' ? 'http' : 'mock',
  }
})
