// GET /api/platform/abonnementen: per pakket de functies per groep, de databronnen, AI-credits per gebruiker,
// de AI-soorten die aanstaan en de prijs met geldig-vanaf (geldend en historie). Founder.
import { sql } from 'drizzle-orm'
import { AI_SOORT, AI_SOORTEN, POT_PER_GEBRUIKER } from '../../../../shared/credits'
import { FUNCTIES, featureGroep, pakketBevat } from '../../../../shared/functies'
import { prijsOp } from '../../../../shared/platform'
import { PAKKETTEN, PAKKET_LABEL } from '../../../../shared/types'
import { platformCredits } from '../../../utils/credits'
import { alsPlatform, requireFounder } from '../../../utils/platform'

const BRONNEN: Record<string, string[]> = { starter: ['Import', 'Handmatig'], plus: ['Import', 'Handmatig', 'AI-zoeker', 'KvK'], compleet: ['Import', 'Handmatig', 'AI-zoeker', 'KvK', 'Datacollectief', 'Webonderzoek'] }

export default defineEventHandler(async (event) => {
  await requireFounder(event)
  return alsPlatform(async (tx) => {
    const prijzen = ((await tx.execute(sql`select pakket, prijs_cent, seat_cent, geldig_vanaf::text as g, op from pakketprijzen order by geldig_vanaf desc, op desc`)).rows as any[])
      .map((p) => ({ pakket: p.pakket, prijsCent: p.prijs_cent, seatCent: p.seat_cent, geldigVanaf: p.g, op: new Date(p.op).toISOString() }))
    const { perGebruiker } = await platformCredits(tx)
    const vandaag = new Date().toISOString().slice(0, 10)
    const klanten = ((await tx.execute(sql`select id, name, pakket from organisations where status <> 'systeem' order by name`)).rows as any[]).map((o) => ({ id: o.id, naam: o.name, pakket: o.pakket }))
    const functies = FUNCTIES.filter((f) => f.rollen === 'iedereen' || !f.rollen.every((r) => r === 'founder'))
    return {
      pakketten: PAKKETTEN.map((p) => ({
        pakket: p, label: PAKKET_LABEL[p], bronnen: BRONNEN[p], creditsPerGebruiker: perGebruiker[p] ?? POT_PER_GEBRUIKER[p], standaardCredits: POT_PER_GEBRUIKER[p],
        aiSoorten: AI_SOORTEN.filter((s) => AI_SOORT[s].pakketten.includes(p)).map((s) => AI_SOORT[s].naam),
        prijs: prijsOp(prijzen, vandaag, (x) => x.pakket === p), komend: prijzen.filter((x) => x.pakket === p && x.geldigVanaf > vandaag),
        functies: functies.filter((f) => pakketBevat({ pakket: p, features: {} }, f)).length,
      })),
      matrix: functies.map((f) => ({ sleutel: f.sleutel, naam: f.naam, groep: featureGroep(f.sleutel), pakket: f.pakket })),
      klanten, historie: prijzen.slice(0, 30),
    }
  })
})
