// P28: de pure functies van het verkoopverhaal. Verhaal, belofte en winpunt per account (C.9 geval 1
// tot en met 4), dekking per branche, kernzin, verouderingsregel, namenfilter en de startset.
import { describe, expect, it } from 'vitest'
import voltvast from '../../seed/voltvast.json'
import {
  LEEG_CONCEPT, beloftevoor, dekking, filterNamen, kernzin, moetControleren, ontbrekendeVelden, startsetConcepten,
  teveelHoog, tekstenUitConcept, verhaalVoor, winpuntVoor, type VerkoopverhaalStand, type Winpunt,
} from '../../shared/verkoopverhaal'

const vv = (voltvast as any).verkoopverhaal
const c = startsetConcepten(vv)
const teksten = [...tekstenUitConcept('bedrijfsverhaal', c.bedrijfsverhaal), ...tekstenUitConcept('waarde', c.waarde)]
const branches = c.branches.items.map((b) => ({ id: b.id, naam: b.naam, focus: b.focus }))
const stand = { teksten, branches } as Pick<VerkoopverhaalStand, 'teksten' | 'branches'>
const wp = (id: string, faseId: string | null, extra: Partial<Winpunt> = {}): Winpunt => ({ id, titel: id, omschrijving: '', faseId, weging: 1, onderNorm: false, actief: true, impact: 'midden', concurrentIds: [], ...extra })
const fasen = c.winpunten.fasen.map((f) => ({ id: f.id, naam: f.naam }))

describe('verhaalVoor (C.9 geval 1)', () => {
  it('branche met eigen verhaal geeft het brancheblok', () => {
    const r = verhaalVoor({ vvBrancheId: 'br-01' }, stand)
    expect(r.brancheBlok).toBe(true)
    expect(r.gat).toBeNull()
    expect(r.tekst).toBe(c.bedrijfsverhaal.perBranche!['br-01'])
  })
  it('branche zonder eigen verhaal valt terug op het algemene, met zichtbaar gat', () => {
    const r = verhaalVoor({ vvBrancheId: 'br-03' }, stand)
    expect(r.brancheBlok).toBe(false)
    expect(r.tekst).toBe(c.bedrijfsverhaal.wieZijnWij)
    expect(r.gat).toBe('Voor Woningcorporaties (via installateurs) is nog geen eigen verhaal; je ziet het algemene verhaal.')
  })
  it('zonder branche: algemeen verhaal zonder gat', () => {
    expect(verhaalVoor({}, stand)).toMatchObject({ brancheBlok: false, gat: null })
  })
})

describe('beloftevoor', () => {
  it('eigen belofte voor br-01, algemene met gat voor br-02', () => {
    expect(beloftevoor({ vvBrancheId: 'br-01' }, stand)).toMatchObject({ brancheBlok: true, kernbelofte: c.waarde.perBranche!['br-01']!.kernbelofte })
    const r = beloftevoor({ vvBrancheId: 'br-02' }, stand)
    expect(r).toMatchObject({ brancheBlok: false, kernbelofte: c.waarde.kernbelofte, waardestatement: c.waarde.waardestatement })
    expect(r.gat).toContain('Utiliteitsinstallateurs')
  })
})

describe('winpuntVoor (C.9 geval 2 tot en met 4)', () => {
  const winpunten = [wp('wp-a', 'fa-03', { impact: 'hoog' }), wp('wp-b', 'fa-03', { impact: 'laag', concurrentIds: ['cc-01'] }), wp('wp-c', 'fa-05')]
  it('kiest binnen de fase op impact', () => {
    expect(winpuntVoor('fa-03', null, { winpunten, fasen }).winpunt?.id).toBe('wp-a')
  })
  it('een bekende concurrent gaat voor impact', () => {
    expect(winpuntVoor('fa-03', 'cc-01', { winpunten, fasen }).winpunt?.id).toBe('wp-b')
  })
  it('een fase zonder winpunt toont het gat en valt terug op een ander winpunt', () => {
    const r = winpuntVoor('fa-01', null, { winpunten, fasen })
    expect(r.gat).toBe('Geen winpunt in Signaal')
    expect(r.winpunt).not.toBeNull()
  })
  it('zonder actieve winpunten: geen winpunt (terugval op de belofte)', () => {
    expect(winpuntVoor('fa-03', null, { winpunten: [wp('x', 'fa-03', { actief: false })], fasen }).winpunt).toBeNull()
  })
})

describe('dekking', () => {
  it('Voltvast: 2 van 4 branches met eigen verhaal, 1 van 4 met eigen belofte', () => {
    expect(dekking('bedrijfsverhaal', stand)).toEqual({ met: 2, totaal: 4, tekst: '2 van 4 branches hebben een eigen verhaal' })
    expect(dekking('waarde', stand).tekst).toBe('1 van 4 branches hebben een eigen belofte')
  })
})

describe('kernzin', () => {
  it('de eerste zin; afkortingen sluiten geen zin af', () => {
    expect(kernzin('Wij leveren o.a. kabels en buizen. Daarna meer.')).toBe('Wij leveren o.a. kabels en buizen.')
    expect(kernzin('Prijs is 3.5 per meter! Echt.')).toBe('Prijs is 3.5 per meter!')
    expect(kernzin('Zonder punt')).toBe('Zonder punt')
    expect(kernzin(null)).toBe('')
  })
})

describe('minimale velden en verouderingsregel', () => {
  it('lege concepten missen de minimale velden', () => {
    expect(ontbrekendeVelden('golden_circle', LEEG_CONCEPT.golden_circle)).toEqual(['Waarom', 'Hoe'])
    expect(ontbrekendeVelden('ambitie', {})).toEqual(['Visie'])
    expect(ontbrekendeVelden('branches', { items: [] })).toEqual(['Minstens één branche'])
    expect(ontbrekendeVelden('concurrenten', { items: [{ id: 'x', naam: 'Keten', soort: 'direct' }] })).toEqual(['Keten: onderscheid', 'Keten: Zo zeg je het', 'Keten: Als de prospect zegt'])
  })
  it('de startset is compleet behalve de golden circle', () => {
    expect(ontbrekendeVelden('golden_circle', c.golden_circle).length).toBe(2)
    for (const o of ['bedrijfsverhaal', 'ambitie', 'waarde', 'branches', 'concurrenten', 'winpunten', 'terugkomregels'] as const) expect(ontbrekendeVelden(o, c[o] as any), o).toEqual([])
  })
  it('hooguit drie winpunten op impact hoog', () => {
    const items = [1, 2, 3, 4].map((i) => ({ id: `w${i}`, faseId: 'fa-01', titel: 't', omschrijving: 'o', impact: 'hoog' as const }))
    expect(teveelHoog({ fasen: [], items: items.slice(0, 3) })).toBe(false)
    expect(teveelHoog({ fasen: [], items })).toBe(true)
    expect(teveelHoog({ fasen: [], items: [...items.slice(0, 3), { ...items[3]!, actief: false }] })).toBe(false)
  })
  it('branches of een andere kernbelofte zetten concurrenten en winpunten op Controleren', () => {
    expect(moetControleren('branches')).toEqual(['concurrenten', 'winpunten'])
    expect(moetControleren('waarde', { kernbelofte: 'a' }, { kernbelofte: 'b' })).toEqual(['concurrenten', 'winpunten'])
    expect(moetControleren('waarde', { kernbelofte: 'a', waardestatement: 'x' }, { kernbelofte: 'a', waardestatement: 'y' })).toEqual([])
    expect(moetControleren('concurrenten')).toEqual([])
  })
})

describe('filterNamen', () => {
  it('namen worden de rol; een naam als deel van een woord blijft staan', () => {
    const namen = [{ naam: 'Sanne de Vries', rol: 'de inkoper' }, { naam: 'Piet', rol: 'de directeur' }]
    expect(filterNamen('Sanne de Vries belde, Piet ook.', namen)).toBe('de inkoper belde, de directeur ook.')
    expect(filterNamen('Vries vond het goed', namen)).toBe('de inkoper vond het goed')
    expect(filterNamen('Pietersen en Sannetje', namen)).toBe('Pietersen en Sannetje')
  })
})

describe('startsetConcepten', () => {
  it('neemt de vier branches, vijf fasen en de terugkomregels letterlijk over', () => {
    expect(c.branches.items.map((b) => b.id)).toEqual(['br-01', 'br-02', 'br-03', 'br-04'])
    expect(c.winpunten.fasen).toHaveLength(5)
    expect(c.terugkomregels.items.length).toBe(vv.vv_terugkomregels.length)
    expect(c.concurrenten.items.every((x) => ['direct', 'indirect', 'intern', 'niets'].includes(x.soort))).toBe(true)
  })
  it('tekstenUitConcept geeft stabiele ids', () => {
    expect(tekstenUitConcept('bedrijfsverhaal', c.bedrijfsverhaal).map((t) => t.id)).toContain('tx-L0.1-verhaal-br-01')
  })
})
