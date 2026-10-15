// PUT /api/mij/route {thuisbasis?, kaartapp?}: thuisbasis voor routes (adres, postcode of plaats; het
// punt komt uit de terugval van de geocodering) en de kaartapp voor navigeren (8.6).
import { eq } from 'drizzle-orm'
import { geocodeerTerugval } from '../../../shared/route'
import { gebiedenInstelling } from '../../utils/bezoeken'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisOrganisatie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  const b = await readBody<{ thuisbasis?: string | null; kaartapp?: string }>(event)
  return metOrganisatie(ctx.organisatie!.id, async (tx) => {
    const [u] = await tx.select({ data: schema.users.data }).from(schema.users).where(eq(schema.users.id, ctx.gebruiker.id))
    const data: any = { ...(u?.data ?? {}) }
    if (b?.kaartapp !== undefined) {
      if (!['google', 'apple', 'waze'].includes(b.kaartapp)) throw createError({ statusCode: 422, statusMessage: 'Kies Google Maps, Apple Kaarten of Waze' })
      data.kaartapp = b.kaartapp
    }
    if (b?.thuisbasis !== undefined) {
      const t = String(b.thuisbasis ?? '').trim()
      if (!t) data.thuisbasis = null
      else {
        const pc = /\b([1-9]\d{3})\s?[a-z]{2}\b/i.exec(t)?.[1]
        const plaats = t.split(',').map((x) => x.replace(/\b[1-9]\d{3}\s?[a-z]{2}\b/i, '').trim()).filter(Boolean).pop() ?? t
        const p = geocodeerTerugval({ postcode: pc ?? null, plaats }, (await gebiedenInstelling(tx)).synoniemen)
        if (!p) throw createError({ statusCode: 422, statusMessage: 'Deze plaats kennen we niet. Geef een postcode of een grotere plaats in de buurt.' })
        data.thuisbasis = { adres: t, lat: p.lat, lng: p.lng, plaats, bron: p.bron }
      }
    }
    await tx.update(schema.users).set({ data }).where(eq(schema.users.id, ctx.gebruiker.id))
    return { thuisbasis: data.thuisbasis ?? null, kaartapp: data.kaartapp ?? 'google' }
  })
})
