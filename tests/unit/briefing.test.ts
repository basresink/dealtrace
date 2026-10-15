import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { combineer, gewogenBezwaren, kiesBriefingSoort, pitstopDrieRegels, vulBriefing, winpuntMetBewijs, type BriefingContext } from '../../shared/briefing'
import { afmeldVoet, bouwPrompt, controleerDomeinRecords, lengteBinnenGrens, LENGTE_GRENS, mailtoLink, overname, PROMPTCACHE, stijlScore, VAST_KADER, whatsappLink } from '../../shared/schrijver'
import type { Winpunt } from '../../shared/verkoopverhaal'

const wp = (id: string, x: Partial<Winpunt> = {}): Winpunt => ({ id, titel: id, omschrijving: `Omschrijving ${id}`, faseId: null, weging: 1, onderNorm: false, actief: true, ...x })
const stand: BriefingContext['stand'] = {
  branches: [{ id: 'br-01', naam: 'Installatiebedrijven woningbouw', focus: 'primair' }, { id: 'br-03', naam: 'Woningcorporaties', focus: 'secundair' }],
  teksten: [
    { id: 't1', sublaag: 'L0.1', sleutel: 'bedrijfsverhaal', brancheId: null, tekst: 'Wij leveren installateurs op tijd. Per bouwfase.', kernzin: 'Wij leveren installateurs op tijd.' },
    { id: 't2', sublaag: 'L0.6', sleutel: 'verhaal', brancheId: 'br-01', tekst: 'Voor de woningbouw leveren we per bouwfase op de bouwplaats.' },
    { id: 't3', sublaag: 'L0.4', sleutel: 'kernbelofte', brancheId: 'br-01', tekst: 'Geen monteur die wacht op materiaal.' },
    { id: 't4', sublaag: 'L0.4', sleutel: 'kernbelofte', brancheId: null, tekst: 'Altijd op tijd geleverd.' },
  ],
  winpunten: [wp('wp-02', { titel: 'Levering op het uur', weging: 0.5, onderNorm: true, impact: 'hoog' }), wp('wp-01', { titel: 'Gratis projectschouw binnen 48 uur', impact: 'hoog', concurrentIds: ['cc-02'] }), wp('wp-03', { titel: 'Projectapp' })],
  concurrenten: [
    { id: 'cc-01', naam: 'Landelijke keten', soort: 'direct', alsDeKlantZegt: '"Bij de keten heb ik alles onder één dak." Antwoord: "Klopt. Wat kost een wachtende monteur?"' },
    { id: 'cc-02', naam: 'Webshop', soort: 'direct', alsDeKlantZegt: '"Online is het goedkoper." Antwoord: "Per stuk soms wel."', bewijs: 'Drie projecten in Drachten op tijd geleverd.' },
  ],
}
const ctx = (x: Partial<BriefingContext> = {}, account: Partial<BriefingContext['account']> = {}): BriefingContext => ({
  account: { naam: 'Testinstallatie Noord', branche: 'Installatiebedrijven woningbouw', plaats: 'Assen', vvBrancheId: 'br-01', huidigeLeverancierId: 'cc-02', aanleiding: { tekst: 'Vacature voor een servicemonteur.', bron: 'Vacaturesite' }, ...account },
  contacten: [{ naam: 'Testpersoon Een', functie: 'Eigenaar', rol: 'beslisser' }], verslagen: [], stand, ...x,
})

describe('kiesBriefingSoort (één soortbepaling, gat 34)', () => {
  it('vastgezet, overdracht, bezoek, verdieping, eerste gesprek, behoefte', () => {
    expect(kiesBriefingSoort({ vastgezet: 'verdieping', gesprekken: 0 })).toBe('verdieping')
    expect(kiesBriefingSoort({ eersteAfspraakGehoudenMetVervolg: true, meetingsoortVorm: 'bezoek', gesprekken: 5 })).toBe('overdracht')
    expect(kiesBriefingSoort({ meetingsoortVorm: 'bezoek', gesprekken: 0 })).toBe('bezoek')
    expect(kiesBriefingSoort({ gesprekken: 3, beslisserGesproken: true })).toBe('verdieping')
    expect(kiesBriefingSoort({ gesprekken: 0, faseId: 'in-gesprek' })).toBe('verdieping')
    expect(kiesBriefingSoort({ gesprekken: 2, beslisserGesproken: false })).toBe('eerste-gesprek')
    expect(kiesBriefingSoort({ gesprekken: 1, beslisserGesproken: true })).toBe('behoefte')
    expect(kiesBriefingSoort({ gesprekken: 0 })).toBe('eerste-gesprek')
  })
})

describe('vulBriefing (geen AI)', () => {
  it('br-01 met huidige leverancier cc-02: verhaal en belofte van br-01, wp-01 met bewijs, het bezwaar "Online is het goedkoper." eerst (C.9 punt 2)', () => {
    const b = vulBriefing('eerste-gesprek', ctx())
    expect(b.find((x) => x.sleutel === 'winpunt')!.tekst).toBe('Gratis projectschouw binnen 48 uur. Bewijs: Drie projecten in Drachten op tijd geleverd.')
    expect(b.find((x) => x.sleutel === 'verhaal')!.tekst).toMatch(/per bouwfase op de bouwplaats\. Geen monteur die wacht op materiaal\./)
    expect(b.find((x) => x.sleutel === 'verhaal')!.gat).toBeNull()
    expect(b.find((x) => x.sleutel === 'waaromNu')!.bron).toBe('Vacaturesite')
    expect(gewogenBezwaren(ctx())[0]).toMatchObject({ bezwaar: 'Online is het goedkoper.', antwoord: 'Per stuk soms wel.', gewicht: 3 })
    expect(vulBriefing('behoefte', ctx()).find((x) => x.sleutel === 'bezwaren')!.tekst.split('\n')[0]).toBe('"Online is het goedkoper." Antwoord: Per stuk soms wel.')
  })
  it('een branche zonder eigen verhaal valt terug op algemeen met zichtbaar gat (C.9 punt 1)', () => {
    const v = vulBriefing('eerste-gesprek', ctx({}, { vvBrancheId: 'br-03' })).find((x) => x.sleutel === 'verhaal')!
    expect(v.tekst).toMatch(/Wij leveren installateurs op tijd/)
    expect(v.gat).toBe('Voor Woningcorporaties is nog geen eigen verhaal; je ziet het algemene verhaal.')
  })
  it('een winpunt onder de norm komt nooit als eerste (C.9 punt 4)', () => {
    expect(winpuntMetBewijs(ctx({}, { huidigeLeverancierId: null })).winpunt!.id).not.toBe('wp-02')
    expect(winpuntMetBewijs({ ...ctx({}, { huidigeLeverancierId: null }), eerderGebruikteWinpunten: ['wp-01'] }).winpunt!.id).toBe('wp-03')
  })
  it('elke soort heeft een doel of vervolg; de overdracht heeft verslag en reis; lege blokken zeggen het', () => {
    const o = vulBriefing('overdracht', ctx({ afspraak: { soort: 'Kennismaking', start: '2026-10-14T08:00:00Z', verslag: 'Twee projecten in 2027.', vervolgstap: 'Projectschouw' }, geschiedenis: [{ fase: 'Gevonden', op: '2026-09-01T10:00:00Z' }] }))
    expect(o.find((x) => x.sleutel === 'verslag')!.tekst).toBe('Twee projecten in 2027.')
    expect(o.find((x) => x.sleutel === 'vervolg')!.tekst).toBe('Projectschouw')
    expect(o.find((x) => x.sleutel === 'reis')!.tekst).toMatch(/^Gevonden op 1 september/)
    expect(vulBriefing('verdieping', ctx()).find((x) => x.sleutel === 'samenvatting')!.tekst).toBe('Nog niet bekend.')
    expect(vulBriefing('bezoek', ctx({}, { adres: 'Testweg 1' })).at(-1)!.tekst).toMatch(/Adres: Testweg 1\. Vraag bij de receptie naar Testpersoon Een\./)
  })
  it('eigen tekst wint van AI, AI van berekend; drie regels', () => {
    const b = combineer(vulBriefing('eerste-gesprek', ctx()), { opening: 'AI-opening', doel: 'AI-doel' }, { doel: 'Mijn doel' })
    expect(b.find((x) => x.sleutel === 'opening')).toMatchObject({ tekst: 'AI-opening', herkomst: 'ai' })
    expect(b.find((x) => x.sleutel === 'doel')).toMatchObject({ tekst: 'Mijn doel', herkomst: 'eigen' })
    expect(b.find((x) => x.sleutel === 'wie')!.herkomst).toBe('berekend')
    expect(pitstopDrieRegels(b)).toEqual(['Waarom nu: Vacature voor een servicemonteur.', 'Winpunt en één bewijs: Gratis projectschouw binnen 48 uur. Bewijs: Drie projecten in Drachten op tijd geleverd.', 'Doel van dit gesprek: Mijn doel'])
  })
})

describe('de Schrijver (11.5, gat 16)', () => {
  it('stijlscore: 5 + min(5, passend) - 2 × vermeden, begrensd 1 tot 10; leeg is 1', () => {
    expect(stijlScore('').score).toBe(1)
    expect(stijlScore('Een gewone zin.').score).toBe(5)
    expect(stijlScore('Je jullie concreet binnen project planning levering').score).toBe(10)
    expect(stijlScore('Een innovatief en uniek product voor u, synergie').score).toBe(1)
    expect(stijlScore('Je project, innovatief.').score).toBe(5)
  })
  it('lengtegrens: precies 120 woorden mag, 121 niet', () => {
    const t = (n: number) => Array(n).fill('woord').join(' ')
    expect(lengteBinnenGrens(t(120), 'mail')).toEqual({ binnen: true, woorden: 120, grens: 120 })
    expect(lengteBinnenGrens(t(121), 'mail').binnen).toBe(false)
    expect(LENGTE_GRENS).toEqual({ mail: 120, linkedin: 80, whatsapp: 60, belscript: 150, kaart: 40 })
  })
  it('mailto en wa.me met gecodeerde tekst; zonder nummer geen WhatsApp', () => {
    expect(mailtoLink({ aan: 'jan@test.test', onderwerp: 'Hoi & dag', tekst: 'Regel 1\nRegel 2?' })).toBe('mailto:jan@test.test?subject=Hoi%20%26%20dag&body=Regel%201%0ARegel%202%3F')
    expect(whatsappLink('Hoi!', '06-12 34 56 78')).toBe('https://wa.me/31612345678?text=Hoi!')
    expect(whatsappLink('Hoi', null)).toBeNull()
  })
  it('overname, afmeldvoet en domeinrecords', () => {
    expect(overname('Hoi  daar', 'Hoi daar')).toBe('ongewijzigd')
    expect(overname('Hoi daar', 'Hoi jij')).toBe('aangepast')
    expect(overname('Hoi', null)).toBe('verworpen')
    expect(afmeldVoet('https://a.test/af', 'https://a.test/privacy')).toMatch(/Meld je af: https:\/\/a\.test\/af\nHoe we met je gegevens omgaan: https:\/\/a\.test\/privacy$/)
    expect(controleerDomeinRecords({ root: ['v=spf1 include:x ~all'], dmarc: ['v=DMARC1; p=none'], dkim: ['v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNAD'] }).ontbreekt).toEqual([])
    expect(controleerDomeinRecords({ root: ['google-site-verification=x'], dmarc: [], dkim: [] }).ontbreekt).toEqual(['SPF', 'DKIM', 'DMARC'])
  })
})

describe('promptcache (gat 24): handboek en code lopen gelijk', () => {
  it('het vaste deel komt eerst en wordt gecachet; instructie en materiaal per aanroep', () => {
    const p = bouwPrompt({ platform: 'Platform', organisatie: 'Organisatie', instructie: 'Doe dit' })
    expect(p.gecachet).toBe(`${VAST_KADER}\n\nPlatform\n\nOrganisatie`)
    expect(p.volledig.endsWith('Doe dit')).toBe(true)
  })
  it('golden master: het handboek noemt precies de onderdelen uit PROMPTCACHE', () => {
    const doc = readFileSync('docs/HOE-HET-WERKT.md', 'utf8')
    const regel = doc.split('\n').find((r) => r.startsWith('- **Promptcache**'))!
    const vet = [...regel.matchAll(/\*\*([^*]+)\*\*/g)].map((m) => m[1]).filter((x) => x !== 'Promptcache')
    expect(vet).toEqual([...PROMPTCACHE.gecachet, ...PROMPTCACHE.perAanroep])
  })
})
