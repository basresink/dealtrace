# P15: Datacollectief

| Onderdeel | Waarde |
|---|---|
| Sprint | 7 |
| Features | F02 Leadgenerator (bron Datacollectief) |
| Hangt af van | P01 (fundament, functiecatalogus, rechten), P27 (inloggen en mobiele schil), P03 (accounts, contacten, eigen velden), P04 (import en datakwaliteit), P28 (verkoopverhaal, `vv_branche_mapping`), P08 (Bewaker en plafonds), P11 (leadgenerator, leadstabel, AI-zoeker en KvK) |
| Bron in het bouwplan | F02 (bronnen, tabblad Koppelingen, grenzen, technisch), 12 (Integraties, rij Datacollectief), 11.4 (Datacollectief valt buiten de AI-credits), 15.1 (datakwaliteit), 15.2 (AVG), 10.1 (herkomst per gegeven), 22 (open vraag 5), ADR-015, Bijlage A regel 4 |

## Lees eerst

- `Bouwplan-Dealtrace.md`: 0.2 (B11), 4.2 en 4.3 (rij F02), F02 volledig, 10.1, 10.2 (rijen `leads`, `koppelingen`, `koppeling_runs`, `lead_verbruik`), 11.2, 11.4, 12 (rij Datacollectief en de slotalinea), 15.1, 15.2, 17 (sprint 7), 19, 22 (vraag 5), ADR-015, Bijlage A (regel 4 en 16), Bijlage B (rij Leads), Bijlage C (branches en SBI-mapping).
- DealDrive op commit 75bee61 (alleen lezen, `git -C /home/user/Dealdrive show origin/develop:<pad>`): `shared/leadGenerator.ts`, `app/pages/generator.vue`, `app/pages/import.vue`, `server/utils/webBron.ts`. DealDrive heeft geen Datacollectief-adapter; de adapter is nieuw.
- De uitkomst van P11: `shared/leadGenerator.ts`, `shared/ontdubbelen.ts`, `server/utils/bronnen/kvk.ts` en het bronnenmodel. P15 voegt de vijfde bron toe in exact dezelfde vorm.

## Deel 1: Functioneel (wat en waarom)

### Wat je bouwt

Je koppelt Datacollectief als bron in de leadgenerator: selecties op doelgroep die leads met contactpersonen opleveren, en verrijking van een bestaand account of contact met functie, direct nummer en zakelijk e-mailadres.

### Waarom

Een lead uit KvK of de AI-zoeker heeft vaak geen aanspreekpunt. Zonder contactpersoon met functie en nummer haalt een lead het criterium Bereikbaarheid niet en belt de binnendienst de receptie. Datacollectief levert bedrijven en contactpersonen (functie, direct nummer, zakelijk e-mailadres, LinkedIn), branche, omvang en selecties op doelgroep (F02). In DealDrive bestond de leadgenerator alleen als schil zonder server en zonder meting van het verbruik (Bijlage A, regel 4). Dealtrace bouwt één leadstroom met vijf bronnen (ADR-015): Datacollectief levert dezelfde leadstructuur, dezelfde ontdubbeling, dezelfde criteria en dezelfde vijf groepen als de andere bronnen.

### Gebruikers en niveaus

| Rol | Niveau | Wat |
|---|---|---|
| Accountmanager | Beginner | Ziet leads met bronpil "Datacollectief" die de salesmanager of een ronde klaarzette; staat "Neem over" voor Beginner aan (`/platform/features`, 4.2), dan ook "Neem over" en "Niet relevant" (F02). Ziet op contacten de herkomst "Datacollectief" met datum |
| Accountmanager | Gevorderd | Ziet Datacollectief als vinkje bij Bronnen in een zoekronde zodra de koppeling actief is en het pakket het toelaat. Niet vastgelegd in het bouwplan; voorstel: verrijken van één eigen account met contactpersonen ("Zoek contactpersonen") ook vanaf Gevorderd, omdat het per account is en binnen het maandplafond van de organisatie telt |
| Accountmanager | Expert | Datacollectief in bulk: selecties op doelgroep, opgeslagen zoekopdrachten en automatische rondes per doelgroep met Datacollectief als bron (4.3) |
| Salesmanager | Gevorderd of Expert | Als Expert, plus verbruik van het team lezen (3.3) |
| Beheerder | Expert | Koppelt Datacollectief: sleutel, test, tegoed, maandplafond (tabblad Koppelingen) |
| Founder | n.v.t. | Ziet de kosten per bron in Platformbeheer (F23); werkt alleen na instappen in klantdata |

### Schermen

**Tabblad Koppelingen** (`/leadgenerator`, tabblad "Koppelingen", beheerder richt in, Expert gebruikt), kaart Datacollectief van boven naar beneden:

1. Kop "Datacollectief" met statuspil ("Actief", "Niet gekoppeld", "Fout").
2. Veld "API-sleutel" (schrijf alleen; na opslaan alleen een vingerafdruk van acht tekens, zie F23 en Bijlage A regel 49 als patroon), knop "Test verbinding". Volgorde: eerst testen, dan opslaan (12).
3. Regel "Tegoed" met de stand van het tegoed en "Datacollectief-records deze maand 120 / 500".
4. Veld "Maandplafond records" (instelling per organisatie, F02 "eigen plafonds per maand uit de instellingen").
5. Lijst "Functies": selectie op doelgroep (branche, omvang, regio, functieniveau), verrijken van een account met contactpersonen, verrijken van een contact (functie, nummer, e-mail).
6. Laatste runs uit `koppeling_runs`: datum, gelezen, geschreven, fouten.
7. Foutmelding in gewone taal, in de vorm van 12 ("De KvK-sleutel is verlopen. Vraag een nieuwe aan bij KvK en plak hem hier."). Niet vastgelegd in het bouwplan; voorstel voor Datacollectief: "De Datacollectief-sleutel werkt niet meer. Vraag een nieuwe aan bij Datacollectief en plak hem hier." en "Je tegoed bij Datacollectief is op. Vul het aan bij Datacollectief; tot die tijd is de bron uitgeschakeld."

Lege staat zonder koppeling: Niet vastgelegd in het bouwplan; voorstel: "Datacollectief is nog niet gekoppeld. Een beheerder plakt hier de sleutel van jullie contract." Voor een niet-beheerder zonder knop.

Pakket te laag: de kaart toont "Onderdeel van Compleet" met een link naar het abonnement, alleen voor de beheerder (4.2; Datacollectief-records zitten alleen in Compleet, 11.4).

**Tabblad Zoeken** (bestaat uit P11): in het vak "Bronnen" staat het vinkje "Datacollectief" alleen als de koppeling actief is (F02: "alleen gekoppelde zichtbaar"). Leadrijen uit deze bron krijgen de bronpil "Datacollectief" en tonen de contactpersoon ("Peter Kok · eigenaar · beslisser" is het voorbeeld uit F02). Onderaan de meter "Datacollectief-records 120 / 500".

**Accountkaart en contacten** (F03, F04): knop bij het blok Contacten. Niet vastgelegd in het bouwplan; voorstel: secundaire knop "Zoek contactpersonen" met kostenregel "Kost tot 5 records", die `POST /api/accounts/:id/verrijk-contacten` aanroept. Elk veld dat Datacollectief vulde toont de herkomst "Datacollectief · 2026-10-14" (10.1).

**Importwizard stap 4** (bestaat uit P04): de keuze "Zoek contactpersonen via Datacollectief" met kostenindicatie wordt nu werkend.

**Telefoon (390 px).** De leadgenerator in bulk staat bewust niet op de telefoon; de pagina opent wel met de melding "Beter op een groot scherm" (8.12). Op de compacte accountkaart (8.5.5) toont het blok Contacten de herkomst. Datacollectief werkt niet offline (8.8): de knop toont dan "Niet beschikbaar zonder verbinding".

### Klikpaden

1. Koppelen (beheerder): Instellingen, Koppelingen of `/leadgenerator` tabblad "Koppelingen" (1), sleutel plakken, "Test verbinding" (2), bij succes "Opslaan" (3). Toast "Datacollectief gekoppeld." Bij een fout blijft de oude stand staan en verschijnt de melding in gewone taal.
2. Leadronde met Datacollectief (Expert): tabblad "Zoeken" (1), vinkje "Datacollectief" (2), "Nieuwe ronde" (3). De ronde levert leads in de vijf groepen; leads met contactpersoon en nummer scoren op Bereikbaarheid.
3. Contacten aanvullen op een account: "Zoek contactpersonen" (1), bevestigen met kosten (2). Nieuwe contacten verschijnen met herkomst; bestaande contacten worden ontdubbeld op e-mail en anders volledige naam (15.1). Toast (voorstel): "3 contactpersonen toegevoegd uit Datacollectief."
4. Bij import (stap 4): vinkje "Zoek contactpersonen via Datacollectief", "Importeer". De voortgangsbalk telt ook de records.

### Knoppen, bevestigingen en meldingen

- "Nieuwe ronde" is een knop met uitleg als de AI-credits op zijn (F02, P11). Voor Datacollectief geldt hetzelfde bij een vol maandplafond. Niet vastgelegd in het bouwplan; voorstel tooltip: "Je maandplafond voor Datacollectief-records is op."
- Bij 80 procent van het maandplafond een melding aan de beheerder (F24). Niet vastgelegd in het bouwplan; voorstel: soort "Datacollectief op 80 procent".
- Bij 100 procent een blokkade vóór de aanroep (11.2).
- "Zoek contactpersonen" vraagt bevestiging met het maximale aantal records, omdat het tegoed kost.

### Filters en sorteren

Geen nieuwe filters. De bestaande bronfilter in de leadgenerator en op Rondes en verbruik krijgt de waarde "Datacollectief". De bronpil telt als filterwaarde in de URL (`?bron=datacollectief`).

### Regels

- Elk opgehaald record kost tegoed en telt in het maandverbruik in `lead_verbruik` (F02). Datacollectief is geen AI en valt buiten de AI-credits; het aantal records volgt het contract van de organisatie (11.4).
- Plafond per maand per organisatie uit de instellingen; afgedwongen op de server.
- Herkomst `datacollectief` met datum op elk veld (12). Bronprioriteit: hand boven kvk boven datacollectief boven crm boven salesdna boven web boven ai boven import; een lagere bron overschrijft een hogere nooit stil (10.1). Datacollectief overschrijft dus nooit een handmatig of KvK-veld.
- Validatie: e-mail syntaxis plus MX, telefoon naar E.164 (15.1).
- Geen verzonnen gegevens: een nummer of adres komt alleen van de bron (15.1).
- AVG: zakelijke contactpersonen op grond van gerechtvaardigd belang; nooit privégegevens; het contract met Datacollectief regelt de herkomst; een afgemeld contact staat gehasht op de onderdrukkingslijst zodat een nieuwe ophaal of import niet opnieuw mailt (15.2).
- Leads die niet zijn overgenomen worden na 60 dagen opgeruimd, afgewezen na 120 (15.2).
- Terugval zonder API: bestandsexport van Datacollectief via de import, met bron "Datacollectief" (12, open vraag 5).
- Kansregel voor de klasse: medewerkers uit KvK of Datacollectief, vergeleken met de klassen van de organisatie (F02).

### Helpartikel

- "KvK en Datacollectief" (collectie Hoe werkt Dealtrace, categorie Prospects, F21). Kern: wat Datacollectief levert, wat een record kost, waar je het tegoed ziet, wat herkomst betekent en waarom Dealtrace nooit privégegevens ophaalt. "Probeer het" opent `/leadgenerator`.
- "Koppelingen" (categorie Inrichten, beheerder): sleutel, test, plafond.

## Deel 2: Technisch (hoe)

### Datamodel

Geen nieuwe tabellen; P15 gebruikt de tabellen uit F02 (aangelegd in P11 en P04):

- `koppelingen`: rij met `soort = 'datacollectief'`, `status`, `geheimen` (versleuteld met AES-256-GCM, eigen geheim per doel, 15.3), `instellingen {plafond, veldtoewijzing?}`.
- `koppeling_runs`: elke aanroep met `start`, `eind`, `gelezen`, `geschreven`, `fouten`.
- `lead_verbruik`: `soort = 'datacollectief'`, `aantal`, `kosten_cent` per maand.
- `leads`: `bron = 'datacollectief'`, `bron_ref` met het externe id, `data.contacten[]` met `bron: 'datacollectief'`.
- `contacts.data.herkomst[veld] = {bron: 'datacollectief', op}`; `accounts.data.herkomst` idem.
- Migratie: alleen als P11 de waarde `datacollectief` nog niet in de toegestane waarden heeft; anders geen migratie.
- RLS: `org_isolation` op `organisation_id` geldt al voor alle drie tabellen (10.1).
- Rechtenmatrix (3.3): Leads en leadgenerator: accountmanager lezen alles, schrijven eigen; salesmanager en beheerder alles. Koppelingen schrijven: alleen beheerder.
- Sync-allowlist: `koppelingen` staat er niet op (geheimen); `leads` en `contacts` lopen zoals in P11 en P03. Geen nieuwe offline-mutatiesoorten: Datacollectief werkt niet offline (8.8).

### Pure functies

| Functie | Invoer | Uitvoer | Randgevallen | Tests |
|---|---|---|---|---|
| `selectieUitDoelgroep(doelgroep, brancheMapping)` in `shared/leadGenerator.ts` | doelgroep (sbi, klassen, omvang, gebieden, postcodes), `vv_branche_mapping` | selectie `{sbi[], trefwoorden[], omvang, regio[], functieniveaus[]}` | doelgroep zonder branche; branche zonder mapping (lege sbi, melding) | mapping br-01 en br-02 naar 4321 en 4322 (Bijlage C) |
| `datacollectiefNaarLead(record)` | record uit de adapter | lead in de gemeenschappelijke leadstructuur | record zonder KvK; contact zonder e-mail; privé-ogend nummer | elk veld krijgt herkomst `datacollectief` met datum |
| `voegContactenSamen(bestaand, nieuw)` in `shared/ontdubbelen.ts` | contacten van een account, nieuwe contacten | `{toevoegen[], bijwerken[], overslaan[]}` | zelfde e-mail; zelfde naam zonder e-mail; contact bij ander bedrijf (verhuisd) | exacte e-mail wint, anders volledige naam (15.1) |
| `magOverschrijven(huidigeBron, nieuweBron)` | twee bronnen | boolean | onbekende bron | volgorde uit 10.1, Datacollectief onder kvk en hand |
| `plafondStand(verbruik, plafond)` | verbruik deze maand, plafond | `{rest, procent, geblokkeerd, waarschuwen}` | plafond 0; plafond niet ingesteld | waarschuwen vanaf 80 procent, blokkeren op 100 |

### Endpoints

| Methode en route | Recht | Invoer | Uitvoer | Fouten |
|---|---|---|---|---|
| `GET /api/koppelingen/datacollectief` | beheerder schrijven, Expert lezen | geen | status, plafond, tegoed, laatste runs; nooit de sleutel | 403 `{functie, reden}` |
| `PUT /api/koppelingen/datacollectief` | beheerder | `{sleutel?, plafond?}` | status | 400 bij een sleutel die de test niet haalt |
| `POST /api/koppelingen/datacollectief/test` | beheerder | `{sleutel}` | `{ok, tegoed?, melding}` | 502 met melding in gewone taal |
| `POST /api/datacollectief/selectie` | functie `leadgenerator.datacollectief` | `{doelgroepId?, selectie}` | ronde-id, aantal leads | 403 pakket of niveau; 429 plafond met "Je maandplafond voor Datacollectief-records is op." (voorstel) |
| `POST /api/accounts/:id/verrijk-contacten` | functie `datacollectief.verrijken` | `{max?}` | `{toegevoegd, bijgewerkt, overgeslagen}` | 404 account; 409 als het account geen KvK of domein heeft (voorstel) |
| `POST /api/leads/ronde` (bestaat, P11) | als P11 | `bronnen` bevat `datacollectief` | als P11 | bron niet gekoppeld: 400 |
| `GET /api/leads/verbruik` (bestaat) | als P11 | geen | meters inclusief Datacollectief | geen |
| `GET /api/config/status` (bestaat) | ingelogd | geen | of een sleutel bestaat, niet de waarde (12) | geen |

Elke aanroep naar Datacollectief: plafondcheck vóór de aanroep, log in `koppeling_runs`, telling in `lead_verbruik`, onderdrukkingslijst toepassen vóór opslaan.

### AI-stappen

Geen. Datacollectief is geen AI-bron; de gegevens gaan als feiten met bron `datacollectief` het materiaal van dossier en beoordeling in (F02).

### Integratie

- Adapter `server/utils/bronnen/datacollectief.ts` met `selectie(opdracht)`, `verrijkBedrijf(kvk|domein)`, `verrijkContact(contact)`; dezelfde vorm als `kvk.ts`.
- Mock met vaste fixtures; tests draaien zonder sleutel en zonder netwerk (11.2, 19). Niet vastgelegd in het bouwplan; voorstel voor de fixtures: tien fictieve installatiebedrijven in de branches br-01 en br-02 van Voltvast (SBI 4321 en 4322) in Midden- en Noord-Nederland, met fictieve namen, fictieve KvK-nummers die niet bestaan, en contactpersonen met fictieve namen; nooit echte bedrijfs- of persoonsgegevens.
- Kosten per record in `lead_verbruik.kosten_cent`; kosten per bron zichtbaar in Analyse (21, risico Datacollectief-kosten).
- Cache: Niet vastgelegd in het bouwplan; voorstel: dezelfde selectie binnen 24 uur geeft het bewaarde resultaat zonder kosten (zoals bij de AI-ronde, F02), en verrijking per KvK-nummer 30 dagen in cache (zoals KvK, 12).
- Terugval: bestandsexport van Datacollectief via de importwizard (P04) met bronlabel "Datacollectief" en herkomst `datacollectief`.

### Functiecatalogus

Sleutelnamen zijn niet vastgelegd in het bouwplan; voorstel:

| Sleutel | Startindeling: aan vanaf | Pakket | Recht | Helpartikel |
|---|---|---|---|---|
| `leadgenerator.datacollectief` (selectie, bron in rondes) | Expert | Compleet | leads schrijven eigen | "KvK en Datacollectief" |
| `datacollectief.verrijken` (contactpersonen per account) | Gevorderd (voorstel) | Compleet | prospects schrijven | "KvK en Datacollectief" |
| `koppeling.datacollectief` (inrichten) | Expert | Compleet | beheerder | "Koppelingen" |

### Hergebruik uit DealDrive

- `shared/leadGenerator.ts`: afleiden, matchregels en groepen blijven; Datacollectief als extra bron in hetzelfde model.
- `app/pages/generator.vue`: bronpil en meters.
- `app/pages/import.vue`: stap 4 met verrijkoptie.
- Nieuw: de adapter, de mock en de koppelingenkaart.

### Buiten scope

- Verrijker-agent die Datacollectief periodiek gebruikt voor managementwijzigingen (P19).
- CRM-koppeling (P20).
- LinkedIn Sales Navigator, scrapen van LinkedIn, lijsten kopen vanuit de app (F02).

## Acceptatiecriteria

1. Bijlage A regel 4: de leadgenerator heeft een echte server, leadstabel en meting van het verbruik; Datacollectief is de vijfde werkende bron naast AI-zoeker, KvK, import en CRM (de CRM-bron volgt in P20).
2. Bijlage A regel 16: er is één definitie van de leadstructuur, de ontdubbeling en de bronprioriteit in `shared/`; Datacollectief heeft geen eigen kopie.
3. Een ronde met Datacollectief als bron levert leads in de vijf groepen met bronpil "Datacollectief" (F02).
4. Een lead met hetzelfde KvK-nummer als een bestaand account staat in "Al in je bestand".
5. Een Datacollectief-veld overschrijft nooit een veld met herkomst `hand` of `kvk`; de herkomst `datacollectief` met datum is zichtbaar.
6. Een contact dat al bestaat (zelfde e-mail) wordt niet dubbel aangemaakt.
7. Zonder sleutel is de bron niet kiesbaar en zegt de koppelingenpagina wat er nodig is (F02).
8. Het plafond wordt op de server afgedwongen: een aanroep boven het plafond geeft 429 en kost niets; bij 80 procent krijgt de beheerder een melding.
9. Een organisatie op Starter of Plus ziet "Onderdeel van Compleet" (beheerder) en de server weigert met 403 `{functie, reden: 'pakket'}`.
10. Een gehasht afgemeld e-mailadres komt na een nieuwe ophaal niet terug als mailbaar contact.
11. Elke aanroep staat in `koppeling_runs` en telt in `lead_verbruik`.
12. Alle tests draaien met de mock, zonder netwerk; de fixtures bevatten alleen fictieve gegevens.
13. Cross-tenant: de koppeling en het verbruik van organisatie A zijn onzichtbaar voor B (wegwerp-Postgres).
14. Telefoon (8.12, 8.15, 8.16): op 375, 390 en 412 px opent `/leadgenerator` met "Beter op een groot scherm", zonder horizontale scroll; de herkomst op de compacte accountkaart is leesbaar; "Zoek contactpersonen" heeft een tikdoel van minimaal 44 px.
15. Offline (8.8): zonder verbinding toont de knop "Zoek contactpersonen" dat het niet kan en komt er niets in de wachtrij.
16. Niveaus: als Beginner ziet de gebruiker geen bronkeuze en geen "Zoek contactpersonen" (of met slot en uitleg); als Gevorderd ziet hij het vinkje Datacollectief niet in rondes in bulk ("Nog niet aangezet" met uitleg); als Expert werkt alles binnen het pakket. Getest per niveau.

## Definition of Done

Hoofdstuk 19 geldt volledig. Specifiek voor deze prompt:

- Adapter, mock en fixtures in de repository; `check:functies` groen met de drie sleutels.
- Geen netwerk in tests; één echte proefaanroep alleen als de founder een sleutel beschikbaar stelt (open vraag 5), met de kosten in het sprintverslag.
- Handboek `docs/HOE-HET-WERKT.md` en het helpartikel "KvK en Datacollectief" bijgewerkt in dezelfde commit.
- Bijlage A regel 4 afgevinkt in het sprintverslag voor het deel Datacollectief.
