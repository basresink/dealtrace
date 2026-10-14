# P01: Fundament, rollen, niveaus en functiecatalogus

| Onderdeel | Waarde |
|---|---|
| Sprint | 1 (Fundament en één app) |
| Features | F22 Instellingen (basis), F24 Meldingen, zoeken, mobiel en offline (basis) |
| Hangt af van | geen; dit is de eerste prompt |
| Bron in het bouwplan | hoofdstuk 2 (2.2, 2.3, 2.4), 3 (3.1 tot en met 3.3), 4 (4.1 tot en met 4.6), 6 (6.1, 6.3), 10 (10.1 tot en met 10.3), 13 (13.1 tot en met 13.4), F22, F24, Bijlage A (gat 15, 16, 23), Bijlage B |

## Lees eerst

- Bouwplan-Dealtrace.md: 0.2 (beslissingen B3, B4, B12, B15), 2.1 tot en met 2.4, hoofdstuk 3, hoofdstuk 4, 6.1 en 6.3, hoofdstuk 10, 13.1 tot en met 13.4, hoofdstuk 14, F22, F24, hoofdstuk 19, ADR-012 en ADR-020, Bijlage A en Bijlage B.
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

Elke latere functie heeft een niveau, een pakket, een recht en een helpartikel nodig (4.2, 13.1). Zonder dit fundament bouwt elke prompt zijn eigen controle en loopt de app uit de pas tussen server en client. Een rol bepaalt wat je mag, het niveau wat je gebruikt en het werkplekprofiel hoe je werkplek is ingedeeld; die drie staan los van elkaar (hoofdstuk 3).

### Gebruikers en niveaus

| Rol | Niveau | Wat |
|---|---|---|
| accountmanager | Beginner | Zijbalk met 10 items, groep "Nog te ontgrendelen", gebruikersblok "ACCOUNTMANAGER · BEGINNER", eigen profiel en meldingen in Mijn instellingen, "Toon minder" niet beschikbaar (er is geen lager niveau) |
| accountmanager | Gevorderd | Zijbalk met 14 items; plus eigen belblokken en werkplekindeling in Mijn instellingen (de inhoud komt in latere prompts) |
| accountmanager | Expert | Zijbalk met 15 items; plus persoonlijke regels en scripts in Mijn instellingen (inhoud later) |
| salesmanager | minimaal Gevorderd, standaard Expert | Plus de groep Manager in de zijbalk; niveaus in eigen teams voorstellen en zetten; losse functies ontgrendelen voor teamleden |
| beheerder | standaard Expert | Plus Instellingen: gebruikers, rollen, teams, niveaus, organisatie-instellingen, "Iedereen ziet alles" |
| founder | n.v.t. | Alleen de rol in de database en de afscherming; Platformbeheer zelf is P02 |

### Schermen

**Schil en zijbalk** (laptop vanaf 1024 px, tablet 768 tot 1023 px als icoonstrook van 64 px; de telefoonschil is P27)

- Zwarte zijbalk van 240 px, inklapbaar naar 64 px, Lucide-iconen, LIVE-strook, "Zoeken" met Ctrl K, groepen, onderaan meldingen en gebruikersmenu (14).
- Items en zichtbaarheid exact volgens de tabel in 6.1: Start (Vandaag `/`, Agenda `/agenda`), Werk (Acties, Belblokken, Bezoeken, Campagnes, Pipeline), Prospects (Prospects, Contacten, Leadgenerator, Inzichten), Plannen (Prospectplanning, Richting, Prospectreizen), Resultaat (Mijn resultaten), Manager (Team, Coaching, Analyse, Audit; rol salesmanager), Beheer (Instellingen; beheerder, Platformbeheer; founder), onderaan Meldingen, Helpcenter, gebruikersmenu (Mijn instellingen, Roadmap, Uitloggen).
- Volgorde binnen "Werk": binnendienst zet Belblokken boven Bezoeken, buitendienst andersom.
- Een lager niveau laat items weg maar verandert nooit plek of vorm van wat blijft.
- **Groep "Nog te ontgrendelen"** onderaan, standaard ingeklapt, met grijze teller. Uitgeklapt: items met `aria-disabled="true"`, tekst `--wit-30`, slot-icoon van 14 px, focusbaar. De groep onthoudt per gebruiker of hij open staat.
- **Uitlegflyout** (480 px) bij klik op een vergrendeld item: kicker "Gevorderd · vergrendeld" (of "Expert · vergrendeld"), "Wat het doet" (twee zinnen), "Wanneer het opengaat" (criteria uit 4.4 als bewijsregels met voortgang), "Tot die tijd" (wat Dealtrace alvast voor je doet), knop "Vraag je salesmanager".
- **Directe link naar een vergrendelde pagina**: de paginakop met kicker "Vergrendeld" en dezelfde uitleg; nooit een foutpagina.
- **Vergrendelde knop op een pagina**: secundaire knop met slot-icoon die de uitlegflyout opent, met de tekst "Dit is een functie voor Gevorderd. Je salesmanager kan hem voor je vrijgeven." en de knop "Lees hoe het werkt". Nooit een uitgeschakelde knop zonder uitleg.
- **Buiten het pakket**: "Onderdeel van Plus" met een link naar het abonnement, alleen voor de beheerder.
- **Gebruikersblok** onderaan: "ACCOUNTMANAGER · BEGINNER", "ACCOUNTMANAGER · GEVORDERD", "ACCOUNTMANAGER · EXPERT" (rol en niveau volgens de gebruiker). Het niveau staat nergens naast een naam in lijsten.
- **Paginakop per niveau** (4.5): Beginner primaire knop, "Hulp" en subtitel met één zin uitleg; Gevorderd plus werkbalk met Weergave en Filters; Expert plus Sortering, opgeslagen weergaven en Download, subtitel met de stand van zaken. Bouw dit als één paginakopcomponent met de niveauregels erin.
- **Pil "Nieuw"**: nieuwe menu-items houden na een niveauverhoging één week de pil "nieuw".
- **Globale zoek** (toets `/` of Ctrl K): venster met groepen per soort, pijltjes, Enter, Escape, accent- en hoofdletterongevoelig, vergrendelde functies met slot. In deze prompt doorzoek je alleen gebruikers en de zijbalkitems; latere prompts melden hun soort aan. Niet vastgelegd in het bouwplan; voorstel: een register `zoekbronnen` waar elke feature een bron aan toevoegt.

**Instellingen** (`/instellingen`, beheerder; salesmanager ziet de teamonderdelen)

- Startpagina met kaarten in vier groepen: "Organisatie", "Verkoop", "Ritme en regels", "Data en AI", elk onderdeel met één regel wat het regelt en de stand. Onderdelen die een latere prompt bouwt, toon je als kaart met de lege staat "Komt in een volgende versie." Niet vastgelegd in het bouwplan; voorstel: deze tekst, of de kaart verbergen tot de feature er is.
- **Organisatie**: naam, logo, land, verkoopjaar (startmaand), werkdagen en feestdagen.
- **Gebruikers, rollen, teams en niveaus** (`/instellingen/gebruikers`): lijst met naam, e-mail, rol, team, niveau (segmentknoppen "Beginner", "Gevorderd", "Expert"), werkplek, laatste inlog, status. Knop "Gebruiker toevoegen" binnen de seats of "Gebruiker aanvragen" (de stand zet de founder in P02). Archiveren. Niveau verlagen vraagt bevestiging. Vangrails: niet jezelf, niet de laatste beheerder.
- **Losse ontgrendeling**: in de gebruikersflyout een lijst functies boven het niveau met per functie een schakelaar "Vrijgeven". Niet vastgelegd hoe het scherm eruitziet; voorstel: blok "Losse functies" in de gebruikersflyout.
- **Teams**: naam, salesmanager(s), gekoppelde buitendienstteams. Niet vastgelegd waar; voorstel: tabblad "Teams" op `/instellingen/gebruikers`.
- **Niveaus**: schakelaar "Iedereen ziet alles" (zet iedereen op Expert en verbergt het groeipad), standaardniveau voor nieuwe gebruikers, criteria uit 4.4 (de waarden; het groeipad zelf bouwt P09).
- **Automatisch bewaren**: elke wijziging per veld na 600 ms stilte bewaard met zichtbare status "Opslaan…", "Opgeslagen", "Opslaan mislukt"; elke wijziging een auditregel.

**Mijn instellingen** (gebruikersmenu): profiel, werkplek (binnendienst, buitendienst, hybride; alleen lezen, de beheerder zet het), meldingen per soort, "Toon minder" (zelf een niveau lager kiezen, nooit hoger). Thuisbasis, kaartapp, dagpakket, toestellen en sessies volgen in P27, P30 en P31.

**Meldingen**: bel onderaan de zijbalk met rode teller; pagina `/meldingen` met rijen met kleurbalk per soort (kritiek rood, hete aanleiding paars, dagstart blauw, herinnering geel, inzicht groen), "Openen", "Markeer gelezen", "Verberg". Lege staat: "Geen meldingen. Nieuwe meldingen verschijnen hier." Niet vastgelegd in het bouwplan; voorstel: deze tekst.

**Offline-indicator**: hoofdstuk 8 gaat voor F24. Gebruik de strook uit 8.3: "Offline · 3 wijzigingen wachten" (geel, 28 px), bij een vastgelopen wachtrij rood met "Opnieuw proberen". De rode banner uit F24 vervalt daarmee.

**Telefoon (390 px).** De mobiele schil is P27. Op 390 px mogen de schermen uit deze prompt niet horizontaal scrollen; Instellingen opent op de telefoon met "Beter op een groot scherm" (8.12).

### Klikpaden

1. Beginner klikt op "Nog te ontgrendelen": de groep klapt uit; klik op "Leadgenerator" opent de uitlegflyout met kicker "Gevorderd · vergrendeld"; "Vraag je salesmanager" maakt een melding voor de salesmanager van zijn team.
2. Beginner opent `/leadgenerator` direct: paginakop met kicker "Vergrendeld" en de uitleg, geen foutpagina.
3. Beheerder zet in `/instellingen/gebruikers` Sanne van Beginner naar Gevorderd: segmentknop, de waarde is bewaard na 600 ms, auditregel, Sanne krijgt bij haar volgende pagina de toast "Gevorderd ontgrendeld. Leadgenerator en Prospectplanning staan nu in je menu." en de nieuwe items houden één week de pil "nieuw".
4. Beheerder zet Sanne terug naar Beginner: bevestiging met reden (nooit automatisch, 4.4), auditregel, `niveauHistorie` bijgewerkt.
5. Salesmanager geeft een Beginner los "Import" vrij: de functie wordt beschikbaar zonder niveauwijziging, auditregel.
6. Accountmanager kiest in Mijn instellingen "Toon minder": zijn niveau gaat één stap omlaag; een hoger niveau is daar niet te kiezen.
7. Beheerder zet "Iedereen ziet alles" aan: alle gebruikers zien alles als Expert, de groep "Nog te ontgrendelen" verdwijnt.

### Regels

- `beschikbaar(functie, gebruiker) = pakketBevat && niveauMinimaal && rolMag || ontgrendeldVoor` (4.2). De server weigert een endpoint van een niet-beschikbare functie met 403 en `{functie, reden: 'niveau'|'pakket'|'rol'}`.
- Rol en niveau staan los: salesmanager minimaal Gevorderd en standaard Expert, beheerder standaard Expert, accountmanager standaard Beginner tenzij de beheerder bij uitnodigen anders kiest.
- Een gebruiker heeft precies één rol. Een accountmanager zit in één team; een salesmanager is eigenaar van één of meer teams.
- Rechtenniveaus `geen`, `eigen`, `team`, `alles`; acties lezen, schrijven, verwijderen, beheren; matrix exact als 3.3. Een tabel die niet in de matrix staat valt op `geen`. `eigen` is tot sprint 5 een zachte filter "Van mij"; de teambeperking van de salesmanager is vanaf sprint 1 server-side.
- Een Beginner heeft 10 zijbalkitems en de hele navigatie past zonder scrollen op 900 px hoogte.
- Niveau en vergrendeling gebruiken alleen `--wit-30`, `--wit-55`, `--muted` en de gestippelde pil, nooit rood of geel.
- Werkdagen zonder Nederlandse feestdagen bestaan niet meer: `shared/datum.ts` kent de feestdagen (gat 15).
- Buiten de mock-modus blijft er nooit demodata in de client als de servertabel leeg is (gat 23).

### Helpartikelen

- "Je niveau en wat er komt" (Hoe werkt Dealtrace, Aan de slag): wat Beginner, Gevorderd en Expert betekenen, hoe je vergrendelde functies herkent, hoe het groeipad werkt.
- "Je werkplek: binnendienst of buitendienst" (Aan de slag): wat het werkplekprofiel verandert en wat niet.
- "Meldingen instellen" (Aan de slag).
- "Gebruikers, rollen en niveaus" (Inrichten, beheerder): uitnodigen, niveau zetten, losse ontgrendeling, "Iedereen ziet alles".

## Deel 2: Technisch (hoe)

### Datamodel

Migratie `0001_fundament` met drizzle (generate en apply). Elke tabel heeft `id`, `organisation_id`, `data jsonb` en tijdstempels; een veld krijgt alleen een kolom als erop gefilterd, geteld of gejoind wordt (10.1).

| Tabel | Kolommen (naast de standaard) |
|---|---|
| `organisations` | `name`, `pakket`, `features`, `contract`, `stripe_customer_id`, `status` |
| `users` | `email`, `name`, `role`, `niveau` (`beginner`, `gevorderd`, `expert`), `team_id`, `werkplek` (`binnendienst`, `buitendienst`, `hybride`), `laatste_inlog`, `status`; `data.ontgrendeld[]`, `data.niveauHistorie[] {van, naar, op, door, reden}` |
| `teams` | `naam`, `manager_ids[]`, `gekoppelde_teams[]` |
| `org_settings` | `(organisation_id, key)`, `value jsonb`; sleutel `niveaus = {aan, criteria, standaardNiveauNieuweGebruiker}` |
| `audit_events` | `actor_id`, `action`, `resource_type`, `resource_id`, `changes`, `metadata` |
| `server_records` | `key`, `version` (conflictgrootboek) |
| `activiteiten` | kolommen uit 10.2; alleen toevoegen (geen update of delete via de app-rol) |
| `notificaties` | `gebruiker_id`, `soort`, `titel`, `tekst`, `link`, `gelezen_op`, `op` (8.14 legt `gelezen_op` op de server vast) |
| `push_subscriptions` | per gebruiker en toestel; gevuld vanaf P27 |

- Bouwplan 4.6 noemt `users.data.werkplek` en 10.2 een kolom `werkplek`; volg 10.2 (kolom), want het profiel bepaalt de standaardindeling en wordt gefilterd in Team.
- **RLS**: policy `org_isolation` op elke tabel met `organisation_id = current_org_id()` per transactie; de app verbindt als `dealtrace_app` zonder `bypassrls`; de organisatie komt uit de sessie, nooit uit de payload (10.1).
- **Wissen**: `null` in een patch wist de sleutel, `undefined` wist niets (`shared/wisPatch.ts`).
- **Herkomst**: `data.herkomst[veld] = {bron, op, door?, url?}` met bronprioriteit hand, kvk, datacollectief, crm, salesdna, web, ai, import; een lagere bron overschrijft een hogere nooit stil. Leg de functie hier vast (`shared/herkomst.ts`, zie pure functies), gebruikt vanaf P03.
- **Sync-allowlist** `shared/syncTabellen.ts`: in deze prompt alleen `notificaties` (gelezen) en de persoonlijke instellingen; latere prompts voegen hun tabellen toe. `users` staat er nooit in.
- **Rechtenmatrix** `shared/permissions.ts` (in DealDrive `server/utils/permissions.ts`): onderdelen en waarden exact als 3.3, met de kolom founder als "alleen na instappen".

### Pure functies

| Functie | Invoer | Uitvoer | Randgevallen en tests |
|---|---|---|---|
| `beschikbaar(functie, gebruiker, organisatie)` in `shared/functies.ts` | functiesleutel, gebruiker (rol, niveau, ontgrendeld), organisatie (pakket, features, niveaus aan) | `{ok: true}` of `{ok: false, reden: 'niveau'|'pakket'|'rol'}` | onbekende sleutel is `rol` geweigerd; "Iedereen ziet alles" maakt niveau Expert; ontgrendeling gaat boven niveau maar nooit boven pakket of rol. Niet vastgelegd of een ontgrendeling het pakket mag passeren; voorstel: nee, want het pakket is het plafond van de organisatie |
| `niveauMinimaal(niveau, vereist)` | twee niveaus | boolean | alle negen combinaties |
| `rolMag(rol, onderdeel, actie, scope)` in `shared/permissions.ts` | rol, onderdeel, actie, `{eigen, team}` | boolean | tabel buiten de matrix is `geen`; salesmanager buiten zijn team is nee |
| `zijbalkVoor(rol, niveau, werkplek, ontgrendeld)` | gebruiker | `{items[], vergrendeld[]}` | Beginner 10, Gevorderd 14, Expert 15; volgorde Werk volgt werkplek |
| `isWerkdag(datum, organisatie)`, `volgendeWerkdag`, `telWerkdagen` in `shared/datum.ts` | ISO-datum | boolean of ISO-datum | Koningsdag op zondag (dan 26 april), Pasen, Hemelvaart, Pinksteren, Kerst, Nieuwjaar; bevrijdingsdag volgens instelling. Niet vastgelegd of 5 mei een vrije dag is; voorstel: instelbaar per organisatie, standaard alleen in lustrumjaren |
| `magOverschrijven(bronOud, bronNieuw)` in `shared/herkomst.ts` | twee bronnen | boolean | gelijke bron mag; hand wint altijd |
| `veldenVoorNiveau` | later in P03 | | |

### Endpoints

| Methode en route | Recht | Invoer | Uitvoer | Fouten |
|---|---|---|---|---|
| `GET /api/settings` | ingelogd | | alle sleutels behalve `VERBORGEN_KEYS` | 401 |
| `PUT /api/settings/:key` | beheerder | `{value}` | `{key, value}` | 403 bij een sleutel van de leverancier (pakket, aiBundel, features, platformprompts); 400 bij een onbekende sleutel |
| `POST /api/sync/mutations` | per mutatie de matrix | mutaties met `idempotentie_sleutel` | resultaten per mutatie | 409 bij versieconflict, 403 per mutatie buiten de allowlist |
| `POST /api/sync/conflict-check` | ingelogd | recordsleutels en versies | conflicten | |
| `GET /api/functies` | ingelogd | | catalogus met per sleutel `beschikbaar` en reden | |

Niet vastgelegd in het bouwplan; voorstel voor gebruikers, teams en meldingen:

| Methode en route | Recht | Doel |
|---|---|---|
| `GET /api/me` | ingelogd | gebruiker, rol, niveau, werkplek, team, beschikbare functies |
| `GET/POST/PUT /api/gebruikers`, `POST /api/gebruikers/:id/archiveer` | beheerder | gebruikers; vangrails niet jezelf en niet de laatste beheerder (409) |
| `POST /api/gebruikers/:id/niveau {niveau, reden}` | beheerder; salesmanager voor eigen teams | niveau zetten, reden verplicht bij verlagen |
| `POST /api/gebruikers/:id/ontgrendel {functie, aan}` | beheerder; salesmanager voor eigen teams | losse ontgrendeling |
| `POST /api/mij/toon-minder` | ingelogd | één niveau omlaag, nooit omhoog |
| `GET/POST/PUT /api/teams` | beheerder | teams |
| `GET /api/notificaties`, `POST /api/notificaties/:id/gelezen`, `POST /api/notificaties/:id/verberg` | eigen | meldingen |

### Functiecatalogus

`shared/functies.ts` bevat per functie: sleutel, naam, niveau, pakket, recht, helpartikel. Bouwcheck `check:functies` faalt als een sleutel een van de vier mist. Het bouwplan legt geen sleutelnamen en geen pakket per functie vast (behalve de AI-bundels in 11.4); voorstel: sleutels als `domein.functie`, pakket Starter tenzij een latere prompt anders zegt. Leg in deze prompt de sleutels van de zijbalk vast:

| Sleutel | Niveau | Pakket | Recht | Helpartikel |
|---|---|---|---|---|
| `nav.vandaag`, `nav.agenda`, `nav.acties`, `nav.belblokken`, `nav.bezoeken`, `nav.prospects`, `nav.contacten`, `nav.richting`, `nav.resultaten` | Beginner | Starter | iedereen | per pagina het artikel uit F21 |
| `nav.campagnes` | Beginner (meedoen) | Starter | iedereen | "Campagnes" |
| `nav.pipeline`, `nav.leadgenerator`, `nav.inzichten`, `nav.planning` | Gevorderd | Starter | iedereen | "Pipeline en offertes", "Leadgenerator", "Inzichten beoordelen", "Prospectplanning" |
| `nav.reizen` | Expert | Starter | iedereen (lezen), salesmanager (activeren) | "De prospectreis en fases" |
| `nav.team`, `nav.coaching`, `nav.analyse`, `nav.audit` | Gevorderd | Starter | salesmanager | "Team controleren" |
| `nav.instellingen` | Expert | Starter | beheerder | "Gebruikers, rollen en niveaus" |
| `nav.platform` | n.v.t. | n.v.t. | founder | geen (platform) |
| `gebruikers.niveau`, `gebruikers.ontgrendel` | Gevorderd | Starter | salesmanager (team), beheerder | "Gebruikers, rollen en niveaus" |
| `mij.toonMinder` | Gevorderd | Starter | iedereen | "Je niveau en wat er komt" |

### AI-stappen en integraties

Geen AI in deze prompt. De mock-modus staat er wel: elke latere AI-laag en adapter krijgt een mock; de app start zonder sleutels met `GET /api/config/status`, die alleen laat zien of een sleutel bestaat (12).

### Hergebruik uit DealDrive

| Bestand | Wat je aanpast |
|---|---|
| `server/utils/appStore.ts`, `shared/wisPatch.ts`, `server/db/rls.sql`, `server/db/schema.ts` | letterlijk; schema uitgebreid met `niveau`, `team_id`, `werkplek`, `teams` |
| sync-bestanden uit Lees eerst | letterlijk; allowlist leeg beginnen |
| `server/utils/permissions.ts` | verhuist naar `shared/permissions.ts`; niveau `team` krijgt echte teams (in DealDrive gereserveerd en nergens toegekend) |
| `server/utils/session.ts`, `server/utils/auditStore.ts` | sessie met niveau, team en werkplek |
| `shared/features.ts`, `server/utils/featureFlags.ts`, `server/utils/pakketten.ts` | samenvoegen tot de functiecatalogus met niveau (4.2); de override per organisatie blijft in `organisations.features` |
| `shared/settingKeys.ts`, `server/utils/settingsStore.ts` | `VERBORGEN_KEYS` aan lees- en schrijfkant |
| `shared/datum.ts` | feestdagen toevoegen (gat 15) |
| `NotificationBell.vue`, `notificaties.vue`, `OfflineBanner.vue` | strook uit 8.3; `gelezen_op` op de server |

### Buiten scope

Inloggen met code en de mobiele schil (P27), Platformbeheer en werken in een organisatie (P02), het groeipad met `niveauVoorstel` en leerpaden (P09), Web Push-verzending (P26), de inhoud van alle features.

## Acceptatiecriteria

1. Een Beginner ziet precies de 10 items uit 6.1, een Gevorderde 14, een Expert 15; de navigatie van een Beginner past zonder scrollen op 900 px hoogte.
2. Een item boven het niveau staat in "Nog te ontgrendelen" met slot, is focusbaar en opent de uitlegflyout met de vier blokken; een directe link toont de vergrendelde paginakop, geen foutpagina.
3. Een endpoint van een niet-beschikbare functie geeft 403 met `{functie, reden}`; getest voor `niveau`, `pakket` en `rol`.
4. Een losse ontgrendeling maakt de functie beschikbaar zonder het niveau te veranderen, met auditregel; "Toon minder" verlaagt alleen; verlagen door de beheerder vraagt bevestiging en reden.
5. "Iedereen ziet alles" maakt iedereen Expert en verbergt de groep "Nog te ontgrendelen".
6. Een salesmanager kan geen niveau zetten voor een gebruiker buiten zijn teams (server-side, 403).
7. Cross-tenant in de wegwerp-Postgres: gebruiker van organisatie A leest of schrijft niets van B, ook niet met een `organisation_id` in de payload.
8. `PUT /api/settings/pakket` en de andere `VERBORGEN_KEYS` geven 403; `GET /api/settings` toont ze niet.
9. Een instelling is na 600 ms stilte bewaard met de status "Opgeslagen" en een auditregel.
10. Een mutatie offline komt na herstel precies één keer aan (idempotentiesleutel); een versieconflict opent het conflictvenster met "Houd mijn versie" en "Neem de andere over".
11. Bijlage A, gat 15: `telWerkdagen` tussen 2026-12-24 en 2027-01-04 telt Kerst en Nieuwjaar niet mee; Koningsdag 2026-04-27 (een maandag) en Tweede Paasdag 2026-04-06 zijn geen werkdag.
12. Bijlage A, gat 23: met een lege servertabel buiten de mock-modus toont de client een lege staat en geen demodata.
13. Bijlage A, gat 16: rechtenmatrix, functiecatalogus, werkdagen en herkomstprioriteit staan elk één keer in `shared/`.
14. `check:functies` faalt op een catalogusregel zonder helpartikel; `check:rechten` faalt op een tabel buiten de matrix die via de sync-queue wordt geschreven.
15. Getest als Beginner, Gevorderd en Expert (accountmanager), en als salesmanager en beheerder: zijbalk, gebruikersblok, paginakop en vergrendelde knoppen kloppen per niveau.
16. Op 390 px geen horizontale scroll op `/instellingen`, `/instellingen/gebruikers` en `/meldingen`; tikdoelen minimaal 44 px.

## Definition of Done

Hoofdstuk 19 geldt volledig. Specifiek voor deze prompt:

- `check:rechten` en `check:functies` bestaan en draaien in de bouwketen; ze zijn de basis voor alle latere prompts.
- De databasevrije suite en de wegwerp-Postgres-suite bestaan (`tools/wegwerpdb/`) met de cross-tenanttest.
- Playwright-projecten voor desktop en 375, 390 en 412 px staan klaar met aanraakmodus.
- `docs/HOE-HET-WERKT.md` beschrijft rol, niveau, werkplekprofiel, `beschikbaar()` en de rechtenmatrix; `docs/HERGEBRUIK.md` pint commit 75bee61.
- Testdata alleen uit de startset Voltvast (Bijlage C) of neutrale testgebruikers; geen echte bedrijfs- of persoonsgegevens.
