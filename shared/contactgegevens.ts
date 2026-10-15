// Telefoon, e-mail en postcode (F03 validatie), en de rollen van contacten (F04, gat 28).

export function normaliseerTelefoon(nummer: string): { ok: true; e164: string } | { ok: false; fout: string } {
  const t = nummer.replace(/[\s().-]/g, '')
  let n: string
  if (/^\+\d{8,15}$/.test(t)) n = t
  else if (/^00\d{8,15}$/.test(t)) n = `+${t.slice(2)}`
  else if (/^0\d{9}$/.test(t)) n = `+31${t.slice(1)}`
  else return { ok: false, fout: 'Geen geldig telefoonnummer' }
  if (n.startsWith('+31') && n.length !== 12) return { ok: false, fout: 'Een Nederlands nummer heeft 10 cijfers' }
  return { ok: true, e164: n }
}

export const geldigEmail = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(e.trim())
export const geldigePostcode = (p: string) => /^\d{4}\s?[A-Za-z]{2}$/.test(p.trim())

export const ROLLEN_CONTACT = ['beslisser', 'beinvloeder', 'champion', 'gebruiker', 'blokkeerder', 'poortwachter', 'onbekend'] as const
export type ContactRol = typeof ROLLEN_CONTACT[number]
export const CONTACTROL_LABEL: Record<ContactRol, string> = {
  beslisser: 'Beslisser', beinvloeder: 'Beïnvloeder', champion: 'Champion', gebruiker: 'Gebruiker',
  blokkeerder: 'Blokkeerder', poortwachter: 'Poortwachter', onbekend: 'Onbekend',
}

export interface ContactLicht {
  id: string
  rol: ContactRol | string
  status: 'actief' | 'vertrokken' | string
  telefoon?: string | null
  mobiel?: string | null
  email?: string | null
  updatedAt?: string
  belMeNiet?: boolean
}

/** Primair contact: eerste beslisser of champion, anders iemand met telefoon, anders de eerste. Vertrokken telt niet. */
export function primairContact<T extends ContactLicht>(contacts: T[]): T | null {
  const actief = contacts.filter((c) => c.status !== 'vertrokken')
  return actief.find((c) => c.rol === 'beslisser') ?? actief.find((c) => c.rol === 'champion')
    ?? actief.find((c) => c.telefoon || c.mobiel) ?? actief[0] ?? null
}

/** Rollen in het buying committee zonder actief contact (onbekend telt niet als rol). */
export function ontbrekendeRollen(contacts: ContactLicht[]): ContactRol[] {
  const aanwezig = new Set(contacts.filter((c) => c.status !== 'vertrokken').map((c) => c.rol))
  return ROLLEN_CONTACT.filter((r) => r !== 'onbekend' && !aanwezig.has(r))
}

/** Volgorde in lijsten: rol, binnen rol laatst bijgewerkt eerst. */
export function sorteerContacten<T extends ContactLicht>(contacts: T[]): T[] {
  return [...contacts].sort((a, b) => {
    const ra = ROLLEN_CONTACT.indexOf(a.rol as ContactRol)
    const rb = ROLLEN_CONTACT.indexOf(b.rol as ContactRol)
    if (ra !== rb) return ra - rb
    return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')
  })
}

/** Het nummer om te bellen: mobiel van de beslisser eerst; nooit een nummer op de bel-me-niet-lijst. */
export function belNummer(c: ContactLicht | null, belMeNiet: Set<string> = new Set()): { nummer: string | null; reden?: string } {
  if (!c) return { nummer: null, reden: 'Geen contactpersoon' }
  if (c.belMeNiet) return { nummer: null, reden: 'Bel me niet' }
  for (const n of [c.mobiel, c.telefoon]) {
    if (!n) continue
    const e = normaliseerTelefoon(n)
    const e164 = e.ok ? e.e164 : n
    if (belMeNiet.has(e164)) continue
    return { nummer: e164 }
  }
  return { nummer: null, reden: c.mobiel || c.telefoon ? 'Nummer staat op bel-me-niet' : 'Geen telefoonnummer' }
}
