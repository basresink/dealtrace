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
  /** Eigen mandaat per agent (Expert), binnen het organisatiemaximum (P08). */
  mandaat?: Record<string, { mandaat: 'A' | 'B' | 'C' | 'D'; dagplafond?: number | null }>
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
  band?: Partial<Record<'behoefte' | 'autoriteit' | 'noodzaak' | 'draagvlak', { ja: boolean; bron?: string; op?: string }>>
  herkomst?: Record<string, { bron: string; op: string; door?: string }>
  customFields?: Record<string, unknown>
  samengevoegdUit?: string[]
  scoreOpbouw?: unknown
  verwijderd?: boolean
  /** P05: nee met reden en afkoelperiode per kanaal; wachtend tot een datum; lopende terugkomregel. */
  nee?: import('../../shared/nbStatus').NeeGegevens | null
  wachtendTot?: string | null
  pauzeReden?: string | null
  terugkom?: { datum: string; regelId?: string | null; reden?: string | null; aanpak?: string | null; kanaal?: string | null } | null
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

// P04: import
export const importBatches = pgTable('import_batches', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: text('organisation_id').notNull(),
  gebruikerId: text('gebruiker_id').notNull(),
  bestandsnaam: text('bestandsnaam').notNull(),
  soort: text('soort').notNull(),
  bronLabel: text('bron_label').notNull(),
  koppeling: jsonb('koppeling').$type<Record<string, string>>().notNull().default({}),
  rapport: jsonb('rapport').$type<Record<string, any>>().notNull().default({}),
  rijen: jsonb('rijen').$type<string[][] | null>(),
  status: text('status').notNull().default('concept'),
  verwerktOp: ts('verwerkt_op'),
  createdAt: ts('created_at').defaultNow().notNull(),
})

export const onderdrukkingslijst = pgTable('onderdrukkingslijst', {
  organisationId: text('organisation_id').notNull(),
  emailHash: text('email_hash').notNull(),
  op: ts('op').defaultNow().notNull(),
  bron: text('bron').notNull().default('afgemeld'),
})

// P05: doelgroepen, prospectreis en reisgeschiedenis (0005_reis_status.sql)
export const doelgroepen = pgTable('doelgroepen', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: text('organisation_id').notNull(),
  naam: text('naam').notNull(),
  status: text('status').notNull().default('concept'),
  prioriteit: integer('prioriteit').notNull().default(10),
  versie: integer('versie').notNull().default(1),
  data: jsonb('data').$type<import('../../shared/reis').DoelgroepData>().notNull().default({}),
  createdAt: ts('created_at').defaultNow().notNull(),
  updatedAt: ts('updated_at').defaultNow().notNull(),
})

export const reistemplates = pgTable('reistemplates', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: text('organisation_id').notNull(),
  naam: text('naam').notNull(),
  doelgroepId: text('doelgroep_id'),
  versie: integer('versie').notNull().default(1),
  status: text('status').notNull().default('concept'),
  isStandaard: boolean('is_standaard').notNull().default(false),
  bron: jsonb('bron').$type<{ reisId?: string; versie?: number }>().notNull().default({}),
  eigenaarId: text('eigenaar_id'),
  data: jsonb('data').$type<import('../../shared/reis').ReisData>().notNull(),
  createdAt: ts('created_at').defaultNow().notNull(),
  updatedAt: ts('updated_at').defaultNow().notNull(),
})

export const activiteitstemplates = pgTable('activiteitstemplates', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: text('organisation_id').notNull(),
  reistemplateId: text('reistemplate_id').notNull(),
  faseId: text('fase_id').notNull(),
  versie: integer('versie').notNull().default(1),
  data: jsonb('data').$type<import('../../shared/reis').ActiviteitTemplate>().notNull(),
})

export const prospectreizen = pgTable('prospectreizen', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: text('organisation_id').notNull(),
  reistemplateId: text('reistemplate_id').notNull(),
  templateVersie: integer('template_versie').notNull().default(1),
  accountId: text('account_id').notNull(),
  faseId: text('fase_id').notNull(),
  nbStatus: text('nb_status').notNull(),
  faseSinds: ts('fase_sinds').defaultNow().notNull(),
  gestartOp: ts('gestart_op').defaultNow().notNull(),
  afgerondOp: ts('afgerond_op'),
  data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
})

export const reisgeschiedenis = pgTable('reisgeschiedenis', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: text('organisation_id').notNull(),
  accountId: text('account_id').notNull(),
  prospectreisId: text('prospectreis_id'),
  versie: integer('versie').notNull().default(1),
  vanFaseId: text('van_fase_id'),
  naarFaseId: text('naar_fase_id'),
  vanStatus: text('van_status'),
  naarStatus: text('naar_status'),
  gebeurtenis: text('gebeurtenis').notNull(),
  door: text('door').notNull(),
  op: ts('op').defaultNow().notNull(),
  reden: text('reden'),
})

// P06: regels, runs, inzichten en taken (0006_motor.sql)
export const activityRules = pgTable('activity_rules', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: text('organisation_id').notNull(),
  code: text('code'),
  naam: text('naam').notNull(),
  categorie: text('categorie').notNull().default('Bewerken'),
  actief: boolean('actief').notNull().default(true),
  motor: text('motor').notNull().default('regel'),
  scope: text('scope').notNull().default('organisatie'),
  teamId: text('team_id'),
  eigenaarId: text('eigenaar_id'),
  reisId: text('reis_id'),
  faseId: text('fase_id'),
  cadansDagen: integer('cadans_dagen').notNull().default(7),
  prioriteit: text('prioriteit').notNull().default('middel'),
  versie: integer('versie').notNull().default(1),
  data: jsonb('data').$type<import('../../shared/regelPatronen').RegelData>().notNull(),
  createdAt: ts('created_at').defaultNow().notNull(),
  updatedAt: ts('updated_at').defaultNow().notNull(),
})

export const ruleRuns = pgTable('rule_runs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: text('organisation_id').notNull(),
  ruleId: text('rule_id'),
  soort: text('soort').notNull(),
  gestartOp: ts('gestart_op').defaultNow().notNull(),
  eindOp: ts('eind_op'),
  geraakt: integer('geraakt').notNull().default(0),
  taken: integer('taken').notNull().default(0),
  inzichten: integer('inzichten').notNull().default(0),
  geschoven: integer('geschoven').notNull().default(0),
  fouten: jsonb('fouten').$type<string[]>().notNull().default([]),
  stappen: jsonb('stappen').$type<unknown[]>().notNull().default([]),
  door: text('door'),
})

export interface SignalData { waarom?: string; bewijs?: string[]; voorstel?: { title: string; actionType: string; priority: string } | null; afwijsReden?: string; [k: string]: unknown }
export const signals = pgTable('signals', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: text('organisation_id').notNull(),
  accountId: text('account_id'),
  contactId: text('contact_id'),
  ownerId: text('owner_id'),
  ruleId: text('rule_id'),
  onderwerp: text('onderwerp'),
  agent: text('agent'),
  type: text('type').notNull(),
  title: text('title').notNull(),
  relevanceScore: integer('relevance_score').notNull().default(50),
  confidence: doublePrecision('confidence'),
  status: text('status').notNull().default('nieuw'),
  bron: text('bron').notNull().default('intern'),
  data: jsonb('data').$type<SignalData>().notNull().default({}),
  createdAt: ts('created_at').defaultNow().notNull(),
  updatedAt: ts('updated_at').defaultNow().notNull(),
})

export interface TaskData { waarom?: string; bewijs?: string[]; herkomst?: string | { bron?: string; inzichtId?: string | null; regelId?: string | null; actiesoort?: string; uitvoerder?: string | null }; uiterste?: string; geschoven?: boolean; poging?: { n: number; van: number; kanaal?: string; vorige?: string }; [k: string]: unknown }
export const tasks = pgTable('tasks', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: text('organisation_id').notNull(),
  ownerId: text('owner_id'),
  accountId: text('account_id'),
  contactId: text('contact_id'),
  signalId: text('signal_id'),
  ruleId: text('rule_id'),
  onderwerp: text('onderwerp'),
  campaignId: text('campaign_id'),
  belblokId: text('belblok_id'),
  actionType: text('action_type').notNull().default('taak'),
  title: text('title').notNull(),
  status: text('status').notNull().default('open'),
  priority: text('priority').notNull().default('middel'),
  dueDate: ts('due_date'),
  uitkomst: text('uitkomst'),
  laterOp: text('later_op'),
  executor: text('executor'),
  executorStatus: text('executor_status'),
  data: jsonb('data').$type<TaskData>().notNull().default({}),
  createdAt: ts('created_at').defaultNow().notNull(),
  updatedAt: ts('updated_at').defaultNow().notNull(),
})

// P07: hercontactritmes (0007_hercontact.sql)
export const hercontactritmes = pgTable('hercontactritmes', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: text('organisation_id').notNull(),
  naam: text('naam').notNull(),
  bron: text('bron').notNull(),
  status: text('status').notNull().default('actief'),
  versie: integer('versie').notNull().default(1),
  data: jsonb('data').$type<{ stappen: import('../../shared/hercontact').RitmeStap[]; parkeerDagen: number; werkplek?: 'binnendienst' | 'buitendienst' | 'alle' }>().notNull(),
  createdAt: ts('created_at').defaultNow().notNull(),
  updatedAt: ts('updated_at').defaultNow().notNull(),
})

// P08: agents en mandaten (0008_agents.sql)
export const agentRuns = pgTable('agent_runs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: text('organisation_id').notNull(),
  agent: text('agent').notNull(),
  handeling: text('handeling').notNull(),
  mandaatNiveau: text('mandaat_niveau').notNull(),
  gebruikerId: text('gebruiker_id'),
  accountId: text('account_id'),
  contactId: text('contact_id'),
  taskId: text('task_id'),
  uitkomst: text('uitkomst').notNull(),
  reden: text('reden'),
  bronnen: jsonb('bronnen').$type<unknown[]>().notNull().default([]),
  kosten: jsonb('kosten').$type<{ soort: string; credits: number; cent?: number } | null>(),
  op: ts('op').defaultNow().notNull(),
})

export const platformAgentmaxima = pgTable('platform_agentmaxima', {
  agent: text('agent').primaryKey(),
  maxMandaat: text('max_mandaat').notNull(),
  gewijzigdDoor: text('gewijzigd_door'),
  gewijzigdOp: ts('gewijzigd_op').defaultNow().notNull(),
})

// P09: helpcenter (0009_help.sql)
export interface HelpData { samenvatting?: string; inhoud?: string; routes?: string[]; features?: string[]; vragen?: unknown[]; videoUrl?: string; hash?: string }
export const helpArtikelen = pgTable('help_artikelen', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: text('organisation_id'),
  collectie: text('collectie').notNull().default('product'),
  categorie: text('categorie').notNull(),
  slug: text('slug').notNull(),
  titel: text('titel').notNull(),
  niveau: text('niveau'),
  status: text('status').notNull().default('gepubliceerd'),
  versie: integer('versie').notNull().default(1),
  data: jsonb('data').$type<HelpData>().notNull().default({}),
  gepubliceerdOp: ts('gepubliceerd_op').defaultNow().notNull(),
  bijgewerktOp: ts('bijgewerkt_op').defaultNow().notNull(),
})
export const helpGelezen = pgTable('help_gelezen', {
  organisationId: text('organisation_id').notNull(),
  gebruikerId: text('gebruiker_id').notNull(),
  artikelId: text('artikel_id').notNull(),
  op: ts('op').defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.gebruikerId, t.artikelId] })])
export const helpFeedback = pgTable('help_feedback', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: text('organisation_id').notNull(),
  gebruikerId: text('gebruiker_id').notNull(),
  artikelId: text('artikel_id').notNull(),
  nuttig: boolean('nuttig').notNull(),
  reden: text('reden'),
  op: ts('op').defaultNow().notNull(),
})
export const helpZoekopdrachten = pgTable('help_zoekopdrachten', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organisationId: text('organisation_id').notNull(),
  term: text('term').notNull(),
  resultaten: integer('resultaten').notNull(),
  op: ts('op').defaultNow().notNull(),
})
