// Automatisch bewaren per veld na 600 ms stilte, met zichtbare status (F22):
// "Opslaan…", "Opgeslagen", "Opslaan mislukt".
export type BewaarStatus = '' | 'Opslaan…' | 'Opgeslagen' | 'Opslaan mislukt'

export function useAutoBewaar(bewaar: (waarde: any) => Promise<unknown>, wacht = 600) {
  const status = ref<BewaarStatus>('')
  let timer: ReturnType<typeof setTimeout> | undefined
  function wijzig(waarde: unknown) {
    if (timer) clearTimeout(timer)
    status.value = 'Opslaan…'
    timer = setTimeout(async () => {
      try {
        await bewaar(waarde)
        status.value = 'Opgeslagen'
      } catch {
        status.value = 'Opslaan mislukt'
      }
    }, wacht)
  }
  return { status, wijzig }
}
