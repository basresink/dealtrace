// Nieuwe prospect: de velden die de plek in de accountmatrix en de motor bepalen (branche uit het
// verkoopverhaal, aantal medewerkers, klasse, huidige leverancier en de regio uit postcode of plaats).
// Eén plek voor de keuzes in de flyout (nieuwContext) en de controle bij aanmaken (leesMatrixVelden,
// leesBasisVelden, controleerVerplichteVelden). Bij aanmaken mag iedereen met "Nieuwe prospect" alle
// datavelden invullen, ook klasse en huidige leverancier: dat is de beginstand. Later wijzigen op de
// accountkaart blijft aan de functies Klasse zetten en Huidige leverancier zetten gebonden.
import { eq, sql } from 'drizzle-orm'
import { regioVan } from '../../shared/gebieden'
import { klasseUitMedewerkers } from '../../shared/leadGenerator'
import { geocodeerTerugval } from '../../shared/route'
import { normaliseerTelefoon } from '../../shared/contactgegevens'
import type { VeldDefinitie } from '../../shared/eigenVelden'
import { gebiedenInstelling } from './bezoeken'
import { schema } from './db'
import { klassenVan } from './leads'
import { planInstelling } from './planning'
import { verkoopverhaal } from './reis'

type Tx = Parameters<Parameters<ReturnType<typeof import('./db').gebruikDb>['transaction']>[0]>[0]

/** Wat de flyout "+ Prospect" nodig heeft om de matrixvelden te tonen en de plek vooraf te laten zien. */
export async function nieuwContext(tx: Tx, _ctx: unknown) {
  const vv = await verkoopverhaal(tx)
  const { regios, synoniemen } = await gebiedenInstelling(tx)
  const doelgroepen = (await tx.select().from(schema.doelgroepen).where(eq(schema.doelgroepen.status, 'actief')))
    .map((d) => ({ id: d.id, naam: d.naam, status: d.status, prioriteit: d.prioriteit, data: d.data ?? {} }))
  return {
    branches: (vv.branches ?? []).map((b) => ({ id: b.id, naam: b.naam, focus: b.focus })),
    concurrenten: (vv.concurrenten ?? []).map((c) => ({ id: c.id, naam: c.naam })),
    klassen: (await klassenVan(tx)).filter((k) => k.tabblad !== 'Klanten'),
    // Zonder de eigenaren: de flyout toont alleen de naam van de regio.
    regios: regios.map((r) => ({ id: r.id, naam: r.naam, reeksen: r.reeksen, plaatsen: r.plaatsen, eigenaren: { buitendienst: [], binnendienst: [] }, dagen: [] })),
    synoniemen,
    doelgroepen,
    planning: await planInstelling(tx),
  }
}

export interface MatrixVelden {
  medewerkers: number | null
  vvBrancheId: string | null
  huidigeLeverancierId: string | null
  /** De klasse: gekozen (met recht), anders afgeleid uit het aantal medewerkers. */
  klasse: string | null
  klasseBron: 'hand' | 'medewerkers' | null
}

/** Controleert de matrixvelden uit het formulier tegen het verkoopverhaal en de klassen (400 bij iets onbekends). */
export async function leesMatrixVelden(tx: Tx, _ctx: unknown, b: { medewerkers?: unknown; vvBrancheId?: unknown; huidigeLeverancierId?: unknown; klasse?: unknown }): Promise<MatrixVelden> {
  const fout = (bericht: string): never => { throw createError({ statusCode: 400, statusMessage: bericht }) }
  let medewerkers: number | null = null
  if (b.medewerkers !== undefined && b.medewerkers !== null && b.medewerkers !== '') {
    const n = Number(b.medewerkers)
    if (!Number.isInteger(n) || n < 0 || n > 1_000_000) fout('Aantal medewerkers is een heel getal van 0 of meer')
    medewerkers = n
  }
  const vv = (b.vvBrancheId || b.huidigeLeverancierId) ? await verkoopverhaal(tx) : null
  const vvBrancheId = b.vvBrancheId ? String(b.vvBrancheId) : null
  if (vvBrancheId && !(vv?.branches ?? []).some((x) => x.id === vvBrancheId)) fout('Deze branche staat niet in het verkoopverhaal')
  const huidigeLeverancierId = b.huidigeLeverancierId ? String(b.huidigeLeverancierId) : null
  if (huidigeLeverancierId && !(vv?.concurrenten ?? []).some((x) => x.id === huidigeLeverancierId)) fout('Deze leverancier staat niet bij de concurrenten in het verkoopverhaal')
  const klassen = (await klassenVan(tx)).filter((k) => k.tabblad !== 'Klanten')
  let klasse: string | null = null
  let klasseBron: MatrixVelden['klasseBron'] = null
  if (b.klasse) {
    klasse = String(b.klasse)
    if (!klassen.some((k) => k.id === klasse)) fout('Deze klasse bestaat niet')
    klasseBron = 'hand'
  } else if (medewerkers !== null) {
    klasse = klasseUitMedewerkers(medewerkers, klassen)
    klasseBron = klasse ? 'medewerkers' : null
  }
  return { medewerkers, vvBrancheId, huidigeLeverancierId, klasse, klasseBron }
}

/** Regio en punt voor een nieuw account uit postcode of plaats (dezelfde regels als bij wijzigen). */
export async function regioEnPunt(tx: Tx, a: { postcode?: string | null; plaats?: string | null; lat?: number | null; lng?: number | null }) {
  const { regios, synoniemen } = await gebiedenInstelling(tx)
  return { gebiedId: regioVan({ postcode: a.postcode, plaats: a.plaats }, regios, synoniemen), punt: geocodeerTerugval({ lat: a.lat, lng: a.lng, postcode: a.postcode, plaats: a.plaats }, synoniemen) }
}

/** Zet het punt met zijn herkomst (geo_bron staat niet in het Drizzle-schema). */
export async function zetPunt(tx: Tx, id: string, punt: { lat: number; lng: number; bron: string } | null) {
  if (punt) await tx.execute(sql`update accounts set lat = ${punt.lat}, lng = ${punt.lng}, geo_bron = ${punt.bron} where id = ${id} and lat is null`)
}

export interface BasisVelden { telefoon: string | null; email: string | null; kvk: string | null }

/** Telefoon (als E.164), e-mail en KvK-nummer uit het formulier; 400 bij een ongeldige waarde. Leeg is goed. */
export function leesBasisVelden(b: { telefoon?: unknown; email?: unknown; kvk?: unknown }): BasisVelden {
  const fout = (bericht: string): never => { throw createError({ statusCode: 400, statusMessage: bericht }) }
  let telefoon: string | null = null
  const tel = String(b.telefoon ?? '').trim()
  if (tel) {
    const t = normaliseerTelefoon(tel)
    if (!t.ok) fout(t.fout)
    else telefoon = t.e164
  }
  const email = String(b.email ?? '').trim().toLowerCase() || null
  if (email && (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) fout('Dit is geen geldig e-mailadres')
  const kvk = String(b.kvk ?? '').replace(/\D/g, '') || null
  if (String(b.kvk ?? '').trim() && kvk?.length !== 8) fout('Een KvK-nummer heeft acht cijfers')
  return { telefoon, email, kvk }
}

/** Eigen velden die bij aanmaken verplicht zijn (en die dit niveau ziet) moeten gevuld zijn; anders 400. */
export function controleerVerplichteVelden(velden: Pick<VeldDefinitie, 'sleutel' | 'naam' | 'gearchiveerd' | 'data'>[], customFields: Record<string, unknown> | undefined) {
  for (const v of velden) {
    if (v.gearchiveerd || v.data?.verplicht !== 'bijAanmaken') continue
    const w = customFields?.[v.sleutel]
    if (w === undefined || w === null || w === '' || (Array.isArray(w) && !w.length)) throw createError({ statusCode: 400, statusMessage: `Vul ${v.naam} in` })
  }
}
