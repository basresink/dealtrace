// POST /api/contacten: "+ Snel contactpersoon" (F04). Altijd bij een account;
// dubbelcheck op e-mail en op naam binnen het bedrijf.
import { eq } from 'drizzle-orm'
import { ROLLEN_CONTACT, geldigEmail, normaliseerTelefoon } from '../../../shared/contactgegevens'
import { contactDuplicaat, normaliseerDomein } from '../../../shared/ontdubbelen'
import { websiteUitEmail } from '../../../shared/logo'
import { contactUit, effectiefNiveau, eigenVeldenVoor, herbereken } from '../../utils/accounts'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'
import { pasEigenVeldenToe } from '../../utils/velden'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'contacten.basis')
  const b = await readBody<{ accountId?: string; voornaam?: string; achternaam?: string; functie?: string; email?: string; telefoon?: string; mobiel?: string; rol?: string; linkedin?: string; customFields?: Record<string, unknown> }>(event)
  if (!b.accountId) throw createError({ statusCode: 400, statusMessage: 'Een contact hoort altijd bij een bedrijf (accountId)' })
  if (!b.achternaam?.trim()) throw createError({ statusCode: 400, statusMessage: 'Achternaam is verplicht' })
  const rol = (ROLLEN_CONTACT as readonly string[]).includes(b.rol ?? '') ? b.rol! : 'onbekend'
  if (b.email && !geldigEmail(b.email)) throw createError({ statusCode: 400, statusMessage: 'Geen geldig e-mailadres' })
  const tel = (n?: string) => { if (!n?.trim()) return undefined; const t = normaliseerTelefoon(n); if (!t.ok) throw createError({ statusCode: 400, statusMessage: t.fout }); return t.e164 }
  const telefoon = tel(b.telefoon)
  const mobiel = tel(b.mobiel)
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [a] = await tx.select({ id: schema.accounts.id, domein: schema.accounts.domein, data: schema.accounts.data }).from(schema.accounts).where(eq(schema.accounts.id, b.accountId!))
    if (!a) throw createError({ statusCode: 404, statusMessage: 'Account onbekend' })
    const bestaand = (await tx.select({ id: schema.contacts.id, accountId: schema.contacts.accountId, firstName: schema.contacts.firstName, lastName: schema.contacts.lastName, email: schema.contacts.email }).from(schema.contacts))
    const dubbel = contactDuplicaat({ accountId: a.id, firstName: b.voornaam, lastName: b.achternaam!, email: b.email }, bestaand)
    if (dubbel) throw createError({ statusCode: 409, statusMessage: `${dubbel.firstName ?? ''} ${dubbel.lastName}`.trim() + ' staat al in je bestand', data: { match: dubbel } })
    const velden = await eigenVeldenVoor(tx, 'contact', effectiefNiveau(ctx))
    const herkomst: Record<string, any> = {}
    const customFields = pasEigenVeldenToe({}, b.customFields, velden, { rol: ctx.gebruiker.rol, eigenaar: true }, herkomst, ctx.gebruiker.id)
    const [c] = await tx.insert(schema.contacts).values({
      organisationId: ctx.organisatie.id, accountId: a.id, firstName: b.voornaam?.trim() || null, lastName: b.achternaam!.trim(), email: b.email?.trim().toLowerCase() || null, rol,
      data: { functie: b.functie?.trim() || undefined, telefoon, mobiel, linkedin: b.linkedin || undefined, bron: `ingevoerd door ${ctx.gebruiker.naam}`, consent: { email: { status: 'onbekend' }, whatsapp: { status: 'onbekend' } }, customFields, herkomst },
    }).returning()
    // Logo en website (opzet uit DealDrive): heeft het account nog geen website, dan komt die uit het
    // e-maildomein van het contact (niet bij gmail, hotmail en dergelijke). Het logo volgt uit het domein.
    const web = !a.data?.website && !a.domein ? websiteUitEmail(c!.email) : null
    if (web) await tx.update(schema.accounts).set({ domein: normaliseerDomein(web), data: { ...a.data, website: web, herkomst: { ...(a.data?.herkomst ?? {}), website: { bron: 'web', op: new Date().toISOString(), door: ctx.gebruiker.id } } } }).where(eq(schema.accounts.id, a.id))
    await herbereken(tx, a.id)
    return contactUit(c!, velden)
  })
})
