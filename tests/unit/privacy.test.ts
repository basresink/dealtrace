// Pakket E: bewaartermijnen, CSV, zip, factuurgegevens, factuur-pdf en de controle op het organisatielogo.
import { describe, expect, it } from 'vitest'
import {
  BEWAAR_SOORTEN, BEWAAR_STANDAARD, csvCel, EXPORT_ONDERDELEN, exportBestandsnaam, grensdatum, leesBewaartermijnen, naarCsv,
  termijnTekst, valideerBewaartermijnen, VASTE_TERMIJNEN, vervaltZin,
} from '../../shared/privacy'
import { factuurAdresRegels, factuurgegevensCompleet, leesFactuurgegevens, valideerFactuurgegevens } from '../../shared/facturatie'
import { controleerLogo, LOGO_MAX_BYTES } from '../../shared/organisatieLogo'
import { maakZip } from '../../server/utils/zip'
import { factuurPdf } from '../../server/utils/factuurPdf'
import { leesZip } from '../../server/utils/documentTekst'

const tekst = (s: string) => new TextEncoder().encode(s)

describe('bewaartermijnen', () => {
  it('elke soort heeft uitleg, gevolg en een standaard die een van zijn keuzes is', () => {
    for (const d of BEWAAR_SOORTEN) {
      expect(d.uitleg.length).toBeGreaterThan(20)
      expect(d.gevolg.length).toBeGreaterThan(10)
      expect(d.keuzes).toContain(d.standaard)
      expect(d.keuzes).toContain(null)
    }
    expect(Object.keys(BEWAAR_STANDAARD).sort()).toEqual(['activiteiten', 'gearchiveerdeGebruikers', 'gedeactiveerdeProspects', 'verslagen'])
  })

  it('leest een opgeslagen waarde en valt per soort terug op de standaard', () => {
    expect(leesBewaartermijnen(null)).toEqual(BEWAAR_STANDAARD)
    expect(leesBewaartermijnen({ activiteiten: 12, verslagen: 7, gearchiveerdeGebruikers: null })).toEqual({ ...BEWAAR_STANDAARD, activiteiten: 12, gearchiveerdeGebruikers: null })
  })

  it('valideert: alleen bekende soorten met een bestaande keuze', () => {
    expect(valideerBewaartermijnen({ activiteiten: 60, verslagen: null }).waarde).toEqual({ ...BEWAAR_STANDAARD, activiteiten: 60, verslagen: null })
    const fout = valideerBewaartermijnen({ activiteiten: 7, iets: 3 })
    expect(fout.waarde).toBeNull()
    expect(fout.fouten.join(' ')).toMatch(/Onbekende soort: iets/)
    expect(fout.fouten.join(' ')).toMatch(/Activiteiten: kies 1 jaar, 2 jaar, 3 jaar, 5 jaar, niet opschonen/)
    expect(valideerBewaartermijnen([]).waarde).toBeNull()
    expect(valideerBewaartermijnen('x').waarde).toBeNull()
  })

  it('termijn in gewone taal en zinnen zonder gedachtestreepjes', () => {
    expect(termijnTekst(6)).toBe('6 maanden')
    expect(termijnTekst(12)).toBe('1 jaar')
    expect(termijnTekst(36)).toBe('3 jaar')
    expect(termijnTekst(null)).toBe('niet opschonen')
    expect(vervaltZin({ naam: 'Activiteiten' }, 24, 3)).toBe('Activiteiten: 3 zouden vervallen, ouder dan 2 jaar.')
    expect(vervaltZin({ naam: 'Verslagen' }, 12, 1)).toBe('Verslagen: 1 zou vervallen, ouder dan 1 jaar.')
    expect(vervaltZin({ naam: 'Verslagen' }, 12, 0)).toBe('Verslagen: niets ouder dan 1 jaar.')
    expect(vervaltZin({ naam: 'Verslagen' }, null, 9)).toMatch(/blijven staan/)
    const alles = [...BEWAAR_SOORTEN.flatMap((d) => [d.naam, d.uitleg, d.gevolg, d.vanaf]), ...VASTE_TERMIJNEN.flatMap((v) => [v.onderwerp, v.termijn, v.gevolg]), ...EXPORT_ONDERDELEN.map((o) => o.naam)].join(' ')
    expect(alles).not.toMatch(/[–—]/)
  })

  it('grensdatum telt maanden terug en houdt het einde van een korte maand aan', () => {
    expect(grensdatum(new Date('2026-10-17T12:00:00Z'), 24).toISOString()).toBe('2024-10-17T12:00:00.000Z')
    expect(grensdatum(new Date('2026-03-31T08:00:00Z'), 1).toISOString()).toBe('2026-02-28T08:00:00.000Z')
    expect(grensdatum(new Date('2026-01-15T00:00:00Z'), 3).toISOString()).toBe('2025-10-15T00:00:00.000Z')
  })
})

describe('export: csv en zip', () => {
  it('csv-cel: puntkomma, aanhalingstekens, json en geen formules', () => {
    expect(csvCel(null)).toBe('')
    expect(csvCel('a;b')).toBe('"a;b"')
    expect(csvCel('zei "ja"')).toBe('"zei ""ja"""')
    expect(csvCel({ a: 1 })).toBe('"{""a"":1}"')
    expect(csvCel('=SOM(A1)')).toBe("'=SOM(A1)")
    expect(csvCel('-12')).toBe("'-12")
    expect(csvCel(-12)).toBe('-12')
    expect(csvCel(new Date('2026-01-02T03:04:05Z'))).toBe('2026-01-02T03:04:05.000Z')
  })

  it('naarCsv: BOM, kop en een regel per rij', () => {
    const c = naarCsv(['id', 'naam'], [{ id: 'a', naam: 'Testbedrijf; Noord' }, { id: 'b', naam: null }])
    expect(c.startsWith('﻿id;naam\r\n')).toBe(true)
    expect(c).toContain('a;"Testbedrijf; Noord"\r\n')
    expect(c).toContain('b;\r\n')
  })

  it('maakZip schrijft een zip die een andere lezer (centrale map) terugleest', () => {
    const groot = 'x'.repeat(50_000)
    const zip = maakZip([{ naam: 'accounts.csv', inhoud: 'id;naam\r\n1;Café Oost\r\n' }, { naam: 'instellingen.json', inhoud: '{"a":1}' }, { naam: 'groot.txt', inhoud: groot }])
    expect(zip.subarray(0, 4).toString('hex')).toBe('504b0304')
    const terug = leesZip(zip)
    expect([...terug.keys()]).toEqual(['accounts.csv', 'instellingen.json', 'groot.txt'])
    expect(terug.get('accounts.csv')!.toString('utf8')).toContain('Café Oost')
    expect(terug.get('groot.txt')!.length).toBe(50_000)
    expect(zip.length).toBeLessThan(5_000)
  })

  it('bestandsnaam van de export', () => {
    expect(exportBestandsnaam('Testbedrijf Voltvast', new Date('2026-10-17T10:00:00Z'))).toBe('dealtrace-export-testbedrijf-voltvast-2026-10-17.zip')
    expect(exportBestandsnaam('Ça & Zo!', new Date('2026-10-17T10:00:00Z'))).toBe('dealtrace-export-ca-zo-2026-10-17.zip')
  })
})

describe('factuurgegevens', () => {
  const goed = { bedrijfsnaam: ' Testbedrijf  Voltvast ', adres: 'Teststraat 1', postcode: '1234ab', plaats: 'Teststad', land: 'NL', kvk: '1234 5678', btw: 'nl123456789b01', email: 'Facturen@Voltvast.test' }
  it('maakt schoon en keurt goed', () => {
    const r = valideerFactuurgegevens(goed)
    expect(r.fouten).toEqual({})
    expect(r.waarde).toMatchObject({ bedrijfsnaam: 'Testbedrijf Voltvast', postcode: '1234 AB', kvk: '12345678', btw: 'NL123456789B01', email: 'facturen@voltvast.test' })
    expect(factuurgegevensCompleet(r.waarde)).toBe(true)
    expect(factuurAdresRegels(r.waarde)).toEqual(['Testbedrijf Voltvast', 'Teststraat 1', '1234 AB Teststad', 'Nederland', 'KvK 12345678', 'Btw NL123456789B01'])
  })
  it('fouten per veld in gewone taal', () => {
    const r = valideerFactuurgegevens({ ...goed, bedrijfsnaam: '', postcode: '12', kvk: '123', btw: 'NL12', email: 'geen-mail' })
    expect(Object.keys(r.fouten).sort()).toEqual(['bedrijfsnaam', 'btw', 'email', 'kvk', 'postcode'])
    expect(r.fouten.btw).toMatch(/NL123456789B01/)
  })
  it('België: andere postcode, ondernemingsnummer en btw', () => {
    expect(valideerFactuurgegevens({ ...goed, land: 'BE', postcode: '2000', kvk: '0123456789', btw: 'BE0123456789' }).fouten).toEqual({})
    expect(valideerFactuurgegevens({ ...goed, land: 'BE', postcode: '1234 AB' }).fouten.postcode).toBeTruthy()
  })
  it('leest een onbekende waarde als leeg en een onbekend land als NL', () => {
    expect(leesFactuurgegevens({ land: 'DE', bedrijfsnaam: 3 })).toMatchObject({ land: 'NL', bedrijfsnaam: '' })
  })
})

describe('factuur als pdf', () => {
  it('een geldige pdf met nummer, bedragen en adres', () => {
    const g = valideerFactuurgegevens({ bedrijfsnaam: 'Testbedrijf (Noord)', adres: 'Teststraat 1', postcode: '1234 AB', plaats: 'Teststad', land: 'NL', kvk: '', btw: '', email: 'facturen@voltvast.test' }).waarde
    const pdf = factuurPdf({ nummer: 'DT-202610-TEST', bedragCent: 12100, btwCent: 2100, status: 'open', op: '2026-10-01T10:00:00Z', vervaltOp: '2026-10-15', betaaldOp: null, regels: [{ description: 'Abonnement', amount: 10000 }] }, g, 'Testbedrijf')
    const s = pdf.toString('latin1')
    expect(s.startsWith('%PDF-1.4')).toBe(true)
    expect(s.trimEnd().endsWith('%%EOF')).toBe(true)
    expect(s).toContain('(DT-202610-TEST)')
    expect(s).toContain('(Testbedrijf \\(Noord\\))')
    expect(s).toContain('\x80 121,00')
    // De xref wijst naar de echte posities van de objecten.
    const start = Number(/startxref\n(\d+)/.exec(s)![1])
    expect(s.slice(start, start + 4)).toBe('xref')
    const eerste = Number(/0000000000 65535 f \n(\d{10})/.exec(s)![1])
    expect(s.slice(eerste, eerste + 7)).toBe('1 0 obj')
  })
})

describe('organisatielogo', () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])
  it('herkent png, jpg en een schone svg', () => {
    expect(controleerLogo(png)).toEqual({ ok: true, mime: 'image/png' })
    expect(controleerLogo(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0]))).toEqual({ ok: true, mime: 'image/jpeg' })
    expect(controleerLogo(tekst('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#000"/></svg>'))).toEqual({ ok: true, mime: 'image/svg+xml' })
  })
  it('weigert een ander bestandstype, een te groot bestand en een svg met script of verwijzing', () => {
    expect(controleerLogo(tekst('GIF89a....'))).toMatchObject({ ok: false, fout: expect.stringMatching(/geen png, jpg of svg/) })
    expect(controleerLogo(tekst('%PDF-1.4'))).toMatchObject({ ok: false })
    expect(controleerLogo(new Uint8Array(0))).toMatchObject({ ok: false })
    const groot = new Uint8Array(LOGO_MAX_BYTES + 1)
    groot.set(png)
    expect(controleerLogo(groot)).toMatchObject({ ok: false, fout: expect.stringMatching(/te groot/) })
    for (const svg of [
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><rect/></a></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://elders.test/x.png"/></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div/></foreignObject></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg"><style>@import url(https://elders.test/a.css);</style></svg>',
    ]) expect(controleerLogo(tekst(svg)).ok, svg).toBe(false)
  })
  it('een verwijzing binnen de svg zelf (#id) mag', () => {
    expect(controleerLogo(tekst('<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g"/></defs><rect fill="url(#g)"/><use href="#g"/></svg>')).ok).toBe(true)
  })
})
