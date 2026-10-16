// Bronnen voor ZoekKiezer: prospects en klanten op naam, contacten op naam of functie (met een account
// alleen diens contacten, beslisser eerst). Beide API's geven hooguit tien treffers; de kiezer toont er zes.
export interface KiesAccount { id: string; naam: string; plaats?: string | null }
export interface KiesContact { id: string; naam: string; functie?: string | null; rol?: string | null; accountId?: string | null; accountNaam?: string | null; plaats?: string | null }

export function zoekAccounts(q: string) {
  return $fetch<KiesAccount[]>('/api/accounts/kies', { query: { q: q.trim() } }).catch(() => [] as KiesAccount[])
}
export function zoekContacten(q: string, accountId?: string | null) {
  return $fetch<KiesContact[]>('/api/contacten/kies', { query: { q: q.trim() || undefined, accountId: accountId || undefined } }).catch(() => [] as KiesContact[])
}
