// Terug naar de Meer-flyout (accountkaart en contactkaart). De pagina maakt met maakMeerTerug() een context en
// geeft die met provide door; kiest de gebruiker een kader in Meer, dan zet de pagina een merkteken
// (markeer). De eerste flyout (FlyoutShell) die daarna binnen een seconde opengaat, neemt het merkteken over
// en toont in zijn kop de knop "Meer" met een pijl naar links. Die knop en Escape sluiten de flyout en openen
// Meer weer; het kruisje en een klik naast de flyout sluiten alles.
import type { InjectionKey } from 'vue'

export interface MeerTerug {
  label: string
  /** Zet het merkteken net voordat een venster vanuit Meer opengaat. */
  markeer: () => void
  /** Neemt het merkteken over (alleen binnen een seconde na markeer); true als deze flyout terug kan. */
  claim: () => boolean
  /** Opent Meer weer. */
  terug: () => void
}

export const MEER_TERUG: InjectionKey<MeerTerug> = Symbol('meerTerug')

export function maakMeerTerug(terug: () => void, label = 'Meer'): MeerTerug {
  let gemarkeerd = 0
  const ctx: MeerTerug = {
    label,
    markeer: () => { gemarkeerd = Date.now() },
    claim: () => {
      if (!gemarkeerd || Date.now() - gemarkeerd > 1000) return false
      gemarkeerd = 0
      return true
    },
    terug,
  }
  provide(MEER_TERUG, ctx)
  return ctx
}
