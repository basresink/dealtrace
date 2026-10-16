// GET /api/instellingen/abonnement: het pakket in gewone woorden, seats, contract, AI-credits en facturen.
import { eq, sql } from 'drizzle-orm'
import { POT_PER_GEBRUIKER } from '../../../../shared/credits'
import { platformCredits } from '../../../utils/credits'
import { PAKKET_LABEL, PAKKET_UITLEG, pakketVerschil } from '../../../../shared/pakket'
import type { Pakket } from '../../../../shared/types'
import { vereisBeheerder } from '../../../utils/beheerder'
import { metOrganisatie, schema } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const { organisatie } = await vereisBeheerder(event, 'instellingen.abonnement')
  return metOrganisatie(organisatie.id, async (tx) => {
    const [o] = await tx.select().from(schema.organisations).where(eq(schema.organisations.id, organisatie.id))
    const gebruikers = (await tx.select({ status: schema.users.status }).from(schema.users)).filter((u) => u.status !== 'gearchiveerd').length
    const pakket = o!.pakket as Pakket
    const hoger = (['plus', 'compleet'] as Pakket[]).filter((p) => ['starter', 'plus', 'compleet'].indexOf(p) > ['starter', 'plus', 'compleet'].indexOf(pakket))
    return {
      pakket, label: PAKKET_LABEL[pakket], uitleg: PAKKET_UITLEG[pakket],
      seats: o!.contract?.seats ?? null, gebruikers, contract: o!.contract ?? {},
      gebruikersStand: o!.data?.gebruikersStand ?? 'aanvragen',
      upgrades: hoger.map((p) => ({ pakket: p, label: PAKKET_LABEL[p], wint: pakketVerschil(pakket, p).wint })),
      // P24: facturen uit Stripe (pdf en betaallink) en de AI-pauze bij een achterstallige factuur.
      aiGepauzeerd: !!(o!.data as any)?.aiGepauzeerd, aiCreditsPerMaand: (await platformCredits(tx)).perGebruiker[pakket] ?? POT_PER_GEBRUIKER[pakket],
      facturen: ((await tx.execute(sql`select nummer, bedrag_cent, status, pdf_url from facturen order by op desc limit 24`)).rows as any[]).map((f) => ({ nummer: f.nummer, bedragCent: f.bedrag_cent, status: f.status, pdf: f.pdf_url })),
    }
  })
})
