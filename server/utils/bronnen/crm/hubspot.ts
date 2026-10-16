// HubSpot achter de CrmAdapter (P20). Basis uit DealDrive (hubspot-client.ts), nu met een token per
// organisatie uit koppelingen.geheimen. Fouten in gewone taal; 429 is tijdelijk (wacht en probeer opnieuw).
import { CrmFout, type CrmActiviteit, type CrmAdapter } from './adapter'

const API = 'https://api.hubapi.com'
const BEDRIJF_VELDEN = ['name', 'domain', 'phone', 'city', 'zip', 'address', 'numberofemployees', 'lifecyclestage', 'kvk_nummer', 'laatste_order', 'dealstatus', 'hubspot_owner_id']
const CONTACT_VELDEN = ['firstname', 'lastname', 'email', 'phone', 'jobtitle']

export function hubspotAdapter(token: string): CrmAdapter {
  async function vraag<T>(pad: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${API}${pad}`, { ...init, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers ?? {}) }, signal: AbortSignal.timeout(15000) })
    if (res.status === 401) throw new CrmFout('De koppeling met HubSpot is verlopen. Verbind opnieuw om verder te synchroniseren.', 'verlopen')
    if (res.status === 403) throw new CrmFout('HubSpot geeft geen toegang tot dit onderdeel. Verbind opnieuw en geef alle gevraagde rechten.', 'scope')
    if (res.status === 429) throw new CrmFout('HubSpot vraagt even te wachten. Dealtrace probeert het straks opnieuw.', 'limiet', true)
    if (!res.ok) throw new CrmFout(`HubSpot antwoordde met ${res.status}.`, 'fout', res.status >= 500)
    return (await res.json()) as T
  }
  async function alle(object: 'companies' | 'contacts', velden: string[]) {
    const uit: any[] = []
    let na: string | undefined
    for (let i = 0; i < 50; i++) {
      const r = await vraag<any>(`/crm/v3/objects/${object}?limit=100&properties=${velden.join(',')}${object === 'contacts' ? '&associations=companies' : ''}${na ? `&after=${na}` : ''}`)
      uit.push(...(r.results ?? []))
      na = r.paging?.next?.after
      if (!na) break
    }
    return uit
  }
  const eigenaren = new Map<string, string>()
  async function eigenaarEmail(id: string | undefined) {
    if (!id) return null
    if (!eigenaren.size) for (const o of (await vraag<any>('/crm/v3/owners?limit=500')).results ?? []) eigenaren.set(String(o.id), o.email)
    return eigenaren.get(String(id)) ?? null
  }
  async function notitie(a: CrmActiviteit) {
    const r = await vraag<any>('/crm/v3/objects/notes', { method: 'POST', body: JSON.stringify({ properties: { hs_timestamp: a.datum, hs_note_body: `${a.onderwerp}\n${a.tekst}`, dealtrace_sleutel: a.sleutel }, associations: [{ to: { id: a.bedrijfId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 190 }] }] }) })
    return { id: String(r.id) }
  }
  async function zoekSleutel(sleutel: string) {
    const r = await vraag<any>('/crm/v3/objects/notes/search', { method: 'POST', body: JSON.stringify({ filterGroups: [{ filters: [{ propertyName: 'dealtrace_sleutel', operator: 'EQ', value: sleutel }] }], limit: 1 }) }).catch(() => null)
    return r?.results?.[0]?.id ? { id: String(r.results[0].id) } : null
  }
  return {
    async test() { const r = await vraag<any>('/account-info/v3/details'); return { ok: true, melding: 'De verbinding met HubSpot werkt.', account: r?.portalId ? `Portaal ${r.portalId}` : undefined } },
    async leesBedrijven() {
      const lijst = await alle('companies', BEDRIJF_VELDEN)
      return Promise.all(lijst.map(async (c) => ({ id: String(c.id), eigenaar: await eigenaarEmail(c.properties?.hubspot_owner_id), velden: c.properties ?? {} })))
    },
    async leesContacten() {
      return (await alle('contacts', CONTACT_VELDEN)).map((c) => ({ id: String(c.id), bedrijfId: c.associations?.companies?.results?.[0]?.id ?? null, velden: c.properties ?? {} }))
    },
    async schrijfBedrijf(velden, externId) {
      const r = await vraag<any>(externId ? `/crm/v3/objects/companies/${externId}` : '/crm/v3/objects/companies', { method: externId ? 'PATCH' : 'POST', body: JSON.stringify({ properties: velden }) })
      return { id: String(r.id) }
    },
    async schrijfContact(velden, bedrijfId, externId) {
      const r = await vraag<any>(externId ? `/crm/v3/objects/contacts/${externId}` : '/crm/v3/objects/contacts', { method: externId ? 'PATCH' : 'POST', body: JSON.stringify({ properties: velden, ...(externId ? {} : { associations: [{ to: { id: bedrijfId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 1 }] }] }) }) })
      return { id: String(r.id) }
    },
    async schrijfActiviteit(a) { return (await zoekSleutel(a.sleutel)) ?? notitie(a) },
    async schrijfOverdracht(a) { return (await zoekSleutel(a.sleutel)) ?? notitie(a) },
  }
}

/** OAuth (hoofdstuk 12): de autorisatie-URL en het ruilen van de code. Geheimen alleen uit de omgeving. */
export const HUBSPOT_SCOPES = ['crm.objects.companies.read', 'crm.objects.companies.write', 'crm.objects.contacts.read', 'crm.objects.contacts.write', 'crm.objects.owners.read']
export function hubspotAutorisatieUrl(state: string, terug: string) {
  const id = process.env.HUBSPOT_CLIENT_ID
  if (!id) throw new CrmFout('HubSpot is op dit platform nog niet ingericht.', 'fout')
  return `https://app.hubspot.com/oauth/authorize?client_id=${encodeURIComponent(id)}&redirect_uri=${encodeURIComponent(terug)}&scope=${encodeURIComponent(HUBSPOT_SCOPES.join(' '))}&state=${encodeURIComponent(state)}`
}
export async function hubspotRuilCode(code: string, terug: string): Promise<{ access: string; refresh: string; verloopt: string }> {
  const body = new URLSearchParams({ grant_type: 'authorization_code', client_id: process.env.HUBSPOT_CLIENT_ID ?? '', client_secret: process.env.HUBSPOT_CLIENT_SECRET ?? '', redirect_uri: terug, code })
  const res = await fetch(`${API}/oauth/v1/token`, { method: 'POST', body, signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new CrmFout('HubSpot gaf geen toegang. Probeer opnieuw te verbinden.', 'verlopen')
  const r = (await res.json()) as any
  return { access: r.access_token, refresh: r.refresh_token, verloopt: new Date(Date.now() + (r.expires_in ?? 1800) * 1000).toISOString() }
}
export async function hubspotVernieuw(refresh: string): Promise<{ access: string; refresh: string; verloopt: string }> {
  const body = new URLSearchParams({ grant_type: 'refresh_token', client_id: process.env.HUBSPOT_CLIENT_ID ?? '', client_secret: process.env.HUBSPOT_CLIENT_SECRET ?? '', refresh_token: refresh })
  const res = await fetch(`${API}/oauth/v1/token`, { method: 'POST', body, signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new CrmFout('De koppeling met HubSpot is verlopen. Verbind opnieuw om verder te synchroniseren.', 'verlopen')
  const r = (await res.json()) as any
  return { access: r.access_token, refresh: r.refresh_token ?? refresh, verloopt: new Date(Date.now() + (r.expires_in ?? 1800) * 1000).toISOString() }
}
