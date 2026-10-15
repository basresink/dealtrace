// GET /api/me: de ingelogde gebruiker met rol, niveau, werkplek, team, zijbalk en
// beschikbare functies. De client rekent niets zelf uit wat de server weigert.

import { eq } from 'drizzle-orm'
import { catalogusVoor, functie } from '../../shared/functies'
import { zijbalkVoor } from '../../shared/zijbalk'
import { resterendTekst } from '../../shared/werkIn'
import { metOrganisatie, schema } from '../utils/db'
import { vereisSessie } from '../utils/sessie'

export default defineEventHandler(async (event) => {
  const { gebruiker, organisatie, stand, werkIn, echteRol } = await vereisSessie(event)
  const platformItem = { sleutel: 'nav.platform', naam: 'Platformbeheer', route: '/platform/klanten', icoon: 'Server', groep: 'Beheer' }

  if (!organisatie) {
    // Founder buiten een organisatie: alleen Platformbeheer (P02).
    return {
      gebruiker: { id: gebruiker.id, naam: gebruiker.naam, email: gebruiker.email, rol: gebruiker.rol, niveau: gebruiker.niveau, werkplek: gebruiker.werkplek },
      echteRol,
      werkIn: null,
      organisatie: null,
      team: null,
      zijbalk: { groepen: [{ naam: 'Beheer', items: [platformItem] }], nietAangezet: [] },
      functies: [],
      nieuw: [],
      nogTonen: [],
    }
  }

  const team = await metOrganisatie(organisatie.id, async (tx) => {
    if (werkIn) return null
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
    echteRol,
    werkIn: werkIn ? { organisatie: werkIn.organisatieNaam, organisatieId: werkIn.organisatieId, modus: werkIn.modus, reden: werkIn.reden, resterendMs: werkIn.resterendMs, resterend: resterendTekst(werkIn.resterendMs) } : null,
    organisatie: { id: organisatie.id, naam: organisatie.naam, pakket: organisatie.pakket, iedereenAlles: organisatie.iedereenAlles },
    team,
    zijbalk: metPlatform(zijbalkVoor(gebruiker, organisatie, stand), werkIn ? platformItem : null),
    functies: catalogusVoor(gebruiker, organisatie, stand),
    nieuw,
    nogTonen: (nogTonen ?? []).map((s) => ({ sleutel: s, naam: functie(s)?.naam ?? s, helpartikel: functie(s)?.helpartikel ?? null })),
  }
})

/** De founder die in een organisatie werkt, houdt Platformbeheer in de zijbalk. */
function metPlatform<Z extends { groepen: { naam: string; items: any[] }[] }>(z: Z, item: any): Z {
  if (!item) return z
  const beheer = z.groepen.find((g) => g.naam === 'Beheer')
  if (beheer) beheer.items = [...beheer.items.filter((i) => i.sleutel !== item.sleutel), item]
  else z.groepen.push({ naam: 'Beheer', items: [item] })
  return z
}
