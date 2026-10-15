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
