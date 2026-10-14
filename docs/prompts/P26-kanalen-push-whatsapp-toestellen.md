# P26: Kanalen, push, WhatsApp en tests op echte toestellen

| Onderdeel | Waarde |
|---|---|
| Sprint | 12 (Platform en afronding) |
| Features | F24 Meldingen, zoeken, mobiel en offline (compleet: alle meldingssoorten, kanalen per soort, Web Push); integratie WhatsApp Business uit hoofdstuk 12 met de Berichtgever; kanalen en consent; tests op echte toestellen (8.15) en de prestatiebudgetten |
| Hangt af van | P01 (meldingen basis, functiecatalogus), P27 (mobiele schil, inloggen met code, PWA), P31 (onderweg-meldingen: vertrek, briefing, verslag, recap, `shared/meldingsregels.ts`), P32 (Vandaag op de telefoon), P03 (consent per contact, bel-me-niet), P08 (Bewaker: consent, afkoeling, plafonds), P16 (mailreeksen, Verzender), P18 (concepten, Schrijver, mail versturen, `wa.me`-link), P30 (onderweg, offline dag), en elke eerdere prompt met een scherm voor de toesteltests |
| Bron in het bouwplan | F24; 8.10; 8.15; 8.14 (PWA, meldingen, prestatiebudget); 8.6 (Rijmodus); 8.11; 8.16; hoofdstuk 12 (rijen WhatsApp Business, Mail, Telefonie); 11.3 (Berichtgever, Verzender, mandaat per niveau); 11.5 (lengte WhatsApp 60 woorden); 7.2 (afkoelperiode WhatsApp 180 dagen); F04 (toestemming en voorkeur); F16 punt 6 (afkoelperiodes en consent, frequentieplafond); F22 (Kanalen en consent, Bel-me-niet-lijst); 13.4; 15.2; 15.3; 16.4; hoofdstuk 19; open vragen 11 en 12; Bijlage A (geen regel noemt P26; regels 23 en 37 raken deze prompt) |

## Lees eerst

- Bouwplan-Dealtrace.md: F24 volledig, hoofdstuk 8 met nadruk op 8.2 punt 8, 8.6 (Rijmodus), 8.10, 8.11, 8.14 (Meldingen, PWA, Prestatiebudget), 8.15, 8.16; hoofdstuk 12 (WhatsApp Business, Mail, Telefonie, slotalinea); 11.2, 11.3, 11.5; 7.2; F04 "Toestemming en voorkeur"; F12 "Mailreeks"; F16 punt 6; F22 (groep Data en AI, Persoonlijke instellingen); 13.4; 15.2 (rijen WhatsApp, Bellen, Zakelijke contactpersonen); 15.3; 16.4; hoofdstuk 19; hoofdstuk 21 (risico's PWA op iOS en telefoonervaring); open vragen 11 en 12; Bijlage A regels 23 (P01) en 37 (P10, P13), die deze prompt niet mag breken.
- DealDrive op commit 75bee61:
  - `server/utils/pushVerzenden.ts` (één verzendpad, organisatie verplicht, dode aanmeldingen opruimen), `server/api/push/subscribe.post.ts`, `subscribe.delete.ts`, `send.post.ts`
  - `app/composables/useWebPush.ts`, `app/components/PushSoftPrompt.vue`, `app/components/NotificationBell.vue`, `app/pages/notificaties.vue`, `app/pages/instellingen/notificaties.vue`
  - `server/utils/reminderSweep.ts`, `server/utils/overzichtSweep.ts`
  - `app/components/InstallPrompt.vue`, `app/components/IOSInstallModal.vue`, `app/components/OfflineBanner.vue`, `app/components/MobileShell.vue`
  - `server/utils/mailVersturen.ts`, `server/utils/mailProviders.ts`, `server/utils/mailConnectionStore.ts`
  - `playwright.config.ts`

## Deel 1: Functioneel (wat en waarom)

### Wat je bouwt

De complete meldingenlaag (alle soorten, kanalen in-app, e-mail en Web Push per soort, stille uren, dagplafond, bundelen), de pagina Kanalen en consent met de bel-me-niet-lijst, WhatsApp Business uit goedgekeurde sjablonen met opt-in via de Berichtgever, de rijmodus, en de testronde op echte toestellen met de prestatiebudgetten.

### Waarom

Meldingen tellen in DealDrive alleen met de app open en "gelezen" gold per apparaat; mail en WhatsApp gingen via kopiëren en plakken (8.1). De vlag "meldingen stil" van een belblok deed niets (Bijlage A regel 37, opgelost in P10 en P13 met de meldingswachtrij die deze prompt compleet maakt). Push vanaf het begin is een uitgangspunt (8.2 punt 8). WhatsApp vraagt toestemming (15.2) en mag nooit zonder opt-in. En de telefoonervaring mag niet achterblijven: een bouwprompt met een scherm is pas klaar als hij op echte toestellen is getest (8.16).

### Gebruikers en niveaus

| Rol | Niveau | Wat |
|---|---|---|
| iedereen | Beginner | Meldingen ontvangen in-app, per e-mail en als push; per soort aan of uit en stille uren in Mijn instellingen; meldingenpagina; WhatsApp-concept goedkeuren en openen in WhatsApp (mandaat C) |
| iedereen | Gevorderd | Idem; handsfree en bundelen tijdens het belblok |
| iedereen | Expert | Plus rijmodus, eigen meldingsplafond en stille uren per soort (8.11) |
| salesmanager | Gevorderd of Expert | Meldingen over het team (campagne loopt achter, niveauvoorstel, concepten van het team die wachten) |
| beheerder | Expert | Kanalen en consent, bel-me-niet-lijst, WhatsApp-koppeling en sjablonen, mailkoppeling; meldingen "leverancier werkt in je organisatie" en "bundel op 80 procent" |
| founder | n.v.t. | Geen eigen functies in deze prompt; ziet koppelingsfouten in Platformbeheer (P24) |

### Schermen

**1. Meldingen** (`/meldingen`, bel onderaan de zijbalk of in de compacte kop)

- Rijen met een kleurbalk per soort: kritiek rood, hete aanleiding paars, dagstart blauw, herinnering geel, inzicht groen; per rij titel, tekst, tijd en "Openen", "Markeer gelezen", "Verberg".
- Bovenaan "Alles gelezen" (niet vastgelegd; voorstel).
- Lege staat: "Geen meldingen. Je hoort het hier zodra er iets voor je klaarstaat." (voorstel).
- Soorten: herinnering (taak of afspraak); dagstart; nieuwe hete aanleiding bij een eigen account; concept klaar ter goedkeuring; afspraak gemaakt door een collega voor jou; kans klaargezet door de binnendienst; campagne loopt achter; niveauvoorstel en ontgrendeling; coachingafspraak gedeeld; leverancier werkt in je organisatie (beheerder); bundel op 80 procent (beheerder). Op de telefoon daarnaast vertrek, briefing, verslag en recap (8.10).

**2. Mijn instellingen, Meldingen** (iedereen): per soort de kanalen "In de app", "E-mail", "Push" als schakelaars; stille uren (standaard 19:00 tot 07:00 en het weekend); tijd van de dagstart (standaard 07:45 op de telefoon, 8.10; F24 noemt 08:00 voor de dagstart in de app, zie Regels); toestellen met push en "Verwijder dit toestel"; "Uitloggen op alle toestellen". Expert: eigen dagplafond en stille uren per soort. "Foto's en opnames alleen via wifi versturen" staat onder Offline (8.8).

**3. Kanalen en consent** (Instellingen, Data en AI; beheerder). Niet vastgelegd welke route; voorstel `/instellingen/kanalen`. Opbouw (voorstel, inhoud vastgelegd in F16, F22, 7.2, 15.2):

1. Kop: kruimelpad "Instellingen", kicker "DATA EN AI", titel "Kanalen en consent".
2. Tabel per kanaal (bellen, mail, LinkedIn, WhatsApp, bezoek, kaart): afkoelperiode na een nee (90, 60, 90, 180, 180, 365 dagen), frequentieplafond (maximaal één bericht per kanaal per 3 werkdagen buiten het ritme), aan of uit.
3. Mail: afzender, SPF, DKIM en DMARC als voorwaarde met status, afmeldlink, onderdrukkingslijst (aantal, gehasht).
4. WhatsApp: koppeling met de provider (status, "Test verbinding"), sjablonen met status en taal, opt-in-tekst.
5. Bel-me-niet-lijst: aantal nummers, toevoegen, verwijderen met reden, "Exporteren".

**4. WhatsApp in het werk**

- Concepten (8.5.7): een WhatsApp-tekst van de Schrijver (hooguit 60 woorden) staat in Concepten met maker, aanleiding, tekst, bewijs en "Goedkeuren", "Aanpassen", "Verwerpen". Na goedkeuren: met koppeling "Verstuur via WhatsApp" (sjabloon van de organisatie, opt-in vereist); zonder koppeling opent WhatsApp met de tekst ingevuld (`https://wa.me/<nummer>?text=`).
- Plakkende actiebalk op de compacte accountkaart en contactkaart: "WhatsApp" uitgegrijsd met tooltip als er geen mobiel nummer is ("Geen mobiel nummer bekend") of als de toestemming ontbreekt (tekst voorstel: "Geen toestemming voor WhatsApp").
- Contactflyout: toestemming "E-mail" en "WhatsApp" met status onbekend, ja, nee, datum en bron; "Voorkeurskanaal"; "Bel me niet" (F04).
- Kaart "Vandaag tegengehouden door de Bewaker" (P19) toont "Geen consent voor WhatsApp".

**5. Rijmodus** (Expert, 8.6): schakelaar, of automatisch na "Navigeer". Alleen grote knoppen (54 px, handschoenmaat) voor "Lees voor", "Inspreken" en "Bel volgende"; meldingen gebundeld tot je stopt. Het bouwplan wijst de rijmodus aan sprint 12 toe maar noemt geen prompt; voorstel: hij hoort hier, omdat hij het bundelen van meldingen bepaalt.

**6. PWA**: installatievraag na de tweede dag van gebruik met iOS-uitleg ("Zet Dealtrace op je beginscherm om meldingen te krijgen", tekst voorstel); na installatie `navigator.storage.persist()`; push pas na een zachte vraag (`PushSoftPrompt`).

**7. Telefoonweergave op 390 px**

- Compacte kop met de bel en rode teller ("9+" boven negen); `/meldingen` schermbreed, rijen van minimaal 48 px; vegen naar links is "Markeer gelezen" (voorstel, in lijn met vegen in F06).
- Meldingsstrook boven de onderbalk voor de uitkomst van een handeling; push opent de juiste pagina via de link in de melding.
- Kanalen en consent staan in Meer met "Beter op een groot scherm".

### Klikpaden

1. **Push aanzetten.** Na de tweede dag vraagt Dealtrace om installatie; na installatie de zachte vraag voor meldingen; "Sta toe" registreert het toestel in `push_subscriptions`.
2. **Briefing-push.** 30 minuten voor een afspraak komt "Pitstop in drie regels" met "Lees voor" en "Open"; tikken opent de Pitstop.
3. **Gelezen op alle toestellen.** Een melding die je op de laptop opent, staat op de telefoon direct als gelezen; de teller daalt op beide.
4. **Stil tijdens een belblok.** Met "meldingen stil" in een belblok worden meldingen vastgehouden tot het einde en daarna gebundeld afgeleverd (F24, regel 37).
5. **WhatsApp met opt-in.** Contact heeft toestemming WhatsApp "ja" met datum en bron. Concept goedkeuren, "Verstuur via WhatsApp": de Berichtgever stuurt het sjabloon via de provider; de activiteit staat in de log met kanaal WhatsApp.
6. **WhatsApp zonder opt-in.** Toestemming "onbekend": de knop "Verstuur via WhatsApp" is er niet; de Bewaker blokkeert en logt "Geen consent voor WhatsApp"; de gebruiker kan wel bellen of mailen.
7. **Bel me niet.** In de contactflyout "Bel me niet": het nummer gaat op de bel-me-niet-lijst en het account verdwijnt uit elke bellijst voor dat nummer.
8. **Rijmodus.** Expert tikt "Navigeer"; de rijmodus gaat aan; een melding "Hete aanleiding" wordt vastgehouden; bij stoppen (rijmodus uit) verschijnen de meldingen gebundeld.

### Filters en sorteren

- `/meldingen`: filter soort en "Ongelezen" (standaard aan); nieuwste eerst; in de URL. Niet vastgelegd welke filters; voorstel.
- Bel-me-niet-lijst: zoeken op nummer; sorteren op datum.

### Regels

- Kanalen per soort: in-app, e-mail, Web Push; per soort aan of uit en stille uren in Mijn instellingen.
- Stille uren standaard 19:00 tot 07:00 en het weekend; dagplafond zes onderweg-meldingen; bundelen tijdens rijmodus en belblok; "gelezen" geldt op alle apparaten (op de server, niet in localStorage) (8.10).
- Dagstart: F24 noemt 08:00 (in-app: afspraken, taken van vandaag, top 3 aanleidingen), 8.10 noemt een zelfgekozen tijd met standaard 07:45 voor de push. Niet eenduidig vastgelegd; voorstel: één instelling "Dagstart" met standaard 07:45 voor alle kanalen, omdat 8.10 voor mobiel voorgaat (hoofdstuk 8 gaat voor alles wat elders over mobiel staat).
- Sweeps: herinneringen elke 5 minuten, dagstart elke 15 minuten, onderweg-meldingen (vertrek, briefing, verslag) elke 5 minuten; regels in `shared/meldingsregels.ts`.
- WhatsApp: alleen uit goedgekeurde sjablonen met opt-in; zonder opt-in geblokkeerd; mandaat C op elk niveau (per stuk goedkeuren); afkoelperiode 180 dagen na een nee; hooguit 60 woorden; frequentieplafond één bericht per 3 werkdagen buiten het ritme.
- Wie een sjabloon goedkeurt is niet vastgelegd; voorstel: de beheerder maakt het sjabloon, de provider of Meta keurt het goed, en pas met status "goedgekeurd" is het kiesbaar.
- Mail: SPF, DKIM en DMARC zijn een voorwaarde; afmeldlink in elke mail aan een prospect; afmelding op de onderdrukkingslijst (gehasht), zodat een nieuwe import niet opnieuw mailt.
- Bellen: bel-me-niet-lijst per organisatie, controle vóór elke bellijst.
- Dealtrace verstuurt nooit zelf een eerste bericht zonder goedkeuring (1.2, 8.5.7).
- Telefonie (klik-om-te-bellen, gespreksduur) is na sprint 12; tot die tijd `tel:`-links (open vraag 12).

### Helpartikelen

- "Meldingen instellen" (Aan de slag): kanalen per soort, stille uren, dagstart, toestellen, rijmodus voor Expert.
- "Dealtrace op je telefoon en offline" (Aan de slag) aanvullen met installeren en push op iOS (alleen na installatie, iOS 16.4 en hoger).
- "Koppelingen" (Inrichten) aanvullen met WhatsApp en "Kanalen en consent". Niet vastgelegd of er een apart artikel "Kanalen en consent" komt; voorstel: ja, in Inrichten.

## Deel 2: Technisch (hoe)

### Datamodel

- `notificaties: id, organisation_id, gebruiker_id, soort, titel, tekst, link, gelezen, op` (F24) met `gelezen_op` op de server (8.14); voorstel aanvullend `kanalen_verstuurd {inApp, email, push}`, `gebundeld_tot`.
- `push_subscriptions` (organisatie verplicht bij verzenden; de tabel valt in DealDrive niet onder RLS, in Dealtrace wel met `org_isolation`, voorstel).
- Meldingsvoorkeuren: niet vastgelegd waar; voorstel `users.data.meldingen {soorten: {[soort]: {inApp, email, push}}, stilleUren {van, tot, weekend}, dagstart, plafond?}`.
- Consent: `contacts.data.consent {email, whatsapp}` met status, datum en bron; `contacts.data.belMeNiet`; `contacts.data.voorkeurskanaal` (F04).
- Bel-me-niet-lijst en onderdrukkingslijst: niet vastgelegd als tabel; voorstel `bel_me_niet (organisation_id, nummer_hash, reden, door, op)` en `onderdrukking (organisation_id, email_hash, bron, op)`, beide met RLS.
- WhatsApp: `koppelingen.soort = 'whatsapp'` (voorstel, de soortlijst in F02 noemt het niet) met geheimen versleuteld; voorstel `whatsapp_sjablonen (id, organisation_id, naam, taal, tekst, status ('concept'|'ingediend'|'goedgekeurd'|'afgewezen'), extern_id)`.
- Kanaalinstellingen: `org_settings` sleutels `afkoeling` en `frequentieplafond` (F16).
- Sync-allowlist: `notificaties` (gelezen als mutatie), consentvelden van `contacts` (al in de sync); nieuwe mutatiesoorten `melding.gelezen` (voorstel) naast de bestaande uit 8.14.

### Pure functies

| Functie | Invoer | Uitvoer | Randgevallen en tests |
|---|---|---|---|
| `magMelden(melding, voorkeuren, nu, stand)` in `shared/meldingsregels.ts` | melding, voorkeuren, tijd, rijmodus of belblok | `verstuur`, `bundel` of `stil` | 18:59 en 19:00; zaterdag; zesde en zevende onderweg-melding; belblok met "meldingen stil" |
| `bundel(meldingen)` | vastgehouden meldingen | één samenvatting per soort | lege lijst; één melding |
| `magWhatsapp(contact, sjabloon, nu)` | contact, sjabloon | toegestaan met reden | opt-in onbekend of nee; sjabloon niet goedgekeurd; afkoeling 180 dagen; frequentieplafond 3 werkdagen met feestdag |
| `waLink(nummer, tekst)` | nummer, tekst | `https://wa.me/<E.164 zonder plus>?text=` | nummer met spaties of 06; tekst met tekens die gecodeerd moeten worden |
| `staatOpBelMeNiet(nummer, lijst)` | nummer | boolean | normalisatie naar E.164 vóór hashen |

`magMelden`, `bundel` en `staatOpBelMeNiet` zijn voorstellen voor namen; `shared/meldingsregels.ts` is vastgelegd (8.14).

### Endpoints

| Methode en route | Recht | Invoer | Uitvoer | Fouten |
|---|---|---|---|---|
| `GET /api/notificaties` | iedereen | `?ongelezen=` | meldingen | |
| `POST /api/notificaties/:id/gelezen` | eigenaar | geen | ok | idempotent; ook via de sync |
| `POST /api/push/subscribe`, `DELETE /api/push/subscribe` | iedereen | aanmelding | ok | organisatie uit de sessie |
| `GET/PUT /api/mij/meldingen` | iedereen | voorkeuren | voorkeuren | niet vastgelegd; voorstel; 403 bij plafond per soort onder Expert |
| `GET/PUT /api/instellingen/kanalen` | beheerder | afkoeling, frequentieplafond, mail, WhatsApp | stand | niet vastgelegd; voorstel |
| `GET/POST/DELETE /api/instellingen/bel-me-niet` | beheerder; toevoegen ook via "Bel me niet" op een contact | nummer, reden | lijst | niet vastgelegd; voorstel |
| `POST /api/whatsapp/sjablonen`, `POST /api/whatsapp/sjablonen/:id/indienen` | beheerder | sjabloon | sjabloon | niet vastgelegd; voorstel |
| `POST /api/whatsapp/verstuur` | eigenaar van het concept na goedkeuring | `{conceptId}` | activiteit | 403 met reden van de Bewaker ("Geen consent voor WhatsApp") |
| `POST /api/whatsapp/webhook` | provider met handtekening | status, opt-out | 2xx | 401 bij ongeldige handtekening; een opt-out zet consent op nee |
| Sweeps `netlify/functions/herinneringen` (5 min), `dagstart` (15 min) | systeem | geen | geen | idempotent per melding en gebruiker |

### AI-stappen

- **Schrijver** (P18) maakt de WhatsApp-tekst, hooguit 60 woorden, met stijlcheck (11.5); bundelsoort "Concept".
- **Berichtgever**: mandaat C op elk niveau; voorstel en uitvoering via de Bewaker `magHandelen(agent, handeling, account, contact, nu)`: consent, afkoeling, ritme, frequentieplafond, werkuren. Mock die het versturen naar de provider nabootst.
- Geen nieuwe AI-aanroep in de meldingenlaag.

### Integraties

- **Web Push** (VAPID): `pushVerzenden.ts` als enige verzendpad; dode aanmeldingen opruimen; iOS alleen in een geïnstalleerde PWA (16.4 en hoger).
- **WhatsApp Business**: provider nog open (open vraag 11, voorstel Meta Cloud API via een Nederlandse provider); adapter `server/utils/bronnen/whatsapp.ts` met `verstuurSjabloon`, `dienSjabloonIn`, `ontvangStatus`; mock met vaste antwoorden; logging in `koppeling_runs`; kosten in het verbruik.
- **Mail**: SMTP van de organisatie of gekoppelde mailbox (P18); e-mailmeldingen. Niet vastgelegd via welk kanaal e-mailmeldingen gaan; voorstel: een transactionele platformafzender, los van de SMTP van de organisatie, zodat meldingen ook zonder mailkoppeling werken.
- **Telefonie**: buiten scope (na sprint 12).

### Functiecatalogus

Niet vastgelegd in het bouwplan welke sleutels; voorstel:

| Sleutel | Niveau | Pakket | Recht | Helpartikel |
|---|---|---|---|---|
| `meldingen` | Beginner | Starter | iedereen | Meldingen instellen |
| `meldingen.perSoortPlafond` | Expert | Starter | iedereen | Meldingen instellen |
| `rijmodus` | Expert | Starter | iedereen | Dealtrace op je telefoon en offline |
| `kanalen.consent` | Expert | Starter | beheerder | Kanalen en consent (voorstel) |
| `whatsapp.versturen` | Beginner | Plus | iedereen met opt-in | Concepten goedkeuren en versturen |
| `whatsapp.koppeling` | Expert | Plus | beheerder | Koppelingen |

### Testen op echte toestellen (8.15)

**Toestelmatrix**, elke sprint vanaf sprint 1 en in deze prompt voor alle schermen:

| Toestel | Breedte | Waarom |
|---|---|---|
| iPhone SE (3e generatie), iOS laatste | 375 px | Kleinste gangbare scherm, Safari, geen thuisbalk |
| iPhone 15 of 16 | 390 tot 393 px | Ontwerpmaat, veilige zones, push in een geïnstalleerde PWA (iOS 16.4 en hoger) |
| Samsung Galaxy A-serie | 360 tot 412 px | Meest verkochte zakelijke Android, Chrome, middenklasse-prestaties |
| Google Pixel 7 of nieuwer | 412 px | Referentie-Android |
| iPad (10e generatie) | 820 px staand | Tabletschil met icoonstrook |

**Geautomatiseerd**: Playwright-projecten voor 375, 390 en 412 px met aanraakmodus; elk scherm uit 8.5 heeft een referentieschermafbeelding en een test op "boven de vouw" (focuskaart en telstrip zichtbaar zonder scrollen); een test die de tikken uit 8.7 telt; offline-tests met `context.setOffline(true)` voor bezoek afronden, uitkomst na bellen en spraakopdracht.

**Handmatige scenario's per sprint**:

1. Een volledige buitendienstdag op de telefoon: drie bezoeken, twee tussenstops, vijf belacties, drie ingesproken verslagen.
2. Een uur in vliegtuigmodus midden op de dag; daarna alles binnen een minuut verstuurd, zonder dubbele records.
3. Buiten in de zon met zonlichtmodus; met werkhandschoenen in handschoenmodus.
4. Bellen via de carkit met handsfree; geen scherm nodig tussen twee gesprekken.
5. Een dag lang accuverbruik meten: Dealtrace hooguit 10 procent bij normaal gebruik.

Aanvullend voor deze prompt (voorstel, binnen de bestaande scenario's): push op iPhone (geïnstalleerd) en Android met stille uren en dagplafond; "gelezen" op telefoon en laptop tegelijk; WhatsApp-concept openen in WhatsApp via `wa.me`.

**Toegankelijkheid**: VoiceOver en TalkBack op de schermen uit 8.5; tekstvergroting tot 200 procent zonder afgekapte knoppen; elk tikdoel minimaal 44 px.

**Prestatiebudgetten** (meten op staging): middenklasse-Android over 4G: eerste weergave van Vandaag binnen 2,5 s (LCP), interactief binnen 3,5 s, volgende opening uit het dagpakket binnen 1 s, JavaScript voor de eerste weergave hooguit 250 KB gecomprimeerd, een tik binnen 100 ms zichtbare reactie (8.14); plus 13.4: Vandaag warm onder 1,0 s desktop en onder 2,0 s op 4G, bootstrap 600 accounts en 3.000 contacten onder 1,5 s en 2 MB, belmodus volgend gesprek onder 300 ms, kansen langs de route onder 800 ms, synchronisatie van 50 mutaties onder 800 ms, app-bundel zonder platformdeel onder 400 kB gezipt.

### Hergebruik uit DealDrive

- `pushVerzenden.ts`, `push/*`, `useWebPush.ts`, `PushSoftPrompt.vue`: letterlijk, met organisatie uit de sessie en RLS op `push_subscriptions`.
- `NotificationBell.vue`, `notificaties.vue`, `instellingen/notificaties.vue`: aanpassen aan "gelezen" op de server en kanalen per soort.
- `reminderSweep.ts`, `overzichtSweep.ts`: basis voor de sweeps; stille uren en plafond via `shared/meldingsregels.ts`.
- `InstallPrompt.vue`, `IOSInstallModal.vue`, `OfflineBanner.vue`: letterlijk, plus de mobiele schil uit hoofdstuk 8 (`MobileShell.vue` vervalt ten gunste van `AppShell.vue`).
- `mailVersturen.ts`, `mailProviders.ts`, `mailConnectionStore.ts`: consent en dagplafond toevoegen.
- `playwright.config.ts`: projecten voor 375, 390 en 412 px toevoegen.

### Buiten scope

Telefonie-koppeling (na sprint 12, open vraag 12); automatisering in LinkedIn (ADR-006); een native app voor achtergrondlocatie en CarPlay of Android Auto (open vraag 18); WhatsApp zonder sjabloon of zonder opt-in.

## Acceptatiecriteria

1. Bijlage A: geen regel noemt P26 in de kolom Prompt. Regel 37 (P10, P13) blijft groen nu de meldingenlaag compleet is: de vlag "meldingen stil" van een belblok houdt meldingen vast tot het einde van het blok en levert ze daarna gebundeld af.
2. Regel 23 (P01) blijft groen: buiten de mock-modus toont de meldingenpagina bij een lege servertabel geen demodata.
3. Pushmeldingen komen binnen op iOS (geïnstalleerde PWA) en Android, respecteren stille uren (19:00 tot 07:00 en het weekend) en het dagplafond van zes onderweg-meldingen, en "gelezen" is gelijk op alle apparaten (8.16).
4. Elke meldingssoort uit F24 en 8.10 is per kanaal aan en uit te zetten; een uitgezet kanaal verstuurt niets.
5. Tijdens de rijmodus worden meldingen gebundeld tot de rijmodus uit is.
6. Een WhatsApp-bericht naar een contact zonder opt-in wordt door de Bewaker geblokkeerd met "Geen consent voor WhatsApp"; met opt-in en een goedgekeurd sjabloon gaat het via de provider (mock) en staat het in de activiteitenlog.
7. Een WhatsApp-bericht binnen 180 dagen na een nee wordt geblokkeerd; een tweede bericht binnen 3 werkdagen buiten het ritme ook.
8. Een opt-out via de provider zet de toestemming op nee met datum en bron.
9. "Bel me niet" verwijdert het account uit elke bellijst voor dat nummer; de bel-me-niet-controle draait vóór elke bellijst.
10. Een mail aan een prospect bevat een afmeldlink; een afgemeld adres staat gehasht op de onderdrukkingslijst en wordt bij een nieuwe import niet opnieuw gemaild.
11. Niveau Beginner: ontvangt alle meldingen, stelt kanalen en stille uren in, keurt een WhatsApp-concept goed en opent het in WhatsApp; geen rijmodus en geen plafond per soort (met slot en uitleg).
12. Niveau Gevorderd: idem, met bundelen tijdens het belblok en handsfree.
13. Niveau Expert: rijmodus, eigen dagplafond en stille uren per soort.
14. Toestelmatrix: elk scherm van de app is getest op de vijf toestellen uit 8.15, met schermafbeeldingen in het sprintverslag.
15. Playwright op 375, 390 en 412 px: elk scherm uit 8.5 met referentieschermafbeelding; focuskaart en telstrip boven de vouw op elk niveau; de tikken uit 8.7 gehaald (bellen tot uitkomst hooguit twee, bezoek afronden met ingesproken verslag hooguit vijf plus praten); offline-tests groen.
16. De vijf handmatige scenario's uit 8.15 zijn uitgevoerd en gehaald, inclusief hooguit 10 procent accuverbruik per dag.
17. VoiceOver en TalkBack werken op de schermen uit 8.5; tekstvergroting tot 200 procent zonder afgekapte knoppen; elk tikdoel minimaal 44 px.
18. De prestatiebudgetten uit 8.14 en 13.4 zijn gemeten op staging en gehaald.
19. Alle adapters (push, WhatsApp, mail) draaien in tests met een mock, zonder netwerk.

## Definition of Done

Hoofdstuk 19 geldt volledig, inclusief de eisen per sprint: de "klaar als"-toestand van sprint 12 op ten minste één echte iPhone en één echte Android bevestigd met schermafbeeldingen in het sprintverslag, adversariële review, prestatiebudgetten gemeten op staging, staging doorlopen door de founder. Specifiek voor deze prompt:

- Unit-tests voor `magMelden`, `bundel`, `magWhatsapp`, `waLink` en `staatOpBelMeNiet` met grenzen (stille uren, plafond, afkoeling, feestdagen).
- Een sprintverslag met per toestel uit 8.15 de resultaten en per scenario het meetresultaat.
- Regels 23 en 37 van Bijlage A opnieuw gecontroleerd en groen (ze horen bij P01, P10 en P13).
- `docs/HOE-HET-WERKT.md` beschrijft meldingssoorten, kanalen, stille uren, WhatsApp-sjablonen en consent.
