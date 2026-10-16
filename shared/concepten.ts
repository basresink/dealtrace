// Concepten (8.5.7): de filters van de conceptenpagina, gedeeld door server en scherm. Soort, status,
// agent, account (zoeken) en periode; de tellers per filter rekenen met de andere filters erop.

export const CONCEPT_SOORT: Record<string, string> = {
  mail: 'Mail', linkedin: 'LinkedIn', whatsapp: 'WhatsApp', belscript: 'Belscript', briefing: 'Bezoekbriefing', taak: 'Taakvoorstel',
}
/** Statussen zoals de filter ze toont; open is klaar en goedgekeurd samen (de standaard). */
export const CONCEPT_STATUS: Record<string, string> = { klaar: 'Klaar', goedgekeurd: 'Goedgekeurd', verstuurd: 'Verstuurd', afgewezen: 'Afgewezen' }
export const CONCEPT_AGENT: Record<string, string> = { schrijver: 'Schrijver', notulist: 'Notulist', berichtgever: 'Berichtgever', mens: 'Zelf geschreven' }
export const CONCEPT_PERIODE: Record<string, string> = { vandaag: 'Vandaag', week: 'Afgelopen week', maand: 'Afgelopen maand', kwartaal: 'Afgelopen kwartaal' }

/** De status in de database naar de status van de filter (verworpen heet afgewezen). */
export const statusFilter = (s: string) => (s === 'verworpen' ? 'afgewezen' : s)
export const agentLabel = (a: string) => CONCEPT_AGENT[a] ?? (a ? a[0]!.toUpperCase() + a.slice(1) : 'Agent')
export const soortLabel = (t: string | null | undefined) => (t ? CONCEPT_SOORT[t] ?? t : 'Concept')

export interface ConceptFilter { soort?: string | null; status?: string | null; agent?: string | null; zoek?: string | null }
export interface FilterbaarConcept { type: string | null; status: string; agent: string; zoektekst: string }

/** Vanaf wanneer een periode telt; vandaag begint om middernacht in Amsterdam. */
export function sindsVan(periode: string | null | undefined, nu = new Date()): Date | null {
  if (!periode || !CONCEPT_PERIODE[periode]) return null
  if (periode === 'vandaag') {
    const dag = nu.toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })
    const uur = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Amsterdam' }).format(nu))
    const utcUur = nu.getUTCHours()
    const verschil = ((uur - utcUur + 24) % 24) * 3600e3
    return new Date(Date.parse(`${dag}T00:00:00Z`) - verschil)
  }
  const dagen = periode === 'week' ? 7 : periode === 'maand' ? 30 : 91
  return new Date(nu.getTime() - dagen * 864e5)
}

const past = (c: FilterbaarConcept, f: ConceptFilter, zonder?: keyof ConceptFilter) => {
  const st = statusFilter(c.status)
  if (zonder !== 'soort' && f.soort && c.type !== f.soort) return false
  if (zonder !== 'status') {
    if (!f.status) { if (st !== 'klaar' && st !== 'goedgekeurd') return false } else if (f.status !== 'alle' && st !== f.status) return false
  }
  if (zonder !== 'agent' && f.agent && c.agent !== f.agent) return false
  if (zonder !== 'zoek' && f.zoek && !c.zoektekst.toLowerCase().includes(f.zoek.trim().toLowerCase())) return false
  return true
}

/** Filtert de concepten en telt per soort, status en agent met de andere filters erop. */
export function filterConcepten<T extends FilterbaarConcept>(lijst: T[], f: ConceptFilter) {
  const tel = (dim: 'soort' | 'status' | 'agent', sleutel: (c: T) => string) => {
    const uit: Record<string, number> = {}
    for (const c of lijst) if (past(c, f, dim)) { const k = sleutel(c); uit[k] = (uit[k] ?? 0) + 1 }
    return uit
  }
  const status = tel('status', (c) => statusFilter(c.status))
  return {
    concepten: lijst.filter((c) => past(c, f)),
    tellers: {
      soort: tel('soort', (c) => c.type ?? 'onbekend'),
      status: { ...status, open: (status.klaar ?? 0) + (status.goedgekeurd ?? 0), alle: Object.values(status).reduce((a, b) => a + b, 0) },
      agent: tel('agent', (c) => c.agent),
    },
  }
}

/** De eerste regels van een concept voor de kaart. */
export function eersteRegels(concept: any, max = 220): string {
  const t = concept?.tekst ? String(concept.tekst) : Object.values(concept?.blokken ?? {}).join(' ')
  const vlak = t.replace(/\s+/g, ' ').trim()
  return vlak.length > max ? `${vlak.slice(0, max).replace(/\s+\S*$/, '')}...` : vlak
}
