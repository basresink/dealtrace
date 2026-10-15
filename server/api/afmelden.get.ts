// GET /api/afmelden?o=&h=&t=: de afmeldlink uit elke eerste mail (15.2). Ondertekend; het adres gaat
// gehasht op de onderdrukkingslijst en krijgt geen mail meer, ook niet na een nieuwe import.
import { sql } from 'drizzle-orm'
import { metOrganisatie } from '../utils/db'
import { isOndertekend } from '../utils/mail'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const o = String(q.o ?? ''); const h = String(q.h ?? ''); const t = String(q.t ?? '')
  setHeader(event, 'content-type', 'text/html; charset=utf-8')
  const pagina = (tekst: string) => `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Afmelden</title></head><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem"><h1>Afmelden</h1><p>${tekst}</p></body></html>`
  if (!o || !/^[a-f0-9]{64}$/.test(h) || !isOndertekend(o, h, t)) { setResponseStatus(event, 400); return pagina('Deze afmeldlink klopt niet.') }
  await metOrganisatie(o, (tx) => tx.execute(sql`insert into onderdrukkingslijst (organisation_id, email_hash, bron) select ${o}, ${h}, 'afgemeld' where not exists (select 1 from onderdrukkingslijst where email_hash = ${h})`))
  return pagina('Je bent afgemeld. Je krijgt geen mail meer van ons.')
})
