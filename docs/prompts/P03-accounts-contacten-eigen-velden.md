# P03: Accounts, contacten, eigen velden

| Onderdeel | Waarde |
|---|---|
| Sprint | 2 (Prospects en data) |
| Features | F03 Prospects en accountkaart, F04 Contacten en buying committee, F19 Eigen velden |
| Hangt af van | P01 (rechten, niveaus, functiecatalogus, sync, herkomst), P27 (mobiele schil, schuifvenster, actiebalk) |
| Bron in het bouwplan | F03, F04, F19, 8.5.5, 8.7, 8.11 (rij Accountkaart), 10.1, 10.2, 15.1, Bijlage A (gaten 2, 9, 10, 16, 25 tot en met 29) |

## Lees eerst

- Bouwplan-Dealtrace.md: 0.2 (B17), F03, F04, F19, 7.2 (statussen), 8.3 (actiebalk), 8.5.5, 8.7, 8.11, 10.1 en 10.2 (`accounts`, `contacts`), 14, 15.1, 15.2 (bel-me-niet), Bijlage A.
- DealDrive (commit 75bee61):
  - Pagina's: `app/pages/prospects/index.vue`, `app/pages/prospects/alle.vue`, `app/pages/prospects/[id]/index.vue`, `app/pages/accounts/[id]/index.vue`, `app/pages/klanten/alle.vue`, `app/pages/contacten/index.vue`, `app/pages/contacten/alle.vue`, `app/pages/contacten/[id]/index.vue`, `app/pages/instellingen/custom-fields.vue`.
  - Componenten: `app/components/AccountRow.vue`, `AccountScoreCircle.vue`, `KlantGradePicker.vue`, `EditableField.vue`, `InlineEditChip.vue`, `ContactInfoFlyout.vue`, `ContactenFlyout.vue`, `Portrait.vue`.
  - Composables: `app/composables/useCustomFields.ts`, `app/composables/useContactRol.ts`.
  - Telefoon: `shared/dexKaartVelden.ts` (wordt `shared/kaartvelden.ts`), `app/components/DexKaart.vue`.

## Deel 1: Functioneel (wat en waarom)

### Wat je bouwt

De prospectlijsten, de accountkaart (ook compact op 390 px), contacten met één rolbegrip en het buying committee, en eigen velden die je kunt invullen, filteren, sorteren en in import gebruiken.

### Waarom

Een account is een bedrijf; prospect of klant is een eigenschap, geen aparte tabel. Klanten komen uit DealDrive of het CRM (voor kansen langs de route en winback); Dealtrace loopt tot en met de eerste afspraak en maakt zelf geen klant van een prospect (B17). De prospectlijst is voor de binnendienst de bellijst en voor de buitendienst de selectie per regio; de accountkaart is het dossier voor en na elk gesprek. "Hebben we de beslisser al, en wie ontbreekt er nog?" is de kern van kwalificatie. Elke organisatie verkoopt iets anders en wil eigen gegevens vastleggen (beslissing B6).

### Gebruikers en niveaus

| Rol | Niveau | Wat |
|---|---|---|
| accountmanager | Beginner | Top deze week; lijst met zoeken en filters klasse, status, "Van mij"; kaart met kop, stuurstrip, statstrook, tijdlijn, taken, notities, contacten; nieuwe prospect (naam, plaats, telefoon, website, "Zoek in KvK"); bellen en mailen; contacten toevoegen en bewerken met rol; eigen velden invullen |
| accountmanager | Gevorderd | Plus alle filters met meerekenende tellers, sorteren, weergaven Lijst, Compact, Kaarten, contextmenu, Info-flyout met eigen velden, segmenten, opgeslagen filters, klasse zetten; contactfilters zonder e-mail, zonder telefoon, zonder contact in X dagen; filteren en sorteren op eigen velden |
| accountmanager | Expert | Plus samenvoegen van duplicaten (accounts en contacten), exporteren, scoreopbouw inzien, alle tabbladen, contact verhuizen naar een ander bedrijf, eigen veld voorstellen |
| salesmanager | Gevorderd, Expert | Plus dekkingstellingen per eigenaar en klasse, eigenaar wijzigen, verwijderen |
| beheerder | Expert | Plus eigen velden maken, wijzigen, ordenen, archiveren |

### Schermen

**Top deze week** (`/prospects`): kicker "TOP DEZE WEEK · 12 OKT TOT 18 OKT", titel "Belangrijkste prospects van deze week", zes kaarten met rangnummer, klassepil, naam, branche, plaats, aanleiding in een grijs blok met paarse rand, aantal inzichten, fasepil en "Open →". Rangschikking op de echte score. Knoppen "Prospectplanning →" (Gevorderd) en "Alle prospects →". Lege staat: "Nog geen prospects deze week. Voeg een prospect toe of importeer een lijst." Niet vastgelegd; voorstel.

**Lijst** (`/prospects/alle`)

- Kop "← Prospects · 86 prospects totaal", titel "Alle prospects". Werkbalk in vaste volgorde: zoeken, "+ Prospect" (geel), "+ Taak", "+ Afspraak", "Weergave" (Lijst, Compact, Kaarten), "Sortering", "Filters" met teller. "+ Taak" en "+ Afspraak" openen hun flyout zodra P07 en P13 er zijn; tot dan niet tonen.
- Rij: logo of initialen in de kleur van de prospectgraad, naam met klassepil, fasepil en statuspil, metaregel (website- en LinkedIn-icoon, branche, plaats, telefoon als bellink, "Inzichten: n", "Laatste contact: 4 sep" of "nog nooit"), aanleiding eronder (rood bij hete aanleiding), rechts hooguit drie contacten als initialen (beslissers eerst) of "Geen contactpersoon".
- Paginering 25 rijen, "Toon meer".
- Contextmenu (rechtsklik of lang drukken): "Open kaart", "Bel primaire contact", "Stuur e-mail", "Nieuwe taak", "Plan afspraak", "Zet in campagne", "Zet nee". Items van latere prompts (taak, afspraak, campagne, nee) verschijnen pas als hun prompt klaar is. Er is geen "Promoveer tot klant" (B17).
- Lege staat: "Niets gevonden." met "Toon alles".
- `/klanten` bestaat als lijst voor accounts met status klant uit DealDrive of het CRM (kansen langs de route en winback); standaard verborgen voor de Beginner.

**Filters** (tellers rekenen mee met alle andere actieve filters; een pil met nul is uitgeschakeld; filters en sortering in de URL; opgeslagen filters per gebruiker vanaf Gevorderd):

| Groep | Waarden |
|---|---|
| Eigenaar | "Van mij" (standaard aan), "Team", "Iedereen" |
| Status | Nieuw, In reis, Wachtend, Nee, Gescoord |
| Reis en fase | per reis de fases (gevuld vanaf P05) |
| Klasse | klassen van de organisatie, "Geen klasse" |
| Aanleiding | "Met aanleiding" |
| Laatste contact | "Nog nooit", "Ouder dan 30 dagen", "Ouder dan 90 dagen" |
| Gebied | gebieden (F18, vanaf P14), "Zonder gebied" |
| Afstand (buitendienst) | binnen 10, 25, 50 km van thuisbasis of van een plaats |
| Bereikbaarheid | "Zonder telefoon", "Zonder e-mail", "Zonder beslisser" |
| Doelgroep, campagne, bron | lijsten |
| Eigen velden | per filterbaar eigen veld met type keuzelijst, ja of nee, getal (Gevorderd) |

Sortering: "Naam", "Laatste contact", "Score", "Klasse", "Dagen in fase", "Afstand".

**Accountkaart** (`/accounts/:id`), van boven naar beneden:

1. Kruimel "← Alle prospects".
2. Kop: logo, naam met klassepil (keuzemenu met omschrijving per klasse), chips branche, plaats, land, bewerkbaar met potlood; statuspil en fasepil met "12 dagen in fase".
3. Contactstrip: website, telefoon (bellink), LinkedIn.
4. Stuurstrip, alleen lezen: "Laatste actie", "Laatste call", "Laatste bezoek", "Reis", "Ritme: poging 3 van 5 · volgende do 16 okt · bellen" (reis en ritme gevuld vanaf P05 en P07).
5. Knoppen: "Info", "Contacten 3", "Briefing" (zwart, vanaf P18), "Bel", "+ Taak", "+ Afspraak".
6. Statstrook: "Open acties" (n achterstallig rood), "Inzichten" (n ongezien), "Eerstvolgende afspraak", "Volgende stap", "Laatste contact", "Eigenaar".
7. Strook nieuwste aanleiding.
8. Blokken in drie kolommen: "Dossier" (datum, aantal criteria, kernfeiten), "Kwalificatie BAND 3/4" (Behoefte, Autoriteit, Noodzaak, Draagvlak, elk met bron), "Ritme" (vanaf P05 en P07).
9. Buying committee.
10. Tabbladen "Tijdlijn", "Taken", "Contacten", "Notities", "Reis" (gevuld vanaf P05), en achter "Meer": "Inzichten", "E-mails", "Afspraken", "Verslagen", "Campagnes", "Activiteitenlog", "Eigen velden".

Een blok of tabblad zonder bron in deze sprint toont een lege staat die zegt wat er niet is en waarom, bijvoorbeeld "Nog geen afspraken. Een afspraak plan je met + Afspraak." Niet vastgelegd welke teksten; voorstel: één zin per blok volgens 2.3.

**Info-flyout** (520 px): basisvelden, eigen velden per sectie, eigenaar (gat 9), klasse, herkomst per veld (Expert), scoreopbouw (Expert). Beginner: geavanceerde blokken ingeklapt achter "Meer" (4.4).

**Flyout Nieuwe prospect** ("Wie ga je erbij zetten?"): Bedrijfsnaam (verplicht) met directe dubbelcheck ("Bedoel je Teeuwen Bouw B.V. in Houten? Al in je bestand."), "Zoek in KvK" (vult officiële naam, KvK, SBI, adres, medewerkers; de KvK-adapter is P11; tot dan verborgen), Klasse (voorstel uit medewerkers), adres, telefoon, website, LinkedIn, eigen velden per sectie, doelgroep en reis (vanaf P05). Knop "Prospect aanmaken"; toast "Teeuwen Bouw staat erbij." en de kaart opent. Een Beginner ziet alleen naam, plaats, telefoon, website en "Zoek in KvK".

**Geen promoveren** (B17): Dealtrace maakt geen klant van een prospect; dat gebeurt in DealDrive of het CRM. In de plaats komt **Overdragen** na een gehouden eerste afspraak met vervolg, altijd met bevestiging en audit, gebeurtenis `overgedragen` en status `overgedragen`; dat bouwt P17 Funnel van de prospectreis en overdracht (met de echte overdracht naar DealDrive in P23). Op de accountkaart reserveer je alleen de plek voor de knop "Overdragen".

**Contacten.** Routes `/contacten` (Top deze week: beslissers en beïnvloeders), `/contacten/alle`, `/contacten/:id`.

- Rollen (één begrip): "Beslisser", "Beïnvloeder", "Champion", "Gebruiker", "Blokkeerder", "Poortwachter", "Onbekend".
- **Snelformulier** op de accountkaart: "Contacten" opent een flyout met de contacten (rolvolgorde, binnen rol laatst bijgewerkt eerst) en onderaan "+ Snel contactpersoon": Voornaam, Achternaam (verplicht), Functie, E-mail, Telefoon, Mobiel, Rol (standaard Onbekend), met dubbelcheck op e-mail en naam binnen het bedrijf. "Contactpersoon toevoegen" zet hem direct in de lijst.
- **Buying committee** (blok op de kaart): per rol een vak met namen, bron ("LinkedIn, ingevoerd door Sanne", "verslag 1 okt", "Datacollectief") en zekerheid ("vermoedelijk" onder 60). Ontbrekende rollen als grijze vakken met "Nog niet gevonden" en de actie "Vraag in je volgende gesprek" (zet een vraag in het belscript, vanaf P10) of "Zoek via Datacollectief" (Expert, vanaf P15).
- **Contactkaart**: portret of initialen, naam, functie, bedrijf (link), telefoon en mobiel als bellink, LinkedIn; stuurstrip van het account met label ("Account · laatste call"); statstrook; tabbladen "Tijdlijn", "Taken", "Notities", "Afspraken", "Verslagen"; voetnoot "Daarnaast 2 open taken op accountniveau".
- **Toestemming en voorkeur**: per contact "E-mail" en "WhatsApp" met status onbekend, ja, nee, datum en bron; "Voorkeurskanaal"; "Bel me niet" (blokkeert bellen en zet het nummer op de bel-me-niet-lijst van de organisatie).
- **Status "vertrokken"** met datum in plaats van verwijderen; het contact blijft in de historie.
- Filters lijst: zoeken (naam, functie, bedrijf), rol, "Bij prospects" of "Bij klanten", "Van mijn accounts", "Zonder e-mail", "Zonder telefoon", "Geen contact in 30 of 90 dagen", eigen velden. Sortering: rol, laatste contact, bedrijf.

**Eigen velden** (`/instellingen/eigen-velden`, beheerder)

- Kop "Eigen velden", subtitel "Velden die jullie zelf nodig hebben, bovenop de standaard.", knop "+ Veld" (geel). Tabbladen **Account**, **Contact**, **Campagne**, **Afspraak**.
- Per object de secties (Account: Adres, Bereik, Stamgegevens, Kwalificatie, Contract en order, plus eigen secties met "+ Sectie"); per sectie de velden met sleepgreep, naam, type, verplicht, zichtbaar voor, gebruikt in, aantal ingevuld.
- **Veldflyout**: Naam; Sleutel (automatisch uit de naam, uniek per object, na aanmaken niet te wijzigen); Type (Tekst, Lange tekst, Getal, Bedrag, Datum, Ja of nee, Keuzelijst, Meerkeuze, Telefoon, E-mail, Link, Gebruiker); Opties (waarden met volgorde en kleur); Sectie; Verplicht (Nee, Bij aanmaken, Bij een fase); Standaardwaarde; Hulptekst; Zichtbaar voor (alle niveaus, vanaf Gevorderd, vanaf Expert); Bewerkbaar door (iedereen, eigenaar en manager, alleen beheerder); Filterbaar; Bron (handmatig, import, KvK, Datacollectief, CRM-veld); "Toon in kop". Knoppen "Annuleren", "Veld opslaan".
- Archiveren in plaats van verwijderen zolang er waarden zijn: "Archiveren verbergt het veld; de 214 ingevulde waarden blijven bewaard."
- Expert-accountmanager: "Stel een veld voor" maakt een verzoek aan de beheerder. Niet vastgelegd waar de knop staat; voorstel: onderaan het tabblad "Eigen velden" op de accountkaart.

**Telefoon (390 px): accountkaart compact** (8.5.5)

1. Naam, plaats, klasse- en fasepil, status in de reis ("Poging 3 van 5 · volgende: bellen op 16 okt", vanaf P07).
2. "Waarom nu": de reden van de motor of het sterkste inzicht, met bron (vanaf P06 en P19; tot dan de nieuwste aanleiding).
3. Contacten: per persoon rol, telefoon (tikbaar), mail; de beslisser bovenaan.
4. Laatste drie contactmomenten met kanaal, datum en uitkomst.
5. Open taken en de eerstvolgende afspraak.
6. Pitstop (ingeklapt, vanaf P18).
7. Tabs onder de vouw: Tijdlijn, Inzichten, Eigen velden, Details.
8. Plakkende actiebalk "Bellen", "Mail", "WhatsApp", "Navigeer" (P27-component); een knop zonder gegevens is uitgegrijsd met de reden. "Navigeer" opent de kaartapp; de keuze in Mijn instellingen komt in P30. Niet vastgelegd welke kaartapp tot dan; voorstel: Apple Kaarten op iOS, Google Maps op Android.

Wijzigen op de telefoon per niveau (8.11): Beginner basisvelden, Gevorderd alle velden behalve eigenaar, Expert alle velden en toewijzen aan een collega. Een contact opent als schuifvenster. Lijst en contextmenu werken met lang drukken.

### Klikpaden

1. Accountmanager klikt "+ Prospect", typt "Teeuwen"; de dubbelcheck toont "Bedoel je Teeuwen Bouw B.V. in Houten? Al in je bestand."; hij kiest het bestaande account en de kaart opent.
2. Bij een nieuw bedrijf: velden invullen, "Prospect aanmaken", toast "Teeuwen Bouw staat erbij.", de kaart opent met status `nieuw` en een berekende score.
3. Op de kaart "Contacten 3", onderaan "+ Snel contactpersoon", Rol "Beslisser", "Contactpersoon toevoegen": het buying committee vult het vak Beslisser en het primaire contact wordt deze persoon.
4. Gevorderd zet filter "Zonder beslisser": de teller op de pil was 12 en de lijst toont 12 rijen; de URL bevat het filter; na herladen staat het er nog.
5. Een account met status klant (uit DealDrive of het CRM, in deze sprint uit de seed) staat in `/klanten` en niet in `/prospects/alle`; het contextmenu heeft geen "Promoveer tot klant".
6. Salesmanager verwijdert een account: bevestiging ("Verwijderen" rood), contacten gaan mee op de server, de activiteitenlog blijft met "account verwijderd".
7. Beheerder maakt eigen veld "Aantal monteurs" (Getal, filterbaar, vanaf Gevorderd); een Beginner ziet het veld niet; een Gevorderde filtert erop met tellers.
8. Op de telefoon tikt de accountmanager op de compacte kaart "Bellen": de `tel:`-link opent met het mobiele nummer van de beslisser eerst (1 tik).

### Regels

- **Score** 0 tot 100 met zichtbare opbouw (hover en Info-flyout): versheid van aanleidingen 30, bereikbaarheid (beslisser met nummer, e-mail) 25, fit met de doelgroep (criteria uit het dossier) 20, momentum (recente uitkomsten, geplande afspraak) 15, recentheid van contact 10. Een nieuw account krijgt de berekende waarde, geen vaste 50 (gat 25). Onderdelen zonder bron in deze sprint tellen 0 en staan in de opbouw als "nog geen gegevens".
- **Laatste contact**: jongste moment uit verzonden of ontvangen mail, afgeronde bel-, mail-, bericht- en afspraaktaken, gehouden afspraken; open taken en toekomstige afspraken tellen niet; import fabriceert geen contactmoment. Eén functie voor lijst, sortering en kaart (gat 26).
- **Primair contact**: eerste beslisser of champion, anders iemand met telefoonnummer, anders de eerste.
- **Klasse**: één veld `klasse` voor kaart, lijst, filter en later de leadgenerator (gat 2).
- **Eigenaar**: in de Info-flyout; "Van mij" standaard aan op elke lijst (gat 9). Eigenaar wijzigen: salesmanager en beheerder.
- **Verwijderen**: alleen salesmanager en beheerder; cascade van contacten op de server; de knop staat er alleen met recht; inline wissen met `null` (gat 10).
- **Geen promoveren** (gat 27, B17): er is geen schrijfpad van prospect naar klant in Dealtrace; overdragen gaat altijd met bevestiging en audit (P17).
- **Rol**: één rolbegrip voor alle formulieren; geen los vinkje "beslist mee" (gat 28).
- **Open taken** tellen op contact- en accountkaart met dezelfde regel (gat 29).
- **Duplicaten** (15.1): KvK gelijk is altijd een duplicaat; anders domein zonder `www.`; anders genormaliseerde naam (zonder B.V., N.V., Holding, Group) met Sørensen-Dice: 80 procent duplicaat, 60 procent mogelijk. Contacten: exact op e-mail, anders volledige naam binnen het bedrijf. Bij samenvoegen blijven beide id's bewaard in `data.samengevoegdUit[]`.
- **Validatie**: e-mail syntaxis (MX in P04), telefoon naar E.164, postcode vier cijfers en twee letters.
- **Eigen velden**: type wijzigen alleen als alle bestaande waarden geldig blijven (anders een lijst van de afwijkende records); hooguit 100 eigen velden per object; een verplicht-bij-fase veld blokkeert de fasewissel (de fasewissel zelf is P05).
- Een contact zonder account kan niet bestaan; "Bel me niet" haalt het nummer uit elke bellijst.

### Helpartikelen

- "Een prospect toevoegen" (Prospects): de dubbelcheck, wat een Beginner invult, "Zoek in KvK".
- "De accountkaart lezen" (Prospects): kop, stuurstrip, statstrook, score met opbouw.
- "Buying committee" (Prospects): de zeven rollen, het primaire contact, ontbrekende rollen.
- "Eigen velden" (Inrichten, beheerder): typen, zichtbaar voor, filterbaar, archiveren.

## Deel 2: Technisch (hoe)

### Datamodel

Migratie `0003_accounts_contacten_eigen_velden`.

- `accounts`: kolommen uit 10.2 (`name`, `account_kind`, `klasse`, `owner_id`, `nb_status`, `reis_id`, `fase_id`, `fase_sinds`, `doelgroep_id`, `gebied_id`, `score`, `laatste_contact_op`, `city`, `postcode`, `kvk`, `domein`, `lat`, `lng`, `nb_bron`, `vv_branche_id`, `huidige_leverancier_id`, `terug_op`, `terug_regel_id`). De kolommen voor reis, gebied en verkoopverhaal blijven leeg tot P05, P14 en P28. `data`: adres, website, telefoon, linkedin, sbi[], medewerkers, dossier, band, herkomst{}, customFields{}, samengevoegdUit[], scoreOpbouw.
- `contacts`: `account_id` (verplicht, foreign key), `first_name`, `last_name`, `email`, `rol`, `status` (`actief`, `vertrokken`); `data { functie, telefoon, mobiel, linkedin, jarenInRol, bronUrl, consent {email, whatsapp}, voorkeurskanaal, belMeNiet, herkomst{}, customFields{}, vertrokkenOp? }`.
- `eigen_velden: id, organisation_id, object, sleutel, naam, type, sectie, volgorde, data {opties[], verplicht, standaard, hulp, zichtbaarVanaf, bewerkbaarDoor, filterbaar, bron, toonInKop}, gearchiveerd`.
- Waarden in `data.customFields[sleutel]` met herkomst in `data.herkomst['cf.'+sleutel]`.
- **Indexen**: bij "Filterbaar aan" maakt een migratiefunctie een expressie-index op `(data->'customFields'->>'sleutel')` per organisatie, plus een gegenereerde kolom voor getal en datum; boven 20 filterbare velden een GIN-index op `data->'customFields'`.
- `bel_me_niet (organisation_id, telefoon_e164, door, op)`. Niet vastgelegd als tabelnaam; voorstel.
- `opgeslagen_filters (organisation_id, gebruiker_id, naam, query)`. Niet vastgelegd; voorstel.
- RLS `org_isolation` op alle nieuwe tabellen. Rechtenmatrix 3.3: prospects en contacten lezen en schrijven alles voor de accountmanager; verwijderen salesmanager (team) en beheerder; eigen velden: definities beheerder, waarden iedereen.
- Sync-allowlist: `accounts`, `contacts` (waarden van eigen velden gaan mee in `data`); `eigen_velden` niet.

### Pure functies

| Functie | Invoer | Uitvoer | Randgevallen en unit-tests |
|---|---|---|---|
| `berekenScore(account, context)` in `shared/score.ts` | account, aanleidingen, contacten, dossier, uitkomsten, afspraken, nu | `{score, opbouw: {aanleiding, bereikbaarheid, fit, momentum, recentheid}}` | leeg account geeft geen 50; elk onderdeel op zijn maximum; som nooit boven 100 |
| `laatsteContact(account, records)` | account, mails, taken, afspraken | ISO-datum of null | open taak en toekomstige afspraak tellen niet; import telt niet; gelijk tijdstip |
| `primairContact(contacts)` | contacten | contact of null | geen beslisser; champion zonder telefoon; alles vertrokken |
| `filterTellers(accounts, filters)` | accounts, actieve filters | telling per pilwaarde | teller gelijk aan resultaat na klikken; pil met nul |
| `ontbrekendeRollen(contacts)` | contacten | rollen zonder actief contact | vertrokken telt niet |
| `zoekDuplicaat(kandidaat, bestand)` in `shared/ontdubbelen.ts` | account, bestaande accounts | `{soort: 'zeker'|'mogelijk'|'geen', match?, op: 'kvk'|'domein'|'naam'}` | `www.` en hoofdletters; "B.V." en "Holding"; 59, 60, 79, 80 procent |
| `contactDuplicaat(nieuw, bestaand)` | contact, contacten van het bedrijf | match of null | e-mail hoofdletterongevoelig; zelfde naam bij een ander bedrijf is geen duplicaat |
| `normaliseerTelefoon(nummer)` | tekst | E.164 of fout | 06, +31, 0031, spaties |
| `telOpenTaken(taken, scope)` | taken, account of contact | aantal | gat 29: zelfde regel op beide kaarten |
| `valideerWaarde(veld, waarde)` | definitie, waarde | ok of fout | elk type; keuzelijst met onbekende optie |
| `veldenVoorNiveau(velden, niveau)` | definities, niveau | zichtbare velden | gearchiveerd nooit |
| `cfVariabele(sleutel)` | sleutel | `{cf.sleutel}` | |
| `sleutelUitNaam(naam, bestaand)` | naam | unieke sleutel | accenten, dubbele namen |

### Endpoints

| Methode en route | Recht | Invoer | Uitvoer | Fouten |
|---|---|---|---|---|
| `GET /api/accounts?...` | lezen | filters, sortering, pagina | rijen en tellers; boven 2.000 accounts server-side gefilterd en gepagineerd | 400 onbekend filter |
| `POST /api/accounts` | schrijven | velden | account met score | 409 met de match bij een zeker duplicaat |
| `PUT /api/accounts/:id` | schrijven; eigenaar alleen salesmanager en beheerder | patch (`null` wist) | account | 403, 409 versie |
| `DELETE /api/accounts/:id` | verwijderen (salesmanager team, beheerder) | | 204, cascade contacten | 403 |
| `POST /api/accounts/samenvoegen` | Expert | `{behoudId, samenvoegenId}` | account | 409 als een klant prospect zou worden |
| `GET /api/accounts/export` | Expert | filters | CSV | 403 |
| `GET/POST/PUT /api/contacten` | lezen, schrijven | | | 400 zonder `accountId` |
| `POST /api/contacten/:id/verhuis {accountId}` | Expert | | contact met datum | |
| `POST /api/contacten/samenvoegen` | Expert | | | |
| `GET/POST/PUT /api/eigen-velden` | lezen iedereen, schrijven beheerder | definitie | | 409 sleutel bestaat, 422 typewissel met afwijkende records |
| `POST /api/eigen-velden/:id/archiveer` | beheerder | | | |
| `POST /api/eigen-velden/voorstel` | Expert | naam, type, reden | verzoek | |

`DELETE /api/accounts/:id` en `GET/POST /api/opgeslagen-filters` staan niet in het bouwplan; voorstel. `POST /api/accounts/:id/nee` is P05; `POST /api/accounts/:id/committee/voorstel` is P19; `POST /api/contacten/:id/verrijk` is P15.

### AI-stappen

Geen in deze prompt. "Stel voor met AI" (Profielbouwer, `bouwCommittee` met schema `[{naam?, functie, rol, bron, zekerheid}]`) staat in F04 maar de agent en de Bewaker komen in P08 en P19. Niet vastgelegd in welke prompt de knop komt; voorstel: P19, tot dan als knop met slot en uitleg voor Gevorderd ("Nog niet aangezet").

### Integraties

Geen. "Zoek in KvK" en "Zoek via Datacollectief" verschijnen pas met hun adapter (P11, P15).

### Functiecatalogus

| Sleutel | Startindeling: aan vanaf | Pakket | Recht | Helpartikel |
|---|---|---|---|---|
| `prospects.lijst`, `prospects.kaart`, `prospects.nieuw` | Beginner | Starter | iedereen | "Een prospect toevoegen", "De accountkaart lezen" |
| `prospects.filtersAlle`, `prospects.weergaven`, `prospects.opgeslagenFilters`, `prospects.klasseZetten` | Gevorderd | Starter | iedereen | "De accountkaart lezen" |
| `prospects.samenvoegen`, `prospects.export`, `prospects.scoreOpbouw` | Expert | Starter | iedereen | "De accountkaart lezen" |
| `prospects.verwijderen`, `prospects.eigenaarWijzigen` | Gevorderd | Starter | salesmanager | "De accountkaart lezen" |
| `contacten.basis` | Beginner | Starter | iedereen | "Buying committee" |
| `contacten.filters` | Gevorderd | Starter | iedereen | "Buying committee" |
| `contacten.samenvoegen`, `contacten.verhuizen` | Expert | Starter | iedereen | "Buying committee" |
| `eigenVelden.invullen` | Beginner | Starter | iedereen | "Eigen velden" |
| `eigenVelden.filteren` | Gevorderd | Starter | iedereen | "Eigen velden" |
| `eigenVelden.voorstellen` | Expert | Starter | iedereen | "Eigen velden" |
| `eigenVelden.beheren` | Expert | Starter | beheerder | "Eigen velden" |

Pakket: het bouwplan legt per functie geen pakket vast; voorstel Starter.

### Hergebruik uit DealDrive

| Bestand | Wat je aanpast |
|---|---|
| `prospects/*`, `accounts/[id]/index.vue`, `klanten/alle.vue` | één accountkaart voor prospect en klant; stuurstrip met reis en ritme; tabbladen per niveau; zonder tabblad "Deals", "Open deals", "Open offertes" en promoveren |
| `AccountRow.vue`, `AccountScoreCircle.vue` | score uit `berekenScore` met opbouw, geen vaste 50 |
| `KlantGradePicker.vue` | schrijft alleen `klasse` (gat 2) |
| `EditableField.vue`, `InlineEditChip.vue` | wissen met `null` (gat 10) |
| `contacten/*`, `ContactInfoFlyout.vue`, `ContactenFlyout.vue`, `useContactRol.ts`, `Portrait.vue` | één rolbegrip (gat 28); toestemming en bel me niet |
| `useCustomFields.ts`, `instellingen/custom-fields.vue` | filterbaar met index, zichtbaar per niveau, archiveren, typewissel met controle |
| `shared/dexKaartVelden.ts`, `DexKaart.vue` | worden `shared/kaartvelden.ts` en `RecordVenster.vue`: één veldenlijst per soort voor scherm, server en niveau |

### Buiten scope

Zet nee, statusmachine en reis (P05), taken en Vandaag (P07), afspraken (P13), overdragen na de eerste afspraak (P17 Funnel van de prospectreis en overdracht), briefing (P18), inzichten en Profielbouwer (P19), KvK (P11), Datacollectief (P15), import (P04), de velden uit het verkoopverhaal op de kaart ("Branche (verkoopverhaal)", "Huidige leverancier", "Terug op"; P28 en P05).

## Acceptatiecriteria

1. Tellers op filterpillen kloppen met het resultaat als je ze aanklikt, ook in combinatie; filters en sortering overleven herladen via de URL.
2. Een dubbel bedrijf wordt bij aanmaken gevangen op KvK, domein en naam; 80 procent naamgelijkenis is "zeker", 60 tot 80 "mogelijk".
3. De score toont zijn opbouw in vijf onderdelen.
4. Een contact zonder account kan niet bestaan (database en API); rol en primair contact zijn overal gelijk.
5. "Bel me niet" haalt het nummer uit elke bellijst; de bellink is uitgegrijsd met de reden.
6. Een keuzelijstveld is filterbaar met tellers; een import met `cf:aantal_monteurs` vult waarden (getest samen met P04); een Beginner ziet een veld "vanaf Gevorderd" niet, ook niet in de API-respons.
7. Bijlage A, gat 2: klasse staat in één veld `klasse`; geen `tier` of `accountfase` meer.
8. Bijlage A, gat 9: eigenaar staat in de Info-flyout; "Van mij" staat standaard aan op `/prospects/alle` en `/contacten/alle`.
9. Bijlage A, gat 10: verwijderen wist contacten op de server; de verwijderknop staat er alleen met recht; inline wissen gebruikt `null`.
10. Bijlage A, gat 25: een nieuw account krijgt een berekende score, niet 50.
11. Bijlage A, gat 26: lijst, sortering "Laatste contact" en kaart gebruiken `laatsteContact`.
12. Bijlage A, gat 27: Dealtrace promoveert niet; er is geen endpoint, menu-item of knop "Promoveer tot klant"; de accountkaart heeft geen "Open deals", "Open offertes" of tabblad "Deals".
13. Bijlage A, gat 28: één rolbegrip in snelformulier, contactkaart en Info-flyout.
14. Bijlage A, gat 29: open taken tellen op contact- en accountkaart via `telOpenTaken`.
15. Bijlage A, gat 16: score, laatste contact, primair contact en ontdubbelen staan elk één keer in `shared/`.
16. Op 390 px: de compacte accountkaart toont naam, contacten met tikbare telefoon en de actiebalk zonder horizontale scroll; alle tikdoelen minimaal 44 px, actiebalk 48 px; bellen kost 1 tik vanaf de kaart (8.7).
17. Getest als Beginner (alleen basisvelden, geen samenvoegen), Gevorderd (filters, weergaven, klasse zetten) en Expert (samenvoegen, export, scoreopbouw), en als salesmanager (verwijderen) en beheerder (eigen velden).
18. Performance: `GET /api/accounts` met 600 accounts en 3.000 contacten past in het budget "Bootstrap onder 1,5 s en onder 2 MB" (13.4).

## Definition of Done

Hoofdstuk 19 geldt volledig. Specifiek voor deze prompt:

- De sprint-2-toestand "een accountkaart is op de telefoon met één duim te bedienen" is op een echte iPhone en Android bevestigd.
- Wegwerp-Postgres-tests voor cascade bij verwijderen, de expressie-index bij "Filterbaar aan" en cross-tenant op `eigen_velden`.
- Playwright: lijst met filters, kaart, nieuwe prospect met dubbelcheck, eigen veld aanmaken en filteren, op desktop en 375, 390, 412 px.
- Seeddata: accounts en contacten uit de fictieve wereld van Testbedrijf Voltvast (installatiebedrijven in Midden- en Noord-Nederland, verzonnen namen); de voorbeeldnaam "Teeuwen Bouw" uit het bouwplan alleen als schermtekst.
