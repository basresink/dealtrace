# P14: Bezoeken, kansen langs de route, gebieden

| Onderdeel | Waarde |
|---|---|
| Sprint | 8 |
| Features | F10 Bezoeken en kansen langs de route, F18 Gebieden en regio-analyse |
| Hangt af van | P01 (fundament, teams), P27 (mobiele schil), P03 (accounts met adres, score), P05 (reis en status), P06 (motor, landing op regiodag, afspraakmatrix), P07 (taken, Vandaag), P10 (belmodus voor "Eerst bellen"), P13 (agenda, meetingsoorten, "Plan een afspraak", "Rond af"), P28 (branches) |
| Bron in het bouwplan | F10, F18, 12 (rij Routedienst), ADR-016, 13.4, 8.13 (`dexKansen`), 22 (open vraag 7), 16.2, Bijlage A regels 30, 31, 32, 45 |

## Lees eerst

- `Bouwplan-Dealtrace.md`: 0.2 (B9, B17), 2.2, 3.2, 4.3 (rijen F10 en F18), 5.2, 6.1, 7.2, 8.5.2 (alleen om de gedeelde kern te kennen; het telefoonscherm bouwt P30), 8.13, F09 (Plan een afspraak), F10 volledig, F15 (landing en capaciteit), F16 (afspraakmatrix), F18 volledig, F25 (branches, terugkomregel met kanaal bezoek), 10.2 (rijen `accounts`, `klaargezet_voor`, `kans_overslaan`), 12, 13.4, 15.2 (locatie), 16.2, 19, 21 (risico kansen onbetrouwbaar), 22 (vraag 7), ADR-016, Bijlage A, Bijlage B (rij Bezoeken en gebieden).
- DealDrive op commit 75bee61: `app/pages/bezoeken.vue` (heette `route.vue`), `app/components/RouteList.vue`, `app/components/MiniMap.vue`, `app/composables/useGeoNL.ts`, `shared/gebieden.ts`, `app/pages/instellingen/gebieden.vue`, `app/pages/bezoek-analyse.vue`, `server/api/gebieden/analyse.get.ts`, `shared/dexKansen.ts` (gaten van 75 minuten, omweg 25 km).

## Deel 1: Functioneel (wat en waarom)

### Wat je bouwt

Je bouwt de bezoekdag van de buitendienst op `/bezoeken` met route, kaart en kansen langs de route op echte omrijtijd, de gebiedsindeling met regiodagen en de regio-analyse.

### Waarom

"Waar moet ik vandaag heen, en wie neem ik onderweg mee?" (F10). In DealDrive kwamen kansen alleen uit de top acht bezoektaken, hemelsbreed tussen plaatsmiddelpunten, zonder regiodag en met accounts van collega's (Bijlage A regel 31); de bellijst op Bezoeken sloot iedereen uit die je in de hele periode bezocht (regel 30); een bezoektaak bleef open na "+ Plan bezoek" (regel 32); regio-overlap werd alleen gemeld en plaatsnamen hadden geen synoniemen (regel 45). Dealtrace maakt van elke rijdag een prospectiedag met echte geografie (ADR-016) en laat de binnendienst kansen klaarzetten voor de regiodag van een collega.

### Gebruikers en niveaus

| Rol | Niveau | Wat |
|---|---|---|
| Buitendienst | Beginner | Route van vandaag met kaart, volgend bezoek, Pitstop per bezoek, bezoek afronden, bellen en navigeren per stop, kansen langs de route bekijken met "+ Tussenstop"; eigen week zien ("maandag Regio Oost") |
| Buitendienst | Gevorderd | Plus periodefilter, te plannen bezoeken, bellijst naast bezoeken (Top 5, 10), kansen met alle acties en filters, inloopbezoek, regio-analyse, persoonlijke regiodag kiezen |
| Buitendienst | Expert | Plus start- en eindadres, regiodag kiezen, eigen kansbronnen en straal, laag "ongeplande prospects in dit gebied", routeoptimalisatie, gebieden voorstellen |
| Binnendienst | Gevorderd | Een prospect of kans "Klaarzetten voor buitendienst" op een regiodag van een collega; regiodagen van de buitendienst vullen |
| Salesmanager | rol | Teamschakelaar, teamkaart, kansen getoond en omgezet per persoon, kilometers per bezoek, aandeel new business-bezoeken |
| Beheerder | rol | Regio's tekenen, voorstel uit de portefeuille, overlap oplossen, eigenaren en regiodagen per regio |

### Schermen

**`/bezoeken`** (laptop; op de telefoon is de route `/onderweg`, gebouwd in P30), van boven naar beneden:

1. **Kop**: kicker "BEZOEKEN · VANDAAG · REGIO OOST", titel naar aantal ("3 bezoeken op de planning."), knoppen "+ Bezoek" (geel), "Filters" (periode), "Agenda", "Hulp". Rechts de dagstatistiek: "Bezoeken 3 · Klantcontact 3u 30 · Rijtijd 1u 50 · 142 km".
2. **Kaart en route** (twee kolommen): kaart met genummerde stops op adres, de route als lijn, startpunt (thuis of kantoor) en eindpunt, volgend bezoek rood pulserend, kansen als gele punten. Rechts de routelijst: tijd en duur, "VOLGENDE", soort, account, contact, adres, reistijd naar de volgende stop, knoppen "Navigeer", "Bel", "Pitstop".
3. **Kansen langs de route** (hoofdblok): kop "KANSEN LANGS DE ROUTE · 9", titel "Prospects en kansen vlak bij je bezoeken", filters (Bron, Klasse, "Alleen mijn accounts" standaard aan, "Alleen prospects" standaard aan, Maximale omrijtijd 10, 20, 30 minuten, Aantal 4, 10, alles), schakelaar "Toon ook ongeplande prospects in dit gebied" (Expert). Per kans: rangnummer, naam met klasse- en fasepil, bron ("Open bezoektaak", "Hete aanleiding: vacature monteur (Indeed, 9 okt)", "Bezoekritme achter: klasse A, 120 dagen niet geweest", "Klaargezet door Sanne (binnendienst)", "Ongeplande prospect in doelgroep Bouw"), afstand en omrijtijd ("12 min omrijden, tussen stop 2 en 3"), beste moment ("45 min vrij tussen 11:30 en 13:00"), primair contact met rol, laatste contact, scoreopbouw bij hover ("bezoektaak +100 · hete aanleiding +20 · 12 min omrijden -12"). Acties: "+ Tussenstop" (geel), "Eerst bellen", "Inloopbezoek", "Overslaan" (met reden), "Navigeer". Een schatting draagt het label "schatting".
4. **Bellijst naast je bezoeken** (Gevorderd): Top 5 of Top 10, zonder de accounts die je vandaag bezoekt; variant "Bellen voor morgen" met prospects in de regio van morgen.
5. **Te plannen bezoeken** (Gevorderd): open bezoektaken (ritme, regel, handmatig, uit de binnendienst), oudste eerst, met "+ Plan bezoek".
6. **Bezoek afronden**: opent het venster "Rond af" uit P13 met de uitkomsten van de meetingsoort.

Lege staten: Niet vastgelegd in het bouwplan; voorstel: "Geen bezoeken op deze dag. Kansen in je regio staan hieronder." en voor kansen "Geen kansen binnen 20 minuten omrijden. Zet de maximale omrijtijd hoger of toon ook ongeplande prospects."

Maximale aantal kansen: Beginner ziet de top 3 (8.11), Gevorderd alle met filters, Expert ook eigen bronnen en straal.

**`/instellingen/gebieden`** (beheerder): blok "Je week" met vijf dagkaarten (regio, tellers klanten, prospects, nooit bezocht, langer dan 90 dagen niet bezocht); per regio naam, postcodereeksen ("3701-3799, 3800-3829"), plaatsen (vangnet), eigenaren (buitendienst en binnendienstpartner), regiodag per persoon (even en oneven weken mogelijk); synoniemen voor plaatsnamen ("Den Bosch" is "'s-Hertogenbosch"); knop "Voorstel uit je accounts" (groepeert op het eerste cijfer van de postcode). Overlap wordt bij invoer geblokkeerd. Niet vastgelegd in het bouwplan; voorstel meldtekst: "Postcode 3750 valt al in Regio Midden. Haal hem daar eerst weg of kies een andere reeks."

**`/analyse/regio`** ("Waar laat je potentie liggen?", Gevorderd; accountmanager eigen accounts, salesmanager team): cijfers "Accounts in beeld", "Stil of nooit bezocht", "Nog niet benaderde prospects", "Gekwalificeerde prospects zonder contact in 60 dagen", "Bezocht in 90 dagen" (doel 80 procent); tabel per regio (regiodag, klanten, prospects, nog niet benaderd, dekking als balk, stil en nooit), altijd een rij "Zonder regio"; kaartweergave met punten per status; per regio een lijst (nooit bezocht boven, dan langst stil, dan klasse) met "+ Afspraak" en "Klaarzetten voor regiodag".

**Mijn instellingen**: "Thuisbasis voor routes" (adres), "Kaartapp voor navigeren" (Google Maps, Apple Kaarten, Waze; 8.6).

**Telefoon (390 px).** `/bezoeken` stuurt op een telefoon door naar `/onderweg` (P30). Niet vastgelegd in het bouwplan; voorstel: de doorverwijzing hangt aan `useSchermklasse()` (8.14). `/instellingen/gebieden` opent met "Beter op een groot scherm" (8.12). `/analyse/regio` is op de telefoon alleen-lezen met lijst in plaats van tabel (voorstel). "Klaarzetten voor buitendienst" staat op de compacte accountkaart van de binnendienst (8.12).

### Klikpaden

1. Tussenstop toevoegen: "+ Tussenstop" (1); de flyout "Plan een afspraak in" opent met klant, contact, meetingsoort "Kennismaking", datum vandaag, start in het voorgestelde gat, duur 30 minuten en titel uit de bron; "Plan afspraak" (2). De stop staat op de juiste plek, kaart en reistijden worden herberekend, de bezoektaak wordt gekoppeld.
2. Eerst bellen: "Eerst bellen" (1) opent de belmodus voor één gesprek met het script "Bellen met een aanleiding"; bij "Gesproken, afspraak" landt de afspraak direct in het gat.
3. Inloopbezoek: "Inloopbezoek" (1) legt achteraf vast: soort "Ongepland bezoek", tijd nu, uitkomst, verslag, eventueel nieuw contact; telt als bezoek (het telefoonpad in drie tikken bouwt P30).
4. Overslaan: "Overslaan" (1), reden kiezen (2); de kans komt 7 dagen niet terug. Redenen: Niet vastgelegd in het bouwplan; voorstel: "Geen tijd", "Klopt niet", "Al gesproken", "Niet interessant", "Anders".
5. Binnendienst zet klaar: op de prospectkaart of in de bellijst "Klaarzetten voor buitendienst" (1), collega kiezen (2), regiodag of "eerstvolgende in deze regio" (3), korte reden, "Klaarzetten" (4). De kans verschijnt bij die collega met de bron "Klaargezet door Sanne" en een melding (F24).
6. Plan bezoek uit te plannen bezoeken: "+ Plan bezoek" (1), moment (2), "Plan afspraak" (3); de taak is gekoppeld en sluit bij afronden.

### Kansen: bronnen en score

| Bron | Gewicht (standaard, instelbaar) | Voorwaarde |
|---|---|---|
| Open bezoektaak van jou | +100 | elke open bezoektaak, niet alleen de top acht |
| Klaargezet door de binnendienst voor deze dag of regio | +90 | |
| Hete aanleiding in de laatste 30 dagen | +20 tot +40 naar relevantie | |
| Bezoekritme achter volgens de afspraakmatrix | +1 per dag achter, maximaal +30 | klasse bekend |
| Ongeplande prospect in een actieve doelgroep (laag aan) | +10 | status nieuw of in reis, geen afkoelperiode op bezoek |
| Basisscore van het account | 0 tot 100 | F03 |
| Omrijkosten | -1 per minuut extra reistijd | ten opzichte van de bestaande route |
| Past in een vrij moment | +10 | gat van minstens 30 minuten plus reistijd |

`kansscore = basisscore + bronGewichten + tijdslotBonus - omrijMinuten`. Uitgesloten: accounts die al in de route zitten, status nee of afkoelperiode op bezoek, accounts van collega's (tenzij de filter uitstaat), "Overslaan" in de afgelopen 7 dagen.

### Regels

- Standaardscope is altijd "mijn" (route, kansen, bellijst); de salesmanager heeft een teamschakelaar.
- De bellijst sluit alleen accounts uit met een bezoek op dezelfde dag (regel 30).
- De regiodag filtert kansen en te plannen bezoeken op de regio van die dag; een kans buiten de regio verschijnt alleen binnen de maximale omrijtijd.
- Een uitgevallen afspraak ("niet verschenen" of "geannuleerd", P13) geeft het inzicht "Gat in je agenda" met de top drie kansen rond die plek en de knop "Plan vervangend bezoek".
- Geografie: elk account krijgt bij aanmaken, import en adreswijziging een coördinaat: adres, anders postcode, anders plaats; herkomst opgeslagen en getoond ("op postcode").
- Omrijtijd via de routedienst; terugval hemelsbreed maal 1,3 bij 60 km per uur, zichtbaar als "schatting" (ADR-016).
- Start- en eindpunt per gebruiker, per dag aan te passen; straal alternatief: binnen X minuten van de lijn tussen twee stops.
- Gebieden: postcode (vier cijfers) gaat voor plaats; buitenlandse postcodes vallen nooit in een Nederlandse reeks; overlap geblokkeerd; synoniemenlijst; nieuwe prospects in een regio krijgen automatisch de eigenaren van die regio; taken en kansen voor de buitendienst landen op de regiodag.
- Een terugkomregel met kanaal bezoek plant op de eerstvolgende regiodag in de regio van het account (F25); kansen en regiodagen kunnen filteren op branche.
- De locatie van de gebruiker wordt niet opgeslagen (15.2).
- Getallen uit de Dex-kern als startpunt, per organisatie instelbaar: werkdag 08:00 tot 18:00, gat vanaf 75 minuten, omweg hooguit 25 km of 20 minuten (8.13). Let op: F10 noemt als gat voor de tijdslotbonus "minstens 30 minuten plus reistijd". Niet vastgelegd in het bouwplan hoe die twee zich verhouden; voorstel: 30 minuten plus reistijd voor de tijdslotbonus, 75 minuten voor een "gat" in de dagweergave.

### Filters en sorteren

Kansen: Bron, Klasse, "Alleen mijn accounts", "Alleen prospects", Maximale omrijtijd (10, 20, 30), Aantal (4, 10, alles), branche; sortering op kansscore aflopend. Periodefilter op `/bezoeken` (Gevorderd): vandaag, morgen, deze week, in de URL (`?datum=2026-10-15&periode=dag`). Regio-analyse: scope (eigen, team) en periode in de URL.

### Helpartikelen

- "Bezoeken en kansen langs de route" (Dagelijks werk) en "Gebieden en regiodagen" (Plannen en sturen), F21.
- "Je week plannen: belblokken en regiodagen": Niet vastgelegd in het bouwplan; voorstel: gewoon artikel (Plannen en sturen), samen met P10. Er zijn geen leerpaden per niveau (B19).
- New business: "Je regiodag plannen", "Binnenlopen langs de route".

## Deel 2: Technisch (hoe)

### Datamodel

- `accounts.lat`, `accounts.lng`, `accounts.gebied_id` (kolommen, 10.2); `accounts.data.geo {bron: 'adres'|'postcode'|'plaats', op}`.
- `users.data.thuisbasis {adres, lat, lng}`; `users.data.kaartapp` (voorstel, niet vastgelegd als veldnaam).
- `kans_overslaan: organisation_id, gebruiker_id, account_id, tot, reden`.
- `klaargezet_voor: id, organisation_id, account_id, van_gebruiker, voor_gebruiker, regio_id?, datum?, reden, status ('open'|'ingepland'|'vervallen')`.
- Instelling `gebieden: [{id, naam, reeksen[{van, tot}], plaatsen[], eigenaren {buitendienst[], binnendienst[]}, dagen [{gebruikerId, weekdag, weken: 'alle'|'even'|'oneven'}]}]` plus synoniemen (voorstel: instelling `plaatsSynoniemen`).
- Instelling voor kansgewichten en maximale omrijtijd. Niet vastgelegd als sleutelnaam; voorstel `kansRegels` in `shared/settingKeys.ts`.
- Routedienstcache: Niet vastgelegd als tabel; voorstel `routedienst_cache (van_hash, naar_hash, minuten, km, op)` zonder `organisation_id` (platformsleutel, geen klantdata), 7 dagen geldig.
- Migratie: kolommen op `accounts`, de twee tabellen, de cache; backfill van coördinaten in een job.
- RLS: `org_isolation` op `kans_overslaan` en `klaargezet_voor`.
- Rechten: gebieden schrijven alleen beheerder (4.3); klaarzetten: Gevorderd binnendienst voor accounts van de organisatie; kansen lezen: eigen scope, salesmanager team.
- Sync-allowlist: `kans_overslaan` en `klaargezet_voor` (schrijven); gebieden alleen lezen. Offline-mutatiesoorten: Niet vastgelegd in het bouwplan; voorstel `kans.overslaan` en `kans.klaarzetten`; `inloop.vastleggen` bouwt P30.

### Pure functies (`shared/route.ts`, `shared/gebieden.ts`)

| Functie | Uitvoer | Randgevallen en tests |
|---|---|---|
| `geocodeerTerugval(account, postcodetabel, plaatsentabel)` | `{lat, lng, bron}` | geen adres, onbekende postcode, buitenlandse postcode |
| `afstandKm(a, b)` (haversine) | km | zelfde punt is 0 |
| `omrijMinuten(route, kandidaat, reistijden)` | minuten extra | lege route (vanaf thuisbasis), kandidaat op de route is 0 |
| `vrijeMomenten(route, agenda)` | gaten met start, eind, plaats | werkdag 08:00 tot 18:00, geen afspraken, overlap |
| `kansScore(account, bronnen, omrij, tijdslot, gewichten)` | score met opbouw | ritme achter begrensd op +30; elke bijdrage terug in de opbouw |
| `kansenLangsRoute(route, kandidaten, instellingen)` | gesorteerde kansen | uitsluitingen uit de regels, scope "mijn", overslaan 7 dagen |
| `bellijstNaastBezoeken(kandidaten, bezoekenVandaag, n)` (voorstel) | top n | sluit alleen bezoeken op dezelfde dag uit (regel 30) |
| `regioVan(account, regios, synoniemen)` | regio-id of null | postcode voor plaats, synoniem, buitenland |
| `overlap(regios)` | lijst conflicten | aangrenzende reeksen zijn geen overlap |
| `regiodagVan(gebruiker, datum, regios)` | regio of null | even en oneven weken, feestdag |
| `dekking(accounts, activiteiten, periode)` | per regio tellingen | rij "Zonder regio" |

Testset `test:route` (8.14), uitgebreid met de acceptatiegevallen hieronder.

### Endpoints

| Methode en route | Recht | Invoer | Uitvoer | Fouten |
|---|---|---|---|---|
| `GET /api/bezoeken?datum=&periode=` | eigen; salesmanager team | datum, periode | route, statistiek, kansen, bellijst, te plannen | 403 |
| `POST /api/kansen/:accountId/overslaan` | eigen | `{reden}` | ok | 400 zonder reden |
| `POST /api/accounts/:id/klaarzetten` | Gevorderd | `{voorGebruiker, regioId?, datum?, reden}` | klaargezet-rij | 400 collega zonder regiodag in die regio |
| `POST /api/afspraken/inloop` | Gevorderd | `{accountId, tijd}` | afspraak | 404 |
| `PUT /api/settings/gebieden` | beheerder | regio's | regio's | 409 overlap met melding |
| `GET /api/analyse/regio?scope=&periode=` | Gevorderd | scope | tabel | 403 teamscope voor accountmanager |
| `POST /api/gebieden/voorstel` | beheerder | geen | voorstel | |

### AI-stappen

Geen. Kansen zijn deterministisch, zonder kosten (zoals `dexKansen.ts`).

### Integraties

- Routedienst (12): OpenRouteService of Google Routes; voorstel uit open vraag 7: OpenRouteService met cache, Google als optie. Adapter `server/utils/routedienst.ts` met `reistijdMatrix(punten)`, `route(punten)` en geocodering, cache per paar punten (7 dagen), een mock met vaste fixtures, API-sleutel van het platform (founder richt in). Fout of geen sleutel: terugval op de schatting met label.
- Kaartapps: diepe link per toestel volgens de keuze in Mijn instellingen.
- Prestatiebudget: kansen voor 600 accounts en 6 stops onder 800 ms (voorselectie hemelsbreed, dan routedienst voor de top 30) (F10, 13.4).

### Functiecatalogus

Sleutels niet vastgelegd in het bouwplan; voorstel:

| Sleutel | Startindeling: aan vanaf | Pakket | Recht | Helpartikel |
|---|---|---|---|---|
| `bezoeken.route` | Beginner | Starter | afspraken lezen | "Bezoeken en kansen langs de route" |
| `bezoeken.kansenAlle` (alle kansen en filters) | Gevorderd | Starter | prospects lezen | idem |
| `bezoeken.bellijst`, `bezoeken.teplannen`, `bezoeken.periode` | Gevorderd | Starter | taken lezen | idem |
| `bezoeken.klaarzetten` | Gevorderd | Starter | prospects schrijven | idem |
| `bezoeken.eigenRegels` (bronnen, straal, start en eind, ongepland, optimaliseren) | Expert | Plus (voorstel) | eigen instellingen | idem |
| `regio.analyse` | Gevorderd | Starter | prospects lezen | "Gebieden en regiodagen" |
| `instellingen.gebieden` | Expert | Starter | beheerder | idem |

### Hergebruik uit DealDrive

- `bezoeken.vue`, `RouteList.vue`, `MiniMap.vue`: opbouw van kop, kaart en routelijst; aanpassen met echte geocodering en omrijtijd.
- `useGeoNL.ts`: plaatsenregister als terugval.
- De kansformule en het inzicht "Gat in je agenda" uit DealDrive; `shared/dexKansen.ts` voor gaten en het idee "elke kans draagt zijn reden"; naar `shared/route.ts` met echte reistijden en meer bronnen (8.13).
- `shared/gebieden.ts`, `instellingen/gebieden.vue`, `bezoek-analyse.vue`, `server/api/gebieden/analyse.get.ts`: met overlapblokkade en synoniemen.

### Buiten scope

- Het telefoonscherm Route, Bezoek afronden op 390 px, "+ Inloop" in drie tikken, "In de buurt", dagpakket en offline kaart (P30).
- Vertrekmelding, briefingmelding en "Klaargezet"-push (P31).
- Pitstop-inhoud (P18). Teamkaart en kilometers per bezoek in Analyse (P21).

## Acceptatiecriteria

1. Bijlage A regel 30: de bellijst naast je bezoeken sluit alleen accounts uit die je op dezelfde dag bezoekt, ook bij een periode van een week.
2. Bijlage A regel 31: kansen komen uit alle eigen open bezoektaken, met echte geocodering en omrijtijd, gefilterd op de regiodag en standaard op scope "mijn".
3. Bijlage A regel 32: "+ Plan bezoek" en "+ Tussenstop" koppelen de bezoektaak aan de afspraak; afronden sluit hem.
4. Bijlage A regel 45: overlappende regio's worden bij invoer geblokkeerd; "Den Bosch" valt in dezelfde regio als "'s-Hertogenbosch".
5. Bijlage A regel 16: de kansformule staat één keer in `shared/route.ts`; scherm, motor en P30 gebruiken hem.
6. Een account met een open bezoektaak op 8 minuten omrijden staat boven een account met een hete aanleiding op 25 minuten (F10).
7. "+ Tussenstop" plant in het voorgestelde gat en herberekent de route.
8. Een account van een collega verschijnt niet tenzij de filter uitstaat; een kans met "Overslaan" komt 7 dagen niet terug.
9. Zonder routedienst werkt alles met de schatting en het label "schatting".
10. Een kans die de binnendienst klaarzet, verschijnt bij de collega met bron "Klaargezet door <naam>" en gewicht +90.
11. Kansenberekening voor 600 accounts en 6 stops onder 800 ms (13.4).
12. Telefoon (8.15, 8.16): op 375, 390 en 412 px stuurt `/bezoeken` door naar `/onderweg`; "Klaarzetten voor buitendienst" op de compacte accountkaart heeft tikdoelen van minimaal 44 px; geen horizontale scroll op `/analyse/regio`.
13. Offline (8.8): "Overslaan" en "Klaarzetten" gaan in de wachtrij en komen na herstel één keer aan; routeberekening is offline niet mogelijk en de laatst bekende route blijft staan.
14. Niveaus: als Beginner ziet de gebruiker de route en de top drie kansen, zonder bellijst en te plannen bezoeken ("Nog niet aangezet" met uitleg); als Gevorderd alle kansen met filters en de regio-analyse; als Expert ook eigen bronnen, straal en start- en eindadres. Getest per niveau.
15. Cross-tenant: `kans_overslaan` en `klaargezet_voor` van organisatie A zijn onzichtbaar voor B; de routedienstcache bevat geen klantgegevens.

## Definition of Done

Hoofdstuk 19 geldt volledig. Specifiek voor deze prompt:

- `test:route` groen met de acceptatiegevallen 6 tot en met 9.
- Routedienst-adapter met mock; geen netwerk in tests; één echte proefrun met kosten in het sprintverslag.
- Testdata: de teams Team Noord en Team Zuid van Voltvast (Bijlage C.1) met regio's in Midden- en Noord-Nederland en fictieve accounts; geen echte adressen van bestaande bedrijven.
- Bijlage A regels 30, 31, 32 en 45 afgevinkt in het sprintverslag; helpartikelen bijgewerkt.
