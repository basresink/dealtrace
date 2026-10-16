// GET /api/belscripts/prospecten: de prospects uit je belblokken van vandaag (zelfde rangorde als de
// belmodus) voor het tabblad Per prospect, met het aantal bewaarde versies. Andere prospects kies je
// met de zoekkiezer.
import { bouwBellijst } from '../../../shared/belblokken'
import { metOrganisatie } from '../../utils/db'
import { laadBelKandidaten } from '../../utils/bellen'
import { prospectKeuze } from '../../utils/belscriptStudio'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'belscript.kiezen')
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const alle = await laadBelKandidaten(tx, ctx.gebruiker.id)
    const inBlok = alle.filter((k) => k.belblokId)
    const lijst = bouwBellijst(inBlok.length ? inBlok : alle, new Date(), { top: 8 })
    return { bron: inBlok.length ? 'belblok' : 'bellijst', prospecten: await prospectKeuze(tx, ctx.gebruiker.id, lijst as any) }
  })
})
