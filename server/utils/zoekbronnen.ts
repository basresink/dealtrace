// Register van zoekbronnen voor de globale zoek (P01 voorstel: elke feature voegt een bron toe).
// Zoeken is accent- en hoofdletterongevoelig.

import { ilike, or } from 'drizzle-orm'
import { FUNCTIES, beschikbaar } from '../../shared/functies'
import { metOrganisatie, schema } from './db'
import type { Context } from './sessie'

export interface ZoekRij {
  titel: string
  detail?: string
  link: string
  /** Functie staat niet aan voor dit niveau: tonen met slot. */
  slot?: boolean
  /** Een korte tag naast de titel, zoals "Gedeactiveerd" (0064). */
  label?: string
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
  {
    // Prospects en klanten op naam of plaats. Gedeactiveerde accounts (0064) blijven vindbaar, met een label en achteraan.
    soort: 'accounts',
    label: 'Prospects',
    async zoek(q, ctx) {
      if (!beschikbaar('prospects.kaart', ctx.gebruiker, ctx.organisatie, ctx.stand).ok) return []
      const n = normaliseer(q.trim())
      if (n.length < 2) return []
      const a = schema.accounts
      const patroon = `%${q.trim().replace(/[%_]/g, '')}%`
      const rijen = await metOrganisatie(ctx.organisatie.id, (tx) =>
        tx.select({ id: a.id, naam: a.name, plaats: a.city, soort: a.accountKind, uit: a.gedeactiveerdOp }).from(a).where(or(ilike(a.name, patroon), ilike(a.city, patroon))).limit(40))
      return rijen
        .filter((r) => normaliseer(`${r.naam} ${r.plaats ?? ''}`).includes(n))
        .sort((x, y) => Number(!!x.uit) - Number(!!y.uit) || x.naam.localeCompare(y.naam, 'nl'))
        .map((r) => ({ titel: r.naam, detail: [r.soort === 'klant' ? 'Klant' : 'Prospect', r.plaats].filter(Boolean).join(' · '), link: `/accounts/${r.id}`, ...(r.uit ? { label: 'Gedeactiveerd' } : {}) }))
    },
  },
]
