// De stand per kaart op Instellingen (F22). Per link van een kaart: wie hem mag zien (dezelfde regel als
// het scherm) en een regel in woorden. Een kaart die de kijker niet mag zien, krijgt geen stand; een
// telling die mislukt, ook niet (de kaart toont dan alleen zijn vaste tekst).
import { sql } from 'drizzle-orm'
import { AGENTS } from '../../shared/mandaat'
import { NIVEAU_LABEL, PAKKET_LABEL, type Niveau, type Pakket } from '../../shared/types'
import { NIET_INGERICHT, aantal, koppelingenTekst, vanTotaal, zin, type KoppelingStand } from '../../shared/instellingenStand'
import { kan } from './accounts'
import { laadAgentStand } from './agents/bewaker'
import { stand as creditsStand } from './credits'
import { gebruikDb, metOrganisatie } from './db'
import type { Context } from './sessie'
import { ledenVan, zichtbareTeams } from './team'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]
type Ctx = Context & { organisatie: NonNullable<Context['organisatie']> }
const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']

async function een<T = any>(tx: Tx, q: ReturnType<typeof sql>): Promise<T> {
  return ((await tx.execute(q)).rows[0] ?? {}) as T
}
async function instelling<T = any>(tx: Tx, key: string): Promise<T | null> {
  return ((await een<{ value?: T }>(tx, sql`select value from org_settings where key = ${key}`)).value ?? null) as T | null
}

/** De koppelingen die de groep Koppelingen telt (alleen wat de kijker ziet). */
async function koppelingen(tx: Tx, ctx: Ctx): Promise<KoppelingStand[]> {
  const rijen = (await tx.execute(sql`select soort, status from koppelingen`)).rows as { soort: string; status: string }[]
  const actief = (s: string | string[]) => rijen.some((r) => (Array.isArray(s) ? s.includes(r.soort) : r.soort === s) && r.status === 'actief')
  const beheerder = ctx.gebruiker.rol === 'beheerder'
  const lijst: (KoppelingStand & { toon: boolean })[] = [
    { sleutel: 'salesdna', naam: 'SalesDNA', actief: actief('salesdna'), toon: kan(ctx, 'koppeling.salesdna') },
    { sleutel: 'agenda', naam: 'Agenda', actief: !!(await instelling<{ aan?: boolean }>(tx, 'agendaKoppeling'))?.aan, toon: beheerder },
    { sleutel: 'mail', naam: 'Mail', actief: actief('mail'), toon: kan(ctx, 'koppeling.mail') },
    { sleutel: 'crm', naam: 'CRM', actief: actief(['hubspot', 'salesforce', 'dynamics', 'pipedrive', 'afas']), toon: kan(ctx, 'koppeling.crm') || kan(ctx, 'koppeling.crmSync') },
    { sleutel: 'kvk', naam: 'KVK', actief: actief('kvk'), toon: beheerder },
    { sleutel: 'datacollectief', naam: 'Datacollectief', actief: actief('datacollectief'), toon: beheerder },
    { sleutel: 'dealdrive', naam: 'DealDrive', actief: actief('dealdrive'), toon: kan(ctx, 'koppelingen.dealdrive') },
  ]
  return lijst.filter((k) => k.toon).map(({ toon: _t, ...k }) => k)
}

interface Kaart { mag: (ctx: Ctx) => boolean; stand: (tx: Tx, ctx: Ctx) => Promise<string | null> }
const isBeheerder = (ctx: Ctx) => ctx.gebruiker.rol === 'beheerder'
const functie = (...s: string[]) => (ctx: Ctx) => s.some((x) => kan(ctx, x))
const ofBeheerder = (...s: string[]) => (ctx: Ctx) => isBeheerder(ctx) || functie(...s)(ctx)

async function terugkomregels(tx: Tx) {
  const t = await een<{ n: number }>(tx, sql`select count(*)::int as n from vv_terugkomregels where actief`)
  return aantal(t.n, 'terugkomregel', 'terugkomregels', 'Nog geen terugkomregels')
}

export const KAARTEN: Record<string, Kaart> = {
  '/instellingen/organisatie': {
    mag: isBeheerder,
    stand: async (tx) => {
      const o = await instelling<{ naam?: string; verkoopjaarStartmaand?: number }>(tx, 'organisatie')
      if (!o?.naam) return NIET_INGERICHT
      return zin(o.naam, o.verkoopjaarStartmaand ? `verkoopjaar vanaf ${MAANDEN[o.verkoopjaarStartmaand - 1]}` : null)
    },
  },
  '/instellingen/organisatie#werkdagen': {
    mag: isBeheerder,
    stand: async (tx) => {
      const w = await instelling<{ werkdagen?: number[] }>(tx, 'werkdagen')
      return w?.werkdagen ? aantal(w.werkdagen.length, 'werkdag per week', 'werkdagen per week') : 'Maandag tot en met vrijdag (standaard)'
    },
  },
  '/instellingen/abonnement': {
    mag: isBeheerder,
    stand: async (tx, ctx) => {
      const o = await een<{ pakket: Pakket; contract: any }>(tx, sql`select pakket, contract from organisations where id = ${ctx.organisatie.id}`)
      const g = await een<{ n: number }>(tx, sql`select count(*)::int as n from users where status <> 'gearchiveerd' and role <> 'founder'`)
      const seats = Number(o.contract?.seats ?? 0)
      return zin(`Pakket ${PAKKET_LABEL[o.pakket] ?? o.pakket}`, seats ? `${g.n} van ${seats} seats in gebruik` : aantal(g.n, 'gebruiker', 'gebruikers'))
    },
  },
  '/instellingen/audit': {
    mag: functie('instellingen.audit'),
    stand: async (tx) => {
      const t = await een<{ n: number }>(tx, sql`select count(*)::int as n from audit_events where occurred_at >= now() - interval '7 days'`)
      return aantal(t.n, 'wijziging', 'wijzigingen', 'Geen wijzigingen') + ' in de laatste 7 dagen'
    },
  },
  '/instellingen/gebruikers': {
    mag: () => true,
    stand: async (tx, ctx) => {
      if (!isBeheerder(ctx)) {
        const teams = await zichtbareTeams(tx, { id: ctx.gebruiker.id, rol: ctx.gebruiker.rol })
        const leden = await ledenVan(tx, teams.map((t) => t.id))
        return teams.length ? `${aantal(leden.length, 'persoon', 'mensen')} in ${aantal(teams.length, 'team', 'teams')}` : 'Je hebt nog geen team'
      }
      const t = await een<{ g: number; t: number }>(tx, sql`select (select count(*)::int from users where status = 'actief' and role <> 'founder') as g, (select count(*)::int from teams) as t`)
      return zin(aantal(t.g, 'actieve gebruiker', 'actieve gebruikers'), t.t ? `${aantal(t.t, 'team', 'teams')}` : 'nog geen teams')
    },
  },
  '/instellingen/niveaus': {
    mag: isBeheerder,
    stand: async (tx) => {
      const n = await instelling<{ iedereenAlles?: boolean; standaardNiveauNieuweGebruiker?: Niveau }>(tx, 'niveaus')
      return zin(`Nieuwe gebruikers starten als ${NIVEAU_LABEL[n?.standaardNiveauNieuweGebruiker ?? 'beginner'] ?? 'Beginner'}`, n?.iedereenAlles ? 'iedereen ziet alles' : null)
    },
  },
  '/instellingen/regels': {
    mag: () => true,
    stand: async (tx) => {
      const t = await een<{ n: number; motor: number }>(tx, sql`select count(*)::int as n, count(*) filter (where actief)::int as motor from activity_rules where eigenaar_id is null`)
      return t.n ? zin(aantal(t.n, 'regel', 'regels'), t.motor === t.n ? 'alle aan' : `${t.motor} aan`) : 'Nog geen regels'
    },
  },
  '/instellingen/ritme': {
    mag: () => true,
    stand: async (tx) => {
      const k = await instelling<unknown[]>(tx, 'klassen')
      return Array.isArray(k) && k.length ? aantal(k.length, 'klasse', 'klassen') : NIET_INGERICHT
    },
  },
  '/planning?tab=ritme': {
    mag: functie('ritme.beheer'),
    stand: async (tx) => {
      const t = await een<{ n: number }>(tx, sql`select count(*)::int as n from hercontactritmes where status = 'actief'`)
      return aantal(t.n, 'actief ritme', 'actieve ritmes', 'Nog geen hercontactritmes')
    },
  },
  '/instellingen/verkoopverhaal': {
    mag: functie('verkoopverhaal.inrichten'),
    stand: async (tx) => {
      const t = await een<{ b: number; s: number }>(tx, sql`select count(*) filter (where status = 'bevestigd')::int as b, count(*) filter (where bron = 'salesdna')::int as s from vv_sublagen`)
      return t.b ? zin(`${t.b} van 8 onderdelen bevestigd`, t.s ? `${t.s} uit SalesDNA` : null) : NIET_INGERICHT
    },
  },
  '/instellingen/terugkomen': { mag: ofBeheerder('verkoopverhaal.inrichten'), stand: terugkomregels },
  '/instellingen/nee-redenen': { mag: isBeheerder, stand: terugkomregels },
  '/instellingen/gebieden': {
    mag: functie('instellingen.gebieden'),
    stand: async (tx) => {
      const g = await instelling<{ dagen?: unknown[] }[]>(tx, 'gebieden')
      if (!Array.isArray(g) || !g.length) return NIET_INGERICHT
      return zin(aantal(g.length, 'regio', "regio's"), aantal(g.reduce((n, r) => n + (r.dagen?.length ?? 0), 0), 'regiodag', 'regiodagen per week', 'nog geen regiodagen'))
    },
  },
  '/instellingen/mail': {
    mag: functie('koppeling.mail'),
    stand: async (tx) => ((await een<{ status?: string }>(tx, sql`select status from koppelingen where soort = 'mail'`)).status === 'actief' ? 'Gekoppeld' : NIET_INGERICHT),
  },
  '/instellingen/mailsjablonen': {
    mag: functie('instellingen.mailsjablonen'),
    stand: async (tx) => {
      const t = await een<{ n: number; a: number }>(tx, sql`select count(*)::int as n, count(*) filter (where actief)::int as a from mailsjablonen`)
      return vanTotaal(t.a, t.n, 'sjablonen', 'aan', 'Nog geen sjablonen')
    },
  },
  '/instellingen/opvolgreeksen': {
    mag: functie('instellingen.opvolgreeksen'),
    stand: async (tx) => {
      const t = await een<{ n: number; a: number }>(tx, sql`select count(*)::int as n, count(*) filter (where actief)::int as a from reekssjablonen`)
      return vanTotaal(t.a, t.n, 'sjablonen', 'aan', 'Nog geen sjablonen')
    },
  },
  '/instellingen/funnel-normen': {
    mag: functie('instellingen.funnelNormen'),
    stand: async (tx) => {
      const n = await instelling<Record<string, unknown>>(tx, 'funnelNormen')
      return n && Object.keys(n).length ? `Eigen normen voor ${aantal(Object.keys(n).length, 'fase', 'fasen')}` : 'De standaardnormen van Dealtrace'
    },
  },
  '/instellingen/campagnesoorten': {
    mag: functie('instellingen.campagnesoorten'),
    stand: async (tx) => {
      const t = await een<{ n: number; a: number }>(tx, sql`select count(*)::int as n, count(*) filter (where actief)::int as a from campagnesoorten`)
      return vanTotaal(t.a, t.n, 'soorten', 'aan')
    },
  },
  '/instellingen/meetingsoorten': {
    mag: functie('instellingen.meetingsoorten'),
    stand: async (tx) => {
      const t = await een<{ n: number; a: number }>(tx, sql`select count(*)::int as n, count(*) filter (where actief)::int as a from meetingsoorten`)
      return vanTotaal(t.a, t.n, 'soorten', 'aan')
    },
  },
  '/belscripts': {
    mag: () => true,
    stand: async (tx) => {
      const t = await een<{ a: number; c: number }>(tx, sql`select count(*) filter (where status = 'actief')::int as a, count(*) filter (where status = 'concept')::int as c from belscripts where not is_persoonlijk`)
      return t.a || t.c ? zin(aantal(t.a, 'actief script', 'actieve scripts'), t.c ? aantal(t.c, 'concept', 'concepten') : null) : 'Nog geen belscripts'
    },
  },
  '/instellingen/belscripts': {
    mag: () => true,
    stand: async (tx) => {
      const t = await een<{ n: number }>(tx, sql`select count(*)::int as n from belscripts where status <> 'gearchiveerd'`)
      return aantal(t.n, 'script', 'scripts', 'Nog geen belscripts')
    },
  },
  '/instellingen/eigen-velden': {
    mag: isBeheerder,
    stand: async (tx) => aantal((await een<{ n: number }>(tx, sql`select count(*)::int as n from eigen_velden where not gearchiveerd`)).n, 'eigen veld', 'eigen velden', 'Nog geen eigen velden'),
  },
  '/reizen': {
    mag: isBeheerder,
    stand: async (tx) => {
      const t = await een<{ r: number; d: number }>(tx, sql`select (select count(*)::int from reistemplates where status = 'actief') as r, (select count(*)::int from doelgroepen where status <> 'gearchiveerd') as d`)
      return t.r || t.d ? zin(aantal(t.r, 'actieve reis', 'actieve reizen'), aantal(t.d, 'doelgroep', 'doelgroepen')) : NIET_INGERICHT
    },
  },
  '/instellingen/kanalen': {
    mag: functie('instellingen.kanalen'),
    stand: async (tx) => aantal((await een<{ n: number }>(tx, sql`select count(*)::int as n from bel_me_niet`)).n, 'nummer', 'nummers', 'Nog geen nummers') + ' op de bel-me-niet-lijst',
  },
  '/instellingen/prompts': {
    mag: functie('instellingen.prompts'),
    stand: async (tx, ctx) => {
      const t = await een<{ n: number }>(tx, sql`select count(distinct slot)::int as n from prompt_versies where laag = 'organisatie' and organisation_id = ${ctx.organisatie.id}`)
      return t.n ? `Eigen laag op ${aantal(t.n, 'slot', 'slots')}` : 'Alleen de prompts van Dealtrace'
    },
  },
  '/instellingen/verbruik': {
    mag: functie('credits.verbruikLezen'),
    stand: async (tx, ctx) => {
      const s = await creditsStand(tx, ctx.organisatie.id)
      return `${s.verbruikt.toLocaleString('nl-NL')} van ${s.pot.toLocaleString('nl-NL')} credits gebruikt deze maand`
    },
  },
  '/instellingen/agents': {
    mag: ofBeheerder('agents.lezen'),
    stand: async (tx, ctx) => {
      const st = await laadAgentStand(tx, ctx.organisatie.id)
      const gebouwd = AGENTS.filter((a) => a.gebouwd)
      const aan = gebouwd.filter((a) => st.mandaten[a.sleutel]?.aan !== false).length
      return zin(`${aan} van ${gebouwd.length} agents aan`, st.pauze ? 'alle agents gepauzeerd' : null)
    },
  },
  '/instellingen/waarnemer': {
    mag: functie('agents.lezen'),
    stand: async (tx) => aantal((await een<{ n: number }>(tx, sql`select count(*)::int as n from waarnemer_profielen`)).n, 'doelgroep met signaalregels', 'doelgroepen met signaalregels', NIET_INGERICHT),
  },
  '/instellingen/koppelingen/salesdna': {
    mag: functie('koppeling.salesdna'),
    stand: async (tx) => ((await een<{ status?: string }>(tx, sql`select status from koppelingen where soort = 'salesdna'`)).status === 'actief' ? 'Gekoppeld' : 'Nog niet gekoppeld'),
  },
  '/instellingen/koppelingen/agenda': {
    mag: isBeheerder,
    stand: async (tx) => {
      if (!(await instelling<{ aan?: boolean }>(tx, 'agendaKoppeling'))?.aan) return 'Staat uit voor de organisatie'
      const t = await een<{ n: number }>(tx, sql`select count(distinct gebruiker_id)::int as n from agenda_koppelingen where status = 'actief'`)
      return `Aan, ${aantal(t.n, 'gebruiker', 'gebruikers')} gekoppeld`
    },
  },
  '/instellingen/koppelingen/crm': {
    mag: functie('koppeling.crm', 'koppeling.crmSync'),
    stand: async (tx) => {
      const r = await een<{ soort?: string }>(tx, sql`select soort from koppelingen where soort in ('hubspot', 'salesforce', 'dynamics', 'pipedrive', 'afas') and status = 'actief' limit 1`)
      return r.soort ? `${r.soort === 'hubspot' ? 'HubSpot' : r.soort} gekoppeld` : 'Nog niet gekoppeld'
    },
  },
  '/leadgenerator?tab=koppelingen': {
    mag: isBeheerder,
    stand: async (tx, ctx) => {
      const k = (await koppelingen(tx, ctx)).filter((x) => x.sleutel === 'kvk' || x.sleutel === 'datacollectief')
      return vanTotaal(k.filter((x) => x.actief).length, k.length, 'bronnen', 'actief')
    },
  },
  '/instellingen/koppelingen/dealdrive': {
    mag: functie('koppelingen.dealdrive'),
    stand: async (tx) => ((await een<{ status?: string }>(tx, sql`select status from koppelingen where soort = 'dealdrive'`)).status === 'actief' ? 'Actief' : 'Nog niet gekoppeld'),
  },
}

/** De stand van alle kaarten die de kijker mag zien, plus de samenvatting van de koppelingen. */
export async function instellingenOverzicht(ctx: Ctx) {
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const stand: Record<string, string> = {}
    for (const [link, k] of Object.entries(KAARTEN)) {
      if (!k.mag(ctx)) continue
      try {
        // Een savepoint per kaart: een fout in één telling breekt de transactie van de rest niet.
        const s = await tx.transaction(async (sp) => k.stand(sp as unknown as Tx, ctx))
        if (s) stand[link] = s
      } catch { /* geen stand: de kaart toont zijn vaste tekst */ }
    }
    const k = await koppelingen(tx, ctx)
    return { stand, groepen: k.length ? { Koppelingen: koppelingenTekst(k) } : {} }
  })
}
