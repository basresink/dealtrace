import { describe, expect, it } from 'vitest'
import { controleerProfiel, isJpegOfPng, PROFIEL_MELDING, splitsNaam } from '../../shared/profiel'

describe('profiel op Account (/mij)', () => {
  it('voor- en achternaam zijn verplicht', () => {
    const c = controleerProfiel({ voornaam: ' ', achternaam: 'Jansen' })
    expect(c.ongeldig).toEqual(['voornaam'])
    expect(c.melding).toBe(PROFIEL_MELDING.naamVerplicht)
  })
  it('telefoon en mobiel: cijfers, spaties, plus, haakjes en streepjes', () => {
    expect(controleerProfiel({ voornaam: 'Sanne', achternaam: 'de Wit', telefoon: '+31 (0)20-123 45 67' }).melding).toBeNull()
    const c = controleerProfiel({ voornaam: 'Sanne', achternaam: 'de Wit', mobiel: '06 abc' })
    expect(c.ongeldig).toEqual(['mobiel'])
    expect(c.melding).toBe(PROFIEL_MELDING.telefoonOngeldig)
  })
  it('maakt de invoer schoon en houdt te lange velden tegen', () => {
    expect(controleerProfiel({ voornaam: ' Sanne ', achternaam: 'de Wit', functie: ' Accountmanager ' }).schoon).toEqual({ voornaam: 'Sanne', achternaam: 'de Wit', functie: 'Accountmanager', telefoon: '', mobiel: '' })
    expect(controleerProfiel({ voornaam: 'Sanne', achternaam: 'de Wit', functie: 'x'.repeat(121) }).ongeldig).toEqual(['functie'])
  })
  it('splitst een naam in het eerste woord en de rest', () => {
    expect(splitsNaam('Sanne de Wit')).toEqual({ voornaam: 'Sanne', achternaam: 'de Wit' })
    expect(splitsNaam('Sanne')).toEqual({ voornaam: 'Sanne', achternaam: '' })
  })
  it('herkent jpg en png aan de eerste bytes', () => {
    expect(isJpegOfPng(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0]))).toBe('image/jpeg')
    expect(isJpegOfPng(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe('image/png')
    expect(isJpegOfPng(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))).toBeNull()
  })
})
