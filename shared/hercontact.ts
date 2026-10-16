// Het hercontactritme (F13, 7.3): na elke uitkomst de volgende poging of parkeren.
// De startset van ritmes staat hier één keer (gat 16). Puur; `nu` gaat mee.
import { nlMoment, nlTijdstip, voegWerkdagenToe, volgendWerkmoment, type WerkdagInstelling } from './datum'

export type RitmeKanaal = 'bellen' | 'mail' | 'linkedin' | 'bezoek' | 'whatsapp'
export interface RitmeStap { volgnummer: number; dagOffset: number; kanaal: RitmeKanaal; instructie?: string; scriptId?: string | null }
export interface Ritme { id: string; naam: string; bron: 'koud' | 'warm' | 'winback'; status?: string; werkplek?: 'binnendienst' | 'buitendienst' | 'alle'; stappen: RitmeStap[]; parkeerDagen: number }

const s = (volgnummer: number, dagOffset: number, kanaal: RitmeKanaal, instructie?: string): RitmeStap => ({ volgnummer, dagOffset, kanaal, ...(instructie ? { instructie } : {}) })

export const RITMES_STARTSET: Omit<Ritme, 'id'>[] = [
  { naam: 'Koud', bron: 'koud', werkplek: 'binnendienst', parkeerDagen: 180, stappen: [s(1, 0, 'bellen'), s(2, 3, 'bellen'), s(3, 7, 'linkedin'), s(4, 12, 'bellen'), s(5, 21, 'mail')] },
  { naam: 'Warm', bron: 'warm', werkplek: 'alle', parkeerDagen: 90, stappen: [s(1, 0, 'bellen'), s(2, 3, 'mail'), s(3, 10, 'bellen')] },
  { naam: 'Winback', bron: 'winback', werkplek: 'alle', parkeerDagen: 365, stappen: [s(1, 0, 'bellen'), s(2, 28, 'mail')] },
  { naam: 'Buitendienst koud', bron: 'koud', werkplek: 'buitendienst', parkeerDagen: 180, stappen: [s(1, 0, 'bezoek', 'Op de regiodag'), s(2, 2, 'bellen'), s(3, 7, 'mail'), s(4, 14, 'bezoek', 'Volgende regiodag')] },
]

export const UITKOMST_CODES = ['afspraak', 'later', 'geen_reactie', 'voicemail', 'nieuw_contact', 'niet_geschikt', 'geen_interesse'] as const
export type UitkomstCode = typeof UITKOMST_CODES[number]
export const UITKOMST_LABEL: Record<UitkomstCode, string> = {
  afspraak: 'Gesproken, afspraak', later: 'Gesproken, later', geen_reactie: 'Geen gehoor of geen reactie', voicemail: 'Voicemail ingesproken',
  nieuw_contact: 'Doorverbonden, nieuwe contactpersoon', niet_geschikt: 'Niet geschikt', geen_interesse: 'Geen interesse',
}
export const KANAAL_LABEL_RITME: Record<string, string> = { bellen: 'bellen', mail: 'mail', linkedin: 'LinkedIn', bezoek: 'bezoek', whatsapp: 'WhatsApp' }

export interface RitmeStand {
  ritmeId: string
  /** De stap die nu aan de beurt is (1-based). */
  stap: number
  gestartOp: string
  volgendeOp: string | null
  kanaal: RitmeKanaal | null
  actief: boolean
  gepauzeerdTot?: string | null
  geparkeerdTot?: string | null
  geschiedenis: { stap: number; uitkomst: UitkomstCode; op: string }[]
}

/** Kies het ritme bij de start: bron en werkplek. */
export function kiesRitme(ritmes: Ritme[], bron: 'koud' | 'warm' | 'winback', werkplek: 'binnendienst' | 'buitendienst'): Ritme | null {
  const actief = ritmes.filter((r) => (r.status ?? 'actief') === 'actief')
  return actief.find((r) => r.bron === bron && r.werkplek === werkplek) ?? actief.find((r) => r.bron === bron && (r.werkplek ?? 'alle') === 'alle')
    ?? actief.find((r) => r.bron === bron) ?? actief.find((r) => r.bron === 'koud') ?? null
}

/**
 * Start het ritme. De start telt vanaf het eerste werkmoment: wie na 18:00 of in het weekend kwalificeert,
 * begint het ritme op de volgende werkdag om 9:00, zodat poging 2 drie dagen na de echte eerste poging
 * valt en niet op dezelfde dag (B03).
 */
export function startRitme(ritme: Ritme, nu: Date, inst: WerkdagInstelling = {}): RitmeStand {
  const eerste = ritme.stappen[0]!
  const start = volgendWerkmoment(nu, inst)
  return { ritmeId: ritme.id, stap: 1, gestartOp: start.toISOString(), volgendeOp: nu.toISOString(), kanaal: eerste.kanaal, actief: true, geschiedenis: [] }
}

export interface UitkomstResultaat {
  stand: RitmeStand
  actie: 'volgende' | 'parkeren' | 'later' | 'nee' | 'afspraak' | 'opnieuw'
  /** De volgende poging (bij volgende, later, opnieuw). */
  volgende?: { stap: number; van: number; kanaal: RitmeKanaal; op: string }
  parkeerTot?: string
  /** Al verwerkt voor deze stap (idempotent). */
  alVerwerkt?: boolean
}

/**
 * Moment van een stap: start plus dagOffset, nooit eerder dan het volgende werkmoment en nooit op de dag
 * van de vorige poging zelf (minimaal de volgende werkdag na de uitkomst, B03).
 */
function momentVoorStap(stand: RitmeStand, stap: RitmeStap, nu: Date, inst: WerkdagInstelling): Date {
  const start = nlMoment(new Date(stand.gestartOp)).datum
  const volgensSchema = voegWerkdagenToe(new Date(Date.parse(`${start}T12:00:00Z`) + stap.dagOffset * 864e5).toISOString().slice(0, 10), 0, inst)
  const minimaal = voegWerkdagenToe(nlMoment(nu).datum, 1, inst)
  return nlTijdstip(volgensSchema > minimaal ? volgensSchema : minimaal, 9)
}

/**
 * Verwerk een uitkomst in het ritme. Idempotent per stap: een tweede uitkomst voor
 * dezelfde stap verandert niets. Na de laatste stap zonder resultaat: parkeren.
 */
export function verwerkUitkomst(stand: RitmeStand, ritme: Ritme, uitkomst: UitkomstCode, nu: Date, opties: { laterOp?: string | null; stap?: number; inst?: WerkdagInstelling } = {}): UitkomstResultaat {
  const inst = opties.inst ?? {}
  const stapNu = opties.stap ?? stand.stap
  if (stand.geschiedenis.some((g) => g.stap === stapNu)) return { stand, actie: 'volgende', alVerwerkt: true }
  const geschiedenis = [...stand.geschiedenis, { stap: stapNu, uitkomst, op: nu.toISOString() }]
  const van = ritme.stappen.length
  const basis = { ...stand, geschiedenis }
  switch (uitkomst) {
    case 'afspraak':
      return { stand: { ...basis, actief: false, volgendeOp: null, kanaal: null }, actie: 'afspraak' }
    case 'niet_geschikt':
    case 'geen_interesse':
      return { stand: { ...basis, actief: false, volgendeOp: null, kanaal: null }, actie: 'nee' }
    case 'later': {
      const op = opties.laterOp ? nlTijdstip(opties.laterOp, 9) : volgendWerkmoment(new Date(nu.getTime() + 14 * 864e5), inst)
      const volgendeStap = Math.min(stapNu + 1, van)
      const kanaal = ritme.stappen[volgendeStap - 1]!.kanaal
      return { stand: { ...basis, stap: volgendeStap, volgendeOp: op.toISOString(), kanaal, gepauzeerdTot: opties.laterOp ?? null }, actie: 'later', volgende: { stap: volgendeStap, van, kanaal, op: op.toISOString() } }
    }
    case 'nieuw_contact': {
      // Dezelfde stap opnieuw, naar de nieuwe contactpersoon.
      const op = volgendWerkmoment(nu, inst)
      const kanaal = ritme.stappen[stapNu - 1]!.kanaal
      return { stand: { ...basis, geschiedenis: stand.geschiedenis, volgendeOp: op.toISOString(), kanaal }, actie: 'opnieuw', volgende: { stap: stapNu, van, kanaal, op: op.toISOString() } }
    }
    case 'geen_reactie':
    case 'voicemail': {
      if (stapNu >= van) {
        const tot = new Date(Date.UTC(nu.getUTCFullYear(), nu.getUTCMonth(), nu.getUTCDate()) + ritme.parkeerDagen * 864e5).toISOString().slice(0, 10)
        return { stand: { ...basis, actief: false, volgendeOp: null, kanaal: null, geparkeerdTot: tot }, actie: 'parkeren', parkeerTot: tot }
      }
      const volgende = ritme.stappen[stapNu]!
      // Voicemail: een korte volgende stap, mail binnen 1 werkdag.
      const op = uitkomst === 'voicemail' ? nlTijdstip(voegWerkdagenToe(nlMoment(nu).datum, 1, inst), 9) : momentVoorStap(stand, volgende, nu, inst)
      const kanaal: RitmeKanaal = uitkomst === 'voicemail' ? 'mail' : volgende.kanaal
      return { stand: { ...basis, stap: stapNu + 1, volgendeOp: op.toISOString(), kanaal }, actie: 'volgende', volgende: { stap: stapNu + 1, van, kanaal, op: op.toISOString() } }
    }
  }
}

/** "Afgerond. Volgende poging donderdag 16 oktober, bellen." */
export function afrondTekst(r: Pick<UitkomstResultaat, 'actie' | 'volgende' | 'parkeerTot'>): string {
  const dag = (iso: string) => new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' }).format(new Date(iso))
  if ((r.actie === 'volgende' || r.actie === 'later' || r.actie === 'opnieuw') && r.volgende) return `Afgerond. Volgende poging ${dag(r.volgende.op)}, ${KANAAL_LABEL_RITME[r.volgende.kanaal]}.`
  if (r.actie === 'parkeren' && r.parkeerTot) return `Afgerond. Geparkeerd tot ${r.parkeerTot}.`
  if (r.actie === 'afspraak') return 'Afgerond. Afspraak gepland; het ritme is klaar.'
  if (r.actie === 'nee') return 'Afgerond. Het account staat op nee.'
  return 'Afgerond.'
}

export function valideerRitme(r: Partial<Ritme>): string[] {
  const f: string[] = []
  if (!r.naam?.trim()) f.push('Naam ontbreekt')
  if (!r.stappen?.length) f.push('Een ritme heeft minstens één stap')
  for (const [i, st] of (r.stappen ?? []).entries()) {
    if (!st.kanaal || !['bellen', 'mail', 'linkedin', 'bezoek', 'whatsapp'].includes(st.kanaal)) f.push(`Stap ${i + 1} heeft geen kanaal`)
    if (!Number.isInteger(st.dagOffset) || st.dagOffset < 0) f.push(`Stap ${i + 1} heeft geen geldige dag`)
    if (i > 0 && st.dagOffset < r.stappen![i - 1]!.dagOffset) f.push(`Stap ${i + 1} ligt voor stap ${i}`)
  }
  if (!Number.isInteger(r.parkeerDagen) || (r.parkeerDagen ?? 0) < 1) f.push('Parkeerduur ontbreekt')
  return f
}

/** Rapport per ritme: afspraken per poging, percentage geparkeerd, gemiddelde pogingen tot afspraak. */
export function ritmeRapport(standen: Pick<RitmeStand, 'geschiedenis' | 'actief' | 'geparkeerdTot'>[]) {
  const perPoging: Record<number, number> = {}
  let geparkeerd = 0
  let afspraken = 0
  let pogingenTotAfspraak = 0
  for (const st of standen) {
    const a = st.geschiedenis.findIndex((g) => g.uitkomst === 'afspraak')
    if (a >= 0) { afspraken++; perPoging[a + 1] = (perPoging[a + 1] ?? 0) + 1; pogingenTotAfspraak += a + 1 }
    if (st.geparkeerdTot) geparkeerd++
  }
  return { accounts: standen.length, afspraken, perPoging, geparkeerdProcent: standen.length ? Math.round((geparkeerd / standen.length) * 100) : 0, gemiddeldePogingen: afspraken ? Math.round((pogingenTotAfspraak / afspraken) * 10) / 10 : null }
}
