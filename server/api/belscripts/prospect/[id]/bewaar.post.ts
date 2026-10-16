// POST /api/belscripts/prospect/:id/bewaar {blokken: [{id, status?, tekst?}]}: de beoordeling van een
// AI-concept bewaren als nieuwe versie bij het prospect. Elk AI-voorstel moet bevestigd, aangepast of
// verworpen zijn (422 met het aantal dat nog open staat). Alleen je eigen concept.
import type { ProspectBesluit } from '../../../../../shared/belscripts'
import { metOrganisatie } from '../../../../utils/db'
import { bewaarProspect } from '../../../../utils/belscriptStudio'
import { vereisFunctie } from '../../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'belscript.kiezen')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<{ blokken?: { id?: string; status?: string; tekst?: string }[] }>(event)
  const besluiten: ProspectBesluit[] = (Array.isArray(b?.blokken) ? b!.blokken : []).slice(0, 40).filter((x) => typeof x?.id === 'string').map((x) => ({
    id: x.id!, status: x.status === 'bevestigd' || x.status === 'verworpen' ? x.status as 'bevestigd' | 'verworpen' : null, tekst: typeof x.tekst === 'string' ? x.tekst : null,
  }))
  return metOrganisatie(ctx.organisatie.id, (tx) => bewaarProspect(tx, ctx, id, besluiten))
})
