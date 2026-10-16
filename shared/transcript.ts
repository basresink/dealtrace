// Transcript uploaden of plakken (afspraakvenster, in de opzet van DealDrive): tekst uit een bestand.
// Een Teams- of Zoom-transcript (.vtt, .srt) wordt een rij beurten "Spreker: tekst" zonder tijdcodes
// en zonder dubbele regels; .txt en .md blijven zoals ze zijn. Puur, zodat scherm en server dezelfde
// regels gebruiken.

export const TRANSCRIPT_EXTENSIES = ['txt', 'md', 'vtt', 'srt'] as const
export const TRANSCRIPT_MAX_BYTES = 5 * 1024 * 1024
export const TRANSCRIPT_MAX_TEKENS = 200_000

export const extensieVan = (naam: string) => (naam.split('.').pop() ?? '').toLowerCase()
export const magTranscript = (naam: string) => (TRANSCRIPT_EXTENSIES as readonly string[]).includes(extensieVan(naam))

/** Ondertitels (WebVTT of SRT) naar beurten; opeenvolgende stukken van dezelfde spreker worden één beurt. */
export function ondertitelsNaarTekst(bron: string): string {
  const regels = bron.replace(/\r\n?/g, '\n').split('\n')
  const beurten: { spreker: string | null; tekst: string }[] = []
  for (const r of regels) {
    const regel = r.trim()
    if (!regel || regel === 'WEBVTT' || /^WEBVTT\b/.test(regel) || /^(NOTE|STYLE|REGION)\b/.test(regel)) continue
    if (/^\d+$/.test(regel)) continue
    if (/-->/.test(regel)) continue
    let spreker: string | null = null
    let tekst = regel
    const v = /^<v(?:\.[^ >]*)?\s+([^>]+)>(.*)$/i.exec(regel)
    if (v) { spreker = v[1]!.trim(); tekst = v[2]! }
    else {
      const d = /^([A-Z][\p{L} .'-]{0,40}):\s+(.+)$/u.exec(regel)
      if (d) { spreker = d[1]!.trim(); tekst = d[2]! }
    }
    tekst = tekst.replace(/<[^>]+>/g, '').trim()
    if (!tekst) continue
    const vorige = beurten[beurten.length - 1]
    if (vorige && (vorige.spreker === spreker || spreker === null)) {
      if (!vorige.tekst.endsWith(tekst)) vorige.tekst = `${vorige.tekst} ${tekst}`
    } else beurten.push({ spreker, tekst })
  }
  return beurten.map((b) => (b.spreker ? `${b.spreker}: ${b.tekst}` : b.tekst)).join('\n')
}

/** De tekst uit een bestand: ondertitels omgezet, de rest ongewijzigd, ingekort tot het maximum. */
export function transcriptUitBestand(naam: string, inhoud: string): { tekst: string; woorden: number; afgekapt: boolean } {
  const ext = extensieVan(naam)
  const ruw = ext === 'vtt' || ext === 'srt' ? ondertitelsNaarTekst(inhoud) : inhoud.replace(/\r\n?/g, '\n').trim()
  const afgekapt = ruw.length > TRANSCRIPT_MAX_TEKENS
  const tekst = afgekapt ? ruw.slice(0, TRANSCRIPT_MAX_TEKENS) : ruw
  return { tekst, woorden: telWoorden(tekst), afgekapt }
}

export const telWoorden = (t: string | null | undefined) => String(t ?? '').trim().split(/\s+/).filter(Boolean).length
