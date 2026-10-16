// Kanalen en consent (P26, F16 punt 6, F22, 7.2, 15.2) en meldingen per soort en kanaal (F24, 8.10).
// Eén definitie voor de verzender op de server, Mijn instellingen en de pagina Kanalen en consent.
import { normaliseerTelefoon } from './contactgegevens'
import { nlMoment, plusDagen, telWerkdagen, type WerkdagInstelling } from './datum'
import { AFKOELING_STANDAARD, type Kanaal } from './nbStatus'

// ── Meldingen per soort en kanaal ──────────────────────────────────────────

/** De soorten in de tabel notificaties, met kleur (F24). "info" valt onder Dealtrace. */
export const MELDING_SOORTEN = ['kritiek', 'hot', 'dagstart', 'herinnering', 'inzicht', 'systeem'] as const
export type MeldingSoort = typeof MELDING_SOORTEN[number]
export const MELDING_SOORT_LABEL: Record<MeldingSoort, string> = { kritiek: 'Kritiek', hot: 'Hete aanleiding', dagstart: 'Dagstart', herinnering: 'Herinnering', inzicht: 'Inzicht', systeem: 'Dealtrace' }
export const MELDING_SOORT_UITLEG: Record<MeldingSoort, string> = {
  kritiek: 'Iets wat vandaag misgaat als je niets doet, zoals een koppeling die stuk is.',
  hot: 'Een hete aanleiding bij een eigen account, of een account dat aan jou is overgedragen.',
  dagstart: 'Je dag in het kort: afspraken, belacties en de eerste afspraak.',
  herinnering: 'Taken en afspraken die eraan komen, vertrek, briefing en verslag.',
  inzicht: 'Wat opvalt in je cijfers en de recap van je dag.',
  systeem: 'Concepten ter goedkeuring, afspraken van collega\'s, functies die voor je aangaan, credits.',
}
export const soortVan = (s: string): MeldingSoort => (MELDING_SOORTEN as readonly string[]).includes(s) ? s as MeldingSoort : 'systeem'

export const MELDING_KANALEN = ['inApp', 'email', 'push'] as const
export type MeldingKanaal = typeof MELDING_KANALEN[number]
export const MELDING_KANAAL_LABEL: Record<MeldingKanaal, string> = { inApp: 'In de app', email: 'E-mail', push: 'Push' }
export type KanaalKeuze = Record<MeldingKanaal, boolean>
export type KanaalVoorkeuren = Partial<Record<MeldingSoort, Partial<KanaalKeuze>>>

/** Standaard: alles in de app en als push; per e-mail alleen kritiek. */
export const KANAAL_STANDAARD: Record<MeldingSoort, KanaalKeuze> = {
  kritiek: { inApp: true, email: true, push: true },
  hot: { inApp: true, email: false, push: true },
  dagstart: { inApp: true, email: false, push: true },
  herinnering: { inApp: true, email: false, push: true },
  inzicht: { inApp: true, email: false, push: false },
  systeem: { inApp: true, email: false, push: true },
}

/**
 * De kanalen van een soort voor deze gebruiker. Het oude veld `meldingen[soort] = false` (P01) zet
 * de soort helemaal uit; anders de keuze per kanaal boven de standaard.
 */
export function kanalenVoor(soort: string, voorkeuren: KanaalVoorkeuren | null | undefined, oud?: Record<string, boolean> | null): KanaalKeuze {
  const s = soortVan(soort)
  if (oud?.[s] === false) return { inApp: false, email: false, push: false }
  return { ...KANAAL_STANDAARD[s], ...(voorkeuren?.[s] ?? {}) }
}

/** Houdt de gebruiker nu meldingen vast (rijmodus of belblok met meldingen stil)? */
export function houdtVast(data: { rijmodus?: { aan?: boolean } | null; stil?: { tot?: string } | null } | null | undefined, nu: Date): 'rijmodus' | 'belblok' | null {
  if (data?.rijmodus?.aan) return 'rijmodus'
  if (data?.stil?.tot && Date.parse(data.stil.tot) > nu.getTime()) return 'belblok'
  return null
}

/** Teller in de kop: leeg bij nul, "9+" boven negen. */
export const tellerTekst = (n: number) => (n <= 0 ? '' : n > 9 ? '9+' : String(n))

/** Vastgehouden meldingen (rijmodus, belblok) als één samenvatting per soort, meeste eerst. */
export function bundel(meldingen: { soort: string; titel: string }[]): { soort: MeldingSoort; aantal: number; titel: string; tekst: string }[] {
  const per = new Map<MeldingSoort, string[]>()
  for (const m of meldingen) { const s = soortVan(m.soort); per.set(s, [...(per.get(s) ?? []), m.titel]) }
  return [...per.entries()].sort((a, b) => b[1].length - a[1].length || MELDING_SOORTEN.indexOf(a[0]) - MELDING_SOORTEN.indexOf(b[0]))
    .map(([soort, titels]) => ({ soort, aantal: titels.length, titel: titels.length === 1 ? titels[0]! : `${titels.length} meldingen: ${MELDING_SOORT_LABEL[soort]}`, tekst: titels.length === 1 ? '' : titels.slice(0, 3).join(' · ') + (titels.length > 3 ? ` en ${titels.length - 3} meer` : '') }))
}

/** Eén pushtekst voor alles wat tijdens de rijmodus of het belblok bleef liggen. */
export function bundelTitel(b: ReturnType<typeof bundel>): string {
  const n = b.reduce((s, x) => s + x.aantal, 0)
  if (n === 1) return b[0]!.titel
  return `${n} meldingen terwijl je bezig was: ${b.map((x) => `${x.aantal} ${MELDING_SOORT_LABEL[x.soort].toLowerCase()}`).join(', ')}`
}

// ── Kanalen en consent ─────────────────────────────────────────────────────

export interface Frequentieplafond { werkdagen: number; maxBerichten: number }
export const FREQUENTIE_STANDAARD: Frequentieplafond = { werkdagen: 3, maxBerichten: 1 }
export const kanaalInstelling = (afk: Partial<Record<Kanaal, number>> | null | undefined, fp: Partial<Frequentieplafond> | null | undefined) => ({
  afkoeling: { ...AFKOELING_STANDAARD, ...(afk ?? {}) }, frequentieplafond: { ...FREQUENTIE_STANDAARD, ...(fp ?? {}) },
})

export type ConsentStatus = 'onbekend' | 'ja' | 'nee'
export interface Consent { status: ConsentStatus; op?: string | null; bron?: string | null }
export const CONSENT_LABEL: Record<ConsentStatus, string> = { onbekend: 'Onbekend', ja: 'Ja', nee: 'Nee' }

/** Mag de frequentie nog? Hooguit `maxBerichten` per `werkdagen` werkdagen buiten het ritme (feestdagen tellen niet). */
export function binnenFrequentie(eerdere: string[], vandaag: string, fp: Frequentieplafond = FREQUENTIE_STANDAARD, w: WerkdagInstelling = {}): boolean {
  const recent = eerdere.filter((d) => d <= vandaag && telWerkdagen(plusDagen(d.slice(0, 10), 1), vandaag, w) < fp.werkdagen)
  return recent.length < fp.maxBerichten
}

export interface WhatsappContact { mobiel?: string | null; consent?: { whatsapp?: Consent | null } | null; belMeNiet?: boolean }
export interface WhatsappSjabloon { status: 'concept' | 'ingediend' | 'goedgekeurd' | 'afgewezen' }
export interface WhatsappStand {
  /** Datum van de laatste nee op WhatsApp (afkoeling 180 dagen, 7.2). */
  neeOp?: string | null
  /** Eerdere WhatsApp-berichten buiten het ritme aan dit account (ISO). */
  eerdere?: string[]
  afkoelDagen?: number
  frequentieplafond?: Frequentieplafond
  werkdagen?: WerkdagInstelling
  /** Bericht binnen een lopend ritme telt niet mee voor het plafond. */
  binnenRitme?: boolean
}

/** WhatsApp alleen met opt-in en een goedgekeurd sjabloon, buiten de afkoeling en binnen het frequentieplafond (15.2, F16). */
export function magWhatsapp(contact: WhatsappContact, sjabloon: WhatsappSjabloon | null, nu: Date, s: WhatsappStand = {}): { mag: boolean; reden: string } {
  if (!contact.mobiel || !normaliseerTelefoon(contact.mobiel).ok) return { mag: false, reden: 'Geen mobiel nummer bekend' }
  if (contact.consent?.whatsapp?.status !== 'ja') return { mag: false, reden: 'Geen consent voor WhatsApp' }
  if (!sjabloon || sjabloon.status !== 'goedgekeurd') return { mag: false, reden: 'Geen goedgekeurd sjabloon' }
  const vandaag = nlMoment(nu).datum
  if (s.neeOp && plusDagen(s.neeOp.slice(0, 10), s.afkoelDagen ?? AFKOELING_STANDAARD.whatsapp) > vandaag) return { mag: false, reden: 'In afkoelperiode na een nee' }
  if (!s.binnenRitme && !binnenFrequentie(s.eerdere ?? [], vandaag, s.frequentieplafond, s.werkdagen)) return { mag: false, reden: 'Frequentieplafond: al een bericht in de laatste werkdagen' }
  return { mag: true, reden: 'ok' }
}

/** https://wa.me/<E.164 zonder plus>?text=; null zonder geldig nummer. */
export function waLink(nummer: string | null | undefined, tekst: string): string | null {
  if (!nummer) return null
  const n = normaliseerTelefoon(nummer)
  return n.ok ? `https://wa.me/${n.e164.slice(1)}?text=${encodeURIComponent(tekst)}` : null
}

/** Het nummer genormaliseerd naar E.164; daarna vergelijken (of hashen) met de bel-me-niet-lijst. */
export function staatOpBelMeNiet(nummer: string | null | undefined, lijst: Iterable<string>): boolean {
  if (!nummer) return false
  const n = normaliseerTelefoon(nummer)
  if (!n.ok) return false
  for (const x of lijst) { const y = normaliseerTelefoon(x); if (y.ok && y.e164 === n.e164) return true }
  return false
}

/** WhatsApp-sjabloon: naam in kleine letters met underscores (zoals Meta vraagt), tekst hooguit 60 woorden. */
export function controleerSjabloon(s: { naam?: string; taal?: string; tekst?: string }): string[] {
  const f: string[] = []
  if (!s.naam || !/^[a-z0-9_]{3,60}$/.test(s.naam)) f.push('Naam: kleine letters, cijfers en _ (3 tot 60 tekens)')
  if (!s.taal || !/^[a-z]{2}(_[A-Z]{2})?$/.test(s.taal)) f.push('Kies een taal, zoals nl')
  const woorden = (s.tekst ?? '').trim().split(/\s+/).filter(Boolean).length
  if (!woorden) f.push('Tekst ontbreekt')
  else if (woorden > 60) f.push('Hooguit 60 woorden')
  if (/[–—]/.test(s.tekst ?? '')) f.push('Gebruik geen gedachtestreepjes')
  return f
}

/** Mail-voorwaarden: SPF, DKIM en DMARC moeten alle drie in orde zijn voordat Dealtrace mailt. */
export const mailKlaar = (d: { spf?: boolean | null; dkim?: boolean | null; dmarc?: boolean | null }) => !!(d.spf && d.dkim && d.dmarc)
