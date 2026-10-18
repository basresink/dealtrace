// P25: helpcenter compleet. De inhoud zelf (elke categorie geldig, geen gedachtestreepjes, elk new
// business-artikel met de vijf onderdelen en drie controlevragen, geen offertes of pipeline), elke feature
// een artikel in "Hoe werkt Dealtrace", en de pure functies: controlevragen, leestijd, zichtbaarheid,
// citatenGeldig, vulVerhaal, controleerArtikel en artikelVoorRoute. Nieuwe klanten werven is een hoofdstuk
// van de academie; Tips & Tricks is een eigen collectie met twintig tips.
import { describe, expect, it } from 'vitest'
import { helpBestanden } from '../../server/db/helpStart'
import { FUNCTIES, featureGroep } from '../../shared/functies'

import { AAN_DE_SLAG, ACADEMIE_HOOFDSTUKKEN, CATEGORIEEN_NEWBUSINESS, CATEGORIEEN_TIPS, CATEGORIEEN_VAK, CATEGORIEEN_WERVEN, COLLECTIES, HELPCENTER_GERESERVEERD, TIPS_ONDERDELEN, VERHAAL_LEEG, WERVEN_BRONNEN, collectieUit, hoofdstukVan, categorieUitSlug, slugVan, artikelVoorRoute, citatenGeldig, helpLink, controleerArtikel, haalControlevragen, leestijd, ontbrekendeOnderdelen, overzichtLink, uitgelicht, vulVerhaal, zichtbareArtikelen } from '../../shared/help'

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
    expect(nb.length).toBeGreaterThanOrEqual(61)
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

describe('Nieuwe klanten werven in de academie', () => {
  const werven = alle.filter((a) => (CATEGORIEEN_WERVEN as readonly string[]).includes(a.categorie))
  it('twaalf artikelen uit The Perfect Pitch en twintig uit Sales Hunter, allemaal in de academie, elk met de vijf onderdelen, drie controlevragen en een bekende bron', () => {
    expect(werven.length).toBe(32)
    const bronnen: string[] = Object.values(WERVEN_BRONNEN)
    for (const a of werven) {
      expect(a.collectie, a.slug).toBe('newbusiness')
      expect(ontbrekendeOnderdelen(a.inhoud), a.slug).toEqual([])
      expect(a.vragen?.length, a.slug).toBe(3)
      expect(bronnen, a.slug).toContain(a.bron)
    }
    expect(werven.filter((a) => a.bron === WERVEN_BRONNEN.perfectPitch)).toHaveLength(12)
    expect(werven.filter((a) => a.bron === WERVEN_BRONNEN.salesHunter)).toHaveLength(20)
  })
  it('Sales Hunter heeft vier eigen categorieën; elk artikel heeft een voorbeeld met fictieve data en linkt naar Dealtrace', () => {
    const hunter = werven.filter((a) => a.bron === WERVEN_BRONNEN.salesHunter)
    const cats = ['Je werving plannen', 'Zichtbaar worden', 'Kanalen inzetten', 'Kwalificeren en opvolgen']
    expect([...new Set(hunter.map((a) => a.categorie))].sort()).toEqual([...cats].sort())
    for (const a of hunter) {
      expect(a.samenvatting.length, a.slug).toBeGreaterThan(40)
      expect(/\d/.test(a.inhoud.slice(a.inhoud.indexOf('## Voorbeeld'), a.inhoud.indexOf('## Valkuilen'))), `${a.slug}: voorbeeld met data`).toBe(true)
      expect(a.inhoud.slice(a.inhoud.indexOf('## Zo doe je het in Dealtrace')), a.slug).toMatch(/\]\(\/helpcenter\/[a-z0-9-]+\)/)
      for (const m of a.inhoud.matchAll(/[a-z0-9.-]+@([a-z0-9-]+(?:\.[a-z0-9-]+)+)/gi)) expect(m[1], a.slug).toMatch(/\.test$/)
    }
  })
  it('de academie heeft twee hoofdstukken: het vak en Nieuwe klanten werven, samen alle categorieën', () => {
    expect(ACADEMIE_HOOFDSTUKKEN.map((h) => h.sleutel)).toEqual(['vak', 'werven'])
    expect(ACADEMIE_HOOFDSTUKKEN.flatMap((h) => [...h.categorieen])).toEqual([...CATEGORIEEN_NEWBUSINESS])
    expect(CATEGORIEEN_NEWBUSINESS).toEqual([...CATEGORIEEN_VAK, ...CATEGORIEEN_WERVEN])
    expect(hoofdstukVan('Je verhaal schrijven')?.sleutel).toBe('werven')
    expect(hoofdstukVan('Bellen')?.sleutel).toBe('vak')
    expect(hoofdstukVan('Dagelijks werk')).toBeNull()
  })
  it('elke categorie heeft artikelen en opent via zijn eigen adres in de academie', () => {
    for (const c of CATEGORIEEN_WERVEN) {
      expect(werven.some((a) => a.categorie === c), c).toBe(true)
      expect(categorieUitSlug(slugVan(c)), c).toEqual({ naam: c, collectie: 'newbusiness' })
    }
    expect(HELPCENTER_GERESERVEERD).toContain('werven')
  })
  it('de oude collectie werven leest als de academie; er is geen losse collectie meer', () => {
    expect(collectieUit('werven')).toBe('newbusiness')
    expect(Object.keys(COLLECTIES)).toEqual(['product', 'newbusiness', 'tips'])
    expect(alle.some((a) => (a.collectie as string) === 'werven')).toBe(false)
  })
  it('elke link naar het helpcenter wijst naar een bestaand artikel', () => {
    for (const a of werven) for (const [, s] of a.inhoud.matchAll(/\]\(\/helpcenter\/([a-z0-9-]+)\)/g)) expect(perSlug.has(s!), `${a.slug} -> ${s}`).toBe(true)
  })
  it('een wervingsartikel is nooit het artikel van een scherm', () => {
    expect(artikelVoorRoute('/belblokken', alle)).not.toBe('aandacht-vragen-met-hulpvraag-en-entree')
    expect((CATEGORIEEN_WERVEN as readonly string[]).includes(perSlug.get(artikelVoorRoute('/belblokken', alle)!)!.categorie)).toBe(false)
  })
})

describe('Tips & Tricks', () => {
  const tips = alle.filter((a) => a.collectie === 'tips')
  const product = new Set(alle.filter((a) => a.collectie === 'product').map((a) => a.slug))
  it('twintig tips, vijf per categorie, van het DealDrive-team', () => {
    expect(tips).toHaveLength(20)
    for (const c of CATEGORIEEN_TIPS) expect(tips.filter((a) => a.categorie === c), c).toHaveLength(5)
    for (const a of tips) {
      expect(a.bron, a.slug).toBe('Van het DealDrive-team')
      expect(a.slug, a.slug).toMatch(/^tip-/)
      expect(a.samenvatting.length, a.slug).toBeGreaterThan(40)
    }
  })
  it('elke tip heeft de vaste onderdelen en drie controlevragen', () => {
    for (const a of tips) {
      expect(ontbrekendeOnderdelen(a.inhoud, TIPS_ONDERDELEN), a.slug).toEqual([])
      expect(a.vragen?.length, a.slug).toBe(3)
      expect(/\d/.test(a.inhoud.slice(a.inhoud.indexOf('## Voorbeeld'))), `${a.slug}: voorbeeld met data`).toBe(true)
    }
  })
  it('elke tip linkt naar het artikel van een functie in Hoe werkt Dealtrace, en elke link bestaat', () => {
    for (const a of tips) {
      const links = [...a.inhoud.matchAll(/\]\((\/helpcenter\/([a-z0-9-]+))\)/g)]
      expect(links.length, a.slug).toBeGreaterThan(0)
      for (const [, href, s] of links) {
        expect(href, a.slug).toBe(helpLink(s!))
        expect(perSlug.has(s!), `${a.slug} -> ${s}`).toBe(true)
      }
      expect(links.some(([, , s]) => product.has(s!)), `${a.slug} linkt naar een functieartikel`).toBe(true)
      expect(links.some(([, , s]) => FUNCTIES.some((f) => f.helpartikel === s)), `${a.slug} linkt naar het artikel van een functie`).toBe(true)
    }
  })
  it('Probeer het wijst naar een scherm van de app; een tip is nooit het artikel van een scherm', () => {
    for (const a of tips) for (const r of a.routes) expect(r, a.slug).toMatch(/^\/[a-z-]*(\/[a-z-]+)?(\?[a-z]+=[a-z]+)?$/)
    for (const r of ['/', '/belblokken', '/bezoeken', '/concepten', '/data-kwaliteit', '/accountplannen', '/mijn-dashboard', '/inzichten', '/taken']) {
      const s = artikelVoorRoute(r, alle)
      if (s) expect(perSlug.get(s)!.collectie, r).not.toBe('tips')
    }
  })
  it('categorieën openen via hun eigen adres en tips is een gereserveerd pad', () => {
    for (const c of CATEGORIEEN_TIPS) expect(categorieUitSlug(slugVan(c)), c).toEqual({ naam: c, collectie: 'tips' })
    expect(HELPCENTER_GERESERVEERD).toContain('tips')
    expect(COLLECTIES.tips.overzicht).toBe('/helpcenter/tips')
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
    expect(controleerArtikel({ titel: 'Onze pitch', collectie: 'newbusiness', categorie: 'Je verhaal schrijven', inhoud: 'Tekst', status: 'concept' })).toEqual([])
    expect(controleerArtikel({ titel: 'Onze pitch', collectie: 'werven' as any, categorie: 'Je verhaal schrijven', inhoud: 'Tekst', status: 'concept' })).toContain('Kies een collectie')
    expect(controleerArtikel({ titel: 'Onze pitch', collectie: 'newbusiness', categorie: 'Je verhaal schrijven', inhoud: 'Tekst', status: 'gepubliceerd' })[0]).toMatch(/onderdelen/)
    expect(controleerArtikel({ titel: 'Onze tip', collectie: 'tips', categorie: 'Bellen', inhoud: 'Tekst', status: 'concept' })).toEqual(['Kies een categorie uit de collectie'])
    expect(controleerArtikel({ titel: 'Onze tip', collectie: 'tips', categorie: 'Je dag en je week', inhoud: 'Tekst', status: 'gepubliceerd' })[0]).toMatch(/Wat het je oplevert/)
    expect(controleerArtikel({ titel: 'Onze tip', collectie: 'tips', categorie: 'Je dag en je week', inhoud: TIPS_ONDERDELEN.map((k) => `## ${k}\n\nTekst.`).join('\n\n'), status: 'gepubliceerd' })).toEqual([])
    expect(controleerArtikel({ titel: 'Een titel', collectie: 'product', categorie: 'Prospects', inhoud: 'a — b', status: 'concept' })).toEqual(['Gebruik geen gedachtestreepjes'])
  })
  it('route met parameter valt terug op het artikel van het scherm', () => {
    expect(artikelVoorRoute('/accounts/pr-01', alle)).toBe('de-accountkaart-lezen')
    expect(artikelVoorRoute('/belblokken', alle)).toBeTruthy()
  })
})

describe('de start van het helpcenter', () => {
  it('uitgelicht: om de beurt een artikel per categorie, hooguit zes, in vaste volgorde', () => {
    const a = (categorie: string, n: number) => ({ categorie, slug: `${categorie}-${n}` })
    const lijst = [a('B', 1), a('A', 1), a('A', 2), a('A', 3), a('C', 1), a('A', 4), a('A', 5), a('A', 6), a('A', 7)]
    expect(uitgelicht(lijst, ['A', 'B', 'C', 'D']).map((x) => x.slug)).toEqual(['A-1', 'B-1', 'C-1', 'A-2', 'A-3', 'A-4'])
    expect(uitgelicht([a('A', 1)], ['A', 'B'])).toHaveLength(1)
    expect(uitgelicht([], ['A'])).toEqual([])
    const nb = alle.filter((x) => x.collectie === 'newbusiness')
    expect(uitgelicht(nb, COLLECTIES.newbusiness.categorieen)).toHaveLength(6)
  })
  it('overzichtLink: een categorie uit Nieuwe klanten werven gaat naar dat hoofdstuk', () => {
    expect(overzichtLink('product', 'Dagelijks werk')).toBe('/helpcenter/instructies')
    expect(overzichtLink('newbusiness', 'Bellen')).toBe('/helpcenter/academie')
    expect(overzichtLink('newbusiness', 'Je verhaal schrijven')).toBe('/helpcenter/academie#werven')
    expect(overzichtLink('tips')).toBe('/helpcenter/tips')
  })
})
