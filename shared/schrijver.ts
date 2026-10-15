// De Schrijver (P18, 11.5): lengtegrenzen per kanaal, de stijlscore, de informatieplicht en de links
// om een goedgekeurd concept in de mail- of WhatsApp-app te openen. Eén keer in shared (gat 16).

export const KANALEN_SCHRIJVER = ['mail', 'linkedin', 'whatsapp', 'belscript', 'kaart'] as const
export type SchrijfKanaal = typeof KANALEN_SCHRIJVER[number]
/** Lengtegrens in woorden per kanaal (11.5). */
export const LENGTE_GRENS: Record<SchrijfKanaal, number> = { mail: 120, linkedin: 80, whatsapp: 60, belscript: 150, kaart: 40 }

export const woorden = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0)
export function lengteBinnenGrens(tekst: string, kanaal: SchrijfKanaal): { binnen: boolean; woorden: number; grens: number } {
  const n = woorden(tekst)
  return { binnen: n <= LENGTE_GRENS[kanaal], woorden: n, grens: LENGTE_GRENS[kanaal] }
}

export interface StijlProfiel { passend: string[]; vermijden: string[] }
/** Standaardprofiel tot de organisatie een eigen profiel heeft: concreet en in je-vorm; geen jargon. */
export const STIJL_STANDAARD: StijlProfiel = {
  passend: ['je', 'jullie', 'concreet', 'binnen', 'project', 'planning', 'levering', 'samen', 'vraag', 'resultaat', 'tijd', 'bouw', 'monteurs'],
  vermijden: ['synergie', 'innovatief', 'uniek', 'oplossingsgericht', 'state-of-the-art', 'win-win', 'disruptief', 'best-in-class', 'u', 'uw'],
}
/** Stijlscore: 5 + min(5, passende woorden) - 2 × vermeden woorden, begrensd op 1 tot 10. Lege tekst: 1. */
export function stijlScore(tekst: string, profiel: StijlProfiel = STIJL_STANDAARD): { score: number; passend: string[]; vermeden: string[] } {
  const w = tekst.toLowerCase().match(/[\p{L}-]+/gu) ?? []
  if (!w.length) return { score: 1, passend: [], vermeden: [] }
  const passend = [...new Set(w.filter((x) => profiel.passend.includes(x)))]
  const vermeden = [...new Set(w.filter((x) => profiel.vermijden.includes(x)))]
  return { score: Math.max(1, Math.min(10, 5 + Math.min(5, passend.length) - 2 * vermeden.length)), passend, vermeden }
}

/** De informatieplicht onder elke eerste mail (15.2): afmeldlink en privacyverklaring. */
export function afmeldVoet(afmeldUrl: string, privacyUrl: string): string {
  return `\n\n--\nWil je geen mail meer van ons? Meld je af: ${afmeldUrl}\nHoe we met je gegevens omgaan: ${privacyUrl}`
}

/** mailto: met ontvanger, onderwerp en tekst ingevuld; tekens gecodeerd. */
export function mailtoLink(c: { aan?: string | null; onderwerp?: string | null; tekst: string }): string {
  const q = [c.onderwerp ? `subject=${encodeURIComponent(c.onderwerp)}` : '', `body=${encodeURIComponent(c.tekst)}`].filter(Boolean).join('&')
  return `mailto:${c.aan ? encodeURIComponent(c.aan).replace(/%40/g, '@') : ''}?${q}`
}
/** https://wa.me/<nummer>?text=: alleen cijfers in het nummer; zonder nummer null. */
export function whatsappLink(tekst: string, nummer: string | null | undefined): string | null {
  const n = (nummer ?? '').replace(/\D/g, '').replace(/^00/, '').replace(/^0(?=6)/, '31')
  return n.length >= 8 ? `https://wa.me/${n}?text=${encodeURIComponent(tekst)}` : null
}

/** De overname van een concept (11.2): ongewijzigd, aangepast of verworpen. */
export function overname(origineel: string, definitief: string | null): 'ongewijzigd' | 'aangepast' | 'verworpen' {
  if (definitief == null) return 'verworpen'
  return origineel.trim().replace(/\s+/g, ' ') === definitief.trim().replace(/\s+/g, ' ') ? 'ongewijzigd' : 'aangepast'
}

/** SPF, DKIM en DMARC van het verzenddomein (12): voorwaarde voor de SMTP-koppeling. */
export function controleerDomeinRecords(txt: { root: string[]; dmarc: string[]; dkim: string[] }): { spf: boolean; dkim: boolean; dmarc: boolean; ontbreekt: string[] } {
  const spf = txt.root.some((r) => /^v=spf1\b/i.test(r))
  const dmarc = txt.dmarc.some((r) => /^v=DMARC1\b/i.test(r))
  const dkim = txt.dkim.some((r) => /v=DKIM1\b/i.test(r) || /\bp=[A-Za-z0-9+/=]{20,}/.test(r))
  return { spf, dkim, dmarc, ontbreekt: [!spf && 'SPF', !dkim && 'DKIM', !dmarc && 'DMARC'].filter(Boolean) as string[] }
}

/**
 * De promptketen (F23) en de promptcache (gat 24): het vaste kader, de platformlaag en de
 * organisatielaag vormen samen het vaste begin van elke aanroep en worden gecachet; de instructie van
 * de stap en het materiaal wisselen per aanroep en gaan er altijd achteraan. Het handboek
 * (docs/HOE-HET-WERKT.md) noemt precies deze onderdelen; een golden master bewaakt dat.
 */
export const PROMPTCACHE = { gecachet: ['vast kader', 'platformlaag', 'organisatielaag'], perAanroep: ['instructie van de stap', 'materiaal'] } as const
export const VAST_KADER = 'Je schrijft in het Nederlands, in de je-vorm, zonder gedachtestreepjes. Je bedenkt geen feiten: elke bewering heeft een bron uit het materiaal. Je noemt geen namen van personen. Je verstuurt nooit zelf iets; je schrijft een concept dat een mens goedkeurt.'
export function bouwPrompt(lagen: { platform?: string | null; organisatie?: string | null; instructie: string }): { gecachet: string; perAanroep: string; volledig: string } {
  const gecachet = [VAST_KADER, lagen.platform ?? '', lagen.organisatie ?? ''].filter(Boolean).join('\n\n')
  return { gecachet, perAanroep: lagen.instructie, volledig: `${gecachet}\n\n${lagen.instructie}` }
}
