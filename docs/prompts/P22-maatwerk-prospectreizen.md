# P22: Maatwerk prospectreizen

| Onderdeel | Waarde |
|---|---|
| Sprint | 11 (Sturen en maatwerk) |
| Features | F05 maatwerk: doelgroepen beheren, maatwerkreizen per doelgroep met editor, versies, fasemapping, validatie en droogloop |
| Hangt af van | P01 (functiecatalogus, rechten), P03 (eigen velden als doelgroepfilter), P05 (standaardreis, `reistemplates`, `prospectreizen`, `reisgeschiedenis`, meldpunt `POST /api/reis/gebeurtenis`, `kiesReis`, `volgendeFase`), P06 (motor, regels met patroon "fase betreden", `activity_rules.reis_id` en `fase_id`), P07 en P12 (hercontactritmes), P10 (belscripts voor startactiviteiten), P14 (gebieden), P28 (leesmodel: branches, ambitie, `vv_fasen`, winpunten, concurrenten), P21 (Analyse, tabblad Reizen en het verbetervoorstel) |
| Bron in het bouwplan | F05 (volledig, met nadruk op "Maatwerkreis per doelgroep", "Versies", "Validatie", "Toewijzing", technisch deel); ADR-004 en ADR-013; 3.3 (rij Doelgroepen en prospectreizen); 4.3 (rij F05); 6.1 (`/reizen`); 7.1 tot en met 7.4; 8.12 (reiseditor niet op de telefoon); F15 (patroon Gebeurtenis en "fase betreden"); F25 (branches, ambitietoets, fasen, sjablonen); hoofdstuk 21 (risico maatwerkreizen); Bijlage A regel 42 |

## Lees eerst

- Bouwplan-Dealtrace.md: F05 volledig, ADR-004, ADR-013, 3.3, 4.3, 4.5, 6.1, hoofdstuk 7, 8.12, F15 (blok Gevolg en patroon Gebeurtenis), F16 punt 7 (overschrijven per reis), F25 ("Uit het verkoopverhaal" bij F05 en de tabel De acht onderdelen), risico "Maatwerkreizen worden te complex", Bijlage A regels 41 en 42.
- DealDrive op commit 75bee61:
  - `app/pages/instellingen/customer-journey.vue` (fasekaarten, overgangsrijen, kleurkeuze, accent, verwijderen van een fase)
  - `app/composables/useCustomerJourney.ts`
  - `server/utils/journeyEngine.ts` (doorschuiven, audit) en `server/utils/faseAccent.ts`
  - `server/utils/agentExecutor.ts` (Pitstop-accent per fase)
  - `server/utils/activityRulesStore.ts` (koppeling `journeyStageId` in de regels)

## Deel 1: Functioneel (wat en waarom)

### Wat je bouwt

Het reisoverzicht `/reizen` en de reiseditor `/reizen/:id` waarmee een Expert of salesmanager per doelgroep een eigen prospectreis maakt, controleert, droog laat lopen en (alleen de salesmanager) publiceert als nieuwe versie met fasemapping.

### Waarom

Elke doelgroep koopt anders: een installateur in de woningbouw wil een werkbezoek op een project, een groothandel een proeforder. Eén vaste reis is te grof, een vrije reis zonder hoofdfase maakt rapportage onvergelijkbaar (ADR-013). DealDrive liet bijna alles toe en liet bij het verwijderen van een fase kale id's achter op regels, overgangen en kaarten (Bijlage A regel 42); Dealtrace valideert, eist een vervangende fase en zet alles echt om.

### Gebruikers en niveaus

| Rol | Niveau | Wat |
|---|---|---|
| accountmanager | Beginner | Fasepil, status en dagen in fase op de kaart; geen menu-item Prospectreizen |
| accountmanager | Gevorderd | Fase corrigeren met reden; reisgeschiedenis lezen; lijsten filteren op reis en fase; reis per doelgroep bekijken met aantallen per fase; `/reizen` staat in "Nog te ontgrendelen" |
| accountmanager | Expert | Een maatwerkreis maken als concept (leeg, vanuit de standaard of door dupliceren), fases, overgangen en startactiviteiten inrichten, "Controleer", "Droogloop", "Vraag publicatie aan", "Stel fases voor" (AI) |
| salesmanager | Gevorderd of Expert | Doelgroepen en reizen beheren, conceptversies publiceren, accenten van de standaardreis bijstellen, "Draai terug", pauzeren, archiveren |
| beheerder | Expert | Alles, inclusief prioriteit tussen doelgroepen en "Standaard terugzetten" |
| founder | n.v.t. | Alleen na instappen |

### Schermen

**1. Reisoverzicht** (`/reizen`, Expert en salesmanager)

De inhoud is vastgelegd ("overzicht van doelgroepen en reizen"); de opbouw niet. Voorstel van boven naar beneden:

1. Kop: kicker "PROSPECTREIZEN", titel als zin ("4 reizen actief, 1 concept wacht op publicatie."), subtitel "Per doelgroep de route van gevonden naar klant." Knoppen "+ Nieuwe reis" (geel), "+ Doelgroep", "Hulp".
2. Tabel doelgroepen in prioriteitsvolgorde: naam, branches (chips uit het leesmodel, primair eerst), aantal accounts, actieve reis met versie, status ("Concept", "Actief", "Gearchiveerd"), sleepgreep voor prioriteit (beheerder).
3. Per reis een kaart: naam, doelgroep, versie, status, mini-trechter met aantallen per hoofdfase (Vinden, Bewerken, Verbinden, Klant, Verloren), "Open". De standaardreis staat altijd bovenaan met pil "Standaard".
4. Blok "Wacht op publicatie" (salesmanager): concepten waarvoor "Vraag publicatie aan" is gekozen.

Lege staat (geen maatwerkreis): "Je werkt nu met de standaardreis. Maak een eigen reis als een doelgroep anders koopt." (voorstel).

**2. Reiseditor** (`/reizen/:id`), tabbladen:

- **Doelgroep**: kies een bestaande doelgroep of maak er een: branches (uit het leesmodel, F25), omvang of klassen, gebieden, bron (koud, warm, referral, winback), eigen-veldfilters, uitsluitingen. Bij aanmaken de vraag "Past deze doelgroep bij onze ambitie?" ("Ja", "Deels", "Nee") met de ambitiezin erbij. Live teller: "214 accounts vallen in deze doelgroep, waarvan 37 al in een andere reis". Bij overlap met een andere doelgroep kies je de prioriteit. Sjablonen "Overstappers van <concurrent>" (per concurrent met soort Direct) en "Niets doen" voor slapende prospects.
- **Fases**: fasekaarten met volgnummer, naam, kleur met voorbeeldpil, omschrijving, Pitstop-accent in een geel blok, hoofdfase (verplicht), verwacht verblijf in dagen, markering "Instapfase" en "Eindfase gewonnen" of "Eindfase verloren". Knoppen ↑ ↓ en ×. "+ Fase" voegt achteraan toe. Per fase de winpunten uit de gekoppelde SalesDNA-fase (`vv_fasen.reis_hoofdfase`), alleen lezen.
- **Overgangen**: rijen "vanuit fase + gebeurtenis → naar fase", optioneel met een voorwaarde (klasse, kanaal, rol). "+ Overgang". De gebeurtenis komt uit de vaste catalogus (alleen gebeurtenissen die de app echt meldt).
- **Activiteiten**: per fase en per rol (binnendienst, buitendienst, alle) de startactiviteiten (actiesoort, belscript, termijn, uitvoerder) en standaardactiviteiten met verwacht resultaat. Dit zijn regels van de motor met patroon "fase betreden", gebonden aan deze reis.
- **Ritme**: optioneel een eigen hercontactritme, belmatrix, afspraakmatrix of offertematrix; leeg betekent de instellingen van de organisatie.
- **Stroom**: de reis als diagram (kolommen per hoofdfase, fases als blokken, overgangen als pijlen met gebeurtenislabel) met waarschuwingen in rood.

Werkbalk van de editor: "Controleer", "Droogloop", "Publiceer" (geel, salesmanager) of "Vraag publicatie aan" (Expert-accountmanager), "Stel fases voor" (Expert, AI), "Standaard terugzetten" (alleen bij de standaardreis, beheerder), en voor een actieve reis "Draai terug", "Pauzeer", "Archiveer".

**3. Validatiepaneel** (na "Controleer"): drie groepen "Fouten", "Waarschuwingen", "Informatie", elk met de fase bij naam en een klik naar de kaart. Teksten: "Fase onbereikbaar", "Doodlopende fase", "Gebeurtenis zonder overgang".

**4. Droogloop** (flyout 560 px): per fase hoeveel accounts er bij publicatie belanden en hoeveel taken de startactiviteiten maken, met verdeling per persoon.

**5. Fasemapping bij publiceren** (flyout 640 px): per oude fase een keuze voor de nieuwe fase met het aantal accounts; voorstel uit `faseMapping`. Knop "Publiceer en zet accounts om".

**6. Fase verwijderen** (bevestiging): vraag als titel "Fase 'Werkbezoek op project' verwijderen?", keuze "Vervangende fase" (verplicht), tekst met het gevolg ("12 accounts, 3 overgangen en 2 regels gaan naar 'In gesprek'."), knop "Verwijderen" (rood).

**7. Accountkaart** (uit P05): stuurstrip met "Reis" (naam) en fasepil; "Fase corrigeren" (Gevorderd) vraagt fase en reden; klik op de fasepil opent de reisgeschiedenis. "Verplaats naar reis" in het blok Ritme (Gevorderd voor eigen accounts, salesmanager voor alle), met reden.

**8. Telefoonweergave op 390 px.** De reiseditor is bewust niet op de telefoon (8.12): hij opent wel, met de melding "Beter op een groot scherm" en alleen lezen van fases en overgangen als lijst. `/reizen` op de telefoon: de reiskaarten onder elkaar met de mini-trechter, zonder bewerkknoppen (voorstel). Op de compacte accountkaart (8.5.5) blijven fasepil, status en "Poging 3 van 5" zichtbaar; "Fase corrigeren" opent als schuifvenster.

### Klikpaden

1. **Nieuwe reis.** In `/reizen` "+ Nieuwe reis", kies "Vanuit de standaardreis", "Vanuit een bestaande reis" of "Leeg". De editor opent op tabblad Doelgroep met een conceptversie.
2. **Doelgroep.** Kies branche br-01 "Installatiebedrijven woningbouw" (Voltvast), klasse A en B, gebieden; beantwoord de ambitievraag met "Ja". De teller toont het aantal en de overlap; kies de prioriteit.
3. **Fase toevoegen.** Op Fases "+ Fase", naam "Werkbezoek op project", hoofdfase Verbinden, verblijf 14 dagen, accent "Laat het leverplan per bouwfase zien."
4. **Overgang.** Op Overgangen "+ Overgang": vanuit "Eerste afspraak", gebeurtenis `gesprek-gevoerd`, naar "Werkbezoek op project".
5. **Controleer.** Het paneel toont "Doodlopende fase: Werkbezoek op project"; voeg een overgang naar "Offerte uit" toe; opnieuw "Controleer" geeft geen fouten.
6. **Droogloop.** "Droogloop" toont 214 accounts en 38 startactiviteiten bij publicatie.
7. **Publicatie aanvragen.** Een Expert-accountmanager klikt "Vraag publicatie aan"; er ontstaat een taak voor de salesmanager en het concept staat in "Wacht op publicatie" en in Team, Goedkeuringen (P21).
8. **Publiceren.** De salesmanager opent het concept, klikt "Publiceer"; bij gewijzigde fases opent de fasemapping; na bevestigen worden accounts omgezet met auditregel en reisgeschiedenis; toast in verleden tijd.
9. **Terugdraaien.** "Draai terug" maakt de vorige versie actief voor nieuwe accounts; accounts in de nieuwe versie krijgen weer een mapping.

### Filters en sorteren

- `/reizen`: filter status (Concept, Actief, Gepauzeerd, Gearchiveerd) en eigenaar; doelgroepen gesorteerd op prioriteit (vast), reizen op naam. Niet vastgelegd; voorstel.
- Lijsten en Vandaag: filters Reis en Fase (vastgelegd in F05), in de URL.

### Regels

- Een account zit in hoogstens één actieve reis, in precies één fase, met daarnaast een status (7.2).
- Elke fase heeft een hoofdfase (Vinden, Bewerken, Verbinden, Klant, Verloren), ook in maatwerk.
- Validatie: naam verplicht en uniek binnen de reis; geen overgang naar dezelfde fase; minstens één instapfase, één eindfase gewonnen en één eindfase verloren; "Fase onbereikbaar" (geen overgang ernaartoe en geen instapfase) en "Doodlopende fase" (geen uitgaande overgang en geen eindfase) blokkeren publiceren; "Gebeurtenis zonder overgang" is informatie.
- Fase verwijderen vraagt een vervangende fase; regels, overgangen en accounts worden echt omgezet; nooit een kaal technisch id op een kaart (regel 42).
- Elke wijziging aan een actieve reis gaat in een conceptversie; de actieve versie blijft lopen; lopende uitvoering blijft op haar versie (`prospectreizen.template_versie`).
- Publiceren maakt een nieuwe versie; bij gewijzigde fases eerst de fasemapping; pas na bevestigen worden accounts omgezet.
- Toewijzing bij binnenkomst (overname, import, CRM-synchronisatie): `kiesReis` kiest de eerste actieve doelgroep in prioriteitsvolgorde waarin het account past, anders de standaardreis.
- Handmatig verplaatsen per account of in bulk met reden. Een afgeronde reis bewaart de laatste fase en historie; heropvolging start een nieuwe inschrijving.
- "Standaard terugzetten" werkt per reis en zet fases, accenten, overgangen en startactiviteiten samen terug, met een tekst die zegt wat verloren gaat; andere reizen blijven ongemoeid (regel 41, gebouwd in P05; hier niet breken).
- Vergelijken van versies in Analyse (P21) vraagt minimaal 20 accounts per versie.
- "Stel fases voor" maakt altijd een concept, nooit een actieve versie; AI schrijft nooit een winpunt (11.2).

### Helpartikelen

- "Een eigen prospectreis bouwen" (leerpad Expert): wanneer een maatwerkreis zin heeft, hoofdfase verplicht, controleer en droogloop, publicatie aanvragen.
- "Doelgroepen en reizen" (categorie Inrichten): prioriteit, overlap, versies, fasemapping, terugdraaien.
- "De prospectreis en fases" (categorie Prospects) bestaat uit P05; vul aan met "Fase corrigeren".

## Deel 2: Technisch (hoe)

### Datamodel

Uit F05 (bestaat grotendeels uit P05; P22 vult aan wat de editor nodig heeft):

- `doelgroepen: id, organisation_id, naam, status ('concept'|'actief'|'gearchiveerd'), prioriteit int, versie int, data jsonb` met `omschrijving, sbi[], klassen[], omvang {min, max}, gebiedIds[], postcodes[], bron, eigenVeldFilters[{sleutel, vergelijking, waarde}], uitsluitingen {segmenten[], tags[]}, geschatteOmvang`. Voeg toe (F25): `data.brancheIds[]` uit het leesmodel en `data.ambitie ('ja'|'deels'|'nee')`; veldnamen niet vastgelegd, voorstel.
- `reistemplates: id, organisation_id, naam, doelgroep_id (null = standaardreis), versie int, status ('concept'|'actief'|'gepauzeerd'|'gearchiveerd'), is_standaard, bron {reisId?, versie?}, eigenaar_id, data {fases[], overgangen[], overschrijvingen {hercontactRitmeId?, belmatrix?, afspraakmatrix?, offertematrix?}}`.
- `activiteitstemplates: id, organisation_id, reistemplate_id, fase_id, versie int, data {naam, rol, actiesoort, belscriptId?, termijnWerkdagen, uitvoerder, waarom {bron, ref}, verwachtResultaat {omschrijving, maat, drempel}, benodigdeInput[], kostenCent, standaardDuurMin}`.
- `prospectreizen` en `reisgeschiedenis` (P05); `accounts.reis_id`, `fase_id`, `nb_status`, `fase_sinds` als kolommen.
- `activity_rules.reis_id`, `activity_rules.fase_id`.
- Publicatieaanvraag: niet vastgelegd; voorstel `reistemplates.data.publicatieAangevraagd {door, op}` plus een taak voor de salesmanager met herkomst "Handmatig".
- RLS `org_isolation`; versies append-only (een gepubliceerde versie wijzig je nooit, je maakt een nieuwe).
- Rechtenmatrix (3.3): accountmanager lezen, maatwerkreis maken als Expert (eigen concept); salesmanager lezen, schrijven, activeren; beheerder alles.
- Sync-allowlist: `reistemplates` en `doelgroepen` alleen lezen in de sync (voor de kaart en filters offline); schrijven via de endpoints hieronder.

### Pure functies (`shared/reis.ts`)

| Functie | Invoer | Uitvoer | Randgevallen en tests |
|---|---|---|---|
| `kiesReis(account, doelgroepen)` | account, doelgroepen | reis-id | geen passende doelgroep geeft standaardreis; twee passende, hoogste prioriteit wint |
| `pastInDoelgroep(account, doelgroep)` | account, doelgroep | boolean | eigen-veldfilter op een leeg veld; uitsluiting wint |
| `volgendeFase(template, faseId, gebeurtenis, context)` | template, fase, gebeurtenis | nieuwe fase of null | twee overgangen met voorwaarde, hoogste prioriteit wint; hoogstens één wissel per gebeurtenis |
| `valideerReis(template)` | template | `{fouten[], waarschuwingen[], informatie[]}` | onbereikbaar, doodlopend, geen instap, geen eindfase gewonnen of verloren, dubbele naam, overgang naar zichzelf, fase zonder hoofdfase |
| `faseMapping(oud, nieuw)` | twee versies | voorstel per oude fase | gelijke id, anders gelijke hoofdfase en positie; verwijderde fase zonder voorstel moet een keuze vragen |
| `droogloop(template, accounts, regels)` | template, accounts, regels | aantallen per fase en verwachte taken | lege doelgroep; account al in een andere reis |
| `zetFaseOm(entiteiten, vanFaseId, naarFaseId)` | regels, overgangen, accounts | omgezette entiteiten | geen enkel kaal id blijft over (regel 42); niet vastgelegd als naam, voorstel |

### Endpoints

| Methode en route | Recht | Invoer | Uitvoer | Fouten |
|---|---|---|---|---|
| `GET/POST/PUT /api/doelgroepen` | lezen iedereen; schrijven salesmanager, beheerder; Expert voor een doelgroep in zijn eigen concept | doelgroep | doelgroep | 422 bij een onbekende branche |
| `GET /api/doelgroepen/:id/telling` | Expert, salesmanager | filters | `{aantal, inAndereReis}` | |
| `GET/POST /api/reizen`, `PUT /api/reizen/:id` | lezen Gevorderd; concept Expert; publiceren salesmanager | template | template | 409 bij wijzigen van een actieve versie (maak een concept) |
| `POST /api/reizen/:id/controleer` | Expert | geen | validatie | |
| `POST /api/reizen/:id/droogloop` | Expert | geen | aantallen | |
| `POST /api/reizen/:id/publiceer {mapping}` | salesmanager, beheerder | mapping | nieuwe versie, aantal omgezette accounts | 422 bij fouten in de validatie of een onvolledige mapping |
| `POST /api/reizen/:id/terugdraaien`, `/pauzeer`, `/archiveer`, `/standaard-terug` | salesmanager, beheerder | reden | status | |
| `POST /api/reizen/:id/publicatie-aanvragen` | Expert | geen | taak-id | niet vastgelegd; voorstel |
| `POST /api/reizen/:id/fase-verwijderen {faseId, vervangendeFaseId}` | Expert in concept, salesmanager | ids | omgezette aantallen | niet vastgelegd als aparte route; voorstel; 422 zonder vervangende fase |
| `POST /api/reizen/voorstel` | Expert | `{doelgroepId}` | concepttemplate | niet vastgelegd als route; voorstel; 429 bij lege bundel |
| `POST /api/accounts/:id/verplaats-reis` | Gevorderd (eigen), salesmanager | `{reisId, reden}` | account | 422 zonder reden |

Het meldpunt `POST /api/reis/gebeurtenis` blijft de enige plek waar fases veranderen; publiceren met mapping schrijft per account een rij in `reisgeschiedenis` met gebeurtenis `handmatig` en de reden "Nieuwe reisversie".

### AI-stappen

- "Stel fases voor" (Expert, optioneel): agent Profielbouwer of Coach is niet vastgelegd; voorstel de Coach met mandaat A voor voorstellen. Materiaal: doelgroep, verkoopproces, winpunten en fasen uit het leesmodel. Schema volgens `reistemplates.data` (fases, overgangen) met `additionalProperties false`, daarna `valideerReis`; altijd als concept. Mock met een vaste conceptreis voor de Voltvast-branche br-01. Bundelsoort niet vastgelegd; voorstel "Coach en verbetervoorstel" (0 / 50 / 50).
- Het Pitstop-accent van de fase gaat mee in elke voorbereiding (P18); de editor bewaart het per fase.

### Integraties

Geen externe. De motor (P06) leest `activiteitstemplates` als regels met patroon "fase betreden".

### Functiecatalogus

Niet vastgelegd in het bouwplan welke sleutels; voorstel:

| Sleutel | Niveau | Pakket | Recht | Helpartikel |
|---|---|---|---|---|
| `reizen.bekijken` | Gevorderd | Starter | lezen | De prospectreis en fases |
| `reizen.maatwerk` | Expert | Plus | concept maken | Een eigen prospectreis bouwen |
| `reizen.publiceren` | Gevorderd | Plus | salesmanager | Doelgroepen en reizen |
| `reizen.voorstelAI` | Expert | Plus | concept maken | Een eigen prospectreis bouwen |
| `account.faseCorrigeren` | Gevorderd | Starter | schrijven | De prospectreis en fases |

### Hergebruik uit DealDrive

- `customer-journey.vue`: fasekaarten, overgangsrijen, kleurkeuze en accent overnemen; toevoegen: hoofdfase, verblijf, instap en eind, tabbladen, validatiepaneel, mapping; het verwijderen met een kaal id vervangen door de verplichte vervangende fase.
- `useCustomerJourney.ts`: van één organisatiebrede lijst naar een reis als object met versie.
- `journeyEngine.ts`: doorschuiven en audit; aanpassen aan `volgendeFase` met voorwaarde en prioriteit.
- `faseAccent.ts` en `agentExecutor.ts`: accent per fase per reis.

### Buiten scope

De standaardreis zelf en het meldpunt (P05), de motor (P06), Analyse van versies (P21), schrijven van fasen in SalesDNA (alleen de mapping `vv_fasen.reis_hoofdfase` lezen), een reiseditor op de telefoon.

## Acceptatiecriteria

1. Bijlage A regel 42: een fase verwijderen vraagt een vervangende fase; daarna bevat geen regel, overgang, account of kaart nog het oude fase-id (databasetest op alle drie).
2. Een maatwerkreis met een onbereikbare fase kan niet worden gepubliceerd; de melding noemt de fase.
3. Een reis zonder eindfase verloren geeft een fout; publiceren geeft 422.
4. Publiceren van een versie met een verwijderde fase vraagt een mapping en zet 100 procent van de accounts om; geen account houdt een onbekend fase-id.
5. Een account past in twee doelgroepen en komt in de reis van de doelgroep met de hoogste prioriteit.
6. Een lopend account blijft op zijn templateversie tot de mapping hem omzet; nieuwe accounts komen in de nieuwe versie.
7. "Draai terug" maakt de vorige versie actief voor nieuwe accounts en vraagt een mapping voor accounts in de nieuwe versie.
8. De droogloop toont hetzelfde aantal startactiviteiten als de motor bij publicatie werkelijk maakt (test met 40 accounts).
9. "Stel fases voor" levert altijd een concept dat `valideerReis` doorstaat of met fouten wordt getoond; nooit een actieve versie.
10. "Standaard terugzetten" laat maatwerkreizen ongemoeid.
11. Niveau Beginner: geen menu-item Prospectreizen; een directe link naar `/reizen` toont de paginakop met kicker "Vergrendeld" en uitleg, geen foutpagina.
12. Niveau Gevorderd: ziet de reis per doelgroep met aantallen per fase en kan "Fase corrigeren" met reden; `/reizen` met bewerken staat in "Nog te ontgrendelen".
13. Niveau Expert (accountmanager): maakt een concept, controleert en doet een droogloop, maar ziet "Vraag publicatie aan" in plaats van "Publiceer"; `POST /api/reizen/:id/publiceer` geeft 403 met `reden: 'rol'`. Een salesmanager publiceert.
14. Telefoon (375, 390, 412 px): `/reizen/:id` opent met "Beter op een groot scherm" en alleen lezen, zonder horizontale scroll; "Fase corrigeren" werkt als schuifvenster op de compacte accountkaart met tikdoelen van minimaal 44 px, ook offline (wachtrij, één keer verwerkt).
15. Cross-tenant: een reis van organisatie A is onzichtbaar voor B (wegwerp-Postgres).

## Definition of Done

Hoofdstuk 19 geldt volledig. Specifiek voor deze prompt:

- Unit-tests voor `valideerReis`, `faseMapping`, `droogloop` en `zetFaseOm` met elke fout- en waarschuwingssoort.
- Playwright-flow uit het sprintdoel van sprint 11: een Expert bouwt een eigen reis en de salesmanager publiceert hem, op desktop.
- Elke publicatie en elke omzetting staat in de audit en in `reisgeschiedenis`.
- Regel 42 van Bijlage A afgevinkt in het sprintverslag; helpartikel "Een eigen prospectreis bouwen" gepubliceerd.
