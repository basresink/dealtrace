# P28: Verkoopverhaal: leesmodel, eigen inrichting en Richting

| Onderdeel | Waarde |
|---|---|
| Sprint | 3 (Verkoopverhaal) |
| Features | F25 Verkoopverhaal en Richting (leesmodel, eigen inrichting, pagina Richting, startset) |
| Hangt af van | P01 (instellingen, audit, functiecatalogus), P03 (accounts met `vv_branche_id`, `huidige_leverancier_id`, `terug_op`, `terug_regel_id`), P27 (schil) |
| Bron in het bouwplan | F25, F22 (Verkoopverhaal), 10.2 (groep Verkoopverhaal), 11.2 (vangrails), ADR-017, ADR-018, Bijlage C, open vragen 19 tot en met 21 |

## Lees eerst

- Bouwplan-Dealtrace.md: 0.2 (B16), 0.3 (rij SalesDNA), 1.2, F25 volledig, F22 (alinea Verkoopverhaal), F03 (alinea "Uit het verkoopverhaal"), 10.2 (rijen Verkoopverhaal), 11.2 (rijen "Alleen bevestigd naar buiten", "AI schrijft geen winpunten", "Namenfilter"), 11.5, ADR-017, ADR-018, 21 (risico "Verkoopverhaal is leeg of verouderd"), 22 (vragen 19, 20, 21), Bijlage C volledig.
- `bijlagen/SalesDNA-sublagen-voor-Dealtrace.docx` is leidend voor de vorm van de sublagen (0.4): veldnamen en keuzewaarden.
- DealDrive (commit 75bee61): geen directe tegenhanger; gebruik `server/utils/settingsStore.ts` en `server/utils/auditStore.ts` als patroon voor automatisch bewaren en audit. Bijlage B noemt geen bestanden voor het verkoopverhaal.

## Deel 1: Functioneel (wat en waarom)

### Wat je bouwt

Het leesmodel `vv_*` waaruit elke functie het verkoopverhaal leest, de eigen inrichting van de acht onderdelen in Instellingen met statussen en versies, de pagina `/richting` voor iedereen, de pure functies van het verkoopverhaal, de startset Voltvast met "Kopieer uit startset" en de velden van het verkoopverhaal op de accountkaart.

### Waarom

Elk script, elke boodschap, briefing en campagne moet hetzelfde verhaal vertellen: wie we zijn, waar we naartoe willen, wat we beloven, voor welke branches, tegen wie we verkopen, waarom we winnen en wanneer we terugkomen. Een organisatie zonder SalesDNA moet volledig kunnen werken met een eigen inrichting in dezelfde vorm (0.3). ADR-017: alle functies lezen uit één leesmodel en weten niet welke bron actief is. De koppeling met SalesDNA zelf is P29.

### Gebruikers en niveaus

| Rol | Niveau | Wat |
|---|---|---|
| accountmanager | Beginner | `/richting` lezen; branche als chip op het account; "Zo zeg je het" bij een huidige leverancier |
| accountmanager | Gevorderd | Plus huidige leverancier zetten en erop filteren; branche filteren; "Download concurrentiekaart" (PDF) |
| accountmanager | Expert | Plus voorstellen doen: persoonlijke variant, nieuw bezwaar of antwoord, winpunt per branche, nieuw bewijs, branche-afleiding; elk voorstel gaat naar de salesmanager |
| salesmanager | Gevorderd, Expert | Inrichten en bevestigen; voorstellen van experts beoordelen |
| beheerder | Expert | Inrichten, bron per onderdeel kiezen (P29), mappings beheren (branche naar SBI, SalesDNA-fase naar hoofdfase, verliesreden naar terugkomreden), "Kopieer uit startset" |

F25 noemt bij de route "beheerder en salesmanager" als inrichters en in de alinea per niveau "De beheerder ... vult de eigen inrichting". Niet vastgelegd wie mag bevestigen; voorstel: salesmanager en beheerder.

### Schermen

**Richting** (`/richting`, zijbalkgroep Plannen, op elk niveau lezen)

1. Kop: kicker "RICHTING · VERKOOPVERHAAL", titel "Ons verhaal", rechts de bron ("Eigen inrichting", of na P29 "Uit SalesDNA · bijgewerkt 12 okt") en voor de beheerder "Inrichten".
2. Tabbladen: Verhaal, Richting, Belofte, Branches, Concurrenten, Winpunten, Terugkomen. Elk tabblad toont per onderdeel de status ("Bevestigd · versie 3", "Concept", en na P29 "Mogelijk verouderd in SalesDNA"), het label "Controleren" waar de verouderingsregel geldt, en bij inhoud per branche de dekking ("2 van 4 branches hebben een eigen verhaal").
3. **Verhaal**: kernzin groot, het volledige verhaal, per branche een kaart; zonder eigen verhaal: "Voor Woningcorporaties is nog geen eigen verhaal; je ziet het algemene verhaal." De golden circle (waarom, hoe, wat) staat ook hier. Niet vastgelegd op welk tabblad de golden circle staat; voorstel: bovenaan Verhaal.
4. **Richting**: ambitie, visie, missie; ambitiedoelen als voortgangsbalk ("Projectpartners: 112 van 400, doel 2029"). Niet vastgelegd waar de stand (112) vandaan komt; voorstel: per ambitiedoel een handmatig bijgehouden stand met datum, en waar het doel "aantal klanten" is, de telling van accounts met status klant.
5. **Belofte**: algemeen en per branche, het waardestatement als uitklap "Als de klant doorvraagt".
6. **Branches**: tabel met focus, horizon, termijn, prioriteit, aantal accounts en het aandeel gesprekken van dit kwartaal.
7. **Concurrenten**: per concurrent een kaart met de negen velden (naam, soort, sterk, zwak, onderscheid, "Zo zeg je het", "Als de klant zegt" met antwoord, bewijs, "Wanneer we verliezen"); "Download concurrentiekaart" (PDF, Gevorderd).
8. **Winpunten**: per fase van de reis de winpunten met impact en bewijs; een fase zonder winpunt toont het gat ("Geen winpunt in Signaal en Kennismaking").
9. **Terugkomen**: de twee lijsten (verloren, slapend) met reden, termijn in dagen, kanaal, rollen, aanpak, en per regel het hercontactritme dat start (de ritmes zelf komen in P07; tot dan de naam van het ritme of "Nog geen ritme gekoppeld").
10. Lege staat zonder bevestigd verhaal: "Jullie verkoopverhaal is nog niet vastgelegd." met voor de beheerder de link "Inrichten".

**Instellingen, Verkoop, Verkoopverhaal** (`/instellingen/verkoopverhaal`, beheerder en salesmanager)

- Acht onderdelen met dezelfde veldnamen en keuzewaarden als SalesDNA: golden circle, bedrijfsverhaal, ambitie en visie, waarde en belofte, branches, concurrenten, winpunten, terugkomregels. Per onderdeel status (concept, bevestigd), versienummer, knop "Bevestig" en de bron ("Eigen inrichting"; de keuze voor SalesDNA is P29).
- Minimale velden voor de basiswerking:

| Onderdeel | Minimaal |
|---|---|
| Golden circle | waarom, hoe |
| Bedrijfsverhaal | wie zijn wij (de kernzin wordt afgeleid en is te overschrijven) |
| Ambitie en visie | visie |
| Waarde en belofte | kernbelofte, waardestatement |
| Concurrenten | per regel naam, soort, onderscheid, "Zo zeg je het", "Als de klant zegt" |
| Branches | per regel naam, focus |
| Winpunten | per regel titel, fase, omschrijving, waarom wij hier winnen; hooguit drie op impact hoog |
| Terugkomregels | per regel reden, termijn, kanaal, aanpak |

- Keuzewaarden: branches focus primair of secundair, horizon huidig of toekomstig; concurrent soort direct, indirect, intern (de klant doet het zelf) of niets doen; winpunt impact hoog, midden, laag; terugkomregel lijst verloren of slapend, termijn standaard 30, 61, 91, 182, 365 dagen of "direct" (0).
- **Eigen aanvullingen** (altijd bewerkbaar, ook later bij een gespiegeld onderdeel): SBI-mapping en trefwoorden per branche, termijn als datum, concurrentcontext per branche en regio, winpunt per branche, eigen bewijs (klantcase, cijfer), termijn van een terugkomregel in dagen, mapping van Dealtrace-redenen naar terugkomredenen, ambitiedoelen, stijlprofiel (toon, passende woorden, te vermijden woorden).
- **Mappings**: branche naar SBI en doelgroepen; SalesDNA-fase naar hoofdfase van de reis (Vinden, Bewerken, Verbinden, Klant, Verloren); verliesreden en reden voor nee naar terugkomreden.
- Een nieuwe organisatie krijgt een lege inrichting met de knop "Kopieer uit startset" (Bijlage C), nooit een stille standaard. Bevestiging: "Startset Voltvast kopiëren? Dit vult alle acht onderdelen als concept. Je past ze daarna aan op jullie eigen verhaal." Niet vastgelegd; voorstel voor de tekst. Gekopieerde inhoud staat op concept, niet op bevestigd.
- Automatisch bewaren per veld na 600 ms met "Opslaan…", "Opgeslagen", "Opslaan mislukt" (F22); bevestigen maakt een nieuwe versie met auditregel.
- **AI schrijft nooit een winpunt.** Bij winpunten staat de knop "Help me met vragen": AI stelt vragen ("Waarom kiest een installateur in de woningbouw voor jullie en niet voor de keten?"), de mens schrijft het antwoord. Niet vastgelegd hoe de knop heet en in welke prompt hij komt; voorstel: deze knop in P18 met de Schrijver, in deze prompt nog niet.

**Accountkaart** (uitbreiding van P03): chip "Branche (verkoopverhaal)" naast de SBI-branche; "Huidige leverancier" (keuze uit de concurrenten of "Onbekend"; bij een keuze verschijnen "Zo zeg je het" en "Bewijs"); "Terug op" (datum, reden en aanpak uit de terugkomregel; gevuld door P05). Bij kwalificeren toont "Wanneer we verliezen" de waarschuwing "Let op: hier verliezen we vaak van <concurrent>."

**Telefoon (390 px).** `/richting` staat onder "Meer" (8.4). De tabbladen staan in een eigen horizontaal scrollende strook; de pagina zelf scrolt niet horizontaal. Concurrentkaarten en branchekaarten onder elkaar op volle breedte. Instellingen opent met "Beter op een groot scherm". Niet vastgelegd hoe `/richting` op 390 px is opgebouwd; voorstel: deze opbouw.

### Klikpaden

1. Beheerder van een nieuwe organisatie opent `/richting` en ziet "Jullie verkoopverhaal is nog niet vastgelegd."; hij klikt "Inrichten".
2. In Instellingen klikt hij "Kopieer uit startset", bevestigt; alle acht onderdelen staan op concept met de Voltvast-inhoud.
3. Hij past het bedrijfsverhaal aan; de kernzin wordt afgeleid uit de eerste zin; hij klikt "Bevestig": versie 1, auditregel; `/richting` toont "Bevestigd · versie 1".
4. Hij wijzigt een branche en bevestigt; Concurrenten en Winpunten krijgen het label "Controleren"; de salesmanager kiest bij Concurrenten "Klopt nog" en het label verdwijnt.
5. Een Gevorderde zet op de accountkaart "Huidige leverancier" op "Online webgroothandel"; "Zo zeg je het" en "Bewijs" verschijnen.
6. Een Expert klikt bij een concurrent "Stel antwoord voor"; het voorstel komt als melding bij de salesmanager. Niet vastgelegd waar experts voorstellen indienen; voorstel: knop "Stel voor" per kaart op `/richting`, met beoordeling in Instellingen onder "Voorstellen".

### Regels

- **Alleen bevestigd naar buiten**: scripts, boodschappen en briefings gebruiken de laatst bevestigde versie; concepten zijn alleen zichtbaar in Instellingen.
- **Versies**: elk onderdeel heeft een versienummer; elke bevestiging maakt een nieuwe versie; elk concept, script en verstuurd bericht bewaart de gebruikte versies (`vvVersies`) in `activiteiten.data.vv`.
- **Terugval per branche**: het blok van de branche van het account, anders het algemene onderdeel, met zichtbaar gat.
- **Verouderingsregel eigen inrichting**: wijzigt Branches of de kernbelofte, dan krijgen Concurrenten en Winpunten "Controleren" tot iemand "Klopt nog" kiest of opnieuw bevestigt.
- **Winpuntkeuze**: eerst "Tegen wie we hier winnen" samen met de huidige leverancier, dan impact, dan fase; een weging onder de norm schuift naar achteren (Bijlage C: wp-02 met weging 0,5 komt niet als eerste).
- **Terugkomregel en hercontactritme zijn twee begrippen** (ADR-018); op `/richting` heet het tabblad "Terugkomen".
- **Namenfilter**: elke AI-aanroep met verkoopverhaal plus account- of contactgegevens filtert namen van contactpersonen en klanten in vrije tekst (11.2). Leg de pure functie hier vast; de aanroepen komen in P18 en P23.
- Zonder bevestigd verhaal werkt Dealtrace met vaste teksten en terugvalzinnen van de scripts (P10).

### Helpartikelen

Leerpad bij F25 (F21, collectie "Hoe werkt Dealtrace" en academie), met de inhoud uit het leesmodel van de eigen organisatie:

- "Ons verhaal": kernzin, golden circle, verhaal per branche.
- "Onze belofte": kernbelofte en waardestatement, per branche.
- "Tegen wie we verkopen": concurrenten, "Zo zeg je het", "Als de klant zegt".
- "Eén winpunt per gesprek": waarom één winpunt, hoe Dealtrace het kiest.
- "Wanneer we iemand terugbellen": terugkomregels tegenover hercontactritme.

## Deel 2: Technisch (hoe)

### Datamodel

Migratie `0005_verkoopverhaal`. Elke tabel met `organisation_id`, RLS `org_isolation`.

| Tabel | Kolommen |
|---|---|
| `vv_sublagen` | `onderdeel` (`golden_circle`, `bedrijfsverhaal`, `ambitie`, `waarde`, `branches`, `concurrenten`, `winpunten`, `terugkomregels`), `bron` (`salesdna`, `eigen`), `status` (`concept`, `bevestigd`), `versie`, `bevestigd_op`, `bevestigd_door`, `bijgewerkt_op`, `verouderd`, `controleren` |
| `vv_teksten` | `sublaag`, `sleutel`, `branche_id` of null, `tekst`, `kernzin`, `versie`, `bron`, `extern_id` |
| `vv_branches` | `naam`, `focus`, `horizon`, `termijn`, `prioriteit`, `actief`, `bron`, `extern_id` |
| `vv_concurrenten` | `naam`, `soort`, `data {sterk, zwak, onderscheid, zoZegJeHet, alsDeKlantZegt, antwoord, bewijs, wanneerVerliezen}`, `actief`, `bron`, `extern_id` |
| `vv_fasen` | `naam`, `soort`, `volgorde`, `reis_hoofdfase`, `bron`, `extern_id` |
| `vv_winpunten` | `fase_id`, `titel`, `omschrijving`, `waarom`, `impact`, `concurrent_ids[]`, `context`, `weging`, `actief`, `bron`, `extern_id` |
| `vv_terugkomregels` | `lijst`, `reden`, `termijn`, `termijn_dagen`, `kanaal`, `klassen[]`, `rollen[]`, `aanpak`, `hercontactritme_id`, `bron`, `extern_id` |
| `vv_eigen_opties` | eigen keuzewaarden (bijvoorbeeld termijn "direct") |
| `vv_branche_mapping` | `branche_id`, `sbi_codes[]`, `doelgroep_ids[]`, `trefwoorden[]` |
| `vv_concurrent_context`, `vv_winpunt_branche`, `vv_bewijs`, `vv_varianten`, `vv_ambitiedoelen`, `vv_redenmapping` | eigen aanvullingen, altijd bewerkbaar |
| `vv_versies` | voorstel, niet vastgelegd: `onderdeel`, `versie`, `inhoud jsonb`, `bevestigd_op`, `door`; de geschiedenis van de eigen inrichting (de spiegel heeft `salesdna_sublaag_versies` in P29) |

- Eigen inrichting en spiegel vullen dezelfde tabellen; kolom `bron` en `extern_id` (SalesDNA `_id`, bij eigen inhoud een eigen id) per rij (ADR-017).
- Afgeleid (nachtelijke job, nu alleen de structuur): `nb_branche_stand`, `nb_winpunt_resultaten`, `nb_concurrent_resultaten`, `nb_terugkom_resultaten`. Niet vastgelegd in welke prompt de jobs gaan draaien; voorstel: `nb_branche_stand` hier (nodig voor het aandeel gesprekken op Branches), de andere in P17, P20 en P21.
- Gebruik op accounts: `vv_branche_id`, `huidige_leverancier_id`, `terug_op`, `terug_regel_id` (kolommen uit P03).
- Rechten: lezen iedereen; schrijven en bevestigen salesmanager en beheerder; mappings en bronkeuze beheerder. Sync-allowlist: geen `vv_*`-tabellen (alleen online inrichten); `accounts` blijft erin voor `huidige_leverancier_id`.

### Pure functies (`shared/verkoopverhaal.ts`)

| Functie | Invoer | Uitvoer | Randgevallen en unit-tests (uit Bijlage C) |
|---|---|---|---|
| `verhaalVoor(account, leesmodel)` | account met `vv_branche_id` | `{tekst, kernzin, brancheBlok: boolean, versie}` | br-01 eigen verhaal; br-03 terugval op algemeen met gat (C.9 punt 1) |
| `beloftevoor(account, leesmodel)` | account | `{kernbelofte, waardestatement, brancheBlok, versie}` | br-01 eigen blok; br-02 terugval (dekking "1 van 4") |
| `kiesWinpunt(account, fase, concurrent, leesmodel)` | account, fase, huidige leverancier | winpunt of `{gat: true, terugval}` | fase Signaal: geen winpunt, gat zichtbaar en wp-01 als belofte (C.9 punt 3); wp-02 met weging 0,5 nooit eerst (C.9 punt 4); testvariant wp-01 met cc-01 en cc-02 wint bij huidige leverancier cc-02 (C.9 punt 2) |
| `dekking(onderdeel, leesmodel)` | onderdeel | `{met, totaal, tekst}` | "2 van 4" voor bedrijfsverhaal, "1 van 4" voor waarde en belofte |
| `terugkomDatum(reden, regels, nu, afkoeling?)` | reden, regels, ISO-datum | `{datum, regel}` | termijn 0 ("direct"); 182 dagen bij "Prijs te hoog"; de afkoelperiode als ondergrens volgt in P05 |
| `kernzin(tekst)` | verhaal | eerste dragende zin | tekst zonder punt; afkortingen als "o.a." |
| `moetControleren(wijziging)` | onderdeel dat wijzigde | onderdelen die "Controleren" krijgen | branches en kernbelofte; een ander onderdeel niets |
| `filterNamen(tekst, namen)` | vrije tekst, namen van contacten en klanten | tekst met namen vervangen door rol | hoofdletters, tussenvoegsels, naam als deel van een woord |

### Projectie

`server/utils/vvProjectie.ts` met per sublaag één functie van eigen inrichting naar leesmodel (de functie van spiegel naar leesmodel komt in P29). Upsert op `extern_id`; verdwenen ids op `actief=false`; verwijzingen in accounts blijven op id. Zelfde seed als eigen inrichting en als spiegel moet hetzelfde leesmodel geven (ADR-017); de vergelijking zelf toets je in P29.

### Endpoints

| Methode en route | Recht | Invoer | Uitvoer | Fouten |
|---|---|---|---|---|
| `GET /api/richting` | ingelogd | | leesmodel (alleen bevestigd) met status, versies, dekking, labels | |
| `GET /api/instellingen/verkoopverhaal/:onderdeel` | salesmanager, beheerder | | concept en laatst bevestigde versie | 404 onbekend onderdeel |
| `PUT /api/instellingen/verkoopverhaal/:onderdeel` | salesmanager, beheerder | inhoud (patch) | concept | 422 minimale velden ontbreken bij bevestigen; 422 meer dan drie winpunten op impact hoog; 409 bij een gespiegeld onderdeel (vanaf P29) |
| `POST /api/instellingen/verkoopverhaal/:onderdeel/bevestig` | salesmanager, beheerder | | nieuwe versie | 422 met de ontbrekende velden |

Niet vastgelegd in het bouwplan; voorstel:

| Methode en route | Recht | Doel |
|---|---|---|
| `POST /api/instellingen/verkoopverhaal/startset` | beheerder | "Kopieer uit startset" als concept; 409 als er al bevestigde inhoud is |
| `POST /api/instellingen/verkoopverhaal/:onderdeel/klopt-nog` | salesmanager, beheerder | label "Controleren" weg zonder nieuwe versie |
| `GET/PUT /api/instellingen/verkoopverhaal/mappings` | beheerder | branche naar SBI, fase naar hoofdfase, reden naar terugkomreden |
| `POST /api/richting/voorstel` | Expert | voorstel aan de salesmanager |
| `GET /api/richting/concurrentiekaart.pdf` | Gevorderd | PDF van de concurrentkaarten, alleen bevestigde inhoud |

### AI-stappen

Geen in deze prompt. Stijlprofiel "door AI voorgesteld uit het verhaal" (F22) en kanaalvarianten (F25, AI maakt ze als concept) komen met de Schrijver in P18; hier vul je ze met de hand. Niet vastgelegd in welke prompt; voorstel: P18.

### Startset

`seed/voltvast.json` met alle inhoud uit Bijlage C (C.2 tot en met C.8), geladen door `db/seed/voltvast.ts`. De seed laadt als eigen inrichting (bron `eigen`) via "Kopieer uit startset", en dient in P29 als fixture voor de webhook-mock. De testvariant van wp-01 (met cc-01 en cc-02) en die van hc-03 (klasse A) zijn apart te laden. Neem de teksten letterlijk over; verander geen bron- of aangevulde tekst.

### Functiecatalogus

| Sleutel | Niveau | Pakket | Recht | Helpartikel |
|---|---|---|---|---|
| `richting.lezen` | Beginner | Starter | iedereen | "Ons verhaal" |
| `richting.concurrentiekaart` | Gevorderd | Starter | iedereen | "Tegen wie we verkopen" |
| `account.huidigeLeverancier` | Gevorderd (zetten), Beginner (lezen) | Starter | iedereen | "Tegen wie we verkopen" |
| `richting.voorstellen` | Expert | Starter | iedereen | "Ons verhaal" |
| `verkoopverhaal.inrichten` | Gevorderd | Starter | salesmanager, beheerder | "Ons verhaal" |
| `verkoopverhaal.mappings` | Expert | Starter | beheerder | "Ons verhaal" |

Pakket: het bouwplan legt per functie geen pakket vast; voorstel Starter, omdat het verkoopverhaal de basis is van scripts op elk pakket.

### Hergebruik uit DealDrive

Geen bestanden uit Bijlage B voor het verkoopverhaal. Gebruik het patroon van `settingsStore.ts` (bewaren per veld) en `auditStore.ts`.

### Buiten scope

De SalesDNA-koppeling, spiegel, webhooks en bronkeuze per onderdeel (P29); suggesties naar SalesDNA (P23); AI-vragen bij winpunten, stijlprofiel en kanaalvarianten (P18); het zetten van "Terug op" bij nee, verlies of slapen (P05, P12, P17); de koppeling van een terugkomregel aan een hercontactritme (P07, P12); de tien weergaven, kaders, meekijkronde en Kwartaal check van SalesDNA.

## Acceptatiecriteria

1. Een organisatie zonder SalesDNA vult haar verhaal in en `/richting` toont het (sprint-3-toestand, eerste helft).
2. Een nieuwe organisatie heeft een lege inrichting; `/richting` toont "Jullie verkoopverhaal is nog niet vastgelegd."; er is geen stille standaard.
3. "Kopieer uit startset" vult alle acht onderdelen als concept met de letterlijke Voltvast-inhoud uit Bijlage C.
4. Bevestigen zonder de minimale velden geeft 422 met de ontbrekende velden; een vierde winpunt op impact hoog wordt geweigerd.
5. `GET /api/richting` geeft alleen bevestigde inhoud; een concept is daar niet zichtbaar.
6. Bijlage C.9, punt 1: een prospect in br-03 krijgt verhaal en belofte van algemeen, met zichtbaar gat; dekking "2 van 4" en "1 van 4" klopt.
7. Bijlage C.9, punt 2: een prospect in br-01 met huidige leverancier cc-02 krijgt kernzin, belofte van br-01, winpunt wp-01 en het bezwaar "Online is het goedkoper." met antwoord.
8. Bijlage C.9, punt 3: fase Signaal geeft geen winpunt; het gat is zichtbaar en wp-01 dient als belofte.
9. Bijlage C.9, punt 4: wp-02 (weging 0,5) is nooit het eerste winpunt.
10. Bijlage C.9, punt 6 (eigen inrichting): br-02 hernoemen laat koppelingen op accounts staan en verandert de naam overal.
11. Bijlage C.9, punt 9 (pure functie): `filterNamen` haalt een contactnaam uit vrije tekst; de toets op een echte AI-aanroep volgt in P18 en P23.
12. Branches of kernbelofte wijzigen zet "Controleren" op Concurrenten en Winpunten; "Klopt nog" haalt het weg.
13. Elke bevestiging maakt een versie met auditregel; `vv_versies` bewaart de inhoud.
14. Een Beginner leest `/richting` maar ziet geen "Download concurrentiekaart"; een Gevorderde wel; een Expert ziet "Stel voor"; alleen salesmanager en beheerder zien "Inrichten". Getest per niveau Beginner, Gevorderd en Expert.
15. Op 390 px geen horizontale paginascroll op `/richting`; tabstrook en knoppen minimaal 44 px.
16. Bijlage A, gat 16: alle keuzes en terugvallen van het verkoopverhaal staan één keer in `shared/verkoopverhaal.ts`; geen functie leest elders uit eigen tabellen of de spiegel (ADR-017).

## Definition of Done

Hoofdstuk 19 geldt volledig. Specifiek voor deze prompt:

- Unit-tests voor elke functie in `shared/verkoopverhaal.ts` met de Voltvast-seed als fixture.
- Wegwerp-Postgres: seed laden als eigen inrichting, projectie naar `vv_*`, cross-tenant (organisatie B ziet het verhaal van A niet).
- Playwright: `/richting` op desktop en 375, 390, 412 px; inrichten en bevestigen op desktop.
- De vijf helpartikelen uit het leerpad staan in `content/help/` en lezen hun voorbeeld uit het leesmodel van de eigen organisatie.
- Testdata alleen uit Bijlage C; geen inhoud van Sales Legends of een echt bedrijf.
