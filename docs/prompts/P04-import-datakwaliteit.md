# P04: Import en datakwaliteit

| Onderdeel | Waarde |
|---|---|
| Sprint | 2 (Prospects en data) |
| Features | F02 Leadgenerator, alleen het tabblad Importeren |
| Hangt af van | P01 (herkomst, rechten, functiecatalogus), P03 (accounts, contacten, eigen velden, ontdubbelen) |
| Bron in het bouwplan | F02 (tabblad Importeren, datamodel `import_batches`, endpoints import), 15.1, 15.2, 10.1 (herkomst), 12 (rij DealDrive), ADR-015, 8.12, Bijlage A (gat 16) |

## Lees eerst

- Bouwplan-Dealtrace.md: F02 (vooral "Tabblad Importeren", het datamodel en de acceptatiecriteria), F03 (regel "Laatste contact"), F19 (rij "Import en CRM"), 10.1 (herkomst en bronprioriteit), 12 (rij DealDrive), 15.1, 15.2, ADR-015, 8.12 ("Bewust niet op de telefoon"), 13.4, Bijlage A.
- `docs/api/dealdrive-koppeling.md` hoofdstuk 4 (Ontdubbelen, `GET /accounts/zoek`) en `seed/dealdrive-mock/zoek-antwoord.json` (B21).
- DealDrive (commit 75bee61): `app/pages/import.vue` (wizard en dubbelcheck), `shared/leadGenerator.ts` (matchregels), `app/pages/generator.vue` (alleen voor de tabbladen).

## Deel 1: Functioneel (wat en waarom)

### Wat je bouwt

De importwizard in vier stappen voor Excel en CSV met kolomkoppeling, ontdubbelen tegen het bestand en binnen het bestand, een controle- en foutenrapport, terugdraaien per batch, en de regels voor datakwaliteit: validatie, herkomst per veld, bronprioriteit en de onderdrukkingslijsten.

### Waarom

Elke organisatie heeft lijsten (beurs, gekochte lijst, netwerk, oude offertes) die in één keer binnen moeten. Zonder ontdubbelen en herkomst vervuilt het bestand bij de eerste import, en een afgemeld contact mag via een nieuwe import nooit opnieuw benaderd worden (15.2). ADR-015: import is een van de vijf bronnen met dezelfde ontdubbeling.

### Gebruikers en niveaus

| Rol | Niveau | Wat |
|---|---|---|
| accountmanager | Beginner | Geen import in de startindeling; het tabblad staat in "Nog niet aangezet" met uitleg; zet de founder import aan voor Beginner (`/platform/features`, 4.2), dan importeert elke Beginner |
| accountmanager | Gevorderd | Importeren met ontdubbelen, eigen batches terugdraaien |
| accountmanager | Expert | Idem; plus verrijken via KvK en Datacollectief in de laatste stap zodra de koppelingen er zijn (P11, P15) |
| salesmanager | Gevorderd, Expert | Importeren voor het team, eigenaar verdelen over het team |
| beheerder | Expert | Alles, ook batches van anderen terugdraaien |

### Schermen

**Route** `/leadgenerator`, tabblad "Importeren". De andere tabbladen ("Zoeken", "Koppelingen", "Rondes en verbruik") bouwt P11; in deze prompt staat alleen "Importeren" plus een lijst van importbatches. Niet vastgelegd hoe de pagina eruitziet zolang alleen import bestaat; voorstel: paginakop "Leadgenerator" met subtitel "Bedrijven die passen bij je doelgroep, met bewijs, bron en datum." en alleen het tabblad "Importeren".

**Wizard** (stappenbalk uit hoofdstuk 14)

1. **Bestand**: Excel (.xlsx) of CSV, hooguit 10.000 rijen en 10 MB; keuze "Bedrijven" of "Bedrijven met contactpersonen"; voorbeeldbestand te downloaden; bron en label verplicht (bijvoorbeeld "Beurs Vakdagen 2026").
2. **Kolommen koppelen**: per kolom een doelveld (bedrijfsnaam verplicht; KvK, domein, adres, postcode, plaats, SBI, medewerkers, telefoon, contact voornaam, achternaam, functie, e-mail, mobiel, eigen velden als `cf:<sleutel>`); automatische herkenning op kolomnaam; voorbeeld van de eerste 10 rijen.
3. **Controle en ontdubbelen**: rapport "85 nieuw · 12 al in je bestand · 3 dubbel in het bestand · 4 met fouten"; per regel kiezen "Importeer als nieuw", "Voeg samen met …", "Sla over". Samenvoegen zet nooit een klant terug naar prospect. **Optioneel tegen DealDrive** (B21): staat de DealDrive-koppeling aan (of draait de mock), dan vraagt de controle per nieuwe rij `GET /accounts/zoek` op KvK, domein en naam; een treffer met soort `klant` staat als "Al klant in DealDrive" (standaard "Sla over"; niet benaderen tenzij de salesmanager het toestaat), een treffer met soort `prospect` als "Al prospect in DealDrive" met de eigenaar. Staat de koppeling uit, dan ontbreekt deze groep zonder melding.
4. **Bevestigen en verrijken**: keuzes "Verrijk na import via KvK" en "Zoek contactpersonen via Datacollectief" (met kostenindicatie), doelgroep en eigenaar (vast, of verdelen over het team volgens gebieden), "Zet in campagne". Daarna een voortgangsbalk en een samenvatting met een link naar de importbatch.

Wat in stap 4 van latere prompts afhangt:

| Keuze | Beschikbaar vanaf | Tot dan |
|---|---|---|
| "Verrijk na import via KvK" | P11 | niet tonen; de koppelingenpagina zegt wat er nodig is |
| "Zoek contactpersonen via Datacollectief" | P15 | niet tonen |
| Doelgroep | P05 | niet tonen |
| Verdelen volgens gebieden | P14 | Niet vastgelegd in het bouwplan; voorstel: "Vast" of "Gelijk verdelen over het team" |
| "Zet in campagne" | P16 | niet tonen |

**Foutenrapport**: per rij met fouten de rijnummer, het veld en de reden in gewone taal ("Postcode 3512 A klopt niet: vier cijfers en twee letters"), met "Download foutenlijst". Niet vastgelegd hoe het rapport per fout eruitziet; voorstel.

**Batchlijst**: per import datum, bestandsnaam, label, door wie, aantallen (nieuw, samengevoegd, overgeslagen, fouten), status (concept, verwerkt, teruggedraaid), knop "Draai import terug" zolang er nog geen activiteit op de accounts is. Bevestiging: "Import Beurs Vakdagen 2026 terugdraaien? 85 accounts zonder activiteit worden verwijderd; 3 accounts met activiteit blijven staan." met knop "Terugdraaien" (rood). Niet vastgelegd welke tekst; voorstel. Lege staat: "Nog geen imports. Start met een bestand uit Excel of CSV." Niet vastgelegd; voorstel.

**Telefoon.** Import staat in 8.12 bij "Bewust niet op de telefoon": de pagina opent wel, met de melding "Beter op een groot scherm". De batchlijst is op 390 px leesbaar zonder horizontale scroll.

### Klikpaden

1. Gevorderde opent `/leadgenerator`, tabblad "Importeren", sleept een .xlsx met 1.000 rijen, kiest "Bedrijven met contactpersonen", label "Beurs Vakdagen 2026", "Volgende".
2. Kolommen zijn herkend ("Bedrijfsnaam" naar bedrijfsnaam, "KvK-nummer" naar KvK, "Aantal monteurs" naar `cf:aantal_monteurs`); hij past één koppeling aan en ziet het voorbeeld van 10 rijen.
3. Het rapport toont "900 nieuw · 50 al in je bestand · 30 dubbel in het bestand · 20 met fouten"; hij kiest bij twee mogelijke duplicaten "Voeg samen met …" en laat de rest op de standaard.
4. Hij kiest eigenaar "Vast: ik" en klikt "Importeren"; de voortgangsbalk loopt; de samenvatting linkt naar de batch.
5. Een dag later, zonder activiteit op de accounts, klikt hij "Draai import terug": de accounts uit de batch zonder activiteit verdwijnen, de batch staat op "teruggedraaid".

### Regels

- Hooguit 10.000 rijen en 10 MB per bestand; bedrijfsnaam verplicht; bron en label verplicht.
- **Standaardkeuze per regel** in stap 3: "Importeer als nieuw" bij geen duplicaat, "Voeg samen met …" bij een zeker duplicaat (KvK of domein), "Sla over" bij dubbel in het bestand (tweede en volgende). Niet vastgelegd in het bouwplan; voorstel. Een mogelijk duplicaat (60 tot 80 procent) vraagt altijd een keuze.
- **Ontdubbelen accounts** (15.1): KvK gelijk is altijd een duplicaat; anders domein zonder `www.`; anders genormaliseerde naam (zonder B.V., N.V., Holding, Group) met Sørensen-Dice: 80 procent duplicaat, 60 procent mogelijk. In F02 (groep "Al in je bestand") staat de variant "naam plus postcode met 80 procent gelijkenis"; gebruik die voor import, want postcode staat in vrijwel elk importbestand. Niet vastgelegd welke van de twee bij import geldt; voorstel: naam plus postcode, en zonder postcode de naamregel uit 15.1.
- **Ontdubbelen contacten** (15.1): exact op e-mail, anders volledige naam binnen het bedrijf; een contact dat bij een ander bedrijf bestaat wordt "verhuisd" met datum, niet dubbel aangemaakt.
- **Samenvoegen**: velden uit de import overschrijven bestaande velden alleen volgens de bronprioriteit (hand boven kvk boven datacollectief boven crm boven salesdna boven web boven ai boven import); omdat import de laagste bron is, vult een import alleen lege velden. Een klant gaat nooit terug naar prospect. Beide id's in `data.samengevoegdUit[]` bij samenvoegen van twee accounts.
- **Validatie** (15.1): e-mail syntaxis plus MX; telefoon naar E.164; postcode vier cijfers en twee letters; URL bereikbaar alleen bij verrijking (niet bij import).
- **Geen verzonnen gegevens**: de import vult nooit een veld dat niet in het bestand staat; een patroon ("voornaam@domein") wordt niet aangevuld.
- **Geen contactmoment**: een import fabriceert geen contactmoment; `laatste_contact_op` blijft leeg, ook als het bestand een kolom "laatste contact" heeft (F03; Bijlage A gat 34 legt het bij P18 maar de regel geldt hier ook).
- **Onderdrukking**: een contact waarvan het e-mailadres (gehasht) op de onderdrukkingslijst staat, wordt geïmporteerd met toestemming e-mail "nee" en de bron "afgemeld"; een nummer op de bel-me-niet-lijst krijgt "Bel me niet" (15.2).
- **Status en reis**: nieuwe accounts krijgen soort prospect, status `nieuw`, `nb_bron` `import` en de herkomst per veld `{bron: 'import', op, door, batchId}`. De gebeurtenis `import` naar het meldpunt van de reis volgt in P05; tot dan schrijft de import een rij in `activiteiten` met soort `import`.
- **Terugdraaien**: alleen accounts zonder activiteit (geen taak afgerond, geen notitie, geen afspraak, geen wijziging door een mens na de import); samengevoegde accounts krijgen hun oude waarden terug. Niet vastgelegd wat terugdraaien met samengevoegde velden doet; voorstel: herstel uit de `voor`-waarden in `import_batches.rapport`.
- **Veroudering** (15.1): een contact zonder bevestiging in 12 maanden krijgt "controleren". Leg de functie hier vast; het signaal op Vandaag en in Team volgt in P07 en P21.

### Helpartikelen

- "Importeren" (Hoe werkt Dealtrace, Prospects): de vier stappen, kolomkoppeling met `cf:`, het ontdubbelrapport, terugdraaien.
- In "KvK en Datacollectief" (P11, P15) een verwijzing naar verrijken na import.

## Deel 2: Technisch (hoe)

### Datamodel

Migratie `0004_import`.

```ts
import_batches: id, organisation_id, gebruiker_id, bestandsnaam, soort ('bedrijven'|'bedrijven_contacten'),
                bron_label, koppeling jsonb, rapport jsonb, status ('concept'|'verwerkt'|'teruggedraaid'), verwerkt_op
  rapport: { nieuw, alInBestand, dubbelInBestand, fouten, regels [{rij, keuze, accountId?, matchId?, fouten[], voor?}] }
```

- `accounts.data.importBatchId` en `contacts.data.importBatchId` voor terugdraaien. Niet vastgelegd; voorstel.
- `onderdrukkingslijst (organisation_id, email_hash, op, bron)`. 15.2 noemt de lijst, niet de tabel; voorstel.
- `bel_me_niet` uit P03.
- Het bestand zelf wordt na verwerken niet bewaard. Niet vastgelegd; voorstel: tijdelijk in Supabase Storage EU tot de batch verwerkt is, daarna verwijderd.
- ADR-015 zegt dat elke bron dezelfde leadstructuur levert. De tabel `leads` komt in P11. Niet vastgelegd of import via `leads` loopt; voorstel: import maakt direct accounts (de wizard is de beoordeling) en P11 laat de importbatches in "Rondes en verbruik" zien met dezelfde tellingen.
- RLS `org_isolation`; rechten: import schrijven vanaf Gevorderd (functiecatalogus), terugdraaien eigen batch (Gevorderd) of elke batch (salesmanager team, beheerder).
- Sync-allowlist: niets; import loopt alleen online via de import-endpoints.

### Pure functies

| Functie | Invoer | Uitvoer | Randgevallen en unit-tests |
|---|---|---|---|
| `importKoppeling(kolommen, eigenVelden)` in `shared/leadGenerator.ts` | kolomnamen | voorstel doelveld per kolom | hoofdletters, spaties, "Plaats" en "Woonplaats", `cf:` op naam en op sleutel, onbekende kolom blijft leeg |
| `valideerImportRij(rij, koppeling, eigenVelden)` | rij | `{ok, fouten[{veld, reden}]}` | lege bedrijfsnaam, ongeldig e-mailadres, postcode zonder spatie, telefoon met +31, eigen veld met verkeerd type |
| `normaliseerNaam(naam)` in `shared/ontdubbelen.ts` | naam | genormaliseerde naam | B.V., BV, N.V., Holding, Group, leestekens, dubbele spaties |
| `sorensenDice(a, b)` | twee tekens | 0 tot 1 | lege tekst, één teken, identiek |
| `zoekDuplicaat(kandidaat, bestand)` | uit P03 | | uitbreiden met naam plus postcode |
| `dubbelInBestand(rijen)` | rijen | groepen van dubbele rijen | KvK, domein, naam plus postcode |
| `contactDuplicaat(nieuw, bestaand)` | uit P03 | | contact bij ander bedrijf geeft `verhuis` |
| `magOverschrijven(bronOud, bronNieuw)` | uit P01 | | import overschrijft nooit hand |
| `normaliseerTelefoon`, `valideerPostcode`, `valideerEmailSyntaxis` | tekst | genormaliseerd of fout | Nederlandse en Belgische nummers; "1234 AB" en "1234AB" |
| `magTerugdraaien(account, activiteiten, batch)` | account | boolean | activiteit van de import zelf telt niet |
| `moetControleren(contact, nu)` | contact | boolean | precies 12 maanden |

### Endpoints

| Methode en route | Recht | Invoer | Uitvoer | Fouten |
|---|---|---|---|---|
| `POST /api/import/voorbeeld` | `import.uitvoeren` | bestand, soort, label | kolommen, koppelvoorstel, 10 voorbeeldrijen, `batchId` | 413 boven 10 MB, 422 boven 10.000 rijen of zonder bedrijfsnaamkolom |
| `POST /api/import/controle` | idem | `{batchId, koppeling}` | rapport met tellingen en per regel standaardkeuze | 404 |
| `POST /api/import/verwerk` | idem | `{batchId, keuzes, eigenaar}` | voortgang (job) en samenvatting | 409 als de batch al verwerkt is |
| `POST /api/import/:id/terugdraaien` | eigen batch of salesmanager, beheerder | | `{verwijderd, bleven}` | 403, 409 als al teruggedraaid |
| `GET /api/import` | lezen | | batches | |
| `GET /api/import/:id/fouten.csv` | eigen batch | | CSV | |

`GET /api/import` en het fouten-CSV staan niet in het bouwplan; voorstel. Verwerken loopt als job met voortgang; 1.000 rijen moeten binnen de prestatiebudgetten blijven. Niet vastgelegd welk budget; voorstel: 1.000 rijen in hooguit 30 seconden.

### Integraties

- **MX-controle**: DNS-opzoeking achter een adapter met mock; in tests geen netwerk. Een time-out telt als "onbekend", niet als fout. Niet vastgelegd; voorstel.
- KvK en Datacollectief na import: P11 en P15, met adapter en mock volgens hoofdstuk 12.
- **Ontdubbelen tegen DealDrive** (optioneel, B21): leg `server/utils/dealdriveAdapter.ts` aan met alleen `zoekAccounts({kvk?, domein?, naam?})` volgens `docs/api/dealdrive-koppeling.md` hoofdstuk 4, met de uitvoering `mock` (fixture `seed/dealdrive-mock/zoek-antwoord.json`) en de uitvoering `http` (ondertekening uit hoofdstuk 2 van het contract), antwoorden 24 uur gecachet per sleutel. Lokaal en in tests draait altijd de mock (13.5). P11 gebruikt dezelfde functie; P23 breidt de adapter uit met overdracht en terugmeldingen. Een fout of time-out van DealDrive blokkeert de import nooit: de groep vervalt en het rapport meldt "DealDrive was niet bereikbaar; niet gecontroleerd tegen DealDrive." Niet vastgelegd; voorstel voor de tekst.

### AI-stappen

Geen. Kolomherkenning is een pure functie, geen AI.

### Functiecatalogus

| Sleutel | Startindeling: aan vanaf | Pakket | Recht | Helpartikel |
|---|---|---|---|---|
| `import.uitvoeren` | Gevorderd | Starter | accountmanager (eigen), salesmanager, beheerder | "Importeren" |
| `import.terugdraaien` | Gevorderd | Starter | eigen batch; salesmanager en beheerder alle | "Importeren" |
| `import.teamVerdelen` | Gevorderd | Starter | salesmanager, beheerder | "Importeren" |

Pakket: het bouwplan legt voor import geen pakket vast; voorstel Starter (import kost geen AI).

### Hergebruik uit DealDrive

| Bestand | Wat je aanpast |
|---|---|
| `app/pages/import.vue` | wordt het tabblad "Importeren" met de stappenbalk; dubbelcheck via `shared/ontdubbelen.ts`; server-side verwerken in plaats van in de browser |
| `shared/leadGenerator.ts` | matchregels naar `shared/ontdubbelen.ts`; kolomherkenning `importKoppeling` erbij |

### Buiten scope

Zoeken, AI-zoeker, KvK, Datacollectief, CRM, rondes en verbruik (P11, P15, P20); "Zet in campagne" (P16); doelgroep en reis bij import (P05); de datakwaliteitsgaten op Vandaag en in Team (P07, P21); de campagnecontrole op 20 procent onbereikbare accounts (P16).

## Acceptatiecriteria

1. Een import van 1.000 rijen met 50 duplicaten toont een correct ontdubbelrapport; de 50 staan in "al in je bestand" (sprint-2-toestand "1.000 accounts geïmporteerd met duplicaten gevangen").
2. Een rij met hetzelfde KvK-nummer als een bestaand account is altijd "al in je bestand", ook met een andere naam.
3. Rijen die binnen het bestand dubbel zijn, staan in "dubbel in het bestand" en worden één account.
4. Een bestand boven 10 MB of 10.000 rijen wordt geweigerd met een melding in gewone taal; zonder kolom voor bedrijfsnaam kan stap 2 niet verder.
5. Kolommen met `cf:aantal_monteurs` vullen het eigen veld; een waarde van het verkeerde type staat in het foutenrapport.
6. Samenvoegen overschrijft geen veld met herkomst `hand`, `kvk` of hoger; het zet nooit een klant terug naar prospect.
7. Terugdraaien verwijdert alleen accounts zonder activiteit en meldt hoeveel er bleven staan; een tweede keer terugdraaien geeft 409.
8. Een geïmporteerd account heeft geen `laatste_contact_op`, ook niet als het bestand een datumkolom "laatste contact" had.
9. Een contact op de onderdrukkingslijst krijgt toestemming e-mail "nee"; een nummer op de bel-me-niet-lijst krijgt "Bel me niet".
10. Elk geïmporteerd veld heeft herkomst `import` met batch, datum en gebruiker.
11. Een Beginner ziet het tabblad in "Nog niet aangezet" met uitleg; de server weigert met 403 en `reden: 'niveau'`; staat import in `functies_per_niveau` aan voor Beginner, dan kan elke Beginner importeren zonder release.
12. Met de DealDrive-mock staat een rij met het KvK-nummer uit `zoek-antwoord.json` als "Al prospect in DealDrive" met eigenaar; een treffer met soort `klant` staat als "Al klant in DealDrive" en wordt standaard overgeslagen; met de koppeling uit of DealDrive onbereikbaar loopt de import door zonder die groep.
13. Getest als Beginner (niet aangezet), Gevorderd (eigen import en terugdraaien) en Expert, en als salesmanager (verdelen over het team) en beheerder (batch van een ander terugdraaien).
14. De MX-adapter en de DealDrive-adapter hebben een mock; de tests draaien zonder netwerk.
15. Op 390 px opent de pagina met "Beter op een groot scherm" en zonder horizontale scroll.
16. Bijlage A, gat 16: ontdubbelregels en validatie staan één keer in `shared/` en worden ook door P03 ("+ Prospect") gebruikt.
17. Bijlage A, gat 34 (bij P18 als prompt genoemd): het importdeel "import fabriceert geen contactmoment" is hier al getoetst.

## Definition of Done

Hoofdstuk 19 geldt volledig. Specifiek voor deze prompt:

- Unit-tests op `importKoppeling`, `valideerImportRij`, `sorensenDice`, `zoekDuplicaat` met grensgevallen 59, 60, 79 en 80 procent.
- Wegwerp-Postgres-test: import van 1.000 rijen, terugdraaien, cross-tenant (batch van organisatie A niet zichtbaar of terug te draaien voor B).
- Playwright: de wizard van bestand tot samenvatting op desktop.
- Het testbestand bevat alleen verzonnen bedrijven en personen in de lijn van Testbedrijf Voltvast (installateurs in Midden- en Noord-Nederland, Bijlage C); geen echte KvK-nummers of e-mailadressen. Gebruik domeinen op `.test` (gereserveerd, nooit echt).
- Helpartikel "Importeren" en `docs/HOE-HET-WERKT.md` (ontdubbelen, bronprioriteit, terugdraaien) bijgewerkt in dezelfde commit.
