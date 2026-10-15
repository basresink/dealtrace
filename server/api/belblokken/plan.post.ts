// POST /api/belblokken/plan: een blok in de eigen agenda met de gekozen gesprekken; wat niet
// past schuift naar het volgende vaste blok. Zet desgewenst de agenda op bezet en houdt
// meldingen vast tijdens het blok.
import { eq } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../utils/db'
import { agenda } from '../../utils/agenda'
import { planBlok } from '../../utils/bellen'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'belblok.uitvoeren')
  const b = await readBody<any>(event)
  if (!b?.start || Number.isNaN(Date.parse(b.start))) throw createError({ statusCode: 422, statusMessage: 'Kies een datum en tijd' })
  if (!Number.isInteger(b.minuten) || b.minuten < 30 || b.minuten > 240) throw createError({ statusCode: 422, statusMessage: 'Een blok duurt 30 tot 240 minuten' })
  if (!Array.isArray(b.accountIds) || !b.accountIds.length) throw createError({ statusCode: 422, statusMessage: 'Kies wie je wilt bellen' })
  if (Date.parse(b.start) < Date.now() - 15 * 60_000) throw createError({ statusCode: 422, statusMessage: 'Dat moment is al voorbij' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [u] = await tx.select({ id: schema.users.id, werkplek: schema.users.werkplek, data: schema.users.data }).from(schema.users).where(eq(schema.users.id, ctx.gebruiker.id))
    const r = await planBlok(tx, ctx.organisatie.id, u!, { start: b.start, minuten: b.minuten, plek: b.plek, soort: b.soort, verhouding: b.verhouding, scriptId: b.scriptId ?? null, accountIds: b.accountIds.map(String).slice(0, 15), bezet: !!b.bezet, stil: !!b.stil })
    const eind = new Date(Date.parse(b.start) + b.minuten * 60_000).toISOString()
    const bezet = b.bezet ? await agenda().zetBezet(ctx.gebruiker.id, { start: b.start, eind, titel: 'Belblok' }) : null
    const wanneer = new Intl.DateTimeFormat('nl-NL', { weekday: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }).format(new Date(b.start))
    const toast = `Belblok gepland voor ${wanneer}. ${r.inBlok} ${r.inBlok === 1 ? 'gesprek' : 'gesprekken'}${r.geschoven ? `, ${r.geschoven} naar ${r.naar}` : r.inLijst ? `, ${r.inLijst} blijven in je bellijst` : ''}.`
    return { ...r, toast, agenda: bezet }
  })
})
