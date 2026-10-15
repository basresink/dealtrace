// Drizzle-schema van de tabellen uit 0001_fundament.sql. De SQL-migratie is de
// bron; dit schema geeft de server getypte queries.

import { boolean, integer, jsonb, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core'

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
