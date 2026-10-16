// De Kennisbank (opzet van DealDrive /kennisbank) op de server: de lijst met zoeken en filteren, het document
// met zijn velden en koppelingen voor de flyout, uploaden met koppeling aan accounts en contacten, verwijderen
// en de documenten voor het tabblad Documenten van de account- en contactkaart. Iedereen in de organisatie ziet
// alle documenten; verwijderen mag wie het uploadde en de beheerder.
import { sql } from 'drizzle-orm'
import { DOCUMENT_TYPES, MAX_GROOTTE, TOEGESTANE_MIME, isDocumentType, mimeVoor, raadType, zoekTermGeldig, type DocumentType } from '../../shared/kennisbank'
import type { Rol } from '../../shared/types'
import { schrijfAudit } from './audit'
import { leesDocumentTekst } from './documentTekst'

type Tx = Parameters<Parameters<ReturnType<typeof import('./db').gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]
const iso = (d: unknown) => (d ? new Date(d as string).toISOString() : null)
const kaal = (n: unknown) => (n ? String(n).replace(/^Testgebruiker /, '') : null)
const naamVan = (r: Rij) => [r.first_name, r.last_name].filter(Boolean).join(' ')

export interface KennisbankGebruiker { id: string; rol: Rol }
export const magDocumentVerwijderen = (g: KennisbankGebruiker, eigenaarId: string | null) => eigenaarId === g.id || g.rol === 'beheerder'

/** De koppelingen van een rij documenten: accounts en contacten met naam. */
async function koppelingenVan(tx: Tx, ids: string[]) {
  const per = new Map<string, { accounts: { id: string; naam: string }[]; contacten: { id: string; naam: string; accountId: string }[] }>()
  for (const id of ids) per.set(id, { accounts: [], contacten: [] })
  if (!ids.length) return per
  const lijst = sql.join(ids.map((x) => sql`${x}`), sql`, `)
  for (const k of await rijen(tx, sql`select k.document_id, k.account_id, a.name as account_naam, k.contact_id, c.first_name, c.last_name
    from document_koppelingen k join accounts a on a.id = k.account_id left join contacts c on c.id = k.contact_id
    where k.document_id in (${lijst}) order by a.name, c.last_name`)) {
    const p = per.get(k.document_id)!
    if (!p.accounts.some((a) => a.id === k.account_id)) p.accounts.push({ id: k.account_id, naam: k.account_naam })
    if (k.contact_id) p.contacten.push({ id: k.contact_id, naam: naamVan(k), accountId: k.account_id })
  }
  return per
}

function rijNaarDocument(d: Rij, g: KennisbankGebruiker, k: { accounts: any[]; contacten: any[] } | undefined) {
  return {
    id: d.id as string, naam: d.naam as string, type: d.type as DocumentType, versie: d.versie as string, beschrijving: (d.beschrijving as string | null) ?? null,
    mime: d.mime as string, grootte: Number(d.grootte), tekstStatus: d.tekst_status as string,
    eigenaar: d.eigenaar_id ? { id: d.eigenaar_id as string, naam: kaal(d.door_naam) } : null,
    gemaaktOp: iso(d.gemaakt_op)!, bijgewerktOp: iso(d.bijgewerkt_op)!,
    accounts: k?.accounts ?? [], contacten: k?.contacten ?? [],
    magVerwijderen: magDocumentVerwijderen(g, d.eigenaar_id ?? null),
  }
}
export type KennisbankDocument = ReturnType<typeof rijNaarDocument>

export interface KennisbankFilter { zoek?: string | null; type?: string | null; eigen?: boolean; koppeling?: 'met' | 'zonder' | null }

/** De kennisbank: nieuwste eerst, met tellers per type die het zoeken en de andere filters meetellen. */
export async function kennisbankLijst(tx: Tx, g: KennisbankGebruiker, f: KennisbankFilter = {}) {
  const q = zoekTermGeldig(f.zoek)
  const patroon = q ? `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%` : null
  const zoekVoorwaarde = patroon
    ? sql`and (d.naam ilike ${patroon} or coalesce(d.beschrijving, '') ilike ${patroon} or coalesce(d.tekst, '') ilike ${patroon}
        or exists (select 1 from document_koppelingen k join accounts a on a.id = k.account_id left join contacts c on c.id = k.contact_id
          where k.document_id = d.id and (a.name ilike ${patroon} or concat_ws(' ', c.first_name, c.last_name) ilike ${patroon})))`
    : sql``
  const eigen = f.eigen ? sql`and d.eigenaar_id = ${g.id}` : sql``
  const koppeling = f.koppeling === 'met' ? sql`and exists (select 1 from document_koppelingen k where k.document_id = d.id)`
    : f.koppeling === 'zonder' ? sql`and not exists (select 1 from document_koppelingen k where k.document_id = d.id)` : sql``
  const type = isDocumentType(f.type) ? f.type : null
  const tellingRijen = await rijen(tx, sql`select d.type, count(*)::int as n from documenten d where true ${zoekVoorwaarde} ${eigen} ${koppeling} group by d.type`)
  const tellers = Object.fromEntries(DOCUMENT_TYPES.map((t) => [t, 0])) as Record<DocumentType, number>
  for (const r of tellingRijen) if (isDocumentType(r.type)) tellers[r.type] = r.n
  const alle = Object.values(tellers).reduce((s, n) => s + n, 0)
  const docs = await rijen(tx, sql`select d.id, d.naam, d.type, d.versie, d.beschrijving, d.mime, d.grootte, d.tekst_status, d.eigenaar_id, d.gemaakt_op, d.bijgewerkt_op, u.name as door_naam
    from documenten d left join users u on u.id = d.eigenaar_id
    where true ${zoekVoorwaarde} ${eigen} ${koppeling} ${type ? sql`and d.type = ${type}` : sql``}
    order by d.bijgewerkt_op desc, d.naam limit 200`)
  const k = await koppelingenVan(tx, docs.map((d) => d.id))
  const [{ n: totaalOrg }] = await rijen(tx, sql`select count(*)::int as n from documenten`) as [{ n: number }]
  return { documenten: docs.map((d) => rijNaarDocument(d, g, k.get(d.id))), totaal: type ? tellers[type] : alle, tellers, alle, totaalOrg }
}

/** Eén document voor de flyout. Een verhuisd document zonder uitgelezen tekst wordt nu uitgelezen. */
export async function documentDetail(tx: Tx, id: string, g: KennisbankGebruiker) {
  const [d] = await rijen(tx, sql`select d.id, d.naam, d.type, d.versie, d.beschrijving, d.mime, d.grootte, d.tekst, d.tekst_status, d.eigenaar_id, d.gemaakt_op, d.bijgewerkt_op, u.name as door_naam
    from documenten d left join users u on u.id = d.eigenaar_id where d.id = ${id}`)
  if (!d) throw createError({ statusCode: 404, statusMessage: 'Document niet gevonden' })
  if (d.tekst_status === 'onbekend') {
    const [b] = await rijen(tx, sql`select inhoud from documenten where id = ${id}`)
    const t = await leesDocumentTekst(d.mime, b?.inhoud ?? null)
    await tx.execute(sql`update documenten set tekst = ${t.tekst}, tekst_status = ${t.status} where id = ${id}`)
    d.tekst = t.tekst
    d.tekst_status = t.status
  }
  const k = await koppelingenVan(tx, [id])
  return { ...rijNaarDocument(d, g, k.get(id)), tekst: (d.tekst as string | null) ?? null }
}

/** Het bestand zelf. */
export async function documentBestand(tx: Tx, id: string) {
  const [d] = await rijen(tx, sql`select naam, mime, inhoud from documenten where id = ${id}`)
  if (!d?.inhoud) throw createError({ statusCode: 404, statusMessage: 'Document niet gevonden' })
  return { naam: d.naam as string, mime: d.mime as string, inhoud: d.inhoud as Buffer }
}

export interface KennisbankUpload {
  naam?: string; mime?: string; data?: string; type?: string; versie?: string; beschrijving?: string
  accountIds?: string[]; contactIds?: string[]
}

/**
 * Een document uploaden: PDF, Office, tekst, Markdown of een afbeelding tot 8 MB (415 en 413). Het type wordt
 * geraden als het er niet bij staat. Een contact koppelt ook zijn account; een onbekend account of contact geeft 422.
 */
export async function maakDocument(tx: Tx, org: string, g: KennisbankGebruiker, b: KennisbankUpload) {
  const naam = String(b?.naam ?? '').trim().slice(0, 200)
  if (!naam || !b?.data) throw createError({ statusCode: 400, statusMessage: 'Kies een document' })
  const mime = mimeVoor(naam, b.mime)
  if (!TOEGESTANE_MIME.test(mime)) throw createError({ statusCode: 415, statusMessage: 'Alleen PDF, Office, tekst of afbeeldingen' })
  const inhoud = Buffer.from(b.data, 'base64')
  if (!inhoud.length) throw createError({ statusCode: 400, statusMessage: 'Het document is leeg' })
  if (inhoud.length > MAX_GROOTTE) throw createError({ statusCode: 413, statusMessage: 'Het document is groter dan 8 MB' })
  const type = isDocumentType(b.type) ? b.type : raadType(naam, mime)
  const versie = String(b.versie ?? '').trim().replace(/^v/i, '').slice(0, 20) || '1'
  const beschrijving = String(b.beschrijving ?? '').trim().slice(0, 1000) || null

  const accountIds = [...new Set((b.accountIds ?? []).filter((x) => typeof x === 'string' && x))]
  const contactIds = [...new Set((b.contactIds ?? []).filter((x) => typeof x === 'string' && x))]
  const koppelingen: { accountId: string; contactId: string | null }[] = []
  if (accountIds.length) {
    const gevonden = new Set((await rijen(tx, sql`select id from accounts where id in (${sql.join(accountIds.map((x) => sql`${x}`), sql`, `)})`)).map((r) => r.id))
    const mist = accountIds.find((x) => !gevonden.has(x))
    if (mist) throw createError({ statusCode: 422, statusMessage: 'Account onbekend' })
    for (const a of accountIds) koppelingen.push({ accountId: a, contactId: null })
  }
  if (contactIds.length) {
    const cs = await rijen(tx, sql`select id, account_id from contacts where id in (${sql.join(contactIds.map((x) => sql`${x}`), sql`, `)})`)
    if (cs.length !== contactIds.length) throw createError({ statusCode: 422, statusMessage: 'Contact onbekend' })
    for (const c of cs) koppelingen.push({ accountId: c.account_id, contactId: c.id })
  }

  const t = await leesDocumentTekst(mime, inhoud)
  const id = crypto.randomUUID()
  await tx.execute(sql`insert into documenten (id, organisation_id, naam, type, versie, beschrijving, mime, grootte, inhoud, tekst, tekst_status, eigenaar_id)
    values (${id}, ${org}, ${naam}, ${type}, ${versie}, ${beschrijving}, ${mime}, ${inhoud.length}, ${inhoud}, ${t.tekst}, ${t.status}, ${g.id})`)
  for (const k of koppelingen) {
    await tx.execute(sql`insert into document_koppelingen (organisation_id, document_id, account_id, contact_id) values (${org}, ${id}, ${k.accountId}, ${k.contactId}) on conflict do nothing`)
  }
  await schrijfAudit(tx, { organisationId: org, actorId: g.id, action: 'document.uploaden', resourceType: 'documenten', resourceId: id, changes: { naam, type, versie, accountIds, contactIds } })
  return { id, naam, type, versie, tekstStatus: t.status }
}

/** Verwijderen: wie het uploadde of de beheerder; anders 403. */
export async function verwijderDocument(tx: Tx, org: string, id: string, g: KennisbankGebruiker) {
  const [d] = await rijen(tx, sql`select id, naam, eigenaar_id from documenten where id = ${id}`)
  if (!d) throw createError({ statusCode: 404, statusMessage: 'Document niet gevonden' })
  if (!magDocumentVerwijderen(g, d.eigenaar_id)) throw createError({ statusCode: 403, statusMessage: 'Alleen wie het document uploadde of de beheerder verwijdert het' })
  await tx.execute(sql`delete from documenten where id = ${id}`)
  await schrijfAudit(tx, { organisationId: org, actorId: g.id, action: 'document.verwijderen', resourceType: 'documenten', resourceId: id, changes: { naam: d.naam } })
  return { ok: true }
}

/** De documenten op het tabblad Documenten: van het account en zijn contacten, of alleen van het contact. */
export async function documentenVoorKaart(tx: Tx, b: { accountIds: string[]; contactId?: string | null }, g: KennisbankGebruiker) {
  if (!b.accountIds.length && !b.contactId) return []
  const waar = b.contactId
    ? sql`k.contact_id = ${b.contactId}`
    : sql`k.account_id in (${sql.join(b.accountIds.map((x) => sql`${x}`), sql`, `)})`
  const docs = await rijen(tx, sql`select d.id, d.naam, d.type, d.versie, d.beschrijving, d.mime, d.grootte, d.tekst_status, d.eigenaar_id, d.gemaakt_op, d.bijgewerkt_op, u.name as door_naam
    from documenten d left join users u on u.id = d.eigenaar_id
    where exists (select 1 from document_koppelingen k where k.document_id = d.id and ${waar})
    order by d.bijgewerkt_op desc`)
  const k = await koppelingenVan(tx, docs.map((d) => d.id))
  return docs.map((d) => rijNaarDocument(d, g, k.get(d.id)))
}
