// GET /api/richting/concurrentiekaart: de concurrentkaarten (alleen bevestigd) als printbare pagina;
// "Download" opent de afdrukdialoog, waarin je als PDF bewaart. Vanaf Gevorderd.
import { metOrganisatie } from '../../utils/db'
import { leesStand } from '../../utils/vvProjectie'
import { vereisFunctie } from '../../utils/sessie'

const e = (t: unknown) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'richting.concurrentiekaart')
  const stand = await metOrganisatie(ctx.organisatie.id, (tx) => leesStand(tx))
  const rij = (l: string, v: unknown) => (v ? `<dt>${l}</dt><dd>${e(v)}</dd>` : '')
  const kaarten = (stand.concurrenten as any[]).map((c) => `<section><h2>${e(c.naam)} <small>${e(c.soort)}</small></h2><dl>${rij('Sterk', c.sterk)}${rij('Zwak', c.zwak)}${rij('Onderscheid', c.onderscheid)}${rij('Zo zeg je het', c.zoZegJeHet)}${rij('Als de klant zegt', c.alsDeKlantZegt)}${rij('Bewijs', c.bewijs)}${rij('Wanneer we verliezen', c.wanneerVerliezen)}</dl></section>`).join('')
  setHeader(event, 'content-type', 'text/html; charset=utf-8')
  return `<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>Concurrentiekaart · ${e(ctx.organisatie.naam)}</title><style>body{font:14px/1.5 system-ui,sans-serif;margin:32px;color:#111}h1{font-size:22px}section{break-inside:avoid;border:1px solid #ccc;padding:12px 16px;margin:12px 0}h2{font-size:16px;margin:0 0 8px}small{color:#666;font-weight:400}dt{font-weight:700;margin-top:6px}dd{margin:0}</style></head><body onload="window.print()"><h1>Concurrentiekaart · ${e(ctx.organisatie.naam)}</h1>${kaarten || '<p>Nog geen bevestigde concurrenten.</p>'}</body></html>`
})
