// Eva Ervaren (u-07, binnendienst, Expert) uitgebreid: elke pagina als een drukke werkweek. Bovenop seedEva
// (twaalf prospects en een klant) zet deze seed 72 extra prospects en drie klanten in Regio Midden en net
// daarbuiten, verspreid over de vier branches uit het verkoopverhaal, de klassen A tot en met D (met een
// passend aantal medewerkers), elke fase van de prospectreis en een paar gedeactiveerd met een reden. Daarbij:
// contactpersonen met rol, houding en rapporteert-aan (invloedskaart), acht weken activiteiten (belpogingen
// over de uren van de dag, mails, LinkedIn, notities en gespreksverslagen), gehouden belblokken met resultaat,
// taken in het verleden, vandaag en de komende vier weken, afspraken en bezoeken met verslag, transcript en
// analyse van de Notulist, inzichten met bronnen, opvolgreeksen (lopend, gepauzeerd, raak en gestopt),
// accountplannen, campagnes (concept, actief en afgerond met kaarten), kennisbankdocumenten, dossiers en
// kwalificaties (BAND), voornemens en weekreview, bewaarde belscriptversies per prospect, concepten en meldingen.
//
// Alles is fictief: namen beginnen met Test, adressen eindigen op .test en nummers op +316120. Datums zijn
// relatief aan het moment van seeden. Idempotent: vaste id's en on conflict do nothing; staat eva-p01 er al,
// dan doet de seed niets. De regels van seedEva gelden ook hier: werkdagen tussen 08:00 en 18:00, niets tussen
// 12:00 en 12:30 en op dinsdag niets tussen 14:00 en 15:00 (de mock van de agendakoppeling), geen taken of
// activiteiten op de planningstestset (pl-..), namen die achter "Testplanning" sorteren, en grote prospects
// (klasse A en B) alleen met een afspraak, overdracht of nee, of met een lopend ritme, zodat de jaarplanning
// van de planningstestset gelijk blijft. Id's van taken die naar belblokken, signalen of accountplannen wijzen
// beginnen met eva-t, zodat de weekdagtest van seedEva ze in de goede volgorde opruimt.
import type pg from 'pg'
import { blokResultaat, type Gesprek } from '../../shared/belblokken'
import { aiBlokkenVan, beslisProspect, prospectConcept, prospectGegevens, prospectSamenvatting, type Belscript } from '../../shared/belscripts'
import { CAMPAGNESOORTEN_START } from '../../shared/campagnes'
import { isWerkdag, nlMoment, nlTijdstip, plusDagen, weekdag, type WerkdagInstelling } from '../../shared/datum'
import { kiesRitme, startRitme, type Ritme } from '../../shared/hercontact'
import { afkoelingVoorNee } from '../../shared/nbStatus'
import { planReeks, STARTSJABLONEN } from '../../shared/opvolgreeks'
import { standaardReisId } from '../../shared/reis'
import { berekenScore, laatsteContact } from '../../shared/score'
import { maandagVan } from '../../shared/weekreview'

const EVA = 'u-07'
const INST: WerkdagInstelling = { werkdagen: [1, 2, 3, 4, 5], bevrijdingsdag: 'lustrum' }

type Fase = 'gevonden' | 'dossier-compleet' | 'gekwalificeerd' | 'benaderd' | 'in-gesprek' | 'afspraak-gepland' | 'afspraak-gehouden' | 'overgedragen' | 'geparkeerd' | 'verloren'
const PAD: Fase[] = ['gevonden', 'dossier-compleet', 'gekwalificeerd', 'benaderd', 'in-gesprek', 'afspraak-gepland', 'afspraak-gehouden', 'overgedragen']
const STATUS: Record<Fase, string> = {
  gevonden: 'nieuw', 'dossier-compleet': 'nieuw', gekwalificeerd: 'in reis', benaderd: 'in reis', 'in-gesprek': 'in reis',
  'afspraak-gepland': 'gescoord', 'afspraak-gehouden': 'gescoord', overgedragen: 'overgedragen', geparkeerd: 'wachtend', verloren: 'nee',
}
const GEBEURTENIS: Record<Fase, string> = {
  gevonden: 'import', 'dossier-compleet': 'dossier-compleet', gekwalificeerd: 'gekwalificeerd', benaderd: 'eerste-contact', 'in-gesprek': 'gesprek-gevoerd',
  'afspraak-gepland': 'eerste-afspraak-gepland', 'afspraak-gehouden': 'eerste-afspraak-gehouden', overgedragen: 'overgedragen', geparkeerd: 'geparkeerd', verloren: 'geen-vervolg',
}
const KLASSE: Record<string, string> = { A: 'kl-a-prospects', B: 'kl-b-prospects', C: 'kl-c-prospects', D: 'kl-d-prospects' }
const BRANCHE_NAAM: Record<string, string> = { 'br-01': 'installatiebedrijven woningbouw', 'br-02': 'utiliteitsinstallateurs', 'br-03': 'woningcorporaties', 'br-04': 'zonne-energiebedrijven' }
const SEGMENT: Record<string, string> = { 'br-01': 'installateur', 'br-02': 'installateur', 'br-03': 'woningcorporatie', 'br-04': 'zonnepanelen' }
const FOCUS: Record<string, string> = { 'br-01': 'nieuwbouw en renovatie van woningen', 'br-02': 'installaties in kantoren, scholen en zorggebouwen', 'br-03': 'onderhoud en verduurzaming van huurwoningen', 'br-04': 'zonnedaken voor bedrijven en woningen' }
const LEVERANCIER: Record<string, string> = { 'cc-01': 'Landelijke groothandelsketen', 'cc-02': 'Online webgroothandel', 'cc-03': 'Fabrikant die direct levert', 'cc-04': 'Eigen magazijn', 'cc-05': 'Vaste leverancier zonder plan' }

// Namen sorteren achter "Testplanning": elke stam begint met Testr tot en met Testz.
const STAMMEN: Record<string, string[]> = {
  'br-01': ['Testwarmtetechniek', 'Testwoninginstall', 'Testsanitair', 'Testverwarming', 'Testwarmtepompen', 'Testrenovatie', 'Testverduurzaming', 'Testwoonklimaat'],
  'br-02': ['Testutiliteit', 'Testregeltechniek', 'Testventilatie', 'Teststroom', 'Testschakeltechniek', 'Testtechniekgroep', 'Testutiliteitstechniek', 'Testsprinkler'],
  'br-03': ['Testwonen', 'Teststichting Wonen', 'Testwoonbeheer', 'Testwoongoed', 'Testwoonstede'],
  'br-04': ['Testzonnestroom', 'Testzonnedak', 'Testsolar', 'Testzonkracht', 'Testzonnewerk'],
}
// [plaats, postcode (4 cijfers), lat, lng, provincie, in Regio Midden]
const PLAATSEN: [string, number, number, number, string, boolean][] = [
  ['Utrecht', 3521, 52.090, 5.121, 'Utrecht', true], ['Amersfoort', 3811, 52.156, 5.388, 'Utrecht', true], ['Zeist', 3701, 52.089, 5.233, 'Utrecht', true],
  ['Veenendaal', 3901, 52.028, 5.558, 'Utrecht', true], ['Houten', 3991, 52.033, 5.168, 'Utrecht', true], ['Maarssen', 3601, 52.137, 5.039, 'Utrecht', true],
  ['Breukelen', 3621, 52.172, 5.002, 'Utrecht', true], ['Bunschoten', 3751, 52.243, 5.375, 'Utrecht', true], ['Nijkerk', 3861, 52.220, 5.487, 'Gelderland', true],
  ['Barneveld', 3771, 52.140, 5.585, 'Gelderland', true], ['Leusden', 3831, 52.132, 5.429, 'Utrecht', true], ['Soest', 3761, 52.173, 5.291, 'Utrecht', true],
  ['Baarn', 3741, 52.211, 5.288, 'Utrecht', true], ['De Bilt', 3731, 52.110, 5.181, 'Utrecht', true], ['Bilthoven', 3721, 52.129, 5.204, 'Utrecht', true],
  ['Driebergen', 3971, 52.052, 5.281, 'Utrecht', true], ['Doorn', 3941, 52.033, 5.344, 'Utrecht', true], ['Wijk bij Duurstede', 3961, 51.975, 5.341, 'Utrecht', true],
  ['Rhenen', 3911, 51.959, 5.568, 'Utrecht', true], ['Woudenberg', 3931, 52.081, 5.416, 'Utrecht', true], ['Harderwijk', 3841, 52.342, 5.620, 'Gelderland', true],
  ['Ermelo', 3851, 52.299, 5.620, 'Gelderland', true], ['Putten', 3881, 52.259, 5.606, 'Gelderland', true], ['Hoevelaken', 3871, 52.175, 5.457, 'Gelderland', true],
  ['Bunnik', 3981, 52.067, 5.198, 'Utrecht', true], ['Eemnes', 3755, 52.254, 5.257, 'Utrecht', true], ['Scherpenzeel', 3925, 52.080, 5.488, 'Gelderland', true],
  // Net buiten de postcodereeksen van de regio's: deze accounts staan zonder regio.
  ['Nieuwegein', 3431, 52.029, 5.081, 'Utrecht', false], ['IJsselstein', 3401, 52.020, 5.043, 'Utrecht', false], ['Woerden', 3441, 52.085, 4.883, 'Utrecht', false],
  ['Ede', 6711, 52.040, 5.665, 'Gelderland', false], ['Wageningen', 6701, 51.965, 5.663, 'Gelderland', false], ['Culemborg', 4101, 51.955, 5.227, 'Gelderland', false],
]
const STRATEN = ['Proefstraat', 'Testlaan', 'Voorbeeldweg', 'Proefdreef', 'Testsingel', 'Voorbeeldplein', 'Oefenweg', 'Proeflaan', 'Testkade', 'Schetsstraat', 'Ontwerpweg', 'Probeerlaan', 'Testpad', 'Conceptweg']
const VOORNAMEN = ['Arjen', 'Bianca', 'Coen', 'Dewi', 'Erik', 'Femke', 'Gerben', 'Hilde', 'Ivo', 'Jolanda', 'Kees', 'Linda', 'Maarten', 'Nienke', 'Onno', 'Paula', 'Rik', 'Sabine', 'Thijs', 'Ursula', 'Vincent', 'Wendy', 'Yvonne', 'Wouter', 'Marloes', 'Ruben', 'Saskia', 'Tom', 'Ilse', 'Niels', 'Charlotte', 'Jeroen', 'Esther', 'Pim', 'Mireille', 'Hugo', 'Floor', 'Bart', 'Karin', 'Lars']
const ACHTERNAMEN = ['Testberg', 'Testdijk', 'Testveld', 'Testhof', 'Testbroek', 'Testkamp', 'Testlaar', 'Testmeer', 'Testbos', 'Testhorst', 'Testwaard', 'Testrade', 'Testpoort', 'Testvaart', 'Testgaarde', 'Testheide', 'Testbeek', 'Testakker', 'Testweide', 'Testwijk', 'Testsluis', 'Testmolen', 'Testbrink']
const FUNCTIES: Record<string, Record<string, string[]>> = {
  beslisser: { 'br-01': ['Directeur', 'Eigenaar'], 'br-02': ['Algemeen directeur', 'Directeur'], 'br-03': ['Manager vastgoed', 'Directeur bedrijfsvoering'], 'br-04': ['Directeur', 'Eigenaar'] },
  beinvloeder: { 'br-01': ['Projectleider', 'Bedrijfsleider'], 'br-02': ['Hoofd werkvoorbereiding', 'Projectleider'], 'br-03': ['Projectleider onderhoud', 'Adviseur duurzaamheid'], 'br-04': ['Hoofd projecten', 'Projectleider'] },
  champion: { 'br-01': ['Werkvoorbereider', 'Calculator'], 'br-02': ['Werkvoorbereider', 'Planner'], 'br-03': ['Coördinator onderhoud', 'Planner'], 'br-04': ['Planner', 'Werkvoorbereider'] },
  gebruiker: { 'br-01': ['Servicemonteur', 'Eerste monteur'], 'br-02': ['Eerste monteur', 'Magazijnbeheerder'], 'br-03': ['Opzichter', 'Medewerker onderhoud'], 'br-04': ['Eerste monteur', 'Magazijnbeheerder'] },
  poortwachter: { 'br-01': ['Office manager', 'Inkoper'], 'br-02': ['Inkoper', 'Office manager'], 'br-03': ['Inkoper', 'Secretariaat'], 'br-04': ['Office manager', 'Inkoper'] },
  blokkeerder: { 'br-01': ['Financieel manager'], 'br-02': ['Controller'], 'br-03': ['Controller'], 'br-04': ['Financieel manager'] },
}
const AANLEIDINGEN: Record<string, string[]> = {
  'br-01': ['Zoekt twee servicemonteurs voor warmtepompen', 'Start met een nieuwbouwproject van 60 woningen', 'Opent een tweede vestiging', 'Won een renovatieproject voor een woningcorporatie', 'Nieuwe bedrijfsleider aangesteld'],
  'br-02': ['Zoekt een projectleider utiliteit', 'Kreeg het installatiewerk voor een nieuw zorgcentrum', 'Breidt de serviceafdeling uit', 'Verhuist naar een groter bedrijfspand'],
  'br-03': ['Start een programma om 400 woningen van het gas af te halen', 'Nieuwe manager vastgoed', 'Kiest nieuwe onderhoudspartners voor 2027'],
  'br-04': ['Groeit hard in zonnedaken voor bedrijven', 'Zoekt drie monteurs voor zonnepanelen', 'Kreeg subsidie voor een opslagproject'],
}

// ── Teksten (je-vorm, geen gedachtestreepjes) ──
const T_LATER = [
  '{v} gesproken: tevreden met de huidige leverancier, maar de monteurs wachten vaak op materiaal. Terugbellen na de jaarplanning.',
  '{v} wil eerst intern overleggen met de projectleider. Volgende week terugbellen.',
  'Kort gesprek met {v}: interesse in levering per bouwfase, nu druk met een oplevering. Over twee weken weer bellen.',
  '{v} vraagt om informatie over de projectapp per mail. Daarna een belmoment plannen.',
  '{v} vertelde dat het contract met de huidige groothandel in het voorjaar afloopt. Dan opnieuw contact.',
]
const T_AFSPRAAK = [
  'Afspraak gemaakt met {v}: kennismaking over levering per bouwfase.',
  '{v} wil graag kennismaken; de planning van de projecten loopt vast op materiaal.',
  'Afspraak ingepland met {v} voor een inventarisatie op locatie.',
  '{v} reageerde op de mail en wil de projectapp zien. Afspraak staat.',
]
const T_NEE = ['Geen interesse: {v} is tevreden met de huidige leverancier.', '{v} geeft aan dat ze dit jaar niets veranderen. Geen budget.', '{v}: geen behoefte, ze werken met een eigen magazijn.']
const T_MAILS: [string, string][] = [
  ['Even voorstellen', 'Hoi {v}, ik probeerde je net te bellen. Wij helpen installateurs in {p} met levering op het uur, zodat monteurs niet wachten. Past een kort belmoment deze week?'],
  ['Levering per bouwfase', 'Hoi {v}, zoals beloofd een korte uitleg: wij leveren per bouwfase op de bouwplaats. Zal ik een voorbeeld sturen van een vergelijkbaar project?'],
  ['Praktijkvoorbeeld uit jullie branche', 'Hoi {v}, een bedrijf van vergelijkbare omvang halveerde zijn spoedbestellingen met vaste leverdagen. Interessant om dat naast jullie situatie te leggen?'],
  ['Een korte vraag', 'Hoi {v}, ik probeerde je een paar keer te bereiken. Is levering per bouwfase iets voor {b}, of zit ik bij de verkeerde persoon?'],
  ['Informatie over de projectapp', 'Hoi {v}, hierbij de informatie over de projectapp waar je om vroeg. Je monteurs zien per project wat er wanneer geleverd wordt.'],
]
const T_BEVESTIG: [string, string] = ['Bevestiging van onze afspraak', 'Hoi {v}, dank voor je tijd aan de telefoon. Hierbij de bevestiging van onze afspraak. Ik neem een voorbeeld van een leverplan mee.']
const T_VERSLAGMAIL: [string, string] = ['Verslag en vervolgstap', 'Hoi {v}, dank voor het goede gesprek. Hierbij het verslag en de afgesproken vervolgstap. Laat je weten of het klopt?']
const T_LINKEDIN = ['Connectieverzoek aan {v} met een korte notitie over levering per bouwfase.', 'Bericht aan {v}: gefeliciteerd met het nieuwe project in {p}.', 'Reactie op het bericht van {v} over de groei van het team.']
const T_GEVONDEN = ['Gevonden via de bezoekerslijst van de beurs Installatie Midden.', 'Toegevoegd uit de Leadgenerator: past bij de doelgroep.', 'Nieuw in het bestand na de import van de regiolijst.']
const T_EXTRA = ['Bellen kan het best voor 10:00 uur, daarna zitten ze op de bouw.', 'Let op: de inkoper is op maandag en dinsdag vrij.', 'Nieuwe projectenpagina op de website met drie lopende projecten.']

const pad = (n: number, l = 2) => String(n).padStart(l, '0')
const vul = (t: string, w: Record<string, string>) => t.replace(/\{(\w+)\}/g, (_, k: string) => w[k] ?? '')
const domeinVan = (naam: string) => `${naam.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '')}.test`

/** Deterministische pseudo-willekeur, zodat de seed altijd hetzelfde oplevert. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return (s >>> 8) / 16777216 }
}
type R = () => number
const kies = <T>(r: R, lijst: readonly T[]): T => lijst[Math.floor(r() * lijst.length)]!
const tussen = (r: R, a: number, b: number) => a + Math.floor(r() * (b - a + 1))
function schud<T>(r: R, lijst: T[]): T[] {
  const uit = [...lijst]
  for (let i = uit.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [uit[i], uit[j]] = [uit[j]!, uit[i]!] }
  return uit
}

/** Veel rijen in één keer (json_populate_recordset), met een vaste kolomlijst per tabel. */
async function zet(client: pg.Client, tabel: string, rijen: Record<string, unknown>[], conflict = 'on conflict do nothing') {
  if (!rijen.length) return 0
  const kolommen = [...new Set(rijen.flatMap((r) => Object.keys(r)))]
  const lijst = kolommen.map((k) => `"${k}"`).join(', ')
  let n = 0
  for (let i = 0; i < rijen.length; i += 400) {
    const deel = rijen.slice(i, i + 400).map((r) => Object.fromEntries(kolommen.map((k) => [k, r[k] ?? null])))
    const res = await client.query(`insert into ${tabel} (${lijst}) select ${lijst} from json_populate_recordset(null::${tabel}, $1::json) ${conflict}`, [JSON.stringify(deel)])
    n += res.rowCount ?? 0
  }
  return n
}

interface Contact { id: string; voor: string; achter: string; functie: string; rol: string; email: string; telefoon: string; invloed?: Record<string, unknown> }
interface Acc {
  id: string; nr: number; kind: 'prospect' | 'klant'; naam: string; branche: string; plaats: string; postcode: string; adres: string; lat: number; lng: number; provincie: string; regio: boolean
  klasse: string; medewerkers: number; monteurs: number; fase: Fase | null; tot?: Fase; S: number; sinds: number; ritme: boolean; leverancier: string | null
  aanleiding?: { tekst: string; dagen: number; heet: boolean; bron: string } | null
  gedeactiveerd?: { reden: string; toelichting: string; dag: number } | null
  contacten: Contact[]; telefoon: string; domein: string
}
interface Ev {
  acc: string; dag: number; min?: number; slot?: 'ochtend' | 'middag' | 'vrijdag' | 'los'
  soort: 'gebeld' | 'mail' | 'linkedin' | 'whatsapp' | 'notitie' | 'afspraak' | 'reactie'
  uitkomst: string | null; contact: number | null; tekst?: string | null; onderwerp?: string; titel?: string; poging?: number; herkomst?: string; verslag?: string | null; afspraak?: string
}
interface Wens {
  id: string; acc: string | null; dag: number; wens: number; slug: string; vorm: 'bezoek' | 'online' | 'telefoon'; duur: number; status: string; uitkomst?: string | null
  contact: number | null; data: Record<string, unknown>; transcript?: boolean; notulist?: boolean; verslagSoort?: 'vervolg' | 'nee' | 'klant' | 'intern' | 'telefoon'; datum?: string; start?: number
}

export async function seedEvaUitgebreid(client: pg.Client, orgId: string, nu = new Date()) {
  const leeg = { accounts: 0, contacten: 0, activiteiten: 0, taken: 0, afspraken: 0, belblokken: 0, inzichten: 0, reeksen: 0 }
  if (!(await client.query(`select 1 from users where id = $1 and organisation_id = $2`, [EVA, orgId])).rowCount) return leeg
  if ((await client.query(`select 1 from accounts where id = 'eva-p01'`)).rowCount) return leeg

  // ── Datums: werkdagen relatief aan vandaag (of de eerstvolgende werkdag in het weekend) ──
  const echt = nlMoment(nu).datum
  let vandaag = echt
  while (!isWerkdag(vandaag, INST)) vandaag = plusDagen(vandaag, 1)
  const wdCache = new Map<number, string>()
  const wd = (n: number) => {
    const al = wdCache.get(n)
    if (al) return al
    let d = vandaag
    let k = 0
    while (k < Math.abs(n)) { d = plusDagen(d, n < 0 ? -1 : 1); if (isWerkdag(d, INST)) k++ }
    wdCache.set(n, d)
    return d
  }
  const om = (dag: string, uur: number, minuut = 0) => nlTijdstip(dag, uur, minuut).toISOString()
  const omMin = (dag: string, min: number) => om(dag, Math.floor(min / 60), min % 60)
  const uurGeleden = (u: number) => new Date(nu.getTime() - u * 3600_000).toISOString()
  const reisId = standaardReisId(orgId)
  const r = rng(20261017)

  const ritmes = (await client.query(`select id, naam, bron, status, data from hercontactritmes where organisation_id = $1`, [orgId])).rows
    .map((x: any) => ({ id: x.id, naam: x.naam, bron: x.bron, status: x.status, werkplek: x.data?.werkplek, stappen: x.data?.stappen ?? [], parkeerDagen: x.data?.parkeerDagen })) as Ritme[]
  const koudRitme = kiesRitme(ritmes, 'koud', 'binnendienst')

  // ── 1. Accounts en contactpersonen ──
  const PLAN: [Fase, string][] = []
  const rep = (f: Fase, k: string, n: number) => { for (let i = 0; i < n; i++) PLAN.push([f, k]) }
  rep('gevonden', 'C', 4); rep('gevonden', 'D', 4)
  rep('dossier-compleet', 'C', 4); rep('dossier-compleet', 'D', 3)
  rep('gekwalificeerd', 'C', 5); rep('gekwalificeerd', 'D', 3)
  rep('benaderd', 'A', 1); rep('benaderd', 'B', 3); rep('benaderd', 'C', 6); rep('benaderd', 'D', 4)
  rep('in-gesprek', 'A', 1); rep('in-gesprek', 'B', 3); rep('in-gesprek', 'C', 4); rep('in-gesprek', 'D', 2)
  rep('afspraak-gepland', 'A', 1); rep('afspraak-gepland', 'B', 3); rep('afspraak-gepland', 'C', 3)
  rep('afspraak-gehouden', 'A', 1); rep('afspraak-gehouden', 'B', 2); rep('afspraak-gehouden', 'C', 2)
  rep('overgedragen', 'B', 2); rep('overgedragen', 'C', 2)
  rep('geparkeerd', 'C', 3); rep('geparkeerd', 'D', 2)
  rep('verloren', 'A', 1); rep('verloren', 'B', 1); rep('verloren', 'C', 2)
  const branches = schud(r, [...Array(30).fill('br-01'), ...Array(22).fill('br-02'), ...Array(10).fill('br-03'), ...Array(10).fill('br-04')] as string[])
  const plan = schud(r, PLAN)
  const namen = new Set<string>()
  const stamTeller: Record<string, number> = {}
  const accs: Acc[] = []
  const maakAcc = (nr: number, id: string, kind: 'prospect' | 'klant', branche: string, fase: Fase | null, klasseLetter: string): Acc => {
    let naam = ''
    let pl = PLAATSEN[0]!
    for (let poging = 0; poging < 50; poging++) {
      const k = stamTeller[branche] = (stamTeller[branche] ?? 0) + 1
      const stam = STAMMEN[branche]![k % STAMMEN[branche]!.length]!
      pl = r() < 0.86 ? kies(r, PLAATSEN.filter((p) => p[5])) : kies(r, PLAATSEN.filter((p) => !p[5]))
      naam = `${stam} ${pl[0]}`
      if (!namen.has(naam)) break
    }
    namen.add(naam)
    const [plaats, pc, lat, lng, provincie, regio] = pl
    const medewerkers = klasseLetter === 'A' ? tussen(r, 260, 620) : klasseLetter === 'B' ? tussen(r, 55, 240) : klasseLetter === 'C' ? tussen(r, 11, 48) : tussen(r, 3, 9)
    const monteurs = branche === 'br-03' ? Math.min(medewerkers, tussen(r, 2, 18)) : Math.max(1, Math.round(medewerkers * (0.45 + r() * 0.25)))
    const domein = domeinVan(naam)
    const prefix = kind === 'klant' ? 290 + nr : 200 + nr
    const aantal = kind === 'klant' ? 3 : klasseLetter === 'A' ? 5 : klasseLetter === 'B' ? tussen(r, 4, 5) : klasseLetter === 'C' ? tussen(r, 2, 3) : 2
    const rollen = aantal === 2 ? ['beslisser', r() < 0.5 ? 'beinvloeder' : 'gebruiker'] : aantal === 3 ? ['beslisser', 'beinvloeder', r() < 0.5 ? 'gebruiker' : 'poortwachter']
      : aantal === 4 ? ['beslisser', 'beinvloeder', 'champion', 'gebruiker'] : ['beslisser', 'beinvloeder', 'champion', 'gebruiker', r() < 0.5 ? 'poortwachter' : 'blokkeerder']
    const voornamen = schud(r, VOORNAMEN).slice(0, aantal)
    const contacten: Contact[] = rollen.map((rol, i) => {
      const voor = voornamen[i]!
      const achter = kies(r, ACHTERNAMEN)
      return { id: `${id}-c${i + 1}`, voor, achter, rol, functie: kies(r, FUNCTIES[rol]![branche]!), email: `${voor.toLowerCase()}.${achter.toLowerCase()}@${domein}`, telefoon: `+316120${prefix}0${i + 1}` }
    })
    return {
      id, nr, kind, naam, branche, plaats, postcode: `${pc + tussen(r, 0, 8)} ${kies(r, ['AB', 'BC', 'CD', 'DE', 'EF', 'GH', 'JK', 'KL', 'LM', 'MN', 'PR', 'RS'])}`, adres: `${kies(r, STRATEN)} ${tussen(r, 1, 140)}`,
      lat: Math.round((lat + (r() - 0.5) * 0.02) * 10000) / 10000, lng: Math.round((lng + (r() - 0.5) * 0.03) * 10000) / 10000, provincie, regio,
      klasse: kind === 'klant' ? (klasseLetter === 'A' ? 'kl-a-klanten' : klasseLetter === 'B' ? 'kl-b-klanten' : 'kl-c-klanten') : KLASSE[klasseLetter]!, medewerkers, monteurs, fase, S: 0, sinds: 0, ritme: false,
      leverancier: null, contacten, telefoon: `+316120${prefix}00`, domein,
    }
  }
  for (let i = 0; i < 72; i++) {
    const [fase, k] = plan[i]!
    accs.push(maakAcc(i + 1, `eva-p${pad(i + 1)}`, 'prospect', branches[i]!, fase, k))
  }
  const klanten = [maakAcc(1, 'eva-k02', 'klant', 'br-01', null, 'A'), maakAcc(2, 'eva-k03', 'klant', 'br-02', null, 'B'), maakAcc(3, 'eva-k04', 'klant', 'br-04', null, 'C')]
  const alle = [...accs, ...klanten]
  const accVan = new Map(alle.map((a) => [a.id, a]))

  // Fasedatums (werkdagen terug), ritme, leverancier, aanleiding en de gedeactiveerde.
  let benaderdTeller = 0
  for (const a of accs) {
    const f = a.fase!
    if (f === 'geparkeerd') a.tot = r() < 0.6 ? 'benaderd' : 'in-gesprek'
    if (f === 'verloren') a.tot = r() < 0.5 ? 'in-gesprek' : 'afspraak-gehouden'
    const bereik: Record<Fase, [number, number, number, number]> = {
      gevonden: [-10, -1, 0, 0], 'dossier-compleet': [-20, -6, -5, -1], gekwalificeerd: [-28, -8, -6, -1], benaderd: [-38, -14, -14, -4], 'in-gesprek': [-38, -20, -10, -1],
      'afspraak-gepland': [-40, -20, -8, -1], 'afspraak-gehouden': [-40, -22, -10, -1], overgedragen: [-40, -25, -8, -1], geparkeerd: [-40, -22, -6, -1], verloren: [-40, -22, -15, -2],
    }
    const [s1, s2, d1, d2] = bereik[f]
    a.S = tussen(r, s1, s2)
    a.sinds = f === 'gevonden' ? a.S : tussen(r, d1, d2)
    const len = (PAD.indexOf(a.tot ?? f) + 1) + (a.tot ? 1 : 0)
    if (len > 1 && a.sinds - a.S < (len - 1) * 2) a.S = Math.max(-40, a.sinds - (len - 1) * 3)
    if (a.sinds <= a.S && len > 1) a.sinds = Math.min(-1, a.S + (len - 1) * 2)
    const groot = a.klasse === 'kl-a-prospects' || a.klasse === 'kl-b-prospects'
    a.ritme = !!koudRitme && ((groot && (f === 'benaderd' || f === 'in-gesprek')) || (!groot && f === 'gekwalificeerd' && r() < 0.5) || (!groot && f === 'benaderd' && ++benaderdTeller % 3 === 0))
    if (PAD.indexOf(f) >= 1 || f === 'geparkeerd' || f === 'verloren') a.leverancier = r() < 0.8 ? kies(r, ['cc-01', 'cc-01', 'cc-02', 'cc-03', 'cc-04', 'cc-05']) : null
    if (r() < 0.45) a.aanleiding = { tekst: kies(r, AANLEIDINGEN[a.branche]!), dagen: tussen(r, 1, 45), heet: r() < 0.25, bron: kies(r, ['web', 'web', 'notitie', 'linkedin']) }
  }
  const deact: [Fase, string, string, string][] = [
    ['gevonden', 'kl-d-prospects', 'dubbel', 'Staat er twee keer in na de beursimport'],
    ['gekwalificeerd', 'kl-c-prospects', 'buiten-doelgroep', 'Doet alleen nog grondwerk, geen installaties'],
    ['benaderd', 'kl-c-prospects', 'failliet', 'Faillissement uitgesproken volgens het handelsregister'],
    ['geparkeerd', 'kl-d-prospects', 'geen-interesse', 'De eigenaar stopt volgend jaar met het bedrijf'],
  ]
  for (const [f, k, reden, toelichting] of deact) {
    const a = accs.find((x) => x.fase === f && x.klasse === k && !x.gedeactiveerd && !x.ritme && x.branche !== 'br-01')
    if (a) a.gedeactiveerd = { reden, toelichting, dag: Math.min(-1, a.sinds + 1) }
  }
  const actief = (a: Acc) => !a.gedeactiveerd

  // ── 2. Tijdlijn per account: activiteiten en afspraakwensen ──
  const evs: Ev[] = []
  const wensen: Wens[] = []
  let apNr = 0
  const nieuwAp = () => `eva-ap-x${pad(++apNr)}`
  const woorden = (a: Acc, c = 0) => ({ v: a.contacten[c]?.voor ?? '', b: a.naam, p: a.plaats, m: String(a.medewerkers), mt: String(a.monteurs) })
  const BEANTWOORD = new Set(['later', 'afspraak', 'geen_interesse', 'gesproken'])
  const tijd = (dag: number, soort: Ev['soort'], uitkomst: string | null): Pick<Ev, 'slot' | 'min'> => {
    const w = weekdag(wd(dag))
    const ja = BEANTWOORD.has(uitkomst ?? '')
    if (soort === 'gebeld') {
      if (w === 5) return r() < 0.6 ? { slot: 'vrijdag' } : { slot: 'los', min: kies(r, ja ? [11 * 60, 15 * 60 + 30] : [8 * 60 + 45, 11 * 60 + 15, 13 * 60 + 15, 15 * 60 + 45, 16 * 60 + 15]) }
      const x = r()
      if (x < 0.5) return { slot: 'ochtend' }
      if (x < 0.7 && [1, 3, 4].includes(w)) return { slot: 'middag' }
      return { slot: 'los', min: kies(r, ja ? [15 * 60 + 30, 15 * 60 + 45, 16 * 60, 9 * 60 + 40] : [8 * 60 + 40, 11 * 60, 11 * 60 + 30, 13 * 60 + 10, 13 * 60 + 40, 16 * 60 + 20, 16 * 60 + 45]) }
    }
    return { slot: 'los', min: kies(r, [8 * 60 + 20, 9 * 60 + 50, 10 * 60 + 40, 11 * 60 + 20, 13 * 60 + 5, 13 * 60 + 50, 15 * 60 + 10, 16 * 60 + 30, 17 * 60 + 10]) }
  }
  const voeg = (e: Omit<Ev, 'slot' | 'min'> & Partial<Pick<Ev, 'slot' | 'min'>>) => { const t = e.slot ? {} : tijd(e.dag, e.soort, e.uitkomst); evs.push({ ...t, ...e } as Ev) }
  const poging = (a: Acc, dag: number, n: number) => {
    const x = r()
    const w = woorden(a)
    if (x < 0.62) voeg({ acc: a.id, dag, soort: 'gebeld', uitkomst: x < 0.36 ? 'geen_reactie' : 'voicemail', contact: x < 0.36 ? null : 0, poging: n, herkomst: a.ritme ? 'ritme' : 'handmatig' })
    else if (x < 0.86) { const [o, t] = kies(r, T_MAILS.slice(0, 4)); voeg({ acc: a.id, dag, soort: 'mail', uitkomst: 'verzonden', contact: 0, onderwerp: o, tekst: vul(t, w), poging: n, herkomst: a.ritme ? 'ritme' : 'handmatig' }) }
    else voeg({ acc: a.id, dag, soort: 'linkedin', uitkomst: 'verzonden', contact: a.contacten.length > 1 && r() < 0.4 ? 1 : 0, tekst: vul(kies(r, T_LINKEDIN), woorden(a, 0)), poging: n, herkomst: 'handmatig' })
  }
  const afspraakSoort = (a: Acc): [string, Wens['vorm'], number] => {
    const groot = a.klasse === 'kl-a-prospects' || a.klasse === 'kl-b-prospects'
    const x = r()
    if (groot ? x < 0.45 : x < 0.2) return kies(r, [['gepland-bezoek', 'bezoek', 60], ['inventarisatie', 'bezoek', 60]] as [string, Wens['vorm'], number][])
    if (x < 0.75) return ['kennismaking', 'online', 30]
    return kies(r, [['online-meeting', 'online', 30], ['demo', 'online', 45]] as [string, Wens['vorm'], number][])
  }
  const wensMin = () => kies(r, [10 * 60 + 45, 11 * 60, 13 * 60, 13 * 60 + 30, 15 * 60 + 15, 15 * 60 + 45, 16 * 60 + 15])

  for (const a of accs) {
    const f = a.fase!
    const pad_: Fase[] = [...PAD.slice(0, PAD.indexOf(a.tot ?? f) + 1), ...(a.tot ? [f] : [])]
    const dagen = pad_.map((_, j) => (pad_.length === 1 ? a.S : a.S + Math.round((j * (a.sinds - a.S)) / (pad_.length - 1))))
    for (let j = 1; j < dagen.length; j++) if (dagen[j]! <= dagen[j - 1]!) dagen[j] = Math.min(-1, dagen[j - 1]! + 1)
    const op = Object.fromEntries(pad_.map((x, j) => [x, dagen[j]!])) as Partial<Record<Fase, number>>
    ;(a as any).mijlpalen = op
    const volgendeNa = (x: Fase) => { const j = pad_.indexOf(x); return j + 1 < pad_.length ? dagen[j + 1]! : 0 }
    let n = 0
    if (r() < 0.4) voeg({ acc: a.id, dag: op.gevonden!, soort: 'notitie', uitkomst: null, contact: null, tekst: kies(r, T_GEVONDEN) })
    if (op['dossier-compleet'] !== undefined) voeg({ acc: a.id, dag: op['dossier-compleet'], soort: 'notitie', uitkomst: null, contact: null, tekst: `Dossier compleet: ${a.medewerkers} medewerkers en ${a.monteurs} monteurs, vooral ${FOCUS[a.branche]} rond ${a.plaats}.` })
    if (op.gekwalificeerd !== undefined) voeg({ acc: a.id, dag: op.gekwalificeerd, soort: 'notitie', uitkomst: null, contact: null, tekst: `Gekwalificeerd: past bij ${BRANCHE_NAAM[a.branche]}, ${a.contacten[0]!.voor} ${a.contacten[0]!.achter} beslist${a.leverancier ? ` en de huidige leverancier is bekend (${LEVERANCIER[a.leverancier]})` : ''}.` })
    if (op.benaderd !== undefined) {
      const eind = volgendeNa('benaderd')
      poging(a, op.benaderd, ++n)
      for (let d = op.benaderd + tussen(r, 2, 4); d < eind && d <= -1 && n < 5; d += tussen(r, 2, 5)) poging(a, d, ++n)
    }
    if (op['in-gesprek'] !== undefined) {
      const c = a.contacten.length > 1 && r() < 0.35 ? 1 : 0
      voeg({ acc: a.id, dag: op['in-gesprek'], soort: 'gebeld', uitkomst: 'later', contact: c, poging: ++n, herkomst: a.ritme ? 'ritme' : 'handmatig', tekst: vul(kies(r, T_LATER), woorden(a, c)), verslag: r() < 0.5 ? 'lang' : null })
      const eind = volgendeNa('in-gesprek')
      if (op['in-gesprek'] + 1 < (eind || 0) && r() < 0.7) { const [o, t] = T_MAILS[4]!; voeg({ acc: a.id, dag: op['in-gesprek'] + 1, soort: 'mail', uitkomst: 'verzonden', contact: c, onderwerp: o, tekst: vul(t, woorden(a, c)), herkomst: 'handmatig' }) }
    }
    if (op['afspraak-gepland'] !== undefined) {
      voeg({ acc: a.id, dag: op['afspraak-gepland'], soort: 'gebeld', uitkomst: 'afspraak', contact: 0, poging: ++n, herkomst: a.ritme ? 'ritme' : 'handmatig', tekst: vul(kies(r, T_AFSPRAAK), woorden(a)), verslag: r() < 0.4 ? 'lang' : null })
      voeg({ acc: a.id, dag: op['afspraak-gepland'], soort: 'mail', uitkomst: 'verzonden', contact: 0, onderwerp: T_BEVESTIG[0], tekst: vul(T_BEVESTIG[1], woorden(a)), herkomst: 'handmatig', slot: 'los', min: 16 * 60 + 40 })
      if (f === 'afspraak-gepland') {
        const [slug, vorm, duur] = afspraakSoort(a)
        wensen.push({ id: nieuwAp(), acc: a.id, dag: tussen(r, 1, 14), wens: wensMin(), slug, vorm, duur, status: 'gepland', contact: 0,
          data: { aanleiding: a.aanleiding?.tekst ?? 'Levering per bouwfase bespreken', eersteAfspraak: true, ...(r() < 0.6 ? { briefing: `${a.medewerkers} medewerkers, ${FOCUS[a.branche]}. ${a.contacten[0]!.voor} beslist zelf${a.contacten[1] ? ` met ${a.contacten[1].voor} (${a.contacten[1].functie.toLowerCase()})` : ''}. Neem het leverplan per bouwfase mee.` } : {}) } })
      }
    }
    if (op['afspraak-gehouden'] !== undefined) {
      const [slug, vorm, duur] = afspraakSoort(a)
      const nee = f === 'verloren'
      const id = nieuwAp()
      wensen.push({ id, acc: a.id, dag: op['afspraak-gehouden'], wens: wensMin(), slug, vorm, duur, status: 'afgerond', uitkomst: nee ? 'geen-vervolg' : 'vervolg', contact: 0, data: {}, transcript: r() < 0.45, notulist: r() < 0.7, verslagSoort: nee ? 'nee' : 'vervolg' })
      const eind = volgendeNa('afspraak-gehouden')
      if (!nee && op['afspraak-gehouden'] + 1 <= -1 && (!eind || op['afspraak-gehouden'] + 1 < eind)) voeg({ acc: a.id, dag: op['afspraak-gehouden'] + 1, soort: 'mail', uitkomst: 'verzonden', contact: 0, onderwerp: T_VERSLAGMAIL[0], tekst: vul(T_VERSLAGMAIL[1], woorden(a)), herkomst: 'afspraak' })
      // Een vervolgafspraak (demo of inventarisatie) in de komende weken voor een deel van de gehouden afspraken.
      if (f === 'afspraak-gehouden' && r() < 0.7) {
        const opLocatie = r() < 0.5
        wensen.push({ id: nieuwAp(), acc: a.id, dag: tussen(r, 2, 18), wens: wensMin(), slug: opLocatie ? 'demo-op-locatie' : 'demo', vorm: opLocatie ? 'bezoek' : 'online', duur: opLocatie ? 60 : 45, status: 'gepland', contact: a.contacten.length > 1 ? 1 : 0, data: { aanleiding: 'Vervolg op de kennismaking: het leverplan laten zien' } })
      }
    }
    if (op.overgedragen !== undefined) voeg({ acc: a.id, dag: op.overgedragen, soort: 'notitie', uitkomst: null, contact: null, tekst: 'Overgedragen aan Bram Middelkamp (buitendienst) met het leverplan per bouwfase als vervolgstap.' })
    if (f === 'geparkeerd') voeg({ acc: a.id, dag: a.sinds, soort: 'notitie', uitkomst: null, contact: null, tekst: `Geparkeerd na ${n} pogingen zonder vervolg. Terugkomen met een nieuwe aanleiding.` })
    if (f === 'verloren' && a.tot === 'in-gesprek') voeg({ acc: a.id, dag: a.sinds, soort: 'gebeld', uitkomst: 'geen_interesse', contact: 0, poging: ++n, herkomst: 'handmatig', tekst: vul(kies(r, T_NEE), woorden(a)) })
    if (f === 'verloren' && a.tot === 'afspraak-gehouden') voeg({ acc: a.id, dag: a.sinds, soort: 'notitie', uitkomst: null, contact: null, tekst: 'Nee na de kennismaking: tevreden met de huidige leverancier. Over een half jaar opnieuw.' })
    if (r() < 0.25 && PAD.indexOf(f) >= 2) voeg({ acc: a.id, dag: Math.min(-1, a.sinds + 1), soort: 'notitie', uitkomst: null, contact: null, tekst: kies(r, T_EXTRA) })
    if (a.gedeactiveerd) voeg({ acc: a.id, dag: a.gedeactiveerd.dag, soort: 'notitie', uitkomst: null, contact: null, tekst: `Prospect gedeactiveerd: ${a.gedeactiveerd.toelichting.toLowerCase()}.` })
    ;(a as any).pogingen = n
  }
  // Klanten: een paar gesprekken en mails, een gehouden bezoek en een belafspraak later.
  for (const k of klanten) {
    for (let i = 0; i < 4; i++) {
      const dag = -tussen(r, 2, 38)
      if (i % 2) { const [o, t] = kies(r, [['Levertijden voor de winter', 'Hoi {v}, hierbij de levertijden voor de wintermaanden. Laat je weten welke projecten voorrang hebben?'], ['Bestelling voorjaar', 'Hoi {v}, zullen we de bestelling voor het voorjaar alvast afstemmen? Ik bel je volgende week.']] as [string, string][]); voeg({ acc: k.id, dag, soort: 'mail', uitkomst: 'verzonden', contact: 0, onderwerp: o, tekst: vul(t, woorden(k)), herkomst: 'handmatig' }) }
      else voeg({ acc: k.id, dag, soort: 'gebeld', uitkomst: 'gesproken', contact: i === 2 ? 1 : 0, herkomst: 'handmatig', tekst: vul(kies(r, ['{v} gesproken over de bestelling voor het nieuwe project. Levering in twee delen.', 'Klantgesprek met {v}: tevreden over de levertijden, vraagt naar de projectapp.']), woorden(k, i === 2 ? 1 : 0)) })
    }
    wensen.push({ id: nieuwAp(), acc: k.id, dag: -tussen(r, 5, 30), wens: wensMin(), slug: 'gepland-bezoek', vorm: 'bezoek', duur: 60, status: 'afgerond', uitkomst: 'vervolg', contact: 0, data: {}, verslagSoort: 'klant', notulist: false })
    wensen.push({ id: nieuwAp(), acc: k.id, dag: tussen(r, 3, 19), wens: wensMin(), slug: 'belafspraak', vorm: 'telefoon', duur: 15, status: 'gepland', contact: 0, data: { aanleiding: 'Bestelling voor het voorjaar afstemmen' } })
  }
  // Extra afspraken: terugbelafspraken, niet verschenen, geannuleerd, intern overleg en een webinar.
  const inGesprek = accs.filter((a) => a.fase === 'in-gesprek' && actief(a))
  for (const [i, a] of inGesprek.slice(0, 3).entries()) {
    wensen.push({ id: nieuwAp(), acc: a.id, dag: tussen(r, 1, 16), wens: wensMin(), slug: i % 2 ? 'terugbelafspraak' : 'belafspraak', vorm: 'telefoon', duur: i % 2 ? 10 : 15, status: 'gepland', contact: 0, data: { aanleiding: 'Terugbellen zoals afgesproken' } })
  }
  for (const [i, a] of inGesprek.slice(3, 6).entries()) {
    wensen.push({ id: nieuwAp(), acc: a.id, dag: Math.min(-1, (a as any).mijlpalen['in-gesprek'] + 2), wens: wensMin(), slug: 'belafspraak', vorm: 'telefoon', duur: 15, status: i === 2 ? 'niet_verschenen' : 'afgerond', uitkomst: i === 2 ? null : 'later', contact: 0, data: { aanleiding: 'Terugbellen over de planning' }, verslagSoort: 'telefoon', notulist: false })
  }
  const gepland = accs.filter((a) => a.fase === 'afspraak-gepland')
  if (gepland[0]) wensen.push({ id: nieuwAp(), acc: gepland[0].id, dag: Math.min(-1, gepland[0].sinds + 1), wens: wensMin(), slug: 'kennismaking', vorm: 'online', duur: 30, status: 'geannuleerd', contact: 0, data: { aanleiding: 'Eerste datum, verzet door de prospect' } })
  const groot = accs.filter((a) => (a.klasse === 'kl-a-prospects' || a.klasse === 'kl-b-prospects') && ['afspraak-gepland', 'afspraak-gehouden'].includes(a.fase!))
  for (const [i, a] of groot.slice(0, 3).entries()) {
    wensen.push({ id: nieuwAp(), acc: a.id, dag: i === 2 ? tussen(r, 2, 10) : -tussen(r, 2, 15), wens: 11 * 60 + 15, slug: 'accountoverleg', vorm: 'online', duur: 30, status: i === 2 ? 'gepland' : 'afgerond', contact: null, data: { aanleiding: `Aanpak ${a.naam} met Joost`, uitgenodigd: ['u-04'] }, verslagSoort: 'intern', notulist: false })
  }
  const webinarAcc = accs.find((a) => a.fase === 'in-gesprek' && a.branche === 'br-02' && actief(a)) ?? inGesprek[0]
  if (webinarAcc) wensen.push({ id: nieuwAp(), acc: webinarAcc.id, dag: tussen(r, 6, 14), wens: 15 * 60 + 30, slug: 'webinar', vorm: 'online', duur: 60, status: 'gepland', contact: 0, data: { aanleiding: 'Webinar levering per bouwfase voor utiliteit' } })

  // ── 3. Belblokken: belpogingen in een vast blok worden een gehouden sessie ──
  const BLOK = { ochtend: { uur: 9, minuut: 0, minuten: 90, vast: 'vb-ochtend', soort: 'koud', plek: 'Kantoor', code: 'o' }, middag: { uur: 14, minuut: 0, minuten: 60, vast: 'vb-middag', soort: 'opvolging', plek: 'Kantoor', code: 'm' }, vrijdag: { uur: 10, minuut: 0, minuten: 60, vast: 'vb-vrijdag', soort: 'gemengd', plek: 'Thuis', code: 'v' } } as const
  const bezet = new Map<string, [number, number][]>()
  const voegBezet = (dag: string, s: number, e: number) => { const l = bezet.get(dag) ?? []; l.push([s, e]); bezet.set(dag, l) }
  const minVan = (iso: string) => { const m = nlMoment(new Date(iso)); return m.uur * 60 + m.minuut }
  const sessieStarts = new Set<string>()
  for (const x of (await client.query(`select start_at as s, end_at as e, false as sessie from appointments where owner_id = $1 and status <> 'geannuleerd' and start_at >= $2 and start_at < $3
    union all select start_op, eind_op, true from belblok_sessies where gebruiker_id = $1 and status <> 'geannuleerd' and start_op >= $2 and start_op < $3`, [EVA, om(wd(-45), 0), om(wd(25), 23)])).rows) {
    const s = new Date(x.s).toISOString()
    const dag = nlMoment(new Date(s)).datum
    voegBezet(dag, minVan(s), minVan(new Date(x.e).toISOString()))
    if (x.sessie) sessieStarts.add(`${dag}|${minVan(s)}`)
  }
  const overlapt = (dag: string, s: number, e: number) => (bezet.get(dag) ?? []).some(([a, b]) => s < b && e > a)
  // Vaste belblokken tot vier weken vooruit (alleen waar nog geen sessie op dat moment staat), vóór de afspraken hun plek krijgen.
  const geplandeSessies: Record<string, unknown>[] = []
  for (let n = 0; n <= 20; n++) {
    const dag = wd(n)
    const w = weekdag(dag)
    const blokken = w === 5 ? [BLOK.vrijdag] : [BLOK.ochtend, ...([1, 3, 4].includes(w) ? [BLOK.middag] : [])]
    for (const b of blokken) {
      const s = b.uur * 60 + b.minuut
      if (sessieStarts.has(`${dag}|${s}`) || overlapt(dag, s, s + b.minuten)) continue
      voegBezet(dag, s, s + b.minuten)
      const start = nlTijdstip(dag, b.uur, b.minuut)
      geplandeSessies.push({ id: `eva-bb-g${dag.replaceAll('-', '')}${b.code}`, organisation_id: orgId, gebruiker_id: EVA, vast_blok_id: b.vast, start_op: start.toISOString(), eind_op: new Date(start.getTime() + b.minuten * 60_000).toISOString(), status: 'gepland',
        data: { plek: b.plek, soort: b.soort, ...(b.soort === 'gemengd' ? { verhouding: 70 } : {}), scriptId: null, gesprekken: [], herkomst: 'seed' } })
    }
  }
  const sessieGroepen = new Map<string, Ev[]>()
  for (const e of evs) if (e.soort === 'gebeld' && e.slot && e.slot !== 'los') { const k = `${wd(e.dag)}|${e.slot}`; sessieGroepen.set(k, [...(sessieGroepen.get(k) ?? []), e]) }
  interface Sessie { id: string; dag: string; start: number; minuten: number; vast: string; soort: string; plek: string; gesprekken: Ev[] }
  const sessies: Sessie[] = []
  for (const [k, groep] of [...sessieGroepen.entries()].sort()) {
    const [dag, slot] = k.split('|') as [string, keyof typeof BLOK]
    const b = BLOK[slot]
    const start = b.uur * 60 + b.minuut
    if (overlapt(dag, start, start + b.minuten)) { for (const e of groep) { e.slot = 'los'; e.min = kies(r, [8 * 60 + 35, 11 * 60 + 5, 13 * 60 + 20, 16 * 60 + 25]) } continue }
    voegBezet(dag, start, start + b.minuten)
    const stap = Math.max(5, Math.min(11, Math.floor((b.minuten - 8) / groep.length)))
    groep.sort((x, y) => x.acc.localeCompare(y.acc)).forEach((e, j) => { e.min = start + 3 + j * stap + tussen(r, 0, 2) })
    sessies.push({ id: `eva-bb-k${dag.replaceAll('-', '')}${b.code}`, dag, start, minuten: b.minuten, vast: b.vast, soort: b.soort, plek: b.plek, gesprekken: groep })
  }

  // ── 4. Afspraken een plek geven: werkdag, 08:00 tot 18:00, niet in de lunch of het dinsdagoverleg, niet over iets anders heen ──
  const vrij = (dag: string, s: number, duur: number) => {
    if (s < 8 * 60 || s + duur > 18 * 60) return false
    if (s < 12 * 60 + 30 && s + duur > 12 * 60) return false
    if (weekdag(dag) === 2 && s < 15 * 60 && s + duur > 14 * 60) return false
    return !overlapt(dag, s, s + duur)
  }
  for (const w of wensen) {
    let n = w.dag
    let plekGevonden = false
    for (let p = 0; p < 6 && !plekGevonden; p++, n += w.dag < 0 ? -1 : 1) {
      const dag = wd(n)
      for (const d of [0, 15, -15, 30, -30, 45, -45, 60, -60, 90, -90, 120, -120, 180, -180]) {
        const s = w.wens + d
        if (vrij(dag, s, w.duur)) { w.datum = dag; w.start = s; w.dag = n; voegBezet(dag, s, s + w.duur); plekGevonden = true; break }
      }
    }
    if (!plekGevonden) w.status = 'weg'
  }
  const afspraken = wensen.filter((w) => w.status !== 'weg')
  // Een gehouden klantafspraak is ook een contactmoment op de tijdlijn.
  for (const w of afspraken) if (w.status === 'afgerond' && w.acc && w.slug !== 'accountoverleg') evs.push({ acc: w.acc, dag: w.dag, slot: 'los', min: w.start! + w.duur, soort: 'afspraak', uitkomst: w.uitkomst ?? null, contact: w.contact, afspraak: w.id })

  // ── 5. Accounts, contacten, reis en geschiedenis ──
  const opVan = (e: Ev) => omMin(wd(e.dag), e.min ?? 9 * 60)
  const accRijen: Record<string, unknown>[] = []
  const contactRijen: Record<string, unknown>[] = []
  const reisRijen: Record<string, unknown>[] = []
  const geschiedenis: Record<string, unknown>[] = []
  for (const a of alle) {
    const eigen = evs.filter((e) => e.acc === a.id)
    const lc = laatsteContact(eigen.filter((e) => e.soort !== 'notitie').map((e) => ({ soort: e.soort === 'linkedin' ? 'bericht' : e.soort, op: opVan(e), status: 'afgerond' })), nu)
    const aanleiding = a.aanleiding ? { tekst: a.aanleiding.tekst, op: new Date(nu.getTime() - a.aanleiding.dagen * 864e5 - 5 * 3600e3).toISOString(), heet: a.aanleiding.heet, bron: a.aanleiding.bron } : null
    const s = berekenScore({ nu, contacten: a.contacten.map((c) => ({ rol: c.rol, status: 'actief', telefoon: c.telefoon, email: c.email })), laatsteContactOp: lc, aanleidingen: aanleiding ? [aanleiding] : [] })
    const f = a.fase
    const fi = f ? PAD.indexOf(a.tot ?? f) : -1
    const mp = ((a as any).mijlpalen ?? {}) as Partial<Record<Fase, number>>
    const opDag = (n: number | undefined) => (n === undefined ? null : om(wd(n), 9, 30))
    const data: Record<string, any> = {
      website: `https://${a.domein}`, telefoon: a.telefoon, adres: a.adres, provincie: a.provincie, medewerkers: a.medewerkers,
      customFields: { aantal_monteurs: a.monteurs, segment: SEGMENT[a.branche] }, scoreOpbouw: s.opbouw,
      herkomst: { seed: 'eva', medewerkers: { bron: 'import', op: wd(-45) }, klasse: { bron: 'voorstel uit medewerkers', op: wd(-45) } },
      ...(aanleiding ? { aanleiding } : {}),
    }
    // Dossier (vanaf dossier compleet) en BAND-kwalificatie (vanaf gekwalificeerd).
    if (a.kind === 'klant' || fi >= 1 || (f === 'gevonden' && r() < 0.5)) {
      const compleet = a.kind === 'klant' || fi >= 1
      const o = (k: string): 'ja' | 'nee' | 'onbekend' => (compleet ? (k === 'leverancier' && !a.leverancier ? 'nee' : k === 'aanleiding' && !a.aanleiding ? 'nee' : 'ja') : (r() < 0.5 ? 'ja' : 'onbekend'))
      const dop = opDag(mp['dossier-compleet'] ?? mp.gevonden) ?? om(wd(-30), 9)
      data.dossier = {
        op: dop, door: 'verrijker',
        criteria: Object.fromEntries(['branche', 'omvang', 'locatie', 'leverancier', 'aanleiding', 'beslisser'].map((k) => [k, { oordeel: o(k), bron: k === 'omvang' ? 'Handelsregister (testomgeving)' : k === 'locatie' ? 'Website' : 'Dossier', op: dop }])),
        kernfeiten: [`${a.medewerkers} medewerkers, ${a.monteurs} monteurs`, `Vooral ${FOCUS[a.branche]}`, ...(a.leverancier ? [`Koopt nu bij: ${LEVERANCIER[a.leverancier]}`] : [])],
        velden: [{ veld: 'kernfeit', waarde: `Actief in ${a.plaats} en omgeving`, bron: `https://${a.domein}/over-ons`, datum: dop.slice(0, 10) }],
        aannames: a.monteurs > 20 ? [{ veld: 'Spoedbestellingen', waarde: 'Waarschijnlijk meerdere per week', aanname: true }] : [],
      }
    }
    if (fi >= 2 || a.kind === 'klant') {
      const nJa = a.kind === 'klant' ? 4 : f === 'gekwalificeerd' ? 2 : f === 'benaderd' || f === 'geparkeerd' ? 2 : f === 'in-gesprek' ? 3 : f === 'verloren' ? 2 : 4
      const bop = opDag(mp.gekwalificeerd) ?? om(wd(-20), 10)
      const bronnen = ['Dossier', `Gesprek met ${a.contacten[0]!.voor}`, 'Verslag van de kennismaking', 'Gesprek met de projectleider']
      data.band = Object.fromEntries(['behoefte', 'autoriteit', 'noodzaak', 'draagvlak'].map((k, i) => [k, { ja: i < nJa, bron: i < nJa ? bronnen[i] : 'hand', op: bop }]))
    }
    if (a.ritme && koudRitme) {
      const n = (a as any).pogingen ?? 1
      const st = startRitme(koudRitme, new Date(om(wd(mp.gekwalificeerd ?? mp.benaderd ?? a.sinds), 9)), INST)
      data.reis = { ritme: { ...st, stap: Math.min(Math.max(1, n + 1), Math.max(1, koudRitme.stappen.length)), volgendeOp: om(wd(tussen(r, 0, 6)), 9) } }
    }
    let terugOp: string | null = null
    if (f === 'geparkeerd') {
      terugOp = wd(tussen(r, 2, 18))
      Object.assign(data, { wachtendTot: terugOp, terugkom: { datum: terugOp, regelId: null, reden: 'Geen reactie na de laatste poging', aanpak: 'Bel met een nieuwe aanleiding', kanaal: 'bellen' } })
    }
    if (f === 'verloren') {
      const reden = a.tot === 'afspraak-gehouden' ? 'Tevreden met huidige leverancier' : kies(r, ['Geen budget', 'Geen behoefte', 'Tevreden met huidige leverancier'])
      terugOp = wd(tussen(r, 60, 120))
      Object.assign(data, { nee: { reden, op: om(wd(a.sinds), 11), door: EVA, afkoeling: afkoelingVoorNee(reden) }, terugkom: { datum: terugOp, regelId: null, reden, aanpak: 'Heropvolging zonder druk', kanaal: 'bellen' } })
    }
    if (a.gedeactiveerd) data.gedeactivering = { op: om(wd(a.gedeactiveerd.dag), 16, 30), door: EVA, reden: a.gedeactiveerd.reden, toelichting: a.gedeactiveerd.toelichting }
    const status = a.kind === 'klant' ? 'klant' : STATUS[f!]
    const sinds = a.kind === 'klant' ? om(wd(-40), 9) : om(wd(a.sinds), 9)
    accRijen.push({
      id: a.id, organisation_id: orgId, name: a.naam, account_kind: a.kind, klasse: a.klasse, owner_id: EVA, nb_status: status, reis_id: a.kind === 'prospect' ? reisId : null, fase_id: f, fase_sinds: sinds,
      score: s.score, laatste_contact_op: lc, city: a.plaats, postcode: a.postcode, domein: a.domein, lat: a.lat, lng: a.lng, nb_bron: 'seed', vv_branche_id: a.branche, huidige_leverancier_id: a.leverancier,
      gebied_id: a.regio ? 'regio-midden' : null, terug_op: terugOp, gedeactiveerd_op: a.gedeactiveerd ? data.gedeactivering.op : null, data, created_at: om(wd(a.kind === 'klant' ? -40 : a.S), 8, 30),
    })
    // Contactpersonen met houding en rapporteert-aan voor de invloedskaart.
    const gesproken = fi >= 4 || a.kind === 'klant'
    const idVanRol = (rol: string) => a.contacten.find((c) => c.rol === rol)?.id ?? null
    for (const [i, c] of a.contacten.entries()) {
      const baas = c.rol === 'beslisser' ? null : c.rol === 'champion' ? idVanRol('beinvloeder') : c.rol === 'gebruiker' ? (idVanRol('champion') ?? idVanRol('beinvloeder')) : idVanRol('beslisser')
      const invloed: Record<string, unknown> = {}
      if (a.contacten.length > 2 || gesproken) invloed.rapporteertAan = baas
      if (gesproken) {
        const houding = f === 'verloren' && c.rol === 'beslisser' ? 'tegen' : c.rol === 'blokkeerder' ? 'tegen' : c.rol === 'champion' ? 'voor' : c.rol === 'beinvloeder' ? kies(r, ['voor', 'voor', 'neutraal']) : c.rol === 'beslisser' ? kies(r, ['neutraal', 'voor']) : kies(r, ['neutraal', 'onbekend'])
        if (houding !== 'onbekend') Object.assign(invloed, { houding, houdingDoor: EVA, houdingOp: opDag(mp['in-gesprek'] ?? a.sinds) ?? om(wd(-10), 10), ...(i === 0 && houding === 'tegen' ? { houdingCitaat: 'We zijn tevreden met wat we nu hebben.' } : i === 1 && houding === 'voor' ? { houdingCitaat: 'Als het op de bouw op tijd ligt, scheelt dat ons echt uren.' } : {}) })
        if (i <= 1) Object.assign(invloed, { rolBevestigdDoor: EVA, rolBevestigdOp: opDag(mp['in-gesprek'] ?? a.sinds) ?? om(wd(-10), 10) })
      }
      if ((f === 'afspraak-gehouden' || f === 'overgedragen') && c.rol === 'gebruiker') invloed.voorstel = { houding: 'voor', citaat: 'De monteurs zijn er blij mee als ze minder hoeven te wachten.', bron: 'Notulist', op: opDag(mp['afspraak-gehouden']) ?? om(wd(-5), 15) }
      contactRijen.push({ id: c.id, organisation_id: orgId, account_id: a.id, first_name: c.voor, last_name: c.achter, email: c.email, rol: c.rol, status: 'actief',
        data: { functie: c.functie, telefoon: c.telefoon, consent: { email: { status: c.rol === 'beslisser' || gesproken ? 'gegeven' : 'onbekend' }, whatsapp: { status: c.rol === 'champion' && gesproken ? 'gegeven' : 'onbekend' } }, ...(Object.keys(invloed).length ? { invloed } : {}) } })
    }
    if (a.kind === 'prospect' && f) {
      const pd: Fase[] = [...PAD.slice(0, PAD.indexOf(a.tot ?? f) + 1), ...(a.tot ? [f] : [])]
      const ops = pd.map((x, j) => (j === pd.length - 1 ? sinds : om(wd(mp[x] ?? a.S), 9, 30 + j)))
      const eind = f === 'overgedragen' || f === 'verloren'
      reisRijen.push({ id: `${a.id}-reis`, organisation_id: orgId, reistemplate_id: reisId, template_versie: 1, account_id: a.id, fase_id: f, nb_status: status, fase_sinds: sinds, gestart_op: ops[0], afgerond_op: eind ? sinds : null })
      for (const [j, x] of pd.entries()) {
        geschiedenis.push({ id: `${a.id}-rg${j + 1}`, organisation_id: orgId, account_id: a.id, prospectreis_id: `${a.id}-reis`, versie: 1, van_fase_id: j ? pd[j - 1] : null, naar_fase_id: x, van_status: j ? STATUS[pd[j - 1]!] : null, naar_status: STATUS[x],
          gebeurtenis: GEBEURTENIS[x], door: j ? EVA : 'motor', op: ops[j], reden: x === 'geparkeerd' ? 'Geen reactie na de laatste poging' : x === 'verloren' ? (data.nee?.reden ?? null) : null })
      }
    }
  }
  const nAccounts = await zet(client, 'accounts', accRijen)
  const nContacten = await zet(client, 'contacts', contactRijen)
  await zet(client, 'prospectreizen', reisRijen)
  await zet(client, 'reisgeschiedenis', geschiedenis)

  // ── 6. Gehouden belblokken, afgeronde taken, activiteiten en gespreksverslagen ──
  const sessieVanEv = new Map<Ev, Sessie>()
  for (const s of sessies) for (const e of s.gesprekken) sessieVanEv.set(e, s)
  const ACTIE: Record<string, [string, string, string]> = { gebeld: ['bellen', 'gebeld', 'telefoon'], mail: ['mailen', 'mail', 'email'], linkedin: ['linkedin', 'bericht', 'linkedin'], whatsapp: ['bericht', 'bericht', 'whatsapp'] }
  const KNOP: Record<string, Gesprek['knop']> = { geen_reactie: 'geen_gehoor', voicemail: 'voicemail', later: 'later', afspraak: 'afspraak', geen_interesse: 'geen_interesse', gesproken: 'later' }
  const taakTitel = (e: Ev, a: Acc) => {
    const c = e.contact !== null ? a.contacten[e.contact] : null
    if (e.soort === 'gebeld') return e.uitkomst === 'afspraak' ? 'Bel: afspraak inplannen' : e.uitkomst === 'later' ? `Bel: ${c ? c.functie.toLowerCase() : 'beslisser'} spreken over de levering` : e.uitkomst === 'geen_interesse' ? 'Bel: laatste poging met de aanleiding' : `Bel: poging ${e.poging ?? 1}${e.poging === 1 ? ', eerste kennismaking' : ''}`
    if (e.soort === 'mail') return `Mail: ${(e.onderwerp ?? 'opvolging').toLowerCase()}`
    if (e.soort === 'linkedin') return `LinkedIn: ${c && c.rol === 'beslisser' ? 'connectieverzoek aan de beslisser' : 'bericht aan de projectleider'}`
    return 'Bericht sturen'
  }
  const taakRijen: Record<string, unknown>[] = []
  const actRijen: Record<string, unknown>[] = []
  const verslagRijen: Record<string, unknown>[] = []
  let tk = 0
  let ax = 0
  const gesprekVanEv = new Map<Ev, Gesprek & { op: string }>()
  for (const e of [...evs].sort((x, y) => x.dag - y.dag || (x.min ?? 0) - (y.min ?? 0) || x.acc.localeCompare(y.acc))) {
    const a = accVan.get(e.acc)!
    const opIso = opVan(e)
    const contactId = e.contact !== null ? a.contacten[e.contact]?.id ?? null : null
    const actId = `eva-x${pad(++ax, 4)}`
    let taskId: string | null = null
    const actie = ACTIE[e.soort]
    if (actie) {
      taskId = `eva-tk${pad(++tk, 4)}`
      const s = sessieVanEv.get(e)
      const herkomst = e.herkomst ?? 'handmatig'
      taakRijen.push({ id: taskId, organisation_id: orgId, owner_id: EVA, account_id: a.id, contact_id: contactId ?? a.contacten[0]!.id, action_type: actie[0], title: taakTitel(e, a), status: 'klaar', priority: e.uitkomst === 'afspraak' || e.uitkomst === 'later' ? 'hoog' : 'middel',
        due_date: s ? omMin(s.dag, s.start) : opIso, uitkomst: e.uitkomst, executor: 'mens', belblok_id: s?.id ?? null, created_at: omMin(wd(e.dag - 2), 8 * 60 + 5), updated_at: opIso,
        data: { herkomst: { bron: herkomst, actiesoort: actie[0], uitvoerder: EVA }, ...(e.poging && actie[0] === 'bellen' ? { poging: { n: e.poging, van: 5, kanaal: 'bellen' } } : {}), ...(s ? { belblokId: s.id } : {}), afronding: { uitkomst: e.uitkomst, op: opIso }, ...(e.onderwerp ? { concept: { onderwerp: e.onderwerp, tekst: e.tekst } } : {}) } })
      if (s) gesprekVanEv.set(e, { taskId, accountId: a.id, contactRol: BEANTWOORD.has(e.uitkomst ?? '') ? a.contacten[e.contact ?? 0]!.rol : null, knop: KNOP[e.uitkomst ?? ''] ?? 'geen_gehoor', duurSec: BEANTWOORD.has(e.uitkomst ?? '') ? tussen(r, 180, 520) : tussen(r, 25, 110), geschatMin: 8, op: opIso })
    }
    const soort = actie ? actie[1] : e.soort
    const kanaal = actie ? actie[2] : e.soort === 'afspraak' ? afspraken.find((w) => w.id === e.afspraak)?.vorm ?? null : e.soort === 'reactie' ? 'mail' : null
    actRijen.push({ id: actId, organisation_id: orgId, account_id: a.id, contact_id: contactId, task_id: taskId, uitvoerder: 'mens', kanaal, soort, uitkomst: e.uitkomst, door: EVA, op: opIso,
      data: { seed: 'eva', ...(e.tekst ? { tekst: e.tekst } : {}), ...(e.onderwerp ? { onderwerp: e.onderwerp } : {}), ...(e.afspraak ? { afspraakId: e.afspraak, soort: afspraken.find((w) => w.id === e.afspraak)?.slug } : {}) } })
    if (e.verslag && e.soort === 'gebeld') {
      const c = a.contacten[e.contact ?? 0]!
      verslagRijen.push({ id: `eva-av${pad(ax, 4)}`, organisation_id: orgId, activiteit_id: actId, task_id: null, bron: r() < 0.4 ? 'ingesproken' : 'getypt', door: EVA, op: new Date(Date.parse(opIso) + 6 * 60_000).toISOString(),
        tekst: `Gesprek met ${c.voor} ${c.achter} (${c.functie.toLowerCase()}). ${a.naam} heeft ${a.monteurs} monteurs en werkt vooral aan ${FOCUS[a.branche]}. ${c.voor} zegt dat de monteurs gemiddeld een uur per dag kwijt zijn aan wachten op materiaal. ${e.uitkomst === 'afspraak' ? 'We spraken een kennismaking af om levering per bouwfase te bespreken.' : 'Ze willen eerst de jaarplanning rond hebben; daarna een belmoment.'} ${a.leverancier ? `Koopt nu bij: ${LEVERANCIER[a.leverancier]}.` : ''}`.trim() })
    }
  }
  const sessieRijen = sessies.map((s) => {
    const gesprekken = s.gesprekken.map((e) => gesprekVanEv.get(e)!).filter(Boolean)
    const start = nlTijdstip(s.dag, Math.floor(s.start / 60), s.start % 60)
    const eind = new Date(start.getTime() + s.minuten * 60_000)
    const laatste = gesprekken.length ? Date.parse(gesprekken.at(-1)!.op) + 6 * 60_000 : eind.getTime() - 5 * 60_000
    return { id: s.id, organisation_id: orgId, gebruiker_id: EVA, vast_blok_id: null, start_op: start.toISOString(), eind_op: eind.toISOString(), status: 'klaar', gestart_op: start.toISOString(), gestopt_op: new Date(Math.min(laatste, eind.getTime())).toISOString(),
      data: { plek: s.plek, soort: s.soort, ...(s.soort === 'gemengd' ? { verhouding: 70 } : {}), scriptId: null, gesprekken, handmatig: true, resultaat: blokResultaat(gesprekken as Gesprek[]), herkomst: 'seed' } }
  })
  const nSessies = await zet(client, 'belblok_sessies', sessieRijen)
  const bestaand = new Set((await client.query(`select id from belblok_sessies where gebruiker_id = $1 and id like 'eva-bb-k2%'`, [EVA])).rows.map((x: any) => x.id as string))
  for (const t of taakRijen) if (t.belblok_id && !bestaand.has(t.belblok_id as string)) { t.belblok_id = null; delete (t.data as any).belblokId }
  let nTaken = await zet(client, 'tasks', taakRijen)
  const nActiviteiten = await zet(client, 'activiteiten', actRijen)
  await zet(client, 'activiteit_verslagen', verslagRijen)

  // ── 7. Afspraken met verslag, transcript en analyse van de Notulist ──
  const ms = Object.fromEntries((await client.query(`select slug, id, data from meetingsoorten where organisation_id = $1`, [orgId])).rows.map((x: any) => [x.slug, { id: x.id as string, agenda: (x.data?.agenda ?? []) as { punt: string }[] }]))
  const apRijen: Record<string, unknown>[] = []
  const transcriptRijen: Record<string, unknown>[] = []
  for (const w of afspraken) {
    const soort = ms[w.slug]
    if (!soort) continue
    const a = w.acc ? accVan.get(w.acc)! : null
    const c = a && w.contact !== null ? a.contacten[w.contact] ?? a.contacten[0]! : null
    const start = nlTijdstip(w.datum!, Math.floor(w.start! / 60), w.start! % 60)
    const eind = new Date(start.getTime() + w.duur * 60_000)
    const data: Record<string, any> = { ...w.data, herinnering: 15, herkomst: 'seed', ...(w.vorm === 'online' ? { meetinglink: `https://meet.voorbeeld.test/${w.id}` } : {}), ...(w.vorm === 'bezoek' && a ? { locatie: `${a.adres}, ${a.plaats}` } : {}) }
    if (w.status === 'afgerond') {
      const agenda = soort.agenda.map((p) => ({ punt: p.punt, besproken: true }))
      const v = c ? c.voor : 'de prospect'
      const tekst = w.verslagSoort === 'nee'
        ? `Kennismaking met ${v}. ${a!.naam} is tevreden met de huidige leverancier en ziet geen reden om te wisselen. De monteurs wachten weinig omdat ze met een eigen voorraad werken. Geen vervolg; over een half jaar opnieuw contact.`
        : w.verslagSoort === 'klant' ? `Bezoek aan ${a!.naam} met ${v}. Tevreden over de levertijden van dit jaar. Volgend voorjaar starten twee nieuwe projecten; ${v} wil de levering per bouwfase uitbreiden. Vervolg: bestelling voor het voorjaar afstemmen.`
        : w.verslagSoort === 'intern' ? `Accountoverleg met Joost over ${a?.naam ?? 'de topprospects'}. Afgesproken: eerst de projectleider winnen met een leverplan voor één project, daarna het voorstel aan de directeur. Joost sluit aan bij de volgende afspraak.`
        : w.verslagSoort === 'telefoon' ? `Belafspraak met ${v}. De jaarplanning is bijna rond; ${v} wil over drie weken een kennismaking op locatie. Terugbellen om de datum vast te zetten.`
        : `Kennismaking met ${v} (${c?.functie.toLowerCase() ?? 'contact'}). ${a!.naam} heeft ${a!.medewerkers} medewerkers en werkt vooral aan ${FOCUS[a!.branche]}. Aanleiding: ${a!.aanleiding?.tekst.toLowerCase() ?? 'de groei van het aantal projecten'}. Situatie: de monteurs wachten gemiddeld een uur per dag op materiaal${a!.leverancier ? ` en ze kopen nu bij een ${LEVERANCIER[a!.leverancier]!.toLowerCase()}` : ''}. Behoefte: vaste levermomenten per bouwfase en minder spoedbestellingen. Vervolg: een leverplan voor het volgende project, samen met de projectleider.`
      Object.assign(data, { verslag: { tekst, bron: r() < 0.3 ? 'ingesproken' : 'getypt', perAgendapunt: agenda }, vervolgstap: w.uitkomst === 'vervolg' ? 'Leverplan per bouwfase voor het volgende project' : null, winpuntUitgevoerd: w.uitkomst === 'vervolg',
        ...(a?.fase === 'overgedragen' ? { overdragen: true } : {}), afronding: { sleutel: null, door: EVA, op: eind.toISOString() } })
      if (w.notulist && a) {
        data.notulist = {
          samenvatting: w.verslagSoort === 'nee' ? 'De prospect is tevreden met de huidige leverancier en werkt met een eigen voorraad. Geen vervolg op korte termijn.' : 'De prospect verliest tijd doordat monteurs wachten op materiaal en wil een leverplan per bouwfase zien voor het volgende project.',
          perAgendapunt: soort.agenda.map((p) => ({ punt: p.punt, samenvatting: p.punt === 'Aanleiding' ? 'Groei in het aantal projecten en krappe planning.' : p.punt === 'Situatie' ? 'Monteurs wachten gemiddeld een uur per dag op materiaal.' : p.punt === 'Behoefte' ? 'Vaste levermomenten per bouwfase, minder spoedbestellingen.' : p.punt === 'Vervolg' ? (w.verslagSoort === 'nee' ? 'Geen vervolg; over een half jaar opnieuw.' : 'Leverplan maken en een afspraak met de projectleider erbij.') : 'Besproken.' })),
          openVragen: ['Wie beslist naast de directeur over de keuze van de groothandel?', 'Hoeveel spoedbestellingen zijn er per maand?'],
          voorgesteldeUitkomst: w.uitkomst ?? 'vervolg',
          koopsignalen: w.verslagSoort === 'nee' ? [] : ['Wil een leverplan zien voor het volgende project', 'Noemt de wachttijd van monteurs als kostenpost'],
          bezwaren: w.verslagSoort === 'nee' ? ['Tevreden met de huidige leverancier'] : ['Twijfel of levering op tijd betrouwbaar is'],
          concurrenten: a.leverancier ? [LEVERANCIER[a.leverancier]] : [],
          actiepunten: w.verslagSoort === 'nee' ? ['Terugkomdatum over een half jaar zetten'] : ['Leverplan per bouwfase maken voor het volgende project', 'Afspraak plannen met de projectleider erbij'],
          op: new Date(eind.getTime() + 20 * 60_000).toISOString(), basis: { verslag: true, transcript: !!w.transcript },
        }
      }
      if (w.transcript && c) {
        transcriptRijen.push({ id: `eva-tr-${w.id.slice(-3)}`, organisation_id: orgId, bijlage_id: null, record_soort: 'appointments', record_id: w.id, taal: 'nl', dienst: 'mock', duur_sec: w.duur * 60 - tussen(r, 60, 300), bewaren_tot: plusDagen(w.datum!, 90), op: new Date(eind.getTime() + 5 * 60_000).toISOString(),
          tekst: [`Eva: Goedemiddag ${c.voor}, fijn dat je tijd hebt. Zullen we beginnen bij jullie projecten?`, `${c.voor}: Ja hoor. We hebben dit jaar een stuk of ${tussen(r, 4, 12)} projecten lopen en de planning is krap.`, 'Eva: Waar loopt het nu het vaakst op vast?', `${c.voor}: Vooral op materiaal. Mijn monteurs staan regelmatig te wachten op een levering.`, 'Eva: Hoe lossen jullie dat nu op?', `${c.voor}: Iemand rijdt dan naar de groothandel. Dat kost ons per week zeker een paar uur.`, 'Eva: Wij leveren per bouwfase op de bouwplaats. Zou dat helpen?',
            w.verslagSoort === 'nee' ? `${c.voor}: Eerlijk gezegd werken we met een eigen voorraad en zijn we tevreden. Ik zie nu geen reden om te wisselen.` : `${c.voor}: Als het betrouwbaar is wel. Ik wil eerst zien hoe dat bij een vergelijkbaar project ging.`,
            w.verslagSoort === 'nee' ? 'Eva: Helder. Mag ik over een half jaar nog eens contact opnemen?' : 'Eva: Dan neem ik bij de volgende afspraak een leverplan mee voor jullie volgende project.', w.verslagSoort === 'nee' ? `${c.voor}: Dat is goed.` : `${c.voor}: Prima, plan het in met mijn projectleider erbij.`].join('\n') })
      }
    }
    apRijen.push({ id: w.id, organisation_id: orgId, owner_id: EVA, gepland_door: EVA, account_id: a?.id ?? null, contact_id: c?.id ?? null, meetingsoort_id: soort.id, vorm: w.vorm, status: w.status, start_at: start.toISOString(), end_at: eind.toISOString(),
      uitkomst_code: w.status === 'afgerond' ? w.uitkomst ?? null : null, uitkomst_op: w.status === 'afgerond' && w.uitkomst ? eind.toISOString() : null, data, created_at: new Date(start.getTime() - tussen(r, 3, 12) * 864e5).toISOString() })
  }
  const nAfspraken = await zet(client, 'appointments', apRijen)
  await zet(client, 'transcripten', transcriptRijen)

  // ── 8. De geplande vaste belblokken en de sessie per dag en blok ──
  await zet(client, 'belblok_sessies', geplandeSessies)
  const sessieOp = new Map<string, string>()
  for (const x of (await client.query(`select id, start_op, vast_blok_id from belblok_sessies where gebruiker_id = $1 and status = 'gepland' and vast_blok_id is not null and start_op >= $2 and start_op < $3 order by id`, [EVA, om(vandaag, 0), om(wd(21), 0)])).rows) {
    const k = `${nlMoment(new Date(x.start_op)).datum}|${x.vast_blok_id}`
    if (!sessieOp.has(k)) sessieOp.set(k, x.id)
  }
  const blokOp = (n: number, soort: 'ochtend' | 'middag'): { id: string; due: string } | null => {
    const dag = wd(n)
    const w = weekdag(dag)
    if (soort === 'middag' && ![1, 3, 4, 5].includes(w)) return null
    const b = w === 5 ? BLOK.vrijdag : soort === 'middag' ? BLOK.middag : BLOK.ochtend
    const id = sessieOp.get(`${dag}|${b.vast}`)
    return id ? { id, due: om(dag, b.uur, b.minuut) } : null
  }

  // ── 9. Open taken: achterstallig, vandaag en de komende vier weken ──
  const open: Record<string, unknown>[] = []
  let to = 0
  const taak = (a: Acc | null, n: number, uur: number, minuut: number, soort: string, titel: string, prio: string, extra: Record<string, unknown> = {}, opties: { blok?: 'ochtend' | 'middag'; herkomst?: string; contact?: number; campagne?: string; signaal?: string; verschoven?: number; plan?: string; id?: string } = {}) => {
    const b = opties.blok ? blokOp(n, opties.blok) : null
    const id = opties.id ?? `eva-to${pad(++to, 3)}`
    open.push({ id, organisation_id: orgId, owner_id: EVA, account_id: a?.id ?? null, contact_id: a ? a.contacten[opties.contact ?? 0]?.id ?? null : null, action_type: soort, title: titel, status: 'open', priority: prio, due_date: b ? b.due : om(wd(n), uur, minuut),
      executor: 'mens', belblok_id: b?.id ?? null, campaign_id: opties.campagne ?? null, signal_id: opties.signaal ?? null, accountplan_id: opties.plan ?? null, verschoven: opties.verschoven ?? 0, created_at: om(wd(Math.min(n, 0) - tussen(r, 1, 6)), 8, 10),
      data: { herkomst: { bron: opties.herkomst ?? 'handmatig', actiesoort: soort, uitvoerder: EVA }, ...extra, ...(b ? { belblokId: b.id } : {}), ...(opties.campagne ? { campagneId: opties.campagne } : {}) } })
    return id
  }
  const metFase = (f: Fase) => accs.filter((a) => a.fase === f && actief(a))
  for (const [i, a] of metFase('gevonden').entries()) {
    if (i % 2) taak(a, tussen(r, 0, 6), kies(r, [10, 11, 13, 16]), 15, 'taak', 'Dossier aanvullen: website, omvang en beslisser', 'laag', { waarom: 'Nieuw in het bestand; het dossier is nog niet compleet.' }, { herkomst: 'regel' })
    else taak(a, tussen(r, 1, 9), 9, 0, 'bellen', 'Bel: eerste kennismaking', 'middel', { poging: { n: 1, van: 5, kanaal: 'bellen' }, waarom: 'Nieuw prospect in je regio.' }, { blok: 'ochtend', herkomst: 'regel' })
  }
  for (const a of metFase('dossier-compleet')) taak(a, tussen(r, 0, 5), kies(r, [11, 13, 15]), 30, 'taak', 'Kwalificeer na het dossier', 'middel', { waarom: 'Het dossier is compleet; kwalificeer zodat het in de reis komt.' }, { herkomst: 'regel' })
  for (const a of metFase('gekwalificeerd')) taak(a, tussen(r, 0, 7), 9, 0, 'bellen', 'Bel: eerste poging uit het ritme', 'middel', { poging: { n: 1, van: 5, kanaal: 'bellen' } }, { blok: 'ochtend', herkomst: a.ritme ? 'ritme' : 'regel' })
  for (const [i, a] of metFase('benaderd').entries()) {
    const n = ((a as any).pogingen ?? 1) + 1
    taak(a, i < 3 ? 0 : tussen(r, 1, 9), 9, 0, 'bellen', `Bel: poging ${n}${n >= 4 ? ', sluit af met een voorstel' : ', vraag naar de projectleider'}`, 'middel', { poging: { n, van: 5, kanaal: 'bellen', vorige: 'bellen' } }, { blok: 'middag', herkomst: a.ritme ? 'ritme' : 'handmatig' })
    if (i % 3 === 0) taak(a, tussen(r, 2, 12), kies(r, [10, 11, 15]), 45, 'mailen', 'Mail: praktijkvoorbeeld uit dezelfde branche', 'laag', { concept: { onderwerp: 'Praktijkvoorbeeld uit jullie branche', tekst: vul(T_MAILS[2]![1], woorden(a)) } })
    if (i % 4 === 1) taak(a, tussen(r, 1, 10), 11, 30, 'linkedin', 'LinkedIn: connectieverzoek aan de beslisser', 'laag', {})
  }
  for (const [i, a] of metFase('in-gesprek').entries()) {
    taak(a, i < 2 ? 0 : tussen(r, 1, 8), 15, 30 + (i % 2) * 15, 'bellen', 'Bel terug zoals afgesproken', 'hoog', { waarom: 'Terugbelmoment uit het laatste gesprek.' }, { herkomst: a.ritme ? 'ritme' : 'handmatig' })
    if (i % 2 === 0) taak(a, tussen(r, 0, 5), 10, 45, 'mailen', 'Mail: informatie over levering per bouwfase', 'middel', { concept: { onderwerp: 'Levering per bouwfase', tekst: vul(T_MAILS[1]![1], woorden(a)) }, waarom: 'Toegezegd in het gesprek.' })
    if (i % 3 === 1) taak(a, tussen(r, 2, 10), 13, 15, 'bericht', 'Bericht: korte bevestiging van het belmoment', 'laag', {}, { contact: a.contacten.findIndex((c) => c.rol === 'champion') >= 0 ? a.contacten.findIndex((c) => c.rol === 'champion') : 0 })
  }
  for (const w of afspraken.filter((x) => x.status === 'gepland' && x.acc && accVan.get(x.acc)!.fase === 'afspraak-gepland')) {
    const a = accVan.get(w.acc!)!
    taak(a, Math.max(0, w.dag - 1), 16, 0, 'bellen', 'Bel om de afspraak te bevestigen', 'hoog', { waarom: 'Eerste afspraak, nog niet bevestigd.' })
    taak(a, w.dag, Math.max(8, Math.floor(w.start! / 60) - 1), 0, 'taak', 'Briefing lezen en het winpunt kiezen', 'middel', { waarom: 'Voorbereiding op de eerste afspraak.' }, { herkomst: 'dagplanner' })
  }
  for (const a of metFase('afspraak-gehouden')) {
    taak(a, tussen(r, 0, 3), 10, 0, 'mailen', 'Mail: voorstel voor het leverplan', 'hoog', { waarom: 'Afgesproken in de kennismaking.' }, { herkomst: 'afspraak' })
    taak(a, tussen(r, 2, 8), 14, 30, 'taak', 'Overdracht voorbereiden voor de buitendienst', 'middel', {}, { herkomst: 'afspraak' })
  }
  for (const a of metFase('overgedragen').slice(0, 2)) taak(a, tussen(r, 3, 12), 16, 30, 'taak', 'Check of de buitendienst de overdracht heeft opgepakt', 'middel', { waarom: 'Overgedragen; nog geen bevestiging.' })
  for (const a of metFase('geparkeerd')) {
    const terug = accRijen.find((x) => x.id === a.id)!.terug_op as string
    let n = 0
    while (wd(n) < terug && n < 20) n++
    taak(a, n, 9, 0, 'bellen', 'Bel: komt terug uit de wachtstand', 'hoog', { waarom: 'De terugkomdatum is bereikt; zoek een nieuwe aanleiding.' }, { blok: 'middag', herkomst: 'regel' })
  }
  for (const [i, k] of klanten.entries()) {
    taak(k, tussen(r, 1, 12), 11, 0, 'bellen', 'Bel: bestelling voor het voorjaar afstemmen', 'laag', {})
    if (i === 0) taak(k, tussen(r, 4, 14), 15, 0, 'bezoek', 'Bezoek: monsters afgeven bij de nieuwe vestiging', 'middel', {})
  }
  // Achterstallig (een paar al vaker verzet: blijvers voor de weekreview).
  const achter = schud(r, accs.filter((a) => actief(a) && ['benaderd', 'in-gesprek', 'gekwalificeerd'].includes(a.fase!))).slice(0, 8)
  const ACHTER: [string, string, string][] = [['bellen', 'Bel: vraag naar de planning van volgend jaar', 'middel'], ['mailen', 'Mail: offerte voor de proefperiode', 'hoog'], ['taak', 'Notitie bijwerken na het gesprek', 'laag'], ['linkedin', 'LinkedIn: reageer op het nieuws over het project', 'laag'], ['bellen', 'Bel: projectleider spreken over de levertijden', 'hoog'], ['taak', 'Huidige leverancier navragen', 'middel'], ['mailen', 'Mail: praktijkvoorbeeld sturen', 'middel'], ['bericht', 'Bericht: datum voor een kennismaking voorstellen', 'middel']]
  for (const [i, a] of achter.entries()) {
    const [soort, titel, prio] = ACHTER[i]!
    taak(a, -tussen(r, 1, 6), kies(r, [9, 10, 11, 14, 15, 16]), 0, soort, titel, prio, { waarom: 'Bleef liggen; plan hem in of laat hem los.' }, { verschoven: i < 4 ? tussen(r, 3, 5) : tussen(r, 0, 2) })
  }
  taak(null, 4, 16, 30, 'taak', 'Pijplijn bijwerken voor het weekoverleg', 'laag', { waarom: 'Afspraak uit de coaching met Joost.' }, { herkomst: 'handmatig' })
  taak(null, 9, 16, 30, 'taak', 'Pijplijn bijwerken voor het weekoverleg', 'laag', { waarom: 'Afspraak uit de coaching met Joost.' }, { herkomst: 'handmatig' })
  taak(null, 1, 8, 30, 'taak', 'Belscript Studio: versies van de topprospects nalopen', 'laag', {}, { herkomst: 'handmatig' })
  taak(null, 0, 17, 0, 'taak', 'Weekstart voorbereiden: drie sterkste aanleidingen kiezen', 'middel', {}, { herkomst: 'volgen' })

  // ── 10. Inzichten met bronnen ──
  const SIG: { soort: string; type: string; titels: string[]; bron: string; waarom: string; voorstel: string | null }[] = [
    { soort: 'vacatures', type: 'vacature', titels: ['Zoekt twee servicemonteurs warmtepompen', 'Vacature werkvoorbereider installatietechniek', 'Zoekt een projectleider utiliteit', 'Zoekt drie monteurs zonnepanelen', 'Vacature planner service en onderhoud'], bron: 'Vacaturebank Testland', waarom: 'Groei in het team betekent meer projecten tegelijk; levering per bouwfase scheelt dan wachttijd.', voorstel: 'Bel over de groei van het team' },
    { soort: 'nieuwe-vestiging', type: 'kvk', titels: ['Nieuwe vestiging ingeschreven in {p}', 'Opent een tweede vestiging aan de Proefweg'], bron: 'Handelsregister (testomgeving)', waarom: 'Een tweede vestiging betekent een tweede magazijn en meer leveringen.', voorstel: 'Bel over de nieuwe vestiging' },
    { soort: 'nieuwbouw-vergunning', type: 'nieuws', titels: ['Omgevingsvergunning verleend voor 48 woningen in {p}', 'Start bouw van een nieuw schoolgebouw in {p}', 'Vergunning voor uitbreiding van het bedrijfspand'], bron: 'Omgevingsloket Testgemeente', waarom: 'Een nieuw project met vaste opleverdata; levering per bouwfase past daarbij.', voorstel: 'Vraag naar de planning van het project' },
    { soort: 'directiewissel', type: 'nieuws', titels: ['Nieuwe directeur benoemd per 1 januari'], bron: 'Regionieuws Testkrant', waarom: 'Een nieuwe directeur kijkt vaak opnieuw naar leveranciers.', voorstel: null },
    { soort: 'subsidie-regeling', type: 'nieuws', titels: ['Toekenning regeling verduurzaming voor 300 woningen', 'Subsidie voor een opslagproject toegekend'], bron: 'Regioportaal Testprovincie', waarom: 'Een groot verduurzamingsprogramma vraagt om een strakke materiaalplanning.', voorstel: 'Bel over de planning van het programma' },
    { soort: 'overname', type: 'nieuws', titels: ['Neemt een collega-installateur in de regio over'], bron: 'Regionieuws Testkrant', waarom: 'Na een overname veranderen inkoopafspraken vaak.', voorstel: 'Bel met de overname als aanleiding' },
    { soort: 'overig', type: 'website', titels: ['Nieuwe projectenpagina op de website', 'Nieuwe dienst: onderhoud van laadpalen'], bron: 'Website van het bedrijf', waarom: 'Nieuwe diensten vragen om snelle levering van onderdelen.', voorstel: null },
  ]
  const sigRijen: Record<string, unknown>[] = []
  let sn = 0
  const statussen = ['nieuw', 'nieuw', 'nieuw', 'gelezen', 'gelezen', 'omgezet', 'omgezet', 'afgewezen', 'later']
  for (const a of schud(r, [...accs.filter(actief), ...klanten])) {
    if (sn >= 64) break
    const aantal = r() < 0.75 ? 1 : r() < 0.6 ? 2 : 0
    for (let i = 0; i < aantal; i++) {
      let s = kies(r, SIG)
      // In br-01 nooit een directiewissel: de signaalradar toont daar bewust geen golf.
      if (s.soort === 'directiewissel' && a.branche === 'br-01') s = SIG[0]!
      const status = kies(r, statussen)
      const uren = status === 'nieuw' ? tussen(r, 3, 280) : status === 'gelezen' ? tussen(r, 24, 480) : status === 'later' ? tussen(r, 72, 360) : tussen(r, 72, 1300)
      const id = `eva-s1${pad(++sn)}`
      const op = uurGeleden(uren)
      const titel = vul(kies(r, s.titels), { p: a.plaats })
      const url = `https://bron.voorbeeld.test/${s.soort}/${id}`
      const rel = Math.min(88, tussen(r, 45, 88))
      sigRijen.push({ id, organisation_id: orgId, account_id: a.id, owner_id: EVA, onderwerp: `${s.type}:${id}`, agent: 'waarnemer', type: s.type, title: `${a.naam}: ${titel.charAt(0).toLowerCase()}${titel.slice(1)}`, relevance_score: rel, confidence: Math.min(95, rel + 5) / 100, status, bron: 'extern', signaalsoort: s.soort,
        data: { agent: 'waarnemer', waarom: s.waarom, bewijs: [`"${titel}" (${s.bron}, ${op.slice(0, 10)})`], evidence: [{ citaat: titel, bron: s.bron, datum: op.slice(0, 10), url }], zekerheid: Math.min(95, rel + 5), bron: { soort: s.type, naam: s.bron, url, datum: op.slice(0, 10) },
          voorstel: s.voorstel ? { title: s.voorstel, actionType: 'bellen', priority: rel >= 80 ? 'hoog' : 'middel' } : null, winpuntVoorstel: null, ...(status === 'afgewezen' ? { afwijsReden: kies(r, ['Niet relevant', 'Al bekend', 'Te oud']) } : {}) },
        created_at: op, updated_at: op })
      if (status === 'omgezet' && a.kind === 'prospect') taak(a, tussen(r, 0, 10), kies(r, [10, 11, 15]), 0, 'bellen', s.voorstel ?? `Bel over: ${titel.toLowerCase()}`, rel >= 80 ? 'hoog' : 'middel', { waarom: s.waarom }, { herkomst: 'inzicht', signaal: id, id: `eva-ts${pad(sn)}` })
    }
  }
  // Interne inzichten van de Notulist (koopsignalen uit verslagen).
  for (const w of afspraken.filter((x) => x.status === 'afgerond' && x.notulist && x.verslagSoort === 'vervolg').slice(0, 6)) {
    const a = accVan.get(w.acc!)!
    const id = `eva-s1${pad(++sn)}`
    const op = new Date(nlTijdstip(w.datum!, 17, 0).getTime()).toISOString()
    sigRijen.push({ id, organisation_id: orgId, account_id: a.id, owner_id: EVA, onderwerp: `koopsignaal:${w.id}`, agent: 'notulist', type: 'koopsignaal', title: `Koopsignaal: ${a.naam} wil een leverplan zien`, relevance_score: 74, confidence: 0.8, status: 'gelezen', bron: 'intern', signaalsoort: null,
      data: { agent: 'notulist', waarom: 'Uit het verslag van de kennismaking.', bewijs: ['"Ik wil eerst zien hoe dat bij een vergelijkbaar project ging" (Verslag)'], evidence: [{ citaat: 'Ik wil eerst zien hoe dat bij een vergelijkbaar project ging', bron: 'Verslag', datum: w.datum }], zekerheid: 80, bron: { soort: 'verslag', naam: 'Verslag', datum: w.datum }, voorstel: null, winpuntVoorstel: null, afspraakId: w.id },
      created_at: op, updated_at: op })
  }
  const nInzichten = await zet(client, 'signals', sigRijen)

  // ── 11. Opvolgreeksen: lopend, gepauzeerd, raak, gestopt en klaar ──
  if (!(await client.query(`select 1 from reekssjablonen where organisation_id = $1 limit 1`, [orgId])).rowCount) {
    for (const s of STARTSJABLONEN) {
      await client.query(`insert into reekssjablonen (organisation_id, sleutel, naam, omschrijving, na, stappen, einde, uitkomsten) values ($1, $2, $3, $4, $5, $6, $7, $8) on conflict (organisation_id, sleutel) do nothing`,
        [orgId, s.sleutel, s.naam, s.omschrijving, s.na, JSON.stringify(s.stappen), JSON.stringify(s.einde), s.uitkomsten ?? []])
    }
  }
  const sjablonen = Object.fromEntries((await client.query(`select id, sleutel from reekssjablonen where organisation_id = $1`, [orgId])).rows.map((x: any) => [x.sleutel, x.id as string]))
  const zonderRitme = (f: Fase) => accs.filter((a) => a.fase === f && actief(a) && !a.ritme && !afspraken.some((w) => w.acc === a.id && w.status !== 'geannuleerd'))
  const STOPPEND = new Set(['afspraak', 'later', 'gesproken', 'geen_interesse'])
  const laatsteReactie = (a: Acc) => Math.max(-99, ...evs.filter((e) => e.acc === a.id && STOPPEND.has(e.uitkomst ?? '')).map((e) => e.dag))
  const kandidaten = { benaderd: zonderRitme('benaderd'), gesprek: zonderRitme('in-gesprek'), geparkeerd: zonderRitme('geparkeerd'), verloren: accs.filter((a) => a.fase === 'verloren'), gepland: accs.filter((a) => a.fase === 'afspraak-gepland') }
  const REEKSEN: [Acc | undefined, string, 'loopt' | 'gepauzeerd' | 'gestopt' | 'klaar', string | null, number, 'B' | 'C'][] = [
    [kandidaten.benaderd[0], 'na-voicemail', 'loopt', null, -5, 'C'],
    [kandidaten.benaderd[1], 'na-voicemail', 'loopt', null, -2, 'B'],
    [kandidaten.gesprek[0], 'na-informatie', 'loopt', null, -6, 'C'],
    [kandidaten.gesprek[1], 'na-eerste-gesprek', 'loopt', null, -9, 'C'],
    [kandidaten.benaderd[2], 'na-informatie', 'gepauzeerd', null, -4, 'C'],
    [kandidaten.gepland[0], 'na-informatie', 'gestopt', 'afspraak', -12, 'C'],
    [kandidaten.gesprek[2], 'na-voicemail', 'gestopt', 'reactie', -10, 'C'],
    [kandidaten.verloren[0], 'na-eerste-gesprek', 'gestopt', 'nee', -18, 'C'],
    [kandidaten.geparkeerd[0], 'na-voicemail', 'gestopt', 'handmatig', -14, 'C'],
    [kandidaten.geparkeerd[1], 'na-voicemail', 'klaar', null, -26, 'C'],
  ]
  const reeksRijen: Record<string, unknown>[] = []
  const stapRijen: Record<string, unknown>[] = []
  const reeksTaken: Record<string, unknown>[] = []
  const reeksActs: Record<string, unknown>[] = []
  const reeksConcepten: Record<string, unknown>[] = []
  const gebruikt = new Set<string>()
  let rn = 0
  for (const [a, sleutel, status, stopreden, startDag, mandaat] of REEKSEN) {
    if (!a || gebruikt.has(a.id)) continue
    gebruikt.add(a.id)
    const sj = STARTSJABLONEN.find((s) => s.sleutel === sleutel)!
    const id = `eva-reeks-${pad(++rn)}`
    const startNa = status === 'loopt' || status === 'gepauzeerd' ? Math.min(-1, Math.max(startDag, laatsteReactie(a) + 1)) : startDag
    const start = new Date(om(wd(startNa), 10, 15))
    const stappen = planReeks({ stappen: sj.stappen, einde: sj.einde }, start, INST)
    const stopOp = status === 'gestopt' ? new Date(om(wd(Math.min(-1, startDag + tussen(r, 3, 6))), 11, 40)) : null
    const pauzeOp = status === 'gepauzeerd' ? new Date(om(wd(-1), 15, 0)) : null
    let openGezet = false
    for (const st of stappen) {
      const t = Date.parse(st.geplandOp)
      let s: string
      if (status === 'klaar') s = 'gedaan'
      else if (stopOp) s = t < stopOp.getTime() ? 'gedaan' : 'overgeslagen'
      else if (pauzeOp) s = t < pauzeOp.getTime() ? 'gedaan' : 'gepland'
      else if (t < nu.getTime() && nlMoment(new Date(t)).datum < vandaag) s = 'gedaan'
      else if (!openGezet && st.kanaal !== 'einde' && nlMoment(new Date(t)).datum <= wd(1)) { s = 'open'; openGezet = true }
      else s = 'gepland'
      if (s === 'gedaan' && t > nu.getTime()) s = 'gepland'
      const stapId = `${id}-s${st.volgnummer}`
      let taskId: string | null = null
      let conceptId: string | null = null
      const c = a.contacten[0]!
      if ((s === 'gedaan' || s === 'open') && st.kanaal !== 'einde') {
        taskId = `eva-rt-${pad(rn)}-${st.volgnummer}`
        const soortTaak = st.kanaal === 'mail' ? 'mailen' : st.kanaal === 'linkedin' ? 'linkedin' : 'bellen'
        const due = s === 'open' && t < nu.getTime() ? om(vandaag, 9) : st.geplandOp
        reeksTaken.push({ id: taskId, organisation_id: orgId, owner_id: EVA, account_id: a.id, contact_id: c.id, action_type: soortTaak, title: st.titel, status: s === 'gedaan' ? 'klaar' : 'open', priority: 'middel', due_date: due, uitkomst: s === 'gedaan' ? (st.kanaal === 'bellen' ? 'voicemail' : 'verzonden') : null, executor: 'mens',
          created_at: start.toISOString(), updated_at: s === 'gedaan' ? st.geplandOp : start.toISOString(), data: { herkomst: { bron: 'reeks', actiesoort: soortTaak, uitvoerder: EVA }, reeks: { id, n: st.volgnummer, van: sj.stappen.length, stapId } } })
        if (s === 'gedaan') reeksActs.push({ id: `eva-xr-${pad(rn)}-${st.volgnummer}`, organisation_id: orgId, account_id: a.id, contact_id: c.id, task_id: taskId, uitvoerder: 'mens', kanaal: st.kanaal === 'mail' ? 'email' : st.kanaal === 'linkedin' ? 'linkedin' : 'telefoon', soort: st.kanaal === 'mail' ? 'mail' : st.kanaal === 'linkedin' ? 'bericht' : 'gebeld',
          uitkomst: st.kanaal === 'bellen' ? 'voicemail' : 'verzonden', door: EVA, op: new Date(t + 25 * 60_000).toISOString(), data: { seed: 'eva', reeksId: id, ...(st.kanaal === 'mail' ? { onderwerp: st.titel.replace(/^Mail: /, ''), tekst: vul('Hoi {v}, zoals beloofd kort op een rij wat levering per bouwfase voor {b} kan betekenen. Zullen we volgende week even bellen?', woorden(a)) } : {}) } })
        if (s === 'open' && st.kanaal !== 'bellen') {
          conceptId = `crr-eva-${pad(rn)}-${st.volgnummer}`
          const tekst = vul(st.kanaal === 'mail' ? 'Hoi {v}, ik liet vorige week een voicemail achter. In het kort: wij leveren per bouwfase op de bouwplaats, zodat de monteurs van {b} niet wachten. Past een kwartier volgende week?' : 'Hoi {v}, we spraken elkaar kort over levering per bouwfase. Leuk om te connecten.', woorden(a))
          reeksConcepten.push({ id: conceptId, organisation_id: orgId, agent: 'schrijver', handeling: `reeks:${st.kanaal}`, gebruiker_id: EVA, account_id: a.id, task_id: taskId, status: 'klaar', op: start.toISOString(),
            concept: { type: st.kanaal, ...(st.kanaal === 'mail' ? { onderwerp: st.titel.replace(/^Mail: /, '') } : {}), tekst, contactId: c.id, winpuntId: 'wp-02', bronnen: [{ soort: 'winpunt', titel: 'Levering op het uur' }], aanleiding: sj.na, stijlscore: 8, woorden: tekst.split(/\s+/).length, grens: st.kanaal === 'mail' ? 120 : 80 } })
        }
      }
      stapRijen.push({ id: stapId, organisation_id: orgId, reeks_id: id, volgnummer: st.volgnummer, dag: st.dag, kanaal: st.kanaal, titel: st.titel, instructie: st.instructie ?? null, status: s, gepland_op: st.geplandOp, task_id: taskId, concept_id: conceptId,
        reden: s === 'overgeslagen' ? 'De reeks is gestopt' : null, gedaan_op: s === 'gedaan' ? new Date(t + 25 * 60_000).toISOString() : null, data: st.onderwerp ? { onderwerp: st.onderwerp } : {} })
    }
    reeksRijen.push({ id, organisation_id: orgId, account_id: a.id, contact_id: a.contacten[0]!.id, sjabloon_id: sjablonen[sleutel] ?? null, naam: sj.naam, owner_id: EVA, mandaat, status, stopreden, gestart_op: start.toISOString(), gepauzeerd_op: pauzeOp?.toISOString() ?? null,
      gestopt_op: stopOp?.toISOString() ?? (status === 'klaar' ? stappen.at(-1)!.geplandOp : null), created_at: start.toISOString(), updated_at: (stopOp ?? pauzeOp ?? start).toISOString(),
      data: { ritmeVoor: null, aanleiding: sj.na, wachtDagen: sj.einde.wachtDagen, stopregels: { reactie: true, afspraak: true, nee: true }, ...(stopreden === 'reactie' ? { stopToelichting: 'Antwoord op de mail ontvangen' } : stopreden === 'handmatig' ? { stopToelichting: 'Zelf gestopt: eerst een nieuwe aanleiding afwachten' } : {}) } })
    if (stopreden === 'reactie' && stopOp) reeksActs.push({ id: `eva-xr-${pad(rn)}-reactie`, organisation_id: orgId, account_id: a.id, contact_id: a.contacten[0]!.id, task_id: null, uitvoerder: 'mens', kanaal: 'mail', soort: 'reactie', uitkomst: null, door: EVA, op: stopOp.toISOString(), data: { seed: 'eva', reeksId: id, tekst: 'Antwoord op de mail: graag in de week erna even bellen.' } })
  }
  await zet(client, 'reeksen', reeksRijen)
  nTaken += await zet(client, 'tasks', reeksTaken)
  await zet(client, 'concepten', reeksConcepten)
  await zet(client, 'reeksstappen', stapRijen)
  await zet(client, 'activiteiten', reeksActs)

  // ── 12. Accountplannen voor de topprospects (twee actueel, één afgerond) ──
  const jaar = vandaag.slice(0, 4)
  const topA = accs.find((a) => a.klasse === 'kl-a-prospects' && a.fase === 'afspraak-gehouden')
  const topB = accs.find((a) => (a.klasse === 'kl-a-prospects' || a.klasse === 'kl-b-prospects') && a.fase === 'afspraak-gepland' && !gebruikt.has(a.id))
  const topC = accs.find((a) => a.klasse === 'kl-b-prospects' && a.fase === 'overgedragen')
  const planRijen: Record<string, unknown>[] = []
  for (const [i, a] of [topA, topB, topC].entries()) {
    if (!a) continue
    const id = `eva-plan-0${i + 2}`
    const afgerond = i === 2
    const c0 = a.contacten[0]!
    const c1 = a.contacten[1] ?? c0
    planRijen.push({ id, organisation_id: orgId, account_id: a.id, owner_id: EVA, titel: afgerond ? `Accountplan ${jaar}: overdracht voorbereiden` : `Accountplan ${jaar}: eerste project binnenhalen`, status: afgerond ? 'afgerond' : 'actueel',
      geldig_van: afgerond ? wd(-60) : `${jaar}-01-01`, geldig_tot: afgerond ? wd(-2) : `${jaar}-12-31`, door: EVA, created_at: om(wd(afgerond ? -45 : -20), 9), updated_at: om(wd(-2), 16),
      data: { contactIds: [c0.id, c1.id], secties: {
        klantinformatie: `${a.naam} in ${a.plaats}: ${a.medewerkers} medewerkers, vooral ${FOCUS[a.branche]}. ${c0.voor} ${c0.achter} (${c0.functie.toLowerCase()}) beslist, ${c1.voor} ${c1.achter} (${c1.functie.toLowerCase()}) bepaalt wat er per bouwfase op de bouw moet zijn.`,
        doelstellingen: afgerond ? 'De overdracht aan de buitendienst met een compleet leverplan en een tweede contact in het buying committee.' : `Voor 31 december het eerste project binnen met levering per bouwfase, daarna een vaste leverafspraak voor ${Number(jaar) + 1}.`,
        kansen: 'Er starten in het voorjaar meerdere projecten in de regio. De projectleider wil minder wachttijd op de bouw.',
        bedreigingen: `${a.leverancier ? `De huidige leverancier (${LEVERANCIER[a.leverancier]!.toLowerCase()}) levert scherp op prijs.` : 'De huidige leverancier is nog niet bekend.'} Zonder bewijs van betere levertijden blijft de directie bij wat ze kent.`,
        strategieen: 'Eerst de projectleider helpen met een leverplan voor één project, daarna met de directeur het voorstel bespreken. In elk gesprek de levertijden van vergelijkbare projecten als bewijs gebruiken.',
        evaluatie: afgerond ? 'Doel gehaald: overgedragen met een leverplan en twee contacten gesproken. Volgende keer eerder de inkoper betrekken.' : '',
      } } })
    const ACTIES: [string, number, number, number, boolean][] = afgerond
      ? [['Leverplan per bouwfase opstellen', -20, 10, 1, true], ['Tweede contact spreken over de planning', -12, 14, 1, true], ['Overdracht met Bram afstemmen', -4, 11, 0, true]]
      : [['Kennismaking plannen met de directeur', -10, 10, 0, true], ['Voorstel voor het eerste project sturen', tussen(r, 2, 6), 10, 0, false], ['Leverplan doornemen met de projectleider', tussen(r, 8, 15), 14, 1, false], ['Referentie van een vergelijkbaar project regelen', tussen(r, 4, 12), 11, 0, false]]
    for (const [j, [titel, dag, uur, ci, klaar]] of ACTIES.entries()) {
      open.push({ id: `eva-tplan-${i + 2}${j + 1}`, organisation_id: orgId, owner_id: EVA, account_id: a.id, contact_id: a.contacten[ci]?.id ?? c0.id, action_type: 'taak', title: titel, status: klaar ? 'klaar' : 'open', priority: 'middel', due_date: om(wd(dag), uur), executor: 'mens', belblok_id: null, campaign_id: null, signal_id: null, accountplan_id: id, verschoven: 0,
        created_at: om(wd(afgerond ? -45 : -20), 9), data: { herkomst: { bron: 'accountplan', actiesoort: 'taak', uitvoerder: EVA }, aanleiding: `Actieplan: Accountplan ${jaar}` } })
    }
  }
  await zet(client, 'accountplannen', planRijen)

  // ── 13. Campagnes: actief, afgerond (met kaarten) en concept ──
  const vv = Object.fromEntries((await client.query(`select onderdeel, versie from vv_sublagen where organisation_id = $1 and status = 'bevestigd'`, [orgId])).rows.map((x: any) => [x.onderdeel, x.versie]))
  const soortVan = (k: string) => CAMPAGNESOORTEN_START.find((s) => s.sleutel === k)
  const campagneData = (k: string, winpunt: string | null, branche: string) => { const s = soortVan(k)!; return { winpuntId: winpunt, scriptId: null, boodschap: null, mailreeks: [], ritme: { bron: s.ritme, pogingen: s.pogingen }, tussendoelen: [], doel: s.standaardDoel, capaciteit: null, verdeling: null, brancheId: branche, jaarkeuze: null, varianten: [], vvVersies: vv, bron: { soort: 'vrij' }, kanaalVia: 'direct', planStart: null } }
  const campagnes: Record<string, unknown>[] = []
  const items: Record<string, unknown>[] = []
  const KOLOM: Record<string, string> = { gevonden: 'gespot', 'dossier-compleet': 'gespot', gekwalificeerd: 'gespot', benaderd: 'benaderd', 'in-gesprek': 'in-gesprek', 'afspraak-gepland': 'afspraak', 'afspraak-gehouden': 'afspraak', overgedragen: 'afspraak', geparkeerd: 'geparkeerd', verloren: 'afgewezen' }
  if (soortVan('koude-belcampagne')) {
    campagnes.push({ id: 'cp-eva-02', organisation_id: orgId, naam: 'Koude belronde utiliteit Regio Midden', soort: 'koude-belcampagne', status: 'actief', eigenaar_id: EVA, started_at: wd(-15), ends_at: wd(10), data: campagneData('koude-belcampagne', 'wp-01', 'br-02') })
    for (const a of accs.filter((x) => x.branche === 'br-02' && actief(x) && x.regio && !gebruikt.has(x.id)).slice(0, 16)) {
      const kolom = KOLOM[a.fase!]!
      const poging = kolom === 'gespot' ? 0 : kolom === 'benaderd' ? Math.min(4, (a as any).pogingen ?? 1) : kolom === 'geparkeerd' ? 5 : 2
      const volgend = ['gespot', 'benaderd', 'in-gesprek'].includes(kolom) ? tussen(r, 0, 8) : null
      items.push({ organisation_id: orgId, campagne_id: 'cp-eva-02', account_id: a.id, kolom, poging, volgende_stap: volgend === null ? null : kolom === 'in-gesprek' ? 'Terugbellen zoals afgesproken' : `Belpoging ${poging + 1}`, volgende_op: volgend === null ? null : om(wd(volgend), 10), eigenaar_id: EVA,
        einddoel_gehaald: kolom === 'afspraak', winpunt_uitgevoerd: kolom === 'afspraak' ? true : kolom === 'afgewezen' ? false : null, data: kolom === 'afgewezen' ? { uitkomst: 'geen_interesse', reden: 'Tevreden met huidige leverancier' } : {} })
      if (kolom === 'gespot' && volgend !== null) taak(a, volgend, 9, 0, 'bellen', 'Bel: koude belronde utiliteit, eerste poging', 'middel', { poging: { n: 1, van: 5, kanaal: 'bellen' } }, { blok: 'ochtend', herkomst: 'campagne', campagne: 'cp-eva-02' })
    }
  }
  if (soortVan('mailreeks')) {
    campagnes.push({ id: 'cp-eva-03', organisation_id: orgId, naam: 'Najaarsmail zonnedaken', soort: 'mailreeks', status: 'afgerond', eigenaar_id: EVA, started_at: wd(-40), ends_at: wd(-12), data: campagneData('mailreeks', 'wp-02', 'br-04') })
    for (const [i, a] of accs.filter((x) => x.branche === 'br-04').slice(0, 9).entries()) {
      const kolom = ['afspraak', 'afspraak', 'afgewezen', 'afgewezen', 'geparkeerd', 'geparkeerd', 'benaderd', 'benaderd', 'in-gesprek'][i]!
      items.push({ organisation_id: orgId, campagne_id: 'cp-eva-03', account_id: a.id, kolom, poging: kolom === 'benaderd' ? 3 : 2, volgende_stap: null, volgende_op: null, eigenaar_id: EVA, einddoel_gehaald: kolom === 'afspraak', winpunt_uitgevoerd: kolom === 'afspraak' ? true : kolom === 'afgewezen' ? false : null,
        data: kolom === 'afgewezen' ? { uitkomst: 'geen_interesse', reden: 'Geen budget' } : {} })
    }
  }
  if (soortVan('beurs-event')) {
    campagnes.push({ id: 'cp-eva-04', organisation_id: orgId, naam: 'Beurs Installatie Midden: uitnodigen', soort: 'beurs-event', status: 'concept', eigenaar_id: EVA, started_at: null, ends_at: wd(25), data: campagneData('beurs-event', 'wp-03', 'br-01') })
    for (const a of accs.filter((x) => x.branche === 'br-01' && actief(x) && ['gevonden', 'dossier-compleet', 'gekwalificeerd', 'benaderd'].includes(x.fase!)).slice(0, 12)) {
      items.push({ organisation_id: orgId, campagne_id: 'cp-eva-04', account_id: a.id, kolom: 'gespot', poging: 0, volgende_stap: null, volgende_op: null, eigenaar_id: EVA, einddoel_gehaald: false, winpunt_uitgevoerd: null, data: {} })
    }
  }
  await zet(client, 'campagnes', campagnes)
  await zet(client, 'campagne_items', items, 'on conflict (campagne_id, account_id) do nothing')
  nTaken += await zet(client, 'tasks', open)

  // ── 14. Concepten ter goedkeuring en verstuurd, en meldingen ──
  const winpunt = (titel: string) => [{ soort: 'winpunt', titel }]
  const conceptRijen: Record<string, unknown>[] = []
  const metConcept = schud(r, accs.filter((a) => actief(a) && ['benaderd', 'in-gesprek', 'afspraak-gepland', 'afspraak-gehouden'].includes(a.fase!) && !gebruikt.has(a.id))).slice(0, 10)
  for (const [i, a] of metConcept.entries()) {
    const type = ['mail', 'mail', 'linkedin', 'whatsapp', 'mail', 'briefing', 'mail', 'linkedin', 'mail', 'mail'][i]!
    const status = ['klaar', 'klaar', 'klaar', 'klaar', 'goedgekeurd', 'klaar', 'verstuurd', 'verstuurd', 'verworpen', 'verstuurd'][i]!
    const c = a.contacten[0]!
    const tekst = type === 'mail' ? vul(kies(r, T_MAILS)[1], woorden(a)) : type === 'linkedin' ? `Hoi ${c.voor}, ik zag het nieuws over ${a.naam}. Wij helpen ${BRANCHE_NAAM[a.branche]} met levering per bouwfase. Leuk om te connecten?` : type === 'whatsapp' ? `Goedemiddag ${c.voor}, zullen we de afspraak houden op de datum uit de agenda? Ik neem het leverplan mee.` : ''
    const concept: Record<string, unknown> = type === 'briefing'
      ? { type, blokken: { opening: `Je sprak ${c.voor} eerder over de levering; de monteurs wachten vaak op materiaal.`, winpunt: 'Gratis projectschouw binnen 48 uur: laat zien wat levering per bouwfase oplevert.', doel: 'Een datum voor de inventarisatie op locatie.' } }
      : { type, ...(type === 'mail' ? { onderwerp: kies(r, ['Levering per bouwfase', 'Een korte vraag', 'Praktijkvoorbeeld uit jullie branche']) } : {}), tekst, contactId: c.id }
    const t = String(concept.tekst ?? Object.values((concept.blokken as Record<string, string>) ?? {}).join(' '))
    const op = uurGeleden(status === 'klaar' ? tussen(r, 1, 30) : tussen(r, 30, 400))
    conceptRijen.push({ id: `cr-eva-x${pad(i + 1)}`, organisation_id: orgId, agent: 'schrijver', handeling: `pitstop:${type}`, gebruiker_id: EVA, account_id: a.id, status, overname: status === 'klaar' ? null : status === 'verworpen' ? 'verworpen' : i % 2 ? 'aangepast' : 'ongewijzigd', op, besloten_op: status === 'klaar' ? null : new Date(Date.parse(op) + 3600e3).toISOString(),
      concept: { ...concept, winpuntId: i % 2 ? 'wp-02' : 'wp-01', bronnen: winpunt(i % 2 ? 'Levering op het uur' : 'Gratis projectschouw binnen 48 uur'), aanleiding: a.aanleiding?.tekst ?? 'Vervolg op het laatste contact', stijlscore: 8, woorden: t.split(/\s+/).filter(Boolean).length, grens: type === 'mail' ? 120 : 80, vvVersies: vv } })
  }
  await zet(client, 'concepten', conceptRijen)
  const eerstNieuw = sigRijen.find((s) => s.status === 'nieuw') as any
  const eerstGepland = afspraken.filter((w) => w.status === 'gepland' && w.acc && w.dag >= 0).sort((x, y) => x.dag - y.dag || x.start! - y.start!)[0]
  const MELDINGEN: [string, string, string, string, string, number, boolean][] = [
    ['m-eva-x1', 'hot', eerstNieuw ? `Nieuw inzicht bij ${accVan.get(eerstNieuw.account_id)?.naam}` : 'Nieuwe inzichten in je regio', eerstNieuw ? String(eerstNieuw.title) : 'Bekijk de inzichten van vandaag.', eerstNieuw ? `/inzichten?inzicht=${eerstNieuw.id}` : '/inzichten', 7, false],
    ['m-eva-x2', 'herinnering', 'Opvolgreeks wacht op jou', 'Een mailstap staat klaar om goed te keuren.', '/opvolgreeksen', 3, false],
    ['m-eva-x3', 'inzicht', 'Vier concepten klaar ter goedkeuring', 'De Schrijver zette mails en berichten klaar.', '/concepten', 9, false],
    ['m-eva-x4', 'systeem', 'Belblok afgerond', `Je belblok van gisteren is verwerkt in je resultaten.`, '/belblokken', 20, true],
    ['m-eva-x5', 'herinnering', eerstGepland ? `Afspraak met ${accVan.get(eerstGepland.acc!)?.naam}` : 'Afspraak deze week', 'Lees de briefing en kies het winpunt.', '/agenda', 26, true],
    ['m-eva-x6', 'inzicht', 'Accountplan bijgewerkt', 'Een actie uit het actieplan is afgerond.', '/accountplannen', 50, true],
  ]
  await zet(client, 'notificaties', MELDINGEN.map(([id, soort, titel, tekst, link, uren, gelezen]) => { const op = uurGeleden(uren); return { id, organisation_id: orgId, gebruiker_id: EVA, soort, titel, tekst, link, op, gelezen_op: gelezen ? new Date(Date.parse(op) + 1800e3).toISOString() : null } }))

  // ── 15. Kennisbank: documenten van Eva, gekoppeld aan prospects en contacten ──
  const docAcc = schud(r, accs.filter((a) => ['afspraak-gepland', 'afspraak-gehouden', 'overgedragen', 'in-gesprek'].includes(a.fase!)))
  const DOCS: { id: string; naam: string; type: string; versie: string; mime: string; dagen: number; beschrijving: string | null; inhoud: string; accounts: Acc[]; contact?: Acc }[] = [
    { id: 'kb-eva-01', naam: 'Case utiliteit: wachttijd op de bouw gehalveerd.md', type: 'case', versie: '1', mime: 'text/markdown', dagen: 18, beschrijving: 'Hoe een utiliteitsinstallateur met levering per bouwfase de wachttijd van zijn monteurs halveerde.', accounts: docAcc.slice(0, 2),
      inhoud: '# Case utiliteit\n\nEen installateur met 35 monteurs werkte aan drie scholen tegelijk.\n\n## De vraag\n\nMonteurs wachtten gemiddeld een uur per dag op materiaal.\n\n## De aanpak\n\nEen leverplan per bouwfase, afgestemd met de werkvoorbereider.\n\n## Het resultaat\n\nNa twee maanden was de wachttijd gehalveerd en daalden de spoedbestellingen met een derde.' },
    { id: 'kb-eva-02', naam: 'Offerte leverplan per bouwfase 2027.md', type: 'offerte', versie: '2', mime: 'text/markdown', dagen: 6, beschrijving: 'Standaardofferte voor een leverplan per bouwfase met vaste leverdagen.', accounts: docAcc.slice(2, 3), contact: docAcc[2],
      inhoud: '# Offerte leverplan per bouwfase\n\nLooptijd: 12 maanden.\n\nPer bouwfase twee vaste leverdagen op de bouwplaats.\n\nProjectschouw vooraf gratis.\n\nPrijs: vaste vergoeding per project, afhankelijk van het aantal fases.' },
    { id: 'kb-eva-03', naam: 'Presentatie kennismaking utiliteit (tekst).md', type: 'presentatie', versie: '1', mime: 'text/markdown', dagen: 25, beschrijving: 'De tekst van de zes dia\'s voor een kennismaking bij een utiliteitsinstallateur.', accounts: [],
      inhoud: '# Kennismaking utiliteit\n\n1. Wie wij zijn.\n2. Wat we horen: wachten op materiaal kost uren per week.\n3. Levering per bouwfase.\n4. De projectapp.\n5. Een case uit de regio.\n6. Voorstel: een gratis projectschouw.' },
    { id: 'kb-eva-04', naam: 'Productinfo projectapp.txt', type: 'productinfo', versie: '3', mime: 'text/plain', dagen: 40, beschrijving: null, accounts: docAcc.slice(3, 5),
      inhoud: 'De projectapp toont per project wat er wanneer geleverd wordt.\nMonteurs zien de levering per bouwfase op hun telefoon.\nDe werkvoorbereider wijzigt een levering tot een dag vooraf.' },
    { id: 'kb-eva-05', naam: 'Raamovereenkomst levering per bouwfase (concept).md', type: 'contract', versie: '1', mime: 'text/markdown', dagen: 3, beschrijving: 'Concept voor een raamovereenkomst bij een vaste leverafspraak.', accounts: topA ? [topA] : [],
      inhoud: '# Raamovereenkomst (concept)\n\nLooptijd: twee jaar, daarna steeds een jaar verlengd.\n\nLevering per bouwfase volgens het leverplan per project.\n\nOpzegtermijn: drie maanden.' },
    { id: 'kb-eva-06', naam: 'Notities beurs Installatie Midden.txt', type: 'overig', versie: '1', mime: 'text/plain', dagen: 33, beschrijving: 'Mijn aantekeningen van de standgesprekken op de beurs.', accounts: accs.filter((a) => a.fase === 'gevonden').slice(0, 3),
      inhoud: 'Standgesprekken op de beurs Installatie Midden.\nVeel vragen over levering op de bouwplaats en over de projectapp.\nDrie bedrijven willen na de beurs gebeld worden.' },
  ]
  const docRijen = DOCS.map((d) => { const b = Buffer.from(d.inhoud, 'utf8'); const op = new Date(nu.getTime() - d.dagen * 864e5).toISOString(); return { id: d.id, organisation_id: orgId, naam: d.naam, type: d.type, versie: d.versie, beschrijving: d.beschrijving, mime: d.mime, grootte: b.length, inhoud: `\\x${b.toString('hex')}`, tekst: d.inhoud, tekst_status: 'gelezen', eigenaar_id: EVA, gemaakt_op: op, bijgewerkt_op: op } })
  await zet(client, 'documenten', docRijen)
  const koppel: Record<string, unknown>[] = []
  for (const d of DOCS) {
    for (const a of d.accounts) koppel.push({ organisation_id: orgId, document_id: d.id, account_id: a.id, contact_id: null })
    if (d.contact) koppel.push({ organisation_id: orgId, document_id: d.id, account_id: d.contact.id, contact_id: d.contact.contacten[0]!.id })
  }
  await zet(client, 'document_koppelingen', koppel)

  // ── 16. Voornemens en weekreview, winpunten die raakten, belscriptversies en inkomende mail ──
  const deze = maandagVan(echt)
  const vorige = plusDagen(deze, -7)
  const twee = plusDagen(deze, -14)
  const sessiesIn = (m: string) => sessieRijen.filter((s) => { const d = nlMoment(new Date(s.start_op)).datum; return d >= m && d <= plusDagen(m, 4) }).map((s) => s.id)
  const takenIn = (m: string, status: string) => [...taakRijen, ...open].filter((t) => t.status === status && (() => { const d = nlMoment(new Date(String(t.due_date))).datum; return d >= m && d <= plusDagen(m, 4) })()).map((t) => t.id as string)
  const VN: [string, string, string, string, 'belblok' | 'taak', Record<string, unknown>][] = [
    ['eva-vn-1', twee, 'gedaan', 'Twee extra koude belblokken op dinsdag en donderdag', 'belblok', { sessieIds: sessiesIn(twee).slice(0, 2) }],
    ['eva-vn-2', twee, 'gedaan', 'Na elk gesprek dezelfde dag een samenvatting sturen', 'taak', { taakIds: takenIn(twee, 'klaar').slice(0, 1) }],
    ['eva-vn-3', twee, 'niet_gedaan', 'Bij drie prospects de projectleider spreken', 'taak', { taakIds: [] }],
    ['eva-vn-4', vorige, 'gedaan', 'Belblok op het beste uur: dinsdag 09:00', 'belblok', { sessieIds: sessiesIn(vorige).slice(0, 1) }],
    ['eva-vn-5', vorige, 'gedaan', 'Elke afspraak met een tweede contact', 'taak', { taakIds: takenIn(vorige, 'klaar').slice(1, 2) }],
    ['eva-vn-6', deze, 'gepland', 'Middagblok vrijhouden voor opvolging', 'belblok', { sessieIds: sessiesIn(deze).slice(0, 2) }],
    ['eva-vn-7', deze, 'gepland', 'Blijvers inplannen of loslaten', 'taak', { taakIds: open.filter((t) => Number(t.verschoven) >= 3).map((t) => t.id as string).slice(0, 2) }],
  ]
  await zet(client, 'voornemens', VN.map(([id, week, status, tekst, soort, data]) => ({ id, organisation_id: orgId, gebruiker_id: EVA, week, tekst, soort, status, gedeeld: id === 'eva-vn-4' || id === 'eva-vn-6', data, created_at: om(plusDagen(week, -3), 15, 30) })))
  await zet(client, 'dagritme_momenten', [twee, vorige].map((m) => ({ id: `eva-dm-${m}`, organisation_id: orgId, gebruiker_id: EVA, soort: 'weekreview', datum: m, data: { afgerondOp: om(plusDagen(m, 4), 15, 40), gedeeld: m === vorige, besluiten: {} }, bijgewerkt_op: om(plusDagen(m, 4), 15, 40) })), 'on conflict do nothing')

  const scripts = (await client.query(`select id, naam, doel, status, versie, data, startset from belscripts where organisation_id = $1 and startset in ('start-1', 'start-4') and status = 'actief' order by startset`, [orgId])).rows as (Belscript & { startset: string })[]
  const koud = scripts.find((s) => s.startset === 'start-1')
  const metAanleiding = scripts.find((s) => s.startset === 'start-4') ?? koud
  const invullingen: Record<string, unknown>[] = []
  const versies: Record<string, unknown>[] = []
  if (koud) {
    for (const e of evs.filter((x) => x.soort === 'gebeld' && x.uitkomst === 'afspraak')) {
      const a = accVan.get(e.acc)!
      const wp = a.branche === 'br-04' ? ['Levering op het uur', 'Levering op het uur: onderdelen op de afgesproken tijd op de bouw, ook bij spoed.'] : ['Gratis projectschouw binnen 48 uur', 'Gratis projectschouw binnen 48 uur: binnen 48 uur komt een specialist gratis op de bouw kijken en maakt een leverplan per bouwfase.']
      invullingen.push({ organisation_id: orgId, belscript_id: koud.id, versie: koud.versie, account_id: a.id, contact_id: a.contacten[0]!.id, op: opVan(e),
        data: { winpunt: { titel: wp[0], tekst: wp[1], bronnen: [{ soort: 'winpunt', citaat: wp[0] }] }, ...(a.aanleiding ? { aanleiding: { tekst: `Ik bel je naar aanleiding van dit: ${a.aanleiding.tekst.toLowerCase()}.`, bronnen: [{ soort: 'aanleiding', citaat: a.aanleiding.tekst }] } } : {}) } })
    }
    const VOOR: Record<string, string> = {
      opening: 'Goedemorgen {contact.voornaam}, met Eva van Voltvast. Ik bel je omdat {bedrijf} veel {focus} doet rond {plaats}.',
      aanleiding: 'Ik zag dat jullie {aanleiding}. Dan wordt de planning op de bouw vaak krapper.',
      toestemming: 'Heb je twee minuten, of bel ik je liever op een ander moment?',
      vragen: 'Hoe vaak staan jullie monteurs nu te wachten op materiaal? En wie regelt bij jullie de levering per project?',
      winpunt: 'Wij komen binnen 48 uur gratis op de bouw kijken en maken een leverplan per bouwfase.',
      afsluiting: 'Zullen we volgende week een kwartier inplannen om dat voor jullie volgende project uit te werken?',
      voicemail: 'Hoi {contact.voornaam}, Eva van Voltvast. Ik bel over levering per bouwfase voor {bedrijf}. Ik probeer het later nog eens.',
      poortwachter: 'Ik zoek degene die over de levering van materiaal op de bouw gaat. Ben jij dat, of kun je me doorverbinden?',
      vrij: 'Andere installateurs in de regio vertellen dat vaste levermomenten ze uren per week schelen.',
    }
    const kandidatenScript = accs.filter((a) => actief(a) && ['gekwalificeerd', 'benaderd', 'in-gesprek', 'afspraak-gepland'].includes(a.fase!)).slice(0, 14)
    for (const [i, a] of kandidatenScript.entries()) {
      const script = a.aanleiding && metAanleiding ? metAanleiding : koud
      const c = a.contacten[0]!
      const gegevens = prospectGegevens({ aanleiding: a.aanleiding ? { tekst: a.aanleiding.tekst, bron: a.aanleiding.bron, op: uurGeleden(a.aanleiding.dagen * 24) } : null, branche: { naam: BRANCHE_NAAM[a.branche]!, kernzin: 'Levering per bouwfase, zodat je monteurs niet wachten.' }, leverancier: a.leverancier ? { naam: LEVERANCIER[a.leverancier]! } : null,
        winpunt: { titel: 'Gratis projectschouw binnen 48 uur', argument: 'Binnen 48 uur een leverplan per bouwfase' }, contact: { naam: `${c.voor} ${c.achter}`, functie: c.functie, rol: c.rol }, agendaGekoppeld: false })
      const w = { bedrijf: a.naam, focus: FOCUS[a.branche]!, plaats: a.plaats, aanleiding: (a.aanleiding?.tekst ?? 'groeien in het aantal projecten').toLowerCase() }
      const ai = Object.fromEntries(aiBlokkenVan(script).map((b) => [b.id, { tekst: vul(VOOR[b.soort] ?? VOOR.vrij!, w) }]))
      const concept = prospectConcept(script, gegevens, ai)
      const aantalVersies = i % 4 === 0 ? 2 : 1
      for (let v = 1; v <= aantalVersies; v++) {
        const besluiten = concept.blokken.filter((b) => b.status === 'voorgesteld').map((b, j) => ({ id: b.id, status: (j === 2 && v === 1 ? 'verworpen' : 'bevestigd') as 'bevestigd' | 'verworpen', tekst: j === 0 && v === 2 ? `${b.tekst} Ik houd het kort.` : null }))
        const b = beslisProspect(concept.blokken, besluiten)
        const op = om(wd(-tussen(r, 1, 20) + (v - 1)), 8, 40 + v)
        versies.push({ id: `eva-bpv-${a.id.slice(-3)}-${v}`, organisation_id: orgId, account_id: a.id, contact_id: c.id, gebruiker_id: EVA, belscript_id: script.id, script_versie: script.versie, status: 'bewaard', versie: v, data: { ...concept, blokken: b.blokken }, samenvatting: prospectSamenvatting(b.blokken, b.aangepast), created_at: op, bewaard_op: op })
      }
    }
  }
  await zet(client, 'belscript_invullingen', invullingen)
  await zet(client, 'belscript_prospectversies', versies)
  const mailAcc = accs.filter((a) => a.fase === 'in-gesprek' && actief(a)).slice(0, 3)
  await zet(client, 'inkomende_mails', mailAcc.map((a, i) => ({ id: `eva-im-${i + 1}`, organisation_id: orgId, bericht_id: `<eva-${a.id}-${i}@${a.domein}>`, van: a.contacten[0]!.email, onderwerp: i === 2 ? 'Automatisch antwoord: afwezig' : i ? 'Re: Levering per bouwfase' : 'Re: Informatie over de projectapp',
    fragment: i === 2 ? 'Ik ben tot en met vrijdag afwezig en lees mijn mail daarna.' : 'Dank voor de informatie. Kunnen we volgende week even bellen over de planning?', ontvangen_op: om(wd(-tussen(r, 1, 6)), 10, 12 + i), bron: 'mock', account_id: a.id, contact_id: null, reeks_id: null, verwerking: i === 2 ? 'auto-antwoord' : 'geen-reeks' })))

  return { accounts: nAccounts, contacten: nContacten, activiteiten: nActiviteiten + reeksActs.length, taken: nTaken, afspraken: nAfspraken, belblokken: nSessies + geplandeSessies.length, inzichten: nInzichten, reeksen: reeksRijen.length }
}
