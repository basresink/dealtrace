// De overdracht na een gehouden eerste afspraak (P17, F17, ADR-021). draagOver schrijft in één
// transactie de overdracht (klaar), de gebeurtenis overgedragen, de status, de activiteit en de audit
// (gat 1). Het versturen naar DealDrive is een aparte stap (verstuurOverdracht), zodat een storing
// bij de ontvanger niets terugdraait. Opnieuw na 1, 5 en 30 minuten, 2 en 12 uur; daarna mislukt.
import { sql } from 'drizzle-orm'
import { magOverdragen, NAAR_LABEL, overdrachtBriefing, overdrachtPakket, volgendePoging, type OverdrachtNaar, type PakketContext } from '../../shared/funnel'
import { STANDAARD_FASES } from '../../shared/reis'
import { schrijfAudit } from './audit'
import { bodyHash, type DealDriveKoppeling, type DealDriveStand } from './dealdriveAdapter'
import { dealdriveInrichting, dealdriveKoppeling } from './dealdrive'
import { gebruikDb } from './db'
import { meldGebeurtenis, ReisFout } from './reis'
import { leesStand } from './vvProjectie'
import { teamLeden } from './planning'
import { crmOverdrachtStand, verstuurCrmOverdracht } from './crm'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]
const fout = (s: number, m: string, extra: object = {}): never => { throw Object.assign(new Error(m), { statusCode: s, statusMessage: m, data: extra }) }
const iso = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString())
const FASE_LABEL_VAN = (id: string) => STANDAARD_FASES.find((f) => f.id === id)?.label ?? id
const kort = (n: string) => n.replace(/^Testgebruiker /, '')

export async function dealdriveStand(tx: Tx): Promise<DealDriveStand> {
  return (await dealdriveInrichting(tx)).stand
}
const crmGekoppeld = async (tx: Tx) => !!(await rijen(tx, sql`select 1 from koppelingen where soort in ('hubspot', 'salesforce', 'dynamics', 'pipedrive', 'afas') and status = 'actief'`)).length

/** De laatste afgeronde eerste afspraak met vervolg (data.overdragen). */
async function eersteAfspraak(tx: Tx, accountId: string) {
  const [ap] = await rijen(tx, sql`select ap.id, ap.start_at, ap.status, ap.vorm, ap.uitkomst_code, ap.data, m.naam as soort from appointments ap join meetingsoorten m on m.id = ap.meetingsoort_id
    where ap.account_id = ${accountId} and ap.status = 'afgerond' and coalesce((ap.data->>'overdragen')::boolean, false) order by ap.start_at desc limit 1`)
  return ap ?? null
}
const lopend = async (tx: Tx, accountId: string) => (await rijen(tx, sql`select * from overdrachten where account_id = ${accountId} and status <> 'mislukt' order by op desc limit 1`))[0] ?? null

/** Alles wat het venster "Overdragen?" nodig heeft: mag het, de keuzes met reden, de vervolgstap en het voorbeeld. */
export async function voorbereiding(tx: Tx, accountId: string, door: { id: string }) {
  const [a] = await rijen(tx, sql`select id, name, nb_status from accounts where id = ${accountId}`)
  if (!a) fout(404, 'Account niet gevonden')
  const ap = await eersteAfspraak(tx, accountId)
  const loopt = await lopend(tx, accountId)
  const m = magOverdragen({ nbStatus: a!.nb_status }, ap ? { eerste: true, status: ap.status, overdragen: true } : null, !!loopt && !loopt.data?.alKlant)
  const stand = await dealdriveStand(tx)
  const crm = await crmGekoppeld(tx)
  const crmStand = await crmOverdrachtStand(tx)
  const [inst] = await rijen(tx, sql`select value from org_settings where key = 'overdracht'`)
  const collegas = await rijen(tx, sql`select id, name as naam from users where status = 'actief' and role in ('accountmanager', 'salesmanager') and id <> ${door.id} order by name`)
  const ctx = ap ? await context(tx, accountId, ap, { omschrijving: ap.data?.vervolgstap ?? '' }) : null
  return {
    mag: m, alKlant: loopt?.data?.alKlant ? { overdrachtId: loopt.id } : null, overdracht: loopt ? overdrachtUit(loopt) : null,
    keuzes: {
      dealdrive: { kan: true, reden: stand === 'uit' ? 'DealDrive is nog niet gekoppeld. Je krijgt een overdrachtstaak met de briefing.' : null },
      // P20: met een gekoppeld CRM is het alleen een keuze als "Overdracht naar dit CRM" aan staat.
      crm: crmStand === 'uit' ? { kan: false, reden: 'Overdracht naar het CRM staat uit. Je beheerder zet dit aan bij de CRM-koppeling.' } : { kan: true, reden: crm ? null : 'Het CRM is nog niet gekoppeld. Je krijgt een overdrachtstaak met de briefing.' },
      collega: { kan: collegas.length > 0, reden: collegas.length ? null : 'Er is geen collega om aan over te dragen.' },
    },
    collegas, ontvanger: (inst?.value as any)?.vasteOntvanger ?? null,
    vervolgstap: ap?.data?.vervolgstap ?? '',
    voorbeeld: ctx ? { briefing: ctx.briefing, contacten: ctx.contacten.length, geschiedenis: ctx.reis?.geschiedenis ?? [], verslag: ctx.afspraak.verslag ?? null } : null,
  }
}

/** De context voor pakket en briefing. */
async function context(tx: Tx, accountId: string, ap: Rij, vervolgstap: PakketContext['vervolgstap']): Promise<Omit<PakketContext, 'overdrachtId' | 'op' | 'door'>> {
  const [a] = await rijen(tx, sql`select a.*, r.naam as reis_naam from accounts a left join reistemplates r on r.id = a.reis_id where a.id = ${accountId}`)
  const cs = await rijen(tx, sql`select id, first_name, last_name, email, rol, data from contacts where account_id = ${accountId} and status <> 'vertrokken' order by id`)
  const stand = await leesStand(tx)
  const branche = (stand.branches ?? []).find((b: any) => b.id === a!.vv_branche_id)?.naam ?? null
  const [cp] = await rijen(tx, sql`select c.data->>'winpuntId' as w from campagne_items ci join campagnes c on c.id = ci.campagne_id where ci.account_id = ${accountId} order by c.updated_at desc limit 1`)
  const winpunt = (stand.winpunten ?? []).find((w: any) => w.id === cp?.w)?.titel ?? null
  const gesch = await rijen(tx, sql`select naar_fase_id, op from reisgeschiedenis where account_id = ${accountId} and naar_fase_id is not null order by op`)
  const [pog] = await rijen(tx, sql`select count(*)::int as n from activiteiten where account_id = ${accountId} and soort in ('gebeld', 'mail', 'bericht', 'bezoek', 'linkedin', 'whatsapp', 'kaart') and op <= ${iso(ap.start_at)}`)
  const basis = {
    account: { id: a!.id, naam: a!.name, kvk: a!.kvk, website: a!.domein ? `https://${a!.domein}` : null, telefoon: a!.data?.telefoon ?? null, klasse: a!.klasse, branche, plaats: a!.city, postcode: a!.postcode, huidigeLeverancier: a!.data?.huidigeLeverancier ?? null, eigenVelden: a!.data?.customFields ?? {} },
    contacten: cs.map((c) => ({ id: c.id, voornaam: c.first_name, achternaam: c.last_name, functie: c.data?.functie ?? null, email: c.email, telefoon: c.data?.telefoon ?? null, mobiel: c.data?.mobiel ?? null, rol: c.rol, prive: Array.isArray(c.data?.prive) ? c.data.prive : [] })),
    afspraak: { id: ap.id, datum: iso(ap.start_at)!, soort: ap.soort, vorm: ap.vorm, uitkomst: ap.uitkomst_code, verslag: ap.data?.verslag?.tekst || null },
    vervolgstap, winpunt,
    reis: { naam: a!.reis_naam ?? 'Standaardreis', geschiedenis: gesch.map((g) => ({ fase: FASE_LABEL_VAN(g.naar_fase_id), op: iso(g.op)! })), pogingenTotAfspraak: Math.max(1, pog?.n ?? 1), bron: a!.nb_bron ?? null },
  }
  return { ...basis, briefing: overdrachtBriefing({ ...basis, geschiedenis: basis.reis.geschiedenis }) }
}

export interface OverdraagInvoer { naar: OverdrachtNaar; naarGebruikerId?: string | null; ontvanger?: string | null; vervolgstap: { omschrijving: string; datum?: string | null; soort?: string | null }; alsNieuweKansBijKlant?: boolean; sleutel?: string | null }

/** "Draag over": in één transactie overdracht, gebeurtenis, status, fase, taken, activiteit en audit. */
export async function draagOver(tx: Tx, org: string, door: { id: string; naam: string; email: string }, accountId: string, inv: OverdraagInvoer, nu = new Date()) {
  if (!['dealdrive', 'crm', 'collega'].includes(inv.naar)) fout(422, 'Kies naar wie je overdraagt')
  if (!inv.vervolgstap?.omschrijving?.trim()) fout(422, 'Beschrijf de vervolgstap')
  const sleutel = inv.sleutel || `overdracht:${accountId}:${nu.toISOString().slice(0, 10)}`
  const [al] = await rijen(tx, sql`select * from overdrachten where sleutel = ${sleutel}`)
  if (al) return { ...overdrachtUit(al), herhaald: true }
  const loopt = await lopend(tx, accountId)
  // Al klant in DealDrive: met "Ja" gaat hetzelfde verzoek opnieuw, als nieuwe kans bij een bestaande klant.
  if (loopt?.data?.alKlant) {
    if (!inv.alsNieuweKansBijKlant) fout(409, 'Dit bedrijf is al klant in DealDrive. Overdragen als nieuwe kans bij een bestaande klant?', { reden: 'al_klant', overdrachtId: loopt.id })
    await tx.execute(sql`update overdrachten set pakket = pakket || '{"alsNieuweKansBijKlant": true}'::jsonb, data = data - 'alKlant', volgende_poging_op = ${nu.toISOString()} where id = ${loopt.id}`)
    await schrijfAudit(tx, { organisationId: org, actorId: door.id, action: 'overdracht.alsKans', resourceType: 'overdrachten', resourceId: loopt.id, changes: {} })
    return overdrachtUit((await rijen(tx, sql`select * from overdrachten where id = ${loopt.id}`))[0]!)
  }
  const [a] = await rijen(tx, sql`select id, name, nb_status, owner_id from accounts where id = ${accountId}`)
  if (!a) fout(404, 'Account niet gevonden')
  const ap = await eersteAfspraak(tx, accountId)
  const m = magOverdragen({ nbStatus: a!.nb_status }, ap ? { eerste: true, status: ap.status, overdragen: true } : null, !!loopt)
  if (!m.ja) fout(loopt || a!.nb_status === 'overgedragen' ? 409 : 422, m.reden)
  let collega: Rij | undefined
  if (inv.naar === 'collega') {
    ;[collega] = await rijen(tx, sql`select id, name, email from users where id = ${inv.naarGebruikerId ?? ''} and status = 'actief'`)
    if (!collega) fout(422, 'Kies de collega die het overneemt')
  }
  const id = crypto.randomUUID()
  const ctx = await context(tx, accountId, ap!, { omschrijving: inv.vervolgstap.omschrijving.trim(), datum: inv.vervolgstap.datum ?? null, soort: inv.vervolgstap.soort ?? null })
  let pakket: Record<string, unknown>
  try {
    pakket = overdrachtPakket({ ...ctx, overdrachtId: id, op: nu.toISOString(), door: { email: door.email, naam: kort(door.naam) }, nieuweEigenaar: collega?.email ?? inv.ontvanger ?? null, alsNieuweKansBijKlant: !!inv.alsNieuweKansBijKlant })
  } catch (e: any) { return fout(422, e.message) }
  const stand = await dealdriveStand(tx)
  const crmStand = inv.naar === 'crm' ? await crmOverdrachtStand(tx) : null
  if (crmStand === 'uit') fout(422, 'Overdracht naar het CRM staat uit')
  const versturen = (inv.naar === 'dealdrive' && stand !== 'uit') || crmStand === 'aan'
  await tx.execute(sql`insert into overdrachten (id, organisation_id, account_id, afspraak_id, naar, naar_gebruiker_id, ontvanger, status, pakket, sleutel, op, door, volgende_poging_op, data)
    values (${id}, ${org}, ${accountId}, ${ap!.id}, ${inv.naar}, ${collega?.id ?? null}, ${inv.ontvanger ?? null}, 'klaar', ${JSON.stringify(pakket)}::jsonb, ${sleutel}, ${nu.toISOString()}, ${door.id}, ${versturen ? nu.toISOString() : null}, ${JSON.stringify({ stand: inv.naar === 'dealdrive' ? stand : null })}::jsonb)`)
  // Reis: overgedragen, status en fase (via de statusmachine; een account buiten de reis wordt alsnog gezet).
  try { await meldGebeurtenis(tx, { accountId, gebeurtenis: 'overgedragen', door: door.id, nu, zonderMotor: true, reden: `Naar ${NAAR_LABEL[inv.naar]}` }) } catch (e) { if (!(e instanceof ReisFout)) throw e }
  await tx.execute(sql`update accounts set nb_status = 'overgedragen', fase_id = 'overgedragen', updated_at = now() where id = ${accountId} and (nb_status <> 'overgedragen' or fase_id is distinct from 'overgedragen')`)
  // De overdrachtstaak uit "Rond af" is hiermee gedaan.
  await tx.execute(sql`update tasks set status = 'klaar', uitkomst = 'gedaan', updated_at = now() where account_id = ${accountId} and status in ('open', 'bezig') and title like 'Overdragen:%'`)
  const naamCollega = collega ? kort(collega.name) : null
  if (collega) {
    await tx.execute(sql`update accounts set owner_id = ${collega.id} where id = ${accountId}`)
    await tx.execute(sql`insert into tasks (id, organisation_id, owner_id, account_id, action_type, title, status, priority, due_date, executor, data) values (${crypto.randomUUID()}, ${org}, ${collega.id}, ${accountId}, 'taak', ${`${inv.vervolgstap.omschrijving.trim()}: ${a!.name}`}, 'open', 'hoog', ${inv.vervolgstap.datum ? `${inv.vervolgstap.datum}T09:00:00+02:00` : new Date(nu.getTime() + 864e5).toISOString()}, 'mens',
      ${JSON.stringify({ herkomst: { bron: 'overdracht' }, overdrachtId: id, briefing: ctx.briefing, aanleiding: `Overgedragen door ${kort(door.naam)}` })}::jsonb)`)
    await tx.execute(sql`insert into notificaties (id, organisation_id, gebruiker_id, soort, titel, tekst, link, op, data) values (${crypto.randomUUID()}, ${org}, ${collega.id}, 'hot', ${`${a!.name} is aan jou overgedragen`}, ${`${kort(door.naam)} droeg het account over met de vervolgstap: ${inv.vervolgstap.omschrijving.trim()}.`}, ${`/accounts/${accountId}`}, now(), '{}'::jsonb)`)
  } else if (!versturen) {
    // Zonder koppeling: een overdrachtstaak met de briefing om te mailen of te downloaden.
    await tx.execute(sql`insert into tasks (id, organisation_id, owner_id, account_id, action_type, title, status, priority, due_date, executor, data) values (${crypto.randomUUID()}, ${org}, ${door.id}, ${accountId}, 'taak', ${`Overdracht naar ${inv.naar === 'crm' ? 'het CRM' : 'DealDrive'}: ${a!.name}`}, 'open', 'hoog', ${new Date(nu.getTime() + 864e5).toISOString()}, 'mens',
      ${JSON.stringify({ herkomst: { bron: 'overdracht' }, overdrachtId: id, briefing: ctx.briefing, ontvanger: inv.ontvanger ?? null })}::jsonb)`)
  }
  await tx.execute(sql`insert into activiteiten (organisation_id, account_id, soort, door, op, data) values (${org}, ${accountId}, 'overdracht', ${door.id}, ${nu.toISOString()}, ${JSON.stringify({ overdrachtId: id, naar: inv.naar, gebeurtenis: 'overgedragen', tekst: `Overgedragen aan ${naamCollega ?? NAAR_LABEL[inv.naar]}` })}::jsonb)`)
  await schrijfAudit(tx, { organisationId: org, actorId: door.id, action: 'account.overdragen', resourceType: 'accounts', resourceId: accountId, changes: { overdrachtId: id, naar: inv.naar, naarGebruikerId: collega?.id ?? null, vervolgstap: inv.vervolgstap.omschrijving } })
  const tekst = collega ? `${a!.name} is overgedragen aan ${naamCollega}.` : versturen ? `${a!.name} is overgedragen aan ${inv.naar === 'crm' ? 'het CRM' : 'DealDrive'}.` : `${a!.name} is overgedragen. De overdrachtstaak met briefing staat klaar.`
  return { ...overdrachtUit((await rijen(tx, sql`select * from overdrachten where id = ${id}`))[0]!), tekst, versturen }
}

export const overdrachtUit = (o: Rij) => ({ id: o.id as string, accountId: o.account_id as string, naar: o.naar as OverdrachtNaar, naarGebruikerId: o.naar_gebruiker_id, status: o.status as string, externId: o.extern_id, externUrl: o.extern_url, pogingen: o.pogingen, laatsteFout: o.laatste_fout, op: iso(o.op), door: o.door, alKlant: !!o.data?.alKlant })

/** Versturen naar DealDrive (job). Succes: verstuurd en in de mock direct bevestigd; al klant: de vraag als taak; fout: opnieuw volgens het schema. */
export async function verstuurOverdracht(tx: Tx, id: string, nu = new Date(), koppeling?: DealDriveKoppeling | null) {
  const [o] = await rijen(tx, sql`select o.*, a.name, a.owner_id from overdrachten o join accounts a on a.id = o.account_id where o.id = ${id}`)
  if (!o || o.naar !== 'dealdrive' || !['klaar'].includes(o.status) || o.data?.alKlant) return null
  const k = koppeling !== undefined ? koppeling : await dealdriveKoppeling(tx)
  if (!k) return null
  // Het logboek bewaart geen body: alleen het overdracht-id en een hash van het pakket.
  const [run] = await rijen(tx, sql`insert into koppeling_runs (organisation_id, soort, handeling, start, fouten) values (${o.organisation_id}, 'dealdrive', 'overdragen', ${nu.toISOString()}, '[]'::jsonb) returning id`)
  let r: Awaited<ReturnType<DealDriveKoppeling['overdragen']>>
  try { r = await k.overdragen(o.pakket) } catch (e: any) { r = { ok: false, code: 'fout', bericht: e?.message ?? 'Onbekende fout', tijdelijk: true } }
  await tx.execute(sql`update koppeling_runs set eind = now(), geschreven = ${r.ok ? 1 : 0}, fouten = ${JSON.stringify(r.ok ? [] : [r.bericht])}::jsonb where id = ${run!.id}`)
  if (r.ok) {
    await tx.execute(sql`update overdrachten set status = ${r.bevestigd ? 'bevestigd' : 'verstuurd'}, extern_id = ${r.accountId}, extern_url = ${r.url}, pogingen = pogingen + 1, laatste_fout = null, volgende_poging_op = null, data = data || ${JSON.stringify({ dealId: r.dealId, verstuurdOp: nu.toISOString(), pakketHash: bodyHash(JSON.stringify(o.pakket)), antwoord: r.status })}::jsonb where id = ${id}`)
    // De link op de accountkaart (accounts.data.extern.dealdrive).
    const dd = { accountId: r.accountId, url: r.url, overgedragenOp: new Date(o.op).toISOString(), eigenaar: r.eigenaar ?? null, overdrachtId: id }
    await tx.execute(sql`update accounts set data = jsonb_set(coalesce(data, '{}'::jsonb), '{extern}', coalesce(data->'extern', '{}'::jsonb) || jsonb_build_object('dealdrive', ${JSON.stringify(dd)}::jsonb)) where id = ${o.account_id}`)
    return 'verstuurd'
  }
  if (r.code === 'al_klant') {
    await tx.execute(sql`update overdrachten set data = data || ${JSON.stringify({ alKlant: { accountId: r.accountId } })}::jsonb, volgende_poging_op = null, pogingen = pogingen + 1 where id = ${id}`)
    await tx.execute(sql`insert into tasks (id, organisation_id, owner_id, account_id, action_type, title, status, priority, due_date, executor, data) values (${crypto.randomUUID()}, ${o.organisation_id}, ${o.door}, ${o.account_id}, 'taak', ${`Al klant in DealDrive: ${o.name}`}, 'open', 'hoog', ${nu.toISOString()}, 'mens',
      ${JSON.stringify({ herkomst: { bron: 'overdracht' }, overdrachtId: id, aanleiding: 'Dit bedrijf is al klant in DealDrive. Overdragen als nieuwe kans bij een bestaande klant?', link: `/accounts/${o.account_id}?overdragen=1` })}::jsonb)`)
    return 'al_klant'
  }
  const pogingen = Number(o.pogingen) + 1
  const volgende = r.tijdelijk ? volgendePoging(pogingen, nu) : null
  if (volgende) {
    await tx.execute(sql`update overdrachten set pogingen = ${pogingen}, laatste_fout = ${r.bericht}, volgende_poging_op = ${volgende.toISOString()} where id = ${id}`)
    return 'opnieuw'
  }
  await tx.execute(sql`update overdrachten set status = 'mislukt', pogingen = ${pogingen}, laatste_fout = ${r.bericht}, volgende_poging_op = null where id = ${id}`)
  await tx.execute(sql`insert into tasks (id, organisation_id, owner_id, account_id, action_type, title, status, priority, due_date, executor, data) values (${crypto.randomUUID()}, ${o.organisation_id}, ${o.door}, ${o.account_id}, 'taak', ${`Overdracht naar DealDrive mislukt: ${o.name}`}, 'open', 'hoog', ${nu.toISOString()}, 'mens',
    ${JSON.stringify({ herkomst: { bron: 'overdracht' }, overdrachtId: id, aanleiding: `DealDrive nam de overdracht niet aan: ${r.bericht}. Kies Opnieuw proberen op de accountkaart.`, link: `/accounts/${o.account_id}` })}::jsonb)`)
  for (const b of await rijen(tx, sql`select id from users where role = 'beheerder' and status = 'actief'`)) {
    await tx.execute(sql`insert into notificaties (id, organisation_id, gebruiker_id, soort, titel, tekst, link, op, data) values (${crypto.randomUUID()}, ${o.organisation_id}, ${b.id}, 'kritiek', 'Overdracht naar DealDrive mislukt', ${`${o.name}: ${r.bericht}`}, ${`/accounts/${o.account_id}`}, now(), '{}'::jsonb)`)
  }
  return 'mislukt'
}

/** De wachtrij: alles met status klaar en een verstreken volgende poging. */
export async function verstuurWachtrij(tx: Tx, nu = new Date()) {
  const lijst = await rijen(tx, sql`select id, naar from overdrachten where status = 'klaar' and naar in ('dealdrive', 'crm') and volgende_poging_op is not null and volgende_poging_op <= ${nu.toISOString()} order by volgende_poging_op limit 50`)
  let n = 0
  for (const o of lijst) if (await (o.naar === 'crm' ? verstuurCrmOverdracht(tx, o.id, nu) : verstuurOverdracht(tx, o.id, nu))) n++
  return n
}

/** Opnieuw proberen na mislukt. */
export async function opnieuw(tx: Tx, id: string, nu = new Date()) {
  const [o] = await rijen(tx, sql`select * from overdrachten where id = ${id}`)
  if (!o) fout(404, 'Overdracht niet gevonden')
  if (o!.status !== 'mislukt') fout(409, 'Alleen een mislukte overdracht probeer je opnieuw')
  await tx.execute(sql`update overdrachten set status = 'klaar', pogingen = 0, laatste_fout = null, volgende_poging_op = ${nu.toISOString()} where id = ${id}`)
  await tx.execute(sql`update tasks set status = 'klaar', uitkomst = 'gedaan', updated_at = now() where data->>'overdrachtId' = ${id} and (title like 'Overdracht naar DealDrive mislukt%' or title like 'Overdracht naar het CRM mislukt%') and status = 'open'`)
  return o!
}

/** Schrijfrecht op het account: de eigenaar, de salesmanager van het team of de beheerder. */
export async function magAccount(tx: Tx, g: { id: string; rol: string }, accountId: string) {
  const [a] = await rijen(tx, sql`select owner_id from accounts where id = ${accountId}`)
  if (!a) fout(404, 'Account niet gevonden')
  if (!a!.owner_id || a!.owner_id === g.id || g.rol === 'beheerder') return true
  return g.rol === 'salesmanager' && (await teamLeden(tx, g)).includes(a!.owner_id)
}
