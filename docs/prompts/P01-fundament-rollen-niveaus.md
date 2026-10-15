# P01: Fundament, rollen, niveaus en functiecatalogus

| Onderdeel | Waarde |
|---|---|
| Sprint | 1 (Fundament en één app) |
| Features | F22 Instellingen (basis), F24 Meldingen, zoeken, mobiel en offline (basis) |
| Hangt af van | geen; dit is de eerste prompt |
| Bron in het bouwplan | hoofdstuk 2 (2.2, 2.3, 2.4), 3 (3.1 tot en met 3.3), 4 (4.1 tot en met 4.5), 6 (6.1, 6.3), 10 (10.1 tot en met 10.3), 13 (13.1 tot en met 13.5), F22, F24, Bijlage A (gat 15, 16, 23), Bijlage B |

## Lees eerst

- Bouwplan-Dealtrace.md: 0.2 (beslissingen B3, B4, B12, B15, B17, B18, B19), 2.1 tot en met 2.4, hoofdstuk 3, hoofdstuk 4, 6.1 en 6.3, hoofdstuk 10, 13.1 tot en met 13.5, hoofdstuk 14, F22, F24, hoofdstuk 19, ADR-012 en ADR-020, Bijlage A en Bijlage B.
- DealDrive (`git -C /home/user/Dealdrive show 75bee61:<pad>`):
  - Opslag en tenant: `server/utils/appStore.ts`, `shared/wisPatch.ts`, `server/db/rls.sql`, `server/db/schema.ts`.
  - Synchronisatie: `server/api/sync/mutations.post.ts`, `shared/syncTabellen.ts`, `server/utils/mutationStore.ts`, `server/utils/serverRecordStore.ts`, `app/composables/useSyncQueue.ts`, `app/composables/useOptimisticWrite.ts`, `app/utils/offlineDb.ts`, `app/components/ConflictResolveModal.vue`.
  - Rechten en sessie: `server/utils/permissions.ts`, `server/utils/session.ts`, `server/utils/auditStore.ts`.
  - Instellingen: `shared/settingKeys.ts`, `server/utils/settingsStore.ts`, `server/utils/featureFlags.ts`, `shared/features.ts`, `server/utils/pakketten.ts`.
  - Ritme: `shared/datum.ts` (werkdagen; feestdagen ontbreken, zie gat 15).
  - Meldingen en offline: `app/components/NotificationBell.vue`, `app/pages/notificaties.vue`, `app/components/OfflineBanner.vue`.
  - Stijl: `designsysteem/dealdrive-designsysteem.css` in deze repository.

## Deel 1: Functioneel (wat en waarom)

### Wat je bouwt

Het fundament van Dealtrace: één Nuxt-app met organisaties, gebruikers, teams, rollen, drie gebruikersniveaus, werkplekprofielen, één functiecatalogus, een rechtenmatrix, RLS, synchronisatie met offline wachtrij, audit, meldingen in de app, instellingen met automatisch bewaren en de zijbalk per niveau.

### Waarom

Elke latere functie heeft een stand per niveau (aan of uit), een pakket, een recht en een helpartikel nodig (4.2, 13.1). Zonder dit fundament bouwt elke prompt zijn eigen controle en loopt de app uit de pas tussen server en client. Een rol bepaalt wat je mag, het niveau wat je gebruikt en het werkplekprofiel hoe je werkplek is ingedeeld; die drie staan los van elkaar (hoofdstuk 3).

### Gebruikers en niveaus

| Rol | Niveau | Wat |
|---|---|---|
| accountmanager | Beginner | Zijbalk met 11 items, groep "Nog niet aangezet", gebruikersblok "ACCOUNTMANAGER · BEGINNER", eigen profiel en meldingen in Mijn instellingen, "Toon minder" om zelf functies te verbergen |
| accountmanager | Gevorderd | Zijbalk met 14 items; plus eigen belblokken en werkplekindeling in Mijn instellingen (de inhoud komt in latere prompts) |
| accountmanager | Expert | Zijbalk met 15 items; plus persoonlijke regels en scripts in Mijn instellingen (inhoud later) |
| salesmanager | minimaal Gevorderd, standaard Expert | Plus de groep Manager in de zijbalk; het niveau kiezen van gebruikers in eigen teams; verder is per gebruiker niets in te stellen (B18) |
| beheerder | standaard Expert | Plus Instellingen: gebruikers, rollen, teams, niveaus, organisatie-instellingen, "Iedereen ziet alles" |
| founder | n.v.t. | Alleen de rol in de database en de afscherming; Platformbeheer zelf is P02, de pagina Features per niveau (`/platform/features`) is P09 Helpcenter basis en features per niveau |

### Schermen

**Schil en zijbalk** (laptop vanaf 1024 px, tablet 768 tot 1023 px als icoonstrook van 64 px; de telefoonschil is P27)

- Zwarte zijbalk van 240 px, inklapbaar naar 64 px, Lucide-iconen, LIVE-strook, "Zoeken" met Ctrl K, groepen, onderaan meldingen en gebruikersmenu (14).
- Items en zichtbaarheid exact volgens de tabel in 6.1: Start (Vandaag `/`, Agenda `/agenda`), Werk (Acties, Belblokken, Bezoeken, Campagnes, Funnel `/funnel`), Prospects (Prospects, Contacten, Leadgenerator, Inzichten), Plannen (Prospectplanning, Richting, Prospectreizen), Resultaat (Mijn resultaten), Manager (Team, Coaching, Analyse, Audit; rol salesmanager), Beheer (Instellingen; beheerder, Platformbeheer; founder), onderaan Meldingen, Helpcenter, gebruikersmenu (Mijn instellingen, Roadmap, Uitloggen).
- Volgorde binnen "Werk": binnendienst zet Belblokken boven Bezoeken, buitendienst andersom.
- Een lager niveau laat items weg maar verandert nooit plek of vorm van wat blijft.
- **Groep "Nog niet aangezet"** onderaan, standaard ingeklapt, met grijze teller. Uitgeklapt: items met `aria-disabled="true"`, tekst `--wit-30`, slot-icoon van 14 px, focusbaar. De groep onthoudt per gebruiker of hij open staat.
- **Uitlegflyout** (480 px) bij klik op een item dat niet aanstaat: kicker "Gevorderd · nog niet aangezet" (of "Expert · nog niet aangezet"), "Wat het doet" (twee zinnen), "Tot die tijd" (wat Dealtrace alvast voor je doet), knop "Lees hoe het werkt". Geen criteria, geen voortgang en geen verzoekknop (B19): wie meer nodig heeft, bespreekt dat met de salesmanager.
- **Directe link naar een pagina die niet aanstaat**: de paginakop met kicker "Nog niet aangezet" en dezelfde uitleg; nooit een foutpagina.
- **Knop van een functie die niet aanstaat**: secundaire knop met slot-icoon die de uitlegflyout opent, met de tekst "Deze functie hoort bij Gevorderd." en de knop "Lees hoe het werkt". Nooit een uitgeschakelde knop zonder uitleg. Een blok van een functie die niet aanstaat, toont hoogstens één lege staat per pagina onderaan met kicker "Nog niet aangezet".
- **Buiten het pakket**: "Onderdeel van Plus" met een link naar het abonnement, alleen voor de beheerder.
- **Gebruikersblok** onderaan: "ACCOUNTMANAGER · BEGINNER", "ACCOUNTMANAGER · GEVORDERD", "ACCOUNTMANAGER · EXPERT" (rol en niveau volgens de gebruiker). Het niveau staat nergens naast een naam in lijsten.
- **Paginakop per niveau** (4.4): Beginner primaire knop, "Hulp" en subtitel met één zin uitleg; Gevorderd plus werkbalk met Weergave en Filters; Expert plus Sortering, opgeslagen weergaven en Download, subtitel met de stand van zaken. Bouw dit als één paginakopcomponent met de niveauregels erin.
- **Pil "Nieuw"**: gaat een functie voor je aan (een hoger niveau of een feature die de founder aanzet), dan volgt de toast "Leadgenerator staat nu voor je aan." met een link naar het helpartikel, en het nieuwe menu-item houdt één week de pil "nieuw".
- **Globale zoek** (toets `/` of Ctrl K): venster met groepen per soort, pijltjes, Enter, Escape, accent- en hoofdletterongevoelig, functies die niet aanstaan met slot. In deze prompt doorzoek je alleen gebruikers en de zijbalkitems; latere prompts melden hun soort aan. Niet vastgelegd in het bouwplan; voorstel: een register `zoekbronnen` waar elke feature een bron aan toevoegt.

**Instellingen** (`/instellingen`, beheerder; salesmanager ziet de teamonderdelen)

- Startpagina met kaarten in vier groepen: "Organisatie", "Verkoop", "Ritme en regels", "Data en AI", elk onderdeel met één regel wat het regelt en de stand. Onderdelen die een latere prompt bouwt, toon je als kaart met de lege staat "Komt in een volgende versie." Niet vastgelegd in het bouwplan; voorstel: deze tekst, of de kaart verbergen tot de feature er is.
- **Organisatie**: naam, logo, land, verkoopjaar (startmaand), werkdagen en feestdagen.
- **Gebruikers, rollen, teams en niveaus** (`/instellingen/gebruikers`): lijst met naam, e-mail, rol, team, niveau (segmentknoppen "Beginner", "Gevorderd", "Expert"), werkplek, laatste inlog, status. Knop "Gebruiker toevoegen" binnen de seats of "Gebruiker aanvragen" (de stand zet de founder in P02). Archiveren. Niveau verlagen vraagt bevestiging. Vangrails: niet jezelf, niet de laatste beheerder.
- **Alleen het niveau per gebruiker** (B18): bij een gebruiker kies je alleen Beginner, Gevorderd of Expert; er zijn geen functies per gebruiker aan of uit te zetten. Welke functies per niveau aanstaan, regelt de founder op `/platform/features` (P09 Helpcenter basis en features per niveau).
- **Teams**: naam, salesmanager(s), gekoppelde buitendienstteams. Niet vastgelegd waar; voorstel: tabblad "Teams" op `/instellingen/gebruikers`.
- **Niveaus**: keuze "Iedereen ziet alles" (dan staan voor iedereen alle functies uit het pakket aan) en het standaardniveau voor nieuwe gebruikers. Geen criteria en geen groeipad (B19).
- **Automatisch bewaren**: elke wijziging per veld na 600 ms stilte bewaard met zichtbare status "Opslaan…", "Opgeslagen", "Opslaan mislukt"; elke wijziging een auditregel.

**Mijn instellingen** (gebruikersmenu): profiel, werkplek (binnendienst, buitendienst, hybride; alleen lezen, de beheerder zet het), meldingen per soort, "Toon minder" (zelf functies verbergen, nooit extra aanzetten). Thuisbasis, kaartapp, dagpakket, toestellen en sessies volgen in P27, P30 en P31.

**Meldingen**: bel onderaan de zijbalk met rode teller; pagina `/meldingen` met rijen met kleurbalk per soort (kritiek rood, hete aanleiding paars, dagstart blauw, herinnering geel, inzicht groen), "Openen", "Markeer gelezen", "Verberg". Lege staat: "Geen meldingen. Nieuwe meldingen verschijnen hier." Niet vastgelegd in het bouwplan; voorstel: deze tekst.

**Offline-indicator**: hoofdstuk 8 gaat voor F24. Gebruik de strook uit 8.3: "Offline · 3 wijzigingen wachten" (geel, 28 px), bij een vastgelopen wachtrij rood met "Opnieuw proberen". De rode banner uit F24 vervalt daarmee.

**Telefoon (390 px).** De mobiele schil is P27. Op 390 px mogen de schermen uit deze prompt niet horizontaal scrollen; Instellingen opent op de telefoon met "Beter op een groot scherm" (8.12).

### Klikpaden

1. Beginner klikt op "Nog niet aangezet": de groep klapt uit; klik op "Leadgenerator" opent de uitlegflyout met kicker "Gevorderd · nog niet aangezet" en "Lees hoe het werkt".
2. Beginner opent `/leadgenerator` direct: paginakop met kicker "Nog niet aangezet" en de uitleg, geen foutpagina.
3. Beheerder zet in `/instellingen/gebruikers` Sanne van Beginner naar Gevorderd: segmentknop, de waarde is bewaard na 600 ms, auditregel, Sanne krijgt bij haar volgende pagina de toast "Leadgenerator staat nu voor je aan." met een link naar het helpartikel, en de nieuwe items houden één week de pil "nieuw".
4. Beheerder zet Sanne terug naar Beginner: bevestiging met reden, auditregel, `niveauHistorie` bijgewerkt.
5. De regel voor "Import" en Beginner in `functies_per_niveau` gaat op aan (in deze prompt via seed of test; de founderpagina `/platform/features` volgt in P09): bij de volgende pagina staat de functie voor elke Beginner aan, zonder release, met auditregel.
6. Accountmanager verbergt in Mijn instellingen met "Toon minder" de functie Campagnes: het item verdwijnt uit zijn zijbalk; iets aanzetten dat voor zijn niveau uit staat, kan daar niet.
7. Beheerder zet "Iedereen ziet alles" aan: alle gebruikers hebben alle functies uit het pakket aan, de groep "Nog niet aangezet" verdwijnt.

### Regels

- `beschikbaar(functie, gebruiker) = pakketBevat && rolMag && aanVoorNiveau` (4.2). Er is geen uitzondering per gebruiker. De server weigert een endpoint van een niet-beschikbare functie met 403 en `{functie, reden: 'niveau'|'pakket'|'rol'}`.
- Rol en niveau staan los: salesmanager minimaal Gevorderd en standaard Expert, beheerder standaard Expert, accountmanager standaard Beginner tenzij de beheerder bij uitnodigen anders kiest.
- Een gebruiker heeft precies één rol. Een accountmanager zit in één team; een salesmanager is eigenaar van één of meer teams.
- Rechtenniveaus `geen`, `eigen`, `team`, `alles`; acties lezen, schrijven, verwijderen, beheren; matrix exact als 3.3. Een tabel die niet in de matrix staat valt op `geen`. `eigen` is tot sprint 5 een zachte filter "Van mij"; de teambeperking van de salesmanager is vanaf sprint 1 server-side.
- Een Beginner heeft 10 zijbalkitems en de hele navigatie past zonder scrollen op 900 px hoogte.
- Niveau en "niet aangezet" gebruiken alleen `--wit-30`, `--wit-55`, `--muted` en de gestippelde pil, nooit rood of geel.
- Werkdagen zonder Nederlandse feestdagen bestaan niet meer: `shared/datum.ts` kent de feestdagen (gat 15).
- Buiten de mock-modus blijft er nooit demodata in de client als de servertabel leeg is (gat 23).

### Helpartikelen

- "Je niveau en functies die aanstaan" (Hoe werkt Dealtrace, Aan de slag): wat Beginner, Gevorderd en Expert betekenen, hoe je functies herkent die nog niet aangezet zijn, en dat een hoger niveau een besluit van je salesmanager is.
- "Je werkplek: binnendienst of buitendienst" (Aan de slag): wat het werkplekprofiel verandert en wat niet.
- "Meldingen instellen" (Aan de slag).
- "Gebruikers, rollen en niveaus" (Inrichten, beheerder): uitnodigen, niveau kiezen, "Iedereen ziet alles".

## Deel 2: Technisch (hoe)

### Datamodel

Migratie `0001_fundament` met drizzle (generate en apply). Elke tabel heeft `id`, `organisation_id`, `data jsonb` en tijdstempels; een veld krijgt alleen een kolom als erop gefilterd, geteld of gejoind wordt (10.1).

| Tabel | Kolommen (naast de standaard) |
|---|---|
| `organisations` | `name`, `pakket`, `features`, `contract`, `stripe_customer_id`, `status` |
| `users` | `email`, `name`, `role`, `niveau` (`beginner`, `gevorderd`, `expert`), `team_id`, `werkplek` (`binnendienst`, `buitendienst`, `hybride`), `laatste_inlog`, `status`; `data.niveauHistorie[] {van, naar, op, door, reden}`, `data.verborgen[]` ("Toon minder") |
| `teams` | `naam`, `manager_ids[]`, `gekoppelde_teams[]` |
| `org_settings` | `(organisation_id, key)`, `value jsonb`; sleutel `niveaus = {iedereenAlles, standaardNiveauNieuweGebruiker}` |
| `functies_per_niveau` | `functie`, `niveau`, `aan boolean`, `organisation_id` (null = alle organisaties), `gewijzigd_door`, `gewijzigd_op` (4.5); alleen de founder schrijft |
| `audit_events` | `actor_id`, `action`, `resource_type`, `resource_id`, `changes`, `metadata` |
| `server_records` | `key`, `version` (conflictgrootboek) |
| `activiteiten` | kolommen uit 10.2; alleen toevoegen (geen update of delete via de app-rol) |
| `notificaties` | `gebruiker_id`, `soort`, `titel`, `tekst`, `link`, `gelezen_op`, `op` (8.14 legt `gelezen_op` op de server vast) |
| `push_subscriptions` | per gebruiker en toestel; gevuld vanaf P27 |

- Bouwplan 4.5 noemt `users.data.werkplek` en 10.2 een kolom `werkplek`; volg 10.2 (kolom), want het profiel bepaalt de standaardindeling en wordt gefilterd in Team.
- **RLS**: policy `org_isolation` op elke tabel met `organisation_id = current_org_id()` per transactie; de app verbindt als `dealtrace_app` zonder `bypassrls`; de organisatie komt uit de sessie, nooit uit de payload (10.1).
- **Wissen**: `null` in een patch wist de sleutel, `undefined` wist niets (`shared/wisPatch.ts`).
- **Herkomst**: `data.herkomst[veld] = {bron, op, door?, url?}` met bronprioriteit hand, kvk, datacollectief, crm, salesdna, web, ai, import; een lagere bron overschrijft een hogere nooit stil. Leg de functie hier vast (`shared/herkomst.ts`, zie pure functies), gebruikt vanaf P03.
- **Sync-allowlist** `shared/syncTabellen.ts`: in deze prompt alleen `notificaties` (gelezen) en de persoonlijke instellingen; latere prompts voegen hun tabellen toe. `users` staat er nooit in.
- **Features per niveau**: de migratie vult `functies_per_niveau` met de startindeling uit 4.3 en de kolommen B, G en E uit 6.1 (regels met `organisation_id` null). Een regel voor één organisatie gaat voor de regel voor alle organisaties. Een wijziging werkt direct, zonder release: lees de stand per verzoek (of met een cache die bij elke wijziging vervalt). De founderpagina om de stand te wijzigen bouwt P09 Helpcenter basis en features per niveau.
- **Rechtenmatrix** `shared/permissions.ts` (in DealDrive `server/utils/permissions.ts`): onderdelen en waarden exact als 3.3, met de kolom founder als "alleen na instappen".

### Pure functies

| Functie | Invoer | Uitvoer | Randgevallen en tests |
|---|---|---|---|
| `beschikbaar(functie, gebruiker, organisatie, stand)` in `shared/functies.ts` | functiesleutel, gebruiker (rol, niveau), organisatie (pakket, features, `iedereenAlles`), stand uit `functies_per_niveau` | `{ok: true}` of `{ok: false, reden: 'pakket'|'rol'|'niveau'}` | onbekende sleutel is `rol` geweigerd; "Iedereen ziet alles" zet alle functies uit het pakket aan, maar nooit boven pakket of rol; geen uitzondering per gebruiker |
| `aanVoorNiveau(functie, niveau, organisatie, stand)` | functiesleutel, niveau, organisatie, regels uit `functies_per_niveau` | boolean | regel van de organisatie gaat voor de regel voor alle organisaties; alle drie niveaus getest. Niet vastgelegd wat een functie zonder regel doet; voorstel: uit, en `check:functies` faalt op een sleutel zonder startregel voor elk niveau |
| `rolMag(rol, onderdeel, actie, scope)` in `shared/permissions.ts` | rol, onderdeel, actie, `{eigen, team}` | boolean | tabel buiten de matrix is `geen`; salesmanager buiten zijn team is nee |
| `zijbalkVoor(rol, niveau, werkplek, stand, verborgen)` | gebruiker | `{items[], nietAangezet[]}` | met de startindeling Beginner 10, Gevorderd 14, Expert 15; volgorde Werk volgt werkplek; "Toon minder" haalt items weg, nooit erbij |
| `isWerkdag(datum, organisatie)`, `volgendeWerkdag`, `telWerkdagen` in `shared/datum.ts` | ISO-datum | boolean of ISO-datum | Koningsdag op zondag (dan 26 april), Pasen, Hemelvaart, Pinksteren, Kerst, Nieuwjaar; bevrijdingsdag volgens instelling. Niet vastgelegd of 5 mei een vrije dag is; voorstel: instelbaar per organisatie, standaard alleen in lustrumjaren |
| `magOverschrijven(bronOud, bronNieuw)` in `shared/herkomst.ts` | twee bronnen | boolean | gelijke bron mag; hand wint altijd |
| `veldenVoorNiveau` | later in P03 | | |

### Endpoints

| Methode en route | Recht | Invoer | Uitvoer | Fouten |
|---|---|---|---|---|
| `GET /api/settings` | ingelogd | | alle sleutels behalve `VERBORGEN_KEYS` | 401 |
| `PUT /api/settings/:key` | beheerder | `{value}` | `{key, value}` | 403 bij een sleutel van de leverancier (pakket, aiCredits, features, platformprompts); 400 bij een onbekende sleutel |
| `POST /api/sync/mutations` | per mutatie de matrix | mutaties met `idempotentie_sleutel` | resultaten per mutatie | 409 bij versieconflict, 403 per mutatie buiten de allowlist |
| `POST /api/sync/conflict-check` | ingelogd | recordsleutels en versies | conflicten | |
| `GET /api/functies` | ingelogd | | catalogus met per sleutel `beschikbaar` en reden | |

Niet vastgelegd in het bouwplan; voorstel voor gebruikers, teams en meldingen:

| Methode en route | Recht | Doel |
|---|---|---|
| `GET /api/me` | ingelogd | gebruiker, rol, niveau, werkplek, team, beschikbare functies |
| `GET/POST/PUT /api/gebruikers`, `POST /api/gebruikers/:id/archiveer` | beheerder | gebruikers; vangrails niet jezelf en niet de laatste beheerder (409) |
| `POST /api/gebruikers/:id/niveau {niveau, reden}` | beheerder; salesmanager voor eigen teams | niveau zetten, reden verplicht bij verlagen |
| `POST /api/mij/toon-minder {functie, verborgen}` | ingelogd | zelf een functie verbergen of weer tonen; nooit iets aanzetten dat voor je niveau uit staat |
| `GET/POST/PUT /api/teams` | beheerder | teams |
| `GET /api/notificaties`, `POST /api/notificaties/:id/gelezen`, `POST /api/notificaties/:id/verberg` | eigen | meldingen |

### Functiecatalogus

`shared/functies.ts` bevat per functie: sleutel, naam, pakket, recht, helpartikel; de stand per niveau staat niet in de code maar in `functies_per_niveau`. Bouwcheck `check:functies` faalt als een sleutel een van de vier mist. Het bouwplan legt geen sleutelnamen en geen pakket per functie vast (behalve welke AI-soorten per pakket aanstaan in 11.4); voorstel: sleutels als `domein.functie`, pakket Starter tenzij een latere prompt anders zegt. Leg in deze prompt de sleutels van de zijbalk vast. De kolom "Startindeling: aan vanaf" is de beginstand in `functies_per_niveau`: aan voor dat niveau en de niveaus erboven, uit voor de niveaus eronder; daarna regelt de founder de stand (4.1, 4.3).

| Sleutel | Startindeling: aan vanaf | Pakket | Recht | Helpartikel |
|---|---|---|---|---|
| `nav.vandaag`, `nav.agenda`, `nav.acties`, `nav.belblokken`, `nav.bezoeken`, `nav.prospects`, `nav.contacten`, `nav.richting`, `nav.resultaten` | Beginner | Starter | iedereen | per pagina het artikel uit F21 |
| `nav.campagnes` | Beginner (meedoen) | Starter | iedereen | "Campagnes" |
| `nav.funnel` | Beginner | Starter | iedereen | "De funnel van je prospectreis" |
| `nav.leadgenerator`, `nav.inzichten`, `nav.planning` | Gevorderd | Starter | iedereen | "Leadgenerator", "Inzichten beoordelen", "Prospectplanning" |
| `nav.reizen` | Expert | Starter | iedereen (lezen), salesmanager (activeren) | "De prospectreis en fases" |
| `nav.team`, `nav.coaching`, `nav.analyse`, `nav.audit` | Gevorderd | Starter | salesmanager | "Team controleren" |
| `nav.instellingen` | Expert | Starter | beheerder | "Gebruikers, rollen en niveaus" |
| `nav.platform` | n.v.t. | n.v.t. | founder | geen (platform) |
| `gebruikers.niveau` | Gevorderd | Starter | salesmanager (team), beheerder | "Gebruikers, rollen en niveaus" |
| `mij.toonMinder` | Beginner | Starter | iedereen | "Je niveau en functies die aanstaan" |

### AI-stappen en integraties

Geen AI in deze prompt. De mock-modus staat er wel: elke latere AI-laag en adapter krijgt een mock (`AI_PROVIDER=mock` is de standaard, 13.5); de app start zonder sleutels met `GET /api/config/status`, die alleen laat zien of een sleutel bestaat (12).

**Lokaal bouwen (13.5).** Zet in deze prompt de lokale opzet neer: `pnpm dev` op `http://localhost:3000` (`pnpm dev --host` voor de telefoon in hetzelfde wifi-netwerk), Supabase lokaal via de Supabase CLI in Docker (`supabase start`: Postgres met RLS, Auth, Storage), de lokale mailbox Inbucket op `http://localhost:54324` waar de inlogcodes van P27 binnenkomen, de mock-provider voor AI en alle koppelingen, `pnpm seed` voor de startset Voltvast (`seed/voltvast.json`), `pnpm motor` voor geplande taken, en de testcommando's `pnpm test`, `pnpm test:db` en `pnpm test:e2e`. Geheimen alleen in `.env.local`; `.env.example` noemt elke variabele met uitleg.

### Hergebruik uit DealDrive

| Bestand | Wat je aanpast |
|---|---|
| `server/utils/appStore.ts`, `shared/wisPatch.ts`, `server/db/rls.sql`, `server/db/schema.ts` | letterlijk; schema uitgebreid met `niveau`, `team_id`, `werkplek`, `teams` |
| sync-bestanden uit Lees eerst | letterlijk; allowlist leeg beginnen |
| `server/utils/permissions.ts` | verhuist naar `shared/permissions.ts`; niveau `team` krijgt echte teams (in DealDrive gereserveerd en nergens toegekend) |
| `server/utils/session.ts`, `server/utils/auditStore.ts` | sessie met niveau, team en werkplek |
| `shared/features.ts`, `server/utils/featureFlags.ts`, `server/utils/pakketten.ts` | samenvoegen tot de functiecatalogus (4.2); de stand per niveau komt uit `functies_per_niveau`; de override per organisatie blijft in `organisations.features` |
| `shared/settingKeys.ts`, `server/utils/settingsStore.ts` | `VERBORGEN_KEYS` aan lees- en schrijfkant |
| `shared/datum.ts` | feestdagen toevoegen (gat 15) |
| `NotificationBell.vue`, `notificaties.vue`, `OfflineBanner.vue` | strook uit 8.3; `gelezen_op` op de server |

### Buiten scope

Inloggen met code en de mobiele schil (P27), Platformbeheer en werken in een organisatie (P02), de pagina Features per niveau op `/platform/features` en het helpcenter (P09 Helpcenter basis en features per niveau), de AI-assistent en credits (P33), Web Push-verzending (P26), de inhoud van alle features.

## Acceptatiecriteria

1. Een Beginner ziet precies de 11 items uit 6.1, een Gevorderde 14, een Expert 15; de navigatie van een Beginner past zonder scrollen op 900 px hoogte.
2. Een item dat voor het niveau uit staat, staat in "Nog niet aangezet" met slot, is focusbaar en opent de uitlegflyout met kicker, "Wat het doet", "Tot die tijd" en "Lees hoe het werkt", zonder verzoekknop; een directe link toont de paginakop met kicker "Nog niet aangezet", geen foutpagina.
3. Een endpoint van een niet-beschikbare functie geeft 403 met `{functie, reden}`; getest voor `niveau`, `pakket` en `rol`.
4. Een regel in `functies_per_niveau` omzetten werkt direct, zonder release, voor iedereen met dat niveau; een regel voor één organisatie gaat voor de regel voor alle organisaties; er is geen endpoint of veld om een functie voor één gebruiker aan of uit te zetten. "Toon minder" verbergt alleen; niveau verlagen door de beheerder vraagt bevestiging en reden.
5. "Iedereen ziet alles" zet voor iedereen alle functies uit het pakket aan en verbergt de groep "Nog niet aangezet".
6. Een salesmanager kan geen niveau zetten voor een gebruiker buiten zijn teams (server-side, 403).
7. Cross-tenant in de wegwerp-Postgres: gebruiker van organisatie A leest of schrijft niets van B, ook niet met een `organisation_id` in de payload.
8. `PUT /api/settings/pakket` en de andere `VERBORGEN_KEYS` geven 403; `GET /api/settings` toont ze niet.
9. Een instelling is na 600 ms stilte bewaard met de status "Opgeslagen" en een auditregel.
10. Een mutatie offline komt na herstel precies één keer aan (idempotentiesleutel); een versieconflict opent het conflictvenster met "Houd mijn versie" en "Neem de andere over".
11. Bijlage A, gat 15: `telWerkdagen` tussen 2026-12-24 en 2027-01-04 telt Kerst en Nieuwjaar niet mee; Koningsdag 2026-04-27 (een maandag) en Tweede Paasdag 2026-04-06 zijn geen werkdag.
12. Bijlage A, gat 23: met een lege servertabel buiten de mock-modus toont de client een lege staat en geen demodata.
13. Bijlage A, gat 16: rechtenmatrix, functiecatalogus, werkdagen en herkomstprioriteit staan elk één keer in `shared/`.
14. `check:functies` faalt op een catalogusregel zonder helpartikel; `check:rechten` faalt op een tabel buiten de matrix die via de sync-queue wordt geschreven.
15. Getest als Beginner, Gevorderd en Expert (accountmanager), en als salesmanager en beheerder: zijbalk, gebruikersblok, paginakop en knoppen van functies die niet aanstaan kloppen per niveau.
16. Op 390 px geen horizontale scroll op `/instellingen`, `/instellingen/gebruikers` en `/meldingen`; tikdoelen minimaal 44 px.

## Definition of Done

Hoofdstuk 19 geldt volledig. Specifiek voor deze prompt:

- `check:rechten` en `check:functies` bestaan en draaien in de bouwketen; ze zijn de basis voor alle latere prompts.
- De databasevrije suite en de wegwerp-Postgres-suite bestaan (`tools/wegwerpdb/`) met de cross-tenanttest.
- Playwright-projecten voor desktop en 375, 390 en 412 px staan klaar met aanraakmodus.
- De lokale opzet uit 13.5 werkt: van nul tot een draaiende app met `pnpm dev`, Supabase lokaal en `pnpm seed` in tien minuten volgens de README, zonder sleutels (mock-provider).
- `docs/HOE-HET-WERKT.md` beschrijft rol, niveau, werkplekprofiel, `beschikbaar()`, `functies_per_niveau` en de rechtenmatrix; `docs/HERGEBRUIK.md` pint commit 75bee61.
- Testdata alleen uit de startset Voltvast (Bijlage C) of neutrale testgebruikers; geen echte bedrijfs- of persoonsgegevens.
