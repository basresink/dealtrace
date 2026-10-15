// Offline wachtrij (bouwplan F24, 8.8, 8.14). Elke handeling krijgt een
// idempotentiesleutel en gaat eerst in IndexedDB; daarna verstuurt de wachtrij
// hem naar POST /api/sync/mutations. Offline blijft hij staan tot er weer
// verbinding is. Een versieconflict opent het conflictvenster.

import Dexie, { type Table } from 'dexie'

export interface WachtendeMutatie {
  idempotentieSleutel: string
  tabel: string
  op: 'patch'
  recordId: string
  versie?: number
  patch: Record<string, unknown>
  pogingen: number
  aangemaakt: string
  /** P30: niet versturen voor dit moment (venster "Ongedaan maken"). */
  nietVoor?: string
}

export interface Conflict {
  mutatie: WachtendeMutatie
  serverVersie: number
  serverStand: unknown
}

export interface WachtendeBijlage { id: string; recordSoort: string; recordId: string; soort: 'foto' | 'opname' | 'visitekaartje'; mime: string; blob: Blob; aangemaakt: string; pogingen: number }

class WachtrijDb extends Dexie {
  mutaties!: Table<WachtendeMutatie, string>
  /** P30: het dagpakket per datum, bijlagen die nog moeten uploaden en accounts die je zelf bewaarde. */
  dagpakket!: Table<{ datum: string; versie: string; pakket: any; op: string }, string>
  bijlagen!: Table<WachtendeBijlage, string>
  bewaard!: Table<{ id: string; naam: string }, string>
  constructor() {
    super('dealtrace')
    this.version(1).stores({ mutaties: 'idempotentieSleutel, aangemaakt' })
    this.version(2).stores({ mutaties: 'idempotentieSleutel, aangemaakt', dagpakket: 'datum', bijlagen: 'id, aangemaakt', bewaard: 'id' })
  }
}

let db: WachtrijDb | null = null
export function wachtrij(): WachtrijDb {
  if (!db) db = new WachtrijDb()
  return db
}

export function useSyncQueue() {
  const online = useState('online', () => true)
  const wachtend = useState('wachtend', () => 0)
  const vastgelopen = useState('vastgelopen', () => false)
  const conflict = useState<Conflict | null>('conflict', () => null)

  async function tel() {
    if (import.meta.server) return
    wachtend.value = await wachtrij().mutaties.count()
  }

  async function voegToe(m: Omit<WachtendeMutatie, 'idempotentieSleutel' | 'pogingen' | 'aangemaakt' | 'nietVoor'>, opties: { uitstelMs?: number } = {}) {
    const sleutel = crypto.randomUUID()
    await wachtrij().mutaties.add({ ...m, idempotentieSleutel: sleutel, pogingen: 0, aangemaakt: new Date().toISOString(), ...(opties.uitstelMs ? { nietVoor: new Date(Date.now() + opties.uitstelMs).toISOString() } : {}) })
    await tel()
    if (opties.uitstelMs) setTimeout(() => void verstuur(), opties.uitstelMs + 50)
    else void verstuur()
    return sleutel
  }

  /** "Ongedaan maken": haal een mutatie terug die nog niet verstuurd is. Geeft false als hij al weg is. */
  async function trekIn(sleutel: string) {
    const m = await wachtrij().mutaties.get(sleutel)
    if (!m) return false
    await wachtrij().mutaties.delete(sleutel)
    await tel()
    return true
  }

  let bezig = false
  async function verstuur() {
    if (import.meta.server || bezig || !navigator.onLine) return
    bezig = true
    try {
      const nu = new Date().toISOString()
      const lijst = (await wachtrij().mutaties.orderBy('aangemaakt').toArray()).filter((m) => !m.nietVoor || m.nietVoor <= nu)
      if (!lijst.length) return
      const { resultaten } = await $fetch<{ resultaten: any[] }>('/api/sync/mutations', {
        method: 'POST',
        body: { mutaties: lijst.map(({ pogingen, aangemaakt, ...m }) => m) },
      })
      for (let i = 0; i < lijst.length; i++) {
        const m = lijst[i]!
        const r = resultaten[i]
        if (r?.status === 'conflict') {
          conflict.value = { mutatie: m, serverVersie: r.serverVersie, serverStand: r.serverStand }
          continue
        }
        // ok of geweigerd: niet opnieuw proberen.
        await wachtrij().mutaties.delete(m.idempotentieSleutel)
      }
      vastgelopen.value = false
    } catch {
      // Netwerkfout of server onbereikbaar: blijft staan; na drie keer "vastgelopen".
      const lijst = await wachtrij().mutaties.toArray()
      for (const m of lijst) await wachtrij().mutaties.update(m.idempotentieSleutel, { pogingen: m.pogingen + 1 })
      vastgelopen.value = lijst.some((m) => m.pogingen + 1 >= 3)
    } finally {
      bezig = false
      await tel()
    }
  }

  /** Conflictvenster: "Houd mijn versie" verstuurt opnieuw op de serverversie; "Neem de andere over" laat de mutatie vallen. */
  async function losConflictOp(keuze: 'mijn' | 'ander') {
    const c = conflict.value
    if (!c) return
    if (keuze === 'mijn') {
      await wachtrij().mutaties.put({ ...c.mutatie, versie: c.serverVersie, idempotentieSleutel: crypto.randomUUID() })
    }
    await wachtrij().mutaties.delete(c.mutatie.idempotentieSleutel)
    conflict.value = null
    await tel()
    void verstuur()
  }

  function start() {
    if (import.meta.server) return
    online.value = navigator.onLine
    window.addEventListener('online', () => { online.value = true; void verstuur() })
    window.addEventListener('offline', () => { online.value = false })
    void tel().then(verstuur)
  }

  return { online, wachtend, vastgelopen, conflict, voegToe, trekIn, verstuur, losConflictOp, start }
}
