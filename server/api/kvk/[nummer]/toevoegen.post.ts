// POST /api/kvk/:nummer/toevoegen: een bedrijf uit KvK als prospect, ontdubbeld tegen de eigen
// accounts (409 met het account als het er al is). Met de eerste taak volgens het werkplekprofiel.
// Extra velden uit de flyout (telefoon, website, e-mail en eigen velden) gaan mee met bron "hand"; de matrixvelden (branche,
// medewerkers, klasse, huidige leverancier) uit de flyout gaan voor wat KvK afleidt, en de regio volgt
// uit postcode of plaats.
import { eq } from 'drizzle-orm'
import { KVK_NIET_GEKOPPELD } from '../../../../shared/leadGenerator'
import { normaliseerDomein } from '../../../../shared/ontdubbelen'
import { metOrganisatie, schema } from '../../../utils/db'
import { kvkContext, kvkProfiel, KvkFout } from '../../../utils/bronnen/kvk'
import { eersteTaak, maakProspect } from '../../../utils/leads'
import { vereisFunctie } from '../../../utils/sessie'
import { effectiefNiveau, eigenVeldenVoor, herbereken } from '../../../utils/accounts'
import { controleerVerplichteVelden, leesBasisVelden, leesMatrixVelden, regioEnPunt } from '../../../utils/nieuweProspect'
import { pasEigenVeldenToe } from '../../../utils/velden'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'prospects.nieuw')
  const nummer = getRouterParam(event, 'nummer')!.replace(/\D/g, '')
  const b = await readBody<{ website?: string; naam?: string; medewerkers?: number | string | null; vvBrancheId?: string | null; huidigeLeverancierId?: string | null; klasse?: string | null; telefoon?: string; email?: string; customFields?: Record<string, unknown> }>(event).catch(() => ({} as any))
  const basis = leesBasisVelden({ telefoon: b?.telefoon, email: b?.email })
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
    const velden = await eigenVeldenVoor(tx, 'account', effectiefNiveau(ctx))
    controleerVerplichteVelden(velden, b?.customFields)
    await pasMatrixToe(tx, ctx, r.id, { ...(b ?? {}), basis, velden }, op)
    const [u] = await tx.select({ id: schema.users.id, werkplek: schema.users.werkplek, data: schema.users.data }).from(schema.users).where(eq(schema.users.id, ctx.gebruiker.id))
    const t = await eersteTaak(tx, ctx.organisatie!.id, u!, { id: r.id, naam: r.naam }, u!.werkplek === 'buitendienst' ? 'bezoek' : 'belblok')
    return { ...r, eersteTaak: t, tekst: `${r.naam} staat erbij.` }
  })
})

/** De matrixvelden uit de flyout op de net gemaakte prospect, plus de regio. */
async function pasMatrixToe(tx: any, ctx: any, id: string, b: Record<string, any>, op: string) {
  const m = await leesMatrixVelden(tx, ctx, { ...b, medewerkers: b.medewerkers ?? undefined })
  const [a] = await tx.select().from(schema.accounts).where(eq(schema.accounts.id, id))
  if (!a) return
  const door = ctx.gebruiker.id
  const herkomst = { ...(a.data?.herkomst ?? {}) }
  const set: Record<string, unknown> = {}
  const data: Record<string, any> = { ...(a.data ?? {}) }
  if (m.medewerkers !== null) { data.medewerkers = m.medewerkers; herkomst.medewerkers = { bron: 'hand', op, door } }
  if (b.basis?.telefoon) { data.telefoon = b.basis.telefoon; herkomst.telefoon = { bron: 'hand', op, door } }
  if (b.basis?.email) { data.email = b.basis.email; herkomst.email = { bron: 'hand', op, door } }
  if (b.customFields && Object.keys(b.customFields).length) data.customFields = pasEigenVeldenToe(data.customFields ?? {}, b.customFields, b.velden ?? [], { rol: ctx.gebruiker.rol, eigenaar: true }, herkomst, door)
  if (m.vvBrancheId) { set.vvBrancheId = m.vvBrancheId; herkomst.branche = { bron: 'hand', op, door } }
  if (m.huidigeLeverancierId) { set.huidigeLeverancierId = m.huidigeLeverancierId; herkomst.huidigeLeverancier = { bron: 'hand', op, door } }
  if (m.klasseBron) { set.klasse = m.klasse; herkomst.klasse = m.klasseBron === 'hand' ? { bron: 'hand', op, door } : { bron: 'voorstel uit medewerkers', op } }
  const { gebiedId } = await regioEnPunt(tx, { postcode: a.postcode, plaats: a.city, lat: a.lat, lng: a.lng })
  if (gebiedId && !a.gebiedId) set.gebiedId = gebiedId
  await tx.update(schema.accounts).set({ ...set, data: { ...data, herkomst }, updatedAt: op }).where(eq(schema.accounts.id, id))
  await herbereken(tx, id)
}
