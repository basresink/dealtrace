// DealDrive-koppeling (B21, docs/api/dealdrive-koppeling.md). In P04 alleen
// zoekAccounts (hoofdstuk 4). Uitvoeringen: 'mock' (fixtures in seed/dealdrive-mock,
// standaard lokaal en in tests), 'http' (ondertekend volgens hoofdstuk 2) en 'uit'.
// Antwoorden 24 uur gecachet per sleutel. P23 breidt dit uit met overdracht.
import { createHmac } from 'node:crypto'
import { normaliseerDomein, normaliseerNaam } from '../../shared/ontdubbelen'

export interface DealDriveTreffer { accountId: string; naam: string; soort: 'klant' | 'prospect'; eigenaar?: string; zekerheid: 'kvk' | 'domein' | 'naam'; laatsteContact?: string }

const DAG = 24 * 3600 * 1000
const cache = new Map<string, { tot: number; treffers: DealDriveTreffer[] }>()

export function dealdriveModus(): 'mock' | 'http' | 'uit' {
  return (process.env.DEALDRIVE_MODUS as any) || 'mock'
}

// De fixture uit seed/dealdrive-mock/zoek-antwoord.json (hier ingebouwd, zodat de
// serverbundel geen bestanden hoeft te lezen) plus een klanttreffer voor tests.
const MOCK_PROSPECT: DealDriveTreffer = { accountId: 'acc_dd_5520', naam: 'Testbrontsma Installatietechniek', soort: 'prospect', eigenaar: 'eva.dijkstra@voltvast.test', zekerheid: 'kvk', laatsteContact: '2026-06-11' }
const MOCK_KLANT: DealDriveTreffer = { accountId: 'acc_dd_1200', naam: 'Testklant Kabelwerk', soort: 'klant', eigenaar: 'jan.wolters@voltvast.test', zekerheid: 'kvk' }

function mock(q: { kvk?: string | null; domein?: string | null; naam?: string | null }): DealDriveTreffer[] {
  const n = q.naam ? normaliseerNaam(q.naam) : ''
  if (q.kvk === '99123456' || n.includes('testbrontsma')) return [{ ...MOCK_PROSPECT, zekerheid: q.kvk === '99123456' ? 'kvk' : 'naam' }]
  if (q.kvk === '99777777' || n.includes('testklant kabelwerk')) return [{ ...MOCK_KLANT, zekerheid: q.kvk === '99777777' ? 'kvk' : 'naam' }]
  return []
}

async function http(q: { kvk?: string | null; domein?: string | null; naam?: string | null }): Promise<DealDriveTreffer[]> {
  const basis = process.env.DEALDRIVE_URL
  const geheim = process.env.DEALDRIVE_GEHEIM
  const org = process.env.DEALDRIVE_ORGANISATIE_ID
  if (!basis || !geheim || !org) throw new Error('DealDrive-koppeling niet ingericht')
  const params = new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][])
  const tijd = String(Math.floor(Date.now() / 1000))
  const handtekening = createHmac('sha256', geheim).update(`${tijd}.`).digest('hex')
  const res = await fetch(`${basis}/accounts/zoek?${params}`, {
    headers: { 'X-Koppeling-Tijd': tijd, 'X-Koppeling-Handtekening': `sha256=${handtekening}`, 'X-Koppeling-Organisatie': org },
    signal: AbortSignal.timeout(3000),
  })
  if (!res.ok) throw new Error(`DealDrive antwoordde ${res.status}`)
  return ((await res.json()) as { treffers: DealDriveTreffer[] }).treffers ?? []
}

/** Zoekt in DealDrive op KvK, domein en naam. Gooit bij een fout; de import loopt dan door zonder deze groep. */
export async function zoekAccounts(q: { kvk?: string | null; domein?: string | null; naam?: string | null }): Promise<DealDriveTreffer[] | null> {
  const modus = dealdriveModus()
  if (modus === 'uit') return null
  const sleutel = `${q.kvk ?? ''}|${normaliseerDomein(q.domein) ?? ''}|${q.naam ? normaliseerNaam(q.naam) : ''}`
  const c = cache.get(sleutel)
  if (c && c.tot > Date.now()) return c.treffers
  const treffers = modus === 'mock' ? mock(q) : await http(q)
  cache.set(sleutel, { tot: Date.now() + DAG, treffers })
  return treffers
}
