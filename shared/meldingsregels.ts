// Meldingen voor onderweg (P31, F24, 8.10). Eén definitie voor de sweep op de server en de
// instellingen in de app (gat 16): stille uren (standaard 19:00 tot 07:00 en het weekend), een
// dagplafond van zes onderweg-meldingen, bundelen tijdens rijmodus en belblok, en per soort aan of uit.
import { nlMoment, nlTijdstip } from './datum'

export const ONDERWEG_SOORTEN = ['vertrek', 'briefing', 'verslag', 'heet', 'klaargezet', 'dagstart', 'recap'] as const
export type OnderwegSoort = typeof ONDERWEG_SOORTEN[number]
export const ONDERWEG_LABEL: Record<OnderwegSoort, string> = { vertrek: 'Vertrek', briefing: 'Briefing', verslag: 'Verslag', heet: 'Hete aanleiding', klaargezet: 'Klaargezet', dagstart: 'Dagstart', recap: 'Recap' }
/** Soort in de tabel notificaties (F24) per onderweg-melding. */
export const NOTIFICATIE_SOORT: Record<OnderwegSoort, 'herinnering' | 'hot' | 'dagstart' | 'inzicht' | 'systeem'> = { vertrek: 'herinnering', briefing: 'herinnering', verslag: 'herinnering', heet: 'hot', klaargezet: 'systeem', dagstart: 'dagstart', recap: 'inzicht' }

export interface MeldingInstelling {
  stilVan: number; stilTot: number; weekendStil: boolean; dagplafond: number; dagstart: string
  uit: OnderwegSoort[]
  /** Expert: eigen stille uren per soort. */
  perSoort?: Partial<Record<OnderwegSoort, { stilVan: number; stilTot: number }>>
}
export const MELDING_STANDAARD: MeldingInstelling = { stilVan: 19, stilTot: 7, weekendStil: true, dagplafond: 6, dagstart: '07:45', uit: [] }

/** Organisatie (dagplafond, stilte) en gebruiker samen; de gebruiker mag het plafond alleen lager zetten. */
export function meldingInstelling(org: Partial<MeldingInstelling> | null | undefined, gebruiker: Partial<MeldingInstelling> | null | undefined, expert = false): MeldingInstelling {
  const o = { ...MELDING_STANDAARD, ...(org ?? {}) }
  const g = gebruiker ?? {}
  return {
    ...o, ...g,
    dagplafond: Math.min(o.dagplafond, Number.isFinite(Number(g.dagplafond)) && expert ? Number(g.dagplafond) : o.dagplafond),
    uit: [...new Set([...(o.uit ?? []), ...(g.uit ?? [])])] as OnderwegSoort[],
    perSoort: expert ? g.perSoort : undefined,
  }
}

const stil = (uur: number, van: number, tot: number) => (van > tot ? uur >= van || uur < tot : uur >= van && uur < tot)
/** Het eerste moment na nu buiten de stille uren (en buiten het weekend als dat stil is). */
export function naStilte(nu: Date, i: Pick<MeldingInstelling, 'stilVan' | 'stilTot' | 'weekendStil'>): Date {
  let t = new Date(nu.getTime())
  for (let n = 0; n < 24 * 4; n++) {
    const m = nlMoment(t)
    const wd = new Date(`${m.datum}T12:00:00Z`).getUTCDay()
    if (!(i.weekendStil && (wd === 0 || wd === 6)) && !stil(m.uur, i.stilVan, i.stilTot)) return t
    t = nlTijdstip(m.datum, m.uur + 1)
  }
  return t
}

export interface Telling { vandaag: number; inBelblok?: boolean; rijmodus?: boolean }
/**
 * Mag deze melding nu? Uit per soort: nee. Stille uren of weekend: uitstellen tot erna (vertrek,
 * briefing en verslag hebben dan geen zin en vallen weg). Dagplafond bereikt: nee, behalve dagstart
 * en recap. Tijdens rijmodus of belblok: bundelen tot erna.
 */
export function magMelden(i: MeldingInstelling, soort: OnderwegSoort, nu: Date, t: Telling): { versturen: boolean; uitstellenTot?: string; reden: string } {
  if (i.uit.includes(soort)) return { versturen: false, reden: `${ONDERWEG_LABEL[soort]} staat uit` }
  const s = i.perSoort?.[soort] ?? i
  const m = nlMoment(nu)
  const wd = new Date(`${m.datum}T12:00:00Z`).getUTCDay()
  const tijdgebonden = soort === 'vertrek' || soort === 'briefing' || soort === 'verslag'
  if ((i.weekendStil && (wd === 0 || wd === 6)) || stil(m.uur, s.stilVan, s.stilTot)) {
    if (tijdgebonden) return { versturen: false, reden: 'Stille uren' }
    return { versturen: false, uitstellenTot: naStilte(nu, { ...i, ...s }).toISOString(), reden: 'Stille uren' }
  }
  if (soort !== 'dagstart' && soort !== 'recap' && t.vandaag >= i.dagplafond) return { versturen: false, reden: `Dagplafond van ${i.dagplafond} bereikt` }
  if (t.rijmodus || t.inBelblok) return { versturen: false, uitstellenTot: new Date(nu.getTime() + 15 * 60_000).toISOString(), reden: t.rijmodus ? 'Rijmodus: gebundeld' : 'Belblok: gebundeld' }
  return { versturen: true, reden: 'ok' }
}

/** Vertrekmelding: reistijd plus 10 minuten voor de afspraak. Zonder reistijd 30 minuten (schatting). */
export function vertrekTijd(afspraak: { start: string }, reistijdMin: number | null | undefined): Date {
  return new Date(Date.parse(afspraak.start) - ((reistijdMin ?? 30) + 10) * 60_000)
}

export interface MeldAfspraak { id: string; gebruikerId: string; accountNaam: string | null; start: string; eind: string; status: string; verslag: boolean; reistijdMin?: number | null; briefing?: string[] | null; adres?: string | null }
export interface DueMelding { soort: OnderwegSoort; sleutel: string; gebruikerId: string; titel: string; tekst: string; link: string; actie: string }
/**
 * De meldingen die nu aan de beurt zijn (binnen het venster van één sweep van 5 minuten, met
 * een marge): vertrek op reistijd plus 10, briefing 30 minuten vooraf, verslag 15 minuten na het
 * einde zonder verslag. Sleutels maken dubbel versturen onmogelijk.
 */
export function onderwegMeldingen(afspraken: MeldAfspraak[], nu: Date, vensterMin = 10): DueMelding[] {
  const uit: DueMelding[] = []
  const t = nu.getTime()
  const inVenster = (moment: number) => moment <= t && moment > t - vensterMin * 60_000
  for (const a of afspraken) {
    const naam = a.accountNaam ?? 'je afspraak'
    if (a.status === 'gepland') {
      const reis = a.reistijdMin ?? null
      if (inVenster(vertrekTijd(a, reis).getTime())) uit.push({ soort: 'vertrek', sleutel: `vertrek:${a.id}`, gebruikerId: a.gebruikerId, titel: `Vertrek over 10 minuten naar ${naam}`, tekst: reis != null ? `${reis} min rijden` : 'Reistijd geschat', link: `/onderweg`, actie: 'Navigeer' })
      if (inVenster(Date.parse(a.start) - 30 * 60_000)) uit.push({ soort: 'briefing', sleutel: `briefing:${a.id}`, gebruikerId: a.gebruikerId, titel: `Briefing: ${naam}`, tekst: (a.briefing ?? []).filter(Boolean).slice(0, 3).join(' ') || 'Open de Pitstop voor je voorbereiding.', link: `/agenda?afspraak=${a.id}`, actie: 'Lees voor' })
    }
    if (!a.verslag && a.status === 'gepland' && inVenster(Date.parse(a.eind) + 15 * 60_000)) uit.push({ soort: 'verslag', sleutel: `verslag:${a.id}`, gebruikerId: a.gebruikerId, titel: `Hoe ging het bij ${naam}?`, tekst: 'Spreek je verslag in.', link: `/onderweg?afronden=${a.id}`, actie: 'Inspreken' })
  }
  return uit
}
