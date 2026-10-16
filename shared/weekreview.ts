// Persoonlijke weekreview (F10): vrijdag in vijf minuten vier kaarten. Wat bewoog (cijfers tegen je
// eigen gemiddelde van acht weken), wat werkte (patronen, alleen bij genoeg gesprekken), wat bleef
// liggen (taken die drie keer of vaker zijn doorgeschoven) en volgende week (hooguit drie voornemens die
// meteen iets concreets worden). Jij tegen jezelf, nooit tegen collega's. Puur, met `nu` als parameter.
import { isWerkdag, nlMoment, plusDagen, type WerkdagInstelling } from './datum'
import { weeknummer } from './gebieden'
import { MINIMUM, NORMEN, TE_WEINIG, genoegOmTeVergelijken, isContact, isGesproken, kpi, tempo, type KpiActiviteit, type Periode } from './team'

export const WEEKREVIEW_UUR = { uur: 15, minuut: 30 }
export const MAX_VOORNEMENS = 3
export const BLIJVER_VANAF = 3
export const VERGELIJK_WEKEN = 8
/** Een belmoment telt pas mee vanaf zoveel pogingen in dat uur. */
export const MIN_POGINGEN_PER_MOMENT = 5

export const DAGNAAM = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'] as const
export const hoofd = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
export const voornaam = (naam: string) => naam.replace(/^Testgebruiker /, '').split(' ')[0] ?? naam
const mv = (n: number, een: string, meer: string) => `${n} ${n === 1 ? een : meer}`
const uurTekst = (u: number) => `${String(u).padStart(2, '0')}:00`
const wd = (datum: string) => new Date(`${datum}T12:00:00Z`).getUTCDay()

/** De maandag van de week van een datum (zaterdag en zondag horen bij de week ervoor). */
export function maandagVan(datum: string): string {
  return plusDagen(datum, -((wd(datum) + 6) % 7))
}

export interface BlijverBron { id: string; titel: string; accountNaam: string | null; accountId: string | null; verschoven: number; dueDate: string | null; actionType: string }
export type BlijverBesluit = 'inplannen' | 'overdragen' | 'loslaten'
export interface RegioBron { id: string; naam: string; stil: number; accountIds: string[]; datum?: string | null }
export interface VoornemenBron { id: string; tekst: string; soort: VoornemenSoort; status: string; gedeeld: boolean; data: Record<string, any> }
export type VoornemenSoort = 'belblok' | 'taak' | 'regiodag'

export interface WeekreviewBron {
  gebruiker: { id: string; naam: string; werkplek?: string | null }
  /** Eigen activiteiten van de laatste negen weken. */
  activiteiten: KpiActiviteit[]
  /** Momenten van eigen overdrachten (ISO). */
  overdrachten: string[]
  /** Open taken met hun teller verschoven. */
  blijvers: BlijverBron[]
  /** Het winpunt uit het belscript per account (laatste invulling). */
  winpunten: { accountId: string; titel: string }[]
  /** Regio's met stille accounts (voor de voorstellen van een regiodag), alleen buiten- en hybride dienst. */
  regios?: RegioBron[]
  zonderVerslag?: number
  /** Besluiten die al in deze review vielen, per taak. */
  besluiten?: Record<string, { besluit: BlijverBesluit; reden?: string | null; datum?: string | null; naar?: string | null }>
  /** Kunnen taken naar een collega? */
  collegas?: boolean
  /** De voornemens voor de week die nu loopt (uit de vorige review), met hun stand. */
  lopend?: (VoornemenBron & { stand: VoornemenStand })[]
  /** De voornemens die in deze review al zijn ingepland (voor de week erna). */
  ingepland?: VoornemenBron[]
  werkdagen?: WerkdagInstelling
}

export interface Cijfer { sleutel: 'gesprekken' | 'afspraken' | 'overdrachten' | 'bereik' | 'pogingen'; label: string; waarde: number; eenheid: '' | '%'; gemiddelde: number | null; verschil: number | null; tekst: string; richting: 'hoger' | 'lager' | 'gelijk' | 'geen' }
export interface Patroon { soort: 'belmoment' | 'winpunt'; titel: string; tekst: string }
export interface Blijver extends BlijverBron { tekst: string; keuzes: BlijverBesluit[]; besluit: { besluit: BlijverBesluit; reden?: string | null; datum?: string | null; naar?: string | null } | null }
export interface VoornemenVoorstel { sleutel: string; soort: VoornemenSoort; tekst: string; wordt: string; data: Record<string, any>; gekozen: boolean }

export interface Weekreview {
  week: { nummer: number; van: string; tot: string; volgende: string }
  titel: string
  klaar: boolean
  moment: string
  bewoog: { kop: string; cijfers: Cijfer[]; genoeg: boolean; melding: string | null }
  werkte: { kop: string; patronen: Patroon[]; melding: string | null }
  liggen: { kop: string; blijvers: Blijver[] }
  volgende: { kop: string; voorstellen: VoornemenVoorstel[]; ingepland: VoornemenBron[]; max: number }
  lopend: { tekst: string; stand: VoornemenStand }[]
  samenvatting: string
}

/** De weekreview staat vrijdag vanaf 15:30 klaar; daarvoor kun je hem al openen. */
export function reviewKlaar(nu: Date): boolean {
  const m = nlMoment(nu)
  const d = wd(m.datum)
  return d === 6 || d === 0 || (d === 5 && m.uur * 60 + m.minuut >= WEEKREVIEW_UUR.uur * 60 + WEEKREVIEW_UUR.minuut)
}

/** De werkweek van maandag tot vrijdag; een lopende week telt tot vandaag. */
export function reviewWeek(maandag: string, vandaag: string): Periode {
  const vrijdag = plusDagen(maandag, 4)
  return { van: maandag, tot: vandaag < vrijdag ? vandaag : vrijdag }
}

const gem = (l: number[]) => (l.length ? Math.round((l.reduce((s, x) => s + x, 0) / l.length) * 10) / 10 : 0)
const nl = (n: number) => String(n).replace('.', ',')
function vergelijk(sleutel: Cijfer['sleutel'], label: string, waarde: number, eerder: number[] | null, eenheid: '' | '%' = ''): Cijfer {
  if (!eerder) return { sleutel, label, waarde, eenheid, gemiddelde: null, verschil: null, tekst: TE_WEINIG, richting: 'geen' }
  const g = gem(eerder)
  const verschil = Math.round((waarde - g) * 10) / 10
  const rond = Math.round(verschil)
  const eenheidTekst = eenheid === '%' ? (Math.abs(rond) === 1 ? ' punt' : ' punten') : ''
  if (rond === 0) return { sleutel, label, waarde, eenheid, gemiddelde: g, verschil, tekst: 'gelijk aan je gemiddelde', richting: 'gelijk' }
  return { sleutel, label, waarde, eenheid, gemiddelde: g, verschil, tekst: `${rond > 0 ? '+' : ''}${rond}${eenheidTekst} tegen je gemiddelde`, richting: rond > 0 ? 'hoger' : 'lager' }
}

/** Het beste en het zwakste belmoment (weekdag en uur) uit de eigen belpogingen. */
export function belmomenten(activiteiten: KpiActiviteit[], gebruikerId: string): { beste: Moment | null; zwakste: Moment | null; gesprekken: number } {
  const per = new Map<string, Moment>()
  let gesprekken = 0
  for (const a of activiteiten) {
    if (a.door !== gebruikerId || a.soort !== 'gebeld' || a.intern) continue
    const m = nlMoment(new Date(a.op))
    const dag = wd(m.datum)
    if (dag === 0 || dag === 6) continue
    const k = `${dag}|${m.uur}`
    const x = per.get(k) ?? { weekdag: dag, uur: m.uur, pogingen: 0, opgenomen: 0, afspraken: 0, procent: 0 }
    x.pogingen++
    if (isGesproken(a)) { x.opgenomen++; gesprekken++ }
    if (a.uitkomst === 'afspraak') x.afspraken++
    per.set(k, x)
  }
  const lijst = [...per.values()].filter((x) => x.pogingen >= MIN_POGINGEN_PER_MOMENT).map((x) => ({ ...x, procent: Math.round((x.opgenomen / x.pogingen) * 100) }))
  const op = [...lijst].sort((a, b) => b.procent - a.procent || b.afspraken - a.afspraken || b.pogingen - a.pogingen || a.weekdag - b.weekdag || a.uur - b.uur)
  const beste = op[0] ?? null
  const zwakste = op.length > 1 ? op[op.length - 1]! : null
  return { beste, zwakste: zwakste && beste && zwakste.procent < beste.procent ? zwakste : null, gesprekken }
}
export interface Moment { weekdag: number; uur: number; pogingen: number; opgenomen: number; afspraken: number; procent: number }

/** Het winpunt dat het vaakst in het script stond bij de afspraken van deze week (minstens twee keer). */
export function winpuntDatRaakte(afspraakAccounts: string[], winpunten: { accountId: string; titel: string }[]): { titel: string; aantal: number; van: number } | null {
  const per = new Map(winpunten.map((w) => [w.accountId, w.titel]))
  const tel = new Map<string, number>()
  for (const a of afspraakAccounts) { const t = per.get(a); if (t) tel.set(t, (tel.get(t) ?? 0) + 1) }
  const top = [...tel].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]
  return top && top[1] >= 2 ? { titel: top[0], aantal: top[1], van: afspraakAccounts.length } : null
}

export interface VoornemenStand { tekst: string; klaar: boolean; gedaan: number; totaal: number }
/** De stand van een voornemen uit de taken en belblokken die het werd. */
export function voornemenStand(v: Pick<VoornemenBron, 'soort' | 'data' | 'status'>, bron: { taken: { id: string; status: string }[]; sessies: { id: string; status: string; start?: string }[] }, nu?: Date): VoornemenStand {
  if (v.status === 'gedaan') return { tekst: 'Gedaan', klaar: true, gedaan: 1, totaal: 1 }
  if (v.soort === 'belblok') {
    const ids: string[] = v.data?.sessieIds ?? []
    const s = bron.sessies.filter((x) => ids.includes(x.id) && x.status !== 'geannuleerd')
    const gehouden = s.filter((x) => x.status === 'klaar').length
    if (!s.length) return { tekst: 'Geen belblok meer in je agenda', klaar: false, gedaan: 0, totaal: ids.length }
    const komend = nu ? s.filter((x) => x.status === 'gepland' && x.start && Date.parse(x.start) > nu.getTime()).length : 0
    return { tekst: gehouden === s.length ? `${mv(gehouden, 'belblok', 'belblokken')} gehouden` : `${gehouden} van ${s.length} belblokken gehouden${komend ? `, ${komend} nog gepland` : ''}`, klaar: gehouden === s.length, gedaan: gehouden, totaal: s.length }
  }
  const ids: string[] = v.data?.taakIds ?? []
  const t = bron.taken.filter((x) => ids.includes(x.id) && x.status !== 'geannuleerd')
  const klaar = t.filter((x) => x.status === 'klaar').length
  if (!t.length) return { tekst: 'Niet meer gepland', klaar: false, gedaan: 0, totaal: ids.length }
  if (v.soort === 'regiodag') return { tekst: `${klaar} van ${mv(t.length, 'bezoek', 'bezoeken')} gedaan`, klaar: klaar === t.length, gedaan: klaar, totaal: t.length }
  return { tekst: klaar === t.length ? 'Gedaan' : 'Staat nog open', klaar: klaar === t.length, gedaan: klaar, totaal: t.length }
}

/** De voorstellen voor volgende week, uit wat de review liet zien. Hooguit vijf, de eerste twee gekozen. */
export function voornemenVoorstellen(p: { beste: Moment | null; tempoAchter: boolean; beslisserLaag: boolean; zonderVerslag: number; regios: RegioBron[]; werkplek?: string | null; volgende: string; blijvers: number }): VoornemenVoorstel[] {
  const uit: Omit<VoornemenVoorstel, 'gekozen'>[] = []
  if (p.beste) {
    const tweede = p.beste.weekdag + 2 <= 5 ? p.beste.weekdag + 2 : p.beste.weekdag - 2
    const dagen = [p.beste.weekdag, tweede].sort((a, b) => a - b)
    uit.push({ sleutel: 'belmoment', soort: 'belblok', tekst: `Belblok naar ${DAGNAAM[dagen[0]!]} en ${DAGNAAM[dagen[1]!]} ${uurTekst(p.beste.uur)}`, wordt: 'Wordt: twee belblokken van een uur in je agenda', data: { dagen, uur: p.beste.uur, minuten: 60 } })
  }
  if (p.tempoAchter) {
    const uur = p.beste?.uur ?? 10
    uit.push({ sleutel: 'tempo', soort: 'belblok', tekst: 'Een extra belblok op maandag', wordt: `Wordt: een belblok maandag om ${uurTekst(uur)}`, data: { dagen: [1], uur, minuten: 60 } })
  }
  const regio = p.werkplek !== 'binnendienst' ? p.regios.filter((r) => r.stil >= 2 && r.accountIds.length).sort((a, b) => b.stil - a.stil || a.naam.localeCompare(b.naam))[0] : undefined
  if (regio) {
    const datum = regio.datum ?? plusDagen(p.volgende, 3)
    const n = Math.min(4, regio.accountIds.length)
    uit.push({ sleutel: `regio:${regio.id}`, soort: 'regiodag', tekst: `Bezoeken in ${regio.naam} combineren`, wordt: `Wordt: regiodag ${DAGNAAM[wd(datum)]} met ${mv(n, 'bezoek', 'bezoeken')}`, data: { regioId: regio.id, regioNaam: regio.naam, datum, accountIds: regio.accountIds.slice(0, 4) } })
  }
  if (p.zonderVerslag > 0) uit.push({ sleutel: 'verslag', soort: 'taak', tekst: 'Leg elk verslag dezelfde dag vast', wordt: `Wordt: een taak maandag 09:00 voor ${mv(p.zonderVerslag, 'open verslag', 'open verslagen')}`, data: { datum: p.volgende, uur: 9, titel: 'Verslagen bijwerken' } })
  if (p.beslisserLaag) uit.push({ sleutel: 'beslisser', soort: 'taak', tekst: 'Vraag in elk gesprek naar de beslisser', wordt: 'Wordt: een herinnering maandag om 08:30', data: { datum: p.volgende, uur: 8, minuut: 30, titel: 'Vraag in elk gesprek naar de beslisser' } })
  if (p.blijvers > 0) uit.push({ sleutel: 'blijvers', soort: 'taak', tekst: 'Begin maandag met wat bleef liggen', wordt: 'Wordt: een taak maandag om 08:30', data: { datum: p.volgende, uur: 8, minuut: 30, titel: 'Eerst wat bleef liggen' } })
  if (uit.length < 2) uit.push({ sleutel: 'eerste-afspraken', soort: 'belblok', tekst: 'Een belblok voor nieuwe eerste afspraken', wordt: `Wordt: een belblok dinsdag om ${uurTekst(p.beste?.uur ?? 10)}`, data: { dagen: [2], uur: p.beste?.uur ?? 10, minuten: 60 } })
  return uit.slice(0, 5).map((v, i) => ({ ...v, gekozen: i < 2 }))
}

/** De hele review. `maandag` kiest de week; zonder is het de week van `nu`. */
export function weekreview(bron: WeekreviewBron, nu: Date, opties: { maandag?: string } = {}): Weekreview {
  const vandaag = nlMoment(nu).datum
  const maandag = opties.maandag ?? maandagVan(vandaag)
  const periode = reviewWeek(maandag, vandaag)
  const volgende = plusDagen(maandag, 7)
  const g = bron.gebruiker
  const eigen = bron.activiteiten.filter((a) => a.door === g.id)
  const k = kpi(g.id, periode, eigen)
  const weken: Periode[] = Array.from({ length: VERGELIJK_WEKEN }, (_, i) => ({ van: plusDagen(maandag, -7 * (i + 1)), tot: plusDagen(maandag, -7 * (i + 1) + 4) }))
  const eerder = weken.map((p) => kpi(g.id, p, eigen))
  const binnen = (op: string, p: Periode) => { const d = nlMoment(new Date(op)).datum; return d >= p.van && d <= p.tot }
  const overNu = bron.overdrachten.filter((o) => binnen(o, periode)).length
  const overEerder = weken.map((p) => bron.overdrachten.filter((o) => binnen(o, p)).length)
  const totaalEerder = eerder.reduce((s, x) => s + x.gesprekken, 0)
  const genoeg = genoegOmTeVergelijken(totaalEerder, 'gesprekken')
  const vgl = genoeg.genoeg
  const bereik = (x: { gesprekken: number; pogingen: number }) => (x.pogingen ? Math.round((x.gesprekken / x.pogingen) * 100) : 0)
  const t = tempo(k, g.werkplek)
  const cijfers: Cijfer[] = [
    vergelijk('gesprekken', 'Gesprekken', k.gesprekken, vgl ? eerder.map((x) => x.gesprekken) : null),
    vergelijk('afspraken', 'Afspraken', k.afspraken, vgl ? eerder.map((x) => x.afspraken) : null),
    vergelijk('overdrachten', 'Overdrachten', overNu, vgl ? overEerder : null),
    vergelijk('bereik', 'Bereik', bereik(k), vgl ? eerder.filter((x) => x.pogingen).map(bereik) : null, '%'),
    { sleutel: 'pogingen', label: 'Pogingen', waarde: k.pogingen, eenheid: '', gemiddelde: null, verschil: null, tekst: t.stand === 'geen' ? 'Geen werkdagen' : `${t.procent}% van je doel van ${t.norm}`, richting: t.stand === 'op schema' ? 'hoger' : t.stand === 'achter' ? 'lager' : 'geen' },
  ]
  const gemG = gem(eerder.map((x) => x.gesprekken))
  const gemA = gem(eerder.map((x) => x.afspraken))
  const besteA = Math.max(0, ...eerder.map((x) => x.afspraken))
  let kopBewoog: string
  const marge = Math.max(1, gemG * 0.1)
  if (vgl && k.afspraken > 0 && k.afspraken > besteA) kopBewoog = `${mv(k.afspraken, 'afspraak', 'afspraken')}, je beste week in twee maanden.`
  else if (vgl && k.gesprekken - gemG >= marge) kopBewoog = `${mv(k.gesprekken, 'gesprek', 'gesprekken')}, meer dan je gemiddelde van ${nl(gemG)}.`
  else if (vgl && gemG - k.gesprekken >= marge) kopBewoog = `${mv(k.gesprekken, 'gesprek', 'gesprekken')}, minder dan je gemiddelde van ${nl(gemG)}.`
  else if (vgl) kopBewoog = `${mv(k.gesprekken, 'gesprek', 'gesprekken')}, rond je gemiddelde.`
  else kopBewoog = `${mv(k.gesprekken, 'gesprek', 'gesprekken')} en ${mv(k.afspraken, 'afspraak', 'afspraken')} deze week.`

  // Wat werkte: patronen alleen bij genoeg gesprekken (dezelfde drempel als genoegOmTeVergelijken).
  const venster = { van: plusDagen(maandag, -7 * VERGELIJK_WEKEN), tot: periode.tot }
  const inVenster = eigen.filter((a) => binnen(a.op, venster))
  const mom = belmomenten(inVenster, g.id)
  const patronenGenoeg = genoegOmTeVergelijken(mom.gesprekken, 'gesprekken').genoeg
  const patronen: Patroon[] = []
  if (patronenGenoeg && mom.beste) {
    const b = mom.beste
    const zw = mom.zwakste
    patronen.push({ soort: 'belmoment', titel: 'Beste belmoment', tekst: `${hoofd(DAGNAAM[b.weekdag]!)} ${uurTekst(b.uur)} tot ${uurTekst(b.uur + 1)}: ${b.opgenomen} van ${b.pogingen} opgenomen${b.afspraken ? `, ${mv(b.afspraken, 'afspraak', 'afspraken')}` : ''}.${zw ? ` ${hoofd(DAGNAAM[zw.weekdag]!)} ${uurTekst(zw.uur)}: ${zw.opgenomen} van ${zw.pogingen}.` : ''}` })
  }
  const afsprakenNu = eigen.filter((a) => a.uitkomst === 'afspraak' && isContact(a) && binnen(a.op, periode) && a.accountId).map((a) => a.accountId!)
  const wp = patronenGenoeg ? winpuntDatRaakte(afsprakenNu, bron.winpunten) : null
  if (wp) patronen.push({ soort: 'winpunt', titel: 'Winpunt dat raakte', tekst: `"${wp.titel}" stond in je script bij ${wp.aantal} van je ${mv(wp.van, 'afspraak', 'afspraken')}.` })
  const kopWerkte = !patronen.length ? 'Nog geen patroon te zien.'
    : mom.beste && patronenGenoeg && wp ? `${hoofd(DAGNAAM[mom.beste.weekdag]!)} rond ${uurTekst(mom.beste.uur)} en het winpunt "${wp.titel}".`
      : mom.beste && patronenGenoeg ? `${hoofd(DAGNAAM[mom.beste.weekdag]!)} rond ${uurTekst(mom.beste.uur)} neemt men het vaakst op.` : `Het winpunt "${wp!.titel}" raakte.`
  const meldingWerkte = patronen.length ? null : patronenGenoeg ? 'Geen belmoment met genoeg pogingen om iets over te zeggen.' : `${TE_WEINIG}: patronen tonen we vanaf ${MINIMUM.gesprekken} gesprekken.`

  // Wat bleef liggen: taken die drie keer of vaker doorschoven.
  const besluiten = bron.besluiten ?? {}
  const blijvers: Blijver[] = bron.blijvers.filter((b) => b.verschoven >= BLIJVER_VANAF || besluiten[b.id])
    .sort((a, b) => b.verschoven - a.verschoven || a.titel.localeCompare(b.titel))
    .map((b) => ({ ...b, tekst: `${b.verschoven} keer verschoven`, keuzes: bron.collegas ? ['inplannen', 'overdragen', 'loslaten'] : ['inplannen', 'loslaten'], besluit: besluiten[b.id] ?? null }))
  const open = blijvers.filter((b) => !b.besluit).length
  const kopLiggen = !blijvers.length ? 'Niets bleef liggen. Geen taak schoof drie keer door.'
    : open ? `${mv(blijvers.length, 'taak', 'taken')} schoof je drie keer of vaker door.` : 'Elke blijver heeft een besluit.'

  // Volgende week.
  const ingepland = bron.ingepland ?? []
  const voorstellen = ingepland.length ? [] : voornemenVoorstellen({
    beste: patronenGenoeg ? mom.beste : null, tempoAchter: t.stand === 'achter', beslisserLaag: k.gesprekken >= MINIMUM.gesprekken && k.beslisserBereikt.waarde < NORMEN.beslisserBereikt,
    zonderVerslag: bron.zonderVerslag ?? 0, regios: bron.regios ?? [], werkplek: g.werkplek, volgende: eersteWerkdag(volgende, bron.werkdagen), blijvers: blijvers.filter((b) => !b.besluit).length,
  })
  const kopVolgende = ingepland.length ? `${mv(ingepland.length, 'voornemen staat', 'voornemens staan')} in volgende week.` : `Kies tot ${MAX_VOORNEMENS} voornemens.`

  const goed = vgl && k.afspraken >= gemA && k.gesprekken >= gemG * 0.9 && k.gesprekken > 0
  const lopend = (bron.lopend ?? []).map((v) => ({ tekst: v.tekst, stand: v.stand }))
  return {
    week: { nummer: weeknummer(maandag), van: maandag, tot: plusDagen(maandag, 4), volgende },
    titel: goed ? `Een goede week, ${voornaam(g.naam)}.` : `Je week in het kort, ${voornaam(g.naam)}.`,
    klaar: reviewKlaar(nu) || maandag < maandagVan(vandaag),
    moment: reviewKlaar(nu) || maandag < maandagVan(vandaag) ? '5 minuten · alleen voor jou' : 'Vrijdag om 15:30 staat hij klaar · alleen voor jou',
    bewoog: { kop: kopBewoog, cijfers, genoeg: vgl, melding: vgl ? null : `${TE_WEINIG}: we vergelijken vanaf ${MINIMUM.gesprekken} gesprekken in de acht weken ervoor.` },
    werkte: { kop: kopWerkte, patronen, melding: meldingWerkte },
    liggen: { kop: kopLiggen, blijvers },
    volgende: { kop: kopVolgende, voorstellen, ingepland, max: MAX_VOORNEMENS },
    lopend,
    samenvatting: `${mv(k.afspraken, 'afspraak', 'afspraken')} · ${mv(blijvers.filter((b) => !b.besluit).length, 'blijver', 'blijvers')} · 5 minuten`,
  }
}

/** De eerste werkdag vanaf een datum (een feestdag op maandag schuift naar dinsdag). */
export function eersteWerkdag(datum: string, w: WerkdagInstelling = {}): string {
  let d = datum
  for (let i = 0; i < 10 && !isWerkdag(d, w); i++) d = plusDagen(d, 1)
  return d
}

/** Hooguit drie voornemens, elk met tekst; een eigen voornemen wordt een taak. */
export function controleerVoornemens(lijst: { soort?: string; tekst?: string }[]): string[] {
  const f: string[] = []
  if (!Array.isArray(lijst) || !lijst.length) f.push('Kies minstens één voornemen')
  else if (lijst.length > MAX_VOORNEMENS) f.push(`Hooguit ${MAX_VOORNEMENS} voornemens`)
  for (const v of lijst ?? []) {
    if (!v?.tekst?.trim()) f.push('Elk voornemen heeft een tekst')
    else if (v.tekst.length > 140) f.push('Een voornemen is hooguit 140 tekens')
    if (!['belblok', 'taak', 'regiodag'].includes(String(v?.soort))) f.push('Onbekende soort voornemen')
    if (/[–—]/.test(v?.tekst ?? '')) f.push('Gebruik geen gedachtestreepjes')
  }
  return [...new Set(f)]
}

/** De momenten (start en eind) van een belblok-voornemen in de week die op `maandag` begint. */
export function belblokMomenten(data: { dagen?: number[]; uur?: number; minuut?: number; minuten?: number }, maandag: string, w: WerkdagInstelling = {}): { datum: string; uur: number; minuut: number; minuten: number }[] {
  const uur = Math.min(17, Math.max(7, Number(data.uur ?? 10)))
  return (data.dagen ?? [1]).filter((d) => d >= 1 && d <= 5).map((d) => plusDagen(maandag, d - 1)).filter((d) => isWerkdag(d, w))
    .map((datum) => ({ datum, uur, minuut: Number(data.minuut ?? 0), minuten: Math.min(120, Math.max(30, Number(data.minuten ?? 60))) }))
}
