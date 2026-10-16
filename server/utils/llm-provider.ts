// De providerlaag voor AI (11.2, 13.1). Elke AI-stap loopt via voerAiStapUit: eerst de Bewaker
// (agents), dan de reservering van credits (P33: pot, plafond, agentgrens), dan maskeren,
// aanroepen met schema, één keer opnieuw en loggen in agent_runs. Zonder sleutel of in
// tests draait de mock met vaste fixtures; hij bewaart de laatste invoer voor de test
// dat privégegevens nooit meegaan.
import type { AiSoort } from '../../shared/credits'
import { voerAiKern, type AiProvider, type JsonSchema } from '../../shared/aiStap'
import { logAgentRun, toets, type Voorstel } from './agents/bewaker'
import { boek, geefVrij, metCredits, reserveer, type ReserveerOpties, type Reservering } from './credits'
import { mockGids } from './assistent'
import { mockOpdracht } from '../../shared/spraakOpdracht'
import { promptVoor, providerVoor } from './aiKoppeling'
import { metOrganisatie } from './db'

type Tx = Parameters<Parameters<ReturnType<typeof import('./db').gebruikDb>['transaction']>[0]>[0]

export const MOCK_FIXTURES: Record<string, unknown[]> = {}
/** Pitstop-mock (P18): waarom, hoe (één winpunt met één bewijs), één vraag; je-vorm, binnen de lengtegrens. */
function mockPitstop(m: any) {
  const w = m.winpunt ? `${m.winpunt.titel}: ${String(m.winpunt.bewijs ?? m.winpunt.omschrijving).replace(/\.$/, "")}` : 'een levering per bouwfase'
  const waarom = m.aanleiding ? `Ik zag dat ${String(m.aanleiding).replace(/\.$/, '').replace(/^./, (c: string) => c.toLowerCase())}.` : 'Ik zie dat jullie planning vaak om materiaal draait.'
  const vraag = 'Past een kwartier volgende week om te kijken of dit jullie monteurs tijd scheelt?'
  if (m.type === 'mail') return { onderwerp: m.winpunt?.titel ?? 'Levering per bouwfase', tekst: `${waarom} Wij helpen jullie met ${w}. ${vraag}`, ...(m.winpunt ? { winpuntId: m.winpunt.id } : {}) }
  if (m.type === 'linkedin') return { tekst: `${waarom} ${w}. ${vraag}`, ...(m.winpunt ? { winpuntId: m.winpunt.id } : {}) }
  if (m.type === 'belscript') return { tekst: `Opening: ${waarom}\nWinpunt: ${w}.\nVraag: ${vraag}${(m.bezwaren ?? []).length ? `\nAls je hoort: "${m.bezwaren[0].bezwaar}" Antwoord: ${m.bezwaren[0].antwoord}` : ''}`, ...(m.winpunt ? { winpuntId: m.winpunt.id } : {}) }
  return { blokken: { opening: `${waarom} ${vraag}`, winpunt: w }, ...(m.winpunt ? { winpuntId: m.winpunt.id } : {}) }
}
/** Mock die uit het materiaal een geldig antwoord maakt, voor soorten zonder vaste fixture. */
export const MOCK_GENERATOREN: Record<string, (materiaal: any) => unknown> = {
  // Opzet van een belscript: de opbouw van het startscript voor dit doel, met de kernzin van het verhaal.
  concept: (m) => m?.campagneWinpunt ? (() => { const w = (m.winpunten ?? []).find((x: any) => x.faseId === m.faseId) ?? m.winpunten?.[0]; return { winpuntId: w?.id ?? '', motivatie: `Past bij deze fase: ${w?.titel ?? 'het eerste winpunt'} sluit aan op wat prospects in de laatste gesprekken vroegen.` } })()
    : m?.pitstop ? mockPitstop(m)
    : m?.campagneBoodschap ? { onderwerp: m.winpunt?.titel ?? 'Even voorstellen', tekst: `${m.verhaal ?? 'Wij helpen installateurs met een betrouwbare levering.'}${m.winpunt ? ` ${m.winpunt.titel}: ${m.winpunt.omschrijving}` : ''} Zullen we een kwartier kijken of dit bij jullie past?`, stijlscore: 8 }
    : m?.opzet ? {
    naam: `${m.opzet.doelLabel} (opzet)`,
    blokken: (m.opzet.voorbeeld ?? []).map((b: any) => ({ soort: b.soort, tekst: b.soort === 'opening' && m.kernzin ? `Goedemorgen {contact.voornaam}, met {gebruiker.voornaam} van {organisatie.naam}. ${m.kernzin}` : b.tekst })),
  } : { tekst: 'Mock-antwoord voor concept' },
  belscript: (m) => {
    const blokken: { blokId: string; tekst: string; bronnen: { soort: string; datum?: string; citaat?: string }[] }[] = []
    for (const b of m?.blokken ?? []) {
      if (b.soort === 'aanleiding' && m.inzichten?.[0]) blokken.push({ blokId: b.id, tekst: `Ik bel u naar aanleiding van dit: ${m.inzichten[0].titel}.`, bronnen: [{ soort: 'inzicht', datum: m.inzichten[0].op, citaat: m.inzichten[0].titel }] })
      if (b.soort === 'winpunt' && m.winpunt) blokken.push({ blokId: b.id, tekst: `${m.winpunt.titel}: ${m.winpunt.omschrijving}`, bronnen: [{ soort: 'winpunt', citaat: m.winpunt.titel }] })
    }
    return { blokken, gekozenWinpuntId: m?.winpunt?.id ?? '', argumentRef: m?.winpunt?.id ?? '' }
  },
  // Zoekronde (Zoeker): bedrijven uit de echte zoekresultaten; titels zijn "Naam | Plaats".
  zoekronde: (m) => ({
    bedrijven: (m?.zoekresultaten ?? []).slice(0, 25).map((r: any) => {
      const [naam, plaats] = String(r.titel).split(' | ')
      const kvk = (m.kvkFeiten ?? []).find((k: any) => k.naam === naam)?.kvk
      return { naam, plaats: plaats ?? '', website: r.url, url: r.url, bronzin: r.fragment, ...(kvk ? { kvk } : {}) }
    }),
  }),
  // Dossier (Zoeker): letterlijke zinnen van de pagina als bewijs en de contactpersonen die er staan.
  dossier: (m) => {
    const bewijs: any[] = []
    const contacten: any[] = []
    const vandaag = new Date().toISOString().slice(0, 10)
    for (const p of m?.paginas ?? []) {
      for (const zin of String(p.tekst).split(/(?<=\.)\s+/)) {
        if (/werft|zoekt|vacature|nieuwe vestiging|breidt uit|bouwt|neemt .* over|opent/i.test(zin)) bewijs.push({ criterium: 'groei', oordeel: 'ja', zin: zin.replace(/\.$/, ''), bron: 'web', url: p.url, datum: vandaag })
        const c = /([A-Z][a-z]+(?: (?:de|van|ter))? [A-Z][a-z]+), (eigenaar|directeur|bedrijfsleider|hoofd inkoop|operationeel directeur|projectleider)/.exec(zin)
        if (c) {
          const tel = /(0\d{1,3}[ \d]{6,10}\d)/.exec(zin)?.[1]
          const mail = /([\w.]+@[\w.-]+\.test)/.exec(zin)?.[1]
          contacten.push({ naam: c[1], functie: c[2], ...(tel ? { telefoon: tel } : {}), ...(mail ? { email: mail } : {}), bron: 'web' })
        }
      }
    }
    return { bewijs, contacten }
  },
}
// De Gids (P33): hetzelfde antwoord voor een gewone vraag, een vraag met account en webonderzoek.
for (const soort of ['assistent', 'assistentUitgebreid', 'webonderzoek']) MOCK_GENERATOREN[soort] = (m) => mockGids(m)
// De Waarnemer (P19): een oordeel met letterlijk citaat en de URL uit de vondst.
MOCK_GENERATOREN.webonderzoek = (m) => {
  if (!m?.waarnemer) return mockGids(m)
  const v = m.vondsten?.[0]
  const citaat = String(v?.tekst ?? '').split(/(?<=\.)\s/)[0] ?? ''
  return {
    titel: v?.titel ?? 'Aanleiding gevonden', beschrijving: `${v?.fragment ?? ''} Dat is een aanleiding om nu contact op te nemen.`.trim(), relevantie: 85, zekerheid: 75,
    evidence: [{ citaat, bron: v?.titel ?? 'Web', ...(v?.datum ? { datum: v.datum } : {}), ...(v?.url ? { url: v.url } : {}) }],
    ...(m.winpuntId ?? m.winpunten?.[0]?.id ? { winpuntVoorstel: m.winpuntId ?? m.winpunten[0].id } : {}), taakVoorstel: `Bel ${m.account} over de ${m.soort}`,
  }
}
// De Verrijker (P19): alleen velden met bron; een patroon als aanname.
const leadDossier = MOCK_GENERATOREN.dossier!
MOCK_GENERATOREN.dossier = (m) => !m?.verrijker ? leadDossier(m) : ({
  velden: [
    ...(m?.kvk ? [{ veld: 'omvang', waarde: `${m.kvk.medewerkers ?? 'onbekend'} medewerkers`, bron: 'KvK' }] : []),
    ...(m?.website ? [{ veld: 'kernfeit', waarde: String(m.website.tekst).split(/(?<=\.)\s/)[0], bron: m.website.url }] : []),
    ...(m?.domein ? [{ veld: 'emailpatroon', waarde: `voornaam@${m.domein}`, aanname: true }] : []),
  ],
  criteria: { branche: m?.branche ? 'ja' : 'onbekend', omvang: m?.kvk ? 'ja' : 'onbekend', locatie: m?.plaats ? 'ja' : 'onbekend', leverancier: m?.leverancier ? 'ja' : 'onbekend', aanleiding: m?.aanleiding ? 'ja' : 'onbekend', beslisser: m?.beslisser ? 'ja' : 'onbekend' },
})
// De Profielbouwer (P19): rollen uit de functies, zonder namen te verzinnen.
MOCK_GENERATOREN.brief = (m) => m?.committee ? { voorstellen: (m.functies ?? []).map((f: string) => ({ functie: f, rol: /directeur|eigenaar|inkoop/i.test(f) ? 'beslisser' : /werkvoorbereider|projectleider/i.test(f) ? 'beinvloeder' : 'gebruiker', bron: m.bron ?? 'Website', zekerheid: /directeur|eigenaar/i.test(f) ? 80 : 55 })) } : { tekst: 'Mock-antwoord voor brief' }
// De Notulist (P19): per agendapunt, open vragen, voorgestelde uitkomst, signalen en concurrenten.
MOCK_GENERATOREN.notulist = (m) => {
  const t = String(m?.aantekeningen ?? '')
  const zinnen = t.split(/(?<=[.!?])\s+/).filter(Boolean)
  return {
    perAgendapunt: (m?.agenda ?? []).map((p: string, i: number) => ({ punt: p, samenvatting: zinnen[i] ?? 'Niet besproken.' })),
    openVragen: zinnen.filter((z) => z.endsWith('?')),
    voorgesteldeUitkomst: /afspraak|vervolg|offerte/i.test(t) ? 'vervolg' : 'later',
    koopsignalen: zinnen.filter((z) => /nieuwbouw|uitbreid|budget|starten|planning/i.test(z)).slice(0, 3),
    bezwaren: zinnen.filter((z) => /duur|goedkoper|tevreden/i.test(z)).slice(0, 3),
    concurrenten: (m?.concurrenten ?? []).filter((c: any) => t.toLowerCase().includes(String(c.naam).toLowerCase().replace(/\s*b\.?v\.?$/i, ''))).map((c: any) => c.naam),
    actiepunten: zinnen.filter((z) => /sturen|bellen|mailen|plannen|terugkomen/i.test(z)).slice(0, 3),
  }
}
// De Coach (P21): punten uit de cijfers, elk met een bestaand artikel; onder het minimum geen vergelijking.
MOCK_GENERATOREN.coach = (m) => {
  if (!m?.coach) return { tekst: 'Mock-antwoord voor coach' }
  // P22: een vaste conceptreis voor de woningbouw (br-01).
  if (m.reisVoorstel) return {
    fases: [
      { id: 'gevonden', label: 'Gevonden', hoofdfase: 'vinden', omschrijving: 'Past in de doelgroep.', accent: 'Kijk naar lopende nieuwbouwprojecten.', verwachtVerblijfDagen: 14, instap: true, eind: 'geen' },
      { id: 'benaderd', label: 'Benaderd', hoofdfase: 'bewerken', omschrijving: 'Eerste poging gedaan.', accent: 'Vraag naar de planning per bouwfase.', verwachtVerblijfDagen: 21, instap: false, eind: 'geen' },
      { id: 'werkbezoek', label: 'Werkbezoek op project', hoofdfase: 'verbinden', omschrijving: 'Samen op de bouwplaats.', accent: 'Laat het leverplan per bouwfase zien.', verwachtVerblijfDagen: 14, instap: false, eind: 'geen' },
      { id: 'overgedragen', label: 'Overgedragen', hoofdfase: 'overgedragen', omschrijving: 'Na de eerste afspraak overgedragen.', accent: '', verwachtVerblijfDagen: 0, instap: false, eind: 'overgedragen' },
      { id: 'verloren', label: 'Verloren', hoofdfase: 'verloren', omschrijving: 'Geen vervolg.', accent: '', verwachtVerblijfDagen: 0, instap: false, eind: 'verloren' },
    ],
    overgangen: [
      { vanFaseId: 'instap', gebeurtenis: 'lead-overgenomen', naarFaseId: 'gevonden' },
      { vanFaseId: 'gevonden', gebeurtenis: 'eerste-contact', naarFaseId: 'benaderd' },
      { vanFaseId: 'benaderd', gebeurtenis: 'eerste-afspraak-gehouden', naarFaseId: 'werkbezoek' },
      { vanFaseId: 'benaderd', gebeurtenis: 'geen-vervolg', naarFaseId: 'verloren' },
      { vanFaseId: 'werkbezoek', gebeurtenis: 'overgedragen', naarFaseId: 'overgedragen' },
      { vanFaseId: 'werkbezoek', gebeurtenis: 'geen-vervolg', naarFaseId: 'verloren' },
    ],
  }
  const art = (s: string) => ((m.artikelen ?? []) as string[]).includes(s) ? s : ((m.artikelen ?? [])[0] ?? s)
  if (m.verbetervoorstel) {
    const [f] = (m.fases ?? []) as { fase: string; n: number }[]
    return { punten: f ? [{ tekst: `In fase ${f.fase} staan ${f.n} accounts stil. Voeg een tweede belpoging toe binnen vijf werkdagen.`, onderbouwing: { cijfers: [`${f.n} accounts in ${f.fase}`], bron: 'Reisgeschiedenis' }, artikelSleutel: art('doelgroepen-en-reizen') }] : [] }
  }
  const c = m.cijfers ?? {}
  const t = m.team ?? {}
  const punten: any[] = []
  if (m.genoeg && Number(c.gesprekken) > 0) punten.push({ tekst: 'Sluit elk gesprek af met een concreet voorstel voor een afspraak.', onderbouwing: { cijfers: [`${c.afspraken ?? 0} afspraken uit ${c.gesprekken} gesprekken`, `team ${Math.round(Number(t.gesprekNaarAfspraak ?? 0) * 100)} procent`], bron: 'Activiteitenlog' }, artikelSleutel: art('een-belscript-kiezen') })
  if (Number(c.pogingen) >= 0) punten.push({ tekst: 'Houd vol tot de vijfde poging; de meeste afspraken ontstaan na de derde.', onderbouwing: { cijfers: [`${c.pogingen ?? 0} pogingen deze periode`], bron: 'Activiteitenlog' }, artikelSleutel: art('waarom-vijf-pogingen-werken') })
  punten.push({ tekst: 'Kies per gesprek één winpunt en noem het in de eerste minuut.', onderbouwing: { cijfers: [`${c.beslisser ?? 0} gesprekken met een beslisser`], bron: 'Activiteitenlog' }, artikelSleutel: art('een-winpunt-per-gesprek') })
  return { punten: punten.slice(0, 3) }
}
// P31: spraakopdracht uit de zin en de lijst accounts; visitekaartje met een vast fictief kaartje.
MOCK_GENERATOREN.spraakopdracht = (m) => mockOpdracht(String(m?.zin ?? ''), m?.accounts ?? [], new Date(m?.vandaag ?? Date.now()))
export const MOCK_VISITEKAARTJES: Record<string, unknown> = {}
MOCK_GENERATOREN.visitekaartje = (m) => MOCK_VISITEKAARTJES[m?.bijlageId] ?? { naam: 'peter KOK', functie: 'Hoofd inkoop', bedrijf: null, telefoon: '06 1234 5678', email: 'Peter.Kok@voorbeeld.test' }

export const mockLog: { soort: string; prompt: string; materiaal: unknown }[] = []

/** Mock-provider: per soort een rij vaste antwoorden (de laatste blijft staan). */
export const mockProvider: AiProvider = async ({ soort, prompt, materiaal }) => {
  mockLog.push({ soort, prompt, materiaal })
  if (mockLog.length > 50) mockLog.shift()
  const rij = MOCK_FIXTURES[soort]
  if (!rij?.length) return MOCK_GENERATOREN[soort] ? MOCK_GENERATOREN[soort]!(materiaal) : { tekst: `Mock-antwoord voor ${soort}` }
  return rij.length > 1 ? rij.shift() : rij[0]
}

/** Zonder database (buiten een organisatie): de mock. Binnen een organisatie kiest providerVoor (P24). */
export function kiesProvider(): AiProvider {
  return mockProvider
}

export interface AiStap {
  soort: AiSoort
  prompt: string
  schema: JsonSchema
  materiaal: unknown
  /** Namens een agent (dan geldt de Bewaker) of een gebruiker. */
  agent?: string | null
  gebruiker?: Voorstel['gebruiker']
  accountId?: string | null
  /** Een handeling van de gebruiker die toch als agentrun telt (credits), zonder de agentgrens van 10 procent. */
  boekAls?: string | null
  /** Proefdraai (P24): de prompt staat al vast, zonder de keten per slot. */
  zonderKeten?: boolean
}

/**
 * Eén AI-stap. Een gebruiker zonder credits krijgt 402 met de melding uit 11.4; een agent
 * wordt door de Bewaker tegengehouden (onder 10 procent, dagplafond). Een stap zonder geldig
 * antwoord na twee pogingen wordt als fout gelogd en levert niets op (geen opslag).
 */
export async function voerAiStapUit<T = unknown>(tx: Tx, org: string, stap: AiStap, nu = new Date(), provider?: AiProvider) {
  if (stap.agent) {
    const b = await toets(tx, org, { agent: stap.agent, handeling: `ai:${stap.soort}`, gebruiker: stap.gebruiker, accountId: stap.accountId, ai: stap.soort }, nu)
    if (!b.mag) return { ok: false as const, reden: b.reden ?? 'Tegengehouden door de Bewaker' }
  }
  // Reserveren vóór de aanroep (402 of 403 voor een gebruiker; een agent krijgt een weigering terug).
  let r: Reservering
  try {
    r = await reserveer(tx, org, { soort: stap.soort, gebruikerId: stap.gebruiker?.id ?? null, automatisch: !!stap.agent }, nu)
  } catch (e: any) {
    if (stap.agent) return { ok: false as const, reden: e?.statusMessage ?? 'De AI-credits van deze maand zijn op' }
    throw createError({ statusCode: e?.statusCode ?? 402, statusMessage: e?.statusMessage ?? 'De AI-credits van deze maand zijn op' })
  }
  // P24: de provider uit de oplosketen en de prompt uit de keten per slot, met het vaste kader.
  const p = provider ?? await providerVoor(tx, org)
  const uit = await voerAiKern<T>(p, { ...stap, prompt: await promptVoor(tx, stap.soort, stap.materiaal, stap.prompt) })
  if (uit.ok) await boek(tx, r, { agent: stap.agent ?? stap.boekAls ?? 'gebruiker', accountId: stap.accountId }, nu)
  else {
    await geefVrij(tx, r)
    if (stap.agent) await logAgentRun(tx, org, { agent: stap.agent, handeling: `ai:${stap.soort}`, mandaat: 'A', uitkomst: 'fout', gebruikerId: stap.gebruiker?.id, accountId: stap.accountId, reden: uit.fouten.join(' | ').slice(0, 500), kosten: null }, nu)
  }
  return uit.ok ? { ok: true as const, antwoord: uit.antwoord as T, pogingen: uit.pogingen } : { ok: false as const, reden: 'Het AI-antwoord was niet bruikbaar', fouten: uit.fouten }
}

/**
 * Een AI-stap buiten een transactie (de assistent): via metCredits reserveren, aanroepen en boeken
 * of vrijgeven. Zo lopen ook lange aanroepen niet binnen een databasetransactie.
 */
export async function voerAiStapMetCredits<T = unknown>(org: string, stap: Omit<AiStap, 'agent'> & { agent: string }, opties: Omit<ReserveerOpties, 'soort'> & { credits?: (antwoord: T) => number }, provider?: AiProvider) {
  const keuze = await metOrganisatie(org, async (tx) => ({ p: provider ?? await providerVoor(tx, org), prompt: stap.zonderKeten ? stap.prompt : await promptVoor(tx, stap.soort, stap.materiaal, stap.prompt) }))
  return metCredits<T>(org, { ...opties, soort: stap.soort, agent: stap.agent, accountId: stap.accountId }, async () => {
    const uit = await voerAiKern<T>(keuze.p, { ...stap, prompt: keuze.prompt })
    return uit.ok ? { ok: true as const, waarde: uit.antwoord as T, credits: opties.credits?.(uit.antwoord as T) } : { ok: false as const, reden: uit.fouten.join(' | ') }
  })
}
