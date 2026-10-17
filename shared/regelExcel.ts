// Excel-kolommen voor regels (F15): één definitie voor export en import. Export
// gevolgd door import geeft dezelfde regels terug; geen veld valt weg (gat 7).
import { ACTIESOORTEN, CADANSEN, CATEGORIEEN, PATROON_SLEUTELS, PRIORITEITEN, UITVOERDERROLLEN, valideerRegel, type Regel } from './regelPatronen'

export interface Kolom { kop: string; uit: (r: Regel) => string | number | boolean; in: (r: any, w: string) => void; keuzes?: readonly string[]; toelichting: string }

const lijst = (v: string) => (v ? v.split(',').map((x) => x.trim()).filter(Boolean) : [])
const zetData = (r: any, pad: string[], w: unknown) => { let o = (r.data ??= {}); for (const p of pad.slice(0, -1)) o = (o[p] ??= {}); o[pad.at(-1)!] = w }

export const REGEL_KOLOMMEN: Kolom[] = [
  { kop: 'id', uit: (r) => r.id, in: (r, w) => { r.id = w || undefined }, toelichting: 'Leeg bij een nieuwe regel; bij "Samenvoegen op id" de regel die je bijwerkt.' },
  { kop: 'code', uit: (r) => r.code ?? '', in: (r, w) => { r.code = w || null }, toelichting: 'SR01 tot en met SR23 voor de starterset.' },
  { kop: 'naam', uit: (r) => r.naam, in: (r, w) => { r.naam = w }, toelichting: 'Verplicht.' },
  { kop: 'categorie', uit: (r) => r.categorie, in: (r, w) => { r.categorie = w }, keuzes: CATEGORIEEN, toelichting: 'Groep in de lijst.' },
  { kop: 'subcategorie', uit: (r) => r.data.subcategorie ?? '', in: (r, w) => zetData(r, ['subcategorie'], w || undefined), toelichting: 'Optioneel.' },
  { kop: 'actief', uit: (r) => (r.actief ? 'ja' : 'nee'), in: (r, w) => { r.actief = w !== 'nee' }, keuzes: ['ja', 'nee'], toelichting: 'Staat de regel aan?' },
  { kop: 'motor', uit: (r) => r.motor, in: (r, w) => { r.motor = w }, keuzes: ['regel', 'ai'], toelichting: 'Regel of AI.' },
  { kop: 'scope', uit: (r) => r.scope, in: (r, w) => { r.scope = w }, keuzes: ['organisatie', 'team', 'persoonlijk'], toelichting: 'Voor wie de regel geldt.' },
  { kop: 'team', uit: (r) => r.teamId ?? '', in: (r, w) => { r.teamId = w || null }, toelichting: 'Team-id bij een teamregel.' },
  { kop: 'eigenaar', uit: (r) => r.eigenaarId ?? '', in: (r, w) => { r.eigenaarId = w || null }, toelichting: 'Gebruiker-id bij een persoonlijke regel.' },
  { kop: 'reis', uit: (r) => r.reisId ?? '', in: (r, w) => { r.reisId = w || null }, toelichting: 'Leeg is alle reizen.' },
  { kop: 'fase', uit: (r) => r.faseId ?? '', in: (r, w) => { r.faseId = w || null }, toelichting: 'Leeg is alle fases.' },
  { kop: 'cadans (dagen)', uit: (r) => r.cadansDagen, in: (r, w) => { r.cadansDagen = Number(w) }, keuzes: CADANSEN.map((c) => String(c.dagen)), toelichting: CADANSEN.map((c) => `${c.dagen} = ${c.label}`).join(', ') },
  { kop: 'prioriteit', uit: (r) => r.prioriteit, in: (r, w) => { r.prioriteit = w }, keuzes: PRIORITEITEN, toelichting: 'hoog, middel of laag.' },
  { kop: 'omschrijving', uit: (r) => r.data.omschrijving, in: (r, w) => zetData(r, ['omschrijving'], w), toelichting: 'Komt in "Waarom krijg ik dit?".' },
  { kop: 'activiteit', uit: (r) => r.data.activiteit, in: (r, w) => zetData(r, ['activiteit'], w), keuzes: ['inzicht', 'taak'], toelichting: 'Inzicht (ter goedkeuring) of Taak.' },
  { kop: 'bron', uit: (r) => r.data.bron, in: (r, w) => zetData(r, ['bron'], w), keuzes: ['intern', 'extern'], toelichting: 'Intern of extern.' },
  { kop: 'specifieke bron', uit: (r) => r.data.specifiekeBron ?? '', in: (r, w) => zetData(r, ['specifiekeBron'], w || undefined), toelichting: 'Bijvoorbeeld "Web: vacatures".' },
  { kop: 'triggerpatroon', uit: (r) => r.data.trigger.patroon, in: (r, w) => zetData(r, ['trigger', 'patroon'], w), keuzes: PATROON_SLEUTELS, toelichting: 'Zie de lijst met patronen.' },
  { kop: 'parameters', uit: (r) => JSON.stringify(r.data.trigger.parameters), in: (r, w) => zetData(r, ['trigger', 'parameters'], w ? JSON.parse(w) : {}), toelichting: 'JSON, bijvoorbeeld {"dagen": 30}.' },
  { kop: 'accounttypes', uit: (r) => (r.data.afbakening.accounttypes ?? []).join(', '), in: (r, w) => zetData(r, ['afbakening', 'accounttypes'], lijst(w)), toelichting: 'prospect; klanten neemt de motor nooit mee.' },
  { kop: 'statussen', uit: (r) => (r.data.afbakening.statussen ?? []).join(', '), in: (r, w) => zetData(r, ['afbakening', 'statussen'], lijst(w)), toelichting: 'nieuw, in reis, wachtend, nee, gescoord.' },
  { kop: 'reizen', uit: (r) => (r.data.afbakening.reisIds ?? []).join(', '), in: (r, w) => zetData(r, ['afbakening', 'reisIds'], lijst(w)), toelichting: 'Reis-id\'s.' },
  { kop: 'fases', uit: (r) => (r.data.afbakening.faseIds ?? []).join(', '), in: (r, w) => zetData(r, ['afbakening', 'faseIds'], lijst(w)), toelichting: 'Fase-id\'s, bijvoorbeeld gekwalificeerd.' },
  { kop: 'doelgroepen', uit: (r) => (r.data.afbakening.doelgroepIds ?? []).join(', '), in: (r, w) => zetData(r, ['afbakening', 'doelgroepIds'], lijst(w)), toelichting: 'Doelgroep-id\'s.' },
  { kop: 'campagnes', uit: (r) => (r.data.afbakening.campagneIds ?? []).join(', '), in: (r, w) => zetData(r, ['afbakening', 'campagneIds'], lijst(w)), toelichting: 'Campagne-id\'s.' },
  { kop: 'klassen', uit: (r) => (r.data.afbakening.klassen ?? []).join(', '), in: (r, w) => zetData(r, ['afbakening', 'klassen'], lijst(w)), toelichting: 'Klassecodes, bijvoorbeeld A, B.' },
  { kop: 'actiesoort', uit: (r) => r.data.gevolg.actiesoort, in: (r, w) => zetData(r, ['gevolg', 'actiesoort'], w), keuzes: ACTIESOORTEN, toelichting: 'Bellen, mailen, LinkedIn, bezoek, bericht (WhatsApp), sms of geen.' },
  { kop: 'uitvoerderrol', uit: (r) => r.data.gevolg.uitvoerderrol, in: (r, w) => zetData(r, ['gevolg', 'uitvoerderrol'], w), keuzes: UITVOERDERROLLEN, toelichting: 'Wie de taak krijgt.' },
  { kop: 'termijn (werkdagen)', uit: (r) => r.data.gevolg.termijnWerkdagen, in: (r, w) => zetData(r, ['gevolg', 'termijnWerkdagen'], Number(w)), toelichting: '0 is binnen 24 uur.' },
  { kop: 'taaksjabloon', uit: (r) => r.data.gevolg.taaksjabloon, in: (r, w) => zetData(r, ['gevolg', 'taaksjabloon'], w), toelichting: 'Met {account}, {contact}, {afspraak}.' },
  { kop: 'belscript', uit: (r) => r.data.gevolg.belscriptId ?? '', in: (r, w) => zetData(r, ['gevolg', 'belscriptId'], w || null), toelichting: 'Belscript-id bij bellen.' },
  { kop: 'automatisch voorbereiden', uit: (r) => (r.data.gevolg.automatischVoorbereiden ? 'ja' : 'nee'), in: (r, w) => zetData(r, ['gevolg', 'automatischVoorbereiden'], w === 'ja'), keuzes: ['ja', 'nee'], toelichting: 'Concept vooraf klaarzetten.' },
  { kop: 'signaaltype', uit: (r) => r.data.gevolg.signaaltype ?? '', in: (r, w) => zetData(r, ['gevolg', 'signaaltype'], w || null), toelichting: 'Soort inzicht.' },
  { kop: 'verwacht resultaat', uit: (r) => r.data.gevolg.verwachtResultaat ?? '', in: (r, w) => zetData(r, ['gevolg', 'verwachtResultaat'], w || null), toelichting: 'Wat de taak moet opleveren.' },
  { kop: 'herkomst', uit: (r) => r.data.herkomst ?? 'eigen', in: (r, w) => zetData(r, ['herkomst'], w || 'import'), keuzes: ['starterset', 'eigen', 'import'], toelichting: 'Waar de regel vandaan komt.' },
]

export const MAX_RIJEN = 2000
export const MAX_BYTES = 5 * 1024 * 1024

/** Een rij uit Excel naar een regel, met fouten en waarschuwingen per rij. */
export function regelUitRij(koppen: string[], cellen: string[]): { regel: any; fouten: string[]; waarschuwingen: string[] } {
  const regel: any = { data: { afbakening: {}, gevolg: {}, trigger: {} } }
  const fouten: string[] = []
  const waarschuwingen: string[] = []
  for (const k of REGEL_KOLOMMEN) {
    const i = koppen.indexOf(k.kop)
    if (i < 0) { waarschuwingen.push(`Kolom "${k.kop}" ontbreekt`); continue }
    const w = String(cellen[i] ?? '').trim()
    if (k.keuzes && w && !k.keuzes.includes(w)) { fouten.push(`"${w}" is geen geldige waarde voor ${k.kop}`); continue }
    try { k.in(regel, w) } catch { fouten.push(`${k.kop} is ongeldig`) }
  }
  if (!fouten.length) fouten.push(...valideerRegel(regel))
  return { regel, fouten, waarschuwingen }
}
