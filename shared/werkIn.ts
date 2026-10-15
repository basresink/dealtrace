// Werken in een organisatie (13.3 flow 4). De cookie is ondertekend; deze
// functies rekenen alleen met de inhoud nadat de handtekening is gecontroleerd.

export type WerkModus = 'meekijken' | 'wijzigen'
export const WERK_IN_MAX_MS = 8 * 3600 * 1000
export const HERBEVESTIG_MS = 15 * 60 * 1000
export const MEEKIJKTEKST = 'Je kijkt mee in deze organisatie; schakel over naar wijzigen om iets aan te passen.'

export interface WerkInInhoud {
  founderId: string
  organisatieId: string
  modus: WerkModus
  reden: string
  /** Begin, ISO. */
  start: string
  /** Vervaltijd, ISO; hooguit 8 uur na start. */
  tot: string
}

export interface WerkIn {
  organisatieId: string
  modus: WerkModus
  reden: string
  resterendMs: number
}

/** Geldig werk-in voor deze founder op dit moment, of null (verlopen, ongeldig, andere founder). */
export function werkInGeldig(inhoud: WerkInInhoud | null, founderId: string, nu: Date): WerkIn | null {
  if (!inhoud || inhoud.founderId !== founderId) return null
  if (inhoud.modus !== 'meekijken' && inhoud.modus !== 'wijzigen') return null
  const start = Date.parse(inhoud.start)
  const tot = Math.min(Date.parse(inhoud.tot), start + WERK_IN_MAX_MS)
  if (Number.isNaN(start) || Number.isNaN(tot)) return null
  const resterendMs = tot - nu.getTime()
  if (resterendMs <= 0) return null
  return { organisatieId: inhoud.organisatieId, modus: inhoud.modus, reden: inhoud.reden, resterendMs }
}

/** Gewone gebruiker ja; founder in werk-in alleen bij "Ook wijzigen". */
export function magSchrijvenInOrganisatie(sessie: { werkIn?: Pick<WerkIn, 'modus'> | null }): boolean {
  if (!sessie.werkIn) return true
  return sessie.werkIn.modus === 'wijzigen'
}

export function geldigeReden(reden: unknown): reden is string {
  return typeof reden === 'string' && reden.trim().length >= 5
}

/** "nog 7 uur 42" voor de gele balk. */
export function resterendTekst(ms: number): string {
  const min = Math.max(0, Math.floor(ms / 60000))
  const uur = Math.floor(min / 60)
  return uur ? `nog ${uur} uur ${String(min % 60).padStart(2, '0')}` : `nog ${min} min`
}
