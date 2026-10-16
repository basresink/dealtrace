// De Waarnemer (P19, F14, mandaat A): zoekt per doelgroep naar vacatures, nieuws en websitewijzigingen
// en maakt er een inzicht met bewijs van. Tool-use met schema (gat 19); een citaat moet in het materiaal
// staan en een URL in de zoekresultaten; te oude bronnen vervallen. Hooguit 25 accounts per regel per
// run, minimaal wekelijks per account. Ook concurrentnamen uit het verkoopverhaal (F25).
// Extra bronnen: de URL's die de gebruiker bij een account (data.volgBronnen, soort url) of een contact
// (data.extraBronnen) zette, leest de Waarnemer in dezelfde ronde via webBron. Een pagina die sinds de vorige
// ronde niet veranderde, kost geen AI-aanroep; een nieuwe of gewijzigde pagina wordt een inzicht met herkomst
// "Extra bron: <label>" (bij een contact ook op de contactkaart).
import { sql } from 'drizzle-orm'
import { PROFIEL_STANDAARD, selecteerAccounts, SIGNAALSOORT_LABEL, type ProfielRegel, type WaarnemerProfiel } from '../../../shared/agents'
import { magTaakVoorstel, ouderdomStatus, valideerBewijs, vindConcurrenten, type BronSoort } from '../../../shared/bewijs'
import type { JsonSchema } from '../../../shared/aiStap'
import { gebruikDb } from '../db'
import { voerAiStapUit } from '../llm-provider'
import { leesStand } from '../vvProjectie'
import { bewaarInzicht } from '../inzichtOpslag'
import { haalVolgbron, vingerafdruk, type VolgbronPagina } from '../webBron'
import { extraBronnenUit, type ExtraBron } from '../extraBronnen'
import { logAgentRun, toets } from './bewaker'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]

export interface Vondst { url: string; titel: string; fragment: string; datum: string | null; tekst: string }
export type Zoeker = (account: { id: string; naam: string; domein?: string | null }, regel: ProfielRegel, nu: Date) => Promise<Vondst[]>
export type BronLezer = (url: string, nu: Date) => Promise<VolgbronPagina | null>
/** De minimale relevantie voor een inzicht uit een extra bron (de gebruiker koos de bron zelf). */
export const MIN_RELEVANTIE_EXTRA_BRON = 50

const slug = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const hash = (t: string) => [...t].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 7)
/** De mock: een vacature of nieuwsbericht bij een deel van de accounts, deterministisch op naam. */
export const mockZoeker: Zoeker = async (a, regel, nu) => {
  const h = hash(`${a.id}:${regel.soort}`)
  if (h % 3 !== 0) return []
  const dagen = h % 20
  const datum = new Date(nu.getTime() - dagen * 864e5).toISOString().slice(0, 10)
  if (regel.soort === 'vacature') {
    const functie = regel.trefwoorden[h % Math.max(1, regel.trefwoorden.length)] ?? 'servicemonteur'
    const url = `https://werkenbij.${slug(a.naam)}.test/vacatures/${slug(functie)}`
    return [{ url, titel: `Vacature ${functie} bij ${a.naam}`, fragment: `${a.naam} zoekt een ${functie}.`, datum, tekst: `${a.naam} zoekt een ${functie} voor de groeiende installatieafdeling. Geplaatst op ${datum}. Je werkt aan nieuwbouwprojecten in de regio.` }]
  }
  if (regel.soort === 'nieuws') {
    const url = `https://nieuws.regio.test/${slug(a.naam)}-breidt-uit`
    return [{ url, titel: `${a.naam} breidt uit`, fragment: `${a.naam} start een nieuwbouwproject.`, datum, tekst: `${a.naam} start in 2027 een nieuwbouwproject van 120 woningen. Het materiaal komt nu nog via Online webgroothandel. Gepubliceerd op ${datum}.` }]
  }
  return []
}

export const WAARNEMER_SCHEMA: JsonSchema = {
  type: 'object', required: ['titel', 'beschrijving', 'relevantie', 'zekerheid', 'evidence'], additionalProperties: false,
  properties: {
    titel: { type: 'string', maxLength: 140 }, beschrijving: { type: 'string', maxLength: 600 }, relevantie: { type: 'number' }, zekerheid: { type: 'number' },
    evidence: { type: 'array', minItems: 1, items: { type: 'object', required: ['citaat', 'bron'], additionalProperties: false, properties: { citaat: { type: 'string', maxLength: 400 }, bron: { type: 'string', maxLength: 140 }, datum: { type: 'string' }, url: { type: 'string' } } } },
    winpuntVoorstel: { type: 'string' }, taakVoorstel: { type: 'string', maxLength: 140 },
  },
}

/** Een run van de Waarnemer voor de organisatie (motor of weekjob). */
export async function draaiWaarnemer(tx: Tx, org: string, nu = new Date(), opties: { accountIds?: string[]; zoeker?: Zoeker; bronLezer?: BronLezer } = {}) {
  const zoeker = opties.zoeker ?? mockZoeker
  const uit = { bekeken: 0, inzichten: 0, tegengehouden: 0, gestopt: null as string | null, extraBronnen: 0 }
  // De Bewaker vooraf: gepauzeerd, uit of onder 10 procent van de pot betekent geen run.
  const t = await toets(tx, org, { agent: 'waarnemer', handeling: 'run', ai: 'webonderzoek' }, nu)
  if (!t.mag) return { ...uit, gestopt: t.reden ?? 'Tegengehouden door de Bewaker' }
  const profielen = await rijen(tx, sql`select doelgroep_id, data from waarnemer_profielen`)
  const profielVoor = (d: string | null): WaarnemerProfiel => (profielen.find((p) => p.doelgroep_id === d)?.data ?? profielen.find((p) => p.doelgroep_id == null)?.data ?? PROFIEL_STANDAARD) as WaarnemerProfiel
  const accounts = await rijen(tx, sql`select a.id, a.name, a.domein, a.owner_id, a.doelgroep_id, a.data->'waarnemer' as w, a.data->'volgBronnen' as volg from accounts a
    where a.account_kind = 'prospect' and a.owner_id is not null and a.nb_status not in ('overgedragen') ${opties.accountIds?.length ? sql`and a.id = any(string_to_array(${opties.accountIds.join(',')}, ','))` : sql``}`)
  const stand = await leesStand(tx)
  const concurrenten = (stand.concurrenten ?? []).map((c: any) => ({ id: c.id, naam: c.naam }))
  const groepen = new Map<string | null, Rij[]>()
  for (const a of accounts) groepen.set(a.doelgroep_id ?? null, [...(groepen.get(a.doelgroep_id ?? null) ?? []), a])
  for (const [doelgroep, lijst] of groepen) {
    const p = profielVoor(doelgroep)
    for (const regel of p.signaalsoorten.filter((r) => r.aan && ['vacature', 'nieuws', 'website'].includes(r.soort))) {
      const kandidaten = selecteerAccounts(lijst.map((a) => ({ ...a, id: a.id as string, laatstBekeken: (a.w?.[regel.soort] ?? null) as string | null })) as (Rij & { id: string; laatstBekeken: string | null })[], p.cadansDagen, nu)
      for (const a of kandidaten) {
        uit.bekeken++
        await tx.execute(sql`update accounts set data = jsonb_set(data, '{waarnemer}', coalesce(data->'waarnemer', '{}'::jsonb) || ${JSON.stringify({ [regel.soort]: nu.toISOString() })}::jsonb) where id = ${a.id}`)
        const vondsten = await zoeker({ id: a.id, naam: a.name, domein: a.domein }, regel, nu)
        if (!vondsten.length) continue
        const materiaalTekst = vondsten.map((v) => `${v.titel}\n${v.fragment}\n${v.tekst}`).join('\n\n')
        const r = await voerAiStapUit<any>(tx, org, {
          soort: 'webonderzoek', agent: 'waarnemer', accountId: a.id, schema: WAARNEMER_SCHEMA,
          prompt: `Beoordeel of dit een aanleiding is om contact op te nemen (${SIGNAALSOORT_LABEL[regel.soort]}). Citeer letterlijk uit het materiaal en noem alleen URL's uit de zoekresultaten. Relevantie en zekerheid van 0 tot 100.`,
          materiaal: { waarnemer: true, soort: regel.soort, account: a.name, vondsten, winpunten: (stand.winpunten ?? []).filter((w: any) => w.actief).map((w: any) => ({ id: w.id, titel: w.titel })), winpuntId: regel.winpuntId ?? null },
        }, nu)
        if (!r.ok) {
          if (/credits|plafond|Bewaker|10 procent/i.test(r.reden ?? '')) { uit.gestopt = r.reden ?? 'Gestopt'; break }
          continue
        }
        const o = r.antwoord
        const bron = vondsten.find((v) => o.evidence?.some((e: any) => e.url && e.url.replace(/\/$/, '') === v.url.replace(/\/$/, ''))) ?? vondsten[0]!
        const bronSoort = regel.soort as BronSoort
        const geldig = valideerBewijs(o, materiaalTekst, vondsten.map((v) => v.url))
        const oud = ouderdomStatus(bronSoort, bron.datum, nu)
        const tegengehouden = !geldig.geldig ? geldig.redenen.join('; ') : oud === 'hard' ? `Te oud: ${SIGNAALSOORT_LABEL[regel.soort].toLowerCase()} ouder dan ${bronSoort === 'vacature' ? 120 : bronSoort === 'nieuws' ? 365 : 90} dagen` : o.relevantie < regel.minRelevantie ? `Onder de minimale relevantie van ${regel.minRelevantie}` : null
        const taak = magTaakVoorstel({ zekerheid: o.zekerheid, bronSoort, bronDatum: bron.datum }, nu) ? o.taakVoorstel ?? `Bel ${a.name} over ${SIGNAALSOORT_LABEL[regel.soort].toLowerCase()}` : null
        const ins = await bewaarInzicht(tx, org, {
          accountId: a.id, ownerId: a.owner_id, agent: 'waarnemer', type: regel.soort, onderwerp: `waarnemer:${regel.soort}:${bron.url}`, title: o.titel, beschrijving: o.beschrijving,
          relevantie: Math.round(o.relevantie), zekerheid: Math.round(o.zekerheid), bron: { soort: regel.soort, naam: `Web: ${SIGNAALSOORT_LABEL[regel.soort].toLowerCase()}`, url: bron.url, datum: bron.datum },
          evidence: o.evidence, winpuntVoorstel: o.winpuntVoorstel ?? regel.winpuntId ?? null, taakVoorstel: taak, tegengehouden,
        })
        if (tegengehouden) uit.tegengehouden++; else if (ins.nieuw) uit.inzichten++
        // Concurrentnamen in de gevonden tekst worden een apart signaal op het account.
        for (const c of vindConcurrenten(materiaalTekst, concurrenten)) {
          await bewaarInzicht(tx, org, { accountId: a.id, ownerId: a.owner_id, agent: 'waarnemer', type: 'concurrent', onderwerp: `concurrent:${c.id}`, title: `${c.naam} genoemd bij ${a.name}`, beschrijving: `In ${bron.titel} wordt ${c.naam} genoemd.`, relevantie: 65, zekerheid: 80, bron: { soort: regel.soort, naam: `Web: ${SIGNAALSOORT_LABEL[regel.soort].toLowerCase()}`, url: bron.url, datum: bron.datum }, evidence: [{ citaat: c.fragment, bron: bron.titel, datum: bron.datum, url: bron.url }] })
        }
        await logAgentRun(tx, org, { agent: 'waarnemer', handeling: tegengehouden ? 'inzicht:tegengehouden' : 'inzicht', mandaat: 'A', uitkomst: tegengehouden ? 'geblokkeerd' : 'uitgevoerd', accountId: a.id, reden: tegengehouden, bronnen: [bron.url] }, nu)
      }
      if (uit.gestopt) break
    }
    if (uit.gestopt) break
  }
  if (!uit.gestopt) await volgExtraBronnen(tx, org, accounts, profielVoor, stand, uit, nu, opties.bronLezer ?? haalVolgbron)
  return uit
}

/** De extra bronnen per account: die van het account zelf en die van zijn contacten (met het contact erbij). */
export function extraBronnenPerAccount(accounts: { id: string; volg?: unknown }[], contacten: { id: string; account_id: string; eb?: unknown }[]) {
  const uit = new Map<string, (ExtraBron & { contactId: string | null })[]>()
  for (const a of accounts) {
    const lijst = extraBronnenUit(a.volg).map((b) => ({ ...b, contactId: null as string | null }))
    for (const c of contacten.filter((x) => x.account_id === a.id && Array.isArray(x.eb))) {
      for (const b of c.eb as any[]) if (typeof b?.url === 'string' && /^https?:\/\//i.test(b.url) && !lijst.some((x) => x.url === b.url && x.contactId === c.id)) lijst.push({ label: String(b.label ?? '').trim() || b.url.replace(/^https?:\/\//i, '').split('/')[0]!, url: b.url, contactId: c.id })
    }
    if (lijst.length) uit.set(a.id, lijst)
  }
  return uit
}

/** Leest de extra bronnen van de accounts in deze ronde (na de toets van de Bewaker in draaiWaarnemer). */
async function volgExtraBronnen(tx: Tx, org: string, accounts: Rij[], profielVoor: (d: string | null) => WaarnemerProfiel, stand: Rij, uit: { bekeken: number; inzichten: number; tegengehouden: number; gestopt: string | null; extraBronnen: number }, nu: Date, lezer: BronLezer) {
  const ids = accounts.map((a) => a.id as string)
  if (!ids.length) return
  const contacten = await rijen(tx, sql`select id, account_id, data->'extraBronnen' as eb from contacts
    where account_id = any(string_to_array(${ids.join(',')}, ',')) and jsonb_typeof(data->'extraBronnen') = 'array' and jsonb_array_length(data->'extraBronnen') > 0`)
  const perAccount = extraBronnenPerAccount(accounts as any, contacten as any)
  const metBronnen = accounts.filter((a) => perAccount.has(a.id))
  const kandidaten = selecteerAccounts(metBronnen.map((a) => ({ ...a, id: a.id as string, laatstBekeken: (a.w?.extraBronnen ?? null) as string | null })), Math.min(...metBronnen.map((a) => profielVoor(a.doelgroep_id ?? null).cadansDagen), 7), nu)
  for (const a of kandidaten) {
    uit.bekeken++
    const vorige = (a.w?.bronVingerafdruk ?? {}) as Record<string, string>
    const nieuw: Record<string, string> = { ...vorige }
    for (const b of perAccount.get(a.id) ?? []) {
      const pagina = await lezer(b.url, nu).catch(() => null)
      if (!pagina?.tekst) continue
      const sleutel = `${b.contactId ?? 'account'}|${b.url}`
      const afdruk = vingerafdruk(pagina.tekst)
      if (vorige[sleutel] === afdruk) continue
      nieuw[sleutel] = afdruk
      uit.extraBronnen++
      const herkomst = `Extra bron: ${b.label}`
      const vondsten: Vondst[] = [{ url: b.url, titel: `${herkomst} (${pagina.titel})`, fragment: pagina.tekst.split(/(?<=\.)\s/)[0] ?? pagina.tekst, datum: pagina.datum, tekst: pagina.tekst }]
      const r = await voerAiStapUit<any>(tx, org, {
        soort: 'webonderzoek', agent: 'waarnemer', accountId: a.id, schema: WAARNEMER_SCHEMA,
        prompt: 'De gebruiker volgt deze pagina als extra bron. Beoordeel of wat er nu staat een aanleiding is om contact op te nemen. Citeer letterlijk uit het materiaal en noem alleen de URL van de bron. Relevantie en zekerheid van 0 tot 100.',
        materiaal: { waarnemer: true, soort: 'website', extraBron: b.label, account: a.name, vondsten, winpunten: (stand.winpunten ?? []).filter((w: any) => w.actief).map((w: any) => ({ id: w.id, titel: w.titel })), winpuntId: null },
      }, nu)
      if (!r.ok) {
        delete nieuw[sleutel]
        if (/credits|plafond|Bewaker|10 procent/i.test(r.reden ?? '')) { uit.gestopt = r.reden ?? 'Gestopt'; break }
        continue
      }
      const o = r.antwoord
      const geldig = valideerBewijs(o, `${vondsten[0]!.titel}\n${pagina.tekst}`, [b.url])
      const oud = ouderdomStatus('website', pagina.datum, nu)
      const tegengehouden = !geldig.geldig ? geldig.redenen.join('; ') : oud === 'hard' ? 'Te oud: de pagina is ouder dan 90 dagen' : o.relevantie < MIN_RELEVANTIE_EXTRA_BRON ? `Onder de minimale relevantie van ${MIN_RELEVANTIE_EXTRA_BRON}` : null
      const taak = magTaakVoorstel({ zekerheid: o.zekerheid, bronSoort: 'website', bronDatum: pagina.datum }, nu) ? o.taakVoorstel ?? `Bel ${a.name} over ${b.label}` : null
      const ins = await bewaarInzicht(tx, org, {
        accountId: a.id, contactId: b.contactId, ownerId: a.owner_id, agent: 'waarnemer', type: 'website', onderwerp: `extrabron:${b.contactId ?? 'account'}:${b.url}`, title: o.titel, beschrijving: o.beschrijving,
        relevantie: Math.round(o.relevantie), zekerheid: Math.round(o.zekerheid), bron: { soort: 'website', naam: herkomst, url: b.url, datum: pagina.datum },
        evidence: (o.evidence ?? []).map((e: any) => ({ ...e, bron: herkomst })), winpuntVoorstel: o.winpuntVoorstel ?? null, taakVoorstel: taak, tegengehouden,
      })
      if (tegengehouden) uit.tegengehouden++; else if (ins.nieuw) uit.inzichten++
      await logAgentRun(tx, org, { agent: 'waarnemer', handeling: tegengehouden ? 'inzicht:tegengehouden' : 'inzicht', mandaat: 'A', uitkomst: tegengehouden ? 'geblokkeerd' : 'uitgevoerd', accountId: a.id, reden: tegengehouden, bronnen: [b.url] }, nu)
    }
    await tx.execute(sql`update accounts set data = jsonb_set(data, '{waarnemer}', coalesce(data->'waarnemer', '{}'::jsonb) || ${JSON.stringify({ extraBronnen: nu.toISOString(), bronVingerafdruk: nieuw })}::jsonb) where id = ${a.id}`)
    if (uit.gestopt) break
  }
}
