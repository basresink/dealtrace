// Steun bij het dagritme: Tips en tricks en drie academieartikelen op Dagstart, Weekstart en Weekreview,
// gekozen bij moment, werkplek en signalen (shared/ritmeSteun.ts). De artikelen komen uit content/help.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { leesArtikel } from '../../shared/help'
import { alleSteunSlugs, geldendeSignalen, kiesRitmeSteun, MOMENT_ARTIKELEN, MOMENT_EIGEN_TIPS, MOMENT_TIPS, plekVan, SIGNAAL_REGELS, type RitmeMoment, type SteunBronArtikel } from '../../shared/ritmeSteun'

const map = join(__dirname, '../../content/help')
const alle: SteunBronArtikel[] = readdirSync(map).filter((f) => f.endsWith('.md')).map((f) => {
  const a = leesArtikel(f.replace(/\.md$/, ''), readFileSync(join(map, f), 'utf8'))
  return { slug: a.slug, titel: a.titel, samenvatting: a.samenvatting, collectie: a.collectie, bron: a.bron }
})
const perSlug = new Map(alle.map((a) => [a.slug, a]))
const MOMENTEN: RitmeMoment[] = ['dagstart', 'weekstart', 'weekreview']
const kies = (moment: RitmeMoment, werkplek: string, signalen = {}, extra: Partial<Parameters<typeof kiesRitmeSteun>[0]> = {}) => kiesRitmeSteun({ moment, werkplek, signalen, artikelen: alle, zaad: '2026-10-12', ...extra })

describe('catalogus', () => {
  it('elke slug bestaat in het helpcenter; academie bij artikelen, Tips & Tricks bij tips', () => {
    for (const s of alleSteunSlugs()) expect(perSlug.has(s), s).toBe(true)
    for (const s of [...SIGNAAL_REGELS.flatMap((r) => r.artikelen), ...Object.values(MOMENT_ARTIKELEN).flat().map((x) => x.slug)]) expect(perSlug.get(s)!.collectie, s).toBe('newbusiness')
    for (const s of Object.values(MOMENT_TIPS).flat().map((x) => x.slug)) expect(perSlug.get(s)!.collectie, s).toBe('tips')
  })
  it('noemt ook artikelen uit Nieuwe klanten werven (met bron)', () => {
    const werven = Object.values(MOMENT_ARTIKELEN).flat().map((x) => perSlug.get(x.slug)!).filter((a) => a.bron)
    expect(werven.length).toBeGreaterThan(5)
  })
  it('geen gedachtestreepjes in eigen tips en redenen', () => {
    const teksten = [
      ...Object.values(MOMENT_EIGEN_TIPS).flat().flatMap((t) => [t.titel, t.tekst]),
      ...SIGNAAL_REGELS.flatMap((r) => [r.tip?.titel ?? '', r.tip?.tekst ?? '', r.reden({ noShows: 2, bereik: 12, pogingen: 40, gesprekken: 8, afspraken: 0, blijvers: 2, achterstallig: 6, zonderVerslag: 1, bezoeken: 2, belTaken: 4, overdrachten: 1 })]),
    ]
    for (const t of teksten) expect(t).not.toMatch(/[–—]/)
  })
})

describe('kiesRitmeSteun', () => {
  it('geeft per moment en werkplek drie verschillende academieartikelen en drie tips, met link naar het helpcenter', () => {
    for (const m of MOMENTEN) for (const w of ['binnendienst', 'buitendienst', 'hybride']) {
      const r = kies(m, w)
      expect(r.artikelen).toHaveLength(3)
      expect(new Set(r.artikelen.map((a) => a.slug)).size).toBe(3)
      for (const a of r.artikelen) {
        expect(a.href).toBe(`/helpcenter/${a.slug}`)
        expect(perSlug.get(a.slug)!.collectie).toBe('newbusiness')
        expect(a.titel).toBe(perSlug.get(a.slug)!.titel)
      }
      expect(r.tips).toHaveLength(3)
      expect(r.tips.some((t) => t.href?.startsWith('/helpcenter/tip-'))).toBe(true)
    }
  })

  it('past bij de werkplek: de binnendienst krijgt geen route-artikelen, de buitendienst geen receptie', () => {
    const binnen = kies('dagstart', 'binnendienst', { bezoeken: 3 })
    const buiten = kies('dagstart', 'buitendienst', { bezoeken: 3 })
    const routeSlugs = MOMENT_ARTIKELEN.dagstart.filter((x) => x.plek === 'buiten').map((x) => x.slug)
    const belSlugs = MOMENT_ARTIKELEN.dagstart.filter((x) => x.plek === 'binnen').map((x) => x.slug)
    expect(binnen.artikelen.some((a) => routeSlugs.includes(a.slug))).toBe(false)
    expect(buiten.artikelen.some((a) => belSlugs.includes(a.slug))).toBe(false)
    expect(buiten.artikelen[0]!.slug).toMatch(/binnenlopen-langs-de-route|koud-langsgaan-bij-bedrijven/)
    expect(buiten.tips.some((t) => t.sleutel === 'tip-pak-kansen-langs-je-route' || t.sleutel === 'tip-rijmodus-handen-aan-het-stuur' || t.sleutel === 'tip-werk-offline-onderweg' || t.sleutel === 'tip-spreek-je-verslag-in-na-een-afspraak')).toBe(true)
    expect(plekVan('hybride')).toBeNull()
    expect(plekVan(null)).toBe('binnen')
  })

  it('weinig bereik: eerst artikelen over voicemail, receptie en de vierde poging, met de reden', () => {
    const r = kies('weekreview', 'binnendienst', { pogingen: 60, gesprekken: 9, bereik: 15 })
    expect(r.artikelen.slice(0, 2).every((a) => ['een-voicemail-die-teruggebeld-wordt', 'langs-de-receptie', 'waarom-de-vierde-en-vijfde-poging-het-verschil-maken'].includes(a.slug))).toBe(true)
    expect(r.artikelen[0]!.reden).toBe('Je bereik was 15%: minder dan een op de vier pogingen werd een gesprek.')
    expect(r.tips[0]).toMatchObject({ sleutel: 'weinig-bereik', titel: 'Wissel van belmoment', href: null })
  })

  it('te weinig pogingen om iets over bereik te zeggen: geen bereiksignaal', () => {
    expect(geldendeSignalen('weekreview', 'binnendienst', { pogingen: 4, bereik: 0 }).map((r) => r.sleutel)).not.toContain('weinig-bereik')
  })

  it('no-shows: het artikel over een no-show en de tip om je afspraak te bevestigen gaan voor', () => {
    const r = kies('weekstart', 'buitendienst', { noShows: 2 })
    expect(r.artikelen[0]!.slug === 'een-no-show-opvangen' || r.artikelen[1]!.slug === 'een-no-show-opvangen').toBe(true)
    expect(r.artikelen.find((a) => a.slug === 'een-no-show-opvangen')!.reden).toBe('2 prospects kwamen de laatste twee weken niet opdagen.')
    expect(r.tips[0]!.titel).toBe('Bevestig je afspraak een dag vooraf')
  })

  it('hooguit twee artikelen per signaal, zodat er ruimte blijft voor het moment', () => {
    const r = kies('weekreview', 'binnendienst', { noShows: 1, pogingen: 50, gesprekken: 8, bereik: 16, afspraken: 0, tempoAchter: true })
    const regels = geldendeSignalen('weekreview', 'binnendienst', { noShows: 1, pogingen: 50, gesprekken: 8, bereik: 16, afspraken: 0, tempoAchter: true })
    expect(regels[0]!.sleutel).toBe('no-shows')
    expect(r.artikelen.filter((a) => regels[0]!.artikelen.includes(a.slug)).length).toBeLessThanOrEqual(2)
    expect(r.tips.filter((t) => !t.href).length).toBeGreaterThanOrEqual(2)
    expect(r.tips.filter((t) => t.reden).length).toBe(2)
  })

  it('een eerste afspraak op de dag: voorbereiden en doorvragen', () => {
    const r = kies('dagstart', 'binnendienst', { eersteAfspraak: true })
    expect(r.artikelen.slice(0, 2).every((a) => ['de-eerste-afspraak-voorbereiden', 'doorvragen-in-het-eerste-gesprek', 'het-buying-committee-in-kaart'].includes(a.slug))).toBe(true)
  })

  it('ongelezen gaat voor gelezen', () => {
    const basis = kies('weekreview', 'binnendienst')
    const gelezen = basis.artikelen.map((a) => a.slug)
    const na = kies('weekreview', 'binnendienst', {}, { gelezen })
    expect(na.artikelen.some((a) => gelezen.includes(a.slug))).toBe(false)
  })

  it('verborgen artikelen komen niet terug en het zaad wisselt de volgorde, deterministisch', () => {
    const r = kies('weekstart', 'binnendienst', {}, { artikelen: alle.filter((a) => a.slug !== 'je-funnel-terugrekenen-vanuit-je-doel') })
    expect(r.artikelen.map((a) => a.slug)).not.toContain('je-funnel-terugrekenen-vanuit-je-doel')
    expect(kies('weekstart', 'binnendienst')).toEqual(kies('weekstart', 'binnendienst'))
    const weken = new Set(['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19'].map((z) => kies('weekstart', 'binnendienst', {}, { zaad: z }).artikelen.map((a) => a.slug).join()))
    expect(weken.size).toBeGreaterThan(1)
  })

  it('zonder artikelen nog steeds eigen tips en geen artikelen', () => {
    const r = kies('dagstart', 'binnendienst', {}, { artikelen: [] })
    expect(r.artikelen).toEqual([])
    expect(r.tips.length).toBeGreaterThan(0)
    expect(r.tips.every((t) => t.href === null)).toBe(true)
  })
})
