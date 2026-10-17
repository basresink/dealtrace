// GET /api/instellingen/audit?persoon=&soort=&van=&tot=&voor=&leverancier=1&formaat=csv: het auditlog van
// de eigen organisatie voor de beheerder, inclusief wat de leverancier deed (F23). Een pagina van 50
// regels met `volgende` als cursor; met formaat=csv de hele selectie als download.
import { vereisBeheerder } from '../../utils/beheerder'
import { auditAntwoord } from '../../utils/auditLijst'

export default defineEventHandler(async (event) => auditAntwoord(event, await vereisBeheerder(event, 'instellingen.audit')))
