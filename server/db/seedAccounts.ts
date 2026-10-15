// P03 startdata: accounts, contacten, klassen en een eigen veld voor Testbedrijf
// Voltvast. Alles is fictief: de 14 accounts uit seed/voltvast.json plus een
// gegenereerde set "Testinstallatie ..." om lijst en filters te vullen.
import type pg from 'pg'
import { berekenScore, laatsteContact } from '../../shared/score'

const PLAATSEN = ['Amersfoort', 'Zwolle', 'Groningen', 'Assen', 'Utrecht', 'Apeldoorn', 'Deventer', 'Leeuwarden', 'Emmen', 'Lelystad', 'Hoogeveen', 'Meppel', 'Harderwijk', 'Veenendaal', 'Zeist']
const WOORDEN = ['Koperslag', 'Stroomlijn', 'Warmtepunt', 'Buizerd', 'Lichtbaak', 'Netwerk', 'Klimaatdijk', 'Zonneweide', 'Pompstation', 'Kabelbaan', 'Schakelveld', 'Leidingkade', 'Watervoort', 'Luchtsluis', 'Dakgoot', 'Vonkdal', 'Ampère', 'Thermiek', 'Radiator', 'Gasveld', 'Spanning', 'Ketelhuis', 'Meterkast', 'Zekering', 'Grondkabel', 'Ventiel', 'Draadloos', 'Isolatie', 'Boiler', 'Warmtenet', 'Installatiehof', 'Lasdraad', 'Spoorweg', 'Krachtstroom', 'Gelijkstroom', 'Wisselstroom', 'Aardlek', 'Schemer', 'Leidingdal', 'Montagehof']
const VOORNAMEN = ['Anke', 'Bas', 'Corine', 'Daan', 'Els', 'Frank', 'Gijs', 'Hanneke', 'Iris', 'Joost', 'Karel', 'Lotte', 'Martijn', 'Noor', 'Olaf', 'Petra', 'Quinten', 'Roos', 'Stijn', 'Tamara']
const ROLLEN = ['beslisser', 'beinvloeder', 'champion', 'gebruiker', 'poortwachter', 'onbekend']
const STATUSSEN = ['nieuw', 'nieuw', 'in reis', 'in reis', 'wachtend', 'gescoord', 'nee']
const AANLEIDINGEN = ['Vacature servicemonteur', 'Nieuwe vestiging geopend', 'Groeit in warmtepompen', 'Won aanbesteding woningbouw', 'Nieuwe directeur benoemd']

/** Deterministische pseudo-willekeur, zodat de seed altijd hetzelfde oplevert. */
function rng(seed: number) {
  let s = seed
  return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648
}

export async function seedAccounts(client: pg.Client, org: { id: string }, bron: any) {
  const nu = new Date()
  const klassen = bron.organisatie.accountklassen.map((k: any) => ({ id: k.id, naam: k.naam, tabblad: k.tabblad }))
  await client.query(`insert into org_settings (organisation_id, key, value) values ($1, 'klassen', $2) on conflict (organisation_id, key) do update set value = excluded.value`, [org.id, JSON.stringify(klassen)])

  await client.query(
    `insert into eigen_velden (id, organisation_id, object, sleutel, naam, type, sectie, volgorde, data)
     values ('ev-monteurs', $1, 'account', 'aantal_monteurs', 'Aantal monteurs', 'getal', 'Kwalificatie', 1, $2),
            ('ev-segment', $1, 'account', 'segment', 'Segment', 'keuzelijst', 'Kwalificatie', 2, $3)
     on conflict (organisation_id, object, sleutel) do nothing`,
    [org.id,
      JSON.stringify({ filterbaar: true, zichtbaarVanaf: 'gevorderd', bewerkbaarDoor: 'iedereen', bron: 'import', hulp: 'Aantal monteurs in loondienst.' }),
      JSON.stringify({ filterbaar: true, zichtbaarVanaf: 'beginner', bewerkbaarDoor: 'iedereen', bron: 'handmatig', opties: [
        { waarde: 'installateur', label: 'Installateur', kleur: 'blauw' }, { waarde: 'woningcorporatie', label: 'Woningcorporatie', kleur: 'groen' },
        { waarde: 'zonnepanelen', label: 'Zonnepanelen', kleur: 'geel' }] })],
  )

  type A = { id: string; name: string; kind: string; klasse: string | null; owner: string | null; status: string; city: string; postcode?: string; kvk?: string; domein?: string; lat?: number; lng?: number; branche?: string | null; leverancier?: string | null; gebied?: string | null; data: any }
  type C = { id: string; accountId: string; first: string; last: string; email: string | null; rol: string; status: string; data: any }
  const accounts: A[] = []
  const contacten: C[] = []
  const momenten: Record<string, { soort: string; op: string; kanaal: string; uitkomst: string }[]> = {}

  for (const a of bron.accounts) {
    const segment = a.id.startsWith('pr-08') || a.id.startsWith('pr-09') || a.id.startsWith('pr-10') ? 'woningcorporatie' : a.id.startsWith('pr-11') || a.id.startsWith('pr-12') ? 'zonnepanelen' : 'installateur'
    accounts.push({
      id: a.id, name: a.naam, kind: a.account_kind, klasse: a.klasse, owner: a.owner_id, status: a.account_kind === 'klant' ? 'klant' : a.nb_status,
      city: a.plaats, postcode: a.postcode, kvk: a.kvk, domein: a.domein, lat: a.lat, lng: a.lng, branche: a.vv_branche_id ?? null, leverancier: a.huidige_leverancier_id ?? null, gebied: a.gebied_id ?? null,
      data: { website: `https://${a.domein}`, telefoon: `+3133${String(1000000 + Number(a.kvk.slice(-4))).slice(-7)}`, provincie: a.provincie, sbi: a.sbi,
        customFields: { aantal_monteurs: a.aantal_monteurs, segment }, herkomst: { 'cf.aantal_monteurs': { bron: 'import', op: '2026-09-01' } },
        ...(a.id === 'pr-01' ? { aanleiding: { tekst: 'Plant woningbouw in Hoogland', op: new Date(nu.getTime() - 3 * 864e5).toISOString(), heet: true, bron: 'notitie' } } : {}),
        ...(a.id === 'pr-04' ? { aanleiding: { tekst: 'Vacature projectleider elektra', op: new Date(nu.getTime() - 10 * 864e5).toISOString(), bron: 'web' } } : {}) },
    })
  }
  for (const c of bron.contacten) {
    contacten.push({ id: c.id, accountId: c.account_id, first: c.first_name, last: c.last_name, email: c.email, rol: c.rol, status: c.status,
      data: { functie: c.functie, telefoon: c.telefoon, consent: { email: { status: 'onbekend' }, whatsapp: { status: 'onbekend' } }, ...(c.status === 'vertrokken' ? { vertrokkenOp: '2026-06-30' } : {}) } })
  }
  momenten['pr-01'] = [{ soort: 'gebeld', op: '2026-10-09T10:00:00+02:00', kanaal: 'telefoon', uitkomst: 'gesproken' }]
  momenten['pr-04'] = [{ soort: 'mail', op: '2026-09-04T09:00:00+02:00', kanaal: 'email', uitkomst: 'verzonden' }]

  const r = rng(42)
  const eigenaars = ['u-01', 'u-02', 'u-03', 'u-05', 'u-07']
  for (let i = 0; i < 48; i++) {
    const woord = WOORDEN[i % WOORDEN.length]!
    const id = `pr-g${String(i + 1).padStart(2, '0')}`
    const city = PLAATSEN[Math.floor(r() * PLAATSEN.length)]!
    const status = STATUSSEN[Math.floor(r() * STATUSSEN.length)]!
    const klasse = ['kl-a-prospects', 'kl-b-prospects', 'kl-c-prospects', null][Math.floor(r() * 4)]!
    const heeftAanleiding = r() < 0.3
    const domein = `${woord.toLowerCase().replace(/[^a-z]/g, '')}${i}.test`
    accounts.push({
      id, name: `Testinstallatie ${woord}${i >= WOORDEN.length ? ' Noord' : ''}`, kind: 'prospect', klasse, owner: eigenaars[i % eigenaars.length]!, status, city, domein,
      data: { website: `https://${domein}`, ...(r() < 0.8 ? { telefoon: `+3130${String(2000000 + i * 137).slice(-7)}` } : {}),
        customFields: { aantal_monteurs: Math.floor(r() * 60) + 2, segment: r() < 0.7 ? 'installateur' : 'zonnepanelen' },
        ...(heeftAanleiding ? { aanleiding: { tekst: AANLEIDINGEN[i % AANLEIDINGEN.length]!, op: new Date(nu.getTime() - Math.floor(r() * 40) * 864e5).toISOString(), heet: r() < 0.3, bron: 'web' } } : {}) },
    })
    const aantal = Math.floor(r() * 4)
    for (let j = 0; j < aantal; j++) {
      const v = VOORNAMEN[Math.floor(r() * VOORNAMEN.length)]!
      contacten.push({ id: `${id}-c${j + 1}`, accountId: id, first: v, last: `Test${woord.toLowerCase().slice(0, 5)}`, email: r() < 0.7 ? `${v.toLowerCase()}@${domein}` : null,
        rol: j === 0 && r() < 0.6 ? 'beslisser' : ROLLEN[Math.floor(r() * ROLLEN.length)]!, status: 'actief',
        data: { functie: j === 0 ? 'Directeur' : 'Projectleider', ...(r() < 0.7 ? { telefoon: `+316000${String(10000 + i * 10 + j).slice(-5)}` } : {}),
          consent: { email: { status: 'onbekend' }, whatsapp: { status: 'onbekend' } } } })
    }
    if (r() < 0.5) momenten[id] = [{ soort: r() < 0.5 ? 'gebeld' : 'mail', op: new Date(nu.getTime() - Math.floor(r() * 120) * 864e5).toISOString(), kanaal: 'telefoon', uitkomst: 'gesproken' }]
  }

  for (const a of accounts) {
    const cs = contacten.filter((c) => c.accountId === a.id).map((c) => ({ rol: c.rol, status: c.status, telefoon: c.data.telefoon, email: c.email }))
    const lc = laatsteContact((momenten[a.id] ?? []).map((m) => ({ soort: m.soort, op: m.op, status: 'afgerond' })), nu)
    const s = berekenScore({ nu, contacten: cs, laatsteContactOp: lc, aanleidingen: a.data.aanleiding ? [a.data.aanleiding] : [] })
    await client.query(
      `insert into accounts (id, organisation_id, name, account_kind, klasse, owner_id, nb_status, score, laatste_contact_op, city, postcode, kvk, domein, lat, lng, nb_bron, fase_sinds, data, vv_branche_id, huidige_leverancier_id, gebied_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'seed', now() - interval '12 days', $16, $17, $18, $19)
       on conflict (id) do nothing`,
      [a.id, org.id, a.name, a.kind, a.klasse, a.owner, a.status, s.score, lc, a.city, a.postcode ?? null, a.kvk ?? null, a.domein ?? null, a.lat ?? null, a.lng ?? null,
        JSON.stringify({ ...a.data, scoreOpbouw: s.opbouw }), a.branche ?? null, a.leverancier ?? null, a.gebied ?? null],
    )
    for (const m of momenten[a.id] ?? []) {
      await client.query(`insert into activiteiten (organisation_id, account_id, soort, kanaal, uitkomst, door, op, data) select $1,$2,$3,$4,$5,$6,$7,'{}' where not exists (select 1 from activiteiten where account_id = $2 and op = $7)`,
        [org.id, a.id, m.soort, m.kanaal, m.uitkomst, a.owner, m.op])
    }
  }
  for (const c of contacten) {
    await client.query(
      `insert into contacts (id, organisation_id, account_id, first_name, last_name, email, rol, status, data) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict (id) do nothing`,
      [c.id, org.id, c.accountId, c.first, c.last, c.email, c.rol, c.status, JSON.stringify(c.data)],
    )
  }
  for (const n of bron.notities ?? []) {
    await client.query(`insert into activiteiten (id, organisation_id, account_id, contact_id, soort, door, op, data) values ($1,$2,$3,$4,'notitie',$5,$6,$7) on conflict (id) do nothing`,
      [n.id, org.id, n.account_id, n.contact_id, n.auteur_id, n.op, JSON.stringify({ tekst: n.tekst })])
  }
  // P04: één afgemeld e-mailadres en één bel-me-niet-nummer, voor de importtests.
  const { createHash } = await import('node:crypto')
  await client.query(`insert into onderdrukkingslijst (organisation_id, email_hash, bron) values ($1, $2, 'afgemeld') on conflict do nothing`, [org.id, createHash('sha256').update('afgemeld@testafmelding.test').digest('hex')])
  await client.query(`insert into bel_me_niet (organisation_id, telefoon_e164, door) values ($1, '+31612000999', 'seed') on conflict do nothing`, [org.id])
  return { accounts: accounts.length, contacten: contacten.length }
}
