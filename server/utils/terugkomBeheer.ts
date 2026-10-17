// Instellingen, Terugkomen op de server: alles in één keer lezen, een droogloop van wat er
// verschuift, en bewaren in één transactie. Een regel bewaren werkt het concept van het onderdeel
// terugkomregels bij, bevestigt het als nieuwe versie (bevestig, met audit), zet de redenen die naar
// de regel wijzen en verschuift de wachtende prospects die nog niet gestart zijn. Komt het onderdeel
// uit SalesDNA, dan zijn reden, termijn, kanaal en aanpak alleen lezen; ritme en wie het oppakt
// blijven eigen aanvullingen. De terugkomdatum zelf komt altijd uit terugkomDatum.
import { sql } from 'drizzle-orm'
import { KANALEN, NEE_REDENEN, type Afkoeling } from '../../shared/nbStatus'
import {
  leesAfkoeling, OPPAKKER_LABEL, oppakkerVan, redenVerhuist, regelUitInvoer, valideerRegel, verschuiving,
  type MappingRij, type RegelInvoer, type Stand, type Verschuiving, type WachtendeProspect,
} from '../../shared/terugkomBeheer'
import { kanaalVanRegel, regelVoorReden, terugkomDatum, type ConceptTerugkomregel, type Redenmapping, type Terugkomregel } from '../../shared/verkoopverhaal'
import { schrijfAudit } from './audit'
import { afkoelingInstelling, laadRitmes } from './reis'
import { bevestig, bewaarConcept, leesStand, sublagen, zetAanvullingen } from './vvProjectie'

type Tx = Parameters<Parameters<ReturnType<typeof import('./db').gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]
const fout = (status: number, bericht: string, data?: unknown): never => { throw Object.assign(new Error(bericht), { statusCode: status, statusMessage: bericht, data }) }

export const BRON_SOORTEN: Redenmapping['bronSoort'][] = ['nee', 'deal_verloren', 'offerte_verloren', 'slapend']
export interface Kan { regels: boolean; redenen: boolean; afkoeling: boolean; ritme: boolean; startset: boolean }

/**
 * Prospects op nee met een terugkomdatum, met of ze al gestart zijn (een open taak uit de
 * terugkomregel of een lopende opvolgreeks) en of de datum met de hand is aangepast.
 */
export async function wachtendeProspects(tx: Tx): Promise<(WachtendeProspect & { regelId: string | null })[]> {
  const r = await rijen(tx, sql`select a.id, a.name, a.terug_op, a.terug_regel_id, a.data->'nee'->>'reden' as reden, a.data->'nee'->>'op' as op,
      jsonb_array_length(case when jsonb_typeof(a.data->'terugHistorie') = 'array' then a.data->'terugHistorie' else '[]'::jsonb end) as hand,
      exists (select 1 from tasks t where t.account_id = a.id and t.status = 'open' and t.data->'herkomst'->>'bron' = 'terugkomregel') as taak,
      exists (select 1 from reeksen r where r.account_id = a.id and r.status in ('loopt', 'gepauzeerd')) as reeks
    from accounts a
    where a.nb_status = 'nee' and a.terug_op is not null and a.gedeactiveerd_op is null and a.data->'nee'->>'reden' is not null
    order by a.terug_op, a.name`)
  return r.map((x) => ({
    id: x.id, naam: x.name, reden: x.reden, bronSoort: 'nee' as const, verlorenOp: x.op ?? '', terugOp: x.terug_op, regelId: x.terug_regel_id ?? null,
    hand: Number(x.hand) > 0, gestart: !!x.taak || !!x.reeks,
  }))
}

/** De rijen van het tabblad Verliesredenen: de vaste redenen voor nee plus elke reden uit de mapping. */
export function redenRijen(stand: Stand, afkoeling: Afkoeling) {
  const rijenLijst: { bronSoort: Redenmapping['bronSoort']; reden: string }[] = [
    ...NEE_REDENEN.map((r) => ({ bronSoort: 'nee' as const, reden: r })),
    ...stand.redenmapping.filter((m) => !(m.bronSoort === 'nee' && (NEE_REDENEN as readonly string[]).includes(m.reden))).map((m) => ({ bronSoort: m.bronSoort, reden: m.reden })),
  ]
  const nu = new Date()
  return rijenLijst.map((x) => {
    const vast = x.reden === 'Niet geschikt'
    const m = stand.redenmapping.find((y) => y.bronSoort === x.bronSoort && y.reden === x.reden)
    const regel = vast ? null : regelVoorReden(x.reden, stand, x.bronSoort)
    const v = terugkomDatum(x.reden, stand, nu, afkoeling, x.bronSoort)
    return { ...x, terugkomregelId: m ? m.terugkomregelId : null, expliciet: !!m, regelId: regel?.id ?? null, dagen: v.dagen, kanaal: v.kanaal, vast }
  })
}

/** Alles voor het scherm in één keer. */
export async function leesTerugkomen(tx: Tx, kan: Kan) {
  const [alle, stand, afkoeling, ritmes, wachtend] = await Promise.all([sublagen(tx), leesStand(tx), afkoelingInstelling(tx), laadRitmes(tx), wachtendeProspects(tx)])
  const s = alle.terugkomregels
  const items = ((s.concept?.items ?? []) as ConceptTerugkomregel[])
  const vandaag = new Date().toISOString().slice(0, 10)
  const nogNiet = wachtend.filter((w) => !w.gestart && w.terugOp >= vandaag)
  const regels = items.map((r) => ({
    ...r, oppakker: oppakkerVan(r), kanaalSleutel: kanaalVanRegel(r.kanaal), actief: stand.terugkomregels.some((x) => x.id === r.id),
    wachtend: nogNiet.filter((w) => w.regelId === r.id).length,
  }))
  const ritmeVoorbeeld: Record<string, { naam: string; terugOp: string; regelId: string } | null> = {}
  for (const rt of ritmes) {
    const metRitme = regels.filter((r) => r.hercontactritmeId === rt.id).map((r) => r.id)
    const p = nogNiet.find((w) => w.regelId && metRitme.includes(w.regelId))
    ritmeVoorbeeld[rt.id] = p ? { naam: p.naam, terugOp: p.terugOp, regelId: p.regelId! } : null
  }
  return {
    bron: s.bron === 'salesdna' ? 'salesdna' : 'eigen', status: s.status, versie: s.versie, bevestigdOp: s.bevestigdOp,
    regels, redenen: redenRijen(stand, afkoeling), afkoeling, kanalen: KANALEN,
    ritmes: ritmes.filter((r) => (r.status ?? 'actief') === 'actief').map((r) => ({ ...r, gebruiktDoor: regels.filter((x) => x.hercontactritmeId === r.id).map((x) => x.reden) })),
    ritmeVoorbeeld, wachtendTotaal: nogNiet.length, vandaag, kan,
  }
}

/** Een regel als Terugkomregel voor het rekenen (zoals het leesmodel hem zou tonen). */
const alsRegel = (c: ConceptTerugkomregel): Terugkomregel => ({ id: c.id, lijst: c.lijst, reden: c.reden, termijn: c.termijn, termijnDagen: c.termijnDagen, kanaal: c.kanaal, rollen: c.rollen ?? [], aanpak: c.aanpak, klassen: c.klassen ?? [] })

export interface Wijziging {
  regel?: { id: string } & RegelInvoer
  /** De redenen die bij de regel horen (vinkjes); verhuizen hierheen. */
  redenen?: { bronSoort: Redenmapping['bronSoort']; reden: string }[]
  /** Eén reden naar een andere regel (tabblad Verliesredenen). */
  reden?: MappingRij
  afkoeling?: Afkoeling
}

/** De stand na een wijziging, zonder iets te bewaren. */
export function standNa(stand: Stand, afkoeling: Afkoeling, w: Wijziging, nieuwId?: string): { stand: Stand; afkoeling: Afkoeling; verhuisd: { reden: string; van: string }[]; losgelaten: string[]; mapping: MappingRij[] } {
  let regels = stand.terugkomregels
  let mapping: MappingRij[] = stand.redenmapping.map((m) => ({ ...m }))
  let verhuisd: { reden: string; van: string }[] = []
  let losgelaten: string[] = []
  if (w.regel) {
    const id = w.regel.id === 'nieuw' ? (nieuwId ?? 'nieuw') : w.regel.id
    const oud = regels.find((r) => r.id === id)
    const nieuw = alsRegel(regelUitInvoer({ ...(oud ?? {}), id } as any, w.regel))
    regels = oud ? regels.map((r) => (r.id === id ? nieuw : r)) : [...regels, nieuw]
    if (w.redenen) ({ mapping, verhuisd, losgelaten } = redenVerhuist(mapping, w.redenen, id))
  }
  if (w.reden) {
    const i = mapping.findIndex((m) => m.bronSoort === w.reden!.bronSoort && m.reden === w.reden!.reden)
    if (i >= 0) mapping[i] = { ...w.reden }
    else mapping.push({ ...w.reden })
  }
  return { stand: { terugkomregels: regels, redenmapping: mapping }, afkoeling: w.afkoeling ?? afkoeling, verhuisd, losgelaten, mapping }
}

/** Droogloop: wat verschuift er als je dit bewaart. */
export async function proef(tx: Tx, w: Wijziging) {
  const [stand, afkoeling, wachtend] = await Promise.all([leesStand(tx), afkoelingInstelling(tx), wachtendeProspects(tx)])
  const na = standNa(stand, afkoeling, w)
  const lijst = verschuiving(wachtend, { stand, afkoeling }, { stand: na.stand, afkoeling: na.afkoeling })
  return { verschuivingen: lijst, aantal: lijst.length, verhuisd: na.verhuisd, losgelaten: na.losgelaten }
}

/** De verschuivingen doorvoeren op de accounts: datum, regel en de terugkomgegevens. */
async function pasToe(tx: Tx, lijst: Verschuiving[], stand: Stand, wachtend: WachtendeProspect[]) {
  for (const v of lijst) {
    const regel = stand.terugkomregels.find((r) => r.id === v.regelNaar) ?? null
    const p = wachtend.find((x) => x.id === v.id)
    const terugkom = { datum: v.naar, regelId: regel?.id ?? null, reden: regel?.reden ?? p?.reden ?? null, aanpak: regel?.aanpak ?? null, kanaal: regel ? v.kanaalNaar : null }
    await tx.execute(sql`update accounts set terug_op = ${v.naar}, terug_regel_id = ${regel?.id ?? null},
      data = coalesce(data, '{}'::jsonb) || jsonb_build_object('terugkom', coalesce(data->'terugkom', '{}'::jsonb) || ${JSON.stringify(terugkom)}::jsonb), updated_at = now()
      where id = ${v.id}`)
  }
}

const kort = (l: Verschuiving[]) => l.slice(0, 50).map((v) => ({ id: v.id, van: v.van, naar: v.naar }))

/**
 * Een regel bewaren (of een nieuwe, met id "nieuw") samen met de redenen die naar deze regel
 * wijzen, in één transactie: nieuwe bevestigde versie, mapping, verschuiving en audit.
 */
export async function bewaarRegel(tx: Tx, org: string, door: string, id: string, invoer: RegelInvoer, redenen: Wijziging['redenen'], magMapping: boolean) {
  const fouten = valideerRegel(invoer)
  if (fouten.length) fout(422, fouten.join('; '), { fouten })
  const s = (await sublagen(tx, org)).terugkomregels
  const spiegel = s.bron === 'salesdna'
  const items = [...((s.concept?.items ?? []) as ConceptTerugkomregel[])]
  const nieuwId = id === 'nieuw' ? `tk-${crypto.randomUUID().slice(0, 8)}` : id
  const oud = items.find((r) => r.id === nieuwId)
  if (id !== 'nieuw' && !oud) fout(404, 'Deze regel bestaat niet')
  if (spiegel) {
    if (!oud) fout(409, 'De terugkomregels komen uit SalesDNA; een nieuwe regel maak je daar')
    if (oud!.reden !== invoer.reden.trim() || oud!.termijnDagen !== invoer.termijnDagen || kanaalVanRegel(oud!.kanaal) !== invoer.kanaal || (oud!.aanpak ?? '').trim() !== invoer.aanpak.trim()) {
      fout(409, 'Deze regel komt uit SalesDNA: reden, termijn, kanaal en aanpak wijzig je daar')
    }
  }
  if (invoer.hercontactritmeId && !(await rijen(tx, sql`select 1 from hercontactritmes where id = ${invoer.hercontactritmeId}`)).length) fout(422, 'Dit ritme bestaat niet')
  const [stand, afkoeling, wachtend] = await Promise.all([leesStand(tx), afkoelingInstelling(tx), wachtendeProspects(tx)])
  const na = standNa(stand, afkoeling, { regel: { ...invoer, id }, redenen }, nieuwId)
  const mappingVeranderd = JSON.stringify(na.mapping) !== JSON.stringify(stand.redenmapping)
  if (mappingVeranderd && !magMapping) fout(403, 'Alleen de beheerder koppelt verliesredenen aan een regel')
  if (spiegel && mappingVeranderd) fout(409, 'De regels komen uit SalesDNA; koppel redenen op het tabblad Verliesredenen')

  const regel = regelUitInvoer(oud ?? { id: nieuwId, lijst: invoer.lijst ?? 'verloren', klassen: [] }, invoer)
  let versie = s.versie
  if (spiegel) {
    // Eigen aanvullingen op een gespiegelde regel: alleen ritme en wie het oppakt, zonder nieuwe versie.
    const concept = { ...s.concept, items: items.map((r) => (r.id === nieuwId ? { ...r, hercontactritmeId: regel.hercontactritmeId, oppakker: regel.oppakker, rollen: regel.rollen } : r)) }
    await tx.execute(sql`update vv_sublagen set concept = ${JSON.stringify(concept)}::jsonb, bijgewerkt_op = now() where organisation_id = ${org} and onderdeel = 'terugkomregels'`)
    await tx.execute(sql`update vv_terugkomregels set hercontactritme_id = ${regel.hercontactritmeId}, rollen = ${`{"${OPPAKKER_LABEL[regel.oppakker]}"}`}::text[] where organisation_id = ${org} and extern_id = ${nieuwId}`)
  } else {
    const nieuweItems = oud ? items.map((r) => (r.id === nieuwId ? regel : r)) : [...items, regel]
    await bewaarConcept(tx, org, 'terugkomregels', { ...s.concept, items: nieuweItems })
    versie = (await bevestig(tx, org, 'terugkomregels', door)).versie
  }
  if (mappingVeranderd) await zetAanvullingen(tx, org, { redenmapping: na.mapping })
  const standNieuw = await leesStand(tx)
  const lijst = verschuiving(wachtend, { stand, afkoeling }, { stand: standNieuw, afkoeling })
  await pasToe(tx, lijst, standNieuw, wachtend)
  await schrijfAudit(tx, {
    organisationId: org, actorId: door, action: id === 'nieuw' ? 'terugkomen.regel.nieuw' : 'terugkomen.regel', resourceType: 'vv_terugkomregels', resourceId: nieuwId,
    changes: { van: oud ?? null, naar: regel, versie, spiegel, verhuisd: na.verhuisd, losgelaten: na.losgelaten, verschoven: lijst.length, accounts: kort(lijst) },
  })
  return { id: nieuwId, versie, verschoven: lijst.length, verschuivingen: lijst, verhuisd: na.verhuisd, losgelaten: na.losgelaten }
}

/** Eén verliesreden naar een regel (of geen regel), met verschuiving en audit. */
export async function bewaarReden(tx: Tx, org: string, door: string, rij: MappingRij) {
  if (!BRON_SOORTEN.includes(rij.bronSoort)) fout(422, 'Onbekende bron')
  if (!rij.reden?.trim()) fout(422, 'Reden ontbreekt')
  if (rij.reden === 'Niet geschikt') fout(422, '"Niet geschikt" heeft nooit een regel: altijd 365 dagen')
  const [stand, afkoeling, wachtend] = await Promise.all([leesStand(tx), afkoelingInstelling(tx), wachtendeProspects(tx)])
  if (rij.terugkomregelId && !stand.terugkomregels.some((r) => r.id === rij.terugkomregelId)) fout(422, 'Deze regel bestaat niet of is nog niet bevestigd')
  const oud = stand.redenmapping.find((m) => m.bronSoort === rij.bronSoort && m.reden === rij.reden) ?? null
  const na = standNa(stand, afkoeling, { reden: { bronSoort: rij.bronSoort, reden: rij.reden.trim(), terugkomregelId: rij.terugkomregelId || null } })
  await zetAanvullingen(tx, org, { redenmapping: na.mapping })
  const lijst = verschuiving(wachtend, { stand, afkoeling }, { stand: na.stand, afkoeling })
  await pasToe(tx, lijst, na.stand, wachtend)
  await schrijfAudit(tx, {
    organisationId: org, actorId: door, action: 'terugkomen.reden', resourceType: 'vv_redenmapping', resourceId: `${rij.bronSoort}:${rij.reden}`,
    changes: { van: oud?.terugkomregelId ?? null, naar: rij.terugkomregelId || null, verschoven: lijst.length, accounts: kort(lijst) },
  })
  return { verschoven: lijst.length, verschuivingen: lijst }
}

/** De afkoeling per kanaal bewaren: de enige schrijfplek, met verschuiving en audit. */
export async function bewaarAfkoeling(tx: Tx, org: string, door: string, nieuw: Afkoeling) {
  const [stand, afkoeling, wachtend] = await Promise.all([leesStand(tx), afkoelingInstelling(tx), wachtendeProspects(tx)])
  const [oud] = await rijen(tx, sql`select value from org_settings where key = 'afkoeling'`)
  await tx.execute(sql`insert into org_settings (organisation_id, key, value, updated_at) values (${org}, 'afkoeling', ${JSON.stringify(nieuw)}::jsonb, now())
    on conflict (organisation_id, key) do update set value = excluded.value, updated_at = now()`)
  const lijst = verschuiving(wachtend, { stand, afkoeling }, { stand, afkoeling: nieuw })
  await pasToe(tx, lijst, stand, wachtend)
  await schrijfAudit(tx, {
    organisationId: org, actorId: door, action: 'instelling.wijzigen', resourceType: 'org_settings', resourceId: 'afkoeling',
    changes: { van: oud?.value ?? null, naar: nieuw, verschoven: lijst.length, accounts: kort(lijst) },
  })
  return { verschoven: lijst.length, verschuivingen: lijst }
}

// ── Invoer van het scherm lezen ────────────────────────────────────────────────

const bronUit = (v: unknown) => (BRON_SOORTEN.includes(v as Redenmapping['bronSoort']) ? (v as Redenmapping['bronSoort']) : null)

export function terugkomRegelUitBody(b: any): RegelInvoer {
  return {
    reden: String(b?.reden ?? '').slice(0, 120), termijnDagen: Number(b?.termijnDagen), kanaal: b?.kanaal, oppakker: b?.oppakker,
    hercontactritmeId: b?.hercontactritmeId ? String(b.hercontactritmeId) : null, aanpak: String(b?.aanpak ?? '').slice(0, 1000),
    lijst: b?.lijst === 'slapend' ? 'slapend' : 'verloren',
  }
}

export function terugkomRedenenUitBody(v: unknown): Wijziging['redenen'] {
  if (!Array.isArray(v)) return undefined
  return v.map((x: any) => ({ bronSoort: bronUit(x?.bronSoort), reden: String(x?.reden ?? '').trim() }))
    .filter((x): x is { bronSoort: Redenmapping['bronSoort']; reden: string } => !!x.bronSoort && !!x.reden).slice(0, 60)
}

export function terugkomWijzigingUitBody(b: any): Wijziging {
  const w: Wijziging = {}
  if (b?.regel && typeof b.regel === 'object') w.regel = { id: String(b.regel.id ?? 'nieuw'), ...terugkomRegelUitBody(b.regel) }
  if (b?.redenen) w.redenen = terugkomRedenenUitBody(b.redenen)
  const br = bronUit(b?.reden?.bronSoort)
  if (br) w.reden = { bronSoort: br, reden: String(b.reden.reden ?? ''), terugkomregelId: b.reden.terugkomregelId ? String(b.reden.terugkomregelId) : null }
  if (b?.afkoeling) { const a = leesAfkoeling(b.afkoeling); if (a) w.afkoeling = a }
  return w
}
