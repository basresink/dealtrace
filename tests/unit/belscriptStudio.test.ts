import { describe, expect, it } from 'vitest'
import {
  SCRIPT_TEMPLATES, STARTSET_SCRIPTS, beslisProspect, filterTemplates, herkomstVoor, lengteMelding, nieuwBlok, onbekendVoor, prospectConcept, prospectGegevens,
  prospectVersieAlsScript, scriptUitTemplate, templateResultaat, templateVanScript, teBeoordelen, valideerScript, verplaatsBlok, voegBlokToe, voegVariabeleIn,
  voorbeeldSegmenten, vulScript, type Belscript,
} from '../../shared/belscripts'

const script: Belscript = { ...STARTSET_SCRIPTS[0]!, id: 's1', versie: 2, status: 'actief' }
const gegevens = prospectGegevens({
  aanleiding: { tekst: 'jullie 64 woningen gaan bouwen', bron: 'web', op: '2026-10-02T08:00:00Z' },
  branche: { naam: 'Installateurs woningbouw', kernzin: 'Monteurs wachten vaak op materiaal.' },
  leverancier: { naam: null }, winpunt: { titel: 'Gratis projectschouw', argument: 'binnen 48 uur op de bouw' },
  contact: { naam: 'Testcontact Een', functie: 'directeur', rol: 'beslisser' },
})

describe('Belscript Studio: standaardscript', () => {
  it('een nieuw blok komt voor de afsluiting; verplaatsen en de volgorde blijft in het voorbeeld', () => {
    const b = nieuwBlok('toestemming', 'nieuw')
    const l = voegBlokToe(script.data.blokken, b)
    expect(l[l.findIndex((x) => x.soort === 'afsluiting') - 1]!.id).toBe('nieuw')
    const om = verplaatsBlok(script.data.blokken, 0, 1)
    expect(om.slice(0, 2).map((x) => x.id)).toEqual(['aanleiding', 'opening'])
    expect(verplaatsBlok(om, 0, -1)).toBe(om)
    expect(vulScript({ data: { ...script.data, blokken: om } }, { waarden: {} }).blokken.slice(0, 2).map((x) => x.id)).toEqual(['aanleiding', 'opening'])
  })
  it('variabele invoegen op de cursor en over de selectie heen', () => {
    expect(voegVariabeleIn('Hallo  daar', 'contact.voornaam', 6)).toEqual({ tekst: 'Hallo {contact.voornaam} daar', cursor: 24 })
    expect(voegVariabeleIn('Hallo X', 'account.naam', 6, 7).tekst).toBe('Hallo {account.naam}')
  })
  it('lengte met richtlijn 150 en maximaal 200', () => {
    expect(lengteMelding(120).stand).toBe('goed')
    expect(lengteMelding(170).stand).toBe('lang')
    expect(lengteMelding(230)).toMatchObject({ stand: 'te_lang', procent: 100 })
  })
  it('voorbeeld: ingevulde en onbekende variabelen met terugvalzin', () => {
    const s = voorbeeldSegmenten('Ik bel {contact.voornaam} over {aanleiding.kort}.', { 'contact.voornaam': 'Pim' })
    expect(s).toEqual([{ tekst: 'Ik bel ' }, { tekst: 'Pim', variabele: 'contact.voornaam' }, { tekst: ' over ' }, { tekst: 'jullie projecten', variabele: 'aanleiding.kort', onbekend: true }, { tekst: '.' }])
    expect(onbekendVoor(script.data, { 'contact.voornaam': 'Pim' })).toContain('voorstel.tijd1')
  })
})

describe('Belscript Studio: templates', () => {
  it('zes templates, elk te activeren zonder onbekende variabelen, met filter en herkomst', () => {
    expect(SCRIPT_TEMPLATES.map((t) => t.id)).toEqual(['koud', 'mail', 'beurs', 'nee', 'bevestig', 'voicemail'])
    for (const t of SCRIPT_TEMPLATES) expect(valideerScript(scriptUitTemplate(t), { activeren: true }).fouten, t.naam).toEqual([])
    expect(filterTemplates(SCRIPT_TEMPLATES, 'nieuw').map((t) => t.id)).toEqual(['koud', 'voicemail'])
    expect(scriptUitTemplate(SCRIPT_TEMPLATES[2]!).data.template).toBe('beurs')
    expect(templateVanScript({ startset: 'start-1', data: {} })).toBe('koud')
    expect(templateVanScript({ startset: null, data: { template: 'nee' } })).toBe('nee')
  })
  it('resultaat alleen bij genoeg gesprekken', () => {
    expect(templateResultaat({ gesprekken: 18, afspraken: 5 })).toMatchObject({ genoeg: false, label: 'Nog te weinig gesprekken (18 van 30)' })
    expect(templateResultaat({ gesprekken: 40, afspraken: 10 }).label).toBe('25% naar afspraak · 40 gesprekken')
  })
})

describe('Belscript Studio: per prospect', () => {
  it('gegevens met bron; wat ontbreekt staat erbij', () => {
    expect(gegevens.find((g) => g.sleutel === 'aanleiding')).toMatchObject({ gebruikt: true })
    expect(gegevens.find((g) => g.sleutel === 'leverancier')).toMatchObject({ gebruikt: false, bron: 'Accountkaart: leverancier onbekend' })
    expect(gegevens.find((g) => g.sleutel === 'tijden')!.gebruikt).toBe(false)
    expect(herkomstVoor('aanleiding', gegevens).map((h) => h.sleutel)).toEqual(['aanleiding'])
    expect(herkomstVoor('vragen', gegevens).map((h) => h.sleutel)).toEqual(['rol'])
  })
  it('AI-blokken zijn voorstellen; zonder besluit geen versie; verwerpen geeft de terugvalzin; aanpassen wordt bewerkt', () => {
    const c = prospectConcept(script, gegevens, { opening: { tekst: 'Goedemorgen {contact.voornaam}, AI-opening.' }, aanleiding: { tekst: 'Ik las dat jullie gaan bouwen.' } })
    expect(c.blokken.find((b) => b.id === 'winpunt')!.status).toBe('geen_voorstel')
    expect(c.blokken.some((b) => b.soort === 'opvolgmail')).toBe(false)
    expect(teBeoordelen(c.blokken)).toBe(2)
    expect(beslisProspect(c.blokken, [{ id: 'opening', status: 'bevestigd' }]).fouten).toEqual(['Nog 1 AI-blok te beoordelen'])
    const r = beslisProspect(c.blokken, [{ id: 'opening', status: 'bevestigd', tekst: 'Goedemorgen {contact.voornaam}, eigen opening.' }, { id: 'aanleiding', status: 'verworpen' }])
    expect(r.fouten).toEqual([])
    expect(r.aangepast).toBe(1)
    expect(r.blokken.find((b) => b.id === 'opening')).toMatchObject({ status: 'bewerkt', tekst: 'Goedemorgen {contact.voornaam}, eigen opening.' })
    expect(r.blokken.find((b) => b.id === 'aanleiding')).toMatchObject({ status: 'verworpen', tekst: 'Ik bel u omdat we veel bedrijven zoals {account.naam} helpen.' })
    // In de belmodus: de beoordeelde tekst, variabelen ingevuld, AI-label en herkomst bij het bevestigde blok.
    const v = prospectVersieAlsScript({ id: 'pv1', versie: 1, belscriptId: 's1', scriptVersie: 2, data: { ...c, blokken: r.blokken } })
    expect(v.aiBlokIds).toEqual(['opening'])
    expect(v.script.versie).toBe(2)
    const ingevuld = vulScript(v.script, { waarden: { 'contact.voornaam': 'Pim', 'account.naam': 'Testbouw' } })
    expect(ingevuld.blokken[0]!.segmenten.map((x) => x.tekst).join('')).toBe('Goedemorgen Pim, eigen opening.')
    expect(ingevuld.blokken[1]!.segmenten.map((x) => x.tekst).join('')).toContain('Testbouw')
  })
})
