// Vaste fixtures voor de KvK-mock en de webzoeker-mock (13.5). Alle bedrijven, nummers,
// namen en websites zijn verzonnen (domeinen op .test); geen echte KvK-data.

export interface MockBedrijf {
  kvk: string; naam: string; plaats: string; postcode: string; adres: string; lat: number; lng: number
  sbi: { code: string; omschrijving: string }[]; medewerkers: number | null; website: string | null; telefoon: string | null
  /** Tekst op de website, voor de webzoeker-mock. */
  pagina?: string
  /** Wijziging in het handelsregister voor de maandelijkse controle. */
  mutatie?: string
}

const ELEK = { code: '4321', omschrijving: 'Elektrotechnische bouwinstallatie' }
const LOOD = { code: '4322', omschrijving: 'Loodgieters- en fitterswerk; installatie van sanitair en verwarming' }
const VAST = { code: '6820', omschrijving: 'Verhuur van overig onroerend goed' }
const BOUW = { code: '4120', omschrijving: 'Algemene burgerlijke en utiliteitsbouw' }

const b = (kvk: string, naam: string, plaats: string, postcode: string, adres: string, lat: number, lng: number, sbi: MockBedrijf['sbi'], medewerkers: number | null, web: string | null, telefoon: string | null, pagina?: string, mutatie?: string): MockBedrijf =>
  ({ kvk, naam, plaats, postcode, adres, lat, lng, sbi, medewerkers, website: web ? `https://www.${web}` : null, telefoon, pagina, mutatie })

export const MOCK_BEDRIJVEN: MockBedrijf[] = [
  b('91000001', 'Teeuwen Bouw B.V.', 'Zwolle', '8011 AB', 'Hanzelaan 12', 52.51, 6.09, [ELEK, BOUW], 62, 'teeuwenbouw.test', '038 300 0101',
    'Teeuwen Bouw werft twee servicemonteurs voor onderhoud aan woningbouwprojecten. Peter Kok, eigenaar, bereikbaar op 038 300 0101. Wij openen in 2027 een nieuwe vestiging in Kampen.'),
  b('91000002', 'Installatiebedrijf Vonk & Zn', 'Groningen', '9723 BC', 'Osloweg 4', 53.2, 6.6, [ELEK], 34, 'vonkinstallatie.test', '050 300 0102',
    'Installatiebedrijf Vonk zoekt een projectleider elektra voor nieuwbouw in Groningen. Contact: Sanne Vonk, directeur, sanne@vonkinstallatie.test.'),
  b('91000003', 'Elektra Noorderzon', 'Leeuwarden', '8939 AD', 'Fokkerweg 9', 53.2, 5.8, [ELEK], 18, 'noorderzon-elektra.test', '058 300 0103',
    'Elektra Noorderzon legt zonnepanelen op daken van woningcorporaties. Ruud Hoekstra, eigenaar.'),
  b('91000004', 'Warmtetechniek Assen', 'Assen', '9403 AC', 'Industrieweg 21', 52.99, 6.56, [LOOD], 45, 'warmtetechniek-assen.test', '0592 300 104',
    'Warmtetechniek Assen breidt uit met een tweede werkplaats. Wij werven monteurs warmtepompen.'),
  b('91000005', 'Bouwgroep Hunzedal', 'Emmen', '7821 AJ', 'Phileas Foggstraat 3', 52.79, 6.9, [BOUW, ELEK], 120, 'hunzedal-bouw.test', '0591 300 105',
    'Bouwgroep Hunzedal bouwt 240 woningen in Emmen-Noord. Inkoop via Marieke Dijk, hoofd inkoop.'),
  b('91000006', 'De Klinker Installaties', 'Drachten', '9207 JA', 'Raai 8', 53.11, 6.1, [ELEK, LOOD], 27, 'deklinker.test', '0512 300 106',
    'De Klinker Installaties zoekt een servicemonteur. Bel Henk de Jong, bedrijfsleider, op 0512 300 106.'),
  b('91000007', 'Vastgoed Lindenhof', 'Hoogeveen', '7901 CA', 'Grote Kerkstraat 30', 52.72, 6.48, [VAST], 9, 'lindenhof-vastgoed.test', '0528 300 107',
    'Vastgoed Lindenhof beheert 600 huurwoningen in Drenthe en renoveert in 2027 vier complexen.'),
  b('91000008', 'Kabel & Co Elektrotechniek', 'Amersfoort', '3821 AE', 'Computerweg 2', 52.17, 5.39, [ELEK], 55, 'kabelenco.test', '033 300 0108',
    'Kabel & Co Elektrotechniek opent een nieuwe vestiging in Utrecht. Lotte Smit, operationeel directeur.'),
  b('91000009', 'Installatietechniek Eemland', 'Amersfoort', '3812 PM', 'Plotterweg 31', 52.16, 5.37, [ELEK, LOOD], 75, 'eemland-it.test', '033 300 0109',
    'Installatietechniek Eemland werft vijf servicemonteurs. Contact: Bas Pronk, eigenaar, 033 300 0109.'),
  b('91000010', 'Domotica Utrecht', 'Utrecht', '3542 AB', 'Atoomweg 50', 52.09, 5.07, [ELEK], 12, 'domotica-utrecht.test', null,
    'Domotica Utrecht installeert slimme meters en laadpalen.'),
  b('91000011', 'Elektro Veluwe', 'Apeldoorn', '7333 NP', 'Ravenweg 3', 52.21, 5.96, [ELEK], 38, 'elektroveluwe.test', '055 300 0111',
    'Elektro Veluwe groeit en zoekt een werkvoorbereider. Anja Mulder, directeur.'),
  b('91000012', 'Zonnewerk Twente', 'Enschede', '7521 PH', 'Hengelosestraat 500', 52.23, 6.86, [ELEK], 22, 'zonnewerk-twente.test', '053 300 0112',
    'Zonnewerk Twente plaatst zonnepanelen en thuisbatterijen in heel Overijssel.'),
  b('91000013', 'Installatiebedrijf Maaskant', 'Maastricht', '6211 AB', 'Boschstraat 7', 50.85, 5.69, [ELEK, LOOD], 48, 'maaskant-installatie.test', '043 300 0113',
    'Installatiebedrijf Maaskant werft monteurs voor projecten in Limburg.'),
  b('91000014', 'Klein Elektra Wessels', 'Meppel', '7941 KH', 'Stationsweg 4', 52.69, 6.19, [ELEK], 4, null, '0522 300 114'),
  b('91000015', 'Bouwbedrijf Ter Horst', 'Zwolle', '8013 PZ', 'Marsweg 20', 52.52, 6.12, [BOUW], 90, 'terhorstbouw.test', '038 300 0115',
    'Bouwbedrijf Ter Horst start met de bouw van 80 appartementen aan de IJssel.'),
  b('91000016', 'Woningbeheer Eemhof', 'Amersfoort', '3811 HD', 'Hof 22', 52.15, 5.39, [VAST], 14, 'eemhof.test', '033 300 0116'),
  b('91000017', 'Technisch Bureau Lelie', 'Almere', '1316 AB', 'Rentmeesterweg 1', 52.37, 5.22, [ELEK], 31, 'tblelie.test', '036 300 0117',
    'Technisch Bureau Lelie zoekt een servicemonteur elektra. Johan Lelie, eigenaar.', 'Nieuwe bestuurder ingeschreven'),
  b('91000018', 'Groen Installatietechniek', 'Hengelo', '7553 GA', 'Enschedesestraat 80', 52.26, 6.79, [LOOD], 26, 'groen-it.test', '074 300 0118'),
  b('91000019', 'Installaties Noordkaap', 'Groningen', '9727 KB', 'Paterswoldseweg 800', 53.19, 6.55, [ELEK, LOOD], 58, 'noordkaap.test', '050 300 0119',
    'Installaties Noordkaap neemt Elektra Haren over en werft monteurs.'),
  b('91000020', 'Elektrotechniek Vecht', 'Ommen', '7731 AA', 'Markt 2', 52.52, 6.42, [ELEK], 16, 'vecht-elektro.test', '0529 300 120'),
  // Ontdubbelen: bestaat al in het bestand (KvK van de seed) en in DealDrive (B21).
  b('99000101', 'Testinstallatie Koperwiek', 'Amersfoort', '3821 BA', 'Koperweg 1', 52.17, 5.4, [ELEK], 40, 'koperwiek.test', '033 300 0199'),
  b('99123456', 'Testbrontsma Installatietechniek', 'Leeuwarden', '8901 BA', 'Brontsmaweg 5', 53.2, 5.79, [ELEK], 30, 'testbrontsma.test', '058 300 0198'),
  b('99777777', 'Testklant Kabelwerk', 'Assen', '9401 AA', 'Kabelstraat 1', 52.99, 6.56, [ELEK], 70, 'testkabelwerk.test', '0592 300 197'),
]

/** Zoekresultaten van de webzoeker-mock: per bedrijf met website een treffer met een fragment. */
export function mockZoekresultaten(vraag: string): { url: string; titel: string; fragment: string }[] {
  const t = vraag.toLowerCase()
  const woorden = t.split(/[^a-z0-9]+/).filter((w) => w.length >= 4)
  return MOCK_BEDRIJVEN.filter((x) => x.website && x.pagina)
    .map((x) => ({ x, hits: woorden.filter((w) => `${x.naam} ${x.plaats} ${x.pagina} ${x.sbi.map((s) => s.omschrijving).join(' ')}`.toLowerCase().includes(w.slice(0, 6))).length }))
    .filter((r) => r.hits > 0).sort((a, b) => b.hits - a.hits)
    .map(({ x }) => ({ url: x.website!, titel: x.naam, fragment: x.pagina!.split(/(?<=\.)\s/)[0]! }))
}

/** De pagina achter een URL, voor het dossier. */
export function mockPagina(url: string): string | null {
  const n = (u: string) => u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '')
  return MOCK_BEDRIJVEN.find((x) => x.website && n(x.website) === n(url))?.pagina ?? null
}
