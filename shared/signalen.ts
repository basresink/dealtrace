// Signalen voor Vandaag (P32, 8.13, uit dexSignalen): vier detectoren voor new business en de
// governor die per dag hooguit één signaal laat zien, met een dagplafond en stilte na een besluit.
// Puur; het besluit staat op de server (signaal_besluiten), zodat het op elk toestel gelijk is.
import { nlMoment, plusDagen } from './datum'
import type { AccountBron, TaakBron } from './dag'

export interface SignaalInstelling { dagplafond: number; stilWegDagen: number; stilLaterDagen: number; stilGedaanDagen: number; koopsignaalMaxDagen: number; koopsignaalMinRelevantie: number; reisStilDagen: number; ritmeAchterDagen: number }
export const SIGNAAL_STANDAARD: SignaalInstelling = { dagplafond: 4, stilWegDagen: 1, stilLaterDagen: 3, stilGedaanDagen: 30, koopsignaalMaxDagen: 14, koopsignaalMinRelevantie: 60, reisStilDagen: 7, ritmeAchterDagen: 2 }

export type SignaalSoort = 'koopsignaal' | 'ritme-achter' | 'reis-stil' | 'terugkomregel'
export interface Signaal { sleutel: string; soort: SignaalSoort; titel: string; bewijs: string; bron: string; accountId: string | null; gewicht: number; link: string | null }
export interface InzichtBron { id: string; accountId: string | null; ownerId: string | null; title: string; relevanceScore: number; status: string; createdAt: string; bron?: string | null }
export type Besluit = 'gedaan' | 'later' | 'weg'
export interface BesluitRij { sleutel: string; besluit: Besluit; op: string; stilTot: string }

const dagen = (van: string, tot: Date) => (tot.getTime() - Date.parse(van)) / 864e5

export function detecteerSignalen(bron: { inzichten: InzichtBron[]; accounts: AccountBron[]; taken: TaakBron[] }, gebruiker: { id: string }, nu: Date, inst: SignaalInstelling = SIGNAAL_STANDAARD): Signaal[] {
  const uit: Signaal[] = []
  const vandaag = nlMoment(nu).datum
  const eigen = new Map(bron.accounts.filter((a) => a.ownerId === gebruiker.id).map((a) => [a.id, a]))
  // Koopsignaal: een eigen inzicht, hooguit 14 dagen oud, relevantie 60 of meer.
  for (const s of bron.inzichten) {
    if (!['nieuw', 'gelezen'].includes(s.status) || s.relevanceScore < inst.koopsignaalMinRelevantie || dagen(s.createdAt, nu) > inst.koopsignaalMaxDagen) continue
    if (s.ownerId !== gebruiker.id && !(s.accountId && eigen.has(s.accountId))) continue
    const a = s.accountId ? eigen.get(s.accountId) : undefined
    uit.push({ sleutel: `koop:${s.id}`, soort: 'koopsignaal', titel: s.title, bewijs: `${a?.naam ?? 'Account'} · relevantie ${s.relevanceScore} · ${Math.floor(dagen(s.createdAt, nu))} dagen oud`, bron: s.bron === 'extern' ? 'Nieuws' : 'Inzicht', accountId: s.accountId, gewicht: 100 + s.relevanceScore, link: s.accountId ? `/accounts/${s.accountId}` : null })
  }
  // Terugkomregel bereikt: vandaag of eerder terug, nog wachtend of nee.
  for (const a of eigen.values()) {
    if (a.terugOp && a.terugOp <= vandaag && ['wachtend', 'nee'].includes(a.nbStatus ?? '')) uit.push({ sleutel: `terug:${a.id}:${a.terugOp}`, soort: 'terugkomregel', titel: `${a.naam} komt ${a.terugOp === vandaag ? 'vandaag' : 'sinds ' + a.terugOp} terug`, bewijs: 'De terugkomtermijn is bereikt.', bron: 'Terugkomregel', accountId: a.id, gewicht: 90, link: `/accounts/${a.id}` })
  }
  // Ritme achter: een poging uit het hercontactritme ligt 2 dagen of meer achter.
  for (const t of bron.taken) {
    if (t.ownerId !== gebruiker.id || !['open', 'bezig'].includes(t.status) || !t.data?.poging || !t.dueDate) continue
    const achter = Math.floor(dagen(t.dueDate, nu))
    if (achter >= inst.ritmeAchterDagen) uit.push({ sleutel: `ritme:${t.id}`, soort: 'ritme-achter', titel: `Ritme loopt achter bij ${eigen.get(t.accountId ?? '')?.naam ?? 'een account'}`, bewijs: `Poging ${t.data.poging.n} van ${t.data.poging.van} staat ${achter} dagen open.`, bron: 'Hercontactritme', accountId: t.accountId, gewicht: 70 + Math.min(20, achter), link: t.accountId ? `/accounts/${t.accountId}` : null })
  }
  // Reis stil: in reis, geen open stap en al 7 dagen geen contact.
  for (const a of eigen.values()) {
    if (a.nbStatus !== 'in reis' || !a.laatsteContactOp) continue
    const open = bron.taken.some((t) => t.accountId === a.id && ['open', 'bezig'].includes(t.status))
    const stil = Math.floor(dagen(a.laatsteContactOp, nu))
    if (!open && stil >= inst.reisStilDagen) uit.push({ sleutel: `stil:${a.id}`, soort: 'reis-stil', titel: `${a.naam} staat stil in de reis`, bewijs: `${stil} dagen geen contact en geen volgende stap.`, bron: 'Prospectreis', accountId: a.id, gewicht: 60 + Math.min(20, stil - inst.reisStilDagen), link: `/accounts/${a.id}` })
  }
  return uit.sort((a, b) => b.gewicht - a.gewicht)
}

/** Tot wanneer een signaal stil blijft na een besluit: Weg 1 dag, Later 3, Gedaan 30. */
export function stilTot(besluit: Besluit, op: Date, inst: SignaalInstelling = SIGNAAL_STANDAARD): string {
  const n = besluit === 'weg' ? inst.stilWegDagen : besluit === 'later' ? inst.stilLaterDagen : inst.stilGedaanDagen
  return plusDagen(nlMoment(op).datum, n)
}

/** Eén signaal of niets: na het dagplafond niets meer; een signaal is stil tot en met de dag vóór stilTot. */
export function governor(signalen: Signaal[], besluiten: BesluitRij[], nu: Date, inst: SignaalInstelling = SIGNAAL_STANDAARD): Signaal | null {
  const vandaag = nlMoment(nu).datum
  if (besluiten.filter((b) => nlMoment(new Date(b.op)).datum === vandaag).length >= inst.dagplafond) return null
  const stil = new Set(besluiten.filter((b) => b.stilTot > vandaag).map((b) => b.sleutel))
  return signalen.find((s) => !stil.has(s.sleutel)) ?? null
}
