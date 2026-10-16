// Testgebruiker Eva Ervaren (u-07, binnendienst, Expert): een gevulde werkplek voor de komende vier
// weken. Alles is fictief en relatief aan het moment van seeden: eigen accounts (Testwarmte,
// Testtechniek, Testvloer, Testzon, Testwater) in elke fase van de prospectreis met contactpersonen
// en reisgeschiedenis, activiteiten van de afgelopen vier weken, taken van vandaag tot over vier weken
// (plus achterstallige), afspraken in de agenda, vaste en geplande belblokken, inzichten (met een
// aanleiding van de dag), concepten ter goedkeuring, meldingen, een campagne waar ze aan meedoet,
// kansen die ze klaarzette voor de regiodag van de buitendienst en een coachingsessie.
//
// Bewust buiten de bestaande testsets gehouden: geen grote prospects (klasse A of B) en geen taken of
// activiteiten op de planningstestset (pl-..), geen belblok dat klaar is op het moment van een vast
// blok, niets tussen 12:00 en 12:30 en op dinsdag niets tussen 14:00 en 15:00 (de mock van de
// agendakoppeling), en namen die achter "Testplanning" sorteren. Idempotent: vaste id's, on conflict
// do nothing.
import type pg from 'pg'
import { blokResultaat, type Gesprek, type VastBlok } from '../../shared/belblokken'
import { CAMPAGNESOORTEN_START } from '../../shared/campagnes'
import { isWerkdag, nlMoment, nlTijdstip, plusDagen, weekdag, type WerkdagInstelling } from '../../shared/datum'
import { kiesRitme, startRitme, type Ritme } from '../../shared/hercontact'
import { afkoelingVoorNee } from '../../shared/nbStatus'
import { standaardReisId } from '../../shared/reis'
import { berekenScore, laatsteContact } from '../../shared/score'

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

interface EvaAccount {
  id: string; naam: string; kind: 'prospect' | 'klant'; fase: Fase | null; sinds: number; klasse: string | null; branche: string
  plaats: string; postcode: string; adres: string; lat: number; lng: number; monteurs: number; segment: string
  aanleiding?: { tekst: string; dagen: number; heet?: boolean; bron: string }
  /** Het pad door de reis tot de huidige fase (alleen bij geparkeerd en verloren afwijkend). */
  tot?: Fase
  contacten: [string, string, string, string][]
}

// Regio Midden (postcodes 3500 tot 3999), de regio waar Eva binnendienst-eigenaar is.
const ACCOUNTS: EvaAccount[] = [
  { id: 'eva-a01', naam: 'Testwarmte Eemland', kind: 'prospect', fase: 'gevonden', sinds: -1, klasse: null, branche: 'br-01', plaats: 'Amersfoort', postcode: '3812 AB', adres: 'Proefstraat 4', lat: 52.163, lng: 5.392, monteurs: 14, segment: 'installateur',
    aanleiding: { tekst: 'Nieuw in het bestand na de beursaanmelding', dagen: 2, bron: 'import' }, contacten: [['Anke', 'Testeemland', 'Directeur', 'beslisser']] },
  { id: 'eva-a02', naam: 'Testtechniek Heuvelrug', kind: 'prospect', fase: 'dossier-compleet', sinds: -3, klasse: null, branche: 'br-02', plaats: 'Driebergen', postcode: '3971 KL', adres: 'Voorbeeldlaan 22', lat: 52.052, lng: 5.281, monteurs: 24, segment: 'installateur',
    contacten: [['Daan', 'Testheuvel', 'Directeur', 'beslisser'], ['Iris', 'Testheuvel', 'Werkvoorbereider', 'beinvloeder']] },
  { id: 'eva-a03', naam: 'Testvloer Soest', kind: 'prospect', fase: 'gekwalificeerd', sinds: -6, klasse: null, branche: 'br-01', plaats: 'Soest', postcode: '3762 CD', adres: 'Testweg 9', lat: 52.173, lng: 5.291, monteurs: 9, segment: 'installateur',
    contacten: [['Frank', 'Testvloer', 'Eigenaar', 'beslisser'], ['Lotte', 'Testvloer', 'Planner', 'gebruiker']] },
  { id: 'eva-a04', naam: 'Testzon Veenendaal', kind: 'prospect', fase: 'benaderd', sinds: -12, klasse: 'kl-c-prospects', branche: 'br-04', plaats: 'Veenendaal', postcode: '3902 EF', adres: 'Zonnehof 3', lat: 52.028, lng: 5.558, monteurs: 18, segment: 'zonnepanelen',
    aanleiding: { tekst: 'Won een aanbesteding voor zonnedaken op scholen', dagen: 1, heet: true, bron: 'web' }, contacten: [['Roos', 'Testzonneveld', 'Directeur', 'beslisser'], ['Stijn', 'Testzonneveld', 'Projectleider', 'champion']] },
  { id: 'eva-a05', naam: 'Testwarmtepomp Zeist', kind: 'prospect', fase: 'benaderd', sinds: -16, klasse: 'kl-c-prospects', branche: 'br-01', plaats: 'Zeist', postcode: '3703 GH', adres: 'Proeflaan 15', lat: 52.089, lng: 5.233, monteurs: 21, segment: 'installateur',
    contacten: [['Karel', 'Testpomp', 'Directeur', 'beslisser'], ['Noor', 'Testpomp', 'Inkoper', 'poortwachter'], ['Gijs', 'Testpomp', 'Servicemonteur', 'gebruiker']] },
  { id: 'eva-a06', naam: 'Testtechniek Vathorst', kind: 'prospect', fase: 'in-gesprek', sinds: -9, klasse: 'kl-c-prospects', branche: 'br-02', plaats: 'Amersfoort', postcode: '3825 JK', adres: 'Vathorsterweg 30', lat: 52.192, lng: 5.418, monteurs: 32, segment: 'installateur',
    aanleiding: { tekst: 'Zoekt twee werkvoorbereiders', dagen: 0, heet: true, bron: 'web' }, contacten: [['Martijn', 'Testvathorst', 'Directeur', 'beslisser'], ['Petra', 'Testvathorst', 'Werkvoorbereider', 'champion']] },
  { id: 'eva-a07', naam: 'Testtechniek Leusden', kind: 'prospect', fase: 'afspraak-gepland', sinds: -6, klasse: 'kl-c-prospects', branche: 'br-01', plaats: 'Leusden', postcode: '3832 LM', adres: 'Testsingel 7', lat: 52.132, lng: 5.429, monteurs: 27, segment: 'installateur',
    contacten: [['Corine', 'Testleusden', 'Directeur', 'beslisser'], ['Olaf', 'Testleusden', 'Projectleider', 'beinvloeder']] },
  { id: 'eva-a08', naam: 'Testwarmte De Bilt', kind: 'prospect', fase: 'afspraak-gepland', sinds: -4, klasse: 'kl-c-prospects', branche: 'br-02', plaats: 'De Bilt', postcode: '3731 NP', adres: 'Voorbeeldplein 2', lat: 52.110, lng: 5.181, monteurs: 40, segment: 'installateur',
    contacten: [['Hanneke', 'Testbilt', 'Directeur', 'beslisser'], ['Bas', 'Testbilt', 'Werkvoorbereider', 'gebruiker']] },
  { id: 'eva-a09', naam: 'Testvloer Houten', kind: 'prospect', fase: 'afspraak-gehouden', sinds: -2, klasse: 'kl-c-prospects', branche: 'br-01', plaats: 'Houten', postcode: '3992 RS', adres: 'Testlaan 8', lat: 52.033, lng: 5.168, monteurs: 16, segment: 'installateur',
    contacten: [['Els', 'Testhouten', 'Directeur', 'beslisser'], ['Joost', 'Testhouten', 'Projectleider', 'champion']] },
  { id: 'eva-a10', naam: 'Testzon Utrecht', kind: 'prospect', fase: 'overgedragen', sinds: -7, klasse: 'kl-c-prospects', branche: 'br-04', plaats: 'Utrecht', postcode: '3521 TV', adres: 'Proefkade 11', lat: 52.090, lng: 5.121, monteurs: 35, segment: 'zonnepanelen',
    contacten: [['Tamara', 'Testzon', 'Directeur', 'beslisser'], ['Quinten', 'Testzon', 'Inkoper', 'beinvloeder']] },
  { id: 'eva-a11', naam: 'Testwater Baarn', kind: 'prospect', fase: 'geparkeerd', tot: 'benaderd', sinds: -9, klasse: 'kl-c-prospects', branche: 'br-02', plaats: 'Baarn', postcode: '3742 WX', adres: 'Waterweg 5', lat: 52.211, lng: 5.288, monteurs: 12, segment: 'installateur',
    aanleiding: { tekst: 'Neemt een sectorgenoot in Hilversum over', dagen: 6, bron: 'web' }, contacten: [['Bas', 'Testwater', 'Eigenaar', 'beslisser']] },
  { id: 'eva-a12', naam: 'Testkoeling Bunnik', kind: 'prospect', fase: 'verloren', tot: 'afspraak-gepland', sinds: -11, klasse: 'kl-c-prospects', branche: 'br-01', plaats: 'Bunnik', postcode: '3981 YZ', adres: 'Testdreef 19', lat: 52.067, lng: 5.198, monteurs: 22, segment: 'installateur',
    contacten: [['Joost', 'Testbunnik', 'Directeur', 'beslisser'], ['Anke', 'Testbunnik', 'Inkoper', 'poortwachter']] },
  { id: 'eva-k01', naam: 'Testwarmte Harderwijk', kind: 'klant', fase: null, sinds: -60, klasse: null, branche: 'br-01', plaats: 'Harderwijk', postcode: '3841 AA', adres: 'Klantweg 1', lat: 52.342, lng: 5.620, monteurs: 28, segment: 'installateur',
    contacten: [['Lotte', 'Testharder', 'Inkoper', 'beslisser'], ['Daan', 'Testharder', 'Magazijnchef', 'gebruiker']] },
]

const domeinVan = (naam: string) => `${naam.toLowerCase().replace(/[^a-z]+/g, '-')}.test`
/** Twee cijfers per account voor een fictief nummer +316120xxxxx (de klant krijgt 90). */
const nummer = (id: string) => (id.startsWith('eva-k') ? '90' : id.slice(-2))

export async function seedEva(client: pg.Client, orgId: string, nu = new Date()) {
  // ── Datums: werkdagen relatief aan vandaag (of de eerstvolgende werkdag in het weekend) ──
  const echt = nlMoment(nu).datum
  let vandaag = echt
  while (!isWerkdag(vandaag, INST)) vandaag = plusDagen(vandaag, 1)
  const wd = (n: number) => {
    let d = vandaag
    let k = 0
    while (k < Math.abs(n)) { d = plusDagen(d, n < 0 ? -1 : 1); if (isWerkdag(d, INST)) k++ }
    return d
  }
  /** Een starttijd die niet botst met de lunch (12:00 tot 12:30) of het externe overleg op dinsdag (14:00 tot 15:00). */
  const veilig = (dag: string, uur: number, minuut: number, duur: number): [number, number] => {
    let s = uur * 60 + minuut
    const raakt = (van: number, tot: number) => s < tot && s + duur > van
    if (raakt(12 * 60, 12 * 60 + 30)) s = 13 * 60
    if (weekdag(dag) === 2 && raakt(14 * 60, 15 * 60)) s = 15 * 60 + 15
    return [Math.floor(s / 60), s % 60]
  }
  const om = (dag: string, uur: number, minuut = 0) => nlTijdstip(dag, uur, minuut).toISOString()
  const uurGeleden = (u: number) => new Date(nu.getTime() - u * 3600_000).toISOString()
  const reisId = standaardReisId(orgId)

  // ── Accounts, contactpersonen, activiteiten en de prospectreis ──
  // [account, werkdag, uur, soort, uitkomst, contact (index) of null, tekst]
  const ACT: [string, number, number, string, string | null, number | null, string | null][] = [
    ['eva-a02', -3, 10, 'notitie', null, null, 'Dossier compleet: 24 monteurs, vooral utiliteitsbouw in de regio.'],
    ['eva-a03', -6, 11, 'notitie', null, null, 'Gekwalificeerd: past bij installatiebedrijven woningbouw, eigenaar beslist zelf.'],
    ['eva-a04', -14, 9.5, 'gebeld', 'geen_reactie', null, null],
    ['eva-a04', -13, 10, 'gebeld', 'voicemail', 0, null],
    ['eva-a04', -12, 9, 'mail', 'verzonden', 0, null],
    ['eva-a04', -8, 15.5, 'linkedin', 'verzonden', 1, null],
    ['eva-a05', -16, 9.25, 'gebeld', 'geen_reactie', null, null],
    ['eva-a05', -13, 11, 'mail', 'verzonden', 0, null],
    ['eva-a05', -10, 9.5, 'gebeld', 'later', 1, 'Inkoop vraagt terug te bellen als de servicecontracten zijn doorgelicht.'],
    ['eva-a05', -5, 15.25, 'gebeld', 'geen_reactie', null, null],
    ['eva-a06', -18, 9.75, 'gebeld', 'voicemail', null, null],
    ['eva-a06', -15, 10.5, 'gebeld', 'later', 1, 'Werkvoorbereider wil eerst intern overleggen.'],
    ['eva-a06', -9, 9.25, 'gebeld', 'later', 0, 'Gesproken met de directeur: monteurs wachten vaak op materiaal. Wil een voorstel voor levering per bouwfase.'],
    ['eva-a06', -5, 11, 'mail', 'verzonden', 0, null],
    ['eva-a06', -1, 13, 'gebeld', 'geen_reactie', null, null],
    ['eva-a07', -17, 9.5, 'gebeld', 'geen_reactie', null, null],
    ['eva-a07', -12, 10.25, 'gebeld', 'later', 1, 'Projectleider verwijst naar de directeur.'],
    ['eva-a07', -6, 9.75, 'gebeld', 'afspraak', 0, 'Kennismaking ingepland; wil levering per bouwfase bespreken.'],
    ['eva-a07', -2, 10, 'mail', 'verzonden', 0, null],
    ['eva-a08', -19, 9, 'gebeld', 'voicemail', null, null],
    ['eva-a08', -14, 14.5, 'gebeld', 'later', 1, 'Werkvoorbereider is positief, directeur beslist.'],
    ['eva-a08', -4, 10.75, 'gebeld', 'afspraak', 0, 'Afspraak gemaakt: eerst online kennismaken, daarna een inventarisatie op locatie.'],
    ['eva-a09', -20, 9.25, 'gebeld', 'geen_reactie', null, null],
    ['eva-a09', -15, 9.75, 'gebeld', 'afspraak', 0, 'Directeur wil kennismaken over de twee nieuwbouwprojecten.'],
    ['eva-a09', -2, 13.75, 'notitie', null, null, 'Kennismaking gehouden: twee nieuwbouwprojecten in 2027, vervolg met een projectschouw op locatie.'],
    ['eva-a10', -19, 10.5, 'gebeld', 'afspraak', 0, 'Afspraak voor een inventarisatie op locatie.'],
    ['eva-a10', -8, 14.25, 'notitie', null, null, 'Inventarisatie gehouden; vervolgstap is een leverplan. Overgedragen aan de buitendienst.'],
    ['eva-a11', -20, 10, 'gebeld', 'geen_reactie', null, null],
    ['eva-a11', -17, 9.5, 'mail', 'verzonden', 0, null],
    ['eva-a11', -13, 9.25, 'gebeld', 'voicemail', 0, null],
    ['eva-a11', -10, 15.75, 'gebeld', 'geen_reactie', null, null],
    ['eva-a12', -20, 11, 'gebeld', 'afspraak', 0, 'Kennismaking ingepland.'],
    ['eva-a12', -12, 13.75, 'notitie', null, null, 'Kennismaking gehouden: tevreden met de huidige groothandel.'],
    ['eva-a12', -11, 10, 'gebeld', 'geen_interesse', 0, 'Geen interesse: tevreden met de huidige leverancier.'],
    ['eva-k01', -7, 10.25, 'gebeld', 'later', 0, 'Klant vraagt naar de levertijden voor de winter.'],
  ]
  const KANAAL: Record<string, string | null> = { gebeld: 'bellen', mail: 'mail', linkedin: 'linkedin', notitie: null }

  const ritmes = (await client.query(`select id, naam, bron, status, data from hercontactritmes where organisation_id = $1`, [orgId])).rows
    .map((r: any) => ({ id: r.id, naam: r.naam, bron: r.bron, status: r.status, werkplek: r.data.werkplek, stappen: r.data.stappen, parkeerDagen: r.data.parkeerDagen })) as Ritme[]

  let nAccounts = 0
  let nContacten = 0
  for (const a of ACCOUNTS) {
    const domein = domeinVan(a.naam)
    const contacten = a.contacten.map(([voor, achter, functie, rol], i) => ({
      id: `${a.id}-c${i + 1}`, voor, achter, functie, rol, email: `${voor.toLowerCase()}@${domein}`,
      telefoon: `+316120${nummer(a.id)}${String(i + 1).padStart(3, '0')}`,
    }))
    const acts = ACT.filter((x) => x[0] === a.id).map(([, d, uur, soort, uitkomst, ci, tekst], i) => ({
      id: `${a.id}-act${String(i + 1).padStart(2, '0')}`, op: om(wd(d), Math.floor(uur), Math.round((uur % 1) * 60)), soort, uitkomst, contactId: ci === null ? null : contacten[ci]?.id ?? null, tekst,
    }))
    const sindsDag = wd(a.sinds)
    const sinds = om(sindsDag, 9)
    const lc = laatsteContact(acts.map((x) => ({ soort: x.soort, op: x.op, status: 'afgerond' })), nu)
    const aanleiding = a.aanleiding ? { tekst: a.aanleiding.tekst, op: new Date(nu.getTime() - a.aanleiding.dagen * 864e5 - 3 * 3600e3).toISOString(), heet: !!a.aanleiding.heet, bron: a.aanleiding.bron } : null
    const s = berekenScore({ nu, contacten: contacten.map((c) => ({ rol: c.rol, status: 'actief', telefoon: c.telefoon, email: c.email })), laatsteContactOp: lc, aanleidingen: aanleiding ? [aanleiding] : [] })
    const data: Record<string, unknown> = {
      website: `https://${domein}`, telefoon: `+316120${nummer(a.id)}000`, adres: a.adres, provincie: a.plaats === 'Harderwijk' ? 'Gelderland' : 'Utrecht',
      customFields: { aantal_monteurs: a.monteurs, segment: a.segment }, scoreOpbouw: s.opbouw, herkomst: { seed: 'eva' },
      ...(aanleiding ? { aanleiding } : {}),
    }
    let terugOp: string | null = null
    if (a.fase === 'geparkeerd') {
      terugOp = vandaag
      Object.assign(data, { wachtendTot: vandaag, terugkom: { datum: vandaag, regelId: null, reden: 'Geen reactie na laatste poging', aanpak: 'Bel met de overname als aanleiding', kanaal: 'bellen' } })
    }
    if (a.fase === 'verloren') {
      const reden = 'Tevreden met huidige leverancier'
      terugOp = wd(65)
      Object.assign(data, { nee: { reden, op: om(wd(-11), 10, 15), door: EVA, afkoeling: afkoelingVoorNee(reden) }, terugkom: { datum: terugOp, regelId: null, reden, aanpak: 'Heropvolging zonder druk', kanaal: 'bellen' } })
    }
    if (a.fase === 'gekwalificeerd') {
      const r = kiesRitme(ritmes, 'koud', 'binnendienst')
      if (r) data.reis = { ritme: startRitme(r, new Date(sinds)) }
    }
    const status = a.kind === 'klant' ? 'klant' : STATUS[a.fase!]
    const res = await client.query(
      `insert into accounts (id, organisation_id, name, account_kind, klasse, owner_id, nb_status, reis_id, fase_id, fase_sinds, score, laatste_contact_op, city, postcode, domein, lat, lng, nb_bron, vv_branche_id, gebied_id, terug_op, data)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'seed', $18, 'regio-midden', $19, $20) on conflict do nothing`,
      [a.id, orgId, a.naam, a.kind, a.klasse, EVA, status, a.kind === 'prospect' ? reisId : null, a.fase, sinds, s.score, lc, a.plaats, a.postcode, domein, a.lat, a.lng, a.branche, terugOp, JSON.stringify(data)],
    )
    if (!res.rowCount) continue
    nAccounts++
    for (const c of contacten) {
      await client.query(`insert into contacts (id, organisation_id, account_id, first_name, last_name, email, rol, status, data) values ($1, $2, $3, $4, $5, $6, $7, 'actief', $8) on conflict do nothing`,
        [c.id, orgId, a.id, c.voor, c.achter, c.email, c.rol, JSON.stringify({ functie: c.functie, telefoon: c.telefoon, consent: { email: { status: c.rol === 'beslisser' ? 'gegeven' : 'onbekend' }, whatsapp: { status: 'onbekend' } } })])
      nContacten++
    }
    for (const x of acts) {
      await client.query(`insert into activiteiten (id, organisation_id, account_id, contact_id, soort, kanaal, uitkomst, door, op, data) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) on conflict do nothing`,
        [x.id, orgId, a.id, x.contactId, x.soort, KANAAL[x.soort] ?? null, x.uitkomst, EVA, x.op, JSON.stringify({ seed: 'eva', ...(x.tekst ? { tekst: x.tekst } : {}) })])
    }
    // De reis: van Gevonden tot de huidige fase, een stap per paar werkdagen.
    if (a.kind === 'prospect' && a.fase) {
      const tot = a.tot ?? a.fase
      const pad: Fase[] = [...PAD.slice(0, PAD.indexOf(tot) + 1), ...(a.tot ? [a.fase] : [])]
      const eind = a.fase === 'overgedragen' || a.fase === 'verloren'
      const ops = pad.map((_, j) => om(wd(a.sinds - (pad.length - 1 - j) * 2), 9, 30 + j))
      ops[ops.length - 1] = sinds
      await client.query(`insert into prospectreizen (id, organisation_id, reistemplate_id, template_versie, account_id, fase_id, nb_status, fase_sinds, gestart_op, afgerond_op) values ($1, $2, $3, 1, $4, $5, $6, $7, $8, $9) on conflict do nothing`,
        [`${a.id}-reis`, orgId, reisId, a.id, a.fase, status, sinds, ops[0], eind ? sinds : null])
      for (const [j, f] of pad.entries()) {
        await client.query(`insert into reisgeschiedenis (id, organisation_id, account_id, prospectreis_id, versie, van_fase_id, naar_fase_id, van_status, naar_status, gebeurtenis, door, op, reden) values ($1, $2, $3, $4, 1, $5, $6, $7, $8, $9, $10, $11, $12) on conflict do nothing`,
          [`${a.id}-rg${j + 1}`, orgId, a.id, `${a.id}-reis`, j ? pad[j - 1] : null, f, j ? STATUS[pad[j - 1]!] : null, STATUS[f], GEBEURTENIS[f], j ? EVA : 'motor', ops[j],
            f === 'geparkeerd' ? 'Geen reactie na de laatste poging' : f === 'verloren' ? 'Tevreden met huidige leverancier' : null])
      }
    }
  }

  // ── Vaste belblokken (alleen als Eva ze nog niet zelf heeft ingesteld) ──
  const vast: VastBlok[] = [
    { id: 'vb-ochtend', dagen: [1, 2, 3, 4], start: '09:00', minuten: 90, plek: 'Kantoor', soort: 'koud', automatisch: true },
    { id: 'vb-middag', dagen: [1, 3, 4], start: '14:00', minuten: 60, plek: 'Kantoor', soort: 'opvolging', automatisch: false },
    { id: 'vb-vrijdag', dagen: [5], start: '10:00', minuten: 60, plek: 'Thuis', soort: 'gemengd', verhouding: 70, automatisch: false },
  ]
  await client.query(`update users set data = data || $2 where id = $1 and organisation_id = $3 and not (data ? 'belblokken')`,
    [EVA, JSON.stringify({ belblokken: { blokken: vast, voorkeuren: { lunch: { start: '12:00', minuten: 30 } } } }), orgId])

  // ── Belblok-sessies: gepland van vandaag tot over twee weken, klaar in de afgelopen weken ──
  type Sessie = { id: string; dag: string; uur: number; minuut: number; minuten: number; vastBlokId: string | null; soort: string; plek: string; status: 'gepland' | 'klaar'; handmatig?: boolean }
  const sessies: Sessie[] = []
  for (let n = 0; n <= 10; n++) {
    const dag = wd(n)
    const w = weekdag(dag)
    sessies.push(w === 5
      ? { id: `eva-bb-${String(n).padStart(2, '0')}v`, dag, uur: 10, minuut: 0, minuten: 60, vastBlokId: 'vb-vrijdag', soort: 'gemengd', plek: 'Thuis', status: 'gepland' }
      : { id: `eva-bb-${String(n).padStart(2, '0')}o`, dag, uur: 9, minuut: 0, minuten: 90, vastBlokId: 'vb-ochtend', soort: 'koud', plek: 'Kantoor', status: 'gepland' })
    if (n >= 1 && n <= 5 && [1, 3, 4].includes(w)) sessies.push({ id: `eva-bb-${String(n).padStart(2, '0')}m`, dag, uur: 14, minuut: 0, minuten: 60, vastBlokId: 'vb-middag', soort: 'opvolging', plek: 'Kantoor', status: 'gepland' })
  }
  {
    const [u, m] = veilig(vandaag, 15, 30, 60)
    sessies.push({ id: 'eva-bb-00h', dag: vandaag, uur: u, minuut: m, minuten: 60, vastBlokId: null, soort: 'gemengd', plek: 'Kantoor', status: 'gepland', handmatig: true })
  }
  // Gehouden blokken: bewust buiten de vaste tijden, zodat ze nooit samenvallen met een blok dat nog gepland wordt.
  const klaar: [number, number, number, string[], Gesprek['knop'][]][] = [
    [-1, 10, 45, ['eva-a06', 'eva-a04', 'eva-a11', 'eva-a05'], ['geen_gehoor', 'voicemail', 'geen_gehoor', 'later']],
    [-2, 15, 30, ['eva-a07', 'eva-a09', 'eva-a05'], ['later', 'afspraak', 'geen_gehoor']],
    [-4, 10, 45, ['eva-a08', 'eva-a06', 'eva-a12'], ['afspraak', 'later', 'geen_interesse']],
    [-6, 15, 30, ['eva-a07', 'eva-a04', 'eva-a11', 'eva-a10'], ['afspraak', 'voicemail', 'geen_gehoor', 'later']],
    [-9, 10, 45, ['eva-a06', 'eva-a05', 'eva-a08'], ['later', 'later', 'poortwachter']],
    [-11, 15, 30, ['eva-a12', 'eva-a04', 'eva-a11', 'eva-a07', 'eva-a09'], ['geen_interesse', 'geen_gehoor', 'voicemail', 'later', 'afspraak']],
  ]
  for (const [i, [d, uur, minuut]] of klaar.entries()) sessies.push({ id: `eva-bb-k${i + 1}`, dag: wd(d), uur, minuut, minuten: 60, vastBlokId: null, soort: 'gemengd', plek: 'Kantoor', status: 'klaar', handmatig: true })
  for (const s of sessies) {
    const start = nlTijdstip(s.dag, s.uur, s.minuut)
    const eind = new Date(start.getTime() + s.minuten * 60_000)
    const k = s.id.startsWith('eva-bb-k') ? klaar[Number(s.id.slice(8)) - 1]! : null
    const gesprekken = k ? k[3].map((acc, j) => {
      const rol = ACCOUNTS.find((a) => a.id === acc)?.contacten[0]?.[3] ?? null
      return { accountId: acc, contactRol: ['afspraak', 'later', 'geen_interesse'].includes(k[4][j]!) ? rol : null, knop: k[4][j]!, duurSec: [95, 240, 410, 180, 300][j % 5]!, geschatMin: 8, op: new Date(start.getTime() + j * 11 * 60_000).toISOString() }
    }) : []
    const data = { plek: s.plek, soort: s.soort, ...(s.soort === 'gemengd' ? { verhouding: 70 } : {}), scriptId: null, gesprekken, ...(s.handmatig ? { handmatig: true } : {}), ...(k ? { resultaat: blokResultaat(gesprekken as Gesprek[]) } : {}), herkomst: 'seed' }
    await client.query(`insert into belblok_sessies (id, organisation_id, gebruiker_id, vast_blok_id, start_op, eind_op, status, gestart_op, gestopt_op, data) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) on conflict do nothing`,
      [s.id, orgId, EVA, s.vastBlokId, start.toISOString(), eind.toISOString(), s.status, s.status === 'klaar' ? start.toISOString() : null, s.status === 'klaar' ? new Date(eind.getTime() - 5 * 60_000).toISOString() : null, JSON.stringify(data)])
  }
  const bestaandeSessies = new Set((await client.query(`select id from belblok_sessies where gebruiker_id = $1 and id like 'eva-bb-%'`, [EVA])).rows.map((r: any) => r.id as string))
  const sessieVan = (n: number, soort: 'ochtend' | 'middag' | 'handmatig') => {
    const s = soort === 'handmatig' ? sessies.find((x) => x.id === 'eva-bb-00h') : sessies.find((x) => x.dag === wd(n) && (soort === 'ochtend' ? ['vb-ochtend', 'vb-vrijdag'].includes(x.vastBlokId ?? '') : x.vastBlokId === 'vb-middag'))
    return s && bestaandeSessies.has(s.id) ? s : null
  }

  // ── Taken: vandaag, achterstallig en de komende vier weken ──
  // [id, werkdag, uur, minuut, soort, account, titel, prioriteit, data, belblok ('ochtend' | 'middag' | 'handmatig'), campagne]
  type T = [string, number, number, number, string, string | null, string, 'hoog' | 'middel' | 'laag', Record<string, unknown>, ('ochtend' | 'middag' | 'handmatig')?, string?]
  const TAKEN: T[] = [
    // Achterstallig
    ['eva-t01', -1, 14, 0, 'bellen', 'eva-a06', 'Bel terug over de levertijden', 'hoog', { waarom: 'De directeur vroeg vorige week om een terugbelmoment.', poging: { n: 3, van: 4, kanaal: 'bellen', vorige: 'mail' } }],
    ['eva-t02', -2, 10, 0, 'mailen', 'eva-a04', 'Stuur de referentie van het zonneproject in Zeist', 'middel', { waarom: 'Toegezegd in de voicemail.' }],
    ['eva-t03', -4, 16, 0, 'taak', 'eva-a10', 'Controleer of de buitendienst de overdracht heeft opgepakt', 'hoog', { waarom: 'Overgedragen zonder bevestiging.' }],
    // Vandaag
    ['eva-t04', 0, 8, 30, 'bellen', 'eva-a07', 'Bel om de afspraak van vanmiddag te bevestigen', 'hoog', { waarom: 'Eerste afspraak, nog niet bevestigd.' }],
    ['eva-t05', 0, 9, 0, 'bellen', 'eva-a01', 'Bel: eerste kennismaking', 'middel', { poging: { n: 1, van: 4, kanaal: 'bellen' }, waarom: 'Nieuw in het bestand na de beursaanmelding.' }, 'ochtend'],
    ['eva-t06', 0, 9, 0, 'bellen', 'eva-a02', 'Bel: eerste kennismaking met de aanleiding uit het dossier', 'middel', { poging: { n: 1, van: 4, kanaal: 'bellen' } }, 'ochtend'],
    ['eva-t07', 0, 9, 0, 'bellen', 'eva-a03', 'Bel: eerste poging uit het ritme', 'middel', { poging: { n: 1, van: 5, kanaal: 'bellen' } }, 'ochtend'],
    ['eva-t08', 0, 10, 45, 'mailen', 'eva-a06', 'Mail de samenvatting van het gesprek met de directeur', 'middel', { concept: { onderwerp: 'Levering per bouwfase', tekst: 'Hoi Martijn, zoals besproken: wij leveren per bouwfase op de bouwplaats, zodat je monteurs niet wachten. Zal ik een voorstel maken voor jullie volgende project?' }, waarom: 'De Schrijver zette een opvolgmail klaar.' }],
    ['eva-t09', 0, 11, 30, 'linkedin', 'eva-a04', 'LinkedIn: feliciteer met de gewonnen aanbesteding', 'middel', { waarom: 'Nieuwe aanleiding van gisteren.' }],
    ['eva-t10', 0, 13, 15, 'bericht', 'eva-a09', 'Bericht: bevestig de datum van de projectschouw', 'middel', {}],
    ['eva-t11', 0, 15, 30, 'bellen', 'eva-a05', 'Bel: tweede poging na de mail', 'middel', { poging: { n: 2, van: 4, kanaal: 'bellen', vorige: 'mail' } }, 'handmatig'],
    ['eva-t12', 0, 15, 30, 'bellen', 'eva-a11', 'Bel: komt vandaag terug uit de wachtstand', 'hoog', { waarom: 'Neemt een sectorgenoot over; nieuwe aanleiding.' }, 'handmatig'],
    ['eva-t13', 0, 15, 30, 'bellen', 'eva-k01', 'Bel: check de winterlevering', 'laag', {}, 'handmatig'],
    ['eva-t14', 0, 16, 30, 'taak', 'eva-a08', 'Leverplan klaarzetten voor de inventarisatie', 'middel', {}],
    // De komende vier weken
    ['eva-t15', 1, 9, 0, 'bellen', 'eva-a04', 'Bel: vraag naar de planning van de schooldaken', 'middel', {}, 'ochtend'],
    ['eva-t16', 1, 10, 45, 'bellen', 'eva-a01', 'Bel: tweede poging, vraag naar de werkvoorbereider', 'middel', { poging: { n: 2, van: 4, kanaal: 'bellen', vorige: 'bellen' } }],
    ['eva-t17', 1, 14, 30, 'mailen', 'eva-a03', 'Mail: uitleg over levering per bouwfase', 'middel', {}],
    ['eva-t18', 2, 9, 0, 'bellen', 'eva-a02', 'Bel: vervolg op de mail', 'middel', {}, 'ochtend'],
    ['eva-t19', 2, 11, 0, 'linkedin', 'eva-a05', 'LinkedIn: reageer op het bericht over warmtepomponderhoud', 'laag', {}],
    ['eva-t20', 2, 15, 30, 'taak', 'eva-a06', 'Leverplan voorbereiden voor het gesprek met de directeur', 'middel', {}],
    ['eva-t21', 3, 10, 45, 'bellen', 'eva-a11', 'Bel: nieuwe aanleiding na de overname', 'hoog', { poging: { n: 1, van: 3, kanaal: 'bellen' } }],
    ['eva-t22', 3, 16, 0, 'bericht', 'eva-a07', 'Bericht: stuur de samenvatting van de kennismaking', 'middel', {}],
    ['eva-t23', 4, 9, 0, 'taak', 'eva-a09', 'Route en materiaallijst klaarzetten voor de projectschouw', 'middel', {}],
    ['eva-t24', 4, 14, 15, 'mailen', 'eva-a05', 'Mail: nieuwsbrief warmtepompen met praktijkvoorbeeld', 'laag', { campagneId: 'cp-eva-01' }, undefined, 'cp-eva-01'],
    ['eva-t25', 5, 11, 15, 'mailen', 'eva-a02', 'Mail: eerste kennismaking met de aanleiding uit het dossier', 'middel', {}],
    ['eva-t26', 5, 15, 30, 'bellen', 'eva-k01', 'Bel: bestelling voor het nieuwe project afstemmen', 'laag', {}],
    ['eva-t27', 6, 10, 45, 'linkedin', 'eva-a01', 'LinkedIn: connectieverzoek aan de directeur', 'laag', {}],
    ['eva-t28', 6, 16, 0, 'bezoek', 'eva-k01', 'Bezoek: monsters afgeven bij de nieuwe showroom', 'middel', {}],
    ['eva-t29', 7, 9, 30, 'bellen', 'eva-a04', 'Bel: derde poging, vraag naar de projectleider', 'middel', { poging: { n: 3, van: 4, kanaal: 'bellen', vorige: 'linkedin' } }],
    ['eva-t30', 7, 13, 30, 'mailen', 'eva-a04', 'Mail: nurture over levering op het uur', 'laag', { campagneId: 'cp-eva-01' }, undefined, 'cp-eva-01'],
    ['eva-t31', 8, 11, 0, 'taak', 'eva-a12', 'Notitie bijwerken: wat zou de overstap waard maken', 'laag', {}],
    ['eva-t32', 8, 15, 30, 'bericht', 'eva-a06', 'Bericht: deel de planning van de eerste levering', 'middel', {}],
    ['eva-t33', 9, 10, 45, 'bellen', 'eva-a03', 'Bel: tweede poging uit het ritme', 'middel', { poging: { n: 2, van: 5, kanaal: 'bellen', vorige: 'bellen' } }],
    ['eva-t34', 10, 14, 30, 'mailen', 'eva-a09', 'Mail: verslag van de projectschouw', 'middel', {}],
    ['eva-t35', 11, 11, 0, 'linkedin', 'eva-a08', 'LinkedIn: bedank voor de inventarisatie', 'laag', {}],
    ['eva-t36', 11, 15, 30, 'bellen', 'eva-a07', 'Bel: vervolg na de kennismaking', 'middel', {}],
    ['eva-t37', 12, 10, 0, 'bezoek', 'eva-a07', 'Bezoek: kennismaken op de bouwplaats met de buitendienst', 'middel', {}],
    ['eva-t38', 13, 13, 30, 'taak', null, 'Pijplijn bijwerken voor het weekoverleg', 'laag', {}],
    ['eva-t39', 14, 10, 45, 'bellen', 'eva-a05', 'Bel: vierde poging, sluit af met een voorstel', 'middel', { poging: { n: 4, van: 4, kanaal: 'bellen', vorige: 'mail' } }],
    ['eva-t40', 15, 14, 30, 'mailen', 'eva-a11', 'Mail: felicitatie met de overname', 'laag', {}],
    ['eva-t41', 16, 11, 15, 'bericht', 'eva-a09', 'Bericht: eerste levering ingepland?', 'laag', {}],
    ['eva-t42', 17, 15, 30, 'linkedin', 'eva-a02', 'LinkedIn: deel het praktijkvoorbeeld van de projectapp', 'laag', {}],
    ['eva-t43', 18, 10, 45, 'bellen', 'eva-a01', 'Bel: derde poging, vraag naar de planning van 2027', 'middel', { poging: { n: 3, van: 4, kanaal: 'bellen', vorige: 'linkedin' } }],
    ['eva-t44', 19, 13, 30, 'taak', 'eva-a12', 'Terugkomdatum controleren en aanleiding zoeken', 'laag', {}],
    ['eva-t45', 20, 11, 0, 'mailen', 'eva-a08', 'Mail: voorstel voor de eerste levering per bouwfase', 'middel', {}],
  ]
  let nTaken = 0
  for (const [id, d, uur, minuut, soort, account, titel, prio, data, blok, campagne] of TAKEN) {
    const dag = wd(d)
    const s = blok ? sessieVan(d, blok) : null
    const due = s ? om(s.dag, s.uur, s.minuut) : om(dag, uur, minuut)
    const r = await client.query(`insert into tasks (id, organisation_id, owner_id, account_id, action_type, title, status, priority, due_date, executor, belblok_id, campaign_id, data)
      values ($1, $2, $3, $4, $5, $6, 'open', $7, $8, 'mens', $9, $10, $11) on conflict do nothing`,
    [id, orgId, EVA, account, soort, titel, prio, due, s?.id ?? null, campagne ?? null, JSON.stringify({ ...data, ...(s ? { belblokId: s.id } : {}), herkomst: { bron: 'seed', actiesoort: soort, uitvoerder: EVA } })])
    nTaken += r.rowCount ?? 0
  }
  // Afgeronde taken van de afgelopen weken (voor de discipline in Mijn resultaten).
  const AF: [string, number, string, string, string, string][] = [
    ['eva-t90', -2, 'bellen', 'eva-a07', 'Bel: afspraak inplannen', 'afspraak'],
    ['eva-t91', -4, 'bellen', 'eva-a08', 'Bel: vervolg op de voicemail', 'afspraak'],
    ['eva-t92', -5, 'mailen', 'eva-a06', 'Mail: opvolging na het gesprek', 'verzonden'],
    ['eva-t93', -8, 'linkedin', 'eva-a04', 'LinkedIn: connectieverzoek', 'verzonden'],
  ]
  for (const [id, d, soort, account, titel, uitkomst] of AF) {
    await client.query(`insert into tasks (id, organisation_id, owner_id, account_id, action_type, title, status, priority, due_date, uitkomst, executor, data, updated_at)
      values ($1, $2, $3, $4, $5, $6, 'klaar', 'middel', $7, $8, 'mens', '{"herkomst": {"bron": "seed"}}', $7) on conflict do nothing`, [id, orgId, EVA, account, soort, titel, om(wd(d), 10), uitkomst])
  }

  // ── Afspraken in de agenda ──
  const ms = Object.fromEntries((await client.query(`select slug, id from meetingsoorten where organisation_id = $1`, [orgId])).rows.map((r: any) => [r.slug, r.id as string]))
  const volgendeMaandag = (() => { let d = wd(3); while (weekdag(d) !== 1 || !isWerkdag(d, INST)) d = plusDagen(d, 1); return d })()
  // [id, eigenaar, werkdag of datum, uur, minuut, duur, soort, vorm, account, status, data]
  type A = [string, string, number | string, number, number, number, string, 'bezoek' | 'online' | 'telefoon', string | null, string, Record<string, unknown>]
  const AFS: A[] = [
    // Vandaag
    ['eva-ap01', EVA, 0, 10, 45, 15, 'belafspraak', 'telefoon', 'eva-a05', 'gepland', { aanleiding: 'Terugbellen over de servicecontracten' }],
    ['eva-ap02', EVA, 0, 13, 30, 30, 'kennismaking', 'online', 'eva-a07', 'gepland', { aanleiding: 'Levering per bouwfase bespreken', eersteAfspraak: true }],
    ['eva-ap03', EVA, 0, 16, 45, 10, 'terugbelafspraak', 'telefoon', 'eva-a04', 'gepland', { aanleiding: 'Vraag over de aanbesteding van de schooldaken' }],
    // De komende vier weken
    ['eva-ap04', EVA, 1, 10, 45, 15, 'belafspraak', 'telefoon', 'eva-a06', 'gepland', { aanleiding: 'Doorpraten over de levertijden' }],
    ['eva-ap05', EVA, 3, 11, 0, 30, 'kennismaking', 'online', 'eva-a08', 'gepland', { aanleiding: 'Online kennismaken voor de inventarisatie', eersteAfspraak: true }],
    ['eva-ap06', EVA, 4, 10, 45, 60, 'inventarisatie', 'bezoek', 'eva-a09', 'gepland', { aanleiding: 'Gratis projectschouw op locatie', locatie: 'Testlaan 8, Houten' }],
    ['eva-ap07', EVA, 6, 15, 15, 10, 'terugbelafspraak', 'telefoon', 'eva-a05', 'gepland', { aanleiding: 'Na de doorlichting van de servicecontracten' }],
    ['eva-ap08', EVA, 9, 13, 0, 45, 'demo', 'online', 'eva-a09', 'gepland', { aanleiding: 'De projectapp laten zien met hun nieuwbouwproject' }],
    ['eva-ap09', EVA, 11, 10, 45, 15, 'belafspraak', 'telefoon', 'eva-k01', 'gepland', { aanleiding: 'Bestelling voor het voorjaar' }],
    ['eva-ap10', EVA, 13, 15, 15, 10, 'terugbelafspraak', 'telefoon', 'eva-a11', 'gepland', { aanleiding: 'Na de overname terugbellen' }],
    ['eva-ap11', EVA, 16, 13, 0, 45, 'demo', 'online', 'eva-a07', 'gepland', { aanleiding: 'Vervolg op de kennismaking: levering op het uur' }],
    ['eva-ap12', EVA, 18, 10, 45, 15, 'belafspraak', 'telefoon', 'eva-a04', 'gepland', { aanleiding: 'Planning van de zonnedaken' }],
    ['eva-ap13', EVA, 19, 13, 30, 60, 'inventarisatie', 'bezoek', 'eva-a06', 'gepland', { aanleiding: 'Magazijn en bouwplaats bekijken', locatie: 'Vathorsterweg 30, Amersfoort' }],
    // Voor de buitendienst (Bram, u-02) op zijn regiodag in Regio Midden, ingepland door Eva.
    ['eva-ap20', 'u-02', volgendeMaandag, 13, 0, 60, 'inventarisatie', 'bezoek', 'eva-a08', 'gepland', { aanleiding: 'Inventarisatie op locatie na de online kennismaking', locatie: 'Voorbeeldplein 2, De Bilt', briefing: 'Gepland door Eva: 40 monteurs, de werkvoorbereider wacht vaak op materiaal. Neem het leverplan per bouwfase mee.' }],
    // Afgelopen weken
    ['eva-ap30', EVA, -2, 13, 0, 30, 'kennismaking', 'online', 'eva-a09', 'afgerond', { uitkomst: 'vervolg', vervolgstap: 'Gratis projectschouw op locatie', winpuntUitgevoerd: true, verslag: { tekst: 'Twee nieuwbouwprojecten in 2027. De monteurs wachten nu vaak op materiaal. De directeur beslist samen met de projectleider.', bron: 'getypt', perAgendapunt: [] } }],
    ['eva-ap31', EVA, -5, 15, 15, 15, 'belafspraak', 'telefoon', 'eva-a05', 'niet_verschenen', { aanleiding: 'Terugbellen over de servicecontracten' }],
    ['eva-ap32', EVA, -8, 13, 0, 60, 'inventarisatie', 'bezoek', 'eva-a10', 'afgerond', { uitkomst: 'vervolg', overdragen: true, vervolgstap: 'Leverplan voor de zonnedaken', winpuntUitgevoerd: true, locatie: 'Proefkade 11, Utrecht', verslag: { tekst: 'Groeit hard in zonnedaken; wil vaste levermomenten. Overdragen aan de buitendienst.', bron: 'getypt', perAgendapunt: [] } }],
    ['eva-ap33', EVA, -12, 13, 0, 30, 'kennismaking', 'online', 'eva-a12', 'afgerond', { uitkomst: 'geen-vervolg', winpuntUitgevoerd: false, verslag: { tekst: 'Tevreden met de huidige groothandel; geen reden om te wisselen.', bron: 'getypt', perAgendapunt: [] } }],
  ]
  // Elke maandag het weekoverleg new business (intern, online).
  for (let n = 0, k = 0; n <= 20; n++) if (weekdag(wd(n)) === 1) AFS.push([`eva-ap-wo${++k}`, EVA, n, 8, 30, 30, 'weekoverleg', 'online', null, 'gepland', { aanleiding: 'Pijplijn van de week' }])
  let nAfspraken = 0
  for (const [id, eigenaar, wanneer, uur, minuut, duur, slug, vorm, account, status, data] of AFS) {
    if (!ms[slug]) continue
    const dag = typeof wanneer === 'number' ? wd(wanneer) : wanneer
    const [u, m] = slug === 'weekoverleg' ? [uur, minuut] : veilig(dag, uur, minuut, duur)
    const start = nlTijdstip(dag, u, m)
    const eind = new Date(start.getTime() + duur * 60_000)
    const contact = account ? `${account}-c1` : null
    const { uitkomst, ...rest } = data as { uitkomst?: string }
    const r = await client.query(`insert into appointments (id, organisation_id, owner_id, gepland_door, account_id, contact_id, meetingsoort_id, vorm, status, start_at, end_at, uitkomst_code, uitkomst_op, data)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) on conflict do nothing`,
    [id, orgId, eigenaar, EVA, account, contact, ms[slug], vorm, status, start.toISOString(), eind.toISOString(), uitkomst ?? null, uitkomst ? eind.toISOString() : null,
      JSON.stringify({ ...rest, herinnering: 15, ...(vorm === 'online' ? { meetinglink: `https://meet.voorbeeld.test/${id}` } : {}), herkomst: 'seed' })])
    nAfspraken += r.rowCount ?? 0
  }

  // ── Inzichten: een aanleiding van de dag (relevantie 92, vijf uur oud) en meer prospect-signalen ──
  // [id, account, type, titel, relevantie, uren geleden, status, bron, agent, waarom, citaat, bronnaam, voorstel]
  type S = [string, string, string, string, number, number, string, 'intern' | 'extern', string | null, string, string, string, string | null]
  const SIGNALEN: S[] = [
    ['eva-s01', 'eva-a06', 'vacature', 'Testtechniek Vathorst zoekt twee werkvoorbereiders', 92, 5, 'nieuw', 'extern', 'waarnemer', 'Groei in werkvoorbereiding betekent meer projecten tegelijk; levering per bouwfase scheelt dan wachttijd.', 'Wij zoeken per direct twee werkvoorbereiders voor onze groeiende projectenafdeling', 'Vacaturesite', 'Bel over de groei van het werkvoorbereidingsteam'],
    ['eva-s02', 'eva-a04', 'nieuws', 'Testzon Veenendaal wint aanbesteding zonnedaken op scholen', 81, 20, 'nieuw', 'extern', 'waarnemer', 'Een groot project met vaste opleverdata; levering op het uur past daarbij.', 'Testzon Veenendaal legt de komende twee jaar zonnedaken op twaalf scholen', 'Regionaal nieuws', 'Feliciteer en vraag naar de planning'],
    ['eva-s03', 'eva-a05', 'website', 'Nieuwe dienst op de website: onderhoud van warmtepompen', 72, 30, 'nieuw', 'extern', 'waarnemer', 'Een nieuwe servicedienst vraagt om snelle levering van onderdelen.', 'Vanaf nu ook onderhoud en storingsdienst voor warmtepompen', 'Website', null],
    ['eva-s04', 'eva-a03', 'kvk', 'Nieuwe vestiging ingeschreven in Amersfoort', 66, 40, 'nieuw', 'extern', 'waarnemer', 'Een tweede vestiging betekent een tweede magazijn en meer leveringen.', 'Inschrijving nevenvestiging Amersfoort', 'KvK', null],
    ['eva-s05', 'eva-a07', 'koopsignaal', 'Vroeg in de mail naar levering per bouwfase', 77, 44, 'nieuw', 'intern', 'notulist', 'De directeur noemde het zelf; neem het mee in de kennismaking van vanmiddag.', 'Kunnen jullie ook per bouwfase leveren?', 'Mail van de klant', null],
    ['eva-s06', 'eva-a09', 'koopsignaal', 'Koopsignaal: twee nieuwbouwprojecten in 2027', 70, 3 * 24, 'gelezen', 'intern', 'notulist', 'Uit het verslag van de kennismaking.', 'We starten volgend jaar met twee nieuwbouwprojecten', 'Verslag', null],
    ['eva-s07', 'eva-a11', 'nieuws', 'Testwater Baarn neemt sectorgenoot in Hilversum over', 68, 6 * 24, 'nieuw', 'extern', 'waarnemer', 'Na een overname veranderen inkoopafspraken vaak; een goed moment om terug te komen.', 'Testwater Baarn neemt per 1 januari een installatiebedrijf in Hilversum over', 'Regionaal nieuws', 'Bel met de overname als aanleiding'],
    ['eva-s08', 'eva-a02', 'aanbesteding', 'Ingeschreven op een aanbesteding voor utiliteitsbouw', 60, 9 * 24, 'gelezen', 'extern', 'waarnemer', 'Bij winst volgt een groot project in de regio.', 'Inschrijving installatiewerk nieuwbouw kantoor', 'Aanbestedingsplatform', null],
    ['eva-s09', 'eva-k01', 'website', 'Klant opent een nieuwe showroom', 55, 2 * 24 + 6, 'nieuw', 'extern', 'waarnemer', 'Kans om het assortiment voor de showroom te bespreken.', 'Bezoek onze nieuwe showroom in Harderwijk', 'Website', null],
  ]
  for (const [id, account, type, titel, rel, uren, status, bron, agent, waarom, citaat, bronNaam, voorstel] of SIGNALEN) {
    const op = uurGeleden(uren)
    const url = `https://${domeinVan(ACCOUNTS.find((a) => a.id === account)!.naam)}/${type}`
    const data = { agent, waarom, bewijs: [`"${citaat}" (${bronNaam}, ${op.slice(0, 10)})`], evidence: [{ citaat, bron: bronNaam, datum: op.slice(0, 10), url }], zekerheid: Math.min(95, rel), bron: { soort: type, naam: bronNaam, url, datum: op.slice(0, 10) },
      voorstel: voorstel ? { title: voorstel, actionType: 'bellen', priority: rel >= 80 ? 'hoog' : 'middel' } : null, winpuntVoorstel: null }
    await client.query(`insert into signals (id, organisation_id, account_id, owner_id, onderwerp, agent, type, title, relevance_score, confidence, status, bron, data, created_at, updated_at)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14) on conflict do nothing`,
    [id, orgId, account, EVA, `${type}:${id}`, agent, type, titel, rel, Math.min(95, rel) / 100, status, bron, JSON.stringify(data), op])
  }

  // ── Concepten ter goedkeuring (en een paar die al verstuurd zijn) ──
  const vv = Object.fromEntries((await client.query(`select onderdeel, versie from vv_sublagen where organisation_id = $1 and status = 'bevestigd'`, [orgId])).rows.map((r: any) => [r.onderdeel, r.versie]))
  const winpunt = (titel: string) => [{ soort: 'winpunt', titel }]
  // [id, account, handeling, status, overname, uren geleden, concept]
  const CONCEPTEN: [string, string, string, string, string | null, number, Record<string, unknown>][] = [
    ['cr-eva-01', 'eva-a06', 'pitstop:mail', 'klaar', null, 2, { type: 'mail', onderwerp: 'Levering per bouwfase', tekst: 'Hoi Martijn, ik zag dat jullie twee werkvoorbereiders zoeken. Meer projecten tegelijk betekent vaak meer wachten op materiaal. Wij leveren per bouwfase op de bouwplaats, zodat je monteurs door kunnen. Zal ik een voorstel maken voor jullie volgende project?', winpuntId: 'wp-01', bronnen: winpunt('Gratis projectschouw binnen 48 uur'), aanleiding: 'Vacature werkvoorbereider bij Testtechniek Vathorst' }],
    ['cr-eva-02', 'eva-a04', 'pitstop:linkedin', 'klaar', null, 5, { type: 'linkedin', tekst: 'Gefeliciteerd met de aanbesteding voor de schooldaken. Twaalf daken in twee jaar vraagt om een strakke planning. Zullen we kort bellen over levering op vaste momenten?', winpuntId: 'wp-02', bronnen: winpunt('Levering op het uur'), aanleiding: 'Aanbesteding zonnedaken gewonnen' }],
    ['cr-eva-03', 'eva-a09', 'pitstop:whatsapp', 'klaar', null, 3, { type: 'whatsapp', tekst: 'Goedemiddag, zullen we de projectschouw houden op de datum uit de agenda? Ik neem het leverplan per bouwfase mee.', winpuntId: 'wp-01', bronnen: winpunt('Gratis projectschouw binnen 48 uur'), aanleiding: 'Vervolg na de kennismaking' }],
    ['cr-eva-04', 'eva-a01', 'pitstop:mail', 'klaar', null, 26, { type: 'mail', onderwerp: 'Even voorstellen', tekst: 'Hoi Anke, jullie meldden je aan voor de beurs. Wij helpen installateurs met levering op het uur, zodat monteurs niet wachten. Past een kwartier volgende week?', winpuntId: 'wp-02', bronnen: winpunt('Levering op het uur'), aanleiding: 'Nieuw in het bestand na de beursaanmelding' }],
    ['cr-eva-05', 'eva-a08', 'pitstop:briefing', 'klaar', null, 6, { type: 'briefing', blokken: { opening: 'Je belde vorige week met de directeur; de werkvoorbereider wacht vaak op materiaal.', winpunt: 'Gratis projectschouw binnen 48 uur: laat zien wat levering per bouwfase oplevert.', doel: 'Een datum voor de inventarisatie op locatie.' }, winpuntId: 'wp-01', bronnen: winpunt('Gratis projectschouw binnen 48 uur'), aanleiding: 'Voorbereiding kennismaking' }],
    ['cr-eva-06', 'eva-a05', 'pitstop:mail', 'goedgekeurd', 'ongewijzigd', 22, { type: 'mail', onderwerp: 'Onderdelen voor jullie storingsdienst', tekst: 'Hoi Karel, ik zag dat jullie nu ook warmtepompen onderhouden. Wij leveren onderdelen op het uur, ook bij een storing. Zal ik je donderdag even bellen?', winpuntId: 'wp-02', bronnen: winpunt('Levering op het uur'), aanleiding: 'Nieuwe dienst op de website' }],
    ['cr-eva-07', 'eva-a07', 'pitstop:mail', 'verstuurd', 'ongewijzigd', 5 * 24, { type: 'mail', onderwerp: 'Bevestiging kennismaking', tekst: 'Hoi Corine, dank voor je tijd aan de telefoon. Ik heb de kennismaking ingepland en neem een voorbeeld van levering per bouwfase mee.', winpuntId: 'wp-01', bronnen: winpunt('Gratis projectschouw binnen 48 uur'), aanleiding: 'Afspraak gemaakt' }],
    ['cr-eva-08', 'eva-a06', 'pitstop:mail', 'verstuurd', 'aangepast', 9 * 24, { type: 'mail', onderwerp: 'Ons gesprek van vandaag', tekst: 'Hoi Martijn, zoals besproken stuur ik je een voorbeeld van een leverplan. Ik bel je volgende week om het door te nemen.', winpuntId: 'wp-03', bronnen: winpunt('Projectapp voor de installateur'), aanleiding: 'Gesprek met de directeur' }],
  ]
  for (const [id, account, handeling, status, overname, uren, concept] of CONCEPTEN) {
    const tekst = String(concept.tekst ?? Object.values((concept.blokken as Record<string, string>) ?? {}).join(' '))
    const woorden = tekst.split(/\s+/).filter(Boolean).length
    const op = uurGeleden(uren)
    await client.query(`insert into concepten (id, organisation_id, agent, handeling, gebruiker_id, account_id, concept, status, overname, op, besloten_op) values ($1, $2, 'schrijver', $3, $4, $5, $6, $7, $8, $9, $10) on conflict do nothing`,
      [id, orgId, handeling, EVA, account, JSON.stringify({ ...concept, stijlscore: 8, woorden, grens: concept.type === 'mail' ? 120 : 80, vvVersies: vv }), status, overname, op, status === 'klaar' ? null : new Date(Date.parse(op) + 3600e3).toISOString()])
  }

  // ── Meldingen ──
  const tijd = (iso: string) => new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }).format(new Date(iso))
  const afspraakTijd = async (id: string) => { const r = (await client.query(`select start_at from appointments where id = $1`, [id])).rows[0]; return r ? tijd(new Date(r.start_at).toISOString()) : '' }
  const MELDINGEN: [string, string, string, string, string, number, boolean][] = [
    ['m-eva-1', 'dagstart', 'Je dag staat klaar', `3 afspraken, 6 belacties. Eerst: je belblok om 09:00.`, '/', 1, false],
    ['m-eva-2', 'hot', 'Nieuwe aanleiding bij Testtechniek Vathorst', 'Vacature werkvoorbereider (relevantie 92).', '/acties?tab=inzichten&inzicht=eva-s01', 5, false],
    ['m-eva-3', 'kritiek', 'Afspraak vandaag nog niet bevestigd', `Kennismaking met Testtechniek Leusden om ${await afspraakTijd('eva-ap02')}.`, '/agenda', 3, false],
    ['m-eva-4', 'herinnering', 'Terugbellen: Testzon Veenendaal', `Vandaag ${await afspraakTijd('eva-ap03')}.`, '/agenda', 0.5, false],
    ['m-eva-5', 'inzicht', 'Concept klaar ter goedkeuring', 'Opvolgmail aan Testtechniek Vathorst.', '/concepten', 2, false],
    ['m-eva-6', 'herinnering', 'Testwater Baarn komt vandaag terug', 'Uit de wachtstand, met de overname als aanleiding.', '/accounts/eva-a11', 4, false],
    ['m-eva-7', 'systeem', 'Belblok gevuld', 'Je belblok van vandaag 09:00 heeft 3 gesprekken.', '/belblokken', 20, true],
    ['m-eva-8', 'inzicht', 'Coachingpunt gedeeld', 'Joost deelde een punt uit jullie gesprek.', '/resultaten', 6 * 24, true],
  ]
  for (const [id, soort, titel, tekst, link, uren, gelezen] of MELDINGEN) {
    const op = uurGeleden(uren)
    await client.query(`insert into notificaties (id, organisation_id, gebruiker_id, soort, titel, tekst, link, op, gelezen_op) values ($1, $2, $3, $4, $5, $6, $7, $8, $9) on conflict do nothing`,
      [id, orgId, EVA, soort, titel, tekst, link, op, gelezen ? new Date(Date.parse(op) + 1800e3).toISOString() : null])
  }

  // ── Een campagne waar Eva aan meedoet (eigenaar Joost, de items zijn van Eva) ──
  const nurture = CAMPAGNESOORTEN_START.find((s) => s.sleutel === 'nurture')
  if (nurture) {
    await client.query(`insert into campagnes (id, organisation_id, naam, soort, status, eigenaar_id, started_at, ends_at, data) values ('cp-eva-01', $1, 'Nurture warmtepompen Regio Midden', 'nurture', 'actief', 'u-04', $2, $3, $4) on conflict do nothing`,
      [orgId, wd(-10), wd(20), JSON.stringify({ winpuntId: 'wp-02', scriptId: null, boodschap: null, mailreeks: [], ritme: { bron: nurture.ritme, pogingen: nurture.pogingen }, tussendoelen: [], doel: nurture.standaardDoel, capaciteit: null, verdeling: null, brancheId: 'br-01', jaarkeuze: null, varianten: [], vvVersies: vv, bron: { soort: 'vrij' }, kanaalVia: 'direct', planStart: null })])
    const items: [string, string, number, string | null, number | null][] = [
      ['eva-a04', 'benaderd', 1, 'Nurturemail over levering op het uur', 7],
      ['eva-a05', 'in-gesprek', 2, 'Nieuwsbrief warmtepompen met praktijkvoorbeeld', 4],
      ['eva-a06', 'in-gesprek', 2, 'Belafspraak over de levertijden', 1],
      ['eva-a11', 'geparkeerd', 4, null, null],
      ['eva-a09', 'afspraak', 2, 'Projectschouw op locatie', 4],
    ]
    for (const [acc, kolom, poging, stap, n] of items) {
      await client.query(`insert into campagne_items (organisation_id, campagne_id, account_id, kolom, poging, volgende_stap, volgende_op, eigenaar_id, einddoel_gehaald, winpunt_uitgevoerd) values ($1, 'cp-eva-01', $2, $3, $4, $5, $6, $7, $8, $9) on conflict do nothing`,
        [orgId, acc, kolom, poging, stap, n === null ? null : om(wd(n), 10), EVA, kolom === 'afspraak', kolom === 'afspraak' ? true : null])
    }
  }

  // ── Kansen klaargezet voor de regiodag van Bram (buitendienst, Regio Midden) ──
  const KANSEN: [string, string, string][] = [
    ['kz-eva-1', 'eva-a03', 'Opent een tweede vestiging; wil iemand langs voor het magazijn'],
    ['kz-eva-2', 'eva-a02', 'Ingeschreven op een aanbesteding; directeur wil graag op locatie praten'],
  ]
  for (const [id, acc, reden] of KANSEN) {
    await client.query(`insert into klaargezet_voor (id, organisation_id, account_id, van_gebruiker, voor_gebruiker, regio_id, datum, reden, op) values ($1, $2, $3, $4, 'u-02', 'regio-midden', $5, $6, $7) on conflict do nothing`,
      [id, orgId, acc, EVA, volgendeMaandag, reden, uurGeleden(26)])
  }

  // ── Coaching: een gesprek met Joost met een gedeeld punt en een afspraak ──
  await client.query(`insert into coaching_sessies (id, organisation_id, gebruiker_id, manager_id, datum, data) values ('cs-eva-1', $1, $2, 'u-04', $3, $4) on conflict do nothing`, [orgId, EVA, wd(-6), JSON.stringify({
    punten: [
      { tekst: 'Stuur na elk gesprek dezelfde dag een korte samenvatting.', onderbouwing: { cijfers: ['4 van 9 gesprekken zonder opvolgmail', 'team 2 van 10'], bron: 'Activiteitenlog' }, artikelSleutel: 'een-belscript-kiezen', gedeeld: true },
      { tekst: 'Houd het middagblok vrij voor opvolging.', onderbouwing: { cijfers: ['2 middagblokken overgeslagen in 2 weken'], bron: 'Belblokken' }, artikelSleutel: 'belblokken', gedeeld: false },
    ],
  })])
  await client.query(`insert into coaching_notities (id, organisation_id, gebruiker_id, manager_id, soort, tekst, termijn, sessie_id) values ('cn-eva-1', $1, $2, 'u-04', 'afspraak', 'Elke vrijdag de pijplijn bijwerken voor het weekoverleg.', $3, 'cs-eva-1') on conflict do nothing`, [orgId, EVA, wd(10)])

  return { accounts: nAccounts, contacten: nContacten, taken: nTaken, afspraken: nAfspraken }
}
