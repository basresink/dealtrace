// Vaste fixtures voor de Datacollectief-mock (P15, 13.5). Tien verzonnen installatiebedrijven in
// de branches br-01 en br-02 van Voltvast (SBI 4321 en 4322) in Midden- en Noord-Nederland, met
// verzonnen KvK-nummers, websites op .test en verzonnen contactpersonen. Geen echte gegevens.
// Eén record valt samen met een bestaand account (pr-03), één met een KvK-fixture (91000002),
// één contact is privé en één heeft een privé-ogend adres: die mogen nooit mee.
import type { DcRecord } from '../../../shared/leadGenerator'

const c = (id: string, voornaam: string, achternaam: string, functie: string, functieniveau: string, email: string | null, telefoon: string | null, extra: { prive?: boolean; linkedin?: string } = {}) =>
  ({ id, voornaam, achternaam, functie, functieniveau, email, telefoon, linkedin: extra.linkedin ?? null, prive: extra.prive })

export const DC_MOCK: DcRecord[] = [
  { id: 'dc-001', naam: 'Installatiebedrijf Hoekstra Techniek', kvk: '92000001', website: 'https://www.hoekstratechniek.test', plaats: 'Leeuwarden', postcode: '8921 AA', adres: 'Testweg 1', medewerkers: 28, sbi: ['4321'], telefoon: '058 400 0001',
    contacten: [c('dcp-0011', 'Jelle', 'Testhoekstra', 'Eigenaar', 'eigenaar', 'jelle@hoekstratechniek.test', '06 4000 0011'), c('dcp-0012', 'Anke', 'Proefstra', 'Projectleider', 'management', 'anke@hoekstratechniek.test', '058 400 0012')] },
  { id: 'dc-002', naam: 'Van der Meer Installaties', kvk: '92000002', website: 'https://www.vdmeerinstallaties.test', plaats: 'Assen', postcode: '9401 BB', adres: 'Proeflaan 2', medewerkers: 45, sbi: ['4322'], telefoon: '0592 400 002',
    contacten: [c('dcp-0021', 'Ruud', 'Testmeer', 'Directeur', 'directie', 'ruud@vdmeerinstallaties.test', '06 4000 0021'), c('dcp-0022', 'Mieke', 'Voorbeeld', 'Inkoper', 'medewerker', 'inkoop@vdmeerinstallaties.test', null)] },
  { id: 'dc-003', naam: 'Kroon Elektrotechniek', kvk: '92000003', website: 'https://www.kroonelektro.test', plaats: 'Zwolle', postcode: '8017 CC', adres: 'Fictiestraat 3', medewerkers: 19, sbi: ['4321'], telefoon: '038 400 0003',
    contacten: [c('dcp-0031', 'Bas', 'Testkroon', 'Eigenaar', 'eigenaar', 'bas@kroonelektro.test', '06 4000 0031'), c('dcp-0032', 'Ilse', 'Privéproef', 'Eigenaar', 'eigenaar', 'ilse.prive@gmail.test', '06 4000 0032')] },
  { id: 'dc-004', naam: 'Bouwinstallatie Oost', kvk: '92000004', website: 'https://www.bouwinstallatieoost.test', plaats: 'Deventer', postcode: '7411 DD', adres: 'Testkade 4', medewerkers: 72, sbi: ['4321', '4322'], telefoon: '0570 400 004',
    contacten: [c('dcp-0041', 'Tim', 'Testoost', 'Operationeel directeur', 'directie', 'tim@bouwinstallatieoost.test', '06 4000 0041'), c('dcp-0042', 'Sara', 'Verzonnen', 'Thuiswerkadres', 'medewerker', null, '06 4000 0042', { prive: true })] },
  { id: 'dc-005', naam: 'Klimaattechniek Noord', kvk: '92000005', website: 'https://www.klimaatnoord.test', plaats: 'Groningen', postcode: '9723 EE', adres: 'Proefplein 5', medewerkers: 12, sbi: ['4322'], telefoon: '050 400 0005',
    contacten: [c('dcp-0051', 'Joris', 'Testklimaat', 'Eigenaar', 'eigenaar', 'joris@klimaatnoord.test', '06 4000 0051')] },
  { id: 'dc-006', naam: 'Elektro Veluwe', kvk: '92000006', website: 'https://www.elektroveluwe.test', plaats: 'Apeldoorn', postcode: '7311 FF', adres: 'Voorbeeldweg 6', medewerkers: 33, sbi: ['4321'], telefoon: '055 400 0006',
    contacten: [c('dcp-0061', 'Hanna', 'Testveluwe', 'Bedrijfsleider', 'management', 'hanna@elektroveluwe.test', '055 400 0061')] },
  { id: 'dc-007', naam: 'Sanitair en Warmte Drenthe', kvk: '92000007', website: 'https://www.swdrenthe.test', plaats: 'Emmen', postcode: '7811 GG', adres: 'Testlaan 7', medewerkers: 9, sbi: ['4322'], telefoon: null,
    contacten: [c('dcp-0071', 'Kees', 'Proefdrent', 'Eigenaar', 'eigenaar', null, '06 4000 0071')] },
  { id: 'dc-008', naam: 'Installatietechniek Midden', kvk: '92000008', website: 'https://www.itmidden.test', plaats: 'Amersfoort', postcode: '3811 HH', adres: 'Fictiepad 8', medewerkers: 51, sbi: ['4321', '4322'], telefoon: '033 400 0008',
    contacten: [c('dcp-0081', 'Lotte', 'Testmidden', 'Directeur', 'directie', 'lotte@itmidden.test', '06 4000 0081'), c('dcp-0082', 'Pim', 'Verzinsel', 'Hoofd inkoop', 'management', 'pim@itmidden.test', '033 400 0082')] },
  // Valt samen met het bestaande account pr-03 (Testinstallatie Stroomdal): "Al in je bestand".
  { id: 'dc-009', naam: 'Testinstallatie Stroomdal', kvk: '99000103', website: 'https://www.stroomdal.test', plaats: 'Meppel', postcode: '7941 JJ', adres: 'Proefsingel 9', medewerkers: 24, sbi: ['4321'], telefoon: '0522 400 009',
    contacten: [c('dcp-0091', 'Frank', 'Teststroom', 'Eigenaar', 'eigenaar', 'frank@stroomdal.test', '06 4000 0091'), c('dcp-0092', 'Noor', 'Proefdal', 'Werkvoorbereider', 'medewerker', 'noor@stroomdal.test', '0522 400 092')] },
  // Valt samen met de KvK-fixture 91000002 (Installatiebedrijf Vonk & Zn).
  { id: 'dc-010', naam: 'Installatiebedrijf Vonk & Zn', kvk: '91000002', website: 'https://www.vonkinstallatie.test', plaats: 'Groningen', postcode: '9723 BC', adres: 'Osloweg 4', medewerkers: 34, sbi: ['4321'], telefoon: '050 300 0102',
    contacten: [c('dcp-0101', 'Sanne', 'Vonk', 'Directeur', 'directie', 'sanne@vonkinstallatie.test', '06 4000 0101')] },
]
