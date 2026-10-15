// POST /api/spraak/opdracht {tekst | bijlageId, accountId?, kandidaatId?}: één zin wordt één concept
// (taak, notitie, afspraak of mail) of een vraag welk account of welke persoon je bedoelt. Afspraak
// en mail vanaf Gevorderd. Opslaan gebeurt pas na "Bewaar" (sync-mutatie spraak.opdracht).
import { kan } from '../../utils/accounts'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'
import { interpreteer } from '../../utils/spraak'
import { transcribeer } from '../../utils/transcriptie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'spraak.opdracht')
  const b = await readBody<{ tekst?: string; bijlageId?: string; accountId?: string | null; kandidaatId?: string | null }>(event)
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    let tekst = String(b?.tekst ?? '')
    if (!tekst.trim() && b?.bijlageId) {
      const t = await transcribeer(tx, ctx.organisatie.id, ctx.gebruiker.id, b.bijlageId)
      if (!t.tekst) return { soort: 'fout', tekst: t.reden ?? 'Je opname is bewaard; de tekst volgt later.', transcript: null }
      tekst = t.tekst
    }
    const uit = await interpreteer(tx, ctx.organisatie.id, { id: ctx.gebruiker.id, niveau: ctx.gebruiker.niveau }, tekst, { accountId: b?.accountId ?? null, kandidaatId: b?.kandidaatId ?? null, uitgebreid: kan(ctx, 'spraak.opdrachtUitgebreid') })
    return { ...uit, transcript: tekst }
  })
})
