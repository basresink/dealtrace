# P10: Belblokken, belmodus en belscripts

| Onderdeel | Waarde |
|---|---|
| Sprint | 6 |
| Features | F07 Belblokken en belmodus, F08 Belscript-templates (met de verkoopverhaal-variabelen uit F25), bellen op de telefoon (8.5.4) |
| Hangt af van | P01 (fundament, functiecatalogus), P27 (mobiele schil), P02 (startset: 6 belscripts, 7 meetingsoorten), P03 (accounts, contacten, eigen velden, BAND), P05 (reis, fases, gebeurtenissen), P28 (leesmodel verkoopverhaal: kernzin, belofte, winpunten, concurrenten), P06 (motor), P07 (`rondTaakAf`, uitkomsten, hercontactritme), P08 (Bewaker, Planner, bundel), P32 (dagkern, belstapel op Vandaag) |
| Bron in het bouwplan | F07, F08, F25 (variabelen, bezwaren per concurrent, Per niveau), 8.5.4, 8.7, 8.9, 8.11, 8.16, 2.2, 5.1, 7.3, 11.4 (bundelsoort belscript), 11.5, 13.3 (flow 2 en 3), 13.4, 15.2 (bel-me-niet), ADR-014, Bijlage A (gat 16, 35, 36, 37) |

## Lees eerst

- `Bouwplan-Dealtrace.md`: 2.2, 3.2 (koppeling binnendienst en buitendienst), 4.3 (rijen F07 en F08), 5.1, 7.3, 8.3, 8.4, 8.5.4, 8.7, 8.9, 8.11, 8.12, 8.16, F06 (taakflyout), F07, F08, F09 (meetingsoorten, afspraak voor een collega), F25, 10.2, 11.2 tot en met 11.5, 12 (rijen Agenda en Telefonie), 13.3, 13.4, 15.2, 19, 22 (vraag 12), ADR-014, Bijlage A, Bijlage C (concurrenten C.6, winpunten C.7).
- DealDrive op commit 75bee61 (alleen lezen): `shared/belblokken.ts`, `server/utils/belblokVuller.ts` (met zijn regressietest van 11 gevallen), `app/composables/useBellijst.ts`, `app/composables/useBelblokken.ts`, `app/pages/belblokken.vue`, `server/utils/agentExecutor.ts` en `server/utils/promptBibliotheek.ts` (Pitstop-belscript als basis voor de AI-invulling), `app/composables/useEmailTemplates.ts` en `app/pages/instellingen/email-templates.vue` (patroon voor templatekeuze en variabelen), `app/components/ConfirmDialog.vue`, `app/components/EditableField.vue`; voor de telefoon `app/pages/dex/bellen.vue` en `app/pages/dex/gesprek.vue`, `shared/dexGesprek.ts`.

## Deel 1: Functioneel (wat en waarom)

### Wat je bouwt

Je bouwt belblokken (plannen, vullen, vaste blokken), de belmodus die gesprek na gesprek opent met een gekozen belscript, de beheerpagina voor belscript-templates met AI-invulling per account, en bellen op de telefoon met "Hoe ging het?".

### Waarom

Bellen wordt een vast tijdvak in plaats van iets wat tussendoor gebeurt; dit is het hoofdscherm van de binnendienst (F07). Templates geven beginners een bewezen opbouw, laten de salesmanager scripts vergelijken op resultaat en houden elk gesprek persoonlijk (F08, ADR-014). In DealDrive filterde de bellijst "vandaag" niet op vandaag, rekenden pagina en vuller verschillend, hing een taak aan een blok via "binnen een uur", stuurde de soort van een blok de vulling niet, verdrong opvolging de koude acquisitie en deden de vlaggen "agenda bezet" en "meldingen stil" niets (Bijlage A, gat 35, 36, 37).

### Gebruikers en niveaus

| Rol | Niveau | Wat |
|---|---|---|
| Binnendienst en buitendienst | Beginner | Bellijst met Top 5 en "Zelf kiezen", één knop "Zet in mijn agenda", de twee standaard vaste blokken, belmodus met standaardscript, uitkomst per gesprek; script kiezen in het belpaneel, volgen, antwoorden en bezwaren vastleggen; alleen actieve scripts van zijn team; op de telefoon belmodus en "Hoe ging het?" |
| Accountmanager | Gevorderd | Top 10 en 15, eigen vaste blokken, soort en plek per blok, script per blok, blokdetail met "Vul aan", herbelregel, eigen blokresultaat; persoonlijke variant van een script ("Mijn scripts"); conversie per script in de keuzelijst; handsfree belmodus en voorlezen van scripts op de telefoon |
| Accountmanager | Expert | "Vult zichzelf", verhouding new business en opvolging per blok, scriptvergelijking, statistiek per blok; eigen varianten vergelijken op resultaat; "Haal de top 5 bezwaren uit de verslagen"; telefonie-koppeling (later) |
| Salesmanager | Gevorderd of Expert | Geplande en gehouden blokken per teamlid, bereik en afspraken per blok; templates maken, testen, activeren voor teams, resultaten vergelijken |
| Beheerder | Expert | Alles van de salesmanager voor de hele organisatie, standaardkoppelingen instellen |
| Founder | n.v.t. | Platformsjablonen die elke nieuwe organisatie als startset krijgt |

### Schermen

**Belblokken** (`/belblokken`; ingangen: Vandaag "Start belblok", Prospectplanning "Plan in belblok", Campagnes "Verdeel over belblokken", Leadgenerator eerste poging). Van boven naar beneden:

1. Kop: kicker "WERK · BELLEN", titel "Een blok is een blok. Wie het vult, kies jij.", knoppen "+ Taak", "+ Afspraak".
2. Links **Vanuit de bellijst**, rechts **Belblok plannen** (geel omrand).
   - Bellijst: schakelaar "Top 5", "Top 10", "Top 15", "Zelf kiezen"; maximaal 15 rijen met rangnummer, account, contactpersoon (beslisser of champion eerst), reden ("poging 2 van 5 · vorige: voicemail" of "Aanleiding: nieuwe vestiging Zwolle"), geschatte duur, pil "Urgent", "Kans" of "Opvolging". De kop zegt eerlijk "Bellijst", geen "vandaag" als de lijst niet op vandaag filtert.
   - Planpaneel: "Advies uit je agenda" (maximaal vijf momenten, vrije gaten en vaste blokken, met externe agendabezetting als die gekoppeld is), "Niet tijdens de lunch" (tijd en duur instelbaar), eigen datum en tijd, plek ("Thuis", "Kantoor", "Onderweg (handsfree)"), rekenblok (gesprekstijd, marge, blok), doorschuifmelding ("4 in dit blok, 2 naar maandag 19 okt 09:00"), "Zet mijn agenda op bezet", "Onderdruk meldingen tijdens het blok", knop "Zet in mijn agenda" (geel).
3. **Vaste belblokken**: kaarten met moment ("Maandag en woensdag 09:00 tot 10:00"), soort ("Koude acquisitie", "Opvolging en ritme", "Gemengd 70/30"), plek, script, schakelaar "Vult zichzelf" of "Ik vul zelf", "Verwijderen", en een uitklapbaar blokdetail (gevulde plekken, vulbalk in minuten, gesprekken met reden, "Vul aan").

Lege bellijst: Niet vastgelegd in het bouwplan; voorstel: "Er staat niemand op je bellijst. De motor zet nieuwe belpogingen klaar zodra ze aan de beurt zijn."

**Belmodus** (schermvullend vanuit "Start belblok"). Links het **belscript**, midden de **gesprekskaart** (account, contact, nummer als bellink, aanleiding, laatste uitkomsten, BAND, eigen velden), rechts de **wachtrij** (volgende gesprekken, tijd die nog over is). Onderaan de uitkomstknoppen: "Gesproken, afspraak", "Gesproken, later", "Geen gehoor", "Voicemail ingesproken", "Poortwachter: terugbellen", "Doorverbonden, nieuw contact", "Verkeerd nummer", "Niet geschikt", "Geen interesse". Notitieveld per gesprek. Na het laatste gesprek of bij "Stop blok" het **blokresultaat**: gesprekken gevoerd, bereikt, beslisser bereikt, afspraken, terugbelafspraken, gemiddelde duur, tegen de schatting, met "Plan resterende in".

Drie knoppen uit F07 hebben geen code in 7.3. Niet vastgelegd in het bouwplan; voorstel: "Poortwachter: terugbellen" is `later` met een datum en de taak naar hetzelfde contact; "Verkeerd nummer" is `geen_reactie` zonder stap te verbruiken plus een taak "Nummer controleren" (de Verrijker kan het later aanvullen); "Geen gehoor" is `geen_reactie`.

**Belpaneel met script** (in de belmodus, in de taakflyout van een beltaak, in de bellijst naast bezoeken en op de accountkaart via "Bel"): bovenaan de keuzelijst "Script" met het voorgestelde script voorgeselecteerd; per script naam, doel en vanaf Gevorderd de conversie "28% naar afspraak". De blokken in vaste volgorde: Poortwachter, Opening, Aanleiding, Toestemmingsvraag, Vragen, Winpunt, Bezwaren, Afsluiting, Voicemail, Opvolgmail. Elke AI-zin heeft een bronlink; een variabele zonder waarde toont een gele markering "onbekend" met de terugvalzin. Vragen zijn afvinkbaar met een kort invulveld; bezwaren zijn aanklikbaar en klappen het antwoord uit.

**Belscripts in Instellingen** (`/instellingen/belscripts`):

1. Kop: kicker "INSTELLINGEN · VERKOOP", titel "Belscripts", subtitel "Standaardscripts die je team kiest in het belpaneel. AI vult per account de aanleiding en het winpunt in." Rechtsboven "+ Nieuw script" (geel) en "Kopieer uit startset".
2. Statkaarten, klikbaar als filter: "Actief", "Concept", "Gebruikt in 30 dagen", "Beste conversie".
3. Filters: Doel (Koude acquisitie, Opvolging, Aanleiding, Offerte nabellen, Winback, Afspraak bevestigen, Anders), Reisfase, Doelgroep, Team, Status (Concept, Actief, Gearchiveerd).
4. Tabel: "Naam", "Doel", "Reisfase", "Doelgroepen", "Teams", "Versie", "Status", "Gesprekken 30 d", "Naar afspraak", "Laatst gewijzigd". Rij klikken opent de editor.
5. Lege staat: "Er zijn nog geen belscripts. Begin met de startset van zes scripts." met "Kopieer uit startset".

**Editor** (flyout over de volle hoogte, 760 px): kop met naam (inline), pil met status en versie, "Voorbeeld", "Test met een account", "Laat AI een opzet maken". Blok "Eigenschappen": Naam (verplicht), Doel (verplicht), Reisfases, Doelgroepen (of "Alle"), Teams (of "Alle"), Rol van het contact (Beslisser, Beïnvloeder, Gebruiker, Receptie, Onbekend), Kanaal (Telefoon vast, Mobiel), Standaard voor (campagnesoorten en belblokken). Blok "Opbouw": blokken met sleepgreep, tekstveld met variabelenknop "{ }", keuze "Vast", "AI vult aan" of "AI schrijft", bij vragen een koppeling naar een veld (BAND of eigen veld), "+ Blok". Blok "Bezwaren": bezwaar, antwoord, wedervraag; "+ Bezwaar", "Haal de top 5 bezwaren uit de verslagen" (Expert en salesmanager). Rechterkolom "Voorbeeld" ingevuld voor een gekozen account uit de doelgroep. Onderin "Annuleren", "Opslaan als concept", "Activeer" (geel). "Archiveren" in het menu. Woordenteller met waarschuwing boven 200 woorden.

**Mijn scripts** (`/instellingen/mijn-scripts`, Gevorderd): persoonlijke varianten; bij een gewijzigd origineel "Het origineel is gewijzigd" met "Bekijk verschil" en "Neem over".

**Telefoon (390 px, 8.5.4).**

- `/bellen` (tab "Bellen" voor de buitendienst, 8.4) toont de bellijst van vandaag met per regel prioriteit, account, contact, reden en de knop "Bel 06 12 34 56 78" (`tel:`-link, mobiel nummer eerst).
- Na terugkeer in de app na een `tel:`-oproep verschijnt automatisch het venster **"Hoe ging het?"** met vier tegels: "Gesproken", "Niet bereikt", "Voicemail", "Terugbellen", en daaronder "Inspreken" voor een notitie. "Gesproken" vraagt daarna de uitkomst uit het belscript (afspraak, interesse, nee met reden, terugbellen op datum).
- De **belmodus** op de telefoon (tab "Belblok" voor de binnendienst) toont één prospect tegelijk: naam, functie, reden, de eerste regel van het gekozen script groot, en onderin "Bel", "Overslaan", "Volgende". Het volledige script schuift omhoog als je het nodig hebt; bezwaren zijn tikbare knoppen.
- **Handsfree** (Gevorderd): schakelaar "Handsfree"; Dealtrace leest naam, reden en opening voor, belt na "Bel" via de carkit, en vraagt na het gesprek met spraak "Hoe ging het?"; je antwoordt met "gesproken", "niet bereikt" of "terugbellen".
- De beheerpagina en de editor staan bewust niet op de telefoon: "Beter op een groot scherm" (8.12).

"Inspreken" en het gesproken antwoord in handsfree gebruiken de transcriptie van P31. Niet vastgelegd in het bouwplan hoe dit vóór P31 werkt; voorstel: "Inspreken" ontbreekt tot P31 (typen kan wel), en handsfree leest voor maar toont na het gesprek de vier tegels in plaats van te luisteren.

### Klikpaden

1. **Belblok starten.** "Start belblok" op Vandaag opent de belmodus met het eerste gesprek en het gekozen script.
2. **Gesprek met uitkomst.** Kies "Geen gehoor"; `rondTaakAf` rondt af, plant de volgende poging volgens het hercontactritme en opent het volgende gesprek binnen 300 ms.
3. **Afspraak maken.** "Gesproken, afspraak" opent het afspraakblok met meetingsoort, voorgestelde tijden (vrije momenten van de buitendienst in de regio als het een bezoek wordt) en de collega; de afspraak landt in de agenda van die collega met briefing ("Afspraak gemaakt door Sanne (binnendienst)"); gebeurtenis `eerste-afspraak-gepland` alleen bij de eerste niet-geannuleerde afspraak; status gescoord.
4. **Voicemail.** "Voicemail ingesproken": de voicemailtekst staat klaar; de opvolgmail wordt als concept klaargezet; de volgende stap is mail binnen 1 werkdag.
5. **Script wisselen.** Kies in de keuzelijst een ander script; het wisselen wordt gelogd met `gekozenDoor: 'gebruiker'`.
6. **Bezwaar.** Tik "Online is het goedkoper."; het antwoord uit "Als de klant zegt" klapt uit, het bezwaar telt, en de concurrent (bij Voltvast cc-02 Online webgroothandel) wordt als huidige leverancier op het account geregistreerd.
7. **Belblok plannen.** Kies Top 10, een advies uit je agenda, plek "Kantoor"; "Zet in mijn agenda"; doorschuifmelding toont wat niet past; toast "Belblok gepland voor donderdag 10:00. 8 gesprekken, 2 naar maandag." (Niet vastgelegd in het bouwplan; voorstel voor de tekst.)
8. **Script activeren.** In de editor "Activeer"; validatie; nieuwe versie actief; lopende belblokken houden hun versie tot het einde van het blok.
9. **Bellen op de telefoon** (2 tikken, 3 met scriptuitkomst): "Bel" (1), terug in de app een tegel in "Hoe ging het?" (2), bij "Gesproken" de uitkomst uit het script (3). Het contactmoment werkt direct `laatst_gebeld_op` en het ritme bij.

### Filters en sorteren

- Bellijst: Top 5, 10, 15 of "Zelf kiezen"; volgorde volgens de rangorde hieronder, overal gelijk.
- Belscripts: filters Doel, Reisfase, Doelgroep, Team, Status in de URL; sorteren op "Laatst gewijzigd" standaard.

### Regels

- **Rangorde** (één functie voor belblokken, bezoeken en de vuller): open beltaken eerst met `1000 + urgentie × 10 + prioriteit × 20 + score` (urgentie achterstallig 100, vandaag 80, later 50, zonder datum 40; prioriteit urgent 4, hoog 3, middel 2, laag 1); daarna aanvulling zonder beltaak `score + min(20, aanleidingen × 5) + min(15, open taken × 4) + 15 bij hete aanleiding of 5 bij waarschuwing`. Prospects zonder historie doen mee.
- **Soort stuurt de vulling**: "Koude acquisitie" vult uit prospects in reis met status nieuw of gekwalificeerd, prospectplanning (venster open, nog niet benaderd) en campagnes van soort bellen; "Opvolging en ritme" uit lopende hercontactpogingen en offerte-opvolging; "Gemengd" volgens de ingestelde verhouding.
- **Duur per gesprek**: 8 minuten, 12 bij urgent, plus 2 bij score 70 of meer, plus 2 bij meer dan één taak; na 20 gesprekken leert de schatting van de werkelijke gemiddelde duur van de gebruiker.
- **Marge** een kwart van de gesprekstijd, naar boven afgerond op 5 minuten; blokduur gesprekstijd plus marge naar boven afgerond op een half uur, minimaal 30 minuten.
- **Wat niet past** schuift naar het eerstvolgende vaste blok; zonder vast blok blijft het in de bellijst.
- **Vuller** (na elke motorrun, alleen werkdagen): vult vaste blokken met "Vult zichzelf" van vandaag die nog niet voorbij zijn; handmatig ingeplande taken blijven; nooit een tweede afspraak op hetzelfde blok; geen leeg blok; ruimte onder 8 minuten wordt overgeslagen.
- **Herbelregel**: na "Geen gehoor" volgt de poging volgens het hercontactritme van het account; zonder ritme na 2 werkdagen, maximaal 5 pogingen, daarna geparkeerd met terugkomdatum.
- **Bel-me-niet**: een nummer op de bel-me-niet-lijst of een contact met "Bel me niet" komt niet in de lijst; controle vóór elke bellijst (15.2).
- **Bezet en stil** werken echt: de afspraak staat als bezet in de gekoppelde agenda, en in-app meldingen worden tijdens het blok vastgehouden tot het einde.
- **Standaard vaste blokken** voor een nieuwe gebruiker: binnendienst maandag tot en met donderdag 09:00 tot 10:30 "Koude acquisitie" (vult zichzelf) en 14:00 tot 15:00 "Opvolging en ritme"; buitendienst vrijdag 09:00 tot 10:00 "Gemengd". Maximaal 20 blokken per gebruiker.
- **Scriptkeuze**: script van de campagne, script van het belblok, script dat past bij doel, reisfase, doelgroep en rol van het contact, persoonlijke variant van de gebruiker van dat script, startscript van de organisatie.
- **Scriptregels**: een actief script heeft minimaal een opening, een afsluiting en een voicemail; een winpunt of concurrent waarnaar verwezen wordt, bestaat en is actief, anders gaat het script op "Controleren" met een inzicht aan de eigenaar; richtlijn 150 woorden, waarschuwing boven 200; voicemail maximaal 25 seconden; vergelijken vraagt minimaal 30 gesprekken per versie of variant ("Te weinig gesprekken om te vergelijken"); varianten erven doel, fases en koppelingen.
- **Uit het verkoopverhaal** (F25, 11.5): variabelen `{verhaal.kernzin}`, `{verhaal.branche}`, `{visie.kernzin}`, `{belofte.branche}`, `{waarde}`, `{winpunt.naam}`, `{argument}`, `{bewijs.klant}`, `{concurrent.naam}`, `{concurrent.zoZegJeHet}`. De opening gebruikt de kernzin van de branche (terugval algemeen); "Waarom wij" de belofte; "Bezwaren" krijgt per concurrent een bezwaar uit "Als de klant zegt" met `argumentRef`. Alleen bevestigde versies; het gesprek bewaart de gebruikte versies.
- AI-invulling: één aanroep per gesprek, gecachet 24 uur per account en scriptversie; zonder bundel vaste tekst met terugvalzinnen.

### Helpartikelen

- "De belmodus", "Een belscript kiezen" (Dagelijks werk), "Belblokken" (Plannen en sturen), "Belscripts maken" (Inrichten).
- Leerpad Beginner "Een belblok uitvoeren met een script" volledig; leerpad Gevorderd "Je week plannen: belblokken en regiodagen" (deel belblokken) en "Bezwaren ombuigen"; leerpad Expert "Scripts testen en verbeteren".

## Deel 2: Technisch (hoe)

### Datamodel

- `users.data.belblokken { blokken: [{id, dagen[], start, minuten, plek, soort, verhouding?, scriptId?, automatisch}], voorkeuren {lunch {start, minuten}} }`, maximaal 20 blokken.
- `belblok_sessies: id, organisation_id, gebruiker_id, afspraak_id, gestart_op, gestopt_op, data {gesprekken[{taskId, accountId, contactId, uitkomst, duurSec, scriptId}], resultaat}`.
- `tasks.belblok_id` (kolom, 10.2) en `tasks.data.belblokId`: echte koppeling, geen "binnen een uur van de blokstart" (gat 35).
- `belscripts: id, organisation_id, naam, doel, status ('concept'|'actief'|'gearchiveerd'), versie, eigenaar_id, basis_script_id, is_persoonlijk, gebruiker_id, data` met `data` volgens F08 (reisfaseIds, doelgroepIds, teamIds, contactRollen, kanaal, standaardVoor, blokken met invulwijze, veldKoppeling en terugval, bezwaren met argumentRef, variabelen, opmerking).
- `belscript_versies: id, organisation_id, belscript_id, versie, data, geactiveerd_op, geactiveerd_door`.
- `activiteiten.data.script = { scriptId, versie, gekozenDoor: 'voorstel'|'gebruiker', gewisseld, blokkenGebruikt[], bezwaren[], vragenBeantwoord[] }` en `activiteiten.data.vv {versies, brancheId, winpuntId?, concurrentId?}`.
- Afgeleide tabel `nb_script_resultaten` (dagelijkse job) per script, versie en variant: gesprekken, bereikt, afspraken, gemiddelde duur, top bezwaren; `nb_bezwaren`.
- Bel-me-niet-lijst: Niet vastgelegd in het bouwplan in een tabel; voorstel: `bel_me_niet: organisation_id, nummer_hash, reden, op` plus `contacts.data.belMeNiet`.
- RLS `org_isolation` op alle tabellen. Rechtenmatrix (3.3): belscript-templates accountmanager lezen en kiezen, persoonlijke kopie als Gevorderd; salesmanager lezen, schrijven, activeren voor team; beheerder alles; founder platformsjablonen.
- Sync-allowlist: `belpoging.uitkomst` (via `rondTaakAf`), `belblok_sessies` (gesprek toevoegen, ook offline), veldwaarden uit scriptvragen met herkomst `belgesprek`.

### Pure functies

| Functie | Bestand | Randgevallen en unit-tests |
|---|---|---|
| `bouwBellijst(taken, accounts, soort, nu)` | `shared/belblokken.ts` | zelfde rangorde op pagina, belmodus en vuller; bel-me-niet uitgesloten; prospects zonder historie doen mee |
| `rangorde(kandidaat, nu)` | `shared/belblokken.ts` | achterstallig tegen vandaag; zonder datum; hete aanleiding |
| `schatDuur(taak, historie)` | `shared/belblokken.ts` | urgent 12; score 70; leren na 20 gesprekken |
| `marge(minuten)`, `blokduur(minuten)` | `shared/belblokken.ts` | afronden op 5 en op 30 minuten; minimaal 30 |
| `verdeelOverBlok(kandidaten, blok, volgendeBlokken)` | `shared/belblokken.ts` | wat niet past schuift; zonder vast blok blijft in de lijst |
| `adviesMomenten(agenda, blokken, nu)` | `shared/belblokken.ts` | maximaal vijf; lunch; weekend en feestdag |
| `vulBlok(soort, kandidaten, verhouding)` | `shared/belblokken.ts` | koud alleen koud (gat 36); gemengd 70/30 precies; ruimte onder 8 minuten overgeslagen |
| `uitkomstNaarCode(knop)` | `shared/belblokken.ts` | de negen knoppen en de vier tegels van "Hoe ging het?" naar de codes uit 7.3 (voorstel uit dit document) |
| `kiesScript(context, scripts, gebruiker)` | `shared/belscripts.ts` | volgorde van voorselectie; geeft `{scriptId, reden}`; Beginner zonder varianten |
| `vulScript(script, context)` | `shared/belscripts.ts` | variabelen vervangen, onbekende gemarkeerd met terugval; geen AI |
| `valideerScript(script)` | `shared/belscripts.ts` | verplichte blokken; onbekende variabele met naam; lengte; bestaande winpunten en concurrenten |
| `scriptVergelijking(resultaten, minimum = 30)` | `shared/belscripts.ts` | 29 en 30 gesprekken |

### Endpoints

| Methode en route | Recht | Doel en fouten |
|---|---|---|
| `GET\|PUT /api/mij/belblokken` | iedere gebruiker; eigen blokken vanaf Gevorderd | vaste blokken en voorkeuren; 422 boven 20 blokken |
| `POST /api/belblokken/plan` | iedere gebruiker | blok in de agenda met gevulde lijst; zet bezet en stil |
| `POST /api/belblokken/:id/start` | eigenaar | sessie starten; vooraf laden van de volgende gesprekken |
| `POST /api/belblokken/:id/gesprek` | eigenaar | `{taskId, uitkomst, ...}`; roept `rondTaakAf`; idempotent op `(taskId, stap)` |
| `POST /api/belblokken/:id/stop` | eigenaar | blokresultaat |
| `GET /api/belblokken/resultaten?gebruiker=&periode=` | eigen; salesmanager voor team | resultaten |
| `GET /api/belscripts` | iedere gebruiker (Beginner alleen actief en eigen team) | lijst met filters |
| `POST /api/belscripts`, `PUT /api/belscripts/:id` | salesmanager, beheerder; persoonlijk: eigenaar vanaf Gevorderd | 422 met de naam van de onbekende variabele |
| `POST /api/belscripts/:id/activeer` | salesmanager, beheerder | nieuwe versie; 422 bij validatiefout |
| `POST /api/belscripts/:id/kopie` | Gevorderd | persoonlijke variant |
| `POST /api/belscripts/:id/archiveer` | salesmanager, beheerder | |
| `POST /api/belscripts/invullen` | iedere gebruiker, binnen de bundel | AI-invulling `{scriptId, accountId, contactId}`; 429 bij bundel op met terugval |
| `POST /api/belscripts/opzet` | salesmanager, beheerder | AI-opzet als concept |
| `GET /api/belscripts/resultaten` | salesmanager; eigen varianten vanaf Expert | vergelijking |

### AI-stappen

| Stap | Agent en mandaat | Invoer | Schema | Vangrails |
|---|---|---|---|---|
| Invullen per account | Schrijver, A (concept) | script, account, contact, dossier, inzichten (laatste 90 dagen), winpunten, waarde, vorige uitkomsten, Pitstop-accent van de fase | `{ blokken: [{blokId, tekst, bronnen[{soort, url?, datum, citaat}]}], gekozenWinpuntId, argumentRef }` | alleen blokken met `ai_*`; elke zin met bron; geen feiten buiten het materiaal; maximaal 60 woorden per blok; cache 24 uur; winpunt via `kiesWinpunt` (wp-02 onder de norm niet als eerste, Bijlage C.9 geval 4) |
| Opzet maken | Schrijver | doel, doelgroep, reisfase, golden circle, winpunten, top bezwaren | volledig script, status concept | altijd concept; mens activeert; AI schrijft geen winpunten |
| Bezwaren ophalen | Schrijver | verslagen van de laatste 90 dagen in de doelgroep | `[{bezwaar, aantal, voorbeeldCitaat, antwoordVoorstel, argumentRef}]` | antwoord zonder `argumentRef` wordt "geen bron in de waarde"; namenfilter |

Elke stap via de Bewaker en de gemeenschappelijke AI-schil van P08; bundelsoort `belscript` (Starter 0, Plus en Compleet 3.000 per maand); mock met vaste fixtures en golden master.

### Integraties

- **Agenda** (bezet zetten, adviesmomenten, afspraak in de agenda van de buitendienst): de agendakoppeling komt in P13 (gat 37 noemt P10 en P13). Hier bouw je de aanroep via een adapterinterface met mock; zonder koppeling zet Dealtrace het blok in de eigen agenda en toont "Zet mijn agenda op bezet" de uitleg "Werkt zodra je agenda gekoppeld is".
- **Meldingen stil**: via de meldingswachtrij van F24 (P01), vastgehouden tot het einde van het blok.
- **Telefonie** (Voys, Aircall): optioneel, Expert, latere adapter (open vraag 12); nu alleen `tel:`-links.

### Functiecatalogus

Niet vastgelegd in het bouwplan; voorstel (niveaus uit 4.3 en 8.11):

| Sleutel | Niveau | Pakket | Recht | Helpartikel |
|---|---|---|---|---|
| `belblok.uitvoeren` | Beginner | Starter | iedereen | De belmodus |
| `belblok.plannen` | Gevorderd | Starter | iedereen | Belblokken |
| `belblok.automatisch` | Expert | Starter | iedereen | Belblokken |
| `belscript.kiezen` | Beginner | Starter | iedereen | Een belscript kiezen |
| `belscript.ai` | Beginner | Plus | iedereen | Een belscript kiezen |
| `belscript.variant` | Gevorderd | Starter | accountmanager | Een belscript kiezen |
| `belscript.vergelijken` | Expert | Plus | iedereen | Belscripts maken |
| `belscript.beheer` | Gevorderd | Starter | salesmanager | Belscripts maken |
| `bellen.handsfree` | Gevorderd | Starter | iedereen | De belmodus |

### Hergebruik uit DealDrive

- `shared/belblokken.ts`: tijden, lunch, standaardblokken, geldigheid; voeg rangorde, duur, marge, verdeling en `vulBlok` toe in hetzelfde bestand.
- `server/utils/belblokVuller.ts` met de regressietest van 11 gevallen: soort stuurt de vulling, echte koppeling `belblokId`.
- `useBellijst.ts`, `useBelblokken.ts`, `belblokken.vue`: pagina en lijst; voeg de belmodus en de eerlijke kop toe.
- `agentExecutor.ts`, `promptBibliotheek.ts`: Pitstop-belscript als basis voor de invulling per blok.
- `useEmailTemplates.ts`, `email-templates.vue`: patroon voor lijst, editor en variabelen.
- `dex/bellen.vue`, `dex/gesprek.vue`, `shared/dexGesprek.ts`: bediening op de telefoon.

### Buiten scope

- Spraakherkenning die automatisch het volgende blok kiest; automatisch bellen (dialer); scripts in meerdere talen tegelijk (F08).
- Agendakoppeling zelf (P13); meetingsoorten beheren (P13); bellijst naast bezoeken (P14); verzenden van de opvolgmail (P18); transcriptie van "Inspreken" (P31); campagnes "Verdeel over belblokken" (P16).

## Acceptatiecriteria

1. Een binnendienstmedewerker belt een blok van tien prospects met een gekozen script (sprint 6 "klaar als").
2. Bijlage A, gat 35: de kop van de bellijst zegt "Bellijst" tenzij hij op vandaag filtert; pagina, belmodus en vuller gebruiken dezelfde `rangorde` (één test met dezelfde fixture); een taak hangt via `belblok_id` aan een blok.
3. Bijlage A, gat 36: een koud blok wordt alleen met koude kandidaten gevuld; een gemengd blok 70/30 houdt de verhouding; opvolging verdringt nooit koude acquisitie.
4. Bijlage A, gat 37: "Onderdruk meldingen tijdens het blok" houdt in-app meldingen vast tot het einde en levert ze daarna af; "Zet mijn agenda op bezet" roept de agenda-adapter aan (mock in deze prompt, echt in P13).
5. Bijlage A, gat 16: rangorde, duur, marge en uitkomstcodes staan één keer in `shared/`.
6. Een uitkomst in de belmodus geeft dezelfde vervolgpoging als in de taakflyout; het blokresultaat telt bereik en afspraken correct; een bel-me-niet-nummer verschijnt nooit.
7. Belmodus: het volgende gesprek opent binnen 300 ms (vooraf geladen, 13.4).
8. Een beheerder maakt een script met vijf blokken en twee bezwaren, activeert het, en een accountmanager in het gekoppelde team ziet het voorgeselecteerd in een belblok van die doelgroep.
9. Een onbekende variabele blokkeert opslaan met de melding welke variabele het is.
10. Een gesprek logt scriptId en versie; de rapportage telt het in de juiste versie; een nieuwe versie activeren tijdens een lopend blok verandert het script in dat blok niet.
11. Zonder AI-sleutel (mock) en zonder bundel (Starter) werkt het script met de vaste teksten en terugvalzinnen.
12. Vergelijken onder 30 gesprekken toont "Te weinig gesprekken om te vergelijken".
13. Verkoopverhaal met de Voltvast-seed: een prospect in br-01 met huidige leverancier cc-02 krijgt in het script de kernzin, de belofte van br-01, winpunt wp-01 en het bezwaar "Online is het goedkoper." met antwoord (Bijlage C.9 geval 2); een prospect in br-03 valt terug op het algemene verhaal met melding (geval 1); wp-02 komt niet als eerste winpunt (geval 4); een contactnaam uit aantekeningen komt niet in de AI-aanroep (geval 9).
14. Telefoon, tikdoelen uit 8.7: een prospect bellen en de uitkomst vastleggen kost hooguit 2 tikken, 3 met de scriptuitkomst; "Hoe ging het?" verschijnt automatisch na terugkeer uit een `tel:`-oproep; elke regel op `/bellen` heeft een belknop van minimaal 44 px binnen duimbereik (8.16).
15. Telefoon offline: een uitkomst na bellen slaagt zonder verbinding met zichtbare status en komt na herstel precies één keer aan.
16. Handsfree (Gevorderd) leest naam, reden en opening voor in `nl-NL`; een Beginner ziet de schakelaar als vergrendelde knop met uitleg.
17. Per niveau getest: Beginner ziet Top 5 en "Zelf kiezen", de standaard vaste blokken, alleen actieve scripts van zijn team en geen knop "Maak persoonlijke variant"; Gevorderd ziet Top 10 en 15, eigen blokken, "Mijn scripts" en conversie in de keuzelijst; Expert ziet "Vult zichzelf", verhouding en scriptvergelijking; de variant toont "Het origineel is gewijzigd" na een nieuwe versie van het origineel.
18. Cross-tenant: scripts, sessies en resultaten van organisatie A zijn onzichtbaar voor B.

## Definition of Done

Hoofdstuk 19 geldt volledig. Specifiek voor deze prompt:

- Unit-tests voor alle functies in `shared/belblokken.ts` en `shared/belscripts.ts`; de regressietest van 11 gevallen uit `belblokVuller.ts` overgenomen en uitgebreid voor soort en verhouding.
- Golden masters voor invullen, opzet en bezwaren; elke AI-stap via de Bewaker.
- Playwright desktop voor `/belblokken`, de belmodus en `/instellingen/belscripts`; telefoon (375, 390, 412 px) voor `/bellen`, de belmodus en "Hoe ging het?", inclusief tikkentest en offline-test; getest op de toestellen uit 8.15.
- Bijlage A, gat 16, 35, 36 en 37 (deel P10) afgevinkt; helpartikelen in `content/help/`.
