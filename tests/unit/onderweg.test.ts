// P30 (test:route): tijdlijn, vertrek, dichtstbijzijnd, aanwezig en de maat van een verkleinde foto.
import { describe, expect, it } from 'vitest'
import { dichtstbijzijnd, isAanwezig, routeVanDag, verkleinMaat, vertrekMoment } from '../../shared/route'

const nu = new Date('2026-10-15T09:00:00Z')
const stop = (id: string, start: string, eind: string, status = 'gepland') => ({ id, start, eind, status, punt: { lat: 52.99, lng: 6.56 } })

describe('routeVanDag', () => {
  it('statussen, geannuleerd weg, kansen als tussenrij na de stop waar ze passen', () => {
    const stops = [stop('a', '2026-10-15T06:00:00Z', '2026-10-15T07:00:00Z', 'afgerond'), stop('b', '2026-10-15T07:30:00Z', '2026-10-15T08:00:00Z'), stop('x', '2026-10-15T08:30:00Z', '2026-10-15T09:00:00Z', 'geannuleerd'),
      stop('c', '2026-10-15T08:45:00Z', '2026-10-15T09:30:00Z'), stop('d', '2026-10-15T10:00:00Z', '2026-10-15T11:00:00Z'), stop('e', '2026-10-15T14:00:00Z', '2026-10-15T15:00:00Z')]
    const r = routeVanDag(stops, [{ id: 'k1', na: 0 }, { id: 'k2', na: 4 }], [null, 20, 30, 15, 40], nu)
    expect(r.map((x) => (x.soort === 'stop' ? `${x.stop.id}:${x.status}` : `kans:${(x.kans as any).id}`))).toEqual(['kans:k1', 'a:afgerond', 'b:zonder-verslag', 'c:bezig', 'd:gepland', 'kans:k2', 'e:gepland'])
    expect((r[3] as any).reistijdNaar).toBe(30)
    // Tussen twee bezoeken in is de volgende stop onderweg.
    const tussen = routeVanDag(stops, [], [], new Date('2026-10-15T07:10:00Z'))
    expect(tussen.filter((x) => x.soort === 'stop').map((x: any) => x.status)).toEqual(['afgerond', 'onderweg', 'gepland', 'gepland', 'gepland'])
  })
  it('geen afspraken: alleen kansen', () => {
    expect(routeVanDag([], [{ id: 'k', na: null }], [], nu)).toEqual([{ soort: 'kans', kans: { id: 'k', na: null } }])
  })
})

describe('vertrekMoment', () => {
  it('rood als vertrek binnen 15 minuten of voorbij', () => {
    expect(vertrekMoment({ start: '2026-10-15T10:00:00Z' }, 24, nu)).toMatchObject({ vertrek: '2026-10-15T09:36:00.000Z', rood: false, minutenTotVertrek: 36 })
    expect(vertrekMoment({ start: '2026-10-15T09:30:00Z' }, 20, nu).rood).toBe(true)
    expect(vertrekMoment({ start: '2026-10-15T09:10:00Z' }, 20, nu).minutenTotVertrek).toBe(-10)
  })
})

describe('dichtstbijzijnd en isAanwezig', () => {
  const plek = { lat: 52.99, lng: 6.56 }
  it('n dichtstbijzijnde op afstand; zonder punt telt niet; gelijke afstand op naam', () => {
    const r = dichtstbijzijnd(plek, [{ naam: 'ver', punt: { lat: 53.2, lng: 6.5 } }, { naam: 'B', punt: { lat: 53.0, lng: 6.56 } }, { naam: 'A', punt: { lat: 53.0, lng: 6.56 } }, { naam: 'geen', punt: null }], 3)
    expect(r.map((x) => x.naam)).toEqual(['A', 'B', 'ver'])
    expect(r[0]!.km).toBeCloseTo(1.1, 1)
  })
  it('binnen 300 m en van 15 minuten voor de start tot het einde', () => {
    const a = { start: '2026-10-15T09:10:00Z', eind: '2026-10-15T10:00:00Z', punt: { lat: 52.991, lng: 6.56 } }
    expect(isAanwezig(plek, a, nu)).toBe(true) // 110 m, 10 minuten voor de start
    expect(isAanwezig(plek, { ...a, punt: { lat: 52.995, lng: 6.56 } }, nu)).toBe(false) // 550 m
    expect(isAanwezig(plek, { ...a, start: '2026-10-15T09:20:00Z' }, nu)).toBe(false) // 20 minuten ervoor
    expect(isAanwezig(plek, a, new Date('2026-10-15T10:01:00Z'))).toBe(false)
    expect(isAanwezig(plek, { ...a, punt: null }, nu)).toBe(false)
  })
})

describe('verkleinMaat', () => {
  it('liggend, staand en kleiner dan 1.600 blijft gelijk', () => {
    expect(verkleinMaat(4000, 3000)).toEqual({ breedte: 1600, hoogte: 1200 })
    expect(verkleinMaat(3000, 4000)).toEqual({ breedte: 1200, hoogte: 1600 })
    expect(verkleinMaat(1200, 900)).toEqual({ breedte: 1200, hoogte: 900 })
  })
})
