// PUT /api/afspraken/:id {meetingsoortId?, titel?, start?, duurMin?, contactId?, locatie?, beschrijving?}: een geplande
// afspraak wijzigen vanuit het afspraakvenster. De vorm volgt uit het type; het contact hoort bij de prospect.
// Rechten zoals bij verplaatsen en afronden (vereisAfspraak); de gekoppelde agenda krijgt de nieuwe stand.
import { wijzigAfspraak, type WijzigInvoer } from '../../../utils/agenda'
import { vereisAfspraak } from '../../../utils/afspraakToegang'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'agenda.basis')
  const id = getRouterParam(event, 'id')!
  const b = (await readBody<WijzigInvoer>(event)) ?? {}
  const invoer: WijzigInvoer = {}
  if (typeof b.meetingsoortId === 'string' && b.meetingsoortId) invoer.meetingsoortId = b.meetingsoortId
  if (b.titel !== undefined) invoer.titel = b.titel === null ? null : String(b.titel)
  if (typeof b.start === 'string' && b.start) invoer.start = b.start
  if (b.duurMin !== undefined) invoer.duurMin = Number(b.duurMin)
  if (b.contactId !== undefined) invoer.contactId = b.contactId ? String(b.contactId) : null
  if (b.locatie !== undefined) invoer.locatie = b.locatie === null ? null : String(b.locatie)
  if (b.beschrijving !== undefined) invoer.beschrijving = b.beschrijving === null ? null : String(b.beschrijving)
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    await vereisAfspraak(tx, ctx, id)
    return wijzigAfspraak(tx, ctx.organisatie.id, id, ctx.gebruiker.id, invoer)
  })
})
