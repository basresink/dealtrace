// De ingelogde gebruiker met zijbalk en functies (GET /api/me). Eén keer laden,
// opnieuw na een wijziging van niveau, instellingen of "Toon minder".
import type { Zijbalk } from '~~/shared/zijbalk'

export interface Me {
  gebruiker: { id: string; naam: string; email: string; rol: string; niveau: string; werkplek: string; verborgen?: string[] }
  /** De echte rol; de founder die in een organisatie werkt, heeft daar de rechten van een beheerder. */
  echteRol: string
  werkIn: { organisatie: string; organisatieId: string; modus: 'meekijken' | 'wijzigen'; reden: string; resterendMs: number; resterend: string } | null
  organisatie: { id: string; naam: string; pakket: string; iedereenAlles: boolean } | null
  team: { id: string; naam: string } | null
  zijbalk: Zijbalk
  functies: { sleutel: string; naam: string; helpartikel: string; beschikbaar: boolean; reden: string | null; aanVanaf: string | null }[]
  nieuw: string[]
  nogTonen: { sleutel: string; naam: string; helpartikel: string | null }[]
}

export function useMe() {
  const me = useState<Me | null>('me', () => null)
  async function laad() {
    const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
    me.value = await $fetch<Me>('/api/me', { headers })
    return me.value
  }
  function functie(sleutel: string) {
    return me.value?.functies.find((f) => f.sleutel === sleutel)
  }
  return { me, laad, functie }
}
