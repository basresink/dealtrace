// GET /api/functies: de catalogus met per functie of hij beschikbaar is en waarom niet (4.2).
import { catalogusVoor } from '../../shared/functies'
import { vereisOrganisatie } from '../utils/sessie'

export default defineEventHandler(async (event) => {
  const { gebruiker, organisatie, stand } = await vereisOrganisatie(event)
  return catalogusVoor(gebruiker, organisatie, stand)
})
