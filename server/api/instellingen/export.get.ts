// GET /api/instellingen/export: alle data van de eigen organisatie als zip (CSV per tabel en instellingen.json),
// direct gemaakt en meegestuurd. Alleen de beheerder, niet de founder die meekijkt; altijd een auditregel.
// De organisatie komt uit de sessie, nooit uit het verzoek; RLS en een eigen filter per query.
import { exportBestandsnaam } from '../../../shared/privacy'
import { metOrganisatie } from '../../utils/db'
import { auditExport, bouwExport, vereisPrivacyBeheer } from '../../utils/privacy'
import { vereisOrganisatie } from '../../utils/sessie'
import { maakZip } from '../../utils/zip'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  vereisPrivacyBeheer(ctx, { export: true })
  const nu = new Date()
  const org = ctx.organisatie
  const uitslag = await metOrganisatie(org.id, async (tx) => {
    const u = await bouwExport(tx, org.id, { organisatieNaam: org.naam, door: ctx.gebruiker.naam, nu })
    await auditExport(tx, org.id, ctx.gebruiker.id, u)
    return u
  })
  const zip = maakZip(uitslag.bestanden, nu)
  setResponseHeader(event, 'content-type', 'application/zip')
  setResponseHeader(event, 'content-disposition', `attachment; filename="${exportBestandsnaam(org.naam, nu)}"`)
  setResponseHeader(event, 'cache-control', 'no-store')
  return zip
})
