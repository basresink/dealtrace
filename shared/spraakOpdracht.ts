// Spraakopdracht (P31, 8.5.6): één ingesproken zin wordt één concept (taak, notitie, afspraak of
// mail). Het account komt uit de lijst echte namen en wordt hier gecontroleerd; daarna pas de
// persoon tussen de contacten van dat account. Twijfel geeft een vraag met twee knoppen, nooit een gok.
import { dice, normaliseerNaam } from './ontdubbelen'
import { nlMoment, plusDagen } from './datum'

export type OpdrachtSoort = 'taak' | 'notitie' | 'afspraak' | 'mail'
export interface OpdrachtAntwoord { soort: OpdrachtSoort; accountNaam: string | null; persoonNaam?: string | null; titel: string; datum?: string | null; tijd?: string | null }
export interface Concept { soort: OpdrachtSoort; accountId: string; accountNaam: string; contactId: string | null; contactNaam: string | null; titel: string; datum: string | null; tijd: string | null; checks: string[] }
export type Uitkomst = { soort: 'concept'; concept: Concept } | { soort: 'vraag'; vraag: string; kandidaten: { id: string; naam: string }[]; antwoord: OpdrachtAntwoord } | { soort: 'fout'; tekst: string }

export const ONVERSTAAN = 'Dat verstond ik niet. Probeer het nog eens of typ je opdracht.'
const DAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag']
const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']
const TIENTAL: Record<string, number> = { een: 1, twee: 2, drie: 3, vier: 4, vijf: 5, zes: 6, zeven: 7, acht: 8, negen: 9, tien: 10 }

/** Datum uit gewone taal: vandaag, morgen, overmorgen, (volgende week) dinsdag, over 3 dagen, 21 oktober, in september. */
export function leesDatum(tekst: string, nu: Date): { datum: string; label: string } | null {
  const t = tekst.toLowerCase()
  const vandaag = nlMoment(nu).datum
  const label = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
  const uit = (d: string) => ({ datum: d, label: label(d) })
  if (/\bovermorgen\b/.test(t)) return uit(plusDagen(vandaag, 2))
  if (/\bmorgen\b/.test(t)) return uit(plusDagen(vandaag, 1))
  if (/\bvandaag\b/.test(t)) return uit(vandaag)
  const over = /\bover (\d+|een|twee|drie|vier|vijf|zes|zeven|acht|negen|tien) (dag|dagen|week|weken)\b/.exec(t)
  if (over) { const n = Number(over[1]) || TIENTAL[over[1]!]!; return uit(plusDagen(vandaag, over[2]!.startsWith('week') ? n * 7 : n)) }
  const dm = new RegExp(`\\b(\\d{1,2}) (${MAANDEN.join('|')})\\b`).exec(t)
  if (dm) {
    const m = MAANDEN.indexOf(dm[2]!); let jaar = Number(vandaag.slice(0, 4))
    let d = `${jaar}-${String(m + 1).padStart(2, '0')}-${dm[1]!.padStart(2, '0')}`
    if (d < vandaag) { jaar++; d = `${jaar}-${d.slice(5)}` }
    return uit(d)
  }
  const dag = new RegExp(`\\b(volgende week )?(${DAGEN.join('|')})\\b`).exec(t)
  if (dag) {
    const doel = DAGEN.indexOf(dag[2]!)
    const nuWd = new Date(`${vandaag}T12:00:00Z`).getUTCDay()
    let n = (doel - nuWd + 7) % 7 || 7
    if (dag[1]) { const maandagVolgende = plusDagen(vandaag, ((8 - nuWd) % 7) || 7); n = Math.round((Date.parse(`${maandagVolgende}T12:00:00Z`) - Date.parse(`${vandaag}T12:00:00Z`)) / 864e5) + ((doel + 6) % 7) }
    return uit(plusDagen(vandaag, n))
  }
  const maand = new RegExp(`\\bin (${MAANDEN.join('|')})\\b`).exec(t)
  if (maand) { const m = MAANDEN.indexOf(maand[1]!); let jaar = Number(vandaag.slice(0, 4)); if (m + 1 < Number(vandaag.slice(5, 7))) jaar++; return uit(`${jaar}-${String(m + 1).padStart(2, '0')}-01`) }
  return null
}
/** Tijd uit gewone taal: "om 10 uur", "10:30", "half 3". */
export function leesTijd(tekst: string): string | null {
  const t = tekst.toLowerCase()
  const hm = /\b(\d{1,2})[:.](\d{2})\b/.exec(t)
  if (hm) return `${hm[1]!.padStart(2, '0')}:${hm[2]}`
  const uur = /\bom (\d{1,2}) ?uur\b/.exec(t)
  if (uur) { const h = Number(uur[1]); return `${String(h < 7 ? h + 12 : h).padStart(2, '0')}:00` }
  const half = /\bhalf (\d{1,2})\b/.exec(t)
  if (half) { const h = Number(half[1]) - 1; return `${String(h < 7 ? h + 12 : h).padStart(2, '0')}:30` }
  return null
}

/** Een naam kiezen uit een lijst: zeker, twijfel tussen twee, of niets. */
export function kiesNaam<T extends { id: string; naam: string }>(gezocht: string | null | undefined, lijst: T[]): { zeker: T } | { twijfel: [T, T] } | { geen: true } {
  const g = normaliseerNaam(String(gezocht ?? ''))
  if (!g) return { geen: true }
  const score = lijst.map((x) => {
    const n = normaliseerNaam(x.naam)
    const woorden = n.split(' ')
    return { x, s: n === g ? 1 : n.includes(g) || g.includes(n) ? 0.95 : Math.max(dice(n, g), ...woorden.map((w) => (w.length > 3 && g.includes(w) ? 0.9 : dice(w, g)))) }
  }).sort((a, b) => b.s - a.s)
  const [a, b] = score
  if (!a || a.s < 0.75) return { geen: true }
  if (b && b.s >= 0.75 && a.s - b.s < 0.05) return { twijfel: [a.x, b.x] }
  return { zeker: a.x }
}

/**
 * Het AI-antwoord controleren: het account moet in de lijst staan (anders een vraag of een
 * weigering), de persoon tussen de contacten van dat account, de soort binnen het niveau.
 */
export function controleerOpdracht(a: OpdrachtAntwoord, accounts: { id: string; naam: string }[], contactenVan: (accountId: string) => { id: string; naam: string }[], toegestaan: OpdrachtSoort[], nu: Date, vastAccountId?: string | null): Uitkomst {
  if (!a || !a.titel?.trim()) return { soort: 'fout', tekst: ONVERSTAAN }
  if (!toegestaan.includes(a.soort)) return { soort: 'fout', tekst: a.soort === 'afspraak' ? 'Een afspraak inspreken staat voor jou nog niet aan. Maak er een taak van of plan hem in de agenda.' : 'Een mail inspreken staat voor jou nog niet aan.' }
  const checks: string[] = []
  let account = vastAccountId ? accounts.find((x) => x.id === vastAccountId) ?? null : null
  if (!account) {
    const k = kiesNaam(a.accountNaam, accounts)
    if ('twijfel' in k) return { soort: 'vraag', vraag: 'Welk account bedoel je?', kandidaten: k.twijfel.map((x) => ({ id: x.id, naam: x.naam })), antwoord: a }
    if ('geen' in k) return { soort: 'fout', tekst: a.accountNaam ? `Ik vind geen account "${a.accountNaam}" bij jouw accounts. Kies het account of typ de opdracht.` : 'Over welk account gaat dit? Open het account en spreek het opnieuw in.' }
    account = k.zeker
  }
  checks.push(`Account gevonden: ${account.naam}`)
  let contact: { id: string; naam: string } | null = null
  if (a.persoonNaam) {
    const k = kiesNaam(a.persoonNaam, contactenVan(account.id))
    if ('twijfel' in k) return { soort: 'vraag', vraag: 'Welke persoon bedoel je?', kandidaten: k.twijfel.map((x) => ({ id: x.id, naam: x.naam })), antwoord: { ...a, accountNaam: account.naam } }
    if ('zeker' in k) { contact = k.zeker; checks.push(`Persoon gevonden: ${contact.naam}`) } else checks.push(`${a.persoonNaam} staat niet bij dit account; de taak komt zonder persoon`)
  }
  let datum = a.datum && /^\d{4}-\d{2}-\d{2}$/.test(a.datum) ? a.datum : null
  if (datum) checks.push(`Datum gelezen als ${new Date(`${datum}T12:00:00Z`).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}`)
  if (!datum && a.soort !== 'notitie') { datum = plusDagen(nlMoment(nu).datum, 1); checks.push('Geen datum genoemd: morgen') }
  const tijd = a.tijd && /^\d{2}:\d{2}$/.test(a.tijd) ? a.tijd : null
  if (a.soort === 'afspraak' && !tijd) checks.push('Geen tijd genoemd: 10:00')
  return { soort: 'concept', concept: { soort: a.soort, accountId: account.id, accountNaam: account.naam, contactId: contact?.id ?? null, contactNaam: contact?.naam ?? null, titel: a.titel.trim().slice(0, 200), datum, tijd: a.soort === 'afspraak' ? tijd ?? '10:00' : tijd, checks } }
}

/** De mock van het model: soort uit het werkwoord, account uit de namen in de zin, datum en tijd uit de taal. */
export function mockOpdracht(zin: string, accounts: { naam: string }[], nu: Date): OpdrachtAntwoord {
  const t = zin.trim()
  const l = t.toLowerCase()
  const soort: OpdrachtSoort = /^(noteer|notitie|onthoud)/.test(l) ? 'notitie' : /^(plan|maak een afspraak|afspraak)/.test(l) ? 'afspraak' : /^(mail|stuur)/.test(l) ? 'mail' : 'taak'
  const account = [...accounts].sort((a, b) => b.naam.length - a.naam.length).find((a) => l.includes(a.naam.toLowerCase()) || normaliseerNaam(a.naam).split(' ').some((w) => w.length > 4 && l.includes(w)))
  const persoon = /\b(?:[Bb]el|[Mm]et|[Mm]ail|[Aa]an)\s+([A-Z][a-z]+)/.exec(t)?.[1] ?? null
  const d = leesDatum(t, nu)
  const titel = t.replace(/^(noteer dat|noteer|notitie|onthoud dat|plan)\s+/i, '').replace(/\s+/g, ' ')
  return { soort, accountNaam: account?.naam ?? null, persoonNaam: persoon, titel: titel.charAt(0).toUpperCase() + titel.slice(1), datum: d?.datum ?? null, tijd: leesTijd(t) }
}
