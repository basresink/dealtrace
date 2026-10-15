// Uploadwachtrij voor foto's en opnames (P30, 8.8): eerst in IndexedDB, dan naar POST /api/bijlagen
// zodra er verbinding is (en, als je dat aanzette, alleen via wifi). Het id maakt de telefoon, zodat
// een bezoek er al naar kan verwijzen voordat de upload klaar is.
import { verkleinMaat } from '~~/shared/route'
import { wachtrij } from './useSyncQueue'

const naarBase64 = (b: Blob) => new Promise<string>((ok, nee) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] ?? ''); r.onerror = nee; r.readAsDataURL(b) })

/** Verklein een foto tot hooguit 1.600 px aan de langste zijde (JPEG 0,82). */
export async function verkleinFoto(bestand: Blob, max = 1600): Promise<Blob> {
  const bmp = await createImageBitmap(bestand)
  const { breedte, hoogte } = verkleinMaat(bmp.width, bmp.height, max)
  if (breedte === bmp.width && hoogte === bmp.height && bestand.type === 'image/jpeg') return bestand
  const c = document.createElement('canvas'); c.width = breedte; c.height = hoogte
  c.getContext('2d')!.drawImage(bmp, 0, 0, breedte, hoogte)
  return await new Promise<Blob>((ok) => c.toBlob((b) => ok(b!), 'image/jpeg', 0.82))
}

export function useBijlagen() {
  const wachtend = useState('bijlagen-wachtend', () => 0)
  const alleenWifi = useState('bijlagen-wifi', () => (import.meta.client ? localStorage.getItem('dt-alleen-wifi') === '1' : false))
  async function tel() { if (import.meta.client) wachtend.value = await wachtrij().bijlagen.count() }
  function zetAlleenWifi(aan: boolean) { alleenWifi.value = aan; try { localStorage.setItem('dt-alleen-wifi', aan ? '1' : '0') } catch { /* privémodus */ } }
  async function voegToe(blob: Blob, soort: 'foto' | 'opname' | 'visitekaartje', record: { soort: string; id: string }) {
    const id = crypto.randomUUID()
    await wachtrij().bijlagen.add({ id, recordSoort: record.soort, recordId: record.id, soort, mime: blob.type || (soort === 'opname' ? 'audio/webm' : 'image/jpeg'), blob, aangemaakt: new Date().toISOString(), pogingen: 0 })
    await tel(); void verstuur()
    return id
  }
  let bezig = false
  async function verstuur() {
    if (import.meta.server || bezig || !navigator.onLine) return
    const verbinding = (navigator as any).connection?.type
    if (alleenWifi.value && verbinding && verbinding !== 'wifi' && verbinding !== 'ethernet') return
    bezig = true
    try {
      for (const b of await wachtrij().bijlagen.orderBy('aangemaakt').toArray()) {
        try {
          await $fetch('/api/bijlagen', { method: 'POST', body: { id: b.id, recordSoort: b.recordSoort, recordId: b.recordId, soort: b.soort, mime: b.mime, data: await naarBase64(b.blob) } })
          await wachtrij().bijlagen.delete(b.id)
        } catch (e: any) {
          // 4xx: niet opnieuw proberen; netwerk: later opnieuw.
          if (e?.statusCode && e.statusCode < 500) await wachtrij().bijlagen.delete(b.id)
          else { await wachtrij().bijlagen.update(b.id, { pogingen: b.pogingen + 1 }); break }
        }
      }
    } finally { bezig = false; await tel() }
  }
  function start() { if (import.meta.client) { window.addEventListener('online', () => void verstuur()); void tel().then(verstuur) } }
  return { wachtend, alleenWifi, zetAlleenWifi, voegToe, verstuur, start, tel }
}
