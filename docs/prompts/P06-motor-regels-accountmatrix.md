# P06: Motor, regels en accountmatrix

| Onderdeel | Waarde |
|---|---|
| Sprint | 4 |
| Features | F15 Activity selling-regels (de motor), F16 Accountmatrix en ritmes |
| Hangt af van | P01 (fundament, rollen, niveaus, functiecatalogus, instellingen, audit), P02 (startset per nieuwe organisatie), P03 (accounts, contacten, eigen velden), P05 (standaard prospectreis, statusmachine, gebeurtenissen, terugkomregels) |
| Bron in het bouwplan | F15, F16, 4.3 (rijen F15 en F16), 3.3 (rij Regels), 7.2, 7.3, 10.2 (`activity_rules`, `rule_runs`), 13.3 (flow 5 Motorrun), 13.4 (budget motorrun), 15.1, 8.12, Bijlage A (gat 6, 7, 8, 16, 20, 41, 43, 44), Bijlage B (rijen Motor en Ritme) |

## Lees eerst

- `Bouwplan-Dealtrace.md`: 2.1 en 2.4 (één regelmotor, één rekenpunt), 3.3, 4.2 en 4.3, 7.2 tot en met 7.4, F05 (gebeurtenissencatalogus en meldpunt), F06 (regels met activiteit "taak" en inzichtstatussen), F13 (hercontactritme, afkoelperiodes), F15, F16, F22 (instellingen bewaren per veld), 10.1, 10.2, 13.3, 13.4, 19, Bijlage A, Bijlage B.
- DealDrive op commit 75bee61 (alleen lezen): `server/utils/ruleEngine.ts` (`runRulesForOrg`, `runEventRules`, `voegWerkdagenToe`), `server/utils/activityRulesStore.ts`, `server/utils/activitySellingWerkmap.ts`, `shared/activitySellingExcel.ts`, `shared/activitySellingKolommen.ts`, `shared/activitySellingRestanten.ts`, `shared/activitySellingVoorbeeld.ts`, `app/composables/useActivitySellingRules.ts`, `app/pages/instellingen/activity-selling.vue`, `app/plugins/motorPoll.client.ts`, `shared/ritmematrix.ts`, `shared/offerteOpvolging.ts`, `shared/datum.ts`, `shared/periodeFilter.ts`, `app/pages/instellingen/accountritme.vue`, `app/composables/useRitmematrix.ts`, `shared/leadGenerator.ts` (`klasseVoorOmvang`).

## Deel 1: Functioneel (wat en waarom)

### Wat je bouwt

Je bouwt de motor die op basis van regels zelf taken en inzichten klaarzet, met een regeleditor, een starterset van 23 werkende regels en de accountmatrix die per klasse vastlegt hoeveel aandacht een account krijgt.

### Waarom

Dealtrace belooft dat je 's ochtends weet wie je belt, mailt of bezoekt en waarom. Dat werk zet de motor klaar. In DealDrive filterde de motor niet op accounttype, stuurden zes velden niets, draaiden 37 standaardregels zonder trigger en vuurde de inactiviteitsregel nooit voor een account zonder datum (Bijlage A, gat 6, 8 en 20). De matrix toonde "niet ingesteld" en "bewust uit" allebei als 0 en rekende per klasse af, waardoor stille accounts wegvielen (gat 43 en 44). Voor new business is het hercontactritme (F13) de reeks pogingen tot een afspraak; de belmatrix regelt het onderhoudsritme daarna. Beide staan op dezelfde pagina, met de regel "nooit twee ritmes tegelijk op één account".

### Gebruikers en niveaus

| Rol | Niveau | Wat |
|---|---|---|
| Accountmanager | Beginner | Ziet alleen het resultaat: taken en inzichten met bij elke taak "Waarom krijg ik dit?" in gewone taal. Ziet de klasse van een account. Geen toegang tot de regelpagina |
| Accountmanager | Gevorderd | Regels lezen, droogloop bekijken; klasse zetten; op de matrixpagina "Wat betekent dit voor mij" |
| Accountmanager | Expert | Persoonlijke regel maken (alleen voor eigen accounts), teamregel voorstellen, matrix voorstellen |
| Salesmanager | Gevorderd of Expert | Teamregels aan- en uitzetten, cadans, drempels, klassen; regels lezen en schrijven voor het team |
| Beheerder | Expert | Alles: nieuwe regels, AI-regels, Excel-import en -export, back-up, starterset; definities van matrix, klassen, segmenten, afkoeling |
| Founder | n.v.t. | Beheert de platformstartset van regels (de 23 regels die elke nieuwe organisatie krijgt); klantregels alleen na instappen |

### Schermen

**Regels** (`/instellingen/regels`), master en detail zoals in DealDrive, van boven naar beneden:

1. Kop met kruimelpad, kicker en titel. Tellers: "21 actief · 2 uit · 19 door de motor · 23 totaal" en de opslagstatus ("Opslaan…", "Opgeslagen", "Opslaan mislukt", na 600 ms stilte, F22).
2. Filterbalk: zoeken, categorie, bron, reis en fase, status van het account, uitvoerderrol, "Alleen motorregels". Alle filters staan in de URL.
3. Knoppen: "Draai motor nu", "Exporteren", "Importeren", "Back-up", "Back-up terugzetten", "Starterset terugzetten".
4. Links de lijst: per regel schakelaar, categorie, naam, label "motor" of "alleen feed", prioriteitsstip.
5. Rechts het bewerkpaneel met drie blokken, elk veld met een ⓘ-uitleg:

| Blok | Velden |
|---|---|
| Wat en wanneer | Categorie, Subcategorie, Omschrijving, Activiteit (Inzicht of Taak), Cadans, Prioriteit |
| Sturing | Bron (Intern, Extern), Specifieke bron, Triggerpatroon met parameters, Motor (Regel of AI), Afbakening: accounttype, status, reis en fase, doelgroep, campagne, klasse |
| Gevolg | Actiesoort (Bellen, Mailen, LinkedIn, Bezoek, Bericht, Geen), Uitvoerderrol (Binnendienst, Buitendienst, Eigenaar, Salesmanager), Termijn ("binnen 24 uur", "binnen 3 werkdagen"), Taaksjabloon met `{account}`, `{contact}`, `{offerte}`, Belscript (bij bellen), Automatisch voorbereiden, Signaaltype, Verwacht resultaat |

6. Onder het paneel het live voorbeeld "Zo verschijnt hij in de takenlijst" met een voorbeeldprospect.
7. Droogloop: "Deze regel raakt nu 214 accounts en maakt bij de volgende run 38 taken", met de verdeling per persoon. Een regel die meer dan 50 taken per persoon zou maken vraagt bevestiging.

Lege staat (gefilterd zonder treffers): Niet vastgelegd in het bouwplan; voorstel: "Geen regels die aan deze filters voldoen." met "Toon alles" (2.3).

Per niveau: een Gevorderde ziet de pagina alleen lezen (velden niet bewerkbaar, geen schakelaars, wel droogloop); een Expert ziet alleen zijn persoonlijke regels bewerkbaar en bij teamregels de knop "Stel wijziging voor". Een Beginner die de route opent, ziet de paginakop met kicker "Vergrendeld" en de uitleg uit 6.1, nooit een foutpagina.

Ingang voor Gevorderd en Expert: de zijbalk toont Instellingen alleen voor de beheerder (6.1). Niet vastgelegd in het bouwplan; voorstel: in Mijn instellingen een regel "Regels bekijken" (Gevorderd) en "Mijn regels" (Expert, zie F22), en in de taakflyout onder "Waarom krijg ik dit?" de link "Bekijk de regel" (Gevorderd en hoger).

**Accountmatrix en ritmes** (`/instellingen/ritme`). Iedereen kan meekijken, met bovenaan "Je kunt meekijken. Alleen een beheerder wijzigt de inrichting." Gevorderd ziet het blok "Wat betekent dit voor mij": hoeveel belmomenten en bezoeken de matrix deze week van hem verwacht, tegen zijn capaciteit. Secties van boven naar beneden:

1. **Accountklassen**: code (maximaal 2 tekens), naam, omschrijving, aantal accounts. Standaard A Corporate (250+ medewerkers), B Groot MKB (50 tot 250), C Middenbedrijf (10 tot 50), D Klein MKB (tot 10). Melding "34 prospects hebben nog geen klasse." met de knop "Stel voor uit medewerkers" (gebruikt KvK of Datacollectief, waar gekoppeld).
2. **Segmenten**: regels op velden, inclusief eigen velden en matrixvelden; leden met teller.
3. **Belmatrix**: per accounttype (prospect, klant) en klasse het aantal per maand, kwartaal, halfjaar en jaar, met afgeleid ritme ("12×/jaar = elke 4 weken"). "niet ingesteld" en "bewust uit (0)" zijn zichtbaar verschillend. Standaard prospect A en B maandelijks, C per kwartaal, D per halfjaar; klant A maandelijks, B per kwartaal, C per halfjaar, D jaarlijks.
4. **Afspraakmatrix**: per klasse meeting (online) en bezoek; standaard A per kwartaal, B per halfjaar, C jaarlijks, D bezoek jaarlijks.
5. **Offertematrix**: per waardeklasse kanaal, uitvoerderrol (binnendienst, buitendienst, salesmanager, directie), opvolgtermijn in werkdagen en toelichting. Standaard €0 mail binnendienst 5 werkdagen, €10.000 bellen 3, €50.000 bezoek buitendienst 5, €100.000 salesmanager belt binnen 2. Contracten altijd in een persoonlijk gesprek op locatie (F16: "face-to-face").
6. **Afkoelperiodes en consent**: per kanaal de afkoelperiode na een nee (standaard bellen 90 dagen, mail 60, LinkedIn 90, WhatsApp 180, bezoek 180, kaart 365; 7.2) en het frequentieplafond (maximaal één bericht per kanaal per 3 werkdagen buiten het ritme).
7. **Overschrijven per reis**: welke reizen (F05) een eigen belmatrix, offertematrix of ritme gebruiken.

**Telefoon (390 px).** De regeleditor en Instellingen staan bewust niet op de telefoon (8.12). Beide pagina's openen wel, met bovenaan de melding "Beter op een groot scherm", en tonen de lijst en de matrix alleen lezen in één kolom zonder horizontale scroll. De uitleg "Waarom krijg ik dit?" in het taakvenster werkt volledig op de telefoon.

### Klikpaden

1. **Regel aanpassen (salesmanager).** Klik een regel in de lijst; het paneel rechts opent. Wijzig de cadans; na 600 ms toont de kop "Opgeslagen" en de droogloop rekent opnieuw. Er komt een auditregel.
2. **Droogloop met bevestiging.** Verlaag bij SR06 de drempel van 45 naar 10 dagen; de droogloop toont meer dan 50 taken per persoon. Bij opslaan vraagt een bevestiging "Deze regel maakt bij de volgende run 64 taken voor Jan. Toch opslaan?" (Niet vastgelegd in het bouwplan; voorstel voor de tekst) met de knop "Opslaan".
3. **Motor nu draaien.** "Draai motor nu" start een run voor de organisatie; de knop toont de voortgang; open sessies zien de nieuwe taken binnen 3 minuten (via `GET /api/motor/updates`). Toast "Motor gedraaid. 12 taken en 3 inzichten klaargezet."
4. **Persoonlijke regel (Expert).** "+ Regel" maakt een regel met afbakening vast op "Mijn accounts"; opslaan; droogloop toont alleen eigen accounts.
5. **Starterset terugzetten (beheerder).** Bevestiging met de vraag als titel, wat verloren gaat in de tekst en het werkwoord "Terugzetten" op de knop. Daarna staan precies de 23 regels van de starterset er, alle met trigger.
6. **Excel.** "Exporteren" levert een werkmap met blad "Regels" (keuzelijsten per kolom) en "Toelichting". "Importeren" leest tot 5 MB en 2.000 rijen, toont per rij fouten en waarschuwingen, en laat kiezen tussen "Samenvoegen op id" en "Alles vervangen".
7. **Klasse voorstellen (beheerder).** "Stel voor uit medewerkers" toont per account de voorgestelde klasse; "Pas toe" zet de klasse en schrijft herkomst per veld.
8. **Matrixcel op bewust uit.** Typ 0 in een cel; de cel toont "bewust uit (0)" en de motor maakt voor die combinatie geen ritmetaken. Leegmaken toont "niet ingesteld" en de standaard geldt.

### Triggerpatronen

| Patroon | Vuurt als | Parameters |
|---|---|---|
| Datum-drempel | datumveld ligt 0 tot N dagen in de toekomst | veld, dagen (standaard 60) |
| Inactiviteit | datumveld ligt N of meer dagen terug; "ook zonder datum" voor nieuwe prospects | veld, dagen (30), ookZonderDatum |
| Ritme | altijd; cadans of matrix is de poort | actiesoort |
| Gebeurtenis | gebeurtenis uit de catalogus of "fase betreden" | gebeurtenis, fase |
| Te lang in fase | dagen in fase boven het verwachte verblijf | marge |
| Lead verlopen | dossier ouder dan N dagen | dagen (30) |
| Jaarplanning-venster | venster voorbij en niet benaderd dit verkoopjaar | geen |
| Offerte verstuurd | offerte verstuurd zonder opvolgtaak | werkdagen (3) |
| Deal onvoldoende gekwalificeerd | open deal boven bedrag, ouder dan N dagen, BAND 1 of minder | bedrag, dagen |
| Campagne-achterstand | tempo N punten achter | marge (10) |
| Hercontact-vervolg | volgende poging in een ritme is aan de beurt | geen |
| Geparkeerd terug | terugkomdatum bereikt | geen |
| Trigger-heractivatie | nieuw extern signaal bij een account in wachtend of nee, afkoelperiode voorbij | signaalsoorten |
| Tussendoel gehaald | tussendoel van een activiteit bereikt | geen |
| Partner te laat | doorgezette lead niet bevestigd binnen de termijn | geen |

Cadans: Dagelijks 1, 2 dagen, 3 dagen, Wekelijks 7, 2 weken 14, Maandelijks 30, 2 maanden 61, Kwartaal 91, Half jaar 182, Jaarlijks 365, Continu. AI-regels minimaal wekelijks.

### Starterset

Elke regel draait; "Starterset terugzetten" laadt precies deze set: SR01 nieuwe lead zonder dossier · SR02 dossier verloopt · SR03 gekwalificeerd, nog geen contact (inactiviteit 7 dagen, ook zonder datum, bellen, binnendienst) · SR04 belritme prospect (ritme, matrix) · SR05 bezoekritme A en B (buitendienst, op regiodag) · SR06 contact-stilte 45 dagen · SR07 jaarplanningsvenster voorbij · SR08 afspraak gehad, geen vervolg · SR09 offerte opvolgen · SR10 deal onvoldoende gekwalificeerd · SR11 campagne loopt achter · SR12 deal gewonnen: overdracht · SR13 deal verloren: heropvolging over 90 dagen · SR14 AI-kansanalyse A en B · SR15 vacatures · SR16 nieuws · SR17 hercontact-vervolg · SR18 geparkeerd terug · SR19 trigger-heractivatie (jubileum, vacature, directiewissel, verhuizing, subsidie) · SR20 partner te laat · SR21 tussendoel gehaald · SR22 te lang in fase · SR23 KvK-mutatie bij prospect in reis.

Een deel van de bronnen bestaat in sprint 4 nog niet (offertes P17, campagnes P16, AI-regels en webbronnen P19, KvK-mutaties P11). Niet vastgelegd in het bouwplan; voorstel: alle 23 regels worden geladen en geëvalueerd; een regel waarvan de brondata nog niet bestaat levert nul treffers zonder fout, en heeft al wel een unit-test met fixturedata, zodat hij werkt zodra de bron er is. AI-regels (SR14 tot en met SR16) draaien in deze prompt tegen de mock-provider.

### Regels van de motor

- Draait elk uur per organisatie, direct na een gebeurtenis voor dat ene account, en op "Draai motor nu"; open sessies zien het resultaat binnen 3 minuten.
- Volgorde van een motorrun (13.3): eerst de afsluiter van campagnes, dan regels (deterministisch in één transactie, AI erbuiten), dan Planner (landing en capaciteit), dan belblokvuller, dan automatisch voorbereiden. Stappen die nog niet bestaan, sla je over met een lege stap in het runverslag.
- Cadanspoort per regel en onderwerp; ontdubbelen van open inzichten: bijwerken zonder terug naar ongelezen (gat 40 hoort bij P07, de motor levert hier het gedrag); offertes en deals krijgen één opvolging per onderwerp.
- **Afbakening**: accounttype, status (7.2), reis en fase, doelgroep, campagne, klasse. Elke afbakening filtert echt (gat 6).
- **Capaciteit**: per uitvoerder een dagplafond, standaard binnendienst 40 beltaken en buitendienst 6 bezoeken per regiodag; wat erboven valt schuift naar de volgende werkdag en wordt gemeld.
- **Landing**: taken voor de binnendienst krijgen als vervaldatum het eerstvolgende passende belblok, taken voor de buitendienst de regiodag van het account. Zolang belblokken (P10) en regiodagen (P14) niet bestaan, valt de landing terug op `volgendWerkmoment`.
- **Eigenaar**: accounteigenaar, anders de uitvoerderrol van het gebied, anders de salesmanager van het team.
- **Statusmachine en afkoeling**: de motor maakt nooit een contacttaak voor een account in afkoeling op dat kanaal (`magBenaderen`, 7.2) en nooit een tweede ritme op één account.
- **Leerlus**: per regel de acceptatiegraad (omgezet, afgewezen met reden, genegeerd) en wat de taken opleverden (afspraken). Onder 20 procent acceptatie over 30 dagen krijgt de eigenaar een inzicht "Regel levert vooral ruis".
- **Matrix**: interval = 365 / jaartotaal, afgerond, minimaal 1 dag; een ingevulde matrix levert zelfstandig taken op (geen losse ritmeregel nodig, gat 8); afrekening per account, niet als som per klasse, en met hetzelfde kanaal dat de motor voorschrijft (gat 44).
- Een kapotte instelling laat de motor nooit omvallen: zonder geldige instelling geldt de standaard.

### Helpartikelen

- "Regels" (collectie Hoe werkt Dealtrace, categorie Inrichten): wat een regel is, de drie blokken, triggerpatronen, droogloop, persoonlijke regels voor Experts, de leerlus.
- "Accountmatrix" (Inrichten): klassen, belmatrix, afspraakmatrix, offertematrix, afkoelperiodes, het verschil tussen "niet ingesteld" en "bewust uit".
- "Regels die werk opleveren (en geen ruis)" staat in het leerpad Expert (F21); Niet vastgelegd in het bouwplan; voorstel: schrijf het in deze prompt als concept, P09 publiceert het in het leerpad.
- Tekst achter "Waarom krijg ik dit?" komt uit de regel (omschrijving plus de trigger in gewone taal), geen apart artikel.

## Deel 2: Technisch (hoe)

### Datamodel

10.2 noemt `activity_rules` en `rule_runs` met verwijzing naar F15 maar zonder kolommen. Niet vastgelegd in het bouwplan; voorstel:

```ts
activity_rules: id, organisation_id, code ('SR01'..'SR23' of null), naam, categorie, actief boolean,
                motor ('regel'|'ai'), scope ('organisatie'|'team'|'persoonlijk'), team_id?, eigenaar_id?,
                reis_id?, fase_id?, cadans_dagen, prioriteit, versie, data jsonb
  data: subcategorie, omschrijving, activiteit ('inzicht'|'taak'), bron ('intern'|'extern'), specifiekeBron,
        trigger {patroon, parameters}, afbakening {accounttypes[], statussen[], reisIds[], faseIds[],
        doelgroepIds[], campagneIds[], klassen[]}, gevolg {actiesoort, uitvoerderrol, termijn, taaksjabloon,
        belscriptId?, automatischVoorbereiden, signaaltype, verwachtResultaat}, herkomst ('starterset'|'eigen'|'import')
rule_runs: id, organisation_id, rule_id?, soort ('uur'|'gebeurtenis'|'handmatig'), gestart_op, eind_op,
           geraakt, taken, inzichten, geschoven, fouten jsonb, stappen jsonb
```

- `activity_rules.reis_id` en `fase_id`: null betekent alle reizen of alle fases (F05).
- De editor is de enige bron; `data` bevat alle velden die de editor toont en niets anders. Velden die niets sturen bestaan niet (gat 6 en 7). Excel is import en export van dezelfde structuur; normalisatie laat geen veld vallen (gat 7).
- Instellingssleutels in `shared/settingKeys.ts`: `accountklassen`, `belmatrix`, `afspraakmatrix`, `offerteOpvolging`, `afkoeling`, `frequentieplafond`, `segmenten`, `capaciteit` (Niet vastgelegd in het bouwplan; voorstel voor `segmenten` en `capaciteit`).
- Matrixcel: `null` is "niet ingesteld", `0` is "bewust uit" (gat 43). Een patch met `null` wist de sleutel, `undefined` wist niets (10.1).
- Migratie maakt beide tabellen met `organisation_id`, RLS-policy `org_isolation` en indexen op `(organisation_id, actief)` en `(organisation_id, rule_id, gestart_op)`.
- Rechtenmatrix (`server/utils/permissions.ts`, 3.3): `activity_rules` accountmanager lezen (vanaf Gevorderd), schrijven alleen `scope='persoonlijk'` met `eigenaar_id = zelf` (Expert); salesmanager lezen, schrijven `scope='team'` voor eigen teams; beheerder alles; founder alleen de platformstartset en na instappen. Instellingssleutels van de matrix: lezen iedereen, schrijven beheerder.
- Sync-allowlist: `activity_rules` niet via de sync (alleen de endpoints hieronder); `rule_runs` alleen lezen. Taken en inzichten die de motor maakt, gaan via de bestaande tabellen `tasks` en `signals`.
- Startset: P02 laadt bij een nieuwe organisatie de 23 regels uit de platformstartset. De standaard leeft als data in `server/db/seed/`, niet alleen in code.

### Pure functies

| Functie | Invoer | Uitvoer | Randgevallen en tests |
|---|---|---|---|
| `evaluateTrigger(regel, onderwerp, nu)` | regel, account of deal of lead of campagne, `nu` | `{vuurt, reden, bewijs[]}` | elk van de vijftien patronen; inactiviteit met `ookZonderDatum` gebruikt de aanmaakdatum als anker (gat 20); datum precies op de grens |
| `ruleTargetsAccount(regel, account)` | regel, account | boolean | elke afbakening apart en gecombineerd; klant tegenover prospect (gat 6); account in afkoeling |
| `cadansVerstreken(regel, onderwerpId, vorigeRuns, nu)` | | boolean | Continu; eerste run; precies op de grens; werkdagen met feestdagen uit `shared/datum.ts` |
| `vulSjabloon(sjabloon, context)` | taaksjabloon, account, contact, offerte | tekst | ontbrekende waarde; onbekende variabele geeft fout bij opslaan |
| `landingsmoment(taak, gebruiker, blokken, regiodagen)` | | datum en tijd | geen blokken; regiodag vandaag al voorbij; weekend en feestdag |
| `verdeelCapaciteit(taken, plafonds, nu)` | | `{geland[], geschoven[]}` | precies 40; 41 schuift één taak; meerdere uitvoerders (Niet vastgelegd in het bouwplan; voorstel voor de naam) |
| `droogloop(regel, accounts)` | | `{geraakt, taken, perPersoon{}}` | regel met 0 treffers; meer dan 50 per persoon zet `vraagtBevestiging` |
| `jaartotaal`, `intervalDagen`, `ritmeLabel` | matrixrij | getal, getal, tekst | `null` en `0` verschillend; interval minimaal 1 dag |
| `klasseVoorOmvang(medewerkers, klassen)` | | klassecode of null | grenzen 10, 50, 250; eigen klassen van de organisatie |
| `offerteProfiel(bedrag, matrix, soort)` | | `{kanaal, rol, werkdagen}` | precies op een drempel; contract altijd bezoek |
| `ritmeAfrekening(accounts, activiteiten, periode)` | | per account achter, op schema, vooruit | afrekening per account, niet per klasse (gat 44); kanaal telt alleen als het overeenkomt |

Alle functies staan in `shared/` (motorlogica die geen database leest) of `server/utils/` en hebben `nu` als parameter. Elke definitie staat één keer (gat 16): één catalogus van triggerpatronen in `shared/regelPatronen.ts` (Niet vastgelegd in het bouwplan; voorstel voor de bestandsnaam), gebruikt door editor, Excel en motor.

### Endpoints

| Methode en route | Recht | Invoer | Uitvoer | Fouten |
|---|---|---|---|---|
| `GET /api/regels` | Gevorderd en hoger | filters als query | regels met tellers | 403 `{functie, reden}` bij Beginner |
| `POST /api/regels` | Expert (persoonlijk), salesmanager (team), beheerder | regel | regel met id | 422 bij onbekende variabele of ontbrekende trigger |
| `PUT /api/regels/:id` | als hierboven, binnen scope | patch | regel | 403 buiten scope; 409 bij versieconflict |
| `DELETE /api/regels/:id` | beheerder; eigen persoonlijke regel voor Expert | | 204 | 403 |
| `POST /api/regels/:id/droogloop` | Gevorderd en hoger | | droogloop | |
| `POST /api/regels/excel-export` | salesmanager, beheerder | | werkmap | |
| `POST /api/regels/excel-import` | beheerder | bestand, modus | rapport per rij | 413 boven 5 MB; 422 boven 2.000 rijen |
| `POST /api/regels/starterset` | beheerder | | 23 regels | (Niet vastgelegd in het bouwplan; voorstel voor de route) |
| `POST /api/motor/run` | salesmanager, beheerder | optioneel `accountId` | runverslag | 429 als er al een run loopt |
| `POST /api/motor/run-all` | geplande functie met `x-motor-secret` | | per organisatie een run | 401 zonder geheim |
| `GET /api/motor/updates?since=` | iedere gebruiker | tijdstip | nieuwe en gewijzigde taken en inzichten | |
| `GET /api/settings`, `PUT /api/settings/:key` | lezen iedereen; schrijven beheerder | sleutel en waarde | waarde | 403; 422 bij ongeldige matrix |
| `POST /api/accountklassen/voorstel` | beheerder | accountIds | voorstel per account | (Niet vastgelegd in het bouwplan; voorstel) |

De server weigert elk endpoint van een functie die voor de gebruiker niet beschikbaar is met 403 `{functie, reden: 'niveau'|'pakket'|'rol'}` (4.2).

### AI-stappen

De AI-regels (Motor "AI", SR14 tot en met SR16) draaien buiten de deterministische transactie, via de providerlaag met schema en bewijsplicht (11.2), minimaal wekelijks. Mandaat en Bewaker komen in P08; in deze prompt draaien ze alleen tegen de mock met vaste fixtures en een golden master. Bundelsoort: inzicht-beoordeling (11.4).

### Integraties

Geen externe integratie. "Stel voor uit medewerkers" leest bestaande velden (medewerkers uit KvK of Datacollectief, als ze er al staan); het ophalen zelf komt in P11 en P15.

### Functiecatalogus

Niet vastgelegd in het bouwplan; voorstel voor de sleutels (niveau en recht uit 4.3 en 3.3; pakket: alle pakketten, behalve de AI-regels die de bundel van het pakket volgen):

| Sleutel | Niveau | Pakket | Recht | Helpartikel |
|---|---|---|---|---|
| `regels.lezen` | Gevorderd | Starter | accountmanager | Regels |
| `regels.persoonlijk` | Expert | Starter | accountmanager | Regels |
| `regels.team` | Gevorderd | Starter | salesmanager | Regels |
| `regels.beheer` | Expert | Starter | beheerder | Regels |
| `motor.ai` | Expert | Plus | beheerder | Regels |
| `matrix.klasseZetten` | Gevorderd | Starter | accountmanager | Accountmatrix |
| `matrix.voorstellen` | Expert | Starter | accountmanager | Accountmatrix |
| `matrix.beheer` | Expert | Starter | beheerder | Accountmatrix |

### Hergebruik uit DealDrive

- `server/utils/ruleEngine.ts`: kopieer de runlus, cadanspoort, `voegWerkdagenToe` en het loggen; voeg de nieuwe patronen toe (Hercontact-vervolg, Geparkeerd terug, Trigger-heractivatie, Tussendoel gehaald, Partner te laat, Jaarplanning-venster), de afbakening op type en status en de stappen landing en capaciteit. Schrap velden die niets sturen.
- `server/utils/activityRulesStore.ts`, `useActivitySellingRules.ts`, `instellingen/activity-selling.vue`: master en detail, opslaan per veld; pas aan naar de drie blokken en de nieuwe afbakening.
- `activitySellingWerkmap.ts`, `shared/activitySellingExcel.ts`, `shared/activitySellingKolommen.ts`: Excel met blad Regels en Toelichting; de kolommen volgen het nieuwe datamodel.
- `app/plugins/motorPoll.client.ts`: poll op `GET /api/motor/updates`.
- `shared/ritmematrix.ts` en `shared/offerteOpvolging.ts`: letterlijk, plus het onderscheid tussen `null` en `0`.
- `instellingen/accountritme.vue` en `useRitmematrix.ts`: basis voor `/instellingen/ritme`.
- `shared/leadGenerator.ts` (`klasseVoorOmvang`): verhuist naar één plek en leest de klassen van de organisatie.

### Buiten scope

- Mandaten, Bewaker en de Planner als agent met `agent_runs` (P08); de rekenfuncties voor landing en capaciteit staan hier, de agent eromheen in P08. Niet vastgelegd in het bouwplan; voorstel voor deze knip.
- Belblokvuller (P10), regiodagen (P14), campagne-afsluiter (P16), echte AI-bronnen (P19).
- Regels die aan een maatwerkreis hangen via de reiseditor (P22); het veld `reis_id` bestaat hier al.
- De motor in Platformbeheer (P24).

## Acceptatiecriteria

1. Een run over 40 prospects in vier klassen levert precies de verwachte taken; een tweede run direct erna levert niets (F15).
2. Een persoonlijke regel van een Expert raakt alleen zijn eigen accounts; een server-side poging om een teamregel te wijzigen als accountmanager geeft 403.
3. Het capaciteitsplafond schuift het overschot door: 41 beltaken voor één binnendienstmedewerker geven 40 op vandaag en 1 op de volgende werkdag, met een melding.
4. Bijlage A, gat 6: de motor filtert op accounttype, status, reis, fase, doelgroep, campagne en klasse; een test per afbakening bewijst dat een niet-passend account geen taak krijgt. Er bestaat geen veld in `activity_rules.data` dat niets stuurt (test die elk editorveld tegen de motor legt).
5. Bijlage A, gat 7: de editor toont taaksjabloon, signaaltypes en status; export gevolgd door import levert byte voor byte dezelfde regels op (geen veld valt weg).
6. Bijlage A, gat 8: de starterset bevat 23 regels die allemaal een trigger hebben en elk een unit-test met fixturedata; een ingevulde belmatrix levert zonder losse ritmeregel taken op.
7. Bijlage A, gat 20: een prospect zonder `laatste_contact_op` vuurt op SR03 met de aanmaakdatum als anker.
8. Bijlage A, gat 41: "Starterset terugzetten" laadt precies de werkende set van 23 regels, nooit regels zonder trigger.
9. Bijlage A, gat 43: in de belmatrix zijn "niet ingesteld" en "bewust uit (0)" zichtbaar verschillend en gedragen ze zich verschillend in de motor.
10. Bijlage A, gat 44: de afrekening van het ritme gebeurt per account; één stil A-account in een verder volle klasse staat als "achter" in de afrekening.
11. Bijlage A, gat 16: triggerpatronen, cadanswaarden, klassen en matrixstandaarden staan elk één keer in `shared/`; een zoekopdracht in de code vindt geen tweede definitie.
12. Een regel die meer dan 50 taken per persoon zou maken, vraagt bevestiging vóór opslaan.
13. Geen contacttaak voor een account in afkoeling op dat kanaal; geen tweede ritme op één account.
14. Een regel met minder dan 20 procent acceptatie over 30 dagen levert de eigenaar het inzicht "Regel levert vooral ruis" (databasevrije test met een fixturelog).
15. Excel-import van 2.001 rijen of een bestand boven 5 MB wordt geweigerd met een melding in gewone taal; een rij met een onbekende waarde geeft een fout op die rij.
16. Een kapotte matrixinstelling laat de motorrun slagen met de standaardwaarden en een waarschuwing in het runverslag.
17. Motorrun per organisatie met 600 accounts en 25 regels duurt onder 20 seconden zonder AI (13.4).
18. Cross-tenant in de wegwerp-Postgres: een regel en een run van organisatie A zijn onzichtbaar voor B; een founder in "Alleen meekijken" kan geen regel opslaan.
19. Per niveau getest: als Beginner opent `/instellingen/regels` de vergrendelde uitleg en geeft `GET /api/regels` 403 met reden `niveau`; als Gevorderd is alles alleen lezen en werkt de droogloop; als Expert kan hij een persoonlijke regel maken en een teamregel alleen voorstellen.
20. Telefoon (375, 390, 412 px): beide pagina's openen met "Beter op een groot scherm", zonder horizontale scroll; "Waarom krijg ik dit?" is in het taakvenster leesbaar en de link is een tikdoel van minimaal 44 px.
21. Testdata: de seed gebruikt Testbedrijf Voltvast (Bijlage C) met de klassen "A · Aantal monteurs (Prospects)" en verder; prospects voor de motortests zijn fictief. Niet vastgelegd in het bouwplan; voorstel: voeg 40 fictieve prospects toe in de branches br-01 tot en met br-04 met herkenbare testnamen ("Testprospect Woningbouw 01").

## Definition of Done

Hoofdstuk 19 geldt volledig. Specifiek voor deze prompt:

- Databasevrije suite voor de motor: elk triggerpatroon, elke afbakening, cadans, capaciteit, landing, droogloop en de complete starterset; wegwerp-Postgres voor migratie, RLS en de rechten per scope.
- `check:functies` groen voor de sleutels uit de tabel Functiecatalogus; de helpartikelen "Regels" en "Accountmatrix" staan in `content/help/`.
- Bijlage A, gat 6, 7, 8, 16, 20, 41, 43 en 44 afgevinkt in het sprintverslag.
- Handboek `docs/HOE-HET-WERKT.md` beschrijft de motorrun en de starterset.
