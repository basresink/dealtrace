// Werkdagen en Nederlandse feestdagen (bouwplan, Bijlage A gat 15).
// Alle datums zijn ISO-datums (JJJJ-MM-DD) zonder tijdzone.

export interface WerkdagInstelling {
  /** Werkdagen als weekdagnummers, 1 = maandag ... 7 = zondag. Standaard maandag tot en met vrijdag. */
  werkdagen?: number[]
  /** Bevrijdingsdag (5 mei): 'altijd', 'lustrum' (elke vijf jaar, standaard) of 'nooit'. */
  bevrijdingsdag?: 'altijd' | 'lustrum' | 'nooit'
  /** Eigen vrije dagen van de organisatie (ISO-datums). */
  extraVrij?: string[]
}

const STANDAARD_WERKDAGEN = [1, 2, 3, 4, 5]

function iso(j: number, m: number, d: number): string {
  return `${j}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function naarDatum(isoDatum: string): Date {
  const [j, m, d] = isoDatum.split('-').map(Number)
  return new Date(Date.UTC(j!, m! - 1, d!))
}

function vanDatum(d: Date): string {
  return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
}

export function plusDagen(isoDatum: string, n: number): string {
  const d = naarDatum(isoDatum)
  d.setUTCDate(d.getUTCDate() + n)
  return vanDatum(d)
}

/** Weekdag: 1 = maandag ... 7 = zondag. */
export function weekdag(isoDatum: string): number {
  const w = naarDatum(isoDatum).getUTCDay()
  return w === 0 ? 7 : w
}

/** Eerste Paasdag volgens de algoritme van Meeus/Jones/Butcher. */
export function pasen(jaar: number): string {
  const a = jaar % 19
  const b = Math.floor(jaar / 100)
  const c = jaar % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const maand = Math.floor((h + l - 7 * m + 114) / 31)
  const dag = ((h + l - 7 * m + 114) % 31) + 1
  return iso(jaar, maand, dag)
}

/** De Nederlandse feestdagen van een jaar, met naam. */
export function feestdagen(jaar: number, instelling: WerkdagInstelling = {}): { datum: string; naam: string }[] {
  const p = pasen(jaar)
  // Koningsdag: 27 april, of 26 april als 27 april op zondag valt.
  const koningsdag = weekdag(iso(jaar, 4, 27)) === 7 ? iso(jaar, 4, 26) : iso(jaar, 4, 27)
  const lijst = [
    { datum: iso(jaar, 1, 1), naam: 'Nieuwjaarsdag' },
    { datum: p, naam: 'Eerste Paasdag' },
    { datum: plusDagen(p, 1), naam: 'Tweede Paasdag' },
    { datum: koningsdag, naam: 'Koningsdag' },
    { datum: plusDagen(p, 39), naam: 'Hemelvaartsdag' },
    { datum: plusDagen(p, 49), naam: 'Eerste Pinksterdag' },
    { datum: plusDagen(p, 50), naam: 'Tweede Pinksterdag' },
    { datum: iso(jaar, 12, 25), naam: 'Eerste Kerstdag' },
    { datum: iso(jaar, 12, 26), naam: 'Tweede Kerstdag' },
  ]
  const bevrijding = instelling.bevrijdingsdag ?? 'lustrum'
  if (bevrijding === 'altijd' || (bevrijding === 'lustrum' && jaar % 5 === 0)) {
    lijst.push({ datum: iso(jaar, 5, 5), naam: 'Bevrijdingsdag' })
  }
  return lijst.sort((x, y) => x.datum.localeCompare(y.datum))
}

export function isFeestdag(isoDatum: string, instelling: WerkdagInstelling = {}): boolean {
  const jaar = Number(isoDatum.slice(0, 4))
  return feestdagen(jaar, instelling).some((f) => f.datum === isoDatum)
}

export function isWerkdag(isoDatum: string, instelling: WerkdagInstelling = {}): boolean {
  const werkdagen = instelling.werkdagen ?? STANDAARD_WERKDAGEN
  if (!werkdagen.includes(weekdag(isoDatum))) return false
  if (instelling.extraVrij?.includes(isoDatum)) return false
  return !isFeestdag(isoDatum, instelling)
}

/** De eerstvolgende werkdag na de gegeven datum. */
export function volgendeWerkdag(isoDatum: string, instelling: WerkdagInstelling = {}): string {
  let d = plusDagen(isoDatum, 1)
  for (let i = 0; i < 400 && !isWerkdag(d, instelling); i++) d = plusDagen(d, 1)
  return d
}

/** Aantal werkdagen van `van` tot en met `tot`. */
export function telWerkdagen(van: string, tot: string, instelling: WerkdagInstelling = {}): number {
  if (tot < van) return 0
  let n = 0
  for (let d = van; d <= tot; d = plusDagen(d, 1)) if (isWerkdag(d, instelling)) n++
  return n
}

/** n werkdagen na de datum (n = 0 geeft de datum zelf als het een werkdag is, anders de volgende werkdag). */
export function voegWerkdagenToe(isoDatum: string, n: number, instelling: WerkdagInstelling = {}): string {
  let d = isWerkdag(isoDatum, instelling) ? isoDatum : volgendeWerkdag(isoDatum, instelling)
  for (let i = 0; i < n; i++) d = volgendeWerkdag(d, instelling)
  return d
}

const TZ = 'Europe/Amsterdam'

/** Datum en uur in Nederland voor een moment. */
export function nlMoment(t: Date): { datum: string; uur: number; minuut: number } {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(t).map((x) => [x.type, x.value]))
  return { datum: `${p.year}-${p.month}-${p.day}`, uur: Number(p.hour), minuut: Number(p.minute) }
}

/** Het moment (UTC) dat in Nederland op `datum` om `uur`:00 valt. */
export function nlTijdstip(datum: string, uur: number, minuut = 0): Date {
  const gok = new Date(`${datum}T${String(uur).padStart(2, '0')}:${String(minuut).padStart(2, '0')}:00Z`)
  const m = nlMoment(gok)
  const verschil = (m.uur - uur) * 60 + (m.minuut - minuut) + (m.datum === datum ? 0 : m.datum > datum ? 24 * 60 : -24 * 60)
  return new Date(gok.getTime() - verschil * 60_000)
}

/** Het volgende hele werkuur (9 tot 18, geen weekend of feestdag) in Nederland. */
export function volgendWerkmoment(nu: Date, instelling: WerkdagInstelling = {}): Date {
  const m = nlMoment(nu)
  if (isWerkdag(m.datum, instelling)) {
    const uur = m.minuut > 0 ? m.uur + 1 : m.uur
    if (uur < 9) return nlTijdstip(m.datum, 9)
    if (uur <= 17) return nlTijdstip(m.datum, uur)
  }
  return nlTijdstip(volgendeWerkdag(m.datum, instelling), 9)
}
