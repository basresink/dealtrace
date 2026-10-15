# P16: Campagnes

| Onderdeel | Waarde |
|---|---|
| Sprint | 9 |
| Features | F12 Campagnes |
| Hangt af van | P01 (functiecatalogus, rechten), P27 (mobiele schil), P03 (accounts, segmenten, opgeslagen filters), P04 (importbatches), P05 (doelgroepen, reis, fases), P06 (motor, regel campagne-achterstand, capaciteit), P07 (taken, `rondTaakAf`), P08 (mandaten, Bewaker, Verzender), P33 (AI-credits: `shared/credits.ts`), P10 (belblokken en belscripts), P11 (leadrondes), P12 (hercontactritmes in de planning), P13 (regiodagen in de agenda), P14 (gebieden), P28 (verkoopverhaal: branches, winpunten, dekking). P18 (Schrijver en mail) loopt in dezelfde sprint; zie Afbakening |
| Bron in het bouwplan | F12, F25 (campagnes), 7.4 (laag 3), 11.3 (Verzender, mandaat), 11.5, 15.1 (kanaaldekking), 15.2 (afmeldlink), F13 (ritmes), F15 (SR11, capaciteit), 16.1, Bijlage A regels 13, 16, 38 |

## Lees eerst

- `Bouwplan-Dealtrace.md`: 2.1, 2.3, 2.4, 3.3 (rij Campagnes), 4.3 (rij F12), 6.1, 7.1 tot en met 7.4, 8.11 en 8.12 (campagnes opzetten niet op de telefoon), F05 (doelgroepen), F07 (koude belblokken), F08 (scripts), F12 volledig, F13 (ritmes, afkoelperiode), F15 (capaciteit, landing, regel campagne-achterstand), F25 (dekking, winpunten, jaarkeuzes), 10.2 (rij `campagnes`, `campagnesoorten`), 11.2 tot en met 11.5, 15.1, 15.2, 19, ADR-007, Bijlage A, Bijlage B (rij Campagnes).
- DealDrive op commit 75bee61: `app/pages/campagnes/index.vue`, `app/pages/campagnes/[id].vue`, `app/components/CampagneFlyout.vue`, `app/components/NieuweCampagneFlyout.vue`, `app/components/CampagneAccountsFlyout.vue`, `app/components/CampagneVoortgangFlyout.vue`, `app/composables/useCampagneDetail.ts`, `app/composables/useCampagneTempo.ts`, `shared/campagneSoorten.ts`, `shared/campagneAdvies.ts`, `server/utils/campagneTempo.ts`, `server/utils/campagneAdvies.ts`, `server/utils/campagneAfsluiter.ts`.

## Deel 1: Functioneel (wat en waarom)

### Wat je bouwt

Je bouwt campagnes als gerichte actie over 20 tot 80 accounts: een wizard in vijf stappen, een bord met zes kolommen, gespreide taken, één tempofunctie en een afsluiter met resultaat.

### Waarom

Een campagne is laag 3 van de vijf lagen (7.4): een actie met soort, winpunt, boodschap of script, hercontactritme, tussendoelen, einddoel en einddatum. In DealDrive verloor een campagne varianten bij aanmaken, zette handmatig actief geen startdatum, bestonden er twee tempoformules (Bijlage A regel 13) en liepen bord en taak uiteen bij slepen naar Klaar (regel 38). De salesmanager moet kunnen zien of een campagne op schema ligt en wat hij oplevert; de accountmanager moet de taken zonder zoeken in zijn blokken of op zijn regiodag vinden.

### Gebruikers en niveaus

| Rol | Niveau | Wat |
|---|---|---|
| Accountmanager | Beginner | Taken uit een campagne uitvoeren; campagnebord lezen; in de zijbalk staat Campagnes als "meedoen" (6.1) |
| Accountmanager | Gevorderd | Campagne maken uit de acht startsoorten met de wizard, bord gebruiken, accounts toevoegen, taken spreiden over belblokken, voortgang |
| Accountmanager | Expert | Alle 26 soorten, mailreeksen met de Verzender op mandaat B, tussendoelen, dynamische doelgroep |
| Salesmanager | rol | Campagnes van het team, activeren boven capaciteit, verdelen over verkopers, resultaat en conversie per campagne |
| Beheerder | rol | Campagnesoorten aan en uit zetten (F22, Verkoop) |

### Schermen

**`/campagnes`** (lijst): kicker "CAMPAGNES · 5 ACTIEF", titel "Eén lijst, één doel, elke dag een stap.", knoppen "+ Campagne" (Gevorderd; Beginner ziet hem als secundaire knop met slot die de uitlegflyout opent), "Filters" (status, soort, eigenaar), "Hulp". Kaarten met soort, status, eigenaar, tempopil ("Voor op schema", "Op schema", "Achter op schema"), doel, winpunt, accounts, klaar, afspraken, voortgangsbalk met de verwachte stand als streep, dagen over. Lege staat: Niet vastgelegd in het bouwplan; voorstel: "Er lopen geen campagnes. Een campagne bundelt 20 tot 80 accounts rond één doel." en bij een filter "Toon alles".

**`/campagnes/nieuw`** (wizard, stappenbalk bovenaan; "Opslaan als concept" kan altijd):

1. **Doelgroep**: doelgroep (F05), fase in een reis, segment, opgeslagen filter, leadronde of importbatch, of "Vrije keuze". De wizard toont het aantal en wat wordt overgeslagen met reden ("6 zitten al in een ritme", "3 in afkoelperiode", "2 horen bij een partner"). Kanaal direct of via partner. Branche verplicht (F25).
2. **Soort**: acht startsoorten als kaarten (Koude belcampagne, Mailreeks, LinkedIn-reeks, Bezoektour, Beurs of event, Referral, Winback, Nurture), daaronder "Alle 26 soorten" in vijf groepen met zoekveld (Expert). Elke soort heeft een standaarddoel, standaardritme, standaardscript of mailsjabloon en uitvoerder (binnendienst, buitendienst of beide). Niet vastgelegd in het bouwplan: de namen van de overige 18 soorten en van de vijf groepen; voorstel: de founder levert de lijst vóór de start van deze prompt, tot dan bouw je de acht startsoorten en de structuur voor 26.
3. **Winpunt**: AI-voorstel met motivatie van hoogstens 40 woorden uit de fase van de doelgroep en de laatste 20 verslagen; kiesbaar uit de winpunten (leesmodel `vv_winpunten`, alleen bevestigd).
4. **Boodschap en script**: per kanaal de boodschap (mail, LinkedIn, kaart) met toon ("Zakelijk", "Persoonlijk", "Kort"), stijlscore en "Maak opnieuw"; het belscript-template voor beltaken (F08); de mailreeks met verzenddagen (bericht 2 en verder met een ander winpunt).
5. **Doel en planning**: einddoel (aantal afspraken of percentage), tussendoelen uit de reis, startdatum, einddatum, eigenaar of verdeling over verkopers (gelijk, op gebied, op capaciteit), capaciteitsschatting per week ("8,5 uur bellen per week tegen 6 beschikbaar") met waarschuwing; boven capaciteit moet de salesmanager bevestigen. Optioneel "Draagt bij aan jaarkeuze" (F25).

Meldingen in de wizard: een branche zonder eigen verhaal of belofte geeft een gele melding met link naar de inrichting; een toekomstige branche met prioriteit hoog krijgt het advies "Eerst referenties en verhaal, dan volume" (F25). Een kanaal dat meer dan 20 procent van de accounts niet kan bereiken, blokkeert de start (15.1). Niet vastgelegd als tekst; voorstel: "23 van de 30 accounts hebben een telefoonnummer. Vul eerst de nummers aan of kies een ander kanaal voor de eerste stap."

**`/campagnes/:id`** (bord): kop met soort, status, reis, winpunt, ritme ("koud, 5 pogingen in 3 weken"), doel en stand ("14 van 30 afspraken"), tempopil, knoppen "Zet om naar taken (7)", "Verdeel over belblokken", "Voortgang", "Wijzigen", "+ Accounts". Blok "Begin hier · uitgerekend, geen AI" (drie accounts: nooit contact eerst, dan langst stil, met aanleiding als tweede sleutel). Kolommen "Gespot", "Benaderd", "In gesprek", "Afspraak", "Geparkeerd", "Afgewezen"; kaartje met initialen in fasekleur, naam, "poging 3 van 5", volgende stap en datum, eigenaar. Slepen kan; een kolomwissel naar Afspraak, Geparkeerd of Afgewezen vraagt de uitkomst. Een bord is altijd een keuze naast een lijst (14): knop "Weergave" met Bord en Lijst.

**Afgerond**: samenvatting met bereikt, gesprekken, afspraken gepland en gehouden, overgedragen, conversie, winpunt uitgevoerd (F12). Geen deals of pipelinewaarde (B17).

**Telefoon (390 px).** Campagnes staat onder "Meer" (8.4). Lijst en bord zijn leesbaar; het bord toont op de telefoon de lijstweergave per kolom als uitklapgroepen (voorstel, niet vastgelegd). Campagnes opzetten staat bewust niet op de telefoon: de wizard opent met "Beter op een groot scherm" (8.12). Taken uit een campagne voer je uit vanuit Vandaag, Bellen en Route.

### Klikpaden

1. Campagne maken (Gevorderd): "+ Campagne" (1), doelgroep kiezen (2), "Volgende" (3), soort Koude belcampagne (4), winpunt bevestigen (5), script bevestigen (6), doel en data (7), "Activeer" (8). De campagne staat op "Actief" met startdatum; toast (voorstel) "Campagne gestart. 30 taken gespreid over je koude belblokken."
2. Taken spreiden: op het bord "Verdeel over belblokken" (1); de taken krijgen vervaldatums in de koude belblokken, maximaal het aantal plekken per blok; buitendienst op de regiodag van het account.
3. Kaart slepen naar Afgewezen (1); venster vraagt de uitkomst "Geen interesse" met reden (2); bewaren (3). De taak wordt afgerond met dezelfde uitkomst via `rondTaakAf`.
4. Item afronden: vraag "Is het winpunt uitgevoerd?" (ja of nee).
5. Activeren boven capaciteit: de accountmanager kiest "Vraag bevestiging" (voorstel); de salesmanager krijgt een taak en bevestigt met "Activeer toch".

### Regels

- Een account zit nooit in twee ritmes; de wizard weigert het met uitleg.
- Taken uit een campagne krijgen titel "{werkwoord} {account} ({campagne})", het script of concept, `campaignId`, eigenaar uit de verdeling en een vervaldatum gespreid over de looptijd (binnendienst in de koude belblokken, maximaal het aantal plekken per blok; buitendienst op de regiodag van het account).
- Tempo (één functie voor scherm en motor): voortgang = items met einddoel gehaald gedeeld door items; verwacht = verstreken looptijd gedeeld door totale looptijd; doelpercentage uit het doel; "Voor op schema" bij 5 punten of meer boven verwacht, "Op schema" tot 10 punten eronder, anders "Achter op schema". Tempo alleen met einddatum en minstens één account.
- Achterstand: de motor maakt een inzicht "Campagne loopt achter" bij 10 procentpunten of meer achterstand (cadans 2 dagen), met het advies "Begin hier" (regel SR11).
- Afsluiter: na de einddatum gaat een actieve campagne naar "Afgerond" met de samenvatting.
- Mailreeks: de eerste mail aan een contact en elke mail aan een beslisser zijn per stuk goed te keuren (mandaat C); mail 2 en verder binnen een goedgekeurde campagne mag de Verzender zelf versturen (mandaat B, Expert, als de organisatie dat aanzet), met dagplafond 40 per gebruiker, afmeldlink, stop bij een antwoord of bounce. Beginner: Verzender uit, elke mail als concept (11.3).
- Bij afronden van een item "Is het winpunt uitgevoerd?"; norm 90 procent.
- Varianten blijven bewaard bij aanmaken; activeren zet de startdatum (regel 13).
- Afkoelperiode per kanaal en consent worden vóór elke poging gecontroleerd (Bewaker, F13).
- Alleen bevestigde versies van het verkoopverhaal gaan naar buiten; elke boodschap bewaart de gebruikte versies (`vvVersies`).
- Toegestane omvang: 20 tot 80 accounts is de beschrijving in F12. Niet vastgelegd in het bouwplan of dit een harde grens is; voorstel: waarschuwing buiten 20 tot 80, geen blokkade.

### Filters en sorteren

Lijst: status (concept, actief, afgerond, voorstel ook gepauzeerd), soort, eigenaar ("Van mij" standaard), in de URL (`/campagnes?status=actief&eigenaar=mij`). Bord: filter eigenaar en zoeken op naam; sortering in een kolom op volgende stap (voorstel).

### Helpartikelen

- "Campagnes" en "Een campagne opzetten" (Plannen en sturen, F21). Er zijn geen leerpaden per niveau (B19).
- New business: "De prospectmix: koud, warm, referral, winback", "Waarom de vierde en vijfde poging het verschil maken", "De eerste mail: waarom, hoe, vraag".

## Deel 2: Technisch (hoe)

### Datamodel

```ts
campagnes: id, organisation_id, reis_id, doelgroep_id, soort, status, eigenaar_id?, started_at, ends_at, data jsonb
  data: winpuntId, boodschap, scriptId, mailreeks[], ritme {ritmeId}, tussendoelen[], doel {type, waarde},
        capaciteit, verdeling, items[], brancheId, jaarkeuze?, varianten[], vvVersies
campagnesoorten: id, organisation_id, sleutel, groep, naam, standaardDoel, ritmeId, kanalen, uitvoerder,
                 scriptId, mailsjabloonId, actief
```

- `items[]` per account: Niet vastgelegd in het bouwplan als structuur; voorstel: `{accountId, kolom, poging, volgendeStap, volgendeOp, eigenaarId, winpuntUitgevoerd?, einddoelGehaald}`. Overweeg een eigen tabel `campagne_items` als items gefilterd of geteld worden (10.1); voorstel: eigen tabel, omdat het bord, de motor en de rapportage erop tellen.
- `tasks.campaign_id` bestaat (10.2).
- Migratie: tabellen plus seed van de acht startsoorten (F23: "8 campagnesoorten aan").
- RLS: `org_isolation`.
- Rechtenmatrix (3.3): accountmanager lezen alles, schrijven eigen, verwijderen eigen; salesmanager alles in team; beheerder alles. Activeren boven capaciteit: salesmanager.
- Sync-allowlist: `campagnes` (schrijven voor eigenaar), `campagne_items` (kolomwissel); offline-mutatiesoort voor een kolomwissel: Niet vastgelegd in het bouwplan; voorstel `campagne.kolom` die intern `rondTaakAf` aanroept.

### Pure functies

| Functie | Invoer | Uitvoer | Randgevallen en tests |
|---|---|---|---|
| `campagneTempo(campagne, items, nu)` | campagne, items | `{voortgang, verwacht, pil}` | zonder einddatum of zonder accounts: geen tempo; grenzen +5 en -10 punten precies |
| `campagneAdvies(items, activiteiten)` ("Begin hier") | items | drie accounts | nooit contact eerst, dan langst stil, aanleiding als tweede sleutel |
| `spreidTaken(items, blokken, regiodagen, looptijd)` | items, koude belblokken, regiodagen | vervaldatums | meer items dan plekken; feestdagen; buitendienst zonder regiodag |
| `capaciteit(items, soort, eigenaars)` | | uren per week tegen beschikbaar | eigenaar zonder blokken |
| `campagneResultaat(items, activiteiten)` | | bereikt, gesprekken, afspraken gepland en gehouden, overgedragen, conversie, winpunt uitgevoerd | lege campagne; overgedragen telt alleen accounts met gebeurtenis `overgedragen` |
| `overslagen(accounts, ritmes, afkoeling, partners)` (voorstel) | | lijst met reden | account in ritme, in afkoeling, bij partner |
| `kanaalDekking(accounts, kanaal)` (voorstel) | | percentage | grens 20 procent (15.1) |
| `kolomUitUitkomst(uitkomst)` (voorstel) | uitkomstcode uit 7.3 | kolom | `afspraak` naar Afspraak, `geen_interesse` naar Afgewezen, laatste poging zonder reactie naar Geparkeerd |

Eén tempofunctie in `shared/` voor scherm en motor (regel 13 en 16).

### Endpoints

| Methode en route | Recht | Invoer | Uitvoer | Fouten |
|---|---|---|---|---|
| `POST /api/campagnes` | Gevorderd | wizardgegevens | campagne (concept) | 400 account in ander ritme, met lijst |
| `PUT /api/campagnes/:id` | eigenaar, salesmanager | wijziging | campagne | 409 versie |
| `POST /api/campagnes/:id/activeer` | eigenaar; boven capaciteit salesmanager | geen | status actief, startdatum | 403 `{reden: 'capaciteit'}`; 400 kanaaldekking onder 80 procent |
| `POST /api/campagnes/:id/taken {itemIds?}` | eigenaar | items | taken | |
| `POST /api/campagnes/:id/verdeel` | salesmanager | verdeling | items met eigenaar | |
| `POST /api/campagnes/:id/boodschap` | Gevorderd | kanaal, toon | concept met stijlscore | 402 credits op, met de tekst uit 11.4 ("De AI-credits van deze maand zijn op. Je beheerder kan extra credits aanvragen.") |
| `GET /api/campagnes/:id/resultaat` | lezen | geen | resultaat | |
| `POST /api/campagnes/:id/items/:accountId/kolom` (voorstel) | eigenaar | `{kolom, uitkomst, reden?}` | item en taak | 400 uitkomst ontbreekt |

### AI-stappen

| Stap | Agent en mandaat | Materiaal | Schema | Vangrails | Mock | Credits (11.4) |
|---|---|---|---|---|---|---|
| Winpuntvoorstel | Schrijver, A (concept) | fase van de doelgroep, laatste 20 verslagen, bevestigde winpunten | `{winpuntId, motivatie}` (motivatie hooguit 40 woorden) | AI schrijft geen winpunten, kiest alleen uit bestaande; namenfilter | vaste fixture | concept, 2 per handeling |
| Boodschap per kanaal | Schrijver, A (concept) | verkoopverhaal (golden circle, belofte, winpunt met één bewijs), dossier | per kanaal tekst, stijlscore | 11.5: waarom, hoe, vraag; lengtegrenzen; stijlscore onder 7 één keer opnieuw; bericht 2 ander winpunt | vaste fixture | concept, 2 per kanaal |
| Versturen mailreeks | Verzender, C voor eerste mail en beslisser, B daarna (Expert, organisatie aan) | goedgekeurde concepten | n.v.t. | Bewaker: consent, afkoeling, dagplafond 40, afmeldlink, stop bij antwoord of bounce | mock-mailprovider | n.v.t. |

### Afbakening met P18

P18 bouwt de Schrijver (11.5, stijlcheck) en het versturen van mail (mailprovider, SMTP, afmeldlink). P16 roept die aan voor de boodschap in de wizard en voor de mailreeks. Bouw P18 eerst of gebruik tot die tijd de mock van de Schrijver.

### Functiecatalogus

Sleutels niet vastgelegd in het bouwplan; voorstel:

| Sleutel | Startindeling: aan vanaf | Pakket | Recht | Helpartikel |
|---|---|---|---|---|
| `campagnes.meedoen` | Beginner | Starter | taken schrijven | "Campagnes" |
| `campagnes.maken` (acht startsoorten, wizard, bord) | Gevorderd | Starter | campagnes schrijven eigen | "Een campagne opzetten" |
| `campagnes.alleSoorten`, `campagnes.tussendoelen`, `campagnes.dynamisch` | Expert | Plus (voorstel) | campagnes schrijven eigen | idem |
| `campagnes.mailreeksB` (Verzender op mandaat B) | Expert | Plus | campagnes schrijven eigen; organisatie zet B aan | idem |
| `campagnes.boodschapAI` | Gevorderd | Plus (AI-soort concept, 2 credits per handeling via `creditsVoor`, P33) | campagnes schrijven eigen | idem |
| `campagnes.team` (activeren boven capaciteit, verdelen) | Gevorderd | Starter | salesmanager | idem |

### Hergebruik uit DealDrive

- `campagnes/index.vue`, `campagnes/[id].vue`, `CampagneFlyout.vue`, `NieuweCampagneFlyout.vue`, `useCampagneDetail.ts`: aanpassen naar wizard in vijf stappen, zes kolommen en spreiding.
- `server/utils/campagneTempo.ts` en `useCampagneTempo.ts`: samenvoegen tot één functie in `shared/` (regel 13).
- `campagneAdvies.ts` (server en shared): "Begin hier".
- `campagneAfsluiter.ts`: afsluiter na de einddatum.
- `shared/campagneSoorten.ts`: structuur van soorten en varianten; varianten blijven bewaard bij aanmaken.

### Buiten scope

- WhatsApp-reeksen (P26), LinkedIn-automatisering (nooit, ADR-006).
- Campagnes vergelijken in Analyse (P21).
- De Schrijver en de mailprovider zelf (P18).

## Acceptatiecriteria

1. Bijlage A regel 13: varianten blijven bewaard bij aanmaken, activeren zet de startdatum, er is één tempofunctie.
2. Bijlage A regel 38: een kolomwissel naar Afspraak, Geparkeerd of Afgewezen vraagt de uitkomst; bord en taak lopen nooit uiteen.
3. Bijlage A regel 16: soorten, tempo en spreiding staan één keer in `shared/`.
4. Een koude belcampagne van 30 accounts loopt van Gespot tot Afspraak en Geparkeerd (F12 en hoofdstuk 17, sprint 9).
5. Taken zijn gespreid en vallen in koude belblokken; buitendiensttaken op de regiodag van het account.
6. Een campagne boven capaciteit vraagt bevestiging van de salesmanager; de server weigert activeren zonder.
7. Een account in een ander ritme wordt in de wizard overgeslagen met reden en kan niet worden toegevoegd.
8. Een campagne waarvan meer dan 20 procent van de accounts het kanaal van de eerste stap niet kan, start niet.
9. Een branche zonder eigen verhaal of belofte geeft de gele dekkingsmelding (Bijlage C.9 punt 1 met br-03).
10. De Verzender verstuurt nooit de eerste mail aan een contact of een mail aan een beslisser zonder goedkeuring per stuk; het dagplafond van 40 per gebruiker wordt afgedwongen; een antwoord of bounce stopt de reeks.
11. Een campagne die 10 procentpunten of meer achterloopt, geeft het inzicht "Campagne loopt achter" (cadans 2 dagen).
12. Na de einddatum staat de campagne op "Afgerond" met samenvatting.
13. Telefoon (8.12, 8.15, 8.16): op 375, 390 en 412 px zijn lijst en bord leesbaar zonder horizontale scroll; de wizard toont "Beter op een groot scherm" en werkt wel; tikdoelen minimaal 44 px.
14. Offline (8.8): taken uit een campagne afronden en een kolomwissel met uitkomst slagen offline en komen na herstel één keer aan (idempotent op item en stap).
15. Niveaus: als Beginner geen "+ Campagne" (knop met slot en uitleg), wel taken uitvoeren en het bord lezen; als Gevorderd de acht startsoorten; als Expert alle soorten, tussendoelen en mailreeks op mandaat B. Getest per niveau.
16. AI-stappen met schema, mock en golden master; een boodschap bewaart `vvVersies`; zonder AI-credits (of op Starter, waar de AI-soort concept niet aanstaat) werkt de wizard met de vaste scripttekst.

## Definition of Done

Hoofdstuk 19 geldt volledig. Specifiek voor deze prompt:

- Playwright-kernflow "campagne naar afspraak" (19) groen op desktop; lijst en bord op 390 px.
- Testdata: Voltvast (Bijlage C) met een campagne op br-01 met winpunt wp-01 en een campagne op br-03 voor de dekkingsmelding; accounts fictief.
- Bijlage A regels 13 en 38 afgevinkt in het sprintverslag.
- Helpartikel "Een campagne opzetten" en het handboek bijgewerkt.
