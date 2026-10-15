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

type Tx = Parameters<Parameters<ReturnType<typeof import('./db').gebruikDb>['transaction']>[0]>[0]

export const MOCK_FIXTURES: Record<string, unknown[]> = {}
/** Mock die uit het materiaal een geldig antwoord maakt, voor soorten zonder vaste fixture. */
export const MOCK_GENERATOREN: Record<string, (materiaal: any) => unknown> = {
  // Opzet van een belscript: de opbouw van het startscript voor dit doel, met de kernzin van het verhaal.
  concept: (m) => m?.opzet ? {
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

/** De echte provider komt met de AI-koppeling (F23); tot dan altijd de mock. */
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
}

/**
 * Eén AI-stap. Een gebruiker zonder credits krijgt 402 met de melding uit 11.4; een agent
 * wordt door de Bewaker tegengehouden (onder 10 procent, dagplafond). Een stap zonder geldig
 * antwoord na twee pogingen wordt als fout gelogd en levert niets op (geen opslag).
 */
export async function voerAiStapUit<T = unknown>(tx: Tx, org: string, stap: AiStap, nu = new Date(), provider: AiProvider = kiesProvider()) {
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
  const uit = await voerAiKern<T>(provider, stap)
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
export async function voerAiStapMetCredits<T = unknown>(org: string, stap: Omit<AiStap, 'agent'> & { agent: string }, opties: Omit<ReserveerOpties, 'soort'> & { credits?: (antwoord: T) => number }, provider: AiProvider = kiesProvider()) {
  return metCredits<T>(org, { ...opties, soort: stap.soort, agent: stap.agent, accountId: stap.accountId }, async () => {
    const uit = await voerAiKern<T>(provider, stap)
    return uit.ok ? { ok: true as const, waarde: uit.antwoord as T, credits: opties.credits?.(uit.antwoord as T) } : { ok: false as const, reden: uit.fouten.join(' | ') }
  })
}
