# P25: Helpcenter compleet en academie

| Onderdeel | Waarde |
|---|---|
| Sprint | 12 (Platform en afronding) |
| Features | F21 Helpcenter compleet: beide collecties volledig, "Voor jou" met de artikelen van de functies die voor je aanstaan, "Vraag AI" via de AI-assistent (F26, P33), eigen artikelen per organisatie, editor, statistiek, controlevragen |
| Hangt af van | P01 (functiecatalogus met helpartikel per functie, `check:functies`), P09 Helpcenter basis en features per niveau (tabellen, startpagina, artikelpagina, hulpknop, "Aan de slag", `functies_per_niveau` en `beschikbaar()`), P33 AI-assistent en credits (de chat "Vraag AI", `POST /api/assistent/vraag`, credits), P08 (Bewaker), P24 (`/platform/help`, versies, rechten founder), P28 (leesmodel voor de verkoopverhaal-artikelen), P31 en P30 (dagpakket met de helpartikelen van de functies die voor je aanstaan), P21 (coachingpunten met artikelsleutel) |
| Bron in het bouwplan | F21 volledig; F26 (de chat vervangt "Stel je vraag"); 4.2 en 4.4 (functie die niet aanstaat linkt naar zijn artikel; toast met helpartikel als een functie aangaat); 2.3 (Hulp waar je bent); 6.3 (Hulp, globale zoek); 8.8 (helpartikelen in het dagpakket); 11.3 (Gids is de AI-assistent); 11.4 (credits per vraag); 10.2 (help-tabellen); 13.2 (`content/help/`); 13.5 (lokaal bouwen); 16.4 (KPI helpartikel nuttig); hoofdstuk 17 (sprint 12 "elke feature heeft een helpartikel"); B19 (geen leerpaden per niveau); open vraag 14; F25 (artikelen bij het verkoopverhaal); F23 (wie beheert) |

## Lees eerst

- Bouwplan-Dealtrace.md: F21 volledig, F26 (vooral "Waar je hem vindt" en "Credits"), 0.2 (B18, B19, B20), 4.2 en 4.4, 2.3, 6.3, 8.4 ("Meer" bevat Helpcenter), 8.8 (dagpakket), 11.2 (bewijsplicht), 11.3 (Gids: de AI-assistent, "A, alleen lezen en concepten"), 11.4 (AI-assistent: gewone vraag 1 credit, met accountgegevens of lang antwoord 2 tot 5), 10.2, 13.2, 13.5, 16.4, hoofdstuk 17, hoofdstuk 21 (risico "Accountmanagers stoppen na twee pogingen": artikel "Waarom de vierde poging"), open vraag 14, F23 (tabel Wie ziet wat, rij Help-artikelen), F25 (artikelen bij het verkoopverhaal en Mobiel), Bijlage C (voorbeelden alleen met Voltvast).
- DealDrive op commit 75bee61:
  - `app/pages/helpcenter/index.vue`, `app/pages/helpcenter/[categorie].vue`, `app/pages/helpcenter/instructies.vue`
  - `app/composables/useHelpcenterInstructies.ts` (instructies op maat van de rol)
  - `app/components/HelpIllustratie.vue`, `app/utils/helpcenterAfbeelding.ts`, `scripts/helpcenter-afbeeldingen.ts` (schermafbeeldingen per pagina met Playwright)

## Deel 1: Functioneel (wat en waarom)

### Wat je bouwt

Het complete helpcenter met de collecties "Hoe werkt Dealtrace" (een of meer artikelen per feature F01 tot en met F26) en "New business" (de academie), het blok "Voor jou" met de artikelen van de functies die voor je aanstaan, "Vraag AI" als ingang naar de AI-assistent (F26, gebouwd in P33) met het helpcenter als bron, eigen artikelen per organisatie met een editor, en statistiek per artikel.

### Waarom

Het helpcenter legt elk scherm uit en leert de gebruiker hoe je nieuwe klanten wint (B10, 1.1 punt 7). Elke functie heeft een artikel: gaat een functie voor je aan (een hoger niveau of een functie die de founder aanzet), dan krijg je dat artikel als eerste uitleg, en de coaching verwijst naar artikelen (F20). Er zijn geen leerpaden per niveau en lezen is nergens een voorwaarde voor (B19). Vragen stel je aan de AI-assistent, die dezelfde artikelen als bron gebruikt (B20, F26). Sprint 12 is pas klaar als elke feature een helpartikel heeft.

### Gebruikers en niveaus

| Rol | Niveau | Wat |
|---|---|---|
| iedereen | Beginner | Alles lezen; "Aan de slag" en "Voor jou"; hulpknop per scherm; "Was dit nuttig?"; "Vraag AI" binnen de credits van de organisatie (een gewone vraag kost 1 credit) |
| iedereen | Gevorderd | Idem; "Voor jou" toont de artikelen van de functies die er voor Gevorderd bij aangingen |
| iedereen | Expert | Idem |
| beheerder | rol | Eigen artikelen voor de organisatie toevoegen, platformartikelen verbergen, statistiek van de organisatie, eigen kennisbank als bron voor de AI-assistent aanzetten |
| founder | rol | Platformartikelen beheren met versies (`/platform/help`), voor alle organisaties; statistiek over alle organisaties; vragen zonder antwoord |

Iedereen leest alles; het niveau bepaalt alleen de volgorde in "Voor jou", nooit wat je mag lezen.

### Schermen

**1. Startpagina** (`/help`), van boven naar beneden:

1. Kop met kicker "HELPCENTER" en zoekveld "Waar kunnen we je mee helpen?".
2. Blok "Voor jou": de artikelen van functies die net voor je aan zijn gegaan (met de pil "nieuw" zolang het menu-item die pil heeft, 4.4) en de vijf artikelen van "Aan de slag" zolang je die nog niet las. Geen voortgangsbalk en geen teller van een niveau.
3. Blok "Hoe werkt Dealtrace": de categorieën Aan de slag, Dagelijks werk, Prospects, Plannen en sturen, Inrichten (beheerder), Voor de salesmanager.
4. Blok "New business": de categorieën Fundament, Voorbereiden, Bellen, Bezwaren, Schrijven, Op pad, Volhouden, Van afspraak naar overdracht, Jezelf verbeteren.
5. "Nieuw en bijgewerkt".
6. "Vraag AI": de knop opent de AI-assistent (F26) met de context "Scherm: Helpcenter"; de chat vervangt het oude blok "Stel je vraag".

Lege staat bij zoeken zonder resultaat: "Niets gevonden voor '<term>'. Vraag het aan de AI-assistent, dan zoeken we het voor je uit." (voorstel); de term gaat naar `help_zoekopdrachten`.

**2. Artikelpagina** (`/help/:collectie/:artikel`): titel, leestijd, niveau-pil, categorie, inhoud (tekst, schermafbeeldingen, korte video, stappen), "Probeer het" (opent het scherm waar het over gaat), controlevragen waar ze er zijn (drie meerkeuzevragen), "Markeer als gelezen", "Was dit nuttig?" (ja of nee met reden), gerelateerde artikelen, "Laatst bijgewerkt". Hoort het artikel bij een functie die voor jou niet aanstaat, dan staat bovenaan de rustige regel "Deze functie hoort bij Gevorderd." (4.2), zonder verzoekknop.

**3. New business-artikel**: vaste opbouw "Waarom dit werkt" (een alinea), "Zo doe je het" (stappen), "Voorbeeld" (een kort voorbeeldgesprek of voorbeeldmail met verzonnen bedrijven), "Valkuilen" en "Zo doe je het in Dealtrace" (met "Probeer het"). Voorbeelden gebruiken alleen de fictieve startset Voltvast (Bijlage C).

**4. Contextuele hulp**: de knop "Hulp" in elke paginakop opent het artikel van dat scherm in een flyout van 560 px; functies die niet aanstaan linken naar hun artikel ("Lees hoe het werkt"); lege staten kunnen "Lees hoe het werkt" hebben.

**5. Vraag AI** (de AI-assistent, F26; de chat, de credits en de meter bouwt P33): vanuit het helpcenter opent de chat met de context "Helpcenter" of het artikel dat open staat. Het antwoord komt uit de artikelen (en, als de organisatie dat aanzet, uit de eigen kennisbank), met de artikelen als bronchips ("Helpcenter: Om de afspraak vragen") en "Open het artikel" als actie. Zonder bron: "Daar staat nog niets over in het helpcenter. Je vraag is doorgestuurd." Deze prompt levert het materiaal (de zoekfunctie), de bronchips naar artikelen en het signaal "vraag zonder antwoord".

**6. Beheer van artikelen** (beheerder: niet vastgelegd welke route; voorstel `/instellingen/help`; founder: `/platform/help`)

- Lijst met titel, collectie, categorie, niveau, status (concept, gepubliceerd), herkomst (platform of eigen), gelezen, nuttig, "Verberg" bij platformartikelen (beheerder).
- **Editor**: titel, collectie, categorie, niveau, samenvatting, inhoud in Markdown met afbeeldingen en videolink, gekoppelde schermen (route), gekoppelde features, controlevragen, status, "Bekijk als Beginner". Knoppen "Opslaan als concept", "Publiceer" (geel).
- **Statistiek** per artikel: gelezen, nuttig, niet nuttig met reden, zoektermen zonder resultaat.
- Founder ziet daarnaast "Vragen zonder antwoord" over alle organisaties (signaal voor een nieuw artikel).

**7. Telefoonweergave op 390 px**

- Helpcenter staat in "Meer" (8.4). De startpagina toont zoekveld, "Voor jou" en daaronder de twee collecties als ingeklapte groepen.
- De hulpknop opent het artikel als schuifvenster tot 92 procent van de schermhoogte; tekst minimaal 15 px; afbeeldingen schermbreed; "Probeer het" sluit het venster en opent het scherm.
- De helpartikelen van de functies die voor je aanstaan, staan in het dagpakket en zijn offline te lezen (8.8); een artikel buiten het dagpakket toont offline "Niet op je telefoon bewaard".
- "Vraag AI" opent de chat als schuifvenster en werkt alleen met verbinding; offline: "Zonder verbinding kun je de AI-assistent niets vragen. De artikelen van je functies kun je wel lezen." (voorstel).
- De editor staat er met "Beter op een groot scherm".

### Klikpaden

1. **Hulp op een scherm.** Op `/belblokken` "Hulp": de flyout toont "Belblokken"; "Probeer het" sluit de flyout en zet de focus op "Start belblok".
2. **Functie gaat aan.** De salesmanager zet een accountmanager op Gevorderd (of de founder zet een functie aan voor Beginner); de gebruiker krijgt de toast "Campagnes staat nu voor je aan." met een link naar "Campagnes"; het artikel staat bovenaan in "Voor jou". Hij leest het tot het einde (of "Markeer als gelezen") en beantwoordt de controlevragen; het artikel telt als gelezen, verder verandert er niets.
3. **Vraag AI.** "Hoe parkeer ik een prospect?": de AI-assistent antwoordt met een citaat uit "Parkeren en terughalen" en de bronchip naar het artikel; de vraag kost 1 credit.
4. **Vraag zonder bron.** De vraag krijgt de tekst "Daar staat nog niets over in het helpcenter. Je vraag is doorgestuurd."; de beheerder en de founder krijgen hem als signaal.
5. **Eigen artikel.** Beheerder maakt "Ons bezwarenboek" (collectie New business, categorie Bezwaren), "Bekijk als Beginner", "Publiceer"; het verschijnt alleen voor de eigen organisatie.
6. **Platformartikel verbergen.** Beheerder klikt "Verberg" bij een platformartikel; het verdwijnt voor zijn organisatie, niet voor andere.
7. **Artikel uit coaching.** Een gedeeld coachingpunt (P21) linkt naar "Om de afspraak vragen"; het artikel opent op de artikelpagina.

### Filters en sorteren

- Zoeken: Postgres full-text search in het Nederlands; filters collectie, categorie, niveau; in de URL (`/help?zoek=&collectie=&niveau=`).
- Beheerlijst: filter collectie, status, herkomst; sorteren op titel, gelezen, nuttig.

### Regels

- Een artikel telt als gelezen na openen en scrollen tot het einde, of na "Markeer als gelezen"; bij controlevragen niet vastgelegd of je ze goed moet hebben; voorstel: gelezen telt ook bij foute antwoorden, `vragenGoed` wordt bewaard voor de statistiek. Lezen is nergens een voorwaarde voor: geen leerpaden per niveau, geen criteria, geen niveauvoorstellen (B19).
- "Aan de slag" (vijf artikelen die elke nieuwe gebruiker als eerste ziet): "Je eerste dag in Dealtrace", "Vandaag lezen en afronden", "Een belblok uitvoeren met een script", "Een afspraak plannen, afronden en overdragen", "Waarom vijf pogingen werken".
- "Voor jou" toont de artikelen van de functies die voor je aanstaan volgens `beschikbaar()` (P09 Helpcenter basis en features per niveau), nieuwste aangezet eerst.
- "Vraag AI" is de AI-assistent (F26, P33): het antwoord komt alleen uit de artikelen (en, als de organisatie dat aanzet, uit de eigen kennisbank), met citaten en bronchips; nooit een antwoord zonder citaat. Een vraag kost credits uit de pot van de organisatie (11.4); bij 0 credits toont de chat "De AI-credits van deze maand zijn op. Je beheerder kan extra credits aanvragen." en blijven alle artikelen leesbaar.
- Een eigen artikel van organisatie A is onzichtbaar voor B; platformartikelen gelden voor alle organisaties en hebben versies.
- Elke functie in de catalogus van 4.2 heeft een helpartikel (`check:functies`).
- Artikelen bij het verkoopverhaal ("Ons verhaal", "Onze belofte", "Tegen wie we verkopen", "Eén winpunt per gesprek", "Wanneer we iemand terugbellen") tonen de inhoud uit het leesmodel van de eigen organisatie; zonder bevestigd verhaal de tekst "Jullie verkoopverhaal is nog niet vastgelegd." (F25).
- Mobiel: artikelen "Dealtrace op je telefoon", "Een dag offline", "Inspreken in plaats van typen".
- KPI: helpartikel nuttig boven 80 procent (16.4).
- Wie de new business-artikelen schrijft: founder en salesexperts; AI-concept per artikel, een mens redigeert (open vraag 14).

### Inhoud die deze prompt oplevert

**Collectie "Hoe werkt Dealtrace"** (F21, minimaal deze titels, aangevuld tot elke feature F01 tot en met F26 een artikel heeft):

- Aan de slag: Je eerste dag · Je werkplek: binnendienst of buitendienst · Je niveau en functies die aanstaan · Chatten met de AI-assistent · Meldingen instellen · Dealtrace op je telefoon en offline.
- Dagelijks werk: Vandaag · Een taak afronden met een uitkomst · Wat betekent poging 3 van 5 · Concepten goedkeuren en versturen · De belmodus · Een belscript kiezen · Bezoeken en kansen langs de route · Een bezoek afronden met een verslag · Briefing en Pitstop.
- Prospects: Een prospect toevoegen · De accountkaart lezen · Buying committee · Nee met reden en afkoelperiode · De prospectreis en fases · Leadgenerator · Importeren · KvK en Datacollectief.
- Plannen en sturen: Belblokken · Prospectplanning · Hercontactritme · Campagnes · De funnel van je prospectreis · Gebieden en regiodagen.
- Inrichten (beheerder): Gebruikers, rollen en niveaus · Belscripts maken · Eigen velden · Regels · Accountmatrix · Doelgroepen en reizen · Agents en mandaten · Koppelingen · Abonnement, verbruik en AI-credits.
- Voor de salesmanager: Team controleren · Coachingsgesprek voorbereiden · Analyse lezen · Verbetervoorstellen beoordelen.

**Collectie "New business"** (de academie):

| Categorie | Artikelen |
|---|---|
| Fundament | Wat new business anders maakt dan accountmanagement · Je ideale klant bepalen · De prospectmix: koud, warm, referral, winback · Je funnel terugrekenen vanuit je doel |
| Voorbereiden | Een goede aanleiding vinden · Het buying committee in kaart · Je verhaal: waarom, hoe, wat · Eén winpunt per gesprek |
| Bellen | De eerste 20 seconden · Langs de receptie · Een belscript gebruiken zonder als een script te klinken · Vragen stellen met BAND · Een voicemail die teruggebeld wordt · Om de afspraak vragen |
| Bezwaren | De vijf bezwaren die je elke week hoort · "Stuur maar wat informatie" · "We hebben al een leverancier" · "Geen budget" · "Bel over een half jaar terug" |
| Schrijven | De eerste mail: waarom, hoe, vraag · Een opvolgmail na een voicemail · LinkedIn: profielbezoek, connectie, bericht · Een kaartje dat opvalt |
| Op pad | Je regiodag plannen · Binnenlopen langs de route · Het eerste bezoek · Inventariseren en doorvragen · Na het bezoek: binnen 24 uur opvolgen |
| Volhouden | Waarom de vierde en vijfde poging het verschil maken · Nee is een datapunt · Parkeren en terughalen · Referrals vragen · Netwerken en beurzen |
| Van afspraak naar overdracht | De eerste afspraak voorbereiden · Doorvragen in het eerste gesprek · Een vervolg afspreken · Een goede overdracht · Een no-show opvangen |
| Jezelf verbeteren | Je cijfers lezen · Een goede week · Feedback vragen aan je salesmanager |

"Aan de slag" noemt "Waarom vijf pogingen werken", dat niet letterlijk in de collecties staat. Niet vastgelegd of dit een apart artikel is; voorstel: een apart artikel met die titel dat naar "Waarom de vierde en vijfde poging het verschil maken" linkt.

### Helpartikel

"Je niveau en functies die aanstaan" (Aan de slag) beschrijft wat een niveau is, dat de founder per niveau functies aan of uit zet, dat de salesmanager je niveau kiest en wat je ziet bij een functie die niet aanstaat; geen groeipad. "Chatten met de AI-assistent" (Aan de slag) beschrijft "Vraag AI", de bronnen en de credits.

## Deel 2: Technisch (hoe)

### Datamodel

- `help_artikelen: id, organisation_id (null = platform), collectie ('product'|'newbusiness'), categorie, slug, titel, niveau, status, versie, data {samenvatting, inhoud (markdown), routes[], features[], vragen[], videoUrl?}, gepubliceerd_op`.
- `help_gelezen: organisation_id, gebruiker_id, artikel_id, op, vragenGoed?`; `help_feedback: artikel_id, gebruiker_id, nuttig, reden?`; `help_zoekopdrachten: organisation_id, term, resultaten, op`.
- Verbergen van een platformartikel per organisatie: niet vastgelegd; voorstel `org_settings` sleutel `helpVerborgen: [artikelId]`.
- Vragen zonder antwoord: niet vastgelegd waar ze staan; voorstel `help_zoekopdrachten` met `soort ('zoek'|'vraag')` en `beantwoord boolean`; de AI-assistent (P33) schrijft hier een rij bij een vraag zonder bron uit het helpcenter.
- Full-text index: `to_tsvector('dutch', titel || samenvatting || inhoud)` als gegenereerde kolom met GIN-index.
- RLS: een eigen artikel alleen binnen de eigen organisatie; platformartikelen (`organisation_id` null) leesbaar voor iedereen, schrijfbaar alleen via `/api/platform/**`.
- Rechtenmatrix: lezen iedereen; eigen artikelen beheerder; platformartikelen founder (F21, F23).
- Sync-allowlist: de `help_artikelen` van de functies die voor je aanstaan in het dagpakket (alleen lezen); `help_gelezen` en `help_feedback` als mutaties via de wachtrij (offline lezen telt na synchronisatie één keer).

### Pure functies

Niet vastgelegd in het bouwplan welke namen; voorstel in `shared/help.ts`:

| Functie | Invoer | Uitvoer | Randgevallen en tests |
|---|---|---|---|
| `artikelenVoorJou(functies, artikelen, gelezen, nu)` | functies die voor je aanstaan met datum van aanzetten, artikelen, gelezen | lijst voor "Voor jou" | functie zonder artikel (mag niet, `check:functies`); "Aan de slag" alles gelezen; verborgen artikel telt niet mee |
| `artikelVoorRoute(route, artikelen)` | route | slug | route met parameter (`/accounts/:id`); geen artikel geeft het overzicht van de categorie |
| `zichtbareArtikelen(artikelen, org, verborgen, niveau)` | lijst | lijst | eigen artikel van een andere organisatie nooit; niveau bepaalt de volgorde, niet de zichtbaarheid (iedereen leest alles) |
| `leestijd(markdown)` | tekst | minuten | lege tekst; 200 woorden per minuut (voorstel) |
| `zoekHelp(term, org, filters)` | zoekterm | artikelen met rang en fragment | ook het materiaal voor de AI-assistent (P33); accent- en hoofdletterongevoelig |
| `citatenGeldig(antwoord, bronnen)` | AI-antwoord, zoekresultaten | boolean | citaat letterlijk; link naar een niet gevonden artikel ongeldig; door P33 aangeroepen op elk antwoord met helpbronnen |

### Endpoints

| Methode en route | Recht | Invoer | Uitvoer | Fouten |
|---|---|---|---|---|
| `GET /api/help?zoek=&collectie=&niveau=` | iedereen | filters | artikelen met rang | |
| `GET /api/help/:slug` | iedereen | geen | artikel | 404 voor een eigen artikel van een andere organisatie |
| `POST /api/help/:id/gelezen` | iedereen | `{vragenGoed?}` | ok | idempotent per gebruiker en artikel |
| `POST /api/help/:id/feedback` | iedereen | `{nuttig, reden?}` | ok | 422 bij nee zonder reden (voorstel) |
| `POST /api/assistent/vraag` (F26, gebouwd in P33) | iedereen | `{chatId?, tekst, context: {route: '/help...'}}` | streamend antwoord met bronnen | 402 bij 0 credits met "De AI-credits van deze maand zijn op. Je beheerder kan extra credits aanvragen." |
| `POST/PUT /api/help` | beheerder (eigen), founder via `/api/platform/help` | artikel | artikel met versie | 403 voor platformartikelen buiten de founder |
| `POST /api/help/:id/verberg` | beheerder | geen | ok | niet vastgelegd; voorstel |
| `GET /api/help/statistiek` | beheerder (eigen), founder (alles) | filters | per artikel | niet vastgelegd; voorstel |

Er is geen eigen AI-endpoint in het helpcenter; het oude voorstel `POST /api/help/vraag` vervalt.

### AI-stappen

- **Agent** Gids: de AI-assistent (F26, 11.3), mandaat A, alleen lezen en concepten. De chat, de modelkeuze, de credits en de golden master van de assistent komen uit P33.
- **Materiaal uit deze prompt**: de resultaten van `zoekHelp` (dezelfde full-text search, geen aparte vectorindex bij honderden artikelen), plus de eigen kennisbank als de organisatie dat aanzet.
- **Vangrails**: bewijsplicht op citaten met `citatenGeldig`; geen antwoord zonder citaat; privégegevens gemaskeerd; de vraag wordt bewaard zonder namen (namenfilter, 11.2).
- **Mock**: vaste helpbronnen voor drie vragen uit de startinhoud en één vraag zonder bron, als fixture voor de mock-provider van P33; lokaal (13.5) altijd `AI_PROVIDER=mock`.
- **Credits**: een gewone vraag 1 credit, met accountgegevens of een lang antwoord 2 tot 5 (11.4); de pot geldt voor alle AI.
- AI-concept per new business-artikel voor de schrijvers (open vraag 14): buiten de app, een mens redigeert; niet in deze prompt als functie.

### Integraties

Geen externe. Startinhoud als Markdown in `content/help/` en bij een release in de tabel geladen als platformlaag (review via pull requests). Schermafbeeldingen gemaakt met Playwright op de lokale ontwikkelserver met de mock en de startset Voltvast (13.5).

### Functiecatalogus

Niet vastgelegd in het bouwplan welke sleutels; voorstel:

| Sleutel | Niveau | Pakket | Recht | Helpartikel |
|---|---|---|---|---|
| `help.lezen` | Beginner | Starter | iedereen | Je eerste dag |
| `help.eigenArtikelen` | Expert | Plus | beheerder | Gebruikers, rollen en niveaus (voorstel: sectie "Eigen artikelen") |
| `help.kennisbankBron` | Expert | Plus | beheerder | Koppelingen (voorstel) |

"Vraag AI" is de functie van de AI-assistent uit P33 (F26), geen eigen helpfunctie. Het niveau in deze tabel is de startindeling; de founder zet functies per niveau aan of uit in `functies_per_niveau` (P09 Helpcenter basis en features per niveau).

### Hergebruik uit DealDrive

- `helpcenter/index.vue` en `[categorie].vue`: kaartenstructuur; vervang Kennisbank en Playbooks door de twee collecties en "Voor jou".
- `useHelpcenterInstructies.ts`: instructies op maat van de rol; uitbreiden met de functies die voor je aanstaan.
- `HelpIllustratie.vue`, `helpcenterAfbeelding.ts`, `scripts/helpcenter-afbeeldingen.ts`: schermafbeeldingen per route, nu op desktop en op 390 px.

### Buiten scope

Een vectorindex; video-opnames maken (alleen een videolink); vertalingen; de chat zelf, de credits en de meter (P33); `functies_per_niveau` en de basis van het helpcenter (P09 Helpcenter basis en features per niveau); het platformbeheer van rechten en versies (P24 levert de route); leerpaden per niveau en een groeipad (vervallen, B19).

## Acceptatiecriteria

1. De hulpknop op elk scherm opent het juiste artikel; een Playwright-test loopt alle routes uit 6.1 en 8.4 langs.
2. Elke functie in de catalogus heeft een gepubliceerd helpartikel; `check:functies` is groen; elke feature F01 tot en met F26 heeft minstens één artikel in "Hoe werkt Dealtrace".
3. Gaat een functie voor een gebruiker aan (hoger niveau of een cel op `/platform/features`), dan staat het artikel van die functie bovenaan in "Voor jou"; er is nergens een leerpad, voortgangsbalk of niveaucriterium.
4. "Vraag AI" in het helpcenter opent de AI-assistent uit P33; een antwoord zonder citaat uit een artikel wordt nooit getoond; een vraag zonder bron geeft "Daar staat nog niets over in het helpcenter. Je vraag is doorgestuurd." en komt bij beheerder en founder; de vraag kost credits volgens 11.4.
5. Een eigen artikel van organisatie A is onzichtbaar voor B (wegwerp-Postgres); een verborgen platformartikel verdwijnt alleen bij de organisatie die het verborg.
6. Elk new business-artikel heeft de vijf vaste onderdelen; voorbeelden gebruiken alleen Voltvast of verzonnen namen zonder echte bedrijven of personen; nergens gaat een artikel over deals, offertes of een pipeline (B17).
7. De verkoopverhaal-artikelen tonen de inhoud uit het leesmodel van de eigen organisatie (Voltvast: kernzin "Voltvast is een technische groothandel voor installateurs in Midden- en Noord-Nederland.").
8. "Bekijk als Beginner" toont het artikel zoals een Beginner het ziet.
9. Zoeken is accent- en hoofdletterongevoelig; een zoekterm zonder resultaat staat in de statistiek.
10. Niveau Beginner, Gevorderd en Expert lezen alle artikelen; een artikel van een functie die niet aanstaat toont "Deze functie hoort bij Gevorderd." zonder verzoekknop.
11. Bij 0 credits toont "Vraag AI" de melding uit F26 en blijven zoeken en lezen werken.
12. Een beheerder beheert eigen artikelen; een accountmanager krijgt 403 op `POST /api/help`.
13. Telefoon (375, 390, 412 px): de hulpknop opent het artikel als schuifvenster, tekst minimaal 15 px, geen horizontale scroll, tikdoelen minimaal 44 px; de helpartikelen van de functies die voor je aanstaan openen in vliegtuigmodus uit het dagpakket; "Markeer als gelezen" offline telt na synchronisatie één keer.
14. VoiceOver en TalkBack lezen de artikelpagina in de goede volgorde; tekstvergroting tot 200 procent zonder afgekapte knoppen (8.15).
15. Het helpcenter en de helpbronnen van de AI-assistent draaien lokaal en in tests met de mock (13.5), zonder netwerk.
16. Bijlage A: geen regel noemt P25 in de kolom Prompt; regel 16 ("elke definitie één keer in `shared/`", alle prompts) geldt wel: "Aan de slag" en `artikelenVoorJou` staan één keer in `shared/help.ts` en worden door server en client gebruikt.

## Definition of Done

Hoofdstuk 19 geldt volledig. Specifiek voor deze prompt:

- Alle artikelen staan als Markdown in `content/help/`, zijn via een pull request gereviewd en worden bij de release geladen.
- Unit-tests voor `artikelenVoorJou`, `artikelVoorRoute`, `zoekHelp` en `citatenGeldig`; de golden master van de AI-assistent (P33) bevat de drie helpvragen uit de mock.
- Het sprintdoel van sprint 12 "elke feature heeft een helpartikel en een telefoonweergave" is voor het helpdeel aangetoond met een lijst feature, artikel en schermafbeelding op 390 px.
- `docs/HOE-HET-WERKT.md` beschrijft hoe je een artikel toevoegt en publiceert.
