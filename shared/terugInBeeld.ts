// Terug in beeld (/terug-in-beeld): verloren prospects die volgens de terugkomregel weer benaderd mogen worden.
// Puur: status, groep, tellers, filters, de teksten per rij en wat er bij het starten mag. De terugkomdatum zelf
// komt altijd uit terugkomDatum (shared/verkoopverhaal.ts) en de afkoeling uit afkoelingTot (shared/nbStatus.ts);
// de server (server/utils/terugInBeeld.ts) vult de rijen. Alle datums zijn ISO-datums (JJJJ-MM-DD).
import { plusDagen, voegWerkdagenToe, type WerkdagInstelling } from './datum'
import { KANAAL_LABEL, type Kanaal } from './nbStatus'
import { terugDagKort, terugDagLang } from './terugkomBeheer'

export type TerugStatus = 'overtijd' | 'klaar' | 'afkoeling' | 'gepland' | 'gestart'
export type TerugGroep = 'week' | 'maand' | 'later'
export type TerugBron = 'nee' | 'deal_verloren' | 'offerte_verloren' | 'slapend'
export type StartSoort = 'reeks' | 'taak' | 'belblok'

export const TERUG_STATUSSEN: TerugStatus[] = ['overtijd', 'klaar', 'afkoeling', 'gepland', 'gestart']
export const TERUG_STATUS_LABEL: Record<TerugStatus, string> = {
  overtijd: 'Over tijd', klaar: 'Klaar om te starten', afkoeling: 'Nog in afkoeling', gepland: 'Gepland', gestart: 'Gestart',
}
export const TERUG_GROEPEN: TerugGroep[] = ['week', 'maand', 'later']
export const TERUG_GROEP_LABEL: Record<TerugGroep, string> = { week: 'Deze week', maand: 'Deze maand', later: 'Later' }
export const TERUG_BRON_LABEL: Record<TerugBron, string> = { nee: 'Nee gezet', deal_verloren: 'Deal verloren', offerte_verloren: 'Offerte verloren', slapend: 'Slapende klant' }
/** Kanalen in de filterrij: wat een regel kan kiezen. */
export const TERUG_KANALEN: Kanaal[] = ['bellen', 'mail', 'bezoek', 'linkedin', 'whatsapp']
/** Een gestarte prospect blijft zo lang zichtbaar (dagen na de start). */
export const GESTART_ZICHTBAAR_DAGEN = 30

export interface TerugRegel {
  id: string
  naam: string
  dagen: number
  /** Eigenaar van de prospect, Binnendienst of Buitendienst. */
  oppakker: string
  aanpak: string | null
  ritmeId: string | null
}

export interface TerugGestart {
  soort: StartSoort
  /** Moment van starten (ISO). */
  op: string
  door?: string | null
  /** Datum van de eerste taak of stap (JJJJ-MM-DD). */
  eersteOp: string | null
  taakId?: string | null
  ritmeNaam?: string | null
  blokLabel?: string | null
  /** Gestart buiten Terug in beeld: een taak uit DealDrive, een opvolgreeks of een poging na de terugkomdatum. */
  elders?: 'taak' | 'reeks' | 'poging' | null
}

export interface TerugRij {
  id: string
  naam: string
  plaats: string | null
  klasse: string | null
  eigenaar: { id: string | null; naam: string | null }
  bron: TerugBron
  reden: string
  toelichting: string | null
  verlorenOp: string | null
  terugOp: string
  opgeschoven: boolean
  hand: boolean
  /** Eerste dag waarop het kanaal weer mag; null zonder afkoeling. */
  afkoelEind: string | null
  kanaal: Kanaal
  regel: TerugRegel | null
  aanpak: string
  gestart: TerugGestart | null
  /** Al terug in de reis (de terugkomdatum is verwerkt). */
  teruggekomen: boolean
}

/** "ma 2 nov", met het jaar erbij als dat niet het jaar van vandaag is ("di 5 okt 2027"). */
export const dagKort = (d: string, vandaag: string) => `${terugDagKort(d)}${d.slice(0, 4) !== vandaag.slice(0, 4) ? ` ${d.slice(0, 4)}` : ''}`

const dagNr = (d: string) => Math.round(Date.parse(`${d.slice(0, 10)}T12:00:00Z`) / 864e5)
/** Dagen van a naar b (b - a). */
export const dagenTussen = (a: string, b: string) => dagNr(b) - dagNr(a)
/** Laatste dag van de maand van een datum. */
export function eindeMaand(d: string): string {
  const [j, m] = d.split('-').map(Number)
  return new Date(Date.UTC(j!, m!, 0)).toISOString().slice(0, 10)
}

/** Over tijd: datum voorbij en nog niet gestart. Klaar: binnen een week en de afkoeling is voorbij. */
export function statusVan(r: Pick<TerugRij, 'gestart' | 'terugOp' | 'afkoelEind'>, vandaag: string): TerugStatus {
  if (r.gestart) return 'gestart'
  if (r.terugOp < vandaag) return 'overtijd'
  if (dagenTussen(vandaag, r.terugOp) <= 6) return r.afkoelEind && vandaag < r.afkoelEind ? 'afkoeling' : 'klaar'
  return 'gepland'
}

/** Deze week (ook over tijd), deze maand (tot de laatste dag van de maand) of later. */
export function groepVan(terugOp: string, vandaag: string): TerugGroep {
  if (dagenTussen(vandaag, terugOp) <= 6) return 'week'
  return terugOp <= eindeMaand(vandaag) ? 'maand' : 'later'
}

/** Mag het hercontact nu starten? Alleen als het nog niet loopt en de afkoeling voorbij is. */
export function magStarten(r: Pick<TerugRij, 'gestart' | 'afkoelEind' | 'kanaal'>, vandaag: string): { mag: boolean; reden?: string; vanaf?: string } {
  if (r.gestart) return { mag: false, reden: 'Het hercontact loopt al.' }
  if (r.afkoelEind && vandaag < r.afkoelEind) return { mag: false, vanaf: r.afkoelEind, reden: `Mag vanaf ${terugDagKort(r.afkoelEind)}: de afkoeling voor ${KANAAL_LABEL[r.kanaal].toLowerCase()} loopt nog.` }
  return { mag: true }
}

/** Een belblok kan alleen als de regel bellen zegt. */
export function belblokMag(kanaal: Kanaal): { mag: boolean; reden?: string } {
  return kanaal === 'bellen' ? { mag: true } : { mag: false, reden: `Kan niet: de regel zegt ${KANAAL_LABEL[kanaal].toLowerCase()}, geen bellen.` }
}

/** Een nieuwe terugkomdatum valt nooit binnen de afkoeling en nooit op of voor vandaag. */
export function laterDatum(gekozen: string, r: Pick<TerugRij, 'afkoelEind'>, vandaag: string): { datum: string; geschoven: boolean } {
  const min = [plusDagen(vandaag, 1), r.afkoelEind ?? ''].sort().at(-1)!
  return gekozen < min ? { datum: min, geschoven: !!r.afkoelEind && gekozen < r.afkoelEind } : { datum: gekozen, geschoven: false }
}
/** Het voorstel in Later: twee weken na de huidige datum, nooit eerder dan twee weken na vandaag. */
export function laterVoorstel(r: Pick<TerugRij, 'terugOp' | 'afkoelEind'>, vandaag: string): string {
  const v = [plusDagen(r.terugOp, 14), plusDagen(vandaag, 14)].sort().at(-1)!
  return laterDatum(v, r, vandaag).datum
}

export interface TerugFilter { regel?: string; kanaal?: string; status?: string; zoek?: string }
/** Past de rij bij de filters? Regel 'geen' is zonder regel. */
export function pastFilter(r: TerugRij, f: TerugFilter, vandaag: string): boolean {
  if (f.regel && f.regel !== 'alle' && (f.regel === 'geen' ? !!r.regel : r.regel?.id !== f.regel)) return false
  if (f.kanaal && f.kanaal !== 'alle' && r.kanaal !== f.kanaal) return false
  if (f.status && f.status !== 'alle' && statusVan(r, vandaag) !== f.status) return false
  const z = f.zoek?.trim().toLowerCase()
  if (z && !`${r.naam} ${r.plaats ?? ''}`.toLowerCase().includes(z)) return false
  return true
}

export interface TerugTellers { week: number; maand: number; later: number; overtijd: number; gestart: number }
export function tellers(rijen: TerugRij[], vandaag: string): TerugTellers {
  const t: TerugTellers = { week: 0, maand: 0, later: 0, overtijd: 0, gestart: 0 }
  for (const r of rijen) {
    t[groepVan(r.terugOp, vandaag)]++
    const s = statusVan(r, vandaag)
    if (s === 'overtijd') t.overtijd++
    if (s === 'gestart') t.gestart++
  }
  return t
}

/** Op volgorde van terugkomdatum, dan naam. */
export const sorteer = (rijen: TerugRij[]) => [...rijen].sort((a, b) => a.terugOp.localeCompare(b.terugOp) || a.naam.localeCompare(b.naam))

/** "Prijs te hoog, na 182 dagen" of "Geen regel: afkoeling bellen". */
export const regelTekst = (r: Pick<TerugRij, 'regel'>) => (r.regel ? `${r.regel.naam}, na ${r.regel.dagen} dagen` : 'Geen regel: afkoeling bellen')

/** "Nee gezet op 4 september 2026 · reden: Verkeerd moment". */
export function herkomstTekst(r: Pick<TerugRij, 'bron' | 'verlorenOp' | 'reden'>): string {
  return [`${TERUG_BRON_LABEL[r.bron]}${r.verlorenOp ? ` op ${terugDagLang(r.verlorenOp)}` : ''}`, `reden: ${r.reden}`].join(' · ')
}

/** Uiterlijk deze dag telt de eerste poging nog als op tijd (5 werkdagen na de terugkomdatum, zoals de KPI). */
export const opTijdTot = (terugOp: string, inst: WerkdagInstelling = {}) => voegWerkdagenToe(terugOp, 5, inst)

/** De uitleg onder de knoppen. */
export function uitlegVan(r: TerugRij, vandaag: string): string {
  const K = (d: string) => dagKort(d, vandaag)
  const s = statusVan(r, vandaag)
  const g = r.gestart
  if (s === 'gestart' && g) {
    if (g.elders === 'reeks') return 'Er loopt een opvolgreeks op deze prospect.'
    if (g.elders === 'poging') return 'Na de terugkomdatum is hij al benaderd.'
    const op = g.eersteOp ? K(g.eersteOp) : null
    if (g.soort === 'reeks') return `Reeks ${g.ritmeNaam ?? ''} loopt${op ? `, stap 1 op ${op}` : ''}.`.replace('Reeks  ', 'Reeks ')
    if (g.soort === 'belblok') return `Ingepland in het belblok van ${g.blokLabel ?? op ?? 'de eerstvolgende dag'}.`
    return op ? `Taak staat op ${op} in Taken.` : 'Taak staat in Taken.'
  }
  if (s === 'afkoeling') return magStarten(r, vandaag).reden!
  if (s === 'gepland') return `Staat op ${K(r.terugOp)} vanzelf in Vandaag.`
  if (s === 'overtijd') return `Sinds ${K(r.terugOp)} terug in beeld. Start vandaag, dan telt hij nog als op tijd tot ${K(opTijdTot(r.terugOp))}.`
  return r.terugOp > vandaag ? `Terugkomdatum ${K(r.terugOp)}; de afkoeling is voorbij, dus je mag nu al.` : 'Vandaag terug in beeld.'
}

/** De toast na het starten. */
export function startToast(soort: StartSoort, naam: string, extra: { blokLabel?: string | null } = {}): string {
  if (soort === 'reeks') return `Reeks gestart voor ${naam}. Stap 1 staat in Taken.`
  if (soort === 'belblok') return `${naam} staat in het belblok van ${extra.blokLabel ?? 'de eerstvolgende dag'}.`
  return `Taak gezet voor ${naam}.`
}

/**
 * Wat bewaard blijft als een prospect terug in de reis gaat (heropvolging): de nee en de terugkomgegevens
 * worden dan leeg, maar Terug in beeld laat hem nog zien tot het hercontact gestart is. Zonder nee (pauze
 * na een eerdere terugkomst) blijft de vorige stand, met de nieuwe datum.
 */
export function bijHeropvolging(a: { terugOp: string | null; terugRegelId: string | null; data?: any }, nu: Date): Record<string, unknown> | null {
  const d = a.data ?? {}
  const nee = d.nee
  const tk = d.terugkom ?? {}
  if (nee?.reden) {
    if (nee.reden === 'Niet geschikt') return null
    const kanaal = (tk.kanaal ?? 'bellen') as Kanaal
    const dagen = nee.afkoeling?.[kanaal]
    const afkoelEind = nee.op && Number.isFinite(Number(dagen)) ? plusDagen(String(nee.op).slice(0, 10), Number(dagen)) : null
    return {
      terugOp: a.terugOp ?? tk.datum ?? nu.toISOString().slice(0, 10), regelId: a.terugRegelId ?? tk.regelId ?? null, reden: nee.reden, toelichting: nee.toelichting ?? null,
      bron: tk.bron ?? 'nee', verlorenOp: nee.op ? String(nee.op).slice(0, 10) : null, kanaal, aanpak: tk.aanpak ?? null, afkoelEind,
      hand: Array.isArray(d.terugHistorie) && d.terugHistorie.length > 0, teruggekomenOp: nu.toISOString(), gestart: null,
    }
  }
  const vorig = d.terugInBeeld
  if (vorig && !vorig.gestart) return { ...vorig, terugOp: a.terugOp ?? vorig.terugOp, teruggekomenOp: nu.toISOString() }
  return vorig ?? null
}
