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

/** De cijfers achter het dashboard op Vandaag ("Jouw resultaten · deze maand"). */
export interface DashboardStand {
  prospects: number; zonderContact: number; inzichtenOpen: number; verlopen: number; afsprakenMaand: number
  tempo: { stand: 'op schema' | 'achter' | 'geen'; pogingen: number }; conversie: { waarde: number; noemer: number | null }
}
/** Eén zin die de stand samenvat en een duiding eronder; de eerste regel die past, wint. */
export function dashboardKop(s: DashboardStand): { kop: string; duiding: string } {
  const mv = (n: number, een: string, meer: string) => `${n} ${n === 1 ? een : meer}`
  const kop = s.inzichtenOpen > 5
    ? `${mv(s.inzichtenOpen, 'inzicht wacht', 'inzichten wachten')}. Er ligt ruimte om op te pakken.`
    : s.tempo.stand === 'op schema'
      ? `Op schema: ${mv(s.tempo.pogingen, 'poging', 'pogingen')} deze week en ${mv(s.afsprakenMaand, 'afspraak', 'afspraken')} deze maand.`
      : s.afsprakenMaand > 0
        ? `${mv(s.afsprakenMaand, 'afspraak', 'afspraken')} deze maand. Elke poging brengt de volgende dichterbij.`
        : `${mv(s.prospects, 'prospect', 'prospects')} in je lijst. Elke dag dat je er één raakt, telt.`
  const pct = Math.round(s.conversie.waarde * 100)
  const duiding = s.verlopen > 0
    ? `${mv(s.verlopen, 'taak staat', 'taken staan')} over tijd. Wie die vandaag wegwerkt, begint morgen schoon.`
    : s.conversie.noemer && s.conversie.waarde >= 0.15
      ? `Je zet ${pct}% van je gesprekken om in een afspraak, boven de norm van 15%. Meer gesprekken is nu de hefboom.`
      : s.zonderContact > 0
        ? `${mv(s.zonderContact, 'prospect heeft', 'prospects hebben')} nog geen eerste contactmoment. Daar zitten de afspraken van volgende maand.`
        : 'Regelmaat wint van losse uitschieters. Vandaag is de dag waar je iets aan kunt doen.'
  return { kop, duiding }
}

/** Een regel in de tijdlijn "Door AI agents gedaan". */
export interface AgentGebeurtenis { soort: 'taak' | 'inzicht' | 'geparkeerd' | 'verrijkt' | 'tegengehouden' | 'concept' | 'overig'; agent: string; actie: string; account: string | null; accountId: string | null; op: string }
/** Tellers boven de tijdlijn; alleen soorten die voorkomen, in vaste volgorde. */
export function agentTellers(tel: Partial<Record<AgentGebeurtenis['soort'], number>>): { soort: AgentGebeurtenis['soort']; aantal: number; label: string }[] {
  const LABEL: [AgentGebeurtenis['soort'], string, string][] = [
    ['taak', 'taak klaargezet', 'taken klaargezet'], ['inzicht', 'inzicht', 'inzichten'], ['concept', 'concept', 'concepten'],
    ['verrijkt', 'verrijkt', 'verrijkt'], ['geparkeerd', 'geparkeerd', 'geparkeerd'], ['tegengehouden', 'tegengehouden', 'tegengehouden'],
  ]
  return LABEL.map(([soort, een, meer]) => { const n = tel[soort] ?? 0; return { soort, aantal: n, label: n === 1 ? een : meer } })
    .filter((t) => t.aantal > 0 || ['taak', 'inzicht', 'tegengehouden'].includes(t.soort))
}
