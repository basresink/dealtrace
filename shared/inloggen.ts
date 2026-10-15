// Inloggen met een code per mail (P27, B12, 15.3): de regels op één plek.
export const CODE_GELDIG_MINUTEN = 10
export const CODES_PER_UUR = 5
export const POGINGEN_PER_CODE = 5
export const SESSIE_DAGEN = 30

export const BEVESTIG_TEKST = 'Als dit adres bij Dealtrace hoort, staat er een code in je mail.'
export const CODE_FOUT_TEKST = 'Deze code klopt niet of is verlopen. Vraag een nieuwe code aan.'
export const LIMIET_TEKST = 'Je hebt te vaak een code aangevraagd. Probeer het over een uur opnieuw.'
export const GEARCHIVEERD_TEKST = 'Je account is gearchiveerd. Vraag je beheerder om toegang.'

export const normaliseerEmail = (e: string) => e.trim().toLowerCase()
export const geldigEmailadres = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())

/** Precies 5 aanvragen binnen 60 minuten mag; de zesde niet. Oudere aanvragen tellen niet. */
export function magCodeAanvragen(aanvragen: (string | Date)[], nu: Date): boolean {
  const grens = nu.getTime() - 60 * 60_000
  return aanvragen.filter((a) => new Date(a).getTime() > grens).length < CODES_PER_UUR
}

/** Naam van het toestel uit de user-agent, bijvoorbeeld "iPhone · Safari" of "Windows · Chrome". */
export function toestelLabel(ua: string | null | undefined): string {
  const u = ua ?? ''
  const os = /iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) ? 'iPad' : /Android/.test(u) ? 'Android' : /Mac OS X/.test(u) ? 'Mac' : /Windows/.test(u) ? 'Windows' : /Linux/.test(u) ? 'Linux' : 'Onbekend toestel'
  const br = /Edg\//.test(u) ? 'Edge' : /Firefox\//.test(u) ? 'Firefox' : /Chrome\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : 'browser'
  return `${os} · ${br}`
}
