// GET /api/richting: het leesmodel (alleen bevestigd) met status, versie, dekking en labels per
// onderdeel, voor iedereen. Concepten zijn hier niet zichtbaar.
import { ONDERDELEN, dekking } from '../../../shared/verkoopverhaal'
import { kan } from '../../utils/accounts'
import { metOrganisatie, schema } from '../../utils/db'
import { leesStand, sublagen } from '../../utils/vvProjectie'
import { vereisOrganisatie } from '../../utils/sessie'
import { sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const stand = await leesStand(tx)
    const s = await sublagen(tx)
    const status = Object.fromEntries(ONDERDELEN.map((o) => [o, { status: s[o].status, versie: s[o].versie, bevestigdOp: s[o].bevestigdOp, controleren: s[o].controleren, verouderd: s[o].verouderd, bron: s[o].bron }]))
    const perBranche = (await tx.execute(sql`select vv_branche_id as b, count(*)::int n from accounts where vv_branche_id is not null group by 1`)).rows as { b: string; n: number }[]
    const gesprekken = (await tx.execute(sql`select a.vv_branche_id as b, count(*)::int n from activiteiten x join accounts a on a.id = x.account_id
      where x.soort in ('gebeld', 'bezoek') and x.uitkomst not in ('geen_reactie', 'voicemail') and x.op >= date_trunc('quarter', now()) and a.vv_branche_id is not null group by 1`)).rows as { b: string; n: number }[]
    const totaalGesprekken = gesprekken.reduce((t, g) => t + g.n, 0)
    const ritmes = (await tx.select({ id: schema.hercontactritmes.id, naam: schema.hercontactritmes.naam }).from(schema.hercontactritmes))
    const bevestigd = ONDERDELEN.some((o) => s[o].status === 'bevestigd')
    const uitSalesdna = ONDERDELEN.filter((o) => s[o].bron === 'salesdna')
    const bijgewerkt = uitSalesdna.map((o) => s[o].bevestigdOp).filter(Boolean).sort().at(-1) ?? null
    return {
      leeg: !bevestigd, bron: uitSalesdna.length ? 'salesdna' : 'eigen', bronBijgewerkt: bijgewerkt, status, stand,
      golden: Object.fromEntries((stand.teksten ?? []).filter((t) => t.sublaag === 'L0.0').map((t) => [t.sleutel, t.tekst])),
      dekking: { verhaal: dekking('bedrijfsverhaal', stand), belofte: dekking('waarde', stand) },
      branches: (stand.branches ?? []).map((b) => ({ ...b, accounts: perBranche.find((x) => x.b === b.id)?.n ?? 0, aandeelGesprekken: totaalGesprekken ? Math.round(((gesprekken.find((x) => x.b === b.id)?.n ?? 0) / totaalGesprekken) * 100) : null })),
      ritmes,
      kan: { concurrentiekaart: kan(ctx, 'richting.concurrentiekaart'), voorstellen: kan(ctx, 'richting.voorstellen'), inrichten: kan(ctx, 'verkoopverhaal.inrichten') },
    }
  })
})
