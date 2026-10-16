// P19: bewijsplicht, ouderdom, taakvoorstel, selectie, concurrenten, heractivatie en het dossier.
import { describe, expect, it } from 'vitest'
import { doorAgentsSamenvatting, dossierCompleet, MAX_PER_REGEL, profielFouten, PROFIEL_STANDAARD, selecteerAccounts, verrijkVelden } from '../../shared/agents'
import { heractivatieToegestaan, magTaakVoorstel, ouderdomStatus, valideerBewijs, vindConcurrenten } from '../../shared/bewijs'

const nu = new Date('2026-10-15T10:00:00Z')
const dagenTerug = (n: number) => new Date(nu.getTime() - n * 864e5).toISOString()

describe('ouderdomStatus', () => {
  it.each([
    ['vacature', 30, 'vers'], ['vacature', 31, 'zacht'], ['vacature', 120, 'zacht'], ['vacature', 121, 'hard'],
    ['nieuws', 90, 'vers'], ['nieuws', 91, 'zacht'], ['nieuws', 365, 'zacht'], ['nieuws', 366, 'hard'],
    ['website', 30, 'vers'], ['website', 31, 'zacht'], ['website', 90, 'zacht'], ['website', 91, 'hard'],
  ] as const)('%s van %i dagen is %s', (soort, dagen, uit) => expect(ouderdomStatus(soort, dagenTerug(dagen), nu)).toBe(uit))
  it('een datum in de toekomst is vers; zonder datum hard', () => {
    expect(ouderdomStatus('nieuws', dagenTerug(-3), nu)).toBe('vers')
    expect(ouderdomStatus('nieuws', null, nu)).toBe('hard')
    expect(ouderdomStatus('nieuws', 'geen datum', nu)).toBe('hard')
  })
})

describe('valideerBewijs', () => {
  const materiaal = 'Installatiebedrijf De Vonk zoekt een   Servicemonteur voor de regio.'
  const urls = ['https://werkenbij.devonk.test/vacatures/servicemonteur']
  it('een citaat met andere witruimte en hoofdletters telt', () => {
    expect(valideerBewijs({ evidence: [{ citaat: 'zoekt een servicemonteur', bron: 'Web' }] }, materiaal, urls).geldig).toBe(true)
  })
  it('een URL met of zonder slash aan het eind telt', () => {
    expect(valideerBewijs({ evidence: [{ citaat: 'zoekt een servicemonteur', bron: 'Web', url: 'https://werkenbij.devonk.test/vacatures/servicemonteur/' }] }, materiaal, urls).geldig).toBe(true)
  })
  it('een verzonnen URL of citaat geeft geldig false', () => {
    const r = valideerBewijs({ evidence: [{ citaat: 'zoekt een servicemonteur', bron: 'Web', url: 'https://verzonnen.test/x' }] }, materiaal, urls)
    expect(r).toEqual({ geldig: false, redenen: ['URL kwam niet uit de zoekresultaten'] })
    expect(valideerBewijs({ evidence: [{ citaat: 'zoekt tien monteurs', bron: 'Web' }] }, materiaal, urls).redenen).toEqual(['Citaat staat niet in het materiaal'])
  })
  it('zonder bewijs geen inzicht', () => expect(valideerBewijs({ evidence: [] }, materiaal, urls)).toEqual({ geldig: false, redenen: ['Geen bewijs'] }))
})

describe('magTaakVoorstel', () => {
  it('zekerheid 59 nee, 60 ja', () => {
    expect(magTaakVoorstel({ zekerheid: 59 }, nu)).toBe(false)
    expect(magTaakVoorstel({ zekerheid: 60 }, nu)).toBe(true)
  })
  it('een zacht verlopen vacature krijgt geen taakvoorstel', () => {
    expect(magTaakVoorstel({ zekerheid: 90, bronSoort: 'vacature', bronDatum: dagenTerug(31) }, nu)).toBe(false)
    expect(magTaakVoorstel({ zekerheid: 90, bronSoort: 'vacature', bronDatum: dagenTerug(30) }, nu)).toBe(true)
  })
})

describe('selecteerAccounts', () => {
  const veel = Array.from({ length: 40 }, (_, i) => ({ id: `a-${String(i).padStart(2, '0')}`, laatstBekeken: i < 5 ? dagenTerug(3) : null }))
  it('hooguit 25 per regel; cadans nog niet verstreken telt niet mee', () => {
    const s = selecteerAccounts(veel, 7, nu)
    expect(s).toHaveLength(MAX_PER_REGEL)
    expect(s.some((a) => a.laatstBekeken)).toBe(false)
  })
  it('minder dan 25 kandidaten; langst niet bekeken eerst', () => {
    const s = selecteerAccounts([{ id: 'b', laatstBekeken: dagenTerug(8) }, { id: 'a', laatstBekeken: dagenTerug(20) }, { id: 'c', laatstBekeken: dagenTerug(2) }], 7, nu)
    expect(s.map((a) => a.id)).toEqual(['a', 'b'])
  })
})

describe('vindConcurrenten', () => {
  const cc = [{ id: 'cc-02', naam: 'Online webgroothandel' }, { id: 'cc-01', naam: 'Technische Unie B.V.' }, { id: 'cc-x', naam: 'Uni' }]
  it('vindt een naam met B.V. en hoofdletters', () => {
    const r = vindConcurrenten('Het materiaal komt nu via online Webgroothandel en Technische Unie.', cc)
    expect(r.map((c) => c.id)).toEqual(['cc-02', 'cc-01'])
    expect(r[0]!.fragment).toContain('Webgroothandel')
  })
  it('deel van een woord telt niet; lege lijst', () => {
    expect(vindConcurrenten('Een onlinewebgroothandelaar is iets anders.', cc)).toEqual([])
    expect(vindConcurrenten('Online webgroothandel', [])).toEqual([])
  })
})

describe('heractivatieToegestaan', () => {
  const nee = (op: string) => ({ nbStatus: 'nee', data: { nee: { op, reden: 'Geen interesse', afkoeling: { bellen: 90, mail: 60 } } } })
  it('binnen de afkoelperiode niet, na de afkoelperiode wel', () => {
    expect(heractivatieToegestaan(nee(dagenTerug(30).slice(0, 10)), 'bellen', nu)).toBe(false)
    expect(heractivatieToegestaan(nee(dagenTerug(90).slice(0, 10)), 'bellen', nu)).toBe(true)
  })
  it('een account in reis haalt een trigger niet terug', () => expect(heractivatieToegestaan({ nbStatus: 'in reis' }, 'bellen', nu)).toBe(false))
})

describe('profiel, dossier en verrijken', () => {
  it('cadans korter dan wekelijks is een fout', () => {
    expect(profielFouten(PROFIEL_STANDAARD)).toEqual([])
    expect(profielFouten({ ...PROFIEL_STANDAARD, cadansDagen: 6 })).toEqual(['De cadans is minimaal wekelijks (7 dagen of meer)'])
  })
  it('dossier compleet zodra alle zes criteria een oordeel hebben', () => {
    const c: any = { branche: { oordeel: 'ja' }, omvang: { oordeel: 'nee' }, locatie: { oordeel: 'ja' }, leverancier: { oordeel: 'ja' }, aanleiding: { oordeel: 'ja' } }
    expect(dossierCompleet(c)).toBe(false)
    expect(dossierCompleet({ ...c, beslisser: { oordeel: 'onbekend' } })).toBe(false)
    expect(dossierCompleet({ ...c, beslisser: { oordeel: 'nee' } })).toBe(true)
  })
  it('geen telefoonnummer zonder bron; een patroon is een aanname', () => {
    const v = verrijkVelden([
      { veld: 'telefoon', waarde: '010 000 0000' },
      { veld: 'telefoon', waarde: '010 000 0000', aanname: true },
      { veld: 'emailpatroon', waarde: 'voornaam@devonk.test', aanname: true },
      { veld: 'medewerkers', waarde: '45', bron: 'KvK' },
    ])
    expect(v.overnemen.map((x) => x.veld)).toEqual(['medewerkers'])
    expect(v.aannames.map((x) => x.veld)).toEqual(['emailpatroon'])
    expect(v.geweigerd).toHaveLength(2)
  })
  it('door agents gedaan: één regel, alleen uitgevoerd', () => {
    expect(doorAgentsSamenvatting([])).toBeNull()
    expect(doorAgentsSamenvatting([
      { agent: 'verrijker', handeling: 'dossier', uitkomst: 'uitgevoerd' }, { agent: 'verrijker', handeling: 'dossier', uitkomst: 'uitgevoerd' },
      { agent: 'waarnemer', handeling: 'inzicht', uitkomst: 'uitgevoerd' }, { agent: 'waarnemer', handeling: 'inzicht:tegengehouden', uitkomst: 'geblokkeerd' },
    ])).toBe('2 dossiers ververst · 1 nieuwe aanleiding')
  })
})

describe('extra bronnen voor de Waarnemer (webBron)', () => {
  it('de mock geeft per URL en per week een vaste pagina; de vingerafdruk negeert de datum', async () => {
    const { haalVolgbron, vingerafdruk } = await import('../../server/utils/webBron')
    const a = await haalVolgbron('https://blog.voorbeeld.test/nieuws', nu)
    const b = await haalVolgbron('https://blog.voorbeeld.test/nieuws', new Date(nu.getTime() + 864e5))
    expect(a).toMatchObject({ url: 'https://blog.voorbeeld.test/nieuws', titel: 'Nieuw op blog.voorbeeld.test', datum: '2026-10-15' })
    expect(a!.tekst).toMatch(/^Op blog\.voorbeeld\.test staat een nieuw bericht over /)
    expect(vingerafdruk(a!.tekst)).toBe(vingerafdruk(b!.tekst))
    expect(vingerafdruk('Een. Bijgewerkt op 2026-10-01.')).not.toBe(vingerafdruk('Twee. Bijgewerkt op 2026-10-01.'))
  })
})
