# P20: CRM-koppeling

| Onderdeel | Waarde |
|---|---|
| Sprint | 10 (Agents en bronnen) |
| Features | F02 CRM-koppeling (vijfde bron van de leadstroom), integratie CRM uit hoofdstuk 12 |
| Hangt af van | P01 (rechten, functiecatalogus, sessie), P03 (accounts, contacten, eigen velden), P04 (import, ontdubbelen, herkomst per veld), P05 (`kiesReis`, meldpunt `lead-overgenomen`), P11 (leadtabel, leadgenerator met tabblad Koppelingen, `koppelingen` en `koppeling_runs`), P15 (Datacollectief als voorbeeld van een adapter met plafond), P17 (deals en uitkomsten die je terugschrijft) |
| Bron in het bouwplan | F02 (Bronnen, tabblad Koppelingen, technisch deel); hoofdstuk 12 (rij CRM en de regels onder de tabel); 10.1 (herkomst en bronprioriteit); 15.1, 15.2, 15.3; F05 (toewijzing bij binnenkomst); F13 (slapende klanten uit besteldata); F14 (CRM als interne bron); F19 (bron CRM-veld); hoofdstuk 21 (risico CRM); open vraag 8; ADR-015; Bijlage A regels 4 en 21 |

## Lees eerst

- Bouwplan-Dealtrace.md: F02 volledig (vooral "Bronnen", "Tabblad Koppelingen", het datamodel, de adapters en de acceptatiecriteria), hoofdstuk 12 met de slotalinea over adapters, mocks, `koppeling_runs` en `GET /api/config/status`, 10.1 (herkomst per gegeven en bronprioriteit), 15.1 (ontdubbelen), 15.3 (geheimen, AES-256-GCM), F05 "Toewijzing van accounts aan een reis", F13 "Terugkomregels" (slapende klanten), F19 (veldtoewijzing naar het CRM), ADR-015, risico "CRM-koppeling geeft dubbele of verkeerde data", Bijlage A regels 4 en 21.
- DealDrive op commit 75bee61:
  - `server/api/integrations/hubspot/start.get.ts`, `callback.get.ts`, `status.get.ts`, `sync.post.ts`, `disconnect.post.ts` (OAuth-stroom; let op: zonder sessiecontrole)
  - `server/utils/hubspot-client.ts` (API-aanroepen), `server/utils/hubspot-mapper.ts` (veldtoewijzing, lege velden naar `undefined`, geld in centen)
  - `server/utils/hubspot-state.ts` (state in het geheugen: vervalt)
  - `shared/leadGenerator.ts` (`leidZoekopdrachtAf`, groepen)
  - `server/utils/calendarCrypto.ts` (versleuteling als voorbeeld, met een eigen geheim per doel)

## Deel 1: Functioneel (wat en waarom)

### Wat je bouwt

Een CRM-koppeling via één adapterlaag (eerst HubSpot) waarmee Dealtrace bedrijven en contacten uit het CRM leest voor ontdubbelen en het klantprofiel, en overgenomen leads, contactpersonen, uitkomsten en deals terugschrijft.

### Waarom

Een accountmanager mag geen bedrijf benaderen dat al klant is of al in het CRM als prospect van een collega staat, en wat hij in Dealtrace wint moet in het CRM terechtkomen zonder overtypen. In DealDrive hadden de HubSpot-endpoints geen sessiecontrole, stond de state in het geheugen en schreef de koppeling niets terug (Bijlage A regel 21). De leadgenerator miste een server en bronnen (regel 4); deze prompt voegt de vijfde bron toe aan de ene leadstroom (ADR-015).

### Gebruikers en niveaus

| Rol | Niveau | Wat |
|---|---|---|
| accountmanager | Beginner | Merkt de koppeling alleen indirect: een lead of prospect die al in het CRM staat, verschijnt niet als nieuw; uitkomsten worden teruggeschreven |
| accountmanager | Gevorderd | Ziet bij een zoekronde de groep "Al in je bestand" ook met CRM-treffers; ziet de bronpil "HubSpot" op een lead |
| accountmanager | Expert | Gebruikt het CRM als bron in de leadgenerator (bulk), start "Synchroniseer nu" voor een gekoppelde bron, ziet het synchronisatielog |
| salesmanager | Gevorderd of Expert | Als accountmanager; ziet in Analyse, tabblad Bronnen, de cijfers van de bron CRM (P21) |
| beheerder | Expert | Verbindt het CRM met OAuth, stelt veldtoewijzing, richting per object, eigenaarsregel, synchronisatiemoment en conflictregel in, test en ontkoppelt |
| founder | n.v.t. | Alleen na instappen in een organisatie; ziet kosten en fouten per klant in Platformbeheer (P24) |

### Schermen

**1. Kaart CRM in Koppelingen.** F02 noemt het tabblad "Koppelingen" in `/leadgenerator` (beheerder richt in, Expert gebruikt) en F22 de kaart "Koppelingen" in Instellingen, Data en AI. Niet vastgelegd in het bouwplan welke route het bewerkscherm heeft; voorstel: `/instellingen/koppelingen/crm` als bewerkscherm voor de beheerder, en in `/leadgenerator?tab=koppelingen` dezelfde kaart alleen lezen met "Synchroniseer nu" voor de Expert.

Opbouw van boven naar beneden (voorstel voor de indeling; de inhoud is vastgelegd in F02 en hoofdstuk 12):

1. Kruimelpad "Instellingen · Koppelingen", kicker "DATA EN AI", titel "CRM-koppeling".
2. Keuze van het CRM: HubSpot (beschikbaar); Salesforce, Microsoft Dynamics, Pipedrive en AFAS met de pil "Volgt" (open vraag 8: HubSpot, dan Salesforce, dan Dynamics en AFAS op aanvraag).
3. Status: niet verbonden, verbonden met datum en account, of fout in gewone taal. Knoppen "Verbind met HubSpot" (geel) of "Test verbinding" en "Ontkoppel". Foutvoorbeeld in de stijl van hoofdstuk 12: "De koppeling met HubSpot is verlopen. Verbind opnieuw om verder te synchroniseren." (tekst niet vastgelegd; voorstel).
4. **Richting per object**: Bedrijven, Contacten, Deals, Activiteiten, elk met "Lezen", "Schrijven" of "Beide". Standaard bij een nieuwe koppeling: alles op "Lezen" (risico 21: "eerst lezen, dan schrijven"; standaardwaarde niet vastgelegd, voorstel).
5. **Veldtoewijzing** per object: tabel met CRM-veld, Dealtrace-veld (standaardvelden en eigen velden als `cf:<sleutel>`), richting en een **voorbeeld** uit het eerste CRM-record ("veldtoewijzing met voorbeeld", hoofdstuk 21).
6. **Eigenaarsregel**: CRM-eigenaar naar Dealtrace-gebruiker op e-mailadres; lijst met niet gevonden eigenaren en een keuze "Wijs toe aan" (terugval niet vastgelegd; voorstel: de salesmanager van het team, zoals de eigenaarsregel van de motor in F15).
7. **Synchronisatiemoment**: elk uur en op verzoek; knop "Synchroniseer nu".
8. **Conflictregel**: bronprioriteit hand boven kvk boven datacollectief boven crm boven salesdna boven web boven ai boven import (10.1), als uitleg met voorbeeld; niet te wijzigen.
9. **Synchronisatielog**: laatste runs uit `koppeling_runs` met start, eind, gelezen, geschreven en fouten; klik op een run toont de fouten per record.

Lege staat (niet verbonden): "Er is nog geen CRM gekoppeld. Verbind je CRM om te voorkomen dat je klanten of prospects van collega's opnieuw benadert." (tekst niet vastgelegd; voorstel).

**2. Leadgenerator, tabblad Zoeken** (uit P11): de groep "Al in je bestand" toetst ook tegen het gekoppelde CRM (KvK gelijk, anders domein, anders naam plus postcode met 80 procent gelijkenis). Leadrij met bronpil "HubSpot" als de lead uit het CRM komt; knop "Open kaart" bij een treffer in het eigen bestand. Het vak "Bronnen" toont alleen gekoppelde bronnen. Het vak Branche kan uit klanten worden afgeleid: "Uit je 142 klanten in deze klassen" (alleen echte klanten, ook uit het CRM).

**3. Accountkaart**: herkomstlabel per veld met bron `crm` en datum (10.1); de Info-flyout toont dit vanaf Expert (4.5). Niet vastgelegd; voorstel: een link "Open in HubSpot" in de contactstrip als het account een extern id heeft.

**4. Telefoonweergave op 390 px.** Koppelingen hoort bij Instellingen en staat in "Meer" met "Beter op een groot scherm" (8.4, 8.12); de pagina opent, zonder horizontale scroll en met tikdoelen van minimaal 44 px. De bronpil "HubSpot" en het herkomstlabel zijn ook op de compacte accountkaart (8.5.5, tabblad Details) zichtbaar.

### Klikpaden

1. **Verbinden.** Beheerder klikt "Verbind met HubSpot". De server start OAuth met een state die aan de sessie hangt; na toestemming in HubSpot keert de beheerder terug op de kaart met status "Verbonden" en een toast "HubSpot is gekoppeld." (tekst voorstel). Tokens staan versleuteld in `koppelingen.geheimen`.
2. **Veldtoewijzing.** Beheerder opent Bedrijven, ziet de voorgestelde toewijzing met voorbeeldwaarden, past "Aantal medewerkers" aan op het eigen veld `cf:aantal_monteurs`; opslaan per veld na 600 ms met "Opgeslagen" (F22).
3. **Eerste synchronisatie.** "Synchroniseer nu": de adapter leest bedrijven en contacten; het log toont "Gelezen 1.240, geschreven 0, fouten 3". Klanten uit het CRM zijn nu treffers bij ontdubbelen en tellen mee in het profiel.
4. **Schrijven aanzetten.** Beheerder zet Bedrijven en Contacten op "Beide". Bij de volgende "Neem over" in de leadgenerator schrijft Dealtrace het bedrijf met contactpersonen naar HubSpot en bewaart het externe id; de bronpil van de lead blijft wat hij was.
5. **Uitkomst terugschrijven.** Een accountmanager rondt een belpoging af met "Gesproken, afspraak"; bij de volgende synchronisatie (of direct via de wachtrij van de adapter) staat in HubSpot een activiteit met kanaal, uitkomst en datum.
6. **Fout.** Het token verloopt; de kaart toont de fout in gewone taal, de beheerder krijgt een melding en klikt "Verbind opnieuw".

### Filters en sorteren

- Synchronisatielog: filter "Alleen met fouten", periode; nieuwste eerst. Niet vastgelegd; voorstel.
- Leadgenerator: filter Bron met de waarde "CRM" (bestaat al in P11); filters in de URL.

### Regels

- Sessiecontrole op elk CRM-endpoint; de organisatie komt uit de sessie, nooit uit de payload of de OAuth-state alleen (regel 21, 10.1).
- Tokens per organisatie, versleuteld met AES-256-GCM met een eigen geheim voor dit doel (15.3); `GET /api/config/status` laat alleen zien of een sleutel bestaat.
- Synchronisatie elk uur en op verzoek; webhooks van het CRM waar beschikbaar (hoofdstuk 12).
- Ontdubbelen over alle bronnen: KvK gelijk is altijd een duplicaat; anders domein zonder `www.`; anders genormaliseerde naam (zonder B.V., N.V., Holding, Group) met Sørensen-Dice: 80 procent duplicaat, 60 procent mogelijk (15.1). Bij samenvoegen blijven beide id's bewaard in `data.samengevoegdUit[]`, zodat de koppeling blijft werken.
- Een lagere bron overschrijft een hogere nooit stil: een veld met herkomst `hand`, `kvk` of `datacollectief` wordt niet door het CRM overschreven; het verschil verschijnt in het log.
- Samenvoegen zet nooit een klant terug naar prospect (F02).
- Het klantprofiel ("Lijkt op mijn klanten") gebruikt alleen echte klanten, niet prospects (`leidZoekopdrachtAf`: top 3 SBI, top 6 postcodegebieden).
- Een account dat via de CRM-synchronisatie binnenkomt, krijgt een reis via `kiesReis` (F05).
- Slapende klanten: Dealtrace herkent ze uit besteldata van het CRM (3, 6 of 12 maanden niet besteld) en maakt er een herwinaccount van (F13). Niet vastgelegd welk CRM-veld de laatste orderdatum levert; voorstel: een verplicht toe te wijzen veld "Laatste order" in de veldtoewijzing van Bedrijven, zonder toewijzing geen herkenning.
- Eigen velden met bron "CRM-veld" krijgen hun waarde uit de veldtoewijzing (F19).
- Elke run staat in `koppeling_runs`; kosten in het verbruik; foutmeldingen in gewone taal op de koppelingenpagina.

### Helpartikel

"Koppelingen" (collectie Hoe werkt Dealtrace, categorie Inrichten, voor de beheerder): wat de CRM-koppeling leest en schrijft, eerst lezen en dan schrijven, veldtoewijzing met voorbeeld, eigenaarsregel, bronprioriteit en het synchronisatielog. Niet vastgelegd of er een apart artikel "CRM koppelen" komt; voorstel: een sectie in "Koppelingen".

## Deel 2: Technisch (hoe)

### Datamodel

- `koppelingen` (uit P11): `soort` in `'hubspot'|'salesforce'|'dynamics'|'pipedrive'|'afas'`, `status`, `geheimen` (versleuteld), `instellingen jsonb {veldtoewijzing, richting, eigenaarsregel, plafond}`.
- `koppeling_runs`: `koppeling_id`, `start`, `eind`, `gelezen`, `geschreven`, `fouten jsonb`.
- `leads.bron = 'crm'`, `leads.bron_ref` met het externe id.
- Externe id's op records: niet vastgelegd in het bouwplan; voorstel `accounts.data.extern {hubspot: {id, bijgewerktOp}}`, idem op `contacts.data` en `deals.data`, plus `activiteiten.data.extern` met het id van de teruggeschreven activiteit, zodat schrijven idempotent is.
- OAuth-state: voorstel tabel `koppeling_states: state, organisation_id, gebruiker_id, verloopt_op` (10 minuten), ter vervanging van `hubspot-state.ts` in het geheugen.
- Herkomst `crm` per veld in `data.herkomst`.
- Migratie met RLS `org_isolation` op elke nieuwe tabel; app-rol zonder `bypassrls`.
- Rechtenmatrix (3.3): leads en leadgenerator, beheerder alles; koppelingen schrijven alleen beheerder (F02 "beheerder richt in"); synchroniseren op verzoek vanaf Expert.
- Sync-allowlist: `koppelingen` en `koppeling_runs` niet via de sync (alleen eigen endpoints; geheimen nooit naar de client).

### Pure functies

Niet vastgelegd in het bouwplan welke namen, behalve `zoekDuplicaat` en `leidZoekopdrachtAf`; voorstel in `shared/crm.ts`:

| Functie | Invoer | Uitvoer | Randgevallen en tests |
|---|---|---|---|
| `pasToewijzingToe(record, toewijzing, object)` | CRM-record, veldtoewijzing | patch met velden en herkomst `crm` | lege CRM-waarde wordt `undefined` (niet wissen); geld naar centen; onbekend veld genegeerd |
| `losConflictOp(huidig, patch, prioriteit)` | huidige waarden met herkomst, patch | toegepaste patch en lijst afgewezen velden | herkomst `hand` wint; gelijke bron wint de nieuwste; ontbrekende herkomst telt als `import` |
| `eigenaarVoor(crmEmail, gebruikers, terugval)` | e-mailadres | gebruiker-id | hoofdletters; onbekend adres geeft terugval |
| `crmNaarLead(bedrijf, contacten)` | CRM-bedrijf | leadstructuur van F02 | geen KvK; meerdere domeinen |
| `isSlapend(laatsteOrder, nu, maanden)` | datum, nu, 3, 6 of 12 | boolean | geen datum; grens op de dag |
| `schrijfplan(gebeurtenissen, richting)` | gebeurtenissen sinds laatste run | lijst schrijfacties | richting "Lezen" geeft niets; dubbel event één actie |

`zoekDuplicaat(kandidaat, bestand)` uit `shared/ontdubbelen.ts` krijgt de CRM-records als extra bestand; unit-tests met treffers op KvK, domein en naam.

### Endpoints

| Methode en route | Recht | Invoer | Uitvoer | Fouten |
|---|---|---|---|---|
| `GET /api/koppelingen/:soort` | beheerder; Expert lezen | geen | status, instellingen zonder geheimen | 404 bij onbekende soort |
| `PUT /api/koppelingen/:soort` | beheerder | `{veldtoewijzing?, richting?, eigenaarsregel?, plafond?}` | instellingen | 422 bij onbekend Dealtrace-veld |
| `POST /api/koppelingen/:soort/test` | beheerder | geen | `{ok, melding}` | melding in gewone taal |
| `POST /api/koppelingen/:soort/sync` | Expert, beheerder | `{objecten?}` | run-id | 409 als er al een run loopt |
| `GET /api/koppelingen/:soort/start` en `GET /api/koppelingen/:soort/callback` | beheerder | OAuth | redirect | niet vastgelegd; voorstel; 401 zonder sessie, 400 bij onbekende of verlopen state |
| `POST /api/koppelingen/:soort/ontkoppel` | beheerder | geen | status | niet vastgelegd; voorstel; tokens gewist, audit |
| `POST /api/koppelingen/:soort/webhook` | CRM met handtekening | event | 2xx | niet vastgelegd; voorstel; 401 bij ongeldige handtekening |
| `GET /api/koppelingen/:soort/runs` | Expert, beheerder | `?fouten=` | runs | niet vastgelegd; voorstel |
| `GET /api/config/status` | beheerder | geen | per koppeling of een sleutel bestaat | nooit de sleutel zelf |

Geplande functie: synchronisatie elk uur per organisatie (Netlify scheduled function), met dezelfde code als "Synchroniseer nu".

### AI-stappen

Geen. De CRM-gegevens gaan als feiten met herkomst `crm` het materiaal van de agents in (F14, P19).

### Integraties

- Interface `CrmAdapter { leesBedrijven, leesContacten, schrijfBedrijf, schrijfContact, schrijfActiviteit }` (F02). Het bouwplan zegt dat deals worden teruggeschreven, maar de interface heeft daar geen methode voor. Niet vastgelegd; voorstel: voeg `schrijfDeal` toe en, voor slapende klanten, `leesOrders` of een veld "Laatste order" via de veldtoewijzing.
- `server/utils/bronnen/crm/hubspot.ts` implementeert de interface; Salesforce, Dynamics, Pipedrive en AFAS volgen via dezelfde interface (buiten deze prompt).
- Mock `crm/mock.ts` met vaste fixtures in de lijn van de startset Voltvast (Bijlage C): enkele fictieve installatiebedrijven in branches br-01 en br-02 als klant, twee als prospect, één met hetzelfde KvK-nummer als een bestaand account in de seed, één zonder eigenaar. Geen echte bedrijfs- of persoonsgegevens.
- Fouten: verlopen token, ontbrekende scope, limiet van het CRM (wacht en probeer opnieuw), veld bestaat niet meer; elke fout als regel in `koppeling_runs.fouten` en in gewone taal op de kaart.
- Kosten: de CRM-koppeling zelf heeft geen bundel in 11.4; runs tellen wel in het verbruik (aantal aanroepen).

### Functiecatalogus

Niet vastgelegd in het bouwplan welke sleutels en welk pakket; voorstel:

| Sleutel | Niveau | Pakket | Recht | Helpartikel |
|---|---|---|---|---|
| `koppelingen.crm.inrichten` | Expert | Plus | beheerder | Koppelingen |
| `leadgenerator.bron.crm` | Expert | Plus | leads lezen en schrijven eigen | Leadgenerator |
| `koppelingen.crm.synchroniseren` | Expert | Plus | Expert, beheerder | Koppelingen |

Ontdubbelen tegen het CRM is geen eigen functie maar gedrag van de leadgenerator en de import voor iedereen.

### Hergebruik uit DealDrive

- `server/api/integrations/hubspot/*`: neem de OAuth-stroom over, voeg op elk endpoint de sessiecontrole toe, sla tokens versleuteld in `koppelingen` op in plaats van in `hubspot-state.ts` (vervalt).
- `hubspot-mapper.ts`: neem de regels over (lege velden naar `undefined`, geld in centen); vervang de vaste lifecycle-naar-segment-tabel door de instelbare veldtoewijzing en map naar `account_kind` en `nb_status` van Dealtrace. Niet vastgelegd hoe lifecyclestages naar statussen gaan; voorstel: `customer` wordt klant, alle andere stages prospect met status `nieuw`, instelbaar in de veldtoewijzing.
- `hubspot-client.ts`: basis voor de adapter, achter de interface.

### Buiten scope

Salesforce, Dynamics, Pipedrive en AFAS als werkende adapters; klik-om-te-bellen via telefonie (na sprint 12); de overdracht van een gewonnen klant naar het CRM als pakket (P17 en P23); LinkedIn Sales Navigator.

## Acceptatiecriteria

1. Bijlage A regel 21: elk CRM-endpoint weigert een verzoek zonder sessie (401); tokens staan versleuteld per organisatie in de database, niet in het geheugen; de koppeling leest en schrijft.
2. Bijlage A regel 4 (deel CRM): het CRM is een werkende bron in de leadgenerator met dezelfde leadstructuur, ontdubbeling en groepen als de andere bronnen; bundel en plafond worden op de server afgedwongen.
3. Een lead met hetzelfde KvK-nummer als een HubSpot-bedrijf staat in "Al in je bestand" (F02).
4. Een veld met herkomst `hand` wordt bij synchronisatie niet overschreven; het log toont het verschil.
5. Met richting "Lezen" schrijft Dealtrace niets naar het CRM; na "Beide" schrijft "Neem over" bedrijf en contacten één keer weg, en een tweede synchronisatie maakt geen dubbel record (extern id bewaard).
6. Een afgeronde poging met uitkomst staat na synchronisatie als activiteit in het CRM, precies één keer, ook als de poging offline werd afgerond.
7. De eigenaarsregel koppelt op e-mailadres zonder hoofdlettergevoeligheid; een onbekende eigenaar valt op de terugval en verschijnt in de lijst.
8. Een gelijktijdige tweede "Synchroniseer nu" geeft 409; de geplande run elk uur draait per organisatie.
9. Zonder koppeling is de bron CRM niet kiesbaar en zegt de koppelingenpagina wat er nodig is.
10. Slapende klanten: een CRM-klant zonder order in 6 maanden wordt een herwinaccount met de terugkomregel "6 maanden niet besteld" (Voltvast hc-04).
11. Cross-tenant: de OAuth-callback van organisatie A kan geen tokens in organisatie B zetten; getest in de wegwerp-Postgres.
12. Niveau Beginner: ziet geen CRM-bron en geen koppelingenkaart; het ontdubbelen tegen het CRM werkt wel bij "Neem over" van een klaargezette lead.
13. Niveau Gevorderd: ziet CRM-treffers in "Al in je bestand" en de bronpil "HubSpot"; kan niet synchroniseren (knop met slot en uitleg).
14. Niveau Expert (accountmanager): kiest het CRM als bron en start "Synchroniseer nu"; kan de veldtoewijzing niet wijzigen (403 met `reden: 'rol'`). Beheerder kan alles.
15. Telefoon (375, 390, 412 px): de koppelingenpagina opent via Meer met "Beter op een groot scherm", zonder horizontale scroll; de bronpil en het herkomstlabel zijn leesbaar op de compacte accountkaart.
16. Alle tests draaien met de mock-adapter, zonder netwerk.

## Definition of Done

Hoofdstuk 19 geldt volledig. Specifiek voor deze prompt:

- Adapter en mock met dezelfde interface; databasevrije tests voor `pasToewijzingToe`, `losConflictOp`, `eigenaarVoor` en `schrijfplan`.
- `check:rechten` groen met de koppelingsendpoints; elk endpoint roept de sessiecontrole aan.
- Geheimen alleen op Netlify per context; rotatie beschreven in `docs/HOE-HET-WERKT.md`.
- Regels 4 (deel CRM) en 21 van Bijlage A afgevinkt in het sprintverslag.
