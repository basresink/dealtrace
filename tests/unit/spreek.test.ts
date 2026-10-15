// P31 (test:spreek): voorleesteksten (hooguit 60 seconden, geen opsommingstekens), de herkenning
// van "Hoe ging het?", de meldingsregels, de spraakopdracht en het visitekaartje.
import { describe, expect, it } from 'vitest'
import { herkenAntwoord, MAX_WOORDEN, spreekBelOpening, spreekBriefing } from '../../shared/spreek'
import { magMelden, MELDING_STANDAARD, meldingInstelling, naStilte, onderwegMeldingen, vertrekTijd } from '../../shared/meldingsregels'
import { controleerOpdracht, kiesNaam, leesDatum, leesTijd, mockOpdracht } from '../../shared/spraakOpdracht'
import { normaliseerVisitekaartje, visitekaartjeDuplicaat } from '../../shared/ontdubbelen'

const woorden = (t: string) => t.split(/\s+/).filter(Boolean).length
const geenTekens = (t: string) => !/[•·→←*#]|^\s*-\s/m.test(t)

describe('voorleesteksten', () => {
  it('briefing: lege blokken weg, hooguit 150 woorden, geen opsommingstekens', () => {
    const t = spreekBriefing({ accountNaam: 'Testinstallatie Leidingdal', tijd: '10:00', contact: 'Tamara Testleidi', doel: 'Kennismaken', punten: ['• Aanleiding', '', null, ...Array.from({ length: 60 }, (_, i) => `Punt nummer ${i} met wat extra woorden`)] })
    expect(t.startsWith('Briefing voor Testinstallatie Leidingdal om 10:00.')).toBe(true)
    expect(woorden(t)).toBeLessThanOrEqual(MAX_WOORDEN)
    expect(geenTekens(t)).toBe(true)
  })
  it('bel-opening met naam, reden en opening', () => {
    const t = spreekBelOpening({ accountNaam: 'Testzon Paneelveld', contactNaam: 'Kees', reden: 'poging 2 van 4', opening: 'Goedemorgen Kees' })
    expect(t).toBe('Volgende: Kees van Testzon Paneelveld. Reden: poging 2 van 4. Je opening: Goedemorgen Kees. Zeg bel om te bellen.')
  })
  it('herkenAntwoord met varianten', () => {
    expect(herkenAntwoord('Gesproken!')).toBe('gesproken')
    expect(herkenAntwoord('niet opgenomen')).toBe('niet_bereikt')
    expect(herkenAntwoord('geen gehoor')).toBe('niet_bereikt')
    expect(herkenAntwoord('Terugbellen graag')).toBe('terugbellen')
    expect(herkenAntwoord('bel me later terug')).toBe('terugbellen')
    expect(herkenAntwoord('banaan')).toBeNull()
    expect(herkenAntwoord('')).toBeNull()
  })
})

describe('meldingsregels', () => {
  const ma10 = new Date('2026-10-19T08:00:00Z') // maandag 10:00
  it('stille uren en weekend: tijdgebonden meldingen vervallen, de rest wacht tot erna', () => {
    expect(magMelden(MELDING_STANDAARD, 'vertrek', new Date('2026-10-19T18:30:00Z'), { vandaag: 0 })).toMatchObject({ versturen: false, reden: 'Stille uren' })
    const r = magMelden(MELDING_STANDAARD, 'klaargezet', new Date('2026-10-17T10:00:00Z'), { vandaag: 0 }) // zaterdag
    expect(r.uitstellenTot).toBe('2026-10-19T05:00:00.000Z') // maandag 07:00
    expect(naStilte(new Date('2026-10-19T18:30:00Z'), MELDING_STANDAARD).toISOString()).toBe('2026-10-20T05:00:00.000Z')
  })
  it('dagplafond van zes, behalve dagstart en recap; uit per soort; belblok bundelt', () => {
    expect(magMelden(MELDING_STANDAARD, 'briefing', ma10, { vandaag: 6 })).toMatchObject({ versturen: false, reden: 'Dagplafond van 6 bereikt' })
    expect(magMelden(MELDING_STANDAARD, 'recap', ma10, { vandaag: 9 }).versturen).toBe(true)
    expect(magMelden({ ...MELDING_STANDAARD, uit: ['heet'] }, 'heet', ma10, { vandaag: 0 }).versturen).toBe(false)
    expect(magMelden(MELDING_STANDAARD, 'heet', ma10, { vandaag: 0, inBelblok: true }).reden).toBe('Belblok: gebundeld')
    expect(magMelden(MELDING_STANDAARD, 'heet', ma10, { vandaag: 0 }).versturen).toBe(true)
  })
  it('gebruiker zet het plafond alleen lager (Expert); per soort alleen Expert', () => {
    expect(meldingInstelling({ dagplafond: 6 }, { dagplafond: 10 }, true).dagplafond).toBe(6)
    expect(meldingInstelling({ dagplafond: 6 }, { dagplafond: 3 }, true).dagplafond).toBe(3)
    expect(meldingInstelling({ dagplafond: 6 }, { dagplafond: 3 }, false).dagplafond).toBe(6)
    expect(meldingInstelling({}, { perSoort: { heet: { stilVan: 12, stilTot: 13 } } }, false).perSoort).toBeUndefined()
  })
  it('vertrek op reistijd plus 10, briefing 30 vooraf, verslag 15 na het einde zonder verslag', () => {
    const a = { id: 'a', gebruikerId: 'u', accountNaam: 'Bakker', start: '2026-10-19T09:00:00Z', eind: '2026-10-19T10:00:00Z', status: 'gepland', verslag: false, reistijdMin: 24 }
    expect(vertrekTijd(a, 24).toISOString()).toBe('2026-10-19T08:26:00.000Z')
    expect(onderwegMeldingen([a], new Date('2026-10-19T08:27:00Z')).map((d) => d.soort)).toEqual(['vertrek'])
    expect(onderwegMeldingen([a], new Date('2026-10-19T08:37:00Z')).map((d) => d.soort)).toEqual(['briefing'])
    expect(onderwegMeldingen([a], new Date('2026-10-19T10:16:00Z')).map((d) => d.titel)).toEqual(['Hoe ging het bij Bakker?'])
    expect(onderwegMeldingen([{ ...a, verslag: true }], new Date('2026-10-19T10:16:00Z'))).toEqual([])
    expect(onderwegMeldingen([a], new Date('2026-10-19T08:27:00Z'))[0]!.titel).toBe('Vertrek over 10 minuten naar Bakker')
  })
})

describe('spraakopdracht', () => {
  const nu = new Date('2026-10-15T08:00:00Z') // donderdag
  it('datums en tijden uit gewone taal', () => {
    expect(leesDatum('morgen', nu)?.datum).toBe('2026-10-16')
    expect(leesDatum('volgende week dinsdag', nu)?.datum).toBe('2026-10-20')
    expect(leesDatum('dinsdag', nu)?.datum).toBe('2026-10-20')
    expect(leesDatum('vrijdag', nu)?.datum).toBe('2026-10-16')
    expect(leesDatum('volgende week vrijdag', nu)?.datum).toBe('2026-10-23')
    expect(leesDatum('over drie dagen', nu)?.datum).toBe('2026-10-18')
    expect(leesDatum('op 21 oktober', nu)?.label).toBe('woensdag 21 oktober')
    expect(leesDatum('in september', nu)?.datum).toBe('2027-09-01')
    expect(leesDatum('ooit', nu)).toBeNull()
    expect(leesTijd('om 10 uur')).toBe('10:00'); expect(leesTijd('om 3 uur')).toBe('15:00'); expect(leesTijd('half 3')).toBe('14:30'); expect(leesTijd('14.15')).toBe('14:15')
  })
  const accounts = [{ id: 'a1', naam: 'Testinstallatie Leidingdal' }, { id: 'a2', naam: 'Testzon Paneelveld' }, { id: 'a3', naam: 'Testzon Paneelveld Noord' }]
  const contacten = (id: string) => (id === 'a1' ? [{ id: 'c1', naam: 'Tamara Testleidi' }, { id: 'c2', naam: 'Tamara Testvries' }] : [])
  it('kiesNaam: zeker, twijfel en niets', () => {
    expect(kiesNaam('Leidingdal', accounts)).toEqual({ zeker: accounts[0] })
    expect(kiesNaam('Bakker Bouw', accounts)).toEqual({ geen: true })
  })
  it('controle: onbekend account geeft een vraag en geen concept; twee personen geven een keuze; niveau begrenst', () => {
    expect(controleerOpdracht({ soort: 'taak', accountNaam: 'Bakker Bouw', titel: 'Bel Jan' }, accounts, contacten, ['taak', 'notitie'], nu).soort).toBe('fout')
    const p = controleerOpdracht({ soort: 'taak', accountNaam: 'Leidingdal', persoonNaam: 'Tamara', titel: 'Bel Tamara' }, accounts, contacten, ['taak', 'notitie'], nu)
    expect(p.soort).toBe('vraag')
    expect((p as any).kandidaten.map((k: any) => k.naam)).toEqual(['Tamara Testleidi', 'Tamara Testvries'])
    expect(controleerOpdracht({ soort: 'afspraak', accountNaam: 'Leidingdal', titel: 'Kennismaking' }, accounts, contacten, ['taak', 'notitie'], nu)).toMatchObject({ soort: 'fout' })
    const c = controleerOpdracht({ soort: 'afspraak', accountNaam: 'Leidingdal', titel: 'Kennismaking', datum: '2026-10-20' }, accounts, contacten, ['taak', 'notitie', 'afspraak', 'mail'], nu)
    expect(c).toMatchObject({ soort: 'concept', concept: { accountId: 'a1', datum: '2026-10-20', tijd: '10:00' } })
    expect(controleerOpdracht({ soort: 'taak', accountNaam: 'Leidingdal', titel: '' }, accounts, contacten, ['taak'], nu).soort).toBe('fout')
  })
  it('de mock leest werkwoord, account, persoon en datum', () => {
    expect(mockOpdracht('Bel Tamara van Leidingdal volgende week dinsdag over de projectschouw', accounts, nu)).toMatchObject({ soort: 'taak', accountNaam: 'Testinstallatie Leidingdal', persoonNaam: 'Tamara', datum: '2026-10-20' })
    expect(mockOpdracht('Noteer dat de DGA in september terug is', accounts, nu)).toMatchObject({ soort: 'notitie', accountNaam: null, titel: 'De DGA in september terug is' })
  })
})

describe('visitekaartje', () => {
  const tel = (t: string) => (t.replace(/\D/g, '').startsWith('06') ? `+31${t.replace(/\D/g, '').slice(1)}` : null)
  it('normaliseert naam, telefoon en e-mail; ongeldige mail valt weg', () => {
    expect(normaliseerVisitekaartje({ naam: 'peter VAN DER kok', telefoon: '06 1234 5678', email: 'Peter.Kok@Voorbeeld.test' }, tel)).toEqual({ voornaam: 'Peter', achternaam: 'van der Kok', functie: null, bedrijf: null, telefoon: '+31612345678', email: 'peter.kok@voorbeeld.test' })
    expect(normaliseerVisitekaartje({ naam: 'Kok', email: 'geen mail' }, tel)).toMatchObject({ voornaam: null, achternaam: 'Kok', email: null })
  })
  it('dubbel op e-mail of nummer', () => {
    const b = [{ id: 'x', email: 'peter.kok@voorbeeld.test' }, { id: 'y', mobiel: '+31612345678' }]
    expect(visitekaartjeDuplicaat({ email: 'peter.kok@voorbeeld.test', telefoon: null }, b)?.id).toBe('x')
    expect(visitekaartjeDuplicaat({ email: null, telefoon: '+31612345678' }, b)?.id).toBe('y')
    expect(visitekaartjeDuplicaat({ email: 'ander@voorbeeld.test', telefoon: null }, b)).toBeNull()
  })
})
