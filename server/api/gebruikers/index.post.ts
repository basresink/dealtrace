// POST /api/gebruikers: gebruiker toevoegen (beheerder). Het niveau is het
// standaardniveau van de organisatie, tenzij de beheerder een ander kiest.
// De stand "toevoegen binnen de seats" of "aanvragen" zet de founder in P02.
import { eq } from 'drizzle-orm'
import { NIVEAUS, WERKPLEKKEN } from '../../../shared/types'
import { schrijfAudit } from '../../utils/audit'
import { metOrganisatie, schema } from '../../utils/db'
import { gebruikerRij } from '../../utils/gebruikers'
import { vereisOrganisatie } from '../../utils/sessie'

const ROLLEN = ['accountmanager', 'salesmanager', 'beheerder']

export default defineEventHandler(async (event) => {
  const { gebruiker, organisatie } = await vereisOrganisatie(event)
  if (gebruiker.rol !== 'beheerder') throw createError({ statusCode: 403, statusMessage: 'Alleen de beheerder voegt gebruikers toe' })
  const b = await readBody<{ naam?: string; email?: string; rol?: string; teamId?: string | null; werkplek?: string; niveau?: string }>(event)
  const naam = b.naam?.trim()
  const email = b.email?.trim().toLowerCase()
  if (!naam || !email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw createError({ statusCode: 400, statusMessage: 'Naam en een geldig e-mailadres zijn verplicht' })
  const rol = b.rol ?? 'accountmanager'
  if (!ROLLEN.includes(rol)) throw createError({ statusCode: 400, statusMessage: 'Onbekende rol' })
  const werkplek = b.werkplek ?? 'binnendienst'
  if (!(WERKPLEKKEN as readonly string[]).includes(werkplek)) throw createError({ statusCode: 400, statusMessage: 'Onbekend werkplekprofiel' })

  return metOrganisatie(organisatie.id, async (tx) => {
    // Seats en stand van de leverancier (F23, open vraag 3): zelf toevoegen kan
    // alleen in de stand "zelf" en binnen de seats; anders een aanvraag.
    const [org] = await tx.select().from(schema.organisations).where(eq(schema.organisations.id, organisatie.id))
    const stand = org?.data?.gebruikersStand ?? 'aanvragen'
    const seats = org?.contract?.seats ?? 0
    const actief = (await tx.select({ id: schema.users.id, status: schema.users.status }).from(schema.users)).filter((u) => u.status !== 'gearchiveerd').length
    if (stand !== 'zelf') throw createError({ statusCode: 409, statusMessage: 'Gebruikers vraag je aan bij Dealtrace', data: { aanvragen: true } })
    if (actief >= seats) throw createError({ statusCode: 409, statusMessage: `Alle ${seats} seats zijn in gebruik. Vraag een extra gebruiker aan.`, data: { aanvragen: true } })
    const [instelling] = await tx.select().from(schema.orgSettings).where(eq(schema.orgSettings.key, 'niveaus'))
    const standaard = ((instelling?.value as any)?.standaardNiveauNieuweGebruiker as string) ?? 'beginner'
    let niveau = b.niveau && (NIVEAUS as readonly string[]).includes(b.niveau) ? b.niveau : standaard
    if (rol === 'salesmanager' && niveau === 'beginner') niveau = 'expert'
    if (rol === 'beheerder' && !b.niveau) niveau = 'expert'
    const nu = new Date().toISOString()
    try {
      const [nieuw] = await tx.insert(schema.users).values({
        id: crypto.randomUUID(), organisationId: organisatie.id, email, name: naam, role: rol, niveau,
        teamId: b.teamId ?? null, werkplek, status: 'uitgenodigd', data: {}, createdAt: nu, updatedAt: nu,
      }).returning()
      await schrijfAudit(tx, { organisationId: organisatie.id, actorId: gebruiker.id, action: 'gebruiker.toevoegen', resourceType: 'users', resourceId: nieuw!.id, changes: { naam, email, rol, niveau, werkplek } })
      return gebruikerRij(nieuw!)
    } catch (e: any) {
      if (e?.cause?.code === '23505' || e?.code === '23505') throw createError({ statusCode: 409, statusMessage: 'Dit e-mailadres bestaat al' })
      throw e
    }
  })
})
