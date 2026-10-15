// Tabellen die de client via de sync-wachtrij (POST /api/sync/mutations) mag
// schrijven. Eén lijst voor de server, check:rechten en de tests. `users` staat
// hier nooit in. Latere prompts voegen hun tabellen toe, met het onderdeel uit
// de rechtenmatrix waaronder ze vallen.

export const SYNCBARE_TABELLEN = {
  notificaties: 'notificaties',
  persoonlijke_instellingen: 'persoonlijk',
} as const

export type SyncbareTabel = keyof typeof SYNCBARE_TABELLEN

export function isSyncbareTabel(v: unknown): v is SyncbareTabel {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(SYNCBARE_TABELLEN, v)
}
