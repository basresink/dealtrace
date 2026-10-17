// Deactiveren in plaats van verwijderen (0064). Een prospect wordt nooit meer verwijderd in de gewone app:
// de eigenaar, de salesmanager van zijn team en de beheerder deactiveren hem met een reden en kunnen hem
// heractiveren. Hier de vaste redenen, de controle en wie het mag; databasevrij en gedeeld met het scherm.

export const DEACTIVEER_REDENEN = ['failliet', 'dubbel', 'buiten-doelgroep', 'geen-interesse', 'overig'] as const
export type DeactiveerReden = typeof DEACTIVEER_REDENEN[number]
export const DEACTIVEER_REDEN_LABEL: Record<DeactiveerReden, string> = {
  failliet: 'Failliet of opgeheven',
  dubbel: 'Dubbel account',
  'buiten-doelgroep': 'Buiten de doelgroep',
  'geen-interesse': 'Definitief geen interesse',
  overig: 'Overig',
}

/** De details van een lopende deactivering (accounts.data.gedeactivering). */
export interface Gedeactivering {
  op: string
  door: string
  reden: DeactiveerReden
  toelichting?: string
  /** Liep er een hercontactritme toen de prospect werd gedeactiveerd? Bij heractiveren gaat het weer lopen. */
  ritmeWasActief?: boolean
}
/** Een afgeronde ronde (accounts.data.deactiveringen), voor wie later terugkijkt. */
export interface AfgerondeDeactivering extends Gedeactivering { heractiveerdOp: string; heractiveerdDoor: string }

export function isDeactiveerReden(r: unknown): r is DeactiveerReden {
  return typeof r === 'string' && (DEACTIVEER_REDENEN as readonly string[]).includes(r)
}

/** Controleert reden en toelichting; geeft een foutzin of null. Bij Overig is een toelichting verplicht. */
export function controleerDeactivering(b: { reden?: unknown; toelichting?: unknown } | null | undefined): { reden: DeactiveerReden; toelichting?: string } | string {
  if (!isDeactiveerReden(b?.reden)) return 'Kies een reden om te deactiveren'
  const toelichting = typeof b!.toelichting === 'string' ? b!.toelichting.trim().slice(0, 500) : ''
  if (b!.reden === 'overig' && !toelichting) return 'Geef een toelichting bij Overig'
  return { reden: b!.reden, ...(toelichting ? { toelichting } : {}) }
}

/**
 * Wie mag deactiveren en heractiveren: de beheerder altijd, de salesmanager voor zijn eigen accounts en die
 * van zijn teams, en ieder ander alleen als eigenaar van de prospect.
 */
export function magDeactiveren(g: { id: string; rol: string }, account: { ownerId: string | null; ownerTeamId?: string | null }, eigenTeams: string[] = []): boolean {
  if (g.rol === 'beheerder') return true
  if (account.ownerId === g.id) return true
  if (g.rol === 'salesmanager') return !!account.ownerTeamId && eigenTeams.includes(account.ownerTeamId)
  return false
}

/** De zin voor de balk op de accountkaart: "Gedeactiveerd op 3 oktober 2026 door Eva, reden Dubbel account". */
export function deactiveerTekst(d: Pick<Gedeactivering, 'op' | 'reden' | 'toelichting'>, doorNaam: string | null): string {
  const datum = new Date(d.op).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' })
  return `Gedeactiveerd op ${datum}${doorNaam ? ` door ${doorNaam}` : ''}, reden ${DEACTIVEER_REDEN_LABEL[d.reden] ?? d.reden}${d.toelichting ? `: ${d.toelichting}` : ''}`
}

/** Het filter Status in de lijst: standaard alleen actieve prospects. */
export const ACTIEF_FILTERS = ['actief', 'gedeactiveerd', 'alle'] as const
export type ActiefFilter = typeof ACTIEF_FILTERS[number]
export function leesActiefFilter(v: unknown): ActiefFilter {
  return (ACTIEF_FILTERS as readonly string[]).includes(String(v)) ? (v as ActiefFilter) : 'actief'
}
export function pastBijActief(gedeactiveerd: boolean, f: ActiefFilter): boolean {
  return f === 'alle' || (f === 'gedeactiveerd') === gedeactiveerd
}
