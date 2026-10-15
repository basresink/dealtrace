// P32: de rekenkern van Vandaag (test:dag, test:ritme, test:signalen, test:recap, test:spreek).
// Eén fixturedag (Voltvast, fictief): drie afspraken, vijf belacties, een terugkomregel vandaag.
import { describe, expect, it } from 'vitest'
import { bouwDag, heeftVervolg, navigeerLink, telLink, type DagBron } from '../../shared/dag'
import { bepaalVorm, groetMetVorm, kiesFocus, kiesTip, LEGE_FOCUS } from '../../shared/dagritme'
import { nlTijdstip } from '../../shared/datum'
import { bouwRecap } from '../../shared/recap'
import { detecteerSignalen, governor, stilTot, type BesluitRij } from '../../shared/signalen'
import { MAX_WOORDEN, spreekDag, spreekRecap, voorHetOor } from '../../shared/spreek'
import { tabVoorRoute, tabsVoor } from '../../shared/onderbalk'

const DAG = '2026-10-15' // donderdag
const om = (u: number, m = 0, d = DAG) => nlTijdstip(d, u, m).toISOString()
const t = (id: string, actionType: string, dueDate: string | null, extra: Record<string, any> = {}) => ({ id, title: `Taak ${id}`, actionType, status: 'open', ownerId: 'u-05', accountId: extra.accountId ?? 'a1', dueDate, priority: 'middel', data: {}, ...extra })
function fixture(): DagBron {
  return {
    accounts: [
      { id: 'a1', naam: 'Testinstallatie Leidingdal', ownerId: 'u-05', faseId: 'afspraak-gepland', adres: 'Testlaan 12', plaats: 'Assen' },
      { id: 'a2', naam: 'Testinstallatie Buizerd', ownerId: 'u-05', faseId: 'in-gesprek', adres: null, plaats: 'Zwolle' },
      { id: 'a3', naam: 'Testzon Paneelveld', ownerId: 'u-05', faseId: 'gekwalificeerd' },
      { id: 'a4', naam: 'Testinstallatie Thermiek', ownerId: 'u-05', faseId: 'afspraak-gehouden' },
      { id: 'c1', naam: 'Account van een collega', ownerId: 'u-01' },
    ],
    contacten: [
      { id: 'k1', accountId: 'a3', naam: 'Sven Testlicht', rol: 'beslisser', mobiel: '06 12 34 56 78' },
      { id: 'k2', accountId: 'a2', naam: 'Nadia Testberg', rol: 'gebruiker', telefoon: '038-1234567' },
    ],
    taken: [
      t('af1', 'bezoek', om(10), { accountId: 'a1', data: { soort: 'afspraak' } }),
      t('af2', 'bezoek', om(13, 30), { accountId: 'a2' }),
      t('af3', 'bezoek', om(15, 30), { accountId: 'a3' }),
      t('b1', 'bellen', om(9, 0, '2026-10-14'), { accountId: 'a3' }),
      t('b2', 'bellen', om(11), { accountId: 'a2', data: { poging: { n: 2, van: 4 } } }),
      t('b3', 'bellen', om(14), { accountId: 'a3' }),
      t('b4', 'bellen', om(9, 0, '2026-10-16'), { accountId: 'a3' }),
      t('x1', 'taak', om(9), { accountId: 'a1', title: 'Afspraak bevestigen met Testinstallatie Leidingdal' }),
      t('m1', 'mailen', om(12), { accountId: 'a2' }),
      t('col', 'bellen', om(9), { accountId: 'a1', ownerId: 'u-01' }),
    ],
  }
}
const nu = (u: number, m = 0) => nlTijdstip(DAG, u, m)
const lieke = { id: 'u-05', werkplek: 'buitendienst' }

describe('test:dag', () => {
  it('alleen eigen werk; achterstand alleen vandaag; vier stapels', () => {
    const d = bouwDag(fixture(), lieke, DAG, nu(8))
    expect(d.stapels.bellen.map((r) => r.taakId)).toEqual(['b1', 'b2', 'b3'])
    expect(d.stapels.bellen.some((r) => r.taakId === 'col')).toBe(false)
    expect(d.stapels.bellen[0]!.achterstallig).toBe(true)
    expect(d.stapels.afspraken.map((r) => r.taakId)).toEqual(['af1', 'af2', 'af3'])
    expect(d.stapels.acties.map((r) => r.taakId).sort()).toEqual(['m1', 'x1'])
    expect(d.stapels.eersteAfspraken.map((r) => [r.accountId, r.knop])).toEqual([['a1', 'bevestig'], ['a4', 'overdragen']])
    expect(d.telstrip.map((s) => [s.sleutel, s.aantal, s.achterstand])).toEqual([['afspraken', 3, 0], ['bellen', 3, 1], ['acties', 4, 0], ['kansen', 0, 0]])
    expect(d.volgorde[0]).toBe('afspraken')
  })
  it('binnendienst: belstapel bovenaan', () => {
    expect(bouwDag(fixture(), { id: 'u-05', werkplek: 'binnendienst' }, DAG, nu(8)).volgorde[0]).toBe('bellen')
  })
  it('morgen: alleen die dag, geen achterstand', () => {
    const d = bouwDag(fixture(), lieke, '2026-10-16', nu(8))
    expect(d.isVandaag).toBe(false)
    expect(d.stapels.bellen.map((r) => r.taakId)).toEqual(['b4'])
    expect(d.achterstand).toBe(0)
  })
  it('lege dag', () => {
    const d = bouwDag({ taken: [], accounts: [], contacten: [] }, lieke, DAG, nu(8))
    expect(d.telstrip.every((s) => s.aantal === 0 && s.achterstand === 0)).toBe(true)
  })
  it('een contacttaak is een contacttaak (afronden vraagt een uitkomst)', () => {
    const d = bouwDag(fixture(), lieke, DAG, nu(8))
    expect(d.stapels.acties.find((r) => r.taakId === 'm1')!.contactTaak).toBe(true)
    expect(d.stapels.acties.find((r) => r.taakId === 'x1')!.contactTaak).toBe(false)
  })
  it('telLink: mobiel eerst, E.164, geen nummer', () => {
    expect(telLink({ mobiel: '06 12 34 56 78', telefoon: '038-1234567' })).toBe('tel:+31612345678')
    expect(telLink({ telefoon: '038-1234567' })).toBe('tel:+31381234567')
    expect(telLink({ telefoon: '+32 2 123 45 67' })).toBe('tel:+3221234567')
    expect(telLink({ telefoon: '0031 6 1234 5678' })).toBe('tel:+31612345678')
    expect(telLink({})).toBeNull()
    expect(telLink({ telefoon: 'onbekend' })).toBeNull()
  })
  it('belregel zonder nummer draagt de reden', () => {
    const d = bouwDag(fixture(), lieke, DAG, nu(8))
    const r = d.stapels.acties.find((x) => x.taakId === 'x1')!
    expect(r.contact).toBeNull()
    expect(d.stapels.bellen.find((x) => x.taakId === 'b2')!.contact).toMatchObject({ naam: 'Nadia Testberg', tel: 'tel:+31381234567' })
  })
  it('navigeerLink en heeftVervolg', () => {
    expect(navigeerLink({ adres: 'Testlaan 12', plaats: 'Assen' })).toContain('Testlaan%2012')
    expect(navigeerLink({})).toBeNull()
    const b = fixture()
    expect(heeftVervolg(b, 'a1', nu(8))).toBe(true)
    b.accounts.push({ id: 'stil', naam: 'Stil', ownerId: 'u-05', laatsteContactOp: '2026-10-01T10:00:00Z' })
    expect(heeftVervolg(b, 'stil', nu(8))).toBe(false)
    b.accounts.push({ id: 'vers', naam: 'Vers', ownerId: 'u-05', laatsteContactOp: '2026-10-12T10:00:00Z' })
    expect(heeftVervolg(b, 'vers', nu(8))).toBe(true)
  })
  it('/?dag= hoort bij Vandaag', () => { const tabs = tabsVoor('buitendienst', 'accountmanager'); expect(tabVoorRoute('/?dag=2026-10-16', tabs)).toBe(0); expect(tabVoorRoute('/', tabs)).toBe(0) })
})

describe('test:ritme', () => {
  it('regel 1: komende eerste afspraak met navigeren', () => {
    const f = kiesFocus(bouwDag(fixture(), lieke, DAG, nu(8)), nu(8))!
    expect(f.regel).toBe('1-eerste-afspraak')
    expect(f.knop).toMatchObject({ soort: 'navigeer', tekst: 'Navigeer naar Testinstallatie Leidingdal' })
  })
  it('regel 2: de eerste komende afspraak; op het eindtijdstip is hij geweest', () => {
    expect(kiesFocus(bouwDag(fixture(), lieke, DAG, nu(12)), nu(12))).toMatchObject({ regel: '2-afspraak', accountId: 'a2' })
    const f = kiesFocus(bouwDag(fixture(), lieke, DAG, nu(14, 30)), nu(14, 30))
    expect(f).toMatchObject({ regel: '2-afspraak', accountId: 'a3' })
  })
  it('regel 2b: 22:41 met alleen voorbije afspraken: verslag', () => {
    const f = kiesFocus(bouwDag(fixture(), lieke, DAG, nu(22, 41)), nu(22, 41))!
    expect(f.regel).toBe('2b-verslag')
    expect(f.knop.tekst).toBe('Leg het verslag vast')
    expect(f.verslagVan).toBe('af1')
  })
  it('regel 2c: de poging die vandaag moet; regel 3 de zwaarste achterstallige; regel 4 overdragen', () => {
    const b = fixture()
    b.taken = b.taken.filter((x) => x.actionType !== 'bezoek')
    expect(kiesFocus(bouwDag(b, lieke, DAG, nu(8)), nu(8))).toMatchObject({ regel: '2c-poging', taakId: 'b2' })
    b.taken = b.taken.filter((x) => x.id !== 'b2')
    expect(kiesFocus(bouwDag(b, lieke, DAG, nu(8)), nu(8))).toMatchObject({ regel: '3-achterstallig', taakId: 'b1', knop: { soort: 'bel', href: 'tel:+31612345678' } })
    b.taken = []
    expect(kiesFocus(bouwDag(b, lieke, DAG, nu(8)), nu(8))).toMatchObject({ regel: '4-overdragen', accountId: 'a4' })
    b.accounts = []
    expect(kiesFocus(bouwDag(b, lieke, DAG, nu(8)), nu(8))).toBeNull()
    expect(LEGE_FOCUS.knop.tekst).toBe('Open de bellijst')
  })
  it('geen focus op een andere dag', () => {
    expect(kiesFocus(bouwDag(fixture(), lieke, '2026-10-16', nu(8)), nu(8))).toBeNull()
  })
  it('bepaalVorm: maandag weekstart; vrijdag 14:59 dagstart, 15:00 weekafsluiting', () => {
    expect(bepaalVorm(nlTijdstip('2026-10-12', 8))).toBe('weekstart')
    expect(bepaalVorm(nlTijdstip('2026-10-16', 14, 59))).toBe('dagstart')
    expect(bepaalVorm(nlTijdstip('2026-10-16', 15))).toBe('weekafsluiting')
    expect(bepaalVorm(nu(8))).toBe('dagstart')
    expect(groetMetVorm('Goedemorgen, Lieke.', 'weekstart')).toBe('Goedemorgen, Lieke. Een nieuwe week.')
  })
  it('kiesTip: na 18:00 niets; drie achterstallig; lege dag; anders een vaste tip per dag', () => {
    expect(kiesTip({ nu: nu(18), achterstallig: 0, leeg: false })).toBeNull()
    expect(kiesTip({ nu: nu(9), achterstallig: 3, leeg: false })).toContain('oudste achterstallige')
    expect(kiesTip({ nu: nu(9), achterstallig: 0, leeg: true })).toContain('belblok')
    expect(kiesTip({ nu: nu(9), achterstallig: 0, leeg: false })).toBe(kiesTip({ nu: nu(16), achterstallig: 0, leeg: false }))
  })
})

describe('test:signalen', () => {
  const basis = (relevantie: number, dagenOud: number) => ({
    inzichten: [{ id: 's1', accountId: 'a1', ownerId: 'u-05', title: 'Nieuwe bouwvergunning', relevanceScore: relevantie, status: 'nieuw', createdAt: new Date(nu(8).getTime() - dagenOud * 864e5).toISOString() }],
    accounts: fixture().accounts, taken: [] as any[],
  })
  it('koopsignaal: 14 dagen oud wel, 15 niet; relevantie 60 wel, 59 niet', () => {
    expect(detecteerSignalen(basis(60, 14), { id: 'u-05' }, nu(8)).map((s) => s.soort)).toContain('koopsignaal')
    expect(detecteerSignalen(basis(60, 15), { id: 'u-05' }, nu(8)).map((s) => s.soort)).not.toContain('koopsignaal')
    expect(detecteerSignalen(basis(59, 1), { id: 'u-05' }, nu(8)).map((s) => s.soort)).not.toContain('koopsignaal')
  })
  it('terugkomregel vandaag, ritme achter en reis stil', () => {
    const b = basis(10, 1)
    b.accounts = [...b.accounts, { id: 't1', naam: 'Testinstallatie Pompstation', ownerId: 'u-05', nbStatus: 'nee', terugOp: DAG }, { id: 'r1', naam: 'Stil BV', ownerId: 'u-05', nbStatus: 'in reis', laatsteContactOp: '2026-10-05T10:00:00Z' }]
    b.taken = [{ ...t('p1', 'bellen', om(9, 0, '2026-10-12'), { accountId: 'a3', data: { poging: { n: 2, van: 4 } } }) }]
    const s = detecteerSignalen(b, { id: 'u-05' }, nu(8))
    expect(s.map((x) => x.soort)).toEqual(['terugkomregel', 'ritme-achter', 'reis-stil'])
    expect(s[0]!.titel).toBe('Testinstallatie Pompstation komt vandaag terug')
  })
  it('governor: dagplafond 4; stilte na Weg 1, Later 3, Gedaan 30 dagen, precies op de grens', () => {
    const sig = detecteerSignalen(basis(80, 1), { id: 'u-05' }, nu(8))
    const op = nu(9)
    const b = (besluit: 'weg' | 'later' | 'gedaan', sleutel = 'koop:s1'): BesluitRij => ({ sleutel, besluit, op: op.toISOString(), stilTot: stilTot(besluit, op) })
    expect(stilTot('weg', op)).toBe('2026-10-16')
    expect(stilTot('later', op)).toBe('2026-10-18')
    expect(stilTot('gedaan', op)).toBe('2026-11-14')
    expect(governor(sig, [b('weg')], nu(10))).toBeNull()
    expect(governor(sig, [b('weg')], nlTijdstip('2026-10-16', 8))?.sleutel).toBe('koop:s1')
    expect(governor(sig, [b('later')], nlTijdstip('2026-10-17', 8))).toBeNull()
    expect(governor(sig, [b('later')], nlTijdstip('2026-10-18', 8))).not.toBeNull()
    const vier = ['x1', 'x2', 'x3', 'x4'].map((k) => b('weg', k))
    expect(governor(sig, vier, nu(10))).toBeNull()
    expect(governor(sig, vier.slice(0, 3), nu(10))).not.toBeNull()
  })
})

describe('test:recap', () => {
  const bron = { zonderVerslag: [{ accountNaam: 'A', taakId: 'x' }, { accountNaam: 'B', taakId: 'y' }], morgenTerug: [{ id: 'p', naam: 'Testinstallatie Pompstation' }], achterstallig: 1, reisStil: 2, week: { gesprekken: 12, afspraken: 3, overgedragen: 1 } }
  it('voor 16:00 niets, vanaf 16:00 wel', () => {
    expect(bouwRecap(bron, 'expert', nu(15, 59))).toBeNull()
    expect(bouwRecap(bron, 'beginner', nu(16))!.regels).toEqual(['2 gesprekken zonder verslag', 'Morgen komt 1 account terug: Testinstallatie Pompstation'])
  })
  it('per niveau: kort, met risico\'s, met weekterugblik', () => {
    expect(bouwRecap(bron, 'beginner', nu(17))!.risicos).toEqual([])
    expect(bouwRecap(bron, 'gevorderd', nu(17))).toMatchObject({ risicos: ['1 actie achterstallig', '2 reizen staan stil'], week: null })
    expect(bouwRecap(bron, 'expert', nu(17))!.week).toBe('Deze week: 12 gesprekken, 3 afspraken, 1 overgedragen.')
    expect(bouwRecap(bron, 'expert', nlTijdstip('2026-10-16', 16), 'weekafsluiting')!.titel).toBe('De week in het kort')
  })
})

describe('test:spreek', () => {
  it('hooguit 150 woorden, hele zinnen, zonder opsommingstekens', () => {
    const d = bouwDag(fixture(), lieke, DAG, nu(8))
    const tekst = spreekDag(d, kiesFocus(d, nu(8)), 'Goedemorgen, Lieke.', { signaal: { titel: 'Nieuwe bouwvergunning bij Testinstallatie Leidingdal' }, recap: bouwRecap({ zonderVerslag: [], morgenTerug: [], achterstallig: 1, reisStil: 0 }, 'gevorderd', nu(17)) })
    expect(tekst.split(/\s+/).length).toBeLessThanOrEqual(MAX_WOORDEN)
    expect(tekst).not.toMatch(/[•·→*#]/)
    expect(tekst).toMatch(/\.$/)
    expect(tekst).toContain('drie afspraken')
    expect(tekst).toContain('Je eerste afspraak is om 10:00 bij Testinstallatie Leidingdal')
  })
  it('een lange dag wordt ingekort op hele zinnen', () => {
    const lang = spreekRecap({ titel: 'De dag in het kort', regels: Array.from({ length: 40 }, (_, i) => `Regel ${i} met een aantal woorden erin`), verslagen: 0, morgen: 0, risicos: [], week: null })
    expect(lang.split(/\s+/).length).toBeLessThanOrEqual(MAX_WOORDEN)
    expect(lang).toMatch(/erin\.$/)
  })
  it('bedragen uitgeschreven', () => { expect(voorHetOor('Omzet € 1.250,50 · 3 deals')).toBe('Omzet 1250 euro en 50 cent 3 deals') })
})

describe('telefoon en laptop rekenen hetzelfde', () => {
  it('dezelfde bron geeft dezelfde focus en telling, ongeacht wie rekent', () => {
    const a = bouwDag(fixture(), lieke, DAG, nu(12))
    const b = bouwDag(JSON.parse(JSON.stringify(fixture())), lieke, DAG, nu(12))
    expect(kiesFocus(a, nu(12))).toEqual(kiesFocus(b, nu(12)))
    expect(a.telstrip).toEqual(b.telstrip)
  })
})
