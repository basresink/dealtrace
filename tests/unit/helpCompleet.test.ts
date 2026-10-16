// P25: helpcenter compleet. De inhoud zelf (elke categorie geldig, geen gedachtestreepjes, elk new
// business-artikel met de vijf onderdelen en drie controlevragen, geen offertes of pipeline), elke feature
// een artikel in "Hoe werkt Dealtrace", en de pure functies: controlevragen, leestijd, zichtbaarheid,
// citatenGeldig, vulVerhaal, controleerArtikel en artikelVoorRoute.
import { describe, expect, it } from 'vitest'
import { helpBestanden } from '../../server/db/helpStart'
import { FUNCTIES, featureGroep } from '../../shared/functies'
import { AAN_DE_SLAG, CATEGORIEEN_NEWBUSINESS, CATEGORIEEN_WERVEN, COLLECTIES, HELPCENTER_GERESERVEERD, VERHAAL_LEEG, WERVEN_BRONNEN, categorieUitSlug, slugVan, artikelVoorRoute, citatenGeldig, controleerArtikel, haalControlevragen, leestijd, ontbrekendeOnderdelen, vulVerhaal, zichtbareArtikelen } from '../../shared/help'

const alle = helpBestanden()
const perSlug = new Map(alle.map((a) => [a.slug, a]))

describe('de inhoud in content/help', () => {
  it('elke categorie hoort bij de collectie', () => {
    for (const a of alle) expect([...COLLECTIES[a.collectie].categorieen], a.slug).toContain(a.categorie)
  })
  it('geen gedachtestreepjes', () => {
    for (const a of alle) expect(/[–—]/.test(`${a.titel} ${a.samenvatting} ${a.inhoud}`), a.slug).toBe(false)
  })
  it('elk new business-artikel heeft de vijf onderdelen en drie controlevragen, zonder offertes of pipeline', () => {
    const nb = alle.filter((a) => a.collectie === 'newbusiness')
    expect(nb.length).toBeGreaterThanOrEqual(41)
    for (const a of nb) {
      expect(ontbrekendeOnderdelen(a.inhoud), a.slug).toEqual([])
      expect(a.vragen?.length, a.slug).toBe(3)
      expect(/\b(offerte|offertes|pipeline)\b/i.test(a.inhoud), a.slug).toBe(false)
    }
  })
  it('elke categorie van de academie heeft artikelen, en Aan de slag bestaat volledig', () => {
    for (const c of CATEGORIEEN_NEWBUSINESS) expect(alle.some((a) => a.collectie === 'newbusiness' && a.categorie === c), c).toBe(true)
    for (const s of AAN_DE_SLAG) expect(perSlug.has(s), s).toBe(true)
  })
  it('elke feature F01 tot en met F26 heeft een artikel in "Hoe werkt Dealtrace"', () => {
    const groepen = new Map<string, Set<string>>()
    for (const f of FUNCTIES) if (f.helpartikel) groepen.set(featureGroep(f.sleutel), new Set([...(groepen.get(featureGroep(f.sleutel)) ?? []), f.helpartikel]))
    for (const [g, slugs] of groepen) if (/^F\d\d/.test(g)) expect([...slugs].some((s) => perSlug.get(s)?.collectie === 'product'), g).toBe(true)
    for (const f of FUNCTIES) if (f.helpartikel) expect(perSlug.has(f.helpartikel), f.sleutel).toBe(true)
  })
  it('de verkoopverhaal-artikelen gebruiken het leesmodel', () => {
    for (const s of ['ons-verhaal', 'onze-belofte', 'tegen-wie-we-verkopen', 'een-winpunt-per-gesprek', 'wanneer-we-iemand-terugbellen']) expect(perSlug.get(s)!.inhoud, s).toMatch(/\{\{verhaal:[a-z]+\}\}/)
  })
})

describe('Nieuwe klanten werven', () => {
  const werven = alle.filter((a) => a.collectie === 'werven')
  it('minstens tien artikelen, elk met de vijf onderdelen, drie controlevragen en een bekende bron', () => {
    expect(werven.length).toBeGreaterThanOrEqual(10)
    const bronnen: string[] = Object.values(WERVEN_BRONNEN)
    for (const a of werven) {
      expect(ontbrekendeOnderdelen(a.inhoud), a.slug).toEqual([])
      expect(a.vragen?.length, a.slug).toBe(3)
      expect(bronnen, a.slug).toContain(a.bron)
    }
  })
  it('elke categorie heeft artikelen en opent via zijn eigen adres', () => {
    for (const c of CATEGORIEEN_WERVEN) {
      expect(werven.some((a) => a.categorie === c), c).toBe(true)
      expect(categorieUitSlug(slugVan(c)), c).toEqual({ naam: c, collectie: 'werven' })
    }
    expect(HELPCENTER_GERESERVEERD).toContain('werven')
  })
  it('elke link naar het helpcenter wijst naar een bestaand artikel', () => {
    for (const a of werven) for (const [, s] of a.inhoud.matchAll(/\]\(\/helpcenter\/([a-z0-9-]+)\)/g)) expect(perSlug.has(s!), `${a.slug} -> ${s}`).toBe(true)
  })
  it('een wervingsartikel is nooit het artikel van een scherm', () => {
    expect(artikelVoorRoute('/belblokken', alle)).not.toBe('aandacht-vragen-met-hulpvraag-en-entree')
    expect(perSlug.get(artikelVoorRoute('/belblokken', alle)!)?.collectie).not.toBe('werven')
  })
})

describe('controlevragen en leestijd', () => {
  const md = '# T\n\nTekst.\n\n## Controlevragen\n\n1. Vraag een?\n   - [ ] a\n   - [x] b\n2. Zonder goed antwoord?\n   - [ ] a\n   - [ ] b\n\n## Na\n\nStaart.'
  it('haalt de vragen eruit en laat de rest staan; een vraag zonder goed antwoord telt niet', () => {
    const r = haalControlevragen(md)
    expect(r.vragen).toEqual([{ vraag: 'Vraag een?', opties: ['a', 'b'], goed: 1 }])
    expect(r.inhoud).toBe('# T\n\nTekst.\n\n## Na\n\nStaart.')
    expect(haalControlevragen('Geen vragen').vragen).toEqual([])
  })
  it('leestijd: 200 woorden per minuut, minstens 1', () => {
    expect(leestijd('')).toBe(1)
    expect(leestijd(Array(600).fill('woord').join(' '))).toBe(3)
  })
})

describe('zichtbaarheid en bewijsplicht', () => {
  const a = [
    { id: '1', slug: 'p', niveau: 'expert', organisationId: null },
    { id: '2', slug: 'eigen-a', niveau: null, organisationId: 'org-a' },
    { id: '3', slug: 'eigen-b', niveau: null, organisationId: 'org-b' },
    { id: '4', slug: 'q', niveau: 'beginner', organisationId: null },
  ]
  it('een eigen artikel van een andere organisatie nooit; verborgen weg; niveau bepaalt alleen de volgorde', () => {
    expect(zichtbareArtikelen(a, 'org-a', ['4'], 'beginner').map((x) => x.slug)).toEqual(['eigen-a', 'p'])
    expect(zichtbareArtikelen(a, 'org-a', [], 'expert').map((x) => x.slug)).toEqual(['p', 'eigen-a', 'q'])
  })
  it('citatenGeldig: letterlijk citaat uit een gevonden artikel; anders of zonder helpbron ongeldig', () => {
    const gevonden = [{ slug: 'parkeren-en-terughalen', titel: 'Parkeren en terughalen', samenvatting: 'Wat je doet na de laatste poging.', inhoud: 'Na de laatste poging parkeert Dealtrace het account.' }]
    expect(citatenGeldig({ bronnen: [{ soort: 'help', ref: 'parkeren-en-terughalen', citaat: 'parkeert Dealtrace het account' }] }, gevonden)).toBe(true)
    expect(citatenGeldig({ bronnen: [{ soort: 'help', ref: 'parkeren-en-terughalen', citaat: 'verwijdert het account' }] }, gevonden)).toBe(false)
    expect(citatenGeldig({ bronnen: [{ soort: 'help', ref: 'onbekend', citaat: 'parkeert' }] }, gevonden)).toBe(false)
    expect(citatenGeldig({ bronnen: [] }, gevonden)).toBe(false)
  })
})

describe('vulVerhaal', () => {
  it('vult het leesmodel in; zonder bevestigd verhaal de vaste tekst', () => {
    const md = 'Belofte:\n\n{{verhaal:kernbelofte}}\n\n{{verhaal:winpunten}}'
    expect(vulVerhaal(md, { kernbelofte: 'Uw materiaal staat op het afgesproken uur op de bouw.', winpunten: [{ titel: 'Levering op het uur' }] }))
      .toBe('Belofte:\n\n**"Uw materiaal staat op het afgesproken uur op de bouw."**\n\n- **Levering op het uur**')
    expect(vulVerhaal('{{verhaal:kernzin}}', null)).toBe(VERHAAL_LEEG)
  })
})

describe('controleerArtikel en artikelVoorRoute', () => {
  it('titel, categorie bij de collectie, vijf onderdelen bij publiceren, geen gedachtestreepjes', () => {
    expect(controleerArtikel({ titel: 'Ons bezwarenboek', collectie: 'newbusiness', categorie: 'Bezwaren', inhoud: 'Tekst', status: 'concept' })).toEqual([])
    expect(controleerArtikel({ titel: 'Ons bezwarenboek', collectie: 'newbusiness', categorie: 'Bezwaren', inhoud: 'Tekst', status: 'gepubliceerd' })[0]).toMatch(/onderdelen/)
    expect(controleerArtikel({ titel: 'X', collectie: 'product', categorie: 'Bezwaren', inhoud: '', status: 'concept' })).toHaveLength(3)
    expect(controleerArtikel({ titel: 'Onze pitch', collectie: 'werven', categorie: 'Je verhaal schrijven', inhoud: 'Tekst', status: 'concept' })).toEqual([])
    expect(controleerArtikel({ titel: 'Onze pitch', collectie: 'werven', categorie: 'Bellen', inhoud: 'Tekst', status: 'concept' })).toEqual(['Kies een categorie uit de collectie'])
    expect(controleerArtikel({ titel: 'Onze pitch', collectie: 'werven', categorie: 'Je verhaal schrijven', inhoud: 'Tekst', status: 'gepubliceerd' })[0]).toMatch(/onderdelen/)
    expect(controleerArtikel({ titel: 'Een titel', collectie: 'product', categorie: 'Prospects', inhoud: 'a — b', status: 'concept' })).toEqual(['Gebruik geen gedachtestreepjes'])
  })
  it('route met parameter valt terug op het artikel van het scherm', () => {
    expect(artikelVoorRoute('/accounts/pr-01', alle)).toBe('de-accountkaart-lezen')
    expect(artikelVoorRoute('/belblokken', alle)).toBeTruthy()
  })
})
