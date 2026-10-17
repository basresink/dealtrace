// GET /api/me: de ingelogde gebruiker met rol, niveau, werkplek, team, zijbalk en
// beschikbare functies. De client rekent niets zelf uit wat de server weigert.

import { eq } from 'drizzle-orm'
import { catalogusVoor, functie } from '../../shared/functies'
import { werkFunctiesGezienBij } from '../utils/functiesGezien'
import { zijbalkVoor } from '../../shared/zijbalk'
import { resterendTekst } from '../../shared/werkIn'
import { metOrganisatie, schema } from '../utils/db'
import { leesLogo, logoUrl } from '../utils/organisatieLogo'
import { vereisSessie } from '../utils/sessie'

// P24: de founder buiten een organisatie ziet alle platformschermen (elk een eigen, lui geladen deel van de bundel).
const PLATFORM_ITEMS = ([
  ['platform.klanten', 'Klanten', '/platform/klanten', 'Building2'], ['platform.abonnementen', 'Abonnementen', '/platform/abonnementen', 'Briefcase'],
  ['platform.features', 'Features per niveau', '/platform/features', 'LayoutGrid'], ['platform.facturen', 'Facturen', '/platform/facturen', 'ScrollText'],
  ['platform.verbruik', 'Verbruik en credits', '/platform/verbruik', 'ChartColumn'], ['platform.ai', 'AI-koppeling', '/platform/ai', 'Sparkles'],
  ['platform.prompts', 'Agent-prompts', '/platform/prompts', 'MessagesSquare'], ['platform.help', 'Help-artikelen', '/platform/help', 'BookOpen'],
  ['platform.roadmap', 'Roadmap', '/platform/roadmap', 'Route'], ['platform.motor', 'Motor', '/platform/motor', 'RefreshCw'], ['platform.audit', 'Platformaudit', '/platform/audit', 'Lock'],
] as const).map(([sleutel, naam, route, icoon]) => ({ sleutel, naam, route, icoon, groep: 'Beheer' as const }))

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
      zijbalk: { groepen: [{ naam: 'Beheer', items: PLATFORM_ITEMS }], nietAangezet: [] },
      functies: [],
      nieuw: [],
      nogTonen: [],
    }
  }

  // P31: de snelle voorvertoning in de browser alleen als de beheerder hem aanzette.
  // Pakket E: het logo van de organisatie (zijbalk), uit dezelfde transactie.
  const { browserherkenning, logo } = await metOrganisatie(organisatie.id, async (tx) => {
    const [r] = await tx.select({ value: schema.orgSettings.value }).from(schema.orgSettings).where(eq(schema.orgSettings.key, 'spraak'))
    return { browserherkenning: !!(r?.value as any)?.browserherkenning, logo: logoUrl(await leesLogo(tx)) }
  })
  const team = await metOrganisatie(organisatie.id, async (tx) => {
    if (werkIn) return null
    await tx.update(schema.users).set({ laatsteInlog: new Date().toISOString() }).where(eq(schema.users.id, gebruiker.id))
    if (!gebruiker.teamId) return null
    const [t] = await tx.select({ id: schema.teams.id, naam: schema.teams.naam }).from(schema.teams).where(eq(schema.teams.id, gebruiker.teamId))
    return t ?? null
  })

  const nu = new Date().toISOString()
  // Functies die aangingen (hoger niveau of de founder zette iets aan): één toast, 7 dagen "nieuw".
  const g = werkIn ? null : await werkFunctiesGezienBij(gebruiker, organisatie, stand)
  const nieuw = [...new Set([...Object.entries(gebruiker.data.nieuwTot ?? {}).filter(([, tot]) => tot > nu).map(([sleutel]) => sleutel), ...(g?.nieuw ?? [])])]
  const nogTonen = g?.nogTonen ?? ((gebruiker.data as any).nogTonen as string[] | undefined)

  return {
    gebruiker: {
      id: gebruiker.id,
      naam: gebruiker.naam,
      email: gebruiker.email,
      rol: gebruiker.rol,
      niveau: gebruiker.niveau,
      werkplek: gebruiker.werkplek,
      verborgen: gebruiker.verborgen,
      eigenPortefeuille: gebruiker.rol !== 'salesmanager' || (gebruiker.data as any)?.eigenPortefeuille === true,
      totpAan: !!(gebruiker.data as any)?.totp?.aan,
      rijmodus: !!(gebruiker.data as any)?.rijmodus?.aan,
      // Profiel (Account op /mij): functie en de profielfoto (een bijlage van de gebruiker).
      functie: (gebruiker.data as any)?.profiel?.functie ?? null,
      foto: (gebruiker.data as any)?.fotoId ? `/api/bijlagen/${(gebruiker.data as any).fotoId}` : null,
      route: { thuisbasis: (gebruiker.data as any)?.thuisbasis?.adres ?? (gebruiker.data as any)?.thuisbasis?.plaats ?? null, kaartapp: (gebruiker.data as any)?.kaartapp ?? 'google' },
    },
    echteRol,
    werkIn: werkIn ? { organisatie: werkIn.organisatieNaam, organisatieId: werkIn.organisatieId, modus: werkIn.modus, reden: werkIn.reden, resterendMs: werkIn.resterendMs, resterend: resterendTekst(werkIn.resterendMs) } : null,
    organisatie: { id: organisatie.id, naam: organisatie.naam, pakket: organisatie.pakket, iedereenAlles: organisatie.iedereenAlles, browserherkenning, logo },
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
