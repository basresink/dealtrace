// GET /api/belblokken?vandaag=1: de bellijst (zelfde rangorde als belmodus en vuller),
// de vaste blokken, de geplande blokken van de komende week (een leeg blok met vulvoorstel) en het advies uit de agenda.
import { and, gte, eq, sql, inArray } from 'drizzle-orm'
import { adviesMomenten, bellijstKop, bouwBellijst, blokduur, blokMoment, soortLabel, TOP } from '../../../shared/belblokken'
import { metOrganisatie, schema } from '../../utils/db'
import { kan } from '../../utils/accounts'
import { agenda, bezetVoor } from '../../utils/agenda'
import { blokkenVan, laadBelKandidaten } from '../../utils/bellen'
import { legeBlokVoorstellen } from '../../utils/ritmeBlokken'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'belblok.uitvoeren')
  const vandaag = getQuery(event).vandaag === '1'
  const nu = new Date()
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [u] = await tx.select({ werkplek: schema.users.werkplek, data: schema.users.data }).from(schema.users).where(eq(schema.users.id, ctx.gebruiker.id))
    const { blokken, voorkeuren, eigen } = blokkenVan(u ?? {})
    const kandidaten = await laadBelKandidaten(tx, ctx.gebruiker.id)
    const lijst = bouwBellijst(kandidaten, nu, { alleenVandaag: vandaag, top: 15 })
    const sessies = await tx.select().from(schema.belblokSessies).where(and(eq(schema.belblokSessies.gebruikerId, ctx.gebruiker.id), gte(schema.belblokSessies.eindOp, nu.toISOString()), sql`${schema.belblokSessies.status} in ('gepland', 'bezig')`)).orderBy(schema.belblokSessies.startOp).limit(20)
    const tellers = sessies.length ? (await tx.select({ id: schema.tasks.belblokId, status: schema.tasks.status }).from(schema.tasks).where(inArray(schema.tasks.belblokId, sessies.map((s) => s.id)))) : []
    // Gat 37: de gekoppelde agenda en de eigen afspraken tellen mee in de adviezen.
    const bezetExtern = await bezetVoor(tx, ctx.gebruiker.id, nu, new Date(nu.getTime() + 14 * 864e5))
    // Een blok dat al klaar is (vroeg gestopt) houdt zijn moment bezet: op hetzelfde moment kan geen tweede blok.
    const klaar = await tx.select({ start: schema.belblokSessies.startOp, eind: schema.belblokSessies.eindOp }).from(schema.belblokSessies).where(and(eq(schema.belblokSessies.gebruikerId, ctx.gebruiker.id), gte(schema.belblokSessies.eindOp, nu.toISOString()), eq(schema.belblokSessies.status, 'klaar')))
    // Een leeg gepland blok krijgt het vulvoorstel van Dagstart en Weekstart (knop Vul, POST /api/belblokken/:id/vul).
    const voorstel = await legeBlokVoorstellen(tx, ctx.gebruiker.id, sessies, nu)
    const top5 = lijst.slice(0, 5)
    const duur = blokduur(top5.reduce((s, k) => s + k.duur, 0))
    return {
      kop: bellijstKop(vandaag),
      bellijst: lijst.map((k) => ({ accountId: k.accountId, accountNaam: k.accountNaam, contactNaam: k.contactNaam, telefoon: k.telefoon, taskId: k.taskId, due: k.due ?? null, reden: k.reden, duur: k.duur, rang: k.rang, herkomst: k.herkomst, prioriteit: k.prioriteit, belblokId: k.belblokId, pil: k.prioriteit === 'urgent' || (k.due && Date.parse(k.due) < nu.getTime()) ? 'Urgent' : k.herkomst === 'opvolging' ? 'Opvolging' : 'Kans' })),
      blokken: blokken.map((b) => ({ ...b, moment: blokMoment(b), soortLabel: soortLabel(b) })), eigenBlokken: eigen, voorkeuren,
      gepland: sessies.map((s) => ({ id: s.id, start: s.startOp, eind: s.eindOp, status: s.status, plek: s.data.plek, soort: s.data.soort, vastBlokId: s.vastBlokId, gesprekken: tellers.filter((t) => t.id === s.id).length, open: tellers.filter((t) => t.id === s.id && t.status === 'open').length, voorstel: voorstel.get(s.id)?.voorstel ?? [], stand: voorstel.get(s.id)?.stand ?? null })),
      advies: adviesMomenten([...bezetExtern, ...klaar, ...sessies.map((s) => ({ start: s.startOp, eind: s.eindOp }))], blokken, nu, { duur, lunch: voorkeuren.lunch }),
      agenda: { gekoppeld: await agenda(tx).gekoppeld(ctx.gebruiker.id) },
      kan: { plannen: kan(ctx, 'belblok.plannen'), automatisch: kan(ctx, 'belblok.automatisch'), top: kan(ctx, 'belblok.plannen') ? [...TOP] : [5] },
    }
  })
})
