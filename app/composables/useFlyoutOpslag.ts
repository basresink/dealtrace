// De opslaan-status van een flyout (UI-standaard Flyouts). De shell (FlyoutShell) toont hem rechts in de
// kop: Gewijzigd, Opslaan…, Opgeslagen om 10:42 of Kon niet opslaan, probeer opnieuw. Een bestaand item
// slaat zichzelf op (plan: na een korte pauze, flush: meteen, bijvoorbeeld bij het verlaten van een veld);
// bij iets nieuws slaat de hoofdactie op (bewaar). volg() kijkt of een formulier afwijkt van de stand bij
// het openen, zodat sluiten met wijzigingen een bevestiging in de flyout vraagt.
export type OpslagStand = 'leeg' | 'gewijzigd' | 'bezig' | 'klaar' | 'fout'

export interface FlyoutOpslag {
  stand: OpslagStand
  tijd: string
  /** Er staat iets dat nog niet bewaard is (gewijzigd of mislukt). */
  readonly open: boolean
  /** Er wacht een automatische opslag. */
  readonly gepland: boolean
  gewijzigd: () => void
  bewaar: <T>(fn: () => Promise<T>) => Promise<T>
  plan: (fn: () => Promise<unknown>, wacht?: number) => void
  flush: () => Promise<void>
  opnieuw: () => Promise<void>
  reset: () => void
  basis: () => void
  volg: (bron: () => unknown) => void
}

const hhmm = () => new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })

export function useFlyoutOpslag(): FlyoutOpslag {
  let timer: ReturnType<typeof setTimeout> | undefined
  let wachtend: (() => Promise<unknown>) | null = null
  let laatste: (() => Promise<unknown>) | null = null
  let bron: (() => unknown) | null = null
  let basisJson: string | null = null
  const toestand = reactive({ stand: 'leeg' as OpslagStand, tijd: '', gepland: false })

  async function bewaar<T>(fn: () => Promise<T>): Promise<T> {
    if (timer) clearTimeout(timer)
    wachtend = null
    toestand.gepland = false
    laatste = fn
    toestand.stand = 'bezig'
    try {
      const r = await fn()
      toestand.tijd = hhmm()
      toestand.stand = 'klaar'
      if (bron) basisJson = JSON.stringify(bron())
      return r
    } catch (e) {
      toestand.stand = 'fout'
      throw e
    }
  }
  function plan(fn: () => Promise<unknown>, wacht = 1000) {
    if (timer) clearTimeout(timer)
    wachtend = fn
    toestand.gepland = true
    toestand.stand = 'gewijzigd'
    timer = setTimeout(() => { void flush() }, wacht)
  }
  async function flush() {
    const fn = wachtend
    if (!fn) return
    try { await bewaar(fn) } catch { /* de status toont de fout */ }
  }
  async function opnieuw() {
    if (!laatste) return
    try { await bewaar(laatste) } catch { /* de status toont de fout */ }
  }
  function reset() {
    if (timer) clearTimeout(timer)
    wachtend = null
    laatste = null
    toestand.gepland = false
    toestand.stand = 'leeg'
    toestand.tijd = ''
    basisJson = null
  }
  function basis() {
    basisJson = bron ? JSON.stringify(bron()) : null
    if (toestand.stand === 'gewijzigd' && !toestand.gepland) toestand.stand = toestand.tijd ? 'klaar' : 'leeg'
  }
  function volg(b: () => unknown) {
    bron = b
    watch(b, () => {
      if (basisJson === null || toestand.stand === 'bezig' || toestand.gepland) return
      const nu = JSON.stringify(b())
      if (nu !== basisJson) toestand.stand = 'gewijzigd'
      else if (toestand.stand === 'gewijzigd') toestand.stand = toestand.tijd ? 'klaar' : 'leeg'
    }, { deep: true })
  }
  if (getCurrentInstance()) onBeforeUnmount(() => { if (timer) clearTimeout(timer) })

  return reactive({
    stand: toRef(toestand, 'stand'),
    tijd: toRef(toestand, 'tijd'),
    open: computed(() => toestand.stand === 'gewijzigd' || toestand.stand === 'fout'),
    gepland: toRef(toestand, 'gepland'),
    gewijzigd: () => { if (toestand.stand !== 'bezig') toestand.stand = 'gewijzigd' },
    bewaar,
    plan,
    flush,
    opnieuw,
    reset,
    basis,
    volg,
  }) as unknown as FlyoutOpslag
}
