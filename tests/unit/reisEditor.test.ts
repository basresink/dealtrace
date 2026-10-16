// P22: validatie, fasemapping, fase omzetten zonder kale id's (regel 42), fase verwijderen, droogloop en schoonmaken.
import { describe, expect, it } from 'vitest'
import { standaardReisData, valideerReis, type ReisData } from '../../shared/reis'
import { blokkeertPublicatie, droogloop, faseMapping, mappingFouten, schoonReisData, verwijderFase, zetFaseOm } from '../../shared/reisEditor'

const basis = (): ReisData => ({
  fases: [
    { id: 'a', label: 'Gevonden', hoofdfase: 'vinden', omschrijving: '', volgorde: 1, kleur: 'grijs', accent: '', instap: true },
    { id: 'b', label: 'Benaderd', hoofdfase: 'bewerken', omschrijving: '', volgorde: 2, kleur: 'grijs', accent: '' },
    { id: 'c', label: 'Werkbezoek op project', hoofdfase: 'verbinden', omschrijving: '', volgorde: 3, kleur: 'geel', accent: '' },
    { id: 'o', label: 'Overgedragen', hoofdfase: 'overgedragen', omschrijving: '', volgorde: 4, kleur: 'groen', accent: '', eind: 'overgedragen' },
    { id: 'v', label: 'Verloren', hoofdfase: 'verloren', omschrijving: '', volgorde: 5, kleur: 'rood', accent: '', eind: 'verloren' },
  ],
  overgangen: [
    { id: '1', vanFaseId: 'a', gebeurtenis: 'eerste-contact', naarFaseId: 'b', prioriteit: 1 },
    { id: '2', vanFaseId: 'b', gebeurtenis: 'eerste-afspraak-gehouden', naarFaseId: 'c', prioriteit: 1 },
    { id: '3', vanFaseId: 'c', gebeurtenis: 'overgedragen', naarFaseId: 'o', prioriteit: 1 },
    { id: '4', vanFaseId: 'c', gebeurtenis: 'geen-vervolg', naarFaseId: 'v', prioriteit: 1 },
    { id: '5', vanFaseId: 'b', gebeurtenis: 'geen-vervolg', naarFaseId: 'v', prioriteit: 1 },
  ],
})

describe('valideerReis en blokkeertPublicatie', () => {
  it('een complete reis blokkeert niet; de standaardreis ook niet', () => {
    expect(blokkeertPublicatie(valideerReis(basis()))).toEqual([])
    expect(blokkeertPublicatie(valideerReis(standaardReisData()))).toEqual([])
  })
  it('doodlopend, onbereikbaar, geen eindfases, overgang naar zichzelf, zonder hoofdfase en dubbele naam', () => {
    const d = basis()
    d.overgangen = d.overgangen.filter((x) => x.vanFaseId !== 'c')
    expect(blokkeertPublicatie(valideerReis(d))).toEqual(['Doodlopende fase: Werkbezoek op project', 'Fase onbereikbaar: Overgedragen'])
    const o = basis(); o.overgangen = o.overgangen.filter((x) => x.naarFaseId !== 'c')
    expect(blokkeertPublicatie(valideerReis(o))).toContain('Fase onbereikbaar: Werkbezoek op project')
    const e = basis(); e.fases = e.fases.map((f) => ({ ...f, eind: null })); e.fases[1]!.label = 'Gevonden'; e.fases[2]!.hoofdfase = undefined as any
    e.overgangen.push({ id: 'z', vanFaseId: 'b', gebeurtenis: 'gekwalificeerd', naarFaseId: 'b', prioriteit: 1 })
    const f = valideerReis(e).fouten
    expect(f).toEqual(expect.arrayContaining(['Er is geen eindfase overgedragen', 'Er is geen eindfase verloren', 'Overgang z gaat naar dezelfde fase', 'Fase "Werkbezoek op project" heeft geen geldige hoofdfase', 'Fasenaam "Gevonden" komt twee keer voor']))
  })
})

describe('faseMapping', () => {
  it('zelfde id blijft; verdwenen fase naar dezelfde hoofdfase; eindfase naar eindfase; geen voorstel geeft null', () => {
    const oud = basis()
    const nieuw = basis(); nieuw.fases = nieuw.fases.filter((f) => f.id !== 'c' && f.id !== 'o').concat([{ id: 'c2', label: 'Proefproject', hoofdfase: 'verbinden', omschrijving: '', volgorde: 3, kleur: 'geel', accent: '' }, { id: 'o2', label: 'Over', hoofdfase: 'overgedragen', omschrijving: '', volgorde: 4, kleur: 'groen', accent: '', eind: 'overgedragen' }])
    expect(faseMapping(oud, nieuw)).toEqual({ a: 'a', b: 'b', c: 'c2', o: 'o2', v: 'v' })
    const zonder = basis(); zonder.fases = zonder.fases.filter((f) => f.hoofdfase !== 'verbinden')
    expect(faseMapping(oud, zonder).c).toBeNull()
    expect(mappingFouten({ c: null }, ['c'], zonder)).toEqual(['Kies een nieuwe fase voor c'])
    expect(mappingFouten({ c: 'b' }, ['c'], zonder)).toEqual([])
  })
})

describe('zetFaseOm en verwijderFase (regel 42)', () => {
  it('geen kaal id blijft over in overgangen, regels, accounts of activiteiten', () => {
    const d = basis()
    const z = zetFaseOm({ overgangen: d.overgangen, regels: [{ id: 'r1', faseId: 'c' }], accounts: [{ id: 'x', faseId: 'c' }, { id: 'y', faseId: 'a' }], activiteiten: [{ faseId: 'c', naam: 'Bel', rol: 'alle', actiesoort: 'bellen', termijnWerkdagen: 1, uitvoerder: 'eigenaar' }] }, 'c', 'b')
    const alles = JSON.stringify([z.overgangen, z.regels, z.accounts, z.activiteiten])
    expect(alles).not.toContain('"c"')
    expect(z.aantallen).toEqual({ overgangen: 3, regels: 1, accounts: 1, activiteiten: 1 })
    // De overgang b -> c wordt b -> b en vervalt; dubbele b -> v vervalt ook.
    expect(z.overgangen.some((x) => x.vanFaseId === x.naarFaseId)).toBe(false)
    expect(z.overgangen.filter((x) => x.vanFaseId === 'b' && x.gebeurtenis === 'geen-vervolg')).toHaveLength(1)
  })
  it('verwijderen vraagt een vervangende fase en nummert opnieuw', () => {
    expect(() => verwijderFase(basis(), 'c', '')).toThrow('Kies een vervangende fase')
    expect(() => verwijderFase(basis(), 'c', 'c')).toThrow()
    const d = verwijderFase(basis(), 'c', 'b')
    expect(d.fases.map((f) => [f.id, f.volgorde])).toEqual([['a', 1], ['b', 2], ['o', 3], ['v', 4]])
    expect(JSON.stringify(d.overgangen)).not.toContain('"c"')
  })
})

describe('droogloop', () => {
  const acts = [
    { faseId: 'a', naam: 'Bel', rol: 'binnendienst' as const, actiesoort: 'bellen' as const, termijnWerkdagen: 1, uitvoerder: 'eigenaar' as const },
    { faseId: 'a', naam: 'Dossier', rol: 'alle' as const, actiesoort: 'taak' as const, termijnWerkdagen: 2, uitvoerder: 'eigenaar' as const },
  ]
  it('accounts landen in de instap of via de mapping; taken volgen rol en ritme; andere reizen blijven', () => {
    const r = droogloop(basis(), [
      { id: '1', reisId: 'std', faseId: 'gevonden', ownerId: 'u1', werkplek: 'binnendienst' },
      { id: '2', reisId: 'std', faseId: 'benaderd', ownerId: 'u2', werkplek: 'buitendienst' },
      { id: '3', reisId: 'std', faseId: 'gevonden', ownerId: 'u1', werkplek: 'binnendienst', ritmeActief: true },
      { id: '4', reisId: 'ander', faseId: 'x', ownerId: 'u1' },
    ], acts, { reisId: 'nieuw', mapping: { benaderd: 'b' }, andereReizen: new Set(['ander']) })
    expect(r.accounts).toBe(3)
    expect(r.inAndereReis).toBe(1)
    expect(r.perFase.find((f) => f.faseId === 'a')).toMatchObject({ accounts: 2, taken: 3 })
    expect(r.perFase.find((f) => f.faseId === 'b')).toMatchObject({ accounts: 1, taken: 0 })
    expect(r.perPersoon).toEqual([{ ownerId: 'u1', taken: 3 }])
  })
  it('lege doelgroep', () => expect(droogloop(basis(), [], acts, { reisId: 'n' })).toMatchObject({ accounts: 0, taken: 0 }))
})

describe('schoonReisData', () => {
  it('onbekende velden en gebeurtenissen vallen weg; volgorde opnieuw; geen hoofdfase blijft fout', () => {
    const d = schoonReisData({ fases: [{ id: 'a', label: ' A ', hoofdfase: 'offerte', kleur: 'paars', hack: 1 }], overgangen: [{ vanFaseId: null, gebeurtenis: 'offerte-verstuurd', naarFaseId: 'a' }, { vanFaseId: null, gebeurtenis: 'import', naarFaseId: 'a' }] })
    expect(d.fases[0]).toMatchObject({ id: 'a', label: 'A', volgorde: 1, kleur: 'paars' })
    expect((d.fases[0] as any).hack).toBeUndefined()
    expect(d.fases[0]!.hoofdfase).toBeUndefined()
    expect(d.overgangen.map((x) => x.gebeurtenis)).toEqual(['import'])
  })
})
