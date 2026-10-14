# P13: Agenda, meetingsoorten, agendakoppeling

| Onderdeel | Waarde |
|---|---|
| Sprint | 8 |
| Features | F09 Agenda, afspraken en meetings |
| Hangt af van | P01 (fundament, teams, functiecatalogus), P27 (mobiele schil, schuifvensters), P03 (accounts, contacten, buying committee), P05 (prospectreis en meldpunt voor gebeurtenissen), P06 (motor, afspraakmatrix), P07 (taken, `rondTaakAf`, Vandaag), P08 (Bewaker, Planner), P10 (belblokken, "agenda bezet"), P18 volgt later voor de Pitstop |
| Bron in het bouwplan | F09, 12 (rij Agenda), 3.2 (teams), 7.1 tot en met 7.3, 13.3 (flow 3), F05 (gebeurtenissen), F16 (afspraakmatrix), 8.3, 8.8, Bijlage A regels 3, 32, 33, 37 |

## Lees eerst

- `Bouwplan-Dealtrace.md`: 2.2, 2.3, 3.2, 3.3 (rij Afspraken), 4.3 (rij F09), 5.1 en 5.2, 6.1, 7.1 tot en met 7.3, 8.2 tot en met 8.5 (vooral 8.5.3), 8.8, F05 (overgangen en melders), F06 (`rondTaakAf`), F09 volledig, F16 (afspraakmatrix), F22 (Meetingsoorten en uitkomsten, Mijn instellingen), 10.2 (rijen `appointments`, `meetingsoorten`), 12 (rij Agenda), 13.3, 15.3, 19, Bijlage A, Bijlage B (rij Agenda en meetings).
- DealDrive op commit 75bee61: `app/pages/agenda.vue`, `app/pages/meetings.vue`, `app/components/AfspraakFlyout.vue`, `app/components/NieuweAfspraakFlyout.vue`, `app/components/AfspraakAnalyseFlyout.vue`, `app/composables/useAfspraakDetail.ts`, `app/composables/useNieuweAfspraak.ts`, `app/composables/useMeetingVoorstellen.ts`, `server/utils/calendarSync.ts`, `server/utils/calendarProviders.ts`, `server/utils/calendarCrypto.ts`.

## Deel 1: Functioneel (wat en waarom)

### Wat je bouwt

Je bouwt de agenda met afspraken van een vaste meetingsoort die na afloop met één uitkomst de reis, de deal en de volgende stap bijwerken, met de lijst "Wie is er aan de beurt?" en een agendakoppeling met Microsoft 365 en Google.

### Waarom

Voor new business is de eerste afspraak het belangrijkste moment: die zet de status op gescoord en de fase op "Eerste afspraak" (F09). In DealDrive vuurde `eerste-afspraak-gepland` bij elke afspraak (Bijlage A regel 3), bleef een bezoektaak open na het plannen (regel 32), vielen prospects zonder historie of klasse uit "Wie is er aan de beurt?" (regel 33) en deed de vlag "agenda bezet" niets (regel 37). De binnendienst plant afspraken voor de buitendienst (13.3 flow 3); dat kan alleen als de agenda van de collega en zijn regiodag zichtbaar zijn.

### Gebruikers en niveaus

| Rol | Niveau | Wat |
|---|---|---|
| Accountmanager | Beginner | Agenda (dag, week), afspraak plannen met meetingsoort, uitkomst vastleggen na afloop, standaardherinnering |
| Accountmanager | Gevorderd | Plus "Wie is er aan de beurt?" met vormadvies, herhaling, collega's uitnodigen, afspraak plannen voor een collega (binnendienst voor buitendienst), verslag uploaden, agendakoppeling (als de beheerder hem inschakelt), weekritme (4.3) |
| Accountmanager | Expert | Plus eigen agenda-indeling en sjablonen, weekritme per meetingsoort, meeting-analyse |
| Salesmanager | rol | Afspraken van zijn teams lezen en schrijven (3.3) |
| Beheerder | rol | Meetingsoorten en uitkomsten beheren (F22), agendakoppeling inschakelen voor de organisatie |

Let op: 4.3 zet het weekritme bij Gevorderd, de tabel in F09 bij Expert ("weekritme per meetingsoort"). Niet vastgelegd in het bouwplan; voorstel: het weekritme (algemeen overzicht) vanaf Gevorderd, het weekritme per meetingsoort vanaf Expert.

### Schermen

**`/agenda`** (zijbalk Start, alle niveaus), van boven naar beneden:

1. Paginakop met kicker, titel als zin over de stand en de knoppen "+ Afspraak" (geel), "Weergave" (Dag, Week, Maand), "Filters", "Hulp". Niet vastgelegd in het bouwplan; voorstel titel: "Deze week 6 afspraken, waarvan 2 eerste gesprekken."
2. Agendaraster met afspraken (kleur per meetingsoort), belblokken (F07), regiodagen (F18) als band over de dag, en conflicten (overlap) met een rode rand.
3. Afspraken die de binnendienst voor jou plande dragen het label "Gepland door Sanne".
4. Lege staat: Niet vastgelegd in het bouwplan; voorstel: "Geen afspraken in deze periode." en bij een filter "Toon alles".

**`/agenda?weergave=meetings`** ("Wie moet ik spreken", Gevorderd): lijst "Wie is er aan de beurt?" met maximaal acht voorstellen. Per voorstel account, reden, vormadvies ("Belafspraak", "Online", "Fysiek · dinsdag Regio Oost", "Taak in belblok") en één knop. Bronnen: belmatrix, afspraakmatrix met regiodag, offerte-opvolging, en voor new business "Eerste gesprek nog niet ingepland" (prospect met contact en positieve uitkomst maar zonder afspraak) en "No-show opnieuw inplannen". Prospects zonder historie of klasse doen mee (regel 33). Lege staat (voorstel): "Niemand is nu aan de beurt. De motor zet nieuwe voorstellen klaar zodra een ritme verloopt."

**Flyout "Plan een afspraak"** (overal dezelfde; op de telefoon als schuifvenster van onderen):

| Veld | Regel |
|---|---|
| Klant | verplicht |
| Contactpersoon | beslissers eerst |
| Meetingsoort | verplicht; vult titel, duur en agenda |
| Vorm | Bezoek, Online, Telefoon |
| Datum, Start, Duur | duur uit de soort |
| Voor wie | jij of een collega; bij een collega de vrije momenten en de regiodag van die collega |
| Locatie of meetinglink | adres van het account voorgevuld bij bezoek; Teams of Google Meet via de agendakoppeling |
| Herinnering | standaard per soort, bijvoorbeeld 15 minuten bij een belafspraak |
| Aanleiding, Beschrijving | vrij |

Knop "Plan afspraak". Na opslaan: toast, de afspraakflyout opent, gebeurtenis `eerste-afspraak-gepland` als het de eerste is, en de taak waaruit je plande wordt aan de afspraak gekoppeld en bij afronden gesloten. Toasttekst: Niet vastgelegd in het bouwplan; voorstel: "Afspraak gepland met Bakker Bouw, dinsdag 21 oktober 10:00."

**Afspraakflyout**: kicker met soort en status ("KENNISMAKING · GEPLAND"), wanneer, wie, locatie of link, "Klant in context", "Wie zit erbij" (buying committee), "Doel en agenda" (agendapunten van de soort), "Pitstop" (wordt gevuld in P18; tot dan de lege staat "Pitstop volgt"), "Verslag". Na afloop de gele knop **"Rond af"**. Op de telefoon onderaan de plakkende actiebalk "Bellen", "Mail", "WhatsApp", "Navigeer" (8.3); een knop zonder gegevens is uitgegrijsd met reden ("Geen mobiel nummer bekend").

**Venster "Rond af"**: uitkomst (knoppen van de soort, uitkomstraster van 56 px), verslag (typen, plakken, inspreken of bestand), per agendapunt "besproken" of "niet besproken" (voorgevuld door de Notulist zodra P19 er is; tot dan leeg), volgende stap (voorgesteld uit het gevolg van de uitkomst). Eén handeling zet status, stuurvelden, gevolg, verslag en taken. Voor vorm bezoek op de telefoon gebruikt P30 hetzelfde venster in de opbouw van 8.5.3.

**Instellingen, Verkoop, Meetingsoorten en uitkomsten** (beheerder, F22): lijst van soorten met naam, type (klant of intern), duur, vorm, doel, standaardlocatie, agendapunten (met verplicht), voorbereiding en uitkomsten met gevolg.

**Mijn instellingen** (iedereen): "Gekoppelde agenda" met "Koppel Microsoft 365" en "Koppel Google", status en "Ontkoppel".

**Telefoon (390 px).** Agenda staat onder "Meer" (8.4). De dagweergave is de standaard op de telefoon (voorstel; niet vastgelegd). De afspraak opent als schuifvenster tot 92 procent hoogte met de plakkende knoppenrij (8.3).

### Klikpaden

1. Afspraak plannen vanuit een taak (Beginner): taak openen, "+ Afspraak" (1), meetingsoort kiezen (2), datum en start (3), "Plan afspraak" (4). De afspraak staat in de agenda, de taak is gekoppeld; bij de eerste afspraak gaat de status naar gescoord en de fase naar "Eerste afspraak".
2. Afspraak voor een collega (binnendienst, Gevorderd): in de belmodus of taakflyout uitkomst "Gesproken, afspraak" (1); de flyout opent met "Voor wie" op de buitendienstcollega van de regio (gekoppelde teams, 3.2) en toont diens vrije momenten en regiodag (2); moment kiezen (3); "Plan afspraak" (4). De afspraak staat in diens agenda met briefing; hij krijgt de melding "afspraak gemaakt door een collega voor jou" (F24).
3. Afronden (Beginner): afspraakflyout, "Rond af" (1), uitkomst "vervolg-inventarisatie" (2), verslag typen, "Bewaar" (3). Er staat een nieuwe afspraak Inventarisatie binnen 14 dagen klaar als voorstel.
4. Agenda koppelen (Gevorderd): Mijn instellingen, "Gekoppelde agenda" (1), "Koppel Microsoft 365" (2), toestemming bij Microsoft, terug in Dealtrace met toast (voorstel) "Agenda gekoppeld."

### Uitkomsten met gevolg (startset)

| Soort | Uitkomsten (code: gevolg) |
|---|---|
| Kennismaking (30 min, online of bezoek; agenda: aanleiding, situatie, behoefte, vervolg) | `vervolg-inventarisatie`: nieuwe afspraak Inventarisatie binnen 14 dagen · `offerte-aanvraag`: deal in fase Behoefte · `later`: wachtend tot datum · `geen-match`: nee met reden |
| Inventarisatie (60 min, bezoek) | `offerte`: deal naar Voorstel en taak "Offerte maken" · `demo`: afspraak Demo · `geen-vervolg`: nee met reden |
| Offertebespreking (45 min) | `akkoord`: deal gewonnen · `aanpassen`: taak "Offerte aanpassen" · `bedenktijd`: belafspraak over 5 werkdagen · `afgewezen`: deal verloren met reden |
| Demo (45 min), Belafspraak (15 min), Terugbelafspraak (10 min) | Niet vastgelegd in het bouwplan; voorstel: Demo als Inventarisatie (`offerte`, `geen-vervolg`); Belafspraak en Terugbelafspraak de belpoging-uitkomsten uit 7.3 |
| Weekoverleg new business (intern, 30 min) | geen klantuitkomst; telt nooit als klantcontact |

"Nee met reden" vraagt een reden uit de vaste lijst van 7.2 en zet de afkoelperiode per kanaal; de terugkomregel volgt 7.3. Deals ontstaan hier als stub met fase; de volledige dealfunctie bouwt P17.

### Filters en sorteren

- Agenda: Weergave (Dag, Week, Maand) in de URL (`?weergave=week&datum=2026-10-20`); filter Gebruiker (eigen standaard; salesmanager: teamleden), Meetingsoort, Vorm.
- Wie is er aan de beurt: sortering op reden en daarna op dagen achter; geen vrije sortering (voorstel).

### Regels

- "Eerste afspraak" is alleen de eerste niet-geannuleerde afspraak met dat account (regel 3).
- Een afspraak met status "niet verschenen" of "geannuleerd" geeft een inzicht "Gat in je agenda" met drie vervangende kansen; de kansen levert P14.
- Intern overleg telt nooit als klantcontact.
- De taak waaruit je plant, wordt gekoppeld en sluit bij afronden (regel 32).
- "Agenda bezet" uit de koppeling telt mee in vrije momenten, in belblokadviezen en in de vuller (regel 37, samen met P10).
- Statussen van een afspraak: "gepland" staat in het bouwplan (kicker), "niet verschenen" en "geannuleerd" ook (regel F09). Niet vastgelegd in het bouwplan; voorstel volledige lijst: `gepland`, `afgerond`, `niet_verschenen`, `geannuleerd`.
- Herinnering standaard per soort; meldingen volgen stille uren (8.10).

### Helpartikelen

- "Een afspraak plannen en afronden" (leerpad Beginner, F21): plannen met meetingsoort, uitkomst kiezen, wat het gevolg doet.
- "Agenda en meetingsoorten" en "Koppelingen" (inrichten). Niet vastgelegd in het bouwplan als titel; voorstel: "Meetingsoorten en uitkomsten inrichten" voor de beheerder.
- New business: "Om de afspraak vragen", "Inventariseren en doorvragen", "Het eerste bezoek" (F21).

## Deel 2: Technisch (hoe)

### Datamodel

```ts
appointments: id, organisation_id, owner_id, gepland_door, account_id, contact_id?, meetingsoort_id, vorm,
              status, start_at, end_at, uitkomst_code, uitkomst_op, task_id?, data jsonb
  data: agenda[], verslag {tekst, bron, perAgendapunt[], openVragen[], voorgesteldeUitkomst},
        herinnering, externalIds {google?, outlook?}, meetinglink?, aanleiding?, beschrijving?
meetingsoorten: id, organisation_id, slug, naam, type ('klant'|'intern'), duur_min, vorm, versie?, data jsonb
  data: doel, standaardLocatie, agenda [{punt, verplicht}], voorbereiding[],
        uitkomsten [{code, label, gevolg {type, meetingsoortId?, termijnDagen?, faseId?, dealFase?}}]
agenda_koppelingen (voorstel, niet vastgelegd): id, organisation_id, gebruiker_id, provider ('microsoft'|'google'),
              tokens (AES-256-GCM, eigen geheim), status, laatste_sync, data jsonb
```

- Kolommen `task_id` en `contact_id` op `appointments` zijn niet vastgelegd in hoofdstuk 10; voorstel: als kolom, omdat erop gejoind wordt (10.1).
- Migratie: tabellen `appointments` en `meetingsoorten` plus seed van zeven meetingsoorten per organisatie (startset, F23).
- RLS: `org_isolation` op alle drie tabellen; `agenda_koppelingen` daarnaast alleen leesbaar voor de eigen gebruiker.
- Rechtenmatrix (3.3, Afspraken): accountmanager lezen alles, schrijven alles, verwijderen eigen; salesmanager alles in team; beheerder alles; founder alleen na instappen. Meetingsoorten schrijven: beheerder.
- Sync-allowlist: `appointments` (schrijven), `meetingsoorten` (alleen lezen, in het dagpakket, 8.8). Offline-mutatiesoorten: nieuwe afspraak via de gewone sync op `appointments`; afronden van een bezoek is `bezoek.afronden` (P30). Niet vastgelegd in het bouwplan; voorstel: `afspraak.afronden` voor afspraken met vorm online of telefoon, met dezelfde idempotentiesleutel.

### Pure functies

| Functie | Invoer | Uitvoer | Randgevallen | Tests |
|---|---|---|---|---|
| `meetingUitkomst(afspraak, soort, code)` | afspraak, meetingsoort, uitkomstcode | lijst mutaties (afspraak, deal, taak, gebeurtenis, status) | onbekende code; soort zonder uitkomsten; intern overleg | elke startcode uit de tabel geeft het juiste gevolg; `bedenktijd` telt 5 werkdagen met feestdagen (`shared/datum.ts`) |
| `isEersteAfspraak(afspraken, accountId, afspraakId)` (voorstel) | alle afspraken van het account | boolean | eerste geannuleerd; twee op dezelfde dag; account wordt opnieuw prospect | tweede afspraak geeft false |
| `aanDeBeurt(accounts, matrices, afspraken, uitkomsten, nu)` (voorstel) | stand van ritmes en uitkomsten | maximaal 8 voorstellen met reden en vormadvies | account zonder klasse of historie doet mee | regel 33 |
| `vormAdvies(account, gebruiker, regiodagen, nu)` (voorstel) | account, werkplek, regiodagen | "Belafspraak", "Online", "Fysiek · <dag> <regio>", "Taak in belblok" | geen regiodag; binnendienst | |
| `vrijeMomentenAgenda(afspraken, bezet, werkdag, duur)` (voorstel) | eigen afspraken, bezetting uit de koppeling | lijst vrije momenten | gebeurtenis over middernacht; hele-dag-afspraak | bezet uit de koppeling telt mee |

### Endpoints

| Methode en route | Recht | Invoer | Uitvoer | Fouten |
|---|---|---|---|---|
| `POST /api/sync/mutations` (`appointments`) | afspraken schrijven | afspraak | versie | 409 conflict |
| `POST /api/afspraken/:id/afronden` | eigenaar of team | `{uitkomst, verslag, agendapunten, laterOp?, reden?}` | mutaties | 400 reden ontbreekt bij nee; idempotent op afspraak en uitkomst |
| `GET /api/agenda?van=&tot=&gebruiker=` | eigen; salesmanager team | periode | afspraken, belblokken, regiodagen, conflicten | 403 buiten team |
| `GET /api/agenda/vrij?gebruiker=&regio=` | Gevorderd | gebruiker, regio | vrije momenten en regiodag | 403 |
| `GET /api/meetings/aan-de-beurt` (voorstel) | Gevorderd | geen | voorstellen | |
| `GET/POST/PUT /api/meetingsoorten` (voorstel) | lezen iedereen, schrijven beheerder | soort | soort | 400 bij een uitkomst zonder gevolg |
| `GET /api/koppelingen/agenda/:provider/start`, `GET .../terug`, `DELETE /api/koppelingen/agenda/:provider` (voorstel) | eigen gebruiker, koppeling ingeschakeld door beheerder | OAuth | status | 403 als de beheerder het uitzette |

Het meldpunt `POST /api/reis/gebeurtenis` (P05) is de enige plek waar de fase verandert; `afronden` roept het aan.

### AI-stappen

Geen nieuwe AI in deze prompt. De Notulist (voorgevuld verslag per agendapunt, voorgestelde uitkomst, concurrentnamen als signaal) komt in P19; de Pitstop in P18. Het venster "Rond af" heeft al de velden en toont de herkomst zodra die er is.

### Integraties

- Agenda (12): Microsoft 365 en Google via OAuth per gebruiker, aan te zetten door de beheerder. Lezen van bezetting voor belblok- en afspraakadviezen; schrijven van afspraken en belblokken; Teams- en Meet-links.
- Adapter `server/utils/calendarProviders.ts` met één interface (`leesBezet`, `schrijfAfspraak`, `wijzigAfspraak`, `verwijderAfspraak`, `maakMeetinglink`), een mock met vaste fixtures, logging in `koppeling_runs`, foutmeldingen in gewone taal. Voorstel voor de tekst: "Je Google-agenda is ontkoppeld. Koppel hem opnieuw in Mijn instellingen."
- Tokens versleuteld met AES-256-GCM met een eigen geheim voor de agenda, niet gedeeld met AI-sleutels (15.3, Bijlage A regel 49 als patroon).
- Synchronisatiemoment: Niet vastgelegd in het bouwplan; voorstel: bij openen van de agenda en elke 15 minuten via de bestaande sweep, plus direct schrijven bij plannen.

### Functiecatalogus

Sleutels niet vastgelegd in het bouwplan; voorstel:

| Sleutel | Niveau | Pakket | Recht | Helpartikel |
|---|---|---|---|---|
| `agenda.basis` | Beginner | Starter | afspraken schrijven | "Een afspraak plannen en afronden" |
| `agenda.aanDeBeurt` | Gevorderd | Starter | afspraken lezen | "Een afspraak plannen en afronden" |
| `agenda.voorCollega` | Gevorderd | Starter | afspraken schrijven | idem |
| `agenda.koppeling` | Gevorderd | Starter | eigen profiel | "Koppelingen" |
| `agenda.weekritmeSoort`, `agenda.meetingAnalyse` | Expert | Plus (voorstel) | afspraken lezen | idem |
| `instellingen.meetingsoorten` | Expert | Starter | beheerder | "Meetingsoorten en uitkomsten inrichten" |

### Hergebruik uit DealDrive

- `agenda.vue`, `meetings.vue`: raster en lijst; aanpassen met regiodagen, belblokken en conflicten.
- `AfspraakFlyout.vue`, `NieuweAfspraakFlyout.vue`, `useAfspraakDetail.ts`, `useNieuweAfspraak.ts`: één component voor flyout en schuifvenster (8.2 punt 5).
- `useMeetingVoorstellen.ts`: basis voor "Wie is er aan de beurt?", uitgebreid met de new business-voorstellen en zonder uitval van prospects zonder klasse.
- `calendarSync.ts`, `calendarProviders.ts`, `calendarCrypto.ts`: letterlijk, met eigen geheim per doel.
- `AfspraakAnalyseFlyout.vue`: voor de meeting-analyse (Expert).

### Buiten scope

- Notulist en verslaganalyse (P19), Pitstop en briefing (P18), dealfunctie en offertes (P17), routes en kansen (P14), het telefoonvenster Bezoek afronden en inloop (P30), meldingen vertrek, briefing en verslag (P31).
- Opnemen van gesprekken (open vraag 13: alleen aantekeningen, inspreken en geplakte transcripten).

## Acceptatiecriteria

1. Bijlage A regel 3: de tweede afspraak met een account meldt geen `eerste-afspraak-gepland`; een geannuleerde eerste afspraak telt niet als eerste.
2. Bijlage A regel 32: een taak waaruit je plant, is aan de afspraak gekoppeld en sluit bij afronden.
3. Bijlage A regel 33: een prospect zonder historie of klasse verschijnt in "Wie is er aan de beurt?" als hij aan een voorwaarde voldoet.
4. Bijlage A regel 37: met een gekoppelde agenda telt "agenda bezet" mee in vrije momenten en belblokadviezen.
5. Bijlage A regel 16: meetingsoorten en uitkomsten staan één keer gedefinieerd; seed en editor gebruiken dezelfde bron.
6. De uitkomst "vervolg-inventarisatie" maakt de vervolgafspraak met de juiste soort en termijn (F09).
7. Een afspraak die de binnendienst voor de buitendienst plant, staat in diens agenda met briefing en melding (13.3 flow 3).
8. Uitkomst "geen-match" vraagt een reden en zet status nee met afkoelperiode per kanaal (7.2).
9. Intern overleg werkt `laatste_contact_op` niet bij.
10. Agendakoppeling werkt met de mock voor Microsoft en Google; tests zonder netwerk; tokens zijn versleuteld en verschijnen nooit in logs.
11. Telefoon (8.3, 8.15, 8.16): op 375, 390 en 412 px opent een afspraak als schuifvenster met greep, plakkende knoppenrij en de actiebalk "Bellen", "Mail", "WhatsApp", "Navigeer" van 48 px; elke afspraak heeft een navigeerknop; geen horizontale scroll.
12. Tikdoelen (8.7): afspraak plannen vanuit een taak in hooguit vier tikken plus de keuze van datum; elk tikdoel minimaal 44 px.
13. Offline (8.8): een nieuwe afspraak en het afronden van een afspraak slagen zonder verbinding, met wolkje en gele strook, en komen na herstel precies één keer aan; meetingsoorten staan in het dagpakket.
14. Niveaus: als Beginner ziet de gebruiker geen "Wie is er aan de beurt?" en geen "Voor wie" met collega (vergrendeld met uitleg); als Gevorderd wel, maar geen meeting-analyse; als Expert alles. Getest per niveau.
15. Cross-tenant en team: een salesmanager ziet alleen afspraken van zijn teams (server-side).

## Definition of Done

Hoofdstuk 19 geldt volledig. Specifiek voor deze prompt:

- Seed van zeven meetingsoorten in de startset van elke nieuwe organisatie (F23); de Voltvast-organisatie (Bijlage C) gebruikt hem in de testdata.
- Playwright-flow "afspraak voor een collega" op desktop en de afspraak als schuifvenster op 390 px.
- Bijlage A regels 3, 32, 33 en 37 afgevinkt in het sprintverslag.
- Helpartikel "Een afspraak plannen en afronden" en het handboek bijgewerkt in dezelfde commit.
