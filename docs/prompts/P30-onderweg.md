# P30: Onderweg: route, bezoek afronden, inloop, in de buurt, offline dag

| Onderdeel | Waarde |
|---|---|
| Sprint | 8 |
| Features | F10 (telefoonweergave), hoofdstuk 8 (8.5.2, 8.5.3, 8.6, 8.8) |
| Hangt af van | P01 (sync, functiecatalogus), P27 (mobiele schil, onderbalk, schuifvensters, wachtrij), P03 (compacte accountkaart), P07 (taken, `rondTaakAf`), P10 (belmodus en "Hoe ging het?"), P32 (dagritme-kern, Vandaag op de telefoon), P13 (meetingsoorten, venster "Rond af"), P14 (`shared/route.ts`, kansen, routedienst, klaarzetten) |
| Bron in het bouwplan | 8.2, 8.3, 8.4, 8.5.2, 8.5.3, 8.6, 8.7, 8.8, 8.11, 8.13, 8.14, 8.15, 8.16, F10, F24 (offline), 15.2, ADR-019, ADR-020 |

## Lees eerst

- `Bouwplan-Dealtrace.md`: hoofdstuk 8 volledig (dit is je belangrijkste hoofdstuk), 2.2, 5.2, F10, F13 (redenen voor nee), F24 (offline en conflicten), 7.2 en 7.3, 10.2 (rij Onderweg), 13.4, 15.2 (spraakopnames, foto's, locatie), 16.2, 19, 21 (risico's telefoon, offline en PWA), ADR-016, ADR-019, ADR-020, Bijlage B (rijen Telefoon, Synchronisatie, Meldingen en PWA).
- DealDrive op commit 75bee61: `app/pages/dex/afspraken.vue`, `app/pages/dex/kansen.vue`, `app/pages/dex/klaargezet.vue`, `app/pages/dex/index.vue`, `app/components/DexKaart.vue`, `app/components/DexNieuw.vue`, `app/components/DexMelding.vue`, `app/components/DexShell.vue`, `app/components/TranscriptUpload.vue`, `shared/dexDag.ts`, `shared/dexKansen.ts`, `shared/werkplek.ts`, `server/utils/dexDagactie.ts`, `server/api/dex/dagactie.post.ts`, en voor de wachtrij `app/composables/useSyncQueue.ts`, `app/composables/useOptimisticWrite.ts`, `app/utils/offlineDb.ts`, `app/components/OfflineBanner.vue`, `app/components/ConflictResolveModal.vue`, `server/api/sync/mutations.post.ts`.

## Deel 1: Functioneel (wat en waarom)

### Wat je bouwt

Je bouwt de telefoonweergave van de bezoekdag op `/onderweg` met volgende stop, tijdlijn en kansen als tussenrij, het venster Bezoek afronden, het inloopbezoek in drie tikken, "In de buurt", foto's bij een bezoek, de aankomstkaart en het dagpakket waarmee een hele dag offline lukt.

### Waarom

De buitendienst werkt de hele dag vanaf de telefoon, ook in een kelder zonder bereik (hoofdstuk 8). Dex in DealDrive was sterk in bediening maar had geen offline schrijven, geen navigeerknop, geen route op volgorde, afstanden op stadsniveau en "Afgehandeld" zonder uitkomst (8.1). Dealtrace bouwt dit in dezelfde app, met één rekenkern en één schrijflaag met offline wachtrij (ADR-020).

### Gebruikers en niveaus

| Rol | Niveau | Wat |
|---|---|---|
| Buitendienst of hybride | Beginner | Route met navigeren, bellen, Pitstop, bezoek afronden; kansen als tussenrij met "+ Tussenstop" (top 3); foto bij bezoek; klaargezet door de binnendienst; offline kaart; dagpakket |
| Buitendienst of hybride | Gevorderd | Plus alle kansen met filters, bellijst naast je route, "In de buurt", "+ Inloop", aankomstkaart |
| Buitendienst of hybride | Expert | Plus eigen bronnen en straal voor kansen (instellingen uit P14) |
| Binnendienst | alle | Geen route en geen "In de buurt" (werkplek Kantoor, 8.12); wel het dagpakket voor accountkaarten en belscripts |
| Salesmanager | rol | Teamschakelaar op de route (8.2 punt 4); standaard "mijn" |

### Schermen

**Route `/onderweg`** (tab 2 "Route" in de onderbalk van buitendienst en hybride, 8.4; op de laptop stuurt hij door naar `/bezoeken`, 8.14), op 390 bij 844 px van boven naar beneden:

1. Kop: "Route · 3 bezoeken · 142 km · 1u 50 rijden", rechts "Kaart" (wisselt tussen lijst en kaart).
2. **Volgende stop** (groot, geel kader): tijd, account, adres, "Vertrek om 10:20 · 24 min rijden", knoppen "Navigeer" (primair), "Bel", "Pitstop". Valt de vertrektijd binnen 15 minuten, dan wordt de vertrekregel rood.
3. **Tijdlijn van de dag**: per stop tijd, account, plaats, status (gepland, onderweg, bezig, afgerond, zonder verslag) en tussen twee stops de reistijd. Kansen staan als gele tussenrij waar ze passen ("12 min omrijden · past tussen 11:30 en 13:00") met "+ Tussenstop" en "Overslaan". Kansen die een collega klaarzette, staan er als tussenrij met bron "Klaargezet door Sanne".
4. **In de buurt** (knop onderaan, Gevorderd).
5. **Bellijst naast je route** (Gevorderd): de top vijf om te bellen tijdens wachttijd of met carkit.

Een afgeronde stop klapt in tot één regel met een groen vinkje. Een voorbije stop zonder verslag krijgt de rode knop "Verslag vastleggen". Knop "+ Inloop" (Gevorderd) staat op Route en op Vandaag.

Lege staat: Niet vastgelegd in het bouwplan; voorstel: "Geen bezoeken vandaag. Kansen in je regio vind je onder In de buurt." Voor een Beginner zonder "In de buurt": "Geen bezoeken vandaag."

**Kaartweergave**: genummerde stops, kansen als gele punten. Offline toont hij de statische kaart die bij het laden is bewaard (offline kaart, 8.6); navigeren gebeurt in de kaartapp, die eigen offline kaarten heeft.

**Venster Bezoek afronden** (schuifvenster, opent vanuit de route, de aankomstkaart of de focuskaart, 8.5.3):

1. Kop: account en tijd ("Bakker Bouw · 10:45 tot 11:30").
2. **Uitkomst**: de knoppen van de meetingsoort als grote tegels in twee kolommen (bijvoorbeeld "Interesse, vervolg", "Offerte gevraagd", "Geen interesse", "Andere contactpersoon").
3. **Verslag**: één groot veld met de microfoonknop als primaire invoer ("Spreek je verslag in"), typen als terugval, en "Foto" (whiteboard, visitekaartje, situatie).
4. **Volgende stap**: voorgesteld door de reis of uit het verslag ("Offerte sturen voor 21 okt"), aan te passen met datum en soort.
5. **Nieuwe contactpersoon** (ingeklapt): naam, functie, telefoon, of "Scan visitekaartje" (de scan zelf bouwt P31).
6. Plakkende knop "Bewaar bezoek".

Bij "Geen interesse" vraagt het venster de reden voor nee (F13, 7.2). Na bewaren sluit het venster na 1,2 seconden en verschijnt de meldingsstrook "Bezoek vastgelegd" met "Ongedaan maken" (5 seconden); offline: "Bewaard op je telefoon, wordt verstuurd zodra je verbinding hebt" (8.3).

Let op de uitkomstlabels: 8.5.3 noemt "Interesse, vervolg", "Offerte gevraagd", "Geen interesse", "Andere contactpersoon"; F09 kent voor Kennismaking de codes `vervolg-inventarisatie`, `offerte-aanvraag`, `later`, `geen-match`. Niet vastgelegd in het bouwplan hoe die bij elkaar horen; voorstel: de tegels tonen de labels uit `meetingsoorten.data.uitkomsten`; de startset krijgt bij Kennismaking de labels "Interesse, vervolg" (`vervolg-inventarisatie`), "Offerte gevraagd" (`offerte-aanvraag`), "Later" (`later`), "Geen interesse" (`geen-match`), plus "Andere contactpersoon" (`nieuw_contact` uit 7.3).

**Aankomstkaart** (Gevorderd, op Vandaag bovenaan): "Je bent bij Bakker Bouw" met "Pitstop" en "Bezoek afronden". Verschijnt alleen als je de app opent binnen 300 m van een afspraak rond de starttijd; een PWA volgt geen locatie op de achtergrond en Dealtrace beweert dat ook niet (8.6). "Rond de starttijd" is niet vastgelegd in het bouwplan; voorstel: van 15 minuten voor de start tot het einde van de afspraak.

**In de buurt** (schuifvenster, Gevorderd): prospects en klanten binnen 15 minuten van je huidige plek, gesorteerd op kansscore, met de reden; filter "alleen prospects". Per regel "Bel", "Navigeer", "+ Inloop". Lege staat (voorstel): "Niemand binnen 15 minuten. Kijk later opnieuw of zet de filter alleen prospects uit."

**Inloopbezoek**: "+ Inloop" stelt het dichtstbijzijnde account voor op basis van je locatie (lijst van de drie dichtstbijzijnde, voorstel), je bevestigt, en Bezoek afronden opent met soort "Ongepland bezoek" en tijd nu. F10 noemt de soort ook "Inloopbezoek"; de startset van F23 heeft zeven meetingsoorten zonder deze. Niet vastgelegd in het bouwplan; voorstel: een achtste meetingsoort "Ongepland bezoek" (type klant, vorm bezoek, 30 minuten) met dezelfde uitkomsten als Kennismaking, aangemaakt in deze prompt.

**Mijn instellingen, Offline**: "Klaar voor vandaag · 23 accounts · 3,1 MB · bijgewerkt 07:42", schakelaar "Foto's en opnames alleen via wifi versturen", knop "Ververs nu" (voorstel).

**Accountkaart buiten het dagpakket** (offline): "Niet op je telefoon bewaard" met "Bewaar voor offline".

**Verbindingsstrook**: geel 28 px "Offline · 3 wijzigingen wachten"; rood met "Opnieuw proberen" bij een vastgelopen wachtrij; elk niet verstuurd record een klein wolkje met streep (8.3, 8.8).

### Klikpaden met tikken (8.7)

1. Naar de volgende afspraak navigeren: Vandaag of Route, "Navigeer" (1). De kaartapp uit Mijn instellingen opent met adres of coördinaat.
2. Bezoek afronden met ingesproken verslag: open vanuit de route (1), uitkomst (2), microfoon (3), stop (4), "Bewaar bezoek" (5). De voorgevulde volgende stap telt niet mee zolang je hem accepteert.
3. Inloopbezoek: "+ Inloop" (1), bevestig account (2), het venster Bezoek afronden staat open (3); daarna als bezoek afronden.
4. Kans als tussenstop: "+ Tussenstop" (1), "Plan afspraak" (2). De route wordt herberekend (online) of de stop wordt lokaal ingevoegd met de geschatte reistijd (offline, voorstel).
5. Foto bij bezoek: in Bezoek afronden "Foto" (1), camera (2), "Gebruik foto" (3, toestelafhankelijk). Verkleind tot 1.600 px, offline in de wachtrij.
6. Bewaar voor offline: op een accountkaart buiten het pakket "Bewaar voor offline" (1).

### Regels

- Mijn is eigenaar: de route toont standaard alleen het werk van de ingelogde gebruiker (8.2, 8.16).
- Eén venster per soort: Bezoek afronden is op de laptop dezelfde component als flyout (8.2 punt 5).
- Afronden is idempotent op `(itemId, stap)`; offline afronden telt bij synchronisatie niet dubbel (7.3).
- Locatie alleen bij openen van Route, "In de buurt" en "+ Inloop"; nooit opgeslagen of gevolgd (8.8, 15.2).
- Geen polling: verversen bij openen van de app en via push (8.8).
- Foto's verkleind tot 1.600 px, 12 maanden bewaard (15.2). Opnames in Opus met 24 kbit/s; na transcriptie verwijderd tenzij de organisatie bewaren aanzet (8.8, 8.9).
- Dagpakket: bij openen met verbinding, en om 06:00 als de app in de achtergrond mag verversen. Inhoud: vandaag en morgen (afspraken, taken, belacties, kansen langs de route, route met reistijden); accountkaarten (contacten, laatste tien contactmomenten, open taken, deals, Pitstop) van de route van vandaag en morgen, de kansen en de bellijst; belscripts die je gebruikt, meetingsoorten met uitkomsten, redenen voor nee; helpartikelen van het leerpad van je niveau; de statische kaart van vandaag. Hooguit 5 MB per dag zonder foto's.
- Offline kan: bezoek afronden, uitkomst na bellen, verslag typen of inspreken (opname bewaard), foto's, nieuwe taak, nieuwe afspraak, nieuwe contactpersoon, signaal afhandelen, concept goedkeuren (versturen wacht), eigen velden invullen.
- Offline kan niet: AI (analyse, scriptinvulling, visitekaartje lezen: de foto wacht), KvK en Datacollectief, routeberekening (de laatst bekende route blijft staan), accounts buiten het dagpakket.
- Bij herstel verstuurt de wachtrij in volgorde; bij een conflict het conflictvenster met "Houd mijn versie" en "Neem de andere over" (F24).
- Na bewaren loopt de verslaganalyse (Notulist): actiepunten worden concepttaken, koopsignalen inzichten. De Notulist zelf komt in P19; deze prompt roept de hook aan en doet niets als hij er nog niet is.

### Afbakening met P31

P30 bouwt de opname in de browser (MediaRecorder), het bewaren als bijlage en de offline wachtrij voor opnames. P31 bouwt de transcriptie op de server, de spraakopdracht, het voorlezen en het visitekaartje. Tot P31 klaar is, gebruikt P30 de mock van `POST /api/spraak/transcribeer`.

### Helpartikelen

- "Dealtrace op je telefoon en offline", "Een dag offline" (F21, Mobiel), "Een bezoek afronden met een verslag", "Bezoeken en kansen langs de route".
- New business: "Binnenlopen langs de route", "Na het bezoek: binnen 24 uur opvolgen".

## Deel 2: Technisch (hoe)

### Datamodel

- `bijlagen: id, organisation_id, eigenaar_id, record_soort, record_id, soort ('foto'|'opname'|'visitekaartje'), pad, grootte, status ('lokaal'|'verstuurd'|'verwerkt')`, opslag in Supabase Storage EU met RLS op `organisation_id` (8.14).
- `dagpakket_versies` (10.2). Kolommen niet vastgelegd in het bouwplan; voorstel: `id, organisation_id, gebruiker_id, datum, versie, grootte, accounts, gemaakt_op`.
- Meetingsoort "Ongepland bezoek" in de startset (voorstel, zie boven) met een migratie die hem toevoegt aan bestaande organisaties.
- Client: Dexie-tabellen voor het dagpakket en de bijlagen; `dagpakket_versie` per gebruiker.
- RLS: `org_isolation` op `bijlagen` en `dagpakket_versies`; bijlagen leesbaar voor de organisatie, schrijfbaar door de eigenaar.
- Rechten: Afspraken schrijven alles (3.3); bijlagen volgen het record.
- Sync-allowlist en offline-mutatiesoorten (8.14): `bezoek.afronden`, `inloop.vastleggen` (deze prompt); `belpoging.uitkomst` (P10, gebruikt vanuit Route); bijlagen via een aparte uploadwachtrij. Elke mutatie met `idempotentie_sleutel`.

### Pure functies

| Functie | Waar | Invoer en uitvoer | Randgevallen en tests |
|---|---|---|---|
| `routeVanDag(afspraken, kansen, reistijden, nu)` (voorstel) | `shared/route.ts` | tijdlijn met stops, statussen, tussenrijen | afspraak geannuleerd; geen afspraken; stop zonder verslag na eindtijd |
| `vertrekMoment(stop, reistijd, nu)` (voorstel) | `shared/route.ts` | vertrektijd en rood ja of nee | rood als vertrek binnen 15 minuten |
| `dichtstbijzijnd(plek, accounts, n)` (voorstel) | `shared/route.ts` | n accounts op hemelsbrede afstand | geen coördinaat; zelfde afstand |
| `isAanwezig(plek, afspraak, nu)` (voorstel) | `shared/route.ts` | boolean | 300 m grens; tijdvenster |
| `dagpakketInhoud(gebruiker, datum, bron)` (voorstel) | `server/utils` | lijst records en grootte | meer dan 5 MB: kansen en bellijst eerst inkorten (voorstel) |
| `verkleinFoto(bestand, 1600)` | `app/utils` | blob | staand, liggend, kleiner dan 1.600 px blijft gelijk |

Testsets `test:route` en `test:dag` uitbreiden (8.14).

### Endpoints

| Methode en route | Recht | Invoer | Uitvoer | Fouten |
|---|---|---|---|---|
| `GET /api/onderweg/dagpakket?datum=` | ingelogd | datum | alles uit 8.8 in één antwoord met versie | 304 bij gelijke versie (voorstel) |
| `GET /api/onderweg/in-de-buurt?lat=&lng=&minuten=` | Gevorderd | plek, minuten (standaard 15) | accounts met kansscore en reden | 403 niveau; plek wordt niet gelogd |
| `POST /api/sync/mutations` | per mutatie | `bezoek.afronden {afspraakId, uitkomst, verslag?, bijlagen[], volgendeStap?, nieuwContact?, reden?}`, `inloop.vastleggen {accountId, tijd, ...}` | versie per record | 409 conflict; dubbele sleutel geeft het eerdere resultaat |
| `POST /api/bijlagen` (voorstel) | eigenaar | bestand, record | id, status | 413 boven de grens |
| `POST /api/afspraken/inloop` | Gevorderd (P14) | `{accountId, tijd}` | afspraak | |

### AI-stappen

Geen in deze prompt. De verslaganalyse (Notulist) en transcriptie volgen in P19 en P31.

### Integraties

- Routedienst (P14) voor reistijden in het dagpakket en "In de buurt" (voorselectie hemelsbreed, reistijd voor de top 20, 8.14).
- Kaartapps: diepe links naar Google Maps, Apple Kaarten of Waze volgens de keuze in Mijn instellingen.
- Supabase Storage EU voor bijlagen.
- PWA: service worker met statische bestanden 30 dagen, API-GET netwerk eerst met terugval op cache, dagpakket via Dexie; `navigator.storage.persist()` na installatie (8.14).

### Functiecatalogus

Sleutels niet vastgelegd in het bouwplan; niveaus uit 8.6 en 8.11; voorstel:

| Sleutel | Niveau | Pakket | Recht | Helpartikel |
|---|---|---|---|---|
| `onderweg.route` (navigeer, offline kaart, klaargezet) | Beginner | Starter | afspraken lezen | "Bezoeken en kansen langs de route" |
| `onderweg.bezoekAfronden` (incl. foto) | Beginner | Starter | afspraken schrijven | "Een bezoek afronden met een verslag" |
| `onderweg.dagpakket` | Beginner | Starter | ingelogd | "Een dag offline" |
| `onderweg.inDeBuurt` | Gevorderd | Starter | prospects lezen | "Dealtrace op je telefoon en offline" |
| `onderweg.inloop` | Gevorderd | Starter | afspraken schrijven | idem |
| `onderweg.aankomst` | Gevorderd | Starter | afspraken lezen | idem |

### Hergebruik uit DealDrive (8.13, Bijlage B)

- `shared/dexDag.ts` naar `shared/dag.ts` (filter op eigenaar, uitkomst werkt contactdatums bij).
- `shared/dexKansen.ts` naar `shared/route.ts` (gedeeld met P14).
- `DexKaart.vue`, `DexNieuw.vue`, `DexMelding.vue` naar `RecordVenster.vue`, `NieuwVenster.vue`, `Meldingsstrook.vue` (responsief).
- `TranscriptUpload.vue` naar `VerslagVeld.vue` (opname naar servertranscriptie, offline in de wachtrij).
- `useSyncQueue.ts`, `useOptimisticWrite.ts`, `offlineDb.ts`, `ConflictResolveModal.vue`, `OfflineBanner.vue`: letterlijk; de banner wordt de gele strook van 8.3.
- `/api/dex/dagactie` vervalt: alles via `POST /api/sync/mutations` (geen tweede schrijfweg).

### Buiten scope

- Spraaktranscriptie, spraakopdracht, voorlezen, handsfree, visitekaartje lezen en de onderweg-pushmeldingen (P31).
- Rijmodus (Expert, sprint 12, 8.6).
- KvK opzoeken op de telefoon (P11).
- Notulist (P19). Vandaag op de telefoon zelf (P32); deze prompt voegt alleen de aankomstkaart en "+ Inloop" toe.

## Acceptatiecriteria

1. Bijlage A noemt P30 niet in de kolom Prompt; regel 16 (één definitie) geldt: de route en kansen komen uit dezelfde `shared/route.ts` als `/bezoeken`.
2. Tikdoelen 8.7 getoetst met een Playwright-test die tikken telt: navigeren 1, bezoek afronden met ingesproken verslag 5 plus praten, inloopbezoek 3 tot het venster, tussenstop 2.
3. Op 390 px staan kop, volgende stop en het begin van de tijdlijn boven de vouw (voorstel als toets; 8.16 eist dit expliciet alleen voor Vandaag).
4. Elke stop heeft een navigeer- en belknop van minimaal 44 px binnen duimbereik; knoppen in lijsten 48 px; in handschoenmodus 54 px (8.3, 8.16).
5. Offline (8.8, 8.16): bezoek afronden, uitkomst na bellen, verslag typen of inspreken, foto, nieuwe taak, nieuwe afspraak, nieuwe contactpersoon en eigen velden slagen zonder verbinding met zichtbare status en komen na herstel precies één keer aan. Getest met `context.setOffline(true)`.
6. Een uur in vliegtuigmodus midden op de dag; daarna alles binnen een minuut verstuurd zonder dubbele records (8.15 scenario 2).
7. Het dagpakket is hooguit 5 MB zonder foto's voor een dag met 3 bezoeken en 23 accounts; Mijn instellingen toont de stand.
8. Een volgende opening uit het dagpakket toont Route binnen 1 seconde; een tik geeft binnen 100 ms zichtbare reactie (8.14).
9. De locatie wordt nooit opgeslagen: geen kolom, geen log, geen analytics met coördinaten.
10. "In de buurt" toont alleen accounts binnen 15 minuten reistijd, met reden; "alleen prospects" werkt.
11. De aankomstkaart verschijnt binnen 300 m in het tijdvenster en niet daarbuiten.
12. Bij "Geen interesse" is een reden verplicht en wordt de afkoelperiode gezet.
13. Toestellen (8.15): getest op iPhone SE (375 px), iPhone 15 of 16, Samsung Galaxy A, Pixel 7 of nieuwer en iPad staand; scenario 1 (volledige buitendienstdag met drie bezoeken, twee tussenstops, vijf belacties en drie ingesproken verslagen), scenario 2 en scenario 3 (zon en handschoenen) doorlopen; VoiceOver en TalkBack op Route en Bezoek afronden; tekstvergroting tot 200 procent zonder afgekapte knoppen.
14. De onderbalk licht "Route" op op `/onderweg` en op Bezoek afronden (8.16).
15. Niveaus (8.11): als Beginner route, navigeren, bezoek afronden, foto en top 3 kansen, zonder "In de buurt", "+ Inloop" en aankomstkaart; als Gevorderd ook die drie en alle kansen; als Expert ook eigen bronnen en straal. Een binnendienstprofiel ziet geen Route-tab. Getest per niveau.

## Definition of Done

Hoofdstuk 19 geldt volledig. Specifiek voor deze prompt:

- De sprintdemonstratie van sprint 8 ("klaar als", hoofdstuk 17) is gehaald op ten minste één echte iPhone en één echte Android, met schermafbeeldingen in het sprintverslag.
- Playwright-projecten 375, 390 en 412 px met aanraakmodus, referentieschermafbeeldingen van Route en Bezoek afronden, offline-tests groen.
- Accuverbruik over een dag gemeten (hooguit 10 procent, 8.15 scenario 5) en in het sprintverslag.
- Testdata: Voltvast (Bijlage C) met fictieve accounts in Team Noord en Team Zuid.
- Helpartikelen "Een dag offline" en "Een bezoek afronden met een verslag" en het handboek bijgewerkt.
