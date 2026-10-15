// De agents voor interne en externe bronnen (P19, F14): Waarnemer, Verrijker, Profielbouwer en
// Notulist. Selectie per run, het dossier en zijn criteria, en de samenvatting "Door agents gedaan".

export const SIGNAALSOORTEN = ['vacature', 'nieuws', 'kvk', 'website', 'aanbesteding'] as const
export type Signaalsoort = typeof SIGNAALSOORTEN[number]
export const SIGNAALSOORT_LABEL: Record<Signaalsoort, string> = { vacature: 'Vacature', nieuws: 'Nieuws', kvk: 'KvK-mutatie', website: 'Website-wijziging', aanbesteding: 'Aanbesteding' }

export interface ProfielRegel { soort: Signaalsoort; aan: boolean; trefwoorden: string[]; minRelevantie: number; winpuntId?: string | null }
export interface WaarnemerProfiel { signaalsoorten: ProfielRegel[]; cadansDagen: number }
export const PROFIEL_STANDAARD: WaarnemerProfiel = {
  cadansDagen: 7,
  signaalsoorten: [
    { soort: 'vacature', aan: true, trefwoorden: ['servicemonteur', 'werkvoorbereider', 'projectleider'], minRelevantie: 60 },
    { soort: 'nieuws', aan: true, trefwoorden: ['nieuwbouw', 'uitbreiding', 'jubileum', 'overname'], minRelevantie: 60 },
    { soort: 'kvk', aan: true, trefwoorden: [], minRelevantie: 50 },
    { soort: 'website', aan: false, trefwoorden: [], minRelevantie: 60 },
    { soort: 'aanbesteding', aan: false, trefwoorden: [], minRelevantie: 70 },
  ],
}
/** Een profiel controleren: cadans minimaal wekelijks (niet korter dan 7 dagen). */
export function profielFouten(p: WaarnemerProfiel): string[] {
  const f: string[] = []
  if (!(p.cadansDagen >= 7)) f.push('De cadans is minimaal wekelijks (7 dagen of meer)')
  for (const r of p.signaalsoorten) {
    if (!SIGNAALSOORTEN.includes(r.soort)) f.push(`Onbekende signaalsoort ${r.soort}`)
    if (r.minRelevantie < 0 || r.minRelevantie > 100) f.push('Minimale relevantie ligt tussen 0 en 100')
  }
  return f
}

export const MAX_PER_REGEL = 25
/** Hooguit 25 accounts per regel per run; alleen als de cadans verstreken is; langst niet bekeken eerst. */
export function selecteerAccounts<T extends { id: string; laatstBekeken?: string | null }>(accounts: T[], cadansDagen: number, nu: Date, max = MAX_PER_REGEL): T[] {
  return accounts
    .filter((a) => !a.laatstBekeken || nu.getTime() - Date.parse(a.laatstBekeken) >= cadansDagen * 864e5)
    .sort((a, b) => String(a.laatstBekeken ?? '').localeCompare(String(b.laatstBekeken ?? '')) || a.id.localeCompare(b.id))
    .slice(0, max)
}

/** De zes criteria van het dossier; compleet als elk een oordeel (ja of nee) heeft. */
export const DOSSIER_CRITERIA = ['branche', 'omvang', 'locatie', 'leverancier', 'aanleiding', 'beslisser'] as const
export type DossierCriterium = typeof DOSSIER_CRITERIA[number]
export const CRITERIUM_LABEL: Record<DossierCriterium, string> = { branche: 'Branche past', omvang: 'Omvang past', locatie: 'In ons gebied', leverancier: 'Huidige leverancier bekend', aanleiding: 'Er is een aanleiding', beslisser: 'Beslisser bekend' }
export type Oordeel = { oordeel: 'ja' | 'nee' | 'onbekend'; bron?: string | null; op?: string }
export const dossierCompleet = (c: Partial<Record<DossierCriterium, Oordeel>>) => DOSSIER_CRITERIA.every((k) => c[k]?.oordeel === 'ja' || c[k]?.oordeel === 'nee')

/** Velden die de Verrijker voorstelt: alleen met bron; een patroon zonder bron is een aanname (15.1). */
export function verrijkVelden(velden: { veld: string; waarde: string; bron?: string | null; datum?: string | null; aanname?: boolean }[]): { overnemen: typeof velden; aannames: typeof velden; geweigerd: typeof velden } {
  const telefoonOfAdres = (v: string) => /telefoon|mobiel|adres|postcode/i.test(v)
  const overnemen = velden.filter((v) => v.bron && !v.aanname)
  const aannames = velden.filter((v) => !v.bron && v.aanname && !telefoonOfAdres(v.veld))
  const geweigerd = velden.filter((v) => !overnemen.includes(v) && !aannames.includes(v))
  return { overnemen, aannames, geweigerd }
}

/** "Door agents gedaan sinds gisteren": één regel uit het logboek. */
export function doorAgentsSamenvatting(runs: { agent: string; handeling: string; uitkomst: string }[]): string | null {
  const ok = runs.filter((r) => r.uitkomst === 'uitgevoerd')
  const tel = (f: (r: (typeof ok)[number]) => boolean) => ok.filter(f).length
  const delen = [
    [tel((r) => r.agent === 'verrijker'), 'dossier ververst', 'dossiers ververst'],
    [tel((r) => r.agent === 'waarnemer' && r.handeling.startsWith('inzicht')), 'nieuwe aanleiding', 'nieuwe aanleidingen'],
    [tel((r) => r.agent === 'notulist'), 'verslag geanalyseerd', 'verslagen geanalyseerd'],
    [tel((r) => r.agent === 'schrijver'), 'concept klaargezet', 'concepten klaargezet'],
    [tel((r) => r.agent === 'verzender'), 'mail verstuurd binnen een campagne', 'mails verstuurd binnen een campagne'],
  ].filter(([n]) => (n as number) > 0).map(([n, een, meer]) => `${n} ${n === 1 ? een : meer}`)
  return delen.length ? delen.join(' · ') : null
}
