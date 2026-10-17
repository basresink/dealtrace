// De Dagplanner (F3, agent Planner, mandaat A): plant de dag van een gebruiker zelf in en plant de rest
// van de dag opnieuw als er iets verschuift. Elke handeling gaat eerst langs de Bewaker (toets: mandaat,
// pauze, dagplafond); mag hij niet direct, dan blijft het bij het voorstel op /dagstart. Wat hij schrijft
// (belblokken, voorbereiding, kansen) loopt via server/utils/dagplanning.ts met herkomst "dagplanner",
// zodat het per blok of voor de hele dag ongedaan kan. Wat niet meer past, schuift met een melding door.
import { sql } from 'drizzle-orm'
import { CAPACITEIT_STANDAARD } from '../../../shared/ritmematrix'
import { dagplanningVoorkeur, herplan, itemsUitPlan, planAanDeBeurt, vastSleutel, vastVerschil, type PlanItem } from '../../../shared/dagplanning'
import type { PlanBlok } from '../../../shared/dagritme'
import { isWerkdag, nlMoment, nlTijdstip } from '../../../shared/datum'
import { schrijfAudit } from '../audit'
import { gebruikerVan, planBron, type DagritmeGebruiker } from '../dagritmeWeek'
import { belPool, dagplanningVan, doelVoorDoorschuiven, doorschuifTekst, haalItemWeg, meldDagplanning, schrijfItem, vastStandVoor, verplaatsItem, werkdagInstelling } from '../dagplanning'
import { instellingVan } from '../onderwegMeldingen'
import { logAgentRun, toets } from './bewaker'

type Tx = Parameters<Parameters<ReturnType<typeof import('../db').gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]
const hhmm = (d: Date) => new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }).format(d)

/** Hoeveel de Dagplanner vandaag namens deze gebruiker al deed (voor het dagplafond van de Bewaker). */
async function vandaagGedaan(tx: Tx, gebruikerId: string, nu: Date): Promise<number> {
  const [r] = await rijen(tx, sql`select count(*)::int as n from agent_runs where agent = 'planner' and handeling like 'dagplanning%' and gebruiker_id = ${gebruikerId} and uitkomst = 'uitgevoerd' and op >= ${nlTijdstip(nlMoment(nu).datum, 0).toISOString()}`)
  return r?.n ?? 0
}
const voorstel = (g: DagritmeGebruiker) => ({ id: g.id, niveau: g.niveau, data: g.data as any })
/** Capaciteit (gat 16, shared/ritmematrix): 40 belacties binnendienst, 6 bezoeken buitendienst; kansen hooguit twee. */
const capaciteit = (bezoeken: number) => ({ capaciteit: CAPACITEIT_STANDAARD.binnendienst, kansenMax: Math.max(0, Math.min(2, CAPACITEIT_STANDAARD.buitendienst - bezoeken)) })

export type PlanStatus = 'gepland' | 'al-gepland' | 'voorstel' | 'geblokkeerd' | 'geen-werkdag'

/**
 * De dag van vandaag automatisch indelen en in de agenda zetten. `automatisch` (de geplande taak) plant
 * een dag hooguit één keer; `handmatig` ("Plan mijn dag nu") mag ook na ongedaan maken of een voorstel.
 */
export async function planMijnDag(tx: Tx, org: string, gebruikerId: string, nu: Date, aanleiding: 'automatisch' | 'handmatig'): Promise<{ status: PlanStatus; reden?: string; items?: number; samenvatting?: string }> {
  const g = await gebruikerVan(tx, gebruikerId)
  const dag = nlMoment(nu).datum
  const w = await werkdagInstelling(tx)
  if (!isWerkdag(dag, w)) return { status: 'geen-werkdag', reden: 'Vandaag is geen werkdag' }
  const al = await dagplanningVan(tx, g.id, dag)
  if (al && (aanleiding === 'automatisch' || al.status === 'gepland')) return { status: 'al-gepland' }
  const t = await toets(tx, org, { agent: 'planner', handeling: 'dagplanning', gebruiker: voorstel(g), vandaagGedaan: await vandaagGedaan(tx, g.id, nu) }, nu)
  if (!t.mag || t.uitvoering !== 'direct') {
    const reden = t.reden ?? 'De Bewaker liet alleen een voorstel toe'
    await tx.execute(sql`insert into dagplanningen (organisation_id, gebruiker_id, datum, status, gepland_op, data) values (${org}, ${g.id}, ${dag}, 'voorstel', ${nu.toISOString()}, ${JSON.stringify({ reden })}::jsonb)
      on conflict (gebruiker_id, datum) do update set status = 'voorstel', data = dagplanningen.data || excluded.data`)
    await meldDagplanning(tx, org, g.id, 'Je dag staat als voorstel klaar', `De Dagplanner zette niets zelf in je agenda: ${reden.charAt(0).toLowerCase()}${reden.slice(1)}. Bekijk het voorstel en zet het in je agenda als het klopt.`, nu)
    return { status: t.mag ? 'voorstel' : 'geblokkeerd', reden }
  }
  const bron = await planBron(tx, g, dag, nu)
  const [rij] = await rijen(tx, sql`insert into dagplanningen (organisation_id, gebruiker_id, datum, status, modus, gepland_op) values (${org}, ${g.id}, ${dag}, 'gepland', ${bron.modus}, ${nu.toISOString()})
    on conflict (gebruiker_id, datum) do update set status = 'gepland', modus = excluded.modus, gepland_op = excluded.gepland_op, herpland_op = null, data = '{}'::jsonb where dagplanningen.status <> 'gepland' returning id`)
  if (!rij) return { status: 'al-gepland' }
  const plan = itemsUitPlan(bron.plan, { belacties: bron.belTaken, ...capaciteit(bron.bezoeken) })
  const pool = await belPool(tx, g.id, dag)
  const gebruikt = new Set<string>()
  const items: PlanItem[] = []
  for (const i of plan) { const s = await schrijfItem(tx, org, g.id, i, pool, gebruikt, dag); if (s) items.push(s) }
  const data = { items, vast: bron.vastStand, belUur: bron.plan.belUur, belUitleg: bron.plan.belUitleg, samenvatting: bron.plan.samenvatting, wijzigingen: [] }
  await tx.execute(sql`update dagplanningen set data = ${JSON.stringify(data)}::jsonb where id = ${rij.id}`)
  const inAgenda = items.filter((i) => i.soort === 'belblok' || i.soort === 'voorbereiding' || i.soort === 'kans')
  await logAgentRun(tx, org, { agent: 'planner', handeling: 'dagplanning', mandaat: t.mandaat, uitkomst: 'uitgevoerd', gebruikerId: g.id, bronnen: [{ dag, items: items.map((i) => i.sleutel), aanleiding }] }, nu)
  await schrijfAudit(tx, { organisationId: org, actorId: g.id, action: 'dagplanning.plannen', resourceType: 'dagplanningen', resourceId: rij.id, changes: { aanleiding, modus: bron.modus, items: items.map((i) => ({ sleutel: i.sleutel, start: i.start, sessieId: i.sessieId ?? null, taakId: i.taakId ?? null })) } })
  await meldDagplanning(tx, org, g.id, 'Je dag staat klaar', `Ingedeeld om ${hhmm(nu)}: ${bron.plan.samenvatting}. ${inAgenda.length ? `De Dagplanner zette ${inAgenda.length === 1 ? '1 blok' : `${inAgenda.length} blokken`} in je agenda; je maakt ze per blok ongedaan op Dagstart.` : 'Er was vandaag niets om zelf in je agenda te zetten.'}`, nu)
  return { status: 'gepland', items: items.length, samenvatting: bron.plan.samenvatting }
}

/**
 * De rest van vandaag opnieuw indelen na een wijziging (afspraak verzet, geannuleerd, uitgelopen, nieuw,
 * of een verandering in de gekoppelde agenda). Alleen wat nog niet begon, schuift; wat niet meer past,
 * gaat naar het eerstvolgende passende moment. Elke wijziging komt in "Wat schoof" en als melding.
 */
export async function herplanDag(tx: Tx, org: string, gebruikerId: string, nu: Date, aanleiding: string): Promise<{ regels: string[] } | null> {
  const dag = nlMoment(nu).datum
  const dp = await dagplanningVan(tx, gebruikerId, dag)
  if (!dp || dp.status !== 'gepland') return null
  const g = await gebruikerVan(tx, gebruikerId)
  const t = await toets(tx, org, { agent: 'planner', handeling: 'dagplanning.herplannen', gebruiker: voorstel(g), vandaagGedaan: await vandaagGedaan(tx, g.id, nu) }, nu)
  if (!t.mag || t.uitvoering !== 'direct') return null
  const items = (dp.data?.items ?? []) as PlanItem[]
  const actief = items.filter((i) => i.status === 'actief')
  const flex = actief.filter((i) => Date.parse(i.start) >= nu.getTime())
  const vastItems = actief.filter((i) => Date.parse(i.start) < nu.getTime())
  const extra: PlanBlok[] = vastItems.filter((i) => i.soort !== 'belblok').map((i): PlanBlok => ({ id: i.sleutel, soort: i.soort as PlanBlok['soort'], start: i.start, eind: i.eind, titel: i.titel, sub: i.sub, vast: true, voorstel: false, accountId: i.accountId ?? null }))
  const bron = await planBron(tx, g, dag, nu, { modus: dp.modus, zonderSessies: flex.filter((i) => i.soort === 'belblok' && i.sessieId).map((i) => i.sessieId!), extra })
  const nieuw = itemsUitPlan(bron.plan, { belacties: bron.belTaken, ...capaciteit(bron.bezoeken), belVanaf: vastItems.filter((i) => i.soort === 'belblok').length })
    .filter((i) => !vastItems.some((v) => v.sleutel === i.sleutel))
  const doel = doelVoorDoorschuiven(g, nu, await werkdagInstelling(tx))
  const h = herplan(flex, nieuw, nu, doorschuifTekst(doel))
  const oorzaak = vastVerschil(dp.data?.vast ?? null, bron.vastStand, dag)
  // Eerst weghalen en verschuiven, dan nieuw schrijven: een vrijgekomen plek kan meteen gevuld worden.
  for (const v of h.vervalt) await haalItemWeg(tx, org, g.id, v, 'doorschuiven', doel)
  const verschoven: PlanItem[] = []
  for (const v of h.verplaatst) verschoven.push(await verplaatsItem(tx, v.oud, v.nieuw))
  const eigen = h.blijft.concat(verschoven).filter((i) => i.soort === 'belblok' && i.sessieId).map((i) => i.sessieId!)
  const pool = await belPool(tx, g.id, dag, eigen)
  const gebruikt = new Set<string>((await rijen(tx, sql`select id from tasks where belblok_id = any(string_to_array(${eigen.join(',') || '-'}, ',')) and status in ('open', 'bezig')`)).map((r) => r.id as string))
  const erbij: PlanItem[] = []
  for (const n of h.nieuw) { const s = await schrijfItem(tx, org, g.id, n, pool, gebruikt, dag); if (s) erbij.push(s) }
  const veranderd = !!(h.verplaatst.length || h.vervalt.length || erbij.length)
  const regels = veranderd ? [...oorzaak, ...h.regels] : oorzaak.length ? [...oorzaak, 'Je planning hoefde niet te veranderen.'] : []
  const rest = items.filter((i) => i.status !== 'actief')
  const nieuweItems = [...rest, ...vastItems, ...h.blijft, ...verschoven, ...h.vervalt.map((v) => ({ ...v, status: 'vervallen' as const })), ...erbij].sort((a, b) => a.start.localeCompare(b.start))
  const wijzigingen = regels.length ? [...(dp.data?.wijzigingen ?? []), { op: nu.toISOString(), aanleiding, regels }] : dp.data?.wijzigingen ?? []
  const data = { items: nieuweItems, vast: bron.vastStand, belUur: bron.plan.belUur ?? dp.data?.belUur ?? null, belUitleg: bron.plan.belUur != null ? bron.plan.belUitleg : dp.data?.belUitleg ?? bron.plan.belUitleg, wijzigingen }
  await tx.execute(sql`update dagplanningen set data = data || ${JSON.stringify(data)}::jsonb ${regels.length ? sql`, herpland_op = ${nu.toISOString()}` : sql``} where id = ${dp.id}`)
  if (veranderd) {
    await logAgentRun(tx, org, { agent: 'planner', handeling: 'dagplanning.herplannen', mandaat: t.mandaat, uitkomst: 'uitgevoerd', gebruikerId: g.id, bronnen: [{ dag, aanleiding, verplaatst: h.verplaatst.length, vervalt: h.vervalt.length, nieuw: erbij.length }] }, nu)
    await schrijfAudit(tx, { organisationId: org, actorId: g.id, action: 'dagplanning.herplannen', resourceType: 'dagplanningen', resourceId: dp.id, changes: { aanleiding, regels } })
  }
  // Elke regel in "Wat schoof" komt ook als melding, ook als de planning zelf niet hoefde te veranderen
  // (Dagstart zegt dan net zo goed "Je dag is opnieuw ingedeeld").
  if (regels.length) await meldDagplanning(tx, org, g.id, 'Je dag is opnieuw ingedeeld', regels.join(' '), nu)
  return { regels }
}

/** Herplan alleen als de vaste punten van vandaag veranderden sinds de laatste (her)planning (poll en na een wijziging). */
export async function herplanAlsNodig(tx: Tx, org: string, gebruikerId: string, nu: Date, aanleiding: string): Promise<boolean> {
  const dag = nlMoment(nu).datum
  const dp = await dagplanningVan(tx, gebruikerId, dag)
  if (!dp || dp.status !== 'gepland') return false
  const stand = await vastStandVoor(tx, gebruikerId, dag)
  if (vastSleutel(stand) === vastSleutel(dp.data?.vast ?? [])) return false
  return !!(await herplanDag(tx, org, gebruikerId, nu, aanleiding))
}

/**
 * Na een wijziging aan een afspraak (verzet, geannuleerd, uitgelopen, nieuw): herplan de dag van de
 * eigenaar als die vandaag een dagplanning heeft. In een eigen savepoint, zodat een fout in het
 * herplannen de wijziging zelf nooit tegenhoudt.
 */
export async function herplanBijWijziging(tx: Tx, org: string, eigenaarId: string, nu: Date, aanleiding: string): Promise<void> {
  const [dp] = await rijen(tx, sql`select 1 from dagplanningen where gebruiker_id = ${eigenaarId} and datum = ${nlMoment(nu).datum} and status = 'gepland'`)
  if (!dp) return
  await tx.transaction((sp) => herplanAlsNodig(sp as unknown as Tx, org, eigenaarId, nu, aanleiding)).catch((e) => console.error('dagplanner herplannen', (e as Error).message))
}

/**
 * De geplande taak (elk kwartier): per gebruiker met "Plan mijn dag automatisch" op zijn tijdstip, na de
 * stille uren, één keer per werkdag (unieke sleutel op gebruiker en datum). Wie vandaag al gepland is,
 * krijgt een controle op de vaste punten (poll op de gekoppelde agenda) en zo nodig een herplanning.
 * `mag` controleert of de dagstart voor de gebruiker aanstaat.
 */
export async function dagplanningSweep(tx: Tx, org: string, nu: Date, mag: (g: { id: string; rol: string; niveau: string; werkplek: string; teamId: string | null }) => boolean) {
  const tel = { gepland: 0, herpland: 0, voorstel: 0, overgeslagen: 0, fout: 0 }
  const dag = nlMoment(nu).datum
  const w = await werkdagInstelling(tx)
  const gebruikers = await rijen(tx, sql`select u.id, u.role, u.niveau, u.werkplek, u.team_id, p.data->'dagplanning' as voorkeur, d.status as dp_status from users u join persoonlijke_instellingen p on p.id = u.id
    left join dagplanningen d on d.gebruiker_id = u.id and d.datum = ${dag}
    where u.status = 'actief' and u.role <> 'founder' and (p.data->'dagplanning'->>'automatisch') = 'true'`)
  for (const u of gebruikers) {
    if (!mag({ id: u.id, rol: u.role, niveau: u.niveau, werkplek: u.werkplek, teamId: u.team_id })) { tel.overgeslagen++; continue }
    try {
      if (u.dp_status === 'gepland') {
        if (await tx.transaction((sp) => herplanAlsNodig(sp as unknown as Tx, org, u.id, nu, 'agenda'))) tel.herpland++
        continue
      }
      if (u.dp_status) continue
      const moment = planAanDeBeurt(dagplanningVoorkeur(u.voorkeur), nu, await instellingVan(tx, u.id), w)
      if (!moment) continue
      const r = await tx.transaction((sp) => planMijnDag(sp as unknown as Tx, org, u.id, nu, 'automatisch'))
      if (r.status === 'gepland') tel.gepland++
      else if (r.status === 'voorstel' || r.status === 'geblokkeerd') tel.voorstel++
    } catch (e: any) {
      console.error(`dagplanning ${u.id}: ${e?.message}`)
      tel.fout++
    }
  }
  return tel
}
