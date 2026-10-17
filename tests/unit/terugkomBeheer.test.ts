// Instellingen, Terugkomen: de pure rekenregels. Verschuiving bij bewaren, een reden die verhuist,
// "Niet geschikt" nooit, de afkoeling als ondergrens, wie het oppakt en de tijdlijn van een ritme.
import { describe, expect, it } from 'vitest'
import { AFKOELING_STANDAARD } from '../../shared/nbStatus'
import {
  korterDanAfkoeling, leesAfkoeling, oppakkerVan, redenVerhuist, regelUitInvoer, ritmeTijdlijn, termijnTekst, valideerRegel, verschuiving, voorbeeld,
  type Stand, type WachtendeProspect,
} from '../../shared/terugkomBeheer'
import { terugkomDatum, type Terugkomregel } from '../../shared/verkoopverhaal'

const regel = (id: string, reden: string, termijnDagen: number, kanaal: string): Terugkomregel => ({ id, lijst: 'verloren', reden, termijn: '', termijnDagen, kanaal, rollen: ['Binnendienst'], aanpak: 'Bel met een nieuwe aanleiding' })
const stand: Stand = {
  terugkomregels: [regel('hc-01', 'Verloren offerte', 91, 'Telefoon'), regel('hc-02', 'Beslissing uitgesteld', 61, 'E-mail'), regel('hc-03', 'Prijs te hoog', 182, 'Bezoek')],
  redenmapping: [
    { bronSoort: 'nee', reden: 'Verkeerd moment', terugkomregelId: 'hc-02' },
    { bronSoort: 'deal_verloren', reden: 'Prijs', terugkomregelId: 'hc-03' },
    { bronSoort: 'nee', reden: 'Tevreden met huidige leverancier', terugkomregelId: 'hc-01' },
  ],
}
const af = AFKOELING_STANDAARD
const prospect = (id: string, reden: string, op: string, extra: Partial<WachtendeProspect> = {}): WachtendeProspect => {
  const p = { id, naam: `Testprospect ${id}`, reden, bronSoort: 'nee' as const, verlorenOp: `${op}T09:00:00.000Z`, terugOp: '' }
  return { ...p, terugOp: terugkomDatum(reden, stand, new Date(p.verlorenOp), af, 'nee').datum, ...extra }
}

describe('verschuiving', () => {
  const metRegel = (id: string, wijzig: Partial<Terugkomregel>): Stand => ({ ...stand, terugkomregels: stand.terugkomregels.map((r) => (r.id === id ? { ...r, ...wijzig } : r)) })

  it('een langere wachttijd verschuift wie op die regel wacht; anderen niet', () => {
    const p = [prospect('p1', 'Verkeerd moment', '2026-10-01'), prospect('p2', 'Tevreden met huidige leverancier', '2026-10-01')]
    const v = verschuiving(p, { stand, afkoeling: af }, { stand: metRegel('hc-02', { termijnDagen: 120 }), afkoeling: af })
    expect(v).toHaveLength(1)
    expect(v[0]).toMatchObject({ id: 'p1', van: '2026-12-01', naar: '2027-01-29', regelVan: 'hc-02', regelNaar: 'hc-02' })
  })

  it('gestart, met de hand aangepast of een afwijkende opgeslagen datum blijft staan', () => {
    const p = [
      prospect('p1', 'Verkeerd moment', '2026-10-01', { gestart: true }),
      prospect('p2', 'Verkeerd moment', '2026-10-01', { hand: true }),
      prospect('p3', 'Verkeerd moment', '2026-10-01', { terugOp: '2027-03-01' }),
    ]
    expect(verschuiving(p, { stand, afkoeling: af }, { stand: metRegel('hc-02', { termijnDagen: 120 }), afkoeling: af })).toEqual([])
  })

  it('Niet geschikt verschuift nooit, ook niet als de afkoeling verandert', () => {
    const p = [{ id: 'p1', naam: 'Test', reden: 'Niet geschikt', verlorenOp: '2026-10-01T09:00:00.000Z', terugOp: '2027-10-01' }]
    expect(verschuiving(p, { stand, afkoeling: af }, { stand, afkoeling: { ...af, bellen: 400 } })).toEqual([])
  })

  it('de afkoeling is de ondergrens: een kortere wachttijd schuift naar het einde van de afkoeling', () => {
    const p = [prospect('p1', 'Verkeerd moment', '2026-10-01')]
    // 61 dagen mail met afkoeling mail 90: de datum wordt dag 90.
    const v = verschuiving(p, { stand, afkoeling: af }, { stand, afkoeling: { ...af, mail: 90 } })
    expect(v[0]).toMatchObject({ van: '2026-12-01', naar: '2026-12-30' })
  })

  it('een ander kanaal telt ook als verschuiving', () => {
    const p = [prospect('p1', 'Verkeerd moment', '2026-10-01')]
    const v = verschuiving(p, { stand, afkoeling: af }, { stand: metRegel('hc-02', { kanaal: 'Telefoon' }), afkoeling: af })
    expect(v[0]).toMatchObject({ kanaalVan: 'mail', kanaalNaar: 'bellen', naar: '2026-12-30' })
  })
})

describe('redenVerhuist', () => {
  it('een gekozen reden van een andere regel verhuist; een uitgevinkte reden krijgt geen regel', () => {
    const r = redenVerhuist(stand.redenmapping, [{ bronSoort: 'nee', reden: 'Tevreden met huidige leverancier' }], 'hc-02')
    expect(r.verhuisd).toEqual([{ reden: 'Tevreden met huidige leverancier', van: 'hc-01' }])
    expect(r.losgelaten).toEqual(['Verkeerd moment'])
    expect(r.mapping.find((m) => m.reden === 'Verkeerd moment')?.terugkomregelId).toBeNull()
    expect(r.mapping.find((m) => m.reden === 'Tevreden met huidige leverancier')?.terugkomregelId).toBe('hc-02')
  })

  it('een nieuwe reden krijgt een rij; Niet geschikt nooit', () => {
    const r = redenVerhuist(stand.redenmapping, [{ bronSoort: 'nee', reden: 'Geen budget' }, { bronSoort: 'nee', reden: 'Niet geschikt' }, { bronSoort: 'nee', reden: 'Verkeerd moment' }], 'hc-02')
    expect(r.mapping.find((m) => m.reden === 'Geen budget')).toEqual({ bronSoort: 'nee', reden: 'Geen budget', terugkomregelId: 'hc-02' })
    expect(r.mapping.some((m) => m.reden === 'Niet geschikt')).toBe(false)
  })
})

describe('regel en voorbeeld', () => {
  it('voorbeeld: verloren op 2 november met 30 dagen mail en afkoeling 60 wordt terug op 1 januari, opgeschoven', () => {
    const v = voorbeeld({ termijnDagen: 30, kanaal: 'E-mail' }, af, '2026-11-02')
    expect(v).toMatchObject({ dagen: 60, ondergrens: 60, terugOp: '2027-01-01', opgeschoven: true, kanaal: 'mail' })
    expect(korterDanAfkoeling({ termijnDagen: 30, kanaal: 'E-mail' }, af)).toContain('korter dan de afkoeling van 60 dagen')
    expect(korterDanAfkoeling({ termijnDagen: 182, kanaal: 'Bezoek' }, af)).toBeNull()
  })

  it('wie pakt het op: drie keuzes, afgeleid uit de rollen', () => {
    expect(oppakkerVan({ rollen: ['Binnendienst'] })).toBe('binnendienst')
    expect(oppakkerVan({ rollen: ['Accountmanager'] })).toBe('eigenaar')
    expect(oppakkerVan({ oppakker: 'buitendienst', rollen: ['Binnendienst'] })).toBe('buitendienst')
  })

  it('regel uit invoer: kanaal als waarde, termijntekst en de rol als label', () => {
    const r = regelUitInvoer({ id: 'hc-03', lijst: 'verloren', klassen: ['A'] }, { reden: 'Prijs te hoog', termijnDagen: 182, kanaal: 'bezoek', oppakker: 'buitendienst', hercontactritmeId: null, aanpak: 'Langs met een klantverhaal' })
    expect(r).toMatchObject({ kanaal: 'Bezoek', termijn: 'Over een halfjaar', rollen: ['Buitendienst'], klassen: ['A'], oppakker: 'buitendienst' })
    expect(termijnTekst(45)).toBe('Over 45 dagen')
  })

  it('validatie en afkoeling lezen', () => {
    expect(valideerRegel({ reden: '', termijnDagen: -1, kanaal: 'kaart' as any, oppakker: 'iemand' as any, aanpak: '' })).toHaveLength(5)
    expect(leesAfkoeling({ ...af, mail: 731 })).toBeNull()
    expect(leesAfkoeling(af)).toEqual(af)
  })
})

describe('ritmeTijdlijn', () => {
  it('stappen op echte werkdagen en daarna parkeren', () => {
    // Start op vrijdag 6 november 2026; dag 1 is zaterdag en schuift naar maandag 9 november.
    const t = ritmeTijdlijn([{ dagOffset: 0, kanaal: 'bellen' }, { dagOffset: 1, kanaal: 'mail', instructie: 'Mail met een klantverhaal' }], 30, '2026-11-06')
    expect(t.stappen.map((s) => s.datum)).toEqual(['2026-11-06', '2026-11-09'])
    expect(t.stappen[1]!.tekst).toBe('Mail met een klantverhaal')
    expect(t.parkeren).toEqual({ vanaf: '2026-11-08', terugOp: '2026-12-08' })
  })
})
