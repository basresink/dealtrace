// PUT /api/contacten/:id: patch (null wist). Rol is één begrip (gat 28). "Bel me niet"
// zet het nummer op de bel-me-niet-lijst van de organisatie. Vertrokken in plaats van verwijderen.
import { eq } from 'drizzle-orm'
import { ROLLEN_CONTACT, geldigEmail, normaliseerTelefoon } from '../../../../shared/contactgegevens'
import { contactUit, effectiefNiveau, eigenVeldenVoor, herbereken } from '../../../utils/accounts'
import { metOrganisatie, schema } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'
import { pasDataToe, pasEigenVeldenToe } from '../../../utils/velden'
import { controleerExtraBronnen } from '../../../utils/extraBronnen'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'contacten.basis')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<Record<string, any>>(event)
  for (const k of ['telefoon', 'mobiel']) if (b[k]) { const t = normaliseerTelefoon(b[k]); if (!t.ok) throw createError({ statusCode: 400, statusMessage: t.fout }); b[k] = t.e164 }
  if (b.email && !geldigEmail(b.email)) throw createError({ statusCode: 400, statusMessage: 'Geen geldig e-mailadres' })
  if ('rol' in b && !(ROLLEN_CONTACT as readonly string[]).includes(b.rol)) throw createError({ statusCode: 400, statusMessage: 'Onbekende rol' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [c] = await tx.select().from(schema.contacts).where(eq(schema.contacts.id, id))
    if (!c) throw createError({ statusCode: 404, statusMessage: 'Contact onbekend' })
    const set: Partial<typeof schema.contacts.$inferInsert> = { updatedAt: new Date().toISOString() }
    if ('voornaam' in b) set.firstName = b.voornaam || null
    if ('achternaam' in b) { if (!b.achternaam?.trim()) throw createError({ statusCode: 400, statusMessage: 'Achternaam is verplicht' }); set.lastName = b.achternaam.trim() }
    if ('email' in b) set.email = b.email ? String(b.email).toLowerCase() : null
    if ('rol' in b) set.rol = b.rol
    const data = pasDataToe({ ...(c.data ?? {}) }, b, ['functie', 'telefoon', 'mobiel', 'linkedin', 'voorkeurskanaal', 'instagram', 'facebook'], ctx.gebruiker.id)
    if (b.consent) {
      const consent = { ...(data.consent ?? {}) }
      for (const k of ['email', 'whatsapp'] as const) if (b.consent[k]) consent[k] = { status: b.consent[k], op: new Date().toISOString(), bron: `door ${ctx.gebruiker.naam}` }
      data.consent = consent
    }
    if ('status' in b) {
      if (!['actief', 'vertrokken'].includes(b.status)) throw createError({ statusCode: 400, statusMessage: 'Status is actief of vertrokken' })
      set.status = b.status
      if (b.status === 'vertrokken') data.vertrokkenOp = b.vertrokkenOp ?? new Date().toISOString().slice(0, 10)
      else delete data.vertrokkenOp
    }
    if ('belMeNiet' in b) {
      data.belMeNiet = !!b.belMeNiet
      if (b.belMeNiet) {
        for (const n of [data.telefoon, data.mobiel].filter(Boolean)) {
          await tx.insert(schema.belMeNiet).values({ organisationId: ctx.organisatie.id, telefoonE164: n, door: ctx.gebruiker.id }).onConflictDoNothing()
        }
      }
    }
    if ('extraBronnen' in b) data.extraBronnen = controleerExtraBronnen(b.extraBronnen)
    if (b.customFields) {
      const velden = await eigenVeldenVoor(tx, 'contact', effectiefNiveau(ctx))
      data.customFields = pasEigenVeldenToe(c.data?.customFields, b.customFields, velden, { rol: ctx.gebruiker.rol, eigenaar: true }, data.herkomst, ctx.gebruiker.id)
    }
    set.data = data
    const [n] = await tx.update(schema.contacts).set(set).where(eq(schema.contacts.id, id)).returning()
    await herbereken(tx, c.accountId)
    return contactUit(n!, await eigenVeldenVoor(tx, 'contact', effectiefNiveau(ctx)))
  })
})
