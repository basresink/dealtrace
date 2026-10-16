// De DealDrive-koppeling per organisatie (P23): inrichting en stand, ontdubbelen met een cache van
// 24 uur, de webhook-ontvanger voor terugmeldingen (handtekening eerst, elk gebeurtenisId hooguit één
// keer, verwerken in een job), de stand-opvraag als overdracht.verwerkt uitblijft, en Test verbinding.
// De organisatie van een terugmelding komt uit de koppeling en de handtekening, nooit uit de body.
import { sql } from 'drizzle-orm'
import { controleerHandtekening, controleerTerugmelding, FOUT_STATUS, foutNaarMelding, verwerkTerugmelding, type FoutCode, type Terugmelding } from '../../shared/dealdrive'
import { normaliseerDomein, normaliseerNaam } from '../../shared/ontdubbelen'
import { koppelingVoor, type DealDriveConfig, type DealDriveKoppeling, type DealDriveStand, type DealDriveTreffer, type ZoekVraag } from './dealdriveAdapter'
import { gebruikDb, metOrganisatie } from './db'
import { ontsleutel } from './geheimen'
import { verwerkTerugkomst } from './planning'
import { vingerafdruk, payloadHash } from './salesdnaWebhook'
import { leesStand } from './vvProjectie'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]
const DAG = 864e5

/** De stand (uit, mock of http) en de inrichting. Zonder rij of met status uit: uit. "aan" is http. */
export async function dealdriveInrichting(tx: Tx): Promise<{ stand: DealDriveStand; cfg: DealDriveConfig | null; instellingen: Rij; geheimVingerafdruk: string | null; getestOp: string | null }> {
  const [k] = await rijen(tx, sql`select status, geheimen, instellingen, getest_op from koppelingen where soort = 'dealdrive'`)
  const ruw = String(k?.instellingen?.stand ?? '')
  const stand: DealDriveStand = k?.status === 'actief' ? (ruw === 'mock' ? 'mock' : ruw === 'http' || ruw === 'aan' ? 'http' : 'uit') : 'uit'
  const geheim = ontsleutel(k?.geheimen, 'dealdrive')?.geheim ?? null
  const i = k?.instellingen ?? {}
  const cfg = i.basisUrl && i.organisatieId && geheim ? { basisUrl: String(i.basisUrl), organisatieId: String(i.organisatieId), geheim } : null
  return { stand, cfg, instellingen: i, geheimVingerafdruk: geheim ? vingerafdruk(geheim) : null, getestOp: k?.getest_op ? new Date(k.getest_op).toISOString() : null }
}

/** De adapter voor deze organisatie, of null bij de stand uit. */
export async function dealdriveKoppeling(tx: Tx): Promise<DealDriveKoppeling | null> {
  const { stand, cfg } = await dealdriveInrichting(tx)
  if (stand === 'uit') return null
  const klanten = stand === 'mock' ? (await rijen(tx, sql`select name as naam, kvk from accounts where account_kind = 'klant'`)).map((r) => ({ naam: r.naam, kvk: r.kvk })) : []
  return koppelingVoor(stand, klanten, cfg)
}

/** Ontdubbelen tegen DealDrive (hoofdstuk 4): KvK, domein en naam; 24 uur in de cache per sleutel. Null bij de stand uit. */
export async function zoekInDealdrive(tx: Tx, q: ZoekVraag, nu = new Date()): Promise<DealDriveTreffer[] | null> {
  if (!q.kvk && !q.domein && !q.naam) return []
  const k = await dealdriveKoppeling(tx)
  if (!k?.zoekAccount) return null
  const sleutel = `${q.kvk ?? ''}|${normaliseerDomein(q.domein) ?? ''}|${q.naam ? normaliseerNaam(q.naam) : ''}`
  const [c] = await rijen(tx, sql`select antwoord from dealdrive_zoekcache where sleutel = ${sleutel} and verloopt_op > ${nu.toISOString()}`)
  if (c) return c.antwoord as DealDriveTreffer[]
  const treffers = await k.zoekAccount({ kvk: q.kvk ?? null, domein: normaliseerDomein(q.domein) ?? null, naam: q.naam ?? null })
  await tx.execute(sql`insert into dealdrive_zoekcache (organisation_id, sleutel, antwoord, verloopt_op) values (current_org_id(), ${sleutel}, ${JSON.stringify(treffers)}::jsonb, ${new Date(nu.getTime() + DAG).toISOString()})
    on conflict (organisation_id, sleutel) do update set antwoord = excluded.antwoord, verloopt_op = excluded.verloopt_op`)
  return treffers
}

// ── Webhook-ontvanger (hoofdstuk 5) ─────────────────────────────────────────

export interface DealdriveOntvangst { status: number; body: Record<string, unknown>; org?: string }
const weiger = (code: FoutCode, velden?: string[]): DealdriveOntvangst => ({ status: FOUT_STATUS[code], body: { fout: { code, bericht: foutNaarMelding(code, velden), ...(velden?.length ? { velden } : {}) } } })

/** Zoekt de koppeling op zonder sessie (security definer); geeft organisatie, status, stand en geheim. */
async function zoekKoppeling(org: string) {
  const [k] = (await gebruikDb().execute(sql`select * from dealtrace_dealdrive_koppeling(${org})`)).rows as Rij[]
  return k ?? null
}
/** Uitvoerder (te vervangen in tests): de koppeling opzoeken en werk binnen één organisatie. */
export interface DealdriveUitvoerder { zoek: (org: string) => Promise<Rij | null>; inOrg: <T>(org: string, werk: (tx: Tx) => Promise<T>) => Promise<T> }
const standaard: DealdriveUitvoerder = { zoek: zoekKoppeling, inOrg: (org, werk) => metOrganisatie(org, werk) }

/** Ontvangen: handtekening en tijd eerst, dan de vorm, dan het account (binnen de organisatie, met RLS). Antwoordt meteen. */
export async function ontvangTerugmelding(orgHeader: string | null | undefined, rauw: string, headers: { handtekening?: string | null; tijd?: string | null }, nu = new Date(), u: DealdriveUitvoerder = standaard): Promise<DealdriveOntvangst> {
  if (!orgHeader) return weiger('organisatie_onbekend')
  const k = await u.zoek(orgHeader)
  if (!k) return weiger('organisatie_onbekend')
  const geheim = ontsleutel(k.geheimen, 'dealdrive')?.geheim ?? null
  // Eerst de handtekening: zonder geldige handtekening zegt het antwoord niets over de stand.
  const h = controleerHandtekening(headers, rauw, geheim, nu)
  if (!h.geldig) return weiger(h.fout)
  if (k.status !== 'actief' || !['mock', 'http', 'aan'].includes(k.stand ?? '')) return weiger('koppeling_uit')
  let b: Terugmelding
  try { b = JSON.parse(rauw) } catch { return weiger('ongeldige_invoer', ['body']) }
  const velden = controleerTerugmelding(b)
  if (velden.length) return weiger('ongeldige_invoer', velden)
  const org = k.organisation_id as string
  return u.inOrg(org, async (tx) => {
    const [al] = await rijen(tx, sql`select resultaat from dealdrive_gebeurtenissen where gebeurtenis_id = ${b.gebeurtenisId}`)
    if (al) return { status: 200, body: { status: 'al verwerkt' }, org }
    if (b.soort !== 'ping') {
      const [a] = await rijen(tx, sql`select id from accounts where id = ${b.dealtraceAccountId ?? ''}`)
      if (!a) return weiger('account_onbekend')
    }
    const gegevens = b.soort === 'ping' ? null : { op: b.op, dealdriveAccountId: b.dealdriveAccountId ?? null, gegevens: b.gegevens ?? {} }
    await tx.execute(sql`insert into dealdrive_gebeurtenissen (organisation_id, gebeurtenis_id, soort, account_id, hash, gegevens, ontvangen_op, resultaat, verwerkt_op)
      values (${org}, ${b.gebeurtenisId}, ${b.soort}, ${b.dealtraceAccountId ?? null}, ${payloadHash(rauw).slice(0, 16)}, ${gegevens ? JSON.stringify(gegevens) : null}::jsonb, ${nu.toISOString()}, ${b.soort === 'ping' ? 'verwerkt' : 'wacht'}, ${b.soort === 'ping' ? nu.toISOString() : null})
      on conflict (organisation_id, gebeurtenis_id) do nothing`)
    await tx.execute(sql`update koppelingen set instellingen = instellingen || ${JSON.stringify({ laatsteTerugmelding: nu.toISOString() })}::jsonb where soort = 'dealdrive'`)
    return { status: 202, body: { status: 'ontvangen' }, org }
  })
}

/** GET /ping van DealDrive: dezelfde handtekening over een lege body. */
export async function ontvangPing(orgHeader: string | null | undefined, headers: { handtekening?: string | null; tijd?: string | null }, nu = new Date(), u: DealdriveUitvoerder = standaard): Promise<DealdriveOntvangst> {
  if (!orgHeader) return weiger('organisatie_onbekend')
  const k = await u.zoek(orgHeader)
  if (!k) return weiger('organisatie_onbekend')
  const h = controleerHandtekening(headers, '', ontsleutel(k.geheimen, 'dealdrive')?.geheim ?? null, nu)
  if (!h.geldig) return weiger(h.fout)
  if (k.status !== 'actief' || !['mock', 'http', 'aan'].includes(k.stand ?? '')) return weiger('koppeling_uit')
  return { status: 200, body: { status: 'ok', versie: 'v1' } }
}

/** De job: wachtende terugmeldingen verwerken. Elke in een eigen savepoint; een fout blokkeert de rest niet. Daarna gaan de gegevens weg. */
export async function verwerkTerugmeldingen(tx: Tx, org: string, nu = new Date()): Promise<number> {
  const wacht = await rijen(tx, sql`select * from dealdrive_gebeurtenissen where resultaat = 'wacht' order by ontvangen_op limit 100`)
  if (!wacht.length) return 0
  const stand = await leesStand(tx)
  let n = 0
  for (const e of wacht) {
    try {
      await tx.transaction(async (sp) => {
        const g: Terugmelding = { gebeurtenisId: e.gebeurtenis_id, soort: e.soort, op: e.gegevens?.op ?? nu.toISOString(), dealtraceAccountId: e.account_id, dealdriveAccountId: e.gegevens?.dealdriveAccountId ?? undefined, gegevens: e.gegevens?.gegevens ?? {} }
        await pasToe(sp as unknown as Tx, org, g, verwerkTerugmelding(g, stand), nu)
        await sp.execute(sql`update dealdrive_gebeurtenissen set resultaat = 'verwerkt', verwerkt_op = ${nu.toISOString()}, gegevens = null where id = ${e.id}`)
      })
      n++
    } catch (x: any) {
      await tx.execute(sql`update dealdrive_gebeurtenissen set resultaat = 'fout', fout = ${String(x?.message ?? x).slice(0, 300)}, verwerkt_op = ${nu.toISOString()}, gegevens = null where id = ${e.id}`)
    }
  }
  return n
}

const extern = (o: Record<string, unknown>) => sql`jsonb_set(coalesce(data, '{}'::jsonb), '{extern}', coalesce(data->'extern', '{}'::jsonb) || jsonb_build_object('dealdrive', coalesce(data->'extern'->'dealdrive', '{}'::jsonb) || ${JSON.stringify(o)}::jsonb))`

async function pasToe(tx: Tx, org: string, g: Terugmelding, actie: ReturnType<typeof verwerkTerugmelding>, nu: Date) {
  const accountId = g.dealtraceAccountId!
  const [a] = await rijen(tx, sql`select id, name, owner_id from accounts where id = ${accountId}`)
  if (!a) throw new Error('Account onbekend')
  switch (actie.soort) {
    case 'overdracht-bevestigd': {
      await tx.execute(sql`update overdrachten set status = 'bevestigd', extern_id = coalesce(extern_id, ${g.dealdriveAccountId ?? null}), data = data || ${JSON.stringify({ bevestigdOp: nu.toISOString() })}::jsonb
        where account_id = ${accountId} and naar = 'dealdrive' and status in ('klaar', 'verstuurd') and (${actie.overdrachtId}::text is null or id = ${actie.overdrachtId})`)
      await tx.execute(sql`update accounts set data = ${extern({ bevestigdOp: nu.toISOString() })} where id = ${accountId}`)
      return
    }
    case 'gewonnen': {
      // Het account blijft overgedragen; Dealtrace maakt geen klant, deal of offerte (B17).
      await tx.execute(sql`update overdrachten set data = data || ${JSON.stringify({ gewonnen: { op: actie.op, dealId: actie.dealId, waarde: actie.waarde } })}::jsonb where account_id = ${accountId} and naar = 'dealdrive' and status <> 'mislukt'`)
      await tx.execute(sql`update accounts set data = ${extern({ gewonnenOp: actie.op, bewijsVraag: 'open' })} where id = ${accountId}`)
      const [ov] = await rijen(tx, sql`select door from overdrachten where account_id = ${accountId} and naar = 'dealdrive' order by op desc limit 1`)
      const wie = ov?.door ?? a.owner_id
      if (wie) await tx.execute(sql`insert into notificaties (id, organisation_id, gebruiker_id, soort, titel, tekst, link, op, data) values (${crypto.randomUUID()}, ${org}, ${wie}, 'hot', ${`Gewonnen in DealDrive: ${a.name}`}, 'De deal na jouw overdracht is gewonnen. Mag dit een bewijs worden?', ${`/accounts/${accountId}?bewijs=1`}, ${nu.toISOString()}, ${JSON.stringify({ vraag: 'bewijs', accountId })}::jsonb)`)
      return
    }
    case 'winback':
    case 'herwin': {
      const v = await verwerkTerugkomst(tx, org, accountId, { bronSoort: actie.bronSoort, reden: actie.reden }, nu)
      const sleutel = actie.soort === 'winback' ? 'winback' : 'herwin'
      const waarde = actie.soort === 'winback'
        ? { bron: 'dealdrive', reden: actie.reden, verlorenAan: actie.verlorenAan, regelId: v.regel?.id ?? null, datum: v.datum, kanaal: v.kanaal, rol: v.regel?.rollen?.[0] ?? null, sinds: nu.toISOString() }
        : { bron: 'dealdrive', reden: actie.reden, maanden: actie.maanden, laatsteOrder: actie.laatsteOrder, regelId: v.regel?.id ?? null, datum: v.datum, kanaal: v.kanaal, rol: v.regel?.rollen?.[0] ?? null, sinds: nu.toISOString() }
      await tx.execute(sql`update accounts set data = data || ${JSON.stringify({ [sleutel]: waarde })}::jsonb where id = ${accountId}`)
      return
    }
    case 'eigenaar':
      await tx.execute(sql`update accounts set data = ${extern({ eigenaar: actie.eigenaar })} where id = ${accountId}`)
  }
}

/** Blijft overdracht.verwerkt uit, dan vraagt deze job de stand op (GET /overdrachten/{id}) na 30 minuten. */
export async function vraagStandOp(tx: Tx, nu = new Date(), koppeling?: DealDriveKoppeling | null): Promise<number> {
  const k = koppeling !== undefined ? koppeling : await dealdriveKoppeling(tx)
  if (!k?.status) return 0
  const lijst = await rijen(tx, sql`select id, account_id from overdrachten where naar = 'dealdrive' and status = 'verstuurd' and coalesce((data->>'verstuurdOp')::timestamptz, op) < ${new Date(nu.getTime() - 30 * 60_000).toISOString()}
    and coalesce((data->>'standGevraagdOp')::timestamptz, 'epoch') < ${new Date(nu.getTime() - 3600_000).toISOString()} limit 20`)
  let n = 0
  for (const o of lijst) {
    let s: Awaited<ReturnType<NonNullable<DealDriveKoppeling['status']>>>
    try { s = await k.status(o.id) } catch { continue }
    await tx.execute(sql`update overdrachten set data = data || ${JSON.stringify({ standGevraagdOp: nu.toISOString() })}::jsonb where id = ${o.id}`)
    if (s.gevonden && ['ontvangen', 'samengevoegd'].includes(s.status)) {
      await tx.execute(sql`update overdrachten set status = 'bevestigd', extern_id = coalesce(${s.accountId}, extern_id), data = data || ${JSON.stringify({ bevestigdOp: nu.toISOString(), bevestigdVia: 'stand' })}::jsonb where id = ${o.id}`)
      n++
    }
  }
  return n
}

/** Test verbinding (GET /ping) met een regel in het logboek. */
export async function testDealdrive(tx: Tx, org: string, nu = new Date()): Promise<{ ok: boolean; melding: string }> {
  const { stand } = await dealdriveInrichting(tx)
  if (stand === 'uit') return { ok: false, melding: 'De koppeling staat uit. Nog niet beschikbaar: DealDrive bouwt de ontvangende kant.' }
  const k = await dealdriveKoppeling(tx)
  const r = k?.ping ? await k.ping() : { ok: false as const, melding: 'Deze koppeling kan niet getest worden.' }
  await tx.execute(sql`insert into koppeling_runs (organisation_id, soort, handeling, start, eind, gelezen, fouten) values (${org}, 'dealdrive', 'ping', ${nu.toISOString()}, now(), ${r.ok ? 1 : 0}, ${JSON.stringify(r.ok ? [] : [r.melding])}::jsonb)`)
  if (r.ok) await tx.execute(sql`update koppelingen set getest_op = ${nu.toISOString()} where soort = 'dealdrive'`)
  return r.ok ? { ok: true, melding: stand === 'mock' ? 'De mock van DealDrive antwoordt.' : 'DealDrive antwoordt. De koppeling werkt.' } : { ok: false, melding: r.melding }
}

/** De stand voor de koppelingenpagina: nooit het geheim, alleen de vingerafdruk. */
export async function dealdriveStatus(tx: Tx) {
  const i = await dealdriveInrichting(tx)
  const [laatste] = await rijen(tx, sql`select o.op, o.status, a.name from overdrachten o join accounts a on a.id = o.account_id where o.naar = 'dealdrive' order by o.op desc limit 1`)
  const mislukt = await rijen(tx, sql`select o.id, o.account_id, a.name, o.laatste_fout, o.op, o.pogingen from overdrachten o join accounts a on a.id = o.account_id where o.naar = 'dealdrive' and o.status = 'mislukt' order by o.op desc limit 20`)
  const telling = await rijen(tx, sql`select status, count(*)::int as n from overdrachten where naar = 'dealdrive' group by status`)
  const runs = await rijen(tx, sql`select handeling, start, eind, gelezen, geschreven, fouten from koppeling_runs where soort = 'dealdrive' order by start desc limit 10`)
  const gebeurtenissen = await rijen(tx, sql`select soort, resultaat, ontvangen_op from dealdrive_gebeurtenissen order by ontvangen_op desc limit 10`)
  return {
    stand: i.stand, ingericht: !!i.cfg, basisUrl: i.instellingen.basisUrl ?? null, organisatieId: i.instellingen.organisatieId ?? null, geheimVingerafdruk: i.geheimVingerafdruk, getestOp: i.getestOp,
    laatste: laatste ? { op: new Date(laatste.op).toISOString(), status: laatste.status, account: laatste.name } : null,
    telling: Object.fromEntries(telling.map((r) => [r.status, r.n])),
    mislukt: mislukt.map((m) => ({ id: m.id, accountId: m.account_id, account: m.name, melding: m.laatste_fout, op: new Date(m.op).toISOString(), pogingen: m.pogingen })),
    runs: runs.map((r) => ({ handeling: r.handeling, start: new Date(r.start).toISOString(), ok: !(r.fouten ?? []).length, fout: (r.fouten ?? [])[0] ?? null })),
    gebeurtenissen: gebeurtenissen.map((g) => ({ soort: g.soort, resultaat: g.resultaat, op: new Date(g.ontvangen_op).toISOString() })),
  }
}

