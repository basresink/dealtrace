// De reiseditor (P22, F05): fasemapping tussen versies, fases omzetten zonder kale id's (regel 42),
// de droogloop en het schoonmaken van een concept. Pure functies; de server schrijft.
import { GEBEURTENISSEN, type Gebeurtenis } from './nbStatus'
import { HOOFDFASEN, instapFase, valideerReis, type ActiviteitTemplate, type Fase, type Hoofdfase, type Overgang, type ReisData } from './reis'

/** Gebeurtenissen die je in Overgangen kiest: alleen wat de app echt meldt; geen offertes of deals (B17). */
export const KIESBARE_GEBEURTENISSEN: Gebeurtenis[] = GEBEURTENISSEN.filter((g) => g !== 'handmatig')
export const KLEUREN = ['zwart', 'geel', 'paars', 'oranje', 'groen', 'rood', 'grijs'] as const

/** Publiceren is geblokkeerd bij fouten, een onbereikbare of een doodlopende fase. */
export function blokkeertPublicatie(v: ReturnType<typeof valideerReis>): string[] {
  return [...v.fouten, ...v.waarschuwingen.filter((w) => w.startsWith('Fase onbereikbaar') || w.startsWith('Doodlopende fase'))]
}

/**
 * Voorstel per oude fase: dezelfde id als die er nog is; anders dezelfde hoofdfase op de dichtstbijzijnde
 * positie; anders null (dan moet je kiezen). Eindfases gaan naar de eindfase van dezelfde soort.
 */
export function faseMapping(oud: Pick<ReisData, 'fases'>, nieuw: Pick<ReisData, 'fases'>): Record<string, string | null> {
  const uit: Record<string, string | null> = {}
  const pos = (lijst: Fase[], f: Fase) => lijst.filter((x) => x.hoofdfase === f.hoofdfase).sort((a, b) => a.volgorde - b.volgorde).indexOf(f)
  for (const f of oud.fases) {
    if (nieuw.fases.some((n) => n.id === f.id)) { uit[f.id] = f.id; continue }
    if (f.eind) { uit[f.id] = nieuw.fases.find((n) => n.eind === f.eind)?.id ?? null; continue }
    const zelfde = nieuw.fases.filter((n) => n.hoofdfase === f.hoofdfase && !n.eind).sort((a, b) => a.volgorde - b.volgorde)
    uit[f.id] = zelfde.length ? zelfde[Math.min(Math.max(0, pos(oud.fases, f)), zelfde.length - 1)]!.id : null
  }
  return uit
}
/** Is de mapping compleet voor de fases waar accounts in staan, en wijst hij alleen naar bestaande fases? */
export function mappingFouten(mapping: Record<string, string | null | undefined>, nodig: string[], nieuw: Pick<ReisData, 'fases'>): string[] {
  const ids = new Set(nieuw.fases.map((f) => f.id))
  return nodig.filter((id) => !mapping[id] || !ids.has(mapping[id]!)).map((id) => `Kies een nieuwe fase voor ${id}`)
}

export interface Omzetbaar { overgangen: Overgang[]; regels: { id: string; faseId: string | null }[]; accounts: { id: string; faseId: string | null }[]; activiteiten: (ActiviteitTemplate & { id?: string })[] }
/** Zet alles van de ene fase naar de andere; overgangen die daardoor naar zichzelf wijzen of dubbel worden, vervallen. */
export function zetFaseOm(e: Omzetbaar, van: string, naar: string): Omzetbaar & { aantallen: { overgangen: number; regels: number; accounts: number; activiteiten: number } } {
  let n = 0
  const overgangen: Overgang[] = []
  const gezien = new Set<string>()
  for (const x of e.overgangen) {
    const o = { ...x, vanFaseId: x.vanFaseId === van ? naar : x.vanFaseId, naarFaseId: x.naarFaseId === van ? naar : x.naarFaseId }
    if (o.vanFaseId !== x.vanFaseId || o.naarFaseId !== x.naarFaseId) n++
    const k = `${o.vanFaseId}|${o.gebeurtenis}|${o.naarFaseId}|${JSON.stringify(o.voorwaarde ?? {})}`
    if (o.vanFaseId === o.naarFaseId || gezien.has(k)) continue
    gezien.add(k)
    overgangen.push(o)
  }
  const regels = e.regels.map((r) => (r.faseId === van ? { ...r, faseId: naar } : r))
  const accounts = e.accounts.map((a) => (a.faseId === van ? { ...a, faseId: naar } : a))
  const activiteiten = e.activiteiten.map((a) => (a.faseId === van ? { ...a, faseId: naar } : a))
  return {
    overgangen, regels, accounts, activiteiten,
    aantallen: { overgangen: n, regels: e.regels.filter((r) => r.faseId === van).length, accounts: e.accounts.filter((a) => a.faseId === van).length, activiteiten: e.activiteiten.filter((a) => a.faseId === van).length },
  }
}

/** Een fase verwijderen uit een concept: de vervangende fase is verplicht en erft instap en eind niet. */
export function verwijderFase(data: ReisData, faseId: string, vervangendeFaseId: string): ReisData {
  if (!vervangendeFaseId || vervangendeFaseId === faseId || !data.fases.some((f) => f.id === vervangendeFaseId)) throw Object.assign(new Error('Kies een vervangende fase'), { statusCode: 422, statusMessage: 'Kies een vervangende fase' })
  const z = zetFaseOm({ overgangen: data.overgangen, regels: [], accounts: [], activiteiten: [] }, faseId, vervangendeFaseId)
  const fases = data.fases.filter((f) => f.id !== faseId).sort((a, b) => a.volgorde - b.volgorde).map((f, i) => ({ ...f, volgorde: i + 1 }))
  return { ...data, fases, overgangen: z.overgangen }
}

export interface DroogAccount { id: string; reisId: string | null; faseId: string | null; ownerId: string | null; werkplek?: string | null; ritmeActief?: boolean; nbStatus?: string | null }
export interface Droogloop { perFase: { faseId: string; label: string; accounts: number; taken: number }[]; perPersoon: { ownerId: string; taken: number }[]; accounts: number; taken: number; inAndereReis: number }
/**
 * Wat publicatie oplevert: elk account landt in een fase (zelfde id, anders de mapping, anders de instap)
 * en elke startactiviteit van die fase wordt een taak als de rol past (zoals de motor: geen bel- of
 * bezoektaak naast een lopend hercontactritme).
 */
export function droogloop(template: ReisData, accounts: DroogAccount[], activiteiten: ActiviteitTemplate[], opties: { reisId: string; mapping?: Record<string, string | null>; andereReizen?: Set<string> } ): Droogloop {
  const perFase = new Map<string, { accounts: number; taken: number }>()
  const perPersoon = new Map<string, number>()
  const instap = instapFase(template)
  let inAndereReis = 0
  let taken = 0
  for (const a of accounts) {
    if (a.reisId && a.reisId !== opties.reisId && opties.andereReizen?.has(a.reisId)) { inAndereReis++; continue }
    const blijft = a.reisId === opties.reisId && !!a.faseId && template.fases.some((f) => f.id === a.faseId)
    const fase = blijft ? a.faseId! : (a.faseId && opties.mapping?.[a.faseId]) || instap
    if (!fase) continue
    const p = perFase.get(fase) ?? { accounts: 0, taken: 0 }
    p.accounts++
    perFase.set(fase, p)
    // Wie in zijn fase blijft, betreedt niets en krijgt dus geen startactiviteit.
    if (blijft) continue
    for (const s of activiteiten.filter((x) => x.faseId === fase)) {
      if (!a.ownerId || (s.rol !== 'alle' && (a.werkplek ?? 'binnendienst') !== s.rol)) continue
      if ((a.ritmeActief || a.nbStatus === 'nee' || a.nbStatus === 'wachtend') && (s.actiesoort === 'bellen' || s.actiesoort === 'bezoek')) continue
      p.taken++; taken++
      perPersoon.set(a.ownerId, (perPersoon.get(a.ownerId) ?? 0) + 1)
    }
  }
  return {
    perFase: template.fases.map((f) => ({ faseId: f.id, label: f.label, accounts: perFase.get(f.id)?.accounts ?? 0, taken: perFase.get(f.id)?.taken ?? 0 })),
    perPersoon: [...perPersoon].map(([ownerId, n]) => ({ ownerId, taken: n })).sort((a, b) => b.taken - a.taken),
    accounts: [...perFase.values()].reduce((s, x) => s + x.accounts, 0), taken, inAndereReis,
  }
}

const slug = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'fase'
/** Een concept uit de editor schoonmaken: alleen bekende velden, hoofdfase verplicht, unieke id's, volgorde opnieuw. */
export function schoonReisData(d: any): ReisData {
  const fases: Fase[] = (Array.isArray(d?.fases) ? d.fases : []).slice(0, 30).map((f: any, i: number) => ({
    id: String(f?.id || slug(String(f?.label ?? `fase-${i + 1}`))).slice(0, 60), label: String(f?.label ?? '').trim().slice(0, 60), omschrijving: String(f?.omschrijving ?? '').slice(0, 500),
    hoofdfase: (HOOFDFASEN as readonly string[]).includes(f?.hoofdfase) ? f.hoofdfase as Hoofdfase : (undefined as unknown as Hoofdfase),
    volgorde: i + 1, kleur: (KLEUREN as readonly string[]).includes(f?.kleur) ? f.kleur : 'grijs', accent: String(f?.accent ?? '').slice(0, 300),
    verwachtVerblijfDagen: f?.verwachtVerblijfDagen === '' || f?.verwachtVerblijfDagen == null ? null : Math.max(0, Math.min(730, Math.round(Number(f.verwachtVerblijfDagen)) || 0)),
    ...(f?.verblijfTekst ? { verblijfTekst: String(f.verblijfTekst).slice(0, 60) } : {}),
    instap: !!f?.instap, eind: f?.eind === 'overgedragen' || f?.eind === 'verloren' ? f.eind : null,
  }))
  const overgangen: Overgang[] = (Array.isArray(d?.overgangen) ? d.overgangen : []).slice(0, 200).filter((x: any) => (KIESBARE_GEBEURTENISSEN as string[]).includes(x?.gebeurtenis) || x?.gebeurtenis === 'handmatig').map((x: any, i: number) => ({
    id: String(x?.id || `o-${i + 1}`).slice(0, 60), vanFaseId: x?.vanFaseId ? String(x.vanFaseId) : null, gebeurtenis: x.gebeurtenis as Gebeurtenis, naarFaseId: String(x?.naarFaseId ?? ''),
    ...(x?.voorwaarde && Object.values(x.voorwaarde).some((v: any) => Array.isArray(v) && v.length) ? { voorwaarde: { klasse: x.voorwaarde.klasse ?? undefined, rol: x.voorwaarde.rol ?? undefined, kanaal: x.voorwaarde.kanaal ?? undefined } } : {}),
    prioriteit: Number.isFinite(Number(x?.prioriteit)) ? Math.round(Number(x.prioriteit)) : 1,
  }))
  return { fases, overgangen, ...(d?.overschrijvingen ? { overschrijvingen: d.overschrijvingen } : {}) }
}
