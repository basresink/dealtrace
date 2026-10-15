// Drizzle-schema van de tabellen uit 0001_fundament.sql. De SQL-migratie is de
// bron; dit schema geeft de server getypte queries.

import { boolean, doublePrecision, integer, jsonb, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core'

const ts = (naam: string) => timestamp(naam, { withTimezone: true, mode: 'string' })

/** Contract en abonnement (F23); Stripe komt in P24. */
export interface Contract {
  status?: 'proef' | 'actief' | 'opgezegd'
  seats?: number
  prijs?: number
  start?: string
  looptijdMaanden?: number
  opzegtermijnMaanden?: number
  proefTot?: string
  proefMeldingOp?: string
}

export interface OrganisatieData {
  toegangLeverancier?: 'altijd' | 'na_toestemming'
  gebruikersStand?: 'aanvragen' | 'zelf'
  contact?: { naam?: string; email?: string; telefoon?: string; adres?: string }
  startset?: Record<string, string>
  [k: string]: unknown
}

export const organisations = pgTable('organisations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  pakket: text('pakket').notNull(),
  features: jsonb('features').$type<{ aan?: string[]; uit?: string[] }>().notNull(),
  contract: jsonb('contract').$type<Contract>().notNull(),
  stripeCustomerId: text('stripe_customer_id'),
  status: text('status').notNull(),
  data: jsonb('data').$type<OrganisatieData>().notNull(),
  createdAt: ts('created_at').notNull(),
  updatedAt: ts('updated_at').notNull(),
})

export const teams = pgTable('teams', {
  id: text('id').primaryKey(),
  organisationId: text('organisation_id').notNull(),
  naam: text('naam').notNull(),
  managerIds: text('manager_ids').array().notNull(),
  gekoppeldeTeams: text('gekoppelde_teams').array().notNull(),
  data: jsonb('data').$type<Record<string, unknown>>().notNull(),
  createdAt: ts('created_at').notNull(),
  updatedAt: ts('updated_at').notNull(),
})

export interface GebruikerData {
  niveauHistorie?: { van: string; naar: string; op: string; door: string; reden?: string }[]
  verborgen?: string[]
  nieuwTot?: Record<string, string>
}

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  organisationId: text('organisation_id'),
  email: text('email').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  niveau: text('niveau').notNull(),
  teamId: text('team_id'),
  werkplek: text('werkplek').notNull(),
  laatsteInlog: ts('laatste_inlog'),
  status: text('status').notNull(),
  data: jsonb('data').$type<GebruikerData>().notNull(),
  createdAt: ts('created_at').notNull(),
  updatedAt: ts('updated_at').notNull(),
})

export const orgSettings = pgTable('org_settings', {
  organisationId: text('organisation_id').notNull(),
  key: text('key').notNull(),
  value: jsonb('value').notNull(),
  updatedAt: ts('updated_at').notNull(),
}, (t) => [primaryKey({ columns: [t.organisationId, t.key] })])

export const functiesPerNiveau = pgTable('functies_per_niveau', {
  id: text('id').primaryKey(),
  functie: text('functie').notNull(),
  niveau: text('niveau').notNull(),
  aan: boolean('aan').notNull(),
  organisationId: text('organisation_id'),
  gewijzigdDoor: text('gewijzigd_door'),
  gewijzigdOp: ts('gewijzigd_op').notNull(),
})

export const auditEvents = pgTable('audit_events', {
  id: text('id').primaryKey(),
  organisationId: text('organisation_id').notNull(),
  actorId: text('actor_id').notNull(),
  action: text('action').notNull(),
  resourceType: text('resource_type').notNull(),
  resourceId: text('resource_id'),
  changes: jsonb('changes'),
  metadata: jsonb('metadata'),
  occurredAt: ts('occurred_at').notNull(),
})

export const serverRecords = pgTable('server_records', {
  key: text('key').primaryKey(),
  organisationId: text('organisation_id').notNull(),
  version: integer('version').notNull(),
  updatedAt: ts('updated_at').notNull(),
  updatedBy: text('updated_by').notNull(),
})

export const mutaties = pgTable('mutaties', {
  id: text('id').primaryKey(),
  organisationId: text('organisation_id').notNull(),
  userId: text('user_id').notNull(),
  tabel: text('tabel').notNull(),
  op: text('op').notNull(),
  recordId: text('record_id').notNull(),
  resultaat: jsonb('resultaat').notNull(),
  appliedAt: ts('applied_at').notNull(),
})

export const notificaties = pgTable('notificaties', {
  id: text('id').primaryKey(),
  organisationId: text('organisation_id').notNull(),
  gebruikerId: text('gebruiker_id').notNull(),
  soort: text('soort').notNull(),
  titel: text('titel').notNull(),
  tekst: text('tekst'),
  link: text('link'),
  gelezenOp: ts('gelezen_op'),
  verborgenOp: ts('verborgen_op'),
  op: ts('op').notNull(),
  data: jsonb('data').notNull(),
})

export const persoonlijkeInstellingen = pgTable('persoonlijke_instellingen', {
  id: text('id').primaryKey(),
  organisationId: text('organisation_id').notNull(),
  data: jsonb('data').$type<Record<string, unknown>>().notNull(),
  updatedAt: ts('updated_at').notNull(),
})

// P02: platform
export const gebruikersaanvragen = pgTable('gebruikersaanvragen', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: text('organisation_id').notNull(),
  aangevraagdDoor: text('aangevraagd_door').notNull(),
  data: jsonb('data').$type<{ naam: string; email: string; rol: string; niveau?: string; werkplek?: string; teamId?: string | null }>().notNull(),
  status: text('status').notNull().default('open'),
  afgehandeldDoor: text('afgehandeld_door'),
  afgehandeldOp: ts('afgehandeld_op'),
  aangevraagdOp: ts('aangevraagd_op').defaultNow().notNull(),
})

export const orgGezondheid = pgTable('org_gezondheid', {
  organisationId: text('organisation_id').primaryKey(),
  stand: text('stand').notNull(),
  redenen: text('redenen').array().notNull(),
  gebruikers: integer('gebruikers').notNull(),
  metLogin: integer('met_login').notNull(),
  laatstActief: ts('laatst_actief'),
  berekendOp: ts('berekend_op').defaultNow().notNull(),
})

export const platformAudit = pgTable('platform_audit', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  actorId: text('actor_id').notNull(),
  actieveOrganisatie: text('actieve_organisatie'),
  handeling: text('handeling').notNull(),
  object: text('object'),
  voor: jsonb('voor'),
  na: jsonb('na'),
  reden: text('reden'),
  ip: text('ip'),
  op: ts('op').defaultNow().notNull(),
})

export const toegangsverzoeken = pgTable('toegangsverzoeken', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: text('organisation_id').notNull(),
  founderId: text('founder_id').notNull(),
  founderNaam: text('founder_naam').notNull(),
  reden: text('reden').notNull(),
  modus: text('modus').notNull(),
  status: text('status').notNull().default('open'),
  aangevraagdOp: ts('aangevraagd_op').defaultNow().notNull(),
  geldigTot: ts('geldig_tot').notNull(),
  beslotenDoor: text('besloten_door'),
  beslotenOp: ts('besloten_op'),
})

// Activiteitenlog (0001): alleen toevoegen.
export const activiteiten = pgTable('activiteiten', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: text('organisation_id').notNull(),
  accountId: text('account_id'),
  contactId: text('contact_id'),
  taskId: text('task_id'),
  campaignId: text('campaign_id'),
  uitvoerder: text('uitvoerder').notNull().default('mens'),
  agent: text('agent'),
  kanaal: text('kanaal'),
  soort: text('soort').notNull(),
  uitkomst: text('uitkomst'),
  scriptId: text('script_id'),
  door: text('door'),
  op: ts('op').defaultNow().notNull(),
  data: jsonb('data').$type<Record<string, any>>().notNull().default({}),
})

// P03: accounts, contacten, eigen velden
export interface AccountData {
  adres?: string
  website?: string
  telefoon?: string
  email?: string
  linkedin?: string
  sbi?: string[]
  medewerkers?: number
  branche?: string
  land?: string
  provincie?: string
  aanleiding?: { tekst: string; heet?: boolean; op: string; bron?: string }
  dossier?: { op?: string; criteria?: number; kernfeiten?: string[] }
  band?: Partial<Record<'behoefte' | 'autoriteit' | 'noodzaak' | 'draagvlak', { ja: boolean; bron?: string }>>
  herkomst?: Record<string, { bron: string; op: string; door?: string }>
  customFields?: Record<string, unknown>
  samengevoegdUit?: string[]
  scoreOpbouw?: unknown
  verwijderd?: boolean
  [k: string]: unknown
}

export const accounts = pgTable('accounts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: text('organisation_id').notNull(),
  name: text('name').notNull(),
  accountKind: text('account_kind').notNull().default('prospect'),
  klasse: text('klasse'),
  ownerId: text('owner_id'),
  nbStatus: text('nb_status').notNull().default('nieuw'),
  reisId: text('reis_id'),
  faseId: text('fase_id'),
  faseSinds: ts('fase_sinds'),
  doelgroepId: text('doelgroep_id'),
  gebiedId: text('gebied_id'),
  score: integer('score').notNull().default(0),
  laatsteContactOp: ts('laatste_contact_op'),
  city: text('city'),
  postcode: text('postcode'),
  kvk: text('kvk'),
  domein: text('domein'),
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  nbBron: text('nb_bron'),
  vvBrancheId: text('vv_branche_id'),
  huidigeLeverancierId: text('huidige_leverancier_id'),
  terugOp: text('terug_op'),
  terugRegelId: text('terug_regel_id'),
  data: jsonb('data').$type<AccountData>().notNull().default({}),
  createdAt: ts('created_at').defaultNow().notNull(),
  updatedAt: ts('updated_at').defaultNow().notNull(),
})

export interface ContactData {
  functie?: string
  telefoon?: string
  mobiel?: string
  linkedin?: string
  jarenInRol?: number
  bronUrl?: string
  bron?: string
  zekerheid?: number
  consent?: { email?: { status: 'onbekend' | 'ja' | 'nee'; op?: string; bron?: string }; whatsapp?: { status: 'onbekend' | 'ja' | 'nee'; op?: string; bron?: string } }
  voorkeurskanaal?: 'telefoon' | 'email' | 'whatsapp' | null
  belMeNiet?: boolean
  herkomst?: Record<string, { bron: string; op: string; door?: string }>
  customFields?: Record<string, unknown>
  vertrokkenOp?: string
  samengevoegdUit?: string[]
  [k: string]: unknown
}

export const contacts = pgTable('contacts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: text('organisation_id').notNull(),
  accountId: text('account_id').notNull(),
  firstName: text('first_name'),
  lastName: text('last_name').notNull(),
  email: text('email'),
  rol: text('rol').notNull().default('onbekend'),
  status: text('status').notNull().default('actief'),
  data: jsonb('data').$type<ContactData>().notNull().default({}),
  createdAt: ts('created_at').defaultNow().notNull(),
  updatedAt: ts('updated_at').defaultNow().notNull(),
})

export const eigenVelden = pgTable('eigen_velden', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: text('organisation_id').notNull(),
  object: text('object').notNull(),
  sleutel: text('sleutel').notNull(),
  naam: text('naam').notNull(),
  type: text('type').notNull(),
  sectie: text('sectie').notNull().default('Stamgegevens'),
  volgorde: integer('volgorde').notNull().default(0),
  data: jsonb('data').$type<Record<string, any>>().notNull().default({}),
  gearchiveerd: boolean('gearchiveerd').notNull().default(false),
  createdAt: ts('created_at').defaultNow().notNull(),
  updatedAt: ts('updated_at').defaultNow().notNull(),
})

export const belMeNiet = pgTable('bel_me_niet', {
  organisationId: text('organisation_id').notNull(),
  telefoonE164: text('telefoon_e164').notNull(),
  door: text('door'),
  op: ts('op').defaultNow().notNull(),
})

export const opgeslagenFilters = pgTable('opgeslagen_filters', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: text('organisation_id').notNull(),
  gebruikerId: text('gebruiker_id').notNull(),
  lijst: text('lijst').notNull().default('prospects'),
  naam: text('naam').notNull(),
  query: jsonb('query').$type<Record<string, string>>().notNull(),
  createdAt: ts('created_at').defaultNow().notNull(),
})

export const eigenVeldVoorstellen = pgTable('eigen_veld_voorstellen', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: text('organisation_id').notNull(),
  door: text('door').notNull(),
  data: jsonb('data').$type<Record<string, any>>().notNull(),
  status: text('status').notNull().default('open'),
  op: ts('op').defaultNow().notNull(),
})
