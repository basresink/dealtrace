// Invloedskaart (F8): wie beslist, wie beïnvloedt, hoe staan ze tegenover je en met wie sprak je nog nooit.
// Pure rekenregels die server en scherm delen: de dekking (vaste regel: beslisser en minstens één beïnvloeder
// gesproken), het grootste risico (één draad: alles via één contact), één voorgestelde stap, de vermoedelijke
// rollen uit de Profielbouwer als "Naam onbekend", de citaten uit verslagen en de indeling van het organigram.
// Houding en rapporteert-aan staan per contact in contacts.data.invloed; de Notulist stelt een houding alleen
// voor (data.invloed.voorstel), de mens bevestigt.
import type { JsonSchema } from './aiStap'
import { CONTACTROL_LABEL, type ContactRol } from './contactgegevens'

export const HOUDINGEN = ['voor', 'neutraal', 'tegen', 'onbekend'] as const
export type Houding = typeof HOUDINGEN[number]
export const HOUDING_LABEL: Record<Houding, string> = { voor: 'Voor', neutraal: 'Neutraal', tegen: 'Tegen', onbekend: 'Onbekend' }
export const isHouding = (h: unknown): h is Houding => (HOUDINGEN as readonly string[]).includes(h as string)

/** De rollen op de kaart, in volgorde van gewicht. Onbekend staat erbij als "Rol onbekend". */
export const KAART_ROLLEN = ['beslisser', 'beinvloeder', 'champion', 'poortwachter', 'gebruiker', 'blokkeerder'] as const
export const rolLabel = (r: string) => (r === 'onbekend' ? 'Rol onbekend' : CONTACTROL_LABEL[r as ContactRol] ?? r)

/** Een belpoging telt als gesprek bij deze uitkomsten; een bezoek of gehouden afspraak altijd. */
export const GESPREK_UITKOMSTEN = ['gesproken', 'afspraak', 'later', 'geen_interesse', 'niet_geschikt', 'doorverbonden'] as const
/** Soorten in de activiteitenlog die als contactmoment tellen. */
export const MOMENT_SOORTEN = ['gebeld', 'mail', 'bericht', 'bezoek', 'afspraak', 'linkedin', 'whatsapp', 'kaart'] as const

export function isGesprek(soort: string, uitkomst: string | null | undefined): boolean {
  if (soort === 'bezoek' || soort === 'afspraak') return true
  return soort === 'gebeld' && (GESPREK_UITKOMSTEN as readonly string[]).includes(uitkomst ?? '')
}

/** Wat per contact in data.invloed staat. */
export interface InvloedData {
  houding?: Houding
  houdingDoor?: string
  houdingOp?: string
  houdingCitaat?: string | null
  rapporteertAan?: string | null
  rolBevestigdDoor?: string
  rolBevestigdOp?: string
  voorstel?: { houding: Houding; citaat: string; bron: string; op: string } | null
}

export interface InvloedPersoon {
  id: string
  naam: string
  functie: string | null
  rol: string
  houding: Houding
  /** Aantal contactmomenten (belpogingen, mails, bezoeken, afspraken). */
  momenten: number
  /** Minstens één echt gesprek (bereikt aan de telefoon, bezoek of gehouden afspraak). */
  gesproken: boolean
  rapporteertAan: string | null
  zekerheid: number | null
  bron: string | null
  rolBevestigd: boolean
  /** Rol met zekerheid onder 60 en niet door de mens bevestigd. */
  vermoedelijk: boolean
  /** Een rol uit de Profielbouwer zonder contact: "Naam onbekend". */
  onbekend: boolean
}

/** Profielbouwer-voorstel zoals bewaard in accounts.data.committee. */
export interface CommitteeVoorstel { functie: string; rol: string; bron?: string; zekerheid: number }

const hoofdletter = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

/**
 * De rollen die de Profielbouwer voorstelde en waar nog geen contact bij is (op functie). Elk wordt een
 * plek "Naam onbekend"; onder 60 procent zekerheid is hij vermoedelijk. De Profielbouwer verzint geen namen.
 */
export function vermoedelijkeRollen(voorstellen: CommitteeVoorstel[] | null | undefined, contacten: Pick<InvloedPersoon, 'functie'>[]): InvloedPersoon[] {
  const bekend = contacten.map((c) => (c.functie ?? '').toLowerCase()).filter(Boolean)
  const gezien = new Set<string>()
  const uit: InvloedPersoon[] = []
  for (const v of voorstellen ?? []) {
    const f = String(v.functie ?? '').trim()
    const k = f.toLowerCase()
    if (!f || gezien.has(k) || bekend.some((b) => b.includes(k) || k.includes(b))) continue
    gezien.add(k)
    uit.push({
      id: `vermoedelijk-${uit.length + 1}`, naam: 'Naam onbekend', functie: hoofdletter(f), rol: v.rol, houding: 'onbekend', momenten: 0, gesproken: false,
      rapporteertAan: null, zekerheid: typeof v.zekerheid === 'number' ? Math.round(v.zekerheid) : null, bron: 'Profielbouwer', rolBevestigd: false,
      vermoedelijk: (v.zekerheid ?? 0) < 60, onbekend: true,
    })
  }
  return uit
}

export interface Dekking {
  gesprokenRollen: number
  totaalRollen: number
  procent: number
  beslisserGesproken: boolean
  beinvloederGesproken: boolean
  /** De vaste regel voor een overdracht: beslisser en minstens één beïnvloeder gesproken. */
  gehaald: boolean
  titel: string
  waarschuwing: string | null
}

/**
 * Dekking: hoeveel rollen in het buying committee je sprak. Beslisser en beïnvloeder tellen altijd mee,
 * ook als nog niemand die rol heeft; een rol telt als gesproken als minstens één echt contact met die rol
 * een gesprek had.
 */
export function dekking(personen: InvloedPersoon[]): Dekking {
  const rollen = new Set<string>(['beslisser', 'beinvloeder'])
  for (const p of personen) if ((KAART_ROLLEN as readonly string[]).includes(p.rol)) rollen.add(p.rol)
  const gesproken = new Set(personen.filter((p) => !p.onbekend && p.gesproken).map((p) => p.rol).filter((r) => rollen.has(r)))
  const beslisser = gesproken.has('beslisser')
  const beinvloeder = gesproken.has('beinvloeder')
  const g = gesproken.size
  const t = rollen.size
  const mist = [!beslisser && 'de beslisser', !beinvloeder && 'een beïnvloeder'].filter(Boolean) as string[]
  return {
    gesprokenRollen: g, totaalRollen: t, procent: t ? Math.round((100 * g) / t) : 0, beslisserGesproken: beslisser, beinvloederGesproken: beinvloeder,
    gehaald: beslisser && beinvloeder,
    titel: `${g} van ${t} rollen gesproken.`,
    waarschuwing: mist.length ? `Je sprak ${mist.join(' en ')} nog niet. Een overdracht zonder beslisser en beïnvloeder strandt vaak op "geen mandaat".` : null,
  }
}

export interface Risico { soort: 'een-draad' | 'tegenstander' | 'beslisser-onbereikt' | 'geen-contact'; label: string; tekst: string; persoonId: string | null }

const metFunctie = (p: InvloedPersoon) => (p.functie ? `${p.naam} (${p.functie.toLowerCase()})` : p.naam)
const beslisserVan = (personen: InvloedPersoon[]) => personen.find((p) => p.rol === 'beslisser' && !p.onbekend) ?? personen.find((p) => p.rol === 'beslisser') ?? null
const noemBeslisser = (b: InvloedPersoon | null) => (b?.functie ? `de ${b.functie.toLowerCase()}` : 'de beslisser')

/**
 * Het grootste risico, één tegelijk. Eerst één draad (alle contactmomenten via één persoon), dan een
 * beslisser of beïnvloeder die tegen is, dan een beslisser met wie je nooit sprak. Geen contact is ook een risico.
 */
export function grootsteRisico(personen: InvloedPersoon[]): Risico | null {
  const echt = personen.filter((p) => !p.onbekend)
  const metMoment = echt.filter((p) => p.momenten > 0)
  const b = beslisserVan(personen)
  if (!metMoment.length) return echt.length || personen.length ? { soort: 'geen-contact', label: 'Nog geen contact', tekst: 'Je had nog met niemand bij dit account contact. Begin bij de persoon met de meeste invloed die je kunt bereiken.', persoonId: null } : null
  if (metMoment.length === 1) {
    const via = metMoment[0]!
    const anderen = personen.length - 1
    let tekst = `Alles loopt via ${metFunctie(via)}.`
    if (b && b.id !== via.id && !b.gesproken) tekst += ` ${hoofdletter(noemBeslisser(b))} tekent, maar jullie spraken ${b.onbekend ? 'die' : b.naam.split(' ')[0]} nooit.`
    else if (!anderen) tekst += ' Je kent nog niemand anders bij dit account. Vertrekt deze persoon, dan valt alles stil.'
    else tekst += ' Vertrekt deze persoon of heeft die geen mandaat, dan valt alles stil.'
    return { soort: 'een-draad', label: 'Eén draad', tekst, persoonId: via.id }
  }
  const tegen = echt.find((p) => (p.rol === 'beslisser' || p.rol === 'beinvloeder') && p.houding === 'tegen')
  if (tegen) return { soort: 'tegenstander', label: 'Tegenstander', tekst: `${metFunctie(tegen)} is ${rolLabel(tegen.rol).toLowerCase()} en staat tegen. Zonder zijn of haar steun komt er geen ja.`, persoonId: tegen.id }
  if (b && !b.gesproken) return { soort: 'beslisser-onbereikt', label: 'Beslisser niet gesproken', tekst: `${hoofdletter(noemBeslisser(b))} tekent, maar jullie spraken ${b.onbekend ? 'die' : b.naam.split(' ')[0]} nooit.`, persoonId: b.id }
  if (!b) return { soort: 'beslisser-onbereikt', label: 'Beslisser onbekend', tekst: 'Je weet nog niet wie er tekent. Zonder beslisser blijft het bij een goed gesprek.', persoonId: null }
  return null
}

export interface Stap { tekst: string; taakTitel: string; contactId: string | null }

/** Eén voorgestelde stap om de grootste leegte te vullen: via wie, en met welk winpunt als dat bekend is. */
export function voorgesteldeStap(personen: InvloedPersoon[], risico: Risico | null, winpunt?: string | null): Stap {
  const echt = personen.filter((p) => !p.onbekend)
  const b = beslisserVan(personen)
  const via = (risico?.persoonId && echt.find((p) => p.id === risico.persoonId)) || echt.filter((p) => p.gesproken).sort((x, y) => y.momenten - x.momenten)[0] || null
  const voornaam = (p: InvloedPersoon) => p.naam.split(' ')[0]!
  const metWinpunt = (t: string) => (winpunt ? `${t} Gebruik winpunt "${winpunt}".` : t)
  let s: Stap
  if (risico?.soort === 'een-draad' && via) {
    if (b && b.id !== via.id && !b.gesproken) s = { tekst: `Vraag ${voornaam(via)} om ${noemBeslisser(b)} bij de volgende afspraak te betrekken.`, taakTitel: `Vraag ${voornaam(via)} om ${noemBeslisser(b)} te betrekken`, contactId: via.id }
    else s = { tekst: `Vraag ${voornaam(via)} wie er nog meebeslist en meekijkt.`, taakTitel: `Vraag ${voornaam(via)} wie er nog meebeslist`, contactId: via.id }
  } else if (risico?.soort === 'tegenstander') {
    const t = echt.find((p) => p.id === risico.persoonId)!
    s = { tekst: `Plan een gesprek met ${voornaam(t)} en vraag door op het bezwaar. Neem iemand mee die het al eens oploste.`, taakTitel: `Bespreek het bezwaar met ${voornaam(t)}`, contactId: t.id }
  } else if (risico?.soort === 'beslisser-onbereikt' && b && !b.onbekend) {
    s = { tekst: `Plan een gesprek met ${b.naam}${via && via.id !== b.id ? `; vraag ${voornaam(via)} om een introductie` : ''}.`, taakTitel: `Plan een gesprek met ${voornaam(b)}`, contactId: via && via.id !== b.id ? via.id : b.id }
  } else if (risico?.soort === 'beslisser-onbereikt' || risico?.soort === 'geen-contact') {
    const vraag = via ?? echt[0] ?? null
    s = vraag
      ? { tekst: `Vraag ${voornaam(vraag)} naar de naam van ${noemBeslisser(b)}${b?.onbekend ? ' en laat de Verrijker zoeken' : ''}.`, taakTitel: `Vraag ${voornaam(vraag)} naar ${noemBeslisser(b)}`, contactId: vraag.id }
      : { tekst: 'Zoek wie er bij dit account beslist: kijk op de website of vraag het aan de receptie.', taakTitel: 'Zoek de beslisser', contactId: null }
  } else if (!echt.some((p) => p.rol === 'beinvloeder' && p.gesproken) && via) {
    s = { tekst: `Vraag ${voornaam(via)} wie ${b && !b.onbekend ? voornaam(b) : 'de beslisser'} adviseert, en spreek die persoon voor de overdracht.`, taakTitel: `Vraag ${voornaam(via)} naar de beïnvloeder`, contactId: via.id }
  } else {
    const champion = echt.find((p) => p.rol === 'champion') ?? via
    s = champion
      ? { tekst: `Houd ${voornaam(champion)} betrokken en bevestig na je volgende gesprek de rollen en de houding.`, taakTitel: `Houd ${voornaam(champion)} betrokken`, contactId: champion.id }
      : { tekst: 'Bevestig na je volgende gesprek de rollen en de houding.', taakTitel: 'Werk de invloedskaart bij', contactId: null }
  }
  return { ...s, tekst: metWinpunt(s.tekst) }
}

/** Mag a aan b rapporteren zonder kring? (b is niet a en rapporteert zelf niet, via anderen, aan a.) */
export function geenKring(personen: Pick<InvloedPersoon, 'id' | 'rapporteertAan'>[], id: string, aan: string | null): boolean {
  if (!aan) return true
  if (aan === id) return false
  const per = new Map(personen.map((p) => [p.id, p.rapporteertAan]))
  let x: string | null | undefined = aan
  for (let i = 0; x && i < 100; i++) {
    if (x === id) return false
    x = per.get(x)
  }
  return true
}

export interface Knoop<T extends InvloedPersoon = InvloedPersoon> { persoon: T; x: number; y: number; laag: number }
export interface Indeling<T extends InvloedPersoon = InvloedPersoon> { knopen: Knoop<T>[]; lijnen: { van: string; naar: string; d: string }[]; breedte: number; hoogte: number }
export const KNOOP_B = 156
export const KNOOP_H = 66
const GAT_X = 16
const LAAG_H = 100

/**
 * Het organigram: lagen volgens rapporteert-aan. Zonder relaties staat de beslisser boven en de rest
 * eronder, zonder lijn (we tekenen alleen wat bekend is). Een kring wordt niet gevolgd.
 */
export function indeling<T extends InvloedPersoon>(personen: T[], minBreedte = 520): Indeling<T> {
  const ids = new Set(personen.map((p) => p.id))
  const baas = (p: InvloedPersoon) => (p.rapporteertAan && ids.has(p.rapporteertAan) && p.rapporteertAan !== p.id ? p.rapporteertAan : null)
  const diepte = new Map<string, number>()
  const per = new Map(personen.map((p) => [p.id, p]))
  const diepteVan = (p: InvloedPersoon, pad = new Set<string>()): number => {
    if (diepte.has(p.id)) return diepte.get(p.id)!
    const b = baas(p)
    const d = b && !pad.has(b) ? diepteVan(per.get(b)!, new Set([...pad, p.id])) + 1 : 0
    diepte.set(p.id, d)
    return d
  }
  personen.forEach((p) => diepteVan(p))
  const heeftRelaties = personen.some((p) => baas(p))
  const metOndergeschikten = new Set(personen.map(baas).filter(Boolean) as string[])
  const boven = personen.some((p) => p.rol === 'beslisser' && !baas(p))
  const laagVan = (p: InvloedPersoon) => {
    const d = diepte.get(p.id) ?? 0
    // Losse personen (geen baas, geen ondergeschikten) onder de top als er een beslisser bovenaan staat.
    if (d === 0 && boven && p.rol !== 'beslisser' && !metOndergeschikten.has(p.id)) return heeftRelaties ? Math.max(1, d) : 1
    return d
  }
  const gewicht = (p: InvloedPersoon) => { const i = (KAART_ROLLEN as readonly string[]).indexOf(p.rol); return i < 0 ? 99 : i }
  const lagen = new Map<number, T[]>()
  for (const p of personen) { const l = laagVan(p); lagen.set(l, [...(lagen.get(l) ?? []), p]) }
  const max = Math.max(1, ...[...lagen.values()].map((l) => l.length))
  const breedte = Math.max(minBreedte, max * (KNOOP_B + GAT_X) + GAT_X)
  const knopen: Knoop<T>[] = []
  for (const [laag, lijst] of [...lagen.entries()].sort((a, b) => a[0] - b[0])) {
    // Binnen een laag: onder dezelfde baas bij elkaar, dan op gewicht van de rol, onbekende namen achteraan.
    const rij = [...lijst].sort((a, b) => String(baas(a) ?? '').localeCompare(String(baas(b) ?? '')) || Number(a.onbekend) - Number(b.onbekend) || gewicht(a) - gewicht(b) || a.naam.localeCompare(b.naam))
    const stap = breedte / rij.length
    rij.forEach((p, i) => knopen.push({ persoon: p, laag, x: Math.round(stap * i + stap / 2), y: 20 + laag * LAAG_H + KNOOP_H / 2 }))
  }
  const plek = new Map(knopen.map((k) => [k.persoon.id, k]))
  const lijnen = knopen.filter((k) => baas(k.persoon)).map((k) => {
    const o = plek.get(baas(k.persoon)!)!
    const midY = Math.round((o.y + KNOOP_H / 2 + k.y - KNOOP_H / 2) / 2)
    return { van: o.persoon.id, naar: k.persoon.id, d: `M${o.x} ${o.y + KNOOP_H / 2} V${midY} H${k.x} V${k.y - KNOOP_H / 2}` }
  })
  const lagenAantal = Math.max(1, ...knopen.map((k) => k.laag + 1))
  return { knopen, lijnen, breedte, hoogte: 40 + (lagenAantal - 1) * LAAG_H + KNOOP_H }
}

export interface Verslag { tekst: string; bron: string; datum: string | null; contactId: string | null }
export interface Citaat { tekst: string; bron: string; datum: string | null }

const zinnen = (t: string) => t.replace(/\s+/g, ' ').split(/(?<=[.!?]["”']?)\s+(?=["'“[A-Z0-9])/).map((z) => z.trim()).filter((z) => z.length > 8)
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Citaten als bewijs: zinnen uit gespreksverslagen die de persoon noemen (voor- of achternaam), of uit
 * verslagen van een gesprek met die persoon (behalve zinnen over een ander). Zinnen met aanhalingstekens eerst;
 * hooguit drie.
 */
export function citatenVoor(p: { id: string; naam: string }, verslagen: Verslag[], max = 3, anderen: string[] = []): Citaat[] {
  const naamRe = (naam: string) => { const d = naam.split(/\s+/).filter((x) => x.length >= 3 && !/^(de|van|der|den|het|ten|ter|naam|onbekend)$/i.test(x)); return d.length ? new RegExp(`\\b(${d.map(escape).join('|')})\\b`, 'i') : null }
  const re = naamRe(p.naam)
  // Een zin over iemand anders (die de persoon zelf niet noemt) is geen bewijs voor deze persoon.
  const ander = anderen.map(naamRe).filter((x): x is RegExp => !!x)
  const uit: (Citaat & { score: number })[] = []
  const gezien = new Set<string>()
  for (const v of verslagen) {
    for (const z of zinnen(v.tekst)) {
      const noemt = !!re?.test(z)
      if (!noemt && (v.contactId !== p.id || ander.some((r) => r.test(z)))) continue
      if (gezien.has(z)) continue
      gezien.add(z)
      uit.push({ tekst: z.length > 280 ? `${z.slice(0, 277)}...` : z, bron: v.bron, datum: v.datum, score: (/["“”']/.test(z) ? 2 : 0) + (noemt ? 1 : 0) })
    }
  }
  return uit.sort((a, b) => b.score - a.score || String(b.datum ?? '').localeCompare(String(a.datum ?? ''))).slice(0, max).map(({ score: _s, ...c }) => c)
}

/** Het antwoord van de Notulist op de vraag "hoe staat iedereen tegenover ons?". */
export const HOUDING_SCHEMA: JsonSchema = {
  type: 'object', required: ['voorstellen'], additionalProperties: false,
  properties: {
    voorstellen: { type: 'array', items: { type: 'object', required: ['persoon', 'houding', 'citaat'], additionalProperties: false, properties: {
      persoon: { type: 'string' }, houding: { type: 'string', enum: ['voor', 'neutraal', 'tegen'] }, citaat: { type: 'string', maxLength: 400 },
    } } },
  },
}

const VOOR = /enthousiast|graag|goed idee|interessant|positief|voorstander|zie[tn]? het zitten|kosten ons|willen we oplossen|staat open/i
const TEGEN = /\btegen\b|geen behoefte|niet nodig|te duur|sceptisch|geen interesse|blokkeert|wil niet/i
const NEUTRAAL = /gedoe|twijfel|eerst zien|afwachten|misschien|neutraal|weet (het )?nog niet/i

/** Mock van de Notulist voor houding: per persoon de eerste zin met een herkenbare houding, letterlijk als citaat. */
export function mockHouding(m: any): { voorstellen: { persoon: string; houding: 'voor' | 'neutraal' | 'tegen'; citaat: string }[] } {
  const personen = (m?.personen ?? []) as { persoon: string }[]
  const verslagen = (m?.verslagen ?? []) as { persoon?: string | null; tekst: string }[]
  const uit: { persoon: string; houding: 'voor' | 'neutraal' | 'tegen'; citaat: string }[] = []
  for (const { persoon } of personen) {
    const kandidaten = verslagen.flatMap((v) => zinnen(v.tekst).filter((z) => v.persoon === persoon || z.includes(`[${persoon}]`)))
    for (const z of kandidaten) {
      const h = TEGEN.test(z) ? 'tegen' : VOOR.test(z) ? 'voor' : NEUTRAAL.test(z) ? 'neutraal' : null
      if (h) { uit.push({ persoon, houding: h, citaat: z }); break }
    }
  }
  return { voorstellen: uit }
}
