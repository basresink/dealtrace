// Status prospect (koud, lauw, warm, heet), het label, de dekkingsbak, de uitkomstgroep en de dagen in een
// funnelfase voor de vensters op Mijn dashboard en /funnel.
import { describe, expect, it } from 'vitest'
import { dekkingBak, uitkomstGroep } from '../../shared/dashboard'
import { dagenInFunnelFase } from '../../shared/funnel'
import { labelDef, ordenLabels } from '../../shared/labels'
import { isProspectStatus, PROSPECT_STATUSSEN, prospectStatusUit, telPerStatus } from '../../shared/prospectStatus'

describe('status prospect', () => {
  it('kent vier keuzes in vaste volgorde', () => {
    expect([...PROSPECT_STATUSSEN]).toEqual(['koud', 'lauw', 'warm', 'heet'])
    expect(isProspectStatus('warm')).toBe(true)
    expect(isProspectStatus('Heet')).toBe(false)
    expect(isProspectStatus(null)).toBe(false)
    expect(prospectStatusUit({ prospectStatus: 'lauw' })).toBe('lauw')
    expect(prospectStatusUit({ prospectStatus: 'gloeiend' })).toBeNull()
    expect(prospectStatusUit(null)).toBeNull()
  })

  it('telt per status met procent van wie een status heeft, en apart wie er geen heeft', () => {
    const t = telPerStatus(['koud', 'warm', 'warm', 'heet', null, 'onzin', undefined])
    expect(t.kolommen.map((k) => [k.sleutel, k.aantal])).toEqual([['koud', 1], ['lauw', 0], ['warm', 2], ['heet', 1]])
    expect(t.kolommen.find((k) => k.sleutel === 'warm')!.procent).toBe(50)
    expect(t.zonder).toBe(3)
    expect(t.totaal).toBe(7)
    expect(telPerStatus([]).kolommen.every((k) => k.procent === 0)).toBe(true)
  })

  it('label: zacht met icoon; koud cyaan, lauw grijs, warm oranje, heet rood', () => {
    const tint = Object.fromEntries(PROSPECT_STATUSSEN.map((s) => [s, labelDef('prospectstatus', s)]))
    expect(tint.koud).toMatchObject({ tekst: 'Koud', stijl: 'zacht', tint: 'cyaan', icoon: 'Snowflake' })
    expect(tint.lauw).toMatchObject({ tekst: 'Lauw', stijl: 'zacht', tint: 'grijs', icoon: 'Thermometer' })
    expect(tint.warm).toMatchObject({ tekst: 'Warm', stijl: 'zacht', tint: 'oranje', icoon: 'Sun' })
    expect(tint.heet).toMatchObject({ tekst: 'Heet', stijl: 'zacht', tint: 'rood', icoon: 'Flame' })
    expect(labelDef('prospectstatus', null)).toBeNull()
  })

  it('in een rij staat de status prospect na de status', () => {
    const l = ordenLabels([{ soort: 'prospectstatus', waarde: 'heet' }, { soort: 'status', waarde: 'in reis' }])
    expect(l.map((x) => x.soort)).toEqual(['status', 'prospectstatus'])
  })
})

describe('vensters op Mijn dashboard', () => {
  const nu = new Date('2026-10-17T10:00:00Z')
  it('dekkingsbak: dagen sinds laatste contact, zonder contact de koudste bak', () => {
    expect(dekkingBak('2026-10-15T10:00:00Z', nu).sleutel).toBe('7')
    expect(dekkingBak('2026-10-05T10:00:00Z', nu).sleutel).toBe('14')
    expect(dekkingBak('2026-08-01T10:00:00Z', nu).sleutel).toBe('90')
    expect(dekkingBak(null, nu).sleutel).toBe('meer')
  })
  it('uitkomstgroep: gelijke groepen voor verwante uitkomsten, onbekend is zonder uitkomst', () => {
    expect(uitkomstGroep('terugbellen')).toEqual({ sleutel: 'later', label: 'Later terugbellen' })
    expect(uitkomstGroep('bezet').sleutel).toBe('geen')
    expect(uitkomstGroep(null)).toEqual({ sleutel: 'overig', label: 'Zonder uitkomst' })
  })
})

describe('dagen in een funnelfase', () => {
  const periode = { van: '2026-10-01T00:00:00Z', tot: '2026-10-31T23:59:59Z' }
  const nu = new Date('2026-10-20T00:00:00Z')
  it('tot de volgende wissel, ook na de periode; wie er nog staat telt tot nu', () => {
    const m = dagenInFunnelFase([
      { accountId: 'a', naarFaseId: 'benaderd', gebeurtenis: 'x', op: '2026-10-02T00:00:00Z' },
      { accountId: 'a', naarFaseId: 'in-gesprek', gebeurtenis: 'x', op: '2026-10-07T00:00:00Z' },
      { accountId: 'b', naarFaseId: 'benaderd', gebeurtenis: 'x', op: '2026-10-10T00:00:00Z' },
      { accountId: 'c', naarFaseId: 'benaderd', gebeurtenis: 'x', op: '2026-09-10T00:00:00Z' },
      { accountId: 'd', naarFaseId: 'gevonden', gebeurtenis: 'x', op: '2026-10-03T00:00:00Z' },
    ], periode, 'benaderd', nu)
    expect(m.get('a')).toEqual({ dagen: 5, nogInFase: false })
    expect(m.get('b')).toEqual({ dagen: 10, nogInFase: true })
    expect(m.has('c')).toBe(false)
    expect(m.has('d')).toBe(false)
  })
})
