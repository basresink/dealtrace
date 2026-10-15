# Bouwplan Dealtrace

> Versie 1.4 · 15 oktober 2026 · new business voor actieve accountmanagers binnendienst en buitendienst
>
> **Waarvoor dit document is.** Dit bouwplan bundelt alle documenten in deze repository tot één ontwerp. Het is de bron voor de functionele en technische bouwprompts van Dealtrace: elk hoofdstuk in deel C is zo opgebouwd dat je er direct een functionele prompt (wat en waarom) en een technische prompt (datamodel, regels, endpoints, acceptatie) van kunt maken.
>
> **Voor wie.** De founder als productowner, ontwerpers, bouwers (mensen en Claude Code), sales-engineers en de eerste klantorganisaties.
>
> **Huisregels.** Nederlands in de je-vorm, geen gedachtestreepjes, geen Engelse termen waar een Nederlandse bestaat, data in ISO-notatie, beslissingen als ADR, schermteksten letterlijk tussen aanhalingstekens.

---

## Inhoud

| Deel | Hoofdstuk | Onderwerp |
|---|---|---|
| A | 0 | Bronnen en beslissingen van de opdrachtgever |
| A | 1 | Samenvatting |
| A | 2 | Uitgangspunten en ontwerpprincipes |
| B | 3 | Rollen |
| B | 4 | Gebruikersniveaus: Beginner, Gevorderd, Expert |
| B | 5 | De dag en de week van binnendienst, buitendienst en salesmanager |
| B | 6 | Informatiearchitectuur en navigatie |
| B | 7 | Het new business-proces: fases, statussen en prospectreis |
| B | 8 | Mobiel en onderweg |
| C | 9 | Featurecatalogus (26 features, elk met functionele en technische uitwerking) |
| D | 10 | Datamodel |
| D | 11 | AI-architectuur en agents |
| D | 12 | Integraties: CRM, KvK, Datacollectief, mail, agenda, DealDrive |
| D | 13 | Technische architectuur |
| D | 14 | Designsysteem en UI-patronen |
| D | 15 | Datakwaliteit, AVG en beveiliging |
| E | 16 | Succescriteria en KPI's |
| E | 17 | Fasering in sprints |
| E | 18 | Van bouwplan naar bouwprompts |
| E | 19 | Definition of Done en teststrategie |
| E | 20 | Beslissingen (ADR) |
| E | 21 | Risico's |
| E | 22 | Open vragen |
| E | 23 | Woordenlijst |
| Bijlage | A | Checklist bekende gaten van DealDrive |
| Bijlage | B | Hergebruikkaart DealDrive |
| Bijlage | C | Startset testdata: Testbedrijf Voltvast |

---

# Deel A · Kaders

## 0. Bronnen en beslissingen van de opdrachtgever

### 0.1 Bronnen in deze repository

| Bron | Wat het bijdraagt |
|---|---|
| `Product brief Dealtrace.txt` | Het productidee: per doelgroep een prospectreis, mens en AI samen, activiteitenlog, SalesDNA als reden achter elke stap, nee als datapunt, signalen, schermen, kanalen en de startset per organisatie |
| `Architectuurplan-NewBusiness.md` | Het architectuurplan (versie 1.0): drie fases, statusmachine, vijf lagen, datamodel, motor, zes AI-lagen, twaalf agents met mandaten, kanalen en consent, stack, KPI's, AVG, acht sprints, tien ADR's |
| `dealdrive-leadgeneratie-bouwprompts.md` | Tien bouwprompts met wat je letterlijk uit DealDrive overneemt, wat bewust anders moet en de bekende gaten; datamodel, regels en acceptatiecriteria per prompt |
| `secties/01` tot en met `14` plus schermafbeeldingen | Uitgebreide beschrijvingen van de DealDrive-features die als basis dienen: accounts, contacten, bezoeken, meetings, briefings, belblokken, prospectplanning, campagnes, taken en inzichten, leadgenerator, activity selling-regels, accountmatrix, gebieden, prospectreis |
| `hq-input/` | De founder-console van DealDrive (klanten, abonnementen, facturen, AI-koppeling, agent-prompts, roadmap, toegang). In Dealtrace komt dit in de app zelf (zie 0.2) |
| `designsysteem/` en `dealdrive-leadgeneratie-stijl.css` | Het complete stijlbestand en opbouwdocument: tokens, schil, bediening, lagen en data |
| `mockup/` | Klikbare mockup van de schermen (Vandaag, account, agents, belblokken, campagnes, wizard, bord, contacten, dashboard, hercontact, instellingen, inzichten, jaarplanning, kanalen) |
| `DealDrive-features-voor-Dealtrace.docx/.pdf` | De gebundelde featurebeschrijvingen als Word- en pdf-bestand |
| `bijlagen/SalesDNA-sublagen-voor-Dealtrace.docx` | De zeven SalesDNA-sublagen (bedrijfsverhaal, ambitie en visie, waarde en belofte, concurrenten, branches, winpunten, hercontact ritme) met velden, statussen, regels en de fictieve demo Testbedrijf Voltvast (F25, Bijlage C) |
| `docs/api/` | Het voorbereide API-contract met DealDrive (B21) |
| DealDrive `develop` (commit 75bee61) | De code van DealDrive, inclusief de telefoonapp Dex, als basis voor hergebruik (hoofdstuk 8, Bijlage B) |

### 0.2 Beslissingen van de opdrachtgever (14 oktober 2026)

Deze beslissingen gaan voor alles wat in de bronnen anders staat.

| # | Beslissing | Gevolg in dit plan |
|---|---|---|
| B1 | De productnaam is **Dealtrace** | Overal Dealtrace in plaats van "DealDrive New Business" (lost open vraag 1 van het architectuurplan op) |
| B2 | Dealtrace is voor **actieve accountmanagers binnendienst en buitendienst** die new business doen, met **salesmanagers** voor controle, analyse en coaching | Twee werkplekprofielen (binnendienst en buitendienst) en een volwaardige managerlaag (hoofdstuk 3, 5 en feature F20) |
| B3 | De gebruiker werkt in **drie niveaus: Beginner, Gevorderd, Expert**. De beginner krijgt de basisfuncties, gevorderd meer, expert alles | Niveaumodel met een startindeling van de functies en functies die nog niet aanstaan met uitleg (hoofdstuk 4); zie ook B18 en B19 |
| B4 | **Geen aparte HQ**. Alle founder- en beheerfuncties zitten in de app zelf, achter de juiste rol | Eén app, één domein, één build; platformbeheer als afgeschermde sectie (feature F23 en ADR-011) |
| B5 | **Standaard belscript-templates** die je in Instellingen maakt en die de gebruiker kiest | Feature F08 |
| B6 | **Eigen velden** (custom fields) toevoegen | Feature F19 |
| B7 | **AI-agents voor interne en externe bronnen** die inzichten presenteren | Feature F14 en hoofdstuk 11 |
| B8 | **Prospectreis** (in DealDrive de customer journey) als **standaard**, maar ook als **maatwerk**: de gebruiker maakt een eigen prospectreis per doelgroep | Feature F05 |
| B9 | **Kansen langs de route bij bezoeken**, zoals in DealDrive | Feature F10 |
| B10 | **Helpcenter** met artikelen over hoe Dealtrace werkt en **new business-artikelen** (hoe werf je nieuwe klanten) | Feature F21 |
| B11 | **Leadgenerator** om nieuwe prospects toe te voegen via import, CRM-koppeling en externe bronnen (**KvK**, **Datacollectief**) | Feature F02 en hoofdstuk 12 |
| B12 | **Inloggen met een eenmalige code per mail**, geen wachtwoord | Supabase e-mail-OTP voor iedereen; TOTP erbij voor de founder (13.1, 15.3); open vraag 1 is daarmee gesloten |
| B13 | **Mobiel en onderweg** werken volwaardig vanuit de app | Hoofdstuk 8: mobiele schil met onderbalk (ADR-019), één app zonder aparte telefoonbuild (ADR-020), schermen op 390 px, onderweg-functies, een offline dag, tests op echte toestellen |
| B14 | **Het aantal sprints volgt de inhoud** (de bronnen noemden 8 en 10) | Twaalf sprints van twee weken (hoofdstuk 17); na elke sprint stelt de founder vast of de volgende zo blijft |
| B15 | **Het stijlbestand is leidend** | `designsysteem/dealdrive-designsysteem.css`: hoeken 2 px, 32 px boven en onder een sectie, 16 px tussen en in kaarten (hoofdstuk 14); waar `dealdrive-leadgeneratie-stijl.css` iets anders zegt (hoeken tot 4 px), geldt het designsysteem |
| B16 | **SalesDNA-sublagen** zijn de bron van het verkoopverhaal | Feature F25 met één leesmodel (ADR-017), terugkomregels naast hercontactritmes (ADR-018), webhooks en suggesties terug (hoofdstuk 12), startset Voltvast (Bijlage C) |
| B17 | **Dealtrace loopt tot en met de eerste afspraak.** Geen pipeline, deals en offertes in de app; de pipeline wordt de **funnel van de prospectreis** | Drie fases tot en met de eerste afspraak (7.1); status `overgedragen` in plaats van `klant`; F17 wordt Funnel van de prospectreis; na de eerste afspraak gaat het account over naar DealDrive, het CRM of een collega; offertematrix, offertebriefing, deals en offertes vervallen (ADR-021) |
| B18 | **Het niveau wordt bepaald door features aan en uit te zetten.** Welke functie bij welk niveau hoort, hangt af van wat in de bouw werkt; de founder regelt dat zelf. Geen schakelaars per gebruiker | Per niveau staat elke functie aan of uit in de functiecatalogus, te wijzigen in Platformbeheer; de salesmanager of beheerder kiest alleen het niveau van een gebruiker; de indeling in 4.3 is een startindeling (4.1, 4.2, ADR-012) |
| B19 | **Geen groeipad** | Geen criteria, geen niveauvoorstellen, geen voortgangsbalken en geen leerpaden per niveau; een functie aanzetten is een besluit van de salesmanager |
| B20 | **Iedere gebruiker kan chatten met AI** om ondersteund te worden; het abonnement bepaalt via **credits** hoeveel. **Credits gelden voor alle AI-onderdelen**, niet alleen de chat | Nieuwe feature F26 AI-assistent; één pot AI-credits per organisatie per maand voor chat, zoekrondes, dossiers, inzichten, concepten, scripts, verslagen, spraak en coach (11.4, F23, F26, ADR-022). Aantallen voorlopig zoals in 11.4 |
| B21 | **De API met DealDrive wordt voorbereid**, nog niet werkend | Contract in `docs/api/dealdrive-koppeling.md` en `docs/api/dealdrive-koppeling.openapi.yaml`, mock-antwoorden in `seed/dealdrive-mock/`; Dealtrace bouwt zijn kant met een mock (P23), DealDrive bouwt de ontvangende kant later (hoofdstuk 12) |

### 0.3 Wat dit plan wijzigt ten opzichte van het architectuurplan

| Onderwerp | Architectuurplan 1.0 | Dit bouwplan |
|---|---|---|
| Naam | DealDrive New Business (werknaam) | Dealtrace |
| Gebruiker | Hunter new business | Actieve accountmanager die naast een bestaande portefeuille new business doet, in twee profielen: binnendienst en buitendienst |
| Complexiteit | Eén interface voor iedereen | Drie gebruikersniveaus; per niveau staan functies aan of uit (B18), zonder groeipad (B19) |
| Scope | Van naam tot klant, met deals en offertes | Van naam tot en met de eerste afspraak; daarna overdracht (B17) |
| AI-hulp | Agents per taak | Plus een AI-assistent waarmee iedere gebruiker chat, met credits per abonnement (B20) |
| SalesDNA | Bron via webhooks, verplicht voor de volle werking | Blijft de voorkeursbron per sublaag, maar Dealtrace werkt volledig met een eigen inrichting in dezelfde vorm: golden circle, bedrijfsverhaal, ambitie en visie, waarde en belofte, concurrenten, branches, winpunten en terugkomregels; per onderdeel een actieve bron (F25) |
| Beheer | Beheer (superuser) als aparte route, HQ-input beschrijft een founder-console | Eén app: "Platformbeheer" als afgeschermde sectie voor de rol founder |
| Prospectreis | Eén starterset van elf fases | Standaardreis plus maatwerkreizen per doelgroep, met een editor en versies |
| Belscripts | Door AI per taak geschreven | Templates in Instellingen, door de gebruiker gekozen, met AI-invulling per account |
| Leadbronnen | AI-zoeker en import | AI-zoeker, import, CRM-koppeling, KvK en Datacollectief in één leadgenerator |
| Helpcenter | Niet beschreven | Kennisbank met twee collecties en contextuele hulp per scherm |
| Inloggen | Niet vastgelegd | Eenmalige code per mail (B12) |
| Mobiel | Eén PWA, zonder uitwerking | Mobiele schil met onderbalk, onderweg-functies en een offline dag (hoofdstuk 8) |
| Sprints | Acht | Twaalf (B14) |

### 0.4 Status van de bronnen

De bronnen zijn op verschillende momenten geschreven en spreken elkaar op punten tegen. Dit bouwplan is **leidend**; waar een bron iets anders zegt, geldt het bouwplan. De oudere stukken blijven staan als achtergrond.

| Bron | Status | Wat vervalt |
|---|---|---|
| `Product brief Dealtrace.txt` | achtergrond, nog geldig | niets; de productbrief is verwerkt |
| `Architectuurplan-NewBusiness.md` | **vervangen** door dit bouwplan | werknaam, acht sprints, aparte beheerroute, SalesDNA als verplichte bron |
| `dealdrive-leadgeneratie-bouwprompts.md` | **vervangen** door de bouwprompts in `docs/prompts/` | de tien prompts en hun volgorde; de lijst met gaten leeft voort in Bijlage A |
| `hq-input/` | **vervangen** door F23 | een aparte HQ |
| `mockup/` | **vervangen** door `mockup-dealtrace/` | naam DealDrive, emoji, ontbrekende pagina's |
| `designsysteem/` | **leidend** voor stijl (B15) | niets |
| `dealdrive-leadgeneratie-stijl.css` | achtergrond | hoeken tot 4 px |
| `secties/` | achtergrond, nog geldig | niets; de gaten staan in Bijlage A |
| `bijlagen/SalesDNA-sublagen-voor-Dealtrace.docx` | leidend voor de vorm van de sublagen | niets |

---

## 1. Samenvatting

| Onderdeel | Waarde |
|---|---|
| **Product** | Dealtrace |
| **Categorie** | Werkplek voor new business: van onbekende naam tot en met de eerste afspraak, met een vast proces, een ritme en AI die voorbereidt |
| **Primaire gebruikers** | Accountmanager binnendienst (belt en mailt vanachter het bureau), accountmanager buitendienst (bezoekt op locatie, belt tussendoor) |
| **Sturende gebruiker** | Salesmanager: richt doelgroepen, reizen en campagnes in, controleert de uitvoering, analyseert resultaten en coacht |
| **Inrichting** | Beheerder van de klantorganisatie (gebruikers, instellingen, koppelingen, belscripts, eigen velden) |
| **Platform** | Founder: organisaties, abonnementen, facturen, AI-koppeling, prompts en roadmap, binnen dezelfde app |
| **Kernbelofte** | "Open Dealtrace 's ochtends en je weet welke prospect je vandaag belt, mailt of bezoekt, waarom, met welk script of welke opening, en wat je doet als hij niet reageert." |
| **Drie fases** | 1. Vinden en kwalificeren · 2. Bewerken op ritme · 3. Verbinden: tot en met de eerste afspraak, daarna overdracht. Geen offerte en geen klant in Dealtrace (B17) |
| **Vijf lagen** | Doelgroep, prospectreis (template met versies), campagne, uitvoering per account, activiteitenlog |
| **Drie niveaus** | Beginner (werken met wat klaarstaat), Gevorderd (zelf plannen en campagnes draaien), Expert (alles, inclusief eigen reizen, regels en agents). Een niveau ontstaat door functies extra aan te zetten; de indeling wordt tijdens de bouw vastgesteld (B18). Geen groeipad (B19) |
| **AI-assistent** | Iedere gebruiker chat met AI voor ondersteuning, binnen de credits van het abonnement (F26) |
| **Drie harde principes** | Geen bewijs, geen inzicht · AI handelt nooit buiten zijn mandaat en verstuurt nooit een eerste bericht zonder goedkeuring · template en uitvoering gescheiden |
| **Stack** | Nuxt 4, Vue 3.5, Nitro, TypeScript strict, Postgres (Supabase EU) met RLS, offline-first PWA met mobiele schil, inloggen met een code per mail, Netlify, Claude via de Anthropic API met mock-provider |
| **Hergebruik** | Ongeveer 60 procent van de logica komt uit DealDrive: opslaglaag, sync, rechten, motor, journey-engine, AI-beoordeling, Pitstop, campagnes, belblokken, leadgenerator, gebieden, huisstijl |
| **Omvang** | 12 sprints van twee weken tot een complete eerste versie (hoofdstuk 17), 26 features, 33 bouwprompts |

### 1.1 Wat Dealtrace is, in zeven zinnen

1. De salesmanager legt per doelgroep vast wie je zoekt, met welk verhaal en in welk ritme; Dealtrace levert daarvoor een standaard prospectreis, en een expert kan een eigen reis per doelgroep bouwen.
2. De leadgenerator vult de doelgroep met bedrijven uit de AI-zoeker, een import, het CRM, het KvK-register of Datacollectief, ontdubbelt ze en laat je per lead zien waarom hij past.
3. Elk account doorloopt de reis met een eigen status; de motor plant elke volgende poging als taak, kiest het kanaal volgens het ritme, parkeert na de laatste poging en haalt het account terug bij een nieuwe aanleiding.
4. De binnendienst werkt in belblokken met een gekozen belscript; de buitendienst plant bezoeken en ziet langs de route welke prospects en kansen in de buurt liggen.
5. AI-agents lezen interne bronnen (eigen data, verslagen, CRM) en externe bronnen (KvK, websites, nieuws, vacatures, Datacollectief) en presenteren inzichten met bewijs; een mens beslist wat er gebeurt.
6. De salesmanager ziet per persoon en per doelgroep wat er gedaan is, wat het oplevert en waar het stokt, en coacht met concrete gesprekken, cijfers en suggesties.
7. Het helpcenter legt elk scherm uit en leert de gebruiker hoe je nieuwe klanten wint; het niveau van de gebruiker bepaalt wat hij ziet en wat hij als volgende leert.

### 1.2 Wat Dealtrace niet is

Geen tweede CRM voor bestaande klanten (dat blijft DealDrive of het eigen CRM), geen pipeline- of offertetool (na de eerste afspraak gaat het account over naar DealDrive of het CRM), geen tool die zelf eerste berichten verstuurt zonder goedkeuring, geen LinkedIn-automaat, geen plek waar winpunten worden verzonnen (ook in de eigen inrichting stelt AI alleen vragen), en geen losse beheerconsole naast de app.

---

## 2. Uitgangspunten en ontwerpprincipes

### 2.1 Negen principes

| Principe | Wat het betekent |
|---|---|
| **Vandaag is het product** | De gebruiker hoeft niets te zoeken: elke werkdag begint op Vandaag met taken, belblok, bezoeken en klaargezette concepten. De rest van de app is voor verdieping, sturing en inrichting. |
| **Aanleiding boven actie** | Elke taak toont eerst waarom (aanleiding, bron, winpunt), dan wat je doet. |
| **Geen bewijs, geen inzicht** | Elk inzicht en elke bewering in een briefing draagt bron, datum en citaat. Een AI-oordeel zonder letterlijk citaat uit het materiaal wordt weggegooid. |
| **De mens beslist** | AI maakt concepten en voorstellen; bellen, bezoeken, het eerste bericht versturen en een template activeren zijn menselijke handelingen. |
| **Template en uitvoering gescheiden** | Reizen, activiteiten, belscripts en campagnesoorten hebben versies; lopende uitvoering blijft op haar versie, zodat je kunt meten welke versie beter werkt. |
| **Meet of het werkte** | Elke activiteit heeft een verwacht resultaat; rapportage telt conversie per stap, winpunt, script en doelgroep, niet alleen afgeronde taken. |
| **Nee is een datapunt** | Een nee krijgt een reden, een terugkomdatum en een afkoelperiode per kanaal; een nieuwe aanleiding kan het account terughalen. |
| **Groeien in niveaus** | Een beginner ziet een rustige app met wat hij nodig heeft; functies komen erbij als de gebruiker er klaar voor is. Niets is verborgen zonder uitleg. |
| **Eén app** | Werkplek, sturing, inrichting en platformbeheer zitten in dezelfde app; rollen en niveaus bepalen wat je ziet. |

### 2.2 Binnendienst en buitendienst: hetzelfde proces, een andere dag

| Onderwerp | Binnendienst | Buitendienst |
|---|---|---|
| Hoofdkanaal | Telefoon en e-mail, LinkedIn als ondersteuning | Bezoek, telefoon onderweg, e-mail na het bezoek |
| Werkeenheid | Belblok (60 tot 120 minuten) met bellijst en belscript | Bezoekdag per regio met route, kansen langs de route en een bellijst voor tussendoor |
| Scherm | Desktop, twee schermen, toetsenbord | Telefoon of tablet, onderweg, slechte verbinding (offline nodig) |
| Typische uitkomst | Afspraak voor de buitendienst of online kennismaking, terugbelafspraak, nee met reden | Eerste afspraak gehouden met vervolg en overdracht, nieuwe contactpersoon, nee met reden |
| Wat AI vooral doet | Bellijst ordenen, belscript invullen per account, mailconcept na het gesprek | Bezoekbriefing (Pitstop), kansen in de buurt, verslag uit spraak of aantekeningen |
| Samenwerking | Plant afspraken in de agenda van de buitendienst (overdracht met briefing) | Geeft opvolging terug aan de binnendienst (terugbellen, no-show opnieuw inplannen) |

Dealtrace kent daarom een **werkplekprofiel** per gebruiker (`binnendienst`, `buitendienst`, `hybride`). Het profiel bepaalt de standaardindeling van Vandaag, de volgorde in de zijbalk en de mobiele onderbalk; het beperkt geen functies.

### 2.3 UX-patronen die overal gelden

| Patroon | Regel |
|---|---|
| Eén volgende beste actie | Maximaal één gele knop per scherm; de rest is secundair |
| Geen invulwerk | AI vult dossier, buying committee, script en concept vooraf in; de mens corrigeert |
| Afronden in één klik | Afronden met een uitkomst is één klik plus eventueel een datum; loggen gebeurt automatisch |
| Flyout boven pagina | Details en bewerken in een flyout rechts; de pagina blijft staan; Escape sluit |
| Lege staat die uitlegt | Elke lege lijst zegt in één zin wat er niet is en waarom; de handeling staat al in de paginakop, alleen bij een filter staat er "Toon alles" |
| Maximaal zeven items in beeld | Vandaag toont maximaal 8 taken en 4 prioriteiten met "nog N meer" |
| Hulp waar je bent | Elk scherm heeft een hulpknop die het bijbehorende helpartikel opent in een flyout |
| Uit met uitleg | Een functie die voor jouw niveau uit staat, staat in de groep "Nog niet aangezet" of als knop met slot, en opent een uitleg met wat hij doet en bij welk niveau hij hoort; nooit een uitgeschakelde knop zonder uitleg |

### 2.4 Anti-patronen die we afwijzen

- Een tweede module voor iets wat al bestaat (één campagnefeature met soorten, één reiseditor, één regelmotor).
- Boodschappen of scripts zonder winpunt, zonder vraag aan het eind of met het "wat" in de openingszin.
- Een eigen berekening per pagina: elke berekening staat één keer als pure functie in `shared/` of `server/utils/` met tests.
- Een account in twee ritmes tegelijk, of pogingen overslaan zonder uitkomst.
- AI-uitvoer zonder schema of zonder bronnen.
- Kleuren of maten buiten de tokens, tekst onder 11 px, schaduwen, hoeken boven 2 px.
- Functies verbergen zonder uitleg, of een niveau als straf laten voelen.


---

# Deel B · Gebruikers en proces

## 3. Rollen

Een rol bepaalt wat je **mag** (rechten op data en instellingen). Het niveau (hoofdstuk 4) bepaalt welke functies je **gebruikt** in je werkplek. Een werkplekprofiel (2.2) bepaalt hoe je werkplek is **ingedeeld**. Die drie staan los van elkaar.

### 3.1 De rollen

| Rol | Wie | Doet | Ziet |
|---|---|---|---|
| `accountmanager` | Accountmanager binnendienst of buitendienst | Voert de dagelijkse new business uit: bellen, mailen, bezoeken, eerste afspraken en de overdracht daarna; neemt leads over; keurt AI-concepten goed | Eigen Vandaag, alle prospects van de organisatie (filter "Van mij" standaard aan), campagnes waarin hij werkt, eigen resultaten |
| `salesmanager` | Leidinggevende van een of meer teams | Richt doelgroepen, reizen, campagnes en belscripts in; controleert de uitvoering, analyseert en coacht; keurt templateversies en AI-verbetervoorstellen goed | Alles van de eigen teams, plus het managerdeel (Team, Coaching, Analyse, Audit) |
| `beheerder` | Inrichter van de klantorganisatie (vaak de salesmanager of een salesoperations-medewerker) | Gebruikers, rollen, niveaus, instellingen, eigen velden, koppelingen, belscript-templates, agentmandaten, abonnement en facturen van de eigen organisatie | Instellingen en alle data van de organisatie |
| `founder` | Het team achter Dealtrace (niet uitdeelbaar, alleen via de database of door een andere founder) | Organisaties aanmaken en beheren, abonnementen en facturen, AI-koppeling en platformprompts, roadmap, instappen bij een organisatie met audit | Platformbeheer, en een organisatie alleen na expliciet instappen |
| `partner` | Dealer of agent zonder login | Bevestigt of weigert een doorgezette lead via een eenmalige link | Eén bevestigingspagina per lead |
| AI-agent | Geen mens; een rol in de motor met een mandaat | Zoekt, verrijkt, volgt bronnen, schrijft concepten, plant, notuleert, coacht | Alleen wat het mandaat toestaat (hoofdstuk 11) |

Een gebruiker heeft precies één rol. Een beheerder kan ook accountmanager zijn in de praktijk; dan krijgt hij de rol `beheerder` en het werkplekprofiel van zijn dagelijkse werk.

### 3.2 Teams

Een organisatie heeft teams (bijvoorbeeld "Binnendienst Noord", "Buitendienst Zuid"). Een accountmanager zit in één team; een salesmanager is eigenaar van één of meer teams. Teams bepalen:

- wat de salesmanager in Team, Coaching en Analyse ziet (alleen zijn teams, tenzij hij beheerder is);
- de standaard bellijsten en gebieden (een team heeft gebieden, zie F18);
- de koppeling binnendienst en buitendienst: een binnendienstteam kan aan een of meer buitendienstteams gekoppeld zijn, zodat een afspraak die de binnendienst maakt in de agenda van de juiste buitendienstcollega landt (regio uit de gebieden).

### 3.3 Rechtenmatrix

Niveaus `geen`, `eigen`, `team`, `alles`; acties lezen, schrijven, verwijderen, beheren. Server en client gebruiken dezelfde matrix (`shared/permissions.ts`); een tabel die niet in de matrix staat valt op `geen`.

| Onderdeel | accountmanager | salesmanager | beheerder | founder |
|---|---|---|---|---|
| Prospects, contacten | lezen alles, schrijven alles | alles, verwijderen team | alles | alleen na instappen |
| Leads en leadgenerator | lezen alles, schrijven eigen | alles | alles | alleen na instappen |
| Doelgroepen en prospectreizen | lezen; maatwerkreis maken als Expert (eigen concept) | lezen, schrijven, activeren | alles | alleen na instappen |
| Campagnes | lezen alles, schrijven eigen, verwijderen eigen | alles in team | alles | alleen na instappen |
| Taken en inzichten | lezen alles, schrijven alles, verwijderen eigen | alles in team | alles | alleen na instappen |
| Afspraken en overdrachten | lezen alles, schrijven alles, verwijderen eigen | alles in team | alles | alleen na instappen |
| Activiteitenlog | lezen alles, toevoegen | lezen | lezen | lezen na instappen |
| Belscript-templates | lezen en kiezen; persoonlijke kopie als Gevorderd | lezen, schrijven, activeren voor team | alles | platformsjablonen |
| Eigen velden | waarden invullen | waarden invullen | definities beheren | alleen na instappen |
| Regels (motor) | lezen; persoonlijke regel als Expert | lezen, schrijven voor team | alles | platformstartset |
| Coachingnotities | eigen notities lezen | lezen en schrijven voor team | lezen | geen |
| Agentmandaten | lezen | lezen | schrijven binnen platformmaxima | platformmaxima zetten |
| Gebruikers, rollen, niveaus | eigen profiel | niveaus in team voorstellen en zetten | alles | alles |
| Abonnement, facturen, verbruik | geen | verbruik team lezen | lezen, abonnement wijzigen | alles |
| Platformbeheer | geen | geen | geen | alles |

`eigen` is in de eerste sprints een zachte filter ("Van mij"); vanaf sprint 5 telt `eigen` ook server-side voor verwijderen. De salesmanager ziet alleen zijn teams; dat is server-side afgedwongen vanaf sprint 1.

---

## 4. Gebruikersniveaus: Beginner, Gevorderd, Expert

### 4.1 Waarom niveaus

Een accountmanager die new business niet gewend is, raakt de weg kwijt in een tool met 26 features. Een ervaren hunter wil juist alles kunnen inrichten. Dealtrace lost dat op met drie niveaus. **Een niveau is een set functies die aanstaat**: de Beginner werkt met de basisfuncties, Gevorderd en Expert hebben meer functies aan. Welke functies dat zijn, regelt de founder door features per niveau aan en uit te zetten (beslissing B18).

| Niveau | Voor wie | Belofte | Wat de gebruiker doet |
|---|---|---|---|
| **Beginner** | Nieuw in Dealtrace of nieuw in new business | "Alles staat klaar. Jij belt, bezoekt en rondt af." | Werkt de taken op Vandaag af, voert belblokken uit met een gekozen script, plant afspraken, bezoekt, legt uitkomsten vast, keurt concepten goed, vraagt de AI-assistent om hulp |
| **Gevorderd** | Werkt zelfstandig en wil zelf sturen | "Jij plant je eigen week en je eigen acties." | Plus: zelf leads zoeken en importeren, belblokken en routes plannen, campagnes maken uit standaardsoorten, de funnel van de prospectreis lezen, inzichten omzetten in taken, eigen scriptvarianten |
| **Expert** | Ervaren new business-verkoper of teamleider | "Jij bouwt het proces." | Plus: eigen prospectreis per doelgroep, eigen regels, agents instellen, alle campagnesoorten en mailreeksen, koppelingen en bulkbronnen, geavanceerde analyse |

Rol en niveau zijn los: een salesmanager en een beheerder hebben standaard alle functies aan. Een accountmanager start standaard als Beginner, tenzij de beheerder bij het uitnodigen een ander niveau kiest.

**De indeling is voorlopig.** Welke functie bij welk niveau hoort, hangt sterk af van wat in de bouw goed werkt. De matrix in 4.3 is de startindeling; na elke sprint stelt de founder de indeling van de functies uit die sprint vast. Een functie naar een ander niveau verschuiven is een feature aan- of uitzetten in Platformbeheer, zonder code te wijzigen.

### 4.2 Features aan en uit per niveau

Elke functie in de catalogus staat per niveau **aan** of **uit**. Dat is de enige knop; er zijn geen schakelaars per gebruiker.

```
beschikbaar(functie, gebruiker) =
     pakketBevat(organisatie.pakket, functie)           // wat de organisatie afneemt
  && rolMag(gebruiker.rol, functie.recht)               // rechten
  && aanVoorNiveau(functie, gebruiker.niveau)           // de feature staat aan voor dit niveau
```

- **Pakket** is het plafond van de organisatie (zie F23). Een functie buiten het pakket toont "Onderdeel van Plus" met een link naar het abonnement (alleen voor de beheerder).
- **Features aan en uit.** De founder zet in Platformbeheer, op de pagina "Features per niveau", elke functie per niveau aan of uit (een raster met de functies als rijen en Beginner, Gevorderd en Expert als kolommen). Dat geldt voor alle organisaties; de founder kan voor één organisatie afwijken als dat nodig is. Elke wijziging heeft een auditregel en werkt direct, zonder release.
- **Niveau kiezen.** De salesmanager of beheerder kiest bij een gebruiker alleen het niveau: Beginner, Gevorderd of Expert. Meer is er per gebruiker niet in te stellen.
- **Uit voor dit niveau.** Een functie die uit staat, toont een rustige regel: "Deze functie hoort bij Gevorderd." met de knop "Lees hoe het werkt" (helpartikel). Er is geen verzoekknop: wie meer nodig heeft, bespreekt dat met de salesmanager.
- **Alles aan**: een organisatie kan in Instellingen kiezen voor "Iedereen ziet alles". Dan staan voor iedereen alle functies uit het pakket aan.
- **Geen groeipad** (beslissing B19). Dealtrace rekent geen criteria uit, doet geen niveauvoorstellen en toont geen voortgangsbalken. Een hoger niveau is een besluit van de salesmanager.

Eén pure functie `shared/functies.ts` bevat de catalogus (sleutel, naam, pakket, recht, helpartikel) en `beschikbaar()`; de stand aan of uit per niveau komt uit de tabel `functies_per_niveau`. Server en client gebruiken hem allebei; de server weigert een endpoint van een functie die niet beschikbaar is (403 met `{functie, reden: 'pakket'|'rol'|'niveau'}`).

### 4.3 Startindeling van de functies per niveau

De kolom "Rol" noemt de minimale rol; leeg betekent iedere gebruiker. Dit is de startindeling (zie 4.1): de founder stelt per sprint vast of een functie zo blijft.

| Feature | Beginner | Gevorderd | Expert | Rol |
|---|---|---|---|---|
| F01 Vandaag | Takenlijst, afspraken, belblok van vandaag, klaargezette concepten, afronden met uitkomst | Plus: eigen indeling van de blokken, "Door agents gedaan", weekvooruitblik | Plus: eigen weergaven en filters op Vandaag | |
| F02 Leadgenerator | Een lead overnemen die de salesmanager of een agent klaarzette; handmatig één prospect toevoegen | Zoeken in KvK, import uit Excel of CSV met ontdubbelen, AI-zoekronde binnen de AI-credits | CRM-koppeling en Datacollectief in bulk, opgeslagen zoekopdrachten, automatische rondes per doelgroep | Bulkbronnen: beheerder koppelt |
| F03 Prospects en accountkaart | Lijst, kaart, gegevens bewerken, notities, status zien | Plus: segmenten, opgeslagen filters, massabewerking van eigen accounts, klasse zetten | Plus: samenvoegen van duplicaten, exporteren | Verwijderen: salesmanager |
| F04 Contacten | Contacten toevoegen en bewerken, rol in het buying committee | Plus: buying committee door AI laten voorstellen | Plus: samenvoegen, verhuizen tussen bedrijven | |
| F05 Prospectreis | De reis van een account zien en een gebeurtenis vastleggen | Plus: reis per doelgroep bekijken met aantallen per fase | Maatwerkreis per doelgroep maken (concept), fases en overgangen bewerken | Activeren: salesmanager |
| F06 Acties | Taken afronden, uitstellen, nieuwe taak | Plus: inzichten beoordelen en omzetten in een taak, bulkacties | Plus: eigen taaksjablonen | |
| F07 Belblokken | Belblok uitvoeren met de klaargezette bellijst | Belblokken zelf plannen, bellijst samenstellen en ordenen | Vaste blokken per week, eigen vulregels | |
| F08 Belscripts | Een script kiezen uit de templates; AI vult het per account in | Persoonlijke variant maken (kopie van een template) | Scripts vergelijken op resultaat, varianten testen | Templates maken: salesmanager of beheerder |
| F09 Agenda en meetings | Afspraken plannen, meetingsoort kiezen, uitkomst vastleggen, overdragen na de eerste afspraak | Plus: weekritme, afspraken voor een collega plannen | Plus: eigen agenda-indeling en sjablonen | |
| F10 Bezoeken en kansen langs de route | Bezoeken van de dag, kansen langs de route bekijken, bellijst naast de bezoeken | Route plannen, kansen toevoegen aan de dag, periodefilter | Eigen afstands- en kansregels, regiodagen plannen | |
| F11 Briefings en Pitstop | Briefing lezen vóór een gesprek of bezoek | Briefing opnieuw laten maken, bewerken, delen met een collega | Eigen briefingsoorten | |
| F12 Campagnes | Taken uit een campagne uitvoeren | Campagne maken uit de acht standaardsoorten, bord, voortgang | Alle soorten, mailreeksen, tussendoelen, Verzender op mandaat B | Activeren boven capaciteit: salesmanager |
| F13 Prospectplanning en hercontact | Volgende poging zien | Jaarplanning en maandplanning gebruiken | Ritmes kiezen per campagne, parkeerregels | Ritmes beheren: salesmanager |
| F14 AI-agents en inzichten | Inzichten lezen | Inzichten beoordelen, bronnen per account aanvullen | Agents instellen binnen het mandaat, eigen onderwerpen voor de Waarnemer | Mandaten: beheerder |
| F15 Regels | Geen | Regels lezen | Persoonlijke regel maken; teamregels voorstellen | Teamregels: salesmanager |
| F16 Accountmatrix | Klasse zien | Klasse zetten | Matrix voorstellen | Matrix: beheerder |
| F17 Funnel van de prospectreis | Eigen funnel: hoeveel accounts per fase en waar het stokt | Plus: funnel per doelgroep en campagne, conversie en doorlooptijd per fase | Plus: vergelijken van reizen en versies, eigen weergaven | Teamfunnel: salesmanager |
| F18 Gebieden en regio | Eigen gebied zien | Regio-analyse | Gebieden voorstellen | Gebieden: beheerder |
| F19 Eigen velden | Waarden invullen | Filteren en sorteren op eigen velden | Eigen velden voorstellen | Definities: beheerder |
| F20 Manager: controle, analyse, coaching | Eigen resultaten en doelen | Plus: eigen trend en vergelijking met het team | Plus: zelfanalyse met AI-coach | Teamdeel: salesmanager |
| F21 Helpcenter | Alles lezen | Alles lezen | Alles lezen | Artikelen beheren: founder en beheerder |
| F22 Instellingen | Eigen profiel en meldingen | Plus: eigen belblokken en werkplekindeling | Plus: persoonlijke regels en scripts | Organisatie-instellingen: beheerder |
| F23 Platformbeheer | Geen | Geen | Geen | Founder |
| F24 Meldingen, zoeken, mobiel | Alles | Alles | Alles | |
| F25 Verkoopverhaal en Richting | Lezen; kernzin en belofte in script en concept | Plus: varianten kiezen, huidige leverancier zetten | Plus: varianten, bezwaren en bewijs voorstellen | Inrichten: beheerder en salesmanager |
| F26 AI-assistent | Chatten binnen de credits van de organisatie | idem | idem | Credits verdelen: beheerder |

### 4.4 Hoe het niveau zichtbaar is

| Plek | Beginner | Gevorderd | Expert |
|---|---|---|---|
| Zijbalk | 11 items, groep "Nog niet aangezet" ingeklapt (zie 6.1) | 14 items | 15 items (alle) |
| Paginakop | primaire knop, "Hulp", subtitel met één zin uitleg over wat je hier doet | plus werkbalk met Weergave en Filters | plus Sortering, opgeslagen weergaven, Download; subtitel met de stand van zaken |
| Flyouts | basisvelden; geavanceerde blokken ingeklapt achter "Meer" | alle velden | alle velden plus herkomst per veld, regelcode en mandaatletter |
| Taal | volle woorden ("Kwalificatie 3 van 4 ingevuld"), geen interne codes | codes in meta | codes zichtbaar |
| Knop van een functie die niet aanstaat | secundaire knop met slot-icoon, opent de uitlegflyout (nooit uitgeschakeld zonder uitleg) | idem | n.v.t. |
| Blok van een functie die niet aanstaat | hoogstens één lege staat per pagina onderaan met kicker "Nog niet aangezet" | idem | n.v.t. |
| Gebruikersblok in de zijbalk | "ACCOUNTMANAGER · BEGINNER" | "ACCOUNTMANAGER · GEVORDERD" | "ACCOUNTMANAGER · EXPERT" |

Ontwerpregels: niveau en "niet aangezet" gebruiken alleen bestaande tokens (`--wit-30`, `--wit-55`, `--muted`, gestippelde pil), nooit rood of geel. Een niveau is geen rang: het woord verschijnt alleen in het gebruikersblok, het profiel en bij de salesmanager, niet naast een naam in lijsten. Gaat een functie voor je aan (een hoger niveau of een feature die de founder aanzet), dan volgt een toast ("Leadgenerator staat nu voor je aan.") met een link naar het helpartikel, en het nieuwe menu-item houdt één week de pil "nieuw". In Mijn instellingen kan een gebruiker met "Toon minder" zelf functies verbergen, nooit extra aanzetten.

### 4.5 Gegevens

- `users.niveau` (`beginner` | `gevorderd` | `expert`), `users.data.werkplek` (`binnendienst` | `buitendienst` | `hybride`), `users.data.niveauHistorie[] {van, naar, op, door}`.
- `functies_per_niveau: functie, niveau, aan boolean, organisation_id (null = alle organisaties), gewijzigd_door, gewijzigd_op`; alleen de founder schrijft, via Platformbeheer.
- `org_settings.niveaus = { iedereenAlles: boolean, standaardNiveauNieuweGebruiker }`.
- Audit bij elke wijziging van een niveau of een feature.

---

## 5. De dag en de week

### 5.1 Accountmanager binnendienst

| Moment | Wat hij doet | Waar |
|---|---|---|
| 08:30 (5 min) | Vandaag openen: taken met "poging n van m", eerste belblok, klaargezette mailconcepten, afspraken die hij voor de buitendienst maakte | F01 |
| 09:00 tot 10:30 | Belblok 1: bellijst uit de motor, per gesprek het gekozen belscript met de AI-invulling voor dit account, uitkomst in één klik, terugbelafspraak of afspraak voor de buitendienst | F07, F08, F09 |
| 10:30 | Mailconcepten goedkeuren en versturen, LinkedIn-taken (bezoek, connectie, bericht) | F06, F12 |
| 11:00 tot 12:00 | Leads beoordelen en overnemen (Gevorderd), dossiers nakijken | F02 |
| 13:30 tot 15:00 | Belblok 2 | F07 |
| 15:00 | Inzichten beoordelen: nieuwe aanleidingen (vacature, nieuwe directeur, verhuizing) omzetten in een taak | F06, F14 |
| 16:45 (5 min) | Wat blijft liggen, wat is klaargezet voor morgen | F01 |
| Wekelijks | Weekstart met de salesmanager (cijfers en coachingpunt), campagnebord bijwerken | F20, F12 |

### 5.2 Accountmanager buitendienst

| Moment | Wat hij doet | Waar |
|---|---|---|
| Avond ervoor of 07:30 | Bezoekdag bekijken: route, briefings per bezoek, kansen langs de route, bellijst voor tussendoor | F10, F11 |
| Onderweg | Bezoek 1: Pitstop openen op de telefoon, na afloop uitkomst kiezen en een verslag inspreken of typen | F09, F11 |
| Tussen bezoeken | Een kans langs de route: onaangekondigd binnenlopen of bellen vanuit de auto (bellijst naast bezoeken), uitkomst vastleggen | F10 |
| Lunch | Taken van Vandaag op de telefoon afronden, offline als er geen bereik is | F01, F24 |
| Einde dag | Verslagen nakijken (AI-notulist), eerste afspraken overdragen met briefing, terugbeltaken naar de binnendienst | F09, F17 |
| Wekelijks | Regiodag plannen voor volgende week met kansen per gebied, weekstart | F10, F18, F20 |

### 5.3 Salesmanager

| Moment | Wat hij doet | Waar |
|---|---|---|
| Maandag 08:30 | Weekoverleg met een vooraf gevulde agenda: tempo per persoon, prospectmix, campagnes, geparkeerde accounts, coachingpunten | F20 |
| Dagelijks (10 min) | Controle: wie ligt achter op norm, welke taken blijven liggen, welke campagnes lopen achter, welke concepten wachten op goedkeuring | F20 |
| Wekelijks | Eén-op-één per accountmanager: coachingkaart met cijfers, beluisterde of gelezen gesprekken, afspraken | F20 |
| Maandelijks | AI-verbetervoorstel per doelgroep beoordelen, scripts vergelijken, de funnel per doelgroep bespreken, nieuwe campagnes | F05, F08, F17, F20 |
| Per kwartaal | Doelgroepen en reizen herzien, prospectmix en normen bijstellen | F05, F13 |

---

## 6. Informatiearchitectuur en navigatie

### 6.1 Zijbalk per niveau

De zijbalk is de schil van het designsysteem (zwart, 240 px, inklapbaar naar 64 px, Lucide-iconen, LIVE-strook, "Zoeken" met Ctrl K, groepen, onderaan meldingen en gebruikersmenu). Een lager niveau laat items weg maar verandert nooit de plek of vorm van wat blijft, zodat een gebruiker bij een hoger niveau niets opnieuw hoeft te leren.

| Groep | Item | Route | B | G | E | Rol |
|---|---|---|---|---|---|---|
| Start | Vandaag | `/` | ● | ● | ● | |
| Start | Agenda | `/agenda` | ● | ● | ● | |
| Werk | Acties | `/acties` | ● | ● | ● | |
| Werk | Belblokken | `/belblokken` | ● | ● | ● | |
| Werk | Bezoeken | `/bezoeken` | ● | ● | ● | |
| Werk | Campagnes | `/campagnes` | meedoen | ● | ● | |
| Werk | Funnel | `/funnel` | ● | ● | ● | |
| Prospects | Prospects | `/prospects` | ● | ● | ● | |
| Prospects | Contacten | `/contacten` | ● | ● | ● | |
| Prospects | Leadgenerator | `/leadgenerator` | | ● | ● | |
| Prospects | Inzichten | `/inzichten` | | ● | ● | |
| Plannen | Prospectplanning | `/planning` | | ● | ● | |
| Plannen | Richting | `/richting` | lezen | lezen | lezen | |
| Plannen | Prospectreizen | `/reizen` | | | ● | |
| Resultaat | Mijn resultaten | `/resultaten` | ● | ● | ● | |
| Manager | Team | `/team` | | | | salesmanager |
| Manager | Coaching | `/coaching` | | | | salesmanager |
| Manager | Analyse | `/analyse` | | | | salesmanager |
| Manager | Audit | `/audit` | | | | salesmanager |
| Beheer | Instellingen | `/instellingen` | | | | beheerder |
| Beheer | Platformbeheer | `/platform` | | | | founder |
| Onderaan | Meldingen, Helpcenter, gebruikersmenu (Mijn instellingen, Roadmap, Uitloggen) | | ● | ● | ● | |

Een Beginner heeft 11 items en de hele navigatie past zonder scrollen op 900 px hoogte. Het werkplekprofiel bepaalt de volgorde binnen "Werk": binnendienst zet Belblokken boven Bezoeken, buitendienst andersom.

**Items die niet aanstaan.** Wat niet voor je aanstaat, staat niet tussen de gewone items maar samen in één ingeklapte groep onderaan de navigatie: "Nog niet aangezet" met een grijze teller. Uitgeklapt staan de items met `aria-disabled="true"`, tekst `--wit-30` en een slot-icoon van 14 px; ze blijven focusbaar. Een klik opent een smalle flyout (480 px) met kicker "Gevorderd · nog niet aangezet", "Wat het doet" (twee zinnen), "Tot die tijd" (wat Dealtrace alvast voor je doet) en "Lees hoe het werkt". De groep onthoudt per gebruiker of hij open of dicht staat. Een directe link naar een pagina die niet aanstaat, toont de paginakop met kicker "Nog niet aangezet" en dezelfde uitleg; nooit een foutpagina.

### 6.2 Mobiel

Op een telefoon (kleiner dan 768 px) vervangen een compacte kop en een onderbalk met vijf tabs de zijbalk; dat is een bewuste afwijking van het designsysteem (ADR-019). De onderbalk volgt het werkplekprofiel (buitendienst: Vandaag, Route, Bellen, Prospects, Meer; binnendienst: Vandaag, Belblok, Acties, Prospects, Meer) en blijft op elk niveau gelijk; "Meer" bevat de rest van de zijbalk van je niveau. Op een tablet staand blijft de icoonstrook van 64 px. Hoofdstuk 8 beschrijft de schil, de schermen op 390 px, de functies voor onderweg, offline werken en de tests op echte toestellen.

### 6.3 Globale elementen

- **Globale zoek** (toets `/` of Ctrl K): prospects, contacten, campagnes, helpartikelen; resultaten gegroepeerd, functies die niet aanstaan met slot.
- **Snelle acties** in de paginakop van Vandaag: "+ Taak", "+ Afspraak", "+ Prospect", "AI".
- **Meldingen**: bel onderaan de zijbalk met teller (F24).
- **Hulp**: knop "Hulp" in elke paginakop; opent het artikel van dat scherm in een flyout (F21).
- **AI-assistent**: knop "Vraag AI" in elke paginakop; opent de chat met de context van het scherm, binnen de credits van de organisatie (F26).
- **Organisatie-wissel**: alleen voor de founder, bovenaan de zijbalk, met een gele banner zolang hij in een andere organisatie is ingestapt (F23).

---

## 7. Het new business-proces

### 7.1 Drie fases, één reis

| Fase | Doel | Begint bij | Eindigt bij | Kernactiviteiten | Kernmaat |
|---|---|---|---|---|---|
| **1. Vinden en kwalificeren** | Van naam naar gekwalificeerde prospect | Lead uit de leadgenerator, import, CRM, KvK, Datacollectief, beurs, referral of signaal | Gebeurtenis `gekwalificeerd` | Leadronde, dossier met bewijs, buying committee, klasse, BAND, kanaalkeuze | Dagen tot dossier compleet, kwalificatiegraad |
| **2. Bewerken op ritme** | Van gekwalificeerd naar gesprek | `gekwalificeerd` | `eerste-afspraak-gepland` | Belblokken met script, campagnes, pogingen volgens het hercontactritme, bezoeken en kansen langs de route, winpunt in elke boodschap, parkeren en terughalen | Pogingen tot afspraak, conversie naar afspraak |
| **3. Verbinden** | Van geplande naar gehouden eerste afspraak, en de overdracht | `eerste-afspraak-gepland` | `overgedragen` (na een gehouden eerste afspraak met vervolg) of nee met reden | Afspraak bevestigen, briefing en Pitstop, no-show opvangen, eerste afspraak houden en afronden met uitkomst en verslag, overdracht naar DealDrive, het CRM of een collega | Geplande naar gehouden afspraken (no-show), gehouden naar overgedragen, doorlooptijd |

Dealtrace stopt bij de eerste afspraak (B17). Deals, offertes en de klantrelatie horen in DealDrive of het CRM; de funnel van de prospectreis (F17) laat zien hoe accounts door deze drie fases stromen.

### 7.2 Statusmachine per account

De reisfase zegt waar het account staat; de status zegt of het nu bewerkt wordt. Eén pure functie `shared/nbStatus.ts` (`volgendeStatus`, `cooldownActief`, `magBenaderen`) is de enige plek waar ze samen veranderen.

```
lead overgenomen / import
          │
          ▼
      ┌───────┐  kwalificatie  ┌─────────┐  geen reactie na laatste poging  ┌──────────┐
      │ nieuw │ ─────────────▶ │ in reis │ ───────────────────────────────▶ │ wachtend │
      └───────┘                └─────────┘ ◀─────────────────────────────── └──────────┘
          │                      │   │       terugkomdatum of nieuwe aanleiding
     niet geschikt               │   │ eerste afspraak gepland
          ▼                      │   ▼
      ┌───────┐  nee met reden   │ ┌──────────┐  gehouden, vervolg  ┌──────────────┐
      │  nee  │ ◀────────────────┘ │ gescoord │ ──────────────────▶ │ overgedragen │ ──▶ DealDrive, CRM of collega
      └───────┘ ◀───────────────── └──────────┘                     └──────────────┘
              geen vervolg na de eerste afspraak
```

| Status | Betekenis | Komt erin door | Gaat eruit door |
|---|---|---|---|
| `nieuw` | Bekend, nog niet gekwalificeerd | leadgenerator, import, signaal, referral | `gekwalificeerd` of niet geschikt |
| `in reis` | Wordt actief bewerkt | kwalificatie, terugkomst uit wachtend of nee | laatste poging zonder reactie, nee, afspraak |
| `wachtend` | Geparkeerd met terugkomdatum, of gepauzeerd tot een datum | laatste poging zonder resultaat, "gesproken, later" | terugkomdatum, nieuwe aanleiding |
| `nee` | Afgewezen met reden en afkoelperiode per kanaal | uitkomst "niet geschikt" of "geen interesse" | terugkomdatum of nieuwe aanleiding |
| `gescoord` | Eerste afspraak gepland, nog niet gehouden of nog niet afgerond | `eerste-afspraak-gepland` | `overgedragen`, nee (geen vervolg), of terug naar in reis (no-show of geannuleerd) |
| `overgedragen` | Eerste afspraak gehouden met vervolg en overgedragen | `overgedragen` | n.v.t.; komt het account later terug uit DealDrive of het CRM (verloren deal, slapende klant), dan via een terugkomregel als winback-kandidaat |

Vaste redenen voor nee: "Geen behoefte", "Tevreden met huidige leverancier", "Geen budget", "Verkeerd moment", "Niet de beslisser", "Niet geschikt", "Anders" (toelichting verplicht). Standaard afkoelperiode per kanaal: bellen 90 dagen, mail 60, LinkedIn 90, WhatsApp 180, bezoek 180, kaart 365; instelbaar per organisatie.

### 7.3 Uitkomsten van een poging

Elke taak, elk belgesprek en elk bezoek wordt afgerond met een uitkomst. De uitkomst bepaalt de volgende stap (pure functie `shared/hercontact.ts`, `verwerkUitkomst`).

| Uitkomst (schermtekst) | Code | Gevolg |
|---|---|---|
| "Gesproken, afspraak" | `afspraak` | Gebeurtenis `eerste-afspraak-gepland`, status gescoord, afspraak van de startmeetingsoort, ritme klaar |
| "Gesproken, later" + datum | `later` | Status wachtend tot de datum; daarna volgende stap |
| "Geen gehoor" of "Geen reactie" | `geen_reactie` | Volgende stap in het ritme met nieuw kanaal en datum; na de laatste stap geparkeerd met terugkomdatum |
| "Voicemail ingesproken" | `voicemail` | Als geen reactie, maar met een korte volgende stap (mail binnen 1 werkdag) |
| "Doorverbonden, nieuwe contactpersoon" | `nieuw_contact` | Contact aanmaken met rol; volgende poging naar dit contact |
| "Niet geschikt" | `niet_geschikt` | Uit de campagne, status nee, afkoelperiode 365 dagen voor alle kanalen |
| "Geen interesse" + reden | `geen_interesse` | Uit de campagne, status nee met reden en afkoelperiode per kanaal |

Regels: idempotent op `(itemId, stap)` zodat offline afronden bij synchronisatie niet dubbel telt; een account zit nooit in twee ritmes; een poging overslaan kan niet zonder uitkomst; elke taak toont "poging n van m", het kanaal, wat er de vorige keer gebeurde en het winpunt.

**Terugkomregel na nee, verlies of slapen (F25, ADR-018).** Een nee, een geparkeerd account of een account dat uit DealDrive of het CRM terugkomt (verloren deal, slapende klant) krijgt naast de reden een terugkomregel uit het verkoopverhaal: terugkomdatum, kanaal, rol en aanpak ("Terug op 14 januari 2027 · Beslissing uitgesteld · e-mail met nieuwe aanleiding"). De afkoelperiode per kanaal blijft de ondergrens: een terugkomdatum binnen de afkoelperiode schuift op naar het einde ervan. Op de terugkomdatum start de motor het hercontactritme uit de regel; de binnendienst krijgt telefoon en mail, de buitendienst een bezoek op de eerstvolgende regiodag.

### 7.4 Vijf lagen

| Laag | Wat | Tabel(len) | Versie |
|---|---|---|---|
| 1. Doelgroep | Definitie van de groep bedrijven: klassen, branches (SBI), regio's, omvang, bron, uitsluitingen | `doelgroepen` | ja |
| 2. Prospectreis-template | Fases, overgangen, gebeurtenissen en standaardactiviteiten; standaard of maatwerk per doelgroep | `reistemplates`, `activiteitstemplates` | ja |
| 3. Campagne | Een actie over 20 tot 80 accounts met soort, winpunt, boodschap of script, ritme, tussendoelen en einddoel | `campagnes` | verwijst naar templateversie |
| 4. Uitvoering | De reis per account: fase, status, ritmestand, historie | `prospectreizen`, `accounts.data.reis` | verwijst naar templateversie |
| 5. Activiteitenlog | Elke handeling van mens of AI per account en contact, met uitkomst; alleen toevoegen | `activiteiten` | n.v.t. |


## 8. Mobiel en onderweg

De buitendienst werkt de hele dag vanaf de telefoon: in de auto, op een parkeerplaats, bij de receptie van een prospect, in een kelder zonder bereik. De binnendienst pakt de telefoon thuis, op weg naar kantoor en tussen twee belblokken. Dit hoofdstuk legt vast hoe Dealtrace op een telefoon van 390 px breed werkt, welke functies er speciaal voor onderweg zijn, hoe een hele dag offline lukt en hoe we dat op echte toestellen testen. Het hoofdstuk gaat voor alles wat elders over mobiel staat (6.2 en F24 verwijzen hierheen).

### 8.1 Wat we leren van Dex in DealDrive

DealDrive heeft een mobiele assistent, Dex, als **aparte build** uit dezelfde repository (`DEALDRIVE_APP=dex`, eigen domein, eigen manifest, een telefoonframe van 402 px). Dex is sterk in de bediening en zwak in de architectuur. Dealtrace neemt de patronen over en niet de knip.

| Wat Dex goed doet (overnemen) | Wat Dex mist of verkeerd doet (oplossen) |
|---|---|
| Eén zet met de reden erbij ("moment boven menu"): één focus, één signaal, daaronder de stapels | Aparte build: twee schrijfwegen, twee kaarten, een allowlist per functie, ontbrekende fase-labels, een laptopschil die later is nagebouwd |
| Een rekenkern zonder framework in `shared/` met `nu` als parameter, getest met honderden checks | Geen offline schrijven: geen wachtrij, geen offline-indicator; afvinken in een parkeergarage geeft een fout |
| Duimbereik: navigatie onderin, schuifvensters van onderen, primaire knop onderaan, tikdoelen van minimaal 44 px | Geen push: meldingen tellen alleen met de app open, "gelezen" per apparaat |
| De handeling in de regel zelf: "Bel 06 ..." en "Afgehandeld" onder de belactie | Stapels organisatiebreed in plaats van "mijn" |
| `tel:`-links uit één functie, mobiel nummer eerst | Geen navigeerknop, geen route op volgorde, afstanden op stadsniveau |
| Spraak twee kanten op: voorlezen in zinnen voor het oor, inspreken met typen als terugval | Geen klant opzoeken, geen klantkaart |
| Concept eerst, met herkomst, bewijs en checks | "Afgehandeld" zonder uitkomst: het contactmoment en het ritme kloppen daarna niet |
| Signalen met Gedaan, Later en Weg, stilteperiodes en een dagplafond | Een goedgekeurd spraakconcept wordt geen echte taak of notitie |
| De melding plakt onderaan, waar je vinger was | Mail en WhatsApp alleen via kopiëren en plakken |
| Werkplek (kantoor of onderweg) in de rekenkern, niet in de weergave | Verwarrende namen ("Feedback" is de concept-inbox, "Jouw team" zijn de agents) |
| Eerlijke lege staten, rood alleen als iets dringt | Dagstart van bijna 4.000 px lang |

### 8.2 Uitgangspunten

1. **Eén app, één build, één manifest.** Telefoon, tablet en laptop openen dezelfde Dealtrace op hetzelfde domein met dezelfde routes. Wat iemand ziet, volgt uit rol, niveau, pakket en werkplekprofiel (hoofdstuk 4), nooit uit welke build hij opent (ADR-020).
2. **Eén rekenkern.** Focus, tip, signaal, dagstapels, kansen, route en recap komen uit pure functies in `shared/` en rekenen op telefoon en laptop gegarandeerd hetzelfde.
3. **Eén schrijflaag met offline wachtrij.** Elke handeling onderweg gaat via `POST /api/sync/mutations` met een idempotentiesleutel; offline staat hij in IndexedDB met zichtbare status.
4. **Mijn is eigenaar.** Alle stapels tonen standaard het werk van de ingelogde gebruiker; de teamweergave is een aparte keuze voor de salesmanager.
5. **Eén venster per soort.** Een account, contact, afspraak of taak opent op de telefoon als schuifvenster van onderen en op de laptop als flyout rechts; het is dezelfde component met dezelfde velden.
6. **De duim beslist.** Alles wat je onderweg vaak doet, zit in de onderste helft van het scherm; de kop is alleen voor zoeken, inspreken en meldingen.
7. **Rijden is geen werkmoment.** Tijdens het rijden leest Dealtrace voor en luistert het; er is geen scherm dat aandacht vraagt. Bellen gaat via de carkit van het toestel.
8. **Push vanaf het begin.** Herinneringen, de dagstart op een zelfgekozen tijd, de briefing 30 minuten voor een afspraak en een signaal met hoge urgentie komen als pushmelding, met stille uren.

### 8.3 De mobiele schil

Het designsysteem kent onder 768 px alleen een icoonstrook van 64 px. Op een telefoon van 390 px houdt dat 302 px over voor de inhoud, en de schermafbeelding `a-5-mobiel.png` laat zien dat er dan geen enkele taak meer boven de vouw staat. Daarom wijkt Dealtrace bewust af (ADR-019): op een telefoon geen zijbalk en geen icoonstrook, maar een compacte kop en een onderbalk.

| Breedte | Schil |
|---|---|
| Kleiner dan 768 px (telefoon) | Compacte kop (56 px), onderbalk (64 px plus de veilige zone), vensters als schuifvenster van onderen, schermbreed |
| 768 tot 1023 px (tablet, staand) | Icoonstrook van 64 px zoals in het designsysteem, flyouts van 480 px |
| Vanaf 1024 px (laptop, tablet liggend) | Zijbalk van 240 px, inklapbaar naar 64 px |

**Compacte kop (56 px, sticky).** Links de paginatitel (16 px, vet), of een terugknop met de naam van het vorige scherm op een subpagina. Rechts drie iconknoppen van 44 bij 44 px: "Zoeken" (vergrootglas), "Inspreken" (microfoon, opent overal de spraakopdracht op het account van het scherm waar je staat) en "Meldingen" (bel met rode teller, "9+" boven negen). Geen logo, geen kicker, geen snelle acties in de kop; die staan op Vandaag zelf.

**Onderbalk (64 px plus `env(safe-area-inset-bottom)`).** Vijf tabs met icoon van 24 px en label van 11 px; de actieve tab in `--geel` met een streep van 3 px erboven. Elke pagina hoort bij precies één tab, zodat er altijd één oplicht. De tabs zijn op elk niveau gelijk: een lager niveau verandert nooit de plek van een tab, alleen de inhoud van "Meer" (zie 8.4).

**Schuifvensters.** Een record, formulier of keuze schuift van onderen in tot maximaal 92 procent van de schermhoogte, met een greep bovenin, sluiten door omlaag te vegen of op "Sluiten" te tikken, en een plakkende knoppenrij onderaan met de primaire knop rechts. Een venster sluit na een succesvolle opslag pas na 1,2 seconden, zodat je de bevestiging ziet.

**Plakkende actiebalk.** Op de accountkaart, de contactkaart en de afspraak staat onderin, boven de onderbalk, een balk met "Bellen", "Mail", "WhatsApp" en "Navigeer" (vier knoppen van 48 px hoog). Een knop zonder gegevens is uitgegrijsd met de reden in een tooltip ("Geen mobiel nummer bekend").

**Meldingsstrook.** De uitkomst van een handeling ("Bezoek vastgelegd", "Bewaard op je telefoon, wordt verstuurd zodra je verbinding hebt") verschijnt boven de onderbalk, waar je vinger net was. Een succes verdwijnt na 5 seconden met "Ongedaan maken" erin; een fout blijft staan tot je hem wegtikt.

**Status van de verbinding.** Offline staat onder de kop een gele strook van 28 px: "Offline · 3 wijzigingen wachten". Bij een vastgelopen wachtrij wordt hij rood met "Opnieuw proberen".

**Tokens.** Tikdoel minimaal 44 px (`--touch-target-min`), standaard 48 px voor knoppen in lijsten, 54 px in handschoenmodus. Zijmarge 16 px op telefoon (in plaats van 24 px), witruimte tussen secties 32 px en hoeken 2 px volgens het designsysteem (B15). Tekst minimaal 15 px voor lopende tekst op de telefoon. Zonlichtmodus verhoogt het contrast naar AAA en zet grijstinten om naar zwart.

### 8.4 Onderbalk per werkplekprofiel

| Profiel | Tab 1 | Tab 2 | Tab 3 | Tab 4 | Tab 5 |
|---|---|---|---|---|---|
| Buitendienst | Vandaag `/` | Route `/onderweg` | Bellen `/bellen` | Prospects `/prospects` | Meer |
| Binnendienst | Vandaag `/` | Belblok `/belblokken` | Acties `/acties` | Prospects `/prospects` | Meer |
| Hybride | Vandaag `/` | Route `/onderweg` | Belblok `/belblokken` | Prospects `/prospects` | Meer |
| Salesmanager (zonder eigen portefeuille) | Team `/team` | Coaching `/coaching` | Acties `/acties` | Prospects `/prospects` | Meer |

`/bellen` is de enkele bellijst van vandaag (belacties uit de motor, terugbelverzoeken en de bellijst naast je bezoeken); `/belblokken` is het blok met belmodus en script (F07).

**Meer** opent een schuifvenster met de overige items uit de zijbalk van je niveau, in dezelfde groepen en volgorde als op de laptop (6.1): Agenda, Acties of Bezoeken (wat niet in de onderbalk staat), Concepten, Inzichten, Campagnes, Funnel, Richting, AI-assistent, Mijn resultaten, Helpcenter, Mijn instellingen, Uitloggen. Items die niet aanstaan, staan onderaan in de ingeklapte groep "Nog niet aangezet", net als op de laptop. Beheerpagina's (Instellingen, Platformbeheer) staan er met de toevoeging "Beter op een groot scherm" en openen wel.

### 8.5 De schermen op 390 px

Voor elk scherm de opbouw van boven naar beneden, op een iPhone van 390 bij 844 px. "Boven de vouw" is wat zonder scrollen zichtbaar is tussen kop en onderbalk (ongeveer 640 px).

#### 8.5.1 Vandaag op de telefoon

Doel: in één blik zien waar de dag knelt, en de eerste zet doen zonder te scrollen.

1. Groet en datum op één regel ("Goedemorgen, Jan. · di 14 okt"), rechts de knop "Lees voor" (luidspreker).
2. **Focuskaart** (de eerste zet): tijd, wat, waarom in één zin, en één primaire knop ("Navigeer naar Bakker Bouw", "Bel Marieke de Vries", "Leg het verslag vast"). Uit `kiesFocus` (8.13).
3. **Signaal** (Gevorderd en Expert): één kaart met bron, bewijs in één regel en de knoppen "Gedaan", "Later", "Weg".
4. **Telstrip**: vier tegels in één rij van 72 px hoog: Afspraken, Bellen, Acties, Kansen, met aantal en rood als er achterstand is. Een tik springt naar de stapel.
5. **Stapels** met de handeling in de regel: afspraken (met "Navigeer" en "Pitstop"), belacties (met "Bel" en "Uitkomst"), acties (met "Afgehandeld"), eerste afspraken die nog bevestigd of overgedragen moeten worden (met "Bevestig" of "Overdragen").
6. **Kansen in je dag**: hooguit drie, met "+ Tussenstop" (buitendienst) of "Bel" (binnendienst), en "Alle kansen →".
7. Na 16:00 verschijnt bovenaan de kaart **Recap** ("2 gesprekken zonder verslag").

Boven de vouw staan op elk niveau minimaal de groet, de focuskaart en de telstrip. Een Beginner ziet geen signaal en geen tip; zijn eerste stapel komt daardoor ook boven de vouw.

De dag staat in de URL (`/?dag=2026-10-15`). Met vegen naar links en rechts op de groet, of de knoppen "Vandaag", "Morgen" en "Week" (Gevorderd), kies je een andere dag; focus, signaal en tip verschijnen alleen voor vandaag.

#### 8.5.2 Onderweg (Route)

Doel: de rijdag op volgorde, met elke stop één tik van navigeren, bellen en afronden. Route `/onderweg`, de telefoonweergave van F10.

1. Kop: "Route · 3 bezoeken · 142 km · 1u 50 rijden", rechts "Kaart" (wisselt tussen lijst en kaart).
2. **Volgende stop** (groot, geel kader): tijd, account, adres, "Vertrek om 10:20 · 24 min rijden", knoppen "Navigeer" (primair), "Bel", "Pitstop". Valt de vertrektijd in de komende 15 minuten, dan wordt de vertrekregel rood.
3. **Tijdlijn van de dag**: per stop een rij met tijd, account, plaats, status (gepland, onderweg, bezig, afgerond, zonder verslag) en tussen twee stops de reistijd. Kansen langs de route staan als gele tussenrij tussen de stops waar ze passen ("12 min omrijden · past tussen 11:30 en 13:00"), met "+ Tussenstop" en "Overslaan". Zo is er geen aparte kansenpagina nodig.
4. **In de buurt** (knop onderaan): opent een lijst met prospects en klanten binnen 15 minuten van je huidige plek, gesorteerd op kansscore, met de reden.
5. **Bellijst naast je route** (Gevorderd): de top vijf om te bellen tijdens wachttijd of in de auto met carkit.

Een afgeronde stop klapt in tot één regel met een groen vinkje. Een stop zonder verslag die al voorbij is, krijgt de rode knop "Verslag vastleggen".

#### 8.5.3 Bezoek afronden

Doel: na een bezoek binnen een minuut de uitkomst en het verslag vastleggen, bij voorkeur ingesproken in de auto.

Opent als schuifvenster vanuit de route, de aankomstmelding (8.6) of de focuskaart.

1. Kop: account en tijd ("Bakker Bouw · 10:45 tot 11:30").
2. **Uitkomst**: de knoppen van de meetingsoort (bijvoorbeeld "Vervolg afgesproken", "Later terugkomen", "Geen interesse", "Andere contactpersoon") als grote tegels in twee kolommen.
3. **Verslag**: één groot veld met de microfoonknop als primaire invoer ("Spreek je verslag in"), typen als terugval, en "Foto" (whiteboard, visitekaartje, situatie).
4. **Volgende stap en overdracht**: bij een eerste afspraak met vervolg de vraag "Overdragen?" met DealDrive, het CRM of een collega (F17); anders de volgende stap uit de reis of het verslag ("Terugbellen op 21 okt"), aan te passen met datum en soort.
5. **Nieuwe contactpersoon** (ingeklapt): naam, functie, telefoon, of "Scan visitekaartje".
6. Plakkende knop "Bewaar bezoek".

Na bewaren loopt op de achtergrond de verslaganalyse (Notulist, F14): actiepunten worden concepttaken in je inbox, koopsignalen worden inzichten. Bij "Geen interesse" vraagt Dealtrace de reden voor nee (F13), zodat de terugkomregel klopt.

Tikken: open vanuit de route (1), uitkomst (2), microfoon (3), stop (4), "Bewaar bezoek" (5). De volgende stap is voorgevuld en telt niet mee zolang je hem accepteert.

#### 8.5.4 Bellen en de belmodus op de telefoon

Doel: achter elkaar bellen met één duim, en na elk gesprek de uitkomst in één tik.

- `/bellen` toont de bellijst van vandaag met per regel prioriteit, account, contact, reden en de knop "Bel 06 12 34 56 78" (`tel:`-link, mobiel nummer eerst).
- Na terugkeer in de app na een `tel:`-oproep verschijnt automatisch het venster **"Hoe ging het?"** met vier tegels: "Gesproken", "Niet bereikt", "Voicemail", "Terugbellen", en daaronder "Inspreken" voor een notitie. "Gesproken" vraagt daarna de uitkomst uit het belscript (afspraak, interesse, nee met reden, terugbellen op datum).
- De **belmodus** (F07) op de telefoon toont één prospect tegelijk: naam, functie, reden, de eerste regel van het gekozen script groot, en onderin "Bel", "Overslaan", "Volgende". Het volledige script schuift omhoog als je het nodig hebt; bezwaren zijn tikbare knoppen.
- **Handsfree** (Gevorderd): in de belmodus de schakelaar "Handsfree": Dealtrace leest naam, reden en opening voor, belt na "Bel" via de carkit, en vraagt na het gesprek met spraak "Hoe ging het?"; je antwoordt met "gesproken", "niet bereikt" of "terugbellen".

Tikken: bellen en uitkomst vastleggen is "Bel" (1), na het gesprek de uitkomst (2), eventueel de uitkomst uit het script (3). Het contactmoment werkt direct `laatst_gebeld_op` en het ritme bij.

#### 8.5.5 Accountkaart compact

Doel: alles wat je onderweg over een prospect nodig hebt op één scherm, met één duim.

1. Naam, plaats, klasse- en fasepil, status in de reis ("Poging 3 van 5 · volgende: bellen op 16 okt").
2. **Waarom nu**: de reden van de motor of het sterkste inzicht, met bron.
3. **Contacten**: per persoon rol, telefoon (tikbaar), mail; de beslisser bovenaan.
4. **Laatste drie contactmomenten** met kanaal, datum en uitkomst.
5. **Open taken en afspraken**.
6. **Pitstop** (ingeklapt): de briefing in vijf regels, met "Lees voor".
7. Tabs onder de vouw: Tijdlijn, Inzichten, Eigen velden, Details.
8. Plakkende actiebalk: "Bellen", "Mail", "WhatsApp", "Navigeer".

#### 8.5.6 Spraakopdracht

Doel: één zin wordt één concept op het juiste account, en na goedkeuren een echte taak, notitie of afspraak (in Dex bleef het een concept; in Dealtrace niet).

Opent vanuit de microfoon in de kop. Staat je op een accountkaart of in een bezoek, dan is dat account al gekozen. Je zegt bijvoorbeeld "Bel Marieke volgende week dinsdag over de projectschouw" of "Noteer dat de DGA in september terug is". Dealtrace toont het concept (soort, account, persoon, titel, datum, checks) met "Bewaar" en "Aanpassen". Bij twijfel over het account vraagt het welke van twee namen je bedoelt.

Tikken: microfoon (1), praten, "Bewaar" (2).

#### 8.5.7 Concepten (inbox)

Alles wat agents klaarzetten (opvolgmail, taak uit verslag, belscript-invulling, LinkedIn-tekst) staat in "Concepten" onder Meer, met een teller op de bel. Per concept: maker, aanleiding, tekst, bewijs en de knoppen "Goedkeuren", "Aanpassen", "Verwerpen". Een goedgekeurde mail opent met "Verstuur via je mail" de mailapp met ontvanger, onderwerp en tekst ingevuld (`mailto:`), of via de gekoppelde mailbox (F09) direct; een WhatsApp-tekst opent WhatsApp met de tekst ingevuld (`https://wa.me/<nummer>?text=`). Dealtrace verstuurt nooit zelf een eerste bericht.

### 8.6 Functies voor onderweg

| Functie | Wat het doet | Niveau | Sprint |
|---|---|---|---|
| **Navigeer** | Diepe link naar de kaartapp die de gebruiker kiest in Mijn instellingen: Google Maps, Apple Kaarten of Waze, met het adres of de coördinaat | Beginner | 8 |
| **Vertrekmelding** | Pushmelding "Vertrek over 10 minuten naar Bakker Bouw (24 min rijden)" op basis van reistijd uit de routedienst | Beginner | 8 |
| **Briefing vooraf** | 30 minuten voor een afspraak een push met de Pitstop in drie regels en "Lees voor" | Beginner | 8 |
| **Aankomst en vertrek** | Wanneer je de app opent binnen 300 m van een afspraak rond de starttijd, toont Vandaag bovenaan "Je bent bij Bakker Bouw" met "Pitstop" en "Bezoek afronden". Een PWA kan geen locatie op de achtergrond volgen; Dealtrace beweert dat ook niet | Gevorderd | 8 |
| **Inloopbezoek in drie tikken** | Op Route of Vandaag "+ Inloop": Dealtrace stelt het dichtstbijzijnde account voor op basis van je locatie (1), je bevestigt (2), en het venster Bezoek afronden opent met soort "Ongepland bezoek" en tijd nu (3) | Gevorderd | 8 |
| **In de buurt** | Prospects en klanten binnen 15 minuten van je huidige plek, met kansscore en reden; filter "alleen prospects" | Gevorderd | 8 |
| **Visitekaartje scannen** | Foto van een visitekaartje; AI leest naam, functie, bedrijf, telefoon en mail en maakt een conceptcontact, gekoppeld aan het account van het bezoek of met een voorstel voor een nieuw account | Gevorderd | 8 |
| **KvK opzoeken** | Een bedrijf dat je passeert op naam of plaats zoeken in het KvK-register en met één tik als prospect toevoegen, ontdubbeld tegen je accounts (F02) | Gevorderd | 7 |
| **Foto bij bezoek** | Foto's (whiteboard, gevel, situatie) bij het bezoek; verkleind tot 1.600 px en offline in de wachtrij | Beginner | 8 |
| **Klaargezet door de binnendienst** | Kansen die een collega voor jouw regiodag klaarzette, als tussenrij in de route (F10) | Beginner | 8 |
| **Handsfree** | Voorlezen van de dag, de briefing en de recap; belmodus met spraak; spraakopdracht zonder te kijken | Gevorderd | 8 |
| **Rijmodus** | Schakelaar (of automatisch na "Navigeer"): alleen grote knoppen voor "Lees voor", "Inspreken" en "Bel volgende", meldingen gebundeld tot je stopt | Expert | 12 |
| **Offline kaart** | De route van vandaag als statische kaart met genummerde stops, bewaard bij het laden; navigeren gebeurt in de kaartapp, die eigen offline kaarten heeft | Beginner | 8 |
| **Dagrecap** | Na de laatste afspraak of om 17:00 een push "De dag rond: 2 verslagen ontbreken", met "Lees voor" | Beginner | 5 |

### 8.7 Doelen in tikken

| Handeling | Route | Maximaal |
|---|---|---|
| Zien waar de dag knelt | open de app | 0 tikken |
| Naar de volgende afspraak navigeren | Vandaag, "Navigeer" | 1 |
| Een prospect bellen en de uitkomst vastleggen | "Bel", uitkomst | 2 (3 met de scriptuitkomst) |
| Bezoek afronden met ingesproken verslag | Bezoek afronden, uitkomst, microfoon, stop, "Bewaar bezoek" | 5 plus praten |
| Inloopbezoek vastleggen | "+ Inloop", bevestig account, Bezoek afronden | 3 tot het venster, daarna als bezoek afronden |
| Kans als tussenstop inplannen | "+ Tussenstop", "Plan afspraak" | 2 |
| Taak inspreken | microfoon, praten, "Bewaar" | 2 plus praten |
| Signaal afhandelen | "Gedaan", "Later" of "Weg" | 1 |
| Concept-opvolgmail versturen | bel, concept, "Goedkeuren", "Verstuur via je mail" | 4 |
| Prospect toevoegen uit KvK | zoek, typ naam, resultaat, "Voeg toe" | 3 plus typen |

De tikdoelen zijn acceptatiecriteria: een bouwprompt die ze niet haalt, is niet klaar.

### 8.8 Een dag offline

Een buitendienstdag moet ook lukken met een uur zonder bereik.

**Wat vooraf op de telefoon staat.** Bij het openen van de app met verbinding, en elke ochtend om 06:00 als de app in de achtergrond mag verversen, haalt Dealtrace het **dagpakket** op:

- Vandaag en morgen: afspraken, taken, belacties, kansen langs de route en de route met reistijden.
- De accountkaarten (inclusief contacten, laatste tien contactmomenten, open taken en afspraken, Pitstop) van alle accounts in de route van vandaag en morgen, van de kansen langs de route en van de bellijst.
- De belscripts die je gebruikt, de meetingsoorten met uitkomsten, de redenen voor nee.
- De helpartikelen van de functies die voor je aanstaan.
- De statische kaart van de route van vandaag.

Doel: hooguit 5 MB per dag (zonder foto's). De voortgang staat in Mijn instellingen onder "Offline": "Klaar voor vandaag · 23 accounts · 3,1 MB · bijgewerkt 07:42".

**Wat offline kan.** Bezoek afronden, uitkomst na bellen, verslag typen of inspreken (opname bewaard, transcriptie zodra er verbinding is), foto's, nieuwe taak, nieuwe afspraak, nieuwe contactpersoon, signaal afhandelen, concept goedkeuren (versturen wacht), eigen velden invullen.

**Wat niet kan.** Alles met AI (analyse, scriptinvulling, visitekaartje lezen: de foto wacht in de wachtrij), KvK en Datacollectief, routeberekening (de laatst bekende route blijft staan), accounts buiten het dagpakket (je ziet "Niet op je telefoon bewaard" met "Bewaar voor offline").

**Zichtbaarheid.** De gele strook "Offline · 3 wijzigingen wachten"; elk record dat nog niet verstuurd is, krijgt een klein wolkje met streep. Bij herstel van de verbinding verstuurt de wachtrij in volgorde; bij een conflict verschijnt het conflictvenster (F24).

**Accu en data.** Geen continue locatie: alleen bij openen van Route, "In de buurt" en "+ Inloop". Geen polling: verversen bij openen van de app en via push. Foto's verkleind, opnames in Opus met 24 kbit/s (ongeveer 3 MB per uur praten). Op een databundel kiest de gebruiker "Foto's en opnames alleen via wifi versturen".

### 8.9 Spraak

| Richting | Hoe | Waar |
|---|---|---|
| Inspreken (verslag, notitie, opdracht) | Opname in de browser (MediaRecorder), transcriptie op de server via een EU-transcriptiedienst; de Web Speech API alleen als snelle voorvertoning waar beschikbaar | Bezoek afronden, Hoe ging het, spraakopdracht, elk tekstveld met een microfoon |
| Voorlezen (dag, briefing, recap, belscript-opening) | Tekst geschreven voor het oor (hele zinnen, bedragen uitgeschreven) via de spraaksynthese van het toestel in `nl-NL` | Vandaag, Pitstop, recap, belmodus handsfree |

Regels:

- Een opname wordt na transcriptie verwijderd, tenzij de organisatie bewaren aanzet (bewaartermijn in Privacy, hoofdstuk 15).
- De transcriptie gaat nooit via een dienst buiten de EU; de browserherkenning van Chrome (via Google) staat standaard uit en is per organisatie aan te zetten.
- Een spraakopdracht maakt na "Bewaar" direct een echte taak, notitie of afspraak via de schrijflaag; alleen berichten aan een prospect blijven concept tot goedkeuring.
- De voorleesteksten komen uit pure functies (`spreekDag`, `spreekBriefing`, `spreekRecap`), getest op lengte (hooguit 60 seconden) en zonder opsommingstekens.

### 8.10 Meldingen en push op de telefoon

Web Push (PWA) vanaf sprint 1 voor herinneringen; de onderweg-meldingen vanaf sprint 8.

| Melding | Wanneer | Inhoud en actie |
|---|---|---|
| Dagstart | Zelfgekozen tijd, standaard 07:45 | "3 bezoeken, 5 belacties. Eerst: Bakker Bouw om 09:30." · "Lees voor" |
| Vertrek | Reistijd plus 10 minuten voor een afspraak | "Vertrek over 10 minuten naar Bakker Bouw" · "Navigeer" |
| Briefing | 30 minuten voor een afspraak | Pitstop in drie regels · "Lees voor", "Open" |
| Verslag | 15 minuten na het einde van een afspraak zonder verslag | "Hoe ging het bij Bakker Bouw?" · "Inspreken" |
| Hete aanleiding | Nieuw inzicht met hoge urgentie op een eigen account | Bron in één regel · "Open" |
| Klaargezet | Een collega zet een kans klaar voor jouw regiodag | Account en reden · "Bekijk" |
| Recap | Na de laatste afspraak of 17:00 | "De dag rond: 2 verslagen ontbreken" |

Regels: stille uren (standaard 19:00 tot 07:00 en het weekend), een dagplafond van zes onderweg-meldingen, bundelen tijdens rijmodus en belblok, en "gelezen" geldt op alle apparaten (opgeslagen op de server, niet in localStorage).

### 8.11 Per gebruikersniveau

Het niveau bepaalt wat beschikbaar is (4.2); de mobiele schil volgt dat zonder iets te verplaatsen.

| Onderdeel op de telefoon | Beginner | Gevorderd | Expert |
|---|---|---|---|
| Vandaag: groet, focus, telstrip, stapels | ● | ● | ● |
| Vandaag: signaal met Gedaan, Later, Weg; tip van de dag | | ● | ● |
| Dagkiezer met Morgen en Week | alleen Morgen | ● | ● |
| Route met navigeren, bellen, Pitstop, bezoek afronden | ● | ● | ● |
| Kansen langs de route als tussenrij met "+ Tussenstop" | ● (top 3) | ● (alle, met filters) | ● (eigen bronnen en straal) |
| In de buurt, inloopbezoek, visitekaartje scannen, KvK opzoeken | | ● | ● |
| Bellen met "Hoe ging het?" | ● | ● | ● |
| Belmodus met script op de telefoon | ● | ● | ● |
| Handsfree belmodus en voorlezen van scripts | | ● | ● |
| Spraakopdracht | ● (taak en notitie) | ● (plus afspraak en mail) | ● |
| Concepten goedkeuren en versturen | ● | ● | ● |
| Accountkaart: wijzigen | basisvelden | alle velden behalve eigenaar | alle velden, toewijzen aan collega |
| Rijmodus, eigen meldingsplafond en stille uren per soort | | | ● |
| Recap | kort (verslagen, morgen) | met risico's | met weekterugblik |

### 8.12 Binnendienst en salesmanager op de telefoon

**Binnendienst.** Werkt vooral op de laptop. Op de telefoon: Vandaag met de belstapel bovenaan, de bellijst en belblokken met "Hoe ging het?", acties, de compacte accountkaart, concepten goedkeuren, en "Klaarzetten voor buitendienst" vanaf de accountkaart. Werkplek Kantoor, dus zonder route en zonder "In de buurt".

**Salesmanager.** Op de telefoon: Team (wie heeft gesprekken zonder verslag, welke eerste afspraken nog niet zijn overgedragen, wie loopt achter op het ritme), coachingsnotities voorbereiden en de coachingskaart tijdens een rit naast een verkoper (F20), meldingen en concepten van het team die op zijn goedkeuring wachten. Analyse met grafieken staat er alleen-lezen, met "Open op laptop" voor het filterwerk.

**Bewust niet op de telefoon** (wel te openen, met de melding "Beter op een groot scherm"): Instellingen, Platformbeheer, de reiseditor, de regeleditor, import en de leadgenerator in bulk, campagnes opzetten.

### 8.13 Hergebruik uit Dex en DealDrive

| DealDrive (develop `75bee61`) | Dealtrace | Wat verandert |
|---|---|---|
| `shared/dexDag.ts` (`bouwDag`, `heeftVervolg`) | `shared/dag.ts` | Filter op eigenaar; prospectreis-stappen als bron van belacties; uitkomst na bellen werkt contactdatums bij |
| `shared/dexRitme.ts` (`kiesFocus`, `kiesTip`, `bepaalVorm`, `spreekRitme`) | `shared/dagritme.ts` | Focusregels uitgebreid met de reis (poging die vandaag moet) en de kansen langs de route |
| `shared/dexSignalen.ts` (vier detectoren, governor) | `shared/signalen.ts` | Detectoren voor new business: koopsignaal, ritme achter, reis stil, terugkomregel bereikt; dagplafond en stilte per organisatie instelbaar |
| `shared/dexKansen.ts` (`bouwKansen`, gaten van 75 min, omweg 25 km) | `shared/route.ts` (F10) | Echte reistijden via de routedienst, meer bronnen, meerdere kansen per gat |
| `shared/dexRecap.ts` | `shared/recap.ts` | Recap met verslagen bovenaan en de terugkomregels van morgen |
| `shared/werkplek.ts` (kantoor, onderweg) | werkplekprofiel binnendienst, buitendienst, hybride (hoofdstuk 3) | Beheerder zet het profiel, niet alleen de founder |
| `shared/dexKaartVelden.ts` | `shared/kaartvelden.ts` | Eén veldenlijst per soort voor scherm, server en niveau |
| `DexKaart.vue`, `DexNieuw.vue`, `DexMelding.vue` | `RecordVenster.vue`, `NieuwVenster.vue`, `Meldingsstrook.vue` | Responsief: schuifvenster op telefoon, flyout op laptop |
| `TranscriptUpload.vue` | `VerslagVeld.vue` | Opname naar servertranscriptie, offline in de wachtrij |
| `DexShell.vue` en `MobileShell.vue` | `AppShell.vue` met `MobieleKop.vue` en `Onderbalk.vue` | Eén schil, geen aparte build, geen allowlist |
| `/api/dex/*` (dagactie, kaart, aanmaken, verslag-extract, signaalstand) | `POST /api/sync/mutations` en de feature-endpoints | Geen tweede schrijfweg |
| `nuxt.config.ts` hook `pages:extend` met `DEALDRIVE_APP` | vervalt | Eén build |

De getallen uit de Dex-kern zijn het startpunt en per organisatie instelbaar: werkdag 08:00 tot 18:00, een gat telt vanaf 75 minuten, omweg hooguit 25 km of 20 minuten, contractvenster 90 dagen (voor bestaande klanten in de route), account in reis zonder volgende stap na 7 dagen stilte, koopsignaal hooguit 14 dagen oud met relevantie 60, dagplafond 4 signaalbesluiten, stilte na Weg 1 dag, Later 3 dagen, Gedaan 30 dagen, vervolghorizon 90 dagen.

### 8.14 Technisch

**Schil en routes**

- `app/layouts/default.vue` kiest met een `useSchermklasse()` (telefoon, tablet, laptop op 768 en 1024 px, plus `pointer: coarse`) tussen `Zijbalk` en `MobieleKop` plus `Onderbalk`. Dezelfde routes, geen aparte pagina's voor mobiel; een pagina mag wel een eigen telefoonopbouw hebben via `<TelefoonWeergave>` en `<LaptopWeergave>`.
- `shared/onderbalk.ts`: `tabsVoor(werkplekprofiel, rol)` en `tabVoorRoute(pad)`, zodat altijd één tab oplicht; getest.
- Nieuwe route `/onderweg` (telefoonweergave van `/bezoeken`; op de laptop stuurt hij door naar `/bezoeken`) en `/bellen`.

**Rekenkern**

- `shared/dag.ts`, `shared/dagritme.ts`, `shared/signalen.ts`, `shared/recap.ts`, `shared/route.ts`, `shared/spreek.ts`: pure functies met `nu` als parameter; bedragen in centen via `formatteerCenten`.
- Testsets `test:dag`, `test:ritme`, `test:signalen`, `test:recap`, `test:route`, `test:spreek`, overgenomen uit Dex en uitgebreid voor de reis.

**Schrijven en offline**

- Alle mutaties via `useSyncQueue` en `POST /api/sync/mutations` met `idempotentie_sleutel` per handeling; nieuwe mutatiesoorten: `bezoek.afronden`, `belpoging.uitkomst`, `inloop.vastleggen`, `contact.uitVisitekaartje`, `signaal.besluit`, `concept.besluit`, `spraak.opdracht`.
- `dagpakket`: `GET /api/onderweg/dagpakket?datum=` levert in één antwoord alles uit 8.8; de client schrijft het in Dexie en houdt `dagpakket_versie` bij.
- Bijlagen: `bijlagen: id, organisation_id, eigenaar_id, record_soort, record_id, soort ('foto'|'opname'|'visitekaartje'), pad, grootte, status ('lokaal'|'verstuurd'|'verwerkt')`, opslag in Supabase Storage EU met RLS op `organisation_id`.
- Spraak: `POST /api/spraak/transcribeer` (opname naar tekst, EU-dienst achter een adapter met mock), `POST /api/spraak/opdracht` (tekst naar concept, met de lijst eigen accounts als keuzeset, schema afgedwongen, account moet bestaan).
- Visitekaartje: `POST /api/contacten/visitekaartje` (foto naar conceptcontact, AI met schema, ontdubbelen op mail en telefoon).
- Locatie: `GET /api/onderweg/in-de-buurt?lat=&lng=&minuten=` met voorselectie op hemelsbrede afstand, daarna reistijd voor de top 20; de locatie wordt niet opgeslagen.
- Meldingen: `notificaties` met `gelezen_op` op de server; pushsweeps voor vertrek, briefing en verslag elke 5 minuten (Netlify scheduled function), met stille uren en dagplafond in `shared/meldingsregels.ts`.

**PWA**

- Eén manifest "Dealtrace", `display: standalone`, staand, eigen iconen en iOS-meta's; installatievraag na de tweede dag van gebruik, met iOS-uitleg.
- Service worker: statische bestanden 30 dagen; API-GET via netwerk eerst met terugval op cache; het dagpakket via Dexie, niet via de cache van de service worker.
- `navigator.storage.persist()` aanvragen na installatie, zodat het dagpakket niet wordt opgeruimd.

**Prestatiebudget op een middenklasse-Android (Moto G-klasse) over 4G**

- Eerste weergave van Vandaag binnen 2,5 seconden (LCP), interactief binnen 3,5 seconden; een volgende opening uit het dagpakket binnen 1 seconde.
- JavaScript voor de eerste weergave hooguit 250 KB gecomprimeerd; per route opgeknipt.
- Een tik geeft binnen 100 ms zichtbare reactie (optimistisch schrijven).

### 8.15 Testen op echte toestellen

**Toestellen.** Elke sprint vanaf sprint 1 op ten minste:

| Toestel | Breedte | Waarom |
|---|---|---|
| iPhone SE (3e generatie), iOS laatste | 375 px | Kleinste gangbare scherm, Safari, geen thuisbalk |
| iPhone 15 of 16 | 390 tot 393 px | Ontwerpmaat, veilige zones, push in een geïnstalleerde PWA (iOS 16.4 en hoger) |
| Samsung Galaxy A-serie | 360 tot 412 px | Meest verkochte zakelijke Android, Chrome, middenklasse-prestaties |
| Google Pixel 7 of nieuwer | 412 px | Referentie-Android |
| iPad (10e generatie) | 820 px staand | Tabletschil met icoonstrook |

**Geautomatiseerd.** Playwright-projecten voor 375, 390 en 412 px met aanraakmodus; elk scherm uit 8.5 heeft een schermafbeelding als referentie en een test op "boven de vouw" (focuskaart en telstrip zichtbaar zonder scrollen); een test die de tikken uit 8.7 telt; offline-tests met `context.setOffline(true)` voor bezoek afronden, uitkomst na bellen en spraakopdracht.

**Handmatig per sprint (scenario's).**

1. Een volledige buitendienstdag op de telefoon: drie bezoeken, twee tussenstops, vijf belacties, drie ingesproken verslagen.
2. Een uur in vliegtuigmodus midden op de dag; daarna alles binnen een minuut verstuurd, zonder dubbele records.
3. Buiten in de zon met zonlichtmodus; met werkhandschoenen in handschoenmodus.
4. Bellen via de carkit met handsfree; geen scherm nodig tussen twee gesprekken.
5. Een dag lang accuverbruik meten: Dealtrace hooguit 10 procent bij normaal gebruik.

**Toegankelijkheid.** VoiceOver en TalkBack op de schermen uit 8.5; tekstvergroting tot 200 procent zonder afgekapte knoppen; elk tikdoel minimaal 44 px.

### 8.16 Acceptatiecriteria van dit hoofdstuk

- Op 390 px staan op Vandaag de focuskaart en de telstrip zonder scrollen in beeld, op elk niveau.
- Elke tab van de onderbalk is op elke pagina eenduidig actief; de onderbalk verschuift nooit van plek tussen niveaus.
- Elke regel met een klant heeft een belknop; elke afspraak een navigeerknop; alle minimaal 44 px en binnen duimbereik.
- Bellen tot en met de uitkomst kost hooguit twee tikken; een bezoek afronden met ingesproken verslag hooguit vijf tikken plus praten.
- Elke handeling uit 8.8 slaagt zonder verbinding, met zichtbare status, en komt na herstel precies één keer aan.
- Een spraakopdracht staat na "Bewaar" binnen één seconde als echte taak of notitie op de accountkaart, op telefoon en laptop.
- Focus, signaal en tellingen zijn op telefoon en laptop identiek, getoetst op de gedeelde kern.
- De stapels tonen standaard alleen het werk van de ingelogde gebruiker.
- Pushmeldingen komen binnen op iOS (geïnstalleerde PWA) en Android, respecteren stille uren en het dagplafond, en "gelezen" is gelijk op alle apparaten.
- Een bouwprompt met een scherm is pas klaar als hij op de toestellen uit 8.15 is getest.

---

# Deel C · Featurecatalogus

## 9. Featurecatalogus

Elke feature heeft dezelfde opbouw, zodat je er direct een bouwprompt van maakt:

- **Functioneel**: kern, voor wie en op welk niveau, waar je het vindt, opbouw van het scherm, klikpaden, flyouts en knoppen, filters, regels.
- **Technisch**: datamodel, pure functies, endpoints, AI-stappen, acceptatiecriteria, hergebruik uit DealDrive, buiten scope.

Schermteksten staan tussen aanhalingstekens en zijn de bedoelde tekst in de app. Waar DealDrive een fout of gat had (bron: `secties/`), staat bij Dealtrace de correctie.

| Nr | Feature | Hoofdgebruiker | Sprint |
|---|---|---|---|
| F01 | Vandaag | iedereen | 5 |
| F02 | Leadgenerator: AI-zoeker, import, CRM, KvK, Datacollectief | accountmanager, salesmanager | 2, 7 en 10 |
| F03 | Prospects en accountkaart | iedereen | 2 |
| F04 | Contacten en buying committee | iedereen | 2 |
| F05 | Doelgroepen en prospectreis, standaard en maatwerk | salesmanager, expert | 4 en 11 |
| F06 | Acties: taken en inzichten | iedereen | 5 |
| F07 | Belblokken en belmodus | binnendienst | 6 |
| F08 | Belscript-templates | binnendienst, salesmanager | 6 |
| F09 | Agenda, afspraken en meetings | iedereen | 8 |
| F10 | Bezoeken en kansen langs de route | buitendienst | 8 |
| F11 | Briefings en Pitstop | iedereen | 9 |
| F12 | Campagnes | gevorderd, salesmanager | 9 |
| F13 | Prospectplanning en hercontactritme | gevorderd, salesmanager | 5 en 6 |
| F14 | AI-agents voor interne en externe bronnen | iedereen (lezen), expert (inrichten) | 10 |
| F15 | Activity selling-regels (de motor) | beheerder, salesmanager | 4 |
| F16 | Accountmatrix en ritmes | beheerder | 4 |
| F17 | Funnel van de prospectreis | iedereen | 9 |
| F18 | Gebieden en regio-analyse | buitendienst, beheerder | 8 |
| F19 | Eigen velden | beheerder | 2 |
| F20 | Salesmanager: controle, analyse en coaching | salesmanager | 11 |
| F21 | Helpcenter: hoe werkt Dealtrace en new business-academie | iedereen | 5 en 12 |
| F22 | Instellingen | beheerder | doorlopend |
| F23 | Platformbeheer in de app (geen aparte HQ) | founder | 1 en 12 |
| F24 | Meldingen, zoeken, mobiel en offline | iedereen | 1 en 12 |
| F25 | Verkoopverhaal en Richting (SalesDNA-sublagen) | iedereen (lezen), beheerder en salesmanager (inrichten) | 3 en 11 |
| F26 | AI-assistent: chatten met AI, credits per abonnement | iedereen | 5 en 12 |

---

### F01 Vandaag

#### Functioneel

**Kern.** Vandaag is het product: de pagina waarop elke werkdag begint en waar de meeste gebruikers het grootste deel van hun tijd zijn. Hij beantwoordt drie vragen: wat moet ik nu doen, waarom, en wat staat er voor mij klaar.

| Wie | Wat | Niveau |
|---|---|---|
| Accountmanager | Taken van vandaag met "poging n van m", afspraken, belblok, klaargezette concepten, afronden met uitkomst | Beginner |
| Accountmanager | Plus: blok "Door agents gedaan sinds gisteren", weekvooruitblik, eigen volgorde van de blokken | Gevorderd |
| Accountmanager | Plus: eigen weergaven en filters op de takenkolom | Expert |
| Salesmanager | Eigen Vandaag plus het blok "Team vandaag" (wie loopt achter, wat wacht op goedkeuring) | rol salesmanager |

**Route:** `/`. Eerste item in de zijbalk.

**Opbouw van boven naar beneden**

1. **Kop.** Groet met naam ("Goedemorgen, Sanne."), datum en weeknummer als kicker ("VANDAAG · DINSDAG 13 OKTOBER · WEEK 42"), een samenvattende regel ("6 taken · 3 uit campagnes · koude norm 3 van 5 deze maand · volgende koude actie 10:00"). Rechts "+ Taak" (geel), "+ Afspraak", "+ Prospect", "Vraag AI" (F26).
2. **Aanleiding van de dag.** Eén kaart met het belangrijkste inzicht voor een van jouw accounts (ongelezen, relevantie 85 of hoger, jonger dan 48 uur wint), met bron, citaat en de knoppen "Maak taak" en "Open kaart".
3. **Drie kolommen.**
   - "TAKEN n": maximaal 8, eerst achterstallig, dan vandaag, dan hoog en urgent; per taak tijd, account, actiesoort als label ("BEL", "MAIL", "LINKEDIN", "BEZOEK", "TAAK"), regel "poging 2 van 5 · vorige: voicemail", winpunt of script, label "AI" als er een concept klaarstaat. "nog N meer →" naar Acties.
   - "AFSPRAKEN n": vandaag, met meetingsoort, plaats of "online", link "Pitstop →".
   - "PRIO n": maximaal 4: nieuwe aanleidingen (trigger), eerste afspraken die nog bevestigd of overgedragen moeten worden, geparkeerde accounts die vandaag terugkomen, partnerleads te laat.
4. **Werkblok** (volgt het werkplekprofiel):
   - Binnendienst: "BELBLOK 10:00 tot 11:00 · 6 gesprekken · 48 min" met "Start belblok" (geel) en "Vul aan".
   - Buitendienst: "BEZOEKDAG · REGIO OOST · 3 bezoeken · 4 kansen langs de route" met "Open route" (geel).
5. **Klaargezet door AI.** "4 concepten wachten op je goedkeuring" (mails, LinkedIn-berichten, belscripts), elk met "Bekijk".
6. **Door agents gedaan sinds gisteren** (Gevorderd): "12 dossiers ververst · 3 nieuwe aanleidingen · 2 accounts geparkeerd · 5 mails verstuurd binnen campagne X". Klik opent de activiteitenlog gefilterd op agents.
7. **Datakwaliteit**: de drie grootste gaten ("12 actieve prospects zonder telefoonnummer") met één knop ("Verrijk" of "Maak taak").
8. **Jouw week** (Gevorderd): vijf dagkolommen met aantallen taken, afspraken, belblokken en regiodagen.

**Klikpaden**

1. Een taak afronden: klik op de taak, de taakflyout opent (F06) met aanleiding, concept en uitkomstknoppen; kies "Geen reactie", de volgende poging verschijnt in de lijst met datum en kanaal; toast "Afgerond. Volgende poging donderdag 16 oktober, bellen."
2. Een belblok starten: "Start belblok" opent de belmodus (F07) met het eerste gesprek en het gekozen script.
3. Een concept goedkeuren: "Bekijk" bij een mailconcept opent de taakflyout met het concept; "Keur goed" maakt "Verstuur" beschikbaar; na versturen is de taak afgerond met uitkomst "verstuurd".
4. Snel een prospect toevoegen: "+ Prospect" opent de flyout "Nieuwe prospect" (F03) met dubbelcheck op KvK, domein en naam.

**Regels**

- Vandaag toont alleen eigen werk; de salesmanager ziet daarnaast "Team vandaag".
- Maximaal 8 taken en 4 prioriteiten in beeld; de rest via "nog N meer".
- Achterstallige taken staan altijd bovenaan en nooit uit beeld.
- Afronden kan zonder de pagina te verlaten; offline wordt het lokaal bewaard en later gesynchroniseerd (F24).
- Een Beginner ziet blok 1 tot en met 5; Gevorderd ziet ook 6 tot en met 8.

**Op de telefoon (hoofdstuk 8).** Vandaag op 390 px toont groet, focuskaart en telstrip boven de vouw; signaal, tip en recap volgen de rekenkern `shared/dagritme.ts` en `shared/signalen.ts` (8.13). De stapels tonen alleen eigen werk.

**Uit het verkoopverhaal (F25).** Taken op accounts in een branche met focus primair of prioriteit hoog krijgen voorrang in "Top deze week"; een terugkomregel die vandaag afloopt, verschijnt als taak met de aanpak als aanleiding.

#### Technisch

- Leest: `tasks` (eigen, open, `due_date <= vandaag` of hoog/urgent), `appointments` (vandaag), `signals` (eigen accounts, ongelezen), `campaign items`, `belblokken`, `agent_runs` (sinds gisteren, eigen accounts), `datakwaliteit`-telling.
- Eén endpoint `GET /api/vandaag` dat alles samenstelt (onder 1,0 s warm op desktop), plus de offline kopie uit IndexedDB zodat Vandaag ook zonder verbinding opent.
- Pure functies: `ordenTaken(taken, nu)` (achterstallig, vandaag, prioriteit, tijd), `kiesAanleidingVanDeDag(signals, gebruiker, nu)`, `samenvattingsregel(...)`.
- Acceptatie: met 30 open taken toont Vandaag er 8 en "nog 22 meer"; een achterstallige taak staat altijd bovenaan; een offline afgeronde taak verschijnt na synchronisatie niet dubbel; een binnendienstprofiel toont het belblok, een buitendienstprofiel de bezoekdag.
- Hergebruik: `index.vue`, `VandaagPanel.vue`, `BriefingCard.vue`, `ActivityFeed.vue` uit DealDrive.

---

### F02 Leadgenerator: AI-zoeker, import, CRM, KvK en Datacollectief

**Beslissing B11.** In DealDrive was de generator een mooie schil zonder echte zoekresultaten (vijf vaste voorbeeldbedrijven, geen leadtabel, bundel niet afgedwongen). Dealtrace bouwt hem als **één leadstroom met vijf bronnen**. Elke bron levert dezelfde leadstructuur aan, gaat door dezelfde ontdubbeling, dezelfde criteria met bewijs en dezelfde vijf groepen. Voor de gebruiker maakt het niet uit waar een naam vandaan komt.

#### Functioneel

**Bronnen**

| Bron | Wat het levert | Wanneer je het gebruikt | Niveau |
|---|---|---|---|
| **AI-zoeker** | Bedrijven die lijken op je beste klanten of op een doelgroep, met dossier en bewijs per criterium | Nieuwe namen vinden zonder lijst | Gevorderd |
| **KvK** | Bedrijven uit het Handelsregister op SBI, plaats of postcodegebied, rechtsvorm en omvang; basisprofiel per KvK-nummer; mutaties (nieuwe vestiging, wijziging) als signaal | Een doelgroep volledig en betrouwbaar vullen | Gevorderd |
| **Datacollectief** | Bedrijven en contactpersonen (functie, direct nummer, zakelijk e-mailadres, LinkedIn), branche, omvang, selecties op doelgroep | Een lead met een aanspreekpunt; contactpersonen aanvullen | 7 |
| **Import** | Een eigen lijst uit Excel of CSV (beurs, gekochte lijst, netwerk, oude offertes) | Bestaande lijsten in één keer binnenhalen | Gevorderd |
| **CRM-koppeling** | Bestaande klanten en prospects uit HubSpot, Salesforce, Microsoft Dynamics, Pipedrive of AFAS (eerst HubSpot), in twee richtingen | Ontdubbelen tegen het CRM, profiel bepalen, overgenomen leads terugschrijven | 10 |

Een Beginner gebruikt de leadgenerator niet zelf; hij krijgt overgenomen leads van zijn salesmanager of van een automatische ronde als taak op Vandaag. Zet de salesmanager die functie voor hem aan, dan kan hij wel "Neem over" en "Niet relevant" gebruiken.

**Route en navigatie:** `/leadgenerator` (groep Prospects). Tabbladen: "Zoeken", "Importeren", "Koppelingen", "Rondes en verbruik".

**Tabblad Zoeken**

- Kop: kicker "LEADGENERATOR · 25 GEVONDEN", titel "Leadgenerator", subtitel "Bedrijven die passen bij je doelgroep, met bewijs, bron en datum." Rechts "Zoekopdracht aanpassen" en "Nieuwe ronde" (geel; uit als de AI-credits op zijn, met tooltip "De AI-credits van deze maand zijn op").
- **Zoekopdracht** in vakken, elk met label, waarde en herkomstregel:

| Vak | Waarde | Herkomst |
|---|---|---|
| Doelgroep | gekozen doelgroep of "Lijkt op mijn klanten" | F05 |
| Klasse of omvang | bijvoorbeeld "B en C" | doelgroep of keuze |
| Branche | maximaal drie SBI-codes met naam | uit de doelgroep, of afgeleid uit je klanten: "Uit je 142 klanten in deze klassen" (alleen echte klanten, niet prospects) |
| Werkgebied | postcodegebieden, gebieden (F18) of straal rond je thuisbasis | doelgroep of profiel |
| Aanleiding | vrije tekst, bijvoorbeeld "werft servicemonteurs" | gebruiker |
| Bronnen | AI-zoeker, KvK, Datacollectief (vinkjes, alleen gekoppelde zichtbaar) | instellingen |

- Paneel "Zoekopdracht aanpassen" opent onder de vakken; wijzigingen werken direct door in de beoordeling; "Bewaar als zoekopdracht" (Expert) maakt een opgeslagen zoekopdracht die je kunt herhalen of automatisch per week laten draaien.
- **Groepen** (vaste volgorde, eerste treffer wint, lege groepen verborgen): "Al in je bestand" (KvK gelijk, anders domein, anders naam plus postcode met 80 procent gelijkenis; ook tegen het gekoppelde CRM), "Valt af" (minstens één criterium nee), "Verlopen" (dossier ouder dan 30 dagen), "Nog niet te beoordelen" (minder dan 4 criteria beoordeeld), "Passend" (minstens 3 keer ja en 4 beoordeeld, instelbaar).
- **Leadrij**: bedrijfsnaam, plaats, bronpil ("KvK", "AI-zoeker", "Datacollectief", "Import: Beurs Vakdagen 2026", "HubSpot"), klassepil, dossierpil ("Dossier van vandaag", oranje na 30 dagen), bewijsregels per criterium (ja groen, nee rood, ? grijs, met zin, bron en datum), score "5/6", contactpersoon als bekend ("Peter Kok · eigenaar · beslisser"), en knoppen per groep: Passend "Neem over" (geel) en "Niet relevant"; Verlopen "Opnieuw uitzoeken" met "Kost 1 dossier"; Nog niet te beoordelen "Toch uitzoeken"; Al in je bestand "Open kaart".
- **Meters** onderaan: "Zoekrondes deze maand 14 / 120", "Dossiers 31 / 240", "Datacollectief-records 120 / 500", "KvK-bevragingen 410 / 2.000".

**Criteria (score x van 6)**

| Criterium | Bron van het oordeel |
|---|---|
| Klasse of omvang | medewerkers uit KvK of Datacollectief, vergeleken met de klassen van de organisatie (niet een vaste standaard) |
| Branche | SBI uit KvK, vergeleken met de doelgroep |
| Werkgebied | postcode of coördinaat, getoetst aan gebieden of straal (in DealDrive niet getoetst) |
| Aanleiding | trefwoorden uit de aanleiding in een bewijszin uit het dossier |
| Groeisignaal | dossier: vacatures, nieuws, nieuwe vestiging |
| Bereikbaarheid | heeft een contactpersoon met functie en een nummer of e-mail |

Regels: onbekend is geen nee; een nee blokkeert; elk oordeel draagt bewijs met bron en waar het veroudert een datum. Dossierhoudbaarheid: zacht 30 dagen (Verlopen), hard 120 dagen (bewijs vervalt), opruimen na 60 dagen zonder actie.

**Neem over**

1. Klik "Neem over". Een kleine flyout bevestigt eigenaar (standaard jij), doelgroep en reis (voorstel uit `kiesReis`), kanaal (direct, of via partner bij een kanaalregel) en de eerste stap: binnendienst "Bel in je eerstvolgende acquisitieblok met script Koude acquisitie", buitendienst "Bezoek op je regiodag" of "Bel eerst", optioneel "Zet in campagne".
2. Na bevestigen maakt Dealtrace het account (soort prospect) met naam, KvK, SBI, branche, medewerkers, klasse in hetzelfde veld dat de kaart toont, adres, website, bron en bewijs als notitie, plus de contactpersonen; status `nieuw`, gebeurtenis `lead-overgenomen`, fase "Gevonden".
3. Toast "Teeuwen Bouw staat nu bij je prospects, klasse B. Eerste belpoging staat in je blok van donderdag 10:00." De lead verhuist naar "Al in je bestand".

**Niet relevant** vraagt een reden ("Te klein", "Verkeerde branche", "Heeft al een leverancier", "Buiten gebied", "Geen budget", "Anders"), bewaart die op de server, zodat het bedrijf niet terugkomt en de reden de volgende ronde bijstuurt.

**Tabblad Importeren** (wizard in vier stappen)

1. **Bestand**: Excel (.xlsx) of CSV, maximaal 10.000 rijen en 10 MB; keuze "Bedrijven" of "Bedrijven met contactpersonen"; voorbeeldbestand te downloaden; bron en label verplicht ("Beurs Vakdagen 2026").
2. **Kolommen koppelen**: per kolom een doelveld (bedrijfsnaam verplicht; KvK, domein, adres, postcode, plaats, SBI, medewerkers, telefoon, contact voornaam, achternaam, functie, e-mail, mobiel, eigen velden als `cf:<sleutel>`); automatische herkenning op kolomnaam; voorbeeld van de eerste 10 rijen.
3. **Controle en ontdubbelen**: rapport "85 nieuw · 12 al in je bestand · 3 dubbel in het bestand · 4 met fouten"; per regel kiezen "Importeer als nieuw", "Voeg samen met …", "Sla over"; samenvoegen zet nooit een klant terug naar prospect.
4. **Bevestigen en verrijken**: keuze "Verrijk na import via KvK" en "Zoek contactpersonen via Datacollectief" (met kostenindicatie), doelgroep en eigenaar (vast, of verdelen over het team volgens gebieden), "Zet in campagne". Daarna een voortgangsbalk en een samenvatting met een link naar de importbatch.

Elke importbatch is terug te draaien zolang er nog geen activiteit op de accounts is ("Draai import terug").

**Tabblad Koppelingen** (beheerder richt in, Expert gebruikt)

- **KvK**: API-sleutel van de organisatie, test, gebruiksteller. Functies: zoeken (handelsnaam, KvK-nummer, plaats, postcode, SBI), basisprofiel en vestigingsprofiel ophalen, maandelijkse controle op wijzigingen bij prospects in reis (wordt een inzicht "KvK-mutatie").
- **Datacollectief**: sleutel, test, tegoed. Functies: selectie op doelgroep (branche, omvang, regio, functieniveau), verrijken van een account met contactpersonen, verrijken van een contact (functie, nummer, e-mail). Elk opgehaald record kost tegoed en telt in het maandplafond voor Datacollectief (geen AI-credits).
- **CRM** (eerst HubSpot, daarna Salesforce, Dynamics, Pipedrive, AFAS via dezelfde koppellaag): OAuth-verbinding, veldtoewijzing, richting per object (lezen, schrijven, beide), eigenaarsregel (CRM-eigenaar naar Dealtrace-gebruiker op e-mail), synchronisatiemoment (elk uur en op verzoek), conflictregel (bronprioriteit, zie 15.1). Lezen: klanten en prospects voor ontdubbelen en profiel; schrijven: overgenomen leads met contactpersonen, uitkomsten, eerste afspraken en de overdracht (het CRM maakt de deal).

**Tabblad Rondes en verbruik**: lijst van rondes en imports met datum, bron, aantal gevonden, overgenomen, afgewezen, conversie naar afspraak; meters per bron in credits; daggrens per gebruiker (10 rondes).

**Grenzen** (op de server afgedwongen): elke ronde en elk dossier kost AI-credits (ronde 20, dossier 10; 11.4) uit de pot van de organisatie, 10 rondes per gebruiker per dag, 25 bedrijven per AI-ronde, dezelfde zoekopdracht binnen 24 uur geeft het bewaarde resultaat zonder kosten; KvK en Datacollectief met eigen plafonds per maand uit de instellingen.

**Uit het verkoopverhaal (F25).** Een zoekopdracht kiest een branche uit het leesmodel; `vv_branche_mapping` levert de SBI-codes en trefwoorden voor KvK en Datacollectief. Per concurrent met soort Direct is er een zoeksjabloon "Overstappers van <concurrent>". Een nieuwe lead krijgt `vv_branche_id` via de mapping. Op de telefoon kun je een bedrijf op naam opzoeken in KvK en met één tik toevoegen (8.6).

#### Technisch

**Datamodel**

```ts
leads: id, organisation_id, naam, kvk, domein, postcode, plaats, status ('nieuw'|'overgenomen'|'afgewezen'),
       bron ('ai'|'kvk'|'datacollectief'|'import'|'crm'), bron_ref (rondeId, batchId, extern id),
       gevonden_op, dossier_op, account_id, data jsonb
  data: medewerkers, sbi[], adres, website, telefoon, contacten [{naam, functie, email?, telefoon?, linkedin?, bron}],
        bewijs [{criterium, oordeel: 'ja'|'nee'|'onbekend', zin, bron, url?, datum?}], score, beoordeeld,
        afwijsreden?, herkomst {}
lead_rondes: id, organisation_id, gebruiker_id, zoekopdracht jsonb, hash, bronnen[], aantal, gestart_op, kosten jsonb
import_batches: id, organisation_id, gebruiker_id, bestandsnaam, soort, bron_label, koppeling jsonb, rapport jsonb,
                status ('concept'|'verwerkt'|'teruggedraaid'), verwerkt_op
koppelingen: id, organisation_id, soort ('kvk'|'datacollectief'|'hubspot'|'salesforce'|'dynamics'|'pipedrive'|'afas'),
             status, geheimen (versleuteld, AES-256-GCM), instellingen jsonb {veldtoewijzing, richting, eigenaarsregel, plafond}
koppeling_runs: id, organisation_id, koppeling_id, start, eind, gelezen, geschreven, fouten jsonb
lead_verbruik: organisation_id, maand, soort ('ronde'|'dossier'|'kvk'|'datacollectief'), aantal, kosten_cent
```

**Pure functies (`shared/leadGenerator.ts`, `shared/ontdubbelen.ts`)**

- `leidZoekopdrachtAf(klanten, klassen)`: top 3 SBI, top 6 postcodegebieden, alleen echte klanten.
- `zoekDuplicaat(kandidaat, bestand)`: KvK, dan domein zonder `www.`, dan genormaliseerde naam (zonder B.V., N.V., Holding, Group) met Sørensen-Dice; 80 procent duplicaat, 60 tot 80 mogelijk duplicaat.
- `beoordeelLead(lead, zoekopdracht, klassen, gebieden)`: zes criteria met bewijs; `groepeerLead(lead)` volgens de vaste volgorde.
- `klasseUitMedewerkers(n, klassenVanOrganisatie)`.
- `importKoppeling(kolommen)`: herkenning op kolomnaam; `valideerImportRij(rij)`.

**Adapters (`server/utils/bronnen/`)**: `kvk.ts` (zoeken, basisprofiel, vestigingsprofiel, mutaties), `datacollectief.ts` (selectie, bedrijfsverrijking, contactverrijking), `crm/hubspot.ts` en een gemeenschappelijke interface `CrmAdapter { leesBedrijven, leesContacten, schrijfBedrijf, schrijfContact, schrijfActiviteit }`. Elke adapter heeft een mock met vaste fixtures, zodat tests zonder sleutel en zonder netwerk draaien. Elke externe aanroep wordt gelogd in `koppeling_runs` en telt in `lead_verbruik`.

**Endpoints**

| Route | Doel |
|---|---|
| `POST /api/leads/ronde {zoekopdracht, bronnen}` | Ronde starten; creditcheck (11.4), hash 24 uur |
| `GET /api/leads?ronde=&groep=` | Leads met groep en bewijs |
| `POST /api/leads/:id/dossier` | Dossier opnieuw uitzoeken (kost 1 dossier) |
| `POST /api/leads/:id/overnemen {eigenaar, reisId, eersteStap, campagneId?}` | Account maken, gebeurtenis `lead-overgenomen`, eerste taak |
| `POST /api/leads/:id/afwijzen {reden}` | Afwijzen met reden |
| `POST /api/import/voorbeeld`, `/api/import/controle`, `/api/import/verwerk`, `/api/import/:id/terugdraaien` | Importwizard |
| `GET/PUT /api/koppelingen/:soort`, `POST /api/koppelingen/:soort/test`, `POST /api/koppelingen/:soort/sync` | Koppelingen |
| `POST /api/kvk/zoek`, `GET /api/kvk/:nummer` | KvK-zoeken en profiel |
| `POST /api/datacollectief/selectie`, `POST /api/accounts/:id/verrijk-contacten` | Datacollectief |
| `GET /api/leads/verbruik` | Meters |

**AI-stappen**: zoekronde (`zoekBedrijven`, Claude met websearch, maximaal 3 zoekopdrachten, 25 bedrijven, URL's alleen uit echte resultaten) en dossier (zes criteria met bewijs); schema en bewijsplicht als in 11.3. KvK en Datacollectief zijn geen AI-bronnen; hun gegevens gaan als feiten met bron `kvk` of `datacollectief` het materiaal in.

**Acceptatiecriteria**

- Een ronde levert leads in de vijf groepen; dezelfde ronde binnen 24 uur kost niets.
- Een lead met hetzelfde KvK-nummer als een bestaand account of een HubSpot-bedrijf staat in "Al in je bestand".
- "Neem over" maakt een account met klasse in het juiste veld, SBI, medewerkers, contactpersonen en bewijs, en een eerste taak volgens het werkplekprofiel.
- Een import van 1.000 rijen met 50 duplicaten toont een correct ontdubbelrapport; terugdraaien verwijdert alleen accounts zonder activiteit.
- Zonder KvK-sleutel is de bron KvK niet kiesbaar en zegt de koppelingenpagina wat er nodig is.
- De AI-credits worden op de server afgedwongen (11.4); de elfde ronde van een gebruiker op één dag geeft 429 met "Je daggrens van 10 zoekrondes is bereikt."
- Alle adapters hebben een mock; de Playwright-specs draaien zonder netwerk.

**Hergebruik uit DealDrive**: `shared/leadGenerator.ts` (afleiden, matchregels, groepen), `webBron.ts` (webzoeker met bewijsplicht en houdbaarheid), `import.vue` (wizard en dubbelcheck), `server/api/integrations/hubspot/*` en `hubspot-mapper.ts` (OAuth en veldtoewijzing).

**Buiten scope (nu)**: LinkedIn Sales Navigator-koppeling, scrapen van LinkedIn, kopen van lijsten vanuit de app.

---

### F03 Prospects en accountkaart

#### Functioneel

**Kern.** Een account is een bedrijf. Prospect of klant is een eigenschap, geen aparte tabel en geen aparte route; klanten komen uit DealDrive of het CRM (voor kansen langs de route en winback), Dealtrace promoveert zelf niet; een wijziging is een veldwijziging met audit. De prospectlijst is voor de binnendienst de bellijst en voor de buitendienst de selectie per regio; de accountkaart is het dossier voor en na elk gesprek.

| Wie | Wat | Niveau |
|---|---|---|
| Accountmanager | Top deze week, lijst met zoeken en filters klasse, status, "Van mij"; kaart met kop, stuurstrip, statstrook, tijdlijn, taken, notities, contacten; nieuwe prospect; bellen en mailen | Beginner |
| Accountmanager | Alle filters met meerekenende tellers, sorteren, weergaven Lijst, Compact, Kaarten, contextmenu, Info-flyout met eigen velden, segmenten, opgeslagen filters, klasse zetten | Gevorderd |
| Accountmanager | Samenvoegen van duplicaten, exporteren, scoreopbouw inzien, alle tabbladen | Expert |
| Salesmanager | Dekkingstellingen per eigenaar en klasse, eigenaar wijzigen, verwijderen | rol |

**Routes**: `/prospects` (Top deze week), `/prospects/alle` (lijst), `/accounts/:id` (kaart). Klanten (`/klanten`) bestaan als lijst voor accounts met status klant; in Dealtrace staat die standaard verborgen voor de Beginner.

**Top deze week** (`/prospects`): kicker "TOP DEZE WEEK · 12 OKT TOT 18 OKT", titel "Belangrijkste prospects van deze week", zes kaarten met rangnummer, klassepil, naam, branche, plaats, aanleiding in een grijs blok met paarse rand, aantal inzichten, fasepil en "Open →". Rangschikking met de echte score (zie regels). Knoppen "Prospectplanning →" (Gevorderd) en "Alle prospects →".

**Lijst** (`/prospects/alle`)

- Kop "← Prospects · 86 prospects totaal", titel "Alle prospects". Werkbalk: zoeken, "+ Prospect" (geel), "+ Taak", "+ Afspraak", "Weergave" (Lijst, Compact, Kaarten), "Sortering", "Filters" met teller.
- Rij: logo of initialen in kleur van de prospectgraad, naam met klassepil, fasepil en statuspil, metaregel (website- en LinkedIn-icoon, branche, plaats, telefoon als bellink, "Inzichten: n", "Laatste contact: 4 sep" of "nog nooit"), aanleiding eronder (rood bij hete aanleiding), rechts maximaal drie contacten als initialen (beslissers eerst) of "Geen contactpersoon".
- Paginering: 25 rijen, "Toon meer".
- Contextmenu (rechtsklik of lang drukken): "Open kaart", "Bel primaire contact", "Stuur e-mail", "Nieuwe taak", "Plan afspraak", "Zet in campagne", "Zet nee", "Promoveer tot klant".
- Lege staat: "Niets gevonden." met "Toon alles".

**Filters** (tellers rekenen mee met alle andere actieve filters; een pil met nul is uitgeschakeld; filters en sortering staan in de URL; opgeslagen filters per gebruiker, Gevorderd):

| Groep | Waarden |
|---|---|
| Eigenaar | "Van mij" (standaard aan), "Team", "Iedereen" |
| Status | Nieuw, In reis, Wachtend, Nee, Gescoord |
| Reis en fase | per reis de fases |
| Klasse | klassen van de organisatie, "Geen klasse" |
| Aanleiding | "Met aanleiding" |
| Laatste contact | "Nog nooit", "Ouder dan 30 dagen", "Ouder dan 90 dagen" |
| Gebied | gebieden (F18), "Zonder gebied" |
| Afstand (buitendienst) | binnen 10, 25, 50 km van thuisbasis of van een plaats |
| Bereikbaarheid | "Zonder telefoon", "Zonder e-mail", "Zonder beslisser" |
| Doelgroep, campagne, bron | lijsten |
| Eigen velden | per eigen veld met type keuzelijst, ja of nee, getal (Gevorderd) |

Sortering: "Naam", "Laatste contact", "Score", "Klasse", "Dagen in fase", "Afstand".

**Accountkaart** (`/accounts/:id`), van boven naar beneden

1. Kruimel "← Alle prospects".
2. Kop: logo, naam met klassepil (keuzemenu met omschrijving per klasse), chips branche, plaats, land, bewerkbaar met potlood; statuspil en fasepil met "12 dagen in fase".
3. Contactstrip: website, telefoon (bellink), LinkedIn.
4. Stuurstrip, alleen lezen: "Laatste actie", "Laatste call", "Laatste bezoek", "Reis", "Ritme: poging 3 van 5 · volgende do 16 okt · bellen".
5. Knoppen: "Info", "Contacten 3", "Briefing" (zwart), "Bel", "+ Taak", "+ Afspraak".
6. Statstrook: "Open acties" (n achterstallig rood), "Inzichten" (n ongezien), "Eerstvolgende afspraak", "Volgende stap", "Laatste contact", "Eigenaar".
7. Strook nieuwste aanleiding.
8. Blokken in drie kolommen: "Dossier" (datum, aantal criteria, kernfeiten, "Dossier vernieuwen · kost 1 dossier"), "Kwalificatie BAND 3/4" (Behoefte, Autoriteit, Noodzaak, Draagvlak, elk met bron), "Ritme" (stand, "Zet nee", "Pauzeer tot", "Verplaats naar reis").
9. Buying committee (F04).
10. Tabbladen: "Tijdlijn", "Taken", "Contacten", "Notities", "Reis", en achter "Meer": "Inzichten", "E-mails", "Afspraken", "Verslagen", "Campagnes", "Activiteitenlog", "Eigen velden".
11. Mobiel: vaste balk onderin "Bellen" en "Mail".

**Flyout Nieuwe prospect** ("Wie ga je erbij zetten?"): Bedrijfsnaam (verplicht) met direct een dubbelcheck ("Bedoel je Teeuwen Bouw B.V. in Houten? Al in je bestand."), "Zoek in KvK" (vult officiële naam, KvK, SBI, adres, medewerkers), Klasse (voorstel uit medewerkers), adres, telefoon, website, LinkedIn, eigen velden per sectie, doelgroep en reis (voorstel). Knop "Prospect aanmaken"; toast "Teeuwen Bouw staat erbij." en de kaart opent. Een Beginner ziet alleen naam, plaats, telefoon, website en "Zoek in KvK".

**Zet nee**: keuzelijst met de vaste redenen (7.2), bij "Tevreden met huidige leverancier" de vraag "Bij wie?" (keuze uit de concurrenten, F25, wordt "Verloren aan"), toelichting (verplicht bij "Anders"), terugkomdatum (voorstel volgens reden), afkoelperiode per kanaal (voorgevuld). Bevestiging "Teeuwen Bouw staat op nee tot 13 januari 2027."

**Overdragen**: na een gehouden eerste afspraak met vervolg; altijd met bevestiging, wie en wanneer gelogd, gebeurtenis `overgedragen`, en overdracht naar DealDrive, het CRM of een collega (F17). Dealtrace maakt geen klant van een prospect; dat gebeurt in DealDrive of het CRM.

**Regels**

- **Score** (0 tot 100, met zichtbare opbouw bij hover en in de Info-flyout): versheid van aanleidingen 30, bereikbaarheid (beslisser met nummer, e-mail) 25, fit met de doelgroep (criteria uit het dossier) 20, momentum (recente uitkomsten, geplande afspraak) 15, recentheid van contact 10. Een nieuw account krijgt geen vaste 50 meer maar de berekende waarde.
- **Laatste contact**: jongste moment uit verzonden of ontvangen mail, afgeronde bel-, mail-, bericht- en afspraaktaken, gehouden afspraken; open taken en toekomstige afspraken tellen niet; import fabriceert geen contactmoment. Eén functie voor lijst, sortering en kaart.
- **Primair contact**: eerste beslisser of champion, anders iemand met telefoonnummer, anders de eerste.
- Verwijderen: alleen salesmanager en beheerder; contactpersonen gaan mee, activiteitenlog blijft met "account verwijderd".

**Uit het verkoopverhaal (F25).** Nieuwe velden "Branche (verkoopverhaal)" (chip naast de SBI-branche), "Huidige leverancier" (keuze uit de concurrenten of "Onbekend"; bij een keuze verschijnen "Zo zeg je het" en "Bewijs") en "Terug op" (datum, reden en aanpak uit de terugkomregel). Bij kwalificeren toont "Wanneer we verliezen" de waarschuwing "Let op: hier verliezen we vaak van <concurrent>."

**Op de telefoon.** De compacte accountkaart uit 8.5.5 met plakkende actiebalk "Bellen", "Mail", "WhatsApp", "Navigeer".

#### Technisch

- Tabel `accounts` als in hoofdstuk 10, met kolommen voor alles waarop gefilterd wordt (`nb_status`, `reis_id`, `fase_id`, `klasse`, `owner_id`, `gebied_id`, `score`, `laatste_contact_op`, `lat`, `lng`).
- Pure functies: `berekenScore(account, context)` met opbouw, `laatsteContact(account, records)`, `primairContact(contacts)`, `filterTellers(accounts, filters)`.
- Endpoints: `GET /api/accounts?...` (server-side filtering en paginering boven 2.000 accounts), `POST /api/accounts`, `PUT /api/accounts/:id`, `POST /api/accounts/:id/nee`, `POST /api/accounts/:id/overdragen` (F17), `POST /api/accounts/samenvoegen`, `GET /api/accounts/export` (Expert).
- Acceptatie: tellers op filterpillen kloppen met het resultaat als je ze aanklikt; filters overleven herladen via de URL; een dubbel bedrijf wordt bij aanmaken gevangen op KvK, domein en naam; de score toont zijn opbouw.
- Hergebruik: `AccountRow.vue`, `AccountScoreCircle.vue`, `KlantGradePicker.vue`, `EditableField.vue`, `InlineEditChip.vue`, pagina's `prospects/*` en `accounts/[id]`.

---

### F04 Contacten en buying committee

#### Functioneel

**Kern.** Een contact is een persoon bij precies één account, met een rol in de koopbeslissing. Voor new business is de vraag "hebben we de beslisser al, en wie ontbreekt er nog?" de kern van kwalificatie.

**Rollen** (één begrip, geen los vinkje "beslist mee" meer): "Beslisser", "Beïnvloeder", "Champion", "Gebruiker", "Blokkeerder", "Poortwachter", "Onbekend". De rol bepaalt het primaire contact, de volgorde in lijsten en de vraag in het belscript.

| Wie | Wat | Niveau |
|---|---|---|
| Accountmanager | Snelformulier op de accountkaart, contactkaart met bellen, mailen, taak, afspraak; lijst met zoeken en rolfilter | Beginner |
| Accountmanager | Filters zonder e-mail, zonder telefoon, zonder contact in X dagen; buying committee door AI laten voorstellen; Info-flyout met bron en toestemming | Gevorderd |
| Accountmanager | Samenvoegen, verhuizen naar een ander bedrijf, contactpersonen aanvullen via Datacollectief | Expert |

**Routes**: `/contacten` (Top deze week: beslissers en beïnvloeders), `/contacten/alle`, `/contacten/:id`.

**Snelformulier op de accountkaart** (standaardroute): "Contacten" opent een flyout met de contacten van het account (rolvolgorde, binnen rol laatst bijgewerkt eerst) en onderaan "+ Snel contactpersoon": Voornaam, Achternaam (verplicht), Functie, E-mail, Telefoon, Mobiel, Rol (standaard Onbekend), met dubbelcheck op e-mail en naam binnen het bedrijf. "Contactpersoon toevoegen" zet hem direct in de lijst.

**Buying committee** (blok op de accountkaart)

- Per rol een vak: "Beslisser", "Beïnvloeder", "Champion", "Gebruiker", "Blokkeerder", met de namen en per naam de bron ("LinkedIn, ingevoerd door Sanne", "verslag 1 okt", "Datacollectief") en zekerheid ("vermoedelijk" onder 60).
- Ontbrekende rollen als grijze vakken met "Nog niet gevonden" en de actie "Zoek via Datacollectief" (Expert) of "Vraag in je volgende gesprek" (zet een vraag in het belscript).
- "Stel voor met AI" (Gevorderd): de Profielbouwer leest dossier, website, verslagen en ingevoerde LinkedIn-informatie en stelt rollen voor; nooit een naam zonder bron.

**Contactkaart**: portret of initialen, naam, functie, bedrijf (link), telefoon en mobiel als bellink, LinkedIn; stuurstrip van het account met expliciet label ("Account · laatste call"); statstrook; tabbladen "Tijdlijn", "Taken", "Notities", "Afspraken", "Verslagen"; voetnoten naar account-items zonder dit contact ("Daarnaast 2 open taken op accountniveau"). Knop "Briefing →" kiest de soort die bij het volgende gesprek past (F11).

**Toestemming en voorkeur**: per contact "E-mail" en "WhatsApp" met status onbekend, ja, nee, datum en bron; "Voorkeurskanaal"; "Bel me niet" (blokkeert bellen en zet het nummer op de bel-me-niet-lijst van de organisatie).

**Status "vertrokken"**: bij vertrek of functiewissel geen verwijdering maar status "vertrokken" met datum; het contact blijft in de historie, en de Waarnemer maakt een inzicht "Beslisser vertrokken bij Teeuwen Bouw" als het een beslisser was.

**Filters lijst**: zoeken (naam, functie, bedrijf), rol, "Bij prospects" of "Bij klanten", "Van mijn accounts", "Zonder e-mail", "Zonder telefoon", "Geen contact in 30 of 90 dagen", eigen velden. Sortering: rol, laatste contact, bedrijf.

#### Technisch

- `contacts`: `account_id` (verplicht), `first_name`, `last_name`, `email`, `rol`, `status` (`actief`|`vertrokken`), `data { functie, telefoon, mobiel, linkedin, jarenInRol, bronUrl, consent {email, whatsapp}, voorkeurskanaal, belMeNiet, herkomst{}, customFields{} }`.
- Pure functies: `ontbrekendeRollen(contacts)`, `contactDuplicaat(nieuw, bestaand)` (exact e-mail, anders volledige naam binnen het bedrijf), `primairContact`.
- Endpoints: `GET/POST/PUT /api/contacten`, `POST /api/contacten/:id/verhuis {accountId}`, `POST /api/contacten/samenvoegen`, `POST /api/accounts/:id/committee/voorstel` (AI), `POST /api/contacten/:id/verrijk` (Datacollectief).
- AI: `bouwCommittee` met schema `[{naam?, functie, rol, bron, zekerheid}]`; zekerheid onder 60 wordt "vermoedelijk".
- Acceptatie: een contact zonder account kan niet bestaan; rol en primair contact zijn overal gelijk; "Bel me niet" verwijdert het account uit elke bellijst voor dat nummer; een vertrokken beslisser geeft één inzicht.
- Hergebruik: `contacten/*`, `ContactInfoFlyout.vue`, `ContactenFlyout.vue`, `useContactRol.ts`, `Portrait.vue`.


### F05 Doelgroepen en prospectreis (standaard en maatwerk)

**Beslissing B8.** In DealDrive heet dit de customer journey: één organisatiebrede lijst fases met overgangen op gebeurtenissen, een Pitstop-accent per fase en regels die aan een fase hangen. Dealtrace maakt er een **prospectreis** van met twee vormen: een **standaardreis** die elke organisatie direct krijgt en die zonder inrichting werkt, en **maatwerkreizen** die een expert per doelgroep bouwt.

#### Functioneel

**Kern**

- Een **doelgroep** beschrijft welke bedrijven je zoekt: branches (SBI), klassen of omvang, regio's of gebieden, bron (koud, warm, referral, winback), eigen filters en uitsluitingen. De doelgroep is ook de zoekopdracht voor de leadgenerator (F02).
- Een **prospectreis** is de route die een account van die doelgroep aflegt: fases, overgangen op gebeurtenissen, per fase een Pitstop-accent, standaardactiviteiten per rol (binnendienst, buitendienst) en een verwacht verblijf.
- Een account zit in hoogstens één actieve reis tegelijk, staat in precies één fase van die reis en heeft daarnaast een status (7.2).

**Voor wie en op welk niveau**

| Wie | Wat | Niveau |
|---|---|---|
| Accountmanager | Fasepil, status en dagen in fase op de kaart; uitkomst vastleggen waarmee fase en status meeschuiven | Beginner |
| Accountmanager | Fase corrigeren met reden; reisgeschiedenis lezen; lijsten filteren op reis en fase; reisoverzicht met aantallen | Gevorderd |
| Accountmanager | Een maatwerkreis maken als concept (leeg, vanuit de standaard of door dupliceren), fases, overgangen en startactiviteiten inrichten | Expert |
| Salesmanager | Doelgroepen en reizen beheren, conceptversies publiceren, accenten van de standaardreis bijstellen, dashboard per reis | rol salesmanager |
| Beheerder | Alles, inclusief prioriteit tussen doelgroepen en terugzetten van de standaard | rol beheerder |

**Waar je het vindt**

- `/reizen` (Expert en salesmanager): overzicht van doelgroepen en reizen.
- `/reizen/:id`: de reiseditor met tabbladen.
- Op de accountkaart (F03): reisnaam, fasepil, status, dagen in fase en "Fase corrigeren".
- In lijsten en op Vandaag: filters Reis en Fase.

**De standaardreis**

Tien fases in vijf hoofdfases, met een accent per fase; de reis eindigt bij de eerste afspraak en de overdracht (B17). De hoofdfase is verplicht bij elke fase, ook in maatwerk, zodat rapportage over reizen heen vergelijkbaar blijft.

| Hoofdfase | Fase | Pitstop-accent | Verwacht verblijf |
|---|---|---|---|
| Vinden | Gevonden | Alleen feiten uit het dossier; geen aannames over behoefte. | 5 dagen |
| Vinden | Dossier compleet | Benoem één concrete aanleiding uit het dossier. | 5 dagen |
| Bewerken | Gekwalificeerd | Kennismaken: één reden voor contact, geen pitch. | 10 dagen |
| Bewerken | Benaderd | Verwijs naar het eerdere contact en stel één vraag. | 21 dagen |
| Bewerken | In gesprek | Onderscheid benoemen en vergelijkingscriteria opvragen. | 21 dagen |
| Verbinden | Afspraak gepland | Bevestigen, voorbereiden: wie zit erbij, wat wil je weten, welk winpunt. | tot de afspraak |
| Verbinden | Afspraak gehouden | Behoefte, beslisser, noodzaak, draagvlak toetsen; vervolg afspreken. | 2 dagen |
| Overgedragen | Overgedragen | Overdracht met briefing; de deal ontstaat in DealDrive of het CRM. | eindfase |
| Verloren | Verloren | Heropvolging over drie maanden, zonder druk. | eindfase |
| Verloren | Geparkeerd | Alleen bij een nieuwe aanleiding. | tot terugkomdatum |

Kleuren per hoofdfase: Vinden zwart, Bewerken geel, Verbinden paars en oranje, Overgedragen groen, Verloren rood en grijs.

Overgangen van de standaardreis (elke fase is bereikbaar en elke fase heeft een uitweg):

| Vanuit | Gebeurtenis | Naar |
|---|---|---|
| (instap) | Lead overgenomen, import | Gevonden |
| Gevonden | Dossier compleet | Dossier compleet |
| Dossier compleet | Gekwalificeerd | Gekwalificeerd |
| Gekwalificeerd | Eerste contact | Benaderd |
| Benaderd | Gesprek gevoerd | In gesprek |
| Gekwalificeerd, Benaderd, In gesprek | Eerste afspraak gepland | Afspraak gepland |
| Afspraak gepland | Eerste afspraak gehouden | Afspraak gehouden |
| Afspraak gepland | Niet verschenen of geannuleerd | In gesprek (opnieuw inplannen) |
| Afspraak gehouden | Overgedragen | Overgedragen |
| Afspraak gehouden | Geen vervolg (nee met reden) | Verloren |
| Elke fase in Bewerken | Geparkeerd (laatste poging zonder reactie) | Geparkeerd |
| Geparkeerd, Verloren | Heropvolging (terugkomdatum of nieuwe aanleiding) | Gekwalificeerd |

Gebeurtenissencatalogus (vast; alleen gebeurtenissen die de app echt meldt zijn kiesbaar): `lead-overgenomen`, `import`, `dossier-compleet`, `gekwalificeerd`, `eerste-contact`, `gesprek-gevoerd`, `eerste-afspraak-gepland`, `eerste-afspraak-gehouden`, `afspraak-niet-verschenen`, `overgedragen`, `geen-vervolg`, `geparkeerd`, `heropvolging`, `handmatig`. Elke gebeurtenis heeft een vaste melder in de code (tabel in het technische deel).

Startactiviteiten per fase en rol (startset, vuren bij "fase betreden"):

| Fase | Binnendienst | Buitendienst |
|---|---|---|
| Gevonden | Dossier controleren (taak, 2 werkdagen) | idem |
| Dossier compleet | Kwalificeren met BAND-vragen in een belblok | Kwalificeren bij bezoek in de regio als het account in een regiodag valt |
| Gekwalificeerd | Eerste belpoging met het script "Koude acquisitie beslisser" | Kans langs de route op de volgende regiodag, anders een belpoging |
| Benaderd | Opvolgpoging volgens het hercontactritme | idem |
| Afspraak gepland | Briefing maken en afspraak bevestigen (mail) | Pitstop klaarzetten op de dag van het bezoek |
| Afspraak gehouden | Overdracht klaarzetten als de binnendienst de afspraak maakte | Afspraak afronden met verslag en overdragen binnen 24 uur |
| Geparkeerd | Geen; terugkomtaak op de terugkomdatum | idem |

**Maatwerkreis per doelgroep**

Een expert of salesmanager maakt een eigen reis, bijvoorbeeld "Installatiebedrijven Brabant" met een fase "Werkbezoek op project" of "Groothandel" met een fase "Proeforder".

1. Klik in `/reizen` op "+ Nieuwe reis". Kies "Vanuit de standaardreis", "Vanuit een bestaande reis" of "Leeg".
2. Tabblad **Doelgroep**: kies een bestaande doelgroep of maak er een (branches, omvang of klassen, gebieden, bron, eigen-veldfilters, uitsluitingen). Een live teller toont "214 accounts vallen in deze doelgroep, waarvan 37 al in een andere reis". Bij overlap met een andere doelgroep kies je de prioriteit.
3. Tabblad **Fases**: fasekaarten zoals in DealDrive (volgnummer, naam, kleur met voorbeeldpil, omschrijving, Pitstop-accent in een geel blok), aangevuld met hoofdfase (verplicht), verwacht verblijf in dagen, markering "Instapfase" en "Eindfase overgedragen" of "Eindfase verloren". Knoppen ↑ ↓ en ×. "+ Fase" voegt achteraan toe.
4. Tabblad **Overgangen**: rijen "vanuit fase + gebeurtenis → naar fase", optioneel met een voorwaarde (klasse, kanaal, rol). "+ Overgang".
5. Tabblad **Activiteiten**: per fase en per rol de startactiviteiten (actiesoort, belscript, termijn, uitvoerder) en de standaardactiviteiten met verwacht resultaat. Dit zijn regels van de motor met patroon "fase betreden", gebonden aan deze reis.
6. Tabblad **Ritme**: optioneel een eigen hercontactritme of belmatrix voor deze reis; leeg betekent de instellingen van de organisatie.
7. Tabblad **Stroom**: de reis als diagram (kolommen per hoofdfase, fases als blokken, overgangen als pijlen met gebeurtenislabel), met waarschuwingen in rood.
8. Knop **"Controleer"** toont de validatie; knop **"Droogloop"** laat zien hoeveel accounts in welke fase belanden en hoeveel taken de startactiviteiten bij publicatie maken.
9. Knop **"Publiceer"** (geel). Een expert-accountmanager kan alleen "Vraag publicatie aan" (wordt een taak voor de salesmanager); de salesmanager publiceert.

**Versies en wijzigen van een actieve reis**

- Elke wijziging aan een actieve reis gaat in een conceptversie; de actieve versie blijft lopen.
- Publiceren maakt een nieuwe versie. Als fases veranderd zijn, toont Dealtrace een **fasemapping**: per oude fase de nieuwe fase, met het aantal accounts. Pas na bevestigen worden accounts omgezet (met auditregel en reisgeschiedenis).
- "Draai terug" maakt de vorige versie weer actief voor nieuwe accounts; accounts die al in de nieuwe versie staan krijgen weer een mapping.
- Vergelijken van versies in Analyse (F20) vraagt minimaal 20 accounts per versie.

**Validatie (anders dan DealDrive, waar bijna alles mag)**

- Naam verplicht, uniek binnen de reis; geen overgang naar dezelfde fase.
- Minstens één instapfase, één eindfase overgedragen en één eindfase verloren.
- Waarschuwing "Fase onbereikbaar" (geen overgang ernaartoe en geen instapfase) en "Doodlopende fase" (geen uitgaande overgang en geen eindfase); publiceren kan pas als beide opgelost zijn.
- Informatie "Gebeurtenis zonder overgang" per fase.
- Fase verwijderen vraagt een vervangende fase; regels, overgangen en accounts worden echt omgezet. Nooit meer een kaal technisch id op een kaart.
- "Standaard terugzetten" werkt per reis en zet fases, accenten, overgangen en startactiviteiten samen terug, met een tekst die zegt wat verloren gaat.

**Toewijzing van accounts aan een reis**

1. Bij binnenkomst (overname, import, CRM-synchronisatie) bepaalt `kiesReis(account, doelgroepen)` de reis: de eerste actieve doelgroep in prioriteitsvolgorde waarin het account past.
2. Past het in geen enkele doelgroep, dan komt het in de standaardreis.
3. Handmatig verplaatsen per account of in bulk kan met een reden (Gevorderd voor eigen accounts, salesmanager voor alle).
4. Een afgeronde reis bewaart de laatste fase en historie; heropvolging start een nieuwe inschrijving, geen overschrijving.

**Op de accountkaart**

Onder de bedrijfsnaam een stuurstrip met "Laatste actie", "Laatste call", "Laatste bezoek", "Reis" (naam) en de fasepil in de kleur van de fase, de statuspil en "12 dagen in fase" (oranje als het verwachte verblijf overschreden is). Klik op de fasepil opent de reisgeschiedenis. Knop "Fase corrigeren" (Gevorderd) vraagt fase en reden en meldt gebeurtenis `handmatig`.

**Uit het verkoopverhaal (F25).** Een doelgroep kiest een of meer branches uit het leesmodel (primair eerst) en beantwoordt bij aanmaken "Past deze doelgroep bij onze ambitie?" (ja, deels, nee) met de ambitiezin erbij. Elke SalesDNA-fase koppelt aan een hoofdfase van de reis (`vv_fasen.reis_hoofdfase`); de winpunten van die fase verschijnen in de reisfase. SalesDNA-fases na de eerste afspraak (soort offerte en klantrelatie) koppelen aan de hoofdfase Overgedragen: hun winpunten staan op `/richting` en in de overdrachtsbriefing, maar Dealtrace bewerkt ze niet (B17). Sjablonen "Overstappers van <concurrent>" en "Niets doen" voor slapende prospects.

#### Technisch

**Datamodel**

```ts
doelgroepen: id, organisation_id, naam, status ('concept'|'actief'|'gearchiveerd'), prioriteit int, versie int, data jsonb
  data: omschrijving, sbi[], klassen[], omvang {min, max}, gebiedIds[], postcodes[], bron ('koud'|'warm'|'referral'|'winback'),
        eigenVeldFilters [{sleutel, vergelijking, waarde}], uitsluitingen {segmenten[], tags[]}, geschatteOmvang
reistemplates: id, organisation_id, naam, doelgroep_id (null = standaardreis), versie int,
               status ('concept'|'actief'|'gepauzeerd'|'gearchiveerd'), is_standaard boolean,
               bron {reisId?, versie?}, eigenaar_id, data jsonb
  data: fases [{id, hoofdfase, label, omschrijving, volgorde, kleur, accent, verwachtVerblijfDagen?, instap?, eind?: 'overgedragen'|'verloren'}],
        overgangen [{id, vanFaseId, gebeurtenis, naarFaseId, voorwaarde?, prioriteit}],
        overschrijvingen {hercontactRitmeId?, belmatrix?, afspraakmatrix?}
activiteitstemplates: id, organisation_id, reistemplate_id, fase_id, versie int, data jsonb
  data: naam, rol ('binnendienst'|'buitendienst'|'alle'), actiesoort, belscriptId?, termijnWerkdagen, uitvoerder,
        waarom {bron: 'golden_circle'|'winpunt'|'belofte', ref}, verwachtResultaat {omschrijving, maat, drempel},
        benodigdeInput[], kostenCent, standaardDuurMin
prospectreizen: id, organisation_id, reistemplate_id, template_versie int, account_id, fase_id, nb_status,
                fase_sinds, gestart_op, afgerond_op, data jsonb
reisgeschiedenis: id, organisation_id, account_id, prospectreis_id, versie, van_fase_id, naar_fase_id,
                  gebeurtenis, door (gebruiker of 'motor'), op, reden
```

- `accounts.reis_id`, `accounts.fase_id`, `accounts.nb_status`, `accounts.fase_sinds` als kolommen (er wordt op gefilterd en geteld).
- `activity_rules.reis_id` en `activity_rules.fase_id` (null betekent alle reizen of alle fases).
- De standaardreis wordt bij het aanmaken van een organisatie als echte rij aangemaakt (`is_standaard true`); nooit alleen in code.

**Pure functies (`shared/reis.ts`)**

- `kiesReis(account, doelgroepen)`: eerste passende actieve doelgroep op prioriteit, anders standaardreis.
- `pastInDoelgroep(account, doelgroep)`: alle filters, inclusief eigen velden en gebieden.
- `volgendeFase(template, faseId, gebeurtenis, context)`: overgang met de hoogste prioriteit waarvan de voorwaarde klopt; hoogstens één wissel per gebeurtenis.
- `valideerReis(template)`: geeft `{fouten[], waarschuwingen[], informatie[]}` (onbereikbaar, doodlopend, ontbrekende instap- of eindfase).
- `faseMapping(oud, nieuw)`: voorstel op gelijke id, anders gelijke hoofdfase en positie.
- `droogloop(template, accounts, regels)`: aantallen per fase en verwachte taken.

**Meldpunt voor gebeurtenissen**

`POST /api/reis/gebeurtenis {accountId, gebeurtenis, reden?}` is de enige plek waar fases veranderen. Melders:

| Gebeurtenis | Gemeld door |
|---|---|
| `lead-overgenomen`, `import` | Leadgenerator en import bij aanmaken van het account |
| `dossier-compleet` | Verrijker wanneer alle criteria een oordeel hebben |
| `gekwalificeerd` | Knop "Kwalificeer" op de kaart of BAND minimaal 3 van 4 |
| `eerste-contact` | Eerste afgeronde poging met uitkomst anders dan geen reactie |
| `gesprek-gevoerd` | Uitkomst "Gesproken" (later, afspraak) |
| `eerste-afspraak-gepland` | Alleen de eerste afspraak met een prospect (volgende afspraken melden niets) |
| `eerste-afspraak-gehouden` | "Rond af" van de eerste afspraak met een uitkomst (F09) |
| `afspraak-niet-verschenen` | Eerste afspraak op status niet verschenen of geannuleerd |
| `overgedragen` | Overdracht naar DealDrive, het CRM of een collega (F17) |
| `geen-vervolg` | Uitkomst zonder vervolg na de eerste afspraak, met reden voor nee |
| `geparkeerd`, `heropvolging` | `hercontact.verwerkUitkomst` en de regel `geparkeerd-terug` of `trigger-heractivatie` |
| `handmatig` | "Fase corrigeren" met verplichte reden |

Na elke gebeurtenis: `volgendeFase`, `volgendeStatus`, reisgeschiedenis, audit, daarna de gebeurtenisregels en startactiviteiten voor dat account (motor, direct).

**Endpoints**

| Route | Doel | Recht |
|---|---|---|
| `GET/POST/PUT /api/doelgroepen` | Doelgroepen | lezen iedereen; schrijven salesmanager, beheerder |
| `GET /api/doelgroepen/:id/telling` | Live telling en overlap | Expert, salesmanager |
| `GET/POST /api/reizen`, `PUT /api/reizen/:id` | Reizen en concepten | lezen Gevorderd; concept Expert; publiceren salesmanager |
| `POST /api/reizen/:id/controleer`, `/droogloop` | Validatie en droogloop | Expert |
| `POST /api/reizen/:id/publiceer {mapping}` | Nieuwe versie met accountmigratie | salesmanager, beheerder |
| `POST /api/reizen/:id/terugdraaien`, `/pauzeer`, `/archiveer`, `/standaard-terug` | Levenscyclus | salesmanager, beheerder |
| `POST /api/reis/gebeurtenis` | Meldpunt | iedere gebruiker voor eigen handelingen; motor |
| `POST /api/accounts/:id/verplaats-reis` | Handmatig verplaatsen | Gevorderd (eigen), salesmanager |

**AI**

Het Pitstop-accent van de fase gaat mee in elke voorbereiding (belscript-invulling, briefing, mailconcept). Optioneel (Expert): "Stel fases voor" maakt uit de doelgroep, het verkoopproces en de winpunten een conceptreis (schema volgens `reistemplates.data`), altijd als concept.

**Acceptatiecriteria**

- Een nieuwe organisatie heeft een werkende standaardreis; een overgenomen lead staat direct in "Gevonden" en krijgt de startactiviteit.
- Elke fase van de standaardreis is via een echte gebeurtenis bereikbaar (test per overgang).
- Een maatwerkreis met een onbereikbare fase kan niet worden gepubliceerd; de melding noemt de fase.
- Publiceren van een versie met een verwijderde fase vraagt een mapping en zet 100 procent van de accounts om; geen account houdt een onbekend fase-id.
- Een account past in twee doelgroepen; het komt in de reis van de doelgroep met de hoogste prioriteit.
- Een Beginner ziet geen menu-item Prospectreizen; een Expert-accountmanager kan een concept maken maar niet publiceren.
- "Standaard terugzetten" zet fases, overgangen, accenten en startactiviteiten van die reis terug en laat andere reizen ongemoeid.

**Hergebruik uit DealDrive**

`server/utils/journeyEngine.ts` (doorschuiven, audit), `useCustomerJourney.ts`, de editor `instellingen/customer-journey.vue` (fasekaarten, overgangsrijen, kleurkeuze, accent), de koppeling `journeyStageId` in de regels en het Pitstop-accent in `agentExecutor.ts`. Aanpassen: reis als object met versie, hoofdfase, validatie, mapping en instap bij binnenkomst.


---

### F06 Acties: taken en inzichten

#### Functioneel

**Kern.** Inzichten en taken zijn één keten: **inzicht** (er gebeurt iets bij een account, met bewijs) → **goedkeuring** (de knop "Maak taak") → **taak** (werk met vervaldatum, eigenaar en herkomst) → **uitvoering** (de mens belt, mailt of bezoekt, eventueel met een AI-concept) → **uitkomst** (die de reis, het ritme en de rapportage voedt). Regels met activiteit "taak" slaan de goedkeuring over voor gepland werk (een ritmepoging, een kwartaalbezoek).

| Wie | Wat | Niveau |
|---|---|---|
| Accountmanager | Eigen taken in een lijst (achterstallig, vandaag, morgen, deze week, later), afronden met uitkomst, uitstellen, nieuwe taak met minimale velden, inzicht lezen en "Maak taak" | Beginner |
| Accountmanager | Horizonweergave, alle filters, herhaling, herinnering, contextmenu en vegen, "Afronden en volgende", inzichten bewerken en afwijzen met reden, bulkacties | Gevorderd |
| Accountmanager | Eigen taaksjablonen, persoonlijke automatische voorbereiding | Expert |
| Salesmanager | Teamweergave met filter per persoon, achterstand per persoon, acceptatiegraad van inzichten per regel | rol |

**Routes**: `/acties` met tabbladen "Taken" en "Inzichten" (één menu-item "Acties"; Inzichten heeft vanaf Gevorderd ook een eigen ingang `/inzichten`).

**Taken**

- Kop: kicker "ACTIES", titel die telt ("12 taken vandaag, 3 over tijd." of "Niets te doen."), rode subtitel bij achterstand. Knoppen "+ Taak" (geel), "+ Afspraak", "Weergave" (Lijst, Horizon), "Filters".
- Statkaarten (klikbaar als filter): "Vandaag", "Komende 7 dagen", "Achterstallig", "Alles open".
- **Lijst**: groepen "Achterstallig", "Vandaag", "Morgen", "Deze week", "Later", "Geen vervaldatum". Taakkaart: afvinkknop, actiesoortlabel, prioriteit, herkomstlabel ("Uit regel", "Uit inzicht", "Campagne", "Ritme", "Handmatig"), "poging 3 van 5", vervaldatum als tekst ("3 dagen over tijd"), titel, account met fasepil, aanleiding.
- **Horizon** (Gevorderd): kolommen "Vandaag", "Komende week", "Week 2 en 3"; achterstallige taken staan bovenaan in "Vandaag" met rode rand (in DealDrive vielen ze weg).
- **Filters**: Periode, Eigenaar ("Van mij", teamleden voor de salesmanager), Prioriteit, Actiesoort (Bellen, Mailen, LinkedIn, Bezoek, Bericht, Te doen), Herkomst, Campagne, Reis en fase. Zoekterm en filters in de URL.
- **Contextmenu en vegen**: "Afronden", "Uitstellen 1 werkdag", "Uitstellen 1 week", "Open kaart", "Annuleer met reden". Telefoon: veeg links afronden, veeg rechts uitstellen.

**Taakflyout**

- Kop: prioriteitsbolletje, status, titel, account met fasepil, "poging 3 van 5 · LinkedIn · vorige: bellen, geen gehoor (3 okt)".
- Blok **Aanleiding** (geel accent): waarom deze taak, met bron en citaat.
- Blok **Concept** (als er een is): belscript (F08), mailconcept of LinkedIn-bericht met stijlscore, winpunt gemarkeerd, bronnen; knoppen "Keur goed", "Kopieer", "Andere toon", "Maak opnieuw". Na "Keur goed" verschijnt bij mail "Verstuur" (via de SMTP van de organisatie, binnen consent en afkoelperiode) en bij LinkedIn "Open profiel" plus "Gedaan".
- Blok **Klant in context**: score, klasse, laatste uitkomsten, primair contact met bel- en mailknop.
- Blok **Uitkomst**: de knoppen uit 7.3, met datumveld bij "Gesproken, later" en reden bij "Geen interesse".
- Voet: "Afronden" (geel), "Afronden en volgende", iconen "Vraag AI", "Uitstellen", "Bewerken", "Annuleren", "Open kaart".
- Bewerkstand: Klant, Contactpersoon, Titel, Prioriteit, Vervaldatum en tijd, Actiesoort, Toegewezen aan, Aanleiding, Herinnering, Beschrijving, Belscript (bij bellen).

**Nieuwe taak** ("Wat moet er gebeuren?"): Beginner ziet Klant, Titel (minimaal 3 tekens), Actiesoort, Vervaldatum. Gevorderd ziet daarnaast Contactpersoon, Prioriteit, Toegewezen aan, Herhaling (elke werkdag, wekelijks, om de week, maandelijks; maximaal 52; vervolg pas na afronden), Herinnering (5 minuten tot 2 dagen; in-app, e-mail, beide), Beschrijving. Standaard vervaldatum: volgend heel werkuur (9 tot 18, geen weekend of feestdag).

**Inzichten**

- Kop: "Wat speelt er bij je prospects?", schakelaar "Alle", "Prospects", "Klanten".
- Statkaarten: "Nieuw" (24 uur), "Hot" (relevantie 75 of hoger), "Deze week", "Totaal open".
- Feed: kaart met accountbalk, badge "EXTERN" (geel) of "INTERN" (donker), specifieke bron ("KvK-mutatie", "Web: vacatures", "Verslag 1 okt"), ouderdom, relevantie, titel, beschrijving, AI-context, knoppen "+ Maak taak" en "Markeer als gelezen".
- Filters: Gelezen (standaard Ongelezen), Bronnen (Intern, Extern, per specifieke bron), Agent (F14), Periode, Reis en fase.
- **Inzichtflyout**: "Wat is er gebeurd?", "Waarom is dit relevant?" (gemarkeerd als beoordeling), "Bewijs" (citaat met bron, datum, link), "Voorgesteld winpunt", "Voorgestelde taak", "Klant in context"; knoppen "Maak taak" (geel), "Vraag AI", "Bewerken", "Markeer als gelezen", "Wijs af" met reden ("Niet relevant", "Al bekend", "Verkeerd account", "Te oud").

**Regels**

- Statussen inzicht: nieuw, gelezen, omgezet, afgewezen. Bijwerken van een open inzicht door de motor zet hem niet terug op ongelezen.
- "Maak taak" erft titel (voorstel, anders "Volg op: {type} bij {account}"), prioriteit (voorstel, anders Hoog bij relevantie 80 of meer, anders Middel), actiesoort, broninzicht, regel; de taak krijgt het label "Uit inzicht" (niet "AI").
- Statussen taak: open, bezig, klaar, geannuleerd. Annuleren met reden is de standaard; echt verwijderen alleen voor de beheerder.
- **Eén afrondfunctie** `rondTaakAf` voor alle paden (flyout, lijst, belmodus, campagnebord, offline sync): status klaar, uitkomst verplicht bij contacttaken, stuurvelden bijwerken (laatste actie, laatste call bij bellen, laatste bezoek bij bezoek), activiteit loggen, campagne-item bijwerken, `hercontact.verwerkUitkomst`, journeygebeurtenis waar van toepassing.
- Uitstellen houdt het tijdstip en telt vanaf de oude vervaldatum als die in de toekomst ligt.
- Goedkeuringsniveau per gebruiker: een Beginner krijgt motorvoorstellen altijd als inzicht ter goedkeuring, behalve ritmepogingen in een lopend hercontactritme (die zijn al goedgekeurd met de campagne of reis).

#### Technisch

- `tasks` en `signals` als in hoofdstuk 10; `tasks.uitkomst`, `tasks.later_op`, `tasks.data.poging {n, van, kanaal, vorige}`, `tasks.data.herkomst`, `signals.data.agent`, `signals.data.afwijsReden`.
- Pure functies: `rondTaakAf`, `ordenTaken`, `horizon(taken, nu)`, `voorinvullingUitInzicht(inzicht)`, `volgendWerkmoment(nu, feestdagen)`.
- Endpoints: sync op `tasks` en `signals`; `POST /api/tasks/:id/afronden {uitkomst, laterOp?, reden?}`; `POST /api/signals/:id/omzetten`; `POST /api/signals/:id/afwijzen {reden}`; `POST /api/tasks/bulk {ids, actie}`; `POST /api/motor/reminders-sweep` (elke 5 minuten).
- Acceptatie: afronden via elk pad geeft dezelfde stuurvelden, dezelfde activiteitenregel en dezelfde volgende poging; een offline afgeronde poging telt bij synchronisatie één keer; achterstallige taken staan in de horizonweergave; een afgewezen inzicht telt in de rapportage per regel.
- Hergebruik: `taken.vue`, `inzichten.vue`, `TaakFlyout.vue`, `NieuweTaakFlyout.vue`, `InzichtFlyout.vue`, `SignalCard.vue`, `SwipeActions.vue`, `useLongPress.ts`, `useQuickCreateTask.ts`.

---

### F07 Belblokken en belmodus

#### Functioneel

**Kern.** Bellen wordt een vast tijdvak in plaats van iets wat tussendoor gebeurt. Een belblok is een agenda-afspraak met een gevulde bellijst, een gekozen belscript per soort gesprek en een **belmodus** die gesprek na gesprek opent. Dit is het hoofdscherm van de binnendienst.

| Wie | Wat | Niveau |
|---|---|---|
| Binnendienst en buitendienst | Bellijst met Top 5 en "Zelf kiezen", één knop "Zet in mijn agenda", de twee standaard vaste blokken, belmodus met standaardscript, uitkomst per gesprek | Beginner |
| Accountmanager | Top 10 en 15, eigen vaste blokken, soort en plek per blok, script per blok, blokdetail met "Vul aan", herbelregel, eigen blokresultaat | Gevorderd |
| Accountmanager | "Vult zichzelf", verhouding new business en opvolging per blok, scriptvergelijking, statistiek per blok | Expert |
| Salesmanager | Geplande en gehouden blokken per teamlid, bereik en afspraken per blok | rol |

**Route**: `/belblokken`. Ingangen: Vandaag ("Start belblok"), Prospectplanning ("Plan in belblok"), Campagnes ("Verdeel over belblokken"), Leadgenerator (eerste poging).

**Opbouw van de pagina**

1. Kop: kicker "WERK · BELLEN", titel "Een blok is een blok. Wie het vult, kies jij.", knoppen "+ Taak", "+ Afspraak".
2. **Vanuit de bellijst** (links) en **Belblok plannen** (rechts, geel omrand).
   - Bellijst: schakelaar "Top 5", "Top 10", "Top 15", "Zelf kiezen"; maximaal 15 rijen met rangnummer, account, contactpersoon (beslisser of champion eerst), reden ("poging 2 van 5 · vorige: voicemail" of "Aanleiding: nieuwe vestiging Zwolle"), geschatte duur, pil "Urgent", "Kans" of "Opvolging". De kop zegt eerlijk "Bellijst" (geen "vandaag" als de lijst niet op vandaag filtert).
   - Planpaneel: "Advies uit je agenda" (maximaal vijf momenten, vrije gaten en vaste blokken, met externe agendabezetting als die gekoppeld is), "Niet tijdens de lunch" (tijd en duur instelbaar), eigen datum en tijd, plek ("Thuis", "Kantoor", "Onderweg (handsfree)"), rekenblok (gesprekstijd, marge, blok), doorschuifmelding ("4 in dit blok, 2 naar maandag 19 okt 09:00"), "Zet mijn agenda op bezet", "Onderdruk meldingen tijdens het blok", knop "Zet in mijn agenda" (geel).
3. **Vaste belblokken**: kaarten met moment ("Maandag en woensdag 09:00 tot 10:00"), soort ("Koude acquisitie", "Opvolging en ritme", "Gemengd 70/30"), plek, script, schakelaar "Vult zichzelf" of "Ik vul zelf", "Verwijderen", en een uitklapbaar **blokdetail** (gevulde plekken, vulbalk in minuten, gesprekken met reden, "Vul aan").

**De belmodus** (nieuw ten opzichte van DealDrive)

- Opent schermvullend vanuit "Start belblok". Links het **belscript** (F08), midden de **gesprekskaart** (account, contact, nummer als bellink of klik-om-te-bellen via de telefonie-koppeling, aanleiding, laatste uitkomsten, BAND, eigen velden), rechts de **wachtrij** (volgende gesprekken, tijd die nog over is).
- Uitkomstknoppen onderaan: "Gesproken, afspraak", "Gesproken, later", "Geen gehoor", "Voicemail ingesproken", "Poortwachter: terugbellen", "Doorverbonden, nieuw contact", "Verkeerd nummer", "Niet geschikt", "Geen interesse". Elke uitkomst rondt de taak af via `rondTaakAf`, plant de volgende poging en opent het volgende gesprek.
- Bij "Gesproken, afspraak": afspraakblok met meetingsoort, voorgestelde tijden (vrije momenten van de buitendienst in de regio als het een bezoek wordt), collega kiezen. De afspraak landt in de agenda van die collega met briefing ("Afspraak gemaakt door Sanne (binnendienst)").
- Notitieveld per gesprek; antwoorden op scriptvragen worden veldwaarden.
- **Blokresultaat** na het laatste gesprek of bij "Stop blok": gesprekken gevoerd, bereikt (gesproken met iemand), beslisser bereikt, afspraken, terugbelafspraken, gemiddelde duur, tegen de schatting. Knop "Plan resterende in".

**Regels**

- **Rangorde** (één functie voor belblokken, bezoeken en de vuller): open beltaken eerst met `1000 + urgentie × 10 + prioriteit × 20 + score` (urgentie achterstallig 100, vandaag 80, later 50, zonder datum 40; prioriteit urgent 4, hoog 3, middel 2, laag 1); daarna aanvulling zonder beltaak `score + min(20, aanleidingen × 5) + min(15, open taken × 4) + 15 bij hete aanleiding of 5 bij waarschuwing`. Prospects zonder historie doen mee.
- **Soort stuurt de vulling**: een blok "Koude acquisitie" vult uit prospects in reis met status nieuw of gekwalificeerd, prospectplanning (venster open, nog niet benaderd) en campagnes van soort bellen; "Opvolging en ritme" uit lopende hercontactpogingen en eerste afspraken die bevestigd moeten worden; "Gemengd" volgens de ingestelde verhouding. Zo verdringt opvolging nooit het nieuwe werk.
- **Duur per gesprek**: 8 minuten, 12 bij urgent, plus 2 bij score 70 of meer, plus 2 bij meer dan één taak; na 20 gesprekken leert de schatting van de werkelijke gemiddelde duur van de gebruiker.
- **Marge** een kwart van de gesprekstijd, naar boven afgerond op 5 minuten; blokduur gesprekstijd plus marge naar boven afgerond op een half uur, minimaal 30 minuten.
- **Wat niet past** schuift naar het eerstvolgende vaste blok; zonder vast blok blijft het in de bellijst.
- **Vuller** (na elke motorrun, alleen werkdagen): vult vaste blokken met "Vult zichzelf" van vandaag die nog niet voorbij zijn; handmatig ingeplande taken blijven; nooit een tweede afspraak op hetzelfde blok; geen leeg blok; ruimte onder 8 minuten wordt overgeslagen.
- **Herbelregel**: na "Geen gehoor" volgt de poging volgens het hercontactritme van het account; zonder ritme na 2 werkdagen, maximaal 5 pogingen, daarna geparkeerd met terugkomdatum.
- **Bel-me-niet**: een nummer op de bel-me-niet-lijst of een contact met "Bel me niet" komt niet in de lijst.
- **Bezet en stil** werken echt: de afspraak staat als bezet in de gekoppelde agenda, en in-app meldingen worden tijdens het blok vastgehouden tot het einde.
- Standaard vaste blokken voor een nieuwe gebruiker: binnendienst maandag tot en met donderdag 09:00 tot 10:30 "Koude acquisitie" (vult zichzelf) en 14:00 tot 15:00 "Opvolging en ritme"; buitendienst vrijdag 09:00 tot 10:00 "Gemengd" (afspraken voor volgende week).

**Op de telefoon (8.5.4).** Na een `tel:`-oproep vraagt "Hoe ging het?" met vier tegels de uitkomst; de belmodus toont één prospect met de eerste scriptregel groot; Gevorderd krijgt de handsfree belmodus met voorlezen en spraakuitkomst.

**Uit het verkoopverhaal (F25).** Een bezwaar aanklikken klapt het antwoord uit "Als de klant zegt" uit, telt het bezwaar en registreert de concurrent op het account.

#### Technisch

- `users.data.belblokken { blokken: [{id, dagen[], start, minuten, plek, soort, verhouding?, scriptId?, automatisch}], voorkeuren {lunch {start, minuten}} }`, maximaal 20 blokken.
- `belblok_sessies: id, organisation_id, gebruiker_id, afspraak_id, gestart_op, gestopt_op, data {gesprekken[{taskId, accountId, contactId, uitkomst, duurSec, scriptId}], resultaat}`.
- Taken krijgen `data.belblokId` (echte koppeling, geen "binnen een uur van de blokstart").
- Pure functies (`shared/belblokken.ts`): `bouwBellijst`, `schatDuur`, `marge`, `blokduur`, `verdeelOverBlok`, `adviesMomenten(agenda, blokken, nu)`, `vulBlok(soort, kandidaten, verhouding)`.
- Endpoints: `GET|PUT /api/mij/belblokken`, `POST /api/belblokken/plan`, `POST /api/belblokken/:id/start`, `POST /api/belblokken/:id/gesprek {taskId, uitkomst, ...}`, `POST /api/belblokken/:id/stop`, `GET /api/belblokken/resultaten?gebruiker=&periode=`.
- Telefonie (optioneel, Expert): klik-om-te-bellen via de `tel:`-link standaard; koppeling met een telefonieplatform (bijvoorbeeld Voys, Aircall) als latere adapter die gespreksduur en tijdstip terugmeldt.
- Acceptatie: een koud blok wordt alleen met koude kandidaten gevuld; de rangorde is op pagina, belmodus en vuller gelijk; een uitkomst in de belmodus geeft dezelfde vervolgpoging als in de taakflyout; het blokresultaat telt bereik en afspraken correct; een bel-me-niet-nummer verschijnt nooit.
- Hergebruik: `belblokken.vue`, `shared/belblokken.ts`, `useBellijst.ts`, `useBelblokken.ts`, `belblokVuller.ts` met zijn regressietest van 11 gevallen.

---


### F08 Belscript-templates

**Nieuw in Dealtrace (beslissing B5).** In DealDrive schrijft de Pitstop per taak een belscript met AI. Dealtrace maakt daar een beheerd middel van: de salesmanager of beheerder maakt in Instellingen **standaard belscript-templates**, de accountmanager **kiest** het passende script in het belpaneel, en AI vult de variabele delen per account in. Zo bellen beginners met een bewezen opbouw, kan de salesmanager scripts vergelijken op resultaat, en blijft elk gesprek persoonlijk.

#### Functioneel

**Voor wie en op welk niveau**

| Wie | Wat | Niveau |
|---|---|---|
| Accountmanager binnendienst en buitendienst | Script kiezen in het belpaneel, volgen tijdens het gesprek, antwoorden en bezwaren vastleggen | Beginner |
| Accountmanager | Persoonlijke variant maken (kopie van een template met eigen formuleringen) | Gevorderd |
| Accountmanager | Eigen varianten vergelijken op resultaat | Expert |
| Salesmanager | Templates maken, testen, activeren voor teams, resultaten vergelijken | rol salesmanager |
| Beheerder | Alles van de salesmanager voor de hele organisatie, standaardkoppelingen instellen | rol beheerder |
| Founder | Platformsjablonen die elke nieuwe organisatie als startset krijgt | rol founder |

**Waar je het vindt**

- Beheer: Instellingen, sectie "Verkoop", item "Belscripts" (`/instellingen/belscripts`).
- Gebruik: het belpaneel in een belblok (F07), de taakflyout van een beltaak (F06), de bellijst naast bezoeken (F10) en de accountkaart via "Bel" (F03).
- Persoonlijke varianten: profielmenu, "Mijn scripts" (`/instellingen/mijn-scripts`, Gevorderd).

**Opbouw van een script**

Een script bestaat uit blokken in een vaste volgorde. Elk blok heeft een soort, een tekst en per tekstdeel een invulwijze.

| Blok | Doel | Standaardinhoud | Invulwijze |
|---|---|---|---|
| Poortwachter | Langs de receptie of het algemene nummer komen | "Goedemorgen, met {gebruiker.voornaam} van {organisatie.naam}. Ik wil graag {contact.naam} spreken over {aanleiding.kort}. Wie gaat er bij jullie over {onderwerp}?" | vaste tekst met variabelen |
| Opening | Wie ben je en waarom bel je, in 20 seconden | Het waarom uit de golden circle, gevolgd door de aanleiding | vast plus AI-zin |
| Aanleiding | Het haakje voor dit account | Een trigger of inzicht met bron ("Ik zag dat jullie twee monteurs zoeken") | AI uit het dossier en de inzichten, met bron |
| Toestemmingsvraag | Ruimte vragen | "Heb je twee minuten, of bel ik je beter op een ander moment?" | vaste tekst |
| Vragen | Kwalificeren volgens BAND en eigen velden | 3 tot 6 vragen, elk gekoppeld aan een veld (bijvoorbeeld "Hoe regelen jullie dat nu?" naar `band.behoefte`) | vaste vragen; antwoord wordt een veldwaarde |
| Winpunt | Waarom met ons, in één argument met bewijs | Winpunt van de campagne of reisfase, met één klantcase | AI kiest het argument uit de winpunten, mens ziet de bron |
| Bezwaren | Reageren op de bekende bezwaren | Per bezwaar een antwoord en een wedervraag ("We hebben al een leverancier" naar antwoord plus vraag) | vaste antwoorden, AI-aanvulling uit de waarde met bron |
| Afsluiting | Om een concreet vervolg vragen | "Zullen we volgende week dinsdag of donderdag een half uur afspreken?" | vaste tekst, voorgestelde tijden uit de agenda van de buitendienst |
| Voicemail | Een bericht dat teruggebeld wordt | Maximaal 25 seconden: naam, aanleiding, één reden, nummer, "ik mail je ook even" | vaste tekst met variabelen |
| Opvolgmail | Mail na het gesprek of de voicemail | Onderwerp en tekst met de afspraak of de aanleiding | AI-concept in de toon van het verhaal; mens keurt goed |

Een template kan blokken weglaten (bijvoorbeeld geen poortwachter bij een mobiel nummer) en extra vrije blokken hebben ("Referentie noemen", "Demo voorstellen").

**Variabelen**

Variabelen staan tussen accolades en komen uit vaste bronnen. De editor biedt ze aan in een keuzelijst; een onbekende variabele is een fout bij opslaan.

| Groep | Voorbeelden |
|---|---|
| Gebruiker en organisatie | `{gebruiker.voornaam}`, `{gebruiker.telefoon}`, `{organisatie.naam}` |
| Account | `{account.naam}`, `{account.plaats}`, `{account.branche}`, `{account.klasse}` |
| Contact | `{contact.voornaam}`, `{contact.naam}`, `{contact.functie}`, `{contact.rol}` |
| Aanleiding en reis | `{aanleiding.kort}`, `{aanleiding.bron}`, `{reis.fase}`, `{poging.n}`, `{poging.van}`, `{vorige.uitkomst}` |
| Verhaal | `{waarom}`, `{belofte}`, `{winpunt.naam}`, `{argument}`, `{bewijs.klant}` |
| Eigen velden | `{cf.<sleutel>}` voor elk eigen veld van account of contact (F19) |
| Agenda | `{voorstel.tijd1}`, `{voorstel.tijd2}` (vrije momenten van de buitendienst in de regio) |

Een variabele zonder waarde toont in het belpaneel een gele markering "onbekend" en een alternatieve zin (de editor vraagt per variabele een terugvaltekst).

**De pagina Belscripts in Instellingen**

- Kop: kicker "INSTELLINGEN · VERKOOP", titel "Belscripts", subtitel "Standaardscripts die je team kiest in het belpaneel. AI vult per account de aanleiding en het winpunt in." Rechtsboven "+ Nieuw script" (geel) en "Kopieer uit startset".
- Statkaarten (klikbaar als filter): "Actief" (aantal), "Concept", "Gebruikt in 30 dagen" (gesprekken), "Beste conversie" (naam en percentage).
- Filters: Doel (Koude acquisitie, Opvolging, Aanleiding, Winback, Afspraak bevestigen, Anders), Reisfase, Doelgroep, Team, Status (Concept, Actief, Gearchiveerd).
- Tabel met kolommen: "Naam", "Doel", "Reisfase", "Doelgroepen", "Teams", "Versie", "Status", "Gesprekken 30 d", "Naar afspraak", "Laatst gewijzigd". Rij klikken opent de editor.
- Lege staat: "Er zijn nog geen belscripts. Begin met de startset van zes scripts." met de knop "Kopieer uit startset".

**De editor (flyout over de volle hoogte, 760 px breed)**

- Kop: naam (inline bewerkbaar), pil met status en versie, knoppen "Voorbeeld", "Test met een account", "Laat AI een opzet maken".
- Blok "Eigenschappen": Naam (verplicht), Doel (verplicht, keuzelijst), Reisfases (meerkeuze uit de reis van de gekozen doelgroepen), Doelgroepen (meerkeuze of "Alle"), Teams (meerkeuze of "Alle"), Rol van het contact (Beslisser, Beïnvloeder, Gebruiker, Receptie, Onbekend), Kanaal (Telefoon vast, Mobiel), Standaard voor (campagnesoorten en belblokken waarvoor dit script voorgeselecteerd is).
- Blok "Opbouw": de blokken als lijst met sleepgreep, per blok een tekstveld met variabelenknop "{ }", een keuze "Vast", "AI vult aan" of "AI schrijft", en voor vragen een koppeling naar een veld (BAND of eigen veld). Knop "+ Blok".
- Blok "Bezwaren": lijst van bezwaar, antwoord, wedervraag; knop "+ Bezwaar" en "Haal de top 5 bezwaren uit de verslagen" (AI, Expert en salesmanager).
- Rechterkolom "Voorbeeld": het script ingevuld voor een voorbeeldaccount (keuzelijst met accounts uit de doelgroep), met onbekende variabelen geel.
- Onderin: "Annuleren", "Opslaan als concept", "Activeer" (geel). Activeren maakt een nieuwe versie; lopende belblokken houden de versie waarmee ze startten tot het einde van het blok.
- "Archiveren" in het menu van de editor; een gearchiveerd script verdwijnt uit de keuze maar blijft in de rapportage.

**Het script kiezen en gebruiken (belpaneel)**

1. De accountmanager start een belblok of opent een beltaak. Het belpaneel opent met links het script en rechts de accountgegevens (contact, laatste uitkomsten, aanleiding, eigen velden).
2. Bovenaan het script staat de keuzelijst "Script" met het voorgestelde script voorgeselecteerd. De voorselectie volgt deze volgorde: script van de campagne, script van het belblok, script dat past bij doel, reisfase, doelgroep en rol van het contact, persoonlijke variant van de gebruiker van dat script, startscript van de organisatie.
3. De gebruiker kan wisselen. De keuzelijst toont per script de naam, het doel en (vanaf Gevorderd) de conversie "28% naar afspraak". Wisselen wordt gelogd.
4. AI vult bij het openen de blokken "Aanleiding", "Winpunt" en eventuele "AI vult aan"-zinnen in voor dit account en contact (één aanroep per gesprek, gecachet 24 uur per account en scriptversie). Elke AI-zin heeft een bronlink. Zonder AI-credits toont het script de vaste tekst met de terugvalzinnen.
5. Tijdens het gesprek: de vragen zijn afvinkbaar met een kort invulveld; het antwoord wordt direct de waarde van het gekoppelde veld (BAND, eigen veld) met herkomst "belgesprek". Een bezwaar aanklikken klapt het antwoord uit en telt het bezwaar.
6. Afronden: uitkomstknoppen onderaan (7.3). Bij "Gesproken, afspraak" opent het afspraakblok met de voorgestelde tijden; bij "Voicemail ingesproken" staat de voicemailtekst al klaar en wordt de opvolgmail als concept klaargezet.
7. Na afronden: de activiteit wordt gelogd met scriptId, versie, gebruikte blokken, bezwaren en uitkomst; de volgende persoon in de bellijst opent.

**Regels**

- Een actief script heeft minimaal een opening, een afsluiting en een voicemail.
- Een script dat een winpunt noemt, gebruikt een winpunt dat bestaat en actief is; een ingetrokken winpunt maakt het script "Controleren" en geeft een inzicht aan de eigenaar.
- Lengte van de gesproken blokken samen: richtlijn 150 woorden (de editor toont een teller, boven 200 woorden een waarschuwing).
- Persoonlijke varianten erven doel, fases en koppelingen van het origineel; als het origineel een nieuwe versie krijgt, ziet de eigenaar van de variant "Het origineel is gewijzigd" met "Bekijk verschil" en "Neem over".
- Vergelijken vraagt minimaal 30 gesprekken per versie of variant; daaronder toont de rapportage "Te weinig gesprekken om te vergelijken".
- Een beginner ziet alleen actieve scripts van zijn team; geen persoonlijke varianten.

**Startset (platformsjablonen)**

| Script | Doel | Kern |
|---|---|---|
| Koude acquisitie beslisser | Koude acquisitie | Opening met waarom, aanleiding, één vraag, winpunt, afsluiting met twee tijden |
| Langs de receptie | Koude acquisitie | Poortwachterblok, naam van de juiste persoon vragen, terugbelmoment afspreken |
| Opvolging na mail of LinkedIn | Opvolging | Verwijzen naar het eerdere bericht, één vraag, afspraak |
| Bellen met een aanleiding | Aanleiding | Trigger als opening (vacature, verhuizing, jubileum, nieuwe directeur), winpunt dat erbij past |
| Ex-klant terugwinnen | Winback | Wat is er veranderd, erkenning van het vertrek, nieuwe reden |

**Uit het verkoopverhaal (F25).** Nieuwe variabelen `{verhaal.kernzin}`, `{verhaal.branche}`, `{visie.kernzin}`, `{belofte.branche}`, `{waarde}`, `{winpunt.naam}`, `{argument}`, `{bewijs.klant}`, `{concurrent.naam}`, `{concurrent.zoZegJeHet}`. Het blok "Opening" gebruikt de kernzin van de branche (terugval algemeen); "Waarom wij" de belofte; "Bezwaren" krijgt per concurrent een bezwaar uit "Als de klant zegt" met `argumentRef` naar de concurrentregel. Validatie bij publiceren: elke verwezen concurrent en elk winpunt bestaat; een script dat een verdwenen winpunt of concurrent noemt, gaat op "Controleren".

#### Technisch

**Datamodel**

```ts
belscripts: id, organisation_id, naam, doel, status ('concept'|'actief'|'gearchiveerd'), versie int,
            eigenaar_id, basis_script_id (null of het origineel bij een persoonlijke variant),
            is_persoonlijk boolean, gebruiker_id (bij persoonlijk), data jsonb
  data: reisfaseIds[], doelgroepIds[] | 'alle', teamIds[] | 'alle', contactRollen[], kanaal,
        standaardVoor { campagnesoorten[], belblokIds[] },
        blokken [{ id, soort, titel, tekst, invulwijze: 'vast'|'ai_aanvullen'|'ai_schrijven',
                   veldKoppeling?: { bron: 'band'|'cf'|'contact'|'account', sleutel }, terugval? }],
        bezwaren [{ id, bezwaar, antwoord, wedervraag, argumentRef? }],
        variabelen[] (afgeleid bij opslaan), opmerking
belscript_versies: id, organisation_id, belscript_id, versie, data jsonb, geactiveerd_op, geactiveerd_door
```

- `activiteiten.data.script = { scriptId, versie, gekozenDoor: 'voorstel'|'gebruiker', gewisseld: boolean, blokkenGebruikt[], bezwaren[], vragenBeantwoord[] }`.
- Afgeleide tabel `nb_script_resultaten` (dagelijkse job): per script, versie en variant het aantal gesprekken, bereikt (gesproken), afspraken, gemiddelde duur, top bezwaren.

**Logica (pure functies in `shared/belscripts.ts`)**

- `kiesScript(context, scripts, gebruiker)`: voorselectie volgens de volgorde in de flow hierboven; geeft `{ scriptId, reden }`.
- `vulScript(script, context)`: vervangt variabelen, markeert onbekende, levert de blokken met invulstatus. Geen AI.
- `valideerScript(script)`: verplichte blokken, bekende variabelen, lengtegrens, bestaande winpunten.
- `scriptVergelijking(resultaten, minimum = 30)`: conversie en betrouwbaarheid per versie of variant.

**Endpoints**

| Methode en route | Doel | Recht |
|---|---|---|
| `GET /api/belscripts` | Lijst met filters | iedere gebruiker (beginner alleen actief en eigen team) |
| `POST /api/belscripts`, `PUT /api/belscripts/:id` | Maken en bewerken | salesmanager, beheerder; persoonlijk: eigenaar vanaf Gevorderd |
| `POST /api/belscripts/:id/activeer` | Nieuwe versie actief | salesmanager, beheerder |
| `POST /api/belscripts/:id/kopie` | Persoonlijke variant | Gevorderd |
| `POST /api/belscripts/:id/archiveer` | Archiveren | salesmanager, beheerder |
| `POST /api/belscripts/invullen` | AI-invulling voor `{scriptId, accountId, contactId}` | iedere gebruiker, binnen de AI-credits |
| `POST /api/belscripts/opzet` | AI-opzet van een nieuw script uit doel, doelgroep, winpunten | salesmanager, beheerder |
| `GET /api/belscripts/resultaten` | Vergelijking per script | salesmanager; eigen varianten vanaf Expert |

**AI-stappen**

| Stap | Invoer | Schema | Vangrails |
|---|---|---|---|
| Invullen per account | script, account, contact, dossier, inzichten (laatste 90 dagen), winpunten, waarde, vorige uitkomsten | `{ blokken: [{blokId, tekst, bronnen[{soort, url?, datum, citaat}]}], gekozenWinpuntId, argumentRef }` | Alleen blokken met `ai_*`; elke zin met bron; geen feiten buiten het materiaal; maximaal 60 woorden per blok; cache 24 uur |
| Opzet maken | doel, doelgroep, reisfase, golden circle, winpunten, top bezwaren | volledig script volgens het datamodel, status concept | Altijd concept; mens activeert |
| Bezwaren ophalen | verslagen van de laatste 90 dagen in de doelgroep | `[{bezwaar, aantal, voorbeeldCitaat, antwoordVoorstel, argumentRef}]` | Antwoord zonder `argumentRef` wordt "geen bron in de waarde" |

Soort in de AI-credits: `belscript`, 1 credit per invulling (11.4).

**Acceptatiecriteria**

- Een beheerder maakt een script met vijf blokken en twee bezwaren, activeert het, en een accountmanager in het gekoppelde team ziet het voorgeselecteerd in een belblok van die doelgroep.
- Een onbekende variabele blokkeert opslaan met de melding welke variabele het is.
- Een gesprek met het script logt scriptId en versie; de rapportage telt het in de juiste versie.
- Een nieuwe versie activeren tijdens een lopend belblok verandert het script in dat blok niet.
- Een Beginner ziet geen knop "Maak persoonlijke variant"; een Gevorderde wel; de variant toont "Het origineel is gewijzigd" na een nieuwe versie van het origineel.
- Zonder AI-sleutel (mock) en zonder credits werkt het script met de vaste teksten en terugvalzinnen.
- Vergelijken onder 30 gesprekken toont "Te weinig gesprekken om te vergelijken".

**Hergebruik uit DealDrive**

`agentExecutor.ts` en `promptBibliotheek.ts` (Pitstop-belscript als basis voor de AI-invulling), `EmailTemplatePicker` en `useEmailTemplates` (patroon voor templatekeuze en variabelen), de instellingenpagina `email-templates.vue` (lijst en editor), `ConfirmDialog`, `EditableField`.

**Buiten scope (nu)**

Spraakherkenning die automatisch het volgende blok kiest; automatisch bellen (dialer); scripts in meerdere talen tegelijk (één taal per script).

---

### F09 Agenda, afspraken en meetings

#### Functioneel

**Kern.** De agenda is waar afspraken landen; Meetings is "wie moet ik spreken", Bezoeken (F10) is "waar moet ik heen". Samen dekken ze elke afspraak precies één keer. Voor new business is de belangrijkste afspraak de **eerste afspraak**: die verandert de status naar gescoord en de fase naar "Eerste afspraak".

| Wie | Wat | Niveau |
|---|---|---|
| Accountmanager | Agenda (dag, week), afspraak plannen met meetingsoort, uitkomst vastleggen na afloop, standaardherinnering | Beginner |
| Accountmanager | "Wie is er aan de beurt?" met vormadvies, herhaling, collega's uitnodigen, afspraak plannen voor een collega (binnendienst voor buitendienst), verslag uploaden | Gevorderd |
| Accountmanager | Eigen agenda-indeling, weekritme per meetingsoort, meeting-analyse | Expert |

**Routes**: `/agenda` (dag, week, maand; met belblokken, regiodagen en conflicten), `/agenda?weergave=meetings` (de lijst "Wie moet ik spreken").

**Meetingsoorten** (startset; een organisatie kan ze aanpassen in Instellingen): "Kennismaking" (30 minuten, online of bezoek, agenda: aanleiding, situatie, behoefte, vervolg), "Inventarisatie" (60 minuten, bezoek), "Demo" (45 minuten), "Belafspraak" (15 minuten), "Terugbelafspraak" (10 minuten), "Weekoverleg new business" (intern, 30 minuten). Elke soort heeft doel, duur, standaardlocatie, agendapunten, voorbereiding en **uitkomsten met gevolg**:

| Soort | Uitkomsten (code: gevolg) |
|---|---|
| Kennismaking, Inventarisatie, Demo (als eerste afspraak) | `vervolg`: "Overdragen?" met DealDrive, het CRM of een collega, plus de afgesproken vervolgstap in de overdracht (F17) · `later`: wachtend tot datum met terugkomtaak · `andere-contactpersoon`: nieuw contact en een nieuwe poging · `geen-vervolg`: nee met reden en terugkomregel |
| Belafspraak, Terugbelafspraak | `afspraak`: eerste afspraak plannen · `later`: wachtend tot datum · `geen-interesse`: nee met reden |

Dealtrace heeft geen meetingsoorten voor offertes of onderhandeling (B17); die afspraken horen in DealDrive of het CRM.

**Plan een afspraak** (flyout, overal dezelfde): Klant, Contactpersoon (beslissers eerst), Meetingsoort (verplicht; vult titel, duur en agenda), Vorm (Bezoek, Online, Telefoon), Datum, Start, Duur, Voor wie (jij of een collega; bij een collega toont de flyout diens vrije momenten en regiodag), Locatie (adres van het account voorgevuld bij bezoek) of meetinglink (Teams of Google Meet via de agendakoppeling), Herinnering (standaard per soort, bijvoorbeeld 15 minuten bij een belafspraak), Aanleiding, Beschrijving. Knop "Plan afspraak". Na opslaan: toast, de afspraakflyout opent, gebeurtenis `eerste-afspraak-gepland` als het de eerste is, en de taak waaruit je plande wordt aan de afspraak gekoppeld en bij afronden gesloten.

**Afspraakflyout**: kicker met soort en status ("KENNISMAKING · GEPLAND"), wanneer, wie, locatie of link, "Klant in context", "Wie zit erbij" (buying committee), "Doel en agenda" (agendapunten van de soort), "Pitstop" (F11), "Verslag". Na afloop: **"Rond af"** (geel) opent één venster met uitkomst (knoppen van de soort), verslag (typen, plakken, inspreken of bestand), per agendapunt "besproken" of "niet besproken" (voorgevuld door de Notulist), volgende stap (voorgesteld uit het gevolg van de uitkomst). Eén handeling zet status, stuurvelden, gevolg, verslag en taken.

**Wie is er aan de beurt?** (Gevorderd): maximaal acht voorstellen uit de ritmes (belmatrix, afspraakmatrix met regiodag) én voor new business: "Eerste gesprek nog niet ingepland" (prospect met contact en positieve uitkomst maar zonder afspraak), "No-show opnieuw inplannen". Per voorstel een vormadvies ("Belafspraak", "Online", "Fysiek · dinsdag Regio Oost", "Taak in belblok") en één knop.

**Regels**: een afspraak met status "niet verschenen" of "geannuleerd" geeft een inzicht "Gat in je agenda" met drie vervangende kansen (F10); intern overleg telt nooit als klantcontact; "eerste afspraak" is alleen de eerste niet-geannuleerde afspraak met dat account.

**Uit het verkoopverhaal (F25).** De Notulist herkent concurrentnamen in verslagen en zet ze als signaal op het account; bezwaren worden per concurrent geteld.

**Op de telefoon (8.5.3).** Bezoek afronden met inspreken als standaard, foto's en "Scan visitekaartje"; een pushmelding 15 minuten na een afspraak zonder verslag.

#### Technisch

- `appointments` met `meetingsoort_id`, `uitkomst_code`, `uitkomst_op`, `owner_id`, `gepland_door`, `data { agenda[], verslag {tekst, bron, perAgendapunt[], openVragen[], voorgesteldeUitkomst}, herinnering, externalIds {google?, outlook?} }`.
- `meetingsoorten: id, organisation_id, slug, naam, type ('klant'|'intern'), duur_min, vorm, data {doel, agenda[{punt, verplicht}], voorbereiding[], uitkomsten [{code, label, gevolg {type, meetingsoortId?, termijnDagen?, faseId?, overdragen?}}]}`.
- Pure functie `meetingUitkomst(afspraak, soort, code)` geeft de mutaties (afspraak, taak, gebeurtenis, status, overdracht).
- Agendakoppeling (Gevorderd, beheerder schakelt in): Microsoft 365 en Google via OAuth, lezen van bezetting voor adviezen en schrijven van afspraken en belblokken; tokens versleuteld per gebruiker.
- Endpoints: sync op `appointments`; `POST /api/afspraken/:id/afronden {uitkomst, verslag, agendapunten}`; `GET /api/agenda?van=&tot=&gebruiker=`; `GET /api/agenda/vrij?gebruiker=&regio=`.
- Acceptatie: de uitkomst "vervolg" na een eerste afspraak meldt `eerste-afspraak-gehouden` en vraagt "Overdragen?"; een afspraak die de binnendienst voor de buitendienst plant staat in diens agenda met briefing; de tweede afspraak met een account meldt geen `eerste-afspraak-gepland`.
- Hergebruik: `agenda.vue`, `AfspraakFlyout.vue`, `NieuweAfspraakFlyout.vue`, `AfspraakAnalyseFlyout.vue`, `useAfspraakDetail.ts`, `useNieuweAfspraak.ts`.

---

### F10 Bezoeken en kansen langs de route

**Beslissing B9.** In DealDrive staat op `/bezoeken` onder de route, de bellijst en de bezoeklijst een blok "Kansen langs de route": accounts binnen 30 km van je bezoeken met een open bezoektaak of een hete aanleiding, gerangschikt met `score + 100 (bezoektaak) + 20 (hete aanleiding) − afstand in km`, maximaal vier, met de knop "+ Tussenstop". Dealtrace maakt hier het **hoofdblok** van het dagscherm van de buitendienst van, met echte afstanden, meer bronnen en een samenwerking met de binnendienst.

#### Functioneel

**Kern.** "Waar moet ik vandaag heen, en wie neem ik onderweg mee?" De motor weet wie bezocht of gebeld moet worden, de agenda weet waar je bent, de gebiedsindeling weet welke regio vandaag aan de beurt is. Bezoeken legt die drie over elkaar en maakt van elke rijdag een prospectiedag.

| Wie | Wat | Niveau |
|---|---|---|
| Buitendienst | Route van vandaag met kaart, volgend bezoek, Pitstop per bezoek, bezoek afronden met verslag en uitkomst, bellen en navigeren per stop, kansen langs de route bekijken met "+ Tussenstop" | Beginner |
| Buitendienst | Periodefilter, te plannen bezoeken, bellijst naast bezoeken (Top 5, 10), kansen met alle acties en filters, inloopbezoek vastleggen | Gevorderd |
| Buitendienst | Start- en eindadres, regiodag kiezen, eigen kansbronnen en straal, laag "ongeplande prospects in dit gebied", routeoptimalisatie | Expert |
| Binnendienst | Een prospect of kans "klaarzetten voor de buitendienst" op een regiodag van een collega | Gevorderd |
| Salesmanager | Teamkaart, kansen getoond en omgezet per persoon, kilometers per bezoek, aandeel new business-bezoeken | rol |

**Route**: `/bezoeken`. Op de telefoon een tab "Onderweg".

**Opbouw van de pagina**

1. **Kop**: kicker "BEZOEKEN · VANDAAG · REGIO OOST", titel naar aantal ("3 bezoeken op de planning."), knoppen "+ Bezoek", "Filters" (periode), "Agenda". Rechts de dagstatistiek: "Bezoeken 3 · Klantcontact 3u 30 · Rijtijd 1u 50 · 142 km".
2. **Kaart en route** (twee kolommen): kaart met genummerde stops op adres (echte geocodering), de route als lijn, startpunt (thuis of kantoor) en eindpunt, volgend bezoek rood pulserend, kansen als gele punten. Rechts de routelijst per dag: tijd en duur, "VOLGENDE", soort, account, contact, adres, reistijd naar de volgende stop, knoppen "Navigeer" (Google Maps of Waze), "Bel", "Pitstop".
3. **Kansen langs de route** (hoofdblok, direct onder of naast de route):
   - Kop "KANSEN LANGS DE ROUTE · 9", titel "Prospects en kansen vlak bij je bezoeken", filters (Bron, Klasse, "Alleen mijn accounts" standaard aan, "Alleen prospects" standaard aan, Maximale omrijtijd 10, 20, 30 minuten, Aantal 4, 10, alles), schakelaar "Toon ook ongeplande prospects in dit gebied".
   - Per kans: rangnummer, naam met klasse- en fasepil, **bron** ("Open bezoektaak", "Hete aanleiding: vacature monteur (Indeed, 9 okt)", "Bezoekritme achter: klasse A, 120 dagen niet geweest", "Klaargezet door Sanne (binnendienst)", "Ongeplande prospect in doelgroep Bouw"), **afstand en omrijtijd** ("12 min omrijden, tussen stop 2 en 3"), **beste moment** ("45 min vrij tussen 11:30 en 13:00"), primair contact met rol, laatste contact, de **scoreopbouw** bij hover ("bezoektaak +100 · hete aanleiding +20 · 12 min omrijden −12").
   - Acties per kans: "+ Tussenstop" (geel), "Eerst bellen", "Inloopbezoek", "Overslaan" (met reden; de kans komt een week niet terug), "Navigeer".
4. **Bellijst naast je bezoeken** (Gevorderd): Top 5 of Top 10 voor reistijd en lege momenten, zonder de accounts die je vandaag bezoekt; variant "Bellen voor morgen": prospects in de regio van morgen om er een tussenstop van te maken.
5. **Te plannen bezoeken**: open bezoektaken (ritme, regel, handmatig, uit de binnendienst), oudste eerst, met "+ Plan bezoek" (de taak wordt aan de afspraak gekoppeld en sluit bij afronden).
6. **Bezoek afronden** (vanuit de route of de afspraakflyout): één scherm met uitkomst (knoppen van de meetingsoort), verslag inspreken of typen, nieuwe contactpersoon, volgende stap; werkt offline.

**Kansen: bronnen en score**

| Bron | Gewicht (standaard, instelbaar) | Voorwaarde |
|---|---|---|
| Open bezoektaak van jou | +100 | elke open bezoektaak, niet alleen de top acht |
| Klaargezet door de binnendienst voor deze dag of regio | +90 | |
| Hete aanleiding (trigger) in de laatste 30 dagen | +20 tot +40 naar relevantie | |
| Bezoekritme achter volgens de afspraakmatrix | +1 per dag achter, maximaal +30 | klasse bekend |
| Ongeplande prospect in een actieve doelgroep (laag aan) | +10 | status nieuw of in reis, geen afkoelperiode op bezoek |
| Basisscore van het account | 0 tot 100 | F03 |
| Omrijkosten | −1 per minuut extra reistijd | omrijtijd ten opzichte van de bestaande route |
| Past in een vrij moment | +10 | gat van minstens 30 minuten plus reistijd |

`kansscore = basisscore + bronGewichten + tijdslotBonus − omrijMinuten`. Uitgesloten: accounts die al in de route zitten, accounts met status nee of afkoelperiode op bezoek, accounts van collega's (tenzij uitgezet), accounts met "Overslaan" in de afgelopen 7 dagen.

**Geografie**

- Elk account krijgt bij aanmaken, import en adreswijziging een coördinaat: adres, anders postcode, anders plaats; de herkomst wordt opgeslagen en getoond ("op postcode").
- Omrijtijd via een routedienst (bijvoorbeeld OpenRouteService of de Google Routes API, keuze in hoofdstuk 22); als terugval hemelsbreed maal 1,3 bij 60 km per uur, zichtbaar als "schatting".
- Start- en eindpunt per gebruiker (thuisadres of kantoor), per dag aan te passen.
- Straal alternatief: binnen X minuten van de lijn tussen twee stops ("langs de route") in plaats van rond een plaats.

**Klikpaden**

1. Een tussenstop toevoegen: klik "+ Tussenstop" bij een kans. De flyout "Plan een afspraak in" opent met klant, contact, meetingsoort "Kennismaking" (of "Inloopbezoek"), datum vandaag, start in het voorgestelde gat, duur 30 minuten en titel uit de bron. "Plan afspraak" zet hem in de route op de juiste plek; de kaart en de reistijden worden herberekend; de bezoektaak wordt gekoppeld.
2. Eerst bellen: "Eerst bellen" opent de belmodus voor één gesprek met het script "Bellen met een aanleiding"; bij "Gesproken, afspraak" landt de afspraak direct in het gat.
3. Inloopbezoek: "Inloopbezoek" legt achteraf vast: soort "Ongepland bezoek", tijd nu, uitkomst, verslag inspreken, eventueel nieuw contact; telt als bezoek.
4. Binnendienst zet klaar: op de prospectkaart of in de bellijst kiest de binnendienst "Klaarzetten voor buitendienst", kiest een collega en een regiodag (of "eerstvolgende in deze regio") en schrijft een korte reden; de kans verschijnt bij die collega met de bron "Klaargezet door Sanne".

**Regels**

- Standaardscope is altijd "mijn" (route, kansen, bellijst); de salesmanager heeft een teamschakelaar.
- De bellijst sluit alleen accounts uit met een bezoek op dezelfde dag (in DealDrive viel bij een langere periode iedereen weg).
- De regiodag van de gebruiker (F18) filtert kansen en te plannen bezoeken op de regio van die dag; een kans buiten de regio verschijnt alleen als hij binnen de maximale omrijtijd ligt.
- Een uitgevallen afspraak geeft het inzicht "Gat in je agenda" met de top drie kansen rond die plek en de knop "Plan vervangend bezoek".

**Op de telefoon (8.5.2).** De route heet op de telefoon "Route" (`/onderweg`): volgende stop groot met "Navigeer", tijdlijn met kansen als gele tussenrij, "In de buurt" en "+ Inloop". Vertrek- en briefingmeldingen per afspraak (8.10).

**Uit het verkoopverhaal (F25).** Kansen en regiodagen kunnen filteren op branche; een terugkomregel met kanaal bezoek plant op de eerstvolgende regiodag in de regio van het account.

#### Technisch

- `accounts.lat`, `accounts.lng`, `accounts.data.geo {bron: 'adres'|'postcode'|'plaats', op}`; `users.data.thuisbasis {adres, lat, lng}`.
- `kans_overslaan: organisation_id, gebruiker_id, account_id, tot, reden`.
- `klaargezet_voor: id, organisation_id, account_id, van_gebruiker, voor_gebruiker, regio_id?, datum?, reden, status ('open'|'ingepland'|'vervallen')`.
- Pure functies (`shared/route.ts`): `geocodeerTerugval(account, postcodetabel, plaatsentabel)`, `afstandKm(a, b)` (haversine), `omrijMinuten(route, kandidaat, reistijden)`, `vrijeMomenten(route, agenda)`, `kansScore(account, bronnen, omrij, tijdslot, gewichten)`, `kansenLangsRoute(route, kandidaten, instellingen)`.
- Adapter `server/utils/routedienst.ts` met `reistijdMatrix(punten)` en `route(punten)`, een cache per paar punten (7 dagen) en een mock.
- Endpoints: `GET /api/bezoeken?datum=&periode=` (route, statistiek, kansen, bellijst, te plannen), `POST /api/kansen/:accountId/overslaan`, `POST /api/accounts/:id/klaarzetten {voorGebruiker, regioId?, datum?, reden}`, `POST /api/afspraken/inloop`.
- Prestatiebudget: kansenberekening voor 600 accounts en 6 stops onder 800 ms (voorselectie op hemelsbrede afstand, dan routedienst voor de top 30).
- Acceptatie: een account met een open bezoektaak op 8 minuten omrijden staat boven een account met een hete aanleiding op 25 minuten; "+ Tussenstop" plant in het voorgestelde gat en herberekent de route; een account van een collega verschijnt niet tenzij de filter uitstaat; een kans met "Overslaan" komt 7 dagen niet terug; zonder routedienst werkt alles met de schatting en het label "schatting".
- Hergebruik: `route.vue`, `RouteList.vue`, `MiniMap.vue`, `useGeoNL.ts` (plaatsenregister als terugval), de kansformule en het "Gat in je agenda"-inzicht uit DealDrive.

---

### F11 Briefings en Pitstop

#### Functioneel

**Kern.** Drie lagen voorbereiding: de **briefing** (regels, gratis, altijd beschikbaar), de **Pitstop** (AI-concept op een taak of afspraak, ter goedkeuring) en de **verslaganalyse** (grondstof voor de volgende briefing). Een briefing maak je niet aan; hij verschijnt omdat er een afspraak of taak is.

| Wie | Wat | Niveau |
|---|---|---|
| Accountmanager | Snelle briefing vanuit afspraak of taak met automatisch gekozen soort; na het gesprek "doel gehaald" en volgende stap | Beginner |
| Accountmanager | Overzicht met filters, soortkiezer, eigen tekst per blok, volledige printbare briefing, Pitstop opnieuw maken | Gevorderd |
| Accountmanager | Soort vastzetten per gesprek, eigen briefingsoort | Expert |

**Soorten voor new business**

| Soort | Wanneer (automatische keuze) | Blokken |
|---|---|---|
| Eerste gesprek | nog geen gesprek met een beslisser | Bedrijf in drie zinnen · Waarom nu (aanleiding met bron) · Wie zit er tegenover je (rol, wat je weet) · Wie ontbreekt nog (buying committee) · Openingsvraag (golden circle en aanleiding) · Winpunt en één bewijs · Doel van dit gesprek |
| Behoefte, probleem, oplossing | 1 of 2 gesprekken gevoerd | Pijnpunt (uit het vorige verslag) · Huidige situatie · Gewenste situatie · Onze oplossing en winpunt · Te verwachten bezwaren met antwoord · Doel |
| Verdieping | 3 of meer gesprekken of fase In gesprek | Samenvatting vorige gesprekken · BAND met wat er ontbreekt · Stakeholders · Vergelijkingscriteria · Doel |
| Overdracht | eerste afspraak gehouden met vervolg | Wie het account is en waarom nu · Wat er in het eerste gesprek is gezegd (verslag) · Buying committee en BAND · Afgesproken vervolgstap en datum · Bezwaren en concurrent · Winpunt dat aansloeg · Reisgeschiedenis in vijf regels |
| Bezoek (buitendienst) | meetingsoort met vorm bezoek | Als eerste gesprek plus: adres, parkeren, wie je bij de receptie vraagt, wat je meeneemt |

De soort volgt eerst de meetingsoort, dan de fase in de reis, dan het aantal gesprekken; een gebruiker kan hem vastzetten (Expert).

**Opbouw**: per blok een herkomstlabel ("Berekend", "Door AI geschreven", "Eigen tekst") met de volgorde eigen tekst wint van AI, AI van berekend; eigen tekst wordt per gesprek bewaard. Na het gesprek vraagt de briefing "Doel gehaald?" (Ja, Deels, Nee) en "Volgende stap", wat de coaching voedt (F20).

**Pitstop** (op taak en afspraak): knop "Bereid voor" maakt het concept dat bij de actiesoort past (belscript via het gekozen template F08, mailconcept, LinkedIn-bericht, bezoekbriefing) met het Pitstop-accent van de fase, het winpunt, de top drie bezwaren uit de waarde en de open vragen uit het vorige verslag. Statussen: wacht, bezig, klaar ter goedkeuring, goedgekeurd, mislukt. Tekst onder het concept: "De agent voert niets uit. Jij keurt goed en belt, mailt of bezoekt zelf." Automatisch voorbereiden per regel (maximaal 10 per motorrun) staat in F15.

**Uit het verkoopverhaal (F25).** Briefing "Eerste gesprek": onderdeel "Ons verhaal voor deze branche" (verhaal, belofte en waarde van de branche). Briefing "Overdracht": de kernbelofte van de branche en "Wanneer we verliezen" van de huidige leverancier als risico voor de collega die het account overneemt. Pitstop bouwt het eerste bericht in vier stappen: voor wie, welk probleem, welk resultaat, waarom geloofwaardig (één bewijs). Op de telefoon is de Pitstop voorleesbaar en komt hij 30 minuten vooraf als push (8.10).

#### Technisch

- Geen aparte briefingtabel: berekend live; eigen tekst in `briefing_teksten: organisation_id, onderwerp ('afspraak'|'taak'), onderwerp_id, blok, tekst, door, op`; AI-versies in `agent_runs` met `draft`.
- Pure functies: `kiesBriefingSoort(context)`, `vulBriefing(soort, context)` (geen AI), `gewogenBezwaren(account)`.
- Endpoints: `GET /api/briefing?afspraak=|taak=|account=`, `PUT /api/briefing/tekst`, `POST /api/agent/prepare {taskId|appointmentId}`.
- AI: Pitstop met de promptketen (platform, organisatie, code), schema per concepttype, lengtegrenzen (belscript 150 woorden, mail 120, LinkedIn 80, WhatsApp 60, kaart 40), stijlcheck (11.5).
- Acceptatie: elke ingang kiest dezelfde soort voor hetzelfde gesprek; achterstallige taken krijgen ook een briefing; zonder AI-credits werkt de briefing volledig met berekende tekst.
- Hergebruik: `briefings.vue`, `BriefingFlyout.vue`, `BriefingOverviewFlyout.vue`, `accounts/[id]/briefing.vue`, `useQuickBriefing.ts`, `agentExecutor.ts`.


---

### F12 Campagnes

#### Functioneel

**Kern.** Een campagne is één gerichte actie over 20 tot 80 accounts: een koude belronde, een mailreeks, een LinkedIn-reeks, een bezoektour, een beurs, een referralactie, een winback. Ze heeft een soort, een winpunt, een boodschap of script, een hercontactritme, tussendoelen, een einddoel en een einddatum. Het bord laat per account zien waar het staat; het tempo zegt of je op schema ligt.

| Wie | Wat | Niveau |
|---|---|---|
| Accountmanager | Taken uit een campagne uitvoeren; campagnebord lezen | Beginner |
| Accountmanager | Campagne maken uit de acht startsoorten met de wizard, bord gebruiken, accounts toevoegen, taken spreiden over belblokken, voortgang | Gevorderd |
| Accountmanager | Alle 26 soorten, mailreeksen met de Verzender op mandaat B, tussendoelen, dynamische doelgroep | Expert |
| Salesmanager | Campagnes van het team, activeren boven capaciteit, verdelen over verkopers, resultaat en conversie per campagne | rol |

**Routes**: `/campagnes` (lijst), `/campagnes/nieuw` (wizard), `/campagnes/:id` (bord).

**Lijst**: kicker "CAMPAGNES · 5 ACTIEF", titel "Eén lijst, één doel, elke dag een stap.", knoppen "+ Campagne" (Gevorderd; Beginner ziet hem met slot), "Filters" (status, soort, eigenaar). Kaarten met soort, status, eigenaar, tempopil ("Voor op schema", "Op schema", "Achter op schema"), doel, winpunt, accounts, klaar, afspraken, voortgangsbalk met de verwachte stand als streep, dagen over.

**Wizard in vijf stappen** (stappenbalk bovenaan; "Opslaan als concept" kan altijd):

1. **Doelgroep**: kies een doelgroep (F05), een fase in een reis, een segment, een opgeslagen filter, een leadronde of importbatch, of "Vrije keuze". De wizard toont het aantal en wat wordt overgeslagen met reden ("6 zitten al in een ritme", "3 in afkoelperiode", "2 horen bij een partner"). Kanaal direct of via partner.
2. **Soort**: acht startsoorten als kaarten (Koude belcampagne, Mailreeks, LinkedIn-reeks, Bezoektour, Beurs of event, Referral, Winback, Nurture), daaronder "Alle 26 soorten" in vijf groepen met zoekveld (Expert). Elke soort heeft een standaarddoel, standaardritme, standaardscript of mailsjabloon en uitvoerder (binnendienst, buitendienst of beide).
3. **Winpunt**: AI-voorstel met motivatie van hoogstens 40 woorden uit de fase van de doelgroep en de laatste 20 verslagen; kiesbaar uit de winpunten.
4. **Boodschap en script**: per kanaal de boodschap (mail, LinkedIn, kaart) met toon ("Zakelijk", "Persoonlijk", "Kort"), stijlscore en "Maak opnieuw"; het belscript-template voor beltaken (F08); de mailreeks met verzenddagen (bericht 2 en verder met een ander winpunt).
5. **Doel en planning**: einddoel (aantal afspraken of percentage), tussendoelen uit de reis, startdatum, einddatum, eigenaar of verdeling over verkopers (gelijk, op gebied, op capaciteit), capaciteitsschatting per week ("8,5 uur bellen per week tegen 6 beschikbaar") met waarschuwing; boven capaciteit moet de salesmanager bevestigen.

**Bord** (`/campagnes/:id`): kop met soort, status, reis, winpunt, ritme ("koud, 5 pogingen in 3 weken"), doel en stand ("14 van 30 afspraken"), tempopil, knoppen "Zet om naar taken (7)", "Verdeel over belblokken", "Voortgang", "Wijzigen", "+ Accounts". Blok "Begin hier · uitgerekend, geen AI" (drie accounts: nooit contact eerst, dan langst stil, met aanleiding als tweede sleutel). Kolommen **"Gespot"**, **"Benaderd"**, **"In gesprek"**, **"Afspraak"**, **"Geparkeerd"**, **"Afgewezen"**; kaartje met initialen in fasekleur, naam, "poging 3 van 5", volgende stap en datum, eigenaar. Slepen kan, maar een kolomwissel naar Afspraak, Geparkeerd of Afgewezen vraagt de uitkomst, zodat bord en taak altijd gelijk lopen.

**Regels**

- Een account zit nooit in twee ritmes; de wizard weigert het met uitleg.
- Taken uit een campagne krijgen titel "{werkwoord} {account} ({campagne})", het script of concept, `campaignId`, eigenaar uit de verdeling, en een vervaldatum **gespreid** over de looptijd (binnendienst: in de koude belblokken, maximaal het aantal plekken per blok; buitendienst: op de regiodag van het account).
- **Tempo** (één functie voor scherm en motor): voortgang = items met einddoel gehaald / items; verwacht = verstreken looptijd / totale looptijd; doelpercentage uit het doel; "Voor op schema" bij 5 punten of meer boven verwacht, "Op schema" tot 10 punten eronder, anders "Achter op schema". Tempo alleen met einddatum en minstens één account.
- **Achterstand**: de motor maakt een inzicht "Campagne loopt achter" bij 10 procentpunten of meer achterstand (cadans 2 dagen), met het advies "Begin hier".
- **Afsluiter**: na de einddatum gaat een actieve campagne naar "Afgerond" met een samenvatting (bereikt, gesprekken, afspraken gepland en gehouden, overgedragen, conversie, winpunt uitgevoerd).
- **Mailreeks**: de eerste mail aan een contact en elke mail aan een beslisser zijn per stuk goed te keuren (mandaat C); mail 2 en verder binnen een goedgekeurde campagne mag de Verzender zelf versturen (mandaat B, Expert, als de organisatie dat aanzet), met dagplafond 40 per gebruiker, afmeldlink, stop bij een antwoord of bounce.
- Bij afronden van een item de vraag "Is het winpunt uitgevoerd?" (ja of nee); de norm is 90 procent.

**Uit het verkoopverhaal (F25).** Branche verplicht. Bij aanmaken een dekkingscontrole: een branche zonder eigen verhaal of belofte geeft een gele melding met link naar de inrichting; een toekomstige branche met prioriteit hoog krijgt het advies "Eerst referenties en verhaal, dan volume". Optioneel veld "Draagt bij aan jaarkeuze". Bij afronden "Is het winpunt uitgevoerd?" met norm 90 procent.

#### Technisch

- `campagnes` als in hoofdstuk 10 met `reis_id`, `doelgroep_id`, `soort`, `status`, `started_at`, `ends_at`, `data { winpuntId, boodschap, scriptId, mailreeks[], ritme {ritmeId}, tussendoelen[], doel {type, waarde}, capaciteit, verdeling, items[] }`.
- `campagnesoorten` (26, startset in `shared/campagneSoorten.ts`, door de organisatie aan en uit te zetten): sleutel, groep, naam, standaardDoel, ritmeId, kanalen, uitvoerder, scriptId, mailsjabloonId.
- Pure functies: `campagneTempo`, `campagneAdvies`, `spreidTaken(items, blokken, regiodagen, looptijd)`, `capaciteit(items, soort, eigenaars)`, `campagneResultaat(items, activiteiten)`.
- Endpoints: `POST /api/campagnes`, `PUT /api/campagnes/:id`, `POST /api/campagnes/:id/activeer`, `POST /api/campagnes/:id/taken {itemIds?}`, `POST /api/campagnes/:id/verdeel`, `POST /api/campagnes/:id/boodschap` (AI), `GET /api/campagnes/:id/resultaat`.
- Acceptatie: een koude belcampagne van 30 accounts loopt van Gespot tot Afspraak en Geparkeerd; het bord en de taken lopen nooit uiteen; taken zijn gespreid en vallen in koude belblokken; een campagne boven capaciteit vraagt bevestiging van de salesmanager.
- Hergebruik: `campagnes/index.vue`, `campagnes/[id].vue`, `CampagneFlyout.vue`, `NieuweCampagneFlyout.vue`, `campagneTempo.ts`, `useCampagneDetail.ts`.

---

### F13 Prospectplanning en hercontactritme

#### Functioneel

**Kern.** Twee planningsmiddelen die bepalen wanneer je wie benadert:

1. **Prospectplanning** (jaarplanning): hoe groter de potentie, hoe eerder in het verkoopjaar. Grote prospects in de eerste twee maanden, middelgrote in maand 1 tot en met 5, kleine doorlopend.
2. **Hercontactritme**: wat je doet als een prospect niet reageert: pogingen, intervallen, kanalen, parkeerduur. De meeste afspraken ontstaan pas na de vierde of vijfde poging; het ritme haalt die beslissing uit het hoofd van de verkoper.

| Wie | Wat | Niveau |
|---|---|---|
| Accountmanager | Volgende poging zien op taak en kaart ("poging 3 van 5") | Beginner |
| Accountmanager | Prospectplanning: "Wat knelt er nu", jaarkalender, maanddetail, "Plan in belblok" of "Zet in campagne" per groep | Gevorderd |
| Accountmanager | Ritme kiezen per campagne, parkeerregels per reis | Expert |
| Salesmanager | Ritmes beheren, vensters per klasse instellen, teamweergave, rapport per ritme | rol |

**Routes**: `/planning` (tabbladen "Jaarplanning" en "Hercontactritme").

**Jaarplanning**

- Kop: "Verkoopjaar 2026 · 105 van 112 prospects ingedeeld", titel "Wie dit jaar aan de beurt is, per potentie."
- Blok "Wat knelt er nu" met signalen in vaste volgorde (urgent, let op, informatief, goed): "Achterstallig · Groot: Het is oktober en 36 grote prospects zijn nog niet benaderd. Dat hoorde in januari en februari." met "Plan 36 in belblokken" en "Maak campagne"; "Buiten de planning: 7 prospects zonder klasse" met "Deel in".
- Jaarkalender van twaalf maandtegels (groepen die aan de beurt zijn, "4/61 benaderd", rode pil "36 te laat"); maanddetail per groep met meter en rijen (naam, klasse, plaats, status "Nog niet benaderd", "Benaderd", "Gesproken", "Afspraak", aantal contactmomenten, knop "Bel" of "Plan bezoek").
- Filters: "Van mij" (standaard), team (salesmanager), doelgroep, gebied; voor de buitendienst een kaartweergave.

**Hercontactritme**

- Per ritme een kaart met de stappen als tijdlijn (vakken per dag: 0 bellen, 3 bellen, 7 LinkedIn, 12 bellen, 21 mail, parkeren 180 dagen), bron (koud, warm, winback), parkeerduur en waar het gebruikt wordt.
- Rapport per ritme: afspraken per poging (waar ontstaan ze), percentage geparkeerd, gemiddelde pogingen tot afspraak; knop "Stel wijziging voor" (wordt een voorstel voor de salesmanager of een suggestie naar SalesDNA).
- Startset: **Koud** (5 pogingen in 3 weken: bellen dag 0, bellen dag 3, LinkedIn dag 7, bellen dag 12, mail dag 21; parkeren 180 dagen), **Warm** (3 pogingen in 10 dagen: bellen 0, mail 3, bellen 10; parkeren 90 dagen), **Winback** (2 pogingen in 4 weken: bellen 0, mail 28; parkeren 365 dagen), **Buitendienst koud** (bezoek op regiodag, bellen dag 2, mail dag 7, bezoek volgende regiodag; parkeren 180 dagen).

**Regels**

- Klasse naar potentie: A en B groot (maand 1 tot 2), C middel (maand 1 tot 5), D klein (doorlopend), eigen klassen middel, zonder klasse buiten de planning. Vensters en startmaand van het verkoopjaar zijn instelbaar.
- Potentie kan behalve uit de klasse ook uit een eigen veld komen ("Omzetpotentie") of uit de score; de klasse is de terugval.
- **Benaderd** telt alleen echte pogingen in het lopende verkoopjaar; **gesproken** vraagt een gesprek met iemand (bij voorkeur de beslisser); geïmporteerde datums tellen niet.
- De motorregel `jaarplanning-venster` maakt wekelijks een beltaak voor prospects waarvan het venster voorbij is en die niet benaderd zijn.
- **Stapberekening** (`shared/hercontact.ts`, `verwerkUitkomst`): zie 7.3. Een account zit nooit in twee ritmes; idempotent per item en stap; een poging overslaan kan niet zonder uitkomst.
- Afkoelperiode per kanaal na een nee (bellen 90, mail 60, LinkedIn 90, WhatsApp 180, bezoek 180, kaart 365 dagen) wordt gecontroleerd vóór elke poging.

**Terugkomregels (F25, ADR-018).** Naast het tabblad "Hercontactritme" (pogingenreeksen) komt het tabblad "Terugkomregels" met de twee lijsten verloren en slapend: reden, termijn in dagen (standaard 30, 61, 91, 182, 365; "direct" is 0), kanaal, klassen, rollen, aanpak en het hercontactritme dat start. Slapende klanten herkent Dealtrace uit besteldata van CRM of DealDrive (3, 6 of 12 maanden niet besteld) en maakt er een herwinaccount van. KPI "Hercontact op tijd" met norm 90 procent (gezond) en 70 procent (aandacht); opbrengst per reden.

#### Technisch

- `hercontactritmes: id, organisation_id, naam, bron, status, versie, data { stappen [{volgnummer, dagOffset, kanaal, instructie?, scriptId?}], parkeerDagen }` (of gespiegeld uit SalesDNA, alleen-lezen).
- `accounts.data.reis.ritme {ritmeId, stap, volgendeOp, gepauzeerdTot, geparkeerdTot, geschiedenis[]}`.
- Pure functies: `potentieVan(account, instellingen)`, `vensterVan(potentie, verkoopjaarStart)`, `benaderdDitJaar(account, activiteiten, jaarStart)`, `verwerkUitkomst(stand, ritme, uitkomst, nu, laterOp?)`, `magBenaderen(account, kanaal, nu)`.
- Endpoints: `GET /api/planning/jaar?jaar=&scope=`, `POST /api/planning/inplannen {accountIds, doel: 'belblokken'|'campagne'}`, `GET|POST|PUT /api/ritmes`, `GET /api/ritmes/:id/rapport`.
- Acceptatie: een account met ritme koud doorloopt vijf stappen met "geen reactie", wordt geparkeerd met terugkomdatum en komt bij een nieuwe aanleiding terug (als de afkoelperiode voorbij is); "Plan 36 in belblokken" spreidt de beltaken over de koude blokken van de komende weken binnen het venster.
- Hergebruik: `prospectplanning.vue`, `useOmzetpotentie.ts`, `useDekkingBuckets.ts`.

---

### F14 AI-agents voor interne en externe bronnen

**Beslissing B7.** AI-agents lezen interne en externe bronnen en presenteren wat ze vinden als **inzichten met bewijs**. Ze doen het werk dat een accountmanager anders niet doet (honderden websites, vacaturesites en registers bijhouden), maar ze handelen nooit buiten hun mandaat. De volledige agentarchitectuur staat in hoofdstuk 11; deze feature beschrijft wat de gebruiker ziet en wat hij kan instellen.

#### Functioneel

**Bronnen**

| Soort | Bron | Wat de agent eruit haalt | Agent |
|---|---|---|---|
| Intern | Eigen Dealtrace-data: accounts, contacten, activiteitenlog, uitkomsten, afspraken | Stilte ("45 dagen geen contact"), patronen ("3 keer voicemail, probeer mail"), dossier verloopt, afspraak gepland bij een onvoldoende gekwalificeerd account, campagne loopt achter | Waarnemer (intern), Coach |
| Intern | Gespreksverslagen en notities | Koopsignalen, bezwaren, open vragen, toezeggingen, wie er nog ontbreekt in het buying committee | Notulist, Profielbouwer |
| Intern | Gekoppeld CRM (HubSpot e.d.) | Klantstatus, laatste order, contracteinde, verloren klanten (winback) | Waarnemer (intern) |
| Intern | Kennisbank van de organisatie (cases, productinfo, prijslijst, playbooks) | Passend bewijs en argument bij een winpunt, antwoord op een bezwaar | Schrijver |
| Extern | KvK (Handelsregister) | Nieuwe vestiging, verhuizing, wijziging rechtsvorm of bestuurder, nieuwe inschrijving in de doelgroep | Waarnemer (extern) |
| Extern | Bedrijfswebsite | Nieuwe diensten, nieuwe projecten, teampagina (wie werkt er), wijzigingen | Waarnemer, Verrijker |
| Extern | Vacaturesites en werkenbij-pagina's | Groei of vervanging in een functie die bij je aanbod past | Waarnemer |
| Extern | Nieuws en vakmedia | Projecten, overnames, jubileum, prijzen, uitbreiding | Waarnemer |
| Extern | Datacollectief | Contactpersonen, functies, wijzigingen in management, omvang | Verrijker |
| Extern | Aanbestedingen (TenderNed) | Lopende of gewonnen aanbestedingen in je branche of regio | Waarnemer (optioneel) |
| Extern | Handmatig door de gebruiker | Wat de accountmanager zelf hoorde of las, met bron | n.v.t. |

Elk inzicht toont: bron (soort en naam), datum, letterlijk citaat, link, relevantie, zekerheid, het voorgestelde winpunt, de voorgestelde actie en welke agent het vond (met mandaatletter).

**Wat de gebruiker ziet**

| Plek | Beginner | Gevorderd | Expert |
|---|---|---|---|
| Vandaag | "Aanleiding van de dag" en Prio-kolom | plus "Door agents gedaan sinds gisteren" | plus filter per agent |
| Inzichten | lezen, "Maak taak" | plus filters op agent en bron, afwijzen met reden, "Inzicht met bron" handmatig toevoegen | plus "Waarom niet?" (inzichten die de Bewaker of de bewijsplicht tegenhield) |
| Accountkaart | blok "Wat de agents zagen" | plus "Laat opnieuw onderzoeken" (kost 1 dossier) | plus bronnen per account aanvullen (een eigen URL of trefwoord om te volgen) |
| Instellingen, Agents | niet zichtbaar | alleen lezen | eigen onderwerpen en bronnen voor de Waarnemer, eigen mandaat binnen het organisatiemaximum |

**Agentpagina** (`/instellingen/agents`, beheerder; alleen lezen voor Gevorderd): kaart "Mandaten in vier niveaus" (A autonoom, B binnen een goedgekeurd kader, C per stuk goedkeuren, D altijd mens) met de harde grenzen; tabel van agents met mandaat, dagplafond, vandaag gedaan, aan of uit; knop **"Agents pauzeren"** (gevaar, met bevestiging; zet alle B-handelingen stil, lopende ritmes gaan als taak naar de mens); kaart "Vandaag tegengehouden door de Bewaker" met reden ("Geen consent voor WhatsApp", "Afkoelperiode mail tot 3 december", "Dagplafond bereikt").

**Waarnemer instellen** (Expert en beheerder): per doelgroep de signaalsoorten die tellen (vacature met functietrefwoorden, nieuws met trefwoorden, KvK-mutatie, website-wijziging, aanbesteding met CPV-codes), de cadans (minimaal wekelijks per account), de minimale relevantie, en per signaalsoort het winpunt dat erbij past (signaalregels, importeerbaar uit Excel). Voorbeeld uit de productbrief: "50 jaar bestaan" wordt de felicitatie met een kaart en het winpunt "De meekijkdag".

**Regels**

- Geen bewijs, geen inzicht: een citaat telt alleen als het letterlijk in het materiaal staat; een URL alleen als hij in de echte zoekresultaten stond.
- Ouderdom: vacatures zacht 30 en hard 120 dagen, nieuws 90 en 365, website 30 en 90; boven hard geschrapt, boven zacht geen taakvoorstel.
- Een inzicht met zekerheid onder 60 krijgt geen taakvoorstel.
- Een trigger kan een account uit "wachtend" of "nee" terughalen (regel `trigger-heractivatie`), maar alleen als de afkoelperiode voor het voorgestelde kanaal voorbij is.
- Kosten per bron vallen in de AI-credits (11.4); de Waarnemer volgt per run maximaal 25 accounts per regel.

**Uit het verkoopverhaal (F25).** De Waarnemer zoekt ook naar concurrentnamen in nieuws en vacatures; de Schrijver leest het leesmodel en bewaart de gebruikte versies; de Coach bundelt wekelijks de suggesties naar SalesDNA voor de salesmanager.

#### Technisch

- `signals.data { agent, bron {soort, naam, url?, datum}, evidence[], winpuntVoorstel?, zekerheid }`, `agent_runs` met `agent`, `mandaatNiveau`, `bronnen[]`, `kosten`.
- `waarnemer_profielen: organisation_id, doelgroep_id, data { signaalsoorten [{soort, trefwoorden[], minRelevantie, winpuntId?}], cadans }`.
- Adapters: `kvk.ts` (mutaties), `webBron.ts` (vacatures, nieuws, website), `datacollectief.ts`, `tenderned.ts` (optioneel), `crm/*`.
- Endpoints: `GET /api/agents` (stand en tellers), `PUT /api/agents/:agent/mandaat`, `POST /api/agents/pauzeer`, `GET|PUT /api/waarnemer/profielen`, `POST /api/accounts/:id/onderzoek`, `POST /api/signals/handmatig {accountId, titel, bron, url?, citaat}`.
- Acceptatie: een vacature op een werkenbij-pagina wordt een inzicht met citaat, URL en datum; een verzonnen URL wordt geweigerd; "Agents pauzeren" stopt de Verzender direct en zet de volgende mails als taak; de Bewaker logt elke blokkade met reden.
- Hergebruik: `aiInsight.ts`, `webBron.ts`, `ruleEngine.ts` (AI-pass), `agentExecutor.ts`.

---

### F15 Activity selling-regels (de motor)

#### Functioneel

**Kern.** De regelset bepaalt welk werk Dealtrace zelf klaarzet. Elke regel is een als-dan-afspraak: als er bij een account, afspraak, lead of campagne iets waar is, dan maakt de motor een inzicht of een taak, met prioriteit, actiesoort, uitvoerderrol en een reden met bewijs.

| Wie | Wat | Niveau |
|---|---|---|
| Accountmanager | Het resultaat (taken en inzichten) met bij elke taak "Waarom krijg ik dit?" in gewone taal | Beginner |
| Accountmanager | Regels lezen, droogloop bekijken | Gevorderd |
| Accountmanager | Persoonlijke regel maken (alleen voor eigen accounts); teamregel voorstellen | Expert |
| Salesmanager | Teamregels aan- en uitzetten, cadans, drempels, klassen | rol |
| Beheerder | Alles: nieuwe regels, AI-regels, Excel-import en -export, back-up, starterset | rol |

**Route**: `/instellingen/regels`.

**Opbouw** (master-detail zoals DealDrive): kop met tellers ("21 actief · 2 uit · 19 door de motor · 23 totaal") en opslagstatus; filterbalk (zoeken, categorie, bron, reis en fase, status van het account, uitvoerderrol, "Alleen motorregels"; in de URL); knoppen "Draai motor nu", "Exporteren", "Importeren", "Back-up", "Back-up terugzetten", "Starterset terugzetten". Links de lijst (schakelaar, categorie, naam, label "motor" of "alleen feed", prioriteitsstip); rechts het bewerkpaneel met drie blokken en een ⓘ-uitleg per veld:

| Blok | Velden |
|---|---|
| Wat en wanneer | Categorie, Subcategorie, Omschrijving, Activiteit (Inzicht of Taak), Cadans, Prioriteit |
| Sturing | Bron (Intern, Extern), Specifieke bron, Triggerpatroon met parameters, Motor (Regel of AI), Afbakening: accounttype, status, reis en fase, doelgroep, campagne, klasse |
| Gevolg | Actiesoort (Bellen, Mailen, LinkedIn, Bezoek, Bericht, Geen), Uitvoerderrol (Binnendienst, Buitendienst, Eigenaar, Salesmanager), Termijn ("binnen 24 uur", "binnen 3 werkdagen"), Taaksjabloon met `{account}`, `{contact}`, `{afspraak}`, Belscript (bij bellen), Automatisch voorbereiden, Signaaltype, Verwacht resultaat |

Onder het paneel: live voorbeeld "Zo verschijnt hij in de takenlijst" met een voorbeeldprospect, en **droogloop** "Deze regel raakt nu 214 accounts en maakt bij de volgende run 38 taken" met de verdeling per persoon. Een regel die meer dan 50 taken per persoon zou maken vraagt bevestiging.

**Triggerpatronen**

| Patroon | Vuurt als | Parameters |
|---|---|---|
| Datum-drempel | datumveld ligt 0 tot N dagen in de toekomst | veld, dagen (standaard 60) |
| Inactiviteit | datumveld ligt N of meer dagen terug; "ook zonder datum" voor nieuwe prospects | veld, dagen (30), ookZonderDatum |
| Ritme | altijd; cadans of matrix is de poort | actiesoort |
| Gebeurtenis | gebeurtenis uit de catalogus of "fase betreden" | gebeurtenis, fase |
| Te lang in fase | dagen in fase boven het verwachte verblijf | marge |
| Lead verlopen | dossier ouder dan N dagen | dagen (30) |
| Jaarplanning-venster | venster voorbij en niet benaderd dit verkoopjaar | geen |
| Afspraak niet overgedragen | eerste afspraak gehouden zonder overdracht of uitkomst | werkdagen (1) |
| Afspraak onvoldoende gekwalificeerd | eerste afspraak gepland bij een account met BAND 1 of minder | dagen vooraf (2) |
| Campagne-achterstand | tempo N punten achter | marge (10) |
| Hercontact-vervolg | volgende poging in een ritme is aan de beurt | geen |
| Geparkeerd terug | terugkomdatum bereikt | geen |
| Trigger-heractivatie | nieuw extern signaal bij een account in wachtend of nee, afkoelperiode voorbij | signaalsoorten |
| Tussendoel gehaald | tussendoel van een activiteit bereikt | geen |
| Partner te laat | doorgezette lead niet bevestigd binnen de termijn | geen |

Cadans: Dagelijks 1, 2 dagen, 3 dagen, Wekelijks 7, 2 weken 14, Maandelijks 30, 2 maanden 61, Kwartaal 91, Half jaar 182, Jaarlijks 365, Continu. AI-regels minimaal wekelijks.

**Starterset** (elke regel draait; "Starterset terugzetten" laadt precies deze set): SR01 nieuwe lead zonder dossier · SR02 dossier verloopt · SR03 gekwalificeerd, nog geen contact (inactiviteit 7 dagen, ook zonder datum, bellen, binnendienst) · SR04 belritme prospect (ritme, matrix) · SR05 bezoekritme A en B (buitendienst, op regiodag) · SR06 contact-stilte 45 dagen · SR07 jaarplanningsvenster voorbij · SR08 afspraak gehad, geen vervolg · SR09 eerste afspraak bevestigen · SR10 afspraak onvoldoende gekwalificeerd · SR11 campagne loopt achter · SR12 afspraak gehouden: overdracht · SR13 no-show: opnieuw inplannen · SR14 AI-kansanalyse A en B · SR15 vacatures · SR16 nieuws · SR17 hercontact-vervolg · SR18 geparkeerd terug · SR19 trigger-heractivatie (jubileum, vacature, directiewissel, verhuizing, subsidie) · SR20 partner te laat · SR21 tussendoel gehaald · SR22 te lang in fase · SR23 KvK-mutatie bij prospect in reis.

**Regels van de motor**

- Draait elk uur per organisatie, direct na een gebeurtenis voor dat ene account, en op "Draai motor nu"; open sessies zien het resultaat binnen 3 minuten.
- Cadanspoort per regel en onderwerp; ontdubbelen van open inzichten (bijwerken zonder terug naar ongelezen); een afspraak krijgt één opvolging per onderwerp.
- **Capaciteit**: per uitvoerder een dagplafond (standaard binnendienst 40 beltaken, buitendienst 6 bezoeken per regiodag); wat erboven valt schuift naar de volgende werkdag en wordt gemeld.
- **Landing**: taken voor de binnendienst krijgen als vervaldatum het eerstvolgende passende belblok, taken voor de buitendienst de regiodag van het account.
- **Eigenaar**: accounteigenaar, anders de uitvoerderrol van het gebied, anders de salesmanager van het team.
- **Leerlus**: per regel de acceptatiegraad (omgezet, afgewezen met reden, genegeerd) en wat de taken opleverden (afspraken); onder 20 procent acceptatie over 30 dagen krijgt de eigenaar een inzicht "Regel levert vooral ruis".
- Excel: export met blad Regels (keuzelijsten per kolom) en Toelichting; import tot 5 MB en 2.000 rijen met per rij fouten en waarschuwingen; samenvoegen op id of alles vervangen.

#### Technisch

- `activity_rules` en `rule_runs` als in hoofdstuk 10; regel `data` met alle velden die de editor toont (de editor is de enige bron; Excel is import en export daarvan).
- Pure functies: `evaluateTrigger`, `cadansVerstreken`, `ruleTargetsAccount`, `vulSjabloon`, `landingsmoment(taak, gebruiker, blokken, regiodagen)`, `droogloop(regel, accounts)`.
- Endpoints: `GET /api/regels`, `PUT /api/regels/:id`, `POST /api/regels`, `DELETE /api/regels/:id`, `POST /api/regels/:id/droogloop`, `POST /api/regels/excel-export`, `POST /api/regels/excel-import`, `POST /api/motor/run`, `POST /api/motor/run-all` (geplande functie met `x-motor-secret`), `GET /api/motor/updates?since=`.
- Acceptatie: een run over 40 prospects in vier klassen levert precies de verwachte taken; een tweede run direct erna levert niets; een persoonlijke regel van een Expert raakt alleen zijn eigen accounts; capaciteitsplafond schuift het overschot door.
- Hergebruik: `ruleEngine.ts`, `activityRulesStore.ts`, `useActivitySellingRules.ts`, `instellingen/activity-selling.vue`, `motorPoll.client.ts`.

---

### F16 Accountmatrix en ritmes

#### Functioneel

**Kern.** Eén pagina waar de organisatie vastlegt hoeveel aandacht elk account verdient: accountklassen, segmenten, belmatrix, afspraakmatrix en afkoelperiodes. De matrix is de inrichting, de regels zijn de uitvoering. Voor new business is het hercontactritme (F13) de reeks pogingen tot een afspraak; de belmatrix regelt het onderhoudsritme daarna. Beide staan op dezelfde pagina, met de regel "nooit twee ritmes tegelijk op één account".

**Route**: `/instellingen/ritme`. Iedereen kan meekijken ("Je kunt meekijken. Alleen een beheerder wijzigt de inrichting."); Gevorderd ziet "Wat betekent dit voor mij": hoeveel belmomenten en bezoeken de matrix deze week van hem verwacht, tegen zijn capaciteit.

**Secties**

1. **Accountklassen**: code (maximaal 2 tekens), naam, omschrijving, aantal accounts; standaard A Corporate (250+ medewerkers), B Groot MKB (50 tot 250), C Middenbedrijf (10 tot 50), D Klein MKB (tot 10). Melding "34 prospects hebben nog geen klasse." met "Stel voor uit medewerkers" (gebruikt KvK of Datacollectief).
2. **Segmenten**: regels op velden, inclusief eigen velden en matrixvelden; leden met teller.
3. **Belmatrix**: per accounttype (prospect, klant) en klasse het aantal per maand, kwartaal, halfjaar en jaar; afgeleid ritme ("12×/jaar = elke 4 weken"); "niet ingesteld" en "bewust uit (0)" zichtbaar verschillend. Standaard prospect A en B maandelijks, C per kwartaal, D per halfjaar; klant A maandelijks, B per kwartaal, C per halfjaar, D jaarlijks.
4. **Afspraakmatrix**: per klasse meeting (online) en bezoek; standaard A per kwartaal, B per halfjaar, C jaarlijks, D bezoek jaarlijks.
5. **Afkoelperiodes en consent**: per kanaal de afkoelperiode na een nee en het frequentieplafond (maximaal één bericht per kanaal per 3 werkdagen buiten het ritme).
6. **Overschrijven per reis**: een reis (F05) kan een eigen belmatrix of ritme gebruiken; deze pagina toont welke reizen afwijken.

**Regels**: interval = 365 / jaartotaal, afgerond, minimaal 1 dag; een ingevulde matrix levert zelfstandig taken op (geen losse ritmeregel nodig); afrekening per account, niet als som per klasse, en met hetzelfde kanaal dat de motor voorschrijft.

#### Technisch

- Instellingssleutels `accountklassen`, `belmatrix`, `afspraakmatrix`, `afkoeling`, `frequentieplafond`; zonder instelling geldt de standaard, een kapotte instelling laat de motor nooit omvallen.
- Pure functies: `jaartotaal`, `intervalDagen`, `ritmeLabel`, `klasseVoorOmvang(medewerkers, klassen)`, `ritmeAfrekening(accounts, activiteiten, periode)`.
- Hergebruik: `shared/ritmematrix.ts`, `instellingen/accountritme`-pagina van DealDrive.

---

### F17 Funnel van de prospectreis

**Beslissing B17.** Dealtrace stopt bij de eerste afspraak. Pipeline, deals en offertes zitten niet in de app; die horen in DealDrive of het CRM van de klant. In plaats van de pipeline komt de **funnel van de prospectreis**: hoeveel accounts er in elke fase van de reis staan, hoeveel er doorstromen naar de volgende fase, hoe lang dat duurt en waar ze uitvallen, tot en met de eerste afspraak en de overdracht.

#### Functioneel

**Kern.** "Waar lekt mijn new business weg?" De funnel leest alleen de reisgeschiedenis en de activiteitenlog; er is niets apart in te vullen.

| Wie | Wat | Niveau |
|---|---|---|
| Accountmanager | Eigen funnel: aantallen per fase, de fase waar het meest stokt, doorklikken naar de accounts | Beginner |
| Accountmanager | Plus: funnel per doelgroep, reis en campagne; conversie en doorlooptijd per fase; uitval met reden | Gevorderd |
| Accountmanager | Plus: reizen en reisversies naast elkaar, eigen weergaven, Download CSV | Expert |
| Salesmanager | Funnel per team en per persoon naast elkaar; vergelijking met de vorige periode | rol |

**Route**: `/funnel`. Op de telefoon dezelfde route met een verticale funnel (één fase per rij).

**Opbouw van de pagina**

1. **Kop**: kicker "FUNNEL · DEZE MAAND", titel als zin ("Van 214 prospects kwamen er 11 tot een eerste afspraak."), keuzes Periode (deze maand, kwartaal, verkoopjaar, eigen periode), Doelgroep, Reis, Campagne, Persoon of team (salesmanager), Kanaal.
2. **De funnel** (horizontaal op de laptop, verticaal op de telefoon), per fase van de reis gegroepeerd in de hoofdfases Vinden, Bewerken en Verbinden:

   | Fase | Wat de balk toont |
   |---|---|
   | Gevonden | aantal accounts dat in de periode binnenkwam |
   | Dossier compleet | aantal en conversie vanaf Gevonden |
   | Gekwalificeerd | aantal en conversie |
   | Benaderd | aantal, gemiddeld aantal pogingen |
   | In gesprek | aantal, aandeel beslisser bereikt |
   | Afspraak gepland | aantal eerste afspraken |
   | Afspraak gehouden | aantal, aandeel no-show |
   | Overgedragen | aantal overgedragen aan DealDrive, het CRM of een collega |

   Per fase: aantal, conversie naar de volgende fase in procent, gemiddelde doorlooptijd in dagen, en een oranje markering bij de fase met de laagste conversie ten opzichte van de norm ("Hier stokt het: van Benaderd naar In gesprek 18 procent, norm 30 procent").
3. **Uitval**: naast elke fase het aantal accounts dat daar naar nee, geparkeerd of afgekoeld ging, met de top drie redenen ("Tevreden met huidige leverancier 14 · Geen budget 6 · Verkeerd moment 5"). Bij een gekoppeld verkoopverhaal ook "Verloren aan" per concurrent (F25).
4. **Pogingen tot afspraak**: bij welke poging de eerste afspraak ontstaat (1, 2, 3, 4, 5 of later), zodat zichtbaar is wat er gebeurt als iemand na twee pogingen stopt.
5. **Lijst**: een klik op een fase of uitvalreden opent de accounts die daar staan, met fase sinds, laatste poging en volgende stap; vanuit de lijst kun je een taak maken of het account openen.

**Klikpaden**

1. Zien waar het stokt: open Funnel; de oranje fase staat bovenaan in de kop ("Hier stokt het"); klik erop voor de accounts.
2. Een campagne beoordelen: kies de campagne; de funnel toont alleen de accounts uit die campagne, met afspraken en uitval.
3. Een reis vergelijken (Expert): kies twee reizen of twee versies; de funnels staan naast elkaar (minimaal 20 accounts per reis of versie, anders de melding "Te weinig accounts om te vergelijken").

**De overdracht na de eerste afspraak**

- Na een gehouden eerste afspraak kies je bij "Rond af" (F09) de uitkomst. Bij een uitkomst met vervolg (zoals "Vervolg afgesproken") vraagt Dealtrace "Overdragen?" met de keuze waarheen: DealDrive, het CRM, of een collega (bijvoorbeeld de accountmanager die de klantrelatie gaat dragen).
- De overdracht stuurt account, contacten, buying committee, dossier, reisgeschiedenis, het verslag van de eerste afspraak, de afgesproken vervolgstap en de overdrachtsbriefing (F11) mee; de deal en een eventuele offerte maakt het ontvangende systeem.
- Het account krijgt status `overgedragen` en fase "Overgedragen" en verdwijnt uit de actieve reis. Zonder koppeling maakt Dealtrace een overdrachtstaak en een overdrachtsbriefing die je kunt mailen of downloaden.
- Komt een account uit DealDrive of het CRM terug (verloren deal, slapende klant), dan komt het via de terugkomregels (F25) als winback-kandidaat terug in een reis.

**Regels**

- De funnel telt accounts die in de periode een fase bereikten, op basis van `reisgeschiedenis`; een account dat een fase overslaat, telt in de overgeslagen fases niet mee.
- Normen per fase (conversie en doorlooptijd) staan in Instellingen en hebben een standaard per reis.
- Standaardscope is "mijn"; de salesmanager heeft een teamschakelaar.
- Elke grafiek is klikbaar naar de onderliggende lijst; elk overzicht heeft "Download CSV" (Expert en salesmanager).

#### Technisch

- Geen eigen invoertabellen; afgeleide tabel `nb_funnel_stand` (per dag, organisatie, reis, versie, doelgroep, campagne, gebruiker, fase: binnengekomen, doorgestroomd, uitgevallen per reden, doorlooptijd) uit `reisgeschiedenis` en `activiteiten`, nachtelijk en bij opvragen voor de lopende dag.
- `overdrachten: id, organisation_id, account_id, naar ('dealdrive'|'crm'|'collega'), naar_gebruiker_id?, extern_id?, status ('klaar'|'verstuurd'|'bevestigd'|'mislukt'), pakket jsonb, op, door`.
- Pure functies (`shared/funnel.ts`): `funnelStand(geschiedenis, periode, filters)`, `conversie(van, naar)`, `doorlooptijd(geschiedenis, fase)`, `stokpunt(stand, normen)`, `pogingTotAfspraak(activiteiten)`; `overdrachtPakket(account)`.
- Endpoints: `GET /api/funnel?periode=&reis=&doelgroep=&campagne=&gebruiker=&team=`, `GET /api/funnel/accounts?fase=&reden=`, `POST /api/accounts/:id/overdragen {naar, naarGebruikerId?}`.
- Koppeling met DealDrive: het contract (overdracht, ontdubbelen, terugmeldingen, ondertekening, foutcodes, veldtoewijzing naar de DealDrive-typen) staat in `docs/api/dealdrive-koppeling.md` en `docs/api/dealdrive-koppeling.openapi.yaml`; de adapter `server/utils/dealdriveAdapter.ts` heeft een uitvoering `http` en `mock` (fixtures in `seed/dealdrive-mock/`).
- Gebeurtenissen: `eerste-afspraak-gehouden` en `overgedragen` (F05).
- Prestatiebudget: funnel van een organisatie met 10.000 accounts en een kwartaal geschiedenis onder 1 seconde.
- Acceptatie: een account dat van Gevonden naar Afspraak gepland gaat, telt in elke tussenliggende fase die het bereikte; de som van doorgestroomd en uitgevallen per fase klopt met het aantal dat binnenkwam min wat er nog staat; de overdracht naar DealDrive geeft een extern id terug en zet het account op `overgedragen`; zonder koppeling ontstaat een overdrachtstaak met briefing.
- Hergebruik: de trechterweergave uit de analysepagina's van DealDrive als vorm; `pipeline.vue`, `DealFlyout.vue` en `offertes.vue` worden **niet** overgenomen.
- Buiten scope: deals, offertes, pipelinewaarde, kans op winst, forecast van omzet.

---

### F18 Gebieden en regio-analyse

#### Functioneel

**Kern.** Het werkgebied in regio's: een regio is een naam met postcodereeksen en plaatsen, met per buitendienstmedewerker een vaste regiodag. Accounts vallen vanzelf in een regio (postcode gaat voor plaats). De regio-analyse toont waar potentie blijft liggen.

| Wie | Wat | Niveau |
|---|---|---|
| Buitendienst | Eigen week zien ("maandag Regio Oost") en per dag de accounts, nooit bezocht bovenaan | Beginner |
| Buitendienst en binnendienst | Regio-analyse met filters, persoonlijke regiodag kiezen, binnendienst vult regiodagen van de buitendienst | Gevorderd |
| Beheerder | Regio's tekenen, voorstel uit de portefeuille, overlap oplossen, eigenaren per regio | rol |

**Routes**: `/instellingen/gebieden` (inrichting), `/analyse/regio` (analyse; accountmanager ziet eigen accounts, salesmanager het team).

**Gebiedsindeling**: blok "Je week" met vijf dagkaarten (regio, tellers klanten, prospects, nooit bezocht, langer dan 90 dagen niet bezocht); per regio naam, postcodereeksen ("3701-3799, 3800-3829"), plaatsen (vangnet), **eigenaren** (buitendienst en binnendienstpartner; nieuwe prospects in die regio krijgen automatisch die eigenaren), regiodag per persoon (twee buitendienstmedewerkers kunnen hetzelfde gebied op verschillende dagen rijden; even en oneven weken mogelijk); overlap wordt bij invoer geblokkeerd met een duidelijke melding; synoniemen voor plaatsnamen ("Den Bosch" is "'s-Hertogenbosch"); "Voorstel uit je accounts" groepeert op het eerste cijfer van de postcode.

**Regio-analyse** ("Waar laat je potentie liggen?"): cijfers "Accounts in beeld", "Stil of nooit bezocht", "Nog niet benaderde prospects", "Gekwalificeerde prospects zonder contact in 60 dagen", "Bezocht in 90 dagen" (doel 80 procent); tabel per regio (regiodag, klanten, prospects, nog niet benaderd, eerste afspraken, dekking als balk, stil en nooit), altijd een rij "Zonder regio"; kaartweergave met punten per status; per regio een lijst (nooit bezocht boven, dan langst stil, dan dealwaarde) met "+ Afspraak" en "Klaarzetten voor regiodag".

**Regels**: indeling postcode (Nederlandse vier cijfers) gaat voor plaats; buitenlandse postcodes vallen nooit in een Nederlandse reeks; tellingen via één bronfunctie; taken en kansen voor de buitendienst landen op de regiodag (F10, F15).

#### Technisch

- Instelling `gebieden: [{id, naam, reeksen[{van, tot}], plaatsen[], eigenaren {buitendienst[], binnendienst[]}, dagen [{gebruikerId, weekdag, weken: 'alle'|'even'|'oneven'}]}]`; `accounts.gebied_id` afgeleid bij elke adreswijziging.
- Pure functies: `regioVan(account, regios, synoniemen)`, `overlap(regios)`, `regiodagVan(gebruiker, datum, regios)`, `dekking(accounts, activiteiten, periode)`.
- Endpoints: `PUT /api/settings/gebieden`, `GET /api/analyse/regio?scope=&periode=`, `POST /api/gebieden/voorstel`.
- Hergebruik: `shared/gebieden.ts`, `instellingen/gebieden.vue`, `regio-analyse.vue`, `server/api/gebieden/analyse.get.ts`.


---

### F19 Eigen velden

**Beslissing B6.** Elke organisatie verkoopt iets anders en wil eigen gegevens vastleggen ("Aantal monteurs", "Huidige leverancier", "Contract loopt af", "Interesse in", "Beurs bezocht"). In DealDrive konden eigen velden alleen worden ingevuld en getoond; in Dealtrace kun je er ook op filteren, sorteren, segmenteren, regels op laten vuren en ze in belscripts en imports gebruiken.

#### Functioneel

| Wie | Wat | Niveau |
|---|---|---|
| Iedereen | Waarden invullen in de Info-flyout, het snelformulier en de belmodus | Beginner |
| Accountmanager | Filteren en sorteren op eigen velden, gebruiken in opgeslagen filters | Gevorderd |
| Accountmanager | Een nieuw eigen veld voorstellen (wordt een verzoek aan de beheerder) | Expert |
| Beheerder | Velden maken, wijzigen, ordenen, archiveren | rol |

**Route**: `/instellingen/eigen-velden`.

**Opbouw**

- Kop: "Eigen velden", subtitel "Velden die jullie zelf nodig hebben, bovenop de standaard." Knop "+ Veld" (geel). Tabbladen per object: **Account**, **Contact**, **Campagne**, **Afspraak**.
- Per object de secties (Account: Adres, Bereik, Stamgegevens, Kwalificatie, Contract en order, plus eigen secties met "+ Sectie"); per sectie de velden als lijst met sleepgreep, naam, type, verplicht, zichtbaar voor, gebruikt in (filters, regels, scripts), aantal ingevuld.
- **Veldflyout**:

| Veld | Uitleg |
|---|---|
| Naam | label op het scherm, bijvoorbeeld "Aantal monteurs" |
| Sleutel | automatisch uit de naam (`aantal_monteurs`), uniek per object, na aanmaken niet meer te wijzigen |
| Type | Tekst, Lange tekst, Getal, Bedrag, Datum, Ja of nee, Keuzelijst, Meerkeuze, Telefoon, E-mail, Link, Gebruiker |
| Opties | bij Keuzelijst en Meerkeuze: de waarden met volgorde en kleur |
| Sectie | waar het veld staat in de Info-flyout |
| Verplicht | Nee, Bij aanmaken, Bij een fase (bijvoorbeeld verplicht vóór "Eerste afspraak") |
| Standaardwaarde | optioneel |
| Hulptekst | korte uitleg onder het veld |
| Zichtbaar voor | alle niveaus, vanaf Gevorderd, vanaf Expert (zodat een Beginner niet overladen wordt) |
| Bewerkbaar door | iedereen, eigenaar en manager, alleen beheerder |
| Filterbaar | ja of nee (zie technisch: filterbare velden krijgen een index) |
| Bron | handmatig, import, KvK, Datacollectief, CRM-veld (met veldtoewijzing) |

- Knoppen "Annuleren", "Veld opslaan"; archiveren in plaats van verwijderen zolang er waarden zijn ("Archiveren verbergt het veld; de 214 ingevulde waarden blijven bewaard.").

**Waar eigen velden terugkomen**

| Plek | Gebruik |
|---|---|
| Info-flyout en snelformulieren | in hun sectie, met hulptekst en validatie |
| Accountkaart | tabblad "Eigen velden" en optioneel als chip in de kop (keuze per veld "Toon in kop") |
| Lijsten | filtergroep per filterbaar veld; sorteren op getal, bedrag en datum; kolom in de compacte weergave |
| Segmenten en doelgroepen | regel op veld, vergelijking, waarde |
| Regels (F15) | datum-drempel en inactiviteit op een datumveld; afbakening op een keuzelijst |
| Belscripts (F08) | variabele `{cf.sleutel}` en een vraag gekoppeld aan het veld; het antwoord vult het veld |
| Import en CRM | kolom `cf:sleutel`; veldtoewijzing naar het CRM |
| Leadgenerator | doelgroepfilter op eigen veld |
| Rapportage | groeperen op keuzelijst (bijvoorbeeld conversie per "Huidige leverancier") |

**Regels**: een type wijzigen kan alleen als alle bestaande waarden geldig blijven (anders een lijst van de afwijkende records); een verplicht-bij-fase veld blokkeert de fasewissel met de melding welk veld leeg is; maximaal 100 eigen velden per object.

#### Technisch

- Definities in tabel `eigen_velden: id, organisation_id, object, sleutel, naam, type, sectie, volgorde, data {opties[], verplicht, standaard, hulp, zichtbaarVanaf, bewerkbaarDoor, filterbaar, bron, toonInKop}, gearchiveerd`.
- Waarden in `data.customFields[sleutel]` van het record (jsonb), met herkomst in `data.herkomst['cf.'+sleutel]`.
- **Filteren**: voor filterbare velden een expressie-index op `(data->'customFields'->>'sleutel')` per organisatie (gemaakt door een migratiefunctie bij "Filterbaar aan"), plus een gegenereerde kolom voor getal en datum zodat sorteren en vergelijken correct werkt. Bij meer dan 20 filterbare velden een GIN-index op `data->'customFields'`.
- Pure functies: `valideerWaarde(veld, waarde)`, `veldenVoorNiveau(velden, niveau)`, `cfVariabele(sleutel)`.
- Endpoints: `GET/POST/PUT /api/eigen-velden`, `POST /api/eigen-velden/:id/archiveer`, `POST /api/eigen-velden/voorstel` (Expert).
- Acceptatie: een keuzelijstveld is filterbaar met tellers in de lijst; een datumveld drijft een datum-drempelregel; een belscriptvraag vult het veld; een import met `cf:aantal_monteurs` vult de waarden; een Beginner ziet een veld met "vanaf Gevorderd" niet.
- Hergebruik: `useCustomFields.ts`, `instellingen/custom-fields.vue`.

---

### F20 Salesmanager: controle, analyse en coaching

**Beslissing B2.** De salesmanager is in Dealtrace geen meekijker maar een volwaardige gebruiker met drie taken: **controleren** (gebeurt wat we afspraken?), **analyseren** (wat werkt, wat niet, waarom?) en **coachen** (hoe help ik deze persoon beter te worden?). DealDrive had hiervoor losse rapportages; Dealtrace bouwt er een samenhangend managerdeel van.

#### Functioneel

**Routes**: `/team`, `/coaching`, `/analyse`, `/audit` (groep "Manager", rol salesmanager en hoger; alleen de eigen teams, tenzij beheerder).

**Team** (controle, dagelijks 10 minuten)

- Kop: "Team Binnendienst Noord · week 42", titel als zin ("Vier van de vijf liggen op schema."). Keuze team, periode (Vandaag, Deze week, Deze maand, Kwartaal).
- **Tabel per persoon**: naam met niveau en werkplek, taken op de dag afgerond (procent), achterstallig, pogingen (gedaan tegen norm), gesprekken en beslisser bereikt, afspraken (tegen doel), koude norm ("koud 3 van 5"), belblokken gepland en gehouden, bezoeken en kansen langs de route omgezet, concepten die wachten op goedkeuring, tempo-pil. Klik op een cel opent de onderliggende lijst.
- **Aandachtspunten** (maximaal vijf, uitgerekend): "Mark stopt gemiddeld na 2,1 pogingen (team 4,3)", "Sanne heeft 14 taken achterstallig", "3 campagnes lopen achter", "6 geparkeerde accounts komen deze week terug", "Eva heeft deze week geen belblok gehouden".
- **Werkverdeling**: accounts per persoon per fase en status, met "Verplaats" (bulk, met reden en audit).
- **Goedkeuringen**: campagnes boven capaciteit, conceptversies van reizen en scripts, roadmapwensen van het team.
- **Niveau per persoon**: per accountmanager het niveau, met "Wijzig niveau" (Beginner, Gevorderd, Expert); elke wijziging met audit (4.2).

**Coaching** (wekelijks per persoon)

- **Coachingkaart per accountmanager** (`/coaching/:gebruiker`):
  - Kop met naam, niveau, werkplek, en de knop "Wijzig niveau".
  - **Cijfers tegen norm en team** (laatste 4 weken met trend): activiteit (pogingen per dag, belblokken), bereik (gesproken, beslisser bereikt), conversie (gesprek naar afspraak, afspraak gepland naar gehouden, gehouden naar overgedragen), discipline (pogingen tot afspraak, taken op de dag, winpunt uitgevoerd, briefing geopend vóór gesprek), kwaliteit (AI-concept ongewijzigd of aangepast, doel gehaald per gesprek).
  - **Funnel van deze persoon** (F17) naast die van het team: waar valt het weg?
  - **Gesprekken om te bespreken**: de Coach-agent kiest drie gesprekken of bezoeken van de afgelopen week (een goede, een verloren, een met een bezwaar dat vaker terugkomt) met verslag, uitkomst en script; de manager kan zelf kiezen.
  - **Coachingpunten**: maximaal drie, uitgerekend en door de Coach voorgesteld met onderbouwing ("Bij koude acquisitie sluit je 2 van de 10 gesprekken met een afspraak; het team 4 van de 10. In 6 gesprekken werd het afsluitblok van het script niet gebruikt."), elk met een gekoppeld helpartikel uit de new business-academie (F21).
  - **Afspraken**: wat spreken we af (doel, gedrag, termijn), vastgelegd als coachingnotitie met datum; de accountmanager ziet de afspraken (niet de privénotities van de manager) en kan reageren.
  - **Historie**: eerdere sessies en of de afspraken gehaald zijn.
- **Eén-op-één-agenda**: de knop "Plan coachingsgesprek" maakt een interne meeting met de kaart als agenda.
- **Meeluisteren en meekijken**: de manager leest verslagen en Pitstop-concepten; opnames zijn buiten scope.

**Analyse** (maandelijks en per kwartaal)

| Tabblad | Inhoud |
|---|---|
| Funnel | de funnel van de prospectreis (F17) per team, doelgroep en reis; verwachting eerste afspraken dit kwartaal uit conversie en capaciteit |
| Activiteit | pogingen, gesprekken, afspraken per kanaal en per persoon; afspraken per poging (bij welke poging ontstaat de afspraak) |
| Campagnes | per campagne en soort: bereik, afspraken, conversie, kosten per afspraak; vergelijken van campagnes met dezelfde soort |
| Scripts | per belscript en versie: gesprekken, afspraken, duur, top bezwaren (minimaal 30 gesprekken) |
| Regels en agents | per regel acceptatie en opbrengst; per agent overname van concepten, blokkades per reden, kosten |
| Reizen | per reisversie conversie per fase (minimaal 20 accounts per versie); het maandelijkse verbetervoorstel van de Coach met "Accepteer", "Wijs af", "Later" |
| Bronnen | per leadbron (AI-zoeker, KvK, Datacollectief, import, CRM): leads, overgenomen, eerste afspraken, overgedragen, kosten per eerste afspraak |
| Regio | dekking en potentie per gebied (F18) |
| Prospectmix | afgesproken verdeling koud, warm, referral, winback tegen werkelijk, per persoon, met campagnevoorstel bij achterstand |

Elke grafiek is klikbaar naar de onderliggende lijst; elk tabblad heeft "Download CSV".

**Audit**: wie veranderde wat (fase handmatig, eigenaar, niveau, regels, scripts, reizen, verwijderingen, instappen van de leverancier), met filters op persoon, soort en periode.

**Wat de accountmanager zelf ziet** (`/resultaten`, "Mijn resultaten"): dezelfde cijfers als op zijn coachingkaart, zonder vergelijking met namen van collega's (wel met het teamgemiddelde), zijn afspraken uit coachingsgesprekken, en vanaf Expert een zelfanalyse door de Coach ("Wat kan ik deze week beter doen?").

**Regels**

- Elk cijfer komt uit de activiteitenlog en is herleidbaar naar records; geen handmatig ingevoerde KPI's.
- Een vergelijking toont altijd het aantal waarop hij rust; onder de minimumaantallen staat "Te weinig om te vergelijken".
- Coachingnotities hebben twee soorten: "Afspraak" (zichtbaar voor de accountmanager) en "Privé" (alleen managers van dat team).
- De Coach-agent stelt voor, de manager beslist; een coachingpunt verschijnt nooit bij de accountmanager zonder dat de manager het deelt.

**Uit het verkoopverhaal (F25).** Norm "Nieuwe gesprekken in primair of hoog": gezond twee derde of meer, aandacht de helft tot twee derde, risico minder dan de helft. Winpunt uitgevoerd tegen norm 90 procent; rapport "Verloren aan" (nee met een concurrent) per concurrent en branche; ambitiedoelen als voortgangsbalk; na een nieuwe bevestigde verhaalversie de oefening "Vertel ons verhaal in twee minuten" in de coachingkaart; de wekelijkse bundel suggesties naar SalesDNA vrijgeven.

**Op de telefoon (8.12).** Team en coaching zijn op de telefoon bruikbaar; analyse met grafieken alleen lezen.

#### Technisch

- `coaching_sessies: id, organisation_id, gebruiker_id, manager_id, datum, data {cijfers (momentopname), punten[{tekst, onderbouwing, artikelId?}], afspraken[{tekst, termijn, status}], gesprekken[activiteitIds], reactie?}`; `coaching_notities: id, organisation_id, gebruiker_id, manager_id, soort ('afspraak'|'prive'), tekst, op`.
- Afgeleide tabellen (dagelijkse job): `nb_kpi_dag (organisation_id, gebruiker_id, datum, metriek, waarde)`, `nb_conversies`, `nb_script_resultaten`, `nb_regel_resultaten`.
- Pure functies: `kpi(gebruiker, periode, activiteiten)`, `funnelStand` (F17), `aandachtspunten(team, kpis, normen)`, `coachVoorstel(kpis, team, verslagen)` (AI, schema `{punten[{tekst, onderbouwing {cijfers[], bron}, artikelSleutel}]}`, maximaal drie).
- Endpoints: `GET /api/team?team=&periode=`, `GET /api/coaching/:gebruiker`, `POST /api/coaching/:gebruiker/sessie`, `PUT /api/coaching/sessie/:id`, `GET /api/analyse/:tabblad?filters`, `GET /api/resultaten/mij`.
- Rechten: server-side alleen eigen teams; privénotities nooit naar de accountmanager.
- Acceptatie: de teamtabel klopt met de onderliggende lijsten; een coachingpunt is pas zichtbaar voor de accountmanager na "Deel"; een vergelijking onder het minimum toont de melding; CSV-export bevat precies de getoonde rijen.

---

### F21 Helpcenter: hoe werkt Dealtrace en new business-academie

**Beslissing B10.** Een helpcenter met twee collecties: **"Hoe werkt Dealtrace"** (per scherm en feature) en **"New business"** (hoe win je nieuwe klanten). Elke functie heeft een artikel; zet de salesmanager een functie aan, dan krijgt de gebruiker dat artikel als eerste uitleg, en de coaching verwijst naar artikelen. Er zijn geen leerpaden per niveau (B19).

#### Functioneel

**Routes**: `/help` (startpagina), `/help/:collectie/:artikel`, en de flyout "Hulp" vanuit elke paginakop.

**Startpagina**: zoekveld ("Waar kunnen we je mee helpen?"), drie blokken: "Voor jou" (de artikelen van functies die net voor je aan zijn gegaan en "Aan de slag"), "Hoe werkt Dealtrace" (categorieën), "New business" (categorieën), plus "Nieuw en bijgewerkt" en "Vraag AI" (de AI-assistent, F26).

**Artikelpagina**: titel, leestijd, niveau-pil, categorie, inhoud (tekst, schermafbeeldingen, korte video, stappen), "Probeer het" (knop die het scherm opent waar het over gaat), "Was dit nuttig?" (ja of nee met reden), gerelateerde artikelen, laatst bijgewerkt.

**Contextuele hulp**: de knop "Hulp" in elke paginakop opent het artikel van dat scherm in een flyout (560 px). Functies die niet aanstaan, linken naar hun artikel. Lege staten kunnen een link "Lees hoe het werkt" hebben.

**Vraag AI**: de AI-assistent (F26) beantwoordt vragen over Dealtrace uit de artikelen van het helpcenter (en, als de organisatie dat aanzet, uit de eigen kennisbank), met citaten en links naar de artikelen; geen antwoord zonder bron ("Daar staat nog niets over in het helpcenter. Je vraag is doorgestuurd.") en de vraag komt bij de beheerder of founder als signaal voor een nieuw artikel. Een vraag kost credits van de organisatie (F26).

**Aan de slag**: vijf artikelen die elke nieuwe gebruiker als eerste ziet: Je eerste dag in Dealtrace · Vandaag lezen en afronden · Een belblok uitvoeren met een script · Een afspraak plannen, afronden en overdragen · Waarom vijf pogingen werken. Een artikel telt als gelezen na het openen en scrollen tot het einde (of na "Markeer als gelezen"); lezen is nergens een voorwaarde voor.

**Collectie "Hoe werkt Dealtrace"** (één of meer artikelen per feature, F01 tot en met F24), bijvoorbeeld:

- Aan de slag: Je eerste dag · Je werkplek: binnendienst of buitendienst · Je niveau en functies die aanstaan · Chatten met de AI-assistent · Meldingen instellen · Dealtrace op je telefoon en offline.
- Dagelijks werk: Vandaag · Een taak afronden met een uitkomst · Wat betekent poging 3 van 5 · Concepten goedkeuren en versturen · De belmodus · Een belscript kiezen · Bezoeken en kansen langs de route · Een bezoek afronden met een verslag · Briefing en Pitstop.
- Prospects: Een prospect toevoegen · De accountkaart lezen · Buying committee · Nee met reden en afkoelperiode · De prospectreis en fases · Leadgenerator · Importeren · KvK en Datacollectief.
- Plannen en sturen: Belblokken · Prospectplanning · Hercontactritme · Campagnes · De funnel van je prospectreis · Gebieden en regiodagen.
- Inrichten (beheerder): Gebruikers, rollen en niveaus · Belscripts maken · Eigen velden · Regels · Accountmatrix · Doelgroepen en reizen · Agents en mandaten · Koppelingen · Abonnement, verbruik en AI-credits.
- Voor de salesmanager: Team controleren · Coachingsgesprek voorbereiden · Analyse lezen · Verbetervoorstellen beoordelen.

**Collectie "New business"** (de academie; korte praktische artikelen, elk met "Zo doe je het in Dealtrace"):

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

Elk new business-artikel heeft de vaste opbouw: "Waarom dit werkt" (een alinea), "Zo doe je het" (stappen), "Voorbeeld" (een kort voorbeeldgesprek of voorbeeldmail met verzonnen bedrijven), "Valkuilen" en "Zo doe je het in Dealtrace" (met "Probeer het").

**Beheer van artikelen**

- Platformartikelen beheert de founder (Platformbeheer, F23); ze gelden voor alle organisaties en hebben versies.
- Een beheerder kan **eigen artikelen** toevoegen voor zijn organisatie (bijvoorbeeld het eigen verkoopverhaal, productinformatie, het eigen bezwarenboek) en platformartikelen verbergen.
- Editor: titel, collectie, categorie, niveau, samenvatting, inhoud in Markdown met afbeeldingen en video-link, gekoppelde schermen (route), gekoppelde features, controlevragen, status (concept, gepubliceerd), "Bekijk als Beginner".
- Statistiek per artikel: gelezen, nuttig, niet nuttig met reden, zoektermen zonder resultaat.

**Uit het verkoopverhaal (F25).** Artikelen "Ons verhaal", "Onze belofte", "Tegen wie we verkopen", "Eén winpunt per gesprek", "Wanneer we iemand terugbellen", met de inhoud uit het leesmodel van de eigen organisatie. **Mobiel**: artikelen "Dealtrace op je telefoon", "Een dag offline", "Inspreken in plaats van typen"; de artikelen van de functies die voor je aanstaan, staan in het dagpakket.

#### Technisch

- `help_artikelen: id, organisation_id (null = platform), collectie ('product'|'newbusiness'), categorie, slug, titel, niveau, status, versie, data {samenvatting, inhoud (markdown), routes[], features[], vragen[], videoUrl?}, gepubliceerd_op`.
- `help_gelezen: organisation_id, gebruiker_id, artikel_id, op, vragenGoed?`; `help_feedback: artikel_id, gebruiker_id, nuttig, reden?`; `help_zoekopdrachten: organisation_id, term, resultaten, op`.
- Zoeken met Postgres full-text search (Nederlands, `to_tsvector('dutch', ...)`); de AI-vraag gebruikt dezelfde zoekresultaten als materiaal (geen aparte vectorindex nodig bij honderden artikelen) met bewijsplicht op citaten.
- Startinhoud: de artikelen staan als Markdown in de repository (`content/help/`) en worden bij een release in de tabel geladen (platformlaag); dat maakt review via pull requests mogelijk.
- Endpoints: `GET /api/help?zoek=&collectie=&niveau=`, `GET /api/help/:slug`, `POST /api/help/:id/gelezen`, `POST /api/help/:id/feedback`, `POST /api/assistent/vraag` (AI, F26), `POST/PUT /api/help` (beheer).
- Acceptatie: de hulpknop op elk scherm opent het juiste artikel; de AI-assistent geeft nooit een antwoord zonder citaat uit een artikel; een eigen artikel van organisatie A is onzichtbaar voor B.

---

### F22 Instellingen

#### Functioneel

**Route**: `/instellingen` (beheerder; een salesmanager ziet de teamonderdelen). Startpagina met kaarten in vier groepen; elke kaart zegt in één regel wat hij regelt en de stand ("21 regels, 19 door de motor").

| Groep | Onderdeel | Feature |
|---|---|---|
| Organisatie | Organisatie (naam, logo, land, verkoopjaar, werkdagen en feestdagen) · Gebruikers, rollen, teams, niveaus en functies · Abonnement en facturen · Verbruik en AI-credits · Audit | F23, F26 |
| Verkoop | Verkoopverhaal (acht onderdelen, eigen inrichting of SalesDNA per onderdeel, F25) · Doelgroepen · Prospectreizen · Belscripts · Mailsjablonen · Meetingsoorten en uitkomsten · Campagnesoorten · Redenen voor nee en terugkomregels | F05, F08, F09, F12, F25 |
| Ritme en regels | Accountmatrix en ritmes · Hercontactritmes · Activity selling-regels · Gebieden · Capaciteit en dagplafonds | F13, F15, F16, F18 |
| Data en AI | Eigen velden · Koppelingen (KvK, Datacollectief, CRM, agenda, mail, telefonie, DealDrive) · Agents en mandaten · Waarnemer en signaalregels · Agent-prompts (vanaf Plus) · Kanalen en consent · Bel-me-niet-lijst · Privacy en bewaartermijnen | F02, F14, F19 |

Persoonlijke instellingen (iedereen, via het gebruikersmenu "Mijn instellingen"): profiel, werkplek, thuisbasis voor routes, kaartapp voor navigeren, offline dagpakket, toestellen en sessies, belblokken en lunch, meldingen en stille uren, gekoppelde agenda en mailbox, "Toon minder", mijn scripts (Gevorderd), mijn regels (Expert).

**Verkoopverhaal**: de acht onderdelen uit F25 (golden circle, bedrijfsverhaal, ambitie en visie, waarde en belofte, branches, concurrenten, winpunten, terugkomregels), per onderdeel de bron (eigen inrichting of SalesDNA), statussen concept en bevestigd met versies, de mappings (branche naar SBI, SalesDNA-fase naar reisfase, verliesreden naar terugkomreden) en het stijlprofiel (toon, passende woorden, te vermijden woorden; door AI voorgesteld uit het verhaal). Inhoud per branche in plaats van per segment. Voor iedereen leesbaar op `/richting`.

**Gebruikers**: lijst met naam, e-mail, rol, team, niveau (segmentknoppen Beginner, Gevorderd, Expert), werkplek, plafond voor AI-credits, laatste inlog, status; "Gebruiker toevoegen" binnen de seats of "Gebruiker aanvragen" (afhankelijk van de stand die de founder zette, F23); archiveren; niveau verlagen vraagt bevestiging. Vangrails: niet jezelf, niet de laatste beheerder.

**Regels voor instellingen**: elke wijziging wordt per veld na 600 ms stilte bewaard met zichtbare status ("Opslaan…", "Opgeslagen", "Opslaan mislukt"); elke wijziging is een auditregel; sleutels die de leverancier beheert (pakket, AI-credits, features per niveau, platformprompts) zijn nooit via deze pagina's te schrijven.

#### Technisch

- `org_settings (organisation_id, key) → value jsonb` met een vaste lijst sleutels in `shared/settingKeys.ts`; `VERBORGEN_KEYS` (pakket, aiCredits, features, platformprompts) worden aan de leeskant gefilterd en aan de schrijfkant geweigerd.
- Eigen tabellen voor alles met versies of veel rijen: reizen, belscripts, eigen velden, meetingsoorten, hercontactritmes, regels, help-artikelen, koppelingen.
- Endpoints: `GET /api/settings`, `PUT /api/settings/:key`, plus de endpoints per feature.

---

### F23 Platformbeheer in de app (geen aparte HQ)

**Beslissing B4.** DealDrive had een aparte founder-console (HQ) op een eigen domein met een eigen build, een eigen zijbalk en impersonatie via een ondertekend token over twee domeinen. Dealtrace heeft **één app, één domein, één build**. Alle HQ-functies zitten in de app als afgeschermde sectie **"Platformbeheer"** voor de rol founder, en een kleinere spiegel voor de beheerder van een klantorganisatie.

#### Functioneel

**Wie ziet wat**

| Onderdeel | Founder | Beheerder klant | Salesmanager | Accountmanager |
|---|---|---|---|---|
| Klanten (organisaties) en gebruikers | alle organisaties | eigen gebruikers, aanvragen | geen | geen |
| Abonnement en pakket | zetten per klant, credits per pakket en extra credits | eigen pakket lezen, upgrade en extra credits aanvragen, credits verdelen | geen | eigen creditstand zien |
| Facturen | alle facturen, marge | eigen facturen, betalen, factuurgegevens | geen | geen |
| AI-verbruik en credits | alle klanten, credits per pakket, extra credits en prijs per handeling zetten | eigen verbruik in credits, plafond per gebruiker | eigen organisatie lezen | eigen verbruik |
| AI-koppeling (LLM-connector) | platform en per klant | één leesregel ("Claude, verwerking in de EU") | geen | geen |
| Agent-prompts | platformlaag, afwijkingen per klant | eigen laag (vanaf Plus) | geen | geen |
| Help-artikelen | platformartikelen | eigen artikelen | geen | geen |
| Roadmap | bord over alle klanten | indienen, stemmen, samenvoegen | indienen, stemmen | indienen, stemmen |
| Motor en platformstatus | alle runs | geen | geen | geen |
| Audit | platformaudit | eigen auditlog inclusief wat de leverancier deed | eigen teams | geen |

**Routes**: `/platform/klanten`, `/platform/abonnementen`, `/platform/features`, `/platform/facturen`, `/platform/verbruik`, `/platform/ai`, `/platform/prompts`, `/platform/help`, `/platform/roadmap`, `/platform/motor`, `/platform/audit`. Voor de beheerder: `/instellingen/gebruikers`, `/instellingen/abonnement`, `/instellingen/verbruik`, `/instellingen/prompts`, `/instellingen/audit`. Voor iedereen: `/roadmap`. Na inloggen landt de founder op `/platform/klanten` zolang hij niet in een organisatie werkt.

**Features per niveau** (`/platform/features`): een raster met alle functies uit de catalogus als rijen en Beginner, Gevorderd en Expert als kolommen; per cel aan of uit. Bovenaan de keuze "Alle organisaties" of één organisatie (afwijking, met een gele markering per afwijkende cel). Elke wijziging werkt direct, met een auditregel en de knop "Draai terug". Hiermee legt de founder per sprint de indeling uit 4.3 vast (B18).

**Klanten**

- Meetlat: Klanten (verdeling Gezond, Let op, Risico, Leeg), Gebruikers (met login), Maandomzet (alleen actieve contracten), AI-kostprijs deze maand, Aandacht (aantal signalen).
- Tabel: Klant, Pakket, Gebruikers ("8/9 met login"), Laatst actief, AI-kosten, Stand (met redenen bij hover), knoppen "Openen" en "Werk in deze organisatie".
- **Gezondheid** (vaste regels, geen score): 0 gebruikers is Leeg; niemand met login, nooit activiteit, meer dan 30 dagen geen activiteit of 0 accounts is Risico; minder dan de helft met login, 15 tot 30 dagen stil, taken zonder afronding in 30 dagen, motor 14 dagen zonder resultaat, of minder dan de afgesproken eerste gesprekken per verkoper per week is Let op. Activiteit telt breed: pogingen, berichten, nieuwe prospects, afspraken. Vooraf berekend in `org_gezondheid` (elk uur).
- **Nieuwe klant**: organisatienaam, pakket (standaard Starter, of proefperiode met einddatum), contact en adres, eerste beheerder (naam en e-mail); de server maakt de organisatie met de **startset** (klassen, standaardreis, 23 regels, 6 belscripts, 4 hercontactritmes, 6 meetingsoorten, 8 campagnesoorten aan, redenen voor nee met afkoelperiodes, signaalregels, eigen velden-voorbeelden, help-artikelen) en stuurt de uitnodiging.
- **Klantflyout** (eigen URL `?klant=`): contactgegevens; contract en abonnement (status Proef, Actief, Opgezegd; prijs, start, looptijd, opzegtermijn, "Loopt tot … · opzeggen vóór …"); gebruikers en aanvragen (stand "Aanvragen via ons" of "Zelf toevoegen binnen de seats"); AI-koppeling; agent-prompts; functievlaggen per groep ("live", "voorbereid", "pakket te laag"); AI-kosten; gebruik en gezondheid; **Data en AVG** (gebruikte bronnen, verrijkte contacten, bewaartermijnen, verwerkersovereenkomst, verwijderverzoeken).

**Werken in een organisatie** (vervangt instappen over twee domeinen)

1. "Werk in deze organisatie" of de organisatiekeuze bovenin de zijbalk (alleen founder).
2. Venster "Werken in Van Dijk Installatie" met verplichte reden (minimaal 5 tekens, bijvoorbeeld een ticketnummer) en de keuze "Alleen meekijken" (standaard) of "Ook wijzigen".
3. De server controleert rol en tweestapsverificatie, schrijft een auditregel bij het platform én bij de klant, en zet een ondertekende httpOnly-cookie met organisatie, modus, reden en vervaltijd (maximaal 8 uur).
4. Gele balk bovenaan elke pagina: "Je werkt in Van Dijk Installatie als founder · alleen meekijken · nog 7 uur 42 · Terug naar platform".
5. In "Alleen meekijken" weigert de server elke schrijfactie in klantdata ("Je kijkt mee in deze organisatie; schakel over naar wijzigen om iets aan te passen."). Overschakelen vraagt opnieuw een reden.
6. De beheerder van de klant krijgt bij elke start een melding met naam, reden en modus. Per organisatie instelbaar: "Toegang leverancier: altijd" of "Alleen na toestemming" (de beheerder keurt een verzoek eerst goed).

**Abonnementen**: pakketten Starter, Plus, Compleet met per pakket de functies en de databronnen (AI-zoeker, KvK, Datacollectief, webonderzoek), seats, maandplafonds voor KvK en Datacollectief en **AI-credits per gebruiker per maand** (F26, 11.4); matrix "Welke inhoud?" met "Vergelijk met klant"; een pakketwissel vraagt bevestiging met wat de klant wint of verliest en wordt geaudit; prijzen per pakket en per seat als gegeven met geldig-vanaf; proefperiode met automatische afwaardering en melding 7 dagen vooraf. De beheerder ziet zijn pakket in gewone woorden, seats in gebruik, contract en "Upgrade aanvragen".

**Facturen**: Stripe Billing als bron van abonnementen, seats, facturen en incasso (SEPA, iDEAL, kaart); betaalde facturen naar de boekhouding (Moneybird) als synchronisatie; extra AI-credits en extra databronverbruik als factuurregel; achterstallig pauzeert automatisch AI-werk (niet de app); de founder ziet marge per klant (gefactureerd tegen AI- en datakosten). De beheerder ziet eigen facturen met pdf, betaalknop, factuuradres en btw-nummer.

**AI-verbruik**: elke AI-aanroep in het logboek met de credits die hij kostte; per organisatie de pot AI-credits en het verbruik per soort en per gebruiker (11.4), los daarvan de externe databronnen (KvK, Datacollectief); melding bij 80 procent, blokkade bij 100 ("Je maandbundel voor dossiers is op."); de founder ziet kosten in euro's per model en soort, de beheerder alleen handelingen.

**AI-koppeling**: oplosketen (organisatie, platform, omgeving, mock); provider Claude als standaard (webonderzoek alleen via Claude vanwege de broncontrole), andere providers per functie mogelijk; sleutel versleuteld en schrijf-alleen; "Test verbinding"; verwerkingsregio en "geen training" vastgelegd per provider.

**Agent-prompts**: per slot (belscript-invulling, mailconcept, LinkedIn-bericht, briefing per soort, beoordelingsvraag, verbetervoorstel, coachvoorstel, helpvraag) de keten organisatie, platform, code; vast kader dat geen prompt kan opheffen; versies met auteur (maximaal 10 per slot); proefdraai op voorbeelddata.

**Roadmap**: iedereen dient wensen in en stemt binnen de eigen organisatie; statussen Ingediend, In ontwikkeling, Niet gedaan, Opgeleverd; de founder ziet het bord over alle klanten met aantal organisaties per wens, prioriteit, link naar de klantflyout, en "Maak issue" (GitHub) met de bestaande bouwketen (altijd een pull request, nooit een merge).

**Motor**: laatste runs per organisatie, fouten per stap, AI-tellingen, kosten per run, "Draai opnieuw voor deze klant".

#### Technisch (beveiliging: de client verbergt, de server weigert, de database zegt nee)

- **Rol**: `founder` staat in de rolkolom maar geen enkel API-schema accepteert hem; een databasetrigger weigert een update naar founder behalve door de migratierol. Founders zitten in de systeemorganisatie "Dealtrace" zonder klantdata.
- **Tweestapsverificatie** (TOTP) verplicht voor de founder; elk platformendpoint controleert het verificatieniveau; gevaarlijke acties (organisatie verwijderen, pakket verlagen, AI-sleutel wijzigen, platformprompt opslaan, wisselen naar "Ook wijzigen") vragen herbevestiging binnen 15 minuten; platformsessies vervallen na 12 uur inactiviteit.
- **Twee lagen op de server**: middleware weigert `/api/platform/**` voor iedereen zonder founderrol met 404, en elk endpoint roept zelf `requireFounder(event)` aan. Een bouwcheck `check:platform` faalt als een platformendpoint die aanroep mist of een gewoon scherm een platformroute aanroept.
- **Database**: de app verbindt met `dealtrace_app` zonder `bypassrls`; een tweede rol `dealtrace_platform` (ook zonder `bypassrls`) is de enige die de security-definer-functies mag uitvoeren die over organisaties heen kijken (lijst organisaties, gezondheid, verbruik per organisatie, roadmap, motor run-all); die functies geven geaggregeerde getallen, nooit klantrecords. Klantdata lees je alleen door te werken in de organisatie, en dat staat in de audit.
- **Organisatie uit de sessie**: gewone endpoints nemen de organisatie nooit uit de payload; de werk-in-cookie bepaalt de actieve organisatie voor de founder.
- **Audit**: `platform_audit` (append-only: actor, actieve organisatie, handeling, object, voor en na, reden, ip, tijd) plus een kopie in `audit_events` van de klant.
- **Geheimen** per doel: `LLM_KEY_SECRET`, `ORG_WISSEL_SECRET`, `MOTOR_SECRET`, `STRIPE_WEBHOOK_SECRET`, `PLATFORM_HOOK_SECRET`, `GITHUB_TOKEN`, `MONEYBIRD_TOKEN`; rotatie elk half jaar.
- **Bundel**: de platformschermen zitten in een eigen, lui geladen deel van de bundel met een routebewaker (gemak, geen beveiliging).
- **Tests**: cross-tenant in de wegwerp-Postgres: een beheerder kan geen platformfunctie uitvoeren, kan pakket, credits of prompts niet via de instellingen schrijven, en een founder in "Alleen meekijken" kan niets schrijven.
- Tabellen: `organisations` (met `pakket`, `features`, `contract`, `stripe_customer_id`), `pakketprijzen`, `facturen`, `gebruikersaanvragen`, `llm_connections`, `prompt_versies`, `feature_requests`, `org_gezondheid`, `platform_audit`.
- Hergebruik uit DealDrive: `admin/index.vue` (klanten), `admin/abonnementen.vue`, `admin/facturen.vue`, `admin/prompts.vue`, `admin/roadmap.vue`, `server/api/superuser/*`, `promptBibliotheek.ts`, `llm-provider.ts`, `pakketten.ts`, `featureRequestStore.ts`, `github.ts`. Vervalt: `AdminShell.vue`, `impersonatieToken.ts`, `DEALDRIVE_APP=hq`, het tweede domein.

---

### F24 Meldingen, zoeken, mobiel en offline

#### Functioneel

**Meldingen**

- Bel onderaan de zijbalk met rode teller; pagina `/meldingen` met rijen (kleurbalk per soort: kritiek rood, hete aanleiding paars, dagstart blauw, herinnering geel, inzicht groen), "Openen", "Markeer gelezen", "Verberg".
- Soorten: herinnering (taak of afspraak), dagstart (zelfgekozen tijd, standaard 07:45 zoals in 8.10: afspraken, taken van vandaag, top 3 aanleidingen), nieuwe hete aanleiding bij een eigen account, concept klaar ter goedkeuring, afspraak gemaakt door een collega voor jou, kans klaargezet door de binnendienst, campagne loopt achter, functie voor je aangezet, coachingafspraak gedeeld, AI-credits op 80 procent, leverancier werkt in je organisatie (beheerder), databronnen KvK of Datacollectief op 80 procent van het maandplafond (beheerder).
- Kanalen: in-app, e-mail, web-push (PWA); per soort aan of uit en stille uren in Mijn instellingen; tijdens een belblok met "meldingen stil" worden ze vastgehouden tot het einde.

**Globaal zoeken** (Ctrl K of `/`): prospects, klanten, contacten, campagnes, helpartikelen; per soort gegroepeerd met telling; pijltjes, Enter, Escape; accent- en hoofdletterongevoelig; functies die niet aanstaan met slot en uitleg.

**Mobiel en buitendienst**: zie hoofdstuk 8 (mobiele schil met onderbalk, schermen op 390 px, onderweg-functies, spraak, push en de offline dag). F24 levert de basis: PWA met installatievraag (iOS-uitleg), Web Push, de synchronisatiewachtrij en de offline-indicator.

**Offline**

- Lezen: Vandaag, de route van vandaag en morgen, de accountkaarten van de accounts in je route, taken en afspraken van deze week staan in IndexedDB.
- Schrijven: afronden, uitkomst, verslag (tekst; spraak wordt lokaal getranscribeerd waar de browser dat kan, anders als opname bewaard tot er verbinding is), nieuwe prospect, nieuwe taak en afspraak gaan in de synchronisatiewachtrij.
- Strook onder de kop (geel, 8.3) "Offline · 3 wijzigingen wachten"; bij een vastgelopen wachtrij wordt hij rood met "Opnieuw proberen". De meldingsstrook zegt bij elke handeling "Bewaard op je telefoon, wordt verstuurd zodra je verbinding hebt".
- Conflicten: versiecontrole per record; bij een conflict een venster met beide versies en "Houd mijn versie", "Neem de andere over"; pogingen zijn idempotent op item en stap.

#### Technisch

- Notificaties: `notificaties: id, organisation_id, gebruiker_id, soort, titel, tekst, link, gelezen, op`; `push_subscriptions`; sweeps elke 5 minuten (herinneringen) en elke 15 minuten (dagstart).
- Offline: Dexie (IndexedDB), `useSyncQueue`, `POST /api/sync/mutations` met allowlist en rechtencheck per mutatie, `server_records` als versiegrootboek, `POST /api/sync/conflict-check`.
- Hergebruik: `NotificationBell.vue`, `notificaties.vue`, `PushSoftPrompt.vue`, `useWebPush.ts`, `OfflineBanner.vue`, `useSyncQueue.ts`, `useOptimisticWrite.ts`, `ConflictResolveModal.vue`, `utils/offlineDb.ts`, `InstallPrompt.vue`, `IOSInstallModal.vue`.

---

### F25 Verkoopverhaal en Richting (SalesDNA-sublagen)

**Bron.** De bijlage "SalesDNA-sublagen voor Dealtrace" (versie 1, 14 oktober 2026), gebaseerd op de code van SalesDNA en de fictieve demo Testbedrijf Voltvast. Beslissing B16.

#### Functioneel

**Kern.** Elk script, elke boodschap, briefing en campagne in Dealtrace vertelt hetzelfde verhaal: wie we zijn, waar we naartoe willen, wat we beloven, voor welke branches, tegen wie we verkopen, waarom we winnen en wanneer we terugkomen. Dat verhaal komt uit zeven sublagen van SalesDNA plus de golden circle. Een organisatie met SalesDNA spiegelt ze; een organisatie zonder SalesDNA vult ze zelf in, in dezelfde vorm. Alle functies lezen uit één leesmodel en weten niet welke bron actief is; ze tonen alleen de herkomst (ADR-017).

**De acht onderdelen**

| Onderdeel | SalesDNA | Inhoud | Waar het in Dealtrace terugkomt |
|---|---|---|---|
| Golden circle | L0.11 | waarom, hoe, wat | Opbouw van elke boodschap (11.5) |
| Bedrijfsverhaal | L0.1 | "Wie zijn wij", kernzin, verhaal per branche | Opening van belscripts (F08), briefing "Eerste gesprek" (F11), oefening in coaching (F20) |
| Ambitie en visie | L0.2 | ambitie, visie, missie; ambitiedoelen | Ambitietoets bij een doelgroep (F05), visievraag in scripts, voortgang in analyse (F20) |
| Waarde en belofte | L0.4 | kernbelofte, waardestatement, algemeen en per branche | `{belofte}` in boodschappen en scripts, in de overdrachtsbriefing |
| Branches | L0.6 | naam, focus (primair, secundair), horizon (huidig, toekomstig), termijn, prioriteit | Doelgroepen (F05), leadgenerator via SBI (F02), weging in Vandaag en belblokken, norm in F20 |
| Concurrenten | L0.8 | soort (direct, indirect, intern, niets doen), sterk, zwak, onderscheid, "Zo zeg je het", "Als de klant zegt", bewijs, "Wanneer we verliezen" | Huidige leverancier op de accountkaart (F03), bezwaren in scripts en belmodus (F07, F08), "Verloren aan" bij een nee (F03), doelgroep "Overstappers van …" |
| Winpunten | L2.1 | per fase: titel, omschrijving, waarom wij winnen, concurrenten, impact, bijlagen | Eén winpunt per bericht (11.5), Pitstop (F11), campagnes (F12), eerste afspraken (F09), coaching (F20) |
| Terugkomregels | L3.14 | twee lijsten (verloren, slapend): reden, termijn, kanaal, klassen, rollen, aanpak | Terugkomdatum na nee, verlies of slapen (F13, 7.4) |

**Terugkomregel en hercontactritme zijn twee begrippen** (ADR-018). Een **hercontactritme** is de reeks pogingen bij geen reactie (dag 0, 3, 7, 12, 21, parkeren; F13). Een **terugkomregel** zegt wanneer en waarom je na een nee, een verlies of een slapende periode terugkomt ("Prijs te hoog: over een halfjaar, bezoek door de accountmanager, met een klantverhaal over de kosten van wachttijd"). Op de terugkomdatum start de regel een hercontactritme op het kanaal en bij de rol uit de regel.

**Route**: `/richting`, voor iedereen leesbaar, met tabbladen Verhaal, Richting, Belofte, Branches, Concurrenten, Winpunten, Terugkomen. Inrichten in Instellingen, Verkoop, Verkoopverhaal (beheerder en salesmanager).

**Opbouw van `/richting`**

1. Kop: kicker "RICHTING · VERKOOPVERHAAL", titel "Ons verhaal", rechts de bron ("Uit SalesDNA · bijgewerkt 12 okt" of "Eigen inrichting") en voor de beheerder "Inrichten" of "Wijzigen doe je in SalesDNA".
2. Tabbladen. Elk tabblad toont per onderdeel de status ("Bevestigd · versie 3", "Concept", "Mogelijk verouderd in SalesDNA") en bij inhoud per branche de **dekking** ("2 van 4 branches hebben een eigen verhaal").
3. **Verhaal**: de kernzin groot, het volledige verhaal, daaronder per branche een kaart; een branche zonder eigen verhaal toont "Voor Woningcorporaties is nog geen eigen verhaal; je ziet het algemene verhaal."
4. **Richting**: ambitie, visie, missie; de ambitiedoelen als voortgangsbalk ("Projectpartners: 112 van 400, doel 2029").
5. **Belofte**: algemeen en per branche, met het waardestatement als uitklap "Als de klant doorvraagt".
6. **Branches**: tabel met focus, horizon, termijn, prioriteit, aantal accounts en het aandeel gesprekken van dit kwartaal.
7. **Concurrenten**: per concurrent een kaart met de negen velden; "Download concurrentiekaart" (PDF, Gevorderd).
8. **Winpunten**: per fase van de reis de winpunten met impact en bewijs; een fase zonder winpunt toont het gat ("Geen winpunt in Signaal en Kennismaking").
9. **Terugkomen**: de twee lijsten met reden, termijn in dagen, kanaal, rollen, aanpak, en per regel het hercontactritme dat start.

**Statussen en versies**

- Elk onderdeel heeft een status (concept of bevestigd) en een versienummer. **Alleen bevestigde inhoud gaat naar buiten**: scripts, boodschappen en briefings gebruiken de laatst bevestigde versie.
- Is een onderdeel in SalesDNA "Mogelijk verouderd", dan werkt Dealtrace door met de laatst bevestigde versie en toont het label "Mogelijk verouderd in SalesDNA" op `/richting` en in de bronregel van elk concept.
- SalesDNA zet bij een gewijzigd blok per branche niets op verouderd; Dealtrace kijkt daarom naar het versienummer en `bijgewerkt_op`, niet alleen naar de vlag.
- Elk concept, script en verstuurd bericht bewaart de gebruikte versies (`vvVersies`), zodat win en verlies aan een versie te koppelen zijn.

**Terugval per branche.** Voor elk onderdeel met blokken per branche: het blok van de branche van het account, anders het algemene onderdeel, met zichtbaar gat.

**Eigen inrichting zonder SalesDNA.** Instellingen, Verkoop, Verkoopverhaal heeft dezelfde acht onderdelen met dezelfde veldnamen en keuzewaarden als SalesDNA, zodat later koppelen zonder mapping kan. Minimale velden voor de basiswerking:

| Onderdeel | Minimaal |
|---|---|
| Golden circle | waarom, hoe |
| Bedrijfsverhaal | wie zijn wij (de kernzin wordt afgeleid en is te overschrijven) |
| Ambitie en visie | visie |
| Waarde en belofte | kernbelofte, waardestatement |
| Concurrenten | per regel naam, soort, onderscheid, "Zo zeg je het", "Als de klant zegt" |
| Branches | per regel naam, focus |
| Winpunten | per regel titel, fase, omschrijving, waarom wij hier winnen; hooguit drie op impact hoog |
| Terugkomregels | per regel reden, termijn, kanaal, aanpak |

- Een nieuwe organisatie krijgt een lege inrichting met de knop "Kopieer uit startset" (Bijlage C), nooit een stille standaard: een verhaal hoort van de organisatie zelf te zijn.
- Zonder bevestigd verhaal werkt Dealtrace met de vaste teksten en terugvalzinnen van de scripts en toont `/richting` "Jullie verkoopverhaal is nog niet vastgelegd." met een link voor de beheerder.
- Een lichte verouderingsregel: wijzigt Branches of de kernbelofte, dan krijgen Concurrenten en Winpunten het label "Controleren" tot iemand "Klopt nog" kiest of opnieuw bevestigt.
- **AI schrijft nooit een winpunt**, ook niet in de eigen inrichting: AI stelt alleen vragen ("Waarom kiest een installateur in de woningbouw voor jullie en niet voor de keten?").

**Overstappen tussen bronnen**

- Eigen naar SalesDNA: per onderdeel "SalesDNA wordt de bron" (eigen inhoud naar archief, verwijzingen via naam gemapt met een controlelijst) of "Eerst vergelijken" (naast elkaar).
- SalesDNA naar eigen: bij ontkoppelen wordt de laatst bevestigde spiegel gekopieerd naar de eigen inrichting met herkomst `salesdna`; vanaf dan bewerkbaar.
- Mengvorm per onderdeel mag: een onderdeel dat in SalesDNA leeg is, blijft eigen.

**Eigen aanvullingen naast de spiegel.** Wat SalesDNA niet kent, bewaart Dealtrace zelf en is altijd bewerkbaar: varianten per kanaal en rol (belzin van 20 seconden, eerste mailregel, bezoekopening; AI maakt ze als concept, de salesmanager keurt goed), de SBI-mapping per branche, de termijn als datum, concurrentcontext per branche en regio, winpunt per branche, eigen bewijs (klantcase, cijfer), de termijn van een terugkomregel in dagen, de mapping van Dealtrace-redenen naar SalesDNA-redenen.

**Suggesties terug naar SalesDNA.** Wat Dealtrace in de praktijk leert, gaat als suggestie met bewijs naar kader 2 van de juiste sublaag: een concurrent die vaak in verslagen voorkomt maar ontbreekt, een antwoord op een bezwaar dat aantoonbaar werkt, een branche met veel gesprekken zonder eigen belofte ("38 gesprekken in Utiliteitsinstallateurs dit kwartaal, nog geen eigen belofte"), opbrengst per terugkomregel, winpuntresultaten. Altijd met aantallen, citaten na het namenfilter, nooit namen van personen of prospects. De salesmanager geeft de wekelijkse bundel vrij; SalesDNA verandert niets zonder besluit.

**Per niveau**

| Onderdeel | Beginner | Gevorderd | Expert |
|---|---|---|---|
| Lezen op `/richting` | ● | ● | ● |
| Verhaal en belofte | Kernzin en belofte van zijn branche in script en concept; oefening "Vertel ons verhaal in twee minuten" na een nieuwe versie | Kanaalvariant kiezen; dekking zien bij een campagne | Persoonlijke variant voorstellen; resultaat per versie |
| Concurrenten | Bezwaar aanklikken in de belmodus; "Zo zeg je het" bij een huidige leverancier | Huidige leverancier zetten en filteren; doelgroep "Overstappers van …"; concurrentiekaart; "Verloren aan" | Nieuw bezwaar of antwoord voorstellen; context per branche en regio |
| Branches | Chip op het account | Filteren en plannen op branche; eigen aandeel primair zien | Branche-afleiding uit klantdata voorstellen |
| Winpunten | Het winpunt dat script of campagne kiest, met één bewijs | Winpunt kiezen per campagne en bericht; "winpunt ingezet" per eerste afspraak | Winpunt per branche en nieuw bewijs voorstellen |
| Terugkomen | Taak op de terugkomdatum met de aanpak; reden kiezen bij een nee | Terugkomdatum per account aanpassen met reden; slapende klanten als bellijst | Regel aan een pogingenreeks per campagne koppelen; opbrengst per reden |

Alles wat een Expert aandraagt, is een voorstel aan de salesmanager. De beheerder koppelt SalesDNA, kiest per onderdeel de bron, vult de eigen inrichting en beheert de mappings (branche naar SBI, SalesDNA-fase naar reisfase, verliesreden naar terugkomreden). Bij een gespiegeld onderdeel is "Bewerken" niet zichtbaar en zegt Dealtrace "Wijzigen doe je in SalesDNA, Salesbasis, Branches."

**Helpcenter (F21).** Artikelen "Ons verhaal", "Onze belofte", "Tegen wie we verkopen", "Eén winpunt per gesprek", "Wanneer we iemand terugbellen".

#### Technisch

- **Spiegel** (alleen geschreven door de webhook-ontvanger en de volledige synchronisatie): `salesdna_koppeling` (status, endpoint, geheim versleuteld, laatste event, laatste volledige sync, actieve sublagen), `salesdna_events` (event_id uniek, soort, onderwerp_id, versie, ontvangen_op, verwerkt_op, fout, payload_hash), `salesdna_sublagen` (onderwerp_id, status, versie, bevestigd_op, bijgewerkt_op, verouderd, verouderd_door, inhoud ongewijzigd), `salesdna_sublaag_versies`.
- **Leesmodel `vv_*`** (kolom `bron` = `salesdna` of `eigen`, `extern_id` = SalesDNA `_id`): `vv_sublagen`, `vv_teksten` (sublaag, sleutel, branche_id of null, tekst, kernzin, versie), `vv_branches`, `vv_concurrenten`, `vv_fasen` (met `reis_hoofdfase`), `vv_winpunten` (met `context` en `weging`), `vv_terugkomregels` (lijst, reden, termijn, `termijn_dagen`, kanaal, klassen, rollen, aanpak, `hercontactritme_id`), `vv_eigen_opties`.
- **Eigen aanvullingen** (altijd bewerkbaar): `vv_branche_mapping` (sbi_codes, doelgroep_ids, trefwoorden), `vv_concurrent_context`, `vv_winpunt_branche`, `vv_bewijs`, `vv_varianten`, `vv_ambitiedoelen`, `vv_redenmapping`.
- **Gebruik**: `accounts.vv_branche_id`, `accounts.huidige_leverancier_id`, `accounts.terug_op`, `accounts.terug_regel_id`; `activiteiten.data.vv {versies, brancheId, winpuntId?, concurrentId?, varianten[]}`; `accounts.data.neeAan` (concurrent bij een nee), `appointments.data.winpuntIngezet[]`.
- **Afgeleid**: `nb_branche_stand`, `nb_winpunt_resultaten`, `nb_concurrent_resultaten`, `nb_terugkom_resultaten`; nachtelijke job.
- **Uitgaand**: `salesdna_suggesties` (onderwerp_id, veld, regel_extern_id, soort, tekst, bewijs, status, verstuurd_op).
- **Webhook-ontvanger** `POST /api/koppelingen/salesdna/webhook`: HMAC-SHA256 over de ruwe body (`X-SalesDNA-Signature`), `X-SalesDNA-Event-Id`, `X-SalesDNA-Tijd` hooguit 5 minuten verschil; idempotent op event_id en op (onderwerp_id, versie); 2xx binnen 5 seconden, verwerking in een job. Gebeurtenissen: `sublaag.bevestigd` (volledige inhoud), `sublaag.verouderd`, `sublaag.verouderd-gesloten`, `sublaag.leeg`, `sublaag.overgeslagen`, `ping`. Bij een gat in de versienummers een volledige synchronisatie.
- **Projectie** `server/utils/vvProjectie.ts`: één functie per sublaag van spiegel naar leesmodel en één van eigen inrichting naar leesmodel; upsert op `extern_id`, verdwenen ids op `actief=false`, verwijzingen in accounts en afspraken blijven op id ("Verwijderd uit SalesDNA"); een nieuwe branche of fase zonder mapping maakt een taak voor de beheerder; scripts die een verdwenen winpunt of concurrent noemen gaan op "Controleren".
- **Pure functies** `shared/verkoopverhaal.ts`: `verhaalVoor(account, leesmodel)` met terugval per branche, `beloftevoor(account)`, `kiesWinpunt(account, fase, concurrent, weging)` (eerst "Tegen wie we hier winnen" plus huidige leverancier, dan impact, dan fase; weging onder de norm schuift naar achteren), `dekking(onderdeel)`, `terugkomDatum(reden, regels, nu)`, `kernzin(tekst)`.
- **Suggesties**: wekelijkse job bundelt hooguit 10 per sublaag, namenfilter, vrijgave door de salesmanager, `POST {salesdna}/api/koppelingen/dealtrace/suggesties` met dezelfde HMAC; status terug via `suggestie.status`.
- **Endpoints**: `GET /api/richting` (leesmodel met status, versies, dekking), `GET/PUT /api/instellingen/verkoopverhaal/:onderdeel`, `POST /api/instellingen/verkoopverhaal/:onderdeel/bevestig`, `POST /api/koppelingen/salesdna/koppel`, `POST /api/koppelingen/salesdna/sync`, `POST /api/koppelingen/salesdna/bron {onderdeel, bron}`.
- **Startset**: de Voltvast-seed (Bijlage C) als `db/seed/voltvast.ts` en als fixture voor de webhook-mock; dezelfde seed als eigen inrichting en als spiegel moet overal hetzelfde resultaat geven.
- **Acceptatie**: de tien testgevallen uit Bijlage C.9; een concept bewaart de gebruikte versies; een webhook met een ongeldige handtekening of een te oud tijdstip geeft 401 en verandert niets; een dubbel event verandert niets; zonder koppeling werkt alles met de eigen inrichting.
- **Buiten scope**: schrijven in SalesDNA buiten suggesties; de tien weergaven, kaders, meekijkronde en Kwartaal check van SalesDNA.

---

### F26 AI-assistent: chatten met AI

**Beslissing B20.** Iedere gebruiker kan chatten met AI om ondersteund te worden. Hoeveel er gechat kan worden, bepaalt het abonnement via een aantal credits.

#### Functioneel

**Kern.** "Help me, hier en nu." Een chat die weet op welk scherm je staat en bij welk account, en die antwoordt met wat Dealtrace weet: het helpcenter, het verkoopverhaal (F25), de gegevens van het account en je eigen werk. Hij legt uit, bereidt voor en stelt voor; hij voert niets uit.

| Wie | Wat | Niveau |
|---|---|---|
| Iedere gebruiker | Chatten vanuit elk scherm; antwoorden met bron; een voorstel als concept laten klaarzetten | Beginner |
| Beheerder | Credits van de organisatie zien en verdelen, een plafond per gebruiker zetten, extra credits aanvragen | rol |
| Founder | Credits per pakket vastleggen, verbruik per organisatie zien | rol |

**Waar je hem vindt**

- Op de laptop: de knop "Vraag AI" (sparkle-icoon) in elke paginakop; de chat opent als flyout rechts (480 px) en blijft open terwijl je doorwerkt.
- Op de telefoon: in de compacte kop naast de microfoon (8.3); de chat opent als schuifvenster. Inspreken werkt ook in de chat.
- In het helpcenter vervangt de chat het blok "Stel je vraag" (F21).

**Opbouw van de chat**

1. Kop: "AI-assistent", de context als chip ("Bij: Brontsma Installatietechniek" of "Scherm: Belblokken"), te verwijderen met een kruisje, en rechts de stand van de credits ("412 credits over deze maand").
2. Voorstellen bij een lege chat, passend bij het scherm: "Hoe begin ik dit gesprek?", "Welke bezwaren kan ik verwachten?", "Hoe werkt een belblok?", "Wat staat er vandaag voor mij klaar?".
3. Gesprek: elk antwoord met bronnen als chips ("Helpcenter: Om de afspraak vragen", "Verhaal: kernzin Woningbouw", "Verslag 9 okt"); geen bron, geen bewering over een account.
4. Acties onder een antwoord, altijd als concept en nooit uitgevoerd: "Zet als taak klaar", "Maak mailconcept", "Open het artikel", "Open het account".
5. Invoer met "Inspreken" en "Verstuur"; onder de invoer: "De assistent voert niets uit. Jij beslist."

**Wat de assistent mag gebruiken**

- Het helpcenter (beide collecties) en de eigen artikelen van de organisatie.
- Het bevestigde verkoopverhaal (F25): verhaal, belofte, concurrenten, winpunten, terugkomregels.
- De gegevens die de gebruiker zelf mag zien (rechtenmatrix 3.3): het account en de contacten van het scherm, de reis, de laatste contactmomenten en verslagen, de eigen taken en afspraken. Nooit gegevens van een andere organisatie, nooit privénotities van een manager.
- Geen internet, tenzij de vraag om webonderzoek gaat en de organisatie dat in haar pakket heeft (dan kost het meer credits en zegt de chat dat vooraf).

**Credits**

- Elk abonnement heeft een aantal **AI-credits per maand** per organisatie, voor alle AI-onderdelen (voorlopig, open vraag 24):

  | Pakket | Credits per gebruiker per maand (samen in één pot per organisatie) |
  |---|---|
  | Starter | 200 |
  | Plus | 600 |
  | Compleet | 1.500 |

- De credits zijn dezelfde pot als voor alle andere AI in Dealtrace (11.4). Een gewone vraag kost 1 credit; een vraag met accountgegevens of een lang antwoord 2 tot 5 credits; webonderzoek 10 credits. De chat toont vóór een dure vraag de kosten ("Dit kost ongeveer 10 credits. Doorgaan?").
- De beheerder kan per gebruiker een plafond zetten en ziet het verbruik per gebruiker; bij 80 procent van de pot krijgen beheerder en gebruikers een melding; bij 0 stopt alle AI, ook de chat, met "De AI-credits van deze maand zijn op. Je beheerder kan extra credits aanvragen."; al het werk zonder AI blijft werken.
- Extra credits vraagt de beheerder aan in Abonnement (F23); de founder zet ze direct of via de facturatie.
- Credits van een maand vervallen aan het einde van de maand.

**Regels**

- De chat valt onder de vangrails van 11.2: bewijsplicht, namenfilter, geen privégegevens, schema op acties, nooit buiten mandaat.
- Een gesprek wordt 30 dagen bewaard voor de gebruiker zelf en daarna verwijderd; de founder ziet alleen tellingen, geen inhoud.
- Vragen zonder antwoord uit het helpcenter gaan als signaal naar de beheerder of founder voor een nieuw artikel (zoals in F21).

#### Technisch

- `ai_chats: id, organisation_id, gebruiker_id, context {route, accountId?, contactId?}, gemaakt_op, verloopt_op`; `ai_chat_berichten: id, chat_id, rol ('gebruiker'|'assistent'), tekst, bronnen jsonb, credits int, op`.
- `ai_credits: organisation_id, maand, toegekend, extra, verbruikt`; `ai_credit_plafonds: organisation_id, gebruiker_id, plafond`; credits per pakket in `pakketprijzen` (F23).
- Pure functies (`shared/credits.ts`): `creditsVoor(vraag, context, soort)`, `magVragen(organisatie, gebruiker, kosten)`, `creditsStand(organisatie, maand)`.
- Endpoints: `POST /api/assistent/vraag {chatId?, tekst, context}` (streamend antwoord), `GET /api/assistent/chats`, `GET /api/assistent/credits`, `PUT /api/instellingen/credits/plafond`, `POST /api/abonnement/extra-credits`.
- AI: Claude Haiku voor eenvoudige vragen en Claude Sonnet voor vragen met accountgegevens, gekozen door `creditsVoor`; materiaal via dezelfde zoekfunctie als het helpcenter plus het leesmodel `vv_*` en de accountcontext; schema voor acties (`taak`, `mailconcept`, `artikel`, `account`); mock-provider met vaste antwoorden.
- Prestatiebudget: eerste woorden van het antwoord binnen 2 seconden.
- Acceptatie: een gebruiker zonder recht op een account krijgt geen gegevens van dat account in een antwoord; bij 0 credits geeft de server 402 met de schermtekst en werkt de rest van de app door; een actie uit de chat maakt een concept en nooit een verstuurd bericht; elk antwoord over een account heeft een bron.
- Hergebruik: `server/utils/llm-provider.ts`, `server/utils/aiVerbruik.ts`, `shared/aiBundel.ts` als basis voor de credits.

---

# Deel D · Techniek

## 10. Datamodel

### 10.1 Principes

| Principe | Uitwerking |
|---|---|
| Kernkolommen plus `data` jsonb | Een veld krijgt alleen een kolom als erop gefilterd, geteld of gejoind wordt; de hele entiteit staat in `data`, kolommen worden bij elke schrijfactie afgeleid. `null` in een patch wist de sleutel, `undefined` wist niets (overgenomen uit DealDrive `appStore.ts`). |
| Tenantgrens in de database | Elke tabel heeft `organisation_id`; RLS-policy `org_isolation` op `current_org_id()` per transactie; de app-rol heeft geen `bypassrls`; de organisatie komt uit de sessie, nooit uit de payload. |
| Template en uitvoering gescheiden | Reizen, activiteiten, belscripts, ritmes, campagnesoorten en help-artikelen hebben een versie; uitvoering verwijst naar de versie waarmee ze startte. |
| Herkomst per gegeven | `data.herkomst[veld] = {bron: 'hand'|'kvk'|'datacollectief'|'crm'|'import'|'web'|'ai'|'belgesprek'|'salesdna', op, door?, url?}`; bronprioriteit hand boven kvk boven datacollectief boven crm boven salesdna boven web boven ai boven import; een lagere bron overschrijft een hogere nooit stil. |
| Eén rekenpunt | Elke berekening is één pure functie in `shared/` of `server/utils/` met unit-tests, gebruikt door server, client en motor. |
| Activiteitenlog alleen toevoegen | Elke handeling van mens of agent is een rij; rapportage leest alleen deze log en de afgeleide tabellen. |
| Afgeleide tabellen herberekenbaar | `nb_*` en `org_gezondheid` komen uit jobs en zijn zonder verlies opnieuw te berekenen. |

### 10.2 Tabellen

| Groep | Tabel | Belangrijkste kolommen (naast `id`, `organisation_id`, `data`, tijdstempels) |
|---|---|---|
| Platform | `organisations` | `name`, `pakket`, `features`, `contract`, `stripe_customer_id`, `status` |
| Platform | `users` | `email`, `name`, `role`, `niveau`, `team_id`, `werkplek`, `laatste_inlog`, `status` |
| Platform | `teams` | `naam`, `manager_ids[]`, `gekoppelde_teams[]` |
| Platform | `org_settings` | `(organisation_id, key)`, `value` |
| Platform | `audit_events`, `platform_audit` | `actor_id`, `action`, `resource_type`, `resource_id`, `changes`, `metadata` |
| Platform | `server_records` | `key`, `version` (conflictgrootboek) |
| Platform | `gebruikersaanvragen`, `pakketprijzen`, `facturen`, `llm_connections`, `prompt_versies`, `feature_requests`, `org_gezondheid` | zie F23 |
| Platform | `notificaties`, `push_subscriptions` | zie F24 |
| Salesobjecten | `accounts` | `name`, `account_kind`, `klasse`, `owner_id`, `nb_status`, `reis_id`, `fase_id`, `fase_sinds`, `doelgroep_id`, `gebied_id`, `score`, `laatste_contact_op`, `city`, `postcode`, `kvk`, `domein`, `lat`, `lng`, `nb_bron`, `vv_branche_id`, `huidige_leverancier_id`, `terug_op`, `terug_regel_id` |
| Salesobjecten | `contacts` | `account_id`, `first_name`, `last_name`, `email`, `rol`, `status` |
| Salesobjecten | `leads`, `lead_rondes`, `import_batches`, `lead_verbruik` | zie F02 |
| Salesobjecten | `signals` | `account_id`, `contact_id`, `rule_id`, `agent`, `type`, `relevance_score`, `confidence`, `status` |
| Salesobjecten | `tasks` | `owner_id`, `account_id`, `contact_id`, `signal_id`, `rule_id`, `campaign_id`, `belblok_id`, `action_type`, `title`, `status`, `priority`, `due_date`, `uitkomst`, `later_op`, `executor`, `executor_status` |
| Salesobjecten | `appointments` | `owner_id`, `gepland_door`, `account_id`, `meetingsoort_id`, `vorm`, `status`, `start_at`, `end_at`, `uitkomst_code` |
| Salesobjecten | `overdrachten` | zie F17 |
| Salesobjecten | `activiteiten` | `account_id`, `contact_id`, `task_id`, `campaign_id`, `uitvoerder` ('mens'|'ai'), `agent?`, `kanaal`, `soort`, `uitkomst`, `script_id?`, `op`, `data.vv` (gebruikte versies van het verkoopverhaal) |
| Proces | `doelgroepen`, `reistemplates`, `activiteitstemplates`, `prospectreizen`, `reisgeschiedenis` | zie F05 |
| Proces | `campagnes`, `campagnesoorten` | zie F12 |
| Proces | `hercontactritmes`, `meetingsoorten` | zie F09, F13 |
| Proces | `activity_rules`, `rule_runs` | zie F15 |
| Inhoud | `belscripts`, `belscript_versies`, `mailsjablonen` | zie F08 |
| Inhoud | `eigen_velden` | zie F19 |
| Inhoud | `help_artikelen`, `help_gelezen`, `help_feedback`, `help_zoekopdrachten` | zie F21 |
| Verkoopverhaal | Spiegel: `salesdna_koppeling`, `salesdna_events`, `salesdna_sublagen`, `salesdna_sublaag_versies` (alleen-lezen) | zie F25 |
| Verkoopverhaal | Leesmodel: `vv_sublagen`, `vv_teksten`, `vv_branches`, `vv_concurrenten`, `vv_fasen`, `vv_winpunten`, `vv_terugkomregels`, `vv_eigen_opties` (kolom `bron`: `salesdna` of `eigen`) | zie F25, ADR-017 |
| Verkoopverhaal | Eigen aanvullingen: `vv_branche_mapping`, `vv_concurrent_context`, `vv_winpunt_branche`, `vv_bewijs`, `vv_varianten`, `vv_ambitiedoelen`, `vv_redenmapping`; uitgaand `salesdna_suggesties` | zie F25 |
| Onderweg | `bijlagen` (foto, opname, visitekaartje), `dagpakket_versies` | zie hoofdstuk 8 |
| Coaching | `coaching_sessies`, `coaching_notities` | zie F20 |
| Planning | `belblok_sessies`, `klaargezet_voor`, `kans_overslaan` | zie F07, F10 |
| Koppelingen | `koppelingen`, `koppeling_runs` | zie F02, hoofdstuk 12 |
| AI | `agent_runs`, `waarnemer_profielen`, `briefing_teksten` | zie hoofdstuk 11 |
| AI-assistent | `ai_chats`, `ai_chat_berichten`, `ai_credits`, `ai_credit_plafonds` | zie F26 |
| Platform | `functies_per_niveau` | zie 4.5 |
| Afgeleid | `nb_funnel_stand`, `nb_kpi_dag`, `nb_conversies`, `nb_script_resultaten`, `nb_regel_resultaten`, `nb_prospectmix_stand`, `nb_bezwaren`, `nb_branche_stand`, `nb_winpunt_resultaten`, `nb_concurrent_resultaten`, `nb_terugkom_resultaten` | dagelijkse en wekelijkse jobs |

### 10.3 Relaties in één oogopslag

```
organisations ─┬─ users ── teams
               ├─ doelgroepen ── reistemplates (versies) ── activiteitstemplates
               │                       └── prospectreizen (per account) ── reisgeschiedenis
               ├─ accounts ─┬─ contacts
               │            ├─ signals ── tasks ── activiteiten
               │            ├─ appointments ── meetingsoorten
               │            ├─ overdrachten
               │            └─ leads (bron)
               ├─ campagnes ── items ── tasks
               ├─ belscripts (versies) ── activiteiten.script
               ├─ activity_rules ── rule_runs
               ├─ eigen_velden ── data.customFields
               └─ help_artikelen (organisatie of platform)
```

---

## 11. AI-architectuur en agents

### 11.1 Zes AI-lagen

| Laag | Wat | Waar in de app |
|---|---|---|
| 1. Verrijken | Zoekronde en dossier per lead, buying committee, compacte brief per account | F02, F03, F04 |
| 2. Beoordelen | Inzicht met bewijs uit interne en externe bronnen, winpuntvoorstel, stijlprofiel | F06, F14 |
| 3. Schrijven | Boodschap per kanaal (waarom, hoe, vraag; belofte en één argument met bewijs; winpunt; stijlcheck) | F06, F12 |
| 4. Voorbereiden | Pitstop: belscript-invulling (F08), briefing, dealvoorbereiding, bezwaarantwoord uit de waarde | F08, F11 |
| 5. Notuleren | Verslag per agendapunt, open vragen, voorgestelde uitkomst, koopsignalen, bezwaren | F09, F10 |
| 6. Verbeteren en coachen | Maandelijks verbetervoorstel per doelgroep, coachingpunten per persoon, helpvraag | F05, F20, F21 |

### 11.2 Vangrails die altijd gelden

| Vangrail | Regel |
|---|---|
| Schema op elk antwoord | Tool-use met JSON-schema (`additionalProperties false`); bij afwijking één keer opnieuw, daarna fout zonder opslag |
| Bewijsplicht | Citaten alleen als ze letterlijk in het materiaal staan; URL's alleen uit echte zoekresultaten; zonder bewijs geen inzicht |
| Bronvermelding | Elke bewering in een dossier, brief, script of boodschap draagt bron en datum; de UI toont ze |
| Nooit buiten mandaat | Verzenden, bellen, bezoeken zijn menselijke handelingen, tenzij een mandaat B expliciet geldt (alleen vervolgmails in een goedgekeurde campagne) |
| Menselijke goedkeuring op templates | Een nieuwe versie van een reis, script of regel wordt pas actief na goedkeuring, met audit |
| Meting van overname | Per concept: ongewijzigd, aangepast of verworpen; KPI per agent |
| Plafond in credits | Eén pot AI-credits per organisatie per maand (11.4); reservering en blokkade vóór de aanroep; melding bij 80 procent; agents stoppen bij 10 procent |
| Geen privégegevens | Privémail en privémobiel worden gemaskeerd vóór de aanroep; alleen bedrijfsfeiten en functies |
| Provider met zero-retention | Anthropic API zonder training, EU-verwerking waar beschikbaar, vastgelegd in de verwerkersovereenkomst |
| Alleen bevestigd naar buiten | Scripts, boodschappen en briefings gebruiken alleen bevestigde versies van het verkoopverhaal (F25) en bewaren welke versie ze gebruikten |
| AI schrijft geen winpunten | Ook in de eigen inrichting stelt AI alleen vragen over winpunten; een winpunt komt altijd van een mens |
| Namenfilter op het verkoopverhaal | Elke aanroep met verkoopverhaal plus account- of contactgegevens filtert namen van contactpersonen en klanten in vrije tekst; geldt ook voor suggesties naar SalesDNA |
| Zonder sleutel | Elke laag heeft een mock met vaste fixtures; tests draaien zonder netwerk en zonder kosten |

### 11.3 Agents en mandaten

Mandaatniveaus: **A** autonoom (doet het zelf, logt het, de mens ziet het achteraf), **B** autonoom binnen een goedgekeurd kader, **C** per stuk goedkeuren, **D** altijd mens. Harde grenzen: D blijft D; nooit zonder consent of in een afkoelperiode; nooit buiten het ritme; nooit een template, regel of verhaal wijzigen; alles herleidbaar; stopknop "Agents pauzeren".

| Agent | Doet | Bronnen | Mandaat (organisatiemaximum) |
|---|---|---|---|
| Zoeker | Zoekt bedrijven voor een doelgroep, bouwt het dossier | AI-webzoeker, KvK, Datacollectief | A |
| Verrijker | Houdt dossiers vers, vult contactpersonen en gegevens aan, valideert telefoon, e-mail en adres | KvK, Datacollectief, website, CRM | A |
| Waarnemer | Volgt interne en externe bronnen, maakt inzichten met bewijs, stelt een winpunt voor | Eigen data, verslagen, CRM, KvK-mutaties, websites, vacatures, nieuws, aanbestedingen | A |
| Profielbouwer | Stelt het buying committee samen en schrijft de compacte brief | Dossier, website, verslagen, ingevoerde LinkedIn-informatie | A |
| Schrijver | Schrijft boodschappen en vult belscripts in, met stijlcheck | Verkoopverhaal, winpunten, waarde, dossier, verslagen, kennisbank | A voor concepten |
| Verzender | Verstuurt mails uit goedgekeurde campagnes | SMTP of gekoppelde mailbox | B voor vervolgmails, C voor de eerste mail en elke mail aan een beslisser |
| Berichtgever | WhatsApp uit goedgekeurde sjablonen met opt-in | WhatsApp Business-provider | C |
| LinkedIn-assistent | Zet profielbezoek, connectie en bericht als taak klaar met tekst en knop | Concepten van de Schrijver | C en D; geen automatisering in het LinkedIn-account van de gebruiker |
| Planner | Plant pogingen volgens het ritme, vult belblokken, landt taken op regiodagen, bewaakt capaciteit | Ritmes, matrices, agenda, gebieden | A |
| Notulist | Maakt het verslag volgens de agenda van de meetingsoort, stelt de uitkomst voor | Aantekeningen, transcript, meetingsoort | A voor het verslag; uitkomst kiest de mens |
| Coach | Verbetervoorstel per doelgroep, coachingpunten per persoon | Activiteitenlog, conversies, verslagen | A voor voorstellen; de manager beslist |
| Gids | De AI-assistent (F26): beantwoordt vragen van gebruikers en zet concepten klaar | Help-artikelen, kennisbank van de organisatie, verkoopverhaal, de context van het scherm binnen de rechten van de gebruiker | A, alleen lezen en concepten |
| Bewaker | Toetst elke handeling aan mandaat, consent, afkoeling, ritme, capaciteit, AI-credits en werkuren | Alle tabellen | A, kan alleen blokkeren en melden |

**Mandaat per gebruikersniveau** (binnen het organisatiemaximum):

| Agent | Beginner | Gevorderd | Expert |
|---|---|---|---|
| Zoeker, Verrijker, Waarnemer, Profielbouwer, Planner, Notulist, Coach, Gids | A | A | A |
| Schrijver | A (concept); elk concept per stuk goedkeuren | A | A |
| Verzender | uit; elke mail als concept (C) | B binnen een door de salesmanager goedgekeurde campagne | B met eigen dagplafond tot het organisatiemaximum |
| Berichtgever, LinkedIn-assistent | C | C | C |
| Bewaker | altijd aan | altijd aan | altijd aan |

**Hoe een agent werkt**: 1. voorstel (uit een regel, ritme, trigger of job) → 2. Bewaker `magHandelen(agent, handeling, account, contact, nu)` → 3. uitvoering: A en B direct met een rij in `activiteiten` en `agent_runs`, C als taak met concept, D als taak met voorbereiding. Elke agent is één module `server/utils/agents/<naam>.ts` met `draai(context)`, aangeroepen door de motor of een job.

### 11.4 Modellen, kosten en credits

Alle AI in Dealtrace rekent in **AI-credits** (B20). Elke organisatie heeft één pot credits per maand; elke AI-handeling kost een vast aantal credits, ongeacht welk model erachter zit. Het pakket bepaalt welke AI-soorten aanstaan en hoe groot de pot is.

| Soort | Model | Credits per handeling | Aan in pakket |
|---|---|---|---|
| AI-assistent: gewone vraag (F26) | Claude Haiku | 1 | Starter, Plus, Compleet |
| AI-assistent: vraag met accountgegevens of lang antwoord | Claude Sonnet | 2 tot 5 | Starter, Plus, Compleet |
| AI-assistent of agent: webonderzoek | Claude Sonnet met websearch | 10 | Compleet |
| Zoekronde leadgenerator | Claude Sonnet met websearch | 20 | Compleet |
| Dossier | Claude Sonnet met websearch | 10 | Compleet |
| Inzicht-beoordeling (intern) | Claude Sonnet | 1 | Plus, Compleet |
| Concept (Pitstop, boodschap) | Claude Sonnet | 2 | Plus, Compleet |
| Belscript-invulling | Claude Haiku of Sonnet | 1 | Plus, Compleet |
| Notulist (verslaganalyse) | Claude Sonnet | 5 | Plus, Compleet |
| Brief en buying committee | Claude Sonnet | 3 | Plus, Compleet |
| Coach en verbetervoorstel | Claude Opus | 20 | Plus, Compleet |
| Spraakopdracht en visitekaartje | Claude Haiku of Sonnet | 1 en 2 | Starter, Plus, Compleet |
| Transcriptie van ingesproken verslagen | EU-transcriptiedienst | 1 per begonnen minuut | Starter, Plus, Compleet |

**Pot per pakket** (voorlopig, open vraag 24): Starter 200, Plus 600 en Compleet 1.500 credits per gebruiker per maand, samen in één pot per organisatie. Externe databronnen zijn geen AI en vallen buiten de credits: KvK-bevragingen (0 / 500 / 2.000 per maand) en Datacollectief-records (volgens het contract van de organisatie).

Regels:

- `creditsVoor(soort, context)` in `shared/credits.ts` is de enige plek waar de prijs per handeling staat; de tabel hierboven is de standaard en de founder past hem aan in Platformbeheer zonder release.
- Elke AI-aanroep boekt zijn credits in `ai_credits` en het logboek (`agent_runs`) vóór de aanroep (reservering) en definitief na afloop; een mislukte aanroep kost niets.
- Bij 80 procent van de pot een melding aan beheerder en gebruikers. Bij 0 stoppen alle AI-handelingen met de melding "De AI-credits van deze maand zijn op. Je beheerder kan extra credits aanvragen."; al het werk zonder AI gaat door (scripts met vaste teksten, briefings met berekende tekst, handmatig invoeren).
- Automatische AI (agents, motorrondes) stopt bij 10 procent van de pot, zodat er credits overblijven voor wat gebruikers zelf vragen.
- De beheerder kan per gebruiker een plafond zetten en per AI-soort een dagplafond voor de agents.

Modelnamen en prijzen per model staan in de tabel `llm_prijzen` met peildatum; de modelkeuze per soort staat in de AI-koppeling (F23) zodat wisselen zonder release kan. Een Beginner op Starter heeft geen AI-invulling van scripts: het script werkt met vaste teksten en terugvalzinnen (F08).

### 11.5 Schrijven: de boodschap

Volgorde bij een eerste contact: waarom (uit de golden circle) → hoe (het winpunt) → één vraag; het "wat" niet in de eerste alinea. Precies één argument met bewijs: het winpunt uit `kiesWinpunt` (F25) met één bewijs uit `vv_bewijs`, de concurrentregel of een winpuntbijlage; de belofte en kernzin komen uit de branche van het account, met terugval op algemeen. Bericht 2 en verder gebruiken een ander winpunt. Lengte: mail 120 woorden, LinkedIn 80, WhatsApp 60, belscript 150, kaart 40. Stijlscore `5 + min(5, passende woorden) − 2 × vermeden woorden`, begrensd 1 tot 10; onder 7 één keer opnieuw met de vermeden woorden in de instructie. Toon "Zakelijk", "Persoonlijk", "Kort" verandert de vorm, niet het waarom.

---

## 12. Integraties

| Integratie | Doel | Richting | Mechanisme | Wie richt in | Sprint |
|---|---|---|---|---|---|
| **KvK API** (Zoeken, Basisprofiel, Vestigingsprofiel) | Bedrijven vinden en verrijken; KvK-nummer als ontdubbelsleutel; mutaties als signaal | lezen | REST met API-sleutel van de organisatie, kosten per bevraging; cache 30 dagen per KvK-nummer; maandelijkse controle op wijzigingen voor accounts in reis | beheerder | 7 |
| **Datacollectief** | Selecties op doelgroep; contactpersonen met functie, direct nummer en e-mail; verrijking | lezen | API van Datacollectief met sleutel van de organisatie (of bestandsexport als terugval via de import); tegoed per record; herkomst `datacollectief` met datum | beheerder | 6 |
| **CRM** (HubSpot eerst; Salesforce, Microsoft Dynamics, Pipedrive, AFAS via dezelfde adapter) | Ontdubbelen tegen het CRM, profiel uit klanten, overgenomen leads, uitkomsten en eerste afspraken terugschrijven, overdracht na de eerste afspraak (het CRM maakt de deal) | beide | OAuth per organisatie, tokens versleuteld, veldtoewijzing, eigenaarsregel op e-mail, synchronisatie elk uur en op verzoek, webhooks waar beschikbaar; sessiecontrole op elk endpoint (gat 21 uit DealDrive) | beheerder | 8 |
| **Agenda** (Microsoft 365, Google) | Bezetting voor belblok- en afspraakadviezen; afspraken en belblokken wegschrijven; Teams- en Meet-links | beide | OAuth per gebruiker | gebruiker, aan te zetten door beheerder | 8 |
| **Mail** (SMTP van de organisatie of gekoppelde mailbox) | Concepten versturen, Verzender, herinneringen, afmeldlink | schrijven | SMTP met test-eerst-dan-opslaan, AES-256-GCM, SPF, DKIM en DMARC als voorwaarde; of Microsoft Graph en Gmail API via de agendakoppeling | beheerder | 9 |
| **WhatsApp Business** | Berichten uit goedgekeurde sjablonen met opt-in | schrijven | provider (open vraag) | beheerder | 12 |
| **Telefonie** (bijvoorbeeld Voys, Aircall) | Klik-om-te-bellen, gespreksduur terug | beide | adapter, optioneel | beheerder | na 12 |
| **Routedienst** (OpenRouteService of Google Routes) | Geocodering, reistijden en omrijtijd voor kansen langs de route | lezen | API-sleutel van het platform, cache per paar punten | founder | 8 |
| **SalesDNA** | De zeven sublagen plus golden circle als bron van het verkoopverhaal (F25); suggesties met bewijs terug naar kader 2 | beide | gesigneerde webhooks per organisatie (HMAC-SHA256, event-id, tijdvenster 5 minuten): `sublaag.bevestigd`, `sublaag.verouderd`, `sublaag.verouderd-gesloten`, `sublaag.leeg`, `sublaag.overgeslagen`, `ping`; volledige synchronisatie bij een gat in de versies; suggesties hooguit 10 per sublaag per week zonder namen; zonder koppeling de eigen inrichting | beheerder | 3 (spiegel), 11 (suggesties) |
| **DealDrive** | Overdracht na de eerste afspraak (DealDrive maakt de deal en de offerte); ontdubbelen tegen DealDrive; terugmeldingen (overdracht verwerkt, deal gewonnen, deal verloren, klant slapend) voor de funnel en winback | beide | REST met HMAC-SHA256 en gedeeld geheim per organisatie, idempotent; contract voorbereid in `docs/api/dealdrive-koppeling.md` en de OpenAPI-specificatie (B21); adapter met mock | founder | 11 |
| **Stripe** en **Moneybird** | Abonnement, seats, facturen, incasso; boekhouding | beide | Stripe Billing met webhook (idempotent op event-id); Moneybird-synchronisatie als job | founder | 12 |
| **GitHub** | Roadmapwens naar issue en bouwketen | schrijven | token van het platform; workflow opent altijd een pull request | founder | 12 |
| **Transcriptie** (EU-dienst, keuze in hoofdstuk 22) | Ingesproken verslagen en spraakopdrachten naar tekst (8.9) | lezen | adapter met mock; opname na transcriptie verwijderd | founder | 8 |
| **Kaartapps** (Google Maps, Apple Kaarten, Waze) | Navigeren naar een afspraak of kans | n.v.t. | diepe link per toestel, keuze in Mijn instellingen | gebruiker | 8 |
| **TenderNed** (optioneel) | Aanbestedingen als signaal | lezen | open data | founder | na 12 |

Voor elke integratie geldt: een adapter met dezelfde interface, een mock met vaste fixtures, logging in `koppeling_runs`, kosten in het verbruik, foutmeldingen in gewone taal op de koppelingenpagina ("De KvK-sleutel is verlopen. Vraag een nieuwe aan bij KvK en plak hem hier."), en `GET /api/config/status` die alleen laat zien of een sleutel bestaat.

---

## 13. Technische architectuur

### 13.1 Stack

| Laag | Keuze |
|---|---|
| Framework | Nuxt 4, Vue 3.5, Nitro, TypeScript strict; state als composables (geen Pinia) |
| Database | Postgres op Supabase (EU), drizzle, migraties via generate en apply, RLS, PITR |
| Auth | Supabase Auth met **eenmalige code per mail** (e-mail-OTP, B12): de gebruiker vult zijn e-mailadres in, krijgt een code van zes cijfers die 10 minuten geldig is, en blijft 30 dagen ingelogd op dat toestel; geen wachtwoorden. Server-side sessie in httpOnly-cookies, JWKS-validatie; TOTP verplicht voor founder, optioneel voor beheerder; rate-limit van 5 codes per uur per adres; SSO (Microsoft, Google) later |
| Hosting | Netlify (staging op `develop`, productie op `main`), geplande functies voor de motor en sweeps; bij groei een losse worker voor lange jobs |
| Client | Offline-first PWA met IndexedDB (Dexie), synchronisatiewachtrij, Web Push, mobiele schil met onderbalk en schuifvensters (hoofdstuk 8) |
| AI | Anthropic API via één providerlaag met mock; modelkeuze per soort in de AI-koppeling |
| Stijl | Eén globale stylesheet uit het designsysteem (leidend, B15), stylelint met de DealDrive-regels, Lucide-iconen |
| Tests | vitest (unit), databasevrije suites, wegwerp-Postgres, Playwright (desktop en telefoon op 375, 390 en 412 px verplicht), tests op echte toestellen (8.15), golden masters voor prompts |
| Checks | `tsc`, `vue-tsc`, eslint, stylelint, `check:rechten`, `check:platform`, `check:functies` (elke functie in de catalogus van 4.2 heeft een niveau, pakket, recht en helpartikel) |

### 13.2 Repo-indeling

```
dealtrace/
  app/
    assets/css/dealtrace.css          designsysteem (enige globale stylesheet)
    components/                       schil, flyouts, lijstrijen, NB-componenten (ritmestrook, uitkomstraster, mandaatpil, bewijsregel)
    composables/                      use* per domein
    pages/                            index, agenda, acties, belblokken, bezoeken, campagnes, funnel, prospects, contacten,
                                      leadgenerator, inzichten, planning, richting, reizen, resultaten, team, coaching, analyse,
                                      audit, help, roadmap, meldingen, instellingen/*, platform/*, partner/bevestig/[token]
  server/
    api/                              per domein; platform/* alleen founder; integraties/*; motor/*
    db/                               schema.ts, migrations/, rls.sql, seed/ (startset per organisatie)
    utils/                            appStore, permissions, session, ruleEngine, journeyEngine, agents/*, bronnen/*,
                                      routedienst, belscripts, hercontact, nbStatus, kansen, coaching, help
  shared/                             pure functies en types: functies (niveaucatalogus), reis, belblokken, belscripts,
                                      hercontact, nbStatus, leadGenerator, ontdubbelen, route, campagneTempo, ritmematrix,
                                      gebieden, datum (met feestdagen), settingKeys, syncTabellen
  content/help/                       help-artikelen in Markdown (platformlaag)
  netlify/functions/                  motor (elk uur), herinneringen (5 min), dagstart (15 min), dag (conversies, kpi,
                                      gezondheid, opruimen), week (bezwaren, waarnemer), maand (coach, verbetervoorstel)
  tools/wegwerpdb/                    wegwerp-Postgres voor databasesuites
  docs/                               HOE-HET-WERKT.md (levend handboek), BOUWPLAN.md (dit document), prompts/
```

### 13.3 Kritieke flows

1. **Lead naar prospect**: ronde of import → ontdubbelen (KvK, domein, naam) → verrijken (KvK, Datacollectief) → beoordelen en groeperen → "Neem over" → account, contacten, `lead-overgenomen`, reis en fase, eerste taak in blok of op regiodag.
2. **Poging afronden (offline-bestendig)**: uitkomst in belmodus of taakflyout → `rondTaakAf` lokaal → wachtrij → server: rechten, versie, upsert → `verwerkUitkomst` (idempotent op item en stap) → volgende poging, statuswissel, gebeurtenis → motor voor dat account → Vandaag bij de volgende poll.
3. **Afspraak voor een collega**: binnendienst kiest "Gesproken, afspraak" → vrije momenten van de buitendienst in de regio → afspraak in diens agenda met briefing → `eerste-afspraak-gepland` → status gescoord.
4. **Werken in een organisatie** (founder): reden en modus → servercontrole en audit → ondertekende cookie → gele balk → schrijfacties volgens modus.
5. **Motorrun**: per organisatie, eerst afsluiter campagnes, dan regels (deterministisch in één transactie, AI erbuiten), dan Planner (landing en capaciteit), dan belblokvuller, dan automatisch voorbereiden.

### 13.4 Prestatiebudgetten

| Meting | Budget |
|---|---|
| Vandaag eerste weergave (warm) | onder 1,0 s desktop, onder 2,0 s op 4G |
| Bootstrap 600 accounts en 3.000 contacten | onder 1,5 s en onder 2 MB |
| Belmodus volgend gesprek | onder 300 ms (vooraf geladen) |
| Kansen langs de route | onder 800 ms |
| Synchronisatie van 50 mutaties | onder 800 ms |
| Motorrun per organisatie (600 accounts, 25 regels) | onder 20 s zonder AI, onder 120 s met AI |
| Leadronde | onder 60 s |
| App-bundel (zonder platformdeel) | onder 400 kB gezipt |

### 13.5 Lokaal bouwen

Dealtrace wordt gebouwd en getest op een lokale ontwikkelomgeving; een server op internet is pas nodig voor staging en productie.

| Onderdeel | Lokaal |
|---|---|
| Code | De repository `basresink/dealtrace` op de eigen computer (bijvoorbeeld `C:\Projecten\Dealtrace`), met Claude Code in die map |
| App | Nuxt-ontwikkelserver: `pnpm dev` op `http://localhost:3000`; op de telefoon in hetzelfde wifi-netwerk via het IP-adres van de computer (`pnpm dev --host`) |
| Database | Supabase lokaal via de Supabase CLI (`supabase start`, draait in Docker Desktop): Postgres met RLS, Auth met inloggen per code (de mails komen in de lokale mailbox Inbucket op `http://localhost:54324`), Storage |
| Startdata | `pnpm seed` laadt de startset Voltvast (`seed/voltvast.json`) |
| AI | Standaard de mock-provider (`AI_PROVIDER=mock`): geen sleutel, geen kosten, vaste antwoorden; met een eigen Anthropic-sleutel in `.env.local` kan het echt |
| Koppelingen | KvK, Datacollectief, CRM, routedienst, transcriptie, SalesDNA en DealDrive draaien lokaal op hun mock (`seed/dealdrive-mock/`, `seed/webhooks/`) |
| Geplande taken | Motor en sweeps met `pnpm motor` of de knop "Draai motor nu"; geen Netlify nodig |
| Tests | `pnpm test` (unit en databasevrij), `pnpm test:db` (wegwerp-Postgres), `pnpm test:e2e` (Playwright, desktop en telefoonformaten) |
| Benodigd | Node.js 22, pnpm, Docker Desktop, Git; op Windows bij voorkeur met WSL 2 |

Regels: geheimen alleen in `.env.local` (nooit in git); `.env.example` noemt elke variabele met uitleg; de README beschrijft de stappen van nul tot een draaiende app in tien minuten; Netlify (staging op `develop`, productie op `main`) komt pas in beeld bij de eerste test met echte gebruikers.

---

## 14. Designsysteem en UI-patronen

Dealtrace gebruikt het designsysteem uit `designsysteem/` (stijlbestand `dealdrive-designsysteem.css` met 104 tokens en het opbouwdocument in drie delen) als enige globale stylesheet. Samenvatting van wat een bouwer moet weten:

| Onderwerp | Regel |
|---|---|
| Kleur | Krantenpalet: `--ink #0a0a0a`, `--bg #fafaf7`, `--surface #f1f1ee`, `--border #e3e1da`, één accent `--yellow #fed800`; semantisch `--red #c0392b` (fout, urgent, verwijderen), `--green #1e7c4a` (gelukt, overgedragen), `--blue #194c8f` (info, klant), `--orange #d97706` (let op), `--purple #4c1d95` (hete prospect). Kleuren altijd via `var()`. Geel nooit als kleine tekst op wit. |
| Typografie | Source Serif 4 voor koppen en cijfers, Inter voor de rest; schaal 11, 12, 13, 14, 16, 18, 22, 32 px; niets onder 11 px; cijfers tabulair |
| Vorm | Hoeken 2 px, geen schaduwen, diepte met randen; aanraakdoelen minimaal 44 px (handschoenmodus 54) |
| Schil | Zwarte zijbalk 240 px (inklapbaar 64), Lucide-iconen, LIVE-strook, "Zoeken" met Ctrl K, groepen, meldingen en gebruikersmenu onderaan; op mobiel een icoonstrook van 64 px, geen onderbalk |
| Paginakop | Werkpagina: kicker met gele streep, grote titel als zin over de stand van zaken, subtitel, knoppen rechts. Instellingen- en detailpagina: kruimelpad, kicker, titel 32 px |
| Werkbalk | Vaste volgorde: Zoeken, primaire knop, andere plusknoppen, Weergave, Sortering, Filters (met teller), Download |
| Flyout | Enige venster voor records: rechts, 520 px (smal 480, breed 560, ruim 640), kop op `--surface`, voet met maximaal drie tekstknoppen en iconen in vaste volgorde (Vraag AI, Uitstellen, Bewerken, Verwijderen, Open kaart); Escape sluit de bovenste laag; focusval en focusherstel |
| Bevestiging | Alleen bij onomkeerbaar; vraag als titel, record en gevolg in de tekst, werkwoord op de knop ("Verwijderen" rood) |
| Toast | Rechtsonder, zwart, 4 s (fout 6 s), verleden tijd, geen knoppen |
| Lege staat | Zegt wat er niet is en waarom; de actie staat in de paginakop; bij filters "Toon alles" |
| Laden | Skelet in de vorm van de lijst, geen draaiende cirkel |
| Kanban | Altijd een keuze naast een lijst |

**Nieuwe componenten voor Dealtrace** (gebouwd uit bestaande tokens): uitkomstraster (knoppen 56 px, aan zwart met geel, uitleg eronder), ritmestrook (vakken 32 px per dag, gedaan inkt, nu geel, parkeren gestippeld), pogingregel ("poging 3 van 5 · LinkedIn · vorige: voicemail"), mandaatpil A tot D (A zwart met geel, B geel met inkt, C wit met inktrand, D gestippeld), bewijsregel (✓ groen, ✗ rood, ? grijs met bron in meta), conceptblok (`.fo-blok--agent` met stijlscore en gemarkeerde woorden), scriptpaneel voor de belmodus, kansregel met scoreopbouw, stappenbalk voor wizards, soortkaart, jaarkalender, mixbalk, trechterkolommen, vergrendelde menugroep, niveaukaart, coachingkaart.

**Afwijkingen in de mockup die rechtgezet worden**: de mockup heet nog "DealDrive New Business" (wordt "Dealtrace"), heeft een zijbalk zonder iconen en een mobiele onderbalk, gebruikt emoji in plaats van Lucide-iconen, segmentknoppen waar het designsysteem een Weergave-menu voorschrijft, en inline stijlen. Bouw vanaf het designsysteem en de generatorscripts in `mockup/gen/`, niet vanaf de HTML (enkele HTML-bestanden ontbreken).

---

## 15. Datakwaliteit, AVG en beveiliging

### 15.1 Datakwaliteit

| Onderwerp | Regel |
|---|---|
| Dubbele accounts | KvK gelijk is altijd een duplicaat; anders domein zonder `www.`; anders genormaliseerde naam (zonder B.V., N.V., Holding, Group) met Sørensen-Dice: 80 procent duplicaat, 60 procent mogelijk; bij samenvoegen blijven beide id's bewaard (`data.samengevoegdUit[]`) zodat koppelingen blijven werken |
| Dubbele contacten | exact op e-mail, anders volledige naam binnen het bedrijf; een contact bij een ander bedrijf wordt "verhuisd" met datum |
| Validatie | e-mail syntaxis plus MX; telefoon naar E.164; postcode vier cijfers en twee letters; URL bereikbaar bij verrijking |
| Veroudering | dossier verloopt na 30 dagen, bewijs vervalt na 120; een contact zonder bevestiging in 12 maanden krijgt "controleren" |
| Geen verzonnen gegevens | de Verrijker vult nooit een nummer of adres in dat niet op een bron staat; een patroon ("voornaam@domein") is een voorstel met de pil "aanname" |
| Datakwaliteit in de dag | de drie grootste gaten op Vandaag en in Team, met één knop (verrijken of taak); een campagne kan niet starten als meer dan 20 procent van de accounts het kanaal van de eerste stap niet kan |

### 15.2 AVG

| Verwerking | Grondslag | Maatregel |
|---|---|---|
| Bedrijfsgegevens (KvK, website, SBI) | gerechtvaardigd belang | openbare bronnen, herkomst per veld |
| Zakelijke contactpersonen (naam, functie, zakelijk nummer en e-mail, ook via Datacollectief) | gerechtvaardigd belang (B2B-acquisitie) met afmeldmogelijkheid | informatieplicht bij het eerste contact (afmeldlink, verwijzing naar de privacyverklaring), nooit privégegevens, afmelding op een onderdrukkingslijst (gehasht) zodat een nieuwe import niet opnieuw mailt; het contract met Datacollectief regelt de herkomst |
| WhatsApp | toestemming | zonder opt-in geblokkeerd |
| Gespreksverslagen en AI-notulen | gerechtvaardigd belang | opname alleen met mededeling; transcript 12 maanden |
| Bellen | gerechtvaardigd belang | bel-me-niet-lijst per organisatie, controle vóór elke bellijst |
| AI-verwerking | verwerkersovereenkomst met de provider, geen training, EU waar beschikbaar | privégegevens gemaskeerd |
| Spraakopnames en foto's onderweg | gerechtvaardigd belang | opname na transcriptie verwijderd tenzij de organisatie bewaren aanzet; transcriptie alleen in de EU; foto's bij het bezoek, 12 maanden |
| Locatie van de gebruiker | gerechtvaardigd belang, op verzoek van de gebruiker | alleen bij openen van Route, "In de buurt" of "+ Inloop"; nooit opgeslagen of gevolgd |
| Suggesties naar SalesDNA | gerechtvaardigd belang | zonder namen van personen of prospects, citaten geanonimiseerd, vrijgave door de salesmanager |
| Leverancier kijkt mee | gerechtvaardigd belang (support) | reden verplicht, modus, tijdslimiet, melding aan de beheerder, audit, optioneel "alleen na toestemming" |

Bewaartermijnen: contactpersonen zonder activiteit 24 maanden na het laatste contact, daarna gepseudonimiseerd (melding 30 dagen vooraf); niet overgenomen leads 60 dagen, afgewezen 120; `agent_runs` 13 maanden; audit 7 jaar; transcripten 12 maanden. Rechten van betrokkenen: export en pseudonimiseren per contact via Instellingen, Privacy, binnen 30 dagen, geaudit.

### 15.3 Beveiliging

Authenticatie via Supabase met httpOnly-cookies; inloggen met een eenmalige code per mail (zes cijfers, 10 minuten geldig, hooguit 5 per uur per adres, sessie 30 dagen per toestel, uitloggen op alle toestellen vanuit Mijn instellingen); TOTP erbij voor founder; autorisatie met rechtenmatrix op server en client plus RLS; geheimen alleen op Netlify per context, nooit in logs, rotatie elk half jaar; webhooks met HMAC, tijdvenster en replay-bescherming; publieke tokens (partner, afmelden) 32 bytes, eenmalig, 14 dagen, rate-limit; sleutels van koppelingen en AI-providers versleuteld met AES-256-GCM met een eigen geheim per doel; wekelijkse afhankelijkheidsaudit; PITR 7 dagen plus wekelijkse dump in de EU; meldplicht binnen 72 uur met draaiboek.


---

# Deel E · Uitvoering

## 16. Succescriteria en KPI's

### 16.1 Accountmanager binnendienst

| KPI | Doel | Meting |
|---|---|---|
| Tijd tot de eerste handeling van de dag | onder 5 minuten | inlog tot eerste afgeronde taak |
| Belblokken gehouden tegen gepland | boven 85 procent | `belblok_sessies` |
| Bereik per blok (gesproken met iemand) | boven 35 procent | uitkomsten in de belmodus |
| Beslisser bereikt | boven 20 procent van de gesprekken | uitkomst plus contactrol |
| Conversie gesprek naar afspraak | boven 15 procent | per script en campagne |
| Pogingen tot afspraak | gemiddeld 4 tot 5 (niet stoppen na 2) | ritmestand bij afspraak |
| Afspraken voor de buitendienst | volgens teamnorm | `gepland_door` |

### 16.2 Accountmanager buitendienst

| KPI | Doel | Meting |
|---|---|---|
| Bezoeken per regiodag | volgens norm (standaard 4) | afspraken met vorm bezoek |
| Kansen langs de route omgezet | boven 25 procent van de getoonde kansen | tussenstops en inloopbezoeken |
| Aandeel new business-bezoeken | volgens afspraak (standaard 50 procent) | soort account bij bezoek |
| Bezoek afgerond met verslag binnen 24 uur | boven 90 procent | uitkomst en verslag |
| Kilometers per bezoek | dalend | route |

### 16.3 Salesmanager en organisatie

| KPI | Doel |
|---|---|
| Teamleden op tempo | boven 70 procent |
| Prospectmix binnen 10 procentpunten van de afspraak | elk kwartaal |
| Coachingsgesprekken gehouden | één per accountmanager per twee weken |
| Coachingafspraken gehaald | boven 60 procent |
| Eerste afspraken uit new business | volgens ambitie |
| Gehouden eerste afspraken overgedragen binnen 24 uur | boven 90 procent |
| Kosten per afspraak (AI, data, tijd) | dalend per kwartaal |
| Datakwaliteit | boven 95 procent van de actieve prospects met geldig nummer of e-mail |

### 16.4 Product en techniek

| KPI | Doel |
|---|---|
| AI-concept ongewijzigd of licht aangepast gebruikt | boven 60 procent |
| Helpartikel nuttig | boven 80 procent |
| Antwoord van de AI-assistent nuttig | boven 75 procent |
| Organisaties die binnen hun AI-credits blijven | boven 90 procent |
| Offline afgeronde pogingen correct verwerkt | boven 99 procent, nooit dubbel |
| AI-antwoorden in één keer binnen het schema | boven 95 procent |
| Playwright desktop groen bij elke commit | 100 procent |

---

## 17. Fasering in sprints

Het aantal sprints volgt de inhoud (beslissing B14). Met het hoofdstuk Mobiel en onderweg, de SalesDNA-sublagen en de checklist van DealDrive-gaten komt de schatting op **twaalf sprints van twee weken**. Elke sprint eindigt met een werkende, geteste toestand die de eerste organisatie kan gebruiken. Het niveaumodel en de mobiele schil zijn er vanaf sprint 1, zodat elke nieuwe functie direct een niveau, pakket, helpartikel en telefoonweergave krijgt. Na elke sprint stelt de founder vast of de volgende sprint zo blijft; een sprint mag worden gesplitst als de "klaar als"-toestand niet haalbaar is.

| Sprint | Naam | Inhoud | Features | Klaar als |
|---|---|---|---|---|
| 1 | Fundament en één app | Organisaties, gebruikers, rollen, teams, **niveaus en functiecatalogus**, **inloggen met een code per mail**, RLS, sync, rechten, audit, mock-modus, designsysteem, **mobiele schil** (onderbalk, compacte kop, actiebalk), meldingen en offline basis; platformbeheer basis: klanten met startset, gebruikers en aanvragen, werken in een organisatie, pakket | F22, F23, F24 (basis), 8 | Een founder maakt een organisatie en werkt erin met reden en gele balk; een accountmanager logt in met een code op zijn telefoon en ziet de onderbalk |
| 2 | Prospects en data | Accounts en contacten, lijsten met tellers, accountkaart (ook op 390 px), buying committee, **eigen velden** met filters, import met ontdubbelen, datakwaliteit, herkomst per veld | F03, F04, F19, F02 (import) | 1.000 accounts geïmporteerd met duplicaten gevangen; een accountkaart is op de telefoon met één duim te bedienen |
| 3 | Verkoopverhaal | **SalesDNA-sublagen**: bedrijfsverhaal (ook per branche), ambitie en visie, waarde en belofte, concurrenten, branches, winpunten, hercontactritme; eigen inrichting en spiegel via webhooks; pagina Richting; startset Voltvast als testdata | F25 | Een organisatie zonder SalesDNA vult haar verhaal in; een organisatie met SalesDNA ontvangt het via een webhook; beide tonen hetzelfde op Richting |
| 4 | Reis, motor en ritme | Doelgroepen (gekoppeld aan branches), standaard prospectreis, statusmachine en nee met afkoelperiode, motor met editor en starterset, accountmatrix | F05 (standaard), F15, F16 | Een overgenomen account doorloopt de reis op echte gebeurtenissen; de motor maakt precies de verwachte taken |
| 5 | Dag en hulp | Vandaag (desktop en telefoon), acties, hercontactritme-engine, Planner en Bewaker, helpcenter basis, AI-assistent met credits (basis), features aan en uit per niveau | F01, F06, F13 (ritme), F21 (basis), F26 | Een account doorloopt vijf pogingen en parkeert; de hulpknop opent op elk scherm het juiste artikel |
| 6 | Binnendienst | Belblokken en belmodus (ook op de telefoon), belscript-templates met AI-invulling uit het verkoopverhaal, prospectplanning | F07, F08, F13 (planning) | Een binnendienstmedewerker belt een blok van tien prospects met een gekozen script |
| 7 | Leads | Leadgenerator met AI-zoeker, KvK en Datacollectief, profiel uit branches en klanten | F02 | Een KvK-selectie levert leads in vijf groepen; "Neem over" maakt een prospect met contactpersonen |
| 8 | Buitendienst en onderweg | Agenda en meetingsoorten, bezoeken en kansen langs de route, gebieden en regiodagen, routedienst, **Onderweg-schermen**, inloopbezoek, spraak, offline bezoekdag, agendakoppeling | F09, F10, F18, 8 | Een buitendienstmedewerker werkt een hele dag op de telefoon, ook een uur zonder bereik, met drie bezoeken, twee tussenstops en drie ingesproken verslagen |
| 9 | Verbinden en campagnes | Campagnes, funnel van de prospectreis en overdracht na de eerste afspraak, briefings en Pitstop, Schrijver met stijlcheck, mail versturen | F11, F12, F17 | Een koude belcampagne van 30 accounts loopt van Gespot tot Afspraak; een gehouden eerste afspraak wordt overgedragen met briefing |
| 10 | Agents en bronnen | Waarnemer, Verrijker, Profielbouwer, Notulist, signaalregels per doelgroep, concurrentsignalen, CRM-koppeling (HubSpot) | F14, F02 (CRM) | Een vacature wordt een inzicht met citaat en winpunt; leads worden tegen HubSpot ontdubbeld en teruggeschreven |
| 11 | Sturen en maatwerk | Team, Coaching (ook op de telefoon), Analyse, Audit; Coach-agent; maatwerk prospectreizen; suggesties terug naar SalesDNA; overdracht naar DealDrive | F05 (maatwerk), F20 | Een salesmanager houdt een coachingsgesprek met kaart; een expert bouwt een eigen reis en de salesmanager publiceert hem |
| 12 | Platform en afronding | Platformbeheer compleet (Stripe, Moneybird, AI-koppeling, AI-credits en extra credits, prompts, roadmap, motor), helpcenter compleet met academie en AI-vraag, Web Push, WhatsApp, tests op echte toestellen, prestatiebudgetten | F21, F23, F24 | De eerste klantorganisatie draait een kwartaal met binnendienst en buitendienst; elke feature heeft een helpartikel en een telefoonweergave |

Bezetting: één bouwer (Claude Code in sessies per bouwprompt) met de founder als productowner en reviewer; per sprint een adversariële review met minimaal twee controleurs op code, desktopbrowser en een echte telefoon vóór de commit naar `develop`.

---

## 18. Van bouwplan naar bouwprompts

Dit bouwplan wordt omgezet in bouwprompts: per sprint één tot drie prompts, elk uitvoerbaar in één Claude Code-sessie. Elke prompt bestaat uit twee delen.

### 18.1 Functionele prompt (wat en waarom)

```
# Prompt <nr>: <naam>
Wat je bouwt, in één zin.
Waarom (welk probleem, voor welke rol, op welk niveau).
Gebruikers en niveaus: tabel rol × niveau × wat.
Schermen: route, opbouw van boven naar beneden, schermteksten letterlijk, lege staten.
Klikpaden: genummerd, met wat er na elke klik gebeurt.
Flyouts en knoppen: velden (verplicht, standaard, validatie), knoppen, bevestigingen, toasts.
Filters en sorteren: waarden, standaard, URL.
Regels: in gewone taal, met getallen.
Helpartikel(en): titel en kern van het artikel dat met deze functie meekomt.
```

### 18.2 Technische prompt (hoe)

```
Datamodel: tabellen, kolommen, data-velden, migratie, RLS, rechtenmatrix, sync-allowlist.
Pure functies: naam, invoer, uitvoer, randgevallen, unit-tests.
Endpoints: methode, route, recht, invoer, uitvoer, fouten.
AI-stappen: agent, mandaat, materiaal, schema, vangrails, mock, soort en credits per handeling (11.4).
Integraties: adapter, mock, fouten, kosten.
Functiecatalogus: sleutel, niveau, pakket, recht, helpartikel.
Hergebruik uit DealDrive: bestanden en wat je aanpast.
Acceptatiecriteria: databasevrij, wegwerp-Postgres, Playwright (desktop, mobiel waar het buitendienst is).
Buiten scope.
Definition of Done (hoofdstuk 19).
```

### 18.3 Indeling van de prompts

De nummers P01 tot en met P26 blijven gelijk aan versie 1.0, zodat de verwijzingen in Bijlage A kloppen; P27 tot en met P33 zijn nieuw. De volgorde is die van de sprints. Elke prompt staat uitgeschreven in `docs/prompts/`, met een functioneel en een technisch deel volgens 18.1 en 18.2.

| Prompt | Sprint | Features | Bron in dit plan |
|---|---|---|---|
| P01 Fundament, rollen, niveaus en functiecatalogus | 1 | F22, F24 basis | 3, 4, 6, 10, 13 |
| P27 Inloggen met code en de mobiele schil | 1 | F24, hoofdstuk 8 | 8.2 tot 8.4, 13.1, 15.3 |
| P02 Platformbeheer basis en werken in een organisatie | 1 | F23 basis | F23, 15.3 |
| P03 Accounts, contacten, eigen velden | 2 | F03, F04, F19 | F03, F04, F19, 8.5.5 |
| P04 Import en datakwaliteit | 2 | F02 import | F02, 15.1 |
| P28 Verkoopverhaal: leesmodel, eigen inrichting en Richting | 3 | F25 | F25, 10.2, ADR-017, Bijlage C |
| P29 SalesDNA-koppeling: webhooks, spiegel en projectie | 3 | F25 | F25, 12, ADR-002 |
| P05 Standaard prospectreis, statusmachine en terugkomregels | 4 | F05 standaard | 7, F05, F25, ADR-018 |
| P06 Motor, regels en accountmatrix | 4 | F15, F16 | F15, F16 |
| P07 Taken, inzichten, Vandaag en hercontactritme | 5 | F01, F06, F13 ritme | F01, F06, F13 |
| P32 Dagritme-kern en Vandaag op de telefoon | 5 | F01, hoofdstuk 8 | 8.5.1, 8.13 |
| P33 AI-assistent en credits | 5 | F26 | F26, 11.2, 11.4 |
| P08 Mandaten, Bewaker, Planner | 5 | 11.3 | 11 |
| P09 Helpcenter basis en features per niveau | 5 | F21 basis, 4.2 | F21, 4 |
| P10 Belblokken, belmodus en belscripts | 6 | F07, F08 | F07, F08, F25, 8.5.4 |
| P12 Prospectplanning en terugkomregels in de planning | 6 | F13 planning | F13, F25 |
| P11 Leadgenerator, AI-zoeker en KvK | 7 | F02 | F02, 12 |
| P15 Datacollectief | 7 | F02 | F02, 12 |
| P13 Agenda, meetingsoorten, agendakoppeling | 8 | F09 | F09, 12 |
| P14 Bezoeken, kansen langs de route, gebieden | 8 | F10, F18 | F10, F18 |
| P30 Onderweg: route, bezoek afronden, inloop, in de buurt, offline dag | 8 | F10, hoofdstuk 8 | 8.5.2, 8.5.3, 8.6, 8.8 |
| P31 Spraak, visitekaartje en onderweg-meldingen | 8 | F24, hoofdstuk 8 | 8.5.6, 8.6, 8.9, 8.10 |
| P16 Campagnes | 9 | F12 | F12, F25 |
| P17 Funnel van de prospectreis en overdracht | 9 | F17 | F17, F09, F25 |
| P18 Briefings, Pitstop, Schrijver, mail | 9 | F11 | F11, 11.5, 8.5.7 |
| P19 Agents voor interne en externe bronnen | 10 | F14 | F14, 11 |
| P20 CRM-koppeling | 10 | F02 CRM | F02, 12 |
| P21 Team, coaching, analyse | 11 | F20 | F20, 8.12 |
| P22 Maatwerk prospectreizen | 11 | F05 maatwerk | F05 |
| P23 Suggesties naar SalesDNA en overdracht naar DealDrive | 11 | F25, 12 | F25, 12 |
| P24 Platformbeheer compleet | 12 | F23 | F23 |
| P25 Helpcenter compleet en academie | 12 | F21 | F21 |
| P26 Kanalen, push, WhatsApp en tests op echte toestellen | 12 | F24, 12 | F24, 8.10, 8.15 |

---

## 19. Definition of Done en teststrategie

**Per prompt**

- `tsc`, `vue-tsc`, eslint, stylelint, `check:rechten`, `check:platform`, `check:functies` groen.
- Elke berekening een pure functie met unit-tests (grenzen, lege invoer, idempotentie).
- Databasevrije suite en wegwerp-Postgres-suite groen, inclusief cross-tenant en platformscheiding.
- Playwright desktop en telefoon (375, 390, 412 px) groen voor elk scherm; de tikdoelen uit 8.7 en "boven de vouw" uit 8.16 getoetst; schermen voor onderweg ook offline getest.
- Elke nieuwe functie in de functiecatalogus met niveau, pakket, recht en helpartikel; getest als Beginner, Gevorderd en Expert.
- Elke AI-stap met schema, mock en golden master; elke agenthandeling via de Bewaker.
- Elke integratie met adapter en mock; geen netwerk in tests.
- UI volgens het designsysteem: tokens, niets onder 11 px, aanraakdoelen 44 px, Escape sluit, focus zichtbaar, geen horizontale scroll op 390 px.
- Teksten: Nederlands, je-vorm, geen gedachtestreepjes, geen Engelse termen waar een Nederlandse bestaat.
- Handboek `docs/HOE-HET-WERKT.md` en het helpartikel bijgewerkt in dezelfde commit.

**Per sprint**: de "klaar als"-toestand in de browser en op ten minste één echte iPhone en één echte Android (8.15) bevestigd met schermafbeeldingen in het sprintverslag; adversariële review met alle bevindingen opgelost of bewust open met reden; prestatiebudgetten gemeten op staging; staging doorlopen door de founder.

**Teststrategie**: unit (vitest) voor alle pure functies; databasevrij (`tsx`) voor motor, reis, ritme, agents met mock-provider; wegwerp-Postgres voor migraties, RLS, cross-tenant, platformscheiding, synchronisatieconflicten, idempotentie; Playwright tegen de mock-server voor elke pagina en de kernflows (lead naar prospect, belblok, bezoekdag met tussenstop op de telefoon met een uur offline, verkoopverhaal via webhook naar script, campagne naar afspraak, afspraak naar klant, coachingsgesprek, werken in een organisatie); golden masters voor prompts; per sprint één echte AI-run met kosten in het verslag.

---

## 20. Beslissingen (ADR)

De ADR's 001 tot en met 010 uit `Architectuurplan-NewBusiness.md` blijven van kracht, met deze aanpassingen en toevoegingen.

| ADR | Beslissing | Status |
|---|---|---|
| 001 | Eigen app (Dealtrace) met hergebruik van DealDrive-code in `shared/` en `server/utils/` | aanvaard, naam gewijzigd |
| 002 | SalesDNA als alleen-lezen bron via gesigneerde webhooks | **gewijzigd**: SalesDNA is de voorkeursbron per sublaag via gesigneerde webhooks; Dealtrace spiegelt alleen bevestigde versies, schrijft nooit in SalesDNA behalve suggesties in kader 2, en werkt zonder koppeling met een eigen inrichting in dezelfde vorm (F25) |
| 003 | Template en uitvoering gescheiden met versies | aanvaard, uitgebreid naar belscripts en help-artikelen |
| 004 | Journey als fijnmazige positie, hoofdfases als groepering, statusmachine ernaast | aanvaard, uitgebreid met maatwerkreizen per doelgroep (ADR-013) |
| 005 | Agents met een mandaat in vier niveaus | aanvaard, mandaat ook per gebruikersniveau |
| 006 | Geen automatisering in het LinkedIn-account van de gebruiker | aanvaard |
| 007 | Vervolgmails door de Verzender op niveau B binnen een goedgekeurde campagne | aanvaard, alleen vanaf Gevorderd |
| 008 | Netlify en Supabase EU | aanvaard |
| 009 | Schema-validatie en bewijsplicht op elk AI-antwoord | aanvaard |
| 010 | Light provenance (herkomst per veld) in plaats van volledige veldhistorie | aanvaard |
| **011** | **Geen aparte HQ: platformbeheer in de app** | aanvaard (beslissing B4) |
| **012** | **Drie gebruikersniveaus naast rollen** | aanvaard (beslissing B3), **gewijzigd** door B18 en B19 |
| **013** | **Maatwerk prospectreizen per doelgroep** | aanvaard (beslissing B8) |
| **014** | **Belscripts als beheerde templates met AI-invulling** | aanvaard (beslissing B5) |
| **015** | **Eén leadstroom met vijf bronnen** | aanvaard (beslissing B11) |
| **016** | **Echte geografie voor kansen langs de route** | aanvaard (beslissing B9) |
| **017** | **Eén leesmodel voor het verkoopverhaal** | aanvaard (beslissing B16) |
| **018** | **Terugkomregels naast hercontactritmes** | aanvaard (beslissing B16) |
| **019** | **Onderbalk op de telefoon, afwijking van het designsysteem** | aanvaard (beslissing B13) |
| **020** | **Eén app voor telefoon en laptop, geen aparte telefoonbuild** | aanvaard (beslissingen B4 en B13) |
| **021** | **Dealtrace stopt bij de eerste afspraak; funnel in plaats van pipeline** | aanvaard (beslissing B17) |
| **022** | **AI-assistent voor iedere gebruiker, begrensd met credits per abonnement** | aanvaard (beslissing B20) |

### ADR-011 Geen aparte HQ: platformbeheer in de app

- **Context**: DealDrive had een founder-console op een eigen domein met een eigen build, zijbalk en impersonatie over twee domeinen. De opdrachtgever wil dat niet voor Dealtrace.
- **Beslissing**: één app, één domein, één build. Platformbeheer is een afgeschermde sectie voor de rol founder; de beheerder van een klant krijgt een eigen spiegel (gebruikers, abonnement, facturen, verbruik, prompts, audit). Instappen wordt "Werken in een organisatie" met reden, modus, tijdslimiet en audit.
- **Argumenten**: minder onderhoud (één build, één deploy), wat de founder ziet is wat de klant krijgt, één sessie, eenvoudiger support, kortere weg van roadmapwens naar oplossing.
- **Afgewezen**: aparte HQ-build (dubbel onderhoud, twee domeinen, impersonatietoken); platformfuncties alleen via de database (geen audit, foutgevoelig).
- **Consequenties**: de scheiding zit volledig op de server: twee lagen op `/api/platform/**`, een aparte databaserol voor functies over organisaties heen, verplichte tweestapsverificatie, append-only platformaudit, bouwcheck `check:platform`, cross-tenanttests op platformscheiding.
- **Heroverweging**: als een externe partij (reseller, supportbureau) platformtoegang nodig heeft; dan een supportrol zonder geld en prompts.

### ADR-012 Drie gebruikersniveaus naast rollen (gewijzigd in versie 1.2)

- **Beslissing**: een gebruiker heeft een rol (rechten), een niveau (Beginner, Gevorderd, Expert) en een werkplekprofiel (indeling). Per niveau staat elke functie aan of uit; de founder regelt dat in Platformbeheer, de salesmanager of beheerder kiest alleen het niveau van een gebruiker. Beschikbaarheid is pakket en rol en aan voor het niveau. Eén functiecatalogus op server en client. Er is geen groeipad (B18, B19).
- **Argumenten**: een rustige start verhoogt adoptie; de salesmanager houdt grip; ervaren mensen worden niet afgeremd (startniveau te kiezen, "Iedereen ziet alles"); welke functie bij welk niveau hoort, kan tijdens de bouw verschuiven door een feature aan of uit te zetten, zonder code te wijzigen.
- **Afgewezen**: alles voor iedereen (overweldigend voor beginners); niveaus als rechtenrol (verwart mogen met kunnen); een groeipad met criteria en voorstellen (te vroeg om te weten wat werkt, voelt als een spel).
- **Consequenties**: elke functie heeft een startniveau en een helpartikel; de server weigert functies die niet aanstaan; functies die niet aanstaan zijn zichtbaar met uitleg; de indeling in 4.3 wordt per sprint vastgesteld.

### ADR-013 Maatwerk prospectreizen per doelgroep

- **Beslissing**: een standaardreis die zonder inrichting werkt, plus maatwerkreizen per doelgroep met eigen fases (altijd met een hoofdfase), overgangen, startactiviteiten per rol en optionele ritmes; wijzigingen als conceptversie, publiceren met fasemapping, validatie op bereikbaarheid.
- **Argumenten**: elke doelgroep koopt anders; een vaste reis is te grof, een vrije reis zonder hoofdfase maakt rapportage onvergelijkbaar.
- **Consequenties**: fases per reis in plaats van organisatiebreed; regels kunnen aan een reis hangen; een account zit in één actieve reis; vergelijken van reizen op hoofdfaseniveau.

### ADR-014 Belscripts als beheerde templates met AI-invulling

- **Beslissing**: belscripts zijn templates met blokken, variabelen, bezwaren en versies, gemaakt in Instellingen en gekozen door de gebruiker; AI vult alleen de gemarkeerde delen per account in, met bron.
- **Argumenten**: bewezen opbouw voor beginners, vergelijkbaarheid per script, controle voor de salesmanager, minder AI-kosten dan een volledig gegenereerd script per gesprek, werkt ook zonder AI.

### ADR-015 Eén leadstroom met vijf bronnen

- **Beslissing**: AI-zoeker, KvK, Datacollectief, import en CRM leveren dezelfde leadstructuur, dezelfde ontdubbeling, dezelfde criteria en dezelfde groepen; KvK-nummer is de primaire sleutel.
- **Argumenten**: de gebruiker hoeft niet te weten waar een naam vandaan komt; ontdubbelen werkt over alle bronnen; kosten per bron zijn meetbaar en vergelijkbaar.

### ADR-016 Echte geografie voor kansen langs de route

- **Beslissing**: geocodering op adres met terugval op postcode en plaats; omrijtijd via een routedienst met cache; hemelsbreed maal 1,3 alleen als zichtbare schatting.
- **Argumenten**: plaatsmiddelpunten en hemelsbrede afstanden (DealDrive) geven verkeerde volgordes; de waarde van de feature hangt aan realistische omrijtijd.

### ADR-017 Eén leesmodel voor het verkoopverhaal

- **Beslissing**: alle functies lezen het verkoopverhaal uit `vv_*`; de SalesDNA-spiegel en de eigen inrichting vullen hetzelfde model, per onderdeel met een actieve bron.
- **Argumenten**: geen dubbele logica in scripts, boodschappen en briefings; overstappen tussen bronnen zonder herbouw; mengvorm per onderdeel mogelijk.
- **Afgewezen**: functies die zelf kiezen tussen `salesdna_*` en eigen tabellen.
- **Consequenties**: een projectiejob per sublaag met tests op de payloads uit de startset (Bijlage C); dezelfde seed als spiegel en als eigen inrichting moet overal hetzelfde resultaat geven.

### ADR-018 Terugkomregels naast hercontactritmes

- **Beslissing**: SalesDNA-hercontact heet in Dealtrace "terugkomregel" (wanneer en waarom je terugkomt na nee, verlies of slapen); de pogingenreeks blijft "hercontactritme" (hoe vaak en via welk kanaal bij geen reactie). Een terugkomregel start op de terugkomdatum een hercontactritme.
- **Argumenten**: beide begrippen zijn nodig en verschillen in tijdmaat (maanden tegenover dagstappen); één woord voor twee dingen verwart gebruikers en bouwers.
- **Consequenties**: twee tabbladen in F13; de afkoelperiode per kanaal blijft de ondergrens; KPI "Hercontact op tijd".

### ADR-019 Onderbalk op de telefoon, afwijking van het designsysteem

- **Context**: het designsysteem kent onder 768 px alleen een icoonstrook van 64 px; op 390 px blijft er te weinig ruimte over en staat er geen taak boven de vouw (`a-5-mobiel.png`).
- **Beslissing**: onder 768 px een compacte kop van 56 px en een onderbalk van 64 px met vijf tabs per werkplekprofiel, schuifvensters van onderen en een plakkende actiebalk; vanaf 768 px het designsysteem ongewijzigd.
- **Argumenten**: duimbereik, één hand, de patronen die in Dex werken; de inhoud krijgt de volle breedte.
- **Afgewezen**: icoonstrook ook op de telefoon (te smal); hamburgermenu (verstopt de kern).
- **Consequenties**: tokens en componenten voor kop, onderbalk en schuifvenster worden aan het designsysteem toegevoegd en daar gedocumenteerd; elke pagina hoort bij precies één tab.

### ADR-020 Eén app voor telefoon en laptop, geen aparte telefoonbuild

- **Context**: DealDrive bouwde Dex als aparte build met eigen allowlist en eigen schrijfwegen, en moest de telefoonervaring later als schil terugbouwen in de laptopapp.
- **Beslissing**: één build, één manifest, één service worker en dezelfde routes; de schil past zich aan de schermbreedte aan; één rekenkern in `shared/` en één schrijflaag met offline wachtrij.
- **Argumenten**: elke functie één keer bouwen; telefoon en laptop rekenen gegarandeerd hetzelfde; geen ontbrekende endpoints of labels op de telefoon.
- **Afgewezen**: een aparte telefoonapp of build; een native app in de eerste versie (later te heroverwegen voor achtergrondlocatie en CarPlay of Android Auto).
- **Consequenties**: elke pagina heeft een telefoonweergave en wordt op 390 px getest; mobiele beperkingen van een PWA (geen locatie op de achtergrond) worden eerlijk benoemd in 8.6.


### ADR-021 Dealtrace stopt bij de eerste afspraak

- **Beslissing**: het proces in Dealtrace loopt tot en met de gehouden eerste afspraak en de overdracht. Pipeline, deals en offertes zitten niet in de app; de funnel van de prospectreis (F17) vervangt de pipeline. Na de eerste afspraak gaat het account over naar DealDrive, het CRM of een collega.
- **Argumenten**: new business is het werk tot de eerste afspraak; deals en offertes hebben al een plek in DealDrive of het CRM; twee plekken voor dezelfde deal geven dubbel werk en verschillende cijfers; de funnel laat zien waar het tot de afspraak weglekt.
- **Afgewezen**: een eigen pipeline met offertes (dubbel met DealDrive en het CRM); een alleen-lezen kopie van de pipeline (verouderd, verwarrend).
- **Consequenties**: status `overgedragen` in plaats van `klant`; nieuwe gebeurtenissen `eerste-afspraak-gehouden`, `afspraak-niet-verschenen`, `overgedragen`, `geen-vervolg`; offertematrix, offertebriefing, meetingsoort Offertebespreking en de bijbehorende regels vervallen; accounts die uit DealDrive of het CRM terugkomen, komen via de terugkomregels terug.

### ADR-022 AI-assistent voor iedere gebruiker, alle AI begrensd met credits

- **Beslissing**: iedere gebruiker kan chatten met een AI-assistent (F26) die de context van het scherm kent; het abonnement bepaalt via credits per maand hoeveel. De assistent voert niets uit en zet alleen concepten klaar.
- **Argumenten**: hulp op het moment dat je hem nodig hebt verlaagt de drempel voor beginners; credits maken de kosten voorspelbaar voor klant en leverancier; één pot per organisatie met een plafond per gebruiker geeft de beheerder grip.
- **Afgewezen**: onbeperkt chatten (kosten onvoorspelbaar); chat alleen voor hogere niveaus (juist beginners hebben hem nodig).
- **Consequenties**: credits gelden voor alle AI-onderdelen (B20); prijs per handeling in `shared/credits.ts`; credits per pakket in de prijstabel; meter en meldingen bij 80 procent; agents stoppen bij 10 procent; bij 0 credits stopt alle AI en werkt de rest door; vangrails van 11.2 gelden ook voor de chat.

---

## 21. Risico's

| Risico | Impact | Maatregel |
|---|---|---|
| Accountmanagers stoppen na twee pogingen | lage conversie | ritme plant pogingen als taken; KPI pogingen tot afspraak; Coach signaleert; academie-artikel "Waarom de vierde poging" |
| Beginners voelen zich beperkt | weerstand | startniveau kiesbaar; features per niveau aan en uit te zetten; "Iedereen ziet alles" per organisatie; de AI-assistent helpt meteen |
| De indeling van functies per niveau klopt niet | te veel of te weinig voor beginners | indeling per sprint vaststellen (4.1); een functie verschuiven is een feature aan of uit zetten in Platformbeheer |
| AI-credits zijn te snel op of te duur | ontevreden klanten of marge weg | kosten per vraag vooraf tonen, plafond per gebruiker, melding bij 80 procent, credits per pakket na de eerste drie klanten bijstellen |
| Overdracht na de eerste afspraak blijft liggen | vervolg gaat verloren | regel "afspraak niet overgedragen" (F15), KPI overdracht binnen 24 uur, overdrachtsbriefing |
| Salesmanager gebruikt het managerdeel niet | geen coaching | vooraf gevulde weekoverleg-agenda, coachingkaart in één klik, aandachtspunten uitgerekend |
| Te veel AI-tekst, te weinig mens | reputatieschade | scripts als templates, stijlcheck, eerste contact per stuk goedkeuren, KPI overname |
| Datacollectief of KvK-kosten lopen op | marge weg | plafond per bron, cache, kosten per bron in Analyse, pakketgrenzen |
| AVG-klacht over koude benadering | juridisch en reputatie | herkomst per veld, informatieplicht, afmeldlink, onderdrukkingslijst, bel-me-niet, bewaartermijnen, verwerkersovereenkomsten |
| Founder-functies lekken naar klanten in één app | ernstig | twee lagen op de server, aparte databaserol, TOTP, audit, bouwcheck, cross-tenanttests (ADR-011) |
| Maatwerkreizen worden te complex | rapportage onbruikbaar | hoofdfase verplicht, validatie, publiceren alleen door salesmanager, vergelijken op hoofdfase |
| Kansen langs de route zijn onbetrouwbaar | buitendienst haakt af | echte geocodering, omrijtijd, uitleg per kans, "Overslaan" met reden die de score bijstuurt |
| CRM-koppeling geeft dubbele of verkeerde data | vertrouwen weg | bronprioriteit, ontdubbelen op KvK en domein, veldtoewijzing met voorbeeld, synchronisatielog, eerst lezen, dan schrijven |
| LinkedIn blokkeert een gebruiker | verlies netwerk | geen automatisering (ADR-006) |
| De telefoonervaring blijft achter bij de laptop | buitendienst haakt af | hoofdstuk 8 als acceptatie per prompt, tikdoelen, tests op echte toestellen elke sprint, mobiele schil vanaf sprint 1 |
| Offline wijzigingen botsen of gaan verloren | vertrouwen weg | idempotentiesleutels, versiecontrole per record, zichtbare wachtrij, conflictvenster, offline-tests in Playwright |
| PWA-beperkingen op iOS (push alleen na installatie, geen locatie op de achtergrond) | minder meldingen, geen automatische aankomst | installatievraag met uitleg, aankomst bij openen van de app, eerlijke teksten; native app als heroverweging (ADR-020) |
| Spraakherkenning stuurt klantnamen naar een dienst buiten de EU | AVG | transcriptie op de server via een EU-dienst; browserherkenning standaard uit |
| Verkoopverhaal is leeg of verouderd | scripts en berichten zonder kern | eigen inrichting met minimale velden, "Kopieer uit startset", dekkingsmeldingen, alleen bevestigd naar buiten, label "Mogelijk verouderd" |
| SalesDNA-webhooks vallen weg of komen dubbel | verouderde spiegel | idempotentie op event-id en versie, volledige synchronisatie bij een gat, koppelingsstatus met foutmelding voor de beheerder |
| Hergebruik veronderstelt toegang tot de DealDrive-code | vertraging | de bouwer krijgt leestoegang tot `basresink/dealdrive` en pint commit 75bee61 in `docs/HERGEBRUIK.md` (Bijlage B); waar dat niet kan, zijn de beschrijvingen in `secties/` en de bouwprompts de specificatie |

---

## 22. Open vragen

| # | Vraag | Voorstel | Wie | Wanneer |
|---|---|---|---|---|
| 1 | Inloggen met wachtwoord, eenmalige code per mail, of beide | **besloten (B12)**: eenmalige code per mail, TOTP erbij voor de founder | founder | gesloten |
| 2 | Criteria voor het groeipad | **vervallen (B19)**: geen groeipad | founder | gesloten |
| 3 | Mag een beheerder binnen de seats zelf gebruikers toevoegen | ja, met de stand per organisatie (F23) | founder | sprint 1 |
| 4 | Is "Alleen meekijken" de standaard bij werken in een organisatie, en mag een klant "Alleen na toestemming" kiezen | ja en ja | founder | sprint 1 |
| 5 | Datacollectief: API of bestandsexport, welk contract en welke velden | API met contract van de organisatie; import als terugval | founder | vóór sprint 7 |
| 6 | KvK: sleutel per organisatie of platformsleutel met doorbelasting | platformsleutel met plafond per pakket, eigen sleutel optioneel | founder | vóór sprint 7 |
| 7 | Routedienst: OpenRouteService (EU, goedkoop) of Google Routes (nauwkeuriger) | OpenRouteService met cache; Google als optie | founder | vóór sprint 8 |
| 8 | Welke CRM's na HubSpot, in welke volgorde | HubSpot, dan Salesforce, dan Dynamics en AFAS op aanvraag | founder | sprint 10 |
| 9 | Stripe als factuurbron met Moneybird als boekhouding, of andersom | Stripe als bron | founder | vóór sprint 12 |
| 10 | Prijs per pakket, seat en extra handeling | vastleggen als gegeven met geldig-vanaf | founder | vóór sprint 12 |
| 11 | WhatsApp-provider | Meta Cloud API via een Nederlandse provider | founder | sprint 12 |
| 12 | Telefonie-koppeling voor klik-om-te-bellen en gespreksduur | eerst `tel:`-links, koppeling na sprint 12 | founder | na sprint 12 |
| 13 | Opnemen van gesprekken voor de Notulist | nee, alleen aantekeningen, inspreken en geplakte transcripten | founder met jurist | sprint 8 |
| 14 | Wie schrijft de new business-artikelen | founder en salesexperts; AI-concept per artikel, mens redigeert | founder | sprint 5 tot 12 |
| 15 | Eerste organisatie | Sales Legends zelf, daarna één klant met binnendienst en buitendienst | founder | vóór sprint 5 |
| 16 | Supportrol zonder geld en prompts | na de eerste drie klanten | founder | na sprint 12 |
| 17 | Transcriptiedienst voor spraak (EU, prijs per minuut, Nederlands) | een EU-dienst achter een adapter met mock; keuze na een proef met tien echte verslagen | founder | vóór sprint 8 |
| 18 | Native app voor achtergrondlocatie en CarPlay of Android Auto | niet in de eerste versie; heroverwegen na een kwartaal gebruik (ADR-020) | founder | na sprint 12 |
| 19 | Veldnamen van de golden circle (L0.11) in SalesDNA | ophalen uit SalesDNA vóór de projectie | founder met SalesDNA | vóór sprint 3 |
| 20 | Fasen als payload: SalesDNA-fasen naar de hoofdfases van de reis | eigen event of meesturen met Winpunten; mapping in Instellingen | founder met SalesDNA | vóór sprint 3 |
| 21 | Accountklassen en rollen van SalesDNA tegenover die van Dealtrace | mapping op naam met controlelijst | founder | sprint 3 |
| 22 | Bijlagen van winpunten: alleen metadata of ook een tijdelijke downloadlink | eerst metadata | founder met SalesDNA | sprint 11 |
| 23 | Opent SalesDNA een endpoint voor suggesties van buiten, met welke limiet | hooguit 10 per sublaag per week | founder met SalesDNA | vóór sprint 11 |
| 24 | Aantal AI-credits per pakket en de prijs van extra credits | **voorlopig vastgesteld**: 200, 600 en 1.500 per gebruiker per maand; staat zo tot na de eerste drie klanten | founder | na de eerste drie klanten |
| 25 | Welke functies horen definitief bij welk niveau | startindeling uit 4.3; per sprint vaststellen | founder met eerste salesmanager | elke sprint |
| 26 | Worden alle AI-soorten ook in credits uitgedrukt, of alleen de chat | **besloten (B20)**: credits gelden voor alle AI-onderdelen | founder | gesloten |
| 27 | Overdracht naar DealDrive: de ontvangende kant bestaat nog niet in DealDrive | **API voorbereid (B21)** in `docs/api/`; DealDrive bouwt de ontvangende kant als aparte opdracht; tot dan staat de koppeling op mock (ontwikkeling) of uit (klanten) | founder | vóór sprint 11 |

---

## 23. Woordenlijst

- **Aanleiding (trigger)**: een gebeurtenis bij een bedrijf met bewijs (vacature, verhuizing, jubileum, nieuwe directeur) die een reden geeft om contact op te nemen.
- **Afkoelperiode**: de periode per kanaal waarin een account na een nee niet benaderd wordt.
- **AI-assistent**: de chat waarmee iedere gebruiker hulp vraagt aan AI, met de context van het scherm (F26).
- **BAND**: kwalificatie op Behoefte, Autoriteit, Noodzaak en Draagvlak.
- **Belblok**: een vast tijdvak in de agenda met een gevulde bellijst en een gekozen belscript.
- **Belmodus**: het scherm waarin je een belblok gesprek na gesprek afwerkt.
- **Belscript-template**: een in Instellingen gemaakt script met blokken, variabelen en bezwaren, dat AI per account invult.
- **Bewaker**: de functie die elke agenthandeling toetst aan mandaat, consent, afkoeling, ritme, capaciteit en AI-credits.
- **Buying committee**: wie bij een account beslist, beïnvloedt, blokkeert of gebruikt.
- **Credits**: de eenheid waarin het abonnement bepaalt hoeveel er met de AI-assistent gechat kan worden.
- **Dagpakket**: wat Dealtrace elke ochtend op de telefoon bewaart voor een dag offline: afspraken, route, accountkaarten, scripts en helpartikelen (8.8).
- **Dekking**: hoeveel branches een eigen verhaal of belofte hebben ("2 van 4").
- **Doelgroep**: de definitie van een groep bedrijven waarop een reis, campagne en leadronde draaien.
- **Dossier**: het bewijs per criterium van een lead of prospect; verloopt na 30 dagen.
- **Features per niveau**: per niveau staat elke functie aan of uit; de founder regelt dat in Platformbeheer.
- **Founder**: de rol van het team achter Dealtrace, met platformbeheer in de app.
- **Funnel**: het overzicht van hoeveel accounts per fase van de prospectreis staan, doorstromen en uitvallen, tot en met de eerste afspraak (F17).
- **Gebruikersniveau**: Beginner, Gevorderd of Expert; bepaalt welke functies voor een gebruiker aanstaan, volgens de features per niveau.
- **Hercontactritme**: wat je doet als een prospect niet reageert: pogingen, intervallen, kanalen en parkeerduur.
- **Hoofdfase**: Vinden, Bewerken, Verbinden, Overgedragen, Verloren.
- **Kans langs de route**: een prospect of klant dicht bij de bezoeken van de dag met een reden om langs te gaan of te bellen.
- **Kernzin**: de eerste, dragende zin van het bedrijfsverhaal, gebruikt als opening in scripts en berichten.
- **Leesmodel**: de tabellen `vv_*` waaruit alle functies het verkoopverhaal lezen, gevuld uit SalesDNA of de eigen inrichting.
- **Mandaat**: wat een agent zelf mag (A), binnen een kader (B), per stuk na goedkeuring (C) of nooit (D).
- **Mogelijk verouderd**: label op een onderdeel van het verkoopverhaal waarvan een bron is gewijzigd; Dealtrace werkt door met de laatst bevestigde versie.
- **Onderbalk**: de navigatie onderin op de telefoon met vijf tabs per werkplekprofiel.
- **Onderweg**: de telefoonweergave van de route van de dag (`/onderweg`).
- **Overdracht**: het doorzetten van een account na een gehouden eerste afspraak naar DealDrive, het CRM of een collega, met briefing.
- **Pitstop**: de AI-voorbereiding op een taak of afspraak, altijd ter goedkeuring.
- **Platformbeheer**: de afgeschermde sectie in de app voor de founder (geen aparte HQ).
- **Prospectreis**: de fases die een account van een doelgroep doorloopt; standaard of maatwerk.
- **Regiodag**: de vaste dag waarop een buitendienstmedewerker een regio bezoekt.
- **Schuifvenster**: venster dat op de telefoon van onderen opschuift; op de laptop dezelfde inhoud als flyout.
- **Soort concurrent**: direct, indirect, intern (de klant doet het zelf) of niets doen.
- **Status**: nieuw, in reis, wachtend, nee, gescoord, overgedragen.
- **Terugkomregel**: wanneer, waarom, via welk kanaal en door wie je terugkomt na een nee, een verlies of een slapende periode; start een hercontactritme.
- **Verkoopverhaal**: golden circle, bedrijfsverhaal, ambitie en visie, waarde en belofte, branches, concurrenten, winpunten en terugkomregels (F25).
- **Werkplekprofiel**: binnendienst, buitendienst of hybride; bepaalt de indeling van de werkplek.
- **Winpunt**: een moment in de klantreis waarop de organisatie het anders doet dan de concurrent; de kern van elke boodschap.

---

## Wijzigingenlog

| Versie | Datum | Wijziging |
|---|---|---|
| 1.0 | 2026-10-14 | Eerste versie van het bouwplan uit alle documenten in deze repository, met de beslissingen B1 tot en met B11 van de opdrachtgever: productnaam Dealtrace, binnendienst en buitendienst, drie gebruikersniveaus, geen aparte HQ, belscript-templates, eigen velden, AI-agents voor interne en externe bronnen, standaard en maatwerk prospectreis, kansen langs de route, helpcenter met new business-academie, leadgenerator met import, CRM, KvK en Datacollectief |
| 1.1 | 2026-10-14 | Beslissingen B12 tot en met B16 (inloggen met een code per mail, mobiel en onderweg, sprints naar inhoud, stijlbestand leidend, SalesDNA-sublagen) en de status van de bronnen (0.4); nieuw hoofdstuk 8 Mobiel en onderweg op basis van Dex in DealDrive; nieuwe feature F25 Verkoopverhaal en Richting met leesmodel, webhooks en terugkomregels, verwerkt in F01 tot en met F24; ADR-002 aangevuld, ADR-017 tot en met ADR-020; twaalf sprints; 32 bouwprompts, uitgeschreven in `docs/prompts/`; Bijlage A (checklist gaten DealDrive), Bijlage B (hergebruikkaart, commit 75bee61) en Bijlage C (startset Voltvast); nieuwe mockup in `mockup-dealtrace/` |
| 1.2 | 2026-10-15 | Beslissingen B17 tot en met B20: Dealtrace loopt tot en met de eerste afspraak (geen pipeline, deals en offertes; F17 wordt Funnel van de prospectreis met overdracht; status `overgedragen`); het niveau ontstaat door het aanzetten van functies met een voorlopige startindeling; het groeipad en de leerpaden per niveau zijn verwijderd; nieuwe feature F26 AI-assistent met credits per abonnement; ADR-012 gewijzigd, ADR-021 en ADR-022 nieuw; prompt P33 |
| 1.3 | 2026-10-15 | B20 aangevuld: credits gelden voor alle AI-onderdelen (11.4 herschreven met credits per handeling); credits per pakket voorlopig vastgesteld; B21: API met DealDrive voorbereid in `docs/api/` met mock-antwoorden in `seed/dealdrive-mock/` |
| 1.4 | 2026-10-15 | B18 vereenvoudigd: geen schakelaars per gebruiker; per niveau staan features aan of uit, door de founder te regelen op `/platform/features`; nieuw 13.5 Lokaal bouwen |

---

# Bijlagen

## Bijlage A. Checklist bekende gaten van DealDrive

DealDrive is de bron van ongeveer 60 procent van de logica. De featurebeschrijvingen in `secties/`, het bouwpromptsdocument (bijlage 14, 24 punten) en de schermonderzoeken leggen gaten bloot: plekken waar het scherm iets belooft wat de code niet doet, of waar new business niet past. Deze checklist zorgt dat geen enkel gat ongemerkt meekomt. Elke regel is een acceptatiecriterium in de genoemde bouwprompt; de reviewer vinkt hem af in het sprintverslag.

### A.1 Uit het bouwpromptsdocument (bijlage 14)

| # | Gat in DealDrive | Oplossing in Dealtrace | Feature | Prompt |
|---|---|---|---|---|
| 1 | Een gewonnen deal maakt de prospect geen klant | **Vervalt in Dealtrace (B17)**: geen deals; de overdracht na de eerste afspraak zet in één transactie status, fase en audit en stuurt het pakket naar DealDrive of het CRM | F17 | P17 |
| 2 | `tier` naast `accountfase`; de leadgenerator schrijft het verkeerde veld | Eén klasseveld (`klasse`), ook bij "Neem over" | F02, F03 | P03, P11 |
| 3 | `eerste-afspraak-gepland` vuurt bij elke afspraak | Alleen bij de eerste niet-geannuleerde afspraak | F05, F09 | P05, P13 |
| 4 | Leadgenerator zonder server, leadstabel, webzoeker en bundelmeting; "Opnieuw uitzoeken" en "Toch uitzoeken" uitgeschakeld | Leadstabel, endpoints, vijf bronnen, bundel op de server, werkende knoppen | F02 | P11, P15, P20 |
| 5 | Journey-starterset is een klantjourney; vier gebeurtenissen worden nergens gemeld; geen handmatige correctie | Standaard prospectreis met een melder per gebeurtenis; "Fase corrigeren" met reden | F05 | P05 |
| 6 | Motor filtert niet op accounttype; zes velden sturen niets | Afbakening op type, status, reis, fase, doelgroep, campagne, klasse; dode velden geschrapt | F15 | P06 |
| 7 | Editor mist taaksjabloon, signaaltypes en status; normalisatie laat velden vallen | De editor is de enige bron; Excel is import en export daarvan | F15 | P06 |
| 8 | 37 standaardregels zonder trigger; geen belritmeregel; meetingrij dood | Starterset van 23 regels die allemaal draaien; matrix levert zelfstandig taken | F15, F16 | P06 |
| 9 | Eigenaar alleen via script; geen filter "Van mij" | Eigenaar in de Info-flyout; "Van mij" standaard op elke lijst | F03 | P03 |
| 10 | Verwijderen wist contacten alleen lokaal; verwijderknoppen zonder rolcontrole; inline wissen met `undefined` | Cascade op de server, knop alleen met recht, wissen met `null` | F03, F04 | P03 |
| 11 | Afronden registreert het contactmoment op één pad | Eén functie `rondTaakAf` voor alle paden | F06 | P07 |
| 12 | Herhaalde en vervolgtaken erven de herkomst niet | Herkomst (inzicht, regel, actiesoort, uitvoerder) gaat mee | F06 | P07 |
| 13 | Campagne verliest varianten bij aanmaken; handmatig actief zet geen startdatum; twee tempoformules | Varianten blijven, startdatum bij activeren, één tempofunctie | F12 | P16 |
| 14 | AI-plafond standaard uit, alleen op de motor, geen melding bij 80 procent | Plafond op alle soorten, standaard aan, melding bij 80 procent | 11.4, F23 | P08, P24 |
| 15 | Werkdagen zonder feestdagen | Nederlandse feestdagen in `shared/datum.ts` | alle | P01 |
| 16 | Dubbele definities (twee journey-seeds, vier kopieën van offertestatussen, twee tempoformules) | Elke definitie één keer in `shared/` | alle | alle |
| 17 | Geen schrijfpad voor de offertestatus; upload maakt geen offerte | **Vervalt in Dealtrace (B17)**: geen offertes; blijft een gat in DealDrive | n.v.t. | n.v.t. |
| 18 | Jaarplanning slaat niets op, geen motorregel, vaste startmaand, "benaderd" niet begrensd op het jaar | Regel `jaarplanning-venster`, instelbare startmaand, benaderd per verkoopjaar | F13 | P12 |
| 19 | Web-beoordeling parst vrije tekst zonder schema | Schema afgedwongen met tool-use | F14 | P19 |
| 20 | Inactiviteitsregel vuurt nooit voor een account zonder datum | `ookZonderDatum` met de aanmaakdatum als anker | F15 | P06 |
| 21 | HubSpot-endpoints zonder sessiecontrole, state in het geheugen, schrijft niets | CRM-adapter met sessiecontrole, tokens per organisatie, schrijven en lezen | F02 | P20 |
| 22 | `executorStatus` met vier dode waarden | Alleen gebruikte waarden; mandaatletter per handeling | 11.3 | P08 |
| 23 | Bij een lege servertabel blijft demodata in de client | Geen demodata als terugval buiten de mock-modus | F24 | P01 |
| 24 | Handboek en code zeggen iets anders over de promptcache | Handboek klopt vanaf dag één; golden master bewaakt | 11 | P18 |

### A.2 Uit de featurebeschrijvingen in `secties/`

| # | Gat in DealDrive | Oplossing in Dealtrace | Feature | Prompt |
|---|---|---|---|---|
| 25 | Elk nieuw account krijgt vaste score 50; aanleiding alleen uit seed of import | Echte score met zichtbare opbouw | F03 | P03 |
| 26 | Sortering "Laatste activiteit" gebruikt een ander veld dan de rij toont | Eén functie `laatsteContact` | F03 | P03 |
| 27 | Promoveren vanuit Info zonder bevestiging en zonder melding | Dealtrace promoveert niet (B17); overdragen gaat altijd met bevestiging en audit | F03, F17 | P03, P17 |
| 28 | Rol en "beslist mee" worden door drie formulieren verschillend gevuld | Eén rolbegrip | F04 | P03 |
| 29 | Open taken tellen op contact- en accountkaart verschillend | Eén telregel | F04 | P03 |
| 30 | Bellijst op Bezoeken sluit iedereen uit die je in de hele periode bezoekt | Alleen uitsluiten op dezelfde dag | F10 | P14 |
| 31 | Kansen langs de route alleen uit de top acht bezoektaken; hemelsbreed tussen plaatsmiddelpunten; regiodag genegeerd; accounts van collega's | Alle eigen bezoektaken, echte geocodering en omrijtijd, regiodag, scope "mijn" | F10 | P14 |
| 32 | Bezoektaak blijft open na "+ Plan bezoek" | Taak gekoppeld aan de afspraak en gesloten bij afronden | F09, F10 | P13, P14 |
| 33 | Prospects zonder historie of klasse vallen uit "Wie is er aan de beurt?" | Doen overal mee | F09 | P13 |
| 34 | Briefing op Vandaag altijd BPO; achterstallige taken zonder briefing; import fabriceert een contactmoment | Eén soortbepaling op elke ingang; achterstallig krijgt briefing; import maakt geen contactmoment | F11 | P18 |
| 35 | Bellijst "vandaag" filtert niet op vandaag; pagina en vuller rekenen verschillend; taak hangt aan blok via "binnen een uur" | Eerlijke kop, één rangorde, echte koppeling `belblokId` | F07 | P10 |
| 36 | Soort van een belblok stuurt de vulling niet; opvolging verdringt koude acquisitie | Soort stuurt de vulling, met verhouding bij gemengd | F07 | P10 |
| 37 | Vlaggen "agenda bezet" en "meldingen stil" doen niets | Werken echt via agendakoppeling en meldingswachtrij | F07 | P10, P13 |
| 38 | Campagnebord en taak lopen uiteen bij slepen naar Klaar | Kolomwissel vraagt de uitkomst | F12 | P16 |
| 39 | Achterstallige en ongedateerde taken vallen weg uit de horizonweergave | Altijd bovenaan in "Vandaag" | F06 | P07 |
| 40 | Motor zet een bijgewerkt inzicht terug op ongelezen | Status blijft | F06 | P07 |
| 41 | "Standaardset terugzetten" laadt regels zonder trigger, en bij de journey blijven overgangen staan en verdwijnen accenten | Terugzetten laadt de werkende starterset; per reis alles samen | F05, F15 | P05, P06 |
| 42 | Fase verwijderen laat kale ids achter op regels, overgangen en kaarten | Verplichte vervangende fase; alles wordt omgezet | F05 | P22 |
| 43 | Matrix "niet ingesteld" en "bewust uit" beide als 0 | Zichtbaar verschillend | F16 | P06 |
| 44 | Afrekening van het ritme per klasse maskeert stille accounts | Afrekening per account | F16, F20 | P06, P21 |
| 45 | Regio-overlap alleen gemeld, niet opgelost; plaatsnamen zonder synoniemen | Overlap geblokkeerd; synoniemenlijst | F18 | P14 |
| 46 | Leadgenerator toetst werkgebied niet; klasse uit vaste standaard; profiel telt prospects mee | Werkgebied getoetst; klassen van de organisatie; profiel alleen uit klanten | F02 | P11 |
| 47 | Afwijzen van een lead alleen in de browser | Afwijzen met reden op de server | F02 | P11 |
| 48 | HQ: pakketwissel zonder bevestiging en audit; gezondheid telt alleen taakwijzigingen; geen melding bij gebruikersaanvraag | Bevestiging, audit, brede activiteit, melding | F23 | P02, P24 |
| 49 | HQ: sleutelvingerafdruk toont de eerste vier tekens; agendageheim gedeeld met AI-sleutels | Alleen vingerafdruk van acht tekens; eigen geheim per doel | F23 | P24 |
| 50 | HQ: roadmap-bouwrun kan twee keer starten | Status "gestart" voorkomt een tweede run | F23 | P24 |

---

## Bijlage B. Hergebruikkaart DealDrive

**Basis.** Hergebruik gaat uit van de DealDrive-repository `basresink/dealdrive`, branch `develop`, **commit 75bee61 (14 oktober 2026)**. Het designsysteem is van die commit afgeleid; het bouwpromptsdocument verwees nog naar 1c314ec (12 oktober). De bouwer van Dealtrace krijgt **leestoegang** tot `basresink/dealdrive` en pint deze commit in `docs/HERGEBRUIK.md`. Wordt later een nieuwere commit gebruikt, dan wordt deze kaart opnieuw gecontroleerd.

**Werkwijze.** Kopieer de logica met de tests, niet blind de bestanden: Dealtrace heeft een andere reis, andere rollen en niveaus, en één build. Gedeelde pure functies houden dezelfde bestandsnaam, zodat een fix in de ene repository in de andere te herhalen is; elk kwartaal een vergelijking met `git diff --no-index` op `shared/` en de gedeelde `server/utils/`.

**Controle.** Alle bestandsnamen die dit bouwplan als hergebruik noemt, zijn gecontroleerd tegen commit 75bee61: 109 bestaan. De overige zijn nieuw in Dealtrace (bijvoorbeeld `shared/reis.ts`, `shared/belscripts.ts`, `shared/functies.ts`, `shared/hercontact.ts`, `shared/nbStatus.ts`, `shared/route.ts`, de adapters voor KvK, Datacollectief en CRM) of zijn in `develop` hernoemd: `route.vue` heet nu `app/pages/bezoeken.vue`, de regio-analyse staat in `app/pages/bezoek-analyse.vue`, `app/pages/meeting-analyse.vue` en `app/pages/account-analyse.vue`, en `shared/permissions.ts` is `server/utils/permissions.ts`.

| Laag | DealDrive (`develop`, 75bee61) | Gebruik in Dealtrace | Hoe |
|---|---|---|---|
| Opslag en tenant | `server/utils/appStore.ts`, `shared/wisPatch.ts`, `server/db/rls.sql`, `server/db/schema.ts` | Opslaglaag, RLS | letterlijk, schema uitgebreid |
| Synchronisatie | `server/api/sync/mutations.post.ts`, `shared/syncTabellen.ts`, `server/utils/mutationStore.ts`, `server/utils/serverRecordStore.ts`, `app/composables/useSyncQueue.ts`, `app/composables/useOptimisticWrite.ts`, `app/utils/offlineDb.ts`, `app/components/ConflictResolveModal.vue` | Offline en wachtrij | letterlijk |
| Rechten en sessie | `server/utils/permissions.ts`, `server/utils/session.ts`, `server/utils/supabaseAuth.ts`, `server/utils/auditStore.ts`, `server/utils/superuser.ts` | Rechten, sessie, audit, founder | aanpassen: niveaus, teams, founder in één app, inloggen met code |
| Instellingen | `shared/settingKeys.ts`, `server/utils/settingsStore.ts`, `server/utils/featureFlags.ts`, `shared/features.ts`, `server/utils/pakketten.ts` | Instellingen, pakketten, functievlaggen | aanpassen: functiecatalogus met niveau (4.2) |
| Motor | `server/utils/ruleEngine.ts`, `server/utils/activityRulesStore.ts`, `server/utils/activitySellingWerkmap.ts`, `shared/activitySelling*.ts`, `app/composables/useActivitySellingRules.ts`, `app/pages/instellingen/activity-selling.vue`, `app/plugins/motorPoll.client.ts` | Regels en motor | aanpassen: nieuwe patronen, landing, capaciteit |
| Reis | `server/utils/journeyEngine.ts`, `app/composables/useCustomerJourney.ts`, `app/pages/instellingen/customer-journey.vue`, `server/utils/faseAccent.ts` | Prospectreis | aanpassen: reis als object met versies |
| Ritme | `shared/ritmematrix.ts`, `shared/datum.ts`, `shared/periodeFilter.ts` | Matrices, werkdagen, periodes | letterlijk |
| Belblokken | `shared/belblokken.ts`, `server/utils/belblokVuller.ts`, `app/composables/useBellijst.ts`, `app/composables/useBelblokken.ts`, `app/pages/belblokken.vue` | Belblokken | aanpassen: soort stuurt vulling, belmodus |
| Leads | `shared/leadGenerator.ts`, `app/pages/generator.vue`, `app/pages/import.vue`, `server/utils/webBron.ts` | Leadgenerator en import | aanpassen: server, vijf bronnen |
| Kwalificatie | `shared/bandKwalificatie.ts` | BAND | letterlijk |
| Campagnes | `shared/campagneSoorten.ts`, `server/utils/campagneTempo.ts`, `server/utils/campagneAdvies.ts`, `server/utils/campagneAfsluiter.ts`, `app/pages/campagnes/*` | Campagnes | aanpassen: wizard, kolommen, spreiding |
| Bezoeken en gebieden | `app/pages/bezoeken.vue`, `app/components/RouteList.vue`, `app/components/MiniMap.vue`, `app/composables/useGeoNL.ts`, `shared/gebieden.ts`, `app/pages/instellingen/gebieden.vue`, `app/pages/bezoek-analyse.vue`, `server/api/gebieden/analyse.get.ts` | Bezoeken, kansen, regio | aanpassen: geocodering, omrijtijd |
| Telefoon (Dex) | `shared/dexDag.ts`, `shared/dexRitme.ts`, `shared/dexSignalen.ts`, `shared/dexKansen.ts`, `shared/dexGesprek.ts`, `shared/dexRecap.ts`, `shared/dexCoaching.ts`, `shared/werkplek.ts`, `app/pages/dex/*`, `app/components/Dex*.vue`, `server/utils/dex*.ts` | Mobiel en onderweg (hoofdstuk 8) | aanpassen: geen aparte build, in de Dealtrace-app |
| Taken en inzichten | `app/pages/taken.vue`, `app/pages/inzichten.vue`, `app/components/TaakFlyout.vue`, `app/components/InzichtFlyout.vue`, `app/components/NieuweTaakFlyout.vue`, `app/components/VandaagPanel.vue`, `app/components/SwipeActions.vue`, `app/composables/useLongPress.ts` | Acties en Vandaag | aanpassen: uitkomsten, pogingen |
| Agenda en meetings | `app/pages/agenda.vue`, `app/pages/meetings.vue`, `app/components/AfspraakFlyout.vue`, `app/components/NieuweAfspraakFlyout.vue`, `server/utils/calendarSync.ts`, `server/utils/calendarProviders.ts`, `server/utils/calendarCrypto.ts` | Agenda en agendakoppeling | aanpassen: meetingsoorten met uitkomst |
| Mail | `server/utils/mailVersturen.ts`, `server/utils/mailProviders.ts`, `server/utils/mailConnectionStore.ts` | Concepten versturen, Verzender | aanpassen: consent, dagplafond |
| Pipeline | `app/pages/pipeline.vue`, `app/pages/offertes.vue`, `app/components/DealFlyout.vue` en verwanten | **vervalt (B17)**: Dealtrace heeft geen pipeline en offertes; de funnel (F17) wordt nieuw gebouwd | niet overnemen |
| AI | `server/utils/llm-provider.ts`, `server/utils/aiInsight.ts`, `server/utils/agentExecutor.ts`, `server/utils/promptBibliotheek.ts`, `server/utils/promptStandaarden.ts`, `shared/promptSlots.ts`, `server/utils/aiVerbruik.ts`, `shared/aiBundel.ts`, `server/utils/verslagAnalyse.ts`, `server/utils/autoVoorbereiding.ts`, `server/utils/briefingAi.ts` | AI-lagen, Pitstop, bundel | aanpassen: agents met mandaat, Bewaker |
| Briefings | `app/pages/briefings.vue`, `app/components/BriefingFlyout.vue`, `shared/briefingBlokken.ts`, `app/composables/useQuickBriefing.ts` | Briefings | aanpassen: soorten voor new business |
| Accounts en contacten | `app/pages/prospects/*`, `app/pages/contacten/*`, `app/pages/accounts/[id]/index.vue`, `app/components/AccountRow.vue`, `app/components/EditableField.vue`, `app/components/InlineEditChip.vue`, `app/composables/useCustomFields.ts`, `app/pages/instellingen/custom-fields.vue` | Prospects, contacten, eigen velden | aanpassen |
| Platform | `app/pages/admin/*`, `server/api/superuser/*`, `server/utils/gebruikersAanvraagStore.ts`, `server/utils/featureRequestStore.ts`, `server/utils/github.ts`, `server/utils/llmInstellingen.ts`, `server/utils/orgStarter.ts` | Platformbeheer in de app | aanpassen: geen aparte build; `AdminShell.vue` en `impersonatieToken.ts` vervallen |
| Meldingen en PWA | `app/components/NotificationBell.vue`, `app/pages/notificaties.vue`, `server/utils/pushVerzenden.ts`, `server/utils/reminderSweep.ts`, `server/utils/overzichtSweep.ts`, `app/components/MobileShell.vue`, `app/components/OfflineBanner.vue`, `app/components/InstallPrompt.vue`, `app/components/IOSInstallModal.vue` | Meldingen, push, PWA | letterlijk, plus mobiele schil uit hoofdstuk 8 |
| Stijl | `designsysteem/dealdrive-designsysteem.css` (in deze repository) | Designsysteem | letterlijk |
| Tests | `server/db/e2e-*.ts`, wegwerp-Postgres in `tools/wegwerpdb/` | Testlagen | letterlijk, uitgebreid |

---

## Bijlage C. Startset testdata: Testbedrijf Voltvast

Testbedrijf Voltvast is een fictieve demo-organisatie van SalesDNA: een technische groothandel voor installateurs in Midden- en Noord-Nederland. De seed staat als bestand in `seed/voltvast.json`, wordt geladen door `db/seed/voltvast.ts` en dient als fixture voor de webhook-mock (payloads van `sublaag.bevestigd`). Dezelfde data laadt ook als eigen inrichting (bron `eigen`); testgeval C.9 punt 10 vergelijkt beide. In de app staat hij achter de knop "Kopieer uit startset" (F25). Bij elk onderdeel staat wat letterlijk uit de bron komt (**bron**) en wat voor de seed is aangevuld in dezelfde lijn (**aangevuld**). Aangevulde teksten zijn fictief, horen bij Voltvast en bevatten geen gegevens van Sales Legends of een echt bedrijf.

### C.1 Organisatie

- Naam: Testbedrijf Voltvast (bron). Werkgebied: Midden- en Noord-Nederland (bron).
- Teams: Organisatie, Binnendienst, Team Noord, Team Zuid (bron, teamtabs op Up- en cross-sell).
- Rollen: Accountmanager, Business developer, Binnendienst, Salesmanager (bron).
- Accountklassen: "A · Aantal monteurs (Prospects)", "B · Aantal monteurs (Prospects)", "C · Aantal monteurs (Prospects)", "A · Jaaromzet bij Voltvast (Klanten)", "B · Jaaromzet bij Voltvast (Klanten)", "C · Jaaromzet bij Voltvast (Klanten)" (bron).
- Kwartaal: Q4 2026 loopt (bron).

### C.2 Branches (L0.6, versie 1, bevestigd) bron

| _id | Branche | Doelgroep | Markt | Termijn | Prioriteit |
|---|---|---|---|---|---|
| br-01 | Installatiebedrijven woningbouw | primair | huidig | nu | hoog |
| br-02 | Utiliteitsinstallateurs | primair | huidig | nu | midden |
| br-03 | Woningcorporaties (via installateurs) | secundair | toekomstig | 2027 | hoog |
| br-04 | Zonne-energiebedrijven | secundair | toekomstig | 2028 | laag |

Aangevuld voor Dealtrace: `termijn_vanaf` br-01 en br-02 vandaag, br-03 1 januari 2027, br-04 1 januari 2028; SBI-mapping br-01 en br-02 naar 4321 (elektrotechnische bouwinstallatie) en 4322 (loodgieters- en verwarmingsinstallatie), br-03 naar 6820 (verhuur van onroerend goed), br-04 naar 4321 met trefwoord "zonnepanelen". "Komt terug in" bij Voltvast: Bedrijfsverhaal, Waarde en belofte, Up- en cross-sell, Campagnes; Regio indeling heeft geen branches (bron).

### C.3 Bedrijfsverhaal (L0.1)

- Kernzin (bron): "Voltvast is een technische groothandel voor installateurs in Midden- en Noord-Nederland."
- Lengte (bron): 64 woorden, "1 minuut · 64 woorden". Verhalen per branche voor br-01 en br-02 (bron); geen verhaal voor br-03 en br-04 (bron), dekking "2 van 4".
- Volledige tekst "Wie zijn wij" (aangevuld, de bron geeft alleen de kernzin): "Voltvast is een technische groothandel voor installateurs in Midden- en Noord-Nederland. Installateurs verliezen tijd als materiaal te laat of verkeerd op de bouw komt. Daarom denken wij mee vanaf het ontwerp, schouwen we het project en leveren we op het afgesproken uur. Zo kan de installateur zijn project zonder zorgen opleveren, ook nu de energietransitie het werk complexer maakt."
- Verhaal br-01 (aangevuld): "Bij woningbouwprojecten staan monteurs vaak te wachten op materiaal. Wij plannen de levering per bouwfase en zijn binnen 48 uur op de bouw voor een gratis projectschouw."
- Verhaal br-02 (aangevuld): "Utiliteitsprojecten vragen veel afstemming tussen techniek en planning. Wij denken vanaf het ontwerp mee en houden de installateur via de projectapp op de hoogte van elke levering."
- Kader 5 taak (bron): "Bedrijfsverhaal laten lezen door twee vestigingsleiders", te laat.
- Status: bevestigd, versie 3 (aangevuld; de bron noemt dat het verhaal bevestigd is en een keer op Mogelijk verouderd stond door de Golden circle, met "besloot dat de sublaag nog klopt").

### C.4 Ambitie & visie (L0.2)

- Ambitie (bron, letterlijk, 27 woorden): "In 2029 is Voltvast de vaste projectpartner van 400 installatiebedrijven in onze regio, met 60 procent van onze omzet uit projecten waarin we vanaf het ontwerp meedenken."
- Visie (bron, eerste zin letterlijk, 34 woorden in totaal): "De energietransitie maakt installatiewerk complexer." Vervolg (bron, als samenvatting, voor de seed in zinnen gezet): "Installateurs zoeken een partner die techniek, planning en levering samenbrengt. Wie dat het beste doet, wint hun loyaliteit."
- Missie (bron, samenvatting, voor de seed in een zin gezet): "Wij helpen installateurs elk project zonder zorgen op te leveren, met eerlijk advies, de juiste materialen en levering op het afgesproken uur."
- Ambitiedoelen voor Dealtrace (aangevuld, status voorstel): "Vaste projectpartners", aantal 400, jaar 2029; "Omzet uit projecten", 60 procent, jaar 2029.
- Jaarkeuzes in het Plan (bron: bij Winpunten, Prospectmix en Branches; teksten aangevuld): "Winpunt voor de eerste fasen vastleggen", "Werfroute voor woningcorporaties", "Branches toetsen aan de klantdata".

### C.5 Waarde en belofte (L0.4)

- Bron: algemeen blok "Voor al je klanten" plus één blok per branche, dekking "1 van 4"; Utiliteitsinstallateurs heeft geen eigen blok. Het blok in het editorvoorbeeld is Installatiebedrijven woningbouw. De teksten zelf staan niet in de bron.
- Kernbelofte algemeen (aangevuld): "Uw materiaal staat op het afgesproken uur op de bouw."
- Waardestatement algemeen (aangevuld): "Voor installateurs met projecten in Midden- en Noord-Nederland die tijd verliezen door late of verkeerde leveringen. Wij denken mee vanaf het ontwerp en leveren per bouwfase, zodat monteurs doorwerken en het project op tijd wordt opgeleverd."
- Blok br-01 (aangevuld): kernbelofte "Binnen 48 uur een gratis projectschouw, daarna levering per bouwfase."; waardestatement "Voor installatiebedrijven in de woningbouw: minder wachttijd voor monteurs en minder retouren, omdat de levering vooraf op het project is afgestemd."

### C.6 Concurrenten (L0.8)

- Bron: vijf concurrenten (01 tot 05), de eerste met soort Direct; één regel is "Niets doen" (de klant die bij zijn vaste leverancier blijft, met onderscheid, antwoord en bewijs); Prospectmix toont het idee "Klanten van Landelijke groothandelsketen overhalen."; "Komt terug in" alleen "Plan"; geen winpunt kiest een concurrent. De binnendienst hoort aan de telefoon dat het online goedkoper is (bron).
- Seed (aangevuld behalve de naam "Landelijke groothandelsketen" en het bestaan van Niets doen):

| _id | Concurrent | Soort | Zo zeg je het | Als de klant zegt | Bewijs | Wanneer we verliezen |
|---|---|---|---|---|---|---|
| cc-01 | Landelijke groothandelsketen | Direct | "Zij hebben het grootste assortiment. Wij kennen uw project en leveren per bouwfase." | "Bij de keten heb ik alles onder één dak." Antwoord: "Klopt. Wat kost het u als een monteur een ochtend wacht?" | Levering op het afgesproken uur, gemeten per project | Bij losse kleine bestellingen zonder project |
| cc-02 | Online webgroothandel | Direct | "Online is de prijs per stuk scherp. Wij rekenen met de kosten van het hele project." | "Online is het goedkoper." Antwoord: "Per stuk soms wel. Zullen we uw laatste project naast elkaar leggen?" | Projectschouw binnen 48 uur | Bij standaardmateriaal in kleine aantallen |
| cc-03 | Fabrikant die direct levert | Indirect | "De fabrikant kent zijn product. Wij combineren merken voor één project." | "Ik bestel rechtstreeks bij de fabrikant." Antwoord: "Voor hoeveel merken doet u dat nu per project?" | Projectapp met alle leveringen | Bij grote orders van één merk |
| cc-04 | Eigen magazijn van de installateur | Intern (de klant doet het zelf) | "Een eigen voorraad geeft zekerheid. Wij geven die zekerheid zonder dat uw kapitaal op de plank ligt." | "We hebben zelf een magazijn." Antwoord: "Hoeveel van die voorraad ligt er langer dan een kwartaal?" | Levering per bouwfase | Bij installateurs met een eigen logistiek medewerker |
| cc-05 | Niets doen (blijft bij vaste leverancier) | Niets doen | "Overstappen kost moeite. Begin met één project, dan ziet u het verschil zelf." | "We zijn tevreden met onze leverancier." Antwoord: "Mooi. Wanneer stond een monteur voor het laatst te wachten?" | Gratis projectschouw als proef | Als er geen nieuw project in de komende zes maanden is |

Velden sterk, zwak en onderscheid vult de seed per regel kort aan (bijvoorbeeld cc-01 sterk "groot assortiment, scherpe inkoop", zwak "geen projectkennis", onderscheid "meedenken vanaf het ontwerp en levering per bouwfase").

### C.7 Fasen en winpunten (L2.1)

- Fasen (bron, namen en soorten; de koppeling van naam aan soort is afgeleid uit de volgorde en moet in SalesDNA worden gecontroleerd): Signaal (pre-prospect- en pre-kwalificatiefase), Kennismaking (prospect- en kwalificatiefase), Behoefte en schouw (kennismakingsfase), Offerte (offerte- en dealfase), Klant en uitbouw (klantrelatiefase).
- Winpunten (bron):

| _id | Fase | Titel | Waarom wij hier winnen | Impact | Tegen wie |
|---|---|---|---|---|---|
| wp-01 | Behoefte en schouw | Gratis projectschouw binnen 48 uur | Concurrenten sturen alleen een prijslijst. | hoog | leeg |
| wp-02 | Offerte | Levering op het uur | Monteurs staan niet te wachten. | hoog | leeg |
| wp-03 | Klant en uitbouw | Projectapp voor de installateur | Minder bellen, minder fouten. | midden | leeg |

- Bron: geen winpunten in Signaal en Kennismaking; "Tegen wie we hier winnen" en "Bijlagen" overal leeg; "Komt terug in": Activiteiten, KPI's per fase en Plan; meekijkronde "5 kijken mee, tot 16 oktober" met een vraag van een verkoper bij "Levering op het uur".
- Omschrijvingen (aangevuld): wp-01 "Binnen 48 uur na de aanvraag komt een specialist gratis op de bouw kijken en maakt een leverplan per bouwfase."; wp-02 "We leveren op het afgesproken uur op de bouwplaats, niet op de dag."; wp-03 "De installateur ziet in de app per project wat besteld, onderweg en geleverd is."
- Klant feedback (bron): wp-02 gemiddeld 3,3 tegen norm 4,0 bij 9 antwoorden, onder de norm. Seed: `weging` wp-02 = 0,5.
- Win/loss (bron): wp-01 met 3 gewonnen deals in de laatste 90 dagen bij de meest voorkomende redenen.
- Variant voor tests (aangevuld, apart te laden): wp-01 met concurrenten cc-01 en cc-02, om de keuzeregel "Tegen wie we hier winnen" te testen.

### C.8 Hercontact ritme (L3.14)

- Bron, lokale stand (bevestigd 5 oktober 2026): verloren "Verloren offerte" met "Over een kwartaal"; slapend "6 maanden niet besteld" met eigen termijn "direct"; beide zonder kanaal, klasse en rollen. Het demoscript heeft zes regels met kanalen en rollen.
- Seed met zes regels (drie uit de helptekst van de bron, twee uit de lokale stand, één aangevuld):

| _id | Lijst | Reden | Termijn | Dagen | Kanaal | Rollen | Aanpak | Herkomst |
|---|---|---|---|---|---|---|---|---|
| hc-01 | verloren | Verloren offerte | Over een kwartaal | 91 | Telefoon | Binnendienst | Bel met een nieuw project als aanleiding, niet met dezelfde offerte. | bron (aanpak, kanaal, rol aangevuld) |
| hc-02 | verloren | Beslissing uitgesteld | Over 2 maanden | 61 | E-mail | Binnendienst | Korte e-mail met een nieuwe aanleiding. | bron |
| hc-03 | verloren | Prijs te hoog | Over een halfjaar | 182 | Bezoek | Accountmanager | Langs met een klantverhaal over de kosten van wachttijd. | bron |
| hc-04 | slapend | 6 maanden niet besteld | direct (eigen) | 0 | Telefoon | Binnendienst | Vraag aan welk project de klant nu werkt. | bron (aanpak aangevuld) |
| hc-05 | slapend | Contactpersoon vertrokken | Over een maand | 30 | Bezoek | Accountmanager | Binnen een maand kennismaken met de opvolger. | bron |
| hc-06 | verloren | Blijft bij bestaande leverancier | Over een jaar | 365 | Telefoon | Binnendienst | Bel bij de start van het nieuwe bouwseizoen met de schouw als proef. | aangevuld |

Eigen opties: termijn "direct" (bron). Accountklassen leeg (bron), wat in Dealtrace "alle klassen" betekent; een testvariant zet hc-03 op "A · Aantal monteurs (Prospects)".

### C.9 Testgevallen die de seed moet dekken

1. Prospect in br-03: verhaal en belofte vallen terug op algemeen met melding; campagne op br-03 geeft de dekkingsmelding.
2. Prospect in br-01 met huidige leverancier cc-02: kernzin, belofte van br-01, winpunt wp-01, bezwaar "Online is het goedkoper." met antwoord.
3. Fase Signaal: geen winpunt; Dealtrace toont het gat en gebruikt wp-01 als belofte.
4. wp-02 onder de norm komt niet als eerste winpunt in een concept.
5. Een uit DealDrive of het CRM teruggekomen verloren deal met reden "Prijs": mapping naar "Prijs te hoog", bezoektaak over 182 dagen op de eerstvolgende regiodag.
6. L0.6 met br-02 hernoemd: koppelingen blijven, namen veranderen overal.
7. Alleen een gewijzigd blok in L0.4: geen verouderd-melding, wel nieuwe versie.
8. `sublaag.verouderd` voor L0.8: label op `/richting`, concepten werken door met de laatste bevestigde versie.
9. Een contactnaam in aantekeningen komt niet in een AI-aanroep of suggestie.
10. Dezelfde seed als eigen inrichting (bron `eigen`) geeft overal hetzelfde resultaat.
