// GET /api/audit?persoon=&soort=&van=&tot=&voor=&formaat=csv: wie veranderde wat (P21). Salesmanager:
// handelingen van en op de eigen teams; beheerder alles. Een pagina van 50 regels met `volgende` als
// cursor; met formaat=csv de hele selectie als download. Zelfde lijst als /api/instellingen/audit.
import { auditAntwoord } from '../../utils/auditLijst'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => auditAntwoord(event, await vereisFunctie(event, 'nav.audit')))
