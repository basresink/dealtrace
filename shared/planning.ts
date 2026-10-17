// Prospectplanning (F13): potentie, vensters, verkoopjaar, "benaderd" en "Wat knelt er nu",
// het spreiden van een achterstand over belblokken en de terugkomregels met de afkoelperiode
// als ondergrens. Pagina, motor en job lezen alleen deze definities (gat 16, gat 18).
import { afkoelingTot, type Kanaal, type NeeGegevens } from './nbStatus'
import { klasseCode, KLASSEN_STANDAARD, type Klasse } from './ritmematrix'

export const POTENTIES = ['groot', 'middel', 'klein'] as const
export type Potentie = typeof POTENTIES[number]
export const POTENTIE_LABEL: Record<Potentie, string> = { groot: 'Groot', middel: 'Middel', klein: 'Klein' }

export interface PlanningInstelling {
  /** Eerste maand van het verkoopjaar, 1 tot en met 12. */
  startmaand: number
  /** Venster in maanden vanaf de start van het verkoopjaar; klein is doorlopend (12). */
  vensters: Record<Potentie, number>
  potentieBron: 'klasse' | 'eigenVeld' | 'score'
  eigenVeldSleutel?: string | null
  /** Potentie per eigen klasse (id); standaard middel. */
  klassePotentie: Record<string, Potentie>
}
export const PLANNING_STANDAARD: PlanningInstelling = { startmaand: 1, vensters: { groot: 2, middel: 5, klein: 12 }, potentieBron: 'klasse', eigenVeldSleutel: null, klassePotentie: {} }

export function leesPlanning(waarde: unknown, startmaandOrganisatie?: number | null): PlanningInstelling {
  const w = (waarde ?? {}) as Partial<PlanningInstelling>
  const m = Number(w.startmaand ?? startmaandOrganisatie ?? 1)
  const v = { ...PLANNING_STANDAARD.vensters, ...(w.vensters ?? {}) }
  for (const p of POTENTIES) v[p] = Math.max(1, Math.min(12, Math.round(Number(v[p]) || PLANNING_STANDAARD.vensters[p])))
  return {
    startmaand: Number.isInteger(m) && m >= 1 && m <= 12 ? m : 1, vensters: v,
    potentieBron: (['klasse', 'eigenVeld', 'score'] as const).find((x) => x === w.potentieBron) ?? 'klasse',
    eigenVeldSleutel: w.eigenVeldSleutel ?? null,
    klassePotentie: Object.fromEntries(Object.entries(w.klassePotentie ?? {}).filter(([, p]) => (POTENTIES as readonly string[]).includes(p))) as Record<string, Potentie>,
  }
}

export interface PlanAccount { klasse?: string | null; score?: number | null; cf?: Record<string, unknown> | null }

const uitKlasse = (klasseId: string | null | undefined, klassen: Klasse[], inst: PlanningInstelling): Potentie | null => {
  if (!klasseId) return null
  if (inst.klassePotentie[klasseId]) return inst.klassePotentie[klasseId]!
  const k = klassen.find((x) => x.id === klasseId)
  const standaard = KLASSEN_STANDAARD.some((s) => s.id === klasseId)
  if (!standaard) return 'middel'
  const c = klasseCode(k ?? { id: klasseId, naam: klasseId })
  return c === 'A' || c === 'B' ? 'groot' : c === 'C' ? 'middel' : 'klein'
}

/** Potentie uit het eigen veld (Omzetpotentie), de score of de klasse; de klasse is de terugval. Zonder klasse buiten de planning. */
export function potentieVan(a: PlanAccount, inst: PlanningInstelling, klassen: Klasse[] = []): Potentie | null {
  if (inst.potentieBron === 'eigenVeld' && inst.eigenVeldSleutel) {
    const w = a.cf?.[inst.eigenVeldSleutel]
    if (typeof w === 'string' && (POTENTIES as readonly string[]).includes(w.toLowerCase())) return w.toLowerCase() as Potentie
    const n = Number(w)
    if (w !== null && w !== undefined && w !== '' && Number.isFinite(n)) return n >= 100_000 ? 'groot' : n >= 25_000 ? 'middel' : 'klein'
  }
  if (inst.potentieBron === 'score' && a.score != null) return a.score >= 70 ? 'groot' : a.score >= 40 ? 'middel' : 'klein'
  return uitKlasse(a.klasse, klassen, inst)
}

const iso = (d: Date) => d.toISOString().slice(0, 10)
const dag = (j: number, m: number, d: number) => new Date(Date.UTC(j, m - 1, d))

/** Het lopende verkoopjaar: start op de eerste van de startmaand. */
export function verkoopjaar(nu: Date, startmaand: number): { jaar: number; start: string; eind: string } {
  const j = nu.getUTCFullYear()
  const m = nu.getUTCMonth() + 1
  const startJaar = m >= startmaand ? j : j - 1
  const start = dag(startJaar, startmaand, 1)
  const eind = new Date(dag(startJaar + 1, startmaand, 1).getTime() - 864e5)
  return { jaar: startJaar, start: iso(start), eind: iso(eind) }
}

/** Venster van een potentie in het verkoopjaar; klein is doorlopend. */
export function vensterVan(potentie: Potentie, jaarStart: string, vensters: PlanningInstelling['vensters'] = PLANNING_STANDAARD.vensters): { van: string; tot: string } {
  const s = new Date(`${jaarStart}T00:00:00Z`)
  const maanden = potentie === 'klein' ? 12 : vensters[potentie]
  const tot = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + maanden, 1) - 864e5)
  return { van: jaarStart, tot: iso(tot) }
}

/** Maandnummer 1..12 binnen het verkoopjaar van een datum. */
export function maandInJaar(datum: string, jaarStart: string): number {
  const d = new Date(`${datum.slice(0, 10)}T00:00:00Z`)
  const s = new Date(`${jaarStart}T00:00:00Z`)
  return (d.getUTCFullYear() - s.getUTCFullYear()) * 12 + d.getUTCMonth() - s.getUTCMonth() + 1
}

export interface PlanActiviteit { soort: string; uitkomst?: string | null; op: string }
/** Echte pogingen; een import, notitie of reisregel telt niet. */
export const POGING_SOORTEN = ['gebeld', 'mail', 'bericht', 'bezoek', 'linkedin', 'whatsapp', 'sms', 'kaart'] as const
const NIET_GESPROKEN = new Set(['geen_reactie', 'voicemail', 'verzonden', 'niet_bereikt', 'verkeerd_nummer', 'bezet', null, undefined, ''])

/** Benaderd en gesproken, alleen met echte pogingen in het lopende verkoopjaar. */
export function benaderdDitJaar(activiteiten: PlanActiviteit[], jaar: { start: string; eind: string }): { benaderd: boolean; gesproken: boolean; afspraak: boolean; pogingen: number } {
  const binnen = activiteiten.filter((a) => (POGING_SOORTEN as readonly string[]).includes(a.soort) && a.op.slice(0, 10) >= jaar.start && a.op.slice(0, 10) <= jaar.eind)
  return {
    benaderd: binnen.length > 0, gesproken: binnen.some((a) => !NIET_GESPROKEN.has(a.uitkomst as any)), afspraak: binnen.some((a) => a.uitkomst === 'afspraak'), pogingen: binnen.length,
  }
}
export type PlanStatus = 'Nog niet benaderd' | 'Benaderd' | 'Gesproken' | 'Afspraak'
export const statusVan = (b: ReturnType<typeof benaderdDitJaar>): PlanStatus => (b.afspraak ? 'Afspraak' : b.gesproken ? 'Gesproken' : b.benaderd ? 'Benaderd' : 'Nog niet benaderd')

export interface IngedeeldAccount { id: string; potentie: Potentie | null; benaderd: boolean; venster: { van: string; tot: string } | null }
export interface MaandTegel { maand: number; label: string; groepen: { potentie: Potentie; totaal: number; benaderd: number; teLaat: number }[] }
export interface PlanningStand { jaar: { jaar: number; start: string; eind: string }; ingedeeld: number; totaal: number; zonderKlasse: number; maanden: MaandTegel[]; achterstand: Record<Potentie, number> }

const MAAND = new Intl.DateTimeFormat('nl-NL', { month: 'long', timeZone: 'UTC' })

/** Jaarkalender: per maand de groepen die aan de beurt zijn, benaderd en te laat. */
export function planningStand(accounts: IngedeeldAccount[], jaar: { jaar: number; start: string; eind: string }, nu: Date): PlanningStand {
  const vandaag = iso(nu)
  const maanden: MaandTegel[] = []
  for (let m = 1; m <= 12; m++) {
    const s = new Date(`${jaar.start}T00:00:00Z`)
    const eerste = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + m - 1, 1))
    const groepen = POTENTIES.map((p) => {
      const lijst = accounts.filter((a) => a.potentie === p && a.venster && maandInJaar(a.venster.tot, jaar.start) >= m)
      return { potentie: p, totaal: lijst.length, benaderd: lijst.filter((a) => a.benaderd).length, teLaat: lijst.filter((a) => !a.benaderd && a.venster!.tot < vandaag).length }
    }).filter((g) => g.totaal)
    maanden.push({ maand: m, label: MAAND.format(eerste), groepen })
  }
  const achterstand = Object.fromEntries(POTENTIES.map((p) => [p, accounts.filter((a) => a.potentie === p && !a.benaderd && a.venster && a.venster.tot < vandaag).length])) as Record<Potentie, number>
  return { jaar, ingedeeld: accounts.filter((a) => a.potentie).length, totaal: accounts.length, zonderKlasse: accounts.filter((a) => !a.potentie).length, maanden, achterstand }
}

export interface Knelpunt { niveau: 'urgent' | 'letop' | 'info' | 'goed'; titel: string; tekst: string; actie?: { soort: 'inplannen' | 'indelen'; potentie?: Potentie; aantal: number } }
const NIVEAU_VOLGORDE = { urgent: 0, letop: 1, info: 2, goed: 3 } as const

/** "Wat knelt er nu": signalen in vaste volgorde (urgent, let op, informatief, goed). */
export function watKnelt(stand: PlanningStand, nu: Date, vensters: PlanningInstelling['vensters'] = PLANNING_STANDAARD.vensters): Knelpunt[] {
  const uit: Knelpunt[] = []
  const maand = MAAND.format(nu)
  const s = new Date(`${stand.jaar.start}T00:00:00Z`)
  const maandenTekst = (n: number) => { const l = Array.from({ length: n }, (_, i) => MAAND.format(new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + i, 1)))); return l.length === 1 ? l[0]! : `${l.slice(0, -1).join(', ')} en ${l.at(-1)}` }
  for (const p of ['groot', 'middel'] as const) {
    const n = stand.achterstand[p]
    if (n) uit.push({ niveau: p === 'groot' ? 'urgent' : 'letop', titel: `Achterstallig · ${POTENTIE_LABEL[p]}`, tekst: `Het is ${maand} en ${n} ${p === 'groot' ? 'grote' : 'middelgrote'} prospects zijn nog niet benaderd. Dat hoorde in ${maandenTekst(vensters[p])}.`, actie: { soort: 'inplannen', potentie: p, aantal: n } })
  }
  if (stand.achterstand.klein) uit.push({ niveau: 'info', titel: 'Kleine prospects', tekst: `${stand.achterstand.klein} kleine prospects zijn dit verkoopjaar nog niet benaderd.`, actie: { soort: 'inplannen', potentie: 'klein', aantal: stand.achterstand.klein } })
  if (stand.zonderKlasse) uit.push({ niveau: 'letop', titel: 'Buiten de planning', tekst: `${stand.zonderKlasse} prospects zonder klasse`, actie: { soort: 'indelen', aantal: stand.zonderKlasse } })
  if (!uit.length) uit.push({ niveau: 'goed', titel: 'Op schema', tekst: 'Iedereen die aan de beurt was, is benaderd.' })
  return uit.sort((a, b) => NIVEAU_VOLGORDE[a.niveau] - NIVEAU_VOLGORDE[b.niveau])
}

export interface BlokMoment { start: string; minuten: number }
/** Gemiddelde belpoging inclusief notitie, voor het vullen van een blok. */
export const MINUTEN_PER_POGING = 5

/**
 * Spreidt beltaken over de koude blokken van de komende weken: per blok wat er past, per dag
 * nooit boven de capaciteit (40 beltaken, inclusief wat er al staat). Wat niet past, blijft over.
 */
export function spreidOverBlokken(accountIds: string[], blokken: BlokMoment[], tot: string, capaciteit: number, nu: Date, bestaandPerDag: Record<string, number> = {}): { verdeling: { start: string; accountIds: string[] }[]; over: string[] } {
  const rest = [...accountIds]
  const perDag = { ...bestaandPerDag }
  const verdeling: { start: string; accountIds: string[] }[] = []
  for (const b of [...blokken].sort((x, y) => x.start.localeCompare(y.start))) {
    if (!rest.length) break
    if (b.start < nu.toISOString() || b.start.slice(0, 10) > tot) continue
    const d = b.start.slice(0, 10)
    const ruimte = Math.min(Math.floor(b.minuten / MINUTEN_PER_POGING), capaciteit - (perDag[d] ?? 0))
    if (ruimte <= 0) continue
    const deel = rest.splice(0, ruimte)
    perDag[d] = (perDag[d] ?? 0) + deel.length
    verdeling.push({ start: b.start, accountIds: deel })
  }
  return { verdeling, over: rest }
}

/** Een terugkomdatum binnen de afkoelperiode schuift naar het einde ervan (7.3). */
export function metAfkoeling(datum: string, nee: NeeGegevens | null | undefined, kanaal: Kanaal): { datum: string; geschoven: boolean; tot: string | null } {
  const tot = afkoelingTot(nee, kanaal)
  return tot && datum < tot ? { datum: tot, geschoven: true, tot } : { datum, geschoven: false, tot }
}

/** Werkdagen tussen twee datums, voor "op tijd" (eerste poging uiterlijk 5 werkdagen na de terugkomdatum). */
function werkdagenTussen(van: string, tot: string): number {
  let n = 0
  const d = new Date(`${van}T12:00:00Z`)
  const e = new Date(`${tot}T12:00:00Z`)
  while (d < e) { d.setUTCDate(d.getUTCDate() + 1); if (d.getUTCDay() % 6 !== 0) n++ }
  return n
}
export const OP_TIJD_WERKDAGEN = 5

/** Hercontact op tijd: aandeel bereikte terugkomdatums met binnen 5 werkdagen een eerste poging. Norm 90 gezond, 70 aandacht. */
export function hercontactOpTijd(accounts: { terugOp: string; eerstePogingNa?: string | null }[], nu: Date): { procent: number | null; stand: 'gezond' | 'aandacht' | 'risico' | null; bereikt: number; opTijd: number } {
  const vandaag = iso(nu)
  const bereikt = accounts.filter((a) => a.terugOp <= vandaag && (!!a.eerstePogingNa || werkdagenTussen(a.terugOp, vandaag) > OP_TIJD_WERKDAGEN))
  if (!bereikt.length) return { procent: null, stand: null, bereikt: 0, opTijd: 0 }
  const opTijd = bereikt.filter((a) => a.eerstePogingNa && werkdagenTussen(a.terugOp, a.eerstePogingNa.slice(0, 10)) <= OP_TIJD_WERKDAGEN).length
  const procent = Math.round((opTijd / bereikt.length) * 100)
  return { procent, stand: procent >= 90 ? 'gezond' : procent >= 70 ? 'aandacht' : 'risico', bereikt: bereikt.length, opTijd }
}
