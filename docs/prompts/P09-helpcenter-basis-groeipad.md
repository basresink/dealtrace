# P09: Helpcenter basis en groeipad

| Onderdeel | Waarde |
|---|---|
| Sprint | 5 |
| Features | F21 Helpcenter (basis), 4.4 Het groeipad (met de zichtbaarheid uit 4.5) |
| Hangt af van | P01 (niveaus, functiecatalogus met helpartikel per functie, vergrendelde menugroep), P27 (mobiele schil, schuifvenster), P02 (platformlaag, systeemorganisatie), P06 (motor voor de inzichten), P07 (Vandaag, taken, inzichten, activiteitenlog), P08 (bundel voor later; niet nodig voor de basis) |
| Bron in het bouwplan | F21, hoofdstuk 4 (4.1 tot en met 4.6), 2.3 (hulp waar je bent, vergrendeld met uitleg), 6.1 (vergrendelde items), 6.3, 8.8 (dagpakket met leerpad), 10.2 (`help_*`), 14, 19, 22 (open vraag 2 en 14), ADR-012, Bijlage A (gat 16) |

## Lees eerst

- `Bouwplan-Dealtrace.md`: 2.1 (groeien in niveaus), 2.3, 3.1, hoofdstuk 4 volledig, 5.3, 6.1 tot en met 6.3, 8.4 (Meer), 8.8, F20 (Coach stelt niveauvoorstellen; teamdeel komt in P21), F21 volledig, F22 (Mijn instellingen, "Toon minder"), F23 (platformartikelen), F24 (meldingen "niveauvoorstel en ontgrendeling"), 10.2, 11.3 (Gids), 14, 19, 22, ADR-012.
- DealDrive op commit 75bee61 (alleen lezen). Bijlage B noemt geen helpcenterbestanden; ter verdieping van wat DealDrive al had: `app/pages/helpcenter/index.vue`, `app/pages/helpcenter/[categorie].vue`, `app/pages/helpcenter/instructies.vue`, `app/composables/useHelpcenterInstructies.ts`, `app/components/HelpIllustratie.vue`, `app/utils/helpcenterAfbeelding.ts`. Voor de functiecatalogus en pakketten (Bijlage B, rij Instellingen): `shared/features.ts`, `server/utils/featureFlags.ts`, `server/utils/pakketten.ts`, `shared/settingKeys.ts`.

## Deel 1: Functioneel (wat en waarom)

### Wat je bouwt

Je bouwt het helpcenter om te lezen (startpagina, artikelpagina, contextuele hulp per scherm, zoeken, leerpaden met gelezen-status en controlevragen) en het groeipad dat een gebruiker met cijfers voordraagt voor het volgende niveau, waarna de salesmanager beslist.

### Waarom

Een accountmanager die new business niet gewend is, raakt de weg kwijt in een tool met 25 features; een ervaren hunter wil juist alles kunnen inrichten (4.1). Het helpcenter is het leermiddel van het niveaumodel: elk niveau heeft een leerpad, en de coaching verwijst naar artikelen (F21, B10). Het groeipad maakt groei zichtbaar en coachbaar en blijft een gesprek tussen accountmanager en salesmanager; automatisch verhogen zonder mens is afgewezen (ADR-012).

### Gebruikers en niveaus

| Rol | Niveau | Wat |
|---|---|---|
| Accountmanager | Beginner | Alles lezen; leerpad Beginner; kaart "Jouw niveau" op Vandaag met voortgang; profiel "Jouw niveau" met "Vraag het volgende niveau aan" |
| Accountmanager | Gevorderd | Leerpad Gevorderd; kaart en profiel als Beginner, naar Expert |
| Accountmanager | Expert | Leerpad Expert; geen kaart "Jouw niveau" op Vandaag |
| Salesmanager | Gevorderd of Expert | Krijgt het inzicht "Sanne is klaar voor Gevorderd" met de cijfers; "Verhoog niveau", "Nog niet" met reden; zet niveaus in het team en verlaagt met reden |
| Beheerder | Expert | Als salesmanager voor de hele organisatie; stelt de criteria per organisatie in; kiest "Iedereen ziet alles"; kan platformartikelen verbergen en eigen artikelen toevoegen (editor in P25) |
| Founder | n.v.t. | Beheert platformartikelen (Platformbeheer, F23; editor in P25) |

### Schermen

**Startpagina** (`/help`, onderaan de zijbalk "Helpcenter"), van boven naar beneden:

1. Zoekveld "Waar kunnen we je mee helpen?".
2. Blok **"Jouw leerpad"**: de artikelen van je niveau met voortgang ("3 van 5 gelezen").
3. Blok **"Hoe werkt Dealtrace"** met de categorieën: Aan de slag, Dagelijks werk, Prospects, Plannen en sturen, Inrichten (beheerder), Voor de salesmanager.
4. Blok **"New business"** met de categorieën: Fundament, Voorbereiden, Bellen, Bezwaren, Schrijven, Op pad, Volhouden, Afsluiten, Jezelf verbeteren.
5. **"Nieuw en bijgewerkt"**.
6. **"Stel je vraag"**: de AI-vraag komt in P25 (sprint 12). Niet vastgelegd in het bouwplan hoe dit blok vóór P25 eruitziet; voorstel: het blok ontbreekt tot P25.

**Artikelpagina** (`/help/:collectie/:artikel`): titel, leestijd, niveau-pil, categorie, inhoud (tekst, schermafbeeldingen, korte video, stappen), "Probeer het" (knop die het scherm opent waar het over gaat), controlevragen waar het artikel ze heeft, "Was dit nuttig?" (ja of nee met reden), gerelateerde artikelen, laatst bijgewerkt. Een new business-artikel heeft de vaste opbouw "Waarom dit werkt", "Zo doe je het", "Voorbeeld", "Valkuilen", "Zo doe je het in Dealtrace" (met "Probeer het").

**Hulp in de paginakop**: de knop "Hulp" in elke paginakop opent het artikel van dat scherm in een flyout van 560 px. Vergrendelde functies linken naar hun artikel; lege staten kunnen een link "Lees hoe het werkt" hebben.

**Lege staten**: zoeken zonder treffer. Niet vastgelegd in het bouwplan; voorstel: "Daar staat nog niets over in het helpcenter. Probeer een ander woord." De zoekterm wordt bewaard in `help_zoekopdrachten` voor de statistiek. Een scherm zonder artikel kan niet bestaan (`check:functies`).

**Groeipad, voor de gebruiker**

- **Mijn instellingen, "Jouw niveau"**: de voortgang per criterium als balkjes, en de knop "Vraag het volgende niveau aan" (wordt een taak voor de salesmanager). Daaronder "Toon minder": zelf een niveau lager kiezen, nooit hoger (4.5).
- **Vandaag**: kaart "Jouw niveau" onderaan met de voortgang naar het volgende niveau (Beginner en Gevorderd, 4.5).
- **Vergrendelde flyout** (6.1, 480 px): kicker "Gevorderd · vergrendeld", "Wat het doet" (twee zinnen), "Wanneer het opengaat" (de criteria uit 4.4 als bewijsregels met voortgang), "Tot die tijd" (wat Dealtrace alvast voor je doet), knop "Vraag je salesmanager". P01 bouwt de flyout; deze prompt vult "Wanneer het opengaat" met echte voortgang.
- **Na een verhoging**: welkomstvenster met de drie belangrijkste nieuwe functies en het leerpad van het nieuwe niveau; toast "Gevorderd ontgrendeld. Leadgenerator en Prospectplanning staan nu in je menu."; de nieuwe menu-items houden één week de pil "nieuw".

**Groeipad, voor de salesmanager**

- Inzicht "Sanne is klaar voor Gevorderd" met de cijfers per criterium; knoppen "Verhoog niveau" en "Nog niet" (met reden; het voorstel komt na 20 werkdagen terug).
- Niveau zetten en verlagen voor teamleden. Het teamscherm zelf komt in P21. Niet vastgelegd in het bouwplan waar de salesmanager vóór P21 een niveau zet; voorstel: in het inzicht zelf, en in Instellingen, Gebruikers (beheerder, F22) met de segmentknoppen Beginner, Gevorderd, Expert; verlagen vraagt bevestiging en een reden.

Niveauregels in de weergave (4.5): het woord van het niveau verschijnt alleen in het gebruikersblok ("ACCOUNTMANAGER · BEGINNER"), het profiel en bij de salesmanager, nooit naast een naam in lijsten. Niveau en vergrendeling gebruiken alleen bestaande tokens (`--wit-30`, `--wit-55`, `--muted`, gestippelde pil), nooit rood of geel.

**Telefoon (390 px).** "Helpcenter" staat onder "Meer" (8.4). De startpagina is één kolom; de hulpflyout opent als schuifvenster van onderen tot 92 procent hoogte. De artikelen van het leerpad van je niveau staan in het dagpakket en zijn offline te lezen (8.8); gelezen markeren werkt offline via de wachtrij. Lopende tekst minimaal 15 px (8.3). "Probeer het" opent het scherm in de telefoonweergave; voor een scherm dat bewust niet op de telefoon staat, toont het "Beter op een groot scherm".

### Klikpaden

1. **Hulp op een scherm.** Klik "Hulp" in de paginakop van Acties; de flyout opent met het artikel "Een taak afronden met een uitkomst"; Escape sluit.
2. **Leerpad lezen.** Op `/help` klik het eerste artikel van "Jouw leerpad"; scroll tot het einde; het artikel telt als gelezen en de voortgang wordt "1 van 5". Alternatief: "Markeer als gelezen".
3. **Controlevraag.** Bij een artikel met drie meerkeuzevragen beantwoord je ze; Niet vastgelegd in het bouwplan of fout beantwoorden het lezen ongedaan maakt; voorstel: het artikel telt als gelezen, `vragenGoed` wordt bewaard en een fout antwoord toont de juiste uitleg.
4. **Nuttig.** "Was dit nuttig?", "Nee", reden kiezen; toast "Bedankt. We gebruiken dit om het artikel te verbeteren." (Niet vastgelegd in het bouwplan; voorstel voor de tekst.)
5. **Volgende niveau aanvragen.** In Mijn instellingen "Vraag het volgende niveau aan"; er komt een taak voor de salesmanager met de cijfers; toast "Aanvraag verstuurd naar je salesmanager." (voorstel).
6. **Voorstel van de nachtelijke job.** De salesmanager opent het inzicht, ziet de cijfers en klikt "Verhoog niveau"; de gebruiker krijgt bij de volgende opening het welkomstvenster en de toast; audit en `niveauHistorie` worden bijgewerkt.
7. **Nog niet.** De salesmanager klikt "Nog niet", vult een reden in; het voorstel verdwijnt en komt na 20 werkdagen terug.
8. **Toon minder.** De gebruiker kiest in Mijn instellingen een niveau lager; de zijbalk toont minder items zonder dat de plek van de rest verandert; audit.

### Filters en sorteren

`/help?zoek=&collectie=&niveau=` in de URL. Zoeken accent- en hoofdletterongevoelig, resultaten gegroepeerd per collectie. Leerpad op volgorde van het leerpad, niet alfabetisch.

### Regels

- **Leerpaden** (F21):

| Leerpad | Artikelen (verplicht voor het volgende niveau) |
|---|---|
| Beginner | Je eerste dag in Dealtrace · Vandaag lezen en afronden · Een belblok uitvoeren met een script · Een afspraak plannen en afronden · Waarom vijf pogingen werken |
| Gevorderd | Leads vinden en overnemen · Je week plannen: belblokken en regiodagen · Een campagne opzetten · Inzichten beoordelen · Bezwaren ombuigen |
| Expert | Een eigen prospectreis bouwen · Regels die werk opleveren (en geen ruis) · Agents en mandaten · Je cijfers lezen en verbeteren · Scripts testen en verbeteren |

- Een artikel telt als gelezen na openen en scrollen tot het einde, of na "Markeer als gelezen".
- **Criteria** (4.4, allemaal, standaardwaarden instelbaar per organisatie): Beginner naar Gevorderd: minimaal 20 werkdagen actief, minimaal 80 procent van de taken afgerond op de dag zelf over de laatste 4 weken, minimaal 100 uitkomsten vastgelegd, leerpad Beginner afgerond (5 artikelen). Gevorderd naar Expert: minimaal 60 werkdagen als Gevorderd, minimaal 2 eigen campagnes afgerond met een uitkomst, conversie prospect naar afspraak minimaal op teamgemiddelde, leerpad Gevorderd afgerond. Terug naar een lager niveau: alleen handmatig, met een reden, nooit automatisch, door salesmanager of beheerder.
- Werkdagen tellen zonder weekend en Nederlandse feestdagen (`shared/datum.ts`). Wat een "actieve werkdag" is, staat niet in het bouwplan. Niet vastgelegd in het bouwplan; voorstel: een werkdag met minimaal één rij in `activiteiten` door de gebruiker zelf.
- Campagnes bestaan pas na P16. Niet vastgelegd in het bouwplan; voorstel: het criterium "2 eigen campagnes" toont tot P16 "Nog niet te meten" en blokkeert het voorstel naar Expert niet stil maar zichtbaar.
- Een salesmanager is minimaal Gevorderd en standaard Expert; een beheerder standaard Expert; een nieuwe accountmanager standaard Beginner, tenzij de beheerder bij het uitnodigen een ander niveau kiest (4.1).
- **Niveaus uit** ("Iedereen ziet alles"): iedereen is Expert, het groeipad verdwijnt, geen kaart "Jouw niveau", geen nachtelijke voorstellen.
- **Losse ontgrendeling** per gebruiker (`users.data.ontgrendeld[]`) verhoogt het niveau niet en telt niet mee in het groeipad.
- Een eigen artikel van organisatie A is onzichtbaar voor B; een beheerder kan een platformartikel verbergen voor zijn organisatie.

### Helpartikelen

- "Je niveau en wat er komt" (Aan de slag): de drie niveaus, de criteria, hoe je het volgende niveau aanvraagt, "Toon minder".
- "Gebruikers, rollen en niveaus" (Inrichten): niveaus zetten, criteria instellen, "Iedereen ziet alles", losse ontgrendeling.
- De vijf artikelen van het leerpad Beginner, compleet (inhoud uit de prompts die de functies bouwen; open vraag 14: AI-concept per artikel, een mens redigeert). Van de leerpaden Gevorderd en Expert schrijf je de titels en een samenvatting. Niet vastgelegd in het bouwplan welke artikelen in de basis volledig moeten zijn; voorstel: Beginner volledig nu, Gevorderd volledig in P10, P11 en P12 (die de functies bouwen), Expert in P22 en P25.
- Voor elk scherm dat P01 tot en met P08 bouwden één artikel in "Hoe werkt Dealtrace", zodat de hulpknop overal werkt.

## Deel 2: Technisch (hoe)

### Datamodel

- `help_artikelen: id, organisation_id (null = platform), collectie ('product'|'newbusiness'), categorie, slug, titel, niveau, status, versie, data {samenvatting, inhoud (markdown), routes[], features[], vragen[], videoUrl?}, gepubliceerd_op`.
- `help_gelezen: organisation_id, gebruiker_id, artikel_id, op, vragenGoed?`; `help_feedback: artikel_id, gebruiker_id, nuttig, reden?`; `help_zoekopdrachten: organisation_id, term, resultaten, op`.
- Verbergen van een platformartikel per organisatie: Niet vastgelegd in het bouwplan; voorstel: `org_settings` sleutel `helpVerborgen` (lijst artikel-id's).
- Zoeken met Postgres full-text search: `to_tsvector('dutch', titel || samenvatting || inhoud)` met een GIN-index.
- RLS: platformartikelen (`organisation_id` null) leesbaar voor iedereen via een eigen policy; eigen artikelen met `org_isolation`; `help_gelezen` en `help_feedback` alleen eigen rijen schrijven.
- Groeipad: `users.niveau`, `users.data.ontgrendeld[]`, `users.data.niveauHistorie[] {van, naar, op, door, reden}`; `org_settings.niveaus = { aan, criteria {...}, standaardNiveauNieuweGebruiker }`; audit bij elke wijziging van niveau of ontgrendeling (4.6). Afwijzen met "Nog niet": Niet vastgelegd in het bouwplan; voorstel: `users.data.niveauVoorstel {status, afgewezenOp, reden, terugOp}`.
- Startinhoud als Markdown in `content/help/` met frontmatter (slug, titel, collectie, categorie, niveau, routes, features, vragen); bij een release geladen in de platformlaag.
- Rechtenmatrix: help lezen iedereen; eigen artikelen beheren beheerder; platformartikelen founder (3.3, 4.3 rij F21). Niveaus zetten: salesmanager in team, beheerder alles (3.3).
- Sync-allowlist: `help_gelezen` (aanmaken, ook offline), `help_feedback`.

### Pure functies

| Functie | Invoer | Uitvoer | Randgevallen en unit-tests |
|---|---|---|---|
| `niveauVoorstel(gebruiker, telling, criteria, nu)` | telling uit de activiteitenlog en `help_gelezen` | `{klaar, criteria: [{naam, waarde, norm, gehaald}]}` | precies op 20 werkdagen; 79,9 en 80 procent; feestdagen; leerpad 4 van 5; teamgemiddelde zonder teamleden; "Nog niet" binnen 20 werkdagen |
| `actieveWerkdagen(activiteiten, van, tot, feestdagen)` | | getal | weekend; feestdag met activiteit telt niet als werkdag |
| `afgerondOpDag(taken, periode)` | | percentage | taken zonder vervaldatum tellen niet; geannuleerd telt niet |
| `leerpadVoortgang(leerpad, gelezen)` | | `{gelezen, totaal, compleet}` | verborgen artikel; nieuwe versie van een artikel telt het oude gelezen nog mee (Niet vastgelegd in het bouwplan; voorstel) |
| `artikelVoorRoute(route, artikelen, niveau)` | | artikel | route met parameter (`/acties?tab=inzichten`); meerdere artikelen kiest het eerste op niveau |
| `isGelezen(scrollpositie, hoogte)` | | boolean | kort artikel zonder scroll telt bij openen |

Bestanden: `shared/groeipad.ts` en `shared/help.ts` (Niet vastgelegd in het bouwplan; voorstel); de functiecatalogus in `shared/functies.ts` (P01) koppelt elke functie aan een helpartikel.

### Endpoints

| Methode en route | Recht | Invoer | Uitvoer | Fouten |
|---|---|---|---|---|
| `GET /api/help?zoek=&collectie=&niveau=` | iedere gebruiker | | artikelen | |
| `GET /api/help/:slug` | iedere gebruiker | | artikel | 404 voor een eigen artikel van een andere organisatie |
| `POST /api/help/:id/gelezen` | iedere gebruiker | `{vragenGoed?}` | stand | idempotent per gebruiker en artikel |
| `POST /api/help/:id/feedback` | iedere gebruiker | `{nuttig, reden?}` | 204 | 422 bij nee zonder reden (Niet vastgelegd in het bouwplan; voorstel) |
| `GET /api/mij/niveau` | iedere gebruiker | | voortgang per criterium | (voorstel) |
| `POST /api/mij/niveau/aanvraag` | accountmanager | | taak voor de salesmanager | 409 als er al een open aanvraag is (voorstel) |
| `POST /api/gebruikers/:id/niveau` | salesmanager (team), beheerder | `{niveau, reden?}` | gebruiker | 422 verlagen zonder reden; 403 buiten team (voorstel) |
| `POST /api/gebruikers/:id/niveauvoorstel/afwijzen` | salesmanager, beheerder | `{reden}` | 204 | (voorstel) |
| `POST /api/mij/toon-minder` | iedere gebruiker | `{niveau}` | gebruiker | 422 als het hoger is dan het huidige niveau (voorstel) |

`POST/PUT /api/help` (beheer) en `POST /api/help/vraag` (AI) staan in F21 maar horen bij P25.

Nachtelijke job `niveauVoorstel` in `netlify/functions/dag` (13.2): per organisatie met niveaus aan, per gebruiker de telling uit de activiteitenlog, en bij "klaar" een inzicht voor de salesmanager via de motor (bron Intern, agent Coach; de Coach-agent zelf komt in P21).

### AI-stappen

Geen in deze prompt. De AI-vraag "Stel je vraag" (Gids, bundelsoort helpvraag 200 / 1.000 / 1.000) komt in P25.

### Integraties

Geen.

### Functiecatalogus

Niet vastgelegd in het bouwplan; voorstel:

| Sleutel | Niveau | Pakket | Recht | Helpartikel |
|---|---|---|---|---|
| `help.lezen` | Beginner | Starter | iedereen | Je eerste dag in Dealtrace |
| `help.leerpad` | Beginner | Starter | iedereen | Je niveau en wat er komt |
| `groeipad.voortgang` | Beginner | Starter | accountmanager | Je niveau en wat er komt |
| `groeipad.beslissen` | Gevorderd | Starter | salesmanager | Gebruikers, rollen en niveaus |
| `niveaus.instellen` | Expert | Starter | beheerder | Gebruikers, rollen en niveaus |

Elke functie in de catalogus verwijst naar een bestaand artikel; `check:functies` faalt als een sleutel een slug noemt die niet in `content/help/` staat.

### Hergebruik uit DealDrive

- `app/pages/helpcenter/index.vue` en `[categorie].vue`: opbouw van een startpagina en categorieën; vervang de bron door `help_artikelen` en voeg leerpaden toe.
- `useHelpcenterInstructies.ts`, `HelpIllustratie.vue`, `helpcenterAfbeelding.ts`: afbeeldingen en instructies bij artikelen.
- `shared/features.ts`, `server/utils/featureFlags.ts`, `server/utils/pakketten.ts`: zijn in P01 al omgezet naar `shared/functies.ts`; hier alleen de koppeling met het helpartikel gebruiken.

### Buiten scope

- AI-vraag "Stel je vraag", editor voor artikelen, eigen artikelen toevoegen, statistiek per artikel, de volledige academie "New business" (P25).
- Platformartikelen beheren in Platformbeheer (P24).
- Team- en coachingschermen van de salesmanager en de Coach-agent (P21).

## Acceptatiecriteria

1. De hulpknop opent op elk scherm dat tot nu toe bestaat het juiste artikel; een Playwright-test loopt alle routes uit 6.1 langs die gebouwd zijn.
2. Het leerpad telt gelezen artikelen voor het groeipad (4.4): na het lezen van vijf artikelen staat het criterium "leerpad Beginner afgerond" op gehaald.
3. Een eigen artikel van organisatie A is onzichtbaar voor B (wegwerp-Postgres).
4. `niveauVoorstel` met een fixture die op elk criterium precies op de grens zit, geeft "klaar"; één punt eronder geeft "niet klaar" met dat criterium als niet gehaald in de voortgang, zonder rood of geel (4.5: alleen bestaande neutrale tokens).
5. Het inzicht "... is klaar voor Gevorderd" verschijnt alleen bij de salesmanager van het team van de gebruiker; "Nog niet" laat het voorstel na 20 werkdagen terugkomen en niet eerder.
6. Een niveau gaat nooit automatisch omhoog of omlaag; verlagen zonder reden geeft 422; elke wijziging staat in de audit en in `niveauHistorie`.
7. Na een verhoging ziet de gebruiker het welkomstvenster één keer, de toast, en de pil "nieuw" bij de nieuwe menu-items gedurende 7 dagen.
8. "Toon minder" kan alleen een lager niveau kiezen; de zijbalk verandert de plek van de overige items niet (6.1).
9. Met "Iedereen ziet alles" is iedereen Expert, verdwijnt de kaart "Jouw niveau" en draait de job geen voorstellen.
10. Bijlage A, gat 16: de criteria en leerpaden staan één keer in `shared/` en worden door job, profiel, Vandaag en de vergrendelde flyout gelezen.
11. Elke functie in de catalogus heeft een bestaand helpartikel (`check:functies` groen).
12. Telefoon (375, 390, 412 px): `/help` en de artikelpagina zonder horizontale scroll; de hulpflyout opent als schuifvenster; knoppen minimaal 44 px; een artikel uit het leerpad is in vliegtuigmodus te openen en "gelezen" komt na herstel precies één keer aan.
13. Zoeken vindt "poging" in het artikel "Wat betekent poging 3 van 5", ook met "Poging" en zonder accenten.
14. Per niveau getest: Beginner ziet leerpad Beginner, de kaart "Jouw niveau" op Vandaag en de knop "Vraag het volgende niveau aan"; Gevorderd ziet leerpad Gevorderd en de kaart naar Expert; Expert ziet leerpad Expert en geen kaart.
15. Testdata: de Voltvast-startset (Bijlage C) met de teams Binnendienst, Team Noord en Team Zuid. Niet vastgelegd in het bouwplan; voorstel: drie fictieve accountmanagers in Binnendienst met een activiteitenlog die net onder, precies op en net boven de criteria zit.

## Definition of Done

Hoofdstuk 19 geldt volledig. Specifiek voor deze prompt:

- Unit-tests voor `niveauVoorstel` en de tellers met grenzen, lege invoer en feestdagen; wegwerp-Postgres voor de RLS op platform- en eigen artikelen.
- Playwright desktop en telefoon voor `/help`, de artikelpagina, de hulpflyout, het profiel "Jouw niveau" en het welkomstvenster.
- `content/help/` bevat het leerpad Beginner volledig en een artikel voor elk bestaand scherm; open vraag 2 (criteria) is met de founder doorgenomen en de standaardwaarden uit 4.4 staan als instelling.
- `docs/HOE-HET-WERKT.md` beschrijft het groeipad en de nachtelijke job.
