import { describe, expect, it } from 'vitest'
import { citatenVoor, dekking, geenKring, grootsteRisico, indeling, mockHouding, vermoedelijkeRollen, voorgesteldeStap, type InvloedPersoon } from '../../shared/invloed'

// Invloedskaart (F8): dekking, grootste risico, stap, vermoedelijke rollen, kringen en het organigram.
const p = (id: string, rol: string, extra: Partial<InvloedPersoon> = {}): InvloedPersoon => ({
  id, naam: `${id.charAt(0).toUpperCase()}${id.slice(1)} de Test`, functie: null, rol, houding: 'onbekend', momenten: 0, gesproken: false,
  rapporteertAan: null, zekerheid: null, bron: null, rolBevestigd: false, vermoedelijk: false, onbekend: false, ...extra,
})

describe('dekking', () => {
  it('telt beslisser en beïnvloeder altijd mee, ook zonder contact', () => {
    const d = dekking([p('karin', 'champion', { momenten: 4, gesproken: true })])
    expect(d.totaalRollen).toBe(3)
    expect(d.gesprokenRollen).toBe(1)
    expect(d.titel).toBe('1 van 3 rollen gesproken.')
    expect(d.gehaald).toBe(false)
    expect(d.waarschuwing).toContain('de beslisser en een beïnvloeder')
  })
  it('is gehaald met beslisser en minstens één beïnvloeder gesproken', () => {
    const d = dekking([p('hans', 'beslisser', { gesproken: true, momenten: 1 }), p('erik', 'beinvloeder', { gesproken: true, momenten: 2 }), p('ilse', 'beinvloeder')])
    expect(d.gehaald).toBe(true)
    expect(d.waarschuwing).toBeNull()
    expect(d.procent).toBe(100)
  })
  it('een mail is geen gesprek, en een rol zonder naam telt niet als gesproken', () => {
    const d = dekking([p('hans', 'beslisser', { momenten: 3, gesproken: false }), p('x', 'beinvloeder', { onbekend: true, gesproken: true })])
    expect(d.beslisserGesproken).toBe(false)
    expect(d.beinvloederGesproken).toBe(false)
    expect(d.waarschuwing).toMatch(/^Je sprak de beslisser en een beïnvloeder nog niet/)
  })
  it('telt elke rol één keer en vijf rollen geven 2 van 5', () => {
    const d = dekking([
      p('hans', 'beslisser'), p('karin', 'champion', { gesproken: true, momenten: 4 }), p('erik', 'beinvloeder', { gesproken: true, momenten: 1 }),
      p('ink', 'beslisser', { onbekend: true }), p('fin', 'poortwachter', { onbekend: true }), p('mon', 'gebruiker'),
    ])
    expect(d.titel).toBe('2 van 5 rollen gesproken.')
    expect(d.procent).toBe(40)
  })
})

describe('grootste risico', () => {
  it('één draad: alles via één contact, met de beslisser die nooit gesproken is', () => {
    const r = grootsteRisico([p('hans', 'beslisser', { functie: 'Directeur' }), p('karin', 'champion', { functie: 'Facilitair manager', momenten: 4, gesproken: true })])
    expect(r?.soort).toBe('een-draad')
    expect(r?.label).toBe('Eén draad')
    expect(r?.persoonId).toBe('karin')
    expect(r?.tekst).toBe('Alles loopt via Karin de Test (facilitair manager). De directeur tekent, maar jullie spraken Hans nooit.')
  })
  it('één draad ook als je maar één persoon kent', () => {
    const r = grootsteRisico([p('karin', 'champion', { momenten: 1, gesproken: true })])
    expect(r?.soort).toBe('een-draad')
    expect(r?.tekst).toContain('Je kent nog niemand anders')
  })
  it('geen draad bij twee mensen met contact; dan telt een beslisser of beïnvloeder die tegen is', () => {
    const r = grootsteRisico([p('hans', 'beslisser', { momenten: 1, gesproken: true, houding: 'tegen' }), p('karin', 'champion', { momenten: 2, gesproken: true })])
    expect(r?.soort).toBe('tegenstander')
    expect(r?.persoonId).toBe('hans')
  })
  it('daarna een beslisser met wie je nooit sprak', () => {
    const r = grootsteRisico([p('hans', 'beslisser'), p('karin', 'champion', { momenten: 2, gesproken: true }), p('erik', 'beinvloeder', { momenten: 1, gesproken: true })])
    expect(r?.soort).toBe('beslisser-onbereikt')
  })
  it('zonder contactmomenten: nog geen contact; zonder personen: geen risico', () => {
    expect(grootsteRisico([p('hans', 'beslisser')])?.soort).toBe('geen-contact')
    expect(grootsteRisico([])).toBeNull()
  })
  it('geen risico als beslisser en beïnvloeder gesproken zijn en niemand tegen is', () => {
    expect(grootsteRisico([p('hans', 'beslisser', { momenten: 1, gesproken: true }), p('erik', 'beinvloeder', { momenten: 1, gesproken: true })])).toBeNull()
  })
})

describe('voorgestelde stap', () => {
  it('bij één draad: vraag het contact om de beslisser te betrekken, met het winpunt', () => {
    const ps = [p('hans', 'beslisser', { functie: 'Directeur' }), p('karin', 'champion', { momenten: 4, gesproken: true })]
    const s = voorgesteldeStap(ps, grootsteRisico(ps), 'minder storingen in de nacht')
    expect(s.tekst).toBe('Vraag Karin om de directeur bij de volgende afspraak te betrekken. Gebruik winpunt "minder storingen in de nacht".')
    expect(s.taakTitel).toBe('Vraag Karin om de directeur te betrekken')
    expect(s.contactId).toBe('karin')
  })
  it('een beslisser zonder naam: vraag naar de naam', () => {
    const ps = [p('karin', 'champion', { momenten: 2, gesproken: true }), p('erik', 'beinvloeder', { momenten: 1, gesproken: true }), p('v1', 'beslisser', { onbekend: true, naam: 'Naam onbekend', functie: 'Inkoper' })]
    const s = voorgesteldeStap(ps, grootsteRisico(ps))
    expect(s.tekst).toContain('naar de naam van de inkoper')
  })
})

describe('vermoedelijke rollen', () => {
  it('maakt "Naam onbekend" voor een functie zonder contact, vermoedelijk onder 60', () => {
    const v = vermoedelijkeRollen([
      { functie: 'directeur', rol: 'beslisser', zekerheid: 82 }, { functie: 'inkoper', rol: 'beslisser', zekerheid: 55 }, { functie: 'inkoper', rol: 'beslisser', zekerheid: 50 },
    ], [{ functie: 'Directeur' }])
    expect(v).toHaveLength(1)
    expect(v[0]).toMatchObject({ naam: 'Naam onbekend', functie: 'Inkoper', vermoedelijk: true, onbekend: true, bron: 'Profielbouwer', zekerheid: 55 })
  })
})

describe('rapporteert aan en organigram', () => {
  it('geen kring', () => {
    const ps = [p('a', 'beslisser'), p('b', 'champion', { rapporteertAan: 'a' }), p('c', 'gebruiker', { rapporteertAan: 'b' })]
    expect(geenKring(ps, 'a', 'c')).toBe(false)
    expect(geenKring(ps, 'a', 'a')).toBe(false)
    expect(geenKring(ps, 'c', 'a')).toBe(true)
    expect(geenKring(ps, 'a', null)).toBe(true)
  })
  it('lagen volgen rapporteert-aan, met een lijn per relatie', () => {
    const k = indeling([p('a', 'beslisser'), p('b', 'champion', { rapporteertAan: 'a' }), p('c', 'gebruiker', { rapporteertAan: 'b' })])
    expect(k.knopen.find((x) => x.persoon.id === 'c')?.laag).toBe(2)
    expect(k.lijnen).toHaveLength(2)
  })
  it('zonder relaties: beslisser boven, de rest eronder en geen lijnen', () => {
    const k = indeling([p('a', 'champion'), p('b', 'beslisser'), p('c', 'gebruiker')])
    expect(k.knopen.find((x) => x.persoon.id === 'b')?.laag).toBe(0)
    expect(k.knopen.filter((x) => x.laag === 1)).toHaveLength(2)
    expect(k.lijnen).toHaveLength(0)
  })
})

describe('citaten en de Notulist-mock', () => {
  const verslagen = [
    { tekst: 'Karin zei: "Die nachtelijke storingen kosten ons elke maand een weekend." De directeur tekent.', bron: 'Verslag 8 okt', datum: '2026-10-08', contactId: null },
    { tekst: 'Korte check over de planning met de werkplaats.', bron: 'Belverslag 9 okt', datum: '2026-10-09', contactId: 'erik' },
  ]
  it('vindt zinnen die de persoon noemen of uit een gesprek met de persoon komen', () => {
    expect(citatenVoor({ id: 'karin', naam: 'Karin de Test' }, verslagen)[0]?.tekst).toContain('nachtelijke storingen')
    expect(citatenVoor({ id: 'erik', naam: 'Erik Testvoort' }, verslagen)[0]?.bron).toBe('Belverslag 9 okt')
    expect(citatenVoor({ id: 'hans', naam: 'Hans Testberg' }, verslagen)).toHaveLength(0)
  })
  it('een zin over een ander in een gesprek met de persoon is geen bewijs', () => {
    const v = [{ tekst: 'Erik vond de planning krap. Hans hakt de knoop door.', bron: 'Belverslag', datum: null, contactId: 'erik' }]
    expect(citatenVoor({ id: 'erik', naam: 'Erik Testvoort' }, v, 3, ['Hans Testberg']).map((c) => c.tekst)).toEqual(['Erik vond de planning krap.'])
  })
  it('stelt een houding voor met een letterlijk citaat', () => {
    const r = mockHouding({ personen: [{ persoon: 'P1' }, { persoon: 'P2' }], verslagen: [{ persoon: null, tekst: '[P1] zei: "Die storingen kosten ons elke maand een weekend." [P2] vindt het eerst zien.' }] })
    expect(r.voorstellen).toEqual([
      { persoon: 'P1', houding: 'voor', citaat: '[P1] zei: "Die storingen kosten ons elke maand een weekend."' },
      { persoon: 'P2', houding: 'neutraal', citaat: '[P2] vindt het eerst zien.' },
    ])
  })
})
