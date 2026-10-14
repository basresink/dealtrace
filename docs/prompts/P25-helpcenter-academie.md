# P25: Helpcenter compleet en academie

| Onderdeel | Waarde |
|---|---|
| Sprint | 12 (Platform en afronding) |
| Features | F21 Helpcenter compleet: beide collecties volledig, leerpaden Gevorderd en Expert, AI-vraag ("Stel je vraag") met de Gids, eigen artikelen per organisatie, editor, statistiek, controlevragen |
| Hangt af van | P01 (functiecatalogus met helpartikel per functie, `check:functies`), P09 (helpcenter basis: tabellen, startpagina, artikelpagina, hulpknop, leerpad Beginner, groeipad), P08 (bundel "Helpvraag", Bewaker), P24 (`/platform/help`, versies, rechten founder), P28 (leesmodel voor de verkoopverhaal-artikelen), P31 en P30 (dagpakket met de artikelen van het leerpad), P21 (coachingpunten met artikelsleutel) |
| Bron in het bouwplan | F21 volledig; 4.4 (leerpad telt voor het groeipad); 2.3 (Hulp waar je bent, Vergrendeld met uitleg); 6.3 (Hulp, globale zoek); 8.8 (helpartikelen in het dagpakket); 11.3 (Gids); 11.4 (bundel Helpvraag); 10.2 (help-tabellen); 13.2 (`content/help/`); 16.4 (KPI helpartikel nuttig); hoofdstuk 17 (sprint 12 "elke feature heeft een helpartikel"); open vraag 14; F25 (leerpad); F23 (wie beheert) |

## Lees eerst

- Bouwplan-Dealtrace.md: F21 volledig, 4.4 en 4.5, 2.3, 6.3, 8.4 ("Meer" bevat Helpcenter), 8.8 (dagpakket), 11.2 (bewijsplicht), 11.3 (Gids: "A, alleen lezen"), 11.4 (Helpvraag, Claude Haiku, 200 / 1.000 / 1.000), 10.2, 13.2, 16.4, hoofdstuk 17, hoofdstuk 21 (risico "Accountmanagers stoppen na twee pogingen": artikel "Waarom de vierde poging"), open vraag 14, F23 (tabel Wie ziet wat, rij Help-artikelen), F25 (Leerpad), Bijlage C (voorbeelden alleen met Voltvast).
- DealDrive op commit 75bee61:
  - `app/pages/helpcenter/index.vue`, `app/pages/helpcenter/[categorie].vue`, `app/pages/helpcenter/instructies.vue`
  - `app/composables/useHelpcenterInstructies.ts` (instructies op maat van de rol)
  - `app/components/HelpIllustratie.vue`, `app/utils/helpcenterAfbeelding.ts`, `scripts/helpcenter-afbeeldingen.ts` (schermafbeeldingen per pagina met Playwright)

## Deel 1: Functioneel (wat en waarom)

### Wat je bouwt

Het complete helpcenter met de collecties "Hoe werkt Dealtrace" (een of meer artikelen per feature F01 tot en met F25) en "New business" (de academie), de leerpaden Gevorderd en Expert, de AI-vraag met bronnen, eigen artikelen per organisatie met een editor, en statistiek per artikel.

### Waarom

Het helpcenter legt elk scherm uit en leert de gebruiker hoe je nieuwe klanten wint (B10, 1.1 punt 7). Het is ook het leermiddel van het niveaumodel: elk niveau heeft een leerpad dat meetelt voor het groeipad (4.4), en de coaching verwijst naar artikelen (F20). Sprint 12 is pas klaar als elke feature een helpartikel heeft.

### Gebruikers en niveaus

| Rol | Niveau | Wat |
|---|---|---|
| iedereen | Beginner | Alles lezen; leerpad Beginner; hulpknop per scherm; "Was dit nuttig?"; "Stel je vraag" (bundel 200 per maand op Starter) |
| iedereen | Gevorderd | Plus leerpad Gevorderd met voortgang |
| iedereen | Expert | Plus leerpad Expert met voortgang |
| beheerder | Expert | Eigen artikelen voor de organisatie toevoegen, platformartikelen verbergen, statistiek van de organisatie, eigen kennisbank als bron voor de AI-vraag aanzetten |
| founder | n.v.t. | Platformartikelen beheren met versies (`/platform/help`), voor alle organisaties; statistiek over alle organisaties; vragen zonder antwoord |

### Schermen

**1. Startpagina** (`/help`), van boven naar beneden:

1. Kop met kicker "HELPCENTER" en zoekveld "Waar kunnen we je mee helpen?".
2. Blok "Jouw leerpad": de artikelen van je niveau met voortgang ("3 van 5 gelezen") en een vinkje per gelezen artikel.
3. Blok "Hoe werkt Dealtrace": de categorieën Aan de slag, Dagelijks werk, Prospects, Plannen en sturen, Inrichten (beheerder), Voor de salesmanager.
4. Blok "New business": de categorieën Fundament, Voorbereiden, Bellen, Bezwaren, Schrijven, Op pad, Volhouden, Afsluiten, Jezelf verbeteren.
5. "Nieuw en bijgewerkt".
6. "Stel je vraag" (AI-antwoord uit de artikelen, met bronnen).

Lege staat bij zoeken zonder resultaat: "Niets gevonden voor '<term>'. Stel je vraag, dan zoeken we het voor je uit." (voorstel); de term gaat naar `help_zoekopdrachten`.

**2. Artikelpagina** (`/help/:collectie/:artikel`): titel, leestijd, niveau-pil, categorie, inhoud (tekst, schermafbeeldingen, korte video, stappen), "Probeer het" (opent het scherm waar het over gaat), controlevragen waar ze er zijn (drie meerkeuzevragen), "Markeer als gelezen", "Was dit nuttig?" (ja of nee met reden), gerelateerde artikelen, "Laatst bijgewerkt".

**3. New business-artikel**: vaste opbouw "Waarom dit werkt" (een alinea), "Zo doe je het" (stappen), "Voorbeeld" (een kort voorbeeldgesprek of voorbeeldmail met verzonnen bedrijven), "Valkuilen" en "Zo doe je het in Dealtrace" (met "Probeer het"). Voorbeelden gebruiken alleen de fictieve startset Voltvast (Bijlage C).

**4. Contextuele hulp**: de knop "Hulp" in elke paginakop opent het artikel van dat scherm in een flyout van 560 px; vergrendelde functies linken naar hun artikel ("Lees hoe het werkt"); lege staten kunnen "Lees hoe het werkt" hebben.

**5. Stel je vraag** (flyout of blok op de startpagina): invoerveld, antwoord met citaten en links naar de artikelen. Zonder bron: "Daar staat nog niets over in het helpcenter. Je vraag is doorgestuurd."

**6. Beheer van artikelen** (beheerder: niet vastgelegd welke route; voorstel `/instellingen/help`; founder: `/platform/help`)

- Lijst met titel, collectie, categorie, niveau, status (concept, gepubliceerd), herkomst (platform of eigen), gelezen, nuttig, "Verberg" bij platformartikelen (beheerder).
- **Editor**: titel, collectie, categorie, niveau, samenvatting, inhoud in Markdown met afbeeldingen en videolink, gekoppelde schermen (route), gekoppelde features, controlevragen, status, "Bekijk als Beginner". Knoppen "Opslaan als concept", "Publiceer" (geel).
- **Statistiek** per artikel: gelezen, nuttig, niet nuttig met reden, zoektermen zonder resultaat.
- Founder ziet daarnaast "Vragen zonder antwoord" over alle organisaties (signaal voor een nieuw artikel).

**7. Telefoonweergave op 390 px**

- Helpcenter staat in "Meer" (8.4). De startpagina toont zoekveld, "Jouw leerpad" en daaronder de twee collecties als ingeklapte groepen.
- De hulpknop opent het artikel als schuifvenster tot 92 procent van de schermhoogte; tekst minimaal 15 px; afbeeldingen schermbreed; "Probeer het" sluit het venster en opent het scherm.
- De artikelen van het leerpad van je niveau staan in het dagpakket en zijn offline te lezen (8.8); een artikel buiten het dagpakket toont offline "Niet op je telefoon bewaard".
- "Stel je vraag" werkt alleen met verbinding; offline: "Zonder verbinding kun je geen vraag stellen. De artikelen van je leerpad kun je wel lezen." (voorstel).
- De editor staat er met "Beter op een groot scherm".

### Klikpaden

1. **Hulp op een scherm.** Op `/belblokken` "Hulp": de flyout toont "Belblokken"; "Probeer het" sluit de flyout en zet de focus op "Start belblok".
2. **Leerpad.** Een Gevorderde opent "Een campagne opzetten", scrolt tot het einde (of "Markeer als gelezen"), beantwoordt drie controlevragen; het artikel telt als gelezen en de voortgang in "Jouw niveau" schuift op.
3. **Vraag stellen.** "Hoe parkeer ik een prospect?": antwoord met citaat uit "Parkeren en terughalen" en link; "Was dit nuttig?".
4. **Vraag zonder bron.** De vraag krijgt de tekst "Daar staat nog niets over in het helpcenter. Je vraag is doorgestuurd."; de beheerder en de founder krijgen hem als signaal.
5. **Eigen artikel.** Beheerder maakt "Ons bezwarenboek" (collectie New business, categorie Bezwaren), "Bekijk als Beginner", "Publiceer"; het verschijnt alleen voor de eigen organisatie.
6. **Platformartikel verbergen.** Beheerder klikt "Verberg" bij een platformartikel; het verdwijnt voor zijn organisatie, niet voor andere.
7. **Artikel uit coaching.** Een gedeeld coachingpunt (P21) linkt naar "Om de afspraak vragen"; het artikel opent op de artikelpagina.

### Filters en sorteren

- Zoeken: Postgres full-text search in het Nederlands; filters collectie, categorie, niveau; in de URL (`/help?zoek=&collectie=&niveau=`).
- Beheerlijst: filter collectie, status, herkomst; sorteren op titel, gelezen, nuttig.

### Regels

- Een artikel telt als gelezen na openen en scrollen tot het einde, of na "Markeer als gelezen"; bij controlevragen niet vastgelegd of je ze goed moet hebben; voorstel: gelezen telt ook bij foute antwoorden, `vragenGoed` wordt bewaard voor de statistiek.
- Leerpaden (verplicht voor het volgende niveau):
  - Beginner: "Je eerste dag in Dealtrace", "Vandaag lezen en afronden", "Een belblok uitvoeren met een script", "Een afspraak plannen en afronden", "Waarom vijf pogingen werken".
  - Gevorderd: "Leads vinden en overnemen", "Je week plannen: belblokken en regiodagen", "Een campagne opzetten", "Inzichten beoordelen", "Bezwaren ombuigen".
  - Expert: "Een eigen prospectreis bouwen", "Regels die werk opleveren (en geen ruis)", "Agents en mandaten", "Je cijfers lezen en verbeteren", "Scripts testen en verbeteren".
- De AI-vraag antwoordt alleen uit de artikelen (en, als de organisatie dat aanzet, uit de eigen kennisbank), met citaten en links; nooit een antwoord zonder citaat.
- Een eigen artikel van organisatie A is onzichtbaar voor B; platformartikelen gelden voor alle organisaties en hebben versies.
- Elke functie in de catalogus van 4.2 heeft een helpartikel (`check:functies`).
- Artikelen bij het verkoopverhaal ("Ons verhaal", "Onze belofte", "Tegen wie we verkopen", "Eén winpunt per gesprek", "Wanneer we iemand terugbellen") tonen de inhoud uit het leesmodel van de eigen organisatie; zonder bevestigd verhaal de tekst "Jullie verkoopverhaal is nog niet vastgelegd." (F25).
- Mobiel: artikelen "Dealtrace op je telefoon", "Een dag offline", "Inspreken in plaats van typen".
- KPI: helpartikel nuttig boven 80 procent (16.4).
- Wie de new business-artikelen schrijft: founder en salesexperts; AI-concept per artikel, een mens redigeert (open vraag 14).

### Inhoud die deze prompt oplevert

**Collectie "Hoe werkt Dealtrace"** (F21, minimaal deze titels, aangevuld tot elke feature F01 tot en met F25 een artikel heeft):

- Aan de slag: Je eerste dag · Je werkplek: binnendienst of buitendienst · Je niveau en wat er komt · Meldingen instellen · Dealtrace op je telefoon en offline.
- Dagelijks werk: Vandaag · Een taak afronden met een uitkomst · Wat betekent poging 3 van 5 · Concepten goedkeuren en versturen · De belmodus · Een belscript kiezen · Bezoeken en kansen langs de route · Een bezoek afronden met een verslag · Briefing en Pitstop.
- Prospects: Een prospect toevoegen · De accountkaart lezen · Buying committee · Nee met reden en afkoelperiode · De prospectreis en fases · Leadgenerator · Importeren · KvK en Datacollectief.
- Plannen en sturen: Belblokken · Prospectplanning · Hercontactritme · Campagnes · Pipeline en offertes · Gebieden en regiodagen.
- Inrichten (beheerder): Gebruikers, rollen en niveaus · Belscripts maken · Eigen velden · Regels · Accountmatrix · Doelgroepen en reizen · Agents en mandaten · Koppelingen · Abonnement en verbruik.
- Voor de salesmanager: Team controleren · Coachingsgesprek voorbereiden · Analyse lezen · Verbetervoorstellen beoordelen.

**Collectie "New business"** (de academie):

| Categorie | Artikelen |
|---|---|
| Fundament | Wat new business anders maakt dan accountmanagement · Je ideale klant bepalen · De prospectmix: koud, warm, referral, winback · Je pijplijn terugrekenen vanuit je doel |
| Voorbereiden | Een goede aanleiding vinden · Het buying committee in kaart · Je verhaal: waarom, hoe, wat · Eén winpunt per gesprek |
| Bellen | De eerste 20 seconden · Langs de receptie · Een belscript gebruiken zonder als een script te klinken · Vragen stellen met BAND · Een voicemail die teruggebeld wordt · Om de afspraak vragen |
| Bezwaren | De vijf bezwaren die je elke week hoort · "Stuur maar wat informatie" · "We hebben al een leverancier" · "Geen budget" · "Bel over een half jaar terug" |
| Schrijven | De eerste mail: waarom, hoe, vraag · Een opvolgmail na een voicemail · LinkedIn: profielbezoek, connectie, bericht · Een kaartje dat opvalt |
| Op pad | Je regiodag plannen · Binnenlopen langs de route · Het eerste bezoek · Inventariseren en doorvragen · Na het bezoek: binnen 24 uur opvolgen |
| Volhouden | Waarom de vierde en vijfde poging het verschil maken · Nee is een datapunt · Parkeren en terughalen · Referrals vragen · Netwerken en beurzen |
| Afsluiten | Van gesprek naar offerte · Een offerte opvolgen · Onderhandelen zonder korting · De overdracht naar de klantrelatie |
| Jezelf verbeteren | Je cijfers lezen · Een goede week · Feedback vragen aan je salesmanager |

Het bouwplan noemt in de leerpaden titels die niet letterlijk in de collecties staan ("Waarom vijf pogingen werken", "Bezwaren ombuigen", "Scripts testen en verbeteren", "Regels die werk opleveren (en geen ruis)"). Niet vastgelegd of dit aparte artikelen zijn; voorstel: aparte artikelen met die titels, die naar de verwante academie-artikelen linken.

### Helpartikel

"Je niveau en wat er komt" (Aan de slag) beschrijft de leerpaden en hoe ze meetellen voor het groeipad; "Hulp gebruiken" is niet vastgelegd, voorstel: een sectie over "Stel je vraag" in "Je eerste dag".

## Deel 2: Technisch (hoe)

### Datamodel

- `help_artikelen: id, organisation_id (null = platform), collectie ('product'|'newbusiness'), categorie, slug, titel, niveau, status, versie, data {samenvatting, inhoud (markdown), routes[], features[], vragen[], videoUrl?}, gepubliceerd_op`.
- `help_gelezen: organisation_id, gebruiker_id, artikel_id, op, vragenGoed?`; `help_feedback: artikel_id, gebruiker_id, nuttig, reden?`; `help_zoekopdrachten: organisation_id, term, resultaten, op`.
- Verbergen van een platformartikel per organisatie: niet vastgelegd; voorstel `org_settings` sleutel `helpVerborgen: [artikelId]`.
- Vragen zonder antwoord: niet vastgelegd waar ze staan; voorstel `help_zoekopdrachten` met `soort ('zoek'|'vraag')` en `beantwoord boolean`.
- Full-text index: `to_tsvector('dutch', titel || samenvatting || inhoud)` als gegenereerde kolom met GIN-index.
- RLS: een eigen artikel alleen binnen de eigen organisatie; platformartikelen (`organisation_id` null) leesbaar voor iedereen, schrijfbaar alleen via `/api/platform/**`.
- Rechtenmatrix: lezen iedereen; eigen artikelen beheerder; platformartikelen founder (F21, F23).
- Sync-allowlist: `help_artikelen` van het leerpad van je niveau in het dagpakket (alleen lezen); `help_gelezen` en `help_feedback` als mutaties via de wachtrij (offline lezen telt na synchronisatie één keer).

### Pure functies

Niet vastgelegd in het bouwplan welke namen; voorstel in `shared/help.ts`:

| Functie | Invoer | Uitvoer | Randgevallen en tests |
|---|---|---|---|
| `leerpadVoortgang(niveau, leerpaden, gelezen)` | niveau, gelezen | `{gelezen, totaal, klaar}` | artikel twee keer gelezen telt één keer; verborgen artikel telt niet mee |
| `artikelVoorRoute(route, artikelen, niveau)` | route | slug | route met parameter (`/accounts/:id`); geen artikel geeft het overzicht van de categorie |
| `zichtbareArtikelen(artikelen, org, verborgen, niveau)` | lijst | lijst | eigen artikel van een andere organisatie nooit; niveau bepaalt de volgorde, niet de zichtbaarheid (iedereen leest alles) |
| `leestijd(markdown)` | tekst | minuten | lege tekst; 200 woorden per minuut (voorstel) |
| `citatenGeldig(antwoord, bronnen)` | AI-antwoord, zoekresultaten | boolean | citaat letterlijk; link naar een niet gevonden artikel ongeldig |

### Endpoints

| Methode en route | Recht | Invoer | Uitvoer | Fouten |
|---|---|---|---|---|
| `GET /api/help?zoek=&collectie=&niveau=` | iedereen | filters | artikelen met rang | |
| `GET /api/help/:slug` | iedereen | geen | artikel | 404 voor een eigen artikel van een andere organisatie |
| `POST /api/help/:id/gelezen` | iedereen | `{vragenGoed?}` | voortgang | idempotent per gebruiker en artikel |
| `POST /api/help/:id/feedback` | iedereen | `{nuttig, reden?}` | ok | 422 bij nee zonder reden (voorstel) |
| `POST /api/help/vraag` | iedereen | `{vraag}` | `{antwoord, citaten[], artikelen[]}` of de tekst zonder bron | 429 met "Je maandbundel voor helpvragen is op." (tekst voorstel) |
| `POST/PUT /api/help` | beheerder (eigen), founder via `/api/platform/help` | artikel | artikel met versie | 403 voor platformartikelen buiten de founder |
| `POST /api/help/:id/verberg` | beheerder | geen | ok | niet vastgelegd; voorstel |
| `GET /api/help/statistiek` | beheerder (eigen), founder (alles) | filters | per artikel | niet vastgelegd; voorstel |

### AI-stappen

- **Agent** Gids, mandaat A, alleen lezen (11.3).
- **Materiaal**: de zoekresultaten van dezelfde full-text search (geen aparte vectorindex bij honderden artikelen), plus de eigen kennisbank als de organisatie dat aanzet.
- **Schema**: `{antwoord, citaten[{artikelId, tekst}], gevonden: boolean}` met `additionalProperties false`; `citatenGeldig` moet waar zijn, anders de tekst zonder bron.
- **Vangrails**: bewijsplicht op citaten; geen antwoord zonder citaat; privégegevens gemaskeerd; de vraag zelf wordt bewaard zonder namen (namenfilter, 11.2).
- **Mock**: vaste antwoorden op drie vragen met citaten uit de startinhoud; één vraag zonder bron.
- **Bundelsoort**: "Helpvraag", Claude Haiku, 200 / 1.000 / 1.000 per maand (11.4).
- AI-concept per new business-artikel voor de schrijvers (open vraag 14): buiten de app, een mens redigeert; niet in deze prompt als functie.

### Integraties

Geen externe. Startinhoud als Markdown in `content/help/` en bij een release in de tabel geladen als platformlaag (review via pull requests). Schermafbeeldingen gemaakt met Playwright op de mock-server met de startset Voltvast.

### Functiecatalogus

Niet vastgelegd in het bouwplan welke sleutels; voorstel:

| Sleutel | Niveau | Pakket | Recht | Helpartikel |
|---|---|---|---|---|
| `help.lezen` | Beginner | Starter | iedereen | Je eerste dag |
| `help.vraag` | Beginner | Starter (bundel 200) | iedereen | Je eerste dag |
| `help.leerpad.gevorderd` | Gevorderd | Starter | iedereen | Je niveau en wat er komt |
| `help.leerpad.expert` | Expert | Starter | iedereen | Je niveau en wat er komt |
| `help.eigenArtikelen` | Expert | Plus | beheerder | Gebruikers, rollen en niveaus (voorstel: sectie "Eigen artikelen") |
| `help.kennisbankBron` | Expert | Plus | beheerder | Koppelingen (voorstel) |

### Hergebruik uit DealDrive

- `helpcenter/index.vue` en `[categorie].vue`: kaartenstructuur; vervang Kennisbank en Playbooks door de twee collecties en het leerpad.
- `useHelpcenterInstructies.ts`: instructies op maat van de rol; uitbreiden met niveau.
- `HelpIllustratie.vue`, `helpcenterAfbeelding.ts`, `scripts/helpcenter-afbeeldingen.ts`: schermafbeeldingen per route, nu op desktop en op 390 px.

### Buiten scope

Een vectorindex; video-opnames maken (alleen een videolink); vertalingen; het groeipad zelf (P09); het platformbeheer van rechten en versies (P24 levert de route).

## Acceptatiecriteria

1. De hulpknop op elk scherm opent het juiste artikel; een Playwright-test loopt alle routes uit 6.1 en 8.4 langs.
2. Elke functie in de catalogus heeft een gepubliceerd helpartikel; `check:functies` is groen; elke feature F01 tot en met F25 heeft minstens één artikel in "Hoe werkt Dealtrace".
3. Het leerpad telt gelezen artikelen voor het groeipad (4.4): na het vijfde artikel van het leerpad Gevorderd staat het criterium op klaar.
4. De AI-vraag geeft nooit een antwoord zonder citaat uit een artikel; een vraag zonder bron geeft "Daar staat nog niets over in het helpcenter. Je vraag is doorgestuurd." en komt bij beheerder en founder.
5. Een eigen artikel van organisatie A is onzichtbaar voor B (wegwerp-Postgres); een verborgen platformartikel verdwijnt alleen bij de organisatie die het verborg.
6. Elk new business-artikel heeft de vijf vaste onderdelen; voorbeelden gebruiken alleen Voltvast of verzonnen namen zonder echte bedrijven of personen.
7. De verkoopverhaal-artikelen tonen de inhoud uit het leesmodel van de eigen organisatie (Voltvast: kernzin "Voltvast is een technische groothandel voor installateurs in Midden- en Noord-Nederland.").
8. "Bekijk als Beginner" toont het artikel zoals een Beginner het ziet.
9. Zoeken is accent- en hoofdletterongevoelig; een zoekterm zonder resultaat staat in de statistiek.
10. Niveau Beginner: ziet het leerpad Beginner; de leerpaden Gevorderd en Expert zijn leesbaar maar tellen niet en staan niet als "Jouw leerpad".
11. Niveau Gevorderd: "Jouw leerpad" toont de vijf artikelen van Gevorderd met voortgang.
12. Niveau Expert: "Jouw leerpad" toont de vijf artikelen van Expert; een beheerder (Expert) beheert eigen artikelen.
13. Telefoon (375, 390, 412 px): de hulpknop opent het artikel als schuifvenster, tekst minimaal 15 px, geen horizontale scroll, tikdoelen minimaal 44 px; de artikelen van het leerpad openen in vliegtuigmodus uit het dagpakket; "Markeer als gelezen" offline telt na synchronisatie één keer.
14. VoiceOver en TalkBack lezen de artikelpagina in de goede volgorde; tekstvergroting tot 200 procent zonder afgekapte knoppen (8.15).
15. De Gids draait in tests met de mock, zonder netwerk.
16. Bijlage A: geen regel noemt P25 in de kolom Prompt; regel 16 ("elke definitie één keer in `shared/`", alle prompts) geldt wel: de leerpaden staan één keer in `shared/help.ts` en worden door server, client en groeipad gebruikt.

## Definition of Done

Hoofdstuk 19 geldt volledig. Specifiek voor deze prompt:

- Alle artikelen staan als Markdown in `content/help/`, zijn via een pull request gereviewd en worden bij de release geladen.
- Golden master voor de Gids; unit-tests voor `leerpadVoortgang`, `artikelVoorRoute` en `citatenGeldig`.
- Het sprintdoel van sprint 12 "elke feature heeft een helpartikel en een telefoonweergave" is voor het helpdeel aangetoond met een lijst feature, artikel en schermafbeelding op 390 px.
- `docs/HOE-HET-WERKT.md` beschrijft hoe je een artikel toevoegt en publiceert.
