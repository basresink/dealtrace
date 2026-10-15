// POST /api/platform/werk-in {organisatieId, reden, modus}: werken in een organisatie
// (13.3 flow 4). Bij "Alleen na toestemming" eerst een verzoek; "Ook wijzigen"
// vraagt herbevestiging. Audit bij platform en klant, melding aan de beheerders.
import { and, eq, gt } from 'drizzle-orm'
import { geldigeReden, type WerkModus } from '../../../../shared/werkIn'
import { schema } from '../../../utils/db'
import { alsPlatform, meldBeheerders, platformAudit, requireFounder, vereisHerbevestiging } from '../../../utils/platform'
import { zetWerkIn } from '../../../utils/werkIn'

export default defineEventHandler(async (event) => {
  const ctx = await requireFounder(event)
  const b = await readBody<{ organisatieId?: string; reden?: string; modus?: string }>(event)
  if (!geldigeReden(b.reden)) throw createError({ statusCode: 400, statusMessage: 'Geef een reden van minstens 5 tekens, bijvoorbeeld een ticketnummer' })
  const modus: WerkModus = b.modus === 'wijzigen' ? 'wijzigen' : 'meekijken'
  if (modus === 'wijzigen') vereisHerbevestiging(ctx)
  const reden = b.reden.trim()

  const uitkomst = await alsPlatform(async (tx) => {
    const [o] = await tx.select().from(schema.organisations).where(eq(schema.organisations.id, b.organisatieId ?? ''))
    if (!o || o.status === 'systeem') throw createError({ statusCode: 404, statusMessage: 'Klant onbekend' })
    if ((o.data?.toegangLeverancier ?? 'altijd') === 'na_toestemming') {
      const [ok] = await tx.select().from(schema.toegangsverzoeken).where(and(
        eq(schema.toegangsverzoeken.organisationId, o.id), eq(schema.toegangsverzoeken.founderId, ctx.gebruiker.id),
        eq(schema.toegangsverzoeken.status, 'goedgekeurd'), eq(schema.toegangsverzoeken.modus, modus),
        gt(schema.toegangsverzoeken.geldigTot, new Date().toISOString())))
      if (!ok) {
        const [open] = await tx.select().from(schema.toegangsverzoeken).where(and(
          eq(schema.toegangsverzoeken.organisationId, o.id), eq(schema.toegangsverzoeken.founderId, ctx.gebruiker.id),
          eq(schema.toegangsverzoeken.status, 'open'), gt(schema.toegangsverzoeken.geldigTot, new Date().toISOString())))
        if (open) return { verzoekId: open.id, naam: o.name, nieuw: false }
        const verzoekId = crypto.randomUUID()
        await tx.insert(schema.toegangsverzoeken).values({
          id: verzoekId, organisationId: o.id, founderId: ctx.gebruiker.id, founderNaam: ctx.gebruiker.naam, reden, modus,
          geldigTot: new Date(Date.now() + 24 * 3600_000).toISOString(),
        })
        await platformAudit(tx, event, ctx, { organisatieId: o.id, handeling: 'werkin.verzoek', object: verzoekId, na: { modus }, reden })
        await meldBeheerders(tx, o.id, `${ctx.gebruiker.naam} vraagt toegang`,
          `Reden: ${reden}. Modus: ${modus === 'meekijken' ? 'alleen meekijken' : 'ook wijzigen'}. Keur goed of af bij Audit en toegang leverancier.`,
          '/instellingen/audit')
        return { verzoekId, naam: o.name, nieuw: true }
      }
      await tx.update(schema.toegangsverzoeken).set({ status: 'gebruikt' }).where(eq(schema.toegangsverzoeken.id, ok.id))
    }
    await platformAudit(tx, event, ctx, { organisatieId: o.id, handeling: 'werkin.start', object: o.id, na: { modus }, reden })
    await meldBeheerders(tx, o.id, `${ctx.gebruiker.naam} van Dealtrace werkt in je organisatie`,
      `Reden: ${reden}. Modus: ${modus === 'meekijken' ? 'alleen meekijken' : 'ook wijzigen'}.`, '/instellingen/audit')
    return { naam: o.name }
  })

  if ('verzoekId' in uitkomst) {
    setResponseStatus(event, 202)
    return { verzoekId: uitkomst.verzoekId, status: 'wacht op toestemming', organisatie: uitkomst.naam }
  }
  const inhoud = await zetWerkIn(event, { founderId: ctx.gebruiker.id, organisatieId: b.organisatieId!, modus, reden })
  return { organisatie: uitkomst.naam, modus, tot: inhoud.tot }
})
