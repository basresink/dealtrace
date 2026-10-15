# P31: Spraak, visitekaartje en onderweg-meldingen

| Onderdeel | Waarde |
|---|---|
| Sprint | 8 |
| Features | F24 (meldingen, mobiel), hoofdstuk 8 (8.5.6, 8.6, 8.9, 8.10) |
| Hangt af van | P01 (functiecatalogus, sync), P27 (mobiele schil, compacte kop met "Inspreken", Web Push basis), P03 (contacten, ontdubbelen), P07 (taken, notities), P08 (Bewaker), P10 (belmodus, "Hoe ging het?"), P13 (afspraken, meetingsoorten), P14 (routedienst, klaarzetten), P30 (Bezoek afronden, opname en bijlagen, dagpakket), P32 (Vandaag op de telefoon, "Lees voor"), P33 AI-assistent en credits (`creditsVoor`, reservering; inspreken in de chat) |
| Bron in het bouwplan | 8.1, 8.2, 8.5.6, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11, 8.14, 8.15, 8.16, F24, 11.2, 11.4 (credits voor spraak en transcriptie), 12 (rij Transcriptie), 13.5 (lokaal bouwen), 15.2, 22 (open vragen 13 en 17) |

## Lees eerst

- `Bouwplan-Dealtrace.md`: hoofdstuk 8 volledig, met nadruk op 8.5.6, 8.6, 8.9 en 8.10; F24 (meldingen); F09 (afspraak), F04 en 15.1 (ontdubbelen van contacten); 11.2 (vangrails), 11.3 (Notulist, mandaat), 11.4 (rijen Spraakopdracht en visitekaartje, Transcriptie); 12 (Transcriptie); 15.2 (spraakopnames, AI-verwerking); 19; 21 (risico's PWA op iOS en spraak buiten de EU); 22 (vragen 13, 17, 18); Bijlage B (rijen Telefoon, Meldingen en PWA, AI).
- DealDrive op commit 75bee61: `app/pages/dex/spraak.vue`, `app/pages/dex/meldingen.vue`, `app/pages/dex/concept.vue`, `server/api/dex/opdracht.post.ts`, `server/utils/dexOpdracht.ts` (één zin wordt één concept; account uit een lijst van echte namen, daarna gecontroleerd), `server/api/dex/verslag-extract.post.ts`, `server/utils/dexVerslagAnalyse.ts`, `server/utils/dexPlafond.ts`, `shared/dexSignalen.ts`, `shared/dexRecap.ts`, `app/composables/useDexMeldingen.ts`, `app/components/TranscriptUpload.vue`, `server/utils/pushVerzenden.ts`, `server/utils/reminderSweep.ts`, `server/utils/overzichtSweep.ts`, `app/composables/useWebPush.ts`, `app/components/PushSoftPrompt.vue`, `public/push-sw.js`.

## Deel 1: Functioneel (wat en waarom)

### Wat je bouwt

Je bouwt inspreken met transcriptie in de EU, de spraakopdracht die na "Bewaar" een echte taak, notitie of afspraak maakt, voorlezen voor het oor, het scannen van een visitekaartje tot conceptcontact, en de pushmeldingen voor onderweg met stille uren en een dagplafond.

### Waarom

Rijden is geen werkmoment (8.2 punt 7): onderweg leest Dealtrace voor en luistert het. In Dex bleef een goedgekeurd spraakconcept een concept, telden meldingen alleen met de app open en gold "gelezen" per apparaat (8.1). Een visitekaartje overtypen bij de receptie kost tijd en levert fouten. Spraak mag geen klantnamen naar een dienst buiten de EU sturen (21).

### Gebruikers en niveaus

| Rol | Niveau | Wat |
|---|---|---|
| Accountmanager | Beginner | Inspreken in elk tekstveld met een microfoon; spraakopdracht voor taak en notitie; voorlezen van dag, briefing en recap; vertrek-, briefing- en verslagmeldingen; dagrecap |
| Accountmanager | Gevorderd | Plus spraakopdracht voor afspraak en mail (mail blijft concept); visitekaartje scannen; handsfree belmodus en voorlezen van scripts; aankomst- en hete-aanleidingmelding |
| Accountmanager | Expert | Plus eigen meldingsplafond en stille uren per soort (8.11); rijmodus volgt in sprint 12 |
| Salesmanager | rol | Meldingen van het team die op goedkeuring wachten (8.12) |
| Beheerder | rol | Per organisatie: opnames bewaren (bewaartermijn in Privacy), browserherkenning van Chrome aan of uit (standaard uit), dagplafond en stilte |

### Schermen

**Spraakopdracht** (schuifvenster, opent vanuit de microfoon in de compacte kop, 8.3 en 8.5.6), van boven naar beneden:

1. Kop "Inspreken" met het gekozen account als pil als je op een accountkaart of in een bezoek staat; anders "Geen account gekozen" (voorstel).
2. Grote microfoonknop, tijdens opnemen een golfbalk en "Stop". Voorvertoning van de tekst via de Web Speech API waar beschikbaar en toegestaan; anders "Je tekst verschijnt zo" (voorstel).
3. Het concept: soort (taak, notitie, afspraak, mail), account, persoon, titel, datum, en checks (bijvoorbeeld "Account gevonden", "Datum gelezen als dinsdag 21 oktober").
4. Bij twijfel over het account de vraag welke van twee namen je bedoelt, met twee knoppen.
5. Knoppenrij: "Aanpassen" en "Bewaar" (primair).

Voorbeeldzinnen uit het bouwplan: "Bel Marieke volgende week dinsdag over de projectschouw", "Noteer dat de DGA in september terug is". Lege of onverstaanbare opname: Niet vastgelegd in het bouwplan; voorstel: "Dat verstond ik niet. Probeer het nog eens of typ je opdracht."

**Microfoon in tekstvelden**: elk tekstveld met een microfoon (verslag in Bezoek afronden, "Hoe ging het?", notitie, beschrijving) gebruikt dezelfde component `VerslagVeld.vue` (8.13). De opname komt uit P30; deze prompt voegt de transcriptie toe.

**Visitekaartje scannen** (Gevorderd): knop "Scan visitekaartje" in Bezoek afronden (blok Nieuwe contactpersoon) en op de compacte accountkaart (voorstel). Camera, foto, daarna het conceptcontact: naam, functie, bedrijf, telefoon, mail, gekoppeld aan het account van het bezoek of met een voorstel voor een nieuw account. Bij een mogelijk duplicaat: Niet vastgelegd in het bouwplan; voorstel: "Lijkt op Peter Kok bij dit account. Samenvoegen of toch nieuw?" Knoppen "Bewaar contact" en "Aanpassen". Offline wacht de foto in de wachtrij met de regel "Wordt gelezen zodra je verbinding hebt" (voorstel).

**Voorlezen**: knop "Lees voor" (luidspreker) op Vandaag (groet), in de Pitstop, in de recap en in de belmodus met handsfree. Tekst voor het oor: hele zinnen, bedragen uitgeschreven, via de spraaksynthese van het toestel in `nl-NL`, hooguit 60 seconden.

**Handsfree belmodus** (Gevorderd, 8.5.4): schakelaar "Handsfree" in de belmodus. Dealtrace leest naam, reden en opening voor, belt na "Bel" via de carkit, en vraagt na het gesprek met spraak "Hoe ging het?"; je antwoordt met "gesproken", "niet bereikt" of "terugbellen". Afbakening: Niet vastgelegd in het bouwplan of P10 of P31 de schakelaar bouwt; voorstel: P10 bouwt de belmodus, P31 levert de voorleestekst en de herkenning van de drie antwoorden.

**Meldingen** (`/meldingen` en de bel in de compacte kop met rode teller, "9+" boven negen). Pushmeldingen voor onderweg:

| Melding | Wanneer | Inhoud en actie |
|---|---|---|
| Vertrek | reistijd plus 10 minuten voor een afspraak | "Vertrek over 10 minuten naar Bakker Bouw" · "Navigeer" (8.6 noemt ook "(24 min rijden)") |
| Briefing | 30 minuten voor een afspraak | Pitstop in drie regels · "Lees voor", "Open" |
| Verslag | 15 minuten na het einde van een afspraak zonder verslag | "Hoe ging het bij Bakker Bouw?" · "Inspreken" |
| Hete aanleiding | nieuw inzicht met hoge urgentie op een eigen account | bron in één regel · "Open" |
| Klaargezet | een collega zet een kans klaar voor jouw regiodag | account en reden · "Bekijk" |
| Dagstart | zelfgekozen tijd, standaard 07:45 | "3 bezoeken, 5 belacties. Eerst: Bakker Bouw om 09:30." · "Lees voor" |
| Recap | na de laatste afspraak of 17:00 | "De dag rond: 2 verslagen ontbreken" |

Let op: F24 noemt de dagstart om 08:00, 8.10 standaard 07:45; hoofdstuk 8 gaat voor (8, inleiding). Dagstart en recap bestaan al vanaf sprint 5 (8.6); deze prompt brengt ze onder dezelfde meldingsregels.

**Mijn instellingen, Meldingen**: per soort aan of uit, stille uren (standaard 19:00 tot 07:00 en het weekend), tijd van de dagstart; Expert ook eigen plafond en stille uren per soort. **Mijn instellingen, Spraak** (voorstel): "Snelle voorvertoning in de browser" alleen zichtbaar als de organisatie hem aanzette.

**Telefoon (390 px).** De microfoon staat op elk scherm in de compacte kop (44 bij 44 px). De spraakopdracht en het visitekaartje zijn schuifvensters met de primaire knop rechts onderin. De meldingsstrook verschijnt boven de onderbalk.

### Klikpaden met tikken (8.7)

1. Taak inspreken: microfoon (1), praten, "Bewaar" (2). De taak staat binnen één seconde als echte taak op de accountkaart, op telefoon en laptop (8.16).
2. Notitie op een account tijdens een bezoek: microfoon (1), praten, "Bewaar" (2).
3. Visitekaartje: "Scan visitekaartje" (1), foto (2), "Bewaar contact" (3).
4. Verslag na een pushmelding: tik op de melding "Hoe ging het bij Bakker Bouw?" (1) opent Bezoek afronden met de microfoon actief (voorstel); verder als 8.5.3.
5. Briefing in de auto: melding "Lees voor" (1).
6. Concept-opvolgmail versturen: bel, concept, "Goedkeuren", "Verstuur via je mail" (4; het conceptscherm bouwt P18, het tikdoel geldt hier ook voor de melding).

### Regels

- Inspreken: opname in de browser (MediaRecorder), transcriptie op de server via een EU-transcriptiedienst; Web Speech API alleen als snelle voorvertoning waar beschikbaar (8.9).
- De transcriptie gaat nooit via een dienst buiten de EU; de browserherkenning van Chrome (via Google) staat standaard uit en is per organisatie aan te zetten.
- Een opname wordt na transcriptie verwijderd, tenzij de organisatie bewaren aanzet (bewaartermijn in Privacy). Transcripten 12 maanden (15.2).
- Een spraakopdracht maakt na "Bewaar" direct een echte taak, notitie of afspraak via de schrijflaag; alleen berichten aan een prospect blijven concept tot goedkeuring. Dealtrace verstuurt nooit zelf een eerste bericht.
- Het account moet bestaan: het model kiest uit de lijst eigen accounts, de server controleert de keuze; herkent het niets, dan volgt een vraag in plaats van een concept (8.14, `dexOpdracht.ts`).
- Een persoon wordt pas na het vaststellen van het account opgezocht tussen de contacten van dat account; twee treffers geven een keuze, geen gok (`dexOpdracht.ts`).
- Visitekaartje: AI leest naam, functie, bedrijf, telefoon en mail; ontdubbelen op mail en telefoon; telefoon naar E.164, e-mail syntaxis plus MX (15.1); nooit privégegevens buiten het kaartje.
- Privémail en privémobiel worden gemaskeerd vóór elke AI-aanroep (11.2).
- Voorleesteksten komen uit pure functies, zijn hooguit 60 seconden en bevatten geen opsommingstekens.
- Meldingen: stille uren standaard 19:00 tot 07:00 en het weekend; dagplafond van zes onderweg-meldingen; bundelen tijdens rijmodus en belblok; "gelezen" geldt op alle apparaten (opgeslagen op de server, niet in localStorage).
- Push werkt op iOS alleen in een geïnstalleerde PWA (iOS 16.4 en hoger); de installatievraag met iOS-uitleg komt na de tweede dag van gebruik (8.14, 8.15).
- Offline: inspreken bewaart de opname; transcriptie en interpretatie volgen bij verbinding. Niet vastgelegd in het bouwplan hoe een offline spraakopdracht eindigt; voorstel: de opname gaat als `spraak.opdracht` in de wachtrij, de server maakt bij verbinding het concept en zet het in Concepten met een melding "Je opdracht van 10:42 staat klaar", waarna "Bewaar" volgt.

### Helpartikelen

- "Inspreken in plaats van typen" (F21, Mobiel): hoe je inspreekt, waar de opname heen gaat, dat transcriptie in de EU gebeurt en dat de opname daarna verdwijnt.
- "Meldingen instellen" (Aan de slag): soorten, stille uren, dagplafond, push installeren op iOS.
- "Dealtrace op je telefoon en offline": visitekaartje en handsfree.

## Deel 2: Technisch (hoe)

### Datamodel

- `bijlagen` (P30) met `soort = 'opname'|'visitekaartje'`; status `lokaal`, `verstuurd`, `verwerkt`.
- `notificaties: id, organisation_id, gebruiker_id, soort, titel, tekst, link, gelezen_op, op` (8.14 en F24; F24 noemt `gelezen`, 8.14 `gelezen_op`; hoofdstuk 8 gaat voor: `gelezen_op`).
- `push_subscriptions` per toestel (F24).
- Transcripten: Niet vastgelegd in het bouwplan als tabel; voorstel: `transcripten: id, organisation_id, bijlage_id, record_soort, record_id, tekst, taal, dienst, duur_sec, op` met bewaartermijn 12 maanden.
- Instellingen: `meldingsregels` per organisatie (dagplafond, stille uren) en per gebruiker (`users.data.meldingen`), `spraak` per organisatie (`opnamesBewaren`, `bewaartermijnDagen`, `browserherkenning`). Sleutelnamen voorstel.
- RLS: `org_isolation` op alle tabellen; notificaties en push-abonnementen alleen voor de eigen gebruiker.
- Sync-allowlist en offline-mutatiesoorten (8.14): `spraak.opdracht`, `contact.uitVisitekaartje`, plus `notificatie.gelezen` (voorstel, zodat gelezen offline wordt doorgegeven).

### Pure functies

| Functie | Waar | Invoer en uitvoer | Randgevallen en tests |
|---|---|---|---|
| `spreekDag(dag, gebruiker, nu)` | `shared/spreek.ts` | tekst voor het oor | geen afspraken; bedragen uitgeschreven; hooguit 60 seconden bij 150 woorden per minuut (voorstel als meetregel) |
| `spreekBriefing(briefing)` | idem | tekst | blokken zonder inhoud overslaan |
| `spreekRecap(recap)` | idem | tekst | nul ontbrekende verslagen |
| `spreekBelOpening(script, account)` (voorstel) | idem | tekst | script zonder AI-invulling |
| `herkenAntwoord(tekst)` (voorstel) | idem | `gesproken`, `niet_bereikt`, `terugbellen` of null | varianten als "niet opgenomen" |
| `magMelden(gebruiker, soort, nu, telling)` | `shared/meldingsregels.ts` | `{versturen, uitstellenTot?, reden}` | stille uren, weekend, dagplafond 6, belblok en rijmodus bundelen, Expert per soort |
| `vertrekTijd(afspraak, reistijdMin)` | `shared/meldingsregels.ts` | tijdstip | reistijd onbekend: schatting uit P14 |
| `normaliseerVisitekaartje(veld)` (voorstel) | `shared/ontdubbelen.ts` | genormaliseerd contact | E.164, hoofdletters in namen, lege velden |

Testset `test:spreek` (8.14); tests op lengte en het ontbreken van opsommingstekens.

### Endpoints

| Methode en route | Recht | Invoer | Uitvoer | Fouten |
|---|---|---|---|---|
| `POST /api/spraak/transcribeer` | ingelogd, functie `spraak.inspreken` | opname (bijlage-id) | tekst | 413 te lang; 502 dienst; opname verwijderd na succes tenzij bewaren aan |
| `POST /api/spraak/opdracht` | functie `spraak.opdracht` | tekst, accountId? | concept `{soort, accountId, contactId?, titel, datum?, checks[]}` of vraag `{kandidaten[2]}` | 422 schema na één herhaling; 403 soort boven niveau (afspraak of mail als Beginner) |
| `POST /api/sync/mutations` (`spraak.opdracht`) | als boven | bewaard concept | echte taak, notitie of afspraak | idempotent op sleutel |
| `POST /api/contacten/visitekaartje` | functie `contact.visitekaartje` | foto (bijlage-id), accountId? | conceptcontact met mogelijke duplicaten | 422 onleesbaar |
| `GET /api/notificaties`, `POST /api/notificaties/:id/gelezen` (voorstel) | eigen | geen | lijst; gelezen_op | |
| `POST /api/push/abonneer`, `DELETE /api/push/abonneer` (voorstel) | eigen | push-abonnement | ok | |
| Geplande functie `onderweg-meldingen` | systeem | elke 5 minuten | verstuurt vertrek, briefing en verslag | logt overgeslagen meldingen met reden |

### AI-stappen

| Stap | Agent en mandaat | Materiaal | Schema | Vangrails | Mock | Credits (11.4) |
|---|---|---|---|---|---|---|
| Spraakopdracht | Notulist-familie, A voor het concept; opslaan is een menselijke handeling | getranscribeerde zin, lijst eigen accounts (naam, plaats), contacten van het gekozen account | `{soort, accountNaam, persoonNaam?, titel, datum?, tijd?}` met `additionalProperties false` | account moet in de lijst staan; geen privégegevens; één herhaling bij schemafout | vaste zinnen met verwachte concepten | Spraakopdracht: 1 credit (Starter, Plus, Compleet) |
| Visitekaartje lezen | Profielbouwer-familie, A voor het conceptcontact | foto van het kaartje | `{naam, functie?, bedrijf?, telefoon?, email?}` | alleen wat op het kaartje staat; geen aanvulling uit het web | vaste foto's met verwachte velden | Visitekaartje: 2 credits (Starter, Plus, Compleet) |

De modelkeuze per soort staat in de AI-koppeling (F23). De prijs komt uit `creditsVoor` (P33), met reservering vóór de aanroep. Golden masters voor beide prompts (19).

### Integraties

- Transcriptie (12): EU-dienst achter een adapter met mock; keuze na een proef met tien echte verslagen (open vraag 17). Adapter `server/utils/transcriptie.ts` (naam voorstel) met `transcribeer(opname, taal)`. Kosten in AI-credits: 1 credit per begonnen minuut (11.4, Starter, Plus, Compleet), via `creditsVoor` uit P33; bij 0 credits blijft de opname bewaard en wordt hij getranscribeerd zodra er weer credits zijn (voorstel).
- Lokaal (13.5): transcriptie en AI op hun mock (`AI_PROVIDER=mock`), geen sleutel en geen kosten; op een echte telefoon test je via `pnpm dev --host` in hetzelfde wifi-netwerk; Web Push op iOS vraagt een geïnstalleerde PWA over HTTPS en wordt op staging getest.
- Web Push: VAPID, `push_subscriptions`, `pushVerzenden.ts`, service worker uit P27.
- Routedienst (P14) voor de reistijd in de vertrekmelding.
- Opnemen van gesprekken: nee (open vraag 13); alleen aantekeningen, inspreken en geplakte transcripten.

### Functiecatalogus

Sleutels niet vastgelegd in het bouwplan; niveaus uit 8.6 en 8.11; voorstel:

| Sleutel | Niveau | Pakket | Recht | Helpartikel |
|---|---|---|---|---|
| `spraak.inspreken` | Beginner | Starter | eigen records | "Inspreken in plaats van typen" |
| `spraak.opdracht` (taak, notitie) | Beginner | Starter (credits, 11.4) | taken schrijven | idem |
| `spraak.opdrachtUitgebreid` (afspraak, mail) | Gevorderd | Starter (credits, 11.4) | afspraken schrijven | idem |
| `spraak.voorlezen` | Beginner | Starter | ingelogd | idem |
| `spraak.handsfree` | Gevorderd | Starter | ingelogd | "Dealtrace op je telefoon en offline" |
| `contact.visitekaartje` | Gevorderd | Starter (credits, 11.4) | contacten schrijven | idem |
| `meldingen.onderweg` | Beginner | Starter | ingelogd | "Meldingen instellen" |
| `meldingen.perSoort` | Expert | Starter | ingelogd | idem |

Spraakopdracht, visitekaartje en transcriptie staan volgens 11.4 aan in elk pakket en kosten credits uit de pot van de organisatie. Zijn de credits op, dan werkt inspreken als opname die wacht en tikt de gebruiker zijn opdracht of contact zelf in. Het niveau is de startindeling; de founder zet functies per niveau aan of uit (P09 Helpcenter basis en features per niveau).

### Hergebruik uit DealDrive (8.13, Bijlage B)

- `dexOpdracht.ts` en `opdracht.post.ts`: tweestaps herkenning (account uit lijst, dan persoon); aanpassen zodat "Bewaar" een echte taak, notitie of afspraak schrijft via `POST /api/sync/mutations` in plaats van een concept in de inbox.
- `dexVerslagAnalyse.ts`, `verslag-extract.post.ts`: basis voor de verwerking na transcriptie (de Notulist zelf in P19).
- `dexRitme.ts` (`spreekRitme`) en `dexRecap.ts` naar `shared/spreek.ts` en `shared/recap.ts`.
- `dexSignalen.ts` (governor, dagplafond, stilte) en `dexPlafond.ts` naar `shared/meldingsregels.ts`.
- `TranscriptUpload.vue` naar `VerslagVeld.vue`; `DexMelding.vue` naar `Meldingsstrook.vue`.
- `pushVerzenden.ts`, `reminderSweep.ts`, `overzichtSweep.ts`, `useWebPush.ts`, `PushSoftPrompt.vue`, `push-sw.js`: letterlijk, plus de nieuwe meldingssoorten en `gelezen_op` op de server.
- `/api/dex/*` vervalt (geen tweede schrijfweg).

### Buiten scope

- Rijmodus (Expert, sprint 12) en meldingen bundelen tijdens rijmodus worden hier alleen als regel in `magMelden` voorbereid.
- WhatsApp en de overige kanalen (P26), e-mailmeldingen.
- Notulist en verslaganalyse naar actiepunten en koopsignalen (P19).
- Een native app voor achtergrondlocatie of CarPlay en Android Auto (open vraag 18).

## Acceptatiecriteria

1. Bijlage A noemt P31 niet in de kolom Prompt; regel 16 geldt: meldingsregels en voorleesteksten staan één keer in `shared/`.
2. Een spraakopdracht staat na "Bewaar" binnen één seconde als echte taak of notitie op de accountkaart, op telefoon en laptop (8.16).
3. Tikdoelen (8.7): taak inspreken 2 plus praten; visitekaartje 3; geteld in Playwright.
4. Een spraakopdracht met een onbekend account maakt geen concept maar stelt een vraag; een verzonnen account wordt door de server geweigerd.
5. Een opname gaat alleen naar de EU-dienst (adaptertest) en is na transcriptie verwijderd als bewaren uit staat; de browserherkenning staat standaard uit.
6. Een visitekaartje met een e-mailadres dat al bij het account bestaat, maakt geen tweede contact.
7. Voorleesteksten zijn hooguit 60 seconden en zonder opsommingstekens (`test:spreek`).
8. Push komt binnen op iOS (geïnstalleerde PWA) en Android, respecteert stille uren en het dagplafond van zes, en "gelezen" is gelijk op alle apparaten (8.16).
9. De vertrekmelding komt op reistijd plus 10 minuten voor de afspraak; de briefingmelding 30 minuten vooraf; de verslagmelding 15 minuten na het einde zonder verslag.
10. Offline (8.8, 8.15): inspreken in Bezoek afronden en een spraakopdracht slagen zonder verbinding, met zichtbare status, en worden na herstel precies één keer verwerkt (Playwright met `context.setOffline(true)`).
11. Toestellen (8.15): getest op de vijf toestellen; scenario 4 (bellen via de carkit met handsfree, geen scherm nodig tussen twee gesprekken); VoiceOver en TalkBack op de spraakopdracht; tikdoelen minimaal 44 px.
12. AI: elk antwoord binnen het schema of één herhaling, daarna een fout zonder opslag; mock en golden master aanwezig; privégegevens gemaskeerd.
13. Niveaus (8.11): als Beginner spraakopdracht voor taak en notitie, geen afspraak of mail (functie niet aangezet, met uitleg en helpartikel), geen visitekaartje; als Gevorderd ook afspraak, mail, visitekaartje en handsfree; als Expert ook meldingsregels per soort. Getest per niveau.
14. Cross-tenant: opnames, transcripten en notificaties van organisatie A zijn onzichtbaar voor B (Storage-RLS en database).

## Definition of Done

Hoofdstuk 19 geldt volledig. Specifiek voor deze prompt:

- Transcriptie-adapter met mock; alles draait lokaal (13.5); geen netwerk in tests; één echte proefrun met kosten per minuut in het sprintverslag (open vraag 17).
- Golden masters voor spraakopdracht en visitekaartje; testkaartjes zijn fictief (personen en bedrijven in de lijn van Voltvast, Bijlage C), nooit echte kaartjes.
- Pushmeldingen gedemonstreerd op een echte iPhone (geïnstalleerde PWA) en een echte Android.
- Helpartikelen "Inspreken in plaats van typen" en "Meldingen instellen" en het handboek bijgewerkt.
