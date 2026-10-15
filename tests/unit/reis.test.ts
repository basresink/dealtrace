import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { bandGekwalificeerd, bandScore } from '../../shared/bandKwalificatie'
import {
  AFKOELING_STANDAARD, GEBEURTENISSEN, afkoelingVoorNee, cooldownActief, magBenaderen, volgendeStatus, type Gebeurtenis,
} from '../../shared/nbStatus'
import {
  STANDAARD_FASES, STANDAARD_OVERGANGEN, dagenInFase, fase, faseVoorStatus, instapFase, isEersteAfspraak, kiesReis,
  pastInDoelgroep, pasAccentenToe, standaardReisData, valideerReis, verblijfOverschreden, volgendeFase, type Doelgroep,
} from '../../shared/reis'
import { regelVoorReden, terugkomDatum, terugkomTekst, verkoopverhaalUitSeed } from '../../shared/verkoopverhaal'

const reis = standaardReisData()
const vv = verkoopverhaalUitSeed(JSON.parse(readFileSync(join(import.meta.dirname, '../../seed/voltvast.json'), 'utf8')).verkoopverhaal)

/** Testmelder: het meldpunt zonder database (volgendeFase + volgendeStatus). */
function meld(stand: { fase: string | null; status: string }, g: Gebeurtenis) {
  const naar = stand.fase === null ? instapFase(reis, g) : volgendeFase(reis, stand.fase, g)
  const f = fase(reis, naar ?? stand.fase)
  return { fase: naar ?? stand.fase, status: volgendeStatus(stand.status, g, { naarHoofdfase: f?.hoofdfase, naarEind: f?.eind ?? null }), gewisseld: naar !== null }
}

describe('statusmachine (7.2)', () => {
  it('elke rij van de tabel', () => {
    expect(volgendeStatus('nieuw', 'gekwalificeerd')).toBe('in reis')
    expect(volgendeStatus('nieuw', 'niet_geschikt')).toBe('nee')
    expect(volgendeStatus('in reis', 'geparkeerd')).toBe('wachtend')
    expect(volgendeStatus('in reis', 'later')).toBe('wachtend')
    expect(volgendeStatus('in reis', 'geen_interesse')).toBe('nee')
    expect(volgendeStatus('in reis', 'eerste-afspraak-gepland')).toBe('gescoord')
    expect(volgendeStatus('in reis', 'afspraak')).toBe('gescoord')
    expect(volgendeStatus('wachtend', 'heropvolging')).toBe('in reis')
    expect(volgendeStatus('nee', 'heropvolging')).toBe('in reis')
    expect(volgendeStatus('gescoord', 'eerste-afspraak-gehouden')).toBe('gescoord')
    expect(volgendeStatus('gescoord', 'overgedragen')).toBe('overgedragen')
    expect(volgendeStatus('gescoord', 'geen-vervolg')).toBe('nee')
    expect(volgendeStatus('gescoord', 'afspraak-niet-verschenen')).toBe('in reis')
    expect(volgendeStatus('in reis', 'pauzeer')).toBe('wachtend')
  })
  it('overgedragen blijft overgedragen; terugkomst alleen via een terugkomregel', () => {
    for (const g of GEBEURTENISSEN) expect(volgendeStatus('overgedragen', g)).toBe('overgedragen')
    expect(volgendeStatus('overgedragen', 'nee')).toBe('overgedragen')
  })
  it('onbekende combinatie geeft de huidige status terug', () => {
    expect(volgendeStatus('nieuw', 'overgedragen')).toBe('nieuw')
    expect(volgendeStatus('wachtend', 'afspraak-niet-verschenen')).toBe('wachtend')
    expect(volgendeStatus('nee', 'dossier-compleet')).toBe('nee')
  })
  it('handmatig: de status volgt de hoofdfase van de doelfase', () => {
    expect(volgendeStatus('nieuw', 'handmatig', { naarHoofdfase: 'bewerken' })).toBe('in reis')
    expect(volgendeStatus('in reis', 'handmatig', { naarHoofdfase: 'verbinden' })).toBe('gescoord')
    expect(volgendeStatus('in reis', 'handmatig', { naarHoofdfase: 'verloren', naarEind: 'verloren' })).toBe('nee')
  })
})

describe('afkoelperiode en magBenaderen', () => {
  const nee = (reden: string, op = '2026-10-15T09:00:00Z') => ({ nbStatus: 'nee', data: { nee: { reden, op, afkoeling: afkoelingVoorNee(reden) } } })
  it('"Niet geschikt" geeft 365 dagen voor elk kanaal', () => {
    expect(Object.values(afkoelingVoorNee('Niet geschikt')).every((d) => d === 365)).toBe(true)
    const a = nee('Niet geschikt')
    for (const k of ['bellen', 'mail', 'linkedin', 'whatsapp', 'bezoek', 'kaart'] as const) {
      expect(magBenaderen(a, k, new Date('2027-10-14T12:00:00Z')).mag).toBe(false)
      expect(magBenaderen(a, k, new Date('2027-10-15T12:00:00Z')).mag).toBe(true)
    }
  })
  it('precies op de laatste dag nog actief, de dag erna niet; ander kanaal eigen termijn', () => {
    const a = nee('Geen budget')
    expect(cooldownActief(a, 'mail', new Date('2026-12-13T23:00:00Z'))).toBe(true) // dag 59
    expect(cooldownActief(a, 'mail', new Date('2026-12-14T08:00:00Z'))).toBe(false) // dag 60
    expect(cooldownActief(a, 'bellen', new Date('2026-12-14T08:00:00Z'))).toBe(true)
  })
  it('wachtend tot een datum en bel-me-niet', () => {
    expect(magBenaderen({ nbStatus: 'wachtend', data: { wachtendTot: '2026-11-01' } }, 'bellen', new Date('2026-10-20')).mag).toBe(false)
    expect(magBenaderen({ nbStatus: 'wachtend', data: { wachtendTot: '2026-11-01' } }, 'bellen', new Date('2026-11-01')).mag).toBe(true)
    expect(magBenaderen({ nbStatus: 'in reis', data: {} }, 'bellen', new Date(), { belMeNiet: true })).toEqual({ mag: false, reden: 'Staat op bel-me-niet' })
    expect(magBenaderen({ nbStatus: 'in reis', data: {} }, 'mail', new Date(), { belMeNiet: true }).mag).toBe(true)
  })
})

describe('terugkomregel (7.3, F25)', () => {
  const nu = new Date('2026-10-15T10:00:00Z')
  it('C.9 punt 5: "Prijs" via de mapping naar "Prijs te hoog", 182 dagen, bezoek', () => {
    const v = terugkomDatum('Prijs', vv, nu, AFKOELING_STANDAARD, 'deal_verloren')
    expect(v.regel?.id).toBe('hc-03')
    expect(v.regel?.reden).toBe('Prijs te hoog')
    expect(v.dagen).toBe(182)
    expect(v.kanaal).toBe('bezoek')
    expect(v.datum).toBe('2027-04-15')
  })
  it('een datum binnen de afkoelperiode schuift op (mail 60, regel 30)', () => {
    const stand = { terugkomregels: [{ id: 'x', lijst: 'verloren' as const, reden: 'Kort', termijn: 'Over een maand', termijnDagen: 30, kanaal: 'E-mail', rollen: [], aanpak: 'Mail' }], redenmapping: [] }
    const v = terugkomDatum('Kort', stand, nu, AFKOELING_STANDAARD)
    expect(v.dagen).toBe(60)
    expect(v.opgeschoven).toBe(true)
    expect(v.datum).toBe('2026-12-14')
  })
  it('nee "Verkeerd moment" volgt hc-02 (61 dagen, e-mail)', () => {
    const v = terugkomDatum('Verkeerd moment', vv, nu, AFKOELING_STANDAARD, 'nee')
    expect(v.regel?.id).toBe('hc-02')
    expect(v.dagen).toBe(61)
    expect(terugkomTekst(v.datum, v.regel)).toBe('Terug op 15 december 2026 · Beslissing uitgesteld · Korte e-mail met een nieuwe aanleiding.')
  })
  it('zonder regel de afkoelperiode van bellen; "Niet geschikt" 365', () => {
    expect(regelVoorReden('Geen budget', vv)).toBeNull()
    expect(terugkomDatum('Geen budget', vv, nu).dagen).toBe(90)
    expect(terugkomDatum('Niet geschikt', vv, nu).dagen).toBe(365)
  })
})

describe('standaardreis (F05)', () => {
  it('tien fases in vijf hoofdfases; valideerReis zonder fouten en waarschuwingen', () => {
    expect(STANDAARD_FASES).toHaveLength(10)
    expect(new Set(STANDAARD_FASES.map((f) => f.hoofdfase)).size).toBe(5)
    const v = valideerReis(reis)
    expect(v.fouten).toEqual([])
    expect(v.waarschuwingen).toEqual([])
  })
  it('elke overgang uit de tabel werkt met een echte gebeurtenis', () => {
    for (const o of STANDAARD_OVERGANGEN) {
      expect(volgendeFase(reis, o.vanFaseId, o.gebeurtenis), `${o.vanFaseId} + ${o.gebeurtenis}`).toBe(o.naarFaseId)
    }
  })
  it('elke fase is bereikbaar via een echte gebeurtenis (databasevrije doorloop)', () => {
    const bereikt = new Set<string>()
    let s = meld({ fase: null, status: 'nieuw' }, 'import'); bereikt.add(s.fase!)
    expect(s).toMatchObject({ fase: 'gevonden', status: 'nieuw' })
    s = meld(s, 'dossier-compleet'); bereikt.add(s.fase!)
    s = meld(s, 'gekwalificeerd'); bereikt.add(s.fase!)
    expect(s).toMatchObject({ fase: 'gekwalificeerd', status: 'in reis' })
    s = meld(s, 'eerste-contact'); bereikt.add(s.fase!)
    s = meld(s, 'gesprek-gevoerd'); bereikt.add(s.fase!)
    s = meld(s, 'eerste-afspraak-gepland'); bereikt.add(s.fase!)
    expect(s).toMatchObject({ fase: 'afspraak-gepland', status: 'gescoord' })
    const noshow = meld(s, 'afspraak-niet-verschenen')
    expect(noshow).toMatchObject({ fase: 'in-gesprek', status: 'in reis' })
    s = meld(s, 'eerste-afspraak-gehouden'); bereikt.add(s.fase!)
    const geenVervolg = meld(s, 'geen-vervolg'); bereikt.add(geenVervolg.fase!)
    expect(geenVervolg).toMatchObject({ fase: 'verloren', status: 'nee' })
    s = meld(s, 'overgedragen'); bereikt.add(s.fase!)
    expect(s).toMatchObject({ fase: 'overgedragen', status: 'overgedragen' })
    const geparkeerd = meld({ fase: 'benaderd', status: 'in reis' }, 'geparkeerd'); bereikt.add(geparkeerd.fase!)
    expect(geparkeerd.status).toBe('wachtend')
    expect(meld(geparkeerd, 'heropvolging')).toMatchObject({ fase: 'gekwalificeerd', status: 'in reis' })
    expect(meld(geenVervolg, 'heropvolging')).toMatchObject({ fase: 'gekwalificeerd', status: 'in reis' })
    expect([...bereikt].sort()).toEqual(STANDAARD_FASES.map((f) => f.id).sort())
  })
  it('geen wissel: onbekende gebeurtenis in een fase, of eindfase overgedragen', () => {
    expect(volgendeFase(reis, 'gevonden', 'overgedragen')).toBeNull()
    expect(volgendeFase(reis, 'overgedragen', 'heropvolging')).toBeNull()
  })
  it('hoogste prioriteit wint, voorwaarde telt, hoogstens één wissel', () => {
    const t = standaardReisData()
    t.overgangen.push({ id: 'x1', vanFaseId: 'gekwalificeerd', gebeurtenis: 'eerste-contact', naarFaseId: 'in-gesprek', prioriteit: 50, voorwaarde: { klasse: ['A'] } })
    expect(volgendeFase(t, 'gekwalificeerd', 'eerste-contact', { klasse: 'A' })).toBe('in-gesprek')
    expect(volgendeFase(t, 'gekwalificeerd', 'eerste-contact', { klasse: 'B' })).toBe('benaderd')
  })
  it('valideerReis vindt een onbereikbare en een doodlopende fase', () => {
    const t = standaardReisData()
    t.fases.push({ id: 'los', hoofdfase: 'bewerken', label: 'Los', omschrijving: '', volgorde: 11, kleur: 'geel', accent: '' })
    const v = valideerReis(t)
    expect(v.waarschuwingen).toContain('Fase onbereikbaar: Los')
    expect(v.waarschuwingen).toContain('Doodlopende fase: Los')
    const zonderEind = { ...t, fases: t.fases.filter((f) => f.eind !== 'verloren') }
    expect(valideerReis(zonderEind).fouten).toContain('Er is geen eindfase verloren')
  })
  it('accenten bijstellen raakt alleen het accent', () => {
    const t = pasAccentenToe(reis, [{ id: 'gevonden', accent: 'Nieuw accent' }])
    expect(fase(t, 'gevonden')?.accent).toBe('Nieuw accent')
    expect(fase(t, 'gevonden')?.label).toBe('Gevonden')
    expect(fase(reis, 'gevonden')?.accent).not.toBe('Nieuw accent')
  })
  it('startfase bij invoering volgt de status', () => {
    expect(faseVoorStatus('nee')).toBe('verloren')
    expect(faseVoorStatus('gescoord')).toBe('afspraak-gepland')
    expect(faseVoorStatus('klant')).toBeNull()
  })
})

describe('isEersteAfspraak (gat 3)', () => {
  it('geannuleerde eerste afspraak telt niet; tweede afspraak geeft false', () => {
    const a = [
      { id: 'a1', status: 'geannuleerd' as const, op: '2026-10-01' },
      { id: 'a2', status: 'gepland' as const, op: '2026-10-10' },
      { id: 'a3', status: 'gepland' as const, op: '2026-10-20' },
    ]
    expect(isEersteAfspraak('a1', a)).toBe(false)
    expect(isEersteAfspraak('a2', a)).toBe(true)
    expect(isEersteAfspraak('a3', a)).toBe(false)
  })
})

describe('dagen in fase', () => {
  it('telt dagen; eindfase nooit overschreden', () => {
    const nu = new Date('2026-10-15T12:00:00Z')
    const a = { faseSinds: '2026-10-01T12:00:00Z' }
    expect(dagenInFase(a, nu)).toBe(14)
    expect(verblijfOverschreden(a, fase(reis, 'gekwalificeerd'), nu)).toBe(true)
    expect(verblijfOverschreden(a, fase(reis, 'benaderd'), nu)).toBe(false)
    expect(verblijfOverschreden(a, fase(reis, 'verloren'), nu)).toBe(false)
    expect(verblijfOverschreden(a, fase(reis, 'afspraak-gepland'), nu)).toBe(false)
  })
})

describe('doelgroepen en kiesReis', () => {
  const dg = (id: string, prioriteit: number, data: Doelgroep['data'], status: Doelgroep['status'] = 'actief'): Doelgroep => ({ id, naam: id, status, prioriteit, data })
  const reizen = [
    { id: 'standaard', doelgroepId: null, isStandaard: true, status: 'actief' },
    { id: 'r-woning', doelgroepId: 'woning', isStandaard: false, status: 'actief' },
    { id: 'r-midden', doelgroepId: 'midden', isStandaard: false, status: 'actief' },
  ]
  const account = { sbi: ['4321'], vvBrancheId: 'br-01', klasse: 'kl-a-prospects', medewerkers: 24, postcode: '3821', bron: 'import', cf: { segment: 'installateur' } }
  it('past in twee doelgroepen: de hoogste prioriteit (laagste getal) wint', () => {
    const d = [dg('midden', 2, { postcodes: ['38'] }), dg('woning', 1, { brancheIds: ['br-01'] })]
    expect(kiesReis(account, d, reizen)).toBe('r-woning')
  })
  it('past nergens: standaardreis; gearchiveerde doelgroep telt niet', () => {
    expect(kiesReis(account, [dg('woning', 1, { brancheIds: ['br-02'] })], reizen)).toBe('standaard')
    expect(kiesReis(account, [dg('woning', 1, { brancheIds: ['br-01'] }, 'gearchiveerd')], reizen)).toBe('standaard')
  })
  it('pastInDoelgroep: SBI, klassen, omvang, postcodes, eigen velden, uitsluitingen', () => {
    expect(pastInDoelgroep(account, { data: { sbi: ['432'] } })).toBe(true)
    expect(pastInDoelgroep(account, { data: { sbi: ['6820'] } })).toBe(false)
    expect(pastInDoelgroep(account, { data: { klassen: ['kl-b-prospects'] } })).toBe(false)
    expect(pastInDoelgroep(account, { data: { omvang: { min: 10, max: 50 } } })).toBe(true)
    expect(pastInDoelgroep(account, { data: { omvang: { min: 30 } } })).toBe(false)
    expect(pastInDoelgroep(account, { data: { postcodes: ['3800-3899'] } })).toBe(true)
    expect(pastInDoelgroep(account, { data: { eigenVeldFilters: [{ sleutel: 'segment', vergelijking: 'is', waarde: 'installateur' }] } })).toBe(true)
    expect(pastInDoelgroep({ ...account, segment: 'installateur' }, { data: { uitsluitingen: { segmenten: ['installateur'] } } })).toBe(false)
    expect(pastInDoelgroep(account, { data: { bron: 'warm' } })).toBe(false)
  })
})

describe('BAND', () => {
  it('minimaal 3 van 4 is gekwalificeerd', () => {
    expect(bandScore({ behoefte: { ja: true }, autoriteit: { ja: false } })).toBe(1)
    expect(bandGekwalificeerd({ behoefte: { ja: true }, autoriteit: { ja: true }, noodzaak: { ja: true } })).toBe(true)
    expect(bandGekwalificeerd({ behoefte: { ja: true }, autoriteit: { ja: true } })).toBe(false)
  })
})
