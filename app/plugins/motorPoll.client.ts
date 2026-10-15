// Poll op GET /api/motor/updates (F15): open sessies zien nieuwe taken en inzichten van de
// motor binnen 3 minuten. Schermen lezen useState('motorVersie') om te verversen.
export default defineNuxtPlugin(() => {
  const versie = useState('motorVersie', () => 0)
  let sinds = new Date().toISOString()
  async function kijk() {
    if (document.hidden || !navigator.onLine) return
    try {
      const r = await $fetch<{ nu: string; taken: unknown[]; inzichten: unknown[] }>('/api/motor/updates', { query: { since: sinds } })
      sinds = r.nu
      if (r.taken.length || r.inzichten.length) versie.value++
    } catch { /* geen sessie of offline: volgende keer */ }
  }
  setInterval(kijk, 60_000)
})
