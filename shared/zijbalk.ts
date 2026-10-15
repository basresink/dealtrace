// De zijbalk per gebruiker (bouwplan 6.1). Eén pure functie voor server en client.
//
// Een lager niveau laat items weg maar verandert nooit de plek of vorm van wat
// blijft. Wat voor het niveau uit staat, komt in de groep "Nog niet aangezet".
// "Toon minder" haalt items weg, nooit erbij.

import { FUNCTIES, aanVanaf, beschikbaar, type Functie, type ZijbalkGroep } from './functies'
import type { FunctieRegel, GebruikerContext, Niveau, OrganisatieContext } from './types'

export interface ZijbalkItem {
  sleutel: string
  naam: string
  route: string
  icoon: string
  groep: ZijbalkGroep
  /** "meedoen" of "lezen" bij Beginner (6.1). */
  label?: string
  /** Bij items in "Nog niet aangezet": het niveau waarvoor ze aanstaan. */
  aanVanaf?: Niveau | null
}

export interface Zijbalk {
  groepen: { naam: ZijbalkGroep; items: ZijbalkItem[] }[]
  nietAangezet: ZijbalkItem[]
}

const GROEPEN: ZijbalkGroep[] = ['Start', 'Werk', 'Prospects', 'Plannen', 'Resultaat', 'Manager', 'Beheer']

function naarItem(f: Functie, label?: string): ZijbalkItem {
  const z = f.zijbalk!
  return { sleutel: f.sleutel, naam: f.naam, route: z.route, icoon: z.icoon, groep: z.groep, ...(label ? { label } : {}) }
}

/** Volgorde binnen "Werk": binnendienst Belblokken boven Bezoeken, buitendienst andersom. */
function werkVolgorde(items: Functie[], werkplek: GebruikerContext['werkplek']): Functie[] {
  if (werkplek !== 'buitendienst') return items
  const i = items.findIndex((f) => f.sleutel === 'nav.belblokken')
  const j = items.findIndex((f) => f.sleutel === 'nav.bezoeken')
  if (i < 0 || j < 0) return items
  const kopie = [...items]
  ;[kopie[i], kopie[j]] = [kopie[j]!, kopie[i]!]
  return kopie
}

export function zijbalkVoor(
  gebruiker: GebruikerContext,
  organisatie: OrganisatieContext,
  stand: FunctieRegel[],
): Zijbalk {
  const groepen: Zijbalk['groepen'] = []
  const nietAangezet: ZijbalkItem[] = []

  for (const groep of GROEPEN) {
    const kandidaten = werkVolgorde(
      FUNCTIES.filter((f) => f.zijbalk?.groep === groep),
      gebruiker.werkplek,
    )
    const items: ZijbalkItem[] = []
    for (const f of kandidaten) {
      if (gebruiker.verborgen.includes(f.sleutel)) continue
      const b = beschikbaar(f.sleutel, gebruiker, organisatie, stand)
      if (b.ok) {
        const label = gebruiker.niveau === 'beginner' && !organisatie.iedereenAlles ? f.zijbalk!.beginnerLabel : undefined
        items.push(naarItem(f, label))
      } else if (b.reden === 'niveau') {
        nietAangezet.push({ ...naarItem(f), aanVanaf: aanVanaf(f.sleutel, organisatie, stand) })
      }
      // Buiten pakket of rol: niet tonen in de zijbalk.
    }
    if (items.length) groepen.push({ naam: groep, items })
  }
  return { groepen, nietAangezet }
}

export function telItems(z: Zijbalk): number {
  return z.groepen.reduce((n, g) => n + g.items.length, 0)
}
