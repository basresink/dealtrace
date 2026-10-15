// GET /api/me: de ingelogde gebruiker met rol, niveau, werkplek, team, zijbalk en
// beschikbare functies. De client rekent niets zelf uit wat de server weigert.

import { eq } from 'drizzle-orm'
import { catalogusVoor, functie } from '../../shared/functies'
import { zijbalkVoor } from '../../shared/zijbalk'
import { metOrganisatie, schema } from '../utils/db'
import { vereisSessie } from '../utils/sessie'

export default defineEventHandler(async (event) => {
  const { gebruiker, organisatie, stand } = await vereisSessie(event)

  if (!organisatie) {
    // Founder buiten een organisatie: alleen Platformbeheer (P02).
    return {
      gebruiker: { id: gebruiker.id, naam: gebruiker.naam, email: gebruiker.email, rol: gebruiker.rol, niveau: gebruiker.niveau, werkplek: gebruiker.werkplek },
      organisatie: null,
      team: null,
      zijbalk: { groepen: [{ naam: 'Beheer', items: [{ sleutel: 'nav.platform', naam: 'Platformbeheer', route: '/platform', icoon: 'Server', groep: 'Beheer' }] }], nietAangezet: [] },
      functies: [],
      nieuw: [],
      nogTonen: [],
    }
  }

  const team = await metOrganisatie(organisatie.id, async (tx) => {
    await tx.update(schema.users).set({ laatsteInlog: new Date().toISOString() }).where(eq(schema.users.id, gebruiker.id))
    if (!gebruiker.teamId) return null
    const [t] = await tx.select({ id: schema.teams.id, naam: schema.teams.naam }).from(schema.teams).where(eq(schema.teams.id, gebruiker.teamId))
    return t ?? null
  })

  const nu = new Date().toISOString()
  const nieuw = Object.entries(gebruiker.data.nieuwTot ?? {}).filter(([, tot]) => tot > nu).map(([sleutel]) => sleutel)
  const nogTonen = (gebruiker.data as any).nogTonen as string[] | undefined

  return {
    gebruiker: {
      id: gebruiker.id,
      naam: gebruiker.naam,
      email: gebruiker.email,
      rol: gebruiker.rol,
      niveau: gebruiker.niveau,
      werkplek: gebruiker.werkplek,
      verborgen: gebruiker.verborgen,
    },
    organisatie: { id: organisatie.id, naam: organisatie.naam, pakket: organisatie.pakket, iedereenAlles: organisatie.iedereenAlles },
    team,
    zijbalk: zijbalkVoor(gebruiker, organisatie, stand),
    functies: catalogusVoor(gebruiker, organisatie, stand),
    nieuw,
    nogTonen: (nogTonen ?? []).map((s) => ({ sleutel: s, naam: functie(s)?.naam ?? s, helpartikel: functie(s)?.helpartikel ?? null })),
  }
})
