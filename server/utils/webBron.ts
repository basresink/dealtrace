// Webzoeker voor de Zoeker (F02, 11.4): echte zoekresultaten en pagina's als materiaal,
// met bewijsplicht. De Zoeker mag alleen URL's uit deze resultaten noemen. Tot de
// AI-koppeling met websearch (F23) draait altijd de mock met vaste fixtures.
import { GRENZEN } from '../../shared/leadGenerator'
import { MOCK_BEDRIJVEN, mockPagina, mockZoekresultaten } from './bronnen/kvkMock'

export interface Zoekresultaat { url: string; titel: string; fragment: string }

/** Hooguit drie zoekopdrachten; dubbele URL's één keer. */
export async function zoekWeb(vragen: string[]): Promise<Zoekresultaat[]> {
  const uit = new Map<string, Zoekresultaat>()
  for (const v of vragen.filter(Boolean).slice(0, GRENZEN.zoekopdrachtenPerRonde)) {
    for (const r of mockZoekresultaten(v)) if (!uit.has(r.url)) uit.set(r.url, { ...r, titel: `${r.titel} | ${plaatsVan(r.url)}` })
  }
  return [...uit.values()].slice(0, GRENZEN.bedrijvenPerRonde)
}

/** De tekst van een pagina, met de datum van ophalen voor de houdbaarheid. */
export async function haalPagina(url: string): Promise<{ url: string; tekst: string; opgehaald: string } | null> {
  const tekst = mockPagina(url)
  return tekst ? { url, tekst, opgehaald: new Date().toISOString() } : null
}

const MOCK_PLAATS = new Map(MOCK_BEDRIJVEN.filter((b) => b.website).map((b) => [b.website!, b.plaats]))
const plaatsVan = (url: string) => MOCK_PLAATS.get(url) ?? ''

export interface VolgbronPagina { url: string; titel: string; tekst: string; datum: string }
const hashTekst = (t: string) => [...t].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 7)

/**
 * Een gevolgde pagina (extra bron van een account of contact) voor de Waarnemer. Een bekende pagina komt uit
 * haalPagina; anders een vaste mockpagina die per URL en per week verandert, zodat het volgen te testen is.
 * Tot de echte webkoppeling (F23) draait altijd de mock.
 */
export async function haalVolgbron(url: string, nu = new Date()): Promise<VolgbronPagina | null> {
  const datum = nu.toISOString().slice(0, 10)
  const host = url.replace(/^https?:\/\/(www\.)?/i, '').split('/')[0] ?? url
  const echt = await haalPagina(url)
  if (echt) return { url, titel: host, tekst: echt.tekst, datum }
  const week = Math.floor(nu.getTime() / (7 * 864e5))
  const h = hashTekst(`${url}:${week}`)
  const onderwerp = ['een nieuw project in de regio', 'een uitbreiding van het team', 'een nieuwe vestiging', 'de vervanging van de installaties'][h % 4]
  return { url, titel: `Nieuw op ${host}`, tekst: `Op ${host} staat een nieuw bericht over ${onderwerp}. Bijgewerkt op ${datum}.`, datum }
}

/** Een korte vingerafdruk van een pagina, om te zien of hij sinds de vorige ronde veranderde. */
export const vingerafdruk = (tekst: string) => hashTekst(tekst.replace(/Bijgewerkt op \d{4}-\d{2}-\d{2}\./g, '').replace(/\s+/g, ' ').trim()).toString(36)
