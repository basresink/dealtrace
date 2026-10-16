// Fictieve inzichten voor de Signaalradar (F5) bij Testbedrijf Voltvast: zeven perioden van 30 dagen op
// bestaande testaccounts (eva-*, pl-*, pr-*), zodat er lokaal golven te zien zijn. In Regio Midden (Eva
// Ervaren) twee golven: vacatures bij installatiebedrijven woningbouw en nieuwbouw of vergunning bij
// utiliteitsinstallateurs; in de hele organisatie daarnaast nieuwe vestigingen. Er staan ook cellen die
// geen golf zijn (te weinig accounts, of rond normaal). Alle namen en adressen zijn fictief (.test).
// Idempotent: vaste id's, on conflict do nothing; een account dat niet bestaat, wordt overgeslagen.
import type pg from 'pg'
import type { Signaalsoort } from '../../shared/signaalradar'

const M1 = ['eva-a01', 'eva-a03', 'eva-a05', 'eva-a07', 'eva-a09', 'eva-a12', 'pl-19', 'pl-29', 'pl-49', 'eva-k01']
const N1 = ['pl-01', 'pl-02', 'pl-04', 'pl-05', 'pl-11', 'pl-13', 'pl-14', 'pl-22', 'pl-23', 'pl-25']
const O1 = ['pl-07', 'pl-08', 'pl-10', 'pl-16', 'pl-17', 'pl-20', 'pl-26', 'pl-28']
const M2 = ['eva-a02', 'eva-a06', 'eva-a08', 'eva-a11', 'pl-09', 'pl-39']
const N2 = ['pl-03', 'pl-12', 'pl-15', 'pl-21', 'pl-24', 'pl-33', 'pl-42', 'pl-45']
const O2 = ['pl-06', 'pl-18', 'pl-27', 'pl-30', 'pl-36', 'pl-48']

/** Accounts per vorige periode uit een paar pools: [pool, aantal] wordt elke periode verder doorgedraaid. */
const draai = (delen: [string[], number][]) => (p: number) => delen.flatMap(([pool, n]) => Array.from({ length: n }, (_, i) => pool[(p * n + i) % pool.length]!))

interface Cel { sleutel: string; soort: Signaalsoort; type: string; nu: string[]; historie: (p: number) => string[] }
const CELLEN: Cel[] = [
  // Golf: in Midden 8 tegen normaal 2, in de organisatie 14 tegen normaal 5.
  { sleutel: 'vac1', soort: 'vacatures', type: 'vacature', nu: [...M1.slice(0, 8), ...N1.slice(0, 4), ...O1.slice(0, 2)], historie: draai([[M1, 2], [N1, 2], [O1, 1]]) },
  // Golf: in Midden 6 tegen normaal 3, in de organisatie 8 tegen normaal 4.
  { sleutel: 'bouw2', soort: 'nieuwbouw-vergunning', type: 'nieuws', nu: [...M2, ...N2.slice(0, 2)], historie: draai([[M2, 3], [N2, 1]]) },
  // Sterke golf in de organisatie (Noord en Oost): 7 tegen normaal 1.
  { sleutel: 'vest1', soort: 'nieuwe-vestiging', type: 'kvk', nu: [...N1.slice(4, 10), O1[2]!], historie: draai([[N1.slice(6), 1]]) },
  // Geen golf: verhoogd, maar 3 accounts.
  { sleutel: 'dir1', soort: 'directiewissel', type: 'nieuws', nu: [M1[8]!, M1[5]!, N1[5]!], historie: (p) => (p % 2 ? [N1[(p + 2) % N1.length]!] : []) },
  // Geen golf: 6 accounts, rond normaal (5 per periode).
  { sleutel: 'vac2', soort: 'vacatures', type: 'vacature', nu: [...N2.slice(2, 7), M2[0]!], historie: draai([[N2, 4], [M2, 1]]) },
  { sleutel: 'sub3', soort: 'subsidie-regeling', type: 'nieuws', nu: ['pr-08', 'pr-09', 'pr-10'], historie: (p) => (p === 2 ? ['pr-08'] : []) },
  { sleutel: 'over2', soort: 'overname', type: 'nieuws', nu: [O2[0]!], historie: (p) => (p === 4 ? [O2[1]!] : []) },
  { sleutel: 'ov1', soort: 'overig', type: 'website', nu: [M1[9]!], historie: (p) => [M1[(p + 3) % M1.length]!] },
]

const TITELS: Record<Signaalsoort, string[]> = {
  vacatures: ['Zoekt twee servicemonteurs', 'Vacature werkvoorbereider installatietechniek', 'Zoekt drie monteurs voor warmtepompen', 'Vacature planner service en onderhoud', 'Zoekt een eerste monteur elektra'],
  'nieuwe-vestiging': ['Opent een nieuwe vestiging in Testdorp', 'Nieuwe vestiging aan de Proefweg', 'Opent een tweede kantoor in Testveen'],
  'nieuwbouw-vergunning': ['Omgevingsvergunning verleend voor een bedrijfshal', 'Start nieuwbouw van 40 woningen in Testwijk', 'Vergunning voor uitbreiding van het pand'],
  directiewissel: ['Nieuwe directeur treedt aan per 1 november', 'Nieuwe directie na het pensioen van de oprichter'],
  'subsidie-regeling': ['Toekenning regeling verduurzaming 2027', 'Subsidie voor 300 woningen van het gas af'],
  overname: ['Testgroep Overkant neemt het bedrijf over'],
  overig: ['Nieuwe website met een projectoverzicht'],
}
const BRON: Record<Signaalsoort, string> = {
  vacatures: 'Vacaturebank Testland', 'nieuwe-vestiging': 'Handelsregister (testomgeving)', 'nieuwbouw-vergunning': 'Omgevingsloket Testgemeente', directiewissel: 'Regionieuws Testkrant',
  'subsidie-regeling': 'Regioportaal Testprovincie', overname: 'Regionieuws Testkrant', overig: 'Website van het bedrijf',
}

export async function seedSignaalradar(client: pg.Client, orgId: string, nu = new Date()) {
  let n = 0
  const zet = async (id: string, account: string, c: Cel, dagenTerug: number, nieuw: boolean, i: number) => {
    const titel = TITELS[c.soort][i % TITELS[c.soort].length]!
    const op = new Date(nu.getTime() - dagenTerug * 864e5).toISOString()
    const bron = { soort: 'web', naam: BRON[c.soort], url: `https://bron.voorbeeld.test/${c.sleutel}/${id}`, datum: op.slice(0, 10) }
    const data = { agent: 'waarnemer', bron, evidence: [{ citaat: titel, bron: BRON[c.soort], datum: op.slice(0, 10), url: bron.url }], zekerheid: 80, waarom: titel, bewijs: [`"${titel}" (${BRON[c.soort]}, ${op.slice(0, 10)})`], winpuntVoorstel: null, voorstel: null }
    const r = await client.query(`insert into signals (id, organisation_id, account_id, owner_id, onderwerp, agent, type, title, relevance_score, confidence, status, bron, signaalsoort, data, created_at, updated_at)
      select $1, $2, a.id, a.owner_id, $3, 'waarnemer', $4, $5, 55, 0.8, $6, 'extern', $7, $8::jsonb, $9, $9 from accounts a where a.id = $10 and a.organisation_id = $2
      on conflict (id) do nothing`, [id, orgId, `radar:${id}`, c.type, titel, nieuw ? 'gelezen' : 'omgezet', c.soort, JSON.stringify(data), op, account])
    n += r.rowCount ?? 0
  }
  for (const c of CELLEN) {
    for (const [i, a] of c.nu.entries()) await zet(`sr-${c.sleutel}-0-${i}`, a, c, 1 + ((i * 3) % 27), true, i)
    for (let p = 1; p <= 6; p++) {
      for (const [i, a] of c.historie(p - 1).entries()) await zet(`sr-${c.sleutel}-${p}-${i}`, a, c, p * 30 + 2 + ((i * 5) % 26), false, i + p)
    }
  }
  return n
}
