// GET /api/accounts/top: "Top deze week", de zes belangrijkste eigen prospects.
// Rangschikking op score met een kleine bonus voor open inzichten, een actieve
// aanleiding en recent contact. Levert ook de klassen voor het label op de kaart.
import { and, count, eq, inArray, notInArray, sql } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

const DAG = 24 * 3600 * 1000

/** Warmte voor de bovenrand van de kaart: heet, warm, lauw of koud. */
function warmte(score: number, aanleiding: { heet?: boolean } | null | undefined): 'heet' | 'warm' | 'lauw' | 'koud' {
  if (aanleiding?.heet || score >= 75) return 'heet'
  if (aanleiding || score >= 55) return 'warm'
  if (score >= 35) return 'lauw'
  return 'koud'
}

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'prospects.lijst')
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const rijen = await tx.select().from(schema.accounts)
      .where(and(eq(schema.accounts.accountKind, 'prospect'), eq(schema.accounts.ownerId, ctx.gebruiker.id), notInArray(schema.accounts.nbStatus, ['nee', 'overgedragen'])))
    const [klasseRij] = await tx.select().from(schema.orgSettings).where(sql`${schema.orgSettings.key} = 'klassen'`)
    const klassen = ((klasseRij?.value as { id: string; naam: string; tabblad?: string }[]) ?? [])
      .filter((k) => !k.tabblad || k.tabblad === 'Prospects').map((k) => ({ id: k.id, naam: k.naam }))
    if (!rijen.length) return { prospects: [], klassen }

    const tellingen = await tx.select({ accountId: schema.signals.accountId, n: count() }).from(schema.signals)
      .where(and(inArray(schema.signals.accountId, rijen.map((a) => a.id)), inArray(schema.signals.status, ['nieuw', 'gelezen'])))
      .groupBy(schema.signals.accountId)
    const inzichten = new Map(tellingen.map((t) => [t.accountId, Number(t.n)]))
    const nu = Date.now()

    const gerangschikt = rijen.map((a) => {
      const n = inzichten.get(a.id) ?? 0
      const aanleiding = a.data?.aanleiding ?? null
      let rang = a.score + Math.min(n * 5, 20)
      if (aanleiding) rang += aanleiding.heet ? 18 : 6
      if (a.laatsteContactOp && nu - Date.parse(a.laatsteContactOp) < 7 * DAG) rang += 4
      return { a, n, aanleiding, rang }
    }).sort((x, y) => y.rang - x.rang || y.a.score - x.a.score || x.a.name.localeCompare(y.a.name)).slice(0, 6)

    return {
      klassen,
      prospects: gerangschikt.map(({ a, n, aanleiding }, i) => ({
        rang: i + 1, id: a.id, naam: a.name, klasse: a.klasse, plaats: a.city, branche: a.data?.branche ?? null,
        aanleiding, status: a.nbStatus, score: a.score, inzichten: n, warmte: warmte(a.score, aanleiding),
      })),
    }
  })
})
