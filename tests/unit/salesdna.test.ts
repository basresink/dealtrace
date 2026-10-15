// P29: pure functies van de SalesDNA-koppeling. Handtekening, tijdvenster, dubbel, gat, inhoudelijke
// wijziging (C.9 punt 7), mappen op naam en de spiegel als concept, gelijk aan de eigen startset (C.9 punt 10).
import { describe, expect, it } from 'vitest'
import voltvast from '../../seed/voltvast.json'
import { binnenTijdvenster, heeftGat, isDubbel, isInhoudelijkGewijzigd, isOud, labelVanCode, mapOpNaam, nieuweIds, spiegelNaarConcept, ONDERWERP_NAAR_ONDERDEEL } from '../../shared/salesdna'
import { beloftevoor, startsetConcepten, tekstenUitConcept, verhaalVoor, winpuntVoor, type Onderdeel } from '../../shared/verkoopverhaal'
import { controleerHandtekening, teken, vingerafdruk } from '../../server/utils/salesdnaWebhook'
import { MOCK_FIXTURES } from '../../server/utils/bronnen/salesdna'

describe('handtekening', () => {
  const body = '{"eventId":"evt-1"}'
  it('klopt alleen met hetzelfde geheim en dezelfde bytes', () => {
    const h = teken(body, 'geheim-a')
    expect(h).toMatch(/^sha256=[0-9a-f]{64}$/)
    expect(controleerHandtekening(body, h, 'geheim-a')).toBe(true)
    expect(controleerHandtekening(body, h, 'geheim-b')).toBe(false)
    expect(controleerHandtekening(`${body} `, h, 'geheim-a')).toBe(false)
    expect(controleerHandtekening(Buffer.from(body, 'utf8'), h, 'geheim-a')).toBe(true)
  })
  it('lege body, ontbrekende header of geheim: nee', () => {
    expect(controleerHandtekening('', teken('', 'g'), 'g')).toBe(true)
    expect(controleerHandtekening(body, null, 'g')).toBe(false)
    expect(controleerHandtekening(body, 'sha256=kort', 'g')).toBe(false)
    expect(controleerHandtekening(body, teken(body, 'g'), '')).toBe(false)
  })
  it('vingerafdruk is acht tekens', () => { expect(vingerafdruk('geheim')).toHaveLength(8) })
})

describe('tijdvenster', () => {
  const nu = new Date('2026-10-15T10:00:00Z')
  it('precies 5 minuten mag; ouder of verder in de toekomst niet', () => {
    expect(binnenTijdvenster('2026-10-15T09:55:00Z', nu)).toBe(true)
    expect(binnenTijdvenster('2026-10-15T09:54:59Z', nu)).toBe(false)
    expect(binnenTijdvenster('2026-10-15T12:04:00+02:00', nu)).toBe(true)
    expect(binnenTijdvenster('2026-10-15T10:05:01Z', nu)).toBe(false)
    expect(binnenTijdvenster('geen tijd', nu)).toBe(false)
  })
})

describe('dubbel, gat en oud', () => {
  const bekend = { eventIds: ['evt-1'], versies: ['L0.8:1'] }
  it('zelfde event-id of zelfde onderwerp en versie', () => {
    expect(isDubbel({ eventId: 'evt-1' }, bekend)).toBe(true)
    expect(isDubbel({ eventId: 'evt-2', soort: 'sublaag.bevestigd', onderwerpId: 'L0.8', versie: 1 }, bekend)).toBe(true)
    expect(isDubbel({ eventId: 'evt-2', soort: 'sublaag.bevestigd', onderwerpId: 'L0.8', versie: 2 }, bekend)).toBe(false)
    expect(isDubbel({ eventId: 'evt-3', soort: 'sublaag.verouderd', onderwerpId: 'L0.8', versie: 1 }, bekend)).toBe(false)
  })
  it('4 naar 5 geen gat, 4 naar 6 wel; eerste ontvangst nooit; lager is oud', () => {
    expect(heeftGat(4, 5)).toBe(false)
    expect(heeftGat(4, 6)).toBe(true)
    expect(heeftGat(0, 3)).toBe(false)
    expect(heeftGat(4, 3)).toBe(false)
    expect(isOud(4, 3)).toBe(true)
    expect(isOud(4, 4)).toBe(true)
    expect(isOud(4, 5)).toBe(false)
  })
})

describe('inhoudelijk gewijzigd (C.9 punt 7)', () => {
  const v2 = MOCK_FIXTURES.basis.find((b) => b.onderwerpId === 'L0.4')!
  it('alleen bijgewerktOp: nee; een gewijzigd blok per branche: ja', () => {
    expect(isInhoudelijkGewijzigd(v2, { ...structuredClone(v2), bijgewerktOp: '2026-10-14T00:00:00Z' })).toBe(false)
    expect(isInhoudelijkGewijzigd(v2, MOCK_FIXTURES.los.l04v3)).toBe(true)
    expect(MOCK_FIXTURES.los.l04v3.verouderd).toBe(false)
  })
  it('sleutelvolgorde telt niet', () => {
    expect(isInhoudelijkGewijzigd({ inhoud: { a: 1, b: [1, 2] } }, { inhoud: { b: [1, 2], a: 1 } })).toBe(false)
  })
})

describe('mapOpNaam', () => {
  it('eerst id, dan naam zonder hoofdletters en spaties, anders geen', () => {
    const r = mapOpNaam([{ id: 'br-01', naam: 'A' }, { id: 'eigen-2', naam: 'Utiliteitsinstallateurs ' }, { id: 'eigen-3', naam: 'Iets anders' }],
      [{ id: 'br-01', naam: 'A' }, { id: 'br-02', naam: 'utiliteitsinstallateurs' }])
    expect(r.map((x) => [x.eigenId, x.salesdnaId, x.op])).toEqual([['br-01', 'br-01', 'id'], ['eigen-2', 'br-02', 'naam'], ['eigen-3', null, 'geen']])
  })
  it('een SalesDNA-rij wordt maar één keer gekozen', () => {
    const r = mapOpNaam([{ id: 'x', naam: 'Keten' }, { id: 'y', naam: 'keten' }], [{ id: 'cc-01', naam: 'Keten' }])
    expect(r.filter((x) => x.salesdnaId === 'cc-01')).toHaveLength(1)
  })
  it('nieuweIds', () => { expect(nieuweIds([{ id: 'a' }], [{ id: 'a' }, { id: 'b' }])).toEqual([{ id: 'b' }]) })
})

describe('spiegel als concept (C.9 punt 10)', () => {
  const start = startsetConcepten((voltvast as any).verkoopverhaal)
  const spiegel = Object.fromEntries(MOCK_FIXTURES.basis.map((b) => {
    const o = ONDERWERP_NAAR_ONDERDEEL[b.onderwerpId]!
    return [o, spiegelNaarConcept(o, { inhoud: b.inhoud, context: b.context }, start[o] as any)]
  })) as any
  it('labels uit codes', () => {
    expect(labelVanCode('verloren-offerte')).toBe('Verloren offerte')
    expect(labelVanCode('6-maanden-niet-besteld')).toBe('6 maanden niet besteld')
    expect(labelVanCode('Al een label')).toBe('Al een label')
  })
  it.each(['bedrijfsverhaal', 'ambitie', 'waarde', 'branches'] as Onderdeel[])('%s is gelijk aan de startset', (o) => {
    expect(spiegel[o]).toEqual(start[o])
  })
  it('concurrenten, winpunten en terugkomregels: dezelfde ids en kernvelden', () => {
    expect(spiegel.concurrenten.items.map((x: any) => [x.id, x.naam, x.soort, x.zoZegJeHet, x.antwoord])).toEqual(start.concurrenten.items.map((x) => [x.id, x.naam, x.soort, x.zoZegJeHet, x.antwoord]))
    expect(spiegel.winpunten.fasen).toEqual(start.winpunten.fasen)
    expect(spiegel.winpunten.items.map((w: any) => [w.id, w.faseId, w.impact, w.waarom, w.concurrentIds])).toEqual(start.winpunten.items.map((w) => [w.id, w.faseId, w.impact, w.waarom, w.concurrentIds]))
    const s = (l: any[]) => [...l].sort((a, b) => a.id.localeCompare(b.id)).map((r) => [r.id, r.lijst, r.reden, r.termijn, r.termijnDagen, r.kanaal, r.rollen, r.aanpak])
    expect(s(spiegel.terugkomregels.items)).toEqual(s(start.terugkomregels.items))
  })
  it('zonder huidig concept: termijn in dagen uit de code', () => {
    const b = MOCK_FIXTURES.basis.find((x) => x.onderwerpId === 'L3.14')!
    const c = spiegelNaarConcept('terugkomregels', { inhoud: b.inhoud })
    expect(c.items.find((r) => r.id === 'hc-01')).toMatchObject({ termijn: 'Over een kwartaal', termijnDagen: 91, kanaal: 'Telefoon', rollen: ['Binnendienst'] })
    expect(c.items.find((r) => r.id === 'hc-02')!.kanaal).toBe('E-mail')
  })
  it('C.9 gevallen 1 tot en met 4 geven dezelfde uitkomst', () => {
    const stand = (c: any) => ({ teksten: [...tekstenUitConcept('bedrijfsverhaal', c.bedrijfsverhaal), ...tekstenUitConcept('waarde', c.waarde)], branches: c.branches.items })
    const winp = (c: any) => ({ winpunten: c.winpunten.items.map((w: any) => ({ ...w, onderNorm: false, actief: true, weging: w.weging ?? 1 })), fasen: c.winpunten.fasen })
    for (const br of ['br-01', 'br-03', null]) {
      expect(verhaalVoor({ vvBrancheId: br }, stand(spiegel))).toEqual(verhaalVoor({ vvBrancheId: br }, stand(start)))
      expect(beloftevoor({ vvBrancheId: br }, stand(spiegel))).toEqual(beloftevoor({ vvBrancheId: br }, stand(start)))
    }
    for (const fase of ['fa-01', 'fa-03', 'fa-04']) expect(winpuntVoor(fase, null, winp(spiegel)).winpunt?.id).toBe(winpuntVoor(fase, null, winp(start)).winpunt?.id)
  })
  it('br-02 hernoemd in de testset: zelfde id, nieuwe naam', () => {
    const c = spiegelNaarConcept('branches', { inhoud: MOCK_FIXTURES.los.l06v2.inhoud })
    expect(c.items.find((b) => b.id === 'br-02')!.naam).toBe('Installateurs utiliteitsbouw')
  })
})
