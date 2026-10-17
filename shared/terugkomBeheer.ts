// Instellingen, Terugkomen: de pure rekenregels achter het beheerscherm. De terugkomdatum zelf
// komt altijd uit terugkomDatum (shared/verkoopverhaal.ts); hier staan alleen de keuzes van het
// scherm (wie pakt het op, kanaal van een regel, termijntekst), de voorbeeldberekening, het
// verhuizen van een reden naar een regel, de verschuiving bij bewaren en de tijdlijn van een ritme.
import { plusDagen, voegWerkdagenToe } from './datum'
import { AFKOELING_STANDAARD, KANAAL_LABEL, KANALEN, type Afkoeling, type Kanaal } from './nbStatus'
import { kanaalVanRegel, terugkomDatum, type ConceptTerugkomregel, type Redenmapping, type Terugkomregel } from './verkoopverhaal'

/** Wie pakt het op: drie vaste keuzes (opdrachtgever, 17 okt 2026). */
export const OPPAKKERS = ['eigenaar', 'binnendienst', 'buitendienst'] as const
export type Oppakker = typeof OPPAKKERS[number]
export const OPPAKKER_LABEL: Record<Oppakker, string> = { eigenaar: 'Eigenaar van de prospect', binnendienst: 'Binnendienst', buitendienst: 'Buitendienst' }

/** De keuze uit een regel: het eigen veld, anders afgeleid uit de rollen (Binnendienst, Buitendienst, de rest is de eigenaar). */
export function oppakkerVan(r: { oppakker?: string | null; rollen?: string[] | null }): Oppakker {
  if (r.oppakker && (OPPAKKERS as readonly string[]).includes(r.oppakker)) return r.oppakker as Oppakker
  const t = (r.rollen ?? []).join(' ').toLowerCase()
  if (t.includes('binnendienst')) return 'binnendienst'
  if (t.includes('buitendienst')) return 'buitendienst'
  return 'eigenaar'
}

/** Kanalen die een regel kan hebben, met de waarde zoals het verkoopverhaal hem opslaat. */
export const REGEL_KANALEN: { waarde: string; kanaal: Kanaal }[] = [
  { waarde: 'Telefoon', kanaal: 'bellen' }, { waarde: 'E-mail', kanaal: 'mail' }, { waarde: 'Bezoek', kanaal: 'bezoek' },
  { waarde: 'LinkedIn', kanaal: 'linkedin' }, { waarde: 'WhatsApp', kanaal: 'whatsapp' },
]
export const regelKanaalWaarde = (k: Kanaal) => REGEL_KANALEN.find((x) => x.kanaal === k)?.waarde ?? 'Telefoon'

/** "Over een halfjaar" bij de bekende termijnen, anders "Over 45 dagen". */
export function termijnTekst(dagen: number): string {
  const vast: Record<number, string> = { 0: 'direct', 30: 'Over een maand', 61: 'Over 2 maanden', 91: 'Over een kwartaal', 182: 'Over een halfjaar', 365: 'Over een jaar' }
  return vast[dagen] ?? `Over ${dagen} dagen`
}

export const BRON_LABEL: Record<Redenmapping['bronSoort'], string> = {
  nee: 'Nee gezet', deal_verloren: 'Deal verloren (DealDrive)', offerte_verloren: 'Offerte verloren (DealDrive)', slapend: 'Slapende klant',
}

export interface RegelInvoer {
  reden: string
  termijnDagen: number
  /** Kanaal van de afkoeling: bellen, mail, bezoek, linkedin of whatsapp. */
  kanaal: Kanaal
  oppakker: Oppakker
  hercontactritmeId: string | null
  aanpak: string
  lijst?: 'verloren' | 'slapend'
}

/** Controle van het formulier; leeg is goed. */
export function valideerRegel(r: Partial<RegelInvoer>): string[] {
  const f: string[] = []
  if (!r.reden?.trim()) f.push('Geef de regel een naam')
  if (!Number.isInteger(r.termijnDagen) || (r.termijnDagen as number) < 0 || (r.termijnDagen as number) > 730) f.push('Terug na is 0 tot 730 dagen')
  if (!r.kanaal || !REGEL_KANALEN.some((k) => k.kanaal === r.kanaal)) f.push('Kies een kanaal')
  if (!r.oppakker || !(OPPAKKERS as readonly string[]).includes(r.oppakker)) f.push('Kies wie het oppakt')
  if (!r.aanpak?.trim()) f.push('Schrijf de aanpak')
  return f
}

/** Het concept van een regel na een wijziging; id, lijst en klassen blijven. */
export function regelUitInvoer(oud: Partial<ConceptTerugkomregel> & { id: string }, r: RegelInvoer): ConceptTerugkomregel & { oppakker: Oppakker } {
  return {
    ...oud, id: oud.id, lijst: r.lijst ?? oud.lijst ?? 'verloren', reden: r.reden.trim(), termijnDagen: r.termijnDagen, termijn: termijnTekst(r.termijnDagen),
    kanaal: regelKanaalWaarde(r.kanaal), klassen: oud.klassen ?? [], rollen: [OPPAKKER_LABEL[r.oppakker]], oppakker: r.oppakker,
    aanpak: r.aanpak.trim(), hercontactritmeId: r.hercontactritmeId || null,
  }
}

export interface Voorbeeld { verlorenOp: string; wachttijd: number; ondergrens: number; dagen: number; terugOp: string; opgeschoven: boolean; kanaal: Kanaal }
/** "Verloren op X wordt terug op Y": dezelfde som als terugkomDatum, voor één regel. */
export function voorbeeld(r: { termijnDagen: number; kanaal: string }, afkoeling: Partial<Afkoeling>, verlorenOp: string): Voorbeeld {
  const stand = { terugkomregels: [{ id: 'vb', lijst: 'verloren', reden: 'vb', termijn: '', termijnDagen: r.termijnDagen, kanaal: r.kanaal, rollen: [], aanpak: '' } as Terugkomregel], redenmapping: [{ bronSoort: 'nee' as const, reden: 'vb', terugkomregelId: 'vb' }] }
  const v = terugkomDatum('vb', stand, new Date(`${verlorenOp}T12:00:00Z`), afkoeling, 'nee')
  const ondergrens = { ...AFKOELING_STANDAARD, ...afkoeling }[v.kanaal]
  return { verlorenOp, wachttijd: r.termijnDagen, ondergrens, dagen: v.dagen, terugOp: v.datum, opgeschoven: v.opgeschoven, kanaal: v.kanaal }
}

export interface MappingRij { bronSoort: Redenmapping['bronSoort']; reden: string; terugkomregelId: string | null }
const zelfde = (a: { bronSoort: string; reden: string }, b: { bronSoort: string; reden: string }) => a.bronSoort === b.bronSoort && a.reden === b.reden

/**
 * De redenen bij een regel kiezen. Een gekozen reden die bij een andere regel hoorde, verhuist
 * hierheen; een reden die bij deze regel hoorde en niet meer gekozen is, krijgt geen regel.
 */
export function redenVerhuist(mapping: MappingRij[], gekozen: { bronSoort: Redenmapping['bronSoort']; reden: string }[], regelId: string): { mapping: MappingRij[]; verhuisd: { reden: string; van: string }[]; losgelaten: string[] } {
  const verhuisd: { reden: string; van: string }[] = []
  const losgelaten: string[] = []
  const uit: MappingRij[] = mapping.map((m) => {
    const kies = gekozen.some((g) => zelfde(g, m))
    if (kies && m.terugkomregelId !== regelId) { if (m.terugkomregelId) verhuisd.push({ reden: m.reden, van: m.terugkomregelId }); return { ...m, terugkomregelId: regelId } }
    if (!kies && m.terugkomregelId === regelId) { losgelaten.push(m.reden); return { ...m, terugkomregelId: null } }
    return { ...m }
  })
  for (const g of gekozen) if (!uit.some((m) => zelfde(m, g)) && g.reden !== 'Niet geschikt') uit.push({ bronSoort: g.bronSoort, reden: g.reden, terugkomregelId: regelId })
  return { mapping: uit, verhuisd, losgelaten }
}

export interface Stand { terugkomregels: Terugkomregel[]; redenmapping: Redenmapping[] }
export interface WachtendeProspect {
  id: string; naam: string; reden: string; bronSoort?: Redenmapping['bronSoort']
  /** Moment van het verlies (ISO). */
  verlorenOp: string
  /** De opgeslagen terugkomdatum. */
  terugOp: string
  /** Met de hand aangepast (Pas datum aan). */
  hand?: boolean
  /** Het hercontact loopt al (taak of reeks). */
  gestart?: boolean
}
export interface Verschuiving { id: string; naam: string; van: string; naar: string; kanaalVan: Kanaal; kanaalNaar: Kanaal; regelVan: string | null; regelNaar: string | null }

/**
 * Wat er verschuift bij bewaren. Alleen prospects die nog niet gestart zijn en geen met de hand
 * aangepaste datum hebben. Een opgeslagen datum die niet meer klopt met de huidige regels telt als
 * aangepast en blijft staan. "Niet geschikt" heeft geen regel en verschuift nooit.
 */
export function verschuiving(prospects: WachtendeProspect[], oud: { stand: Stand; afkoeling: Partial<Afkoeling> }, nieuw: { stand: Stand; afkoeling: Partial<Afkoeling> }): Verschuiving[] {
  const uit: Verschuiving[] = []
  for (const p of prospects) {
    if (p.gestart || p.hand || p.reden === 'Niet geschikt') continue
    const op = new Date(p.verlorenOp)
    if (Number.isNaN(op.getTime())) continue
    const o = terugkomDatum(p.reden, oud.stand, op, oud.afkoeling, p.bronSoort)
    if (o.datum !== p.terugOp) continue
    const n = terugkomDatum(p.reden, nieuw.stand, op, nieuw.afkoeling, p.bronSoort)
    if (n.datum === o.datum && n.kanaal === o.kanaal && (n.regel?.id ?? null) === (o.regel?.id ?? null)) continue
    uit.push({ id: p.id, naam: p.naam, van: o.datum, naar: n.datum, kanaalVan: o.kanaal, kanaalNaar: n.kanaal, regelVan: o.regel?.id ?? null, regelNaar: n.regel?.id ?? null })
  }
  return uit.sort((a, b) => a.naar.localeCompare(b.naar) || a.naam.localeCompare(b.naam))
}

/** Een afkoeling uit invoer: elk kanaal een geheel getal van 0 tot 730, anders null. */
export function leesAfkoeling(v: unknown): Afkoeling | null {
  if (!v || typeof v !== 'object') return null
  const a = v as Record<string, unknown>
  const uit = {} as Afkoeling
  for (const k of KANALEN) {
    const n = Number(a[k])
    if (!Number.isInteger(n) || n < 0 || n > 730) return null
    uit[k] = n
  }
  return uit
}

/** Een regel die korter wacht dan de afkoeling van zijn kanaal: de tekst voor de waarschuwing. Wie de afkoeling
 * niet mag wijzigen (`magAfkoeling: false`), krijgt geen advies om hem te verlagen. */
export function korterDanAfkoeling(r: { termijnDagen: number; kanaal: string }, afkoeling: Partial<Afkoeling>, opties: { magAfkoeling?: boolean } = {}): string | null {
  const k = kanaalVanRegel(r.kanaal)
  const grens = { ...AFKOELING_STANDAARD, ...afkoeling }[k]
  if (r.termijnDagen >= grens) return null
  return `${r.termijnDagen} dagen is korter dan de afkoeling van ${grens} dagen voor ${KANAAL_LABEL[k].toLowerCase()}. De datum schuift dus naar dag ${grens}. ${opties.magAfkoeling === false ? 'Wil je echt eerder terug, kies dan bij de regel een ander kanaal. De afkoeling past alleen de beheerder aan.' : 'Wil je echt eerder terug, verlaag dan de afkoeling of kies een ander kanaal.'}`
}

export interface TijdlijnStap { nr: number; dag: number; datum: string; kanaal: string; tekst: string }
/** De stappen van een ritme op echte datums vanaf de startdag; een stap in het weekend of op een feestdag schuift naar de volgende werkdag. */
export function ritmeTijdlijn(stappen: { dagOffset: number; kanaal: string; instructie?: string }[], parkeerDagen: number, start: string): { stappen: TijdlijnStap[]; parkeren: { vanaf: string; terugOp: string } } {
  const s = [...stappen].sort((a, b) => a.dagOffset - b.dagOffset)
  const begin = voegWerkdagenToe(start, 0)
  const lijst = s.map((x, i) => ({ nr: i + 1, dag: x.dagOffset, datum: voegWerkdagenToe(plusDagen(begin, x.dagOffset), 0), kanaal: x.kanaal, tekst: x.instructie ?? '' }))
  const laatste = s.at(-1)?.dagOffset ?? 0
  const vanaf = plusDagen(begin, laatste + 1)
  return { stappen: lijst, parkeren: { vanaf, terugOp: plusDagen(vanaf, Math.max(1, parkeerDagen)) } }
}

const DAGEN = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za']
const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']
const KORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
const d = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`)
/** "ma 2 nov" */
export const terugDagKort = (iso: string) => { const x = d(iso); return `${DAGEN[x.getUTCDay()]} ${x.getUTCDate()} ${KORT[x.getUTCMonth()]}` }
/** "2 november 2026" */
export const terugDagLang = (iso: string) => { const x = d(iso); return `${x.getUTCDate()} ${MAANDEN[x.getUTCMonth()]} ${x.getUTCFullYear()}` }
