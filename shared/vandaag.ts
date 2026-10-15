// Vandaag (F01): de aanleiding van de dag en de samenvattingsregel. Puur.
export interface InzichtKort { id: string; accountId: string | null; status: string; relevanceScore: number; createdAt: string; ownerId: string | null }

/** Ongelezen, relevantie 85 of hoger, jonger dan 48 uur, op een eigen account: de hoogste (en dan de nieuwste) wint. */
export function kiesAanleidingVanDeDag<T extends InzichtKort>(inzichten: T[], gebruikerId: string, eigenAccounts: Set<string>, nu: Date): T | null {
  const grens = nu.getTime() - 48 * 3600_000
  return inzichten
    .filter((i) => i.status === 'nieuw' && i.relevanceScore >= 85 && Date.parse(i.createdAt) >= grens && i.accountId && eigenAccounts.has(i.accountId) && (i.ownerId === gebruikerId || !i.ownerId))
    .sort((a, b) => b.relevanceScore - a.relevanceScore || b.createdAt.localeCompare(a.createdAt))[0] ?? null
}

/** "6 taken · 3 uit campagnes · volgende koude actie 10:00". */
export function samenvattingsregel(p: { taken: number; uitCampagnes: number; volgendeKoud?: string | null; koudeNorm?: { gedaan: number; norm: number } | null }): string {
  if (!p.taken) return 'Niets te doen. De motor zet nieuwe pogingen klaar zodra ze aan de beurt zijn.'
  const delen = [`${p.taken} ${p.taken === 1 ? 'taak' : 'taken'}`]
  if (p.uitCampagnes) delen.push(`${p.uitCampagnes} uit campagnes`)
  if (p.koudeNorm) delen.push(`koude norm ${p.koudeNorm.gedaan} van ${p.koudeNorm.norm} deze maand`)
  if (p.volgendeKoud) delen.push(`volgende koude actie ${p.volgendeKoud}`)
  return delen.join(' · ')
}

export function groetVoor(nu: Date): string {
  const uur = Number(new Intl.DateTimeFormat('nl-NL', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Amsterdam' }).format(nu))
  return uur < 12 ? 'Goedemorgen' : uur < 18 ? 'Goedemiddag' : 'Goedenavond'
}

/** "VANDAAG · DINSDAG 13 OKTOBER · WEEK 42" */
export function vandaagKicker(nu: Date): string {
  const dag = new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' }).format(nu).toUpperCase()
  const d = new Date(Date.UTC(nu.getUTCFullYear(), nu.getUTCMonth(), nu.getUTCDate()))
  const wd = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - wd)
  const week = Math.ceil(((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7)
  return `VANDAAG · ${dag} · WEEK ${week}`
}
