import { describe, expect, it } from 'vitest'
import { afspraakTitel, herhalingsDatums } from '../../shared/agenda'
import { magTranscript, ondertitelsNaarTekst, telWoorden, transcriptUitBestand } from '../../shared/transcript'

// Afspraakvenster en plannen in de opzet van DealDrive: herhaling, titel en transcript uit een bestand.
describe('herhaling', () => {
  it('geen herhaling of een einddatum voor de start: alleen de eerste', () => {
    expect(herhalingsDatums('2026-10-19', 'geen', '2026-12-31')).toEqual(['2026-10-19'])
    expect(herhalingsDatums('2026-10-19', 'wekelijks', '2026-10-01')).toEqual(['2026-10-19'])
    expect(herhalingsDatums('19-10-2026', 'wekelijks', '2026-12-31')).toEqual([])
  })
  it('wekelijks en om de week tot en met de einddatum', () => {
    expect(herhalingsDatums('2026-10-19', 'wekelijks', '2026-11-09')).toEqual(['2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09'])
    expect(herhalingsDatums('2026-10-19', 'tweewekelijks', '2026-11-15')).toEqual(['2026-10-19', '2026-11-02'])
  })
  it('maandelijks op dezelfde dag, in een korte maand de laatste dag', () => {
    expect(herhalingsDatums('2027-01-31', 'maandelijks', '2027-04-30')).toEqual(['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30'])
    expect(herhalingsDatums('2026-11-15', 'maandelijks', '2027-01-20')).toEqual(['2026-11-15', '2026-12-15', '2027-01-15'])
  })
  it('hooguit 52 afspraken', () => {
    expect(herhalingsDatums('2026-01-05', 'wekelijks', '2030-01-01')).toHaveLength(52)
  })
  it('titel: eigen titel, anders soort en klant', () => {
    expect(afspraakTitel('  Leverplan bespreken ', 'Kennismaking', 'Testbouw Noord')).toBe('Leverplan bespreken')
    expect(afspraakTitel(null, 'Kennismaking', 'Testbouw Noord')).toBe('Kennismaking · Testbouw Noord')
    expect(afspraakTitel('', 'Weekoverleg new business')).toBe('Weekoverleg new business')
  })
})

describe('transcript uit een bestand', () => {
  it('alleen tekstbestanden en ondertitels', () => {
    expect(magTranscript('gesprek.VTT')).toBe(true)
    expect(magTranscript('notulen.md')).toBe(true)
    expect(magTranscript('notulen.docx')).toBe(false)
    expect(magTranscript('zonder-extensie')).toBe(false)
  })
  it('WebVTT van Teams: sprekers, geen tijdcodes, beurten samengevoegd', () => {
    const vtt = 'WEBVTT\n\n1\n00:00:01.000 --> 00:00:04.000\n<v Anna Test>Goedemorgen, fijn dat je er bent.</v>\n\n2\n00:00:04.500 --> 00:00:07.000\n<v Anna Test>We starten in maart met nieuwbouw.</v>\n\n3\n00:00:07.500 --> 00:00:09.000\n<v Bram Proef>Dan sturen we het leverplan op.</v>\n'
    expect(ondertitelsNaarTekst(vtt)).toBe('Anna Test: Goedemorgen, fijn dat je er bent. We starten in maart met nieuwbouw.\nBram Proef: Dan sturen we het leverplan op.')
  })
  it('SRT met spreker voor de dubbele punt', () => {
    const srt = '1\n00:00:01,000 --> 00:00:03,000\nAnna: Wat kost levering op het uur?\n\n2\n00:00:03,500 --> 00:00:05,000\nBram: Dat rekenen we uit.\n'
    expect(ondertitelsNaarTekst(srt)).toBe('Anna: Wat kost levering op het uur?\nBram: Dat rekenen we uit.')
  })
  it('tekst blijft tekst; woorden geteld', () => {
    const r = transcriptUitBestand('notulen.txt', 'Eerste regel.\r\nTweede regel.\r\n')
    expect(r).toEqual({ tekst: 'Eerste regel.\nTweede regel.', woorden: 4, afgekapt: false })
    expect(telWoorden('  een  twee drie ')).toBe(3)
    expect(telWoorden(null)).toBe(0)
  })
})
