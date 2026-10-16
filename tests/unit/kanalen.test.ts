// P26: kanalen en meldingen. magMelden (grenzen van stille uren, weekend, plafond, belblok), bundel,
// kanalenVoor, houdtVast, magWhatsapp (opt-in, sjabloon, afkoeling 180 dagen, frequentieplafond met
// feestdag), waLink, staatOpBelMeNiet, controleerSjabloon en de webhook-handtekening.
import { describe, expect, it } from 'vitest'
import { binnenFrequentie, bundel, bundelTitel, controleerSjabloon, houdtVast, kanalenVoor, magWhatsapp, staatOpBelMeNiet, tellerTekst, waLink } from '../../shared/kanalen'
import { MELDING_STANDAARD, magMelden } from '../../shared/meldingsregels'
import { controleerWebhook, ontvangStatus, tekenWebhook } from '../../server/utils/bronnen/whatsapp'

// Tijden in Nederland (oktober: UTC+2).
const nl = (d: string, t: string) => new Date(`${d}T${t}:00+02:00`)
const DI = '2026-10-13'

describe('magMelden: stille uren, weekend, plafond en bundelen', () => {
  it('18:59 mag, 19:00 is stil; vertrek vervalt, hete aanleiding wordt uitgesteld tot 07:00', () => {
    expect(magMelden(MELDING_STANDAARD, 'heet', nl(DI, '18:59'), { vandaag: 0 }).versturen).toBe(true)
    expect(magMelden(MELDING_STANDAARD, 'vertrek', nl(DI, '19:00'), { vandaag: 0 })).toMatchObject({ versturen: false, reden: 'Stille uren' })
    const h = magMelden(MELDING_STANDAARD, 'heet', nl(DI, '19:00'), { vandaag: 0 })
    expect(h.uitstellenTot).toBe(nl('2026-10-14', '07:00').toISOString())
  })
  it('zaterdag is stil', () => {
    expect(magMelden(MELDING_STANDAARD, 'heet', nl('2026-10-17', '11:00'), { vandaag: 0 }).versturen).toBe(false)
  })
  it('de zesde onderweg-melding mag, de zevende niet; dagstart telt niet mee', () => {
    expect(magMelden(MELDING_STANDAARD, 'heet', nl(DI, '11:00'), { vandaag: 5 }).versturen).toBe(true)
    expect(magMelden(MELDING_STANDAARD, 'heet', nl(DI, '11:00'), { vandaag: 6 }).reden).toMatch(/Dagplafond/)
    expect(magMelden(MELDING_STANDAARD, 'dagstart', nl(DI, '11:00'), { vandaag: 6 }).versturen).toBe(true)
  })
  it('tijdens belblok of rijmodus: gebundeld', () => {
    expect(magMelden(MELDING_STANDAARD, 'heet', nl(DI, '11:00'), { vandaag: 0, inBelblok: true }).reden).toBe('Belblok: gebundeld')
    expect(magMelden(MELDING_STANDAARD, 'heet', nl(DI, '11:00'), { vandaag: 0, rijmodus: true }).reden).toBe('Rijmodus: gebundeld')
  })
})

describe('bundel en houdtVast', () => {
  it('lege lijst, één melding, en meerdere per soort', () => {
    expect(bundel([])).toEqual([])
    expect(bundel([{ soort: 'hot', titel: 'Hete aanleiding: Testbedrijf' }])).toEqual([{ soort: 'hot', aantal: 1, titel: 'Hete aanleiding: Testbedrijf', tekst: '' }])
    const b = bundel([{ soort: 'herinnering', titel: 'A' }, { soort: 'hot', titel: 'B' }, { soort: 'herinnering', titel: 'C' }, { soort: 'info', titel: 'D' }])
    expect(b.map((x) => [x.soort, x.aantal])).toEqual([['herinnering', 2], ['hot', 1], ['systeem', 1]])
    expect(bundelTitel(b)).toBe('4 meldingen terwijl je bezig was: 2 herinnering, 1 hete aanleiding, 1 dealtrace')
  })
  it('houdtVast: rijmodus, belblok tot het einde, daarna niet meer', () => {
    const nu = nl(DI, '10:00')
    expect(houdtVast({ rijmodus: { aan: true } }, nu)).toBe('rijmodus')
    expect(houdtVast({ stil: { tot: nl(DI, '10:30').toISOString() } }, nu)).toBe('belblok')
    expect(houdtVast({ stil: { tot: nl(DI, '09:30').toISOString() } }, nu)).toBeNull()
  })
})

describe('kanalenVoor en de teller', () => {
  it('standaard, eigen keuze per kanaal, en het oude veld zet een soort helemaal uit', () => {
    expect(kanalenVoor('kritiek', null)).toEqual({ inApp: true, email: true, push: true })
    expect(kanalenVoor('inzicht', null).push).toBe(false)
    expect(kanalenVoor('hot', { hot: { push: false } })).toEqual({ inApp: true, email: false, push: false })
    expect(kanalenVoor('hot', null, { hot: false })).toEqual({ inApp: false, email: false, push: false })
    expect(kanalenVoor('info', null)).toEqual(kanalenVoor('systeem', null))
  })
  it('teller: leeg, getal, 9+', () => {
    expect([tellerTekst(0), tellerTekst(9), tellerTekst(10)]).toEqual(['', '9', '9+'])
  })
})

describe('magWhatsapp', () => {
  const ja = { mobiel: '06 12345678', consent: { whatsapp: { status: 'ja' as const, op: '2026-09-01', bron: 'beurs' } } }
  const sj = { status: 'goedgekeurd' as const }
  const nu = nl(DI, '10:00')
  it('zonder mobiel, zonder opt-in of met onbekend, en zonder goedgekeurd sjabloon: nee', () => {
    expect(magWhatsapp({ ...ja, mobiel: null }, sj, nu).reden).toBe('Geen mobiel nummer bekend')
    expect(magWhatsapp({ ...ja, consent: { whatsapp: { status: 'onbekend' } } }, sj, nu).reden).toBe('Geen consent voor WhatsApp')
    expect(magWhatsapp({ ...ja, consent: { whatsapp: { status: 'nee' } } }, sj, nu).reden).toBe('Geen consent voor WhatsApp')
    expect(magWhatsapp(ja, { status: 'ingediend' }, nu).reden).toBe('Geen goedgekeurd sjabloon')
    expect(magWhatsapp(ja, sj, nu)).toEqual({ mag: true, reden: 'ok' })
  })
  it('afkoeling 180 dagen na een nee: dag 179 nee, dag 180 ja', () => {
    expect(magWhatsapp(ja, sj, nu, { neeOp: '2026-04-17' }).reden).toMatch(/afkoelperiode/)
    expect(magWhatsapp(ja, sj, nu, { neeOp: '2026-04-16' }).mag).toBe(true)
  })
  it('frequentieplafond: één bericht per 3 werkdagen; een feestdag telt niet; binnen het ritme telt niet', () => {
    expect(magWhatsapp(ja, sj, nu, { eerdere: ['2026-10-12'] }).reden).toMatch(/Frequentieplafond/)
    expect(magWhatsapp(ja, sj, nu, { eerdere: ['2026-10-08'] }).mag).toBe(true)
    expect(magWhatsapp(ja, sj, nu, { eerdere: ['2026-10-12'], binnenRitme: true }).mag).toBe(true)
    // Kerst 2026: donderdag 24 december verstuurd; vrijdag 25 (Eerste Kerstdag) en het weekend tellen niet.
    // Maandag 28 en dinsdag 29 zijn twee werkdagen: nog niet. Woensdag 30 is de derde: weer mogen.
    expect(binnenFrequentie(['2026-12-24'], '2026-12-29')).toBe(false)
    expect(binnenFrequentie(['2026-12-24'], '2026-12-30')).toBe(true)
  })
})

describe('waLink en staatOpBelMeNiet', () => {
  it('06 met spaties wordt 31; tekens worden gecodeerd; ongeldig nummer geeft null', () => {
    expect(waLink('06 12 34 56 78', 'Hoi & tot "morgen"?')).toBe('https://wa.me/31612345678?text=Hoi%20%26%20tot%20%22morgen%22%3F')
    expect(waLink('+32 470 12 34 56', 'x')).toBe('https://wa.me/32470123456?text=x')
    expect(waLink('12', 'x')).toBeNull()
    expect(waLink(null, 'x')).toBeNull()
  })
  it('vergelijkt na normalisatie naar E.164', () => {
    expect(staatOpBelMeNiet('06-12000999', ['+31612000999'])).toBe(true)
    expect(staatOpBelMeNiet('0031612000999', ['06 12 00 09 99'])).toBe(true)
    expect(staatOpBelMeNiet('0612000998', ['+31612000999'])).toBe(false)
    expect(staatOpBelMeNiet('onzin', ['+31612000999'])).toBe(false)
  })
})

describe('sjablonen en webhook', () => {
  it('controleerSjabloon: naam, taal, 60 woorden, geen gedachtestreepjes', () => {
    expect(controleerSjabloon({ naam: 'eerste_contact', taal: 'nl', tekst: 'Hoi {{1}}' })).toEqual([])
    expect(controleerSjabloon({ naam: 'Eerste Contact', taal: 'nl', tekst: 'x' })[0]).toMatch(/Naam/)
    expect(controleerSjabloon({ naam: 'lang', taal: 'nl', tekst: Array(61).fill('w').join(' ') })).toEqual(['Hooguit 60 woorden'])
    expect(controleerSjabloon({ naam: 'streep', taal: 'nl', tekst: 'a — b' })).toEqual(['Gebruik geen gedachtestreepjes'])
  })
  it('handtekening: goed, fout en zonder geheim', () => {
    const body = '{"entry":[]}'
    expect(controleerWebhook(body, tekenWebhook(body, 'geheim-123'), 'geheim-123')).toBe(true)
    expect(controleerWebhook(body, tekenWebhook(body, 'ander'), 'geheim-123')).toBe(false)
    expect(controleerWebhook(body, tekenWebhook(body, 'geheim-123'), null)).toBe(false)
  })
  it('ontvangStatus: statussen en STOP als opt-out', () => {
    const s = ontvangStatus({ entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.1', status: 'delivered', recipient_id: '31612345678' }], messages: [{ id: 'wamid.2', from: '31612345678', text: { body: 'STOP' } }, { id: 'wamid.3', from: '31612345678', text: { body: 'Graag' } }] } }] }] })
    expect(s).toEqual([{ externId: 'wamid.1', status: 'afgeleverd', optOut: false, nummer: '+31612345678' }, { externId: 'wamid.2', status: null, optOut: true, nummer: '+31612345678' }])
  })
})
