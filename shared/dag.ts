// De dag (P32, 8.13, uit de Dex-kern van DealDrive): stapels, telstrip en achterstand voor één
// gebruiker op één dag. Puur en zonder framework; telefoon, laptop en server rekenen hiermee
// (ADR-020). Dealtrace kent geen deals (B17): afspraken zijn bezoektaken, de eerste afspraak
// volgt uit de fase van de reis.
import { nlMoment, plusDagen } from './datum'
import { CONTACT_ACTIES } from './taken'

export interface DagInstelling { werkdagStart: number; werkdagEind: number; reisStilDagen: number; vervolghorizonDagen: number; afspraakDuurMinuten: number }
export const DAG_STANDAARD: DagInstelling = { werkdagStart: 8, werkdagEind: 18, reisStilDagen: 7, vervolghorizonDagen: 90, afspraakDuurMinuten: 60 }

export interface TaakBron { id: string; title: string; actionType: string; status: string; ownerId: string | null; accountId: string | null; contactId?: string | null; dueDate: string | null; priority?: string | null; data?: Record<string, any> | null }
export interface AccountBron { id: string; naam: string; ownerId: string | null; faseId?: string | null; nbStatus?: string | null; terugOp?: string | null; laatsteContactOp?: string | null; adres?: string | null; plaats?: string | null; telefoon?: string | null }
export interface ContactBron { id: string; accountId: string; naam: string; rol?: string | null; telefoon?: string | null; mobiel?: string | null; status?: string | null }
export interface DagBron { taken: TaakBron[]; accounts: AccountBron[]; contacten: ContactBron[] }
export interface Gebruiker { id: string; werkplek?: 'binnendienst' | 'buitendienst' | 'hybride' | string | null }

export type StapelSleutel = 'afspraken' | 'bellen' | 'acties' | 'eersteAfspraken'
export interface Regel {
  id: string; soort: StapelSleutel; taakId: string | null; titel: string; tijd: string | null; start: string | null; eind: string | null; accountId: string | null; accountNaam: string | null
  contact: { naam: string; tel: string | null; reden?: string } | null; navigeer: string | null; achterstallig: boolean; contactTaak: boolean; actionType: string | null
  eerste: boolean; zonderVerslag: boolean; poging: boolean; priority: string | null; knop?: 'bevestig' | 'overdragen' | null
}
export interface Dag {
  dag: string; isVandaag: boolean
  stapels: Record<StapelSleutel, Regel[]>
  volgorde: StapelSleutel[]
  telstrip: { sleutel: 'afspraken' | 'bellen' | 'acties' | 'kansen'; label: string; aantal: number; achterstand: number; stapel: StapelSleutel | null }[]
  achterstand: number
}

/** `tel:`-link in E.164, mobiel eerst. Null zonder bruikbaar nummer. */
export function telLink(c: { mobiel?: string | null; telefoon?: string | null } | null | undefined): string | null {
  const ruw = (c?.mobiel || c?.telefoon || '').trim()
  if (!ruw) return null
  let n = ruw.replace(/[\s\-().]/g, '')
  if (n.startsWith('00')) n = `+${n.slice(2)}`
  else if (n.startsWith('0')) n = `+31${n.slice(1)}`
  else if (!n.startsWith('+')) n = `+31${n}`
  return /^\+\d{8,15}$/.test(n) ? `tel:${n}` : null
}
/** Leesbaar nummer bij een link: "06 12 34 56 78" blijft zoals de bron het schreef. */
export const nummerVan = (c: { mobiel?: string | null; telefoon?: string | null } | null | undefined) => (c?.mobiel || c?.telefoon || '').trim() || null

/** Diepe link naar de kaartapp (Google Maps tot P30 de keuze per gebruiker brengt). */
export function navigeerLink(a: { naam?: string; adres?: string | null; plaats?: string | null } | null | undefined): string | null {
  const q = [a?.adres, a?.plaats].filter(Boolean).join(', ')
  return q ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}` : null
}

const datumVan = (iso: string | null) => (iso ? nlMoment(new Date(iso)).datum : null)
const tijdVan = (iso: string | null) => { if (!iso) return null; const m = nlMoment(new Date(iso)); return `${String(m.uur).padStart(2, '0')}:${String(m.minuut).padStart(2, '0')}` }
const isAfspraak = (t: TaakBron) => t.actionType === 'bezoek' || t.data?.soort === 'afspraak'
const PRIO: Record<string, number> = { hoog: 0, middel: 1, laag: 2 }

/** Is er een vervolg binnen de horizon? Een account in reis zonder volgende stap is na 7 dagen stil. */
export function heeftVervolg(bron: Pick<DagBron, 'taken' | 'accounts'>, accountId: string, nu: Date, inst: DagInstelling = DAG_STANDAARD): boolean {
  const grens = nu.getTime() + inst.vervolghorizonDagen * 864e5
  const open = bron.taken.some((t) => t.accountId === accountId && ['open', 'bezig'].includes(t.status) && (!t.dueDate || Date.parse(t.dueDate) <= grens))
  if (open) return true
  const a = bron.accounts.find((x) => x.id === accountId)
  if (!a?.laatsteContactOp) return false
  return nu.getTime() - Date.parse(a.laatsteContactOp) < inst.reisStilDagen * 864e5
}

/** De dag van één gebruiker: alleen eigen werk, op de gevraagde dag; achterstand alleen op vandaag. */
export function bouwDag(bron: DagBron, gebruiker: Gebruiker, dag: string, nu: Date, opties: Partial<DagInstelling> = {}): Dag {
  const inst = { ...DAG_STANDAARD, ...opties }
  const vandaag = nlMoment(nu).datum
  const isVandaag = dag === vandaag
  const acc = new Map(bron.accounts.map((a) => [a.id, a]))
  const contactVoor = (t: TaakBron) => {
    const cs = bron.contacten.filter((c) => c.accountId === t.accountId && c.status !== 'vertrokken')
    const c = (t.contactId && cs.find((x) => x.id === t.contactId)) || cs.find((x) => x.rol === 'beslisser' && telLink(x)) || cs.find((x) => telLink(x)) || cs[0]
    const a = t.accountId ? acc.get(t.accountId) : undefined
    if (!c && !a?.telefoon) return null
    const tel = telLink(c) ?? telLink({ telefoon: a?.telefoon })
    return { naam: c?.naam ?? a?.naam ?? '', tel, ...(tel ? {} : { reden: 'Geen telefoonnummer bekend' }) }
  }
  const mijn = bron.taken.filter((t) => t.ownerId === gebruiker.id && ['open', 'bezig'].includes(t.status))
  const opDag = mijn.filter((t) => {
    const d = datumVan(t.dueDate)
    return isVandaag ? !d || d <= dag : d === dag
  })
  const regel = (t: TaakBron, soort: StapelSleutel): Regel => {
    const a = t.accountId ? acc.get(t.accountId) : undefined
    const d = datumVan(t.dueDate)
    const afspraak = isAfspraak(t)
    const eind = afspraak && t.dueDate ? new Date(Date.parse(t.dueDate) + (Number(t.data?.duurMinuten) || inst.afspraakDuurMinuten) * 60_000).toISOString() : null
    return {
      id: `${soort}:${t.id}`, soort, taakId: t.id, titel: t.title, tijd: tijdVan(t.dueDate), start: t.dueDate, eind, accountId: t.accountId, accountNaam: a?.naam ?? null,
      contact: contactVoor(t), navigeer: afspraak ? navigeerLink(a) : null, achterstallig: isVandaag && !!d && (afspraak ? false : d < dag),
      contactTaak: CONTACT_ACTIES.has(t.actionType), actionType: t.actionType, eerste: afspraak && a?.faseId === 'afspraak-gepland',
      zonderVerslag: afspraak && !!eind && Date.parse(eind) <= nu.getTime(), poging: !!t.data?.poging, priority: t.priority ?? null,
    }
  }
  const opTijd = (a: Regel, b: Regel) => (a.start ?? '').localeCompare(b.start ?? '')
  const zwaar = (a: Regel, b: Regel) => Number(b.achterstallig) - Number(a.achterstallig) || (PRIO[a.priority ?? 'middel'] ?? 1) - (PRIO[b.priority ?? 'middel'] ?? 1) || opTijd(a, b)
  const afspraken = opDag.filter(isAfspraak).map((t) => regel(t, 'afspraken')).sort(opTijd)
  const bellen = opDag.filter((t) => !isAfspraak(t) && t.actionType === 'bellen').map((t) => regel(t, 'bellen')).sort(zwaar)
  const acties = opDag.filter((t) => !isAfspraak(t) && t.actionType !== 'bellen').map((t) => regel(t, 'acties')).sort(zwaar)

  // Eerste afspraken die nog bevestigd of overgedragen moeten worden (vierde stapel, F17).
  const eersteAfspraken: Regel[] = []
  for (const a of bron.accounts.filter((x) => x.ownerId === gebruiker.id && (x.faseId === 'afspraak-gepland' || x.faseId === 'afspraak-gehouden'))) {
    const bevestig = mijn.find((t) => t.accountId === a.id && /bevestig/i.test(t.title))
    if (a.faseId === 'afspraak-gepland' && !bevestig) continue
    eersteAfspraken.push({
      id: `eersteAfspraken:${a.id}`, soort: 'eersteAfspraken', taakId: bevestig?.id ?? null, titel: a.faseId === 'afspraak-gepland' ? `Eerste afspraak bevestigen met ${a.naam}` : `Eerste afspraak met ${a.naam} overdragen`,
      tijd: null, start: null, eind: null, accountId: a.id, accountNaam: a.naam, contact: null, navigeer: null, achterstallig: false, contactTaak: false, actionType: null, eerste: true, zonderVerslag: false, poging: false, priority: null,
      knop: a.faseId === 'afspraak-gepland' ? 'bevestig' : 'overdragen',
    })
  }
  const stapels = { afspraken, bellen, acties, eersteAfspraken }
  const volgorde: StapelSleutel[] = gebruiker.werkplek === 'binnendienst' ? ['bellen', 'afspraken', 'acties', 'eersteAfspraken'] : ['afspraken', 'bellen', 'acties', 'eersteAfspraken']
  const ach = (l: Regel[]) => l.filter((r) => r.achterstallig).length
  return {
    dag, isVandaag, stapels, volgorde,
    telstrip: [
      { sleutel: 'afspraken', label: 'Afspraken', aantal: afspraken.length, achterstand: afspraken.filter((r) => r.zonderVerslag).length, stapel: 'afspraken' },
      { sleutel: 'bellen', label: 'Bellen', aantal: bellen.length, achterstand: ach(bellen), stapel: 'bellen' },
      { sleutel: 'acties', label: 'Acties', aantal: acties.length + eersteAfspraken.length, achterstand: ach(acties), stapel: 'acties' },
      { sleutel: 'kansen', label: 'Kansen', aantal: 0, achterstand: 0, stapel: null },
    ],
    achterstand: ach(bellen) + ach(acties),
  }
}

/** Morgen en de vijf werkdagen van de week, voor de dagkiezer. */
export const morgen = (nu: Date) => plusDagen(nlMoment(nu).datum, 1)
