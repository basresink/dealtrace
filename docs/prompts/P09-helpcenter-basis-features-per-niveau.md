# P09: Helpcenter basis en features per niveau

| Onderdeel | Waarde |
|---|---|
| Sprint | 5 |
| Features | F21 Helpcenter (basis, zonder leerpaden), 4.2 Features aan en uit per niveau (functiecatalogus, tabel `functies_per_niveau`, `/platform/features`, niveau kiezen per gebruiker, weergave "Nog niet aangezet") |
| Hangt af van | P01 (rollen, niveaus, functiecatalogus `shared/functies.ts`, zijbalk, `check:functies`), P27 (mobiele schil, schuifvenster, onderbalk met "Meer"), P02 (Platformbeheer basis, `requireFounder`, platformaudit, werken in een organisatie), P07 (Vandaag, Acties: de schermen waar de hulpknop al naar een artikel moet wijzen) |
| Bron in het bouwplan | 0.2 (B3, B10, B18, B19), hoofdstuk 4 (4.1 tot en met 4.5), 2.3, 3.3 (rij Gebruikers, rollen, niveaus), 6.1 (items die niet aanstaan), 6.3, 8.4 (Meer), F21, F22 (Gebruikers, "Toon minder"), F23 (Features per niveau), 10.2 (`help_*`, `functies_per_niveau`), 14, 19, 22 (open vraag 25), ADR-012, Bijlage A (gat 16) |

## Lees eerst

- `Bouwplan-Dealtrace.md`: 0.2 (B3, B10, B18, B19), 2.3, 3.1 en 3.3, hoofdstuk 4 volledig, 6.1 tot en met 6.3, 8.3 en 8.4, 8.8 (dagpakket), F21 volledig, F22 (Gebruikers, Mijn instellingen), F23 (rechtentabel, routes, "Features per niveau", technisch deel), F26 (alleen "Waar je hem vindt": het blok "Vraag AI" in het helpcenter), 10.2, 14, 19, 22 (open vraag 25), ADR-012.
- DealDrive op commit 75bee61 (alleen lezen): `app/pages/helpcenter/index.vue`, `app/pages/helpcenter/[categorie].vue`, `app/pages/helpcenter/instructies.vue`, `app/composables/useHelpcenterInstructies.ts`, `app/components/HelpIllustratie.vue`, `app/utils/helpcenterAfbeelding.ts`; voor de catalogus en pakketten: `shared/features.ts`, `server/utils/featureFlags.ts`, `server/utils/pakketten.ts`, `shared/settingKeys.ts`.

## Deel 1: Functioneel (wat en waarom)

### Wat je bouwt

Je bouwt het helpcenter om te lezen (startpagina met "Voor jou" en "Aan de slag", artikelpagina, hulp per scherm, zoeken) en het mechanisme waarmee per niveau elke functie aan of uit staat: de tabel `functies_per_niveau` met de startindeling uit 4.3, de pagina `/platform/features` voor de founder, het kiezen van het niveau per gebruiker door de salesmanager of beheerder, en de rustige weergave "Nog niet aangezet" zonder verzoekknop.

### Waarom

Een accountmanager die new business niet gewend is, raakt de weg kwijt in een tool met 26 features; een ervaren hunter wil juist alles kunnen inrichten (4.1). Een niveau is een set functies die aanstaat (B18). Welke functie bij welk niveau hoort, hangt af van wat in de bouw goed werkt; daarom zet de founder features per niveau aan en uit zonder code te wijzigen, en stelt hij na elke sprint de indeling vast (open vraag 25). Er is geen groeipad (B19): geen criteria, geen niveauvoorstellen, geen voortgangsbalken en geen leerpaden per niveau. Een hoger niveau is een besluit van de salesmanager. Het helpcenter legt elke functie uit; gaat een functie voor je aan, dan krijg je het artikel als eerste uitleg (F21, B10).

### Gebruikers en niveaus

| Rol | Niveau | Wat |
|---|---|---|
| Accountmanager | Beginner | Alles lezen in het helpcenter; "Voor jou" en "Aan de slag"; hulp per scherm; functies die niet aanstaan zien in de groep "Nog niet aangezet" met uitleg; "Toon minder" in Mijn instellingen |
| Accountmanager | Gevorderd | Idem; meer functies aan volgens `functies_per_niveau` |
| Accountmanager | Expert | Idem; alle functies uit het pakket aan in de startindeling |
| Salesmanager | standaard Expert | Kiest het niveau van de gebruikers in zijn eigen teams (Beginner, Gevorderd, Expert); verlagen met bevestiging |
| Beheerder | standaard Expert | Kiest het niveau van iedere gebruiker in de organisatie; kiest het standaardniveau voor nieuwe gebruikers; zet "Iedereen ziet alles"; kan platformartikelen verbergen (eigen artikelen schrijven komt in P25) |
| Founder | n.v.t. | Zet op `/platform/features` elke functie per niveau aan of uit, voor alle organisaties of als afwijking voor één organisatie; beheert platformartikelen (editor in P25) |

Rol en niveau zijn los (4.1): het niveau bepaalt welke functies aanstaan, de rol bepaalt wat je mag (3.3). Per gebruiker is alleen het niveau in te stellen; er zijn geen schakelaars per gebruiker (B18).

### Schermen

**Startpagina helpcenter** (`/help`, onderaan de zijbalk "Helpcenter"), van boven naar beneden:

1. Zoekveld "Waar kunnen we je mee helpen?".
2. Blok **"Voor jou"**: eerst de artikelen van functies die de afgelopen 7 dagen voor je aan zijn gegaan (met de pil "nieuw"), daarna **"Aan de slag"**: Je eerste dag in Dealtrace · Vandaag lezen en afronden · Een belblok uitvoeren met een script · Een afspraak plannen, afronden en overdragen · Waarom vijf pogingen werken. Een gelezen artikel krijgt een rustig vinkje; er is geen teller, geen balk en geen percentage.
3. Blok **"Hoe werkt Dealtrace"** met de categorieën Aan de slag, Dagelijks werk, Prospects, Plannen en sturen, Inrichten (alleen zichtbaar voor de beheerder), Voor de salesmanager (alleen zichtbaar voor de salesmanager).
4. Blok **"New business"** met de categorieën Fundament, Voorbereiden, Bellen, Bezwaren, Schrijven, Op pad, Volhouden, Van afspraak naar overdracht, Jezelf verbeteren. In deze prompt staan alleen de categorieën en de titels die al bestaan; de volledige academie komt in P25.
5. **"Nieuw en bijgewerkt"**: de vijf laatst gepubliceerde of bijgewerkte artikelen.
6. **"Vraag AI"**: het blok opent de AI-assistent uit P33 met de context "Helpcenter". Niet vastgelegd in het bouwplan hoe dit blok eruitziet zolang P33 nog niet gebouwd is; voorstel: het blok hangt aan de functie `assistent.chat` en ontbreekt zolang die niet in de catalogus staat.

**Artikelpagina** (`/help/:collectie/:artikel`): titel, leestijd, niveau-pil (het niveau waarvoor de functie in de startindeling aangaat, alleen als oriëntatie), categorie, inhoud (tekst, schermafbeeldingen, korte video, stappen), "Probeer het" (opent het scherm waar het over gaat), "Was dit nuttig?" (ja, of nee met reden), gerelateerde artikelen, "Laatst bijgewerkt". Een new business-artikel heeft de vaste opbouw "Waarom dit werkt", "Zo doe je het", "Voorbeeld", "Valkuilen", "Zo doe je het in Dealtrace". Onderaan "Markeer als gelezen". Er zijn geen controlevragen op de artikelpagina; lezen is nergens een voorwaarde voor (F21).

**Hulp in de paginakop**: de knop "Hulp" in elke paginakop opent het artikel van dat scherm in een flyout van 560 px. Een functie die niet aanstaat, linkt naar haar artikel; lege staten kunnen een link "Lees hoe het werkt" hebben.

**Lege staat zoeken**: Niet vastgelegd in het bouwplan; voorstel: "Daar staat nog niets over in het helpcenter. Probeer een ander woord of vraag het de AI-assistent." De zoekterm wordt bewaard in `help_zoekopdrachten`.

**Features per niveau** (`/platform/features`, alleen founder, 4.2 en F23), van boven naar beneden:

1. Kop: kicker "PLATFORMBEHEER · FEATURES PER NIVEAU", titel als zin ("63 functies, 21 aan voor Beginner."), keuze "Alle organisaties" (standaard) of één organisatie.
2. Raster: de functies uit de catalogus als rijen, gegroepeerd per feature (F01 tot en met F26) met de featurenaam als tussenkop; kolommen Beginner, Gevorderd, Expert; per cel een schakelaar aan of uit. Per rij ook pakket (Starter, Plus, Compleet) en minimale rol als meta in `--muted`.
3. Bij de keuze van één organisatie: een cel die afwijkt van "Alle organisaties" krijgt een gele markering en een knop "Terug naar standaard".
4. Onder het raster: de laatste wijzigingen (wie, wat, wanneer) met per regel "Draai terug".

Elke wijziging werkt direct, zonder release, en schrijft een auditregel. Niet vastgelegd in het bouwplan of een cel per stuk of in een bundel wordt opgeslagen; voorstel: per cel direct, met de toast "Leadgenerator staat nu aan voor Gevorderd." en "Ongedaan maken" (5 seconden).

**Niveau kiezen** (`/instellingen/gebruikers`, F22): in de gebruikerslijst per gebruiker de segmentknoppen Beginner, Gevorderd, Expert. De salesmanager ziet alleen de gebruikers in zijn teams; de beheerder ziet iedereen. Verlagen vraagt bevestiging: titel "Niveau verlagen?", tekst "Sanne Belhuis gaat van Gevorderd naar Beginner. Functies die bij Gevorderd horen, staan daarna uit; haar gegevens blijven bewaard.", knop "Verlaag niveau" (Niet vastgelegd in het bouwplan; voorstel voor de tekst). Verhogen gaat zonder bevestiging. Bij de beheerder onder de lijst: "Standaardniveau voor nieuwe gebruikers" en de schakelaar "Iedereen ziet alles".

**Nog niet aangezet** (4.2, 4.4, 6.1):

- In de zijbalk staan functies die niet voor je aanstaan samen in één ingeklapte groep onderaan, "Nog niet aangezet", met een grijze teller. Uitgeklapt: items met `aria-disabled="true"`, tekst `--wit-30`, slot-icoon van 14 px, focusbaar. De groep onthoudt per gebruiker open of dicht.
- Een klik opent een flyout van 480 px: kicker "Gevorderd · nog niet aangezet", de regel "Deze functie hoort bij Gevorderd.", "Wat het doet" (twee zinnen), "Tot die tijd" (wat Dealtrace alvast voor je doet) en de knop "Lees hoe het werkt" (opent het helpartikel). Er is **geen verzoekknop** en geen tekst over wanneer de functie opengaat; wie meer nodig heeft, bespreekt dat met de salesmanager.
- Een knop van een functie die niet aanstaat: secundaire knop met slot-icoon die dezelfde flyout opent, nooit uitgeschakeld zonder uitleg. Een blok: hoogstens één lege staat per pagina onderaan met de kicker "Nog niet aangezet".
- Een directe link naar een pagina die niet aanstaat, toont de paginakop met de kicker "Nog niet aangezet" en dezelfde uitleg; nooit een foutpagina.
- Een functie buiten het pakket toont "Onderdeel van Plus" (of Compleet), met een link naar het abonnement alleen voor de beheerder (4.2).

**Een functie gaat voor je aan** (4.4): door een hoger niveau of doordat de founder een feature aanzet. Bij de volgende opening van de app een toast "Leadgenerator staat nu voor je aan." met de link "Lees hoe het werkt"; het nieuwe menu-item houdt 7 dagen de pil "nieuw"; het artikel staat bovenaan in "Voor jou".

**Mijn instellingen, "Toon minder"** (4.4, F22): een lijst van de functies die voor je aanstaan met per functie "Verberg"; je kunt zelf functies verbergen, nooit extra aanzetten. Verborgen functies staan niet in "Nog niet aangezet" maar onder "Verborgen door jou" met "Toon weer" (Niet vastgelegd in het bouwplan; voorstel).

Niveauregels in de weergave (4.4): het woord van het niveau verschijnt alleen in het gebruikersblok ("ACCOUNTMANAGER · BEGINNER"), het profiel en bij de salesmanager, nooit naast een naam in lijsten. Niveau en "niet aangezet" gebruiken alleen bestaande tokens (`--wit-30`, `--wit-55`, `--muted`, gestippelde pil), nooit rood of geel; de gele markering op `/platform/features` is een beheermarkering voor de founder, geen niveauweergave.

**Telefoon (390 px).**

- "Helpcenter" staat onder "Meer" (8.4). De startpagina is één kolom; de hulpflyout opent als schuifvenster van onderen tot 92 procent hoogte; lopende tekst minimaal 15 px (8.3).
- "Probeer het" opent het scherm in de telefoonweergave; voor een scherm dat bewust niet op de telefoon staat, toont het "Beter op een groot scherm".
- In "Meer" staan items die niet aanstaan onderaan in de ingeklapte groep "Nog niet aangezet", net als op de laptop; de uitlegflyout opent als schuifvenster.
- De artikelen van de functies die voor je aanstaan, gaan mee in het dagpakket en zijn offline te lezen (F21, 8.8); "Markeer als gelezen" werkt offline via de wachtrij. Het dagpakket zelf komt in P30; deze prompt levert de lijst.
- `/platform/features` en `/instellingen/gebruikers` openen op de telefoon met "Beter op een groot scherm" (8.4); ze werken wel.

### Klikpaden

1. **Hulp op een scherm.** Klik "Hulp" in de paginakop van Acties; de flyout opent met "Een taak afronden met een uitkomst"; Escape sluit.
2. **Aan de slag lezen.** Op `/help` klik "Je eerste dag in Dealtrace"; scroll tot het einde; het artikel krijgt een vinkje in "Voor jou". Alternatief: "Markeer als gelezen".
3. **Nuttig.** "Was dit nuttig?", "Nee", reden kiezen ("Klopt niet", "Onduidelijk", "Mist iets", "Anders"); toast "Bedankt. We gebruiken dit om het artikel te verbeteren." (Niet vastgelegd in het bouwplan; voorstel voor de redenen en de tekst.)
4. **Feature aanzetten voor een niveau** (founder). Open `/platform/features`, kies "Alle organisaties", zet "Leadgenerator: zoeken in KvK" aan in de kolom Gevorderd. De wijziging werkt direct; een Gevorderde gebruiker ziet bij de volgende opening de toast en het menu-item met "nieuw"; de auditregel staat onder het raster.
5. **Afwijking voor één organisatie** (founder). Kies "Testbedrijf Voltvast", zet een cel uit; de cel wordt geel gemarkeerd; "Terug naar standaard" haalt de afwijking weg.
6. **Draai terug** (founder). Klik "Draai terug" bij een wijziging; de cel krijgt de vorige stand; er komt een nieuwe auditregel.
7. **Niveau kiezen** (salesmanager). In `/instellingen/gebruikers` zet Joost Stuurman Bram Middelkamp van Beginner op Gevorderd; toast "Bram Middelkamp is nu Gevorderd."; Bram ziet bij de volgende opening per nieuwe functie de toast en de pil "nieuw".
8. **Niet aangezet.** Een Beginner klikt in de groep "Nog niet aangezet" op "Leadgenerator"; de flyout toont "Deze functie hoort bij Gevorderd.", "Wat het doet", "Tot die tijd" en "Lees hoe het werkt"; er is geen knop om iets aan te vragen.
9. **Iedereen ziet alles** (beheerder). Zet de schakelaar aan; voor iedereen in de organisatie staan alle functies uit het pakket aan; de groep "Nog niet aangezet" verdwijnt.
10. **Toon minder.** In Mijn instellingen kies "Verberg" bij Campagnes; het item verdwijnt uit de zijbalk zonder dat de plek van de rest verandert.

### Filters en sorteren

- `/help?zoek=&collectie=&niveau=` in de URL. Zoeken accent- en hoofdletterongevoelig, resultaten gegroepeerd per collectie.
- `/platform/features?organisatie=&feature=`: filter op feature (F01 tot en met F26) en op "Alleen afwijkingen" (bij één organisatie). Sortering op de volgorde van de catalogus.

### Regels

- **Beschikbaarheid** (4.2): `beschikbaar(functie, gebruiker) = pakketBevat && rolMag && aanVoorNiveau`. `aanVoorNiveau` leest `functies_per_niveau`: eerst de rij van de organisatie, anders de rij voor alle organisaties. "Iedereen ziet alles" maakt `aanVoorNiveau` altijd waar; pakket en rol blijven gelden. "Toon minder" verbergt alleen in de weergave; de server blijft de functie toestaan.
- **Startindeling**: de seed van `functies_per_niveau` volgt 4.3. Een functie die in 4.3 bij Gevorderd hoort, staat aan voor Gevorderd en Expert en uit voor Beginner. De founder stelt na elke sprint vast of de indeling blijft (open vraag 25).
- **Afwijking in 4.3 tegenover 6.1**: 4.3 zet de eigen funnel (F17) aan voor Beginner, 6.1 toont het zijbalkitem Funnel pas vanaf Gevorderd. Niet vastgelegd in het bouwplan welke van de twee geldt; voorstel: de tabel is leidend, de zijbalk toont een item zodra de functie aanstaat, en de seed volgt 4.3. Leg dit voor aan de founder.
- **Niveau**: alleen `beginner`, `gevorderd`, `expert`. Een nieuwe accountmanager start op het standaardniveau van de organisatie (standaard Beginner) tenzij de beheerder bij het uitnodigen een ander niveau kiest; salesmanager en beheerder starten als Expert (4.1).
- Een niveau gaat nooit automatisch omhoog of omlaag. Elke wijziging van een niveau of van een cel in `functies_per_niveau` heeft een auditregel; een niveauwijziging ook een regel in `users.data.niveauHistorie` (4.5).
- **Geen groeipad** (B19): geen criteria, geen telling naar een volgend niveau, geen voorstellen, geen voortgangsbalken, geen leerpaden per niveau, geen controlevragen als voorwaarde, geen knop om een niveau of functie aan te vragen.
- **Gelezen**: een artikel telt als gelezen na openen en scrollen tot het einde, of na "Markeer als gelezen"; een kort artikel zonder scroll telt bij openen. Gelezen is alleen een vinkje voor de lezer.
- **Voor jou**: een functie die in de laatste 7 dagen voor de gebruiker aanging, met haar artikel; daarna "Aan de slag" zolang niet alle vijf gelezen zijn, en anders "Nieuw en bijgewerkt".
- Een eigen artikel van organisatie A is onzichtbaar voor B; een beheerder kan een platformartikel verbergen voor zijn organisatie.

### Helpartikelen

- "Je niveau en functies die aanstaan" (Hoe werkt Dealtrace, Aan de slag): wat Beginner, Gevorderd en Expert betekenen, hoe je "Nog niet aangezet" herkent, dat de salesmanager je niveau kiest, "Toon minder". Geen tekst over criteria of groeien.
- "Gebruikers, rollen en niveaus" (Inrichten): niveau kiezen, standaardniveau, "Iedereen ziet alles".
- De vijf artikelen van "Aan de slag", volledig (open vraag 14: AI-concept per artikel, een mens redigeert).
- Voor elk scherm dat P01 tot en met P08 bouwden één artikel in "Hoe werkt Dealtrace", zodat de hulpknop overal werkt; voor elke functie in de catalogus minstens een titel en samenvatting.
- Platformhandleiding "Features per niveau" voor de founder. Niet vastgelegd in het bouwplan waar die staat; voorstel: in `docs/HOE-HET-WERKT.md`, niet in het helpcenter.

## Deel 2: Technisch (hoe)

### Datamodel

- `functies_per_niveau: functie, niveau ('beginner'|'gevorderd'|'expert'), aan boolean, organisation_id (null = alle organisaties), gewijzigd_door, gewijzigd_op` (4.5). Uniek op `(functie, niveau, organisation_id)` met `NULLS NOT DISTINCT`. Alleen de founder schrijft, via de platformrol (`dealtrace_platform`, F23); de app-rol leest alleen de rijen voor null en de eigen organisatie.
- `users.niveau`, `users.data.niveauHistorie[] {van, naar, op, door}` (4.5).
- `org_settings.niveaus = { iedereenAlles: boolean, standaardNiveauNieuweGebruiker }` (4.5); de sleutel staat in `shared/settingKeys.ts`.
- Per gebruiker wanneer een functie voor hem aanging (voor de toast, de pil "nieuw" en "Voor jou"): Niet vastgelegd in het bouwplan; voorstel: `users.data.functiesGezien {sleutel: datum}`, bijgewerkt bij het ophalen van de eigen functies.
- "Toon minder": Niet vastgelegd in het bouwplan; voorstel: `users.data.verborgen[]` (lijst functiesleutels).
- Verwijder uit P01 wat bij het groeipad hoorde, als het er is: `users.data.ontgrendeld[]`, `org_settings.niveaus.criteria`, de knop "Vraag je salesmanager" en het blok "Wanneer het opengaat" in de uitlegflyout, de kicker "vergrendeld" (wordt "nog niet aangezet"). Migratie die deze velden leegt.
- Helpcenter (F21): `help_artikelen: id, organisation_id (null = platform), collectie ('product'|'newbusiness'), categorie, slug, titel, niveau, status, versie, data {samenvatting, inhoud (markdown), routes[], features[], vragen[], videoUrl?}, gepubliceerd_op`; `help_gelezen: organisation_id, gebruiker_id, artikel_id, op`; `help_feedback: artikel_id, gebruiker_id, nuttig, reden?`; `help_zoekopdrachten: organisation_id, term, resultaten, op`. Het veld `vragen[]` blijft in het schema voor de editor (P25) maar wordt in deze prompt niet getoond en is nergens een voorwaarde.
- Verbergen van een platformartikel per organisatie: Niet vastgelegd in het bouwplan; voorstel: `org_settings` sleutel `helpVerborgen` (lijst artikel-id's).
- Zoeken met Postgres full-text search: `to_tsvector('dutch', titel || ' ' || samenvatting || ' ' || inhoud)` met een GIN-index en `unaccent`.
- RLS: platformartikelen (`organisation_id` null) leesbaar voor iedereen via een eigen policy; eigen artikelen met `org_isolation`; `help_gelezen` en `help_feedback` alleen eigen rijen.
- Startinhoud als Markdown in `content/help/` met frontmatter (slug, titel, collectie, categorie, niveau, routes, features); bij een release geladen in de platformlaag.
- Rechtenmatrix (3.3): Gebruikers, rollen, niveaus: accountmanager eigen profiel; salesmanager niveaus in team zetten; beheerder alles; founder alles. `functies_per_niveau` alleen founder. Help lezen iedereen.
- Sync-allowlist: `help_gelezen` (aanmaken, ook offline), `help_feedback`. `functies_per_niveau` en `users.niveau` staan niet in de allowlist (alleen via de endpoints).

### Pure functies

| Functie | Plek | Invoer en uitvoer | Randgevallen en unit-tests |
|---|---|---|---|
| `beschikbaar(functie, gebruiker, organisatie, stand)` | `shared/functies.ts` | `{ja: true}` of `{ja: false, reden: 'pakket'\|'rol'\|'niveau'}` | pakket gaat voor rol, rol voor niveau; "Iedereen ziet alles"; afwijking van de organisatie wint van de rij voor alle organisaties; functie zonder rij in de tabel (uit, met een waarschuwing in `check:functies`) |
| `aanVoorNiveau(functie, niveau, rijen, organisatieId)` | `shared/functies.ts` | boolean | rij voor de organisatie aanwezig en anders; beide ontbreken |
| `startindeling()` | `shared/functies.ts` | rijen voor alle organisaties uit 4.3 | elke catalogussleutel heeft drie rijen; Expert heeft alles aan |
| `functiesVoor(gebruiker, organisatie, stand)` | `shared/functies.ts` | `{aan[], nietAangezet[{sleutel, niveau}], buitenPakket[], verborgen[]}` | verborgen door "Toon minder" telt niet als niet aangezet; laagste niveau waarop een functie aanstaat bepaalt de tekst "hoort bij Gevorderd" |
| `nieuwVoorMij(functiesNu, functiesGezien, nu)` | `shared/functies.ts` | sleutels die de laatste 7 dagen aangingen | precies 7 dagen; functie uit en weer aan |
| `zijbalkVoor(rol, functies, werkplek)` | `shared/navigatie.ts` (P01) | `{items[], nietAangezet[]}` | volgorde binnen "Werk" volgt de werkplek; een lager niveau verandert nooit de plek van wat blijft |
| `artikelVoorRoute(route, artikelen)` | `shared/help.ts` (voorstel) | artikel | route met parameter (`/acties?tab=inzichten`); meerdere artikelen, de eerste in de catalogus |
| `isGelezen(scrollpositie, hoogte)` | `shared/help.ts` | boolean | kort artikel zonder scroll |
| `voorJou(gebruiker, nieuw, gelezen, artikelen)` | `shared/help.ts` | lijst | geen nieuwe functies; alle "Aan de slag" gelezen |
| `artikelenVoorDagpakket(functies, artikelen)` | `shared/help.ts` | lijst slugs | alleen functies die aanstaan; verborgen platformartikel weg |

### Endpoints

| Methode en route | Recht | Invoer | Uitvoer | Fouten |
|---|---|---|---|---|
| `GET /api/mij/functies` | iedere gebruiker | | `functiesVoor` plus `nieuw[]` en een versie | |
| `GET /api/platform/features?organisatie=` | founder (`requireFounder`) | | raster met stand en afwijkingen | 404 voor iedereen zonder founderrol (middleware) |
| `PUT /api/platform/features` | founder, tweestapsverificatie | `{functie, niveau, aan, organisatieId?}` | rij | 422 bij onbekende functie of niveau |
| `DELETE /api/platform/features` | founder | `{functie, niveau, organisatieId}` | 204 (afwijking weg) | 422 zonder organisatie |
| `POST /api/platform/features/terugdraaien` | founder | `{auditId}` | rij | 409 als de cel na die wijziging nog eens wijzigde (Niet vastgelegd in het bouwplan; voorstel) |
| `PUT /api/gebruikers/:id/niveau` | salesmanager (eigen teams), beheerder | `{niveau}` | gebruiker | 403 buiten team; 422 bij onbekend niveau; 409 bij de laatste beheerder of jezelf verlagen (F22) |
| `PUT /api/settings/niveaus` | beheerder | `{iedereenAlles?, standaardNiveauNieuweGebruiker?}` | stand | 403 voor anderen |
| `PUT /api/mij/verborgen` | iedere gebruiker | `{sleutels[]}` | stand | 422 voor een functie die niet aanstaat |
| `GET /api/help?zoek=&collectie=&niveau=` | iedere gebruiker | | artikelen | |
| `GET /api/help/:slug` | iedere gebruiker | | artikel | 404 voor een eigen artikel van een andere organisatie |
| `POST /api/help/:id/gelezen` | iedere gebruiker | | stand | idempotent per gebruiker en artikel |
| `POST /api/help/:id/feedback` | iedere gebruiker | `{nuttig, reden?}` | 204 | 422 bij nee zonder reden (voorstel) |

Elke server-route van een functie roept `vereisFunctie(event, sleutel)` aan en geeft bij weigering 403 met `{functie, reden: 'pakket'|'rol'|'niveau'}` (4.2). De stand van `functies_per_niveau` wordt per verzoek gelezen of kort gecachet. Niet vastgelegd in het bouwplan hoe lang; voorstel: een cache van hooguit 30 seconden per organisatie, die bij elke `PUT` op `/api/platform/features` wordt geleegd, zodat een wijziging direct werkt. De client haalt `GET /api/mij/functies` opnieuw op bij elke paginawissel als de versie veranderde en na elke 403 met reden `niveau`.

`POST /api/assistent/vraag` (de AI-vraag uit het helpcenter) hoort bij P33; `POST/PUT /api/help` (editor) bij P25.

### AI-stappen

Geen in deze prompt. Het blok "Vraag AI" opent de assistent uit P33; die zoekt in de artikelen met `GET /api/help` als materiaal en rekent credits via `creditsVoor` (11.4).

### Integraties

Geen.

### Functiecatalogus

Niet vastgelegd in het bouwplan; voorstel (startindeling uit 4.3, alle in Starter):

| Sleutel | Startniveau | Recht | Helpartikel |
|---|---|---|---|
| `help.lezen` | Beginner | iedereen | Je eerste dag in Dealtrace |
| `help.verbergen` | Beginner | beheerder | Gebruikers, rollen en niveaus |
| `niveaus.kiezen` | Beginner | salesmanager (team), beheerder | Gebruikers, rollen en niveaus |
| `niveaus.iedereenAlles` | Beginner | beheerder | Gebruikers, rollen en niveaus |
| `instellingen.toonMinder` | Beginner | iedereen | Je niveau en functies die aanstaan |
| `platform.features` | n.v.t. | founder | (platformhandleiding) |

Het recht beperkt `niveaus.*` tot salesmanager en beheerder; het startniveau Beginner betekent alleen dat het niveau van die gebruiker er niet tussen zit. `check:functies` faalt als een sleutel geen helpartikel heeft dat in `content/help/` staat, of geen drie rijen in de startindeling.

### Hergebruik uit DealDrive

- `app/pages/helpcenter/index.vue` en `[categorie].vue`: opbouw van startpagina en categorieën; vervang de bron door `help_artikelen` en voeg "Voor jou" toe.
- `useHelpcenterInstructies.ts`, `HelpIllustratie.vue`, `helpcenterAfbeelding.ts`: afbeeldingen en instructies bij artikelen.
- `shared/features.ts`, `server/utils/featureFlags.ts`, `server/utils/pakketten.ts`: in P01 omgezet naar `shared/functies.ts`; hier voeg je `aanVoorNiveau` met de tabel toe en vervang je een vaste niveau-indeling in code door de tabel.

### Buiten scope

- De AI-assistent en de AI-vraag in het helpcenter (P33).
- Editor voor artikelen, eigen artikelen toevoegen, statistiek per artikel, de volledige academie "New business" (P25).
- Platformartikelen beheren in Platformbeheer (P24); de overige pagina's van Platformbeheer (P24).
- Team- en coachingschermen van de salesmanager (P21).
- Het dagpakket zelf (P30).
- Alles wat bij het groeipad hoorde: criteria, niveauvoorstellen, voortgang, leerpaden, controlevragen als voorwaarde, aanvragen van een niveau of functie (B19).

## Acceptatiecriteria

1. De hulpknop opent op elk scherm dat tot nu toe bestaat het juiste artikel; een Playwright-test loopt alle gebouwde routes uit 6.1 langs.
2. Na de seed heeft `functies_per_niveau` voor elke catalogussleutel drie rijen voor alle organisaties, volgens 4.3; Expert heeft alles aan.
3. Founder zet op `/platform/features` een functie aan voor Gevorderd: zonder herstart of release geeft het endpoint van die functie binnen 30 seconden 200 voor een Gevorderde gebruiker in plaats van 403 met reden `niveau`; de wijziging staat in de platformaudit.
4. Een afwijking voor Testbedrijf Voltvast geldt alleen voor Voltvast (wegwerp-Postgres met een tweede organisatie); de cel is geel gemarkeerd; "Terug naar standaard" haalt de rij weg.
5. "Draai terug" zet de vorige stand terug en schrijft een nieuwe auditregel.
6. Een beheerder, salesmanager of accountmanager krijgt 404 op elke `/api/platform/features`-route en kan `functies_per_niveau` niet via instellingen of sync schrijven (cross-tenant- en platformscheidingstest).
7. De salesmanager zet het niveau van een gebruiker in zijn team; voor een gebruiker buiten zijn team krijgt hij 403. Elke niveauwijziging staat in de audit en in `niveauHistorie`; verlagen vraagt bevestiging.
8. Een niveau verandert nooit vanzelf: er bestaat geen job, endpoint of scherm dat een niveau voorstelt, een criterium telt of een niveau of functie laat aanvragen (codezoektocht op `niveauVoorstel`, `ontgrendeld`, `criteria`, `leerpad` en `Vraag je salesmanager` levert niets op).
9. Een functie die niet aanstaat staat in "Nog niet aangezet" met slot; de flyout toont "Deze functie hoort bij Gevorderd." en "Lees hoe het werkt" en geen verzoekknop; een directe link toont de paginakop met de kicker "Nog niet aangezet", geen foutpagina.
10. Gaat een functie voor een gebruiker aan, dan ziet hij één keer de toast, 7 dagen de pil "nieuw" en het artikel bovenaan "Voor jou".
11. "Iedereen ziet alles" zet voor iedereen alle functies uit het pakket aan; een functie buiten het pakket blijft "Onderdeel van Plus".
12. "Toon minder" verbergt een functie in de zijbalk zonder de plek van de rest te veranderen; een functie die niet aanstaat kan niet via "Toon minder" aan.
13. Het helpcenter heeft geen voortgangsbalk, geen teller "n van m gelezen", geen leerpad per niveau en geen controlevragen; "Aan de slag" toont vijf artikelen met een vinkje na lezen.
14. Een eigen artikel van organisatie A is onzichtbaar voor B (wegwerp-Postgres).
15. Zoeken vindt "poging" in "Wat betekent poging 3 van 5", ook met "Poging" en zonder accenten.
16. Bijlage A, gat 16: de catalogus, de startindeling en `beschikbaar` staan één keer in `shared/functies.ts` en worden door server, zijbalk, knoppen en "Meer" gelezen.
17. Telefoon (375, 390, 412 px): `/help` en de artikelpagina zonder horizontale scroll; de hulpflyout en de uitlegflyout openen als schuifvenster; "Nog niet aangezet" staat onderaan in "Meer"; knoppen minimaal 44 px; "Markeer als gelezen" in vliegtuigmodus komt na herstel precies één keer aan.
18. Per niveau getest met de Voltvast-seed: Beginner (Bram Middelkamp) ziet de functies die in de startindeling bij Beginner aanstaan en de rest in "Nog niet aangezet"; Gevorderd (Sanne Belhuis) ziet daarnaast de Gevorderd-functies, onder meer de Leadgenerator; Expert (Joost Stuurman als salesmanager) ziet alles uit het pakket en geen groep "Nog niet aangezet".

## Definition of Done

Hoofdstuk 19 geldt volledig. Specifiek voor deze prompt:

- Unit-tests voor `beschikbaar`, `aanVoorNiveau`, `startindeling`, `functiesVoor` en `nieuwVoorMij` met grenzen en lege invoer; wegwerp-Postgres voor RLS op `functies_per_niveau`, platform- en eigen artikelen en de platformscheiding.
- Playwright desktop en telefoon voor `/help`, de artikelpagina, de hulpflyout, de groep "Nog niet aangezet" met de uitlegflyout, `/instellingen/gebruikers` (niveau kiezen) en `/platform/features`.
- `check:functies` groen: elke sleutel heeft een helpartikel en drie rijen in de startindeling.
- `content/help/` bevat "Aan de slag" volledig en een artikel voor elk bestaand scherm.
- De afwijking tussen 4.3 en 6.1 (funnel voor Beginner) is aan de founder voorgelegd.
- `docs/HOE-HET-WERKT.md` beschrijft features per niveau, de cache en hoe de founder de indeling per sprint vastlegt.
