# P11: Leadgenerator, AI-zoeker en KvK

| Onderdeel | Waarde |
|---|---|
| Sprint | 7 |
| Features | F02 Leadgenerator: tabbladen Zoeken, Koppelingen (KvK) en Rondes en verbruik; bronnen AI-zoeker en KvK; KvK opzoeken op de telefoon (8.6) |
| Hangt af van | P01 (functiecatalogus, rechten, herkomst), P27 (mobiele schil, globale zoek), P03 (accounts, contacten, flyout Nieuwe prospect met "Zoek in KvK", `zoekDuplicaat`), P04 (tabblad Importeren, `shared/ontdubbelen.ts`, `import_batches`, `dealdriveAdapter.zoekAccounts`), P05 (doelgroepen, `kiesReis`, gebeurtenis `lead-overgenomen`), P28 (leesmodel: branches, `vv_branche_mapping`, concurrenten), P06 (motor, SR01, SR02, SR23), P07 (eerste taak, taken), P08 (Bewaker, creditscheck, AI-schil), P33 (AI-assistent en credits: `shared/credits.ts`), P10 (belblokken voor de eerste belpoging) |
| Bron in het bouwplan | F02, 12 (rijen KvK API, DealDrive en slotalinea), 11.3 (Zoeker), 11.4, 4.3 (rij F02), 8.6, 8.7, 13.3 (flow 1), 13.4 (leadronde), 15.1, 15.2, 22 (open vraag 6), ADR-015, Bijlage A (gat 2, 4, 16, 46, 47) |

## Lees eerst

- `Bouwplan-Dealtrace.md`: 0.2 (B11), 4.2 en 4.3, 6.1, 6.3, 7.1 en 7.2, 8.6, 8.7, 8.11, 8.12, F02 volledig, F05 (doelgroepen, `kiesReis`, gebeurtenissen), F14 (KvK-mutaties als signaal), F16 (klassen), F18 (gebieden als werkgebied), F25 (branches, `vv_branche_mapping`, concurrenten van soort Direct), 10.1, 10.2, 11.2 tot en met 11.4, 12, 13.3, 13.4, 15.1, 15.2, 19, 22, ADR-015, Bijlage A, Bijlage C.2 (branches en SBI-mapping) en C.6 (concurrenten).
- `docs/api/dealdrive-koppeling.md` hoofdstuk 4 (Ontdubbelen, `GET /accounts/zoek`) en `seed/dealdrive-mock/zoek-antwoord.json` (B21).
- DealDrive op commit 75bee61 (alleen lezen): `shared/leadGenerator.ts` (`GRENZEN`, `DOSSIER_GRENS`, `klasseVoorOmvang`, `alBekend`, `berekenLeadMatch`, `sorteerLeadMatches`, `GROEP_VOLGORDE`, `leidZoekopdrachtAf`), `app/pages/generator.vue`, `app/composables/useLeadGenerator.ts`, `server/utils/webBron.ts` (webzoeker met bewijsplicht en houdbaarheid), `app/pages/import.vue` (voor de koppeling met P04), `server/utils/llm-provider.ts`.

## Deel 1: Functioneel (wat en waarom)

### Wat je bouwt

Je bouwt de leadgenerator als één leadstroom met de bronnen AI-zoeker en KvK: zoeken op een doelgroep, ontdubbelen, beoordelen op zes criteria met bewijs, groeperen in vijf groepen, overnemen als prospect met eerste taak, afwijzen met reden, plus de KvK-koppeling, de meters en het opzoeken van een bedrijf in KvK op de telefoon.

### Waarom

In DealDrive was de generator een mooie schil zonder echte zoekresultaten: vijf vaste voorbeeldbedrijven, geen leadtabel, geen server, geen webzoeker en een AI-plafond dat niet werd afgedwongen; "Opnieuw uitzoeken" en "Toch uitzoeken" waren uitgeschakeld (F02, Bijlage A, gat 4). "Neem over" schreef het verkeerde klasseveld (gat 2), het werkgebied werd niet getoetst, de klasse kwam uit een vaste standaard, het profiel telde prospects mee (gat 46) en afwijzen gebeurde alleen in de browser (gat 47). Dealtrace bouwt één leadstroom met vijf bronnen: elke bron levert dezelfde leadstructuur, dezelfde ontdubbeling, dezelfde criteria en dezelfde groepen (ADR-015). Deze prompt levert de stroom met AI-zoeker en KvK; import (P04), Datacollectief (P15) en CRM (P20) haken erop in.

### Gebruikers en niveaus

| Rol | Niveau | Wat |
|---|---|---|
| Accountmanager | Beginner | Gebruikt de leadgenerator niet zelf; krijgt overgenomen leads van zijn salesmanager of van een automatische ronde als taak op Vandaag; handmatig één prospect toevoegen (met "Zoek in KvK" in de flyout). Zet de founder "Neem over" aan voor Beginner (`/platform/features`, 4.2), dan ook "Neem over" en "Niet relevant" |
| Accountmanager | Gevorderd | Zoeken in KvK, AI-zoekronde binnen de AI-credits (20 credits per ronde), "Neem over", "Niet relevant", "Opnieuw uitzoeken", "Toch uitzoeken"; KvK opzoeken op de telefoon |
| Accountmanager | Expert | Opgeslagen zoekopdrachten ("Bewaar als zoekopdracht"), automatische rondes per doelgroep (per week), bulkbronnen |
| Salesmanager | Gevorderd of Expert | Als Expert; zet leads klaar voor teamleden (eigenaar kiezen bij "Neem over"); verbruik van het team lezen |
| Beheerder | Expert | Koppelt KvK (sleutel, test, plafond); ziet alle rondes |
| Founder | n.v.t. | Kosten per bron in Platformbeheer (F23); platformsleutel KvK als open vraag 6 zo besloten wordt |

### Schermen

**Leadgenerator** (`/leadgenerator`, groep Prospects, vanaf Gevorderd). Tabbladen "Zoeken", "Importeren" (P04), "Koppelingen", "Rondes en verbruik".

**Tabblad Zoeken**, van boven naar beneden:

1. Kop: kicker "LEADGENERATOR · 25 GEVONDEN", titel "Leadgenerator", subtitel "Bedrijven die passen bij je doelgroep, met bewijs, bron en datum." Rechts "Zoekopdracht aanpassen" en "Nieuwe ronde" (geel). Als de AI-credits op zijn of er minder dan 20 over zijn, is "Nieuwe ronde" een knop met uitleg in plaats van uitgeschakeld zonder uitleg (2.3), met de tekst "De AI-credits van deze maand zijn op. Je beheerder kan extra credits aanvragen."
2. **Zoekopdracht** in vakken, elk met label, waarde en herkomstregel:

| Vak | Waarde | Herkomst |
|---|---|---|
| Doelgroep | gekozen doelgroep of "Lijkt op mijn klanten" | F05 |
| Klasse of omvang | bijvoorbeeld "B en C" | doelgroep of keuze |
| Branche | maximaal drie SBI-codes met naam | uit de doelgroep, of afgeleid uit je klanten: "Uit je 142 klanten in deze klassen" (alleen echte klanten, niet prospects) |
| Werkgebied | postcodegebieden, gebieden (F18) of straal rond je thuisbasis | doelgroep of profiel |
| Aanleiding | vrije tekst, bijvoorbeeld "werft servicemonteurs" | gebruiker |
| Bronnen | AI-zoeker, KvK, Datacollectief (vinkjes, alleen gekoppelde zichtbaar) | instellingen |

3. Paneel **"Zoekopdracht aanpassen"** onder de vakken; wijzigingen werken direct door in de beoordeling; "Bewaar als zoekopdracht" (Expert).
4. **Groepen** in vaste volgorde, eerste treffer wint, lege groepen verborgen: "Al in je bestand", "Valt af", "Verlopen", "Nog niet te beoordelen", "Passend".
5. **Leadrij**: bedrijfsnaam, plaats, bronpil ("KvK", "AI-zoeker", "Import: Beurs Vakdagen 2026"), klassepil, dossierpil ("Dossier van vandaag", oranje na 30 dagen), bewijsregels per criterium (ja groen, nee rood, ? grijs, met zin, bron en datum), score "5/6", contactpersoon als bekend ("Peter Kok · eigenaar · beslisser"), en knoppen per groep: Passend "Neem over" (geel) en "Niet relevant"; Verlopen "Opnieuw uitzoeken" met "Kost 10 credits"; Nog niet te beoordelen "Toch uitzoeken"; Al in je bestand "Open kaart".
6. **Meters** onderaan: "AI-credits deze maand: 412 over" (stand uit `creditsStand`, P33; een zoekronde kost 20, een dossier 10), "KvK-bevragingen 410 / 2.000" (de meter "Datacollectief-records" komt met P15). KvK en Datacollectief zijn geen AI en tellen niet in de credits.

Lege staat zonder ronde: Niet vastgelegd in het bouwplan; voorstel: "Nog geen leads. Kies een doelgroep en start een ronde." (de knop "Nieuwe ronde" staat al in de kop, 2.3). Lege groep na filteren: "Toon alles".

**Uit het verkoopverhaal** (F25): een zoekopdracht kiest een branche uit het leesmodel; `vv_branche_mapping` levert de SBI-codes en trefwoorden voor KvK. Per concurrent met soort Direct is er een zoeksjabloon "Overstappers van <concurrent>" (bij Voltvast cc-01 Landelijke groothandelsketen en cc-02 Online webgroothandel). Een nieuwe lead krijgt `vv_branche_id` via de mapping.

**Tabblad Koppelingen**, kaart KvK (beheerder richt in, Expert gebruikt): API-sleutel (schrijf alleen), "Test verbinding", gebruiksteller, maandplafond; functies zoeken (handelsnaam, KvK-nummer, plaats, postcode, SBI), basisprofiel en vestigingsprofiel ophalen, maandelijkse controle op wijzigingen bij prospects in reis (wordt een inzicht "KvK-mutatie"). Zonder sleutel is de bron KvK niet kiesbaar en zegt de kaart wat er nodig is, bijvoorbeeld "De KvK-sleutel is verlopen. Vraag een nieuwe aan bij KvK en plak hem hier." (12). Kaarten voor Datacollectief en CRM komen met P15 en P20.

**Tabblad Rondes en verbruik**: lijst van rondes en imports met datum, bron, aantal gevonden, overgenomen, afgewezen, conversie naar afspraak; meters per bron; daggrens per gebruiker (10 rondes).

**Elders in de app**

- Flyout **"Nieuwe prospect"** (P03): "Zoek in KvK" wordt zichtbaar en vult officiële naam, KvK, SBI, adres en medewerkers.
- Importwizard stap 4 (P04): "Verrijk na import via KvK" wordt werkend, met kostenindicatie.
- Vandaag (P07): een overgenomen lead verschijnt als eerste taak; een Beginner ziet leads die zijn salesmanager voor hem overnam.

**Telefoon (390 px).** De leadgenerator in bulk staat bewust niet op de telefoon (8.12): `/leadgenerator` opent met "Beter op een groot scherm". **KvK opzoeken** (Gevorderd, 8.6) werkt wel: een bedrijf dat je passeert op naam of plaats zoeken en met één tik als prospect toevoegen, ontdubbeld tegen je accounts. Niet vastgelegd in het bouwplan waar de zoekingang op de telefoon zit; voorstel: in de globale zoek ("Zoeken" in de compacte kop) staat onder de eigen resultaten de groep "KvK-register" met per resultaat naam, plaats, KvK-nummer en "Voeg toe"; een treffer die al in je bestand staat toont "Al in je bestand" met "Open kaart". KvK werkt niet offline (8.8): de groep toont dan "KvK zoeken kan alleen met verbinding".

### Klikpaden

1. **Ronde starten.** Kies doelgroep "Installatiebedrijven woningbouw" (br-01), bronnen AI-zoeker en KvK, klik "Nieuwe ronde"; binnen 60 seconden (13.4) verschijnen de leads in de vijf groepen; de meters lopen op.
2. **Dezelfde ronde nog eens** binnen 24 uur: het bewaarde resultaat verschijnt zonder kosten.
3. **Neem over.** Klik "Neem over". Een kleine flyout bevestigt eigenaar (standaard jij), doelgroep en reis (voorstel uit `kiesReis`), kanaal (direct, of via partner bij een kanaalregel) en de eerste stap: binnendienst "Bel in je eerstvolgende acquisitieblok met script Koude acquisitie", buitendienst "Bezoek op je regiodag" of "Bel eerst", optioneel "Zet in campagne". Na bevestigen maakt Dealtrace het account (soort prospect) met naam, KvK, SBI, branche, medewerkers, klasse in hetzelfde veld dat de kaart toont, adres, website, bron en bewijs als notitie, plus de contactpersonen; status `nieuw`, gebeurtenis `lead-overgenomen`, fase "Gevonden". Toast "Teeuwen Bouw staat nu bij je prospects, klasse B. Eerste belpoging staat in je blok van donderdag 10:00." De lead verhuist naar "Al in je bestand".
4. **Niet relevant.** Kies een reden ("Te klein", "Verkeerde branche", "Heeft al een leverancier", "Buiten gebied", "Geen budget", "Anders"); de server bewaart hem, het bedrijf komt niet terug en de reden stuurt de volgende ronde bij.
5. **Opnieuw uitzoeken.** Bij een verlopen lead "Opnieuw uitzoeken" ("Kost 10 credits"); de Zoeker maakt een nieuw dossier; de lead verhuist naar de juiste groep.
6. **Toch uitzoeken.** Bij "Nog niet te beoordelen" zoekt de Zoeker de ontbrekende criteria uit.
7. **KvK koppelen** (beheerder). Plak de sleutel, "Test verbinding", daarna opslaan (eerst testen, dan opslaan, 12); de bron KvK wordt kiesbaar.
8. **KvK op de telefoon** (3 tikken plus typen, 8.7): "Zoeken" (1), typ de naam, tik het resultaat (2), "Voeg toe" (3); toast "Teeuwen Bouw staat erbij." en de compacte kaart opent.

### Criteria (score x van 6)

| Criterium | Bron van het oordeel |
|---|---|
| Klasse of omvang | medewerkers uit KvK of Datacollectief, vergeleken met de klassen van de organisatie (niet een vaste standaard) |
| Branche | SBI uit KvK, vergeleken met de doelgroep |
| Werkgebied | postcode of coördinaat, getoetst aan gebieden of straal |
| Aanleiding | trefwoorden uit de aanleiding in een bewijszin uit het dossier |
| Groeisignaal | dossier: vacatures, nieuws, nieuwe vestiging |
| Bereikbaarheid | heeft een contactpersoon met functie en een nummer of e-mail |

### Regels

- Groepen: "Al in je bestand" (KvK gelijk, anders domein, anders naam plus postcode met 80 procent gelijkenis; ook een treffer in DealDrive, zie hieronder), "Valt af" (minstens één criterium nee), "Verlopen" (dossier ouder dan 30 dagen), "Nog niet te beoordelen" (minder dan 4 criteria beoordeeld), "Passend" (minstens 3 keer ja en 4 beoordeeld, instelbaar).
- Onbekend is geen nee; een nee blokkeert; elk oordeel draagt bewijs met bron en waar het veroudert een datum.
- Dossierhoudbaarheid: zacht 30 dagen (Verlopen), hard 120 dagen (bewijs vervalt), opruimen na 60 dagen zonder actie; niet overgenomen leads 60 dagen, afgewezen 120 (15.2).
- **Ontdubbelen tegen DealDrive** (optioneel, B21): staat de DealDrive-koppeling aan (of draait de mock), dan vraagt de ronde per nieuwe lead `GET /accounts/zoek` via `dealdriveAdapter.zoekAccounts` uit P04 (24 uur gecachet per sleutel). Een treffer met soort `klant` staat in "Al in je bestand" met de pil "Al klant in DealDrive" en wordt niet benaderd tenzij de salesmanager het toestaat; een treffer met soort `prospect` toont "Al prospect in DealDrive" met de eigenaar. Staat de koppeling uit of is DealDrive onbereikbaar, dan gaat de ronde door zonder deze controle.
- **Grenzen** (op de server afgedwongen): 10 rondes per gebruiker per dag, 25 bedrijven per AI-ronde, dezelfde zoekopdracht binnen 24 uur geeft het bewaarde resultaat zonder kosten; KvK met een eigen plafond per maand uit de instellingen. De elfde ronde van een gebruiker op één dag geeft "Je daggrens van 10 zoekrondes is bereikt."
- **Credits** (11.4, B20): een zoekronde kost 20 credits en een dossier 10, beide alleen aan in Compleet; de prijs komt uit `creditsVoor` in `shared/credits.ts` (P33 AI-assistent en credits); reservering vóór de aanroep, definitief na afloop, een mislukte ronde kost niets; automatische rondes stoppen bij 10 procent van de pot (P08). KvK-bevragingen zijn geen AI en vallen buiten de credits: Starter 0, Plus 500, Compleet 2.000 per maand. Op Plus is dus alleen KvK beschikbaar; de AI-zoeker toont "Onderdeel van Compleet" voor de beheerder (4.2).
- KvK-cache 30 dagen per KvK-nummer; KvK-nummer is de primaire ontdubbelsleutel (12, ADR-015).
- Herkomst per veld: `kvk` of `web` of `ai` met datum en URL; bronprioriteit hand boven kvk boven datacollectief boven crm boven salesdna boven web boven ai boven import; een lagere bron overschrijft een hogere nooit stil (10.1).
- Geen verzonnen gegevens: een nummer of adres dat niet op een bron staat, wordt niet ingevuld; een patroon ("voornaam@domein") is een voorstel met de pil "aanname" (15.1).
- Een eerste taak volgt het werkplekprofiel; de Planner laat hem landen in het eerstvolgende acquisitieblok of op de regiodag (P08).
- Overgenomen account: het klasseveld is `klasse`, hetzelfde veld dat de kaart toont (gat 2).

### Helpartikelen

- "Leadgenerator" en "KvK en Datacollectief" (Prospects): bronnen, groepen, criteria, overnemen, afwijzen, meters; KvK koppelen.
- "Leads vinden en overnemen": Niet vastgelegd in het bouwplan; voorstel: een gewoon artikel in de categorie Prospects. Er zijn geen leerpaden per niveau (B19).
- "Koppelingen" (Inrichten) aanvullen met KvK.

## Deel 2: Technisch (hoe)

### Datamodel

```ts
leads: id, organisation_id, naam, kvk, domein, postcode, plaats, status ('nieuw'|'overgenomen'|'afgewezen'),
       bron ('ai'|'kvk'|'datacollectief'|'import'|'crm'), bron_ref (rondeId, batchId, extern id),
       gevonden_op, dossier_op, account_id, data jsonb
  data: medewerkers, sbi[], adres, website, telefoon, contacten [{naam, functie, email?, telefoon?, linkedin?, bron}],
        bewijs [{criterium, oordeel: 'ja'|'nee'|'onbekend', zin, bron, url?, datum?}], score, beoordeeld,
        afwijsreden?, herkomst {}, vvBrancheId?
lead_rondes: id, organisation_id, gebruiker_id, zoekopdracht jsonb, hash, bronnen[], aantal, gestart_op, kosten jsonb
koppelingen: id, organisation_id, soort ('kvk'|'datacollectief'|'hubspot'|'salesforce'|'dynamics'|'pipedrive'|'afas'),
             status, geheimen (versleuteld, AES-256-GCM), instellingen jsonb {veldtoewijzing, richting, eigenaarsregel, plafond}
koppeling_runs: id, organisation_id, koppeling_id, start, eind, gelezen, geschreven, fouten jsonb
lead_verbruik: organisation_id, maand, soort ('ronde'|'dossier'|'kvk'|'datacollectief'), aantal, kosten_cent
```

- Alle waarden van `bron` en `koppelingen.soort` meteen in de migratie, zodat P15 en P20 geen migratie op de enumeratie nodig hebben.
- Opgeslagen zoekopdrachten (Expert): Niet vastgelegd in het bouwplan in een tabel; voorstel: `lead_zoekopdrachten: id, organisation_id, gebruiker_id, naam, zoekopdracht jsonb, automatisch ('uit'|'wekelijks'), doelgroep_id?`.
- KvK-cache: Niet vastgelegd in het bouwplan in een tabel; voorstel: `kvk_cache: kvk, profiel jsonb, opgehaald_op` als platformtabel zonder klantdata (alleen openbare registerdata), 30 dagen geldig.
- `accounts.nb_bron`, `accounts.kvk`, `accounts.vv_branche_id` (10.2) bij "Neem over".
- RLS `org_isolation` op alle tabellen; `koppelingen.geheimen` nooit naar de client, `GET /api/config/status` laat alleen zien of een sleutel bestaat (12).
- Rechtenmatrix (3.3): leads en leadgenerator accountmanager lezen alles, schrijven eigen; salesmanager en beheerder alles; koppelingen schrijven beheerder.
- Sync-allowlist: `leads` niet via de sync (alleen endpoints, omdat elke handeling kosten of credits raakt); `koppelingen` staat er nooit op.

### Pure functies (`shared/leadGenerator.ts`, `shared/ontdubbelen.ts`)

| Functie | Invoer en uitvoer | Randgevallen en unit-tests |
|---|---|---|
| `leidZoekopdrachtAf(klanten, klassen)` | top 3 SBI, top 6 postcodegebieden | alleen echte klanten, nooit prospects (gat 46); geen klanten |
| `zoekDuplicaat(kandidaat, bestand)` | uit P03 en P04 | KvK, dan domein zonder `www.`, dan genormaliseerde naam met Sørensen-Dice; 80 procent duplicaat, 60 tot 80 mogelijk |
| `beoordeelLead(lead, zoekopdracht, klassen, gebieden)` | zes oordelen met bewijs | werkgebied buiten straal geeft nee (gat 46); onbekend is geen nee; klassen van de organisatie |
| `groepeerLead(lead, nu)` | één van de vijf groepen | eerste treffer wint; precies 30 dagen; 3 keer ja met 3 beoordeeld blijft "Nog niet te beoordelen" |
| `klasseUitMedewerkers(n, klassenVanOrganisatie)` | klassecode | grenzen; eigen klassen van Voltvast; zonder medewerkers null |
| `zoekopdrachtHash(zoekopdracht)` | hash voor de 24-uursregel | volgorde van bronnen en SBI maakt niet uit |
| `brancheUitSbi(sbi, mapping)` | `vv_branche_id` | SBI 4321 bij br-01, br-02 en br-04 (trefwoord "zonnepanelen" beslist); geen mapping |
| `magRonde(verbruik, grenzen, gebruiker, nu)` | `{mag, reden}` | elfde ronde op een dag; minder dan 20 credits over; AI-soort zoekronde niet aan op Plus |

Elke definitie één keer (gat 16): groepsvolgorde, criteria en grenzen alleen in `shared/leadGenerator.ts`; `klasseVoorOmvang` uit DealDrive wordt `klasseUitMedewerkers` en P06 gebruikt dezelfde functie.

### Endpoints

| Methode en route | Recht | Invoer | Uitvoer | Fouten |
|---|---|---|---|---|
| `POST /api/leads/ronde` | Gevorderd | `{zoekopdracht, bronnen}` | rondeId en leads | 429 "Je daggrens van 10 zoekrondes is bereikt."; 402 credits op; 400 bron niet gekoppeld |
| `GET /api/leads?ronde=&groep=` | Gevorderd; Beginner als de functie voor Beginner aanstaat | | leads met groep en bewijs | |
| `POST /api/leads/:id/dossier` | Gevorderd | | lead | 402 credits op ("De AI-credits van deze maand zijn op. Je beheerder kan extra credits aanvragen.") |
| `POST /api/leads/:id/overnemen` | Gevorderd; Beginner als de functie voor Beginner aanstaat | `{eigenaar, reisId, eersteStap, campagneId?}` | account, contacten, eerste taak | 409 als de lead al is overgenomen; 422 bij een klant als duplicaat (nooit terug naar prospect) |
| `POST /api/leads/:id/afwijzen` | Gevorderd; Beginner als de functie voor Beginner aanstaat | `{reden}` | lead | 422 zonder reden |
| `GET\|PUT /api/koppelingen/kvk`, `POST /api/koppelingen/kvk/test` | beheerder | sleutel, plafond | status | 400 met uitleg in gewone taal |
| `POST /api/kvk/zoek`, `GET /api/kvk/:nummer` | Gevorderd; "Zoek in KvK" in de flyout voor iedereen die een prospect mag toevoegen | naam, plaats, postcode, SBI | resultaten met "Al in je bestand" | 503 zonder verbinding met KvK |
| `GET /api/leads/verbruik` | Gevorderd; beheerder alle | | meters | |
| `GET\|POST\|PUT /api/leads/zoekopdrachten` | Expert | | | (Niet vastgelegd in het bouwplan; voorstel) |

`POST /api/leads/:id/overnemen` doet in één transactie: account, contacten, herkomst, `POST /api/reis/gebeurtenis` met `lead-overgenomen`, eerste taak via de motor en de Planner.

Geplande functies: maandelijkse KvK-mutatiecontrole voor accounts in reis (inzicht "KvK-mutatie", SR23); automatische rondes per opgeslagen zoekopdracht (wekelijks, Expert); opruimen van leads na 60 en 120 dagen.

### AI-stappen

| Stap | Agent en mandaat | Materiaal | Schema | Vangrails |
|---|---|---|---|---|
| Zoekronde `zoekBedrijven` | Zoeker, A | zoekopdracht, branche en trefwoorden uit `vv_branche_mapping`, KvK-feiten | `{bedrijven: [{naam, plaats, website, kvk?, url, bronzin}]}` | Claude met websearch, maximaal 3 zoekopdrachten, 25 bedrijven, URL's alleen uit echte zoekresultaten |
| Dossier | Zoeker, A | website, zoekresultaten, KvK-feiten | `{bewijs: [{criterium, oordeel, zin, bron, url, datum}], contacten[]}` | citaat moet letterlijk in het materiaal staan; geen verzonnen nummers; privégegevens gemaskeerd |

KvK is geen AI-bron: KvK-gegevens gaan als feiten met bron `kvk` het materiaal in. Elke stap via de Bewaker en de AI-schil van P08 (schema met `additionalProperties false`, één herhaling, golden master); credits per handeling uit 11.4: zoekronde 20, dossier 10; mock met vaste fixtures.

### Integraties

- **KvK API** (Zoeken, Basisprofiel, Vestigingsprofiel): adapter `server/utils/bronnen/kvk.ts` met functies zoeken, basisprofiel, vestigingsprofiel, mutaties; REST met API-sleutel, kosten per bevraging, cache 30 dagen per KvK-nummer, maandelijkse controle op wijzigingen voor accounts in reis. Mock met vaste fixtures (Voltvast-achtige fictieve bedrijven, geen echte KvK-data). Elke aanroep gelogd in `koppeling_runs` en geteld in `lead_verbruik`.
- **Sleutel**: F02 en 12 zeggen "API-sleutel van de organisatie"; open vraag 6 (vóór sprint 7) stelt een platformsleutel met plafond per pakket voor, eigen sleutel optioneel. Bouw de adapter zo dat beide kunnen: eerst de sleutel van de organisatie, anders de platformsleutel, met het plafond per pakket.
- **AI-webzoeker**: via `server/utils/webBron.ts` en de providerlaag (Claude met websearch, 11.4).
- **DealDrive** (optioneel, B21): ontdubbelen via `dealdriveAdapter.zoekAccounts` uit P04, volgens `docs/api/dealdrive-koppeling.md` hoofdstuk 4; lokaal en in tests altijd de mock met `seed/dealdrive-mock/zoek-antwoord.json` (13.5).

### Functiecatalogus

Niet vastgelegd in het bouwplan; voorstel (niveaus uit 4.3, pakket uit 11.4):

| Sleutel | Startindeling: aan vanaf | Pakket | Recht | Helpartikel |
|---|---|---|---|---|
| `leads.overnemen` | Gevorderd (de founder kan het aanzetten voor Beginner) | Starter | accountmanager | Leadgenerator |
| `leads.kvk` | Gevorderd | Plus | accountmanager | KvK en Datacollectief |
| `leads.aiZoeker` | Gevorderd | Compleet | accountmanager | Leadgenerator |
| `leads.opgeslagen` | Expert | Compleet | accountmanager | Leadgenerator |
| `leads.automatisch` | Expert | Compleet | accountmanager | Leadgenerator |
| `koppeling.kvk` | Expert | Plus | beheerder | Koppelingen |
| `onderweg.kvkOpzoeken` | Gevorderd | Plus | accountmanager | KvK en Datacollectief |

### Hergebruik uit DealDrive

- `shared/leadGenerator.ts`: `leidZoekopdrachtAf` (alleen klanten), `alBekend` en de matchregels (naar `shared/ontdubbelen.ts`, al gedaan in P04), `berekenLeadMatch` en `GROEP_VOLGORDE` (zes criteria met bewijs, groepen), `GRENZEN` en `DOSSIER_GRENS`; `klasseVoorOmvang` leest voortaan de klassen van de organisatie.
- `server/utils/webBron.ts`: webzoeker met bewijsplicht en houdbaarheid; schema afdwingen met tool-use.
- `app/pages/generator.vue` en `useLeadGenerator.ts`: vakken, groepen, leadrij en meters; nu met echte server, leadstabel en werkende knoppen.
- Nieuw in Dealtrace: `server/utils/bronnen/kvk.ts` (Bijlage B, Controle).

### Buiten scope

- Datacollectief (P15), CRM-koppeling en ontdubbelen tegen HubSpot (P20), "Zet in campagne" (P16), regiodagen voor de buitendienst (P14).
- LinkedIn Sales Navigator-koppeling, scrapen van LinkedIn, kopen van lijsten vanuit de app (F02).

## Acceptatiecriteria

1. Een KvK-selectie levert leads in vijf groepen; "Neem over" maakt een prospect met contactpersonen (sprint 7 "klaar als").
2. Een ronde levert leads in de vijf groepen; dezelfde ronde binnen 24 uur kost niets.
3. Een lead met hetzelfde KvK-nummer als een bestaand account staat in "Al in je bestand".
4. Bijlage A, gat 2: "Neem over" schrijft de klasse in `accounts.klasse`, het veld dat de kaart toont; er bestaat geen tweede klasseveld.
5. Bijlage A, gat 4: leadstabel, endpoints, bronnen AI-zoeker en KvK, credits op de server en werkende knoppen "Opnieuw uitzoeken" en "Toch uitzoeken"; geen vaste voorbeeldbedrijven buiten de mock-modus.
6. Bijlage A, gat 46: het werkgebied wordt getoetst (een lead buiten de straal valt af met bewijsregel); de klasse komt uit de klassen van de organisatie; het profiel "Lijkt op mijn klanten" telt alleen klanten.
7. Bijlage A, gat 47: "Niet relevant" bewaart de reden op de server; het bedrijf komt in een volgende ronde niet terug, ook niet op een ander toestel.
8. Bijlage A, gat 16: groepen, criteria en grenzen staan één keer in `shared/leadGenerator.ts`.
9. "Neem over" maakt een account met klasse, SBI, medewerkers, contactpersonen en bewijs, status `nieuw`, fase "Gevonden", gebeurtenis `lead-overgenomen`, en een eerste taak volgens het werkplekprofiel.
10. Zonder KvK-sleutel is de bron KvK niet kiesbaar en zegt de koppelingenpagina wat er nodig is.
11. De AI-credits worden op de server afgedwongen (een ronde boekt 20 credits, een dossier 10, een herhaalde ronde binnen 24 uur 0); de elfde ronde van een gebruiker op één dag geeft 429 met "Je daggrens van 10 zoekrondes is bereikt."; op Plus is de AI-zoeker niet kiesbaar en toont "Onderdeel van Compleet" voor de beheerder.
12. De Zoeker gebruikt alleen URL's uit de echte zoekresultaten; een verzonnen URL in een mock-antwoord wordt geweigerd en het dossier krijgt geen bewijs zonder citaat.
13. Met de Voltvast-seed geeft de doelgroep op br-01 de SBI-codes 4321 en 4322 uit de mapping; het zoeksjabloon "Overstappers van Landelijke groothandelsketen" bestaat; een lead met SBI 6820 krijgt `vv_branche_id` br-03.
14. Een leadronde duurt onder 60 seconden met de mock (13.4).
15. Alle adapters hebben een mock; de Playwright-specs draaien zonder netwerk.
16. Telefoon (375, 390, 412 px): `/leadgenerator` opent met "Beter op een groot scherm" zonder horizontale scroll; KvK opzoeken en toevoegen kost hooguit 3 tikken plus typen (8.7), ontdubbeld tegen de eigen accounts; zonder verbinding toont de groep de uitleg; knoppen minimaal 44 px.
17. Per niveau getest: Beginner ziet Leadgenerator in "Nog niet aangezet" met uitleg en krijgt 403 met reden `niveau` op `POST /api/leads/ronde`; staat "Neem over" in `functies_per_niveau` aan voor Beginner, dan werken "Neem over" en "Niet relevant" voor elke Beginner; Gevorderd kan rondes draaien, overnemen en afwijzen; Expert kan een zoekopdracht bewaren en wekelijks laten draaien.
18. Cross-tenant: leads, rondes, koppelingen en verbruik van organisatie A zijn onzichtbaar voor B; geheimen verschijnen nooit in een antwoord of log.
19. Met de DealDrive-mock staat een lead met het KvK-nummer uit `zoek-antwoord.json` in "Al in je bestand" met "Al prospect in DealDrive" en eigenaar; met de koppeling uit of DealDrive onbereikbaar loopt de ronde door zonder die controle.

## Definition of Done

Hoofdstuk 19 geldt volledig. Specifiek voor deze prompt:

- Unit-tests voor alle functies in `shared/leadGenerator.ts` met grenzen (30 en 120 dagen, 60 en 80 procent, 3 en 4 beoordeeld, 10 en 11 rondes).
- Golden masters voor zoekronde en dossier; elke Zoeker-handeling via de Bewaker; de KvK-adapter met mock, geen netwerk in tests.
- Playwright desktop voor de tabbladen Zoeken, Koppelingen en Rondes en verbruik en de flow lead naar prospect; telefoon voor KvK opzoeken.
- Bijlage A, gat 2 (deel P11), 4 (deel P11), 16, 46 en 47 afgevinkt; helpartikelen in `content/help/`.
