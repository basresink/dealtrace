import { describe, expect, it } from 'vitest'
import { FUNCTIES, aanVoorNiveau, beschikbaar, functie, startindeling } from '../../shared/functies'
import { KWALITEIT_CATEGORIEEN, eigenaarFilter, filterLink, kwaliteitScore } from '../../shared/datakwaliteit'
import { telItems, zijbalkVoor } from '../../shared/zijbalk'
import type { FunctieRegel, GebruikerContext, OrganisatieContext } from '../../shared/types'

const org: OrganisatieContext = { id: 'org-a', pakket: 'starter', features: {}, iedereenAlles: false }
const stand: FunctieRegel[] = startindeling().map((r) => ({ ...r, organisationId: null }))

function gebruiker(overig: Partial<GebruikerContext> = {}): GebruikerContext {
  return { id: 'u1', rol: 'accountmanager', niveau: 'beginner', werkplek: 'binnendienst', teamId: null, verborgen: [], ...overig }
}

describe('zijbalk per niveau (6.1)', () => {
  it('Beginner 13, Gevorderd 16, Expert 17 items (met Concepten en Meetings)', () => {
    expect(telItems(zijbalkVoor(gebruiker(), org, stand))).toBe(13)
    expect(telItems(zijbalkVoor(gebruiker({ niveau: 'gevorderd' }), org, stand))).toBe(16)
    expect(telItems(zijbalkVoor(gebruiker({ niveau: 'expert' }), org, stand))).toBe(17)
  })

  it('wat uit staat komt in "Nog niet aangezet" met het niveau waarvoor het aanstaat', () => {
    const z = zijbalkVoor(gebruiker(), org, stand)
    expect(z.nietAangezet.map((i) => i.sleutel)).toEqual(['nav.inzichten', 'nav.leadgenerator', 'nav.planning', 'nav.reizen'])
    expect(z.nietAangezet.find((i) => i.sleutel === 'nav.leadgenerator')?.aanVanaf).toBe('gevorderd')
    expect(z.nietAangezet.find((i) => i.sleutel === 'nav.reizen')?.aanVanaf).toBe('expert')
  })

  it('volgorde in Werk volgt het werkplekprofiel', () => {
    const werk = (w: GebruikerContext['werkplek']) =>
      zijbalkVoor(gebruiker({ werkplek: w }), org, stand).groepen.find((g) => g.naam === 'Planning')!.items.map((i) => i.naam)
    expect(werk('binnendienst').indexOf('Belblokken')).toBeLessThan(werk('binnendienst').indexOf('Bezoeken'))
    expect(werk('buitendienst').indexOf('Bezoeken')).toBeLessThan(werk('buitendienst').indexOf('Belblokken'))
  })

  it('Leadgenerator staat in Planning, na Campagnes; Prospects houdt Prospects en Contacten', () => {
    const z = zijbalkVoor(gebruiker({ niveau: 'gevorderd' }), org, stand)
    const planning = z.groepen.find((g) => g.naam === 'Planning')!.items.map((i) => i.sleutel)
    expect(planning).toContain('nav.leadgenerator')
    expect(planning.indexOf('nav.campagnes')).toBeLessThan(planning.indexOf('nav.leadgenerator'))
    expect(z.groepen.find((g) => g.naam === 'Prospects')!.items.map((i) => i.sleutel)).toEqual(['nav.prospects', 'nav.contacten'])
  })

  it('Instellingen van de organisatie is een gewoon item in Beheer voor de beheerder', () => {
    const z = zijbalkVoor(gebruiker({ rol: 'beheerder', niveau: 'expert' }), org, stand)
    expect(z.groepen.find((g) => g.naam === 'Beheer')?.items.map((i) => [i.sleutel, i.route])).toContainEqual(['nav.instellingen', '/instellingen'])
  })

  it('Beginner ziet de labels meedoen en lezen', () => {
    const items = zijbalkVoor(gebruiker(), org, stand).groepen.flatMap((g) => g.items)
    expect(items.find((i) => i.sleutel === 'nav.campagnes')?.label).toBe('meedoen')
    expect(items.find((i) => i.sleutel === 'nav.richting')?.label).toBe('lezen')
  })

  it('Toon minder haalt weg, nooit erbij', () => {
    const z = zijbalkVoor(gebruiker({ verborgen: ['nav.campagnes', 'nav.leadgenerator'] }), org, stand)
    expect(telItems(z)).toBe(12)
    expect(z.groepen.flatMap((g) => g.items).some((i) => i.sleutel === 'nav.leadgenerator')).toBe(false)
  })

  it('Manager-groep alleen voor salesmanager en beheerder; Instellingen niet voor accountmanager', () => {
    const am = zijbalkVoor(gebruiker({ niveau: 'expert' }), org, stand)
    expect(am.groepen.some((g) => g.naam === 'Manager')).toBe(false)
    const sm = zijbalkVoor(gebruiker({ rol: 'salesmanager', niveau: 'expert' }), org, stand)
    expect(sm.groepen.find((g) => g.naam === 'Manager')?.items).toHaveLength(4)
  })

  it('Rapportages: Mijn dashboard op /mijn-dashboard en Funnel, na Prospects en voor Planning', () => {
    const z = zijbalkVoor(gebruiker(), org, stand)
    expect(z.groepen.map((g) => g.naam)).toEqual(['Start', 'Activiteiten', 'Prospects', 'Rapportages', 'Planning'])
    expect(z.groepen.some((g) => (g.naam as string) === 'Resultaten')).toBe(false)
    expect(z.groepen.find((g) => g.naam === 'Rapportages')!.items.map((i) => [i.naam, i.route])).toEqual([['Mijn dashboard', '/mijn-dashboard'], ['Funnel', '/funnel']])
  })

  it('Datakwaliteit staat niet in de zijbalk en gaat aan vanaf Gevorderd', () => {
    expect(functie('data.kwaliteit')?.zijbalk).toBeUndefined()
    expect(beschikbaar('data.kwaliteit', gebruiker(), org, stand)).toEqual({ ok: false, reden: 'niveau' })
    expect(beschikbaar('data.kwaliteit', gebruiker({ niveau: 'gevorderd' }), org, stand).ok).toBe(true)
    expect(beschikbaar('data.kwaliteit', gebruiker({ niveau: 'expert' }), org, stand).ok).toBe(true)
  })

  it('Iedereen ziet alles: geen groep Nog niet aangezet', () => {
    const z = zijbalkVoor(gebruiker(), { ...org, iedereenAlles: true }, stand)
    expect(z.nietAangezet).toHaveLength(0)
    expect(telItems(z)).toBe(17)
  })
})

describe('beschikbaar (4.2)', () => {
  it('geeft de reden niveau, pakket en rol', () => {
    expect(beschikbaar('nav.leadgenerator', gebruiker(), org, stand)).toEqual({ ok: false, reden: 'niveau' })
    expect(beschikbaar('nav.team', gebruiker({ niveau: 'expert' }), org, stand)).toEqual({ ok: false, reden: 'rol' })
    expect(beschikbaar('bestaat.niet', gebruiker(), org, stand)).toEqual({ ok: false, reden: 'rol' })
    const uitPakket = { ...org, features: { uit: ['nav.agenda'] } }
    expect(beschikbaar('nav.agenda', gebruiker(), uitPakket, stand)).toEqual({ ok: false, reden: 'pakket' })
  })

  it('Iedereen ziet alles gaat nooit boven pakket of rol', () => {
    const alles = { ...org, iedereenAlles: true, features: { uit: ['nav.agenda'] } }
    expect(beschikbaar('nav.leadgenerator', gebruiker(), alles, stand).ok).toBe(true)
    expect(beschikbaar('nav.agenda', gebruiker(), alles, stand).ok).toBe(false)
    expect(beschikbaar('nav.team', gebruiker(), alles, stand).ok).toBe(false)
  })

  it('een regel voor de organisatie gaat voor de regel voor alle organisaties', () => {
    const eigen: FunctieRegel[] = [...stand, { functie: 'nav.leadgenerator', niveau: 'beginner', aan: true, organisationId: 'org-a' }]
    expect(aanVoorNiveau('nav.leadgenerator', 'beginner', org, eigen)).toBe(true)
    expect(aanVoorNiveau('nav.leadgenerator', 'beginner', { id: 'org-b' }, eigen)).toBe(false)
  })

  it('een functie zonder regel staat uit', () => {
    expect(aanVoorNiveau('nav.vandaag', 'beginner', org, [])).toBe(false)
  })

  it('elke functie heeft een helpartikel en een startregel per niveau, behalve founderfuncties (P02)', () => {
    const alleenFounder = (f: (typeof FUNCTIES)[number]) => f.rollen !== 'iedereen' && f.rollen.every((r) => r === 'founder')
    for (const f of FUNCTIES) if (!alleenFounder(f)) expect(f.helpartikel).toBeTruthy()
    expect(startindeling()).toHaveLength(FUNCTIES.filter((f) => !alleenFounder(f)).length * 3)
    expect(startindeling().some((r) => r.functie.startsWith('platform.') || r.functie === 'nav.platform')).toBe(false)
  })
})

describe('datakwaliteit', () => {
  it('score is het deel van de controles dat klopt; zonder controles 100', () => {
    expect(kwaliteitScore([])).toBe(100)
    expect(kwaliteitScore([{ aantal: 0, noemer: 0 }])).toBe(100)
    expect(kwaliteitScore([{ aantal: 1, noemer: 4 }, { aantal: 0, noemer: 6 }])).toBe(90)
    expect(kwaliteitScore([{ aantal: 9, noemer: 3 }])).toBe(0)
  })
  it('elke categorie heeft een unieke sleutel, uitleg en een basis', () => {
    expect(new Set(KWALITEIT_CATEGORIEEN.map((c) => c.sleutel)).size).toBe(KWALITEIT_CATEGORIEEN.length)
    for (const c of KWALITEIT_CATEGORIEEN) expect(c.uitleg.length, c.sleutel).toBeGreaterThan(20)
  })
  it('de link naar de prospectlijst volgt de rol en vraagt soms Alle filters', () => {
    const beslisser = KWALITEIT_CATEGORIEEN.find((c) => c.sleutel === 'zonderBeslisser')!
    const klasse = KWALITEIT_CATEGORIEEN.find((c) => c.sleutel === 'zonderKlasse')!
    const website = KWALITEIT_CATEGORIEEN.find((c) => c.sleutel === 'zonderWebsite')!
    expect(filterLink(beslisser, 'accountmanager', true)).toBe('/prospects/alle?bereikbaarheid=zonderBeslisser')
    expect(filterLink(beslisser, 'salesmanager', true)).toBe('/prospects/alle?eigenaar=team&bereikbaarheid=zonderBeslisser')
    expect(filterLink(klasse, 'beheerder', false)).toBe('/prospects/alle?eigenaar=iedereen&klasse=geen')
    expect(filterLink(beslisser, 'accountmanager', false)).toBeNull()
    expect(filterLink(website, 'beheerder', true)).toBeNull()
    expect(eigenaarFilter('founder')).toBe('iedereen')
  })
})
