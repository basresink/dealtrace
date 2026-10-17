// De blokken van Dagstart en Weekstart op de server (shared/ritmeBlokken.ts): lege belblokken met een
// vulvoorstel uit de bellijst, de belprioriteit naast je afspraken, kansen langs de route, lopende
// campagnes en lopende accountplannen. Alles van één gebruiker, binnen metOrganisatie (RLS). Een blok
// waarvan de functie uit staat (kan), laadt niets en komt als null terug. Hergebruikt de bestaande
// logica: laadBelKandidaten en bouwBellijst (Belblokken), bellijstNaastBezoeken en bezoekDag (Bezoeken),
// lijst (Campagnes) en voortgang/weergaveStatus (Accountplannen).
import { sql } from 'drizzle-orm'
import { bouwBellijst, schatDuur, type BlokSoort } from '../../shared/belblokken'
import { voortgang, weergaveStatus } from '../../shared/accountplannen'
import { nlMoment, nlTijdstip, plusDagen } from '../../shared/datum'
import { bellijstNaastBezoeken } from '../../shared/route'
import { RITME_BLOK_FUNCTIE, vulVoorstellen, type BelblokDagVoorstel, type RitmeAfspraak, type RitmeBlokken } from '../../shared/ritmeBlokken'
import { laadBelKandidaten } from './bellen'
import { bezoekDag } from './bezoeken'
import { lijst as campagneLijst } from './campagnes'
import { gebruikDb } from './db'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]
const iso = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString())
const lijst = (ids: string[]) => ids.join(',')
const EIND = ['afspraak', 'geparkeerd', 'afgewezen']

export interface RitmeGebruiker { id: string; naam: string; werkplek: string; niveau: 'beginner' | 'gevorderd' | 'expert'; data: Record<string, any> }
export interface RitmeOpties {
  periode: 'dag' | 'week'
  /** De dagen om naar belblokken en kansen te kijken (werkdagen, vanaf vandaag). */
  dagen: string[]
  /** De periode voor campagnes en accountplannen: tot (niet met) deze dag; over tijd telt mee. */
  tot: string
  kan: (sleutel: string) => boolean
  /** Het voorgestelde belblok op het beste uur voor een dag zonder belblok (uit planBron). */
  voorstelVoor?: (dag: string) => Promise<BelblokDagVoorstel[]>
}

export async function laadRitmeBlokken(tx: Tx, g: RitmeGebruiker, nu: Date, o: RitmeOpties): Promise<RitmeBlokken> {
  const mag = (k: keyof typeof RITME_BLOK_FUNCTIE) => o.kan(RITME_BLOK_FUNCTIE[k])
  const vandaag = nlMoment(nu).datum
  const totT = nlTijdstip(o.tot, 0).toISOString()
  const dagen = [...o.dagen].sort()
  const vanT = dagen.length ? nlTijdstip(dagen[0]!, 0).toISOString() : totT
  const eindDagenT = dagen.length ? nlTijdstip(plusDagen(dagen[dagen.length - 1]!, 1), 0).toISOString() : totT

  // Afspraken in de dagen: wie je spreekt, bel je niet tussendoor en komt niet in een belblok van die dag.
  const afs = dagen.length ? await rijen(tx, sql`select ap.id, ap.start_at, ap.end_at, ap.vorm, ap.account_id, ap.data->>'titel' as eigen_titel, m.naam as soort, a.name from appointments ap
    join meetingsoorten m on m.id = ap.meetingsoort_id left join accounts a on a.id = ap.account_id
    where ap.owner_id = ${g.id} and ap.status in ('gepland', 'afgerond') and ap.start_at >= ${vanT} and ap.start_at < ${eindDagenT} order by ap.start_at`) : []
  const afspraken: RitmeAfspraak[] = afs.map((a) => ({ id: a.id, start: iso(a.start_at)!, eind: iso(a.end_at)!, titel: (a.eigen_titel || (a.name ? `${a.soort} ${a.name}` : a.soort)) as string, vorm: a.vorm, accountId: a.account_id ?? null, accountNaam: a.name ?? null }))
  const bezetPerDag = new Map<string, Set<string>>()
  for (const a of afspraken) if (a.accountId) {
    const d = nlMoment(new Date(a.start)).datum
    bezetPerDag.set(d, (bezetPerDag.get(d) ?? new Set()).add(a.accountId))
  }
  const kandidaten = mag('belblokken') || mag('belprioriteit') ? await laadBelKandidaten(tx, g.id) : []

  // 1. Lege belblokken en een voorstel op het beste uur als er geen belblok is.
  let belblokken: RitmeBlokken['belblokken'] = null
  if (mag('belblokken')) {
    const ses = dagen.length ? await rijen(tx, sql`select id, start_op, eind_op, status, data->>'soort' as soort, data->>'verhouding' as verhouding from belblok_sessies
      where gebruiker_id = ${g.id} and start_op >= ${vanT} and start_op < ${eindDagenT} and status <> 'geannuleerd' order by start_op`) : []
    const inBlok = ses.length ? await rijen(tx, sql`select t.belblok_id, t.priority, coalesce(a.score, 0) as score from tasks t left join accounts a on a.id = t.account_id where t.belblok_id = any(string_to_array(${lijst(ses.map((s) => s.id))}, ','))`) : []
    // Wie al in een belblok staat (ook met een tweede beltaak), komt niet in het voorstel.
    const inEenBlok = new Set(kandidaten.filter((k) => k.belblokId).map((k) => k.accountId))
    const pool = bouwBellijst(kandidaten.filter((k) => !k.belblokId && !inEenBlok.has(k.accountId)), nu)
    const blokken = vulVoorstellen(ses.map((s) => ({
      id: s.id, start: iso(s.start_op)!, eind: iso(s.eind_op)!, status: s.status, soort: (['koud', 'opvolging', 'gemengd'].includes(s.soort) ? s.soort : null) as BlokSoort | null,
      verhouding: s.verhouding != null && Number.isFinite(Number(s.verhouding)) ? Number(s.verhouding) : null,
      duren: inBlok.filter((t) => t.belblok_id === s.id).map((t) => schatDuur({ prioriteit: t.priority === 'urgent' ? 'urgent' : 'middel', score: Number(t.score) })),
    })), pool, nu, bezetPerDag)
    const voorstellen: BelblokDagVoorstel[] = []
    if (o.voorstelVoor) {
      for (const d of dagen) {
        if (ses.some((s) => nlMoment(new Date(iso(s.start_op)!)).datum === d)) continue
        voorstellen.push(...(await o.voorstelVoor(d)).filter((v) => Date.parse(v.eind) > nu.getTime()))
      }
    }
    belblokken = { blokken, voorstellen, totaal: ses.length }
  }

  // 2. Belprioriteit naast je afspraken: dezelfde lijst als op Bezoeken, zonder wie je in deze periode spreekt.
  let belprioriteit: RitmeBlokken['belprioriteit'] = null
  if (mag('belprioriteit')) {
    const zonder = new Set(afspraken.map((a) => a.accountId).filter(Boolean) as string[])
    const top = bellijstNaastBezoeken(bouwBellijst(kandidaten, nu, { top: 30 }), zonder, 5)
    belprioriteit = {
      afspraken,
      lijst: top.map((k) => ({ accountId: k.accountId, accountNaam: k.accountNaam, contactNaam: k.contactNaam ?? null, telefoon: k.telefoon ?? null, reden: k.reden, score: k.score, heet: !!k.heet, taskId: k.taskId ?? null, inBelblok: !!k.belblokId })),
    }
  }

  // 3. Kansen langs de route: per dag met bezoeken, eigen prospects (bezoekDag van Bezoeken).
  let kansen: RitmeBlokken['kansen'] = null
  if (mag('kansen')) {
    const alle = o.kan('bezoeken.kansenAlle')
    const uit: NonNullable<RitmeBlokken['kansen']>['dagen'] = []
    for (const d of dagen) {
      const bezoeken = afspraken.filter((a) => a.vorm === 'bezoek' && nlMoment(new Date(a.start)).datum === d).length
      if (!bezoeken) continue
      let l: any[] = []
      try {
        const b = await bezoekDag(tx, { id: g.id, naam: g.naam, werkplek: g.werkplek, data: g.data, niveau: g.niveau }, d, { alleenMijn: true, alleenProspects: true, maxOmrij: 20, aantal: alle ? 5 : 3, ongepland: false }, nu, { bellijst: false, teplannen: false, kansenAlle: alle })
        l = b.kansen
      } catch { l = [] }
      uit.push({ datum: d, bezoeken, kansen: l.map((k: any) => ({ accountId: k.id, naam: k.naam, omrij: Math.round(k.omrij ?? 0), score: Math.round(k.score ?? 0), reden: k.bronnen?.[0]?.label ?? null, taakId: k.taakId ?? null, momentStart: k.momentStart ?? null })) })
    }
    kansen = { dagen: uit }
  }

  // 4. Lopende campagnes waar je aan meedoet: je kaarten en wat aan de beurt is.
  let campagnes: RitmeBlokken['campagnes'] = null
  if (mag('campagnes')) {
    const cs = (await campagneLijst(tx, { eigenaar: g.id }, nu)).campagnes.filter((c) => c.status === 'actief')
    const ids = cs.map((c) => c.id)
    const items = ids.length ? await rijen(tx, sql`select campagne_id, kolom from campagne_items where eigenaar_id = ${g.id} and campagne_id = any(string_to_array(${lijst(ids)}, ','))`) : []
    const taken = ids.length ? await rijen(tx, sql`select t.id, t.title, t.due_date, t.campaign_id, a.name from tasks t left join accounts a on a.id = t.account_id
      where t.owner_id = ${g.id} and t.campaign_id = any(string_to_array(${lijst(ids)}, ',')) and t.status in ('open', 'bezig') and t.due_date < ${totT} order by t.due_date`) : []
    const vandaagT = nlTijdstip(vandaag, 0).getTime()
    campagnes = {
      lopend: cs.map((c) => {
        const mijn = items.filter((i) => i.campagne_id === c.id)
        const t = taken.filter((x) => x.campaign_id === c.id)
        return {
          id: c.id, naam: c.naam, eindOp: c.eindOp, dagenOver: c.dagenOver, tempo: c.tempo ? { voortgang: c.tempo.voortgang, verwacht: c.tempo.verwacht, pil: c.tempo.pil } : null,
          kaarten: { gedaan: mijn.filter((i) => EIND.includes(i.kolom)).length, totaal: mijn.length }, aanDeBeurt: t.length,
          taken: t.slice(0, 3).map((x) => ({ id: x.id, titel: x.title, accountNaam: x.name ?? null, due: iso(x.due_date), teLaat: Date.parse(iso(x.due_date)!) < vandaagT })),
        }
      }).sort((a, b) => b.aanDeBeurt - a.aanDeBeurt || a.naam.localeCompare(b.naam, 'nl')),
    }
  }

  // 5. Lopende accountplannen van jezelf: open acties in de periode en de voortgang.
  let accountplannen: RitmeBlokken['accountplannen'] = null
  if (mag('accountplannen')) {
    const ps = (await rijen(tx, sql`select p.id, p.titel, p.status, p.geldig_tot::text as geldig_tot, p.account_id, a.name from accountplannen p join accounts a on a.id = p.account_id where p.owner_id = ${g.id} order by p.geldig_tot nulls last, a.name`))
      .filter((p) => weergaveStatus({ status: p.status, geldigTot: p.geldig_tot ?? null }, vandaag) === 'actueel')
    const acties = ps.length ? await rijen(tx, sql`select id, accountplan_id, title, status, due_date from tasks where accountplan_id = any(string_to_array(${lijst(ps.map((p) => p.id))}, ',')) and status <> 'geannuleerd' order by due_date nulls last`) : []
    const vandaagT = nlTijdstip(vandaag, 0).getTime()
    accountplannen = {
      lopend: ps.map((p) => {
        const a = acties.filter((x) => x.accountplan_id === p.id)
        const open = a.filter((x) => ['open', 'bezig'].includes(x.status))
        const nu2 = open.filter((x) => x.due_date && Date.parse(iso(x.due_date)!) < Date.parse(totT))
        const later = open.find((x) => !nu2.includes(x))
        return {
          id: p.id, titel: p.titel, accountId: p.account_id, accountNaam: p.name, geldigTot: p.geldig_tot ?? null,
          voortgang: voortgang(a as { status: string }[]), open: nu2.length,
          acties: nu2.slice(0, 3).map((x) => ({ id: x.id, titel: x.title, due: iso(x.due_date), teLaat: Date.parse(iso(x.due_date)!) < vandaagT })),
          volgende: later ? { id: later.id, titel: later.title, due: iso(later.due_date) } : null,
        }
      }).sort((a, b) => b.open - a.open || a.accountNaam.localeCompare(b.accountNaam, 'nl')),
    }
  }

  return { periode: o.periode, belblokken, belprioriteit, kansen, campagnes, accountplannen }
}
