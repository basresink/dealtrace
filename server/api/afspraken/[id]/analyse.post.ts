// POST /api/afspraken/:id/analyse: de Notulist leest verslag en transcript en geeft samenvatting,
// actiepunten (concepttaken in Concepten), koopsignalen (inzichten), bezwaren en open vragen. De mens
// keurt de concepten goed. Zonder klant of met te weinig tekst: 422; de Bewaker kan tegenhouden.
import { analyseerVerslag } from '../../../utils/agents/notulist'
import { vereisAfspraak } from '../../../utils/afspraakToegang'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'agenda.basis')
  const id = getRouterParam(event, 'id')!
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const ap = await vereisAfspraak(tx, ctx, id)
    if (!ap.account_id) throw createError({ statusCode: 422, statusMessage: 'Analyse hoort bij een afspraak met een klant' })
    const r = await analyseerVerslag(tx, ctx.organisatie.id, id)
    if (!r) throw createError({ statusCode: 422, statusMessage: 'Schrijf eerst een verslag of voeg een transcript toe (minstens een paar zinnen)' })
    if (!r.ok) return { ok: false, reden: r.reden }
    const o: any = r.analyse
    return {
      ok: true, actiepunten: r.actiepunten, concurrenten: r.concurrenten,
      analyse: { samenvatting: o.samenvatting || null, perAgendapunt: o.perAgendapunt ?? [], actiepunten: o.actiepunten ?? [], koopsignalen: o.koopsignalen ?? [], bezwaren: o.bezwaren ?? [], openVragen: o.openVragen ?? [], concurrenten: o.concurrenten ?? [], voorgesteldeUitkomst: o.voorgesteldeUitkomst ?? null, op: new Date().toISOString() },
    }
  })
})
