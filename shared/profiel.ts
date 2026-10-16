// Je eigen profiel (Account op /mij): controle van de velden, gedeeld door het scherm en de server.

export interface ProfielInvoer {
  voornaam: string
  achternaam: string
  functie: string
  telefoon: string
  mobiel: string
}

export type ProfielVeld = keyof ProfielInvoer

export const PROFIEL_MAX: Record<ProfielVeld, number> = { voornaam: 60, achternaam: 80, functie: 120, telefoon: 40, mobiel: 40 }

/** Cijfers, spaties, plus, haakjes, punt en streepje. Leeg mag. */
export const TELEFOON_PATROON = /^[\d\s+().-]*$/

export const PROFIEL_MELDING = {
  naamVerplicht: 'Vul je voornaam en achternaam in.',
  telefoonOngeldig: 'Vul een geldig telefoonnummer in: cijfers, spaties en eventueel een plus.',
  teLang: 'Een van de velden is te lang.',
} as const

/** Maakt de invoer schoon en geeft de velden die niet kloppen, met één melding voor het scherm. */
export function controleerProfiel(b: Partial<Record<ProfielVeld, unknown>> | null | undefined): { schoon: ProfielInvoer; ongeldig: ProfielVeld[]; melding: string | null } {
  const schoon = Object.fromEntries((Object.keys(PROFIEL_MAX) as ProfielVeld[]).map((k) => [k, String(b?.[k] ?? '').trim()])) as unknown as ProfielInvoer
  const leeg = (['voornaam', 'achternaam'] as const).filter((k) => !schoon[k])
  if (leeg.length) return { schoon, ongeldig: [...leeg], melding: PROFIEL_MELDING.naamVerplicht }
  const tel = (['telefoon', 'mobiel'] as const).filter((k) => !TELEFOON_PATROON.test(schoon[k]))
  if (tel.length) return { schoon, ongeldig: [...tel], melding: PROFIEL_MELDING.telefoonOngeldig }
  const lang = (Object.keys(PROFIEL_MAX) as ProfielVeld[]).filter((k) => schoon[k].length > PROFIEL_MAX[k])
  if (lang.length) return { schoon, ongeldig: lang, melding: PROFIEL_MELDING.teLang }
  return { schoon, ongeldig: [], melding: null }
}

/** Voor- en achternaam uit één naam: het eerste woord en de rest. */
export function splitsNaam(naam: string): { voornaam: string; achternaam: string } {
  const [voornaam = '', ...rest] = naam.trim().split(/\s+/)
  return { voornaam, achternaam: rest.join(' ') }
}

/** JPEG of PNG aan de eerste bytes, niet aan de naam. */
export function isJpegOfPng(b: Uint8Array): 'image/jpeg' | 'image/png' | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png'
  return null
}

export const FOTO_MAX_BYTES = 1_000_000
