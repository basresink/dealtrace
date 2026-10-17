// De automatische dagplanning (F3 Dagplanner): de voorkeur, wanneer de geplande taak aan de beurt is
// (tijdstip, stille uren, werkdag), welke blokken echte agenda-items worden binnen de capaciteit, en
// herplannen met `nu` als parameter: verzet, geannuleerd, uitgelopen, niets verdwijnt stil.
import { describe, expect, it } from 'vitest'
import { blokkenMetItems, controleerPlanTijd, dagplanningKop, dagplanningVoorkeur, herplan, itemsUitPlan, planAanDeBeurt, vastSleutel, vastVerschil, type PlanItem, type VastStand } from '../../shared/dagplanning'
import { bereikbaarheid, planDag, type BereikPoging, type PlanInput } from '../../shared/dagritme'
import { nlTijdstip } from '../../shared/datum'

const om = (d: string, u: number, m = 0) => nlTijdstip(d, u, m).toISOString()
const DAG = '2026-10-19' // maandag
const STIL = { stilVan: 19, stilTot: 7, weekendStil: true }

const pogingen: BereikPoging[] = []
for (let i = 0; i < 20; i++) pogingen.push({ op: om('2026-10-13', 9, i), brancheId: 'br-1', gesproken: i < 2 }, { op: om('2026-10-13', 16, i), brancheId: 'br-1', gesproken: i < 7 })
const basis = (extra: Partial<PlanInput> = {}): PlanInput => ({
  dag: DAG, nu: nlTijdstip(DAG, 7), modus: 'buiten', vast: [
    { id: 'ap1', soort: 'bezoek', start: om(DAG, 10), eind: om(DAG, 11), titel: 'Bezoek Testinstallatie Vonkdal', accountId: 'a1', reisMinuten: 24, eerste: true },
    { id: 'ap2', soort: 'afspraak', start: om(DAG, 13), eind: om(DAG, 14), titel: 'Online Testzorg Lindehof', accountId: 'a2' },
  ],
  kansen: [{ id: 'k1', naam: 'Testkoeling Noorderveld', start: om(DAG, 11, 15), sub: '3 min omrijden · score 112', accountId: 'k1' }],
  belblokken: [], belTaken: 9, acties: 3, bereik: bereikbaarheid(pogingen, ['br-1']), ...extra,
})
const opties = { belacties: 9, capaciteit: 40, kansenMax: 2 }

describe('voorkeur en tijdstip', () => {
  it('standaard uit om 07:00; een ongeldig tijdstip valt terug', () => {
    expect(dagplanningVoorkeur(null)).toEqual({ automatisch: false, tijd: '07:00' })
    expect(dagplanningVoorkeur({ automatisch: true, tijd: '25:00' })).toEqual({ automatisch: true, tijd: '07:00' })
    expect(controleerPlanTijd('07:15')).toBeNull()
    expect(controleerPlanTijd('05:00')).toMatch(/tussen 06:00 en 12:00/)
    expect(controleerPlanTijd('07:10')).toMatch(/kwartier/)
  })
  it('aan de beurt op of na het tijdstip, na de stille uren, alleen op een werkdag en niet na 16:00', () => {
    const v = { automatisch: true, tijd: '07:00' }
    expect(planAanDeBeurt(v, nlTijdstip(DAG, 6, 45), STIL)).toBeNull()
    expect(planAanDeBeurt(v, nlTijdstip(DAG, 7, 0), STIL)?.toISOString()).toBe(om(DAG, 7))
    expect(planAanDeBeurt(v, nlTijdstip(DAG, 11, 0), STIL)).not.toBeNull()
    expect(planAanDeBeurt(v, nlTijdstip(DAG, 16, 5), STIL)).toBeNull()
    expect(planAanDeBeurt({ ...v, automatisch: false }, nlTijdstip(DAG, 8), STIL)).toBeNull()
    expect(planAanDeBeurt(v, nlTijdstip('2026-10-17', 8), STIL)).toBeNull() // zaterdag
    // Stil tot 08:00: het tijdstip 07:00 valt erin, dus pas om 08:00.
    expect(planAanDeBeurt(v, nlTijdstip(DAG, 7, 30), { ...STIL, stilTot: 8 })).toBeNull()
    expect(planAanDeBeurt(v, nlTijdstip(DAG, 8, 0), { ...STIL, stilTot: 8 })?.toISOString()).toBe(om(DAG, 8))
  })
})

describe('wat de Dagplanner schrijft', () => {
  it('belblok op het beste uur met de belacties, voorbereiding, kans langs de route en lunch; vaste punten nooit', () => {
    const items = itemsUitPlan(planDag(basis()), opties)
    const kort = items.map((i) => [i.sleutel, i.start])
    expect(kort).toContainEqual(['bel:1', om(DAG, 16)])
    expect(kort).toContainEqual(['voorbereiding:ap1', om(DAG, 9, 6)])
    expect(kort).toContainEqual(['kans:k1', om(DAG, 11, 15)])
    expect(kort).toContainEqual(['lunch', om(DAG, 12)])
    expect(items.find((i) => i.sleutel === 'bel:1')!.aantal).toBe(9)
    expect(items.some((i) => i.sleutel === 'ap1' || i.sleutel === 'ap2')).toBe(false)
  })
  it('capaciteit: niet meer belacties dan de capaciteit en wat in de blokken past; kansen binnen de bezoeken', () => {
    const binnen = itemsUitPlan(planDag(basis({ modus: 'binnen', belTaken: 60 })), { belacties: 60, capaciteit: 40, kansenMax: 0 })
    const bel = binnen.filter((i) => i.soort === 'belblok')
    expect(bel).toHaveLength(3)
    expect(bel.reduce((s, i) => s + (i.aantal ?? 0), 0)).toBe(30)
    expect(itemsUitPlan(planDag(basis({ modus: 'binnen', belTaken: 60 })), { belacties: 60, capaciteit: 12, kansenMax: 0 }).filter((i) => i.soort === 'belblok').reduce((s, i) => s + (i.aantal ?? 0), 0)).toBe(12)
    expect(itemsUitPlan(planDag(basis()), { ...opties, kansenMax: 0 }).some((i) => i.soort === 'kans')).toBe(false)
  })
  it('een lunch in de gekoppelde agenda telt als de lunch; bezet blijft staan', () => {
    const p = planDag(basis({ vast: [...basis().vast, { id: 'bezet:1', soort: 'bezet', start: om(DAG, 12), eind: om(DAG, 12, 30), titel: 'Lunch' }] }))
    expect(p.blokken.filter((b) => b.soort === 'lunch')).toHaveLength(0)
    expect(p.blokken.find((b) => b.soort === 'bezet')).toMatchObject({ vast: true, href: null })
  })
  it('blokkenMetItems toont de vaste punten en de items van de Dagplanner, zonder wat ongedaan is', () => {
    const plan = planDag(basis())
    const items = itemsUitPlan(plan, opties).map((i) => (i.soort === 'lunch' ? { ...i, status: 'ongedaan' as const } : i))
    const b = blokkenMetItems(plan, items)
    expect(b.some((x) => x.soort === 'lunch')).toBe(false)
    expect(b.find((x) => x.dagplanner === 'bel:1')).toMatchObject({ soort: 'bel', start: om(DAG, 16) })
    expect(b.some((x) => x.id === 'ap1' && x.vast)).toBe(true)
  })
})

describe('herplannen', () => {
  const NAAR = { belacties: 'je vaste belblok van dinsdag 20 oktober 09:00', bezoek: 'dinsdag 20 oktober' }
  const oud = (): PlanItem[] => itemsUitPlan(planDag(basis()), opties).map((i) => ({ ...i, sessieId: i.soort === 'belblok' ? 's1' : null, taakId: i.soort === 'kans' ? 't1' : null }))

  it('niets veranderd: alles blijft, geen regels', () => {
    const h = herplan(oud(), itemsUitPlan(planDag(basis()), opties), nlTijdstip(DAG, 7, 5), NAAR)
    expect(h.verplaatst).toEqual([])
    expect(h.vervalt).toEqual([])
    expect(h.nieuw).toEqual([])
    expect(h.regels).toEqual([])
  })

  it('een geannuleerde afspraak: de voorbereiding vervalt niet stil, de vrijgekomen plek krijgt een kans', () => {
    const nu = nlTijdstip(DAG, 9, 0)
    const zonderAp1 = basis({ nu, vast: [basis().vast[1]!], kansen: [...basis().kansen!, { id: 'k2', naam: 'Testvastgoed Rietzoom', start: om(DAG, 10, 15), sub: '4 min omrijden · score 112', accountId: 'k2' }] })
    const nieuw = itemsUitPlan(planDag(zonderAp1), opties)
    const h = herplan(oud(), nieuw, nu, NAAR)
    expect(h.vervalt.map((i) => i.sleutel)).toContain('voorbereiding:ap1')
    expect(h.regels.some((r) => r.startsWith('Voorbereiding Bezoek Testinstallatie Vonkdal vervalt'))).toBe(true)
    expect(h.nieuw.map((i) => i.sleutel)).toContain('kans:k2')
    expect(h.regels).toContain('Op de vrijgekomen plek: kans Testvastgoed Rietzoom om 10:15, 4 min omrijden · score 112.')
    // De voorbereiding gaat nu naar de volgende afspraak; elke wijziging heeft een regel.
    expect(h.nieuw.map((i) => i.sleutel)).toContain('voorbereiding:ap2')
    expect(h.regels.length).toBe(h.verplaatst.length + h.vervalt.length + h.nieuw.length + (h.vervalt.some((v) => v.soort === 'belblok' || v.soort === 'kans') ? 0 : 1))
  })

  it('een verzette afspraak op het beste uur: het belblok schuift; wat al voorbij is, blijft', () => {
    const nu = nlTijdstip(DAG, 9, 30)
    const p = basis({ nu, vast: [...basis().vast, { id: 'ap3', soort: 'afspraak', start: om(DAG, 16), eind: om(DAG, 17), titel: 'Online Testkoeling' }] })
    const h = herplan(oud(), itemsUitPlan(planDag(p), opties), nu, NAAR)
    const bel = h.verplaatst.find((v) => v.oud.sleutel === 'bel:1')!
    expect(bel.nieuw.start).not.toBe(om(DAG, 16))
    expect(bel.nieuw.sessieId).toBe('s1')
    expect(h.regels[0]).toMatch(/^Het belblok schoof van 16:00 naar \d\d:00\.$/)
    // De voorbereiding van 09:06 is voorbij: die telt niet mee.
    expect([...h.verplaatst.map((v) => v.oud.sleutel), ...h.vervalt.map((v) => v.sleutel)]).not.toContain('voorbereiding:ap1')
  })

  it('een belblok zonder plek meer schuift met zijn belacties door naar het eerstvolgende moment', () => {
    const nu = nlTijdstip(DAG, 15, 0)
    const vol = basis({ nu, vast: [...basis().vast, { id: 'ap4', soort: 'afspraak', start: om(DAG, 15, 30), eind: om(DAG, 18), titel: 'Online Testbouw Hoogwerf' }] })
    const h = herplan(oud(), itemsUitPlan(planDag(vol), opties), nu, NAAR)
    expect(h.vervalt.map((i) => i.sleutel)).toContain('bel:1')
    expect(h.regels).toContain('Het belblok van 16:00 past niet meer vandaag. De 9 belacties schuiven naar je vaste belblok van dinsdag 20 oktober 09:00.')
    expect(h.regels).not.toContain('Niets schoof naar een andere dag.')
  })

  it('een kans die niet meer past, schuift naar de volgende werkdag', () => {
    const nu = nlTijdstip(DAG, 9, 0)
    const h = herplan(oud(), itemsUitPlan(planDag(basis({ nu, kansen: [] })), opties), nu, NAAR)
    expect(h.regels).toContain('Kans: Testkoeling Noorderveld past niet meer vandaag en schuift naar dinsdag 20 oktober.')
  })
})

describe('vaste punten', () => {
  const v = (x: Partial<VastStand> = {}): VastStand => ({ id: 'ap1', soort: 'bezoek', start: om(DAG, 10), eind: om(DAG, 11), titel: 'Bezoek Testinstallatie Vonkdal', status: 'gepland', ...x })
  it('verzet, geannuleerd, uitgelopen en nieuw', () => {
    expect(vastVerschil([v()], [v({ start: om(DAG, 11), eind: om(DAG, 12) })], DAG)).toEqual(['Bezoek Testinstallatie Vonkdal is verzet naar 11:00.'])
    expect(vastVerschil([v()], [v({ start: om('2026-10-22', 10), eind: om('2026-10-22', 11) })], DAG)[0]).toMatch(/is verzet naar do 22 okt 10:00\.$/)
    expect(vastVerschil([v()], [v({ status: 'geannuleerd' })], DAG)).toEqual(['Bezoek Testinstallatie Vonkdal is geannuleerd.'])
    expect(vastVerschil([v()], [v({ eind: om(DAG, 11, 30) })], DAG)).toEqual(['Bezoek Testinstallatie Vonkdal loopt uit tot 11:30.'])
    expect(vastVerschil([v()], [v(), v({ id: 'ap9', soort: 'afspraak', titel: 'Online Testkoeling', start: om(DAG, 14), eind: om(DAG, 15) })], DAG)).toEqual(['Nieuw: Online Testkoeling om 14:00.'])
    expect(vastVerschil(null, [v()], DAG)).toEqual([])
  })
  it('de vingerafdruk verandert bij een wijziging, niet bij afronden', () => {
    expect(vastSleutel([v()])).toBe(vastSleutel([v({ status: 'afgerond' })]))
    expect(vastSleutel([v()])).not.toBe(vastSleutel([v({ eind: om(DAG, 11, 15) })]))
  })
  it('de kop zegt wanneer de dag is ingedeeld of herpland', () => {
    expect(dagplanningKop({ geplandOp: om(DAG, 7), wijzigingen: 0, samenvatting: '1 afspraak, 1 bezoek, 1 belblok' })).toEqual({ titel: 'Je dag staat klaar.', lede: 'Ingedeeld om 07:00 · 1 afspraak, 1 bezoek, 1 belblok' })
    expect(dagplanningKop({ geplandOp: om(DAG, 7), herplandOp: om(DAG, 9, 12), wijzigingen: 1, samenvatting: '' })).toEqual({ titel: 'Je dag is opnieuw ingedeeld.', lede: 'Herpland om 09:12 · 1 wijziging' })
  })
})
