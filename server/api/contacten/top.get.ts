// GET /api/contacten/top: "Beslissers en beïnvloeders deze week", zes contacten bij je
// eigen accounts, in de opzet van DealDrive. Eerst wie deze week iets heeft lopen (open
// taken die deze week of eerder vervallen, afspraken deze week), daarna aanvullen met
// beslissers, champions en beïnvloeders op de score van het account. Vaste aantallen
// queries: contacten, accounts, klassen, taken, afspraken, inzichten en activiteit.
import { and, count, inArray, isNotNull, lt, sql } from 'drizzle-orm'
import { effectiefNiveau, eigenVeldenVoor } from '../../utils/accounts'
import { contactExtra, contactRijen, laatsteActiviteit } from '../../utils/contactLijst'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

const DAG = 864e5
const BESLIS_RANG: Record<string, number> = { beslisser: 3, champion: 2, beinvloeder: 2 }

/** Maandag 00:00 tot en met zondag van deze week, in de tijdzone van de server (Europe/Amsterdam in productie). */
function weekVenster(nu = new Date()) {
  const d = new Date(nu); d.setHours(0, 0, 0, 0)
  const start = new Date(d.getTime() - ((d.getDay() + 6) % 7) * DAG)
  return { start, eind: new Date(start.getTime() + 7 * DAG) }
}

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'contacten.basis')
  const nu = new Date()
  const { start, eind } = weekVenster(nu)
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const velden = await eigenVeldenVoor(tx, 'contact', effectiefNiveau(ctx))
    const eigen = (await contactRijen(tx, velden)).filter((c) => c.eigenaarId === ctx.gebruiker.id && c.status === 'actief')
    const [klasseRij] = await tx.select().from(schema.orgSettings).where(sql`${schema.orgSettings.key} = 'klassen'`)
    const klassen = ((klasseRij?.value as { id: string; naam: string }[]) ?? []).map((k) => ({ id: k.id, naam: k.naam }))
    const week = { van: start.toISOString(), tot: new Date(eind.getTime() - DAG).toISOString() }
    if (!eigen.length) return { contacten: [], klassen, week }
    const ids = eigen.map((c) => c.id)

    const taken = await tx.select({ id: schema.tasks.contactId, n: count() }).from(schema.tasks)
      .where(and(inArray(schema.tasks.contactId, ids), inArray(schema.tasks.status, ['open', 'bezig']), isNotNull(schema.tasks.dueDate), lt(schema.tasks.dueDate, eind.toISOString())))
      .groupBy(schema.tasks.contactId)
    const afspraakRijen = (await tx.execute(sql`select contact_id as id, count(*)::int as n, min(start_at) as eerste from appointments
      where contact_id in (${sql.join(ids.map((i) => sql`${i}`), sql`, `)}) and status = 'gepland' and start_at >= ${start.toISOString()} and start_at < ${eind.toISOString()} group by contact_id`)).rows as { id: string; n: number; eerste: string }[]
    const taakMap = new Map(taken.map((t) => [t.id!, Number(t.n)]))
    const afspraakMap = new Map(afspraakRijen.map((a) => [a.id, a]))

    const gescoord = eigen.map((c) => {
      const t = taakMap.get(c.id) ?? 0
      const a = afspraakMap.get(c.id)
      return { c, t, a, week: t + (a ? a.n * 2 : 0) }
    })
    const dezeWeek = gescoord.filter((x) => x.week > 0).sort((x, y) => y.week - x.week || y.c.score - x.c.score)
    const aanvulling = gescoord.filter((x) => x.week === 0 && BESLIS_RANG[x.c.rol])
      .sort((x, y) => BESLIS_RANG[y.c.rol]! - BESLIS_RANG[x.c.rol]! || y.c.score - x.c.score || y.c.updatedAt.localeCompare(x.c.updatedAt) || x.c.naam.localeCompare(y.c.naam, 'nl'))
    const top = [...dezeWeek, ...aanvulling].slice(0, 6)
    const extra = await contactExtra(tx, top.map((x) => x.c.accountId), nu)
    const dagFmt = new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' })

    return {
      klassen,
      week,
      contacten: top.map(({ c, t, a }) => ({
        id: c.id, naam: c.naam, functie: c.functie, rol: c.rol, linkedin: c.linkedin, jarenInRol: c.jarenInRol,
        account: { id: c.accountId, naam: c.bedrijf, soort: c.soort, klasse: c.accountKlasse },
        inzichten: extra.inzichten.get(c.accountId) ?? 0,
        laatsteActiviteitOp: laatsteActiviteit(extra.activiteit.get(c.accountId), c.laatsteContactOp),
        reden: a ? `Afspraak ${dagFmt.format(new Date(a.eerste)).replace(/\./g, '')}` : t ? `${t} open ${t === 1 ? 'taak' : 'taken'} deze week` : null,
      })),
    }
  })
})
