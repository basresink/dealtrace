// POST /api/platform/klanten/:id/avg/verzoeken {soort, kenmerk, ontvangenOp}: een AVG-verzoek vastleggen,
// zonder persoonsgegevens (alleen een kenmerk). Termijn 30 dagen na ontvangst. De beheerders van de klant
// krijgen een melding; zij handelen een verzoek van een betrokkene af in hun eigen organisatie. Platformaudit.
import { eq } from 'drizzle-orm'
import { AVG_TERMIJN_DAGEN, AVG_VERZOEK_LABEL, plusDagen, valideerVerzoek, type AvgVerzoek, type AvgVerzoekSoort } from '../../../../../../shared/platformAvg'
import { schema } from '../../../../../utils/db'
import { alsPlatform, meldBeheerders, platformAudit, requireFounder } from '../../../../../utils/platform'
import { leesAvgData, vandaagNL } from '../../../../../utils/platformAvg'

const datumNL = (d: string) => new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${d}T00:00:00Z`))

export default defineEventHandler(async (event) => {
  const ctx = await requireFounder(event)
  const id = getRouterParam(event, 'id')!
  const b = await readBody<{ soort?: string; kenmerk?: string; ontvangenOp?: string }>(event)
  const vandaag = vandaagNL()
  const fouten = valideerVerzoek(b ?? {}, vandaag)
  if (fouten.length) throw createError({ statusCode: 422, statusMessage: fouten[0], data: { fouten } })
  return alsPlatform(async (tx) => {
    const [o] = await tx.select().from(schema.organisations).where(eq(schema.organisations.id, id))
    if (!o || o.status === 'systeem') throw createError({ statusCode: 404, statusMessage: 'Klant onbekend' })
    const avg = leesAvgData(o.data)
    const soort = b.soort as AvgVerzoekSoort
    const verzoek: AvgVerzoek = {
      id: crypto.randomUUID(), soort, kenmerk: b.kenmerk!.trim(), ontvangenOp: b.ontvangenOp!, termijnOp: plusDagen(b.ontvangenOp!, AVG_TERMIJN_DAGEN),
      status: 'open', afgehandeldOp: null, door: ctx.gebruiker.naam, op: new Date().toISOString(),
    }
    await tx.update(schema.organisations).set({ data: { ...o.data, avg: { ...avg, verzoeken: [verzoek, ...avg.verzoeken] } }, updatedAt: new Date().toISOString() }).where(eq(schema.organisations.id, id))
    await platformAudit(tx, event, ctx, { organisatieId: id, handeling: 'avg.verzoek', object: verzoek.id, na: { soort, kenmerk: verzoek.kenmerk, termijnOp: verzoek.termijnOp } })
    const tekst = soort === 'organisatie-verwijderen'
      ? `Dealtrace heeft je verzoek ${verzoek.kenmerk} ontvangen om alle gegevens van je organisatie te verwijderen. Maak eerst een export via Instellingen, Privacy; we handelen het af vóór ${datumNL(verzoek.termijnOp)}.`
      : `${AVG_VERZOEK_LABEL[soort]} (kenmerk ${verzoek.kenmerk}). Handel het af via de contactpersoon en Instellingen, Privacy, vóór ${datumNL(verzoek.termijnOp)}.`
    await meldBeheerders(tx, id, 'AVG-verzoek ontvangen', tekst, '/instellingen/privacy')
    return { verzoek }
  })
})
