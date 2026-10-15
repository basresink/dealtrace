# P12: Prospectplanning en terugkomregels in de planning

| Onderdeel | Waarde |
|---|---|
| Sprint | 6 |
| Features | F13 Prospectplanning (jaarplanning) en het tabblad Terugkomregels, met de terugkomregels uit F25 |
| Hangt af van | P01 (fundament, instellingen met verkoopjaar), P03 (accounts, klasse, eigen velden), P05 (statusmachine, nee met reden, terugkomregel toepassen bij nee), P28 (leesmodel `vv_terugkomregels`, `terugkomDatum`), P06 (motor, regel `jaarplanning-venster`, SR07, SR18), P07 (hercontactritme, route `/planning` met tabblad Hercontactritme), P08 (Planner, capaciteit), P10 (belblokken om in te plannen) |
| Bron in het bouwplan | F13 (Jaarplanning, Regels, Terugkomregels, Technisch), F25 (Terugkomregels, Per niveau rij Terugkomen, `terugkomDatum`, `nb_terugkom_resultaten`), 7.2, 7.3 (terugkomregel na nee), 4.3 (rij F13), 15.1, ADR-018, Bijlage A (gat 16, 18), Bijlage C.8 en C.9 |

## Lees eerst

- `Bouwplan-Dealtrace.md`: 4.3 (rij F13), 5.2 en 5.3, 6.1 (Plannen), 7.2, 7.3 (alinea Terugkomregel), F05 (gebeurtenissen `geparkeerd`, `heropvolging`), F07 (soort "Koude acquisitie" vult uit de prospectplanning), F13, F15 (patronen Jaarplanning-venster, Geparkeerd terug), F16 (accountklassen), F19 (eigen veld als potentie), F25, 10.2, 12 (CRM en DealDrive als bron voor slapende klanten), 19, ADR-018, Bijlage A, Bijlage C.1, C.8 en C.9.
- DealDrive op commit 75bee61 (alleen lezen): `app/pages/prospectplanning.vue`, `app/composables/useOmzetpotentie.ts`, `app/composables/useDekkingBuckets.ts`, `shared/periodeFilter.ts`, `shared/datum.ts`, `shared/ritmematrix.ts`. Bijlage B noemt deze drie eerste bestanden niet, F13 wel (Hergebruik).

## Deel 1: Functioneel (wat en waarom)

### Wat je bouwt

Je bouwt de jaarplanning die laat zien wie dit verkoopjaar aan de beurt is per potentie en wat er knelt, met één klik om de achterstand in belblokken te plannen, en het tabblad Terugkomregels dat laat zien wanneer en hoe je terugkomt na een nee, een verlies of een slapende periode.

### Waarom

Hoe groter de potentie, hoe eerder in het verkoopjaar je een prospect benadert: grote prospects in de eerste twee maanden, middelgrote in maand 1 tot en met 5, kleine doorlopend (F13). In DealDrive sloeg de jaarplanning niets op, had ze geen motorregel en een vaste startmaand, en was "benaderd" niet begrensd op het jaar (Bijlage A, gat 18). Een terugkomregel is iets anders dan een hercontactritme: hij zegt wanneer en waarom je na een nee, verlies of slapen terugkomt, en start op die datum een hercontactritme (ADR-018).

### Gebruikers en niveaus

| Rol | Niveau | Wat |
|---|---|---|
| Accountmanager | Beginner | Volgende poging zien op taak en kaart; een taak op de terugkomdatum met de aanpak; reden kiezen bij een nee. Geen menu-item Prospectplanning (6.1) |
| Accountmanager | Gevorderd | Prospectplanning: "Wat knelt er nu", jaarkalender, maanddetail, "Plan in belblok" per groep; terugkomdatum per account aanpassen met reden; slapende klanten als bellijst |
| Accountmanager | Expert | Ritme kiezen per campagne, parkeerregels per reis; een terugkomregel aan een pogingenreeks per campagne koppelen; opbrengst per reden |
| Salesmanager | Gevorderd of Expert | Ritmes beheren, vensters per klasse instellen, teamweergave, rapport per ritme; voorstellen van Experts beoordelen |
| Beheerder | Expert | Verkoopjaar en startmaand, vensters, potentiebron; terugkomregels inrichten (Instellingen, Verkoop, Verkoopverhaal, F22 en F25) |

### Schermen

**Prospectplanning** (`/planning`, groep Plannen; tabbladen "Jaarplanning", "Hercontactritme" uit P07, "Terugkomregels"). Jaarplanning is het standaardtabblad. Niet vastgelegd in het bouwplan welk tabblad standaard opent; voorstel: Jaarplanning.

**Tabblad Jaarplanning**, van boven naar beneden:

1. Kop: kicker "Verkoopjaar 2026 · 105 van 112 prospects ingedeeld", titel "Wie dit jaar aan de beurt is, per potentie."
2. Blok **"Wat knelt er nu"** met signalen in vaste volgorde (urgent, let op, informatief, goed): "Achterstallig · Groot: Het is oktober en 36 grote prospects zijn nog niet benaderd. Dat hoorde in januari en februari." met "Plan 36 in belblokken" en "Maak campagne"; "Buiten de planning: 7 prospects zonder klasse" met "Deel in".
3. **Jaarkalender** van twaalf maandtegels: per tegel de groepen die aan de beurt zijn, "4/61 benaderd", rode pil "36 te laat".
4. **Maanddetail** per groep met meter en rijen: naam, klasse, plaats, status ("Nog niet benaderd", "Benaderd", "Gesproken", "Afspraak"), aantal contactmomenten, knop "Bel" of "Plan bezoek".
5. Voor de buitendienst een **kaartweergave** (Weergave, Kaart).

Lege staat: Niet vastgelegd in het bouwplan; voorstel: "Er zijn nog geen prospects met een klasse. Deel ze in om de jaarplanning te vullen." met "Deel in" (alleen bij de knop die in de kop al staat; 2.3) en bij filters "Toon alles".

"Maak campagne" vraagt campagnes (P16, sprint 9). Niet vastgelegd in het bouwplan; voorstel: de knop ontbreekt tot P16.

"Plan bezoek" vraagt afspraken en regiodagen (P13 en P14). Niet vastgelegd in het bouwplan; voorstel: tot P13 maakt "Plan bezoek" een bezoektaak via de flyout "Nieuwe taak" met actiesoort Bezoek.

**Tabblad Terugkomregels**, van boven naar beneden:

1. Kop. Niet vastgelegd in het bouwplan; voorstel: titel "Wanneer we terugkomen" met de bron ("Uit SalesDNA · bijgewerkt 12 okt" of "Eigen inrichting", zoals op `/richting`).
2. KPI **"Hercontact op tijd"** met norm 90 procent (gezond) en 70 procent (aandacht).
3. Twee lijsten, **verloren** en **slapend**: per regel reden, termijn in dagen (standaard 30, 61, 91, 182, 365; "direct" is 0), kanaal, klassen, rollen, aanpak en het hercontactritme dat start.
4. Per regel de opbrengst (Expert): hoeveel accounts op tijd zijn teruggekomen en wat het opleverde (gesprekken, afspraken).
5. **Komt binnenkort terug**. Niet vastgelegd in het bouwplan; voorstel: een lijst van eigen accounts met een terugkomdatum in de komende 30 dagen (naam, reden, terugkomdatum, kanaal, aanpak), met "Pas datum aan" (Gevorderd).
6. **Slapende klanten** (Gevorderd): als bellijst; met "Zet in belblok".

Inrichten gebeurt niet hier: bij een gespiegeld onderdeel zegt het tabblad "Wijzigen doe je in SalesDNA"; bij eigen inrichting heeft de beheerder de knop "Inrichten" naar Instellingen, Verkoop, Verkoopverhaal (F25). Een Expert heeft "Stel wijziging voor" (een voorstel aan de salesmanager, F13 en F25).

Lege staat zonder verkoopverhaal: Niet vastgelegd in het bouwplan; voorstel, in de lijn van F25: "Jullie terugkomregels zijn nog niet vastgelegd." met voor de beheerder "Inrichten". De afkoelperiode per kanaal blijft dan de enige termijn.

**Telefoon (390 px).** 8.5 beschrijft geen telefoonopbouw voor `/planning`; de pagina staat onder "Meer". Niet vastgelegd in het bouwplan; voorstel: één kolom; "Wat knelt er nu" bovenaan met de knoppen onder elkaar; de jaarkalender als horizontaal vegen door de maanden (één maandtegel schermbreed, geen horizontale paginascroll); rijen in het maanddetail met "Bel" (`tel:`-link) en "Plan bezoek" als knoppen van 48 px; de kaartweergave alleen voor de buitendienst; het tabblad Terugkomregels als kaarten per regel. "Plan 36 in belblokken" werkt op de telefoon met bevestiging in een schuifvenster.

### Klikpaden

1. **Achterstand plannen.** In "Wat knelt er nu" klik "Plan 36 in belblokken"; een bevestiging toont hoe de beltaken over de koude blokken van de komende weken verdeeld worden binnen het venster ("36 belpogingen in 6 blokken tussen 2026-10-15 en 2026-11-05"; voorstel voor de tekst); na "Plan in" komen de taken met `belblok_id` in de blokken; toast "36 belpogingen ingepland."
2. **Indelen.** "Deel in" bij "7 prospects zonder klasse" opent de lijst met een klassekeuze per account (Gevorderd mag de klasse zetten, F16); na opslaan verschijnen ze in de kalender.
3. **Maand openen.** Klik op de maandtegel oktober; het maanddetail toont per groep de meter en de rijen; "Bel" opent de belmodus of op de telefoon de `tel:`-link met daarna "Hoe ging het?".
4. **Terugkomdatum aanpassen** (Gevorderd). Op een account met status nee of wachtend kies "Pas datum aan", vul datum en reden in; een datum binnen de afkoelperiode schuift naar het einde ervan met de melding "De afkoelperiode voor bellen loopt tot 2027-01-12. De terugkomdatum is daarop gezet." (voorstel voor de tekst); auditregel.
5. **Op de terugkomdatum.** De motor (regel Geparkeerd terug, SR18) start het hercontactritme uit de regel; de binnendienst krijgt telefoon en mail, de buitendienst een bezoek op de eerstvolgende regiodag; de taak toont de aanpak als aanleiding ("Terug op 14 januari 2027 · Beslissing uitgesteld · e-mail met nieuwe aanleiding").
6. **Regel koppelen aan een ritme** (Expert). Kies bij een regel een ander hercontactritme; dit wordt een voorstel aan de salesmanager.

### Filters en sorteren

Filters: "Van mij" (standaard), team (salesmanager), doelgroep, gebied; in de URL, ook `?jaar=` en het tabblad. Rijen in het maanddetail op status (eerst "Nog niet benaderd") en daarna op naam. Niet vastgelegd in het bouwplan; voorstel voor de sortering.

### Regels

- **Klasse naar potentie**: A en B groot (maand 1 tot 2), C middel (maand 1 tot 5), D klein (doorlopend), eigen klassen middel, zonder klasse buiten de planning. Vensters en startmaand van het verkoopjaar zijn instelbaar. Voltvast gebruikt eigen klassen ("A · Aantal monteurs (Prospects)" en verder, Bijlage C.1). Niet vastgelegd in het bouwplan of eigen klassen met een A, B of C ervoor als groot of middel tellen; voorstel: de beheerder koppelt elke eigen klasse aan een potentie (groot, middel, klein), standaard middel.
- Potentie kan behalve uit de klasse ook uit een eigen veld komen ("Omzetpotentie") of uit de score; de klasse is de terugval.
- **Benaderd** telt alleen echte pogingen in het lopende verkoopjaar; **gesproken** vraagt een gesprek met iemand (bij voorkeur de beslisser); geïmporteerde datums tellen niet.
- De motorregel `jaarplanning-venster` (SR07) maakt wekelijks een beltaak voor prospects waarvan het venster voorbij is en die niet benaderd zijn.
- "Plan in belblokken" spreidt de beltaken over de koude blokken van de komende weken binnen het venster; de capaciteit van de Planner (40 beltaken per dag) geldt.
- **Terugkomregel**: een nee, een geparkeerd account of een account dat uit DealDrive of het CRM terugkomt (verloren deal, slapende klant) krijgt naast de reden een terugkomregel: terugkomdatum, kanaal, rol en aanpak. De afkoelperiode per kanaal blijft de ondergrens: een terugkomdatum binnen de afkoelperiode schuift op naar het einde ervan (7.3).
- Klassen leeg in een regel betekent "alle klassen" (Bijlage C.8).
- Slapende klanten herkent Dealtrace uit besteldata van CRM of DealDrive (3, 6 of 12 maanden niet besteld; DealDrive meldt dit met de terugmelding `klant.slapend` uit `docs/api/dealdrive-koppeling.md`) en maakt er een herwinaccount van. Dealtrace zelf maakt geen klanten (B17). CRM (P20) en DealDrive (P23) komen later; tot dan is de lijst slapende klanten leeg. Niet vastgelegd in het bouwplan; voorstel: lege staat "Slapende klanten verschijnen zodra jullie CRM of DealDrive gekoppeld is."
- **Hercontact op tijd** = het aandeel accounts met een bereikte terugkomdatum waarvoor binnen de termijn een eerste poging is gedaan. Niet vastgelegd in het bouwplan hoe "op tijd" gemeten wordt; voorstel: eerste poging uiterlijk 5 werkdagen na de terugkomdatum.
- Een account zit nooit in twee ritmes; een terugkomregel start geen ritme op een account dat al in een ritme zit, maar schuift de start naar het einde daarvan (voorstel, uit de regel "nooit twee ritmes tegelijk").

### Helpartikelen

- "Prospectplanning" (Plannen en sturen): potentie, vensters, benaderd, "Plan in belblokken".
- "Wanneer we iemand terugbellen" (uit F25 en F21): terugkomregels, verschil met het hercontactritme, afkoelperiode als ondergrens.
- "Nee met reden en afkoelperiode" (Prospects) aanvullen met de terugkomdatum.
- Het artikel "Je week plannen: belblokken en regiodagen" (P10, P14) aanvullen met de jaarplanning (geen leerpaden per niveau, B19); academie "Parkeren en terughalen" en "Nee is een datapunt" als titel en samenvatting (volledig in P25).

## Deel 2: Technisch (hoe)

### Datamodel

- Geen nieuwe tabel voor de jaarplanning: de stand rekent uit `accounts` (klasse, eigen velden, score), `activiteiten` en de instellingen. Niet vastgelegd in het bouwplan of de stand wordt opgeslagen; gat 18 zegt "Jaarplanning slaat niets op" als gat. Voorstel: de indeling (potentie en venster per account per verkoopjaar) opslaan in `accounts.data.planning {jaar, potentie, venster, ingedeeldOp}` zodat een handmatige indeling bewaard blijft, en een afgeleide tabel `nb_planning_stand (organisation_id, jaar, maand, groep, totaal, benaderd, te_laat)` die de dagelijkse job herberekent.
- Instellingssleutel `prospectplanning {startmaand, vensters {groot, middel, klein}, potentieBron ('klasse'|'eigenVeld'|'score'), eigenVeldSleutel?, klassePotentie {}}` in `shared/settingKeys.ts` (Niet vastgelegd in het bouwplan; voorstel voor de vorm). Het verkoopjaar staat al bij Organisatie (F22).
- `accounts.terug_op`, `accounts.terug_regel_id` (10.2, F25); `vv_terugkomregels` (lijst, reden, termijn, `termijn_dagen`, kanaal, klassen, rollen, aanpak, `hercontactritme_id`); `vv_redenmapping`.
- `nb_terugkom_resultaten` (F25, afgeleid, nachtelijke job): per regel aantallen teruggekomen, op tijd, opbrengst.
- Aanpassen van de terugkomdatum: `accounts.data.terugHistorie[] {van, naar, op, door, reden}` (voorstel) plus audit.
- RLS `org_isolation`. Rechtenmatrix (3.3): planning lezen vanaf Gevorderd; inplannen eigen accounts (Gevorderd), team (salesmanager); terugkomdatum aanpassen eigen accounts (Gevorderd), team (salesmanager); terugkomregels schrijven alleen via de verkoopverhaal-inrichting (beheerder en salesmanager, F25).
- Sync-allowlist: mutatie `account.terugkomdatum` (voorstel) met idempotentiesleutel; inplannen loopt via het endpoint.

### Pure functies

| Functie | Invoer en uitvoer | Randgevallen en unit-tests |
|---|---|---|
| `potentieVan(account, instellingen)` | account naar groot, middel, klein of null | zonder klasse; eigen klasse; eigen veld leeg valt terug op klasse |
| `vensterVan(potentie, verkoopjaarStart)` | potentie naar `{van, tot}` | startmaand april; jaarwissel; klein doorlopend |
| `benaderdDitJaar(account, activiteiten, jaarStart)` | boolean en `gesproken` | poging op 31 december en 1 januari; geïmporteerde datum telt niet; alleen echte pogingen |
| `watKnelt(stand, nu)` | signalen in vaste volgorde | geen achterstand geeft "goed"; zeven zonder klasse |
| `spreidOverBlokken(accounts, blokken, venster, capaciteit, nu)` | verdeling per blok | minder blokken dan nodig; venster sluit eerder; capaciteit 40 |
| `terugkomDatum(reden, regels, nu)` | uit P28 (`shared/verkoopverhaal.ts`), hier hergebruiken | termijn "direct" is 0; reden zonder regel |
| `metAfkoeling(datum, account, kanaal)` | datum binnen afkoeling schuift naar het einde | precies op de grens; kanaal kaart 365 |
| `hercontactOpTijd(accounts, activiteiten, periode)` | percentage en stand gezond, aandacht | norm 90 en 70 precies op de grens |

Alle functies in `shared/planning.ts` (Niet vastgelegd in het bouwplan; voorstel voor de bestandsnaam) met `nu` als parameter; werkdagen en feestdagen uit `shared/datum.ts`.

### Endpoints

| Methode en route | Recht | Invoer | Uitvoer | Fouten |
|---|---|---|---|---|
| `GET /api/planning/jaar?jaar=&scope=` | Gevorderd; scope team voor salesmanager | | kalender, knelpunten, maanddetail | 403 bij Beginner met reden `niveau` |
| `POST /api/planning/inplannen` | Gevorderd (eigen), salesmanager (team) | `{accountIds, doel: 'belblokken'|'campagne'}` | verdeling en aangemaakte taken | 422 bij `campagne` zolang P16 er niet is; 409 als een account al in een ritme zit |
| `GET /api/planning/terugkomregels` | Gevorderd | | regels, KPI, opbrengst, komt binnenkort terug | (Niet vastgelegd in het bouwplan; voorstel; de regels zelf komen uit `GET /api/richting`) |
| `PUT /api/accounts/:id/terugkomdatum` | Gevorderd (eigen), salesmanager | `{datum, reden}` | account | 422 zonder reden (voorstel) |
| `GET\|POST\|PUT /api/ritmes`, `GET /api/ritmes/:id/rapport` | uit P07 | | | |

### AI-stappen

Geen.

### Integraties

Geen nieuwe. Besteldata voor slapende klanten komt via de CRM-adapter (P20) en de DealDrive-koppeling (P23).

### Functiecatalogus

Niet vastgelegd in het bouwplan; voorstel:

| Sleutel | Startindeling: aan vanaf | Pakket | Recht | Helpartikel |
|---|---|---|---|---|
| `planning.jaar` | Gevorderd | Starter | iedereen | Prospectplanning |
| `planning.inplannen` | Gevorderd | Starter | iedereen | Prospectplanning |
| `terugkomen.lezen` | Gevorderd | Starter | iedereen | Wanneer we iemand terugbellen |
| `terugkomen.datumAanpassen` | Gevorderd | Starter | accountmanager | Wanneer we iemand terugbellen |
| `terugkomen.koppelenEnOpbrengst` | Expert | Starter | accountmanager | Wanneer we iemand terugbellen |
| `planning.vensters` | Gevorderd | Starter | salesmanager | Prospectplanning |

### Hergebruik uit DealDrive

- `app/pages/prospectplanning.vue`: jaarkalender, maandtegels en maanddetail; vervang de berekening in de pagina door `shared/planning.ts` en voeg opslag, instelbare startmaand en de begrenzing op het verkoopjaar toe (gat 18).
- `useOmzetpotentie.ts`: potentie uit een eigen veld of de klasse.
- `useDekkingBuckets.ts`: groepen per potentie en de tellers "4/61 benaderd".
- `shared/periodeFilter.ts` en `shared/datum.ts`: periodes, werkdagen en feestdagen.

### Buiten scope

- "Maak campagne" en "Zet in campagne" (P16); bezoeken plannen op regiodagen (P13, P14); slapende klanten uit CRM en DealDrive (P20, P23); inrichten van terugkomregels zelf (P28); suggesties naar SalesDNA (P23).

## Acceptatiecriteria

1. Bijlage A, gat 18: de motorregel `jaarplanning-venster` maakt wekelijks een beltaak voor een prospect waarvan het venster voorbij is en die niet benaderd is; de startmaand van het verkoopjaar is instelbaar; "benaderd" telt alleen pogingen in het lopende verkoopjaar; de indeling wordt opgeslagen en overleeft een herlading.
2. Bijlage A, gat 16: potentie, vensters en de definitie van benaderd staan één keer in `shared/` en worden door pagina, motor en job gelezen.
3. "Plan 36 in belblokken" spreidt de beltaken over de koude blokken van de komende weken binnen het venster, met `belblok_id`, zonder het dagplafond van 40 te overschrijden (F13).
4. Een account met ritme koud dat vijf keer niet reageert, wordt geparkeerd met terugkomdatum en komt bij een nieuwe aanleiding terug als de afkoelperiode voorbij is.
5. Een terugkomdatum binnen de afkoelperiode schuift naar het einde ervan (test per kanaal).
6. Bijlage C.9 geval 5: een uit DealDrive of het CRM teruggekomen verloren deal met reden "Prijs" (hier met de mock-fixture `seed/dealdrive-mock/webhook-deal-verloren.json`; de echte terugmelding bouwt P23) geeft via de mapping "Prijs te hoog" (hc-03) een bezoektaak over 182 dagen op de eerstvolgende regiodag; zolang regiodagen (P14) niet bestaan, op het volgende werkmoment na 182 dagen.
7. Met de Voltvast-seed toont het tabblad Terugkomregels zes regels (hc-01 tot en met hc-06) in twee lijsten; hc-04 met termijn "direct" (0 dagen); klassen leeg toont "alle klassen".
8. Dezelfde seed als eigen inrichting en als spiegel geeft op het tabblad hetzelfde resultaat (Bijlage C.9 geval 10).
9. "Hercontact op tijd" toont gezond bij 90 procent en aandacht bij 70 procent, getoetst op de grens.
10. Een Beginner ziet geen menu-item Prospectplanning; een directe link toont de uitleg met kicker "Nog niet aangezet"; `GET /api/planning/jaar` geeft 403 met reden `niveau`.
11. Per niveau getest: Gevorderd ziet jaarplanning, "Plan in belblok" en kan een terugkomdatum met reden aanpassen; Expert ziet daarnaast de opbrengst per regel en kan een regel aan een ritme koppelen als voorstel; Beginner ziet alleen de taak op de terugkomdatum met de aanpak.
12. Salesmanager ziet met scope team alleen zijn eigen teams (server-side).
13. Telefoon (375, 390, 412 px): `/planning` zonder horizontale paginascroll; knoppen "Bel" en "Plan bezoek" minimaal 44 px; "Bel" opent een `tel:`-link.
14. Cross-tenant: planning en terugkomgegevens van organisatie A zijn onzichtbaar voor B.
15. Testdata: alleen Voltvast (Bijlage C). Niet vastgelegd in het bouwplan; voorstel: 112 fictieve prospects verdeeld over de zes Voltvast-klassen en vier branches, waarvan 36 grote prospects zonder poging in het verkoopjaar 2026, zodat het voorbeeld uit F13 ("36 grote prospects zijn nog niet benaderd") te reproduceren is.

## Definition of Done

Hoofdstuk 19 geldt volledig. Specifiek voor deze prompt:

- Unit-tests voor `shared/planning.ts` met jaarwissel, startmaand, feestdagen, lege invoer en capaciteit; wegwerp-Postgres voor RLS en de rechten op inplannen en terugkomdatum.
- Playwright desktop en telefoon voor beide tabbladen; de inplanflow van 36 accounts end-to-end tegen de mock-server.
- Bijlage A, gat 16 en 18 afgevinkt; helpartikelen "Prospectplanning" en "Wanneer we iemand terugbellen" in `content/help/`.
