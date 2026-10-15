// SalesDNA-koppeling op de server (P29, F25, ADR-002, ADR-017): ontvangen (handtekening, tijdvenster,
// dubbel), de spiegel (salesdna_sublagen en versies), verwerken in een job, volledige synchronisatie,
// de projectie naar het leesmodel met bron 'salesdna', bron kiezen per onderdeel, vergelijken en
// ontkoppelen. Spiegeltabellen worden alleen hier geschreven, nooit door gebruikersendpoints.
import { sql } from 'drizzle-orm'
import {
  ONDERDEEL_NAAR_ONDERWERP, ONDERWERP_NAAR_ONDERDEEL, PLEK_IN_SALESDNA, binnenTijdvenster, heeftGat, isOud, mapOpNaam, nieuweIds, spiegelNaarConcept, type Koppelregel,
} from '../../shared/salesdna'
import { LEEG_CONCEPT, ONDERDEEL_LABEL, ONDERDELEN, type Onderdeel } from '../../shared/verkoopverhaal'
import { schrijfAudit } from './audit'
import { salesdnaBron, type SublaagBericht } from './bronnen/salesdna'
import { gebruikDb, metOrganisatie } from './db'
import { ontsleutel, versleutel } from './geheimen'
import { controleerHandtekening, payloadHash, vingerafdruk } from './salesdnaWebhook'
import { projecteer, sublagen } from './vvProjectie'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]
const fout = (status: number, bericht: string, data?: unknown): never => { throw Object.assign(new Error(bericht), { statusCode: status, statusMessage: bericht, data }) }
const LIJSTEN: Onderdeel[] = ['branches', 'concurrenten', 'winpunten']

export async function koppeling(tx: Tx, org: string) {
  return (await rijen(tx, sql`select * from koppelingen where organisation_id = ${org} and soort = 'salesdna'`))[0] ?? null
}
const bronVan = (k: Rij | null) => salesdnaBron(String(k?.instellingen?.endpoint ?? ''), ontsleutel(k?.geheimen)?.geheim ?? '')

async function logEvent(tx: Tx, org: string, e: { eventId?: string | null; soort: string; onderwerpId?: string | null; versie?: number | null; resultaat: string; fout?: string | null; hash?: string | null; payload?: unknown }) {
  const [r] = await rijen(tx, sql`insert into salesdna_events (organisation_id, event_id, soort, onderwerp_id, versie, resultaat, fout, payload_hash, payload, verwerkt_op)
    values (${org}, ${e.eventId ?? null}, ${e.soort}, ${e.onderwerpId ?? null}, ${e.versie ?? null}, ${e.resultaat}, ${e.fout ?? null}, ${e.hash ?? null}, ${e.payload ? JSON.stringify(e.payload) : null}::jsonb, ${e.resultaat === 'wacht' ? null : new Date().toISOString()}) returning id`)
  return r?.id as number
}

// ── Ontvangen ────────────────────────────────────────────────────────────────

export interface Ontvangst { status: number; resultaat: string; org?: string }
/**
 * De webhook: de organisatie komt uit de koppeling (pad of header), nooit uit de payload. Ongeldige
 * handtekening of tijd: 401 en alleen een geweigerde regel zonder payload. Dubbel: 200 en niets doen.
 * Anders bewaren met resultaat 'wacht'; de verwerking loopt daarna in een job.
 */
export interface Uitvoerder { zoek(koppelingId: string): Promise<Rij | undefined>; inOrg<T>(org: string, werk: (tx: Tx) => Promise<T>): Promise<T> }
const standaard: Uitvoerder = {
  zoek: async (id) => ((await gebruikDb().execute(sql`select * from dealtrace_salesdna_koppeling(${id})`)).rows as Rij[])[0],
  inOrg: (org, werk) => metOrganisatie(org, werk),
}
export async function ontvang(koppelingId: string | null | undefined, rauw: string, headers: { handtekening?: string | null; eventId?: string | null; tijd?: string | null }, nu = new Date(), u: Uitvoerder = standaard): Promise<Ontvangst> {
  if (!koppelingId) return { status: 401, resultaat: 'geen koppeling' }
  const k = await u.zoek(koppelingId)
  if (!k) return { status: 401, resultaat: 'geen koppeling' }
  const org = k.organisation_id as string
  const geheim = ontsleutel(k.geheimen)?.geheim
  const weiger = (reden: string) => u.inOrg(org, (tx) => logEvent(tx, org, { eventId: headers.eventId ?? null, soort: 'onbekend', resultaat: 'geweigerd', fout: reden })).then(() => ({ status: 401, resultaat: 'geweigerd', org }))
  if (k.status === 'uit' || !geheim) return weiger('De koppeling staat uit.')
  if (!controleerHandtekening(rauw, headers.handtekening, geheim)) return weiger('De handtekening klopt niet.')
  if (!binnenTijdvenster(headers.tijd, nu)) return weiger('Het tijdstip wijkt meer dan 5 minuten af.')
  let b: SublaagBericht
  try { b = JSON.parse(rauw) } catch { return weiger('Geen geldige JSON.') }
  if (!b?.eventId || !b?.soort || (headers.eventId && headers.eventId !== b.eventId)) return weiger('Event-id ontbreekt of verschilt van de header.')
  return u.inOrg(org, async (tx) => {
    const dubbel = await rijen(tx, sql`select 1 from salesdna_events where organisation_id = ${org} and event_id = ${b.eventId} and resultaat <> 'dubbel' and resultaat <> 'geweigerd'
      union all select 1 from salesdna_sublaag_versies where organisation_id = ${org} and ${b.soort} = 'sublaag.bevestigd' and onderwerp_id = ${b.onderwerpId ?? ''} and versie = ${b.versie ?? -1} limit 1`)
    if (dubbel.length) {
      await logEvent(tx, org, { eventId: b.eventId, soort: b.soort, onderwerpId: b.onderwerpId, versie: b.versie, resultaat: 'dubbel' })
      return { status: 200, resultaat: 'dubbel', org }
    }
    await logEvent(tx, org, { eventId: b.eventId, soort: b.soort, onderwerpId: b.onderwerpId, versie: b.versie, resultaat: 'wacht', hash: payloadHash(rauw), payload: b })
    await tx.execute(sql`update koppelingen set instellingen = instellingen || ${JSON.stringify({ laatsteEvent: nu.toISOString() })}::jsonb where id = ${koppelingId}`)
    return { status: 202, resultaat: 'wacht', org }
  })
}

/** De job: verwerk wachtende berichten op volgorde van ontvangst. Fouten komen in het logboek, niet bij de afzender. */
export async function verwerkWachtende(org: string, u: Pick<Uitvoerder, 'inOrg'> = standaard) {
  return u.inOrg(org, async (tx) => {
    const wacht = await rijen(tx, sql`select id, payload from salesdna_events where organisation_id = ${org} and resultaat = 'wacht' order by id`)
    for (const e of wacht) {
      try {
        const r = await verwerkBericht(tx, org, e.payload as SublaagBericht)
        await tx.execute(sql`update salesdna_events set resultaat = ${r}, verwerkt_op = now() where id = ${e.id}`)
      } catch (x: any) {
        await tx.execute(sql`update salesdna_events set resultaat = 'fout', fout = ${String(x?.message ?? x).slice(0, 300)}, verwerkt_op = now() where id = ${e.id}`)
      }
    }
    return wacht.length
  })
}

// ── Verwerken en projecteren ─────────────────────────────────────────────────

/** Eén bericht toepassen. Geeft het resultaat voor het logboek. */
export async function verwerkBericht(tx: Tx, org: string, b: SublaagBericht): Promise<string> {
  if (b.soort === 'ping') return 'verwerkt'
  const onderdeel = ONDERWERP_NAAR_ONDERDEEL[b.onderwerpId]
  if (!onderdeel) return 'verwerkt'
  const [spiegel] = await rijen(tx, sql`select * from salesdna_sublagen where organisation_id = ${org} and onderwerp_id = ${b.onderwerpId}`)
  const huidig = spiegel?.status === 'bevestigd' ? Number(spiegel.versie) : 0
  switch (b.soort) {
    case 'sublaag.bevestigd': {
      if (isOud(huidig, b.versie)) return 'oud'
      if (heeftGat(huidig, b.versie)) { await volledigeSync(tx, org, b.onderwerpId, 'gat'); return 'synchronisatie' }
      await spiegelEnProjecteer(tx, org, b)
      return 'verwerkt'
    }
    case 'sublaag.verouderd':
    case 'sublaag.verouderd-gesloten': {
      const aan = b.soort === 'sublaag.verouderd'
      await tx.execute(sql`insert into salesdna_sublagen (organisation_id, onderwerp_id, versie, verouderd, verouderd_door, bijgewerkt_op) values (${org}, ${b.onderwerpId}, ${b.versie ?? 0}, ${aan}, ${aan ? JSON.stringify({ ...(b.verouderdDoor as object ?? {}), reden: b.reden ?? null }) : null}::jsonb, ${b.bijgewerktOp ?? null})
        on conflict (organisation_id, onderwerp_id) do update set verouderd = excluded.verouderd, verouderd_door = excluded.verouderd_door, bijgewerkt_op = coalesce(excluded.bijgewerkt_op, salesdna_sublagen.bijgewerkt_op)`)
      await tx.execute(sql`update vv_sublagen set verouderd = ${aan} where organisation_id = ${org} and onderdeel = ${onderdeel} and bron = 'salesdna'`)
      return 'verwerkt'
    }
    case 'sublaag.leeg':
    case 'sublaag.overgeslagen': {
      const st = b.soort === 'sublaag.leeg' ? 'leeg' : 'overgeslagen'
      await tx.execute(sql`insert into salesdna_sublagen (organisation_id, onderwerp_id, status, versie) values (${org}, ${b.onderwerpId}, ${st}, ${b.versie ?? 0})
        on conflict (organisation_id, onderwerp_id) do update set status = excluded.status, verouderd = false`)
      return 'verwerkt'
    }
  }
  return 'verwerkt'
}

/** Leeg betekent: geen bevestigde eigen versie en geen ingevuld concept. Dan neemt SalesDNA het onderdeel vanzelf over. */
function eigenIsLeeg(s: { versie: number; concept: any; bron: string }) {
  if (s.versie > 0) return false
  return !Object.values(s.concept ?? {}).some((v: any) => (Array.isArray(v) ? v.length : v && (typeof v !== 'object' || Object.keys(v).length)))
}

/** Spiegel bijwerken (ongewijzigd bewaren) en, als SalesDNA de bron is, projecteren. */
export async function spiegelEnProjecteer(tx: Tx, org: string, b: SublaagBericht) {
  await tx.execute(sql`insert into salesdna_sublaag_versies (organisation_id, onderwerp_id, versie, inhoud, context, bevestigd_op, bijgewerkt_op)
    values (${org}, ${b.onderwerpId}, ${b.versie}, ${JSON.stringify(b.inhoud ?? {})}::jsonb, ${JSON.stringify(b.context ?? {})}::jsonb, ${b.bevestigdOp ?? null}, ${b.bijgewerktOp ?? null}) on conflict do nothing`)
  await tx.execute(sql`insert into salesdna_sublagen (organisation_id, onderwerp_id, status, versie, bevestigd_op, bijgewerkt_op, verouderd, inhoud, context, ontvangen_op)
    values (${org}, ${b.onderwerpId}, 'bevestigd', ${b.versie}, ${b.bevestigdOp ?? null}, ${b.bijgewerktOp ?? null}, ${!!b.verouderd}, ${JSON.stringify(b.inhoud ?? {})}::jsonb, ${JSON.stringify(b.context ?? {})}::jsonb, now())
    on conflict (organisation_id, onderwerp_id) do update set status = 'bevestigd', versie = excluded.versie, bevestigd_op = excluded.bevestigd_op, bijgewerkt_op = excluded.bijgewerkt_op,
      verouderd = excluded.verouderd, verouderd_door = case when excluded.verouderd then salesdna_sublagen.verouderd_door else null end, inhoud = excluded.inhoud, context = excluded.context, ontvangen_op = now()`)
  const onderdeel = ONDERWERP_NAAR_ONDERDEEL[b.onderwerpId]!
  const s = (await sublagen(tx, org))[onderdeel]
  if (s.bron !== 'salesdna' && !eigenIsLeeg(s)) return false
  await projecteerSpiegel(tx, org, onderdeel)
  return true
}

/** De laatst bevestigde spiegel als concept, met de eigen aanvullingen uit het huidige concept. */
async function spiegelConcept(tx: Tx, org: string, onderdeel: Onderdeel) {
  const ids = Object.keys(ONDERWERP_NAAR_ONDERDEEL).filter((k) => ONDERWERP_NAAR_ONDERDEEL[k] === onderdeel).join(',')
  const [sp] = await rijen(tx, sql`select * from salesdna_sublagen where organisation_id = ${org} and onderwerp_id = any(string_to_array(${ids}, ',')) and status = 'bevestigd' order by ontvangen_op desc limit 1`)
  if (!sp) return null
  const huidig = (await sublagen(tx, org))[onderdeel].concept
  return { spiegel: sp, concept: spiegelNaarConcept(onderdeel, { inhoud: sp.inhoud, context: sp.context }, huidig) }
}

async function projecteerSpiegel(tx: Tx, org: string, onderdeel: Onderdeel) {
  const sc = await spiegelConcept(tx, org, onderdeel)
  if (!sc) return
  const oud = (await sublagen(tx, org))[onderdeel].concept
  await tx.execute(sql`insert into vv_sublagen (organisation_id, onderdeel, bron, status, versie, bevestigd_op, verouderd, controleren, concept, bijgewerkt_op)
    values (${org}, ${onderdeel}, 'salesdna', 'bevestigd', ${sc.spiegel.versie}, ${sc.spiegel.bevestigd_op ?? new Date().toISOString()}, ${!!sc.spiegel.verouderd}, false, ${JSON.stringify(sc.concept)}::jsonb, now())
    on conflict (organisation_id, onderdeel) do update set bron = 'salesdna', status = 'bevestigd', versie = excluded.versie, bevestigd_op = excluded.bevestigd_op, verouderd = excluded.verouderd,
      controleren = false, concept = excluded.concept, bijgewerkt_op = now()`)
  await projecteer(tx, org, onderdeel, sc.concept, sc.spiegel.versie, 'salesdna')
  await takenVoorNieuw(tx, org, onderdeel, oud, sc.concept)
}

/** Een nieuwe branche zonder SBI-koppeling of een nieuwe fase zonder hoofdfase: een taak voor de beheerder. */
async function takenVoorNieuw(tx: Tx, org: string, onderdeel: Onderdeel, oud: any, nieuw: any) {
  const titels: string[] = []
  if (onderdeel === 'branches') {
    const mapping = await rijen(tx, sql`select branche_id from vv_branche_mapping where organisation_id = ${org} and cardinality(sbi_codes) > 0`)
    for (const b of nieuweIds(oud?.items ?? [], nieuw.items ?? [])) if (!mapping.some((m) => m.branche_id === b.id)) titels.push(`Nieuwe branche ${(b as any).naam} heeft nog geen SBI-koppeling.`)
  }
  if (onderdeel === 'winpunten') {
    for (const f of nieuw.fasen ?? []) if (!f.reisHoofdfase) titels.push(`Fase ${f.naam} uit SalesDNA is nog niet gekoppeld aan een fase van de reis.`)
  }
  if (!titels.length) return
  const [beheerder] = await rijen(tx, sql`select id from users where organisation_id = ${org} and role = 'beheerder' and coalesce(status, 'actief') <> 'gearchiveerd' order by id limit 1`)
  for (const t of titels) {
    const [er] = await rijen(tx, sql`select 1 from tasks where organisation_id = ${org} and title = ${t} and status = 'open'`)
    if (er) continue
    await tx.execute(sql`insert into tasks (id, organisation_id, owner_id, action_type, title, status, priority, due_date, executor, data)
      values (${crypto.randomUUID()}, ${org}, ${beheerder?.id ?? null}, 'taak', ${t}, 'open', 'middel', now(), 'mens', ${JSON.stringify({ herkomst: { bron: 'salesdna' }, link: '/instellingen/verkoopverhaal' })}::jsonb)`)
  }
}

// ── Volledige synchronisatie ─────────────────────────────────────────────────

/** Haalt per sublaag de laatst bevestigde versie op en past toe. 409 als er al een run loopt. */
export async function volledigeSync(tx: Tx, org: string, onderwerpId?: string | null, aanleiding = 'verzoek') {
  const k = await koppeling(tx, org)
  if (!k || k.status === 'uit') fout(409, 'SalesDNA is niet gekoppeld')
  const [loopt] = await rijen(tx, sql`select id from koppeling_runs where organisation_id = ${org} and soort = 'salesdna' and eind is null and start > now() - interval '10 minutes'`)
  if (loopt) fout(409, 'Er loopt al een synchronisatie')
  const [run] = await rijen(tx, sql`insert into koppeling_runs (organisation_id, koppeling_id, soort, handeling) values (${org}, ${k!.id}, 'salesdna', ${`volledig:${aanleiding}${onderwerpId ? `:${onderwerpId}` : ''}`}) returning id`)
  let gelezen = 0
  let geschreven = 0
  const fouten: string[] = []
  try {
    const bron = bronVan(k)
    const lijst = onderwerpId ? [await bron.haalSublaag(onderwerpId)].filter(Boolean) as SublaagBericht[] : await bron.haalSublagen()
    for (const b of lijst) {
      gelezen++
      if (!ONDERWERP_NAAR_ONDERDEEL[b.onderwerpId]) continue
      const [sp] = await rijen(tx, sql`select versie, status from salesdna_sublagen where organisation_id = ${org} and onderwerp_id = ${b.onderwerpId}`)
      const isBevestigd = (b.status ?? 'bevestigd') === 'bevestigd' && b.inhoud
      if (!isBevestigd) { await verwerkBericht(tx, org, { ...b, soort: b.status === 'leeg' ? 'sublaag.leeg' : 'sublaag.overgeslagen' }); continue }
      if (sp?.status === 'bevestigd' && Number(sp.versie) >= b.versie) {
        if (b.verouderd !== undefined) await verwerkBericht(tx, org, { ...b, soort: b.verouderd ? 'sublaag.verouderd' : 'sublaag.verouderd-gesloten' })
        continue
      }
      await spiegelEnProjecteer(tx, org, { ...b, soort: 'sublaag.bevestigd' })
      await logEvent(tx, org, { eventId: b.eventId ? `${b.eventId}:sync` : null, soort: 'sublaag.bevestigd', onderwerpId: b.onderwerpId, versie: b.versie, resultaat: 'synchronisatie' })
      geschreven++
    }
  } catch (e: any) { fouten.push(String(e?.message ?? e)) }
  await tx.execute(sql`update koppeling_runs set eind = now(), gelezen = ${gelezen}, geschreven = ${geschreven}, fouten = ${JSON.stringify(fouten)}::jsonb where id = ${run!.id}`)
  if (!onderwerpId) await tx.execute(sql`update koppelingen set instellingen = instellingen || ${JSON.stringify({ laatsteVolledigeSync: new Date().toISOString() })}::jsonb, status = ${fouten.length ? 'fout' : 'actief'} where id = ${k!.id}`)
  return { runId: run!.id as string, gelezen, geschreven, fouten }
}

// ── Koppelen, bron kiezen, vergelijken, ontkoppelen ──────────────────────────

export async function koppel(tx: Tx, org: string, endpoint: string, geheim: string | null, door: string) {
  const bestaand = await koppeling(tx, org)
  const sleutel = geheim || ontsleutel(bestaand?.geheimen)?.geheim
  if (!endpoint.trim() || !sleutel) fout(400, 'Vul het adres en het geheim in')
  const p = await salesdnaBron(endpoint, sleutel!).ping()
  if (!p.ok) fout(400, p.reden)
  const inst = { ...(bestaand?.instellingen ?? {}), endpoint: endpoint.trim(), vingerafdruk: vingerafdruk(sleutel!), gekoppeldOp: new Date().toISOString() }
  await tx.execute(sql`insert into koppelingen (organisation_id, soort, status, geheimen, instellingen, getest_op, updated_at) values (${org}, 'salesdna', 'actief', ${versleutel({ geheim: sleutel! })}, ${JSON.stringify(inst)}::jsonb, now(), now())
    on conflict (organisation_id, soort) do update set status = 'actief', geheimen = excluded.geheimen, instellingen = excluded.instellingen, getest_op = now(), updated_at = now()`)
  await schrijfAudit(tx, { organisationId: org, actorId: door, action: 'salesdna.koppel', resourceType: 'koppelingen', resourceId: 'salesdna', changes: { endpoint: inst.endpoint, vingerafdruk: inst.vingerafdruk } })
  return volledigeSync(tx, org, null, 'koppelen')
}

/** Vergelijken: eigen concept naast de spiegel, met de controlelijst van verwijzingen. */
export async function vergelijk(tx: Tx, org: string, onderdeel: Onderdeel) {
  const s = (await sublagen(tx, org))[onderdeel]
  const sc = await spiegelConcept(tx, org, onderdeel)
  const eigen = s.bron === 'eigen' ? s.concept : (await laatsteEigen(tx, org, onderdeel)) ?? LEEG_CONCEPT[onderdeel]
  let controlelijst: (Koppelregel & { accounts: number })[] = []
  if (sc && LIJSTEN.includes(onderdeel)) {
    const regels = mapOpNaam((eigen.items ?? []).map((x: any) => ({ id: x.id, naam: x.naam ?? x.titel })), (sc.concept as any).items.map((x: any) => ({ id: x.id, naam: x.naam ?? x.titel })))
    const kolom = onderdeel === 'branches' ? sql`vv_branche_id` : onderdeel === 'concurrenten' ? sql`huidige_leverancier_id` : null
    const telling = kolom ? await rijen(tx, sql`select ${kolom} as id, count(*)::int n from accounts where organisation_id = ${org} and ${kolom} is not null group by 1`) : []
    controlelijst = regels.map((r) => ({ ...r, accounts: telling.find((t) => t.id === r.eigenId)?.n ?? 0 }))
  }
  return {
    onderdeel, label: ONDERDEEL_LABEL[onderdeel], bron: s.bron, eigen, salesdna: sc?.concept ?? null,
    spiegel: sc ? { versie: sc.spiegel.versie, verouderd: sc.spiegel.verouderd, bijgewerktOp: sc.spiegel.bijgewerkt_op } : null,
    controlelijst,
  }
}
async function laatsteEigen(tx: Tx, org: string, onderdeel: Onderdeel) {
  return (await rijen(tx, sql`select inhoud from vv_versies where organisation_id = ${org} and onderdeel = ${onderdeel} and herkomst = 'eigen' order by versie desc limit 1`))[0]?.inhoud ?? null
}
const volgendeVersie = async (tx: Tx, org: string, onderdeel: Onderdeel) => Number((await rijen(tx, sql`select coalesce(max(versie), 0)::int v from vv_versies where organisation_id = ${org} and onderdeel = ${onderdeel}`))[0]?.v ?? 0) + 1

/** Eigen naar SalesDNA: archief van de eigen inhoud, verwijzingen via de bevestigde naammapping, dan projecteren. */
export async function wordSalesdna(tx: Tx, org: string, onderdeel: Onderdeel, opties: { controlelijstBevestigd?: boolean; mapping?: Record<string, string | null> }, door: string) {
  const s = (await sublagen(tx, org))[onderdeel]
  if (s.bron === 'salesdna') return { onderdeel, bron: 'salesdna' }
  const v = await vergelijk(tx, org, onderdeel)
  if (!v.salesdna) fout(409, `${ONDERDEEL_LABEL[onderdeel]} is in SalesDNA nog leeg; dit onderdeel blijft eigen`)
  if (!opties.controlelijstBevestigd) fout(422, 'Bevestig eerst de controlelijst')
  if (!eigenIsLeeg(s)) await tx.execute(sql`insert into vv_versies (organisation_id, onderdeel, versie, inhoud, door, status, herkomst) values (${org}, ${onderdeel}, ${await volgendeVersie(tx, org, onderdeel)}, ${JSON.stringify(s.concept)}::jsonb, ${door}, 'gearchiveerd', 'eigen')`)
  const mapping = new Map(v.controlelijst.map((r) => [r.eigenId, opties.mapping && r.eigenId in opties.mapping ? opties.mapping[r.eigenId] : r.salesdnaId]))
  for (const [eigenId, sdId] of mapping) {
    if (!sdId || sdId === eigenId) continue
    if (onderdeel === 'branches') {
      await tx.execute(sql`update accounts set vv_branche_id = ${sdId} where organisation_id = ${org} and vv_branche_id = ${eigenId}`)
      await tx.execute(sql`update vv_branche_mapping set branche_id = ${sdId} where organisation_id = ${org} and branche_id = ${eigenId} and not exists (select 1 from vv_branche_mapping m where m.organisation_id = ${org} and m.branche_id = ${sdId})`)
    }
    if (onderdeel === 'concurrenten') await tx.execute(sql`update accounts set huidige_leverancier_id = ${sdId} where organisation_id = ${org} and huidige_leverancier_id = ${eigenId}`)
  }
  await tx.execute(sql`update vv_sublagen set bron = 'salesdna' where organisation_id = ${org} and onderdeel = ${onderdeel}`)
  await projecteerSpiegel(tx, org, onderdeel)
  await schrijfAudit(tx, { organisationId: org, actorId: door, action: 'salesdna.bron', resourceType: 'vv_sublagen', resourceId: onderdeel, changes: { bron: 'salesdna', mapping: Object.fromEntries(mapping) } })
  return { onderdeel, bron: 'salesdna' }
}

/** SalesDNA naar eigen: de laatst bevestigde spiegel wordt de eigen inrichting (herkomst salesdna), bevestigd en bewerkbaar. */
export async function wordEigen(tx: Tx, org: string, onderdeel: Onderdeel, door: string) {
  const s = (await sublagen(tx, org))[onderdeel]
  if (s.bron !== 'salesdna') return { onderdeel, bron: 'eigen' }
  const versie = await volgendeVersie(tx, org, onderdeel)
  await tx.execute(sql`insert into vv_versies (organisation_id, onderdeel, versie, inhoud, door, status, herkomst) values (${org}, ${onderdeel}, ${versie}, ${JSON.stringify(s.concept)}::jsonb, ${door}, 'bevestigd', 'salesdna')`)
  await tx.execute(sql`update vv_sublagen set bron = 'eigen', herkomst = 'salesdna', status = 'bevestigd', versie = ${versie}, verouderd = false, bevestigd_op = now(), bevestigd_door = ${door}, bijgewerkt_op = now() where organisation_id = ${org} and onderdeel = ${onderdeel}`)
  await projecteer(tx, org, onderdeel, s.concept, versie, 'eigen')
  await schrijfAudit(tx, { organisationId: org, actorId: door, action: 'salesdna.bron', resourceType: 'vv_sublagen', resourceId: onderdeel, changes: { bron: 'eigen', versie } })
  return { onderdeel, bron: 'eigen' }
}

export async function ontkoppel(tx: Tx, org: string, door: string) {
  const s = await sublagen(tx, org)
  for (const o of ONDERDELEN) if (s[o].bron === 'salesdna') await wordEigen(tx, org, o, door)
  await tx.execute(sql`update koppelingen set status = 'uit', geheimen = null, instellingen = instellingen - 'vingerafdruk', updated_at = now() where organisation_id = ${org} and soort = 'salesdna'`)
  await schrijfAudit(tx, { organisationId: org, actorId: door, action: 'salesdna.ontkoppel', resourceType: 'koppelingen', resourceId: 'salesdna', changes: {} })
}

/** Status voor de beheerder: koppeling (zonder geheim), onderdelen met bron en spiegel, logboek. */
export async function status(tx: Tx, org: string) {
  const k = await koppeling(tx, org)
  const s = await sublagen(tx, org)
  const spiegel = await rijen(tx, sql`select onderwerp_id, status, versie, verouderd, bijgewerkt_op from salesdna_sublagen where organisation_id = ${org}`)
  const log = await rijen(tx, sql`select id, event_id, soort, onderwerp_id, versie, ontvangen_op, resultaat, fout from salesdna_events where organisation_id = ${org} order by id desc limit 50`)
  const [run] = await rijen(tx, sql`select start, eind, gelezen, geschreven, fouten from koppeling_runs where organisation_id = ${org} and soort = 'salesdna' order by start desc limit 1`)
  return {
    gekoppeld: k?.status === 'actief' || k?.status === 'fout',
    koppeling: k ? { id: k.id, status: k.status, endpoint: k.instellingen?.endpoint ?? null, vingerafdruk: k.instellingen?.vingerafdruk ?? null, laatsteEvent: k.instellingen?.laatsteEvent ?? null, laatsteVolledigeSync: k.instellingen?.laatsteVolledigeSync ?? null } : null,
    laatsteRun: run ? { start: run.start, eind: run.eind, gelezen: run.gelezen, geschreven: run.geschreven, fouten: run.fouten } : null,
    onderdelen: ONDERDELEN.map((o) => {
      const sp = spiegel.find((x) => ONDERWERP_NAAR_ONDERDEEL[x.onderwerp_id] === o)
      return { onderdeel: o, label: ONDERDEEL_LABEL[o], onderwerpId: ONDERDEEL_NAAR_ONDERWERP[o], plek: PLEK_IN_SALESDNA[o], bron: s[o].bron, status: s[o].status, versie: s[o].versie,
        spiegel: sp ? { status: sp.status, versie: sp.versie, verouderd: sp.verouderd, bijgewerktOp: sp.bijgewerkt_op } : null }
    }),
    logboek: log.map((e) => ({ id: String(e.id), eventId: e.event_id, soort: e.soort, onderwerpId: e.onderwerp_id, versie: e.versie, op: e.ontvangen_op, resultaat: e.resultaat, fout: e.fout })),
  }
}
