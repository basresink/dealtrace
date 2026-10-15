// Register van zoekbronnen voor de globale zoek (P01 voorstel: elke feature voegt een bron toe).
// Zoeken is accent- en hoofdletterongevoelig.

import { FUNCTIES, beschikbaar } from '../../shared/functies'
import { metOrganisatie, schema } from './db'
import type { Context } from './sessie'

export interface ZoekRij {
  titel: string
  detail?: string
  link: string
  /** Functie staat niet aan voor dit niveau: tonen met slot. */
  slot?: boolean
}

export interface ZoekBron {
  soort: string
  label: string
  zoek(q: string, ctx: Context & { organisatie: NonNullable<Context['organisatie']> }): Promise<ZoekRij[]>
}

export function normaliseer(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export const zoekBronnen: ZoekBron[] = [
  {
    soort: 'paginas',
    label: "Pagina's",
    async zoek(q, ctx) {
      const n = normaliseer(q)
      return FUNCTIES.filter((f) => f.zijbalk && normaliseer(f.naam).includes(n)).flatMap((f): ZoekRij[] => {
        const b = beschikbaar(f.sleutel, ctx.gebruiker, ctx.organisatie, ctx.stand)
        if (!b.ok && b.reden !== 'niveau') return []
        return [{ titel: f.naam, link: f.zijbalk!.route, slot: !b.ok }]
      })
    },
  },
  {
    soort: 'gebruikers',
    label: 'Collega’s',
    async zoek(q, ctx) {
      const n = normaliseer(q)
      const rijen = await metOrganisatie(ctx.organisatie.id, (tx) =>
        tx.select({ id: schema.users.id, naam: schema.users.name, email: schema.users.email, status: schema.users.status }).from(schema.users))
      return rijen
        .filter((u) => u.status !== 'gearchiveerd' && (normaliseer(u.naam).includes(n) || normaliseer(u.email).includes(n)))
        .map((u) => ({
          titel: u.naam,
          detail: u.email,
          link: ['beheerder', 'salesmanager'].includes(ctx.gebruiker.rol) ? `/instellingen/gebruikers?gebruiker=${u.id}` : '/',
        }))
    },
  },
]
