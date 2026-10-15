// POST /api/kvk/:nummer/toevoegen: een bedrijf uit KvK als prospect, ontdubbeld tegen de eigen
// accounts (409 met het account als het er al is). Met de eerste taak volgens het werkplekprofiel.
// Extra velden uit de flyout (telefoon, website) gaan mee met bron "hand".
import { eq } from 'drizzle-orm'
import { KVK_NIET_GEKOPPELD } from '../../../../shared/leadGenerator'
import { normaliseerDomein } from '../../../../shared/ontdubbelen'
import { metOrganisatie, schema } from '../../../utils/db'
import { kvkContext, kvkProfiel, KvkFout } from '../../../utils/bronnen/kvk'
import { eersteTaak, maakProspect } from '../../../utils/leads'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'prospects.nieuw')
  const nummer = getRouterParam(event, 'nummer')!.replace(/\D/g, '')
  const b = await readBody<{ website?: string; naam?: string }>(event).catch(() => ({} as any))
  return metOrganisatie(ctx.organisatie!.id, async (tx) => {
    const k = await kvkContext(tx, ctx.organisatie!.pakket)
    if (!k) throw createError({ statusCode: 400, statusMessage: KVK_NIET_GEKOPPELD })
    let p
    try { p = await kvkProfiel(tx, ctx.organisatie!.id, k, nummer) } catch (e) { if (e instanceof KvkFout) throw createError({ statusCode: e.statusCode, statusMessage: e.message }); throw e }
    if (!p) throw createError({ statusCode: 404, statusMessage: 'Dit KvK-nummer staat niet in het register' })
    const op = new Date().toISOString()
    const website = b?.website?.trim() || p.website
    const r = await maakProspect(tx, ctx.organisatie!.id, ctx.gebruiker.id, ctx.gebruiker.id, {
      naam: b?.naam?.trim() || p.naam, kvk: p.kvk, plaats: p.plaats, postcode: p.postcode, adres: p.adres, lat: p.lat, lng: p.lng, medewerkers: p.medewerkers, sbi: p.sbi.map((s) => s.code),
      website, domein: normaliseerDomein(website),
      herkomst: { ...Object.fromEntries(['kvk', 'adres', 'medewerkers', 'sbi', 'plaats', 'postcode'].map((v) => [v, { bron: 'kvk', op }])), naam: { bron: b?.naam?.trim() ? 'hand' : 'kvk', op }, ...(b?.website?.trim() ? { website: { bron: 'hand', op } } : {}) },
    }, { nbBron: 'kvk' })
    const [u] = await tx.select({ id: schema.users.id, werkplek: schema.users.werkplek, data: schema.users.data }).from(schema.users).where(eq(schema.users.id, ctx.gebruiker.id))
    const t = await eersteTaak(tx, ctx.organisatie!.id, u!, { id: r.id, naam: r.naam }, u!.werkplek === 'buitendienst' ? 'bezoek' : 'belblok')
    return { ...r, eersteTaak: t, tekst: `${r.naam} staat erbij.` }
  })
})
