# P32: Dagritme-kern en Vandaag op de telefoon

| Onderdeel | Waarde |
|---|---|
| Sprint | 5 |
| Features | F01 Vandaag (telefoonweergave), hoofdstuk 8 (Mobiel en onderweg: 8.5.1 en de rekenkern uit 8.13) |
| Hangt af van | P01 (fundament, functiecatalogus, sync), P27 (inloggen met code, mobiele schil: compacte kop, onderbalk, schuifvenster, meldingsstrook), P03 (compacte accountkaart), P05 (reis en statusmachine), P06 (motor), P07 (Vandaag op de laptop, `GET /api/vandaag`, `rondTaakAf`, hercontactritme) |
| Bron in het bouwplan | 8.5.1, 8.13, en daarbij 8.1 tot en met 8.4, 8.7, 8.9 (voorlezen), 8.11, 8.12, 8.14, 8.15, 8.16, F01 (Op de telefoon, PRIO), 13.5 (lokaal bouwen), ADR-019, ADR-020, ADR-021, Bijlage B (rij Telefoon (Dex)), Bijlage A (gat 16) |

## Lees eerst

- `Bouwplan-Dealtrace.md`: 2.1, 2.2 (werkplekprofiel), 4.3 en 4.5, 6.2, hoofdstuk 8 volledig met nadruk op 8.1, 8.2, 8.3, 8.5.1, 8.7, 8.9, 8.11, 8.13, 8.14, 8.15, 8.16; F01; F06 (uitkomsten), 7.3; 13.4; 14; 19; ADR-019 en ADR-020; Bijlage B.
- DealDrive op commit 75bee61 (alleen lezen), de Dex-kern uit 8.13: `shared/dexDag.ts` (`bouwDag`, `heeftVervolg`, `telLink`, `bouwWeek`), `shared/dexRitme.ts` (`bepaalVorm`, `kiesFocus`, `kiesTip`, `maakTerugblik`, `bouwRitme`, `spreekRitme`), `shared/dexSignalen.ts` (vier detectoren, `governor`, `DAGPLAFOND`, `STIL_NA`, `stilTot`), `shared/dexRecap.ts` (`bouwRecap`, `spreekRecap`), `shared/werkplek.ts`, `shared/dexKaartVelden.ts`, `shared/datum.ts`. Ter vergelijking van de bediening: `app/pages/dex/index.vue`, `app/pages/dex/dagstart.vue`, `app/components/DexDagKiezer.vue`, `app/components/DexSignaalKaart.vue`, `app/components/DexMelding.vue`, `app/composables/useDexDag.ts`, `app/composables/useDexRitme.ts`, `app/composables/useDexSignalen.ts`, `server/utils/dexSignaalBesluit.ts`.

## Deel 1: Functioneel (wat en waarom)

### Wat je bouwt

Je zet de rekenkern van Dex om naar gedeelde pure functies in `shared/` (dag, dagritme, signalen, recap, voorlezen) en bouwt daarmee Vandaag op een telefoon van 390 px: groet, focuskaart, signaal, telstrip, stapels met de handeling in de regel, kansen en recap.

### Waarom

De buitendienst werkt de hele dag vanaf de telefoon en de binnendienst pakt hem tussen twee belblokken (hoofdstuk 8). Met alleen de icoonstrook van het designsysteem staat op 390 px geen enkele taak boven de vouw (ADR-019). Dex in DealDrive was sterk in de bediening ("moment boven menu", één zet met de reden erbij, duimbereik, de handeling in de regel) maar zwak in de architectuur: een aparte build, stapels organisatiebreed in plaats van "mijn", "Afgehandeld" zonder uitkomst en een dagstart van bijna 4.000 px lang (8.1). Dealtrace neemt de patronen over en niet de knip: één app, één rekenkern die op telefoon en laptop hetzelfde rekent (ADR-020).

### Gebruikers en niveaus

| Rol | Niveau | Wat (8.11) |
|---|---|---|
| Accountmanager | Beginner | Groet, focuskaart, telstrip, stapels; dagkiezer alleen met Morgen; kansen in je dag (top 3); recap kort (verslagen, morgen). Geen signaal en geen tip, zodat de eerste stapel ook boven de vouw staat |
| Accountmanager | Gevorderd | Plus signaal met "Gedaan", "Later", "Weg" en de tip van de dag; dagkiezer met "Vandaag", "Morgen" en "Week"; recap met risico's |
| Accountmanager | Expert | Als Gevorderd; recap met weekterugblik |
| Binnendienst | elk niveau | Vandaag met de belstapel bovenaan; werkplek Kantoor, dus zonder route en zonder "In de buurt" (8.12) |
| Salesmanager zonder eigen portefeuille | n.v.t. | Onderbalk begint met Team (8.4); eigen Vandaag alleen via Meer. Niet vastgelegd in het bouwplan; voorstel: Vandaag toont voor hem dezelfde opbouw op eigen werk |

### Schermen

**Vandaag op de telefoon** (`/`, onder 768 px, binnen de schil van P27: compacte kop van 56 px met "Zoeken", "Inspreken" en "Meldingen", onderbalk met Vandaag als tab 1). Opbouw van boven naar beneden op 390 bij 844 px:

1. **Groet en datum** op één regel ("Goedemorgen, Jan. · di 14 okt"), rechts de knop "Lees voor" (luidspreker).
2. **Focuskaart**, de eerste zet: tijd, wat, waarom in één zin, en één primaire knop ("Navigeer naar Bakker Bouw", "Bel Marieke de Vries", "Leg het verslag vast"). Uit `kiesFocus`.
3. **Signaal** (Gevorderd en Expert): één kaart met bron, bewijs in één regel en de knoppen "Gedaan", "Later", "Weg".
4. **Telstrip**: vier tegels in één rij van 72 px hoog: Afspraken, Bellen, Acties, Kansen, met aantal en rood als er achterstand is. Een tik springt naar de stapel.
5. **Stapels** met de handeling in de regel: afspraken (met "Navigeer" en "Pitstop"), belacties (met "Bel" en "Uitkomst"), acties (met "Afgehandeld"), eerste afspraken die nog bevestigd of overgedragen moeten worden (met "Bevestig" of "Overdragen"). Bij de binnendienst staat de belstapel bovenaan.
6. **Kansen in je dag**: hooguit drie, met "+ Tussenstop" (buitendienst) of "Bel" (binnendienst), en "Alle kansen →".
7. Na 16:00 verschijnt bovenaan de kaart **Recap** ("2 gesprekken zonder verslag").

Boven de vouw (ongeveer 640 px tussen kop en onderbalk) staan op elk niveau minimaal de groet, de focuskaart en de telstrip.

**Andere dag.** De dag staat in de URL (`/?dag=2026-10-15`). Met vegen naar links en rechts op de groet, of de knoppen "Vandaag", "Morgen" en "Week" (Gevorderd), kies je een andere dag; focus, signaal en tip verschijnen alleen voor vandaag.

**Tip van de dag** (Gevorderd en Expert, 8.11). De plek staat niet in 8.5.1. Niet vastgelegd in het bouwplan; voorstel: één regel onder de focuskaart, in `--muted`, alleen voor vandaag, en hij vervalt als er een signaal staat zodat de telstrip boven de vouw blijft.

**Lege staten.** Dex had eerlijke lege staten (8.1). Niet vastgelegd in het bouwplan; voorstel: focuskaart op een lege dag "Niets dringends vandaag. Een lege agenda is het beste moment om te prospecteren." met de knop "Open de bellijst"; een lege stapel verdwijnt en de telstrip toont 0 zonder rood.

**Wat op latere prompts wacht.** "Pitstop" komt met P18; "Navigeer" met de kaartappkeuze uit Mijn instellingen komt met P30; kansen en de tegel Kansen komen uit `shared/route.ts` in P14 en P30; "Hoe ging het?" na een `tel:`-oproep komt met P10. Niet vastgelegd in het bouwplan; voorstel: de knop "Pitstop" ontbreekt tot P18; "Navigeer" gebruikt tot P30 een diepe link naar Google Maps; de tegel Kansen toont 0 en het blok Kansen in je dag ontbreekt tot P14; "Uitkomst" opent het uitkomstraster uit 7.3 als schuifvenster.

**Laptop.** 8.16 eist dat focus, signaal en tellingen op telefoon en laptop identiek zijn. F01 beschrijft geen focuskaart op de laptop. Niet vastgelegd in het bouwplan; voorstel: Vandaag op de laptop (P07) leest de aantallen in de kolomkoppen en de samenvattingsregel uit dezelfde `bouwDag`, en toont de focus als één regel boven de drie kolommen.

### Klikpaden

1. **Zien waar de dag knelt** (0 tikken): open de app; groet, focuskaart en telstrip staan in beeld.
2. **Naar de volgende afspraak navigeren** (1 tik): op de focuskaart of in de afsprakenstapel "Navigeer"; de kaartapp opent met het adres.
3. **Bellen en uitkomst vastleggen** (2 tikken): "Bel 06 12 34 56 78" in de belstapel opent de telefoon via een `tel:`-link (mobiel nummer eerst); terug in de app tik je "Uitkomst" en een tegel. Het contactmoment werkt via `rondTaakAf` direct `laatst_gebeld_op` en het ritme bij.
4. **Signaal afhandelen** (1 tik): "Gedaan", "Later" of "Weg"; de kaart verdwijnt, de meldingsstrook toont "Signaal op later gezet. Komt terug op 2026-10-17." met "Ongedaan maken" (Niet vastgelegd in het bouwplan; voorstel voor de tekst).
5. **Actie afhandelen**: "Afgehandeld" in de actiestapel rondt een taak zonder contact af; een contacttaak (bellen, mail, bezoek) opent in plaats daarvan het uitkomstraster, want afronden zonder uitkomst kan niet (8.1, 7.3).
6. **Eerste afspraak bevestigen of overdragen**: "Bevestig" bij een geplande eerste afspraak rondt de taak "Afspraak bevestigen" af en zet de afspraak op bevestigd; "Overdragen" bij een gehouden eerste afspraak met vervolg opent "Overdragen?" met DealDrive, het CRM of een collega (F17). Niet vastgelegd in het bouwplan hoe "Bevestig" werkt; voorstel zoals hier. De knop "Overdragen" ontbreekt tot P17 Funnel van de prospectreis en overdracht klaar is; tot dan staat de afspraak alleen in de stapel.
7. **Voorlezen**: "Lees voor" spreekt de dag uit via de spraaksynthese van het toestel in `nl-NL`, in hooguit 60 seconden; nogmaals tikken stopt.
8. **Morgen bekijken**: veeg naar links op de groet; de URL wordt `/?dag=` met de datum van morgen; focus, signaal en tip verdwijnen.
9. **Telstrip**: tik op "Bellen"; de pagina scrolt naar de belstapel.

### Flyouts, schuifvensters en knoppen

- Elke regel opent het record als schuifvenster van onderen (tot 92 procent hoogte, greep bovenin, sluiten door omlaag te vegen of "Sluiten", plakkende knoppenrij onderaan met de primaire knop rechts); na opslaan sluit het venster pas na 1,2 seconden (8.3).
- Uitkomstraster: de tegels uit 7.3 in twee kolommen, knoppen van 56 px.
- Meldingsstrook boven de onderbalk; succes verdwijnt na 5 seconden met "Ongedaan maken", een fout blijft staan.
- Elke regel met een contactpersoon heeft een belknop, elke afspraak een navigeerknop, alle minimaal 44 px en in de onderste helft bereikbaar (8.16). Een knop zonder gegevens is uitgegrijsd met de reden ("Geen mobiel nummer bekend").

### Filters en sorteren

Geen filters op de telefoon. Stapels tonen standaard alleen het werk van de ingelogde gebruiker (8.2, punt 4). Volgorde binnen een stapel: afspraken op starttijd, belacties volgens de rangorde van de bellijst (zodra P10 die levert; tot dan `ordenTaken` uit P07), acties volgens `ordenTaken`.

### Regels

- **Focus** (`kiesFocus`, uit Dex, uitgebreid met de reis; Dex rekende met open deals, Dealtrace kent geen deals, B17): 1. een komende eerste afspraak; 2. de eerste komende afspraak; 2b. alles geweest en een afspraak zonder verslag: "Leg het verslag vast"; 3. de zwaarste achterstallige actie; 4. een gehouden eerste afspraak die nog niet is overgedragen. Niet vastgelegd in het bouwplan; voorstel voor regel 1 en 4 zoals hier. Dealtrace voegt toe: de poging die vandaag moet uit het hercontactritme, en de kansen langs de route (8.13). Niet vastgelegd in het bouwplan; voorstel voor de volgorde: de poging die vandaag moet komt direct na regel 2b en vóór de achterstallige actie; een kans langs de route komt pas na regel 4, omdat hij vrijblijvend is.
- **Signalen** (`shared/signalen.ts`): detectoren voor new business: koopsignaal, ritme achter, reis stil, terugkomregel bereikt. Governor: dagplafond 4 signaalbesluiten, stilte na Weg 1 dag, Later 3 dagen, Gedaan 30 dagen; dagplafond en stilte per organisatie instelbaar.
- **Getallen uit de Dex-kern**, startpunt en per organisatie instelbaar: werkdag 08:00 tot 18:00, account in reis zonder volgende stap na 7 dagen stilte, koopsignaal hooguit 14 dagen oud met relevantie 60, contractvenster 90 dagen (voor bestaande klanten in de route), vervolghorizon 90 dagen (8.13).
- **Recap** na 16:00 bovenaan; met verslagen bovenaan en de terugkomregels van morgen (8.13). Inhoud per niveau: kort, met risico's, met weekterugblik.
- **Vorm van het moment** (`bepaalVorm`): maandag weekstart, vrijdag vanaf 15:00 weekafsluiting, anders dagstart. Niet vastgelegd in het bouwplan hoe dit op Vandaag zichtbaar wordt; voorstel: alleen de groet en de recap volgen de vorm ("Goedemorgen, Jan. Een nieuwe week." en op vrijdag de weekterugblik in de recap voor Expert), geen extra blok.
- **Voorlezen**: tekst geschreven voor het oor, hele zinnen, bedragen uitgeschreven, zonder opsommingstekens, hooguit 60 seconden (8.9).
- **Werkplek** zit in de rekenkern, niet in de weergave: binnendienst krijgt de belstapel bovenaan en "Bel" bij kansen, buitendienst "+ Tussenstop".
- **Offline**: Vandaag opent uit IndexedDB; "Afgehandeld", uitkomst na bellen en signaalbesluiten gaan in de wachtrij met zichtbare status (8.8).

### Helpartikelen

- "Dealtrace op je telefoon en offline" (Aan de slag, F21): onderbalk, Vandaag op de telefoon, focus, signaal, telstrip, offline.
- "Dealtrace op je telefoon" staat ook in de mobiele reeks van F21. Niet vastgelegd in het bouwplan of dit één of twee artikelen zijn; voorstel: één artikel met de titel "Dealtrace op je telefoon en offline", met "Een dag offline" als apart artikel in P30.
- Uitbreiding van het artikel "Vandaag" uit P07 met de telefoonweergave.

## Deel 2: Technisch (hoe)

### Datamodel

- Geen nieuwe tabel voor de dag zelf: `bouwDag` rekent uit `tasks`, `appointments`, `signals`, `accounts`, `prospectreizen` en `activiteiten`; er is geen tabel `deals` (B17).
- Signaalbesluiten: 8.10 eist dat "gelezen" op alle apparaten gelijk is en op de server staat; Dex bewaarde besluiten via `dexSignaalBesluit.ts`. Niet vastgelegd in het bouwplan; voorstel: tabel `signaal_besluiten: id, organisation_id, gebruiker_id, signaal_sleutel, besluit ('gedaan'|'later'|'weg'), op, stil_tot`, RLS `org_isolation` plus filter op `gebruiker_id`, uniek op `(gebruiker_id, signaal_sleutel, datum)`.
- Instellingssleutel `dagritme` in `shared/settingKeys.ts` met de getallen uit 8.13 (werkdag, gat, omweg, contractvenster, reisstilte, koopsignaal, dagplafond, stilte, vervolghorizon). Niet vastgelegd in het bouwplan; voorstel voor de sleutelnaam.
- Rechtenmatrix: `signaal_besluiten` alleen eigen rijen lezen en schrijven.
- Sync-allowlist: nieuwe mutatiesoort `signaal.besluit` (8.14) met `idempotentie_sleutel`; `taak.afronden` en `belpoging.uitkomst` bestaan uit P07.

### Pure functies

Alle functies zonder framework, met `nu` als parameter, bedragen in centen via `formatteerCenten` (8.14).

| Functie | Bestand | Invoer en uitvoer | Randgevallen en tests |
|---|---|---|---|
| `bouwDag(bron, gebruiker, dag, nu, opties)` | `shared/dag.ts` | brondata naar stapels, telstrip en achterstand | filter op eigenaar; prospectreis-stappen als bron van belacties; dag in het verleden; lege dag; werkplek binnendienst tegenover buitendienst |
| `heeftVervolg(bron, accountId, nu)` | `shared/dag.ts` | boolean | taak of afspraak binnen de vervolghorizon van 90 dagen; account in reis 7 dagen stil zonder volgende stap |
| `telLink(contact)` | `shared/dag.ts` | `tel:`-link of null | mobiel eerst; nummer in E.164; geen nummer |
| `kiesFocus(afspraken, acties, reis, kansen, nu, periode)` | `shared/dagritme.ts` | `{wat, waarom, wanneer, accountId, verslagVan, knop}` of null | elke regel apart; afspraak precies op het eindtijdstip; 22:41 met alleen voorbije afspraken; poging die vandaag moet; gehouden eerste afspraak niet overgedragen |
| `kiesTip(...)` | `shared/dagritme.ts` | tekst of null | na 18:00; 3 achterstallige acties; lege dag |
| `bepaalVorm(nu)` | `shared/dagritme.ts` | weekstart, weekafsluiting of dagstart | vrijdag 14:59 en 15:00 |
| `detecteerSignalen(bron, gebruiker, nu, instellingen)` | `shared/signalen.ts` | lijst signalen | koopsignaal 14 en 15 dagen oud; relevantie 59 en 60; ritme achter; reis stil; terugkomregel vandaag bereikt |
| `governor(signalen, besluiten, nu, instellingen)` | `shared/signalen.ts` | één signaal of null | dagplafond 4 bereikt; stilte na Weg, Later, Gedaan precies op de grens |
| `bouwRecap(bron, gebruiker, niveau, nu)` | `shared/recap.ts` | recap per niveau | voor 16:00 leeg; verslagen ontbreken; terugkomregels van morgen |
| `spreekDag(dag, focus, nu)`, `spreekRecap(recap)` | `shared/spreek.ts` | tekst voor het oor | hooguit 60 seconden (bij 150 woorden per minuut hooguit 150 woorden); geen opsommingstekens; bedragen uitgeschreven |
| `tabVoorRoute(pad)` | `shared/onderbalk.ts` (P27) | tab | `/?dag=` hoort bij Vandaag |

Testsets `test:dag`, `test:ritme`, `test:signalen`, `test:recap`, `test:spreek`: overnemen uit Dex en uitbreiden voor de reis (8.14). Eén gedeelde test bewijst dat telefoon en laptop dezelfde focus, signaal en tellingen krijgen.

### Endpoints

| Methode en route | Recht | Invoer | Uitvoer | Fouten |
|---|---|---|---|---|
| `GET /api/vandaag?dag=` | iedere gebruiker | dag in ISO | brondata plus de uitkomst van `bouwDag` | 400 bij ongeldige datum |
| `POST /api/sync/mutations` | iedere gebruiker | `signaal.besluit {signaalSleutel, besluit}`, `taak.afronden`, `belpoging.uitkomst` | resultaat per mutatie | 409 bij conflict; dubbele sleutel verandert niets |

Geen aparte telefoonendpoints: de `/api/dex/*`-routes van DealDrive vervallen (8.13). Niet vastgelegd in het bouwplan of de server of de client `bouwDag` draait; voorstel: de client rekent uit de brondata (ook offline), de server rekent met dezelfde functie voor de push van P31 en voor de gedeelde test.

### AI-stappen

Geen. De rekenkern is deterministisch: geen AI, geen kosten (8.1, Dex). Signalen lezen inzichten die de agents later maken (P19), maar beoordelen zelf niets.

### Integraties

- Spraaksynthese van het toestel in `nl-NL` (8.9); geen externe dienst.
- Kaartapp via diepe link (8.6); de keuze per gebruiker komt in P30.

### Functiecatalogus

Niet vastgelegd in het bouwplan; voorstel voor de sleutels (niveaus uit 8.11, alle in Starter):

| Sleutel | Niveau | Recht | Helpartikel |
|---|---|---|---|
| `vandaag.telefoon` | Beginner | iedereen | Dealtrace op je telefoon en offline |
| `vandaag.signaal` | Gevorderd | iedereen | Dealtrace op je telefoon en offline |
| `vandaag.tip` | Gevorderd | iedereen | Dealtrace op je telefoon en offline |
| `vandaag.dagkiezerWeek` | Gevorderd | iedereen | Vandaag |
| `vandaag.recapRisico` | Gevorderd | iedereen | Vandaag |
| `vandaag.recapWeek` | Expert | iedereen | Vandaag |
| `vandaag.voorlezen` | Beginner | iedereen | Dealtrace op je telefoon en offline |

### Hergebruik uit DealDrive (de Dex-kern uit 8.13)

| DealDrive (75bee61) | Dealtrace | Wat verandert |
|---|---|---|
| `shared/dexDag.ts` (`bouwDag`, `heeftVervolg`) | `shared/dag.ts` | filter op eigenaar; prospectreis-stappen als bron van belacties; uitkomst na bellen werkt contactdatums bij |
| `shared/dexRitme.ts` (`kiesFocus`, `kiesTip`, `bepaalVorm`, `spreekRitme`) | `shared/dagritme.ts` | focusregels uitgebreid met de reis (poging die vandaag moet) en de kansen langs de route |
| `shared/dexSignalen.ts` (vier detectoren, governor) | `shared/signalen.ts` | detectoren voor new business: koopsignaal, ritme achter, reis stil, terugkomregel bereikt; dagplafond en stilte per organisatie instelbaar |
| `shared/dexRecap.ts` | `shared/recap.ts` | verslagen bovenaan en de terugkomregels van morgen |
| `shared/werkplek.ts` (kantoor, onderweg) | werkplekprofiel binnendienst, buitendienst, hybride | beheerder zet het profiel |
| `shared/dexKaartVelden.ts` | `shared/kaartvelden.ts` | één veldenlijst per soort voor scherm, server en niveau |
| `DexMelding.vue`, `DexKaart.vue` | `Meldingsstrook.vue`, `RecordVenster.vue` (P27) | responsief; hier alleen gebruiken |
| `/api/dex/*` | `POST /api/sync/mutations` en `GET /api/vandaag` | geen tweede schrijfweg |

Wat je uit Dex niet overneemt: de aparte build en allowlist, stapels organisatiebreed, "Afgehandeld" zonder uitkomst op een contacttaak, links naar `/dex/*`-pagina's, "gelezen" per apparaat (8.1).

### Buiten scope

- Route en tussenstops (P30), "Hoe ging het?" en de belmodus op de telefoon (P10), spraakopdracht en inspreken (P31), push van dagstart, vertrek, briefing en recap (P31 en P26), dagpakket voor een hele dag offline (P30), aankomstmelding "Je bent bij ..." (P30).

## Acceptatiecriteria

1. Op 390 px staan op Vandaag de groet, de focuskaart en de telstrip zonder scrollen in beeld, op elk niveau (8.16); een Beginner ziet ook de eerste stapel boven de vouw. Playwright toetst dit op 375, 390 en 412 px.
2. Tikdoelen uit 8.7: zien waar de dag knelt 0 tikken; naar de volgende afspraak navigeren 1 tik; een prospect bellen en de uitkomst vastleggen 2 tikken; signaal afhandelen 1 tik. Een Playwright-test telt de tikken.
3. Elke regel met een contactpersoon heeft een belknop; elke afspraak een navigeerknop; alle minimaal 44 px en binnen duimbereik (8.16).
4. Focus, signaal en tellingen zijn op telefoon en laptop identiek, getoetst op de gedeelde kern met dezelfde fixture.
5. De stapels tonen standaard alleen het werk van de ingelogde gebruiker; een taak van een collega op een eigen account verschijnt niet.
6. Een contacttaak kan niet met "Afgehandeld" zonder uitkomst worden afgerond.
7. Elke tab van de onderbalk is op `/` en `/?dag=` eenduidig actief; de onderbalk verschuift niet tussen niveaus.
8. Offline: "Afgehandeld", een uitkomst na bellen en een signaalbesluit slagen zonder verbinding met zichtbare status ("Offline · 3 wijzigingen wachten") en komen na herstel precies één keer aan (`context.setOffline(true)`).
9. De governor laat na 4 signaalbesluiten op één dag geen nieuw signaal meer zien; "Later" houdt een signaal 3 dagen stil, "Weg" 1 dag, "Gedaan" 30 dagen; een besluit op de telefoon geldt ook op de laptop.
10. Voorlezen: `spreekDag` levert voor de Voltvast-fixture een tekst van hooguit 60 seconden zonder opsommingstekens; de knop werkt met de spraaksynthese van het toestel.
11. Recap verschijnt na 16:00 en niet ervoor (test met `nu` 15:59 en 16:00).
12. De dag in de URL werkt: `/?dag=` met de datum van morgen toont geen focus, signaal en tip.
13. Prestatie op een middenklasse-Android over 4G: eerste weergave van Vandaag binnen 2,5 seconden (LCP), interactief binnen 3,5 seconden; een tik geeft binnen 100 ms zichtbare reactie; JavaScript voor de eerste weergave hooguit 250 KB gecomprimeerd (8.14).
14. Bijlage A, gat 16: elke berekening van dag, focus, signaal en recap staat één keer in `shared/`; er is geen kopie in een component of composable.
15. Toegankelijkheid: VoiceOver en TalkBack lezen groet, focuskaart, telstrip en stapels in logische volgorde; tekstvergroting tot 200 procent zonder afgekapte knoppen (8.15).
16. Per niveau getest: Beginner zonder signaal en tip en met alleen "Morgen" in de dagkiezer; Gevorderd met signaal, tip en "Week"; Expert met de weekterugblik in de recap.
17. Werkplek getest: binnendienst toont de belstapel bovenaan en "Bel" bij kansen; buitendienst toont "+ Tussenstop".
18. Testdata uit de Voltvast-startset (Bijlage C): teams Binnendienst, Team Noord en Team Zuid. Niet vastgelegd in het bouwplan; voorstel: een fixturedag met drie fictieve afspraken, vijf belacties en één terugkomregel (hc-02, "Beslissing uitgesteld") die vandaag afloopt.
19. De vierde stapel toont eerste afspraken die nog bevestigd of overgedragen moeten worden; nergens op Vandaag staan deals, offertes of "deals zonder vervolgstap" (B17).

## Definition of Done

Hoofdstuk 19 geldt volledig. Specifiek voor deze prompt:

- Testsets `test:dag`, `test:ritme`, `test:signalen`, `test:recap` en `test:spreek` groen, lokaal met `pnpm test` en de startset uit `pnpm seed` (13.5), met de checks uit Dex overgenomen en uitgebreid voor de reis.
- Playwright-projecten voor 375, 390 en 412 px met aanraakmodus; een schermafbeelding van Vandaag als referentie; de boven-de-vouwtest en de tikkentest uit 8.15.
- Getest op de toestellen uit 8.15 (iPhone SE, iPhone 15 of 16, Samsung Galaxy A-serie, Google Pixel 7 of nieuwer, iPad staand) met schermafbeeldingen in het sprintverslag (8.16: een prompt met een scherm is pas klaar na deze test).
- Helpartikel "Dealtrace op je telefoon en offline" in `content/help/`; `docs/HOE-HET-WERKT.md` beschrijft de rekenkern en wat uit Dex komt.
