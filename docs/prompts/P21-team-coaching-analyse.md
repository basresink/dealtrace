# P21: Team, coaching, analyse

| Onderdeel | Waarde |
|---|---|
| Sprint | 11 (Sturen en maatwerk) |
| Features | F20 Salesmanager: controle, analyse en coaching; Coach-agent (11.3); "Mijn resultaten" voor de accountmanager; telefoonweergave voor de salesmanager (8.12) |
| Hangt af van | P01 (teams, rechten, functiecatalogus), P05 (reis en reisgeschiedenis), P06 (motor, `ritmeAfrekening`), P07 (taken, inzichten, uitkomsten), P08 (Bewaker, bundel), P09 (helpartikelen en groeipad met `niveauVoorstel`), P10 (belscripts en `belblok_sessies`), P12 (hercontactritme en terugkomregels), P13 (meetingsoorten, interne meeting), P16 (campagnes), P17 (deals, offertes, verlorenredenen), P18 (concepten en overname), P19 (agents en blokkades), P28 (leesmodel, branches, winpunten, ambitiedoelen), P32 (mobiele schil en onderbalk salesmanager) |
| Bron in het bouwplan | F20; 8.12; 8.4 (onderbalk salesmanager); 5.3 (dag en week van de salesmanager); 3.2 en 3.3 (teams, rechten coachingnotities); 4.4 (groeipad); 10.2 (afgeleide tabellen); 11.3 en 11.4 (Coach, bundel); 16.1 tot en met 16.3 (KPI's); F25 (normen en rapporten); Bijlage A regel 44 |

## Lees eerst

- Bouwplan-Dealtrace.md: F20 volledig, 8.12, 8.4, 5.3, 3.2, 3.3 (rij Coachingnotities en de alinea over `eigen` en teams), 4.4 en 4.5, 10.1 (afgeleide tabellen herberekenbaar), 10.2 (rij Afgeleid en Coaching), 11.3 (Coach), 11.4 (bundel Coach en verbetervoorstel), hoofdstuk 16, F05 (verbetervoorstel, versies vergelijken), F21 (artikelen voor de salesmanager en de new business-academie), F25 "Per niveau" en de normen in F20 "Uit het verkoopverhaal", Bijlage A regel 44.
- DealDrive op commit 75bee61:
  - `app/pages/team.vue`, `app/pages/team-dashboard.vue`, `app/pages/team-weekrapport.vue`, `app/composables/useTeamPrestaties.ts`, `app/composables/useTeamBlokbeeld.ts`
  - `shared/dexCoaching.ts` (de pure kant van de coach: onderdelen, `herkenBron`, `heeftGrond`) en `server/utils/dexCoach.ts`
  - `app/pages/dex/team.vue` (teamweergave op de telefoon)
  - `app/pages/account-analyse.vue`, `app/pages/bezoek-analyse.vue` (analysepatronen)
  - `shared/ritmematrix.ts` en `server/db/e2e-coach.ts`

## Deel 1: Functioneel (wat en waarom)

### Wat je bouwt

Het managerdeel van Dealtrace (Team, Coaching, Analyse, Audit) met de Coach-agent, plus "Mijn resultaten" voor de accountmanager en de telefoonweergave voor de salesmanager.

### Waarom

De salesmanager is in Dealtrace geen meekijker maar een volwaardige gebruiker met drie taken: controleren (gebeurt wat we afspraken?), analyseren (wat werkt, wat niet, waarom?) en coachen (hoe help ik deze persoon beter te worden?). DealDrive had losse rapportages; Dealtrace bouwt er een samenhangend geheel van met cijfers die uit de activiteitenlog komen en herleidbaar zijn. De afrekening van het ritme per klasse maskeerde in DealDrive stille accounts (Bijlage A regel 44); hier rekent alles per account.

### Gebruikers en niveaus

| Rol | Niveau | Wat |
|---|---|---|
| accountmanager | Beginner | "Mijn resultaten": eigen resultaten en doelen; zijn afspraken uit coachingsgesprekken lezen en erop reageren |
| accountmanager | Gevorderd | Plus eigen trend en vergelijking met het teamgemiddelde (zonder namen van collega's) |
| accountmanager | Expert | Plus zelfanalyse door de Coach: "Wat kan ik deze week beter doen?" |
| salesmanager | Gevorderd of Expert | Team, Coaching, Analyse en Audit voor de eigen teams; goedkeuringen; coachingnotities lezen en schrijven voor het team |
| beheerder | Expert | Alle teams; coachingnotities lezen (3.3) |
| founder | n.v.t. | Geen toegang tot coachingnotities (3.3) |

### Schermen

**1. Team** (`/team`, controle, dagelijks 10 minuten)

1. Kop: kicker "Team Binnendienst Noord · week 42", titel als zin over de stand ("Vier van de vijf liggen op schema."). Keuze team en periode ("Vandaag", "Deze week", "Deze maand", "Kwartaal").
2. **Tabel per persoon**: naam met niveau en werkplek, taken op de dag afgerond (procent), achterstallig, pogingen (gedaan tegen norm), gesprekken en beslisser bereikt, afspraken (tegen doel), koude norm ("koud 3 van 5"), belblokken gepland en gehouden, bezoeken en kansen langs de route omgezet, concepten die wachten op goedkeuring, tempo-pil. Klik op een cel opent de onderliggende lijst.
3. **Aandachtspunten** (maximaal vijf, uitgerekend): "Mark stopt gemiddeld na 2,1 pogingen (team 4,3)", "Sanne heeft 14 taken achterstallig", "3 campagnes lopen achter", "6 geparkeerde accounts komen deze week terug", "Eva heeft deze week geen belblok gehouden".
4. **Werkverdeling**: accounts per persoon per fase en status, met "Verplaats" (bulk, met reden en audit).
5. **Goedkeuringen**: campagnes boven capaciteit, conceptversies van reizen en scripts, niveauvoorstellen, roadmapwensen van het team.

Lege staat (geen team): "Je bent nog geen eigenaar van een team. Vraag je beheerder om je aan een team te koppelen." (tekst niet vastgelegd; voorstel).

**2. Coaching** (`/coaching` en `/coaching/:gebruiker`, wekelijks per persoon)

`/coaching` toont de teamleden met datum van het laatste gesprek en open afspraken (overzicht niet vastgelegd in het bouwplan; voorstel). De **coachingkaart** (`/coaching/:gebruiker`) van boven naar beneden:

1. Kop met naam, niveau, werkplek, voortgang naar het volgende niveau (de criteria uit 4.4 als balkjes).
2. **Cijfers tegen norm en team** (laatste 4 weken met trend): activiteit (pogingen per dag, belblokken), bereik (gesproken, beslisser bereikt), conversie (gesprek naar afspraak, afspraak naar offerte, offerte naar klant), discipline (pogingen tot afspraak, taken op de dag, winpunt uitgevoerd, briefing geopend vóór gesprek), kwaliteit (AI-concept ongewijzigd of aangepast, doel gehaald per gesprek).
3. **Trechter van deze persoon** naast die van het team: waar valt het weg?
4. **Gesprekken om te bespreken**: de Coach kiest drie gesprekken of bezoeken van de afgelopen week (een goede, een verloren, een met een bezwaar dat vaker terugkomt) met verslag, uitkomst en script; de manager kan zelf kiezen.
5. **Coachingpunten**: maximaal drie, uitgerekend en door de Coach voorgesteld met onderbouwing ("Bij koude acquisitie sluit je 2 van de 10 gesprekken met een afspraak; het team 4 van de 10. In 6 gesprekken werd het afsluitblok van het script niet gebruikt."), elk met een gekoppeld helpartikel uit de new business-academie (F21). Knop "Deel" per punt.
6. **Afspraken**: doel, gedrag, termijn, vastgelegd als coachingnotitie van soort "Afspraak" met datum; de accountmanager ziet ze en kan reageren. Notities van soort "Privé" alleen voor managers van dat team.
7. **Historie**: eerdere sessies en of de afspraken gehaald zijn.
8. Na een nieuwe bevestigde versie van het verkoopverhaal: de oefening "Vertel ons verhaal in twee minuten" (F25).
9. Knop "Plan coachingsgesprek": maakt een interne meeting (meetingsoort intern) met de kaart als agenda.

**3. Analyse** (`/analyse`, maandelijks en per kwartaal), tabbladen:

| Tabblad | Inhoud |
|---|---|
| Trechter | per doelgroep en reis: accounts per fase, conversie tussen fases, doorlooptijd per fase, waar het stokt; forecast nieuwe klanten dit kwartaal uit conversie en capaciteit |
| Activiteit | pogingen, gesprekken, afspraken per kanaal en per persoon; afspraken per poging |
| Campagnes | per campagne en soort: bereik, afspraken, conversie, kosten per afspraak; vergelijken binnen dezelfde soort |
| Scripts | per belscript en versie: gesprekken, afspraken, duur, top bezwaren (minimaal 30 gesprekken) |
| Regels en agents | per regel acceptatie en opbrengst; per agent overname van concepten, blokkades per reden, kosten |
| Reizen | per reisversie conversie per fase (minimaal 20 accounts per versie); het maandelijkse verbetervoorstel van de Coach met "Accepteer", "Wijs af", "Later" |
| Bronnen | per leadbron (AI-zoeker, KvK, Datacollectief, import, CRM): leads, overgenomen, afspraken, klanten, kosten per klant |
| Regio | dekking en potentie per gebied (F18, `/analyse/regio` uit P14) |
| Prospectmix | afgesproken verdeling koud, warm, referral, winback tegen werkelijk, per persoon, met campagnevoorstel bij achterstand |

Uit het verkoopverhaal (F25): norm "Nieuwe gesprekken in primair of hoog" (gezond twee derde of meer, aandacht de helft tot twee derde, risico minder dan de helft); "Winpunt uitgevoerd" tegen norm 90 procent; rapport "Verloren aan" en "Gewonnen van" per concurrent en branche; ambitiedoelen als voortgangsbalk. Niet vastgelegd in welk tabblad deze rapporten staan; voorstel: "Verloren aan" en "Gewonnen van" onder Trechter, de branchenorm en de ambitiedoelen onder Prospectmix.

Elke grafiek is klikbaar naar de onderliggende lijst; elk tabblad heeft "Download CSV". Onder het minimum staat "Te weinig om te vergelijken".

**4. Audit** (`/audit`): wie veranderde wat (fase handmatig, eigenaar, niveau, regels, scripts, reizen, verwijderingen, instappen van de leverancier), met filters op persoon, soort en periode.

**5. Mijn resultaten** (`/resultaten`, iedereen): dezelfde cijfers als op de eigen coachingkaart, zonder namen van collega's (wel het teamgemiddelde vanaf Gevorderd), de afspraken uit coachingsgesprekken met "Reageer", en vanaf Expert de knop "Wat kan ik deze week beter doen?".

**6. Telefoonweergave op 390 px (8.12 en 8.4)**

- Onderbalk salesmanager zonder eigen portefeuille: Team `/team`, Coaching `/coaching`, Acties `/acties`, Prospects `/prospects`, Meer.
- Team op de telefoon: drie stapels met de handeling in de regel: "Gesprekken zonder verslag" (per persoon met aantal), "Deals zonder vervolg", "Achter op het ritme"; daaronder de aandachtspunten en "Wacht op jouw goedkeuring" (concepten en goedkeuringen van het team). De tabel per persoon wordt een lijst met per persoon één regel (naam, tempo-pil, achterstallig) die een schuifvenster met de cijfers opent. Opbouw niet vastgelegd in het bouwplan behalve de inhoud uit 8.12; voorstel zoals hier.
- Coachingkaart op de telefoon: geschikt om voor te bereiden en tijdens een rit naast een verkoper te gebruiken; volgorde: kop met niveau, coachingpunten, afspraken (met "+ Afspraak"), cijfers (ingeklapt), gesprekken om te bespreken. Voorlezen van de coachingpunten met "Lees voor" is niet vastgelegd; voorstel: niet in deze prompt.
- Analyse: alleen lezen, grafieken schermbreed onder elkaar, filters verborgen achter "Open op laptop".
- Audit: lijst met filters in een schuifvenster.
- Mijn resultaten: cijferkaarten onder elkaar; vergelijking als balk met de teamstreep.

### Klikpaden

1. **Dagelijkse controle.** Salesmanager opent `/team` met periode "Vandaag", ziet "Sanne heeft 14 taken achterstallig", klikt de cel achterstallig van Sanne: de takenlijst opent gefilterd op Sanne en achterstallig.
2. **Werk verplaatsen.** In Werkverdeling selecteert hij 12 accounts van Mark in fase Gekwalificeerd, klikt "Verplaats", kiest Eva en de reden "Verlof"; audit en toast.
3. **Coachingsgesprek voorbereiden.** Op `/coaching/:gebruiker` leest hij de cijfers, bekijkt de drie gekozen gesprekken, past een coachingpunt aan en klikt "Deel"; pas dan ziet de accountmanager het punt.
4. **Afspraak vastleggen.** "+ Afspraak": tekst, termijn; opslaan als coachingnotitie "Afspraak". De accountmanager krijgt de melding "Coachingafspraak gedeeld" (F24) en ziet hem in Mijn resultaten.
5. **Gesprek plannen.** "Plan coachingsgesprek" maakt een interne meeting met de kaart als agenda.
6. **Verbetervoorstel.** In Analyse, Reizen kiest hij "Accepteer" bij het voorstel van de Coach: er ontstaat een conceptversie van de reis (P22) met het voorstel erin; "Later" laat het voorstel 30 dagen staan (termijn niet vastgelegd; voorstel).
7. **Niveauvoorstel.** In Goedkeuringen "Sanne is klaar voor Gevorderd" met de cijfers; "Verhoog niveau" of "Nog niet" met reden (4.4).
8. **Zelfanalyse.** Een Expert-accountmanager klikt in Mijn resultaten "Wat kan ik deze week beter doen?"; de Coach geeft maximaal drie punten met onderbouwing en artikel.

### Filters en sorteren

- Team: team, periode (Vandaag, Deze week, Deze maand, Kwartaal); sorteren op elke kolom; standaard sortering niet vastgelegd, voorstel: tempo-pil (achter eerst).
- Analyse: per tabblad doelgroep, reis, team, persoon, periode, kanaal; alle filters in de URL.
- Audit: persoon, soort, periode.

### Regels

- Elk cijfer komt uit de activiteitenlog en is herleidbaar naar records; geen handmatig ingevoerde KPI's.
- Een vergelijking toont altijd het aantal waarop hij rust; onder de minimumaantallen (30 gesprekken per script, 20 accounts per reisversie) staat "Te weinig om te vergelijken".
- Coachingnotities: "Afspraak" (zichtbaar voor de accountmanager) en "Privé" (alleen managers van dat team).
- De Coach stelt voor, de manager beslist; een coachingpunt verschijnt nooit bij de accountmanager zonder "Deel".
- De salesmanager ziet alleen zijn teams, server-side afgedwongen; een beheerder ziet alles.
- Afrekening van het ritme per account, niet als som per klasse, met hetzelfde kanaal dat de motor voorschrijft (F16, regel 44).
- Normen uit hoofdstuk 16, onder meer: pogingen tot afspraak gemiddeld 4 tot 5, conversie gesprek naar afspraak boven 15 procent, beslisser bereikt boven 20 procent, teamleden op tempo boven 70 procent, één coachingsgesprek per accountmanager per twee weken, coachingafspraken gehaald boven 60 procent.
- Tempo-pil per persoon: niet vastgelegd in het bouwplan hoe die wordt berekend; voorstel: pogingen gedaan tegen norm in de periode, "Op schema" vanaf 90 procent, "Achter op schema" daaronder.

### Helpartikelen

Categorie "Voor de salesmanager": "Team controleren", "Coachingsgesprek voorbereiden", "Analyse lezen", "Verbetervoorstellen beoordelen". Voor de accountmanager in de academie: "Je cijfers lezen" en "Feedback vragen aan je salesmanager" (categorie Jezelf verbeteren), plus "Je cijfers lezen en verbeteren" in het leerpad Expert.

## Deel 2: Technisch (hoe)

### Datamodel

- `coaching_sessies: id, organisation_id, gebruiker_id, manager_id, datum, data {cijfers (momentopname), punten[{tekst, onderbouwing, artikelId?, gedeeld?}], afspraken[{tekst, termijn, status}], gesprekken[activiteitIds], reactie?}`. Het veld `gedeeld` per punt staat niet in het bouwplan; voorstel, nodig voor "Deel".
- `coaching_notities: id, organisation_id, gebruiker_id, manager_id, soort ('afspraak'|'prive'), tekst, op`.
- Afgeleide tabellen (dagelijkse job, herberekenbaar): `nb_kpi_dag (organisation_id, gebruiker_id, datum, metriek, waarde)`, `nb_conversies`, `nb_script_resultaten`, `nb_regel_resultaten`; wekelijks `nb_bezwaren`; ook `nb_prospectmix_stand`, `nb_branche_stand`, `nb_winpunt_resultaten`, `nb_concurrent_resultaten`, `nb_terugkom_resultaten` (F25) als die nog niet bestaan.
- Verbetervoorstel: niet vastgelegd waar het staat; voorstel `signals` met `type = 'verbetervoorstel'`, `data {reisId, versie, voorstel, onderbouwing}` en status nieuw, geaccepteerd, afgewezen, later.
- RLS `org_isolation` op alle nieuwe tabellen; daarnaast server-side filter op de teams van de salesmanager (`teams.manager_ids`).
- Rechtenmatrix (3.3): Coachingnotities accountmanager eigen notities lezen (alleen soort afspraak), salesmanager lezen en schrijven voor team, beheerder lezen, founder geen. Activiteitenlog salesmanager lezen.
- Sync-allowlist: `coaching_notities` (soort afspraak) voor de accountmanager in zijn dagpakket; `coaching_sessies` en de afgeleide tabellen niet via de sync.

### Pure functies

| Functie | Invoer | Uitvoer | Randgevallen en tests |
|---|---|---|---|
| `kpi(gebruiker, periode, activiteiten)` | gebruiker, periode, activiteiten | metrieken met noemer | lege periode; feestdagen niet als werkdag (`shared/datum.ts`); intern overleg telt niet als klantcontact |
| `trechter(accounts, reisgeschiedenis, periode)` | accounts, geschiedenis | aantallen per fase, conversie, doorlooptijd | account dat terugspringt; fasemapping na een nieuwe versie |
| `aandachtspunten(team, kpis, normen)` | team, kpi's, normen | maximaal vijf punten met cijfers | minder dan vijf; gelijke ernst, vaste volgorde |
| `coachVoorstel(kpis, team, verslagen)` | zie AI-stappen | maximaal drie punten | geen verslagen; onder minimum geen vergelijking |
| `ritmeAfrekening(accounts, activiteiten, periode)` | per account | achterstand per account | stil account in een klasse die gemiddeld op schema ligt moet zichtbaar zijn (regel 44) |
| `genoegOmTeVergelijken(n, soort)` | aantal, soort | boolean met melding | 29 en 30 gesprekken; 19 en 20 accounts |

`kpi`, `trechter`, `aandachtspunten` en `coachVoorstel` zijn vastgelegd in F20; `ritmeAfrekening` in F16; `genoegOmTeVergelijken` is een voorstel.

### Endpoints

| Methode en route | Recht | Invoer | Uitvoer | Fouten |
|---|---|---|---|---|
| `GET /api/team?team=&periode=` | salesmanager (eigen teams), beheerder | team, periode | tabel, aandachtspunten, werkverdeling, goedkeuringen | 403 bij een ander team |
| `GET /api/coaching/:gebruiker` | salesmanager van het team | geen | kaart met cijfers, gesprekken, punten, afspraken, historie | 403 buiten het team |
| `POST /api/coaching/:gebruiker/sessie` | salesmanager | `{datum}` | sessie | 422 zonder datum |
| `PUT /api/coaching/sessie/:id` | salesmanager | punten, afspraken, gedeeld | sessie | privénotitie nooit in de respons voor de accountmanager |
| `GET /api/analyse/:tabblad?filters` | salesmanager; Regio ook accountmanager voor eigen accounts | filters | reeksen met aantallen | "Te weinig om te vergelijken" als vlag |
| `GET /api/resultaten/mij` | iedereen | `?periode=` | eigen cijfers, teamgemiddelde vanaf Gevorderd, afspraken | geen namen van collega's |
| `POST /api/accounts/verplaats` | salesmanager | `{accountIds, naarGebruiker, reden}` | aantal | niet vastgelegd welke route; voorstel; 422 zonder reden |
| `POST /api/coaching/zelfanalyse` | Expert | geen | maximaal drie punten | niet vastgelegd; voorstel; 429 als de bundel op is |

CSV-export per tabblad: `GET /api/analyse/:tabblad?formaat=csv` (voorstel) met precies de getoonde rijen.

### AI-stappen

- **Agent** Coach, mandaat A voor voorstellen; de manager beslist (11.3).
- **Materiaal**: activiteitenlog, conversies, verslagen van de laatste week, scriptgebruik per blok, helpartikelen van de academie (sleutels).
- **Schema** `coachVoorstel`: `{punten[{tekst, onderbouwing {cijfers[], bron}, artikelSleutel}]}`, maximaal drie; `additionalProperties false`. Een punt zonder cijfers of zonder bestaande artikelsleutel wordt geschrapt (neem `heeftGrond` en `herkenBron` uit `shared/dexCoaching.ts` over).
- **Vangrails**: namen van klanten en contactpersonen in vrije tekst gefilterd; geen vergelijking onder het minimum; geen privénotities in het materiaal.
- **Mock**: vaste fixtures uit de startset Voltvast (Bijlage C) met fictieve teamleden van "Binnendienst" en "Team Noord".
- **Bundelsoort**: "Coach en verbetervoorstel", Claude Opus, 0 / 50 / 50 per maand (11.4). Het maandelijkse verbetervoorstel per doelgroep draait in de maandjob (`netlify/functions/maand`).

### Integraties

Geen externe integraties. De agenda-koppeling (P13) schrijft de interne meeting weg als de gebruiker die heeft.

### Functiecatalogus

Niet vastgelegd in het bouwplan welke sleutels; voorstel:

| Sleutel | Niveau | Pakket | Recht | Helpartikel |
|---|---|---|---|---|
| `resultaten.eigen` | Beginner | Starter | eigen | Je cijfers lezen |
| `resultaten.trend` | Gevorderd | Starter | eigen | Je cijfers lezen |
| `resultaten.zelfanalyse` | Expert | Plus (bundel Coach) | eigen | Je cijfers lezen en verbeteren |
| `team.controle` | Gevorderd | Starter | salesmanager | Team controleren |
| `coaching.kaart` | Gevorderd | Starter | salesmanager | Coachingsgesprek voorbereiden |
| `coaching.coachVoorstel` | Gevorderd | Plus | salesmanager | Coachingsgesprek voorbereiden |
| `analyse` | Gevorderd | Starter | salesmanager | Analyse lezen |
| `analyse.verbetervoorstel` | Gevorderd | Plus | salesmanager | Verbetervoorstellen beoordelen |
| `audit` | Gevorderd | Starter | salesmanager | Team controleren |

De salesmanager is minimaal Gevorderd (4.1), dus het niveau Gevorderd is de ondergrens voor het managerdeel.

### Hergebruik uit DealDrive

- `team.vue`, `useTeamPrestaties.ts`, `useTeamBlokbeeld.ts`: basis voor de teamtabel; rekenwerk naar de pure functies hierboven, niet in de pagina.
- `team-weekrapport.vue`: patroon voor de vooraf gevulde agenda van het weekoverleg (5.3).
- `shared/dexCoaching.ts` en `server/utils/dexCoach.ts`: de knip tussen pure regels en de betaalde aanroep; vervang de vijf gespreksonderdelen door de coachingpunten van F20.
- `app/pages/dex/team.vue`: basis voor Team op de telefoon, nu in dezelfde app (ADR-020).

### Buiten scope

Opnames van gesprekken (meeluisteren is lezen van verslagen en Pitstop-concepten), handmatig ingevoerde KPI's, de reiseditor zelf (P22), de regio-analyse zelf (P14), de suggesties naar SalesDNA (P23; Team toont alleen de goedkeuring als P23 hem levert).

## Acceptatiecriteria

1. Bijlage A regel 44: de ritmeafrekening rekent per account; een stil account in een klasse die als geheel op schema ligt, verschijnt als achterstand.
2. De teamtabel klopt met de onderliggende lijsten: elke cel opent een lijst met precies dat aantal records.
3. Een coachingpunt is pas zichtbaar voor de accountmanager na "Deel"; een privénotitie komt in geen enkele respons voor de accountmanager voor (wegwerp-Postgres).
4. Een vergelijking onder het minimum toont "Te weinig om te vergelijken" (29 gesprekken per script, 19 accounts per reisversie).
5. CSV-export bevat precies de getoonde rijen.
6. Een salesmanager van Team Noord krijgt 403 op `/api/team?team=<Team Zuid>`; een beheerder niet.
7. De Coach geeft hoogstens drie punten, elk met cijfers en een bestaand artikel; zonder bundel verschijnt de melding en blijft de kaart bruikbaar met de berekende cijfers.
8. Aandachtspunten tonen er hoogstens vijf.
9. "Verplaats" vraagt een reden en schrijft een auditregel per account; de audit toont de wijziging met filters op persoon, soort en periode.
10. Mijn resultaten toont geen namen van collega's; vanaf Gevorderd het teamgemiddelde.
11. Niveau Beginner: `/resultaten` met eigen cijfers en afspraken, geen trend en geen vergelijking (blok "Bij Gevorderd" als lege staat onderaan, 4.5).
12. Niveau Gevorderd: trend en vergelijking met het teamgemiddelde; de zelfanalyse staat met slot en uitleg.
13. Niveau Expert: "Wat kan ik deze week beter doen?" geeft punten; een salesmanager op niveau Gevorderd heeft volledig Team, Coaching, Analyse en Audit.
14. Telefoon (375, 390, 412 px): de onderbalk van de salesmanager toont Team, Coaching, Acties, Prospects, Meer en licht op elke pagina eenduidig op; Team toont gesprekken zonder verslag, deals zonder vervolg en achterstand op het ritme zonder horizontale scroll; de coachingkaart is met één duim te gebruiken (tikdoelen minimaal 44 px); Analyse is alleen lezen met "Open op laptop".
15. Een afspraak die de manager tijdens een rit op de telefoon vastlegt, staat offline in de wachtrij en komt na herstel precies één keer aan.
16. De afgeleide tabellen zijn zonder verlies opnieuw te berekenen: een volledige herberekening geeft dezelfde cijfers.

## Definition of Done

Hoofdstuk 19 geldt volledig. Specifiek voor deze prompt:

- Unit-tests voor `kpi`, `trechter`, `aandachtspunten`, `ritmeAfrekening` met grenzen en lege invoer; golden master voor `coachVoorstel`.
- Playwright-flow "coachingsgesprek" uit de teststrategie (hoofdstuk 19) groen op desktop en telefoon.
- Prestatiebudget: `GET /api/team` voor een team van 10 personen onder 1,0 s warm (niet vastgelegd in 13.4; voorstel).
- Regel 44 van Bijlage A afgevinkt in het sprintverslag; de helpartikelen voor de salesmanager staan erin.
