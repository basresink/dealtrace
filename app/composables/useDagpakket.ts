// Dagpakket (P30, 8.8): vandaag en morgen op de telefoon in IndexedDB. Met verbinding haalt hij de
// nieuwste versie op (304 als hij al klopt); zonder verbinding leest hij uit de opslag. Accounts die
// je met "Bewaar voor offline" toevoegt, gaan bij de volgende keer mee.
import { wachtrij } from './useSyncQueue'

const vandaag = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })

export function useDagpakket() {
  const pakket = useState<any>('dagpakket', () => null)
  const bezig = useState('dagpakket-bezig', () => false)
  const fout = useState<string | null>('dagpakket-fout', () => null)

  async function uitOpslag(datum = vandaag()) {
    if (import.meta.server) return null
    const r = await wachtrij().dagpakket.get(datum).catch(() => undefined)
    return r?.pakket ?? null
  }

  async function laad(opties: { forceer?: boolean } = {}) {
    if (import.meta.server) return null
    const datum = vandaag()
    const opgeslagen = await wachtrij().dagpakket.get(datum).catch(() => undefined)
    if (opgeslagen && !pakket.value) pakket.value = opgeslagen.pakket
    if (!navigator.onLine) return pakket.value
    bezig.value = true
    try {
      const extra = (await wachtrij().bewaard.toArray()).map((b) => b.id).join(',')
      const res = await fetch(`/api/onderweg/dagpakket?datum=${datum}${extra ? `&extra=${encodeURIComponent(extra)}` : ''}`, { headers: !opties.forceer && opgeslagen ? { 'if-none-match': `"${opgeslagen.versie}"` } : {}, credentials: 'same-origin' })
      if (res.status === 304 && opgeslagen) { pakket.value = opgeslagen.pakket; return pakket.value }
      if (!res.ok) throw new Error(`dagpakket ${res.status}`)
      const p = await res.json()
      await wachtrij().dagpakket.put({ datum, versie: p.versie, pakket: p, op: new Date().toISOString() })
      // Oude dagen weg: alleen vandaag blijft staan.
      await wachtrij().dagpakket.where('datum').below(datum).delete()
      pakket.value = p
      fout.value = null
    } catch {
      fout.value = 'Het dagpakket kon niet worden bijgewerkt.'
    } finally { bezig.value = false }
    return pakket.value
  }

  function account(id: string) { return (pakket.value?.accounts ?? []).find((a: any) => a.id === id) ?? null }

  async function bewaarVoorOffline(id: string, naam: string) {
    await wachtrij().bewaard.put({ id, naam })
    await laad({ forceer: true })
  }

  return { pakket, bezig, fout, laad, uitOpslag, account, bewaarVoorOffline }
}
