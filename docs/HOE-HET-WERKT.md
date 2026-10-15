# Hoe Dealtrace werkt (P01)

## Drie dingen bepalen wat iemand ziet

1. **Rol**: accountmanager, salesmanager, beheerder of founder. De rol bepaalt wat je mag (rechtenmatrix).
2. **Niveau**: Beginner, Gevorderd of Expert. Het niveau bepaalt welke functies voor je aanstaan.
3. **Werkplek**: binnendienst, buitendienst of hybride. De werkplek bepaalt de volgorde (buitendienst ziet Bezoeken voor Belblokken), nooit wat je mag.

## Is een functie beschikbaar?

`shared/functies.ts`, functie `beschikbaar()`:

```
beschikbaar = pakket bevat de functie  EN  rol mag de functie  EN  functie staat aan voor het niveau
```

Staat hij uit, dan krijg je een reden terug: `pakket`, `rol` of `niveau`.

- Reden **niveau**: de functie staat in de zijbalk onder "Nog niet aangezet" met een slotje. Een klik opent de uitleg (Wat het doet, Tot die tijd). Een directe link toont dezelfde uitleg.
- Reden **pakket** of **rol**: de functie is onzichtbaar; een directe link geeft "Geen toegang".
- De API weigert met 403 en `data.reden`, zodat de server dezelfde regel volgt als het scherm.

## Features per niveau

Welke functie bij welk niveau aanstaat, staat niet in de code maar in de tabel `functies_per_niveau` (functie, niveau, aan, organisatie). De migratie vult hem met een startindeling (kolom `startNiveau` in de catalogus). Daarna zet de founder functies aan of uit op `/platform/features` (P09). Een regel voor één organisatie gaat voor de algemene regel; zonder regel staat een functie uit.

De app-rol kan deze tabel niet wijzigen; alleen de platformlaag van de founder.

**Iedereen ziet alles** (Instellingen, Niveaus) zet voor de hele organisatie alles uit het pakket aan, los van het niveau. Pakket en rol blijven gelden.

**Toon minder** (Mijn instellingen) verbergt functies voor jezelf. Je kunt er nooit iets mee aanzetten.

## Niveau wijzigen

Beheerder voor iedereen, salesmanager alleen binnen de eigen teams (anders 403). Verlagen vraagt een reden. Functies die door een hoger niveau aangaan, krijgen een week de pil "nieuw" en één melding. Elke wijziging komt in de audit.

## Rechtenmatrix

`shared/permissions.ts` geeft per onderdeel, rol en actie (lezen, schrijven, verwijderen, beheren) een bereik: geen, eigen, team of alles. De founder ziet organisatiedata alleen als hij is ingestapt, en dan alleen lezend.

## Gescheiden organisaties (RLS)

Elke tabel heeft `organisation_id` en een RLS-regel `organisation_id = current_org_id()`. De app verbindt als `dealtrace_app` (geen superuser, omzeilt RLS niet) en zet per transactie de organisatie (`metOrganisatie()` in `server/utils/db.ts`). Zonder organisatie ziet de app niets. `pnpm test:db` bewijst dit.

## Offline

Wijzigingen die offline moeten werken (meldingen gelezen of verbergen, persoonlijke instellingen) gaan eerst in een wachtrij in de browser (IndexedDB) en dan naar `POST /api/sync/mutations`. Elke wijziging heeft een idempotentiesleutel, zodat dubbel versturen niets dubbel doet. Is de stand op de server intussen veranderd, dan opent het conflictvenster: "Houd mijn versie" of "Neem de andere over".

## Platformbeheer en werken in een organisatie (P02)

Er is geen aparte HQ: Platformbeheer zit in dezelfde app, alleen voor de founder. De scheiding zit in drie lagen.

1. **De client verbergt.** Gewone gebruikers zien geen Platformbeheer; `/platform/klanten` toont voor hen "Niet gevonden". Dit is gemak, geen beveiliging.
2. **De server weigert.** De middleware `server/middleware/10.platform.ts` geeft 404 op elke `/api/platform/**`-route voor iedereen zonder founderrol, en elk platformendpoint roept zelf `requireFounder(event)` aan. De bouwcheck `pnpm check:platform` faalt als een platformendpoint dat vergeet of als een gewoon scherm een platformroute aanroept.
3. **De database zegt nee.**
   - De app verbindt als `dealtrace_app`. Die is lid van `dealtrace_platform` maar erft niets (`noinherit`): alleen na `set local role dealtrace_platform` (in `alsPlatform()`, na `requireFounder`) werkt hij over organisaties heen.
   - `dealtrace_platform` mag organisaties, gebruikers, teams, instellingen, aanvragen, toegangsverzoeken, gezondheid en `platform_audit`. Klantdata (activiteiten, meldingen lezen, later accounts en contacten) mag hij niet; daarover krijgt hij alleen getallen via `dealtrace_platform_tellingen()`.
   - Een trigger weigert de rol `founder` voor iedereen behalve de migratierol.
   - `platform_audit` is alleen toevoegen, voor iedere rol.

**Verificatie.** Platformendpoints vragen `aal2` (tweestapsverificatie, P27; in de ontwikkelmodus geldt de founder als geverifieerd). Gevaarlijke acties (pakket verlagen, overschakelen naar "Ook wijzigen") vragen een herbevestiging binnen 15 minuten, anders 428 en het venster "Bevestig dat jij het bent". Een platformsessie vervalt na 12 uur stilte.

**Werken in een organisatie.** De founder kiest "Werk in deze organisatie", geeft een reden (minstens 5 tekens) en kiest "Alleen meekijken" (standaard) of "Ook wijzigen". De server zet het cookie `dt_werkin`, ondertekend met `ORG_WISSEL_SECRET` (eigen geheim), met organisatie, modus, reden en vervaltijd (hooguit 8 uur). Daarna:

- is de actieve organisatie die uit het cookie, nooit uit de payload;
- werkt de founder met de rechten van een beheerder, maar in "Alleen meekijken" weigert `server/middleware/20.meekijken.ts` elke schrijfactie in klantdata (ook de sync-wachtrij) met de meekijktekst;
- staat elke start, modewissel en stop in `platform_audit` en in `audit_events` van de klant, en krijgen de beheerders een melding;
- staat bovenaan elke pagina de gele balk met organisatie, modus, resterende tijd en "Terug naar platform".

Kiest de klant "Alleen na toestemming", dan maakt de founder eerst een toegangsverzoek (24 uur geldig); pas na goedkeuring door de beheerder kan hij erin.

**Spiegel voor de beheerder.** Abonnement (pakket in gewone woorden, seats, contract, "Upgrade aanvragen"), Audit en toegang leverancier, en bij Gebruikers "Gebruiker toevoegen" binnen de seats of "Gebruiker aanvragen", volgens de stand die de founder zet. Een aanvraag of upgrade geeft de founder een melding.

**Gezondheid** (`shared/gezondheid.ts`): Leeg, Risico, Let op of Gezond, met vaste regels. Berekend in `org_gezondheid` zodra de stand ouder is dan een uur. Daar ook de proefperiode: melding 7 dagen vooraf en daarna automatisch naar Starter.

**Startset** (`server/utils/orgStarter.ts`): register van onderdelen voor een nieuwe klant; elke latere prompt voegt zijn onderdeel toe. "Startset aanvullen" in de klantflyout draait alles opnieuw en is idempotent.

## Accounts, contacten en eigen velden (P03)

- **Een account is een bedrijf**; prospect of klant is de eigenschap `account_kind`. Klanten komen uit DealDrive of het CRM. Dealtrace maakt zelf geen klant van een prospect: er is geen endpoint, knop of menu-item om te promoveren (B17).
- **Eén plek per rekenregel** in `shared/`: score met opbouw (`score.ts`, geen vaste 50), laatste contact (open taken, toekomstige afspraken en import tellen niet), primair contact en ontbrekende rollen (`contactgegevens.ts`), ontdubbelen op KvK, domein en naam (`ontdubbelen.ts`, Sørensen-Dice 80 en 60 procent), filters met meerekenende tellers (`accountFilters.ts`), en eigen velden (`eigenVelden.ts`).
- **Filters** staan in de URL; tellers rekenen mee met alle andere actieve filters. "Van mij" staat standaard aan.
- **Contacten** hebben één rolbegrip (beslisser, beïnvloeder, champion, gebruiker, blokkeerder, poortwachter, onbekend). Een contact kan niet zonder account bestaan; verwijderen van een account neemt de contacten mee. "Bel me niet" zet het nummer op de bel-me-niet-lijst; vertrekken in plaats van verwijderen.
- **Eigen velden**: waarden staan in `data.customFields`, met herkomst. Zichtbaar per niveau, ook in de API-respons. "Filterbaar" maakt een expressie-index via `dealtrace_index_eigen_veld()`. Een typewissel kan alleen als alle bestaande waarden geldig blijven.

## Importeren (P04)

Leadgenerator, tabblad Importeren: een wizard in vier stappen (bestand, kolommen koppelen, controle en ontdubbelen, bevestigen).

- **Bestand**: Excel (.xlsx) of CSV, hooguit 10.000 rijen en 10 MB. De rijen staan tijdelijk in de conceptbatch en worden na verwerken gewist.
- **Kolommen**: `importKoppeling()` herkent kolomnamen; `cf:sleutel` of de naam van een eigen veld gaat naar dat veld. Een kolom zonder koppeling wordt niet geïmporteerd; de import verzint niets.
- **Ontdubbelen**: tegen het bestand op KvK, domein (zonder www.) en, als de rij een postcode heeft, naam plus postcode (80 procent zeker, 60 mogelijk); zonder postcode de naamregel. Binnen het bestand op KvK, domein en naam plus postcode; dubbele rijen worden één account. Optioneel tegen DealDrive via `server/utils/dealdriveAdapter.ts` (mock lokaal en in tests; `DEALDRIVE_MODUS=uit` zet het uit). "Al klant in DealDrive" wordt standaard overgeslagen.
- **Samenvoegen**: import is de laagste bron, dus vult alleen lege velden. Een klant gaat nooit terug naar prospect.
- **Datakwaliteit**: e-mail syntaxis plus MX (`server/utils/mx.ts`, mock in tests), telefoon naar E.164, postcode vier cijfers en twee letters. Een afgemeld e-mailadres (onderdrukkingslijst, gehasht) krijgt toestemming e-mail "nee"; een nummer op de bel-me-niet-lijst krijgt "Bel me niet".
- **Geen contactmoment**: een import vult `laatste_contact_op` nooit.
- **Herkomst**: elk veld krijgt `{bron: 'import', op, door, batchId}`.
- **Terugdraaien**: alleen accounts zonder activiteit en zonder wijziging met de hand; samengevoegde accounts krijgen hun oude waarden terug. Een tweede keer geeft 409.

## Prospectreis, status en terugkomregels (P05)

De reisfase zegt waar een account staat; de status zegt of het nu bewerkt wordt. Ze veranderen altijd samen en op één plek.

- **Standaardreis**: tien fases in vijf hoofdfases (Vinden, Bewerken, Verbinden, Overgedragen, Verloren), tot en met de eerste afspraak en de overdracht. De definitie staat één keer in `shared/reis.ts`; elke organisatie krijgt hem als echte rij in `reistemplates` (met startactiviteiten in `activiteitstemplates`), via de startset en na elke migratie (`server/db/reisStart.ts`).
- **Status** (`shared/nbStatus.ts`, `volgendeStatus`): nieuw, in reis, wachtend, nee, gescoord, overgedragen. Overgedragen blijft overgedragen; terugkomen gaat alleen via een terugkomregel.
- **Meldpunt** (`POST /api/reis/gebeurtenis`, `server/utils/reis.ts`): de enige plek waar fase, reis en status veranderen. In één transactie: `volgendeFase`, `volgendeStatus`, de inschrijving in `prospectreizen`, een regel in `reisgeschiedenis`, een activiteit en een auditregel. Zonder wissel alleen een activiteit. De database weigert elke andere update van `fase_id`, `reis_id` of `nb_status` (trigger `dealtrace_alleen_via_meldpunt`); `PUT /api/accounts/:id` met een fase geeft 400.
- **Melders per gebeurtenis**: `import` (import, P04) en `lead-overgenomen` (handmatig aanmaken nu, leadgenerator in P11) bij binnenkomst; `gekwalificeerd` (knop Kwalificeer of BAND minimaal 3 van 4); `handmatig` (Fase corrigeren, reden verplicht, vanaf Gevorderd); `heropvolging` (dagelijkse terugkomcontrole). De melders voor `dossier-compleet` (P19), `eerste-contact` en `gesprek-gevoerd` (P07), de afspraken (P13) en `overgedragen` (P17) komen later; tot dan kun je ze via het meldpunt testen. Een tweede `eerste-afspraak-gepland` binnen dezelfde inschrijving verandert niets (gat 3).
- **Toewijzing**: `kiesReis` neemt de eerste actieve doelgroep op prioriteit (1 eerst) waarin het account past en die een eigen reis heeft; anders de standaardreis. Een account zit in hoogstens één actieve reis; na een eindfase start heropvolging een nieuwe inschrijving.
- **Zet nee**: vaste reden ("Anders" vraagt een toelichting), afkoelperiode per kanaal (bellen 90, mail 60, LinkedIn 90, WhatsApp 180, bezoek 180, kaart 365 dagen; instelbaar onder Instellingen, Redenen voor nee) en een terugkomdatum uit de terugkomregel. De afkoelperiode is de ondergrens: een datum erbinnen schuift op. "Niet geschikt" is 365 dagen voor elk kanaal. `magBenaderen` controleert dit voor elke poging. Het account gaat naar de fase Verloren (na een gehouden eerste afspraak via `geen-vervolg`).
- **Terugkomregels**: tot Richting (P28) staan de regels, de mapping van reden naar regel en de concurrenten in `org_settings` onder `verkoopverhaal` (uit Bijlage C). Zonder regel geldt de afkoelperiode van bellen.
- **Terugkomcontrole**: accounts op nee of wachtend met een terugkomdatum vandaag of eerder krijgen `heropvolging` en staan daarna in Gekwalificeerd met status in reis. Hij draait lui, hooguit eens per uur per organisatie, bij het openen van de prospectlijst of een accountkaart. Een tweede run doet niets, want de terugkomdatum is dan leeg.
- **Offline**: "Zet nee" en "Pauzeer tot" mogen via de wachtrij (`accounts` met de soorten `account.nee` en `account.pauzeer`); de idempotentiesleutel zorgt dat het precies één keer aankomt. Een fasewissel via de wachtrij wordt geweigerd.
- **Wie wat**: Beginner ziet fasepil, status en dagen in fase, en kan kwalificeren en nee zetten. Gevorderd: Fase corrigeren, reisgeschiedenis, filter Reis en fase, de reis alleen lezen, terugkomdatum aanpassen en eigen accounts verplaatsen. Expert en salesmanager: `/reizen`. Salesmanager: doelgroepen en accenten. Beheerder (en salesmanager): Standaard terugzetten.

## Motor, regels en accountmatrix (P06)

De motor zet zelf taken en inzichten klaar op basis van regels. De matrix is de inrichting, de regels zijn de uitvoering.

- **Regels** (`activity_rules`): elke regel is een als-dan-afspraak met drie blokken. *Wat en wanneer* (categorie, omschrijving, activiteit inzicht of taak, cadans, prioriteit), *Sturing* (bron, triggerpatroon met parameters, motor regel of AI, afbakening op accounttype, status, reis en fase, doelgroep, campagne en klasse) en *Gevolg* (actiesoort, uitvoerderrol, termijn, taaksjabloon met `{account}`, `{contact}`, `{afspraak}`, belscript, automatisch voorbereiden, signaaltype, verwacht resultaat). Elk veld stuurt iets; Excel gebruikt dezelfde kolommen (`shared/regelExcel.ts`).
- **Eén catalogus** (`shared/regelPatronen.ts`): vijftien triggerpatronen, cadansen, actiesoorten en `evaluateTrigger`, `ruleTargetsAccount`, `cadansVerstreken`, `vulSjabloon`, `droogloop`. De accountmatrix staat in `shared/ritmematrix.ts`.
- **Starterset**: 23 regels (SR01 tot en met SR23) als data in `seed/regels-starterset.json`. Elke organisatie krijgt ze bij aanmaken (startset) en na de migratie als ze nog geen regels heeft. "Starterset terugzetten" maakt de organisatieregels weer precies deze 23; persoonlijke en teamregels blijven. Regels waarvan de bron nog niet bestaat (afspraken, campagnes, webbronnen) leveren nu nul treffers zonder fout en zijn met fixtures getest.
- **Motorrun** (`shared/motor.ts`, databasevrij; `server/utils/motor.ts` laadt en schrijft): eerst de campagne-afsluiter (nog leeg), dan de regels, dan de planner (landing en capaciteit), dan de belblokvuller en het automatisch voorbereiden (nog leeg). Per regel en onderwerp een cadanspoort; een open taak of inzicht wordt niet verdubbeld (een open inzicht wordt bijgewerkt zonder terug naar ongelezen). Nooit twee ritmes op één account; geen contacttaak in afkoeling (`magBenaderen`). Een Beginner krijgt motorvoorstellen als inzicht ter goedkeuring, behalve ritmepogingen.
- **Wanneer**: elk uur via de geplande functie `netlify/functions/motor-uur.mts` (roept `POST /api/motor/run-all` aan met `MOTOR_SECRET`), direct na een gebeurtenis op het meldpunt voor dat ene account (met de startactiviteiten van de fase), en op "Draai motor nu". Een tweede handmatige run terwijl er een loopt geeft 429. Open sessies pollen `GET /api/motor/updates` elke minuut.
- **Capaciteit en landing**: standaard 40 beltaken voor de binnendienst en 6 bezoeken voor de buitendienst per dag; het overschot schuift naar de volgende werkdag met een melding. De vervaldatum is het eerstvolgende belblok of de regiodag; zolang die er niet zijn het volgende hele werkuur (9 tot 18, geen weekend of feestdag).
- **Leerlus**: onder 20 procent acceptatie over 30 dagen (minstens 10 voorstellen) krijgt de eigenaar van de regel het inzicht "Regel levert vooral ruis".
- **Rechten**: Gevorderd leest en ziet de droogloop; Expert maakt persoonlijke regels voor zijn eigen accounts en stelt wijzigingen aan teamregels voor; de salesmanager beheert teamregels en wijzigt bij organisatieregels aan of uit, cadans, drempels en klassen; de beheerder alles, met Excel, back-up en de starterset. Een regel die meer dan 50 taken per persoon zou maken, vraagt bevestiging.
- **Accountmatrix** (`/instellingen/ritme`): klassen (instelling `klassen`, code hooguit 2 tekens), segmenten, belmatrix, afspraakmatrix, afkoeling, frequentieplafond en capaciteit. Een lege cel is "niet ingesteld" (de standaard geldt), 0 is "bewust uit" (geen ritmetaken). Interval is 365 gedeeld door het jaartotaal, minimaal 1 dag. De afrekening is per account, niet per klasse. Een kapotte instelling geeft de standaard met een waarschuwing in het runverslag.

## Waar staat wat

| Map | Inhoud |
|---|---|
| `shared/` | Rekenregels die server en scherm delen: functies, zijbalk, rechten, feestdagen |
| `server/db/` | Migraties, rollen, seed |
| `server/api/` | API-endpoints |
| `server/utils/` | Sessie, database, audit, zoekbronnen |
| `app/` | Schermen, componenten, composables |
| `tests/unit`, `tests/db`, `tests/e2e` | Tests |
| `tools/checks` | Bouwchecks op catalogus en rechten |
