// Bronnen voor ZoekKiezer: prospects en klanten op naam, contacten op naam of functie (met een account
// alleen diens contacten, beslisser eerst). Ook zonder zoekterm: dan eerst je eigen recente of actieve
// prospects (en hun contacten). Beide API's geven hooguit dertig treffers; de kiezer toont er zes en scrolt.
export interface KiesAccount { id: string; naam: string; plaats?: string | null; branche?: string | null }
export interface KiesContact { id: string; naam: string; functie?: string | null; rol?: string | null; accountId?: string | null; accountNaam?: string | null; plaats?: string | null }

export function zoekAccounts(q: string, soort?: 'prospect') {
  return $fetch<KiesAccount[]>('/api/accounts/kies', { query: { q: q.trim() || undefined, soort } }).catch(() => [] as KiesAccount[])
}
export function zoekContacten(q: string, accountId?: string | null) {
  return $fetch<KiesContact[]>('/api/contacten/kies', { query: { q: q.trim() || undefined, accountId: accountId || undefined } }).catch(() => [] as KiesContact[])
}
/** De gedempte toevoeging achter een prospect in de lijst: de branche, anders de plaats. */
export function accountSub(a: { branche?: string | null; plaats?: string | null }) { return a.branche || a.plaats || null }
/** De gedempte toevoeging achter een contact: functie, en zonder gekozen prospect ook het bedrijf. */
export function contactSub(c: { functie?: string | null; rol?: string | null; accountNaam?: string | null }, metBedrijf = true) {
  return [c.functie, metBedrijf ? c.accountNaam : null].filter(Boolean).join(' · ') || null
}
