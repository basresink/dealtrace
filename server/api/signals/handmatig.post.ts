// POST /api/signals/handmatig {accountId, contactId?, titel, bron, url?, citaat}: "+ Inzicht" (P19, Gevorderd).
// 422 zonder titel, bron of citaat, of met een contact dat niet bij het account hoort. Het contact komt in
// signals.contact_id, zodat het inzicht ook op de contactkaart staat. De bron van het inzicht is "Handmatig door de gebruiker".
import { sql } from 'drizzle-orm'
import { metOrganisatie } from '../../utils/db'
import { bewaarInzicht } from '../../utils/inzichtOpslag'
import { magAccount } from '../../utils/overdracht'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'inzichten.handmatig')
  const b = await readBody<{ accountId?: string; contactId?: string | null; titel?: string; bron?: string; url?: string; citaat?: string }>(event)
  const titel = b?.titel?.trim(); const bron = b?.bron?.trim(); const citaat = b?.citaat?.trim(); const url = b?.url?.trim() || null
  if (!b?.accountId) throw createError({ statusCode: 422, statusMessage: 'Kies een account' })
  if (!titel || !bron || !citaat) throw createError({ statusCode: 422, statusMessage: 'Titel, bron en citaat zijn verplicht' })
  if (titel.length > 140 || bron.length > 140 || citaat.length > 600) throw createError({ statusCode: 422, statusMessage: 'De tekst is te lang' })
  if (url && !/^https?:\/\//i.test(url)) throw createError({ statusCode: 422, statusMessage: 'Een URL begint met http:// of https://' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    if (!(await magAccount(tx, ctx.gebruiker, b.accountId!))) throw createError({ statusCode: 403, statusMessage: 'Dit account is niet van jou' })
    const [a] = (await tx.execute(sql`select owner_id from accounts where id = ${b.accountId}`)).rows as any[]
    const contactId = b.contactId || null
    if (contactId) {
      const [c] = (await tx.execute(sql`select account_id from contacts where id = ${contactId}`)).rows as any[]
      if (!c || c.account_id !== b.accountId) throw createError({ statusCode: 422, statusMessage: 'Dit contact hoort niet bij het gekozen account' })
    }
    const datum = new Date().toISOString().slice(0, 10)
    const r = await bewaarInzicht(tx, ctx.organisatie.id, {
      accountId: b.accountId!, contactId, ownerId: a?.owner_id ?? ctx.gebruiker.id, agent: 'handmatig', type: 'handmatig', onderwerp: `handmatig:${crypto.randomUUID()}`,
      title: titel, beschrijving: `Toegevoegd door ${ctx.gebruiker.naam ?? 'een gebruiker'}.`, relevantie: 70, zekerheid: 100,
      bron: { soort: url ? 'handmatig' : 'intern', naam: 'Handmatig', url, datum }, evidence: [{ citaat, bron, datum, url }],
    })
    return { id: r.id }
  })
})
