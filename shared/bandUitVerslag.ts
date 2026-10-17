// BAND uit de gespreksverslagen: de Notulist analyseert elk verslag (afspraak of beltaak). Uit die analyse
// halen we per BAND-letter een voorstel met het letterlijke citaat. Budget, autoriteit, behoefte en timing uit
// het gesprek passen zo op de vier letters van Dealtrace:
//   behoefte   = wat de prospect wil oplossen (behoefte)
//   autoriteit = wie beslist (autoriteit)
//   noodzaak   = timing en urgentie (timing)
//   draagvlak  = budget en steun in de organisatie (budget)
// Een nieuwe analyse levert het veld `band` zelf (NOTULIST_SCHEMA); een oudere analyse zonder dat veld lezen we
// uit de samenvatting, de agendapunten, de koopsignalen en de bezwaren. Het is altijd een voorstel: de gebruiker
// bevestigt, bewerkt of verwerpt per letter, en een letter die al is ingevuld blijft zoals hij is.
import { BAND_LETTERS, type Band, type BandLetter } from './bandKwalificatie'

export const BAND_UITLEG: Record<BandLetter, string> = {
  behoefte: 'Wat de prospect wil oplossen',
  autoriteit: 'Wie beslist',
  noodzaak: 'Timing en urgentie',
  draagvlak: 'Budget en steun in de organisatie',
}

export interface BandUitAnalyse { ja: boolean; citaat: string }
export type BandAnalyse = Partial<Record<BandLetter, BandUitAnalyse>>

/** Positieve en negatieve signalen per letter (kleine letters, op zinnen uit de analyse). */
const REGELS: Record<BandLetter, { ja: RegExp; nee?: RegExp; agendapunt?: RegExp }> = {
  behoefte: { ja: /\b(wil|willen|zoekt|zoeken|behoefte|nodig|probleem|verliest|verliezen|wacht|wachten|knelpunt)\b/, nee: /\b(geen behoefte|tevreden met|niets nodig)\b/, agendapunt: /behoefte/ },
  autoriteit: { ja: /\b(directeur|eigenaar|beslist|beslisser|beslissen|tekenbevoegd|tekent|akkoord van|inkoper|dga)\b/, nee: /\b(beslist niet|geen beslisser|niet bevoegd)\b/ },
  noodzaak: { ja: /\b(planning|deadline|spoed|snel|starten|start|dit jaar|volgend jaar|dit kwartaal|volgend kwartaal|voor de zomer|binnen \d+|krap|krappe|kostenpost|urgent)\b/, nee: /\b(geen haast|niet urgent|pas over)\b/ },
  draagvlak: { ja: /\b(budget|begroting|investering|investeren|geld vrij|projectleider erbij|steun|draagvlak|team erbij|offerte)\b/, nee: /\b(geen budget|te duur|geen geld|geen draagvlak)\b/ },
}

const schoon = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim()
const kort = (s: string) => (s.length > 200 ? `${s.slice(0, 197)}...` : s)

/** Per letter een voorstel uit één Notulist-analyse; letters zonder signaal ontbreken. */
export function bandUitAnalyse(analyse: any): BandAnalyse {
  if (!analyse || typeof analyse !== 'object') return {}
  const uit: BandAnalyse = {}
  // Een nieuwe analyse levert de BAND zelf.
  if (analyse.band && typeof analyse.band === 'object') {
    for (const l of BAND_LETTERS) {
      const b = analyse.band[l]
      if (b && (b.oordeel === 'ja' || b.oordeel === 'nee') && schoon(b.citaat)) uit[l] = { ja: b.oordeel === 'ja', citaat: kort(schoon(b.citaat)) }
    }
    if (Object.keys(uit).length) return uit
  }
  const agenda = (Array.isArray(analyse.perAgendapunt) ? analyse.perAgendapunt : []).filter((p: any) => schoon(p?.samenvatting) && !/^niet besproken/i.test(schoon(p?.samenvatting)))
  const positief = [...(analyse.koopsignalen ?? []), ...agenda.map((p: any) => p.samenvatting), ...schoon(analyse.samenvatting).split(/(?<=[.!?])\s+/)].map(schoon).filter(Boolean)
  const negatief = [...(analyse.bezwaren ?? []), ...positief].map(schoon).filter(Boolean)
  for (const l of BAND_LETTERS) {
    const r = REGELS[l]
    const nee = r.nee ? negatief.find((z) => r.nee!.test(z.toLowerCase())) : undefined
    if (nee) { uit[l] = { ja: false, citaat: kort(nee) }; continue }
    const punt = r.agendapunt ? agenda.find((p: any) => r.agendapunt!.test(schoon(p.punt).toLowerCase())) : undefined
    const ja = punt ? schoon(punt.samenvatting) : positief.find((z) => r.ja.test(z.toLowerCase()))
    if (ja) uit[l] = { ja: true, citaat: kort(ja) }
  }
  return uit
}

export interface VerslagBron { id: string; soort: 'afspraak' | 'taak'; titel: string; datum: string; analyse: any }
export interface BandVoorstel { letter: BandLetter; ja: boolean; citaat: string; bron: { id: string; soort: 'afspraak' | 'taak'; titel: string; datum: string } }
export interface BandVerworpen { bronId: string; op: string }

/**
 * Voorstellen per letter uit de verslagen (nieuwste eerst): de nieuwste analyse met een signaal wint. Een letter
 * die al is ingevuld (met de hand of eerder bevestigd) krijgt geen voorstel; een verworpen voorstel komt alleen
 * terug als een nieuwer verslag iets anders zegt.
 */
export function bandVoorstellen(bronnen: VerslagBron[], band: Band | null | undefined, verworpen: Partial<Record<BandLetter, BandVerworpen>> = {}): BandVoorstel[] {
  const gesorteerd = [...bronnen].sort((a, b) => Date.parse(b.datum) - Date.parse(a.datum))
  const uit: BandVoorstel[] = []
  for (const l of BAND_LETTERS) {
    if (band?.[l]) continue
    for (const b of gesorteerd) {
      const v = bandUitAnalyse(b.analyse)[l]
      if (!v) continue
      const weg = verworpen[l]
      if (weg && (weg.bronId === b.id || Date.parse(b.datum) <= Date.parse(weg.op))) break
      uit.push({ letter: l, ja: v.ja, citaat: v.citaat, bron: { id: b.id, soort: b.soort, titel: b.titel, datum: b.datum } })
      break
    }
  }
  return uit
}
