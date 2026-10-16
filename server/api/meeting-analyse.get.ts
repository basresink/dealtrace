// GET /api/meeting-analyse?scope=eigen|team&persoon=&venster=week|maand|kwartaal|periode&van=&tot=&soort=&vorm=
// De meetinganalyse (F09) in de opzet van DealDrive /meeting-analyse: het meetingritme per
// accountklasse tegen de afspraakmatrix, meetings (online en telefoon) per soort met uitkomst,
// verslag, transcript, Notulist en doorlooptijd naar vervolg, en de dekking per regio.
// Functie agenda.meetingAnalyse (Gevorderd); het teambeeld alleen voor de salesmanager en de beheerder.
import { meetingAnalyse } from '../utils/afspraakAnalyse'
import { metOrganisatie } from '../utils/db'
import { vereisFunctie } from '../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'agenda.meetingAnalyse')
  const q = getQuery(event)
  return metOrganisatie(ctx.organisatie.id, (tx) => meetingAnalyse(tx, { id: ctx.gebruiker.id, rol: ctx.gebruiker.rol }, q))
})
