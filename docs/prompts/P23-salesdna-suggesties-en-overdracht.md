# P23: Suggesties naar SalesDNA en overdracht naar DealDrive

| Onderdeel | Waarde |
|---|---|
| Sprint | 11 (Sturen en maatwerk) |
| Features | F25 Verkoopverhaal en Richting: suggesties terug naar SalesDNA (kader 2); hoofdstuk 12: integraties SalesDNA (uitgaand) en DealDrive (de echte HTTP-adapter op het voorbereide contract: overdracht na de eerste afspraak, ontdubbelen, terugmeldingen voor de funnel en winback, B21) |
| Hangt af van | P01 (rechten, audit), P17 Funnel van de prospectreis en overdracht (knop "Overdragen?", status `overgedragen`, tabel `overdrachten`, `overdrachtPakket`, `POST /api/accounts/:id/overdragen`, de adapter `dealdriveAdapter.ts` met de uitvoering `mock`), P18 (briefing "Overdracht"), P19 (Notulist herkent concurrenten en bezwaren), P20 (patroon `koppelingen` en `koppeling_runs`, doel CRM), P21 (Team, Goedkeuringen; afgeleide tabellen `nb_*`; Coach), P24 (founder richt de DealDrive-koppeling in), P28 (leesmodel `vv_*`, eigen aanvullingen, `vv_redenmapping`), P29 (SalesDNA-koppeling, webhook-ontvanger met HMAC, `salesdna_koppeling`), P04 en P11 (ontdubbelen bij import en in de leadgenerator), P12 (terugkomregels, slapende klanten), P33 AI-assistent en credits (credits voor de Coach) |
| Bron in het bouwplan | F25 ("Suggesties terug naar SalesDNA", "Per niveau", "Eigen aanvullingen", technisch deel "Uitgaand" en "Suggesties"); hoofdstuk 12 (rijen SalesDNA en DealDrive); F17 (De overdracht na de eerste afspraak, technisch deel "Koppeling met DealDrive"); F03 (Overdragen); F13 (terugkomregels, slapende klanten, "Stel wijziging voor"); F14 (Coach bundelt wekelijks); F20 ("de wekelijkse bundel suggesties naar SalesDNA vrijgeven"); 7.2 (status `overgedragen`, winback); 7.3 (terugkomregel na verlies of slapen); 11.2 (namenfilter); 13.5 (lokaal bouwen met mocks); 15.2 (AVG); B21; ADR-002; ADR-021; open vragen 22, 23 en 27; Bijlage C.9 punt 9; `docs/api/dealdrive-koppeling.md` en `docs/api/dealdrive-koppeling.openapi.yaml`; `seed/dealdrive-mock/` |

## Lees eerst

- Bouwplan-Dealtrace.md: F25 volledig (vooral de alinea "Suggesties terug naar SalesDNA", de tabel "Per niveau" en de technische punten Uitgaand, Suggesties en Webhook-ontvanger), hoofdstuk 12 (rijen SalesDNA en DealDrive, en de slotalinea), F17 (De overdracht na de eerste afspraak, Koppeling met DealDrive), F03 (Overdragen), F13 (Terugkomregels, rapport per ritme met "Stel wijziging voor"), F14 ("Uit het verkoopverhaal"), F20 ("Uit het verkoopverhaal"), 7.2, 7.3, 11.2, 13.5, 15.2 (rij Suggesties naar SalesDNA), 15.3 (webhooks met HMAC, tijdvenster en replay-bescherming), B21, ADR-002, ADR-017, ADR-021, open vragen 22, 23 en 27, Bijlage C.
- `docs/api/dealdrive-koppeling.md` volledig: de vier stromen (overdracht, ontdubbelen, terugmeldingen, winback-signaal), de afspraken voor beide kanten (ondertekening, tijd, herkomst, idempotentie, opnieuw proberen, foutcodes), de veldtoewijzing naar de DealDrive-typen, hoofdstuk 7 "Voorbereiding in Dealtrace" en hoofdstuk 9 "Open punten".
- `docs/api/dealdrive-koppeling.openapi.yaml`: de machineleesbare versie met `overdragen`, `overdrachtStand`, `zoekAccount`, `terugmelding` en `ping`, de schema's en de beveiliging `handtekening`.
- `seed/dealdrive-mock/` (README en de JSON-bestanden): de vaste antwoorden voor de mock en de fixtures voor de contracttests.
- DealDrive op commit 75bee61, ter oriëntatie op de ontvanger (de ontvangende kant bestaat in DealDrive nog niet; dat is een bekende afhankelijkheid, open vraag 27, geen blokkade voor deze prompt):
  - `app/types/entities.ts` (veldnamen van `Account`, `Contact` en `Deal` aan de DealDrive-kant, gebruikt in de veldtoewijzing van het contract)
  - `server/api/hooks/github/wens.post.ts` (voorbeeld van een gesigneerde inkomende hook)

## Deel 1: Functioneel (wat en waarom)

### Wat je bouwt

Twee stromen naar buiten en één naar binnen: een wekelijkse bundel suggesties met bewijs van Dealtrace naar kader 2 van de juiste SalesDNA-sublaag, die de salesmanager vrijgeeft; de echte HTTP-adapter voor de DealDrive-koppeling volgens het contract in `docs/api/` (overdracht na de eerste afspraak, ontdubbelen tegen DealDrive, stand van een overdracht, ping); en de webhook-ontvanger voor de terugmeldingen uit DealDrive (`overdracht.verwerkt`, `deal.gewonnen`, `deal.verloren`, `klant.slapend`), met contracttests die de mock en de echte adapter allebei moeten halen. De overdrachtsflow zelf (de vraag "Overdragen?", de status `overgedragen`, de briefing "Overdracht", de mock) zit in P17 en P18.

### Waarom

Wat Dealtrace in de praktijk leert (een concurrent die vaak voorkomt maar ontbreekt, een bezwaarantwoord dat aantoonbaar werkt, een branche zonder eigen belofte) hoort terug te gaan naar de bron van het verkoopverhaal, zonder dat Dealtrace zelf in SalesDNA schrijft (ADR-002: alleen suggesties in kader 2). En Dealtrace loopt tot en met de eerste afspraak (B17, ADR-021): daarna gaat het account naar DealDrive, waar de deal, de offerte en de klantrelatie ontstaan. De terugmeldingen maken de funnel na de overdracht compleet ("gewonnen na overdracht") en brengen een verloren deal of een slapende klant via de terugkomregels terug als winback-kandidaat (7.2, 7.3). Het contract is voorbereid (B21); zolang DealDrive de ontvangende kant niet heeft, staat de koppeling op mock (ontwikkeling en tests) of uit (klanten).

### Gebruikers en niveaus

| Rol | Niveau | Wat |
|---|---|---|
| accountmanager | Beginner | Kiest bij "Overdragen?" (P17) DealDrive als de koppeling aan staat; ziet daarna "Overgedragen aan DealDrive" op de accountkaart en de vraag bij een bedrijf dat al klant is; ziet bij import en in de leadgenerator de pil "Al klant in DealDrive"; geen suggesties |
| accountmanager | Gevorderd | Beantwoordt na een terugmelding `deal.gewonnen` "Mag dit een bewijs worden?" |
| accountmanager | Expert | Draagt voorstellen aan (nieuw bezwaar of antwoord, context per branche, winpunt per branche, nieuw bewijs, persoonlijke variant); elk voorstel gaat eerst naar de salesmanager |
| salesmanager | rol | Beoordeelt de wekelijkse bundel suggesties, past tekst aan, geeft vrij of wijst af; ziet de status uit SalesDNA; ziet in de funnel "gewonnen na overdracht" van zijn team |
| beheerder | rol | Ziet de stand van de uitgaande suggesties en van de DealDrive-koppeling in Instellingen, Koppelingen, met "Test verbinding" en de lijst mislukte overdrachten |
| founder | rol | Richt de DealDrive-koppeling per organisatie in (hoofdstuk 12: "Wie richt in: founder") en zet de stand op uit, mock of aan |

### Schermen

**1. Suggesties naar SalesDNA.** Het bouwplan legt vast dat de salesmanager de wekelijkse bundel vrijgeeft (F20, F25), niet waar. Niet vastgelegd; voorstel: in `/team` onder "Goedkeuringen" een regel "Suggesties naar SalesDNA · week 46 · 7 suggesties" die een flyout (640 px) opent.

Opbouw van de flyout van boven naar beneden (voorstel):

1. Kop: kicker "SUGGESTIES NAAR SALESDNA · WEEK 46", titel "7 suggesties wachten op je besluit.", meta "Hooguit 10 per sublaag per week. Zonder namen van personen of prospects."
2. Per sublaag een groep (Concurrenten, Winpunten, Waarde en belofte, Terugkomregels, Branches) met per suggestie: soort, tekst, bewijs (aantallen en geanonimiseerde citaten), het veld en de regel in SalesDNA waar hij hoort, en de knoppen "Geef vrij", "Pas aan", "Wijs af".
3. Voet: "Geef alles vrij" (geel), "Later".

Voorbeelden van suggesties uit F25: een concurrent die vaak in verslagen voorkomt maar ontbreekt; een antwoord op een bezwaar dat aantoonbaar werkt; "38 gesprekken in Utiliteitsinstallateurs dit kwartaal, nog geen eigen belofte"; opbrengst per terugkomregel; winpuntresultaten.

Statussen per suggestie (voorstel, de waarden van `salesdna_suggesties.status` zijn niet vastgelegd): "Concept", "Vrijgegeven", "Verstuurd", "Overgenomen in SalesDNA", "Afgewezen in SalesDNA", "Afgewezen", "Mislukt".

**2. Stand in Instellingen.** In Instellingen, Verkoop, Verkoopverhaal per onderdeel een regel "Suggesties: 3 verstuurd, 1 overgenomen" met link naar de lijst (voorstel). Lege staat: "Er zijn deze week geen suggesties. Dealtrace stelt pas iets voor als er genoeg bewijs is." (voorstel).

**3. Zonder SalesDNA-koppeling.** Niet vastgelegd in het bouwplan wat er dan met suggesties gebeurt; voorstel: dezelfde bundel verschijnt als voorstel voor de eigen inrichting (taak voor de beheerder met link naar het onderdeel), zonder verzenden.

**4. Overdracht naar DealDrive** (de knop en de bevestiging bouwt P17; deze prompt levert wat er na de keuze DealDrive gebeurt).

- Na "Overdragen?" met keuze DealDrive: toast in verleden tijd "Testbrontsma Installatietechniek is overgedragen aan DealDrive." Op de accountkaart een regel in het blok Ritme of de statstrook: "Overgedragen aan DealDrive op 15 oktober 2026 · Eva Dijkstra" met de link uit het antwoord (`dealdrive.url`); plaats niet vastgelegd, voorstel. Na `overdracht.verwerkt` verandert de pil van "Verstuurd" naar "Bevestigd".
- Is het bedrijf in DealDrive al klant (`409 al_klant`), dan een bevestiging met de vraag als titel uit het contract: "Dit bedrijf is al klant in DealDrive. Overdragen als nieuwe kans bij een bestaande klant?" met "Ja, draag over" en "Annuleer". "Ja" stuurt hetzelfde pakket met `alsNieuweKansBijKlant: true`.
- Lukt de overdracht niet na de laatste poging, dan een taak voor de eigenaar "Overdracht naar DealDrive mislukt" met de reden in gewone taal, "Opnieuw proberen" en "Download briefing"; de beheerder krijgt een melding. Het account blijft `overgedragen`; de overdracht staat op `mislukt`.
- Staat de koppeling uit, dan biedt "Overdragen?" (P17) DealDrive niet aan en werkt de overdracht met een overdrachtstaak en de briefing om te mailen of te downloaden.
- Na `deal.gewonnen` krijgt de accountmanager een melding met de vraag "Mag dit een bewijs worden?" ("Ja", "Nee"); "Ja" maakt een klantcase-voorstel voor de kennisbank of een suggestie naar SalesDNA (F25). Het account blijft `overgedragen`; Dealtrace maakt geen klant (B17).

**5. Ontdubbelen tegen DealDrive.** In de importwizard (P04) en de leadgenerator (P11) een pil "Al klant in DealDrive" of "Prospect in DealDrive · Eva Dijkstra" bij een treffer uit `zoekAccount`, met de zekerheid (KvK, domein of naam) als meta. Een account dat al klant is in DealDrive wordt niet benaderd tenzij de salesmanager het toestaat (contract hoofdstuk 4).

**6. Koppeling DealDrive inrichten.** Niet vastgelegd waar in het scherm; voorstel: in Platformbeheer, klantflyout (P24), blok "Koppelingen" met basis-URL van DealDrive, `dealdriveOrganisatieId`, gedeeld geheim (schrijf-alleen, vingerafdruk van acht tekens), de stand ("Uit", "Mock", "Aan"), "Test verbinding" (`GET /ping`) en de laatste runs. De beheerder ziet in Instellingen, Koppelingen alleen de stand ("Gekoppeld met DealDrive · laatste overdracht 15 oktober 2026" of "Nog niet beschikbaar: DealDrive bouwt de ontvangende kant.") en "Test verbinding".

**7. Telefoonweergave op 390 px.** De suggestieflyout opent als schuifvenster tot 92 procent van de schermhoogte met de knoppen plakkend onderaan; de salesmanager kan per suggestie "Geef vrij" of "Wijs af" met één tik (8.12: goedkeuringen van het team op de telefoon). De toast na de overdracht verschijnt als meldingsstrook boven de onderbalk; de vraag bij `409 al_klant` opent als schuifvenster. Het inrichten van de DealDrive-koppeling hoort bij Platformbeheer en toont "Beter op een groot scherm".

### Klikpaden

1. **Bundel maken.** De wekelijkse job (`netlify/functions/week`, lokaal met `pnpm motor`) leest de afgeleide tabellen en verslagen, maakt per sublaag hooguit 10 suggesties, haalt ze door het namenfilter en zet ze op "Concept". De salesmanager krijgt een melding (soort niet vastgelegd; voorstel: soort "Concept klaar ter goedkeuring").
2. **Vrijgeven.** De salesmanager opent de flyout, past een tekst aan, klikt "Geef vrij" bij vijf en "Wijs af" bij twee; daarna "Verstuur" of automatisch bij het sluiten (voorstel: versturen direct na "Geef alles vrij" of per suggestie na "Geef vrij").
3. **Versturen.** Dealtrace stuurt de vrijgegeven suggesties met HMAC naar SalesDNA; status "Verstuurd".
4. **Status terug.** SalesDNA stuurt `suggestie.status`; de webhook-ontvanger uit P29 zet "Overgenomen in SalesDNA" of "Afgewezen in SalesDNA". Wordt een sublaag daarna bevestigd, dan komt de nieuwe versie via `sublaag.bevestigd` binnen (P29).
5. **Overdracht.** Na een gehouden eerste afspraak met vervolg kiest de accountmanager bij "Overdragen?" DealDrive (P17). P17 zet in één transactie status `overgedragen`, fase "Overgedragen", audit en een rij in `overdrachten`; daarna roept een job de adapter aan: `POST /overdrachten` met het pakket uit `overdrachtPakket`, `Idempotentie-Sleutel` gelijk aan het `overdrachtId` en de handtekening. Antwoord 201: `overdrachten.status` wordt `verstuurd`, `extern_id` wordt `dealdrive.accountId`, de link komt op de accountkaart. De terugmelding `overdracht.verwerkt` zet de status op `bevestigd`.
6. **Al klant.** DealDrive antwoordt `409 al_klant`; de accountmanager ziet de vraag en kiest "Ja, draag over"; Dealtrace stuurt hetzelfde pakket met `alsNieuweKansBijKlant: true`.
7. **Deal gewonnen.** DealDrive meldt `deal.gewonnen`; het account blijft `overgedragen`; de funnel en de analyse tellen "gewonnen na overdracht" per doelgroep, campagne en persoon; de accountmanager krijgt "Mag dit een bewijs worden?".
8. **Deal verloren.** DealDrive meldt `deal.verloren` met reden "Prijs" en `verlorenAan` "Online webgroothandel" (cc-02, Voltvast); de reden gaat via `vv_redenmapping` naar een terugkomregel; het account komt op de terugkomdatum met kanaal en rol uit de regel terug in een reis (7.3).
9. **Winback.** DealDrive meldt `klant.slapend` met `maandenNietBesteld` 6; Dealtrace maakt er een herwinaccount van met de terugkomregel "6 maanden niet besteld" (Voltvast hc-04) en de motor start op de terugkomdatum het hercontactritme.

### Regels

**Suggesties**

- Altijd met aantallen; citaten alleen na het namenfilter en geanonimiseerd; nooit namen van personen of prospects (F25, 11.2, 15.2).
- Hooguit 10 suggesties per sublaag per week (hoofdstuk 12, open vraag 23).
- Vrijgave door de salesmanager; SalesDNA verandert niets zonder besluit.
- Alleen naar kader 2 van de juiste sublaag; Dealtrace schrijft nooit elders in SalesDNA (ADR-002).
- Alles wat een Expert aandraagt, is eerst een voorstel aan de salesmanager (F25 "Per niveau").
- AI schrijft nooit een winpunt; een suggestie over winpunten is een resultaat met cijfers of een vraag, nooit een nieuwe winpunttekst (11.2).
- Drempels voor "aantoonbaar werkt" en "vaak voorkomt" zijn niet vastgelegd; voorstel: een bezwaarantwoord pas bij minimaal 30 gesprekken met dat bezwaar en een hogere afspraakconversie dan zonder het antwoord; een ontbrekende concurrent pas bij minimaal 5 verslagen in 90 dagen; een branche zonder belofte bij minimaal 20 gesprekken in het kwartaal.
- Bijlagen van winpunten: eerst alleen metadata (open vraag 22).

**DealDrive-koppeling** (het contract in `docs/api/` is de bron; wijkt deze prompt ervan af, dan geldt het contract)

- Stand per organisatie: `uit`, `mock` of `aan`. Zolang DealDrive de ontvangende kant niet heeft (open vraag 27), staat de koppeling op `mock` voor ontwikkeling en tests en op `uit` voor klanten. Met `uit` maakt Dealtrace bij een overdracht een overdrachtstaak plus de briefing om te mailen of te downloaden (F17).
- De overdracht in Dealtrace (status, fase, audit) staat los van de verzending: een storing bij DealDrive draait de overdracht niet terug; de verzending loopt in een job.
- Pakket volgens `POST /overdrachten` van het contract: account, contacten, eerste afspraak met verslag, vervolgstap, kwalificatie (BAND), verkoopverhaal (branche, winpunt ingezet, bezwaren), briefing "Overdracht" in Markdown, reisgeschiedenis, dossier en een dealvoorstel; verplichte velden zoals in het contract. Geen deals of offertes uit Dealtrace: de deal maakt DealDrive.
- Ondertekenen in beide richtingen: `X-Koppeling-Handtekening: sha256=<hex>` (HMAC-SHA256 met het gedeelde geheim over `<X-Koppeling-Tijd>.<ruwe body>`), `X-Koppeling-Tijd` met hooguit 5 minuten verschil, `X-Koppeling-Organisatie`.
- Idempotentie: elk schrijvend verzoek draagt `Idempotentie-Sleutel`; bij een overdracht is dat het `overdrachtId`; een tweede verzending van dezelfde overdracht maakt in DealDrive geen tweede account of deal. Elke terugmelding heeft een uniek `gebeurtenisId` en wordt hooguit één keer verwerkt.
- De webhook-ontvanger antwoordt binnen 5 seconden met 2xx en verwerkt in een job; een gebeurtenis voor een onbekend `dealtraceAccountId` geeft `404 account_onbekend`.
- Opnieuw proberen bij een time-out of 5xx na 1, 5 en 30 minuten, 2 en 12 uur; daarna `mislukt`, een taak voor de eigenaar en een melding bij de beheerder. Blijft `overdracht.verwerkt` uit, dan vraagt een job de stand op met `GET /overdrachten/{overdrachtId}`.
- Foutcodes uit het contract (`handtekening_ongeldig`, `tijd_verlopen`, `koppeling_uit`, `organisatie_onbekend`, `account_onbekend`, `ongeldige_invoer`, `al_klant`, `te_veel_verzoeken`, `interne_fout`) krijgen elk een melding in gewone taal op de koppelingenpagina en in de taak.
- Terugmeldingen: `overdracht.verwerkt` zet de overdracht op `bevestigd`; `deal.gewonnen` laat het account `overgedragen` en telt in de funnel; `deal.verloren` gaat via `vv_redenmapping` naar een terugkomregel; `klant.slapend` maakt een herwinaccount volgens de lijst "slapend" (3, 6 of 12 maanden); `account.eigenaar-gewijzigd` werkt alleen de informatie op de kaart bij; `ping` test de koppeling.
- Ontdubbelen: `GET /accounts/zoek` op KvK, domein en naam; antwoorden 24 uur in de cache per sleutel; vóór een overdracht altijd, zodat een `409 al_klant` zelden voorkomt.
- Persoonsgegevens: alleen zakelijke gegevens; privémail en privémobiel gaan niet mee; logs bewaren geen body, alleen ids en een hash (contract hoofdstuk 2, 15.2).

### Helpartikelen

- "Wanneer we iemand terugbellen" (F25, collectie New business) aanvullen met winback na een verloren deal of een slapende klant in DealDrive.
- "Een goede overdracht" (academie, categorie Van afspraak naar overdracht): wat er bij "Overdragen?" naar DealDrive gaat, wat DealDrive ermee doet en wat je terugziet.
- "Koppelingen" (categorie Inrichten) aanvullen met de DealDrive-koppeling: de stand uit, mock of aan, "Test verbinding" en wat een mislukte overdracht betekent.
- "Verbetervoorstellen beoordelen" (voor de salesmanager) aanvullen met de suggesties naar SalesDNA.

## Deel 2: Technisch (hoe)

### Datamodel

- `salesdna_suggesties (id, organisation_id, onderwerp_id, veld, regel_extern_id, soort, tekst, bewijs, status, verstuurd_op)` (F25). Voorstel aanvullend: `week` (ISO-week, bijvoorbeeld `2026-W46`), `vrijgegeven_door`, `vrijgegeven_op`, `extern_status_op`, `fout`.
- `overdrachten: id, organisation_id, account_id, naar ('dealdrive'|'crm'|'collega'), naar_gebruiker_id?, extern_id?, status ('klaar'|'verstuurd'|'bevestigd'|'mislukt'), pakket jsonb, op, door` (F17, gebouwd in P17). Voorstel aanvullend voor de verzending: `pogingen`, `volgende_poging_op`, `laatste_fout {code, bericht}`, `pakket_hash`.
- `accounts.data.extern.dealdrive {accountId, url, overgedragenOp, eigenaar}` (voorstel) voor de link op de kaart.
- Koppeling: `koppelingen.soort = 'dealdrive'` met `geheimen` (gedeeld geheim van 32 bytes, AES-256-GCM met een eigen geheim voor dit doel) en `instellingen {basisUrl, dealdriveOrganisatieId, stand ('uit'|'mock'|'aan')}`; `koppeling_runs` voor het logboek (ids en hash, geen body).
- `dealdrive_gebeurtenissen: gebeurtenis_id (uniek), organisation_id, soort, ontvangen_op, verwerkt_op, fout` (contract hoofdstuk 7).
- Ontdubbelcache: niet vastgelegd; voorstel `dealdrive_zoekcache: organisation_id, sleutel, antwoord jsonb, verloopt_op` (24 uur).
- RLS `org_isolation` op alle tabellen; uitgaande suggesties, overdrachten en terugmeldingen alleen via de server; de webhook-ontvanger bepaalt de organisatie uit de koppeling en de handtekening, nooit uit de body alleen.
- Rechtenmatrix: suggesties lezen en vrijgeven salesmanager voor zijn teams en beheerder; overdragen iedereen met schrijfrecht op het account (P17); koppeling inrichten founder; stand en "Test verbinding" beheerder.
- Sync-allowlist: geen van deze tabellen in de sync; `accounts.data.extern` gaat mee met het account.

### Pure functies

| Functie | Invoer | Uitvoer | Randgevallen en tests |
|---|---|---|---|
| `naarContract(pakket)` | pakket uit `overdrachtPakket(account)` (F17, P17) | body van `POST /overdrachten` volgens de OpenAPI-specificatie | verplichte velden ontbreken; privémobiel weggelaten; geen offertes of deals; deterministische volgorde voor de hash |
| `bundelSuggesties(kandidaten, max)` | kandidaten per sublaag | hooguit 10 per sublaag, sterkste bewijs eerst | precies 10 en 11; lege sublaag |
| `filterNamen(tekst, namen)` | vrije tekst, namen van contacten en accounts | tekst zonder namen | vastgelegd als vangrail in 11.2; naam als deel van een woord; hoofdletters; Bijlage C.9 punt 9 |
| `kandidatenConcurrent(verslagen, concurrenten)` | verslagen, leesmodel | ontbrekende concurrenten met aantal | drempel; naam al bekend |
| `kandidatenBezwaar(bezwaren, conversies)` | `nb_bezwaren`, conversies | antwoorden die werken | minder dan 30 gesprekken |
| `kandidatenBrancheBelofte(brancheStand, leesmodel)` | `nb_branche_stand` | branches zonder eigen belofte | Voltvast br-02 heeft geen eigen blok in L0.4 (C.5) |
| `tekenVerzoek(body, geheim, tijd)` en `controleerHandtekening(headers, ruweBody, geheim, nu)` | ruwe body, `X-Koppeling-Tijd` | `sha256=<hex>` of `{geldig, fout}` | tijdverschil precies 5 minuten en daarboven; andere body; ontbrekende header |
| `volgendePoging(pogingen, nu)` | aantal pogingen | tijdstip of `mislukt` | schema 1, 5, 30 minuten, 2 en 12 uur; zesde poging |
| `verwerkTerugmelding(gebeurtenis, account, regels)` | terugmelding, account, terugkomregels | acties (status overdracht, funnelteller, terugkomregel, herwinaccount) | onbekend account; dubbel `gebeurtenisId`; `deal.verloren` zonder `verlorenAan`; `klant.slapend` met 3, 6 en 12 |
| `foutNaarMelding(code)` | foutcode uit het contract | melding in gewone taal | onbekende code valt terug op `interne_fout` |

Namen van `bundelSuggesties`, `kandidaten*`, `naarContract`, `volgendePoging`, `verwerkTerugmelding` en `foutNaarMelding` zijn niet vastgelegd; voorstel.

### Endpoints

| Methode en route | Recht | Invoer | Uitvoer | Fouten |
|---|---|---|---|---|
| `GET /api/salesdna/suggesties?week=` | salesmanager, beheerder | week | suggesties per sublaag | niet vastgelegd; voorstel |
| `PUT /api/salesdna/suggesties/:id` | salesmanager | `{tekst?, besluit}` met besluit `vrij` of `af` | suggestie | 422 als de tekst na aanpassen een naam bevat (namenfilter opnieuw) |
| `POST /api/salesdna/suggesties/verstuur` | salesmanager | `{ids}` | aantallen | 409 zonder koppeling; 429 boven 10 per sublaag per week |
| `POST {salesdna}/api/koppelingen/dealtrace/suggesties` | uitgaand, HMAC | bundel | ontvangstbevestiging | vastgelegd in F25 |
| `POST /api/koppelingen/salesdna/webhook` (P29) | SalesDNA, HMAC | `suggestie.status` | 2xx binnen 5 seconden | 401 bij ongeldige handtekening of te oud tijdstip |
| `POST /api/accounts/:id/overdragen {naar, naarGebruikerId?, alsNieuweKansBijKlant?}` (P17) | schrijfrecht op het account | keuze | overdracht | gebouwd in P17; deze prompt voegt `alsNieuweKansBijKlant` toe en zet de verzending naar DealDrive in de job |
| `POST /api/koppelingen/dealdrive/v1/webhook` | DealDrive, HMAC | terugmelding | 2xx binnen 5 seconden | 401 `handtekening_ongeldig` of `tijd_verlopen`; 403 `koppeling_uit`; 404 `account_onbekend` |
| `GET /api/koppelingen/dealdrive/v1/ping` | DealDrive, HMAC | geen | `{ok}` | 401 |
| `POST /api/koppelingen/dealdrive/test` | beheerder, founder | geen | `{ok, melding}` | melding in gewone taal |
| `GET /api/koppelingen/dealdrive/status` | beheerder, founder | geen | stand, laatste overdracht, mislukte overdrachten | nooit het geheim |
| `POST /overdrachten`, `GET /overdrachten/{overdrachtId}`, `GET /accounts/zoek`, `GET /ping` | uitgaand naar DealDrive, HMAC | volgens het contract | volgens het contract | foutcodes uit het contract |

### AI-stappen

- Geen generatie van suggestieteksten nodig: kandidaten komen uit pure functies op de afgeleide tabellen. De Coach bundelt wekelijks (F14); niet vastgelegd of de Coach de teksten formuleert. Voorstel: de Coach (mandaat A voor voorstellen) formuleert per kandidaat één zin met schema `{tekst, onderbouwing {cijfers[], citaten[]}}`, daarna `filterNamen`; mock met fixtures uit Voltvast; credits: soort "Coach en verbetervoorstel", 20 credits per handeling (Plus, Compleet; 11.4), via `creditsVoor` uit P33; als automatische AI stopt de job bij 10 procent van de pot en blijven de kandidaten zonder Coach-tekst staan.
- Vangrails: namenfilter (11.2) vóór de aanroep en op de uitvoer; geen winpunttekst; citaten letterlijk uit verslagen na anonimiseren.
- De DealDrive-koppeling gebruikt geen AI en kost geen credits.

### Integraties

- **SalesDNA uitgaand**: adapter `server/utils/bronnen/salesdna.ts` (uit P29) krijgt `stuurSuggesties(bundel)`; HMAC-SHA256 met hetzelfde geheim als de koppeling; mock die "ontvangen" en daarna een `suggestie.status` teruggeeft.
- **DealDrive**: adapter `server/utils/dealdriveAdapter.ts` met de interface `DealDriveKoppeling { overdragen(pakket), zoekAccount(sleutels), status(overdrachtId), ping() }` (contract hoofdstuk 7). De interface en de uitvoering `mock` (vaste antwoorden uit `seed/dealdrive-mock/`) komen uit P17; bestaan ze nog niet, bouw ze hier. Deze prompt levert de uitvoering `http` volgens het contract en de OpenAPI-specificatie, met ondertekening, idempotentie, opnieuw proberen en logging in `koppeling_runs`. De keuze tussen `mock` en `http` volgt `instellingen.stand`; met `uit` wordt de adapter niet aangeroepen.
- **Webhook-ontvanger** `POST /api/koppelingen/dealdrive/v1/webhook`: controle van de handtekening vóór verwerking (patroon uit `wens.post.ts`), uniek `gebeurtenisId` in `dealdrive_gebeurtenissen`, verwerking in een job met `verwerkTerugmelding`.
- **Contracttests**: de voorbeelden in `docs/api/dealdrive-koppeling.md`, de schema's uit de OpenAPI-specificatie en de bestanden in `seed/dealdrive-mock/` zijn de fixtures. Dezelfde testsuite draait tegen de mock en tegen de uitvoering `http` met een lokale testserver die de fixtures teruggeeft (inclusief `fout-al-klant.json` en de vier webhooks); elk uitgaand verzoek en elk antwoord wordt gevalideerd tegen de OpenAPI-specificatie.
- **Lokaal** (13.5): SalesDNA en DealDrive draaien op hun mock (`seed/webhooks/`, `seed/dealdrive-mock/`); er is geen DealDrive-omgeving nodig en geen netwerk in tests. Het gedeelde geheim staat lokaal alleen in `.env.local`.

### Functiecatalogus

Niet vastgelegd in het bouwplan welke sleutels; voorstel:

| Sleutel | Niveau | Pakket | Recht | Helpartikel |
|---|---|---|---|---|
| `salesdna.suggesties.vrijgeven` | Gevorderd | Plus | salesmanager | Verbetervoorstellen beoordelen |
| `verkoopverhaal.voorstellen` | Expert | Starter | accountmanager | Eén winpunt per gesprek |
| `overdracht.bewijsVoorstel` | Gevorderd | Starter | schrijven accounts | Een goede overdracht |
| `overdracht.dealdrive` | Beginner | Starter | schrijven accounts | Een goede overdracht |
| `koppelingen.dealdrive` | Expert | Starter | founder (inrichten), beheerder (stand en test) | Koppelingen |

Het niveau is de startindeling; de founder zet functies per niveau aan of uit in `functies_per_niveau` (P09 Helpcenter basis en features per niveau). Ontdubbelen tegen DealDrive is geen eigen functie maar gedrag van import en leadgenerator voor iedereen.

### Hergebruik uit DealDrive

- `server/api/hooks/github/wens.post.ts`: patroon voor een gesigneerde inkomende hook (controle van de handtekening vóór verwerking).
- `app/types/entities.ts`: de veldnamen van de ontvangende kant zoals in de veldtoewijzing van het contract; Dealtrace vertaalt niet zelf naar DealDrive-typen, dat doet de ontvanger.
- Voor de SalesDNA-kant is er geen DealDrive-code; de vorm komt uit F25 en de bijlage `bijlagen/SalesDNA-sublagen-voor-Dealtrace.docx`.

### Buiten scope

Schrijven in SalesDNA buiten suggesties; de tien weergaven, kaders, meekijkronde en Kwartaal check van SalesDNA; de overdrachtsflow zelf (de vraag "Overdragen?", de status `overgedragen`, de briefing "Overdracht"; P17 en P18); de overdracht naar het CRM (P20); de ontvangende kant in DealDrive (open vraag 27, contract hoofdstuk 8; een aparte opdracht voor DealDrive, geen blokkade voor deze prompt); deals, offertes en een pipeline in Dealtrace (B17); bijlagen van winpunten als download (open vraag 22).

## Acceptatiecriteria

1. Een contactnaam uit aantekeningen komt niet in een suggestie of in een AI-aanroep (Bijlage C.9 punt 9); een aangepaste tekst met een naam geeft 422.
2. Per sublaag gaan er hooguit 10 suggesties per week uit; de elfde blijft op "Concept" voor de volgende week.
3. Zonder vrijgave van de salesmanager wordt niets verstuurd.
4. Een uitgaand verzoek naar SalesDNA draagt een geldige HMAC-SHA256 met event-id en tijd; een `suggestie.status` met ongeldige handtekening of een tijdverschil boven 5 minuten geeft 401 en verandert niets; een dubbel event verandert niets.
5. Voltvast: met 38 gesprekken in br-02 "Utiliteitsinstallateurs" in het kwartaal en geen eigen blok in L0.4 verschijnt de suggestie "38 gesprekken in Utiliteitsinstallateurs dit kwartaal, nog geen eigen belofte".
6. Contracttests: dezelfde suite slaagt tegen de mock en tegen de uitvoering `http` met de lokale testserver; elk uitgaand verzoek en elk antwoord past in de OpenAPI-specificatie; de fixtures in `seed/dealdrive-mock/` worden ongewijzigd gebruikt.
7. Overdracht (stand `mock`): na "Overdragen?" met DealDrive krijgt `overdrachten` status `verstuurd` met het `accountId` uit `overdracht-antwoord.json` als extern id; `webhook-overdracht-verwerkt.json` zet hem op `bevestigd`; de accountkaart toont de link.
8. Een tweede verzending van dezelfde overdracht gebruikt dezelfde `Idempotentie-Sleutel` en maakt geen tweede account of deal (test met de mock en de testserver).
9. `409 al_klant` (`fout-al-klant.json`) toont de vraag uit het contract; "Ja, draag over" stuurt het pakket opnieuw met `alsNieuweKansBijKlant: true`.
10. Een time-out of 5xx leidt tot nieuwe pogingen na 1, 5 en 30 minuten, 2 en 12 uur; daarna `mislukt`, een taak voor de eigenaar en een melding bij de beheerder; de overdracht in Dealtrace (status `overgedragen`) blijft staan.
11. Webhook-ontvanger: een ongeldige handtekening of een tijdverschil boven 5 minuten geeft 401 en verandert niets; een dubbel `gebeurtenisId` verandert niets; een onbekend `dealtraceAccountId` geeft 404 `account_onbekend`; elk antwoord komt binnen 5 seconden.
12. `deal.gewonnen` laat het account `overgedragen`, telt "gewonnen na overdracht" in de funnel en vraagt "Mag dit een bewijs worden?"; Dealtrace maakt nergens een deal, offerte of klant.
13. `deal.verloren` met `verlorenAan` "Online webgroothandel" zet via `vv_redenmapping` een terugkomregel met datum, kanaal en rol; `klant.slapend` met 6 maanden maakt een herwinaccount met de terugkomregel hc-04 en een taak op de terugkomdatum.
14. Stand `uit`: "Overdragen?" biedt DealDrive niet aan en de adapter wordt nooit aangeroepen; de overdracht werkt met een overdrachtstaak en de briefing (F17). Stand `mock` is de standaard in ontwikkeling; een nieuwe klantorganisatie start op `uit`.
15. Ontdubbelen: een lead met het KvK-nummer uit `zoek-antwoord.json` toont "Prospect in DealDrive" in import en leadgenerator; een tweede vraag binnen 24 uur komt uit de cache.
16. Niveau Beginner: ziet geen suggesties; draagt over naar DealDrive en ziet de link en de pil "Al klant in DealDrive". Niveau Gevorderd: beantwoordt "Mag dit een bewijs worden?"; een verhaalvoorstel indienen staat niet aan (met uitleg en helpartikel, zonder verzoekknop). Niveau Expert: dient een nieuw bezwaarantwoord in; het verschijnt als voorstel bij de salesmanager, niet direct in de bundel naar SalesDNA.
17. Een salesmanager ziet alleen suggesties uit zijn teams; cross-tenant: suggesties, overdrachten en terugmeldingen van organisatie A zijn onzichtbaar voor B, ook als een terugmelding met de handtekening van A een account van B noemt.
18. Telefoon (375, 390, 412 px): de suggestieflyout opent als schuifvenster, "Geef vrij" kost één tik per suggestie, tikdoelen minimaal 44 px, geen horizontale scroll; de toast na de overdracht verschijnt boven de onderbalk.
19. Alle adapters draaien lokaal met een mock (13.5); geen netwerk en geen sleutel in tests.

## Definition of Done

Hoofdstuk 19 geldt volledig. Specifiek voor deze prompt:

- Unit-tests voor `filterNamen`, `bundelSuggesties`, `naarContract`, `volgendePoging`, `verwerkTerugmelding` en de HMAC-functies (tijdgrens, replay, idempotentie).
- Contracttests tegen de OpenAPI-specificatie, met de mock en met de uitvoering `http`, groen in `pnpm test`.
- Wegwerp-Postgres: dubbele `suggestie.status`, dubbele terugmelding, dubbele overdracht, cross-tenant.
- AVG-check uit 15.2 (rij Suggesties naar SalesDNA) afgevinkt; de verwerkersafspraak met DealDrive en SalesDNA genoemd in `docs/HOE-HET-WERKT.md`.
- Open vraag 27 staat in het sprintverslag als bekende afhankelijkheid: de koppeling staat voor klanten op `uit` tot DealDrive de ontvangende kant levert (contract hoofdstuk 8).
