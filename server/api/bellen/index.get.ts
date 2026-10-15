// GET /api/bellen: de bellijst van vandaag voor de telefoon (8.5.4), met per regel de eerste
// zin van het voorgestelde script en het nummer voor de belknop (mobiel eerst).
import { bouwBellijst } from '../../../shared/belblokken'
import { vulScript, zichtbareScripts } from '../../../shared/belscripts'
import { metOrganisatie } from '../../utils/db'
import { kan } from '../../utils/accounts'
import { belmodusItems, laadBelKandidaten, laadScripts } from '../../utils/bellen'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'belblok.uitvoeren')
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const kandidaten = (await laadBelKandidaten(tx, ctx.gebruiker.id)).filter((k) => k.taskId)
    const lijst = bouwBellijst(kandidaten, new Date(), { alleenVandaag: true, top: 30 })
    const scripts = zichtbareScripts(await laadScripts(tx), { id: ctx.gebruiker.id, niveau: ctx.gebruiker.niveau, teamId: ctx.gebruiker.teamId })
    const items = await belmodusItems(tx, { gebruiker: { id: ctx.gebruiker.id, naam: ctx.gebruiker.naam, niveau: ctx.gebruiker.niveau, teamId: ctx.gebruiker.teamId }, organisatie: ctx.organisatie }, lijst as any, { scripts })
    return {
      kop: 'Bellijst van vandaag',
      items: items.map((i) => {
        const s = scripts.find((x) => x.id === i.voorstel?.scriptId)
        const opening = s ? vulScript(s, { waarden: i.waarden }).blokken.find((b) => b.soort === 'opening' || b.soort === 'poortwachter') : undefined
        return { ...i, eersteRegel: opening ? opening.segmenten.map((x) => x.tekst).join('') : null }
      }),
      scripts, kan: { handsfree: kan(ctx, 'bellen.handsfree') },
    }
  })
})
