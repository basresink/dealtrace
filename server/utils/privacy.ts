// Privacy, bewaartermijnen en de export van de hele organisatie (pakket E). Alles binnen metOrganisatie:
// RLS op organisation_id, en elke query filtert daarnaast zelf op de organisatie uit de sessie.
import { sql } from 'drizzle-orm'
import { rolMag } from '../../shared/permissions'
import { isVerborgen } from '../../shared/settingKeys'
import type { Rol } from '../../shared/types'
import {
  BEWAAR_SOORTEN, EXPORT_MAX_RIJEN, EXPORT_ONDERDELEN, grensdatum, leesBewaartermijnen, naarCsv, termijnTekst,
  valideerBewaartermijnen, vervaltZin, type BewaarSoort, type Bewaartermijnen,
} from '../../shared/privacy'
import { schrijfAudit } from './audit'
import type { ZipBestand } from './zip'

type Tx = Parameters<Parameters<ReturnType<typeof import('./db').gebruikDb>['transaction']>[0]>[0]

const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Record<string, any>[]

/** Privacy en export zijn van de beheerder (rechtenmatrix: instellingen schrijven). De founder die meekijkt,
 * mag geen export van klantdata maken: dat beslist de beheerder van de klant zelf. */
export function vereisPrivacyBeheer(ctx: { gebruiker: { rol: Rol }; werkIn?: unknown }, opties: { export?: boolean } = {}) {
  if (!rolMag(ctx.gebruiker.rol, 'instellingen', 'schrijven')) throw createError({ statusCode: 403, statusMessage: 'Alleen de beheerder van de organisatie' })
  if (opties.export && ctx.werkIn) throw createError({ statusCode: 403, statusMessage: 'Een export van de organisatie maakt de beheerder van de klant zelf' })
}

// ── Bewaartermijnen ──────────────────────────────────────────────────────

export async function leesTermijnen(tx: Tx): Promise<{ termijnen: Bewaartermijnen; ingesteld: boolean; bijgewerktOp: string | null }> {
  const [r] = await rijen(tx, sql`select value, updated_at from org_settings where key = 'bewaartermijnen'`)
  return { termijnen: leesBewaartermijnen(r?.value), ingesteld: !!r, bijgewerktOp: r ? new Date(r.updated_at).toISOString() : null }
}

export interface Verval { soort: BewaarSoort; naam: string; maanden: number | null; termijn: string; grens: string | null; aantal: number; oudste: string | null; zin: string }

const TELLINGEN: Record<BewaarSoort, (org: string, grens: string) => ReturnType<typeof sql>> = {
  activiteiten: (org, g) => sql`select count(*)::int as n, min(op) as oudste from activiteiten where organisation_id = ${org} and op < ${g}`,
  verslagen: (org, g) => sql`select count(*)::int as n, min(op) as oudste from activiteit_verslagen where organisation_id = ${org} and op < ${g}`,
  gedeactiveerdeProspects: (org, g) => sql`select count(*)::int as n, min(gedeactiveerd_op) as oudste from accounts where organisation_id = ${org} and gedeactiveerd_op is not null and gedeactiveerd_op < ${g}`,
  gearchiveerdeGebruikers: (org, g) => sql`select count(*)::int as n, min(updated_at) as oudste from users where organisation_id = ${org} and status = 'gearchiveerd' and updated_at < ${g}`,
}

/** Wat er bij de volgende opschoning zou vervallen: alleen tellen, er wordt niets verwijderd. */
export async function vervaltOverzicht(tx: Tx, org: string, termijnen: Bewaartermijnen, nu = new Date()): Promise<Verval[]> {
  const uit: Verval[] = []
  for (const d of BEWAAR_SOORTEN) {
    const maanden = termijnen[d.soort]
    if (maanden === null) {
      uit.push({ soort: d.soort, naam: d.naam, maanden, termijn: termijnTekst(maanden), grens: null, aantal: 0, oudste: null, zin: vervaltZin(d, maanden, 0) })
      continue
    }
    const grens = grensdatum(nu, maanden).toISOString()
    const [r] = await rijen(tx, TELLINGEN[d.soort](org, grens))
    const aantal = Number(r?.n ?? 0)
    uit.push({ soort: d.soort, naam: d.naam, maanden, termijn: termijnTekst(maanden), grens, aantal, oudste: r?.oudste ? new Date(r.oudste).toISOString() : null, zin: vervaltZin(d, maanden, aantal) })
  }
  return uit
}

export async function bewaarTermijnen(tx: Tx, org: string, actorId: string, invoer: unknown): Promise<Bewaartermijnen> {
  const { waarde, fouten } = valideerBewaartermijnen(invoer)
  if (!waarde) throw createError({ statusCode: 422, statusMessage: fouten.join('; ') })
  const oud = (await leesTermijnen(tx)).termijnen
  await tx.execute(sql`insert into org_settings (organisation_id, key, value, updated_at) values (${org}, 'bewaartermijnen', ${JSON.stringify(waarde)}::jsonb, now())
    on conflict (organisation_id, key) do update set value = excluded.value, updated_at = now()`)
  await schrijfAudit(tx, { organisationId: org, actorId, action: 'privacy.bewaartermijnen', resourceType: 'org_settings', resourceId: 'bewaartermijnen', changes: { van: oud, naar: waarde } })
  return waarde
}

// ── Export van de hele organisatie ────────────────────────────────────────

interface ExportTabel { bestand: string; kolommen: string[]; query: (org: string) => ReturnType<typeof sql>; tel: (org: string) => ReturnType<typeof sql> }

const tel = (tabel: string) => (org: string) => sql`select count(*)::int as n from ${sql.raw(tabel)} where organisation_id = ${org}`

/** Per bestand de kolommen. Geheimen (inlogcodes, sleutels van koppelingen, tweestapsgeheimen in users.data)
 * en bijlagen zelf gaan er nooit in. */
export const EXPORT_TABELLEN: readonly ExportTabel[] = [
  {
    bestand: 'accounts.csv', tel: tel('accounts'),
    kolommen: ['id', 'naam', 'soort', 'klasse', 'eigenaar_id', 'status', 'fase_id', 'fase_sinds', 'score', 'laatste_contact_op', 'plaats', 'postcode', 'kvk', 'domein', 'terug_op', 'gedeactiveerd_op', 'aangemaakt_op', 'gewijzigd_op', 'gegevens'],
    query: (org) => sql`select id, name as naam, account_kind as soort, klasse, owner_id as eigenaar_id, nb_status as status, fase_id, fase_sinds, score, laatste_contact_op,
      city as plaats, postcode, kvk, domein, terug_op, gedeactiveerd_op, created_at as aangemaakt_op, updated_at as gewijzigd_op, data as gegevens
      from accounts where organisation_id = ${org} order by created_at, id`,
  },
  {
    bestand: 'contactpersonen.csv', tel: tel('contacts'),
    kolommen: ['id', 'account_id', 'voornaam', 'achternaam', 'email', 'rol', 'status', 'aangemaakt_op', 'gewijzigd_op', 'gegevens'],
    query: (org) => sql`select id, account_id, first_name as voornaam, last_name as achternaam, email, rol, status, created_at as aangemaakt_op, updated_at as gewijzigd_op, data as gegevens
      from contacts where organisation_id = ${org} order by created_at, id`,
  },
  {
    bestand: 'taken.csv', tel: tel('tasks'),
    kolommen: ['id', 'eigenaar_id', 'account_id', 'contact_id', 'titel', 'soort', 'status', 'prioriteit', 'vervaldatum', 'uitkomst', 'later_op', 'campagne_id', 'accountplan_id', 'aangemaakt_op', 'gewijzigd_op', 'gegevens'],
    query: (org) => sql`select id, owner_id as eigenaar_id, account_id, contact_id, title as titel, action_type as soort, status, priority as prioriteit, due_date as vervaldatum, uitkomst, later_op,
      campaign_id as campagne_id, accountplan_id, created_at as aangemaakt_op, updated_at as gewijzigd_op, data as gegevens
      from tasks where organisation_id = ${org} order by created_at, id`,
  },
  {
    bestand: 'afspraken.csv', tel: tel('appointments'),
    kolommen: ['id', 'eigenaar_id', 'account_id', 'contact_id', 'meetingsoort_id', 'vorm', 'status', 'start', 'eind', 'uitkomst', 'uitkomst_op', 'aangemaakt_op', 'gegevens'],
    query: (org) => sql`select id, owner_id as eigenaar_id, account_id, contact_id, meetingsoort_id, vorm, status, start_at as start, end_at as eind, uitkomst_code as uitkomst, uitkomst_op,
      created_at as aangemaakt_op, data as gegevens
      from appointments where organisation_id = ${org} order by start_at, id`,
  },
  {
    bestand: 'activiteiten.csv', tel: tel('activiteiten'),
    kolommen: ['id', 'account_id', 'contact_id', 'taak_id', 'campagne_id', 'uitvoerder', 'agent', 'kanaal', 'soort', 'uitkomst', 'door', 'op', 'gegevens'],
    query: (org) => sql`select id, account_id, contact_id, task_id as taak_id, campaign_id as campagne_id, uitvoerder, agent, kanaal, soort, uitkomst, door, op, data as gegevens
      from activiteiten where organisation_id = ${org} order by op, id`,
  },
  {
    bestand: 'verslagen.csv', tel: tel('activiteit_verslagen'),
    kolommen: ['id', 'activiteit_id', 'taak_id', 'tekst', 'bron', 'door', 'op'],
    query: (org) => sql`select id, activiteit_id, task_id as taak_id, tekst, bron, door, op from activiteit_verslagen where organisation_id = ${org} order by op, id`,
  },
  {
    bestand: 'campagnes.csv', tel: tel('campagnes'),
    kolommen: ['id', 'naam', 'soort', 'status', 'eigenaar_id', 'start', 'eind', 'aangemaakt_op', 'gegevens'],
    query: (org) => sql`select id, naam, soort, status, eigenaar_id, started_at as start, ends_at as eind, created_at as aangemaakt_op, data as gegevens
      from campagnes where organisation_id = ${org} order by created_at, id`,
  },
  {
    bestand: 'campagne-accounts.csv', tel: tel('campagne_items'),
    kolommen: ['id', 'campagne_id', 'account_id', 'kolom', 'poging', 'volgende_stap', 'volgende_op', 'eigenaar_id', 'winpunt_uitgevoerd', 'einddoel_gehaald', 'gewijzigd_op'],
    query: (org) => sql`select id, campagne_id, account_id, kolom, poging, volgende_stap, volgende_op, eigenaar_id, winpunt_uitgevoerd, einddoel_gehaald, updated_at as gewijzigd_op
      from campagne_items where organisation_id = ${org} order by campagne_id, id`,
  },
  {
    bestand: 'accountplannen.csv', tel: tel('accountplannen'),
    kolommen: ['id', 'account_id', 'eigenaar_id', 'titel', 'status', 'geldig_van', 'geldig_tot', 'aangemaakt_op', 'gewijzigd_op', 'gegevens'],
    query: (org) => sql`select id, account_id, owner_id as eigenaar_id, titel, status, geldig_van, geldig_tot, created_at as aangemaakt_op, updated_at as gewijzigd_op, data as gegevens
      from accountplannen where organisation_id = ${org} order by created_at, id`,
  },
  {
    bestand: 'gebruikers.csv', tel: tel('users'),
    kolommen: ['id', 'naam', 'email', 'rol', 'niveau', 'werkplek', 'team_id', 'status', 'laatste_inlog', 'aangemaakt_op'],
    query: (org) => sql`select id, name as naam, email, role as rol, niveau, werkplek, team_id, status, laatste_inlog, created_at as aangemaakt_op
      from users where organisation_id = ${org} order by created_at, id`,
  },
  {
    bestand: 'teams.csv', tel: tel('teams'),
    kolommen: ['id', 'naam', 'manager_ids', 'gekoppelde_teams', 'aangemaakt_op'],
    query: (org) => sql`select id, naam, manager_ids, gekoppelde_teams, created_at as aangemaakt_op from teams where organisation_id = ${org} order by created_at, id`,
  },
]

export interface ExportUitslag { bestanden: ZipBestand[]; aantallen: Record<string, number>; rijen: number }

/** Bouwt alle bestanden van de export van één organisatie. Schrijft niets; de auditregel doet de aanroeper. */
export async function bouwExport(tx: Tx, org: string, meta: { organisatieNaam: string; door: string; nu?: Date }): Promise<ExportUitslag> {
  const nu = meta.nu ?? new Date()
  let totaal = 0
  for (const t of EXPORT_TABELLEN) totaal += Number((await rijen(tx, t.tel(org)))[0]?.n ?? 0)
  if (totaal > EXPORT_MAX_RIJEN) throw createError({ statusCode: 413, statusMessage: `De organisatie heeft ${totaal} rijen; meer dan ${EXPORT_MAX_RIJEN} exporteert Dealtrace nog niet in één keer. Vraag Dealtrace om een export.` })
  const bestanden: ZipBestand[] = []
  const aantallen: Record<string, number> = {}
  let n = 0
  for (const t of EXPORT_TABELLEN) {
    const r = await rijen(tx, t.query(org))
    aantallen[t.bestand] = r.length
    n += r.length
    bestanden.push({ naam: t.bestand, inhoud: naarCsv(t.kolommen, r) })
  }
  const instellingen: Record<string, unknown> = {}
  for (const s of await rijen(tx, sql`select key, value from org_settings where organisation_id = ${org} order by key`)) if (!isVerborgen(s.key)) instellingen[s.key] = s.value
  aantallen['instellingen.json'] = Object.keys(instellingen).length
  bestanden.push({
    naam: 'instellingen.json',
    inhoud: JSON.stringify({ organisatie: meta.organisatieNaam, gemaaktOp: nu.toISOString(), gemaaktDoor: meta.door, bestanden: EXPORT_ONDERDELEN.map((o) => ({ ...o, rijen: aantallen[o.bestand] ?? 0 })), instellingen }, null, 2),
  })
  return { bestanden, aantallen, rijen: n }
}

export async function auditExport(tx: Tx, org: string, actorId: string, u: Pick<ExportUitslag, 'aantallen' | 'rijen'>) {
  await schrijfAudit(tx, { organisationId: org, actorId, action: 'organisatie.export', resourceType: 'organisatie', resourceId: org, metadata: { rijen: u.rijen, aantallen: u.aantallen } })
}
