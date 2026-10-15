import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AL_GEZIEN, FUNCTIES, featureGroep, functiesVoor, nieuwVoorMij, startindeling } from '../../shared/functies'
import { AAN_DE_SLAG, artikelVoorRoute, artikelenVoorDagpakket, isGelezen, leesArtikel, voorJou, zoekNormaal, type HelpArtikel } from '../../shared/help'
import { markdownNaarHtml } from '../../shared/markdown'
import type { FunctieRegel, OrganisatieContext } from '../../shared/types'

const MAP = join(import.meta.dirname, '../../content/help')
const artikelen: HelpArtikel[] = readdirSync(MAP).filter((f) => f.endsWith('.md')).map((f) => leesArtikel(f.slice(0, -3), readFileSync(join(MAP, f), 'utf8')))
const org: OrganisatieContext = { id: 'org-a', pakket: 'plus', features: {}, iedereenAlles: false }
const stand: FunctieRegel[] = startindeling().map((r) => ({ ...r, organisationId: null }))
const NU = new Date('2026-10-14T08:00:00Z')

describe('functiesVoor en nieuwVoorMij (4.2, 4.4)', () => {
  it('Beginner: aan, nog niet aangezet met niveau, buiten het pakket; verborgen telt niet als niet aangezet', () => {
    const f = functiesVoor({ rol: 'accountmanager', niveau: 'beginner' }, org, stand, ['nav.funnel'])
    expect(f.aan).toContain('nav.vandaag')
    expect(f.verborgen).toEqual(['nav.funnel'])
    expect(f.nietAangezet.find((x) => x.sleutel === 'nav.leadgenerator')).toEqual({ sleutel: 'nav.leadgenerator', niveau: 'gevorderd' })
    expect(f.nietAangezet.some((x) => x.sleutel === 'nav.funnel')).toBe(false)
    const starter = functiesVoor({ rol: 'accountmanager', niveau: 'expert' }, { ...org, pakket: 'starter' }, stand)
    expect(starter.buitenPakket.some((x) => x.pakket === 'plus')).toBe(true)
    expect(starter.nietAangezet).toEqual([])
  })
  it('Iedereen ziet alles: niets meer "nog niet aangezet", pakket blijft gelden', () => {
    const f = functiesVoor({ rol: 'accountmanager', niveau: 'beginner' }, { ...org, pakket: 'starter', iedereenAlles: true }, stand)
    expect(f.nietAangezet).toEqual([])
    expect(f.buitenPakket.length).toBeGreaterThan(0)
  })
  it('de eerste keer is niets nieuw; daarna is een functie die aangaat 7 dagen nieuw', () => {
    const eerste = nieuwVoorMij(['a', 'b'], undefined, NU)
    expect(eerste).toMatchObject({ nieuw: [], netAan: [], gewijzigd: true, gezien: { a: AL_GEZIEN, b: AL_GEZIEN } })
    const tweede = nieuwVoorMij(['a', 'b', 'c'], eerste.gezien, NU)
    expect(tweede.netAan).toEqual(['c'])
    expect(tweede.nieuw).toEqual(['c'])
    const bijnaWeek = new Date(NU.getTime() + 7 * 864e5 - 1000)
    expect(nieuwVoorMij(['a', 'b', 'c'], tweede.gezien, bijnaWeek).nieuw).toEqual(['c'])
    const week = new Date(NU.getTime() + 7 * 864e5)
    expect(nieuwVoorMij(['a', 'b', 'c'], tweede.gezien, week)).toMatchObject({ nieuw: [], gewijzigd: false })
  })
  it('uit en weer aan is opnieuw nieuw', () => {
    const g = nieuwVoorMij(['a', 'c'], { a: AL_GEZIEN, c: AL_GEZIEN }, NU)
    const uit = nieuwVoorMij(['a'], g.gezien, NU)
    expect(uit.gewijzigd).toBe(true)
    expect(nieuwVoorMij(['a', 'c'], uit.gezien, NU).netAan).toEqual(['c'])
  })
  it('elke functie heeft een featuregroep; de startindeling heeft drie rijen per functie en Expert alles aan', () => {
    const s = startindeling()
    for (const f of FUNCTIES.filter((x) => !(x.rollen !== 'iedereen' && x.rollen.every((r) => r === 'founder')))) {
      expect(s.filter((r) => r.functie === f.sleutel)).toHaveLength(3)
      expect(featureGroep(f.sleutel)).not.toBe('Overig')
    }
    expect(s.filter((r) => r.niveau === 'expert').every((r) => r.aan)).toBe(true)
  })
})

describe('helpcenter (F21)', () => {
  it('elk helpartikel uit de catalogus bestaat, met titel, categorie en samenvatting', () => {
    const slugs = new Set(artikelen.map((a) => a.slug))
    for (const f of FUNCTIES) if (f.helpartikel) expect(slugs.has(f.helpartikel), f.helpartikel).toBe(true)
    for (const a of artikelen) { expect(a.titel).not.toBe(a.slug); expect(a.samenvatting.length).toBeGreaterThan(10) }
    for (const s of AAN_DE_SLAG) expect(slugs.has(s), s).toBe(true)
  })
  it('geen gedachtestreepjes en geen groeipad in de artikelen', () => {
    for (const a of artikelen) {
      expect(a.inhoud, a.slug).not.toMatch(/[—–]/)
      expect(a.inhoud, a.slug).not.toMatch(/Vraag je salesmanager om|leerpad|ontgrendel/i)
    }
  })
  it('artikelVoorRoute: exacte route, met query, met een id en via de zijbalk', () => {
    expect(artikelVoorRoute('/', artikelen)).toBe('vandaag')
    expect(artikelVoorRoute('/acties', artikelen)).toBe('een-taak-afronden-met-een-uitkomst')
    expect(artikelVoorRoute('/acties?tab=inzichten', artikelen)).toBe('inzichten')
    expect(artikelVoorRoute('/accounts/abc-123', artikelen)).toBe('de-accountkaart-lezen')
    expect(artikelVoorRoute('/instellingen/agents', artikelen)).toBe('agents-en-mandaten')
    expect(artikelVoorRoute('/funnel', artikelen)).toBe('funnel')
    expect(artikelVoorRoute('/bestaat-niet', artikelen)).toBeNull()
  })
  it('isGelezen: kort artikel bij openen, lang artikel aan het einde', () => {
    expect(isGelezen(0, 800, 600)).toBe(true)
    expect(isGelezen(0, 800, 3000)).toBe(false)
    expect(isGelezen(2190, 800, 3000)).toBe(true)
  })
  it('voorJou: eerst nieuwe functies, dan Aan de slag zolang niet alles gelezen is', () => {
    const v = voorJou(['nav.leadgenerator'], new Set(), artikelen)
    expect(v.nieuw.map((a) => a.slug)).toEqual(['leadgenerator'])
    expect(v.aanDeSlag.map((a) => a.slug)).toEqual([...AAN_DE_SLAG])
    expect(voorJou([], new Set(AAN_DE_SLAG), artikelen).aanDeSlag).toEqual([])
    expect(voorJou([], new Set(), artikelen).bijgewerkt).toHaveLength(5)
  })
  it('dagpakket: alleen artikelen van functies die aanstaan, zonder verborgen artikelen', () => {
    const lijst = artikelenVoorDagpakket(['nav.vandaag', 'taken.basis'], artikelen, ['vandaag'])
    expect(lijst).toContain('een-taak-afronden-met-een-uitkomst')
    expect(lijst).not.toContain('vandaag')
    expect(lijst).not.toContain('leadgenerator')
  })
  it('zoekNormaal en de Markdown-weergave', () => {
    expect(zoekNormaal(' Pógíng ')).toBe('poging')
    const html = markdownNaarHtml('# Titel\n\nTekst met **vet** en <script>x</script>.\n\n- een\n- twee\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n[link](javascript:alert(1)) [goed](/help)')
    expect(html).toContain('<h2>Titel</h2>')
    expect(html).toContain('<strong>vet</strong>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('<ul><li>een</li><li>twee</li></ul>')
    expect(html).toContain('<td>1</td>')
    expect(html).not.toContain('javascript:')
    expect(html).toContain('<a href="/help">goed</a>')
  })
})

describe('markdown zonder dubbele titel', () => {
  it('haalt de eerste kop weg als die gelijk is aan de titel', () => {
    expect(markdownNaarHtml('# Vandaag (kort)\n\nTekst', { zonderTitel: 'Vandaag (kort)' })).toBe('<p>Tekst</p>')
    expect(markdownNaarHtml('# Anders\n\nTekst', { zonderTitel: 'Vandaag' })).toContain('<h2>Anders</h2>')
  })
})
