// POST /api/motor/reeksen-sweep: elke 15 minuten (geplande functie opvolgreeksen, x-motor-secret). Per organisatie
// eerst het postvak lezen via de adapter van de mailkoppeling (een antwoord stopt de reeks), dan
// alle lopende opvolgreeksen bijwerken: stoppen bij een reactie (met een taak "bel terug"), vervallen stappen
// klaarzetten (taak, concept van de Schrijver, belstap in het belblok) en bij mandaat B een mail op de dag zelf versturen.
import { timingSafeEqual } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { gebruikDb, metOrganisatie } from '../../utils/db'
import { pollPostvak } from '../../utils/mailInkomend'
import { reeksSweep } from '../../utils/opvolgreeks'

export default defineEventHandler(async (event) => {
  const geheim = process.env.MOTOR_SECRET ?? ''
  const gegeven = getHeader(event, 'x-motor-secret') ?? ''
  if (!(geheim.length >= 16 && gegeven.length === geheim.length && timingSafeEqual(Buffer.from(gegeven), Buffer.from(geheim)))) throw createError({ statusCode: 401, statusMessage: 'Geheim ontbreekt of klopt niet' })
  const orgs = await gebruikDb().transaction(async (tx) => {
    await tx.execute(sql`set local role dealtrace_platform`)
    return (await tx.execute(sql`select id from organisations where status <> 'systeem'`)).rows as { id: string }[]
  })
  const basis = getRequestURL(event).origin
  const totaal = { reeksen: 0, gestopt: 0, klaargezet: 0, verstuurd: 0 }
  for (const o of orgs) {
    // Elke organisatie in een eigen transactie: een fout bij de één houdt de rest niet tegen.
    const r = await metOrganisatie(o.id, async (tx) => { await pollPostvak(tx, o.id); return reeksSweep(tx, o.id, new Date(), basis) }).catch((e) => { console.error(`reeksen ${o.id}: ${e?.message}`); return null })
    if (r) for (const k of Object.keys(totaal) as (keyof typeof totaal)[]) totaal[k] += r[k]
  }
  return totaal
})
