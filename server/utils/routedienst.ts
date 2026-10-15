// Routedienst (P14, ADR-016, 12): reistijden tussen punten met een cache per paar punten (7 dagen,
// zonder klantgegevens). Uitvoering via ROUTEDIENST_MODUS: `ors` (OpenRouteService met de
// platformsleutel ROUTEDIENST_SLEUTEL), `mock` (vaste, netwerkloze reistijden voor tests) of niets:
// dan de schatting met het label "schatting". Een fout valt altijd terug op de schatting.
import { sql } from 'drizzle-orm'
import { schatReistijd, type Punt, type Reistijd, type ReistijdFn } from '../../shared/route'
import { gebruikDb } from './db'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]
const r4 = (x: number) => x.toFixed(4)
export const paarSleutel = (a: Punt, b: Punt) => `${r4(a.lat)},${r4(a.lng)}>${r4(b.lat)},${r4(b.lng)}`
export const routedienstModus = () => (process.env.ROUTEDIENST_MODUS === 'ors' && process.env.ROUTEDIENST_SLEUTEL ? 'ors' : process.env.ROUTEDIENST_MODUS === 'mock' ? 'mock' : 'schatting')

/** Mock: de schatting met 10 procent extra, als echte reistijd (geen label). */
const mockTijd = (a: Punt, b: Punt): Reistijd => { const s = schatReistijd(a, b); return { minuten: Math.round(s.minuten * 1.1), km: s.km, schatting: false } }

async function orsMatrix(punten: Punt[]): Promise<{ duur: number[][]; afstand: number[][] }> {
  const r = await fetch('https://api.openrouteservice.org/v2/matrix/driving-car', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: process.env.ROUTEDIENST_SLEUTEL! },
    body: JSON.stringify({ locations: punten.map((p) => [p.lng, p.lat]), metrics: ['duration', 'distance'], units: 'km' }),
    signal: AbortSignal.timeout(4000),
  })
  if (!r.ok) throw new Error(`routedienst ${r.status}`)
  const j: any = await r.json()
  return { duur: j.durations, afstand: j.distances }
}

/**
 * Reistijden voor een set paren: eerst de cache, dan de routedienst in één matrix, anders de
 * schatting. Geeft een synchrone opzoekfunctie terug voor de pure kansformule.
 */
export async function reistijden(tx: Tx, paren: [Punt, Punt][]): Promise<ReistijdFn> {
  const modus = routedienstModus()
  const tabel = new Map<string, Reistijd>()
  if (modus === 'schatting' || !paren.length) return schatReistijd
  if (modus === 'mock') return mockTijd
  const sleutels = [...new Set(paren.map(([a, b]) => paarSleutel(a, b)))]
  const rijen = (await tx.execute(sql`select sleutel, minuten, km from routedienst_cache where sleutel = any(string_to_array(${sleutels.join('|')}, '|')) and op > now() - interval '7 days'`)).rows as any[]
  for (const r of rijen) tabel.set(r.sleutel, { minuten: r.minuten, km: r.km, schatting: false })
  const missend = paren.filter(([a, b]) => !tabel.has(paarSleutel(a, b)))
  if (missend.length) {
    const punten: Punt[] = []
    const idx = (p: Punt) => { const i = punten.findIndex((q) => r4(q.lat) === r4(p.lat) && r4(q.lng) === r4(p.lng)); if (i >= 0) return i; punten.push(p); return punten.length - 1 }
    const ij = missend.slice(0, 600).map(([a, b]) => [idx(a), idx(b)] as const)
    if (punten.length <= 50) {
      try {
        const m = await orsMatrix(punten)
        for (const [i, j] of ij) {
          const t = { minuten: Math.round((m.duur[i]?.[j] ?? 0) / 60), km: Math.round((m.afstand[i]?.[j] ?? 0) * 10) / 10, schatting: false }
          const s = paarSleutel(punten[i]!, punten[j]!)
          tabel.set(s, t)
          await tx.execute(sql`insert into routedienst_cache (sleutel, minuten, km) values (${s}, ${t.minuten}, ${t.km}) on conflict (sleutel) do update set minuten = excluded.minuten, km = excluded.km, op = now()`)
        }
      } catch { /* terugval op de schatting */ }
    }
  }
  return (a, b) => tabel.get(paarSleutel(a, b)) ?? schatReistijd(a, b)
}
