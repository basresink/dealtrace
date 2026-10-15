// Locatie (P30, 8.6, 15.2): alleen op het moment dat je Route, "In de buurt" of "+ Inloop" opent.
// Eén meting, niets bewaard, geen volgen op de achtergrond.
export function useLocatie() {
  const fout = ref<string | null>(null)
  async function plek(): Promise<{ lat: number; lng: number } | null> {
    if (import.meta.server || !navigator.geolocation) { fout.value = 'Je toestel geeft geen locatie.'; return null }
    return await new Promise((ok) => navigator.geolocation.getCurrentPosition(
      (p) => { fout.value = null; ok({ lat: p.coords.latitude, lng: p.coords.longitude }) },
      () => { fout.value = 'Geen toegang tot je locatie. Zet locatie aan voor Dealtrace.'; ok(null) },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    ))
  }
  return { plek, fout }
}
