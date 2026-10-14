# DealDrive Leadgeneratie: bouwprompts voor een nieuwe tool

> Werkdocument voor het bouwen van een nieuwe DealDrive-tool voor leadgeneratie
> en new business. Onderzocht op 12 oktober 2026 tegen de code van DealDrive op
> `develop` (commit 1c314ec, map `C:\Projecten\dealdrive`) en het handboek
> `docs/HOE-DEALDRIVE-WERKT.md`. Elk hoofdstuk is één bouwprompt voor een
> Claude Code-sessie; de prompts bouwen op elkaar en horen in deze volgorde.
> Huisregels: alles in het Nederlands, geen gedachtestreepjes in UI-copy,
> commentaar en documentatie, en per prompt één commit met een bijgewerkt
> handboek.

## Wat de nieuwe tool is, in één alinea

Een sales-workspace voor new business die een bedrijf van onbekende naam naar
betalende klant brengt in drie fases: de pre-data en kwalificatiefase (vinden,
verrijken, kwalificeren), de prospectfase (bewerken op ritme, met campagnes en
belblokken) en de verbindingsfase (eerste afspraak, offerte, deal, overdracht
naar klant). De ruggengraat is een prospect journey met fases en gebeurtenissen,
gestuurd door activity selling-regels (de motor) die inzichten en taken maakt.
Alles draait om één keten: inzicht met bewijs, de verkoper keurt goed, taak,
uitvoering door de verkoper zelf of met een AI-concept dat nooit zelf handelt.

## Hoe je dit document gebruikt

1. Lees eerst hoofdstuk 0 (de kaders) en hoofdstuk 1 (wat je uit DealDrive
   overneemt en wat je bewust anders doet). Die gelden voor elke prompt.
2. Geef daarna per sessie één hoofdstuk uit deel B als opdracht, in de
   volgorde van de bouwvolgorde in hoofdstuk 2. Elke prompt noemt wat hij
   verwacht van de vorige.
3. Elke prompt heeft dezelfde opbouw: wat je bouwt in één zin, waarom,
   functioneel (schermen, teksten, lege staten), datamodel, bedrijfsregels,
   endpoints, AI-stappen, wat je uit DealDrive hergebruikt (bestandspaden),
   wat je anders doet dan DealDrive, acceptatiecriteria en wat bewust buiten
   scope blijft.
4. De bestandspaden in de hergebruik-tabellen verwijzen naar
   `C:\Projecten\dealdrive`. Kopieer de logica, niet blind de bestanden: de
   nieuwe tool heeft minder modules en een andere journey.

## Inhoud

Deel A: kaders

- 0. De kaders: principes, stack, huisstijl, rollen, multi-tenant
- 1. Wat je overneemt uit DealDrive en wat je bewust anders doet
- 2. Bouwvolgorde en afhankelijkheden

Deel B: de bouwprompts

- 3. Prompt 1: Fundament (organisatie, gebruikers, instellingen, sync, rechten)
- 4. Prompt 2: Accounts en contacten (prospects en klanten)
- 5. Prompt 3: Prospect journey (fases, gebeurtenissen, overgangen)
- 6. Prompt 4: Activity selling-regels, de motor
- 7. Prompt 5: Taken en inzichten (de goedkeuringsketen)
- 8. Prompt 6: Fase 1, pre-data en kwalificatie (leadgenerator, verrijking, BAND)
- 9. Prompt 7: Fase 2, prospectfase (dekking, jaarplanning, belblokken, ritme)
- 10. Prompt 8: Fase 3, verbindingsfase (pipeline, offertes, van prospect naar klant)
- 11. Prompt 9: Campagnes
- 12. Prompt 10: De AI-lagen (beoordeling, Pitstop, promptketen, verbruik)

Deel C: bijlagen

- 13. Bronbestanden in DealDrive per onderwerp
- 14. Bekende gaten in DealDrive die je hier meteen goed doet
- 15. Woordenlijst

---

# Deel A: kaders

## 0. De kaders

### 0.1 Drie principes die overal terugkomen

1. **Geen bewijs, geen inzicht.** Elk inzicht draagt zijn bron mee: veld,
   datum, URL, citaat. Wat de verkoper tegen een prospect zegt moet hij kunnen
   laten zien. Een AI-oordeel zonder citaat dat letterlijk in het materiaal
   staat, wordt weggegooid. (DealDrive: `server/utils/aiInsight.ts` 240 tot 252,
   `server/utils/webBron.ts` 370 tot 372.)
2. **De agent handelt nooit zonder goedkeuring.** Geen uitzondering, geen
   schakelaar. AI bereidt voor (belscript, mailconcept, briefing); de mens
   keurt goed en belt, mailt of bezoekt zelf. Er is geen verstuurknop op een
   concept. (DealDrive: `server/utils/agentExecutor.ts` 108 tot 152 en
   346 tot 352.)
3. **Gestuurd, niet lerend.** Regels en matrices sturen de motor; er is geen
   lerende lus. Dat houdt het gedrag uitlegbaar. Een feedbacklus op
   afwijzingen is een latere stap, en de data per regel ligt er dan al.

### 0.2 Stack en architectuur

- **Nuxt 4 met Vue 3.5**, server-routes onder `server/api`, gedeelde
  domeinlogica onder `shared/` (werkt op server en client), drizzle op
  Postgres (Supabase, EU-regio). Dezelfde keuzes als DealDrive, zodat je de
  modules uit bijlage 13 letterlijk kunt hergebruiken.
- **Opslagprincipe: kernkolommen plus `data` jsonb.** Een veld krijgt alleen
  een echte kolom als erop gefilterd of geteld wordt; de hele entiteit staat
  in `data`, de kolommen worden bij elke schrijfactie uit `data` afgeleid.
  `null` in een patch betekent "wis de sleutel", `undefined` wist niets.
  (DealDrive: `server/utils/appStore.ts` 46 tot 209 en 279 tot 320.)
- **Multi-tenant door de database zelf.** Elke tabel heeft `organisation_id`;
  RLS-policy `org_isolation` met `current_org_id()` uit
  `set_config('app.organisation_id', …, true)` per transactie; de app
  verbindt met een rol zonder `bypassrls`. De organisatie komt altijd uit de
  sessie, nooit uit de payload. (DealDrive: `server/db/rls.sql`,
  `server/utils/appStore.ts` 223 tot 238.)
- **Offline-first client met een mutatiewachtrij.** Wijzigingen zijn direct
  lokaal zichtbaar en gaan via `POST /api/sync/mutations`
  (`{table, op, recordId, payload, clientVersion}`) naar de server, die per
  mutatie de rechten en de versie controleert. Alleen tabellen op een
  allowlist worden geaccepteerd. (DealDrive: `shared/syncTabellen.ts`,
  `server/api/sync/mutations.post.ts` 93 tot 128.)
- **Lezen via één bootstrap-snapshot** per organisatie (`GET /api/bootstrap`)
  en daarna lichte polls op `updatedAt`.
- **Drie builds uit één repo** zijn voor de nieuwe tool niet nodig; begin met
  één klantapp. Houd wel de allowlist-gedachte aan: een module praat alleen
  met de endpoints die hij nodig heeft (`npm run check:omgeving` in
  DealDrive bewaakt dat).

### 0.3 Huisstijl en tokens

Neem de DealDrive-tokens over (`app/assets/css/tokens.css`):
`--ink #0a0a0a`, `--bg #fafaf7`, `--surface #f1f1ee`, `--yellow #fed800`,
`--yellow-dark #d4b400`; Source Serif 4 voor koppen, Inter voor lopende
tekst, IBM Plex Mono voor cijfers en labels. Afstanden 24/16/16
(`--pagina-marge`, `--sectie-padding`, `--kaart-gap`, `--kaart-padding`),
hoeken maximaal 2 px (`--radius`), geen box-shadow, kleuren altijd via
`var()`, tekst nooit onder 11 px (`--fs-label`). Knoppen: `.dd-actie--primair`
en `.dd-actie--secundair`. Elke pagina draagt zijn eigen scoped
section/container/kicker/title-blokken (kopieer ze uit een bestaande pagina);
er is geen globale stylesheet voor die blokken. Stylelint bewaakt dit; neem de
configuratie over.

Copy-regels: Nederlands, zinnen in plaats van labels met een dubbele punt,
geen gedachtestreepjes, lege staten in de vorm "KICKER / Eén zin wat er niet
is." plus één knop die de lege staat oplost.

### 0.4 Rollen

Vier rollen, overgenomen uit DealDrive: `accountmanager`, `salesmanager`,
`beheerder` en `superuser` (op het scherm "Founder", niet uitdeelbaar).
De rol zegt wat je mag, niet waar je bureau staat. Rechten staan in één
matrix per resource (`read`, `write`, `delete`, `admin`) die de server
afdwingt in de sync en die de client spiegelt; een tabel die niet in de
matrix staat valt op `none` en elke mutatie erop wordt geweigerd. Een check
(`check:rechten`) bewaakt dat elke synceerbare tabel in de matrix staat.
(DealDrive: `server/utils/permissions.ts` 37 tot 140,
`app/composables/usePermissions.ts`.)

### 0.5 Wat bewust buiten de nieuwe tool blijft

Klantritme en accountplannen voor bestaande klanten, Dex op de telefoon, de
founder-console als apart domein, agenda- en mailkoppelingen (OAuth, IMAP),
gespreksverslagen met analyse, documenten en de AI-chat. Waar een prompt een
raakvlak heeft (bijvoorbeeld "afspraak in de agenda") staat dat erbij als
koppelpunt, niet als bouwopdracht.

## 1. Wat je overneemt uit DealDrive en wat je bewust anders doet

### 1.1 Letterlijk overnemen (logica kopiëren, tests meenemen)

| Onderdeel | DealDrive-bron | Waarom |
|---|---|---|
| Opslaglaag kernkolommen plus jsonb, org-gescopete upserts, null-wisconventie | `server/utils/appStore.ts`, `shared/wisPatch.ts` | Bewezen patroon, geen migratie per veld |
| RLS-opzet en de twee databaserollen | `server/db/rls.sql`, `server/db/apply-rls.ts` | Tenantgrens in de database |
| Sync-wachtrij met allowlist, rechten per mutatie en versieconflict | `server/api/sync/mutations.post.ts`, `shared/syncTabellen.ts`, `server/utils/permissions.ts` | Offline-first zonder gaten |
| Regelmodel, triggerpatronen, cadanspoort, runsleutel, dedup, taakgeneratie | `server/utils/ruleEngine.ts`, `server/utils/activityRulesStore.ts`, `app/composables/useActivitySellingRules.ts` | De kern van de motor |
| Journey-engine met instapregel, overgangen en audit | `server/utils/journeyEngine.ts`, `server/api/journey/event.post.ts` | Kleine, afgeronde module |
| AI-beoordeling met bewijsvalidatie en het toolschema `geef_oordeel` | `server/utils/aiInsight.ts`, `server/utils/llm-provider.ts` | "Geen bewijs, geen inzicht" in code |
| Web-connector met URL- en ouderdomsvalidatie | `server/utils/webBron.ts` | Externe signalen zonder verzonnen bronnen |
| Pitstop (concept-eerst), promptbibliotheek, kostenlogboek, bundel | `server/utils/agentExecutor.ts`, `server/utils/promptBibliotheek.ts`, `shared/promptSlots.ts`, `server/utils/aiVerbruik.ts`, `shared/aiBundel.ts` | De AI-laag met vangrails |
| Leadgenerator-domein (matchregels, grenzen, dossierhoudbaarheid) | `shared/leadGenerator.ts`, `server/db/e2e-leadgenerator.ts` | Al getest, mist alleen de server |
| BAND-kwalificatie | `shared/bandKwalificatie.ts` | Compact en af |
| Ritmematrix (bel en afspraak), offertematrix | `shared/ritmematrix.ts`, `shared/offerteOpvolging.ts` | Het ritme per klasse |
| Campagnes: soorten, tempo, advies, afsluiter | `shared/campagneSoorten.ts`, `server/utils/campagneTempo.ts`, `campagneAdvies.ts`, `campagneAfsluiter.ts` | Volwaardige feature, deterministisch |
| Belblokken en bellijst | `shared/belblokken.ts`, `app/composables/useBellijst.ts`, `server/utils/belblokVuller.ts` | Het dagelijkse ritme van bellen |
| Datum- en tijdhulp, werkdagen | `shared/datum.ts` | Eén definitie van "geen tijd", "volgend werkmoment" |
| Gebieden (postcode gaat voor plaats) | `shared/gebieden.ts` | Werkgebied voor de leadzoekopdracht en de dekking |
| Import met dedupe (Sørensen-Dice) | `app/pages/import.vue` 1037 tot 1053 en 882 tot 917 | Bewezen drempels 80 en 60 procent |
| Dekkingsbakken | `app/composables/useDekkingBuckets.ts` | Prospectdekking in één blik |
| Vandaag-paneel, taak- en inzichtflyouts, bevestigingsdialoog, flyout-a11y | `app/components/VandaagPanel.vue`, `TaakFlyout.vue`, `InzichtFlyout.vue`, `NieuweTaakFlyout.vue`, `ConfirmDialog.vue`, `app/composables/useFlyoutA11y.ts` | De werkschermen |
| Tokens, stylelint-config, lege-staat-component | `app/assets/css/tokens.css`, `.stylelintrc`, `app/components/LegeStaat.vue` | Huisstijl |

### 1.2 Bewust anders dan DealDrive

Dit zijn de gaten en keuzes uit het onderzoek die de nieuwe tool meteen goed
doet. Elke prompt verwijst ernaar met het nummer.

1. **Een gewonnen deal maakt de prospect klant.** In DealDrive blijft
   `accountKind` op prospect staan na een gewonnen deal; promoveren is een
   handmatige knop. In de nieuwe tool zet de gebeurtenis `deal-gewonnen` het
   account op klant, de journey op de klantfase en de belmatrix op de
   klantrij, met één auditregel. Terugzetten blijft handmatig.
2. **Eén klasseveld.** DealDrive heeft `tier` (A/B/C) naast `accountfase`
   (A tot D, instelbaar); de leadgenerator schrijft `tier`, de planning en de
   motor lezen `accountfase`. De nieuwe tool kent alleen `accountfase`, en de
   leadgenerator zet die bij "Neem over".
3. **"Eerste afspraak" is echt de eerste.** DealDrive stuurt
   `eerste-afspraak-gepland` bij elke afspraak. De nieuwe tool controleert of
   er al een afspraak met het account was.
4. **Een leadgenerator met server en webzoeker.** DealDrive heeft vijf
   voorbeeldleads en geen endpoint. De nieuwe tool krijgt een `leads`-tabel,
   endpoints voor ronde, dossier, overnemen en afwijzen, en de webzoeker die
   `webBron.ts` al kan.
5. **De journey heeft prospectfases en prospectgebeurtenissen.** DealDrive's
   starterset is een klantjourney (awareness tot retention) met vier
   overgangen waarvan er twee nooit afgaan. De nieuwe tool start met de drie
   fases van het new business-proces als journeyfases met echte
   gebeurtenissen (lead overgenomen, dossier compleet, gekwalificeerd, eerste
   contact, eerste afspraak, offerte verstuurd, deal gewonnen of verloren).
6. **Regels mikken ook op accounttype.** DealDrive's motor filtert alleen op
   accountklasse en journeyfase; `levensfase` en `klantType` sturen niets.
   De nieuwe tool heeft een echt filter `accountType: prospect|klant|alle`
   en schrapt de dode velden `levensfase`, `klantType`, `eigenaar`,
   `triggerType` en `verwachteUitkomst`.
7. **De regeleditor bewerkt alle velden die de motor leest.** In DealDrive
   ontbreken `taakSjabloon`, `signalTypes` en `status` in de editor en laat
   `normaliseRule` `omschrijving` vallen. Hier is het formulier de enige bron
   van waarheid en is Excel een import-export daarvan.
8. **Een starterset waarvan elke regel draait.** DealDrive's standaardset van
   37 regels heeft geen triggers. De nieuwe tool levert alleen regels met
   een trigger, voor prospects, inclusief een belritmeregel (DealDrive heeft
   er geen, waardoor de prospect-belmatrix niets doet).
9. **Eigenaar is te wijzigen en te filteren.** DealDrive kan de eigenaar
   alleen met een script zetten en heeft geen eigenaarsfilter. Hier staat de
   eigenaar in het Info-formulier en op elke lijst als filter "Van mij".
10. **Verwijderen gebeurt op de server, met rechten in de UI.** DealDrive
    verwijdert contacten bij een accountverwijdering alleen lokaal en toont
    verwijderknoppen aan rollen die het niet mogen. Hier cascadeert de server
    en toont de UI de knop alleen met `delete`-recht.
11. **Taak afronden telt op één manier.** In DealDrive registreert
    `updateTaskStatus` een contactmoment, maar de bewerkmodus en het Dex-pad
    niet, en een to-do telt wel voor `lastInteractionAt` maar niet als KPI.
    Hier is er één functie `rondTaakAf` die alle paden gebruiken, en telt
    alleen een taak van type bellen, mail, bericht of afspraak als
    contactmoment.
12. **Herhaalde en Dex-taken erven de herkomst.** Vervolgtaken van een
    herhaling en taken uit "inzicht naar taak" krijgen `sourceSignalId`,
    `ruleId`, `actionType` en `executor` mee, zodat automatisch voorbereiden
    werkt.
13. **Campagnevarianten overleven het aanmaken** en een handmatige wissel
    naar actief zet `startedAt`.
14. **Het AI-maandplafond geldt voor alle automatische én handmatige
    soorten**, met een melding bij 80 procent.
15. **Werkdagen kennen feestdagen** (vaste Nederlandse lijst in
    `shared/datum.ts`).
16. **Geen dubbele definities.** DealDrive heeft twee journey-seeds (8 en 5
    fases), twee tempoformules (client met "voor", server zonder) en vier
    kopieën van de offertestatus-labels. Hier staat elke definitie in
    `shared/` en gebruiken server en client dezelfde.

### 1.3 Wat je niet overneemt

Dex en de drie lagen, de werkplek Kantoor/Onderweg, accountplannen,
startplannen, evaluaties, de founder-console als apart domein (HQ wordt een
beheertab in dezelfde app), de HubSpot-koppeling (in DealDrive onaf en zonder
sessiecontrole), mail-koppeling en inbox, agenda-tweerichtingssync, documenten
en verslaganalyse.

## 2. Bouwvolgorde en afhankelijkheden

| # | Prompt | Verwacht van | Levert aan |
|---|---|---|---|
| 1 | Fundament | niets | alles |
| 2 | Accounts en contacten | 1 | 3, 4, 6, 7, 8, 9 |
| 3 | Prospect journey | 2 | 4, 8, 9 |
| 4 | Activity selling-regels (motor) | 2, 3 | 5, 7, 8, 9 |
| 5 | Taken en inzichten | 2, 4 | 6, 7, 8, 9, 10 |
| 6 | Fase 1: leadgenerator, verrijking, BAND | 2, 3, 5 | 7 |
| 7 | Fase 2: dekking, jaarplanning, belblokken, ritme | 2, 4, 5 | 9 |
| 8 | Fase 3: pipeline, offertes, van prospect naar klant | 2, 3, 4, 5 | 10 |
| 9 | Campagnes | 2, 4, 5 | 10 |
| 10 | De AI-lagen | 4, 5, 8 | niets |

Waarom deze volgorde: de motor (4) kan pas iets doen als er accounts met
klasse en journeyfase zijn (2, 3); taken en inzichten (5) zijn de uitvoer van
de motor en de ingang van alle drie de fases; de AI-lagen (10) komen laatst
omdat elke prompt eerst zonder AI moet werken (mock-provider), precies zoals
DealDrive het deed.

Per prompt één commit op `develop`, met het handboek `docs/HOE-HET-WERKT.md`
van de nieuwe tool bijgewerkt in dezelfde commit (changelogblok bovenaan,
nieuwste eerst, plus de duurzame beschrijving in het hoofdstuk zelf).

---

# Deel B: de bouwprompts

## 3. Prompt 1: Fundament

> Bouwprompt voor een Claude Code-sessie in de nieuwe repo. Eerste van tien.
> Huisregels: Nederlands, geen gedachtestreepjes, tokens uit DealDrive, per
> prompt één commit met een bijgewerkt handboek.

### Wat je bouwt, in één zin

Een lege maar werkende multi-tenant Nuxt 4-app met organisaties, gebruikers
en rollen, een instellingenlaag per organisatie, de sync-wachtrij met
rechtenmatrix, een mock-modus zonder database, de huisstijl en de
checks, zodat elke volgende prompt alleen domein hoeft toe te voegen.

### Waarom

DealDrive's fundament is in twee jaar gegroeid tot iets wat werkt: de
database bewaakt de tenantgrens, de rechtenmatrix is één bron voor server en
client, en zonder database draait alles op mock-data zodat elke feature
zonder productiedata te testen is. Die drie dingen moeten er op dag één zijn;
later inbouwen is tien keer duurder.

### Functioneel

- **Inloggen** met e-mail en wachtwoord (Supabase Auth, server-side, tokens
  in httpOnly-cookies, lokale JWT-validatie via JWKS). Zonder `SUPABASE_URL`
  een mock-login met vier demo-gebruikers (`user-bas` beheerder,
  `user-am` accountmanager, `user-sm` salesmanager, `user-root` superuser).
  Cookie `dd-lead_session=<userId>` in de mock.
- **Schil:** zijbalk met groepen Start (Vandaag, Taken, Inzichten),
  Prospects (Leadgenerator, Prospects, Jaarplanning, Campagnes, Belblokken),
  Verkoop (Pipeline, Offertes), Accounts (Klanten, Contacten), Beheer
  (Instellingen, alleen beheerder). Mobiel een onderbalk met vijf ingangen;
  beheer alleen op desktop. Een gebruikersmenu met Jouw account en
  Uitloggen. Globaal zoeken op Ctrl K (vul je in prompt 2).
- **Jouw account** (`/jouw-account`): naam, functie, telefoon bewerken;
  e-mail en organisatie alleen-lezen; wachtwoord wijzigen.
- **Instellingen** (`/instellingen`, alleen beheerder): een index met
  kaarten naar de deelpagina's die latere prompts toevoegen; nu alleen
  Gebruikers (lijst, rol wijzigen, uitnodigen per mail, archiveren) en
  Organisatie (naam, logo, standaardland NL).
- **Beheer over organisaties** (`/beheer`, alleen superuser): organisaties
  aanmaken met een starterspakket, gebruikers per organisatie, instappen
  (impersonatie met audit, "Stap uit" in de topbalk). Dit vervangt
  DealDrive's aparte HQ-build.
- **Foutpagina** (`app/error.vue`) in huisstijl, met één knop terug naar
  Vandaag.
- **Lege staten** via één component `LegeStaat` (kicker, één zin, één
  knop).

### Datamodel

```ts
// server/db/schema.ts (drizzle, Postgres)
organisations: id, name, data jsonb (logo, land, pakket, contact[]), created_at, updated_at
users: id, organisation_id, email, name, role ('accountmanager'|'salesmanager'|'beheerder'|'superuser'), data jsonb (functie, telefoon, gearchiveerd, belblokken, notificationPrefs), created_at, updated_at
org_settings: (organisation_id, key) PK, value jsonb, updated_at
audit_events: id, organisation_id, actor_id, action, resource_type, resource_id, changes jsonb, metadata jsonb, created_at
server_records: key 'table::recordId' PK, version int, updated_at   // conflictgrootboek voor de sync
```

Toegestane instellingensleutels staan in `shared/settingKeys.ts`
(`SETTING_KEYS`) en groeien per prompt; `PUT /api/settings/:key` weigert elke
andere sleutel. Verborgen sleutels (`VERBORGEN_KEYS`, bijvoorbeeld
`agentPrompts` en `aiBundel`) zijn nooit via die route te schrijven.

### Bedrijfsregels

- `organisationId` komt altijd uit de sessie; een payload met een andere
  organisatie wordt genegeerd.
- Rollen: `superuser` is niet uitdeelbaar; een beheerder kan zijn eigen
  beheerdersrol niet afstaan als hij de laatste is.
- Rechtenmatrix in `server/utils/permissions.ts`:

| Resource | accountmanager | salesmanager | beheerder |
|---|---|---|---|
| accounts, contacts | read all, write all | read all, write all | alles |
| tasks | read/write all, delete own | read/write all | alles |
| signals | read/write all | read/write all | alles |
| deals, quotes | read/write all, delete own | read/write all, delete all | alles |
| campaigns | read/write all, delete own | read/write all, delete all | alles |
| segments | read | read/write/delete | alles |
| leads | read/write all | read/write all | alles |
| settings | read | read | write |

  Niveaus `own`, `team` en `all` zijn in deze prompt nog geen slot (alleen
  `none` wordt afgedwongen), precies als in DealDrive; prompt 2 voegt de
  eigenaarsfilter toe als zachte filter, niet als rechtengrens.
- Een tabel die niet in de matrix staat valt op `none`; `npm run
  check:rechten` faalt als een synceerbare tabel ontbreekt.
- Sync: `POST /api/sync/mutations` met `{table, op, recordId, payload,
  clientVersion}`; per mutatie rechtencheck, dan versiecheck (lager dan de
  serverversie geeft `conflict`), dan upsert; het antwoord bevat per mutatie
  `ok|conflict|geweigerd`. De client flusht bij elke mutatie, bij opstarten,
  bij online komen en elke 60 seconden.
- Audit: elke rolwijziging, impersonatie-start en -stop, en elke
  instellingenwijziging schrijft een auditregel.

### Endpoints

```
POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me
GET  /api/bootstrap                      snapshot van de organisatie
POST /api/sync/mutations, GET /api/sync/status, POST /api/sync/conflict-check
GET  /api/settings, PUT /api/settings/:key
GET  /api/me/profiel, PUT /api/me/profiel, POST /api/me/wachtwoord
GET  /api/users, POST /api/users, PUT /api/users/:id, POST /api/users/:id/archief
GET  /api/superuser/organisations, POST /api/superuser/organisations
GET  /api/superuser/organisations/:id/users, POST .../users, PUT .../users/:userId
POST /api/superuser/impersonate, POST /api/superuser/impersonate/stop
GET  /api/config/status                   welke koppelingen en sleutels er zijn, zonder waarden
```

### AI-stappen

Geen. Wel de providerlaag alvast: `server/utils/llm-provider.ts` uit DealDrive
met `LLM_PROVIDER=mock|anthropic`, `ANTHROPIC_API_KEY`, `LLM_MODEL`
(standaard `claude-sonnet-5`), zonder `temperature` (Claude 5 weigert dat),
en de mock-provider als standaard. Niets roept hem nog aan.

### Wat je hergebruikt uit DealDrive

| Bestand | Wat |
|---|---|
| `server/utils/appStore.ts` | upsert, withOrgContext, kolomafleiding |
| `server/db/rls.sql`, `server/db/apply-rls.ts` | RLS en rollen |
| `server/api/sync/mutations.post.ts`, `shared/syncTabellen.ts` | sync met allowlist |
| `server/utils/permissions.ts`, `app/composables/usePermissions.ts`, `scripts/check-rechten` | rechtenmatrix en check |
| `server/utils/session.ts`, `server/middleware/session.ts`, `server/utils/supabaseAuth.ts` | sessie en auth |
| `server/utils/auditStore.ts` | audit |
| `server/utils/superuser.ts`, `server/utils/impersonatieToken.ts` | instappen |
| `server/utils/orgStarter.ts` | starterspakket (inhoud vul je in prompt 3, 4 en 7) |
| `app/assets/css/tokens.css`, `.stylelintrc`, `app/components/LegeStaat.vue`, `ConfirmDialog.vue`, `app/composables/useFlyoutA11y.ts`, `useConfirm.ts` | huisstijl en basiscomponenten |
| `tools/wegwerpdb/run.mjs` | wegwerp-Postgres voor databasetests |
| `app/error.vue`, `app/plugins/demoKlok.server.ts` | foutpagina en vaste demoklok |

### Wat je anders doet dan DealDrive

- Eén build in plaats van drie (zie 1.3); HQ is een tab.
- `check:omgeving` bewaakt alleen nog dat `/beheer` geen klant-endpoints
  aanroept en andersom.
- Geen `tier`-veld, nergens (1.2 punt 2).

### Acceptatiecriteria

- Zonder `.env` start de app in mock-modus met vier gebruikers en een lege
  organisatie "Demo".
- Met de wegwerp-Postgres (`node tools/wegwerpdb/run.mjs test:fundament`)
  slaagt een suite die aantoont: een gebruiker van organisatie A ziet niets
  van B via bootstrap, sync of settings; een accountmanager kan geen
  instelling schrijven; een mutatie op een tabel buiten de matrix wordt
  geweigerd; een lagere `clientVersion` geeft `conflict`.
- `npm run check:rechten`, `tsc`, `vue-tsc`, eslint en stylelint groen.
- Playwright: inloggen, Jouw account bewerken, een gebruiker uitnodigen,
  instappen en uitstappen als superuser.

### Buiten scope

SSO, mail versturen (de uitnodiging logt in mock de link), notificaties,
push.

---

## 4. Prompt 2: Accounts en contacten (prospects en klanten)

> Bouwprompt, tweede van tien. Verwacht prompt 1.

### Wat je bouwt, in één zin

Eén accountentiteit voor prospects en klanten met contactpersonen,
accountklasse, eigenaar, gebied en stuurvelden, de lijsten en de kaarten,
import met dedupe, eigen velden, segmenten en globaal zoeken.

### Waarom

Alles wat volgt (journey, motor, leads, campagnes) hangt aan het account.
DealDrive heeft dit model goed: klant of prospect is één record met een
typeveld, de klasse is instelbaar per organisatie, de stuurvelden
(`lastInteractionAt`, `lastCallAt`, `lastVisitAt`, `contractEndDate`,
`lastOrderDate`) zijn de enige datums waar de motor op rekent.

### Functioneel

**Lijsten** `/prospects/alle`, `/klanten/alle`, `/contacten/alle`:

- Werkbalk: zoekknop (Ctrl K), **+ Prospect** of **+ Klant** (primair),
  + Taak, + Afspraak, Weergave (Lijst, Compact, Kaarten), Sorteren (Naam,
  Laatste activiteit, Score, Accountklasse; zonder klasse onderaan), Filters
  met teller.
- Filters: zoekveld op naam, plaats en branche; Accountklasse-pillen plus
  "Geen klasse" (een pil met 0 is uitgeschakeld); Signaal "Aanleiding"
  (`triggerKind === 'hot'`); Journeyfase (vanaf prompt 3); **Eigenaar: Van
  mij / Iedereen** (1.2 punt 9); Dekking (de zes bakken uit
  `useDekkingBuckets`). Elke pilteller rekent met de andere actieve filters
  mee. "Reset filters" wist ook de zoekterm.
- 25 rijen, daarna "Toon meer" met "X van Y getoond".
- Rij: logo of initialen, naam met klassepil, website- en LinkedIn-icoon
  (grijs als leeg), branche, plaats, telefoon, "Inzichten: n", "Laatste
  activiteit: datum", de aanleidingsregel, rechts maximaal drie
  contactinitialen (beslissers eerst) plus "+N" of "Geen contactpersoon".
- Contextmenu (rechtsklik): Open kaart, Bel primaire contact (`tel:`, alleen
  met nummer), Stuur e-mail, Nieuwe taak, Plan afspraak, op de prospectlijst
  ook "Promoveer tot klant" (met bevestiging).
- Lege staat: "GEEN RESULTATEN / Niets in deze filter." met "Toon alles".
- Contactenlijst: filters Rol (alleen rollen met aantal boven 0), Accounts
  (Alle, Bij klanten, Bij prospects); sortering op rolgewicht (beslisser,
  champion, beïnvloeder, gebruiker, onbekend) en achternaam; statvoet
  Beslissers, Champions, Beïnvloeders, Accounts.

**Landingspagina's** `/prospects` en `/klanten`: top 6 van de week met een
rangscore (zie bedrijfsregels), links naar de volledige lijst en (prompt 7)
de jaarplanning.

**Accountkaart** `/accounts/:id`:

- Kop: logo bewerken (weghalen zet `logoUit`), breadcrumb naar de juiste
  lijst, inline chips branche, plaats, land, functie, de klassekiezer naast
  de naam, een contactstrip (website, telefoon, LinkedIn, Instagram,
  Facebook, alleen gevuld).
- Stuurveldenstrip alleen-lezen: Laatste actie, Laatste call, Laatste
  bezoek, Journey (prompt 3), Eigenaar (klikbaar naar het Info-formulier).
- Knoppen: Info, Contacten (teller), Briefing (prompt 10), + Taak,
  + Afspraak.
- Statstrip: Open taken (met achterstallig), Inzichten (met ongezien), Open
  offertes, Open deals, Laatste contact (relatief), Eigenaar.
- Tabbladen met tellers, tab in `?tab=`: Tijdslijn, Inzichten, Taken,
  Notities, Afspraken, Deals, Campagnes (prompt 9). Tijdslijn met
  filterpillen per soort en + Taak, + Afspraak.
- Info-flyout: secties Adres, Bereik (met Logo-URL), Stamgegevens
  (Account-ID met kopieerknop, Accounttype, Accountklasse, Accountfunctie,
  Bedrijfsnaam, Officiële naam, KvK, SBI, Branche, **Eigenaar** (select uit
  de gebruikers van de organisatie)), Contract en order (Contract tot,
  Laatste order), eigen velden per sectie. Leeg opslaan is `null`; een datum
  wordt op 12:00 opgeslagen; een lege naam wordt genegeerd. **Verwijder
  account** alleen zichtbaar met `delete`-recht, met de bevestiging "… wordt
  verwijderd samen met de contactpersonen die eronder hangen. Taken en
  afspraken uit het verleden blijven staan." (1.2 punt 10).
- Mobiel: vaste balk Bellen (primair contact: beslisser of champion, anders
  het eerste contact, anders het bedrijfsnummer) en Mail.

**Contactkaart** `/contacten/:id`: profielfoto met roltag, naam, functie,
link naar het account, telefoon, mobiel, LinkedIn, de stuurstrip van het
account, knoppen Info en Briefing; statstrip; tabbladen Tijdslijn (gefilterd
op `contactId` en `contactIds`), Inzichten (van het account), Taken,
Notities, Afspraken, Deals (waarin het contact staat, met noot over de andere
deals). Info-flyout met Persoon (Voornaam, Achternaam, Functie, Rol, Jaren in
rol, **Beslisser** als vinkje), Bereik, Context (Uitspraak, Bron voor
publieke verificatie) en eigen velden; Verwijder contact met bevestiging.

**Nieuw account / nieuw contact** als flyout: account alleen naam verplicht
en de soort volgt de lijst; contact voornaam, achternaam en bedrijf
verplicht (type-ahead op accounts, maximaal 8).

**Import** `/import` (beheerder): stappen Uploaden, Koppelen, Duplicaten,
Bevestiging, Resultaat. CSV en TSV, maximaal 10.000 rijen, scheidingsteken
uit de kopregel, RFC-quoting; keuze Accounts of Contactpersonen;
voorbeeldbestand downloaden; automatische kolomkoppeling op exact label en
daarna regex; eigen velden als `cf:<key>`; per rij Importeer als nieuw, Voeg
samen, Sla over; "Terugdraaien kan niet"; zonder kolom Accounttype wordt elke
rij prospect (waarschuwing). Resultaat met tellers imported, merged, skipped,
onbruikbaar, ongewijzigd, mislukt, klanten, prospects.

**Eigen velden** `/instellingen/custom-fields`: types `text, tel, email,
url, select, number, date`; doelen `account, contact, deal, campagne`; vaste
secties account (Adres, Bereik, Stamgegevens, Contract en order) en contact
(Persoon, Bereik, Context); sleutel uniek per doel met `_2` bij een botsing;
reset met bevestiging.

**Segmenten** `/instellingen/segmenten`: regels `{field, operator, value}`
met operators `gt, gte, lt, lte, eq, neq, contains, in`, match-modus AND of
OR, organisatiesegment of eigen segment (`ownerId`); een segment zonder
regels matcht niets. Gebruikt door campagnes (prompt 9).

**Globaal zoeken** (Ctrl K): in de browser over de lijsten in het geheugen;
deelstring, hoofdletter- en accentongevoelig (NFD plus ø/æ/œ/ß/ł/đ/ð), geen
fuzzy; accounts op naam, plaats, branche; contacten op naam, functie,
accountnaam; maximaal 5 per groep plus "nog N".

### Datamodel

```ts
accounts: id 'acc-<base36>-<4>', organisation_id, name, account_kind ('klant'|'prospect'), accountfase, journey_stage_id, owner_id, city, contract_end_date, last_order_date, data jsonb, created_at, updated_at
  data: legalName, kvkNumber, sbiCode, website, branche, addressLine, postcode, country,
        phone, linkedInUrl, instagramUrl, facebookUrl, logoUrl, logoUit,
        segment ('strategic'|'klant'|'at-risk'|'hot-prospect'|'warm-prospect'|'prospect'|'watchlist'),
        klantGrade ('top-klant'|'klant'|'medium'|'low'), prospectGrade ('hot'|'warm'|'lauw'|'koud'),
        accountFunction ('distributeur'|'eindklant'), medewerkers (number),
        lastInteractionAt, lastCallAt, lastVisitAt (ISO),
        score (0-100), trigger (string), triggerKind ('standard'|'hot'|'warn'),
        externalIds {kvk?, leadId?}, customFields {}
contacts: id 'c-<ms>-<4>', organisation_id, account_id, first_name, last_name, email, is_decision_maker bool, data jsonb
  data: jobTitle, phone, mobile, linkedInUrl, instagramUrl, facebookUrl,
        role ('beslisser'|'beinvloeder'|'champion'|'gebruiker'|'onbekend'), sourceUrl, avatarUrl, quote, yearsInRole, customFields
segments: id, organisation_id, owner_id, data jsonb {name, description, shortLabel, colorVar, matchMode, rules[], showInListings}
communications: id, organisation_id, account_id, contact_id, author_id, kind ('notitie'|'telefoon'|'email'|'gesprek'), direction ('internal'|'inbound'|'outbound'), subject, occurred_at, data jsonb
```

Instellingen: `accountfases` (`{code, label, omschrijving}`, standaard
A Corporate 250+, B Groot MKB 50 tot 250, C Middenbedrijf 10 tot 50, D Klein
MKB tot 10), `customFields`, `customFieldSecties`, `gebieden`.

### Bedrijfsregels

- Accounttype: `accountKind` is leidend; zonder waarde geldt het segment
  (klantsegmenten `strategic, klant, at-risk`). Server en client gebruiken
  één functie `accounttypeVan` in `shared/accounttype.ts`.
- Promoveren tot klant: `{accountKind: 'klant', prospectGrade: null}`;
  terug naar prospect wist `klantGrade`; `segment` blijft staan. Elke wissel
  schrijft een auditregel. Vanaf prompt 3 meldt een handmatige promotie de
  journeygebeurtenis `handmatig-klant`.
- Klasse uit medewerkersaantal (`klasseVoorOmvang`): A vanaf 250, B vanaf
  50, C vanaf 10, D vanaf 0; zonder aantal geen klasse. Wordt voorgesteld,
  nooit stilzwijgend gezet.
- Rangscore op `/prospects`: `score + min(inzichten × 5, 20) + 18 (hot) of
  6 (warn) + 10 (hot-prospect) of 4 (warm-prospect) + 4 (contact < 7
  dagen)`; op `/klanten`: `score + min(inzichten × 5, 20) + 15 (hot) of 5
  (warn) + 8 (at-risk) + 4 (strategic) + recentheid`.
- Laatste activiteit = het maximum van communicaties, afgeronde
  contacttaken (`call, mail, bericht, afspraak`), gehouden afspraken en
  `lastInteractionAt`; `telContactmomenten` telt unieke dagen.
- Dekkingsbakken: `<7d, 7-14d, 14-30d, 30-60d, 60-90d, >90d` op
  `lastInteractionAt`; gedekt is onder 30 dagen (`DEKKING_DREMPEL_DAGEN`);
  zonder contact in `>90d`; binnen een bak oudste eerst.
- Logo: `logoUrl`, anders (tenzij `logoUit`) de favicon van het domein op
  128 px, anders initialen; een favicon smaller dan 32 px valt terug op
  initialen.
- Gebied: `regioVan(plek, regios)`: postcode gaat voor plaats; reeksen
  gelden alleen voor NL of leeg land en precies vier cijfers; geen match is
  "Zonder regio"; overlap wordt gemeld, niet opgelost; één regio per
  weekdag.
- Import-dedupe accounts: naam genormaliseerd (kleine letters, zonder b.v.,
  n.v., holding, group), Sørensen-Dice-bigramscore tegen alle accounts van
  de organisatie; boven 80 procent duplicaat (standaard samenvoegen), boven
  60 procent mogelijk duplicaat, anders nieuw; **KvK-nummer gelijk is altijd
  duplicaat** (nieuw ten opzichte van DealDrive). Contacten: exact op e-mail,
  anders exacte volledige naam binnen het gevonden bedrijf. Samenvoegen vult
  alleen lege of afwijkende tekstvelden, nooit de naam; een leeg type mag
  gevuld worden en prospect mag klant worden, nooit andersom.
- Verwijderen: de server verwijdert contacten, open taken en open inzichten
  van het account mee (cascade in één transactie); historische taken,
  afspraken en communicaties blijven met een losse accountnaam.
- Eigenaar: bij aanmaken de ingelogde gebruiker; wijzigbaar in het
  Info-formulier door beheerder en salesmanager, en door de huidige eigenaar.

### Endpoints

Lezen via bootstrap, schrijven via de sync (tabellen `accounts`, `contacts`,
`segments`, `communications`). Daarnaast:

```
POST   /api/communications/notitie, PATCH/DELETE /api/communications/notitie/:id
POST   /api/accounts/:id/verwijder      cascade, vereist accounts:delete
POST   /api/import/voorbeeld            CSV-voorbeeld
GET    /api/gebieden/analyse            per regio: klanten, prospects, dealwaarde, recent <30, oplopend 30-90, stil >90, nooit; accountmanager ziet eigen gebied, managers ?scope=alles
```

### AI-stappen

Geen.

### Wat je hergebruikt uit DealDrive

`app/types/entities.ts` (Account, Contact, SegmentDefinition, Communication),
`app/pages/klanten/alle.vue`, `app/pages/prospects/alle.vue`,
`app/pages/contacten/alle.vue`, `app/components/AccountRow.vue`,
`app/pages/accounts/[id]/index.vue`, `app/components/InfoFlyout.vue`,
`ContactInfoFlyout.vue`, `ContactenFlyout.vue`, `NieuwAccountFlyout.vue`,
`NieuwContactFlyout.vue`, `app/composables/useAccountSortering.ts`,
`useDekkingBuckets.ts`, `useAccountLogo.ts`, `useContactRol.ts`,
`useKlantGrade.ts`, `useProspectGrade.ts`, `useCustomFields.ts`,
`useSegments.ts`, `useGlobaleZoek.ts`, `app/components/GlobaleZoek.vue`,
`app/utils/accountInitialen.ts`, `contactNaam.ts`, `app/pages/import.vue`,
`shared/gebieden.ts`, `shared/ritmematrix.ts` (alleen `accounttypeVan`),
`server/api/gebieden/analyse.get.ts`, `server/api/communications/*`.

### Wat je anders doet dan DealDrive

1.2 punten 2 (geen `tier`), 9 (eigenaar), 10 (verwijderen), en: inline chips
wissen met `null`; `accountId` en `ownerId` staan op de allowlist van de
update; bij een lege servertabel blijft geen demodata in de client hangen
(DealDrive `useOfflineHydration.ts` 329 tot 336); geen HubSpot.

### Acceptatiecriteria

- Databasevrije suite `e2e-accounts` (dedupe-score, klasse uit omvang,
  rangscores, dekkingsbakken, regioVan, accounttypeVan).
- Wegwerp-DB suite: cascade-verwijdering, eigenaarswissel met audit, import
  van 50 rijen met 3 duplicaten.
- Playwright: lijst filteren op klasse en Van mij, kaart openen, Info
  bewerken, contact toevoegen, promoveren tot klant, Ctrl K zoeken.

### Buiten scope

Documenten, e-mails, gespreksverslagen, HubSpot.

---

## 5. Prompt 3: Prospect journey

> Bouwprompt, derde van tien. Verwacht prompt 2.

### Wat je bouwt, in één zin

Een per organisatie instelbare prospect journey met fases, een vaste
gebeurtenissencatalogus en overgangen "gebeurtenis X in fase Y naar fase Z",
een instapregel, een audit per wissel, en de overstap van prospect naar
klant bij een gewonnen deal.

### Waarom

De journey is de ruggengraat waar regels, campagneadvies en de Pitstop op
mikken. DealDrive's engine is klein en goed (één stap per gebeurtenis, nooit
automatisch terug, alles geaudit), maar zijn starterset is een klantjourney
en vier van de zeven gebeurtenissen worden nergens gemeld. De nieuwe tool
krijgt prospectfases en gebeurtenissen die echt afgaan.

### Functioneel

**Instellingen** `/instellingen/prospect-journey` (beheerder):

- Fases met naam, kleur (`ink, yellow, purple, green, blue, red, orange`),
  omschrijving, "Pitstop-accent" (hoe AI-concepten in deze fase gekleurd
  worden), pijltjes omhoog en omlaag, verwijderen (alleen als er geen
  accounts in staan), teller van gekoppelde regels per fase.
- Markering per fase: **hoofdfase** (`pre-data`, `prospect`, `verbinding`,
  `klant`, `verloren`). Elke journeyfase hoort bij precies één hoofdfase; de
  UI groepeert erop. Dit is wat de nieuwe tool anders doet dan DealDrive:
  de drie fases van het new business-proces zijn geen losse module maar de
  groepering van de journey.
- Blok "Doorschuiven op gebeurtenis": van-fase, gebeurtenis, naar-fase;
  per gebeurtenis maximaal één overgang per van-fase.
- "Standaardset terugzetten" met bevestiging.

**Op de accountkaart**: de journeyfase in de stuurveldenstrip, met de
hoofdfase als pil en een knop "Zet fase" (beheerder en salesmanager) die
de gebeurtenis `handmatig` meldt met de gekozen doelfase en een reden
(verplicht, minimaal 10 tekens). DealDrive heeft die handmatige correctie
niet.

**Op de lijsten**: filter Journeyfase (prompt 2 reserveerde hem) en
hoofdfase als groep.

### Datamodel

```ts
// org_settings
journeyStages: [{ id, label, description, order, color, hoofdfase, voorbereidingsAccent?, createdAt }]
journeyTransitions: [{ fromStageId, event, toStageId }]

// accounts
journey_stage_id (kolom) en data.journeyStageId, altijd samen gezet
data.journeyHistorie: [{ van, naar, gebeurtenis, op, door }]   // laatste 50
```

Gebeurtenissencatalogus (`shared/journey.ts`, vast, niet instelbaar):

| Gebeurtenis | Wie meldt hem | Hoofdfase waar hij hoort |
|---|---|---|
| `lead-overgenomen` | leadgenerator "Neem over" (prompt 6) | pre-data |
| `dossier-compleet` | verrijking klaar (prompt 6) | pre-data |
| `gekwalificeerd` | BAND-score boven de drempel of knop "Kwalificeer" (prompt 6) | pre-data naar prospect |
| `eerste-contact` | eerste afgeronde contacttaak of gehouden afspraak (prompt 5) | prospect |
| `eerste-afspraak-gepland` | eerste afspraak met het account (alleen de eerste, 1.2 punt 3) | prospect naar verbinding |
| `offerte-verstuurd` | offerte op verstuurd (prompt 8) | verbinding |
| `deal-gewonnen` | deal naar een won-fase (prompt 8) | verbinding naar klant |
| `deal-verloren` | deal naar een lost-fase (prompt 8) | verbinding naar verloren |
| `heropvolging` | heropvolgtaak afgerond met uitkomst "weer actief" (prompt 8) | verloren naar prospect |
| `handmatig` | knop "Zet fase" met doelfase en reden | overal |
| `handmatig-klant` | promoveren tot klant op de lijst of in Info (prompt 2) | naar klant |

Starterset (`server/utils/orgStarter.ts`), elf fases:

| id | label | hoofdfase | accent |
|---|---|---|---|
| `pj-gevonden` | Gevonden | pre-data | "Alleen feiten uit het dossier; geen aannames over behoefte." |
| `pj-verrijkt` | Dossier compleet | pre-data | "Benoem één concrete aanleiding uit het dossier." |
| `pj-gekwalificeerd` | Gekwalificeerd | prospect | "Kennismaken: één reden voor contact, geen pitch." |
| `pj-benaderd` | Benaderd | prospect | "Verwijs naar het eerdere contact en stel één vraag." |
| `pj-in-gesprek` | In gesprek | prospect | "Onderscheid benoemen en vergelijkingscriteria opvragen." |
| `pj-afspraak` | Eerste afspraak | verbinding | "Behoefte, beslisser, noodzaak, draagvlak toetsen." |
| `pj-offerte` | Offerte uit | verbinding | "Bezwaren over prijs, voorwaarden en timing voor zijn." |
| `pj-onderhandeling` | Onderhandeling | verbinding | "Eén besluitvraag; wat is nodig om te tekenen." |
| `pj-klant` | Klant | klant | "Onboarding: eerste 30 dagen, eerste order." |
| `pj-verloren` | Verloren | verloren | "Heropvolging over drie maanden, zonder druk." |
| `pj-geparkeerd` | Geparkeerd | verloren | "Alleen bij een nieuwe aanleiding." |

Starterovergangen: gevonden + dossier-compleet naar verrijkt; verrijkt +
gekwalificeerd naar gekwalificeerd; gevonden + gekwalificeerd naar
gekwalificeerd; gekwalificeerd + eerste-contact naar benaderd; benaderd +
eerste-afspraak-gepland naar afspraak; in-gesprek + eerste-afspraak-gepland
naar afspraak; afspraak + offerte-verstuurd naar offerte; offerte +
deal-gewonnen naar klant; onderhandeling + deal-gewonnen naar klant;
afspraak + deal-gewonnen naar klant; elke verbindingsfase + deal-verloren
naar verloren; verloren + heropvolging naar gekwalificeerd.

### Bedrijfsregels

- Instap (`entryStageFor`): een account zonder fase stapt in bij de eerste
  gebeurtenis; prospect op de eerste fase (laagste `order`), klant op de
  eerste fase met hoofdfase `klant`. Nieuw ten opzichte van DealDrive: een
  account dat via de leadgenerator binnenkomt stapt direct in op
  `pj-gevonden`; een geïmporteerde prospect op `pj-gekwalificeerd`
  (hij is al bekend), een geïmporteerde klant op `pj-klant`.
- Doorschuiven (`applyJourneyEvent`): zoek de overgang met `fromStageId ===
  huidige fase && event`; hooguit één stap per gebeurtenis; nooit
  automatisch terug; zonder overgang alleen de instap. Uitzondering: een
  gebeurtenis die naar hoofdfase `klant` leidt (`deal-gewonnen`,
  `handmatig-klant`) werkt vanuit elke fase, ook zonder expliciete overgang
  (DealDrive's randgeval: een prospect zonder fase die wint blijft in
  awareness hangen).
- **Overstap naar klant** (1.2 punt 1), in één transactie: `accountKind`
  naar `klant`, `prospectGrade` naar null, `klantGrade` naar `klant`, de
  journeyfase naar de eerste klantfase, één auditregel
  `prospect-naar-klant`, en de motor draait `runEventRules` met
  `deal-gewonnen` (prompt 4 levert SR-onboarding). De eigenaar blijft; de
  klasse blijft; `rule_runs` wordt niet gereset.
- Audit: elke wissel `appendAuditEvent({action: 'journey-doorschuiven',
  resourceType: 'account', changes: {journeyStageId: {from, to}},
  metadata: {gebeurtenis, reden?}})` plus een regel in
  `data.journeyHistorie`.
- `eerste-afspraak-gepland` wordt alleen gemeld als het account nog geen
  afspraak had (geannuleerde tellen niet); `eerste-contact` alleen als
  `telContactmomenten(account) === 0` vóór de afronding.
- Gebeurtenisregels (prompt 4) draaien na elke gemelde gebeurtenis, ook
  `fase-betreden` met de nieuwe fase.
- Verwijderen van een fase met accounts erin is geblokkeerd; de UI biedt
  "Verplaats de N accounts naar …" aan.

### Endpoints

```
POST /api/journey/event   body {accountId, event, doelfase?, reden?}; sessie verplicht;
                          onbekende gebeurtenis 400; handmatig zonder reden 400;
                          antwoord {ok, moved, from, to, klantGeworden, generated:{inzichten, taken}}
```

Instellingen `journeyStages` en `journeyTransitions` via `PUT
/api/settings/:key` (beheerder).

### AI-stappen

Geen. Het Pitstop-accent is tekst die prompt 10 leest.

### Wat je hergebruikt uit DealDrive

`server/utils/journeyEngine.ts` (volledig, met de catalogus vervangen),
`server/api/journey/event.post.ts`,
`app/composables/useCustomerJourney.ts`,
`app/pages/instellingen/customer-journey.vue`, de accentteksten uit
`server/utils/orgStarter.ts` 38 tot 46, `useDealStageChange.ts` 84 tot 89 en
`NieuweAfspraakFlyout.vue` 676 tot 684 als voorbeeld van de aanroep.

### Wat je anders doet dan DealDrive

1.2 punten 1, 3, 5 en 16 (één seed, geen client-seed met acht fases).
Hoofdfases als vaste groepering; `handmatig` met reden en een UI;
`fase-betreden` blijft intern maar krijgt documentatie in het handboek.

### Acceptatiecriteria

- Databasevrije suite `e2e-journey`: instap prospect en klant, elke
  starterovergang, geen stap terug, klantgebeurtenis vanuit elke fase,
  eerste-afspraak alleen de eerste keer.
- Wegwerp-DB: `deal-gewonnen` zet in één transactie type, fase, grade en
  audit; een mislukte regelrun rolt de typewissel niet terug (de
  gebeurtenis is geschied).
- Playwright: fase zetten met reden, overgang inrichten, standaardset
  terugzetten.

### Buiten scope

Automatisch terugzetten, meerdere journeys per organisatie.

---

## 6. Prompt 4: Activity selling-regels, de motor

> Bouwprompt, vierde van tien. Verwacht prompt 2 en 3.

### Wat je bouwt, in één zin

Een regelmotor die per uur en bij gebeurtenissen over alle accounts loopt,
per regel een triggerpatroon toetst, de cadans per regel en onderwerp
bewaakt, inzichten ontdubbelt en taken met sjablonen genereert, met een
regeleditor waarin elk veld dat de motor leest te bewerken is, een
Excel-import en -export, de accountklassen en de ritmematrices.

### Waarom

Dit is wat DealDrive onderscheidt van een CRM: de verkoper hoeft niet zelf te
bedenken wie aan de beurt is. DealDrive's motor is goed doordacht (vier
patronen, cadanspoort via `rule_runs`, dedup, owner-fallback, AI als aparte
pass). Wat ontbreekt is targeting op accounttype, een editor die alles kan
en een starterset die draait. Dat lost deze prompt op.

### Functioneel

**Regeleditor** `/instellingen/activity-selling` (beheerder; anderen kijken
mee):

- Kop met tellers actief, uit, "door de motor" (`enabled && (motor ===
  'ai' || trigger.patroon)`), totaal; opslagstatus "Opslaan… / Opgeslagen /
  Opslaan mislukt, alleen op dit apparaat".
- Filterbalk: zoeken over id, categorie, subcategorie, bron, omschrijving;
  selecties categorie, bron, journeyfase (inclusief "Zonder fase"),
  accounttype. Knoppen: Draai motor nu, Prospect journey, Exporteren
  (Excel), Importeren, Back-up (JSON `{version, exportedAt, count, rules}`),
  Standaardset terugzetten (met bevestiging).
- Lijst links: aan/uit, categorie, subcategorie, label "AI" of patroon,
  prioriteitsstip. Rechts het bewerkpaneel in drie secties:
  - *Wat en wanneer*: Categorie, Subcategorie, Omschrijving, Activiteit
    (inzicht of taak), Cadans (bij AI alleen Wekelijks en langzamer),
    Prioriteit.
  - *Sturing*: Bron (Intern/Extern), Specifieke bron (optgroups), Trigger
    patroon met parameters, **Accounttype** (prospect, klant, alle),
    Accountklasse (vinkjes, leeg is alle), Journeyfase, Motor (Regel of
    AI).
  - *Gevolg*: Actiesoort (Uit categorie, Bellen, Bezoek, Mailen, Bericht,
    Geen), **Taaksjabloon** met `{account}` en `{offerte}`, Signaaltype,
    Automatisch voorbereiden (alleen bij taak, Pitstop), Uitvoerder (self
    of ai-agent).
  - Live preview met de voorbeeldprospect "Bouwbedrijf De Vries" en offerte
    "OFF-2026-0142".
  - Elk veld een ⓘ-uitleg. Opslaan per veld na 600 ms stilte, één verzoek
    tegelijk per regel. Verwijderen met bevestiging.
- "+ Regel" flyout: categorie en subcategorie verplicht, waarschuwing bij
  een dubbele combinatie, daarna opent het paneel.
- Blok "AI-verbruik per regel" (prompt 10 vult het).

**Accountklassen en ritme** `/instellingen/accountritme`: secties
Accountklassen (code maximaal 2 tekens, waarschuwing bij dubbele code,
aantal accounts per klasse en zonder klasse), Belmatrix (groepen Klant en
Prospect, kolommen per maand, kwartaal, halfjaar, jaar, plus "Afgeleid
belritme" zoals "17×/jaar = elke 3 weken"), Afspraakmatrix (Meeting, Bezoek),
Offertematrix (prompt 8). Beheerder en superuser wijzigen; anderen zien "Je
kunt meekijken".

**Vandaag en de lijsten** tonen wat de motor maakt via prompt 5.

### Datamodel

```ts
activity_rules: id, organisation_id, status ('actief'|'gepauzeerd'), motor ('deterministisch'|'ai'), activiteit ('inzicht'|'taak'), data jsonb, created_at, updated_at
rule_runs: (organisation_id, rule_id, subject_kind, subject_id) PK, account_id, last_generated_at, last_result_id, last_result_kind, updated_at
   subject_kind: 'account'|'campagne'|'offerte'|'deal'|'lead'
```

Regel (`shared/activityRule.ts`):

```ts
{
  id: string,                      // 'R<base36>-<rnd>' of starter 'SR..'
  categorie: string, subcategorie: string, omschrijving: string,
  bron: 'Intern'|'Extern', specifiekeBron?: string,
  cadans: 'Dagelijks'|'2 dagen'|'3 dagen'|'Wekelijks'|'2 weken'|'Maandelijks'|'2 maanden'|'Kwartaal'|'Half jaar'|'Jaarlijks'|'Continu',
  prioriteit: 'Laag'|'Midden'|'Hoog'|'Kritiek',
  enabled: boolean, status: 'actief'|'gepauzeerd',
  activiteit: 'inzicht'|'taak', motor: 'deterministisch'|'ai',
  accountType: 'prospect'|'klant'|'alle',
  accountfase: string[], journeyStageId?: string,
  trigger?: { patroon: 'datum-drempel'|'inactiviteit'|'ritme'|'gebeurtenis'|'campagne-achterstand'|'offerte-verstuurd'|'deal-onvoldoende-gekwalificeerd'|'lead-verlopen'|'jaarplanning-venster',
              veld?: 'contractEndDate'|'lastOrderDate'|'lastInteractionAt'|'lastVisitAt'|'lastCallAt', dagen?: number, minWaarde?: number, gebeurtenis?: string },
  actionType?: 'bellen'|'bezoek'|'mailen'|'bericht'|'geen',
  taakSjabloon?: string, signalTypes?: SignalType[], autoVoorbereiden?: boolean, executor?: 'self'|'ai-agent',
  createdAt: string
}
```

Geschrapt ten opzichte van DealDrive (1.2 punt 6): `kpi`, `triggerType`,
`eigenaar`, `levensfase`, `verwachteUitkomst`, `klantType`, `nummer`,
`taakvoorbeeld` (heet nu `omschrijving`).

Specifieke bronnen: Intern `CRM`, `CRM/agenda`, `CRM/telefonie`,
`CRM/order data`, `CRM/Contractenregister`, `Finance`; Extern automatisch
`Web: vacatures`, `Web: nieuws`, `Web: website`; Extern handmatig
`LinkedIn`, `KvK`, `Google Alerts`, `Vakmedia`, `Beurs`, `Persoonlijk
netwerk`.

Instellingen: `belmatrix` (`{accounttype, klasse, maand, kwartaal, halfjaar,
jaar}`), `afspraakmatrix` (`{afspraaksoort: 'meeting'|'bezoek', klasse, …}`).

### Bedrijfsregels

**Draaimomenten.** Een geplande functie elk uur roept `POST
/api/motor/run-all` aan met header `x-motor-secret` (503 zonder geheim, 403
bij een verkeerd); per organisatie `runRulesForOrg`, fouten per organisatie
gevangen; daarna de belblokvuller (prompt 7). "Draai motor nu" is `POST
/api/motor/run` (beheerder). Gebeurtenissen draaien direct via
`runEventRules`. De client pollt elke 3 minuten `GET /api/motor/updates
?since=`.

**Volgorde van een run**: verlopen campagnes afsluiten (prompt 9); regels
laden; selectie: accountlus (deterministisch, met patroon, niet in de eigen
lussen), eigen lussen (gebeurtenis, campagne-achterstand, offerte-verstuurd,
deal-onvoldoende-gekwalificeerd, lead-verlopen, jaarplanning-venster), AI-regels;
instellingen laden (matrices met terugval op de standaard); pakketpoort en
plafond (prompt 10); één transactie voor alle deterministische lussen en
de AI-kandidaatselectie; AI buiten de transactie; korte schrijftransactie;
automatisch voorbereiden (maximaal 10 per run).

**Targeting** (`ruleTargetsAccount`): `accountType` moet passen (via
`accounttypeVan`), `accountfase[]` niet leeg betekent dat de klasse erin
moet staan (zonder klasse valt het account af), `journeyStageId` moet gelijk
zijn. Een regel zonder enig filter raakt alle accounts; de editor waarschuwt
daarvoor ("Deze regel raakt N accounts").

**Patronen** (`evaluateTrigger`, `dagMs = 86.400.000`):

- Datum-drempel: veld standaard `contractEndDate`, dagen 60; `dagenTot =
  ceil((datum − nu) / dagMs)`; vuurt bij `0 ≤ dagenTot ≤ drempel`; zonder
  datum nooit. Bewijs "contract-einddatum: 2026-12-31, nog 42 dagen".
- Inactiviteit: veld standaard `lastInteractionAt`, dagen 30; `dagenGeleden
  = floor((nu − datum) / dagMs)`; vuurt bij `≥ drempel`; zonder datum nooit.
  **Nieuw**: optie `ookZonderDatum` (standaard aan bij prospects) zodat een
  prospect die nog nooit contact had wél vuurt, met `createdAt` als anker.
- Ritme: vuurt altijd; de cadans is de poortwachter, met de matrix als
  override: `bellen` leest de belmatrix op accounttype × klasse, `bezoek` de
  bezoekrij, **meeting leest de meetingrij** (DealDrive liet die dood); geen
  rij betekent de regelcadans, 0 betekent geen taak (telt als
  `skippedByCadans`), anders `intervalDagen = max(1, round(365 / perJaar))`
  en de taakreden "Terugkerend volgens belmatrix (prospect, klasse B): 12×
  per jaar (interval 30 dagen)".
- Gebeurtenis: alleen in `runEventRules`; `t.gebeurtenis === gebeurtenis`
  of `fase-betreden` met `journeyStageId === nieuweFase` of zonder fase;
  daarna dezelfde targeting en cadans. Bewijs "Journey-gebeurtenis
  "deal-gewonnen" op 2026-10-12".
- Campagne-achterstand, offerte-verstuurd, deal-onvoldoende-gekwalificeerd:
  zie prompt 9, 8 en 6; `lead-verlopen` en `jaarplanning-venster` zie
  prompt 6 en 7.

**Cadanspoort**: `CADANS_DAGEN` Dagelijks 1, 2 dagen 2, 3 dagen 3, Wekelijks
7, 2 weken 14, Maandelijks 30, 2 maanden 61, Kwartaal 91, Half jaar 182,
Jaarlijks 365, Continu 1, onbekend 7. `cadansVerstreken`: nooit gedraaid is
waar, anders `verstrekenDagen ≥ max(override ?? cadans, minimum)`.
`alGedraaid` betekent ooit (offerte en deal: één opvolging per onderwerp).
`registreerRun` is een upsert op de PK.

**Dedup**: accountinzicht met dezelfde `ruleId` en `accountId` en status
`nieuw` of `gelezen` wordt bijgewerkt (`{...oud, ...nieuw, id, createdAt:
oud.createdAt}`); campagne op `campaignId`; deal op `dealId` zonder
bijwerken; taken worden niet ontdubbeld, de cadans remt ze. Id-patronen
`sig-rule-<rule>-<account>-<ts36>`, `sig-ai-…`, `t-rule-…`.

**Inzicht uit een regel**: `title = "<subcategorie> · <account>"`, `body =
reden`, `commercialAngle = omschrijving`, `generatedBy 'deterministisch'`,
`confidence 100`, `relevanceScore` Kritiek 90, Hoog 80, anders 65,
`evidence [{bron: 'CRM', citaat}]`, `type` uit `signalTypes[0]` anders uit
het veld (`contractEndDate` aflopend-contract, `lastOrderDate` omzetdaling,
`lastInteractionAt` en `lastVisitAt` klantaandacht, anders nieuws),
`voorgesteldeTaak {titel, prioriteit, executor, actionType}` als er een
sjabloon of omschrijving is.

**Taak uit een regel**: titel `vulSjabloon(taakSjabloon || omschrijving ||
'Actie voor {account}')`, `status open`, `source 'regel'`, `executor` uit de
regel (standaard `self`), `ruleId`, `reason = description = reden`, `dueDate
= nu + 7 dagen` (bij ritme met matrix: nu + interval), `priority` via
`PRIO_MAP` (Kritiek urgent, Hoog high, Midden medium, Laag low), taaktype
uit actiesoort (bezoek afspraak, bellen call, mailen mail, bericht bericht,
anders to-do), `ownerId = account.ownerId ?? eerste beheerder ?? 'onbekend'`.

**Starterset (prospects, elke regel met trigger)**:

| Id | Naam | Patroon | Type | Klasse | Cadans | Prio | Actie | Sjabloon |
|---|---|---|---|---|---|---|---|---|
| SR01 | Nieuwe lead zonder dossier | gebeurtenis `lead-overgenomen` | prospect | alle | Continu | Hoog | geen | `Dossier van {account} compleet maken` (taak) |
| SR02 | Dossier verloopt | lead-verlopen 30 | prospect | alle | Wekelijks | Midden | geen | inzicht |
| SR03 | Gekwalificeerd, nog geen contact | inactiviteit `lastInteractionAt` 7, ookZonderDatum | prospect | alle | Wekelijks | Hoog | bellen | `Eerste belpoging {account}` (taak) |
| SR04 | Belritme prospect | ritme | prospect | alle | Maandelijks | Midden | bellen | `Bel {account}` (taak, matrix overrulet) |
| SR05 | Bezoekritme A en B | ritme | prospect | A, B | Kwartaal | Midden | bezoek | `Bezoek {account} inplannen` (taak) |
| SR06 | Contact-stilte prospect | inactiviteit `lastInteractionAt` 45 | prospect | alle | 2 weken | Midden | bellen | `Plan contactmoment met {account}` (taak) |
| SR07 | Jaarplanningsvenster voorbij | jaarplanning-venster | prospect | alle | Wekelijks | Hoog | bellen | `Bellen: {account} (venster verstreken)` (taak) |
| SR08 | Afspraak gehad, geen vervolg | inactiviteit `lastVisitAt` 14 met open deal zonder vervolgstap | prospect | alle | Wekelijks | Hoog | bellen | inzicht met voorstel |
| SR09 | Offerte opvolgen | offerte-verstuurd 3 | alle | alle | Dagelijks | Hoog | bellen | `Bel {account} op over offerte {offerte}` (taak) |
| SR10 | Deal onvoldoende gekwalificeerd | deal-onvoldoende-gekwalificeerd 14 dagen, €10.000 | alle | alle | Wekelijks | Hoog | bellen | inzicht |
| SR11 | Campagne loopt achter | campagne-achterstand 10 | alle | alle | 2 dagen | Hoog | geen | inzicht |
| SR12 | Deal gewonnen: onboarding | gebeurtenis `deal-gewonnen` | alle | alle | Continu | Hoog | geen | `Start onboarding {account}` (taak) |
| SR13 | Deal verloren: heropvolging | gebeurtenis `deal-verloren` | alle | alle | Continu | Midden | bellen | `Heropvolging {account} inplannen (3 maanden)` (taak, dueDate +90 dagen) |
| SR14 | AI-kansanalyse A en B | geen (AI, Intern) | prospect | A, B | Wekelijks | Hoog | geen | inzicht |
| SR15 | Vacatures | geen (AI, Extern `Web: vacatures`) | prospect | A, B | Wekelijks | Hoog | geen | inzicht |
| SR16 | Nieuws | geen (AI, Extern `Web: nieuws`) | prospect | A, B | Wekelijks | Midden | geen | inzicht |

Standaardmatrices: belmatrix klant A maand, B kwartaal, C halfjaar, D jaar;
prospect A maand, B maand, C kwartaal, D halfjaar. Afspraakmatrix meeting A
kwartaal, B halfjaar, C jaar, D 0; bezoek A kwartaal, B halfjaar, C jaar, D
jaar.

**Excel**: één kolomtabel (`KOLOMMEN`) met de 24 velden van het model;
export met blad Regels (bevroren kop, uitleg als notitie, keuzelijsten) en
blad Toelichting; import maximaal 5 MB en 2000 rijen, bewaart niets zelf,
koppen hoofdletter- en spatieongevoelig, ontbrekende verplichte kolom
weigert het blad, per rij fouten (onbekende keuze met de lijst, geen getal,
geen ja/nee met de sets `ja, j, true, waar, 1, x, aan, yes, y` en `nee, n,
false, onwaar, 0, uit, no`, leeg verplicht veld, dubbel id), lijsten op `,`
of `;`, triggerdata zonder patroon geeft een waarschuwing en wordt
verwijderd, leeg id wordt `R<6>`, goede rijen gaan door; de importflyout
toont fouten, waarschuwingen en "overschrijft N" met de keuze samenvoegen op
id of vervangen.

### Endpoints

```
GET  /api/activity-rules                 ingelogd
PUT  /api/activity-rules  {rule}         beheerder
PUT  /api/activity-rules/replace {rules} beheerder
DELETE /api/activity-rules/:id           beheerder
POST /api/activity-rules/excel-export    beheerder, regels uit de browser, max 1000
GET  /api/activity-rules/excel-voorbeeld
POST /api/activity-rules/excel-import    multipart 'bestand'
POST /api/motor/run                      beheerder
POST /api/motor/run-all                  x-motor-secret
GET  /api/motor/updates?since=
```

### AI-stappen

De AI-pass zelf staat in prompt 10; deze prompt bouwt de kandidaatselectie
(`motor === 'ai'`, targeting, cadans met minimum 7 dagen, maximaal 25 per
regel per run) en roept een `beoordeel()`-functie aan die in deze prompt de
mock is (contract binnen 90 dagen geeft confidence 80, bestelstilte boven
120 dagen 70, anders niet relevant).

### Wat je hergebruikt uit DealDrive

`server/utils/ruleEngine.ts` (bijna volledig), `activityRulesStore.ts`,
`app/composables/useActivitySellingRules.ts`,
`app/pages/instellingen/activity-selling.vue`,
`app/components/NieuweActiviteitFlyout.vue`, `RegelsImportFlyout.vue`,
`shared/activitySellingKolommen.ts`, `activitySellingExcel.ts`,
`activitySellingVoorbeeld.ts`, `server/utils/activitySellingWerkmap.ts`,
`server/api/activity-rules/*`, `server/api/motor/*`,
`netlify/functions/motor-schedule.mts`, `app/plugins/motorPoll.client.ts`,
`shared/ritmematrix.ts`, `app/composables/useRitmematrix.ts`,
`app/pages/instellingen/accountritme.vue`, `useAccountfases.ts`,
`server/db/e2e-ritme.ts`, `e2e-signalen.ts`.

### Wat je anders doet dan DealDrive

1.2 punten 6, 7, 8, 15 en 16. Daarnaast: de meetingrij stuurt wél;
`ookZonderDatum` bij inactiviteit; de editor waarschuwt bij een regel zonder
filter; `normaliseRule` bewaart alle velden; geen restantenfilter voor
recruitment (bestaat hier niet).

### Acceptatiecriteria

- Databasevrije suite `e2e-motor`: elk patroon, cadans met override, dedup,
  owner-fallback, targeting op type, klasse en fase, sjabloonvulling,
  Excel-import met foute rijen.
- Wegwerp-DB: een volledige run over een seed van 40 prospects in vier
  klassen levert precies de verwachte taken en inzichten; een tweede run
  direct erna levert niets (cadans); `deal-gewonnen` via het journey-endpoint
  levert SR12.
- Playwright: regel aanmaken, patroon kiezen, matrix wijzigen, "Draai
  motor nu", het resultaat op Vandaag.

### Buiten scope

De AI-beoordeling zelf, de web-connector, de Pitstop (prompt 10).

---

## 7. Prompt 5: Taken en inzichten (de goedkeuringsketen)

> Bouwprompt, vijfde van tien. Verwacht prompt 2 en 4.

### Wat je bouwt, in één zin

Inzichten met bewijs en een levenscyclus (nieuw, gelezen, omgezet,
afgewezen), taken met prioriteit, vervaldatum, uitvoerder en herkomst, de
goedkeuring "Maak taak" als scharnier, het Vandaag-scherm, de takenpagina met
horizonnen, de inzichtenpagina met bronnenfilter, de flyouts en de
herinneringen.

### Waarom

Dit is de kernflow: inzicht, goedkeuring, taak, uitvoering. DealDrive heeft
hem compleet, met één zwakte: het afronden van een taak telt op drie plekken
anders (1.2 punt 11). De nieuwe tool heeft één afrondfunctie.

### Functioneel

**Vandaag** `/` : hero met het belangrijkste inzicht (LeadCard, CTA "Open
klantkaart"); het Vandaag-paneel met drie kolommen Taken (open taken met
vervaldatum tot einde dag of prioriteit high/urgent zonder datum, sortering
vervaldatum oplopend dan prio, maximaal 8 met "nog N meer" naar `/taken`),
Afspraken (van de dag, niet geannuleerd, tags STRATEGISCH, RISICO, PROSPECT,
KLANT) en Prio (accounts met open offerte of segment at-risk, tags OFFERTE,
RISICO, maximaal 4 met "nog N meer"); kolomkoppen tellen de hele lijst; een
briefingblok met de accounts van vandaag (één per account, maximaal 6);
twee inzichtgrids klant en prospect (ongelezen, binnen 48 uur). Lege staten
"Geen taken vandaag.", "Geen afspraken vandaag.", "Niets dringends.".
Tijdweergave: vandaag "14:00 · vandaag", verleden "gisteren" of "over tijd",
toekomst "morgen" of "over N dgn", zonder datum "geen datum".

**Taken** `/taken`: horizonkolommen Vandaag `[0, 1d)`, Komende week `[1d,
8d)`, Week 2 en 3 `[8d, 22d)` gegroepeerd per dag (`HORIZON_DAGEN = 22`);
lijstweergave met groepen Achterstallig, Vandaag, Morgen, Deze week, Later,
Geen vervaldatum (opent op Achterstallig als die niet leeg is); filters Type
(Alle N, per type), Bronnen (regel, handmatig, campagne, lead), periode uit
`shared/periodeFilter.ts` (Vandaag, Morgen, Komende 7 dagen, Week erna,
Komende 14 dagen, Komende 30 dagen); contextmenu Afronden, Snooze 1 dag,
Snooze 7 dagen, Open klantkaart, Taak annuleren (status `cancelled`, met
bevestiging). Titelregel "32 taken en 22 afspraken op de planning.",
achterstallig "5 taken over tijd.".

**Inzichten** `/inzichten`: één grid nieuwste eerst, met accountbalk
(klant/prospect-pil, "Campagne-breed" zonder account); statkaarten Nieuw (<24
uur), Hot (≥ 75), Deze week, Totaal open als togglefilter (AND); filters
Gelezen (Ongelezen standaard, Gelezen, Beide), Bronnen (Alle, Extern, Intern,
Overig met tellers, verfijning op specifieke bron), Periode (Vandaag,
Gisteren, Afgelopen 7 dagen, Week ervoor, Afgelopen 14 dagen, Afgelopen 30
dagen, Alles standaard, Eigen periode), Klant/Prospect via `?kindFilter=`;
badges INTERN donker, EXTERN geel; `/inzichten?id=` opent de flyout; lege
staat "NIETS GEVONDEN / Geen inzichten in dit filter."

**InzichtFlyout**: kop `{groep} · {bron}`, titel, account · branche;
blokken Relevantie, Bron, Gezien (relatief), Status-pil (Omgezet, Afgewezen,
Gelezen, Nieuw), "Wat is er gebeurd?", "Waarom is dit relevant?" (AI-hoek,
gemarkeerd als beoordeling), Bewijs (citaat met link bij URL), "Klant in
context", "Voorgestelde taak", "Open originele bron ↗"; voet Maak taak
(primair), Bewerken, Markeer als gelezen (alleen ongelezen en niet omgezet of
afgewezen), Wijs af (gevaar, met korte reden uit een lijst: niet relevant,
al bekend, verkeerd account, te oud); bewerkmodus titel (minimaal 3 tekens),
type, relevantie 0 tot 100, body, hoek, voorsteltitel. `role="dialog"`,
Escape via de gedeelde flyoutstapel, focus-trap en focusherstel.

**TaakFlyout**: kop prio · status; velden Type, Vervaldatum (met label
"wo 23 sep (5 dagen over tijd)"), Toegewezen aan, Contactpersoon,
Herinnering, Aanleiding, Beschrijving, Klant in context, Volgende stap,
Pitstop-blok (prompt 10); voet Afronden, Snooze 1 dag (niet bij afspraak),
Bewerken, Verwijderen (alleen met recht, bevestiging "Taak verwijderen?"),
Open klantkaart; bewerkvoet Afronden, "Afronden en volgende taak" (nieuwe
taak met hetzelfde account en contact), Annuleren, Opslaan.

**NieuweTaakFlyout**: Klant (type-ahead, maximaal 8), Contactpersoon,
Titel (minimaal 3), Prioriteit (Laag, Middel, Hoog, Urgent; standaard
Middel), Vervaldatum en Tijd (standaard `volgendWerkmoment`: eerstvolgende
hele uur tussen 9 en 18, in het weekend maandag; leeg tijdveld wordt 09:00),
Type (Te doen, Bellen, Mailen, Bericht, Bezoek; afgeleid uit `actionType`),
Toegewezen aan, Aanleiding, Taak herhalen (dagelijks op werkdagen,
wekelijks, tweewekelijks, maandelijks; tot standaard +3 maanden; maximaal 52
taken; vervolgtaken erven herkomst, 1.2 punt 12), Herinnering (5, 15, 30
min, 1 uur, 4 uur, 1 dag, 2 dagen vóór; standaard 30; kanaal in-app, e-mail,
beide), Beschrijving; knoppen Annuleren en Maak taak.

**Herinneringen**: in-app engine elke 30 seconden over eigen taken en
afspraken (venster: verstreken en jonger dan 24 uur; stille uren op de
browserklok; ontdubbeling op `rem-taak-<id>-<ms>`; toast 8 seconden plus
belitem). E-mail via een sweep elke 5 minuten (`POST
/api/motor/reminders-sweep`, geheim): categorie uit betekent markeren zonder
mail; stille uren uitstellen; ouder dan 24 uur markeren; geen SMTP overslaan
zonder markeren; anders eerst `reminderSent` dan mailen ("at most once"),
onderwerp "Herinnering: {titel}". Dagstartmail via een sweep elke 15 minuten
met afspraken, taken van vandaag en de top 3 ongelezen inzichten.

### Datamodel

```ts
signals: id, organisation_id, account_id, contact_id, rule_id, generated_by, type, relevance_score int, confidence int, status, acknowledged bool, data jsonb
  data: title, body, commercialAngle, source {kind:'crawler'|'api'|'manual'|'regel', url?, provider, timestamp},
        evidence [{bron, url?, citaat}], voorgesteldeTaak {titel, prioriteit?, actionType?, executor?},
        campaignId?, leadId?, dealId?, advies?, afwijsReden?,
        status 'nieuw'|'gelezen'|'omgezet'|'afgewezen', acknowledgedAt, acknowledgedBy, createdAt, updatedAt
  type: 'vacature'|'nieuws'|'website-change'|'branche'|'concurrent'|'kvk-mutatie'|'directiewissel'|'aflopend-contract'|'omzetdaling'|'klantaandacht'|'cross-sell-kans'|'upsell-kans'|'campagne'|'agenda'|'lead'|'kwalificatie'
tasks: id, organisation_id, owner_id, account_id, contact_id, signal_id, rule_id, executor, executor_status, action_type, title, status, priority, type, due_date, data jsonb
  data: description, reason, dealId?, quoteId?, campaignId?, leadId?, source 'manual'|'regel'|'signal'|'campagne'|'lead',
        reminderAt, reminderChannel 'in-app'|'email'|'beide', reminderSent, completedAt, uitkomst?, draft {kind, content, generatedAt}, createdAt, updatedAt
  status 'open'|'in-progress'|'done'|'cancelled'; priority 'low'|'medium'|'high'|'urgent'; type 'to-do'|'call'|'afspraak'|'mail'|'bericht'
  executor 'self'|'ai-agent'; executorStatus 'concept-klaar'|'goedgekeurd'
appointments: id, organisation_id, owner_id, account_id, title, type ('klantbezoek'|'online-meeting'|'belafspraak'|'demo'|'intern'|'overig'), status ('gepland'|'voltooid'|'geannuleerd'|'niet-verschenen'), start_at, end_at, data jsonb {contactIds[], locatie, reason, verslag?}
```

`executorStatus` kent alleen de twee waarden die ook gezet worden (DealDrive
had er zes waarvan vier dood). Eén veld `dueDate`; middernacht lokaal
betekent "geen tijd" (`heeftTijd`, `tijdOfLeeg` in `shared/datum.ts`).

### Bedrijfsregels

- **Levenscyclus inzicht**: ontstaat `nieuw` met `acknowledged false`
  (motor, AI, lead, agenda-gat bij een afspraak van gepland naar geannuleerd
  of niet-verschenen); "Markeer als gelezen" zet `gelezen` met ack-velden
  tenzij al omgezet of afgewezen; "Maak taak" opent NieuweTaakFlyout
  voorgevuld (`title` uit het voorstel anders "Volg op: {typeLabel} bij
  {account}", `reason` uit de hoek, `description` uit de body, `source
  'signal'`, `priority` uit het voorstel anders `relevanceScore ≥ 80 ? high
  : medium`, `sourceSignalId`, `ruleId`, `executor`, `actionType`) en pas bij
  opslaan gaat het inzicht naar `omgezet`; annuleren laat het open; "Wijs
  af" zet `afgewezen` met reden; afgewezen valt uit alle werklijsten maar
  blijft voor rapportage per regel. Een regel met activiteit taak slaat het
  inzicht over.
- **Relevantie**: deterministisch Kritiek 90, Hoog 80, anders 65 met
  confidence 100; AI `relevanceScore = confidence`; handmatig vrij. Hot is
  ≥ 75; hero-pool ≥ 85 met account, ongelezen, vers binnen 48 uur, anders een
  dagrotatie `pool[dagNL % n]`; "Hoge relevantie" in de flyout vanaf 85.
- **Prioriteit taak**: uit de regel via `PRIO_MAP`, uit het voorstel, of
  handmatig; sorteergewicht urgent 4, high 3, medium 2, low 1.
- **Afronden** (`rondTaakAf`, één functie voor flyout, bewerkmodus,
  contextmenu, campagnebord en API): `status done`, `completedAt`; als de
  taak een account heeft en het type `call, mail, bericht, afspraak` is:
  `lastInteractionAt = nu`, bij `bellen` of `call` ook `lastCallAt`, bij
  `bezoek` of `afspraak` ook `lastVisitAt`; gekoppelde campagne-items naar
  klaar; als dit het eerste contactmoment was: journeygebeurtenis
  `eerste-contact`. Een to-do zet geen stuurveld. Een afspraak op `voltooid`
  (niet `intern`) zet `lastInteractionAt` en bij `klantbezoek`
  `lastVisitAt`, met de start van de afspraak als datum.
- Snooze: `status open`, `dueDate = nu + N dagen` op dezelfde tijd.
- Annuleren via het contextmenu is `cancelled`; verwijderen via de flyout
  is een harde delete op de server (recht `tasks:delete`).
- Rechten: goedkeuren, afwijzen en afronden mag iedere rol met `write`;
  geen eigenaarscheck; de lijsten hebben wel de filter Van mij.
- Herhaling: losse taken, maandelijks valt op de laatste dag van een korte
  maand, dagelijks alleen werkdagen, maximaal 52.

### Endpoints

Schrijven via de sync op `tasks`, `signals`, `appointments`. Daarnaast:

```
POST /api/tasks/:id/afronden          {uitkomst?}  dezelfde functie als de client, voor de API en latere koppelingen
POST /api/motor/reminders-sweep       x-motor-secret, elke 5 minuten
POST /api/motor/overzicht-sweep       x-motor-secret, elke 15 minuten (dagstartmail)
```

### AI-stappen

Geen in deze prompt. Het Pitstop-blok in de TaakFlyout toont alleen "Bereid
voor met AI" als een stub die prompt 10 invult.

### Wat je hergebruikt uit DealDrive

`app/types/entities.ts` (Signal, Task, Appointment), `app/pages/index.vue`,
`taken.vue`, `inzichten.vue`, `app/components/VandaagPanel.vue`,
`LeadCard.vue`, `SignalCard.vue`, `SignalTag.vue`, `InzichtFlyout.vue`,
`TaakFlyout.vue`, `NieuweTaakFlyout.vue`, `NieuweAfspraakFlyout.vue`,
`app/composables/useVandaagItems.ts`, `useHeroInzicht.ts`, `useAllSignals`,
`useAccountSignals`, `useSignaalLabels.ts`, `useSignalBron.ts`,
`useOptimisticWrite.ts` (allowlists, `registreerContactmoment`,
`acknowledgeSignal`), `useReminderEngine.ts`,
`app/plugins/reminderEngine.client.ts`, `server/utils/reminderSweep.ts`,
`overzichtSweep.ts`, `shared/periodeFilter.ts`, `shared/datum.ts`,
`server/db/e2e-dag.ts`.

### Wat je anders doet dan DealDrive

1.2 punten 11 en 12; `klantaandacht` staat in het type; afwijzen met reden
(de basis voor een latere leerlus); geen Dex-paden; herinneringen alleen
in-app en e-mail (push later).

### Acceptatiecriteria

- Databasevrije suite `e2e-taken`: levenscyclus inzicht, afronden op alle
  paden met dezelfde stuurvelden, horizonnen, herhaling, relevantie en
  hero-keuze, tijdweergave.
- Playwright: inzicht naar taak, taak afronden en het stuurveld op de kaart,
  snooze, herinnering instellen, filters op /taken en /inzichten.

### Buiten scope

Gespreksverslagen, push, de AI-chat.

---

## 8. Prompt 6: Fase 1, pre-data en kwalificatie

> Bouwprompt, zesde van tien. Verwacht prompt 2, 3 en 5.

### Wat je bouwt, in één zin

De leadgenerator met echte zoekrondes via de webzoeker, een leadsdossier
met bewijs per criterium, een maandbundel met grenzen, overnemen als
prospect met klasse en journeyfase, verrijking van het dossier, de
BAND-kwalificatie op het account (niet alleen op de deal) en de
kwalificatiestap naar de prospectfase.

### Waarom

DealDrive's leadgenerator is een voorbeeldronde zonder server; het domein
(matchregels, grenzen, dossierhoudbaarheid, ontdubbeling op KvK en domein)
is wel af en getest. De webzoeker bestaat al in `webBron.ts` met de
vangrails die hier nodig zijn. Kwalificatie is in DealDrive een dealveld
(BAND); in new business hoort hij bij het account vóór er een deal is.

### Functioneel

**Leadgenerator** `/leadgenerator`:

- Kop "Leadgenerator · {n} gevonden" of "nog niet gezocht"; knoppen
  "Zoekopdracht aanpassen" en primair "Nieuwe ronde zoeken" (uitgeschakeld
  bij bezig of bundel op, tooltip "Je maandbundel voor zoekrondes is op").
- Zoekopdracht in vier vakken met bronregel: Accountklasse (omschrijving),
  Branche (SBI-codes, "Uit je {n} klanten in deze klassen"), Werkgebied
  (postcodegebieden uit de gebieden of "heel Nederland"), Aanleiding (vrij,
  placeholder "bijvoorbeeld: werft servicemonteurs"). Bewerkvorm met vinkjes
  per klasse (standaard A en B), SBI-lijst bewerkbaar, postcodes bewerkbaar.
- Groepen in vaste volgorde: Passend, Nog niet te beoordelen, Verlopen, Al
  in je CRM, Valt af.
- Per lead: naam, plaats, pil "Klasse X", dossierpil ("Dossier van vandaag"
  of "Dossier N dagen oud"; groen tot 30 dagen, oranje daarna), reden,
  bewijslijst (criterium, ja/nee/?, bewijs, bron, datum), score "x/6" en "n
  beoordeeld".
- Knoppen: Passend "Neem over" en "Niet relevant"; Verlopen "Opnieuw
  uitzoeken" (kost 1 dossier); Nog niet te beoordelen "Toch uitzoeken"
  (kost 1 dossier); Al in je CRM "Open klantkaart".
- Meters "Zoekrondes deze maand x/120" en "Dossiers deze maand x/240" uit de
  bundelmeting op de server.
- Lege staten: "Kies minstens één accountklasse.", "Nog geen bedrijven
  gezocht.", "Deze ronde leverde niets op."
- Toasts: "Ronde klaar: {n} bedrijven beoordeeld, {p} passend.", "{naam}
  staat nu als prospect in je CRM, klasse X.", "{naam} komt in een volgende
  ronde niet terug."

**Op de accountkaart** (prospects in hoofdfase pre-data en prospect): blok
**Dossier** met de bewijsregels van de lead, "Dossier N dagen oud", knop
"Dossier vernieuwen" (kost 1 dossier); blok **Kwalificatie** met de vier
BAND-velden (Behoefte, Autoriteit (DMU), Noodzaak, Draagvlak; "Optioneel.
Eén à twee zinnen per vraag."), score x/4 met kleur (≤ 1 rood, 2 geel, ≥ 3
groen), knop "Kwalificeer" (meldt `gekwalificeerd`; vanaf score 2
automatisch aangeboden, onder 2 met waarschuwing), en het voorstel voor
de klasse uit het medewerkersaantal ("Voorstel: klasse B · Groot MKB.
Overnemen?").

**Lijst** `/prospects/alle` krijgt de filter Hoofdfase (pre-data, prospect,
verbinding) en de kolom Dossier (vers, oud, geen).

### Datamodel

```ts
leads: id, organisation_id, naam, kvk, domein, status ('nieuw'|'overgenomen'|'afgewezen'), gevonden_op, dossier_op, account_id, data jsonb
  data: plaats, medewerkers, sbi, bewijs [{criterium, oordeel 'ja'|'nee'|'onbekend', bewijs, bron?, bronDatum?, url?}],
        zoekopdrachtHash, rondeId, bronnen [{url, titel, datum}], afgewezenReden?
lead_rondes: id, organisation_id, user_id, zoekopdracht jsonb {klassen[], sbi[], postcodes[], aanleiding?}, hash, gestart_op, klaar_op, aantal, status ('bezig'|'klaar'|'fout'), data jsonb {foutmelding?, webzoekopdrachten}
lead_verbruik: (organisation_id, maand) PK, rondes int, dossiers int, per_gebruiker jsonb {userId: {dag: aantal}}
accounts.data.band: { behoefte?, autoriteit?, noodzaak?, draagvlak? }   // op het account, prompt 8 kopieert hem naar de deal
accounts.data.externalIds.leadId
```

Grenzen (`shared/leadGenerator.ts` `GRENZEN`): 120 rondes per organisatie
per maand, 240 dossiers per maand, 10 rondes per gebruiker per dag, 25
bedrijven per ronde, dezelfde zoekopdracht binnen 24 uur geeft het bewaarde
resultaat. `DOSSIER_GRENS`: zacht 30 dagen (Verlopen), hard 120, opruimen
60. `KLASSE_ONDERGRENS`: A 250, B 50, C 10, D 0. `MATCH_CRITERIA_AANTAL = 6`.

### Bedrijfsregels

- **Matchregels**: onbekend is geen nee; een nee blokkeert; elk oordeel
  draagt zijn bewijs. Criteria uit de opdracht (`regelsUitOpdracht`):
  Accountklasse ja als de klasse (uit medewerkers) in de gekozen klassen
  valt, anders nee, onbekend zonder aantal; Branche: SBI vóór de dubbele
  punt in de SBI-lijst; Werkgebied: postcode in de gebieden; Aanleiding:
  trefwoord van minimaal 4 tekens (ook zonder meervoud-s of -en) in een
  ander bewijs; de twee overige criteria komen uit de webzoeker (vacature
  of nieuws gevonden, website actief).
- **Volgorde** (`berekenLeadMatch`): bekend (KvK gelijk, anders domein
  zonder `www.`) met reden "Staat al in je klantenbestand als …";
  afgevallen bij een nee; verlopen als `dossierOp` ouder dan 30 dagen;
  onbeoordeelbaar bij `beoordeeld === 0`; anders passend. Sortering score,
  dan beoordeeld.
- **Zoekopdracht afleiden** (`leidZoekopdrachtAf`): accounts met
  `accountfase` in de klassen; top 3 SBI-codes op frequentie; top 6
  postcodegebieden op twee cijfers.
- **Ronde**: controleer eerst de bundel (maand, dag per gebruiker); een
  hash van de zoekopdracht binnen 24 uur geeft het bewaarde resultaat zonder
  verbruik; anders de webzoeker met maximaal 3 zoekopdrachten per ronde en
  maximaal 25 bedrijven; elk bedrijf krijgt een dossier met bewijs (alleen
  URL's die in de echte zoekresultaten staan en een niet-leeg citaat; datum
  van het model kale ISO, niet in de toekomst, niet meer dan 7 dagen na de
  paginadatum); ontdubbelen tegen accounts en bestaande leads; een lead die
  eerder afgewezen is komt niet terug.
- **Overnemen**: `createAccount({name, accountKind: 'prospect', kvkNumber,
  city, website, accountfase: klasse (ook D), medewerkers, sbiCode,
  trigger: 'Gevonden door de leadgenerator', triggerKind: 'hot' als de
  aanleiding ja was, externalIds.leadId, band: {}})`, de lead op
  `overgenomen` met `account_id`, een inzicht type `lead` met het dossier als
  bewijs, en de journeygebeurtenis `lead-overgenomen` (SR01 maakt de
  dossiertaak als het dossier niet compleet is).
- **Dossier compleet** = de zes criteria beoordeeld en `dossierOp` jonger
  dan 30 dagen; dan gebeurtenis `dossier-compleet`. Een dossier vernieuwen
  kost 1 dossier uit de bundel en zet `dossierOp`.
- **Regelpatroon `lead-verlopen`** (SR02): per overgenomen lead waarvan
  `dossierOp` ouder is dan `trigger.dagen` (30): inzicht "Dossier verloopt ·
  {account}" met voorstel "Dossier vernieuwen"; onderwerp `lead` in
  `rule_runs`.
- **BAND**: ingevuld is `trim().length > 0`; score 0 tot 4; onvoldoende is
  `≤ BAND_ONVOLDOENDE_MAX = 1` (vast); kleur ≤ 1 rood, 2 geel, ≥ 3 groen.
  "Kwalificeer" meldt `gekwalificeerd` en zet `prospectGrade` op `warm` bij
  score ≥ 3, anders `lauw`; bij score ≤ 1 vraagt de knop een bevestiging
  "Je kwalificeert met 1 van 4 BAND-vragen ingevuld. Toch doorgaan?".
- **Klassevoorstel**: `klasseVoorOmvang(medewerkers)`; wordt voorgesteld in
  een strook, nooit stil gezet.
- **Opruimen**: een sweep verwijdert leads met status `nieuw` ouder dan 60
  dagen en afgewezen leads ouder dan 120 dagen.

### Endpoints

```
GET  /api/leads                           leads van de organisatie met match
POST /api/leads/ronde   {zoekopdracht}     bundelcheck, hash, webzoeker, antwoord {rondeId, leads[], verbruik}
POST /api/leads/:id/dossier               vernieuwen, kost 1 dossier
POST /api/leads/:id/overnemen             maakt account, inzicht, gebeurtenis
POST /api/leads/:id/afwijzen {reden?}
GET  /api/leads/verbruik                  {rondes, dossiers, rondesVandaag, grenzen}
POST /api/accounts/:id/kwalificeer        BAND-check, gebeurtenis gekwalificeerd
POST /api/motor/leads-sweep               x-motor-secret, dagelijks
```

### AI-stappen

- **Webzoeker** (`server/utils/webBron.ts` als basis, nieuwe functie
  `zoekBedrijven(zoekopdracht)`): Claude met `web_search` (`max_uses 3`,
  `max_tokens 2000`), een prompt die per bedrijf JSON vraagt (`naam, plaats,
  kvk?, domein?, medewerkers?, sbi?, bewijs[{criterium, oordeel, bewijs,
  url, publicatiedatum}]`) en "bij twijfel onbekend"; bewijs alleen met een
  URL uit de echte `web_search_tool_result`-blokken; ouderdom vacatures
  zacht 30 en hard 120 dagen, nieuws zacht 90 en hard 365; boven hard
  schrappen, boven zacht geen "ja"; zonder sleutel geen ronde (de knop legt
  dat uit, geen nepbedrijven).
- Logging per ronde in `agent_runs` met `kind 'lead-ronde'` en
  `web_zoekopdrachten`; de ronde telt mee in de bundel van prompt 10.
- Kwalificeren zelf is mensenwerk; er is geen AI-score op BAND.

### Wat je hergebruikt uit DealDrive

`shared/leadGenerator.ts` (volledig), `app/composables/useLeadGenerator.ts`
(zonder de seedleads), `app/pages/generator.vue`,
`server/db/e2e-leadgenerator.ts`, `server/utils/webBron.ts` (validaties
`valideerModelDatum`, `OUDERDOM_GRENS`, URL-check),
`shared/bandKwalificatie.ts`, `app/components/BandBadge.vue`, de
BAND-sectie uit `NieuweDealFlyout.vue` 227 tot 241.

### Wat je anders doet dan DealDrive

1.2 punten 2 en 4; BAND op het account; het zesde criterium is "website
actief" in plaats van leeg; afwijzen met reden; dossier vernieuwen werkt.

### Acceptatiecriteria

- `e2e-leadgenerator` uit DealDrive groen plus: bundelgrenzen, hash-cache
  binnen 24 uur, ontdubbeling tegen leads, overnemen zet klasse D.
- Wegwerp-DB: ronde met de mock-webzoeker (vaste fixture van 25 bedrijven)
  levert leads in alle vijf groepen; overnemen maakt account, inzicht en
  journeyfase `pj-gevonden`; kwalificeren schuift naar `pj-gekwalificeerd`.
- Playwright: zoekopdracht aanpassen, ronde, overnemen, dossier op de
  kaart, BAND invullen, kwalificeren.

### Buiten scope

KvK-API, LinkedIn, verrijking van contactpersonen (handmatig invoeren
blijft), ICP-score.

---

## 9. Prompt 7: Fase 2, de prospectfase

> Bouwprompt, zevende van tien. Verwacht prompt 2, 4 en 5.

### Wat je bouwt, in één zin

De prospectfase als dagelijks ritme: de prospectdekking, de jaarplanning
met benadervensters per omzetpotentie, de bellijst en de belblokken die
zichzelf vullen, en de ritmeregels die de prospect-belmatrix echt laten
werken.

### Waarom

Een gekwalificeerde prospect verliest waarde met elke week stilte. DealDrive
heeft drie goede stukken (dekkingsbakken, jaarplanning, belblokken) die los
van elkaar staan; de jaarplanning slaat niets op en heeft geen motorregel,
en de prospect-belmatrix doet niets omdat er geen belritmeregel is. Hier
hangen ze aan elkaar via de motor.

### Functioneel

**Prospects** `/prospects`: "Top deze week · {ma tot zo}" met zes kaarten
(rang, klassepil, branche en plaats, aanleiding, aantal inzichten), een
dekkingsstrook (zes bakken met aantallen en "Prospectdekking 41%: 13 van 32
contact binnen 30 dagen"), links "Jaarplanning" en "Alle prospects". Lege
staat "GEEN PROSPECTS / Nog geen prospects in beeld." met knop naar de
leadgenerator.

**Jaarplanning** `/jaarplanning`:

- Kop "Jaarplanning prospects", "Verkoopjaar {jaar} · {x} van {n} prospects
  ingedeeld", zoeken, "Alle prospects".
- Blok "Wat knelt er nu": signalen met kicker en actieknop ("Bekijk de
  lijst", "Naar {maand}"); lege staat "Nog geen prospects met een
  accountklasse. De jaarplanning heeft niets om over te signaleren."
- Jaarkalender: twaalf maandknoppen met pillen Groot, Middel, Klein, "x/y
  benaderd", "n te laat"; legenda met klassenamen per venster.
- Maanddetail: "Aan de beurt in {maand}", "Blijven liggen in {maand}" of
  "Niets gepland in {maand}"; schakelaar "Toon ook benaderde"; per groep
  een meter "x/y benaderd"; per rij naam (klasse · plaats · branche),
  "Benaderd" of "Nog niet benaderd", aantal contactmomenten, knop "Bel".
- Blok "Buiten de planning": "{n} prospects zonder accountklasse" met link
  naar `/prospects/alle?filter=geen-klasse`.
- Instelling: startmaand van het verkoopjaar (standaard januari;
  DealDrive had hem vast).

**Belblokken** `/belblokken`:

- Kop "Een blok is een blok. Wie het vult, kies jij.", knoppen + Taak en
  + Afspraak.
- "Bellijst vandaag": Top 5, Top 10, Top 15, Zelf kiezen; per rij naam,
  contact, reden, minuten; lege staat "Geen belkandidaten: er staan geen
  open beltaken en alle accounts zijn recent gesproken."
- "Belblok plannen": advies uit de agenda (eigen vaste blokken, dan vrije
  voorstellen), "Niet tijdens de lunch (12:00 tot 13:00)", eigen datum,
  tijd en plek, geschatte gesprekstijd, marge, blokduur, melding over
  gesprekken die doorschuiven, vinkjes "agenda bezet" en "notificaties
  stil", knop "Zet in mijn agenda".
- "Vaste belblokken · Ritme dat zichzelf vult.": per blok "Vult zichzelf"
  of "Ik vul zelf", Verwijderen, blokdetail met gesprekken en vulbalk,
  "Vul aan"; flyout "Vast blok plannen" (dagen, starttijd, duur, soort,
  plek).

**Accountritme** (prompt 4) toont nu per klasse ook "Prospects in deze
klasse: N, waarvan M op ritme".

### Datamodel

```ts
// instellingen
verkoopjaarStart: number (1..12, standaard 1)
// users.data
belblokken: { blokken: VastBlok[], voorkeuren: { lunchVrij: boolean } }
VastBlok: { id, dagen: number[] (1..5), start 'HH:MM', minuten: 30|60|90|120|180|240, plek: string, soort: 'opvolging'|'koud'|'gemengd', automatisch: boolean }
// appointments van type 'belafspraak' met data.reason 'Belblok · agenda: bezet|vrij · notificaties: stil|aan', id 'a-blok-<user>-<datum>-<blokid>'
// jaarplanning: niets opslaan; alles berekend uit accounts (klasse, contactmomenten) en de instelling
```

Omzetpotentie (`shared/omzetpotentie.ts`): `OMZETPOTENTIE_PER_KLASSE` A en B
groot, C middelgroot, D klein, een eigen klasse telt als middelgroot, zonder
klasse null. `BENADER_VENSTERS`: groot maand 1 tot 2 ("grote trajecten
hebben de rest van het jaar nodig om te landen"), middelgroot maand 1 tot 5
("vóór de zomer rond"), klein maand 1 tot 12 doorlopend. Maanden tellen vanaf
`verkoopjaarStart`.

### Bedrijfsregels

- **Dekking**: bakken uit prompt 2; `dekkingPct = eerste drie bakken /
  totaal`.
- **Benaderd** in de jaarplanning: `telContactmomenten(account, vanaf
  verkoopjaarStart) > 0` (begrensd op het verkoopjaar; DealDrive telde
  alles). Sortering binnen een groep: niet benaderd eerst, dan score
  aflopend, dan naam. Een groep is "te laat" in elke maand na `totMaand`
  zolang er open prospects zijn. Signaaltonen: urgent Achterstallig; let-op
  Laatste maand, Buiten de planning; info Loopt (nog N maanden), Doorlopend
  ("Plan er wekelijks een paar tussendoor."), Nog niet aan de beurt; goed
  Op schema, Afgerond.
- **Knop Bel** opent NieuweTaakFlyout met `title "Bellen: {naam}"`, `type
  call`, `actionType bellen`, `source manual`, prioriteit high als het
  venster voorbij is anders medium, `reason "Jaarplanning {jaar}: {venster}
  (venster verstreken)"`.
- **Regelpatroon `jaarplanning-venster`** (SR07): per prospect met klasse
  waarvan het venster voorbij is en die dit verkoopjaar niet benaderd is:
  een taak volgens het sjabloon, prioriteit high, `dueDate` einde van de
  lopende week; cadans wekelijks via `rule_runs` met onderwerp account.
- **Belritme** (SR04): ritmeregel met actie bellen, de belmatrix overrulet
  de cadans per accounttype × klasse; prospect A en B elke 30 dagen, C elke
  91, D elke 182; een afgeronde beltaak of gehouden belafspraak zet
  `lastCallAt`, en de volgende ritmetaak krijgt `dueDate = lastCallAt +
  interval`.
- **Bellijst** (`bouwBellijst`): open beltaken (`type call` of `actionType
  bellen`) per account met `rangScore = 1000 + urgentie × 10 + prio × 20 +
  score` (urgentie achterstallig 100, vandaag 80, later 50, zonder datum 40;
  prio urgent 4, high 3, medium 2, low 1); aanvulling zonder beltaak `score
  + min(20, inzichten × 5) + min(15, openTaken × 4) + 15 (hot) of 5 (warn)`;
  minuten 8, 12 bij urgent, +2 bij score ≥ 70, +2 bij meerdere taken.
- **Blok plannen**: marge `ceil(minuten × 0,25 / 5) × 5`; blokduur `max(30,
  ceil((gesprek + marge) / 30) × 30)`; wat niet past schuift naar het
  volgende vaste blok; een bestaande beltaak krijgt `dueDate` = blokstart,
  anders een nieuwe beltaak "Bellen: {naam}"; één afspraak `belafspraak`
  "Belblok · n gesprekken (· bezet)".
- **Vuller op de server** (na de motorrun): alleen maandag tot vrijdag,
  alleen blokken met `automatisch` voor vandaag die nog niet voorbij zijn;
  een bestaande belafspraak op dat tijdstip wordt aangevuld; handmatig
  ingeplande taken blijven staan; minder dan 8 minuten ruimte betekent
  overslaan; kandidaten zijn open beltaken niet binnen 60 minuten van een
  ander blok; rang `(achterstallig ? 1000 : 0) + prio × 100 + score`; geen
  kandidaten betekent geen afspraak; insert met `onConflictDoUpdate` op het
  vaste id.
- Standaardblokken: maandag en woensdag 09:00, 60 minuten, opvolging,
  automatisch; vrijdag 15:00, 60 minuten, koud, handmatig. Starttijden 08:00
  tot 19:00 in halve uren; lunch 12:00 tot 13:00 vrij (voorkeur, standaard
  aan).

### Endpoints

```
GET  /api/mij/belblokken, PUT /api/mij/belblokken {blokken?, voorkeuren?}
GET  /api/jaarplanning?jaar=            berekend; per maand groepen, benaderd, te laat, signalen
PUT  /api/settings/verkoopjaarStart     beheerder
```

De vuller draait binnen `POST /api/motor/run-all` na de regels.

### AI-stappen

Geen; alles heuristisch en uitlegbaar ("uitgerekend, geen AI").

### Wat je hergebruikt uit DealDrive

`app/pages/prospects/index.vue`, `app/pages/prospectplanning.vue`,
`app/composables/useOmzetpotentie.ts`, `useDekkingBuckets.ts`,
`useBriefingSoort.ts` (`telContactmomenten`), `app/pages/belblokken.vue`,
`shared/belblokken.ts`, `app/composables/useBelblokken.ts`,
`useBellijst.ts`, `server/utils/belblokVuller.ts`,
`server/api/mij/belblokken.*`, `server/db/e2e-belblokken.ts`.

### Wat je anders doet dan DealDrive

Jaarplanning begrensd op het verkoopjaar en met een instelbare startmaand;
het patroon `jaarplanning-venster` als echte motorregel; een belritmeregel
in de starterset zodat de prospect-belmatrix werkt; de volgende ritmetaak
rekent vanaf `lastCallAt`; stiltenotificaties doen echt iets (in-app
herinneringen gepauzeerd tijdens het blok).

### Acceptatiecriteria

- Databasevrije suites `e2e-jaarplanning` (vensters, te laat, benaderd
  binnen het verkoopjaar, startmaand juli) en `e2e-belblokken` (rang,
  marge, doorschuiven, vuller).
- Wegwerp-DB: motorrun maakt voor klasse B prospect zonder contact een
  beltaak via SR04 met interval 30; na afronden geen nieuwe tot
  `lastCallAt + 30`.
- Playwright: jaarplanning doorklikken naar de maand en "Bel"; belblok
  plannen; vast blok toevoegen en de vuller via "Draai motor nu".

### Buiten scope

Route en regiodag (bezoekplanning blijft buiten de tool), agenda-sync.

---

## 10. Prompt 8: Fase 3, de verbindingsfase

> Bouwprompt, achtste van tien. Verwacht prompt 2, 3, 4 en 5.

### Wat je bouwt, in één zin

De weg van eerste afspraak naar klant: afspraken die de journey voeden, de
pipeline met fases en kansen, deals met BAND uit het account, offertes met
status en opvolging volgens de offertematrix, en de overstap naar klant
bij een gewonnen deal met onboarding en heropvolging bij verlies.

### Waarom

Hier wordt een prospect omzet. DealDrive heeft de pipeline, de offertematrix
en de regel voor onvoldoende gekwalificeerde deals; wat ontbreekt is de
automatische overstap naar klant en een schrijfpad voor de offertestatus.
Beide zitten in deze prompt.

### Functioneel

**Afspraken**: `NieuweAfspraakFlyout` met Klant, Contactpersoon, Type (één
select met optgroups Afspraak: klantbezoek, demo, beurs; Meeting:
online-meeting, belafspraak, intern), datum, begin en eind, locatie, reden;
opslaan meldt `eerste-afspraak-gepland` alleen bij de eerste afspraak met
dat account. Afspraak op voltooid vanuit de flyout.

**Pipeline** `/pipeline`: kicker "Pipeline · {open} open, {totaal} totaal",
titel "{n} kansen in beeld.", knoppen + Deal, pipelinekeuze, Kanban of
Lijst, Filters (fasepillen, waarde Alle, € 1.000+, € 5.000+, € 25.000+,
€ 100.000+, Van mij); stats Aantal kansen, Pipelinewaarde, Gewogen (Σ
waarde × kans), Tot sluiting (gemiddelde dagen); kanban met slepen tussen
zichtbare kolommen inclusief Gewonnen en Verloren; lege kolom "Sleep hier
een kaart naartoe."; kaart met "BAND x/4" bij open fase en score boven 0.

**DealFlyout**: Waarde, Kans, Gewogen, sluitdatum of "Gesloten op", Account,
Contactpersoon, Verliesreden, Offertes met "+ Offerte", BAND (bewerkbaar;
gespiegeld met het account), Extra velden, Pitstop-blok (prompt 10); acties
"Markeer gewonnen" (bevestiging "Deal gewonnen? "{titel}" gaat op gewonnen
met sluitdatum vandaag. {account} wordt klant."), "Markeer verloren"
(paneel met redenen Prijs, Timing, Concurrent, Geen budget, Geen besluit,
Anders plus toelichting; opgeslagen als "reden: toelichting"), "Heropen
deal", Wijzigen, Verwijderen (recht), Open klantkaart.

**Nieuwe deal**: standaardfase `kwalificatie`, kans volgt de fase ("volg
fase" zet een handmatige kans terug), sluitdatum vandaag + 30 dagen, BAND
voorgevuld uit het account.

**Offertes** `/offertes`: kop "Offertes · n totaal", "{n} offertes vragen
aandacht binnen 7 dagen. Geen offerte mag liggen zonder opvolging."; stats
Alle, Urgent, Concept, Verstuurd, Gelezen, Besproken, Goedgekeurd, "Verloren
of vervallen"; filters zoeken, vervaltermijn (Alle, Verlopen, < 7 dagen, <
30 dagen), Klant; rij met status, urgentielabel (VERLOPEN, "{d} D RESTEREN",
NIET GELEZEN), "verstuurd …" of "opgesteld …", "gelezen n×", bedrag,
vervaldatum of besluitdatum, **statusknop** (concept naar verstuurd naar
gelezen naar besproken naar goedgekeurd, of verloren of vervallen; met
bevestiging bij goedgekeurd en verloren) en "Open klantkaart".

**Offertematrix** op `/instellingen/accountritme`: kolommen Waardeklasse,
Vanaf (€), Kanaal, Uitvoerder, Opvolgen binnen (werkdagen, placeholder
"regel"), Waarom; lege lijst betekent bewust niet sturen op orderwaarde.

**Op de accountkaart** na de overstap: de klantfase, "Klant sinds {datum}"
in de stuurstrip, de onboardingtaak op de tijdslijn.

### Datamodel

```ts
deals: id, organisation_id, account_id, owner_id, stage, probability int, value_amount int (centen), expected_close_date, closed_at, data jsonb
  data: title, description, contactIds[], lostReason, stageHistory [{van, naar, op}], band {behoefte, autoriteit, noodzaak, draagvlak}, customFields, executor, executorStatus, draft
quotes: id, organisation_id, account_id, deal_id, contact_id, status, total_value int, sent_at, valid_until, decided_at, data jsonb
  data: title, reference, issuedAt, readAt, readCount, pdfUrl, soort ('offerte'|'contract'), statusHistorie [{van, naar, op, door}]
  status: 'concept'|'verstuurd'|'gelezen'|'besproken'|'goedgekeurd'|'verloren'|'vervallen'
// instellingen
dealStages: [{id, label, kind: 'open'|'won'|'lost', color, probability, builtin?}]
pipelines: [{id, name, description?, stages[], accountFunctionFilter?, minValueCents?, isDefault?}]
offerteOpvolging: [{drempel (centen), kanaal: 'mailen'|'bellen'|'bezoek'|'belafspraak'|'online-meeting', rol: 'accountmanager'|'salesmanager'|'beheerder', opvolgDagen?, omschrijving}]
```

Standaardfases: identificatie 10, kwalificatie 25, behoefte 40, voorstel
60, onderhandeling 80, gewonnen 100 (won), verloren 0 (lost). Won en lost
zijn niet te verwijderen; minstens één open fase; een nieuwe fase wordt op
kans ingevoegd; deals in een verwijderde fase verhuizen naar de eerste
andere open fase. Standaardpipeline "Alle deals".

Standaard offertematrix: €0 mailen accountmanager 5 werkdagen; €10.000
bellen accountmanager 3; €50.000 bezoek accountmanager 5; €100.000 bellen
beheerder 2 ("de directeur belt zelf na").

### Bedrijfsregels

- **Fasewissel** (`verplaatsDeal`): kans volgt de fase; `stageHistory`
  krijgt een regel; won of lost zet `closedAt`, open wist hem; weg van lost
  wist `lostReason`; bij won of lost de journeygebeurtenis `deal-gewonnen`
  of `deal-verloren` via `POST /api/journey/event`. Heropenen gaat naar de
  vorige open fase uit de historie, anders de laatste open fase.
- **Deal gewonnen**: prompt 3 doet de overstap (type klant, grade, fase,
  audit); SR12 maakt "Start onboarding {account}"; de belmatrix springt
  door `accountKind` vanzelf naar de klantrij. Toast "{account} is klant.
  Onboarding staat op je lijst."
- **Deal verloren**: fase `pj-verloren`; SR13 maakt de heropvolgtaak met
  `dueDate` +90 dagen; afronden van die taak met uitkomst "weer actief"
  meldt `heropvolging` (terug naar gekwalificeerd), met "definitief weg"
  gaat het account naar `pj-geparkeerd`.
- **Offertestatus**: overgangen alleen vooruit langs concept, verstuurd,
  gelezen, besproken, goedgekeurd; vanuit elke niet-besliste status naar
  verloren of vervallen; `verstuurd` zet `sentAt` en meldt
  `offerte-verstuurd`; `goedgekeurd` zet `decidedAt` en biedt aan de deal
  op gewonnen te zetten; een offerte met `validUntil` voorbij en status
  verstuurd of gelezen wordt door een sweep `vervallen`. Urgent is niet
  beslist en (geldig tot binnen 7 dagen, of verstuurd, niet gelezen en
  langer dan 5 dagen).
- **Offerteopvolging** (SR09, patroon `offerte-verstuurd`): offertes met
  status verstuurd binnen `OFFERTE_VENSTER_DAGEN = 30`; profiel is het
  hoogste met `drempel ≤ bedrag` (geen bedrag telt als 0; onder de laagste
  drempel geen profiel); contract (`soort 'contract'` of trefwoorden
  contract, overeenkomst, verlenging in titel of referentie) gaat altijd
  naar bezoek; werkdagen uit de matrix, anders `trigger.dagen`, anders 3,
  grenzen 1 tot 60, met feestdagen; uitvoerder de accounteigenaar als die
  de rol heeft, anders de eerste met die rol, anders de eigenaar met een
  noot; de taak: titel per kanaal ("Bel na over offerte {offerte} bij
  {account}"), `dueDate = sentAt + N werkdagen`, `quoteId`, `dealId`,
  `source 'regel'`, uitlegzin over waardeklasse, kanaal en rol; dedup op een
  open opvolgtaak met dat `quoteId` plus `alGedraaid` per offerte.
- **Onvoldoende gekwalificeerd** (SR10): open deal (niet won of lost, geen
  `closedAt`), `valueAmount ≥ minWaarde` (standaard €10.000; zonder bedrag
  buiten de regel), leeftijd ≥ 14 dagen, BAND-score ≤ 1: inzicht "Deal
  onvoldoende gekwalificeerd · {titel}" met bewijs "BAND s/4, ingevuld …,
  leeg …" en voorstel "BAND compleet maken met {partner}" (dealcontact,
  anders beslisser, anders eerste contact, anders accountnaam); één open
  inzicht per deal.
- BAND staat op het account en wordt bij een nieuwe deal gekopieerd;
  bewerken in de deal schrijft terug naar het account (één waarheid).
- Gewogen waarde = Σ `value × probability / 100` over open deals.

### Endpoints

Deals, offertes en afspraken via de sync. Daarnaast:

```
POST /api/quotes/:id/status  {status}     overgangscheck, sentAt/decidedAt, journeygebeurtenis
POST /api/motor/offertes-sweep           x-motor-secret, dagelijks: vervallen
PUT  /api/settings/dealStages | pipelines | offerteOpvolging
```

### AI-stappen

Geen in deze prompt; de dealvoorbereiding (Pitstop) komt in prompt 10 en
leest dan fase, waarde, kans, sluitdatum, BAND en het journey-accent.

### Wat je hergebruikt uit DealDrive

`app/pages/pipeline.vue`, `app/components/DealFlyout.vue`,
`NieuweDealFlyout.vue`, `NieuweAfspraakFlyout.vue`,
`app/composables/useDealStages.ts`, `useDealStageChange.ts`,
`usePipelines.ts`, `app/pages/offertes.vue`, `shared/offerteStatus.ts`,
`shared/offerteOpvolging.ts`, `app/composables/useOfferteOpvolging.ts`, de
offertematrix-sectie uit `accountritme.vue` 272 tot 397,
`server/utils/ruleEngine.ts` 1510 tot 1878 (offerte- en BAND-lus),
`shared/bandKwalificatie.ts`, `server/db/e2e-offerte*.ts`.

### Wat je anders doet dan DealDrive

1.2 punten 1, 3 en 16; een schrijfpad voor de offertestatus met historie;
BAND vanuit het account; heropvolging met uitkomst; de vervallen-sweep.

### Acceptatiecriteria

- Databasevrije suite `e2e-verbinding`: fasewissel met historie,
  profielkeuze, werkdagen met feestdag, contractherkenning, urgentie,
  statusovergangen van de offerte.
- Wegwerp-DB: deal naar gewonnen zet in één keer type, fase, grade, audit
  en SR12; offerte op verstuurd levert via de motor de opvolgtaak met de
  juiste uitvoerder en datum; deal verloren levert de heropvolgtaak op +90.
- Playwright: afspraak plannen (journey schuift), deal aanmaken met BAND,
  slepen naar gewonnen, offerte op verstuurd, de taak op Vandaag.

### Buiten scope

Offerte-PDF genereren, e-mailsequences met open-tracking, winback-cadans
na drie maanden (de heropvolgtaak dekt de eerste stap).

---

## 11. Prompt 9: Campagnes

> Bouwprompt, negende van tien. Verwacht prompt 2, 4 en 5.

### Wat je bouwt, in één zin

Campagnes als gerichte actie op een doelgroep: soorten met verdiepingen,
een doel dat meetbaar is, een bord met vier kolommen, omzetten naar taken
per kanaal, een tempo-oordeel, een deterministisch advies "begin hier", de
achterstandregel in de motor en de afsluiter.

### Waarom

Een prospectfase zonder campagnes is bellen op gevoel. DealDrive's
campagnemodule is compleet en bewust zonder AI ("uitgerekend, geen AI"); hij
mist alleen de koppeling met de journey, verliest verdiepingen bij het
aanmaken en kent geen `startedAt` bij een handmatige activering. De nieuwe
tool neemt de module over en hangt hem aan de prospect journey.

### Functioneel

**Lijst** `/campagnes`: kicker "Campagnes · {n} actief" (over alle
campagnes), titel "Eén lijst, één doel, elke dag een stap.", subtitel "Een
campagne is geen lijst om af te vinken maar een reeks gesprekken: elke stap
die je vandaag zet, scheelt er morgen twee."; knoppen zoeken, + Campagne,
Filters (status Concept, Actief, Afgerond, Archief met aantallen, "Alles
aan", "Alles uit", teller x/4); kaart met soortpil, statuspil, eigenaar,
naam, beschrijving, "Doel: …", accounts, klaar, voortgang % met balk,
tempopil, "Doel: … ✓" en "nog N dgn" of "N dgn over tijd", link "Open
campagnebord"; lege staat "Geen campagnes in dit filter."

**Aanmaken** (flyout "Nieuwe campagne / Plan een gerichte actie", "Start als
concept en activeer pas wanneer de doelgroep en het doel scherp zijn."):
stap 1 Soort (standaard bel) met optionele verdiepingen (wisselen van soort
schrapt niet-passende verdiepingen); stap 2 Naam (3 tot 80 tekens) en
beschrijving (maximaal 240, placeholders per soort); stap 3 Doelgroep: een
segment (eigen of van de organisatie, met match-modus en aantal regels), een
**journeyfase of hoofdfase** (nieuw), of "Vrije keuze (later toevoegen)";
stap 4 "Doel / KPI (toelichting)", "Meetbaar doel" (Geen, Aantal accounts
klaar, % van de accounts klaar; minimaal 1, bij % maximaal 100), "Geplande
einddatum" (op zijn vroegst morgen, "campagne sluit automatisch na deze
datum"); knop "Opslaan als concept". Bij opslaan komen de accounts uit het
segment of de fase als items `gespot` op het bord; toast 'Campagne "…"
opgeslagen als concept met {n} accounts.'

**Detailflyout**: lezen (Doel, Meetbaar doel, Voortgang, Beschrijving, Extra
velden; zonder accounts "Nog geen accounts gekoppeld. Voeg ze toe op het
campagnebord."; "Open campagnebord" en Wijzigen) en bewerken (naam, soort,
status Concept, Actief, Afgerond, Archief, verdieping, doelgroep, doel,
meetbaar doel, einddatum als 23:59, beschrijving; "Opslaan"). Een
handmatige wissel naar actief zet `startedAt` (1.2 punt 13).

**Bord** `/campagnes/:id`: niet gevonden "Campagne niet gevonden." met
"Terug"; kop kicker "{soort} · {status}", naam, beschrijving, "Doel: …",
cijfers accounts, voortgang %, verwacht %; actierij met tempopil, "Doel: …
✓ behaald", "nog N dagen" of "N dagen over tijd", "Alle accounts hebben een
taak." of "Zet om naar taken ({n})", knoppen Voortgang, Wijzigen,
+ Accounts; adviesblok "Begin hier · uitgerekend, geen AI" (maximaal drie
accounts met naam, reden, aanpak); vier kolommen Gespot, Open, Bezig, Klaar
met aantallen en slepen; Gespot met filter "Filter op accountnaam…", "Alles
selecteren", "→ Open + taak ({n})" (zonder vinkjes geldt alles wat
zichtbaar is); kaart met initialen in segmentkleur, naam, notitie, "Bekijk
taak" of "✓ taak gekoppeld", "Uit campagne" (bevestiging "{naam} uit de
campagne halen? Een gekoppelde taak blijft staan."); lege kolom "Sleep hier
een kaart naartoe."; lege staat "Nog leeg / Nog geen accounts op dit bord.
/ Voeg ze toe met + Accounts; ze komen dan in de kolom Gespot te staan.";
+ Accounts opent een flyout met alle accounts die nog niet meedoen (zoeken
op naam, plaats, branche; maximaal 100 zichtbaar; filter Hoofdfase), toast
"{n} accounts in Gespot gezet."; voortgangsflyout met doel, KPI, totaal, %,
verwacht %, per account kolom en taak, "Taken uit deze campagne" open,
klaar, "Nog zonder taak", dagen tot de einddatum.

**Op de accountkaart**: tabblad Campagnes met de niet-gearchiveerde
campagnes van dit account (soort, status, doel, itemstatus, klik naar het
bord); lege staat "Dit account loopt in geen enkele campagne mee."

### Datamodel

```ts
campaigns: id, organisation_id, owner_id, name, kind, status, goal, source_segment_id, source_stage_id, started_at, ends_at, data jsonb
  data: description, varianten[], doelType 'aantal'|'percentage', doelWaarde, customFields, afgerondOp,
        items [{id, accountId, assignedTo?, status 'gespot'|'open'|'bezig'|'klaar', note?, taskId?, completedAt?}]
  kind: 'bel'|'mail'|'bezoek'|'meeting'|'demo'|'whatsapp'|'sms'|'training'|'webinar'|'event'|'mixed'
  status: 'concept'|'actief'|'afgerond'|'gearchiveerd'
```

Soorten en verdiepingen (`shared/campagneSoorten.ts`): bel (bel-koud,
bel-warm), mail (mail-koud, mail-warm), bezoek (bezoek-gepland,
bezoek-ongepland), meeting (meeting-online, meeting-belafspraak), demo
(demo-online, demo-offline), whatsapp (whatsapp-tekst, -audio, -video), sms
(geen), training (training-online, -offline), webinar (webinar-live,
-terugkijken), event (event-intern, -extern), mixed (alle).

Rechten: accountmanager read/write all, delete own; salesmanager en
beheerder delete all. Tabel op de sync-allowlist.

### Bedrijfsregels

- **Taak per kanaal** bij "Zet om naar taken" (items zonder `taskId` en niet
  klaar): titel "{werkwoord} {account} ({campagne})", `source 'campagne'`,
  `campaignId`, `reason 'Campagne "{naam}" (doel: …)'`, `priority medium`,
  `ownerId = item.assignedTo ?? account.ownerId`, `dueDate = endsAt` anders
  vandaag + 7 dagen; type, actiesoort en werkwoord:

| soort | taaktype | actiesoort | werkwoord |
|---|---|---|---|
| bel | call | bellen | Bel |
| mail | mail | mailen | Mail |
| bezoek | afspraak | bezoek | Bezoek |
| whatsapp | bericht | bericht | App |
| meeting | afspraak | online-meeting | Plan meeting met |
| demo | afspraak | bezoek | Geef demo bij |
| training | afspraak | bezoek | Train |
| webinar | afspraak | online-meeting | Nodig uit voor webinar |
| event | afspraak | bezoek | Nodig uit voor event |
| sms | bericht | bericht | Sms |
| mixed | to-do | geen | Benader |

- Bevestiging vooraf: "Er komen {n} taken in je takenlijst met vervaldatum
  {datum} ({x} accounts, waarvan {y} al een taak hebben). Terugdraaien kan
  alleen taak voor taak."; titel "{n} taken in één keer?" boven 10, anders
  "Taken aanmaken?"; knop "Maak {n} taken". Na afloop wordt een concept
  actief met `startedAt`; toast "{n} taken aangemaakt. Afronden zet het item
  op Klaar."
- Een afgeronde taak zet alle items met dat `taskId` op klaar met
  `completedAt` (via `rondTaakAf` uit prompt 5); slepen naar Klaar zet
  `completedAt`.
- **Tempo** (één formule in `shared/campagneTempo.ts`, server en client):
  `pct = round(klaar / totaal × 100)`; doel behaald bij aantal `klaar ≥
  doelWaarde`, bij percentage `pct ≥ doelWaarde`; tempo alleen als de status
  niet afgerond of gearchiveerd is, er een `endsAt` is, eind na start en
  totaal boven 0; start is `startedAt ?? createdAt`; `verwachtPct =
  round(clamp(verstreken / looptijd) × 100)`; `doelPct` bij percentage de
  doelwaarde, bij aantal `min(100, round(doelWaarde / totaal × 100))`,
  anders 100; `verwachtBehaald = round(verwachtPct / 100 × doelPct)`;
  oordeel "Voor op schema" bij `pct ≥ verwachtBehaald + 5`, "Op schema" bij
  `≥ verwachtBehaald − 10` (`TEMPO_MARGE`), anders "Achter op schema";
  `achterstand = verwachtBehaald − pct`; `dagenRest = ceil((eind − nu) /
  dag)`.
- **Achterstandregel** (SR11, patroon `campagne-achterstand`): per actieve
  campagne, vuurt bij `achterstand ≥ marge` (`trigger.dagen`, standaard 10
  punten); inzicht type `campagne` zonder account, titel "Campagne loopt
  achter · {naam}", body "Voortgang {pct}% ({klaar}/{totaal} accounts klaar)
  waar {verwachtBehaald}% verwacht is, nog {n} dagen tot de einddatum.",
  bewijs met de cijfers, confidence 100, voorstel 'Inhaalactie "{naam}":
  {open} open accounts omzetten naar taken', plus het advies; dedup op
  `campaignId` met bijwerken; cadans via `rule_runs` onderwerp campagne.
- **Advies** (`bouwCampagneAdvies`): open items één keer per account,
  gesorteerd op het laatste contact (recentste van `lastInteractionAt` en
  `lastVisitAt`; nooit contact vooraan); top 3 met `{accountId, naam,
  dagenGeenContact, reden ("Nog geen contactmoment vastgelegd" of "Laatste
  contact N dagen geleden"), accountklasse "A · Corporate", fase, aanpak}`;
  aanpak is het Pitstop-accent van de journeyfase, anders per soort (bel
  "Bel de vaste contactpersoon en gebruik de campagne-aanleiding als
  opening."; bezoek "Plan een bezoek en combineer het met accounts in
  dezelfde regio."; mail "Stuur een persoonlijke mail met één concrete
  vervolgstap."; whatsapp "Stuur een kort persoonlijk bericht met één
  concrete vervolgstap."; mixed "Kies het kanaal waar deze klant normaal op
  reageert en stuur op één vervolgstap."; anders "Neem contact op met de
  vaste contactpersoon en stuur op één concrete vervolgstap."); kop "Begin
  bij deze {n} accounts, hier is het het langst stil."; `herkomst
  'deterministisch'`.
- **Afsluiter** (in de motorrun vóór de regels): actieve campagnes met
  `endsAt < nu` naar afgerond met `afgerondOp`; geen oordeel gehaald of
  gemist; idempotent; concepten blijven.
- **Journey** (nieuw): een campagne op een hoofdfase neemt bij activering
  alle accounts in die fase; een account dat tijdens de campagne van fase
  wisselt blijft op het bord met een pil van de nieuwe fase; een campagne
  meldt zelf geen gebeurtenis, de taken wel (eerste contact via afronden).
- Varianten gaan mee bij aanmaken én bewerken.

### Endpoints

Via de sync op `campaigns`. Daarnaast:

```
POST /api/campaigns/:id/taken   {itemIds?}   omzetten naar taken op de server (zelfde logica als de client, voor de API)
```

### AI-stappen

Geen. Het advies is uitgerekend. Prompt 10 voegt per campagnetaak de Pitstop
toe met het soortspecifieke concept (belscript bij bel, mailconcept bij
mail).

### Wat je hergebruikt uit DealDrive

`shared/campagneSoorten.ts`, `shared/campagneAdvies.ts`,
`server/utils/campagneAdvies.ts`, `campagneTempo.ts`,
`campagneAfsluiter.ts`, `app/composables/useCampagneTempo.ts`,
`useCampagneDetail.ts`, `app/pages/campagnes/index.vue`, `[id].vue`,
`app/components/NieuweCampagneFlyout.vue`, `CampagneFlyout.vue`,
`CampagneAccountsFlyout.vue`, `CampagneVoortgangFlyout.vue`,
`server/utils/ruleEngine.ts` 1389 tot 1508 (campagnelus),
`server/db/e2e-campagne.ts`.

### Wat je anders doet dan DealDrive

1.2 punten 13 en 16 (één tempoformule); doelgroep uit een journeyfase;
`source_stage_id`; `ownerId` valt terug op de accounteigenaar; het
advies-accent komt uit de prospect journey.

### Acceptatiecriteria

- Databasevrije suite `e2e-campagne`: tempo in alle takken, advies met en
  zonder accent, taak per soort, afsluiter idempotent.
- Wegwerp-DB: campagne uit hoofdfase prospect met 12 accounts, omzetten,
  twee taken afronden, motorrun levert het achterstandsinzicht met advies.
- Playwright: aanmaken in vier stappen, bord slepen, omzetten met
  bevestiging, voortgang.

### Buiten scope

Multikanaal-opvolgacties met audio of video, een doelen-entiteit naast het
tekstdoel, campagnesjablonen.

---

## 12. Prompt 10: De AI-lagen

> Bouwprompt, tiende van tien. Verwacht prompt 4, 5 en 8.

### Wat je bouwt, in één zin

De AI-beoordeling in de motor met bewijsvalidatie, de web-connector voor
vacatures en nieuws, de Pitstop die per taak, afspraak of deal een concept
klaarzet dat nooit zelf iets doet, de promptketen met platform- en
klantregels, het kostenlogboek en de maandbundel met plafond, en de
pakketpoort.

### Waarom

Dit is de laag die DealDrive van een lijstje regels een assistent maakt,
met drie vangrails die niet mogen ontbreken: geen bewijs geen inzicht,
concept-eerst, en een plafond op verbruik. Alles hierboven werkt al zonder
AI (mock); deze prompt vervangt de mock door echte aanroepen zonder het
gedrag van de rest te veranderen.

### Functioneel

- **Pitstop-blok** in TaakFlyout, DealFlyout en de afspraakflyout: "Bereid
  voor met AI" (uitgeschakeld onder Starter met uitleg), daarna het concept
  als platte tekst, de knoppen "Keur concept goed" (zet `goedgekeurd`),
  "Kopieer tekst", "Nieuwe pitstop", en de vaste noot "De agent voert niets
  uit. Jij keurt goed en belt, mailt of bezoekt zelf."; statuslabel
  "Pitstop klaar, wacht op jouw goedkeuring". Geen verstuurknop.
- **Klaargezet door je team** op Vandaag: taken met `draft` en status
  `concept-klaar`.
- **Instellingen, Agent-prompts** `/instellingen/agent-prompts` (beheerder):
  per slot de platformtekst (alleen-lezen) en de eigen tekst (leeg betekent
  platform volgen), met de voorbeelduitvoer "Zo klinkt het nu" voor
  Bouwbedrijf De Vries. Nooit instelbaar: bewijsplicht, citeerplicht,
  uitvoerformaat, taal.
- **Instellingen, Verbruik** `/instellingen/verbruik`: per soort de bundel,
  gebruikt, percentage met pil (let op vanaf 70, over vanaf 100), de
  schakelaar "Plafond actief" (standaard aan in de nieuwe tool), en de
  tabel "AI-verbruik per regel" (regel, soort, model, aanroepen, fouten,
  tokens in en uit, cache lees en schrijf, webzoekopdrachten, ≈ kosten).
  Melding per mail aan de beheerder bij 80 procent van een soort.
- **Beheer over organisaties**: pakket per organisatie (Starter, Plus,
  Compleet) en de bundel per soort (alleen superuser).

### Datamodel

```ts
agent_runs: id, organisation_id, kind, rule_id, task_id, account_id, provider, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, web_zoekopdrachten, status ('ok'|'fout'), created_at
  kind: 'inzicht-beoordeling'|'web-beoordeling'|'concept'|'lead-ronde'|'verbindingstest'
// org_settings (verborgen, niet via PUT /api/settings)
agentPrompts: { [slot]: string }
aiBundel: { plafondActief: boolean, [soort]: number }
// organisations.data.pakket: 'starter'|'plus'|'compleet'
```

Promptslots (`shared/promptSlots.ts`): Pitstop `belscript`, `mailconcept`,
`berichtconcept`, `bezoek-briefing`, `meeting-briefing`, `demo-briefing`,
`deal-voorbereiding`, `research-notitie`, `voorbereiding`; motor
`motor.inzicht.vraag` ("Beoordeel: is er volgens deze regel een commercieel
relevant inzicht?") en `motor.inzicht.stijl` (Nederlands, zakelijk; alleen
een taak voorstellen als er iets te doen valt); lead `lead.ronde.vraag`.

Pakketten: Starter `{aiInzichten: false, webBronnen: false, agentConcepten:
false, leadGenerator: false}`; Plus `{true, false, true, false}`; Compleet
alles. Standaardbundel per maand: Starter alles 0; Plus inzicht-beoordeling
8000, web 0, concept 1500, lead-ronde 0; Compleet inzicht 8000, web 3000,
concept 1500, lead-ronde 120 (de rondegrens uit prompt 6).

### Bedrijfsregels

- **AI-pass in de motor**: kandidaten uit prompt 4 (minimum cadans 7
  dagen, maximaal 25 per regel per run); materiaal zonder AI
  (`verzamelMateriaal`): citaten met bron `CRM` zoals "accountfase: B",
  "contract-einddatum: 2026-12-31, nog 42 dagen", "laatste contactmoment:
  2026-09-30", "branche: bouw", "journeyfase: Benaderd", "dossier: vacature
  servicemonteur (2026-10-01)"; leeg materiaal betekent geen aanroep;
  toolschema `geef_oordeel` (`relevant`, `confidence` 0 tot 100, `titel`,
  `body`, `commercieleHoek`, `evidence [{bron, citaat}]` minimaal 1,
  optioneel `voorgesteldeTaak {titel, actionType, executor}`;
  `additionalProperties false`; afgedwongen met `tool_choice`; `maxTokens
  1024`); validatie: alleen citaten die na `trim()` letterlijk in het
  materiaal staan tellen, zonder geldig citaat geen inzicht, confidence
  afgerond en geklemd, voorstel alleen bij `confidence ≥ 60`; opslaan met
  `relevanceScore = confidence`, `generatedBy 'ai'`, provider
  "DealDrive-AI"; "niet relevant" registreert óók een run; een fout logt
  `status 'fout'` zonder run-registratie. Mock zonder sleutel: contract
  binnen 90 dagen 80, bestelstilte boven 120 dagen 70.
- **Web-connector**: regels met `motor 'ai'`, `bron 'Extern'` en een
  specifieke bron die matcht op `vacature|indeed|jobs` (vacatures) of
  `nieuws|pers|alerts|media` (nieuws) of `website` (websitewijziging);
  Claude met `web_search` `max_uses 3`, `max_tokens 2000`; antwoord als
  JSON via hetzelfde toolschema plus `url` en `publicatiedatum` per
  bewijsstuk (DealDrive parste vrije tekst; hier afgedwongen); een
  bewijsstuk telt alleen met een URL uit de echte zoekresultaten en een
  niet-leeg citaat; ouderdom vacatures zacht 30 hard 120, nieuws zacht 90
  hard 365, website zacht 30 hard 90; boven hard schrappen, boven zacht
  geen voorstel, onbekend nooit te oud; modeldatum kale ISO, niet in de
  toekomst, maximaal 7 dagen na de paginadatum; zonder sleutel geen oordeel
  en nooit nepbronnen; `web_zoekopdrachten` gelogd.
- **Pitstop** (`bereidVoor`): concepttype per actiesoort (bellen belscript,
  mailen mailconcept, bericht berichtconcept, bezoek bezoek-briefing,
  online-meeting meeting-briefing, research research-notitie, anders
  voorbereiding; afspraak klantbezoek bezoek-briefing, demo demo-briefing,
  belafspraak belscript; deal deal-voorbereiding); prompt met een vast
  veiligheidskader ("Je voert NIETS uit", "verzin niets daarbuiten"), dan
  TAAK of AFSPRAAK, AANLEIDING, ACCOUNT, CONTACTPERSOON, WANNEER, JOURNEYFASE
  en het Pitstop-accent, BAND, BRONINZICHT (gemarkeerd als beoordeling,
  geen feit), BEKENDE FEITEN uit het materiaal, OPDRACHT (eigen regel,
  anders platform, anders standaard), "platte tekst, geen markdown";
  lengtegrenzen mail 120 woorden, bericht 60; kale tekstaanroep `maxTokens
  1024` zonder tool-use; resultaat `draft {kind, content, generatedAt}`,
  `executor 'ai-agent'`, `executorStatus 'concept-klaar'`; elke aanroep in
  `agent_runs` met `kind 'concept'`; fouten 402 (tegoed op), 503 (sleutel
  of overbelast), 502 (overig) met leesbare meldingen.
- **Automatisch voorbereiden**: regels met `autoVoorbereiden` na de
  motorrun (maximaal 10 per run) en na "Maak taak" uit een regelinzicht
  (maximaal 3 per sync-batch); idempotent bij een bestaand `draft`.
- **Promptketen**: per slot eigen organisatie, dan platform
  (`SYSTEEM_ORG_ID`), dan code; een leeggemaakte klantregel valt terug op
  het platform; het stabiele deel van de motorprompt krijgt `cache_control
  ephemeral` zodra de prefix de drempel haalt.
- **Plafond** (1.2 punt 14): geldt voor alle soorten; vóór elke aanroep
  `plafondStand(soort)`; geblokkeerd als `bundel > 0 && gebruikt ≥ bundel`;
  telling over de kalendermaand in Europe/Amsterdam met `status <> 'fout'`
  en `provider <> 'mock'`; bij 80 procent één mail per soort per maand aan
  de beheerder; de UI toont bij blokkade "Je maandbundel voor {soort} is
  op." zonder de aanroep te doen.
- **Kosten**: tarieven in USD per miljoen tokens in een tabel met
  peildatum (claude-opus-5 5/25, claude-sonnet-5 2/10, claude-haiku-4-5
  1/5; cache lezen × 0,1, schrijven × 1,25; websearch 10 dollar per 1000);
  schattingsmodel claude-sonnet-5; retentie van `agent_runs` 13 maanden via
  een sweep, instelbaar met `AI_LOGBOEK_RETENTIE_DAGEN` (minimaal 30).
- **Providerlaag**: `LLM_PROVIDER=mock|anthropic`, model standaard
  `claude-sonnet-5`, geen `temperature`, AI buiten de databasetransactie
  (kandidaten in tx, beoordelen zonder tx, wegschrijven in een korte tx).

### Endpoints

```
POST /api/agent/prepare           {taskId}
POST /api/agent/prepare-afspraak  {appointmentId}
POST /api/agent/prepare-deal      {dealId}
GET  /api/agent/kosten            beheerder
GET  /api/ai/verbruik             beheerder
PUT  /api/superuser/organisations/:id/pakket, PUT .../bundel
GET  /api/agent-prompts, PUT /api/agent-prompts/:slot   beheerder (eigen laag); platformlaag alleen superuser
POST /api/motor/logboek-sweep     x-motor-secret
```

### AI-stappen

Alles hierboven. Modelkeuze: `claude-sonnet-5` voor beoordeling en
concepten; Opus alleen als een organisatie het expliciet instelt.

### Wat je hergebruikt uit DealDrive

`server/utils/aiInsight.ts`, `webBron.ts`, `agentExecutor.ts`,
`autoVoorbereiding.ts`, `promptBibliotheek.ts`, `promptStandaarden.ts`,
`llm-provider.ts`, `llmInstellingen.ts`, `aiVerbruik.ts`, `pakketten.ts`,
`shared/promptSlots.ts`, `shared/aiBundel.ts`, `server/api/agent/*`,
`app/pages/instellingen/verbruik.vue`, `app/pages/admin/prompts.vue` (als
basis voor agent-prompts), het Pitstop-blok uit `TaakFlyout.vue` 117 tot
164, `server/db/e2e-promptketen.ts`, `npm run test:prompts` (golden
masters).

### Wat je anders doet dan DealDrive

1.2 punt 14; web-antwoord via een afgedwongen schema; BAND en journeyfase
in de Pitstop-prompt; plafond standaard aan; één kostentabel met peildatum;
geen Dex-agents.

### Acceptatiecriteria

- `e2e-promptketen` en de golden masters groen; databasevrije suite
  `e2e-ai`: validatie van citaten, drempel 60, ouderdomsgrenzen,
  schemafouten, plafondstand.
- Wegwerp-DB met mock-provider: motorrun met AI-regel levert een inzicht
  met bewijs; met een lege bundel levert hij niets en registreert hij geen
  run; Pitstop op een taak zet `concept-klaar`; goedkeuren zet
  `goedgekeurd`; niets verstuurt iets.
- Eén echte run tegen Claude met een testsleutel (handmatig, gelogd in het
  handboek met tokens en kosten).

### Buiten scope

AI-chat, documenten bevragen, verslaganalyse, een leerlus op afwijzingen,
Microsoft of Google als provider.

---

# Deel C: bijlagen

## 13. Bronbestanden in DealDrive per onderwerp

Alle paden onder `C:\Projecten\dealdrive`. Regelnummers gelden voor commit
1c314ec.

### Fundament

| Onderwerp | Bestand |
|---|---|
| Opslaglaag | `server/utils/appStore.ts` 46 tot 209 (kolomafleiding), 223 tot 238 (`withOrgContext`), 279 tot 320 (upsert) |
| RLS | `server/db/rls.sql` 31, 63 (rollen), 81 tot 110 (policies), 134 tot 173 (open tabellen) |
| Sync | `server/api/sync/mutations.post.ts` 93 tot 128 (rechten en versie), 174 tot 192 (audit), 209 tot 251 (nabewerking) |
| Rechten | `server/utils/permissions.ts` 37 tot 140; `app/composables/usePermissions.ts`; `shared/syncTabellen.ts` |
| Sessie | `server/middleware/session.ts` 115 tot 147; `server/utils/session.ts` 54 tot 63 (`requireAdmin`) |
| Instellingen | `shared/settingKeys.ts` 20 tot 41; `server/api/settings/[key].put.ts` 19 tot 31 |
| Datum | `shared/datum.ts` 83 tot 91 (`heeftTijd`), 113 tot 121 (`volgendWerkmoment`) |
| Huisstijl | `app/assets/css/tokens.css`; `.stylelintrc`; `app/components/LegeStaat.vue`, `ConfirmDialog.vue`; `app/composables/useFlyoutA11y.ts` |

### Accounts en contacten

| Onderwerp | Bestand |
|---|---|
| Schema | `server/db/schema-app.ts` 55 tot 91 (accounts), 121 tot 135 (contacts), 543 tot 565 (communications), 614 tot 624 (segments) |
| Types | `app/types/entities.ts` 258 tot 408 (Account), 424 tot 464 (Contact), 1384 tot 1409 (SegmentDefinition) |
| Accounttype | `app/composables/useMockData.ts` 3004 tot 3018; `shared/ritmematrix.ts` 182 tot 191 |
| Klasse | `app/composables/useAccountfases.ts` 17 tot 38; `server/utils/orgStarter.ts` 24 tot 32 |
| Lijsten | `app/pages/klanten/alle.vue`, `app/pages/prospects/alle.vue` 531 tot 580 (contextmenu), `app/pages/contacten/alle.vue` 305 tot 385 |
| Rangscores | `app/pages/klanten/index.vue` 97 tot 124; `app/pages/prospects/index.vue` 102 tot 127 |
| Kaart | `app/pages/accounts/[id]/index.vue` 11 tot 290 (kop en stats), 1255 tot 1296 (tabs) |
| Info-flyouts | `app/components/InfoFlyout.vue` 21 tot 265, 430 tot 496; `ContactInfoFlyout.vue` 21 tot 190, 290 tot 307 |
| Logo | `app/composables/useAccountLogo.ts` 22 tot 39; `app/components/AccountLogo.vue` 68 tot 87 |
| Dekking | `app/composables/useDekkingBuckets.ts` 26 tot 95 |
| Contactmomenten | `app/composables/useBriefingSoort.ts` 79 tot 130; `useContactmomenten.ts` 17 tot 27; `useOptimisticWrite.ts` 301 tot 308 |
| Import | `app/pages/import.vue` 448 tot 455 (stappen), 561 tot 660 (CSV), 811 tot 865 (koppelen), 882 tot 1053 (dedupe), 1384 tot 1479 (samenvoegen), 1565 tot 1617 (contacten) |
| Eigen velden | `app/composables/useCustomFields.ts` 22 tot 191; `app/pages/instellingen/custom-fields.vue` |
| Segmenten | `app/composables/useSegments.ts` 227 tot 253; `app/components/SegmentBeheer.vue` |
| Gebieden | `shared/gebieden.ts` 22 tot 126; `server/api/gebieden/analyse.get.ts`; `app/pages/instellingen/gebieden.vue` 504 tot 560 |
| Zoeken | `app/composables/useGlobaleZoek.ts` 19 tot 21, 135 tot 156, 210 tot 271; `app/components/GlobaleZoek.vue` |

### Prospect journey

| Onderwerp | Bestand |
|---|---|
| Engine | `server/utils/journeyEngine.ts` 30 tot 38 (catalogus), 46 tot 53 (overgang), 71 tot 77 (instap), 84 tot 146 (doorschuiven en audit) |
| Endpoint | `server/api/journey/event.post.ts` |
| Client | `app/composables/useCustomerJourney.ts` 14 tot 79; `app/pages/instellingen/customer-journey.vue` 88 tot 198 |
| Starterset | `server/utils/orgStarter.ts` 38 tot 56 |
| Aanroepers | `app/composables/useDealStageChange.ts` 84 tot 89; `app/components/NieuweAfspraakFlyout.vue` 676 tot 684 |

### Motor en regels

| Onderwerp | Bestand |
|---|---|
| Motor | `server/utils/ruleEngine.ts` 87 tot 99 (constanten), 164 tot 188 (cadans en prio), 297 tot 303 (targeting), 313 tot 380 (velden en patronen), 389 tot 423 (actiesoort), 445 tot 504 (ritmekeuze en werkdagen), 507 tot 534 (sjabloon en type), 540 tot 673 (generate), 697 tot 877 (runsleutel, cadans, owner), 990 tot 1076 (logAgentRun), 1215 tot 1975 (run), 1984 tot 2051 (gebeurtenissen) |
| Opslag | `server/utils/activityRulesStore.ts` 16 tot 77 |
| Regeltype | `app/composables/useActivitySellingRules.ts` 53 tot 189, 447 tot 589 (standaardset), 611 tot 721 (opslaan), 841 tot 871 (`normaliseRule`) |
| Editor | `app/pages/instellingen/activity-selling.vue` 509 tot 595, 993 tot 1079, 1205 tot 1407 |
| Nieuwe regel | `app/components/NieuweActiviteitFlyout.vue` 187 tot 286 |
| Excel | `shared/activitySellingKolommen.ts` 39 tot 108, 167 tot 359; `shared/activitySellingExcel.ts` 86 tot 87, 150 tot 255; `server/utils/activitySellingWerkmap.ts`; `app/components/RegelsImportFlyout.vue` |
| Starterregels | `server/utils/orgStarter.ts` 85 tot 228 |
| Ritmematrix | `shared/ritmematrix.ts` 20 tot 45, 56 tot 84, 94 tot 137, 165 tot 191; `app/pages/instellingen/accountritme.vue` |
| Planning | `netlify/functions/motor-schedule.mts`; `server/api/motor/run-all.post.ts` 32 tot 75; `app/plugins/motorPoll.client.ts` |

### Taken en inzichten

| Onderwerp | Bestand |
|---|---|
| Schema | `server/db/schema-app.ts` 137 tot 196 (signals, tasks), 728 tot 757 (rule_runs), 788 tot 857 (agent_runs) |
| Types | `app/types/entities.ts` 470 tot 551 (Signal), 557 tot 674 (Task) |
| Schrijven | `app/composables/useOptimisticWrite.ts` 218 tot 308 (snooze, afronden, contactmoment), 351 tot 455 (taak), 888 tot 936 (ack), 1130 tot 1241 (afspraak en agenda-gat) |
| Flyouts | `app/components/InzichtFlyout.vue` 207 tot 252, 394 tot 457, 513 tot 605; `TaakFlyout.vue` 117 tot 164, 549 tot 568, 743 tot 782, 1000 tot 1023; `NieuweTaakFlyout.vue` 166 tot 197, 520 tot 561, 615 tot 656, 703 tot 711 |
| Vandaag | `app/pages/index.vue` 61 tot 75, 334 tot 424, 485 tot 539; `app/components/VandaagPanel.vue` 262 tot 301; `app/composables/useVandaagItems.ts` 35 tot 61, 83 tot 100, 129 tot 158, 198 tot 224 |
| Taken | `app/pages/taken.vue` 729 tot 782, 890 tot 922, 1027 tot 1093, 1146 tot 1157, 1198 tot 1274 |
| Inzichten | `app/pages/inzichten.vue` 64 tot 183, 333 tot 403, 454 tot 525, 640 tot 721; `app/composables/useHeroInzicht.ts` 30 tot 84 |
| Herinneringen | `app/composables/useReminderEngine.ts` 33 tot 112; `server/utils/reminderSweep.ts` 119 tot 165; `server/utils/overzichtSweep.ts` 46, 263 tot 293, 529 tot 584 |
| Periodes | `shared/periodeFilter.ts` 17 tot 24, 85 tot 118 |

### Fase 1

| Onderwerp | Bestand |
|---|---|
| Leadgenerator | `shared/leadGenerator.ts` 9 tot 22, 46 tot 85, 89 tot 184, 200 tot 210, 238 tot 289, 299 tot 406; `app/composables/useLeadGenerator.ts`; `app/pages/generator.vue` 9 tot 246, 300, 367 tot 435; `server/db/e2e-leadgenerator.ts` |
| Webzoeker | `server/utils/webBron.ts` 39 tot 46, 77 tot 87, 163 tot 173, 180 tot 208, 255 tot 262, 282 tot 285, 301 tot 325, 344 tot 416 |
| BAND | `shared/bandKwalificatie.ts` 31, 51 tot 69, 82 tot 113, 132 tot 162; `app/components/BandBadge.vue`; `NieuweDealFlyout.vue` 227 tot 241; `DealFlyout.vue` 84 tot 97 |
| Grades | `app/composables/useProspectGrade.ts` 9 tot 41; `useKlantGrade.ts` 27 tot 38 |

### Fase 2

| Onderwerp | Bestand |
|---|---|
| Jaarplanning | `app/pages/prospectplanning.vue` 5 tot 264, 286 tot 297, 406 tot 453, 501 tot 655; `app/composables/useOmzetpotentie.ts` 47 tot 164 |
| Belblokken | `shared/belblokken.ts` 14 tot 103, 171 tot 196, 249 tot 281; `app/composables/useBellijst.ts` 17 tot 27, 86 tot 174; `app/pages/belblokken.vue` 586 tot 608, 845 tot 930; `server/utils/belblokVuller.ts` 60 tot 236; `server/api/mij/belblokken.put.ts` |

### Fase 3

| Onderwerp | Bestand |
|---|---|
| Pipeline | `app/pages/pipeline.vue` 15 tot 166, 252, 314 tot 316, 552 tot 588, 652 tot 665, 737 tot 740 |
| Deals | `app/types/entities.ts` 695 tot 744; `app/components/DealFlyout.vue` 16 tot 274, 408 tot 497, 581 tot 604; `NieuweDealFlyout.vue` 319 tot 356, 510 tot 576 |
| Fases en pipelines | `app/composables/useDealStages.ts` 15 tot 43, 107 tot 171; `usePipelines.ts` 14 tot 60; `useDealStageChange.ts` |
| Offertes | `app/types/entities.ts` 750 tot 780; `app/pages/offertes.vue` 163 tot 175, 297 tot 351; `shared/offerteStatus.ts` |
| Offertematrix | `shared/offerteOpvolging.ts` 37 tot 109, 180 tot 258, 294 tot 322, 362 tot 378, 418 tot 421; `app/pages/instellingen/accountritme.vue` 272 tot 397 |
| Motor | `server/utils/ruleEngine.ts` 1510 tot 1706 (offerte), 1708 tot 1878 (BAND) |

### Campagnes

| Onderwerp | Bestand |
|---|---|
| Soorten | `shared/campagneSoorten.ts` 22 tot 142 |
| Types | `app/types/entities.ts` 1191 tot 1276 |
| Schema | `server/db/schema-app.ts` 241 tot 261 |
| Lijst en bord | `app/pages/campagnes/index.vue` 14 tot 157, 195 tot 257; `app/pages/campagnes/[id].vue` 4 tot 233, 297 tot 339, 362 tot 370, 430 tot 602 |
| Flyouts | `app/components/NieuweCampagneFlyout.vue` 9 tot 179, 288 tot 311; `CampagneFlyout.vue` 25 tot 120, 167, 400 tot 425; `CampagneAccountsFlyout.vue` 110 tot 125; `CampagneVoortgangFlyout.vue` |
| Tempo | `app/composables/useCampagneTempo.ts` 38 tot 89; `server/utils/campagneTempo.ts` 33 tot 67 |
| Advies en afsluiter | `server/utils/campagneAdvies.ts` 28 tot 36, 62 tot 119; `shared/campagneAdvies.ts` 10 tot 38; `server/utils/campagneAfsluiter.ts` 40 tot 74 |
| Motor | `server/utils/ruleEngine.ts` 1389 tot 1508 |
| Schrijven | `app/composables/useOptimisticWrite.ts` 1356 tot 1430, 1591 tot 1609 |

### AI-lagen

| Onderwerp | Bestand |
|---|---|
| Beoordeling | `server/utils/aiInsight.ts` 45, 90 tot 139, 143 tot 181, 202 tot 252, 260 tot 294, 308 tot 326 |
| Pitstop | `server/utils/agentExecutor.ts` 42 tot 79, 108 tot 152, 206 tot 277, 346 tot 360, 472 tot 555; `server/utils/autoVoorbereiding.ts` 33 tot 41, 115 tot 157 |
| Promptketen | `server/utils/promptBibliotheek.ts` 143 tot 186; `shared/promptSlots.ts` 14 tot 125 |
| Verbruik | `server/utils/aiVerbruik.ts` 95 tot 117, 238 tot 255; `shared/aiBundel.ts` 114 tot 179; `server/api/agent/kosten.get.ts` 40 tot 106 |
| Pakketten | `server/utils/pakketten.ts` 29 tot 61 |
| Provider | `server/utils/llm-provider.ts` 1494 tot 1508 |

## 14. Bekende gaten in DealDrive die je hier meteen goed doet

Samenvatting van wat het onderzoek vond, met de prompt waarin het opgelost
wordt.

| # | Gat in DealDrive | Prompt |
|---|---|---|
| 1 | Gewonnen deal maakt prospect niet klant; promoveren is handmatig | 3, 8 |
| 2 | `tier` naast `accountfase`; leadgenerator schrijft `tier`, de rest leest `accountfase`; klasse D krijgt geen tier | 2, 6 |
| 3 | `eerste-afspraak-gepland` vuurt bij elke afspraak | 3, 8 |
| 4 | Leadgenerator zonder server, webzoeker, leadstabel of bundelmeting; "Opnieuw uitzoeken" en "Toch uitzoeken" uitgeschakeld | 6 |
| 5 | Journey-starterset is een klantjourney; `eerste-order`, `contract-getekend`, `contract-verlengd` en `handmatig` worden nergens gemeld; geen handmatige correctie | 3 |
| 6 | Motor filtert niet op accounttype; `levensfase`, `klantType`, `eigenaar`, `triggerType`, `verwachteUitkomst` en `kpi` sturen niets | 4 |
| 7 | Editor mist `taakSjabloon`, `signalTypes`, `status`; `normaliseRule` laat `omschrijving` en `status` vallen | 4 |
| 8 | Standaardset van 37 regels zonder trigger; geen belritmeregel dus de prospect-belmatrix doet niets; meetingrij dood | 4, 7 |
| 9 | Eigenaar alleen via script te zetten; geen eigenaarsfilter | 2 |
| 10 | Accountverwijdering wist contacten alleen lokaal; verwijderknoppen zonder rolcontrole; inline chips wissen met `undefined` | 2 |
| 11 | Afronden registreert een contactmoment op één pad maar niet in de bewerkmodus of via Dex; to-do telt wel voor `lastInteractionAt` maar niet als KPI | 5 |
| 12 | Herhaalde taken en Dex-taken erven `sourceSignalId`, `ruleId`, `actionType`, `executor` niet | 5 |
| 13 | `createCampaign` laat `varianten` vallen; handmatig actief zet geen `startedAt`; tempo client en server verschillen | 9 |
| 14 | AI-plafond standaard uit, alleen op de motor, geen 80-procentmelding | 10 |
| 15 | Werkdagen zonder feestdagen | 1, 8 |
| 16 | Dubbele definities: twee journey-seeds (8 en 5 fases), vier kopieën van de offertestatus-labels, twee tempoformules | 3, 8, 9 |
| 17 | Geen schrijfpad voor de offertestatus; upload maakt geen `Quote` | 8 |
| 18 | Jaarplanning slaat niets op, heeft geen motorregel, vaste startmaand, "benaderd" niet begrensd op het jaar | 7 |
| 19 | Web-beoordeling parst vrije tekst zonder schema; alleen URL en datum gevalideerd | 10 |
| 20 | Inactiviteitsregel vuurt nooit voor een account zonder datum (nieuwe prospects) | 4 |
| 21 | HubSpot-endpoints zonder sessiecontrole, state in het geheugen, schrijft niets | niet overgenomen |
| 22 | `executorStatus` met vier dode waarden en `executor 'cowork'` nergens gezet | 5 |
| 23 | Bij een lege servertabel blijft demodata in de client | 2 |
| 24 | Motorprompt zet wél een cache-markering terwijl het handboek het tegendeel zegt | 10 (handboek klopt vanaf dag één) |

## 15. Woordenlijst

- **Account**: één record voor prospect én klant; het type staat in
  `accountKind`.
- **Accountklasse** (`accountfase`): A tot D naar omvang, instelbaar per
  organisatie; stuurt de ritmematrices en de regels.
- **Activity selling-regel**: een regel in de motor met een triggerpatroon,
  cadans, targeting en een gevolg (inzicht of taak).
- **BAND**: Behoefte, Autoriteit, Noodzaak, Draagvlak; de kwalificatie in
  vier zinnen; score 0 tot 4.
- **Belmatrix, afspraakmatrix, offertematrix**: ritme per accounttype en
  klasse (bellen), per soort en klasse (meeting, bezoek), en per
  orderwaarde (kanaal, rol, werkdagen).
- **Bewijs**: een citaat met bron, datum en eventueel URL dat een inzicht
  draagt; zonder bewijs geen inzicht.
- **Cadans**: hoe vaak een regel per onderwerp mag vuren; bewaakt via
  `rule_runs`.
- **Campagne**: gerichte actie op een doelgroep met een bord (Gespot, Open,
  Bezig, Klaar), een meetbaar doel en een tempo-oordeel.
- **Dossier**: het bewijs per criterium van een lead; verloopt na 30
  dagen.
- **Gebeurtenis**: een vaste naam uit de journeycatalogus die een overgang
  en gebeurtenisregels kan afvuren.
- **Hoofdfase**: pre-data, prospect, verbinding, klant, verloren; de
  groepering van de journeyfases en de drie fases van het proces.
- **Inzicht** (signal): een waarneming met bewijs en relevantie die de
  verkoper goedkeurt tot een taak.
- **Jaarplanning**: benadervensters per omzetpotentie (groot, middelgroot,
  klein) over het verkoopjaar.
- **Motor**: de run per uur en per gebeurtenis over alle regels en
  accounts.
- **Pitstop**: het AI-concept (belscript, mailconcept, briefing) dat op een
  taak, afspraak of deal klaarstaat tot de verkoper het goedkeurt.
- **Prospect journey**: de fases en overgangen van gevonden tot klant.
- **Stuurvelden**: `lastInteractionAt`, `lastCallAt`, `lastVisitAt`,
  `contractEndDate`, `lastOrderDate`; de datums waar de motor op rekent.
- **Vandaag**: het startscherm met taken, afspraken en prio van de dag.
