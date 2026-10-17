// CRM-koppeling (P20, F02, hoofdstuk 12). Eén adapterlaag (eerst HubSpot), tokens versleuteld per
// organisatie, elke run in koppeling_runs. Lezen: bedrijven en contacten naar crm_records (ontdubbelen,
// klantprofiel, bron CRM); klanten worden een klant-account. Schrijven alleen met de richting
// Schrijven of Beide: overgenomen leads, contactpersonen, uitkomsten en de overdracht. Elk record
// krijgt zijn extern id, zodat een tweede run niets dubbel maakt. Deals maakt het CRM zelf (B17).
import { sql } from 'drizzle-orm'
import {
  CRM_SOORTEN, crmNaarLead, eigenaarVoor, isSlapend, losConflictOp, magLezen, magSchrijven, overdrachtNaarCrm, pasToewijzingToe, RICHTING_STANDAARD, schrijfplan,
  TOEWIJZING_STANDAARD, type CrmBedrijf, type CrmContact, type CrmGebeurtenis, type CrmObject, type CrmSoort, type Richting, type Toewijzing,
} from '../../shared/crm'
import { volgendePoging } from '../../shared/funnel'
import { berichtKanaalLabel } from '../../shared/taken'
import type { LeadFeiten } from '../../shared/leadGenerator'
import { normaliseerDomein, zoekDuplicaat, type AccountKandidaat } from '../../shared/ontdubbelen'
import { schrijfAudit } from './audit'
import { CrmFout, crmModus, type CrmAdapter } from './bronnen/crm/adapter'
import { hubspotAdapter, hubspotVernieuw } from './bronnen/crm/hubspot'
import { mockAdapter } from './bronnen/crm/mock'
import { gebruikDb } from './db'
import { ontsleutel, versleutel } from './geheimen'
import { leesStand } from './vvProjectie'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]
const fout = (s: number, m: string): never => { throw Object.assign(new Error(m), { statusCode: s, statusMessage: m }) }

export interface CrmInstellingen {
  richting: Record<CrmObject, Richting>
  toewijzing: { bedrijven: Toewijzing[]; contacten: Toewijzing[] }
  eigenaarsregel: { terugval: string | null; onbekend: string[] }
  overdracht: boolean
  slapendMaanden: 3 | 6 | 12
  account?: string | null; verbondenOp?: string | null; laatsteSync?: string | null; laatsteFout?: string | null
  schrijvenSinds?: Partial<Record<CrmObject, string>>
  mockVerlopen?: boolean
}
export function instellingenVan(k: Rij | null | undefined): CrmInstellingen {
  const i = (k?.instellingen ?? {}) as Partial<CrmInstellingen>
  return {
    ...i,
    richting: { ...RICHTING_STANDAARD, ...(i.richting ?? {}) },
    toewijzing: { bedrijven: i.toewijzing?.bedrijven ?? TOEWIJZING_STANDAARD.bedrijven, contacten: i.toewijzing?.contacten ?? TOEWIJZING_STANDAARD.contacten },
    eigenaarsregel: { terugval: i.eigenaarsregel?.terugval ?? null, onbekend: i.eigenaarsregel?.onbekend ?? [] },
    overdracht: !!i.overdracht, slapendMaanden: ([3, 6, 12] as const).includes(i.slapendMaanden as any) ? i.slapendMaanden! : 6,
  }
}

export const isCrmSoort = (s: string): s is CrmSoort => (CRM_SOORTEN as readonly string[]).includes(s)
export async function crmRij(tx: Tx, soort: CrmSoort = 'hubspot') { return (await rijen(tx, sql`select * from koppelingen where soort = ${soort}`))[0] ?? null }
/** De actieve CRM-koppeling van de organisatie (er is er hooguit één in gebruik). */
export async function actieveCrm(tx: Tx) { return (await rijen(tx, sql`select * from koppelingen where soort in ('hubspot', 'salesforce', 'dynamics', 'pipedrive', 'afas') and status = 'actief' order by updated_at desc limit 1`))[0] ?? null }

/** De adapter voor een koppeling: lokaal de mock, anders HubSpot met het token (vernieuwd als het bijna verloopt). */
export async function adapterVoor(tx: Tx, k: Rij): Promise<CrmAdapter> {
  if (crmModus() === 'mock') return mockAdapter(k.organisation_id, { verlopen: !!k.instellingen?.mockVerlopen })
  const g = ontsleutel(k.geheimen, 'crm')
  if (!g?.access) throw new CrmFout('De koppeling met HubSpot is verlopen. Verbind opnieuw om verder te synchroniseren.', 'verlopen')
  if (g.refresh && g.verloopt && Date.parse(g.verloopt) - Date.now() < 120_000) {
    const n = await hubspotVernieuw(g.refresh)
    await tx.execute(sql`update koppelingen set geheimen = ${versleutel(n, 'crm')}, updated_at = now() where id = ${k.id}`)
    return hubspotAdapter(n.access)
  }
  return hubspotAdapter(g.access)
}

/** De stand voor het scherm: nooit de geheimen. */
export async function crmStand(tx: Tx, soort: CrmSoort) {
  const k = await crmRij(tx, soort)
  const i = instellingenVan(k)
  const runs = k ? await rijen(tx, sql`select id, handeling, start, eind, gelezen, geschreven, fouten from koppeling_runs where koppeling_id = ${k.id} order by start desc limit 20`) : []
  const voorbeeld = k?.status === 'actief' ? await rijen(tx, sql`select object, data from crm_records where soort = ${soort} order by bijgewerkt_op desc, extern_id limit 40`) : []
  return {
    soort, status: (k?.status ?? 'uit') as 'uit' | 'actief' | 'fout', verbonden: k?.status === 'actief', account: i.account ?? null, verbondenOp: i.verbondenOp ?? null,
    laatsteSync: i.laatsteSync ?? null, laatsteFout: k?.status === 'fout' ? i.laatsteFout ?? 'De koppeling werkt niet.' : null,
    richting: i.richting, toewijzing: i.toewijzing, eigenaarsregel: i.eigenaarsregel, overdracht: i.overdracht, slapendMaanden: i.slapendMaanden,
    voorbeeld: { bedrijven: voorbeeld.find((v) => v.object === 'bedrijf')?.data ?? null, contacten: voorbeeld.find((v) => v.object === 'contact')?.data ?? null },
    runs: runs.map((r) => ({ id: r.id, handeling: r.handeling, start: new Date(r.start).toISOString(), eind: r.eind ? new Date(r.eind).toISOString() : null, gelezen: r.gelezen, geschreven: r.geschreven, fouten: r.fouten ?? [] })),
    sleutelBestaat: !!k?.geheimen,
  }
}

const gebruikersVan = async (tx: Tx) => (await rijen(tx, sql`select id, email, role, team_id from users where status = 'actief' and role <> 'founder'`)) as { id: string; email: string | null; role: string; team_id: string | null }[]
/** Terugval van de eigenaarsregel: ingesteld, anders de salesmanager (zoals de motor, F15), anders de beheerder. */
async function terugvalVan(tx: Tx, i: CrmInstellingen) {
  if (i.eigenaarsregel.terugval) return i.eigenaarsregel.terugval
  const g = await gebruikersVan(tx)
  return g.find((u) => u.role === 'salesmanager')?.id ?? g.find((u) => u.role === 'beheerder')?.id ?? null
}

/** Accountvelden met hun herkomst, in de termen van de veldtoewijzing. */
function huidigeVelden(a: Rij) {
  const h = a.data?.herkomst ?? {}
  const v = (waarde: unknown, sleutel: string) => ({ waarde, herkomst: h[sleutel] ?? null })
  const uit: Record<string, { waarde: unknown; herkomst: any }> = {
    naam: v(a.name, 'naam'), kvk: v(a.kvk, 'kvk'), domein: v(a.domein, 'website'), plaats: v(a.city, 'plaats'), postcode: v(a.postcode, 'postcode'),
    telefoon: v(a.data?.telefoon, 'telefoon'), adres: v(a.data?.adres, 'adres'), medewerkers: v(a.data?.medewerkers, 'medewerkers'),
  }
  for (const [k, w] of Object.entries(a.data?.customFields ?? {})) uit[`cf:${k}`] = v(w, `cf:${k}`)
  return uit
}
/** Toegepaste velden terug in kolommen en data, met herkomst crm. */
async function werkAccountBij(tx: Tx, a: Rij, toepassen: Record<string, unknown>, op: string, extern: { soort: CrmSoort; id: string }, extra: Record<string, unknown> = {}) {
  const kolom: Record<string, string> = { naam: 'name', kvk: 'kvk', domein: 'domein', plaats: 'city', postcode: 'postcode' }
  const data: Rij = { ...(a.data ?? {}), ...extra, extern: { ...(a.data?.extern ?? {}), [extern.soort]: { id: extern.id, bijgewerktOp: op } }, herkomst: { ...(a.data?.herkomst ?? {}) }, customFields: { ...(a.data?.customFields ?? {}) } }
  const kolommen: Record<string, unknown> = {}
  for (const [veld, w] of Object.entries(toepassen)) {
    const hk = veld === 'domein' ? 'website' : veld
    data.herkomst[hk] = { bron: 'crm', op }
    if (kolom[veld]) kolommen[kolom[veld]!] = w
    else if (veld.startsWith('cf:')) data.customFields[veld.slice(3)] = w
    else if (['telefoon', 'adres', 'medewerkers'].includes(veld)) data[veld] = w
  }
  await tx.execute(sql`update accounts set data = ${JSON.stringify(data)}::jsonb, updated_at = now(),
    name = coalesce(${(kolommen.name as string) ?? null}, name), kvk = coalesce(${(kolommen.kvk as string) ?? null}, kvk), domein = coalesce(${(kolommen.domein as string) ?? null}, domein),
    city = coalesce(${(kolommen.city as string) ?? null}, city), postcode = coalesce(${(kolommen.postcode as string) ?? null}, postcode) where id = ${a.id}`)
}

const bestandVan = async (tx: Tx): Promise<(AccountKandidaat & { id: string })[]> => (await rijen(tx, sql`select id, name, kvk, domein, city, postcode, account_kind as "accountKind" from accounts`)) as any

export interface SyncUitkomst { runId: string; gelezen: number; geschreven: number; fouten: number; verschillen: number; klanten: number; slapend: number; melding: string | null }

/** Een run: lezen, klanten bijwerken, slapende klanten herkennen en schrijven volgens de richting. */
export async function syncCrm(tx: Tx, org: string, opties: { soort?: CrmSoort; door?: string | null; nu?: Date; handeling?: 'sync' | 'uur' } = {}): Promise<SyncUitkomst> {
  const nu = opties.nu ?? new Date()
  const op = nu.toISOString()
  const k = opties.soort ? await crmRij(tx, opties.soort) : await actieveCrm(tx)
  if (!k || k.status === 'uit') fout(400, 'Er is nog geen CRM gekoppeld. Verbind je CRM om te synchroniseren.')
  const soort = k!.soort as CrmSoort
  // Eén run tegelijk per koppeling; een run die langer dan 15 minuten open staat, telt als afgebroken.
  await tx.execute(sql`select id from koppelingen where id = ${k!.id} for update`)
  const [loopt] = await rijen(tx, sql`select id from koppeling_runs where koppeling_id = ${k!.id} and eind is null and start > ${new Date(nu.getTime() - 15 * 60_000).toISOString()}`)
  if (loopt) fout(409, 'Er loopt al een synchronisatie. Wacht tot die klaar is.')
  const [run] = await rijen(tx, sql`insert into koppeling_runs (organisation_id, koppeling_id, soort, handeling, start) values (${org}, ${k!.id}, ${soort}, ${opties.handeling ?? 'sync'}, ${op}) returning id`)
  const i = instellingenVan(k)
  const fouten: { record?: string; veld?: string; melding: string; soort?: 'fout' | 'verschil' }[] = []
  let gelezen = 0
  let geschreven = 0
  let klanten = 0
  let slapend = 0
  let melding: string | null = null
  try {
    const adapter = await adapterVoor(tx, k!)
    const gebruikers = await gebruikersVan(tx)
    const terugval = await terugvalVan(tx, i)
    const onbekend = new Set<string>()
    if (magLezen(i.richting.bedrijven)) {
      const bedrijven = await adapter.leesBedrijven()
      const contacten = magLezen(i.richting.contacten) ? await adapter.leesContacten() : []
      gelezen += bedrijven.length + contacten.length
      const bestand = await bestandVan(tx)
      for (const b of bedrijven) {
        const p = pasToewijzingToe(b.velden, i.toewijzing.bedrijven, 'bedrijven', op)
        const [rec] = await rijen(tx, sql`insert into crm_records (organisation_id, soort, object, extern_id, data, eigenaar_email, bijgewerkt_op) values (${org}, ${soort}, 'bedrijf', ${b.id}, ${JSON.stringify({ ...p.velden, ruw: b.velden })}::jsonb, ${b.eigenaar ?? null}, ${op})
          on conflict (organisation_id, soort, object, extern_id) do update set data = excluded.data, eigenaar_email = excluded.eigenaar_email, bijgewerkt_op = excluded.bijgewerkt_op returning id, account_id`)
        const eig = eigenaarVoor(b.eigenaar, gebruikers, terugval)
        if (b.eigenaar && !eig.gevonden) onbekend.add(b.eigenaar.toLowerCase())
        // Koppelen aan een account: eerst het bewaarde id, dan het extern id op het account, dan ontdubbelen.
        let accountId: string | null = rec!.account_id ?? (await rijen(tx, sql`select id from accounts where data->'extern'->${soort}->>'id' = ${b.id}`))[0]?.id ?? null
        if (!accountId) {
          const d = zoekDuplicaat({ name: String(p.velden.naam ?? ''), kvk: (p.velden.kvk as string) ?? null, domein: normaliseerDomein(p.velden.domein as string), postcode: (p.velden.postcode as string) ?? null }, bestand)
          if (d.soort === 'zeker') accountId = d.match!.id!
        }
        const klant = p.velden.soort === 'klant'
        if (!accountId && klant) {
          // Een klant uit het CRM wordt een klant-account (voor ontdubbelen, profiel en kansen langs de route).
          accountId = crypto.randomUUID()
          await tx.execute(sql`insert into accounts (id, organisation_id, name, account_kind, nb_status, owner_id, kvk, domein, city, postcode, nb_bron, data)
            values (${accountId}, ${org}, ${String(p.velden.naam ?? 'Onbekend bedrijf')}, 'klant', 'nieuw', ${eig.id}, ${(p.velden.kvk as string) ?? null}, ${normaliseerDomein(p.velden.domein as string)}, ${(p.velden.plaats as string) ?? null}, ${(p.velden.postcode as string) ?? null}, 'crm',
            ${JSON.stringify({ telefoon: p.velden.telefoon ?? undefined, medewerkers: p.velden.medewerkers ?? undefined, adres: p.velden.adres ?? undefined, customFields: Object.fromEntries(Object.entries(p.velden).filter(([x]) => x.startsWith('cf:')).map(([x, w]) => [x.slice(3), w])), herkomst: Object.fromEntries(Object.keys(p.herkomst).map((x) => [x === 'domein' ? 'website' : x, { bron: 'crm', op }])), extern: { [soort]: { id: b.id, bijgewerktOp: op } }, crm: { laatsteOrder: p.velden.laatsteOrder ?? null, dealstatus: p.velden.dealstatus ?? null } })}::jsonb)`)
          bestand.push({ id: accountId, name: String(p.velden.naam ?? ''), kvk: (p.velden.kvk as string) ?? null, domein: normaliseerDomein(p.velden.domein as string), postcode: (p.velden.postcode as string) ?? null, accountKind: 'klant' })
          klanten++
        } else if (accountId) {
          const [a] = await rijen(tx, sql`select * from accounts where id = ${accountId}`)
          const c = losConflictOp(huidigeVelden(a!), { velden: Object.fromEntries(Object.entries(p.velden).filter(([x]) => !['soort', 'laatsteOrder', 'dealstatus', 'omzet'].includes(x))), herkomst: p.herkomst })
          for (const x of c.afgewezen) fouten.push({ soort: 'verschil', record: `${a!.name} (${b.id})`, veld: x.veld, melding: `${x.veld}: in Dealtrace "${x.huidig}" (bron ${x.bron}), in het CRM "${x.crm}". Dealtrace houdt zijn waarde.` })
          await werkAccountBij(tx, a!, c.toepassen, op, { soort, id: b.id }, { crm: { laatsteOrder: p.velden.laatsteOrder ?? a!.data?.crm?.laatsteOrder ?? null, dealstatus: p.velden.dealstatus ?? a!.data?.crm?.dealstatus ?? null } })
          if (klant && a!.account_kind === 'klant') klanten++
        }
        if (accountId) await tx.execute(sql`update crm_records set account_id = ${accountId} where id = ${rec!.id}`)
      }
      // Contacten van gekoppelde accounts: bijwerken of toevoegen, nooit een hand-veld overschrijven.
      for (const c of contacten) {
        const p = pasToewijzingToe(c.velden, i.toewijzing.contacten, 'contacten', op)
        const [b] = c.bedrijfId ? await rijen(tx, sql`select account_id from crm_records where soort = ${soort} and object = 'bedrijf' and extern_id = ${c.bedrijfId}`) : []
        const [rec] = await rijen(tx, sql`insert into crm_records (organisation_id, soort, object, extern_id, bedrijf_extern, data, bijgewerkt_op) values (${org}, ${soort}, 'contact', ${c.id}, ${c.bedrijfId ?? null}, ${JSON.stringify(p.velden)}::jsonb, ${op})
          on conflict (organisation_id, soort, object, extern_id) do update set data = excluded.data, bedrijf_extern = excluded.bedrijf_extern, bijgewerkt_op = excluded.bijgewerkt_op returning id, contact_id`)
        if (!b?.account_id || !p.velden.achternaam && !p.velden.email) continue
        let [ct] = rec!.contact_id ? await rijen(tx, sql`select * from contacts where id = ${rec!.contact_id}`) : await rijen(tx, sql`select * from contacts where account_id = ${b.account_id} and ((data->'extern'->${soort}->>'id') = ${c.id} or (email is not null and lower(email) = lower(${(p.velden.email as string) ?? ''})))`)
        if (!ct) {
          const [n] = await rijen(tx, sql`insert into contacts (organisation_id, account_id, first_name, last_name, email, status, data) values (${org}, ${b.account_id}, ${(p.velden.voornaam as string) || null}, ${String(p.velden.achternaam || p.velden.email)}, ${(p.velden.email as string) ?? null}, 'actief',
            ${JSON.stringify({ functie: p.velden.functie ?? undefined, telefoon: p.velden.telefoon ?? undefined, bron: 'crm', herkomst: Object.fromEntries(Object.keys(p.herkomst).map((x) => [x, { bron: 'crm', op }])), extern: { [soort]: { id: c.id, bijgewerktOp: op } }, consent: { email: { status: 'onbekend' }, whatsapp: { status: 'onbekend' } } })}::jsonb) returning id`)
          ct = { id: n!.id }
        } else {
          const h = ct.data?.herkomst ?? {}
          const cur = { voornaam: { waarde: ct.first_name, herkomst: h.voornaam ?? h.naam }, achternaam: { waarde: ct.last_name, herkomst: h.achternaam ?? h.naam }, email: { waarde: ct.email, herkomst: h.email }, telefoon: { waarde: ct.data?.telefoon, herkomst: h.telefoon }, functie: { waarde: ct.data?.functie, herkomst: h.functie } }
          const x = losConflictOp(cur, p)
          for (const af of x.afgewezen) fouten.push({ soort: 'verschil', record: `contact ${c.id}`, veld: af.veld, melding: `${af.veld}: Dealtrace houdt "${af.huidig}" (bron ${af.bron}); het CRM heeft "${af.crm}".` })
          const t = x.toepassen
          const nd = { ...(ct.data ?? {}), ...(t.functie ? { functie: t.functie } : {}), ...(t.telefoon ? { telefoon: t.telefoon } : {}), herkomst: { ...h, ...Object.fromEntries(Object.keys(t).map((v) => [v, { bron: 'crm', op }])) }, extern: { ...(ct.data?.extern ?? {}), [soort]: { id: c.id, bijgewerktOp: op } } }
          await tx.execute(sql`update contacts set first_name = coalesce(${(t.voornaam as string) ?? null}, first_name), last_name = coalesce(${(t.achternaam as string) ?? null}, last_name), email = coalesce(${(t.email as string) ?? null}, email), data = ${JSON.stringify(nd)}::jsonb where id = ${ct.id}`)
        }
        await tx.execute(sql`update crm_records set contact_id = ${ct.id}, account_id = ${b.account_id} where id = ${rec!.id}`)
      }
    }
    i.eigenaarsregel.onbekend = [...onbekend].sort()
    slapend = await herkenSlapend(tx, org, i, soort, nu)
    await herkenVerloren(tx, org, soort, nu)
    geschreven += await schrijfNaarCrm(tx, org, k!, i, adapter, nu, fouten)
    await tx.execute(sql`update koppelingen set status = 'actief', instellingen = instellingen || ${JSON.stringify({ laatsteSync: op, laatsteFout: null, eigenaarsregel: i.eigenaarsregel })}::jsonb, updated_at = now() where id = ${k!.id}`)
  } catch (e: any) {
    if (!(e instanceof CrmFout) && !['verlopen', 'scope', 'limiet', 'veld', 'fout'].includes(e?.code)) throw e
    melding = e.message
    fouten.push({ soort: 'fout', melding: e.message })
    if (e.code === 'verlopen' || e.code === 'scope') {
      await tx.execute(sql`update koppelingen set status = 'fout', instellingen = instellingen || ${JSON.stringify({ laatsteFout: e.message })}::jsonb, updated_at = now() where id = ${k!.id}`)
      for (const b of await rijen(tx, sql`select id from users where role = 'beheerder' and status = 'actief'`)) {
        await tx.execute(sql`insert into notificaties (id, organisation_id, gebruiker_id, soort, titel, tekst, link, op, data) values (${crypto.randomUUID()}, ${org}, ${b.id}, 'kritiek', 'CRM-koppeling werkt niet', ${e.message}, '/instellingen/koppelingen/crm', now(), '{}'::jsonb)`)
      }
    }
  }
  await tx.execute(sql`update koppeling_runs set eind = now(), gelezen = ${gelezen}, geschreven = ${geschreven}, fouten = ${JSON.stringify(fouten)}::jsonb where id = ${run!.id}`)
  if (opties.door) await schrijfAudit(tx, { organisationId: org, actorId: opties.door, action: 'koppeling.crm.sync', resourceType: 'koppelingen', resourceId: soort, changes: { gelezen, geschreven, fouten: fouten.length } })
  return { runId: run!.id, gelezen, geschreven, fouten: fouten.filter((f) => f.soort !== 'verschil').length, verschillen: fouten.filter((f) => f.soort === 'verschil').length, klanten, slapend, melding }
}

/** Slapende klanten (F13): geen order in 3, 6 of 12 maanden wordt een herwinaccount met de terugkomregel. */
async function herkenSlapend(tx: Tx, org: string, i: CrmInstellingen, soort: CrmSoort, nu: Date) {
  const stand = await leesStand(tx)
  const r0 = ((stand.terugkomregels ?? []) as any[]).find((r) => String(r.reden).toLowerCase().includes(`${i.slapendMaanden} maanden niet besteld`))
  const regel = r0 ? { extern_id: r0.id as string, reden: r0.reden as string, aanpak: (r0.aanpak as string) ?? null } : null
  const reden = regel?.reden ?? `${i.slapendMaanden} maanden niet besteld`
  let n = 0
  for (const a of await rijen(tx, sql`select id, name, owner_id, data from accounts where account_kind = 'klant' and data->'extern'->${soort} is not null`)) {
    if (!isSlapend(a.data?.crm?.laatsteOrder, nu, i.slapendMaanden) || a.data?.herwin?.regelId === (regel?.extern_id ?? reden)) continue
    await tx.execute(sql`update accounts set data = data || ${JSON.stringify({ herwin: { regelId: regel?.extern_id ?? reden, reden, sinds: nu.toISOString(), laatsteOrder: a.data.crm.laatsteOrder }, terugkom: { reden, aanpak: regel?.aanpak ?? null, kanaal: 'bellen' } })}::jsonb, updated_at = now() where id = ${a.id}`)
    if (a.owner_id) {
      await tx.execute(sql`insert into tasks (id, organisation_id, owner_id, account_id, action_type, title, status, priority, due_date, executor, data) values (${crypto.randomUUID()}, ${org}, ${a.owner_id}, ${a.id}, 'bellen', ${`Herwinnen: ${a.name}`}, 'open', 'middel', ${nu.toISOString()}, 'mens',
        ${JSON.stringify({ herkomst: { bron: 'crm' }, waarom: `${reden}. Laatste order ${a.data.crm.laatsteOrder}.`, aanleiding: regel?.aanpak ?? null })}::jsonb)`)
    }
    n++
  }
  return n
}

/** Een verloren deal in het CRM brengt een overgedragen account terug als winback-kandidaat (7.2, 7.3). */
async function herkenVerloren(tx: Tx, org: string, soort: CrmSoort, nu: Date) {
  for (const a of await rijen(tx, sql`select id, name, owner_id, data from accounts where nb_status = 'overgedragen' and data->'extern'->${soort} is not null and lower(coalesce(data->'crm'->>'dealstatus', '')) in ('verloren', 'closedlost', 'lost') and data->'winback' is null`)) {
    await tx.execute(sql`update accounts set data = data || ${JSON.stringify({ winback: { sinds: nu.toISOString(), reden: 'Deal verloren in het CRM' } })}::jsonb where id = ${a.id}`)
    if (a.owner_id) await tx.execute(sql`insert into tasks (id, organisation_id, owner_id, account_id, action_type, title, status, priority, due_date, executor, data) values (${crypto.randomUUID()}, ${org}, ${a.owner_id}, ${a.id}, 'taak', ${`Winback: ${a.name}`}, 'open', 'middel', ${new Date(nu.getTime() + 864e5).toISOString()}, 'mens', ${JSON.stringify({ herkomst: { bron: 'crm' }, waarom: 'De deal is in het CRM verloren. Kijk wanneer je terugkomt.' })}::jsonb)`)
  }
}

const KANAAL_LABEL: Record<string, string> = { gebeld: 'Gebeld', mail: 'Mail', bericht: 'Bericht', afspraak: 'Afspraak', bezoek: 'Bezoek', linkedin: 'LinkedIn', whatsapp: 'WhatsApp', sms: 'SMS', kaart: 'Kaart' }
/** Schrijven volgens de richting: bedrijven (gemarkeerd bij Neem over), hun contacten en de uitkomsten sinds schrijven aan staat. */
async function schrijfNaarCrm(tx: Tx, org: string, k: Rij, i: CrmInstellingen, adapter: CrmAdapter, nu: Date, fouten: { record?: string; melding: string; soort?: 'fout' | 'verschil' }[]) {
  const soort = k.soort as CrmSoort
  if (!CRM_OBJECTEN_SCHRIJF.some((o) => magSchrijven(i.richting[o]))) return 0
  const sinds = (o: CrmObject) => i.schrijvenSinds?.[o] ?? nu.toISOString()
  const ev: CrmGebeurtenis[] = []
  for (const a of await rijen(tx, sql`select id, data from accounts where coalesce((data->>'crmSchrijven')::boolean, false)`)) ev.push({ soort: 'bedrijf', id: a.id, accountId: a.id, extern: a.data?.extern?.[soort]?.id ?? null })
  for (const c of await rijen(tx, sql`select c.id, c.account_id, c.data->'extern'->${soort}->>'id' as extern, a.data->'extern'->${soort}->>'id' as bedrijf from contacts c join accounts a on a.id = c.account_id
    where (a.data->'extern'->${soort} is not null or coalesce((a.data->>'crmSchrijven')::boolean, false)) and c.status <> 'vertrokken' and c.data->'extern'->${soort} is null and c.created_at >= ${sinds('contacten')}`)) ev.push({ soort: 'contact', id: c.id, accountId: c.account_id, extern: c.extern, externBedrijf: c.bedrijf })
  for (const x of await rijen(tx, sql`select x.id, x.account_id, a.data->'extern'->${soort}->>'id' as bedrijf from activiteiten x join accounts a on a.id = x.account_id
    where x.soort in ('gebeld', 'mail', 'bericht', 'afspraak', 'bezoek', 'linkedin', 'whatsapp', 'kaart') and x.op >= ${sinds('activiteiten')}
    and not exists (select 1 from crm_records r where r.soort = ${soort} and r.activiteit_id = x.id)`)) ev.push({ soort: 'activiteit', id: x.id, accountId: x.account_id, externBedrijf: x.bedrijf })
  let n = 0
  for (const s of schrijfplan(ev, i.richting)) {
    try {
      if (s.soort === 'bedrijf') { await schrijfBedrijf(tx, s.accountId, soort, adapter, nu); n++ }
      else if (s.soort === 'contact') {
        const [c] = await rijen(tx, sql`select c.*, a.data->'extern'->${soort}->>'id' as bedrijf from contacts c join accounts a on a.id = c.account_id where c.id = ${s.id}`)
        if (!c?.bedrijf) continue
        const r = await adapter.schrijfContact({ firstname: c.first_name ?? '', lastname: c.last_name, email: c.email ?? '', jobtitle: c.data?.functie ?? '', phone: c.data?.telefoon ?? '' }, c.bedrijf)
        await tx.execute(sql`update contacts set data = jsonb_set(data, '{extern}', coalesce(data->'extern', '{}'::jsonb) || ${JSON.stringify({ [soort]: { id: r.id, bijgewerktOp: nu.toISOString() } })}::jsonb) where id = ${c.id}`)
        await tx.execute(sql`insert into crm_records (organisation_id, soort, object, extern_id, bedrijf_extern, data, account_id, contact_id) values (${org}, ${soort}, 'contact', ${r.id}, ${c.bedrijf}, ${JSON.stringify({ achternaam: c.last_name, email: c.email })}::jsonb, ${c.account_id}, ${c.id}) on conflict do nothing`)
        n++
      } else {
        const [x] = await rijen(tx, sql`select x.*, a.data->'extern'->${soort}->>'id' as bedrijf, a.name from activiteiten x join accounts a on a.id = x.account_id where x.id = ${s.id}`)
        if (!x?.bedrijf) continue
        const r = await adapter.schrijfActiviteit({ sleutel: `dealtrace-activiteit:${x.id}`, bedrijfId: x.bedrijf, onderwerp: `${berichtKanaalLabel(x.soort, x.kanaal) ?? KANAAL_LABEL[x.soort] ?? x.soort}${x.uitkomst ? `: ${x.uitkomst}` : ''}`, tekst: x.data?.tekst ?? '', datum: new Date(x.op).toISOString(), kanaal: x.kanaal ?? x.soort, uitkomst: x.uitkomst ?? null })
        await tx.execute(sql`insert into crm_records (organisation_id, soort, object, extern_id, bedrijf_extern, account_id, activiteit_id, data) values (${org}, ${soort}, 'activiteit', ${r.id}, ${x.bedrijf}, ${x.account_id}, ${x.id}, ${JSON.stringify({ soort: x.soort, uitkomst: x.uitkomst })}::jsonb)
          on conflict (organisation_id, soort, object, extern_id) do nothing`)
        n++
      }
    } catch (e: any) {
      if (e?.code === 'verlopen' || e?.code === 'scope' || !(e instanceof CrmFout || e?.code === 'fout' || e?.code === 'limiet' || e?.code === 'veld')) throw e
      fouten.push({ soort: 'fout', record: `${s.soort} ${s.id}`, melding: e?.message ?? 'Schrijven mislukt' })
    }
  }
  return n
}
const CRM_OBJECTEN_SCHRIJF: CrmObject[] = ['bedrijven', 'contacten', 'activiteiten']

/** Een account als bedrijf in het CRM (eerst bedrijf, dan zijn contacten via het plan). */
async function schrijfBedrijf(tx: Tx, accountId: string, soort: CrmSoort, adapter: CrmAdapter, nu: Date) {
  const [a] = await rijen(tx, sql`select a.*, u.email as eigenaar from accounts a left join users u on u.id = a.owner_id where a.id = ${accountId}`)
  if (!a) return null
  const al = a.data?.extern?.[soort]?.id ?? null
  const r = await adapter.schrijfBedrijf({ name: a.name, kvk_nummer: a.kvk ?? '', domain: a.domein ?? '', city: a.city ?? '', zip: a.postcode ?? '', phone: a.data?.telefoon ?? '', lifecyclestage: a.account_kind === 'klant' ? 'customer' : 'lead', eigenaar: a.eigenaar ?? null }, al)
  await tx.execute(sql`update accounts set data = (data - 'crmSchrijven') || ${JSON.stringify({ extern: { ...(a.data?.extern ?? {}), [soort]: { id: r.id, bijgewerktOp: nu.toISOString() } } })}::jsonb where id = ${accountId}`)
  await tx.execute(sql`insert into crm_records (organisation_id, soort, object, extern_id, data, account_id, eigenaar_email) values (${a.organisation_id}, ${soort}, 'bedrijf', ${r.id}, ${JSON.stringify({ naam: a.name, kvk: a.kvk, domein: a.domein, plaats: a.city, postcode: a.postcode, soort: a.account_kind })}::jsonb, ${accountId}, ${a.eigenaar ?? null})
    on conflict (organisation_id, soort, object, extern_id) do update set account_id = excluded.account_id`)
  return r.id
}

/**
 * Na "Neem over": een CRM-lead koppelt aan zijn record; anders schrijft Dealtrace met Schrijven of Beide
 * het bedrijf en de contacten direct weg. Mislukt dat, dan pakt de volgende synchronisatie het op.
 */
export async function naNeemOver(tx: Tx, org: string, accountId: string, lead: { bron: string; data?: any }, nu = new Date()) {
  const k = await actieveCrm(tx)
  if (!k) return null
  const soort = k.soort as CrmSoort
  if (lead.bron === 'crm' && lead.data?.crmId) {
    await tx.execute(sql`update crm_records set account_id = ${accountId} where soort = ${soort} and object = 'bedrijf' and extern_id = ${lead.data.crmId}`)
    await tx.execute(sql`update accounts set data = data || ${JSON.stringify({ extern: { [soort]: { id: lead.data.crmId, bijgewerktOp: nu.toISOString() } } })}::jsonb where id = ${accountId}`)
    return 'gekoppeld'
  }
  const i = instellingenVan(k)
  if (!magSchrijven(i.richting.bedrijven)) return null
  await tx.execute(sql`update accounts set data = data || '{"crmSchrijven": true}'::jsonb where id = ${accountId}`)
  // In een savepoint: lukt het niet, dan blijft de vlag staan en pakt de volgende run het op.
  try {
    await tx.transaction(async (sp) => {
      const adapter = await adapterVoor(sp as unknown as Tx, k)
      await schrijfBedrijf(sp as unknown as Tx, accountId, soort, adapter, nu)
      if (magSchrijven(i.richting.contacten)) {
        const [a] = await rijen(sp as unknown as Tx, sql`select data->'extern'->${soort}->>'id' as bedrijf from accounts where id = ${accountId}`)
        for (const c of await rijen(sp as unknown as Tx, sql`select * from contacts where account_id = ${accountId} and status <> 'vertrokken' and data->'extern'->${soort} is null`)) {
          const r = await adapter.schrijfContact({ firstname: c.first_name ?? '', lastname: c.last_name, email: c.email ?? '', jobtitle: c.data?.functie ?? '', phone: c.data?.telefoon ?? '' }, a!.bedrijf)
          await sp.execute(sql`update contacts set data = jsonb_set(data, '{extern}', coalesce(data->'extern', '{}'::jsonb) || ${JSON.stringify({ [soort]: { id: r.id, bijgewerktOp: nu.toISOString() } })}::jsonb) where id = ${c.id}`)
        }
      }
    })
    return 'geschreven'
  } catch (e) {
    if (!(e instanceof CrmFout) && !['verlopen', 'scope', 'limiet', 'veld', 'fout'].includes((e as any)?.code)) throw e
    return 'later'
  }
}

/** Treffers in het CRM die (nog) geen account zijn: voor "Al in je bestand" en Neem over. */
export async function crmBestand(tx: Tx): Promise<(AccountKandidaat & { id: string; eigenaar: string | null; klant: boolean; externId: string })[]> {
  return (await rijen(tx, sql`select r.id, r.extern_id, r.data, r.eigenaar_email from crm_records r join koppelingen k on k.soort = r.soort and k.status = 'actief' where r.object = 'bedrijf' and r.account_id is null`))
    .map((r) => ({ id: r.id, externId: r.extern_id, name: String(r.data?.naam ?? ''), kvk: r.data?.kvk ?? null, domein: normaliseerDomein(r.data?.domein ?? null), postcode: r.data?.postcode ?? null, city: r.data?.plaats ?? null, accountKind: r.data?.soort === 'klant' ? 'klant' : 'prospect', eigenaar: r.eigenaar_email ?? null, klant: r.data?.soort === 'klant' }))
}

/** De bron CRM in de leadstroom: prospects uit het CRM die nog geen account zijn, met hun contacten. */
export async function crmLeads(tx: Tx, z: { werkgebied?: { postcodes?: string[] } | null }, op: string, max = 25): Promise<(LeadFeiten & { crmId: string; eigenaar: string | null })[]> {
  const k = await actieveCrm(tx)
  if (!k) return []
  const i = instellingenVan(k)
  const bedrijven = (await rijen(tx, sql`select extern_id, data, eigenaar_email from crm_records where soort = ${k.soort} and object = 'bedrijf' and account_id is null and coalesce(data->>'soort', 'prospect') <> 'klant' order by extern_id`))
  const contacten = (await rijen(tx, sql`select extern_id, bedrijf_extern, data from crm_records where soort = ${k.soort} and object = 'contact'`))
  const pc = (z.werkgebied?.postcodes ?? []).map((p) => p.slice(0, 2))
  const uit = bedrijven.filter((b) => !pc.length || pc.includes(String(b.data?.postcode ?? '').slice(0, 2))).slice(0, max).map((b) => {
    const bedrijf: CrmBedrijf = { id: b.extern_id, eigenaar: b.eigenaar_email, velden: b.data?.ruw ?? {} }
    const cs: CrmContact[] = contacten.filter((c) => c.bedrijf_extern === b.extern_id).map((c) => ({ id: c.extern_id, bedrijfId: c.bedrijf_extern, velden: Object.fromEntries(i.toewijzing.contacten.map((t) => [t.crmVeld, c.data?.[t.veld]])) }))
    return { ...crmNaarLead(bedrijf, cs, i.toewijzing, op), crmId: b.extern_id, eigenaar: b.eigenaar_email ?? null }
  })
  return uit
}

/** De overdracht naar het CRM (P17 met doel crm): één activiteit met de briefing, idempotent op het overdracht-id. */
export async function verstuurCrmOverdracht(tx: Tx, id: string, nu = new Date()) {
  const [o] = await rijen(tx, sql`select o.*, a.name, a.data as account_data from overdrachten o join accounts a on a.id = o.account_id where o.id = ${id}`)
  if (!o || o.naar !== 'crm' || o.status !== 'klaar') return null
  const k = await actieveCrm(tx)
  if (!k) return null
  const soort = k.soort as CrmSoort
  const [run] = await rijen(tx, sql`insert into koppeling_runs (organisation_id, koppeling_id, soort, handeling, start) values (${o.organisation_id}, ${k.id}, ${soort}, 'overdragen', ${nu.toISOString()}) returning id`)
  try {
    const adapter = await adapterVoor(tx, k)
    let bedrijf = o.account_data?.extern?.[soort]?.id ?? null
    const plan = overdrachtNaarCrm({ ...o.pakket, overdrachtId: o.id }, { bedrijfExtern: bedrijf, eigenaarEmail: o.pakket?.nieuweEigenaar ?? null })
    if (plan.eerstBedrijf) bedrijf = await schrijfBedrijf(tx, o.account_id, soort, adapter, nu)
    const r = await adapter.schrijfOverdracht({ ...plan.activiteit, bedrijfId: bedrijf! }, o.pakket?.nieuweEigenaar ?? null)
    await tx.execute(sql`update koppeling_runs set eind = now(), geschreven = 1 where id = ${run!.id}`)
    await tx.execute(sql`update overdrachten set status = 'bevestigd', extern_id = ${r.id}, pogingen = pogingen + 1, laatste_fout = null, volgende_poging_op = null, data = data || ${JSON.stringify({ verstuurdOp: nu.toISOString(), crm: soort })}::jsonb where id = ${id}`)
    return 'bevestigd'
  } catch (e: any) {
    const bericht = e?.message ?? 'Onbekende fout'
    await tx.execute(sql`update koppeling_runs set eind = now(), fouten = ${JSON.stringify([{ soort: 'fout', melding: bericht }])}::jsonb where id = ${run!.id}`)
    const pogingen = Number(o.pogingen) + 1
    const volgende = e?.tijdelijk ? volgendePoging(pogingen, nu) : null
    if (volgende) { await tx.execute(sql`update overdrachten set pogingen = ${pogingen}, laatste_fout = ${bericht}, volgende_poging_op = ${volgende.toISOString()} where id = ${id}`); return 'opnieuw' }
    await tx.execute(sql`update overdrachten set status = 'mislukt', pogingen = ${pogingen}, laatste_fout = ${bericht}, volgende_poging_op = null where id = ${id}`)
    await tx.execute(sql`insert into tasks (id, organisation_id, owner_id, account_id, action_type, title, status, priority, due_date, executor, data) values (${crypto.randomUUID()}, ${o.organisation_id}, ${o.door}, ${o.account_id}, 'taak', ${`Overdracht naar het CRM mislukt: ${o.name}`}, 'open', 'hoog', ${nu.toISOString()}, 'mens',
      ${JSON.stringify({ herkomst: { bron: 'overdracht' }, overdrachtId: id, aanleiding: `Het CRM nam de overdracht niet aan: ${bericht}`, link: `/accounts/${o.account_id}` })}::jsonb)`)
    return 'mislukt'
  }
}

/** Is overdragen naar het CRM een keuze? Alleen met een actieve koppeling en de schakelaar aan. */
export async function crmOverdrachtStand(tx: Tx): Promise<'uit' | 'aan' | 'niet-gekoppeld'> {
  const k = await actieveCrm(tx)
  if (!k) return 'niet-gekoppeld'
  return instellingenVan(k).overdracht ? 'aan' : 'uit'
}
