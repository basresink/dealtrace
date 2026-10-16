// GET /api/mij/profiel: je eigen gegevens voor Account (/mij): naam in voor- en achternaam, functie,
// telefoon, mobiel, je inlogadres, de profielfoto, je plek in de organisatie en de stand van de
// tweestapsverificatie. Alleen lezen als de founder in een organisatie werkt.
import { eq } from 'drizzle-orm'
import { splitsNaam } from '../../../shared/profiel'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisSessie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisSessie(event)
  const g = ctx.gebruiker
  const d = (g.data ?? {}) as Record<string, any>
  const p = (d.profiel ?? {}) as Record<string, string | undefined>
  const afgeleid = splitsNaam(g.naam)
  const team = ctx.organisatie && g.teamId
    ? await metOrganisatie(ctx.organisatie.id, async (tx) => (await tx.select({ naam: schema.teams.naam }).from(schema.teams).where(eq(schema.teams.id, g.teamId!)))[0]?.naam ?? null)
    : null
  return {
    naam: g.naam,
    voornaam: p.voornaam ?? afgeleid.voornaam,
    achternaam: p.achternaam ?? afgeleid.achternaam,
    functie: p.functie ?? '',
    telefoon: p.telefoon ?? '',
    mobiel: p.mobiel ?? '',
    email: g.email,
    fotoUrl: d.fotoId && ctx.organisatie ? `/api/bijlagen/${d.fotoId}` : null,
    organisatie: ctx.organisatie?.naam ?? null,
    team,
    rol: ctx.echteRol,
    niveau: g.niveau,
    werkplek: g.werkplek,
    magOrganisatieBeheren: g.rol === 'beheerder',
    alleenLezen: !!ctx.werkIn || !ctx.organisatie,
    tweestap: { aan: !!d.totp?.aan, verplicht: ctx.echteRol === 'founder', mag: ['beheerder', 'founder'].includes(ctx.echteRol) },
  }
})
