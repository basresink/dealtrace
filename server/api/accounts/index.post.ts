// POST /api/accounts: nieuwe prospect met dubbelcheck (409 met de match bij een
// zeker duplicaat) en een berekende score (geen vaste 50, gat 25).
import { normaliseerTelefoon } from '../../../shared/contactgegevens'
import { normaliseerDomein, zoekDuplicaat } from '../../../shared/ontdubbelen'
import { schrijfAudit } from '../../utils/audit'
import { effectiefNiveau, eigenVeldenVoor, herbereken, kan } from '../../utils/accounts'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'
import { pasEigenVeldenToe } from '../../utils/velden'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'prospects.nieuw')
  const b = await readBody<{ naam?: string; plaats?: string; postcode?: string; adres?: string; telefoon?: string; website?: string; linkedin?: string; kvk?: string; klasse?: string; customFields?: Record<string, unknown>; negeerMogelijk?: boolean }>(event)
  const naam = b.naam?.trim()
  if (!naam) throw createError({ statusCode: 400, statusMessage: 'Bedrijfsnaam is verplicht' })
  let telefoon: string | undefined
  if (b.telefoon?.trim()) {
    const t = normaliseerTelefoon(b.telefoon)
    if (!t.ok) throw createError({ statusCode: 400, statusMessage: t.fout })
    telefoon = t.e164
  }
  if (b.postcode && !/^\d{4}\s?[A-Za-z]{2}$/.test(b.postcode.trim())) throw createError({ statusCode: 400, statusMessage: 'Postcode is vier cijfers en twee letters' })
  const domein = normaliseerDomein(b.website)
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const bestand = await tx.select({ id: schema.accounts.id, name: schema.accounts.name, kvk: schema.accounts.kvk, domein: schema.accounts.domein, city: schema.accounts.city }).from(schema.accounts)
    const d = zoekDuplicaat({ name: naam, kvk: b.kvk ?? null, domein }, bestand)
    if (d.soort === 'zeker') throw createError({ statusCode: 409, statusMessage: `Bedoel je ${d.match!.name}${d.match!.city ? ` in ${d.match!.city}` : ''}? Al in je bestand.`, data: d })
    const velden = await eigenVeldenVoor(tx, 'account', effectiefNiveau(ctx))
    const herkomst: Record<string, any> = {}
    const op = new Date().toISOString()
    for (const k of ['naam', 'plaats', 'telefoon', 'website']) if ((b as any)[k]) herkomst[k] = { bron: 'hand', op, door: ctx.gebruiker.id }
    const customFields = pasEigenVeldenToe({}, b.customFields, velden, { rol: ctx.gebruiker.rol, eigenaar: true }, herkomst, ctx.gebruiker.id)
    const id = crypto.randomUUID()
    await tx.insert(schema.accounts).values({
      id, organisationId: ctx.organisatie.id, name: naam, accountKind: 'prospect', nbStatus: 'nieuw', ownerId: ctx.gebruiker.id,
      klasse: kan(ctx, 'prospects.klasseZetten') ? b.klasse || null : null, city: b.plaats?.trim() || null, postcode: b.postcode?.trim().toUpperCase() || null,
      kvk: b.kvk?.replace(/\D/g, '') || null, domein, nbBron: 'hand',
      data: { telefoon, website: b.website?.trim() || undefined, linkedin: b.linkedin?.trim() || undefined, adres: b.adres?.trim() || undefined, customFields, herkomst },
    })
    const s = await herbereken(tx, id)
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'account.aanmaken', resourceType: 'accounts', resourceId: id, changes: { naam } })
    return { id, naam, score: s?.score ?? 0, mogelijkDuplicaat: d.soort === 'mogelijk' ? d.match : null }
  })
})
