import { describe, expect, it } from 'vitest'
import { RITMES_STARTSET, afrondTekst, kiesRitme, ritmeRapport, startRitme, valideerRitme, verwerkUitkomst, type Ritme } from '../../shared/hercontact'
import { nlMoment } from '../../shared/datum'
import { PRIORITEITEN, PRIO_LABEL, TAAK_TYPES, groepVan, herhalingAantal, horizon, isDringend, isPrioriteit, ordenTaken, rondTaakAf, uitstellen, vervalLabel, volgendeStap, voorinvullingUitInzicht, type Taak } from '../../shared/taken'
import { kiesAanleidingVanDeDag, samenvattingsregel, vandaagKicker } from '../../shared/vandaag'

const NU = new Date('2026-10-14T08:00:00Z') // woensdag 10:00 in Nederland
const ritmes: Ritme[] = RITMES_STARTSET.map((r, i) => ({ ...r, id: `r${i}` }))
const koud = ritmes.find((r) => r.naam === 'Koud')!
const dag = (d: Date | string) => nlMoment(typeof d === 'string' ? new Date(d) : d).datum

describe('hercontactritme (F13)', () => {
  it('de startset: Koud, Warm, Winback, Buitendienst koud, allemaal geldig', () => {
    expect(ritmes.map((r) => r.naam)).toEqual(['Koud', 'Warm', 'Winback', 'Buitendienst koud'])
    for (const r of ritmes) expect(valideerRitme(r)).toEqual([])
    expect(koud.stappen.map((s) => `${s.dagOffset}${s.kanaal}`)).toEqual(['0bellen', '3bellen', '7linkedin', '12bellen', '21mail'])
  })
  it('kiesRitme op bron en werkplek', () => {
    expect(kiesRitme(ritmes, 'koud', 'buitendienst')?.naam).toBe('Buitendienst koud')
    expect(kiesRitme(ritmes, 'koud', 'binnendienst')?.naam).toBe('Koud')
    expect(kiesRitme(ritmes, 'warm', 'buitendienst')?.naam).toBe('Warm')
  })
  it('Koud: vijf keer geen reactie, dan geparkeerd met terugkomdatum na 180 dagen', () => {
    let stand = startRitme(koud, NU)
    let nu = NU
    const kanalen: string[] = []
    for (let stap = 1; stap <= 4; stap++) {
      const r = verwerkUitkomst(stand, koud, 'geen_reactie', nu)
      expect(r.actie).toBe('volgende')
      kanalen.push(r.volgende!.kanaal)
      stand = r.stand
      nu = new Date(r.volgende!.op)
    }
    expect(kanalen).toEqual(['bellen', 'linkedin', 'bellen', 'mail'])
    const laatste = verwerkUitkomst(stand, koud, 'geen_reactie', nu)
    expect(laatste.actie).toBe('parkeren')
    expect(laatste.stand.actief).toBe(false)
    expect(Math.round((Date.parse(laatste.parkeerTot!) - Date.parse(dag(nu))) / 864e5)).toBe(180)
    expect(afrondTekst(laatste)).toMatch(/^Afgerond\. Geparkeerd tot \d{4}-\d{2}-\d{2}\.$/)
  })
  it('stappen landen op dag 0, 3, 7, 12 en 21 (werkdagen) na de start', () => {
    let stand = startRitme(koud, NU)
    const dagen: number[] = []
    for (let i = 0; i < 4; i++) {
      const r = verwerkUitkomst(stand, koud, 'geen_reactie', new Date(stand.volgendeOp!))
      dagen.push(Math.round((Date.parse(dag(r.volgende!.op)) - Date.parse(dag(NU))) / 864e5))
      stand = r.stand
    }
    expect(dagen).toEqual([5, 7, 12, 21]) // dag 3 valt op zaterdag: maandag (5)
  })
  it('voicemail: korte volgende stap, mail binnen 1 werkdag', () => {
    const r = verwerkUitkomst(startRitme(koud, NU), koud, 'voicemail', NU)
    expect(r.volgende).toMatchObject({ stap: 2, kanaal: 'mail' })
    expect(dag(r.volgende!.op)).toBe('2026-10-15')
  })
  it('later met datum, afspraak, nee, nieuw contact', () => {
    const s = startRitme(koud, NU)
    expect(verwerkUitkomst(s, koud, 'later', NU, { laterOp: '2026-11-20' })).toMatchObject({ actie: 'later', volgende: { stap: 2 } })
    expect(dag(verwerkUitkomst(s, koud, 'later', NU, { laterOp: '2026-11-20' }).volgende!.op)).toBe('2026-11-20')
    expect(verwerkUitkomst(s, koud, 'afspraak', NU)).toMatchObject({ actie: 'afspraak', stand: { actief: false } })
    expect(verwerkUitkomst(s, koud, 'geen_interesse', NU).actie).toBe('nee')
    expect(verwerkUitkomst(s, koud, 'nieuw_contact', NU)).toMatchObject({ actie: 'opnieuw', volgende: { stap: 1 } })
  })
  it('idempotent per stap', () => {
    const r1 = verwerkUitkomst(startRitme(koud, NU), koud, 'geen_reactie', NU)
    const r2 = verwerkUitkomst(r1.stand, koud, 'geen_reactie', NU, { stap: 1 })
    expect(r2.alVerwerkt).toBe(true)
    expect(r2.stand).toBe(r1.stand)
  })
  it('rapport per ritme', () => {
    const r = ritmeRapport([
      { actief: false, geschiedenis: [{ stap: 1, uitkomst: 'geen_reactie', op: '' }, { stap: 2, uitkomst: 'afspraak', op: '' }] },
      { actief: false, geparkeerdTot: '2027-01-01', geschiedenis: [] },
    ])
    expect(r).toMatchObject({ afspraken: 1, perPoging: { 2: 1 }, geparkeerdProcent: 50, gemiddeldePogingen: 2 })
  })
})

const taak = (p: Partial<Taak> = {}): Taak => ({ id: 't1', title: 'Poging 1: Testinstallatie Koperwiek', status: 'open', actionType: 'bellen', priority: 'middel', dueDate: NU.toISOString(), ownerId: 'u1', accountId: 'a1', ruleId: 'r17', data: { herkomst: { bron: 'ritme' }, poging: { n: 1, van: 5 } }, ...p })

describe('rondTaakAf (gat 11, 12)', () => {
  it('een contacttaak zonder uitkomst geeft een fout', () => {
    expect(rondTaakAf(taak(), {}, { nu: NU }).fout).toBe('Kies een uitkomst')
    expect(rondTaakAf(taak({ actionType: 'taak' }), {}, { nu: NU }).fout).toBeUndefined()
  })
  it('elke uitkomst uit 7.3 geeft stuurvelden, activiteit en gebeurtenissen', () => {
    const stand = startRitme(koud, NU)
    const geval = (uitkomst: any, extra = {}) => rondTaakAf(taak(), { uitkomst, ...extra }, { nu: NU, ritme: koud, stand, eersteContact: true })
    expect(geval('afspraak').gebeurtenissen).toEqual(['eerste-contact', 'gesprek-gevoerd', 'eerste-afspraak-gepland'])
    expect(geval('later', { laterOp: '2026-11-01' })).toMatchObject({ later: '2026-11-01', gebeurtenissen: ['eerste-contact', 'gesprek-gevoerd'] })
    expect(geval('later').fout).toContain('datum')
    expect(geval('geen_reactie')).toMatchObject({ gebeurtenissen: [], stuur: { contactmoment: false, laatsteCall: NU.toISOString() } })
    expect(geval('voicemail').vervolgtaak?.actionType).toBe('mailen')
    expect(geval('nieuw_contact').gebeurtenissen).toEqual(['eerste-contact'])
    expect(geval('niet_geschikt').nee).toEqual({ reden: 'Niet geschikt' })
    expect(geval('geen_interesse').fout).toContain('reden')
    expect(geval('geen_interesse', { reden: 'Geen budget' }).nee).toMatchObject({ reden: 'Geen budget' })
    expect(geval('geen_reactie').activiteit).toMatchObject({ soort: 'gebeld', kanaal: 'telefoon', uitkomst: 'geen_reactie' })
  })
  it('een tweede keer met dezelfde sleutel verandert niets', () => {
    const r = rondTaakAf(taak({ status: 'klaar', data: { afronding: { sleutel: 'k1' } } }), { uitkomst: 'geen_reactie', sleutel: 'k1' }, { nu: NU })
    expect(r.alAfgerond).toBe(true)
    expect(r.fout).toBeUndefined()
    expect(rondTaakAf(taak({ status: 'klaar', data: { afronding: { sleutel: 'k1' } } }), { uitkomst: 'geen_reactie', sleutel: 'k2' }, { nu: NU }).fout).toBe('Deze taak is al afgerond')
  })
  it('vervolgtaak erft de herkomst (inzicht, regel, actiesoort, uitvoerder)', () => {
    const r = rondTaakAf(taak({ signalId: 's1' }), { uitkomst: 'geen_reactie' }, { nu: NU, ritme: koud, stand: startRitme(koud, NU) })
    expect(r.vervolgtaak).toMatchObject({ title: 'Poging 2: Testinstallatie Koperwiek', data: { herkomst: { bron: 'ritme', inzichtId: 's1', regelId: 'r17', actiesoort: 'bellen', uitvoerder: 'u1' }, poging: { n: 2, van: 5 } } })
    const h = rondTaakAf(taak({ actionType: 'taak', ruleId: null, data: { herkomst: 'handmatig', herhaling: { soort: 'wekelijks', teller: 1, max: 3 } } }), {}, { nu: NU })
    expect(h.vervolgtaak).toMatchObject({ data: { herkomst: { bron: 'handmatig', actiesoort: 'taak', uitvoerder: 'u1' }, herhaling: { teller: 2, max: 3 } } })
    expect(dag(h.vervolgtaak!.due)).toBe('2026-10-21')
    expect(rondTaakAf(taak({ actionType: 'taak', data: { herhaling: { soort: 'wekelijks', teller: 3, max: 3 } } }), {}, { nu: NU }).vervolgtaak).toBeNull()
  })
})

describe('ordenen, horizon en uitstellen', () => {
  const t = (id: string, due: string | null, priority = 'middel') => ({ id, dueDate: due, priority })
  const lijst = [t('later', '2026-10-20T08:00:00Z'), t('geen', null), t('vandaag-laag', '2026-10-14T12:00:00Z', 'laag'), t('over', '2026-10-10T08:00:00Z'), t('vandaag-hoog', '2026-10-14T13:00:00Z', 'hoog'), t('ver', '2026-11-30T08:00:00Z')]
  it('achterstallig altijd eerst, dan vandaag op prioriteit, dan later, zonder datum achteraan', () => {
    expect(ordenTaken(lijst, NU).map((x) => x.id)).toEqual(['over', 'vandaag-hoog', 'vandaag-laag', 'later', 'ver', 'geen'])
  })
  it('horizon: achterstallig en ongedateerd bovenaan in Vandaag (gat 39)', () => {
    const h = horizon(lijst, NU)
    expect(h.vandaag.map((x) => x.id)).toEqual(['over', 'vandaag-hoog', 'vandaag-laag', 'geen'])
    expect(h.komendeWeek.map((x) => x.id)).toEqual(['later'])
    expect(h.week23).toEqual([])
  })
  it('groepen', () => {
    expect(['over', 'vandaag-hoog', 'later', 'geen'].map((id) => groepVan(lijst.find((x) => x.id === id)!, NU))).toEqual(['Achterstallig', 'Vandaag', 'Later', 'Geen vervaldatum'])
    expect(groepVan({ dueDate: '2026-10-15T08:00:00Z' }, NU)).toBe('Morgen')
    expect(groepVan({ dueDate: '2026-10-17T08:00:00Z' }, NU)).toBe('Deze week')
  })
  it('uitstellen houdt het tijdstip en telt vanaf de oude datum als die in de toekomst ligt', () => {
    expect(uitstellen({ dueDate: '2026-10-16T13:30:00Z' }, 'werkdag', NU)).toBe('2026-10-19T13:30:00.000Z') // vrijdag naar maandag
    expect(uitstellen({ dueDate: '2026-10-10T13:30:00Z' }, 'werkdag', NU)).toBe('2026-10-15T13:30:00.000Z') // oud: vanaf vandaag
    expect(dag(uitstellen({ dueDate: '2026-10-14T13:30:00Z' }, 'week', NU))).toBe('2026-10-21')
  })
  it('vervalLabel', () => {
    expect(vervalLabel('2026-10-11T08:00:00Z', NU)).toBe('3 dagen over tijd')
    expect(vervalLabel('2026-10-14T08:00:00Z', NU)).toBe('vandaag 10:00')
    expect(vervalLabel(null, NU)).toBe('geen vervaldatum')
  })
  it('taak uit een inzicht: zonder voorstel, relevantie precies 80', () => {
    expect(voorinvullingUitInzicht({ id: 's', title: 'x', type: 'vacature', relevanceScore: 80, accountNaam: 'Teeuwen Bouw' })).toMatchObject({ title: 'Volg op: vacature bij Teeuwen Bouw', priority: 'hoog', actionType: 'taak', herkomst: 'inzicht', signalId: 's' })
    expect(voorinvullingUitInzicht({ id: 's', title: 'x', type: 'v', relevanceScore: 79 }).priority).toBe('middel')
    expect(voorinvullingUitInzicht({ id: 's', title: 'x', type: 'v', relevanceScore: 50, data: { voorstel: { title: 'Bel over vacature', actionType: 'bellen', priority: 'laag' } } })).toMatchObject({ title: 'Bel over vacature', actionType: 'bellen' })
  })
})

describe('nieuwe taak in de opzet van DealDrive', () => {
  it('vier prioriteiten met urgent; urgent gaat voor hoog in de volgorde', () => {
    expect(PRIORITEITEN.map((p) => PRIO_LABEL[p])).toEqual(['Laag', 'Middel', 'Hoog', 'Urgent'])
    expect([isPrioriteit('urgent'), isPrioriteit('hoog'), isPrioriteit('normaal'), isPrioriteit(undefined)]).toEqual([true, true, false, false])
    expect([isDringend('urgent'), isDringend('hoog'), isDringend('middel')]).toEqual([true, true, false])
    const t = (id: string, priority: string) => ({ id, priority, dueDate: '2026-10-14T12:00:00Z' })
    expect(ordenTaken([t('a', 'hoog'), t('b', 'laag'), t('c', 'urgent'), t('d', 'middel')], NU).map((x) => x.id)).toEqual(['c', 'a', 'd', 'b'])
  })
  it('type als knoppen: Te doen, Bellen, Mailen, Bericht, Bezoek en LinkedIn, elk een actiesoort', () => {
    expect(TAAK_TYPES.map((x) => x.label)).toEqual(['Te doen', 'Bellen', 'Mailen', 'Bericht', 'Bezoek', 'LinkedIn'])
    expect(TAAK_TYPES.map((x) => x.id)).toEqual(['taak', 'bellen', 'mailen', 'bericht', 'bezoek', 'linkedin'])
  })
  it('herhalingAantal: wekelijks tot en met de einddatum, werkdagen zonder weekend, hooguit 52', () => {
    const eerste = '2026-10-14T08:00:00Z' // woensdag
    expect(herhalingAantal(eerste, 'wekelijks', '2026-11-04')).toBe(4)
    expect(herhalingAantal(eerste, 'wekelijks', '2026-10-14')).toBe(1)
    expect(herhalingAantal(eerste, 'werkdag', '2026-10-20')).toBe(5) // wo, do, vr, ma, di
    expect(herhalingAantal(eerste, 'werkdag', '2028-01-01')).toBe(52)
    expect(herhalingAantal('', 'wekelijks', '2026-11-04')).toBe(1)
  })
  it('volgendeStap: urgent, over tijd, laatste poging, inzicht en standaard', () => {
    expect(volgendeStap({ priority: 'urgent', dueDate: null }, NU)).toMatch(/^Pak deze nu op/)
    expect(volgendeStap({ priority: 'middel', dueDate: '2026-10-10T08:00:00Z' }, NU)).toMatch(/over tijd/)
    expect(volgendeStap({ priority: 'middel', dueDate: null, poging: { n: 5, van: 5 } }, NU)).toMatch(/Laatste poging/)
    expect(volgendeStap({ priority: 'middel', dueDate: null, herkomst: 'inzicht' }, NU)).toMatch(/inzicht/)
    expect(volgendeStap({ priority: 'middel', dueDate: null }, NU)).toBe('Plan een concreet moment en leg de uitkomst vast zodra het gedaan is.')
  })
})

describe('Vandaag', () => {
  const i = (id: string, relevanceScore: number, uren: number, accountId = 'a1', status = 'nieuw') => ({ id, relevanceScore, status, accountId, ownerId: 'u1', createdAt: new Date(NU.getTime() - uren * 3600_000).toISOString() })
  it('aanleiding van de dag: 85 tegen 84, 48 uur, alleen eigen accounts', () => {
    expect(kiesAanleidingVanDeDag([i('a', 84, 1), i('b', 85, 2)], 'u1', new Set(['a1']), NU)?.id).toBe('b')
    expect(kiesAanleidingVanDeDag([i('a', 90, 49), i('b', 65, 1)], 'u1', new Set(['a1']), NU)?.id).toBe('a')
    expect(kiesAanleidingVanDeDag([i('a', 90, 1, 'a2')], 'u1', new Set(['a1']), NU)).toBeNull()
    expect(kiesAanleidingVanDeDag([i('a', 90, 1, 'a1', 'gelezen')], 'u1', new Set(['a1']), NU)).toBeNull()
  })
  it('aanleiding van de dag: terugval op 60 of hoger binnen zeven dagen, ook voor een Beginner', () => {
    // Een Beginner krijgt motorvoorstellen als inzicht met relevantie 65; die worden de aanleiding als er geen 85+ is.
    expect(kiesAanleidingVanDeDag([i('a', 65, 30), i('b', 45, 1)], 'u1', new Set(['a1']), NU)?.id).toBe('a')
    expect(kiesAanleidingVanDeDag([i('a', 59, 1)], 'u1', new Set(['a1']), NU)).toBeNull()
    expect(kiesAanleidingVanDeDag([i('a', 90, 7 * 24 + 1)], 'u1', new Set(['a1']), NU)).toBeNull()
    expect(kiesAanleidingVanDeDag([i('a', 65, 1, 'a2')], 'u1', new Set(['a1']), NU)).toBeNull()
    // Een 85+ van de laatste 48 uur gaat altijd voor.
    expect(kiesAanleidingVanDeDag([i('a', 80, 1), i('b', 85, 40)], 'u1', new Set(['a1']), NU)?.id).toBe('b')
  })
  it('samenvattingsregel en kicker', () => {
    expect(samenvattingsregel({ taken: 0, uitCampagnes: 0 })).toBe('Niets te doen. De motor zet nieuwe pogingen klaar zodra ze aan de beurt zijn.')
    expect(samenvattingsregel({ taken: 6, uitCampagnes: 3, volgendeKoud: '10:00' })).toBe('6 taken · 3 uit campagnes · volgende koude actie 10:00')
    expect(vandaagKicker(new Date('2026-10-13T08:00:00Z'))).toBe('VANDAAG · DINSDAG 13 OKTOBER · WEEK 42')
  })
})
