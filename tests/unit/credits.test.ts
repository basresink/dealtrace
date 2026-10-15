// P33: credits voor alle AI (11.4) en de Gids (F26). Grenzen: 0, 10 procent, 80 procent, precies het
// plafond, kosten groter dan wat over is, een pakketwissel en de bewijsplicht op citaten.
import { describe, expect, it } from 'vitest'
import {
  AI_SOORT, AI_SOORTEN, AGENTGRENS_TEKST, CREDITS_OP_TEKST, PLAFOND_TEKST, bronnenVoorAntwoord, creditsStand, creditsVoor, kiesAssistentSoort, magVragenVoor, meldingNodig, potVoor,
} from '../../shared/credits'
import { controleerAntwoord, materiaalTeksten, mockGids, type Materiaal } from '../../server/utils/assistent'

const stand = (verbruikt: number, pot = 1000, gereserveerd = 0) => creditsStand({ pakket: 'plus', gebruikers: 0, vastePot: pot, verbruikt, gereserveerd })

describe('creditsVoor', () => {
  it('elke soort uit de tabel; een prijs van de founder wint', () => {
    for (const s of AI_SOORTEN) expect(creditsVoor(s)).toBe(AI_SOORT[s].credits)
    expect(creditsVoor('assistent', { prijzen: { assistent: 3 } })).toBe(3)
    expect(creditsVoor('webonderzoek')).toBe(10)
  })
  it('vraag met account: 2, plus 1 per bron boven de drie, plus 1 boven 300 woorden, hooguit 5', () => {
    expect(creditsVoor('assistentUitgebreid')).toBe(2)
    expect(creditsVoor('assistentUitgebreid', { bronnen: 3 })).toBe(2)
    expect(creditsVoor('assistentUitgebreid', { bronnen: 5 })).toBe(4)
    expect(creditsVoor('assistentUitgebreid', { bronnen: 5, woorden: 301 })).toBe(5)
    expect(creditsVoor('assistentUitgebreid', { bronnen: 12, woorden: 900 })).toBe(5)
  })
  it('transcriptie: 61 seconden is 2 credits', () => { expect(creditsVoor('transcriptie', { seconden: 61 })).toBe(2) })
})

describe('potVoor en creditsStand', () => {
  it('pakket maal gebruikers plus extra; 0 gebruikers; aangepast bedrag van de founder', () => {
    expect(potVoor('starter', 3)).toBe(600)
    expect(potVoor('compleet', 0, 500)).toBe(500)
    expect(potVoor('plus', 2, 0, 100)).toBe(200)
  })
  it('pakketwissel midden in de maand: de toegekende pot zakt nooit', () => {
    const s = creditsStand({ pakket: 'starter', gebruikers: 2, toegekend: 1200, verbruikt: 0 })
    expect(s.pot).toBe(1200)
    expect(creditsStand({ pakket: 'compleet', gebruikers: 2, toegekend: 1200, verbruikt: 0 }).pot).toBe(3000)
  })
  it('gereserveerd telt als niet beschikbaar', () => {
    expect(stand(100, 1000, 50)).toMatchObject({ over: 850, gereserveerd: 50 })
  })
})

describe('magVragenVoor', () => {
  it('precies 0 over: op; kosten groter dan wat over is: op', () => {
    expect(magVragenVoor({ stand: stand(1000), kosten: 1, automatisch: false })).toEqual({ ja: false, reden: 'op', status: 402, tekst: CREDITS_OP_TEKST })
    expect(magVragenVoor({ stand: stand(999), kosten: 2, automatisch: false })).toMatchObject({ ja: false, reden: 'op' })
    expect(magVragenVoor({ stand: stand(999), kosten: 1, automatisch: false })).toEqual({ ja: true })
  })
  it('plafond precies bereikt; een collega zonder plafond gaat door; automatische AI telt niet op het plafond', () => {
    expect(magVragenVoor({ stand: stand(0), kosten: 1, automatisch: false, plafond: 300, verbruiktGebruiker: 299 })).toEqual({ ja: true })
    expect(magVragenVoor({ stand: stand(0), kosten: 1, automatisch: false, plafond: 300, verbruiktGebruiker: 300 })).toEqual({ ja: false, reden: 'plafond', status: 402, tekst: PLAFOND_TEKST })
    expect(magVragenVoor({ stand: stand(0), kosten: 1, automatisch: false, plafond: null, verbruiktGebruiker: 5000 })).toEqual({ ja: true })
    expect(magVragenVoor({ stand: stand(0), kosten: 1, automatisch: true, plafond: 0 })).toEqual({ ja: true })
  })
  it('agentgrens: automatisch stopt onder 10 procent na de aanroep; een gebruiker gaat door', () => {
    expect(magVragenVoor({ stand: stand(899), kosten: 1, automatisch: true })).toEqual({ ja: true })
    expect(magVragenVoor({ stand: stand(900), kosten: 1, automatisch: true })).toEqual({ ja: false, reden: 'agentgrens', status: 402, tekst: AGENTGRENS_TEKST })
    expect(magVragenVoor({ stand: stand(950), kosten: 1, automatisch: false })).toEqual({ ja: true })
  })
  it('soort niet in het pakket: 403', () => {
    expect(magVragenVoor({ stand: stand(0), kosten: 10, automatisch: false, soort: 'webonderzoek', pakket: 'plus' })).toMatchObject({ ja: false, reden: 'pakket', status: 403 })
  })
})

describe('meldingNodig', () => {
  it('80 procent: één keer, ook als één handeling er overheen springt', () => {
    expect(meldingNodig(stand(790), stand(800), {})).toBe('80')
    expect(meldingNodig(stand(700), stand(850), {})).toBe('80')
    expect(meldingNodig(stand(790), stand(800), { gemeld80: true })).toBeNull()
    expect(meldingNodig(stand(800), stand(801), {})).toBeNull()
  })
  it('10 procent over', () => {
    expect(meldingNodig(stand(900), stand(901), {})).toBe('10')
    expect(meldingNodig(stand(900), stand(901), { gemeld10: true })).toBeNull()
    expect(meldingNodig(stand(0, 0), stand(0, 0), {})).toBeNull()
  })
})

describe('kiesAssistentSoort', () => {
  it('met account duurder; chip weg is een gewone vraag; webonderzoek alleen in Compleet', () => {
    expect(kiesAssistentSoort('Hoe begin ik?', { accountId: 'a1' }, 'plus')).toEqual({ soort: 'assistentUitgebreid' })
    expect(kiesAssistentSoort('Hoe begin ik?', { accountId: null }, 'plus')).toEqual({ soort: 'assistent' })
    expect(kiesAssistentSoort('Wat staat er op de vacaturepagina?', {}, 'compleet')).toEqual({ soort: 'webonderzoek' })
    expect(kiesAssistentSoort('Zoek op internet naar nieuws', {}, 'plus')).toEqual({ soort: 'webonderzoek', nietInPakket: true })
  })
})

// Golden master van de Gids: drie vaste vragen op Voltvast-materiaal (fictief).
const MATERIAAL = (vraag: string, account = true): Materiaal => ({
  vraag,
  helpcenter: [{ slug: 'een-belblok-uitvoeren-met-een-script', titel: 'Een belblok uitvoeren met een script', samenvatting: 'Een blok tijd om achter elkaar te bellen, met een script dat je helpt het gesprek te openen.', inhoud: '' }],
  verhaal: {
    kernzin: 'Voltvast is een technische groothandel voor installateurs in Midden- en Noord-Nederland.', brancheverhaal: null, kernbelofte: 'Uw materiaal staat op het afgesproken uur op de bouw.',
    concurrenten: [{ id: 'cc-02', naam: 'Online webgroothandel', alsDeKlantZegt: '"Online is het goedkoper." Antwoord: "Per stuk soms wel."', zoZegJeHet: null }], winpunten: [],
  },
  account: account ? { id: 'pr-g39', naam: 'Testinstallatie Leidingdal', plaats: 'Assen', fase: 'afspraak-gepland', status: 'gescoord', brancheId: null, leverancierId: null, contacten: [], verslagen: [] } : null,
  taken: [{ id: 't1', titel: 'Bel Testinstallatie Leidingdal', soort: 'bellen', op: null, accountId: 'pr-g39' }],
})
describe('de Gids (golden master)', () => {
  it('bezwaren: citaat uit het verhaal met bron en acties als concept', () => {
    const a = controleerAntwoord(MATERIAAL('Welke bezwaren kan ik verwachten?'), mockGids(MATERIAAL('Welke bezwaren kan ik verwachten?')))
    expect(a.tekst).toContain('Online is het goedkoper.')
    expect(a.bronnen).toEqual([{ soort: 'verhaal', label: 'Verhaal: Online webgroothandel', ref: 'cc-02', citaat: '"Online is het goedkoper." Antwoord: "Per stuk soms wel."' }])
    expect(a.acties.map((x) => x.soort)).toEqual(['taak', 'mailconcept', 'account'])
  })
  it('helpcenter: het artikel als bron en als link', () => {
    const m = MATERIAAL('Hoe werkt een belblok?', false)
    const a = controleerAntwoord(m, mockGids(m))
    expect(a.bronnen[0]).toMatchObject({ soort: 'help', ref: 'een-belblok-uitvoeren-met-een-script' })
    expect(a.acties[0]).toEqual({ soort: 'artikel', label: 'Open het artikel', slug: 'een-belblok-uitvoeren-met-een-script' })
  })
  it('geen antwoord: doorgestuurd zonder bronnen', () => {
    const m = { ...MATERIAAL('Wat is de hoofdstad van Peru?', false), helpcenter: [], taken: [] }
    expect(mockGids(m)).toMatchObject({ doorgestuurd: true, bronnen: [] })
  })
  it('bewijsplicht: een verzonnen citaat valt weg; zonder bron geen bewering over het account', () => {
    const m = MATERIAAL('x')
    const r = bronnenVoorAntwoord(materiaalTeksten(m), [{ soort: 'verhaal', label: 'Echt', citaat: 'Online is het goedkoper.' }, { soort: 'account', label: 'Verzonnen', citaat: 'Ze gaan failliet.' }])
    expect(r.geldig.map((b) => b.label)).toEqual(['Echt'])
    expect(r.afgewezen.map((b) => b.label)).toEqual(['Verzonnen'])
    const a = controleerAntwoord(m, { tekst: 'Testinstallatie Leidingdal gaat failliet.', bronnen: [{ soort: 'account', label: 'Verzonnen', citaat: 'Ze gaan failliet.' }], acties: [{ soort: 'account', label: 'x', accountId: 'ander-account' }] })
    expect(a.bronnen).toEqual([])
    expect(a.tekst).not.toContain('failliet')
    expect(a.acties).toEqual([])
  })
})
