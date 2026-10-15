// POST /api/platform/klanten: nieuwe klant met startset en eerste beheerder (founder, aal2).
import { sql } from 'drizzle-orm'
import { PAKKETTEN, type Pakket } from '../../../../shared/types'
import { schema } from '../../../utils/db'
import { pasStartsetToe } from '../../../utils/orgStarter'
import { alsPlatform, platformAudit, requireFounder } from '../../../utils/platform'

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export default defineEventHandler(async (event) => {
  const ctx = await requireFounder(event)
  const b = await readBody<{
    naam?: string; pakket?: string; proefTot?: string | null; seats?: number
    contact?: { naam?: string; email?: string; telefoon?: string; adres?: string }
    beheerder?: { naam?: string; email?: string }
  }>(event)
  const naam = b.naam?.trim()
  const beheerderNaam = b.beheerder?.naam?.trim()
  const beheerderEmail = b.beheerder?.email?.trim().toLowerCase()
  if (!naam) throw createError({ statusCode: 400, statusMessage: 'Organisatienaam is verplicht' })
  if (!beheerderNaam || !beheerderEmail || !EMAIL.test(beheerderEmail)) throw createError({ statusCode: 400, statusMessage: 'Naam en een geldig e-mailadres van de eerste beheerder zijn verplicht' })
  const pakket = (b.pakket ?? 'starter') as Pakket
  if (!PAKKETTEN.includes(pakket)) throw createError({ statusCode: 400, statusMessage: 'Onbekend pakket' })
  if (b.proefTot && Number.isNaN(Date.parse(b.proefTot))) throw createError({ statusCode: 400, statusMessage: 'Ongeldige einddatum van de proef' })

  return alsPlatform(async (tx) => {
    const bestaand = await tx.execute(sql`select 1 from users where lower(email) = ${beheerderEmail}`)
    if (bestaand.rows.length) throw createError({ statusCode: 409, statusMessage: 'Dit e-mailadres bestaat al' })
    const id = crypto.randomUUID()
    const nu = new Date().toISOString()
    const contract = {
      status: b.proefTot ? 'proef' as const : 'actief' as const, seats: b.seats && b.seats > 0 ? Math.floor(b.seats) : 5,
      start: nu.slice(0, 10), looptijdMaanden: 12, opzegtermijnMaanden: 1, ...(b.proefTot ? { proefTot: b.proefTot } : {}),
    }
    await tx.insert(schema.organisations).values({
      id, name: naam, pakket, features: {}, contract, status: 'actief',
      data: { contact: b.contact ?? {}, gebruikersStand: 'aanvragen', toegangLeverancier: 'altijd' }, createdAt: nu, updatedAt: nu,
    })
    const startset = await pasStartsetToe(tx, id, naam)
    const beheerderId = crypto.randomUUID()
    await tx.insert(schema.users).values({
      id: beheerderId, organisationId: id, email: beheerderEmail, name: beheerderNaam, role: 'beheerder', niveau: 'expert',
      teamId: null, werkplek: 'binnendienst', status: 'uitgenodigd', data: {}, createdAt: nu, updatedAt: nu,
    })
    await platformAudit(tx, event, ctx, { organisatieId: id, handeling: 'klant.aanmaken', object: id, na: { naam, pakket, contract, beheerder: beheerderEmail, startset } })
    return { id, naam, pakket, startset }
  })
})
