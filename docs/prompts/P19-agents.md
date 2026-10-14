# P19: Agents voor interne en externe bronnen

| Onderdeel | Waarde |
|---|---|
| Sprint | 10 (Agents en bronnen) |
| Features | F14 AI-agents voor interne en externe bronnen; de agents Waarnemer, Verrijker, Profielbouwer en Notulist uit 11.3; signaalregels per doelgroep en concurrentsignalen |
| Hangt af van | P01 (functiecatalogus, rechten), P03 (accountkaart, buying committee), P06 (motor, starterset SR14, SR15, SR16, SR19, SR23), P07 (inzichten en "Maak taak"), P08 (mandaten, Bewaker, bundel), P11 (KvK-adapter, `webBron`), P13 (meetingsoorten en verslag), P15 (Datacollectief-adapter), P28 (leesmodel, concurrenten), P32 (`shared/signalen.ts`, signaalkaart op de telefoon) |
| Bron in het bouwplan | F14; hoofdstuk 11 (11.1 tot en met 11.4); F06 (inzichten); F04 (buying committee); F09 en 8.5.3 (Notulist); F15 (triggerpatronen en starterset); F25 (concurrentnamen); 8.5.1, 8.5.5, 8.10; 15.1 en 15.2; Bijlage A regel 19 |

## Lees eerst

- Bouwplan-Dealtrace.md: F14 volledig, hoofdstuk 11 (zes lagen, vangrails, agents en mandaten, mandaat per niveau, bundel), F06 (blok Inzichten en de regels), F04 (buying committee en "Stel voor met AI"), F09 (meetingsoorten, Notulist herkent concurrenten), F15 (patronen Trigger-heractivatie en Lead verlopen, starterset), F25 (Waarnemer zoekt concurrentnamen), 8.5.1 punt 3, 8.5.5, 8.10 (melding "Hete aanleiding"), 8.13 (signaaldetectoren), 15.1 (veroudering, geen verzonnen gegevens), 15.2 (AI-verwerking), 2.1 (geen bewijs, geen inzicht), Bijlage A regel 19.
- DealDrive op commit 75bee61 (`git -C /home/user/Dealdrive show 75bee61:<pad>`):
  - `server/utils/aiInsight.ts` (beoordeling met materiaal, drempel voor taakvoorstel)
  - `server/utils/webBron.ts` (websearch met URL-controle tegen de echte zoekresultaten, houdbaarheid, maximaal 3 zoekopdrachten)
  - `server/utils/agentExecutor.ts` (uitvoering, Pitstop-accent)
  - `server/utils/ruleEngine.ts` (AI-pass van de motor)
  - `server/utils/verslagAnalyse.ts` en `server/utils/dexVerslagAnalyse.ts` (verslag naar actiepunten en signalen)
  - `shared/dexSignalen.ts` (detectoren en governor) en `server/utils/aiVerbruik.ts`, `shared/aiBundel.ts`
  - `app/pages/inzichten.vue`, `app/components/InzichtFlyout.vue`

## Deel 1: Functioneel (wat en waarom)

### Wat je bouwt

Vier agents (Waarnemer, Verrijker, Profielbouwer, Notulist) die interne en externe bronnen lezen en wat ze vinden als inzicht met bewijs presenteren, plus de agentpagina, de Waarnemer-instellingen per doelgroep en de agentblokken op Vandaag, Inzichten en de accountkaart.

### Waarom

Een accountmanager kan geen honderden websites, vacaturesites en registers bijhouden. De agents doen dat werk en leveren aanleidingen met bron, datum en citaat, zodat de mens beslist wat er gebeurt (principes "Geen bewijs, geen inzicht" en "De mens beslist", 2.1). DealDrive parste de webbeoordeling als vrije tekst zonder schema (Bijlage A regel 19); in Dealtrace dwingt tool-use met een schema elk antwoord af.

### Gebruikers en niveaus

| Rol | Niveau | Wat |
|---|---|---|
| accountmanager | Beginner | Op Vandaag "Aanleiding van de dag" en de Prio-kolom; op Inzichten lezen en "Maak taak"; op de accountkaart het blok "Wat de agents zagen" |
| accountmanager | Gevorderd | Plus "Door agents gedaan sinds gisteren" op Vandaag; filters op agent en bron; afwijzen met reden; "Inzicht met bron" handmatig toevoegen; "Laat opnieuw onderzoeken" (kost 1 dossier); agentpagina alleen lezen; signaalkaart met "Gedaan", "Later", "Weg" op de telefoon |
| accountmanager | Expert | Plus filter per agent op Vandaag; "Waarom niet?" op Inzichten; bronnen per account aanvullen (eigen URL of trefwoord); eigen onderwerpen en bronnen voor de Waarnemer; eigen mandaat binnen het organisatiemaximum |
| salesmanager | Gevorderd of Expert | Als accountmanager op zijn niveau, plus teamweergave van inzichten en acceptatie per regel (F06) |
| beheerder | Expert | Agentpagina beheren: mandaat per agent binnen de platformmaxima, dagplafonds, aan of uit, "Agents pauzeren", Waarnemer-profielen per doelgroep |
| founder | n.v.t. | Platformmaxima per agent zetten (3.3); in een organisatie alleen na instappen |

### Schermen

**1. Inzichten** (`/acties?tab=inzichten`, vanaf Gevorderd ook `/inzichten`). Je breidt de feed uit P07 uit.

- Kop: "Wat speelt er bij je prospects?", schakelaar "Alle", "Prospects", "Klanten". Statkaarten "Nieuw" (24 uur), "Hot" (relevantie 75 of hoger), "Deze week", "Totaal open".
- Feedkaart: accountbalk, badge "EXTERN" (geel) of "INTERN" (donker), specifieke bron ("KvK-mutatie", "Web: vacatures", "Verslag 1 okt"), ouderdom, relevantie, titel, beschrijving, AI-context, de agent met mandaatpil (A tot en met D), knoppen "+ Maak taak" en "Markeer als gelezen".
- Filters (Gevorderd): Gelezen (standaard Ongelezen), Bronnen (Intern, Extern, per specifieke bron), Agent, Periode, Reis en fase. Filters in de URL.
- Knop "Inzicht met bron" (Gevorderd): flyout met Account (verplicht), Titel (verplicht), Bron (verplicht), URL, Citaat (verplicht). Bron van het inzicht is "Handmatig door de gebruiker".
- Tabblad of schakelaar "Waarom niet?" (Expert): inzichten die de Bewaker of de bewijsplicht tegenhield, met reden. Niet vastgelegd in het bouwplan; voorstel: een schakelaar "Toon tegengehouden" in de werkbalk, rijen grijs met de reden als meta ("Citaat staat niet in het materiaal", "URL kwam niet uit de zoekresultaten", "Te oud: vacature ouder dan 120 dagen").
- **Inzichtflyout**: "Wat is er gebeurd?", "Waarom is dit relevant?" (gemarkeerd als beoordeling), "Bewijs" (citaat met bron, datum, link), "Voorgesteld winpunt", "Voorgestelde taak", "Klant in context"; knoppen "Maak taak" (geel), "Vraag AI", "Bewerken", "Markeer als gelezen", "Wijs af" met reden ("Niet relevant", "Al bekend", "Verkeerd account", "Te oud"). Expert ziet ook de regelcode en de mandaatletter (4.5).
- Lege staat: "Geen nieuwe inzichten. De agents hebben sinds gisteren niets gevonden bij je accounts." Bij een filter: "Toon alles". Niet vastgelegd in het bouwplan; voorstel voor de tekst van de lege staat zoals hier.

**2. Vandaag** (`/`, uitbreiding van P07 en P32)

- "Aanleiding van de dag" (Beginner): één kaart, ongelezen, relevantie 85 of hoger, jonger dan 48 uur wint, met bron, citaat, "Maak taak" en "Open kaart".
- "Door agents gedaan sinds gisteren" (Gevorderd): "12 dossiers ververst · 3 nieuwe aanleidingen · 2 accounts geparkeerd · 5 mails verstuurd binnen campagne X". Klik opent de activiteitenlog gefilterd op agents.
- Filter per agent op de takenkolom (Expert).

**3. Accountkaart** (`/accounts/:id`)

- Blok "Wat de agents zagen": de laatste inzichten op dit account met agent, bron en datum. Lege staat: "De agents hebben nog niets gevonden bij dit account." (voorstel; tekst niet vastgelegd).
- "Laat opnieuw onderzoeken" (Gevorderd), meta "Kost 1 dossier"; uitgeschakeld met tooltip "Je maandbundel voor dossiers is op." als de bundel op is.
- "Bronnen om te volgen" (Expert): lijst met eigen URL's en trefwoorden, "+ Bron". Niet vastgelegd in het bouwplan hoe dit blok heet; voorstel "Bronnen om te volgen".

**4. Agentpagina** (`/instellingen/agents`, beheerder; Gevorderd en Expert alleen lezen)

Van boven naar beneden:

1. Paginakop met kruimelpad "Instellingen", kicker "DATA EN AI", titel "Agents en mandaten".
2. Kaart "Mandaten in vier niveaus": A autonoom, B binnen een goedgekeurd kader, C per stuk goedkeuren, D altijd mens, met de harde grenzen uit 11.3 ("D blijft D; nooit zonder consent of in een afkoelperiode; nooit buiten het ritme; nooit een template, regel of verhaal wijzigen; alles herleidbaar").
3. Tabel van agents: naam, mandaat (mandaatpil), dagplafond, vandaag gedaan, aan of uit.
4. Knop "Agents pauzeren" (gevaarstijl, met bevestiging): zet alle B-handelingen stil; lopende ritmes gaan als taak naar de mens. Bevestiging als vraag: "Alle agents pauzeren?", tekst met gevolg, knop "Pauzeren".
5. Kaart "Vandaag tegengehouden door de Bewaker" met reden per regel ("Geen consent voor WhatsApp", "Afkoelperiode mail tot 3 december", "Dagplafond bereikt").

**5. Waarnemer instellen** (Expert en beheerder). Niet vastgelegd in het bouwplan welke route; voorstel: `/instellingen/waarnemer`, in Instellingen onder "Data en AI" de kaart "Waarnemer en signaalregels" (F22).

- Keuze doelgroep bovenaan.
- Per signaalsoort een rij: vacature (functietrefwoorden), nieuws (trefwoorden), KvK-mutatie, website-wijziging, aanbesteding (CPV-codes); per rij aan of uit, minimale relevantie en het winpunt dat erbij past (keuze uit het leesmodel, F25).
- Cadans (minimaal wekelijks per account).
- "Exporteren" en "Importeren" voor signaalregels uit Excel.
- Voorbeeld uit de productbrief als hulptekst: "50 jaar bestaan" wordt de felicitatie met een kaart en het winpunt "De meekijkdag".

**6. Telefoonweergave op 390 px (hoofdstuk 8)**

- Vandaag (8.5.1 punt 3, Gevorderd en Expert): één signaalkaart met bron, bewijs in één regel en de knoppen "Gedaan", "Later", "Weg"; de kaart komt uit `shared/signalen.ts` (P32) met de inzichten die deze prompt maakt als invoer. Een Beginner ziet geen signaal.
- Accountkaart compact (8.5.5): "Waarom nu" toont het sterkste inzicht met bron; tabblad "Inzichten" onder de vouw.
- Inzichtflyout opent als schuifvenster van onderen met de knoppenrij plakkend onderaan; "Maak taak" rechts als primaire knop.
- De agentpagina en de Waarnemer-instellingen staan onder Meer met "Beter op een groot scherm" en openen wel (8.4).

### Klikpaden

1. **Vacature wordt inzicht.** De wekelijkse Waarnemer-run vindt op een werkenbij-pagina een vacature servicemonteur. Het inzicht verschijnt in de feed met badge "EXTERN", bron "Web: vacatures", citaat, URL en datum. Op Vandaag wint hij "Aanleiding van de dag" als hij jonger dan 48 uur is en relevantie 85 of hoger heeft.
2. **Maak taak.** Klik "+ Maak taak". De taak erft titel, prioriteit (Hoog bij relevantie 80 of meer, anders Middel), actiesoort, broninzicht en regel, met het label "Uit inzicht". Het inzicht krijgt status omgezet. Toast in verleden tijd.
3. **Afwijzen.** Klik "Wijs af", kies "Te oud". Het inzicht krijgt status afgewezen; de reden telt in de rapportage per regel.
4. **Opnieuw onderzoeken.** Op de accountkaart "Laat opnieuw onderzoeken". De Verrijker draait voor dit account, het dossier krijgt de datum van vandaag, 1 dossier gaat van de bundel af; nieuwe inzichten verschijnen in "Wat de agents zagen".
5. **Agents pauzeren.** Beheerder klikt "Agents pauzeren", bevestigt. De Verzender stopt direct; de volgende mails in lopende campagnes komen als taak bij de eigenaar.
6. **Handmatig inzicht.** "Inzicht met bron", vul account, titel, bron, citaat; "Opslaan". Het inzicht staat in de feed met bron "Handmatig".
7. **Verslag analyseren.** Na "Rond af" of "Bewaar bezoek" loopt de Notulist: actiepunten worden concepttaken in Concepten, koopsignalen en concurrentnamen worden inzichten op het account.

### Regels

- Geen bewijs, geen inzicht: een citaat telt alleen als het letterlijk in het materiaal staat; een URL alleen als hij in de echte zoekresultaten stond.
- Ouderdom per bron (zacht en hard): vacatures 30 en 120 dagen, nieuws 90 en 365, website 30 en 90. Boven hard wordt het inzicht geschrapt; boven zacht krijgt het geen taakvoorstel.
- Een inzicht met zekerheid onder 60 krijgt geen taakvoorstel.
- Een trigger haalt een account uit "wachtend" of "nee" terug (regel `trigger-heractivatie`) alleen als de afkoelperiode voor het voorgestelde kanaal voorbij is.
- De Waarnemer volgt per run maximaal 25 accounts per regel; cadans minimaal wekelijks per account; AI-regels minimaal wekelijks.
- Kosten per bron vallen in de bundel (11.4); blokkade vóór de aanroep, melding bij 80 procent.
- Bijwerken van een open inzicht door de motor zet het niet terug op ongelezen.
- De Verrijker vult nooit een nummer of adres in dat niet op een bron staat; een patroon ("voornaam@domein") is een voorstel met de pil "aanname" (15.1).
- Een contact met status vertrokken die beslisser was, geeft één inzicht "Beslisser vertrokken bij <account>" (F04).
- Privémail en privémobiel worden gemaskeerd vóór de aanroep; namen van contactpersonen en klanten in vrije tekst worden gefilterd bij aanroepen met het verkoopverhaal (11.2).
- De Waarnemer zoekt ook naar concurrentnamen uit het leesmodel in nieuws en vacatures; de Notulist herkent ze in verslagen en zet ze als signaal op het account (F09, F25).

### Helpartikelen

- "Inzichten beoordelen" (collectie Hoe werkt Dealtrace, leerpad Gevorderd): wat een inzicht is, bron en citaat lezen, "Maak taak", afwijzen met reden en waarom dat de regels bijstuurt.
- "Agents en mandaten" (leerpad Expert en categorie Inrichten): de vier mandaatniveaus, mandaat per niveau, de Bewaker, "Agents pauzeren", de Waarnemer instellen per doelgroep.

## Deel 2: Technisch (hoe)

### Datamodel

- `signals.data { agent, bron {soort, naam, url?, datum}, evidence[], winpuntVoorstel?, zekerheid, afwijsReden? }`; kolommen `account_id`, `contact_id`, `rule_id`, `agent`, `type`, `relevance_score`, `confidence`, `status` (10.2).
- `agent_runs` met `agent`, `mandaatNiveau`, `bronnen[]`, `kosten`; bewaartermijn 13 maanden (15.2).
- Nieuwe tabel `waarnemer_profielen: id, organisation_id, doelgroep_id, data { signaalsoorten [{soort, trefwoorden[], minRelevantie, winpuntId?}], cadans }`. Migratie met RLS-policy `org_isolation`.
- Niet vastgelegd in het bouwplan; voorstel: `accounts.data.volgBronnen [{soort: 'url'|'trefwoord', waarde, door, op}]` voor bronnen per account; `org_settings` sleutel `agents { [agent]: {mandaat, dagplafond, aan} }` en `agentsGepauzeerd {op, door}`; `users.data.agentMandaat` voor het eigen mandaat van een Expert, nooit hoger dan het organisatiemaximum.
- Tegengehouden inzichten: niet vastgelegd; voorstel `signals.status = 'tegengehouden'` met `data.tegenhoudReden`, buiten de gewone feed en tellers.
- Rechtenmatrix (3.3): agentmandaten accountmanager en salesmanager lezen, beheerder schrijven binnen platformmaxima, founder platformmaxima; taken en inzichten accountmanager lezen alles, schrijven alles, verwijderen eigen.
- Sync-allowlist: `signals` staat er al in (P07); `waarnemer_profielen` en de agentinstellingen gaan via eigen endpoints, niet via de sync.

### Pure functies

Niet vastgelegd in het bouwplan welke namen; voorstel (in `shared/agents.ts` en `shared/bewijs.ts`):

| Functie | Invoer | Uitvoer | Randgevallen en tests |
|---|---|---|---|
| `ouderdomStatus(bronSoort, datum, nu)` | bronsoort (`vacature`, `nieuws` of `website`), datum, nu | `vers`, `zacht` of `hard` | grens op precies 30, 90, 120, 365 dagen; datum in de toekomst; ontbrekende datum is `hard` |
| `valideerBewijs(oordeel, materiaal, zoekUrls)` | AI-oordeel, tekstmateriaal, URL's uit de zoekresultaten | `{geldig, redenen[]}` | citaat met andere witruimte of hoofdletters; URL met en zonder slash aan het eind; verzonnen URL geeft `geldig false` |
| `magTaakVoorstel(inzicht, nu)` | inzicht | boolean | zekerheid 59 en 60; zacht verlopen |
| `selecteerAccounts(regel, accounts, profiel, nu)` | regel, accounts, Waarnemer-profiel | maximaal 25 accounts | cadans nog niet verstreken; minder dan 25 kandidaten |
| `vindConcurrenten(tekst, concurrenten)` | vrije tekst, `vv_concurrenten` | lijst concurrent-id's met fragment | naam met B.V.; deel van een woord telt niet; lege lijst |
| `heractivatieToegestaan(account, kanaal, nu)` | account, kanaal | boolean | gebruikt `magBenaderen` uit `shared/nbStatus.ts`; afkoeling eindigt vandaag |

`kiesAanleidingVanDeDag(signals, gebruiker, nu)` bestaat uit P07; `magHandelen` uit P08. Unit-tests per functie met grenzen, lege invoer en idempotentie.

### Endpoints

| Methode en route | Recht | Invoer | Uitvoer | Fouten |
|---|---|---|---|---|
| `GET /api/agents` | iedereen vanaf Gevorderd (lezen) | geen | stand per agent, tellers vandaag, tegengehouden met reden | 403 met `{functie, reden}` onder Gevorderd |
| `PUT /api/agents/:agent/mandaat` | beheerder; Expert voor eigen mandaat | `{mandaat, dagplafond?, aan?}` | bijgewerkte stand | 422 boven organisatiemaximum; 422 als D omlaag zou gaan |
| `POST /api/agents/pauzeer` | beheerder | `{pauze: boolean}` | stand | audit verplicht |
| `GET /api/waarnemer/profielen`, `PUT /api/waarnemer/profielen` | lezen Gevorderd; schrijven Expert en beheerder | profiel per doelgroep | profiel | 422 bij cadans korter dan wekelijks |
| `POST /api/accounts/:id/onderzoek` | Gevorderd | geen | run-id | 429 met "Je maandbundel voor dossiers is op." |
| `POST /api/signals/handmatig` | Gevorderd | `{accountId, titel, bron, url?, citaat}` | inzicht | 422 zonder bron of citaat |
| `GET /api/signals/tegengehouden` | Expert | `?periode=` | lijst met reden | niet vastgelegd; voorstel |

Bestaande endpoints `POST /api/signals/:id/omzetten` en `POST /api/signals/:id/afwijzen` (P07) blijven de enige weg voor omzetten en afwijzen. Mutatiesoort `signaal.besluit` (8.14) voor "Gedaan", "Later", "Weg" op de telefoon.

### AI-stappen

| Agent | Mandaat | Materiaal | Schema | Bundelsoort |
|---|---|---|---|---|
| Waarnemer (intern) | A | activiteitenlog, uitkomsten, afspraken, deals, verslagen, CRM-velden | `{titel, beschrijving, relevantie, zekerheid, evidence[{citaat, bron, datum, url?}], winpuntVoorstel?, taakVoorstel?}` | Inzicht-beoordeling (intern): 0 / 8.000 / 8.000 |
| Waarnemer (extern) | A | websearch op vacatures, nieuws, website; KvK-mutaties; aanbestedingen (optioneel) | idem, URL's verplicht uit de zoekresultaten | Webonderzoek (extern): 0 / 0 / 3.000; KvK-bevragingen 0 / 500 / 2.000 |
| Verrijker | A | KvK, Datacollectief, website, CRM | `{velden[{veld, waarde, bron, datum, aanname?}]}`; meldt `dossier-compleet` als alle criteria een oordeel hebben | Dossier: 0 / 0 / 240; Datacollectief-records volgens contract |
| Profielbouwer | A | dossier, website, verslagen, ingevoerde LinkedIn-informatie | `bouwCommittee`: `[{naam?, functie, rol, bron, zekerheid}]`, zekerheid onder 60 wordt "vermoedelijk" | Brief en committee: 0 / 500 / 500 |
| Notulist | A voor het verslag; uitkomst kiest de mens | aantekeningen, transcript, agenda van de meetingsoort | `{perAgendapunt[], openVragen[], voorgesteldeUitkomst, koopsignalen[], bezwaren[], concurrenten[]}` | Notulist: 0 / 300 / 300 |

Vangrails (11.2) voor elk: tool-use met JSON-schema en `additionalProperties false`, bij afwijking één keer opnieuw, daarna fout zonder opslag; bewijsplicht met `valideerBewijs`; elke handeling via `magHandelen` van de Bewaker; privégegevens gemaskeerd; namenfilter bij verkoopverhaal; blokkade vóór de aanroep als de bundel op is. Elke agent is één module `server/utils/agents/<naam>.ts` met `draai(context)`, aangeroepen door de motor of de weekjob (`netlify/functions/week`). Mock per agent met vaste fixtures uit de startset Voltvast (Bijlage C), bijvoorbeeld een vacature bij een fictieve installateur in br-01 en een nieuwsbericht dat cc-02 "Online webgroothandel" noemt. Golden master per prompt.

### Integraties

Hergebruik de adapters uit P11 en P15: `server/utils/bronnen/kvk.ts` (mutaties), `server/utils/webBron.ts` (vacatures, nieuws, website), `server/utils/bronnen/datacollectief.ts`, `server/utils/bronnen/crm/*` (alleen lezen, uit P20), `server/utils/bronnen/tenderned.ts` (optioneel; open data; na sprint 12 volgens hoofdstuk 12, dus hier alleen de interface met mock). Elke aanroep in `koppeling_runs` en in het verbruik.

### Functiecatalogus

Niet vastgelegd in het bouwplan welke sleutels; voorstel (pakket afgeleid uit de bundel in 11.4, die op Starter 0 is):

| Sleutel | Niveau | Pakket | Recht | Helpartikel |
|---|---|---|---|---|
| `inzichten.lezen` | Beginner | Starter | taken en inzichten lezen | Inzichten beoordelen |
| `inzichten.beoordelen` | Gevorderd | Starter | schrijven | Inzichten beoordelen |
| `inzichten.handmatig` | Gevorderd | Starter | schrijven | Inzichten beoordelen |
| `inzichten.waaromNiet` | Expert | Plus | lezen | Agents en mandaten |
| `vandaag.doorAgents` | Gevorderd | Plus | lezen | Inzichten beoordelen |
| `account.opnieuwOnderzoeken` | Gevorderd | Compleet (dossier) | schrijven | Agents en mandaten |
| `account.bronnenVolgen` | Expert | Compleet (webonderzoek) | schrijven | Agents en mandaten |
| `agents.lezen` | Gevorderd | Plus | agentmandaten lezen | Agents en mandaten |
| `agents.instellen` | Expert | Plus | agentmandaten schrijven (beheerder) of eigen mandaat | Agents en mandaten |
| `waarnemer.profielen` | Expert | Plus | schrijven | Agents en mandaten |

### Hergebruik uit DealDrive

- `aiInsight.ts`: neem `verzamelMateriaal` en de drempel voor een taakvoorstel over; vervang vrije tekst door tool-use met schema (regel 19).
- `webBron.ts`: neem de URL-controle tegen `web_search_tool_result` en de houdbaarheid over; maak de grenzen 30 en 120, 90 en 365, 30 en 90 per bronsoort.
- `ruleEngine.ts` (AI-pass) en `agentExecutor.ts`: roep de agents aan als module met mandaat in plaats van als losse AI-pass.
- `verslagAnalyse.ts`: basis voor de Notulist; voeg concurrentherkenning en het schema toe.
- `shared/dexSignalen.ts`: levert in P32 al de detectoren; P19 voedt ze met echte inzichten.

### Buiten scope

Zoeker (P11), Schrijver en Pitstop (P18), Coach (P21), Verzender, Berichtgever en LinkedIn-assistent (P16, P26), TenderNed als echte koppeling (na sprint 12), opnemen van gesprekken (open vraag 13: alleen aantekeningen, inspreken en geplakte transcripten), automatisering in LinkedIn (ADR-006).

## Acceptatiecriteria

1. Bijlage A regel 19: de webbeoordeling gebruikt tool-use met een schema; een antwoord buiten het schema wordt één keer opnieuw gevraagd en daarna zonder opslag afgewezen.
2. Een vacature op een werkenbij-pagina (mock) wordt een inzicht met citaat, URL en datum.
3. Een verzonnen URL (niet in de zoekresultaten) wordt geweigerd; zonder geldig bewijs ontstaat geen inzicht.
4. Een vacature van 31 dagen oud heeft geen taakvoorstel; een vacature van 121 dagen oud wordt geschrapt; idem voor nieuws (90 en 365) en website (30 en 90).
5. Een inzicht met zekerheid 59 heeft geen taakvoorstel; met 60 wel.
6. Een trigger op een account met status nee binnen de afkoelperiode haalt het account niet terug; na de afkoelperiode wel, via `trigger-heractivatie`.
7. De Waarnemer verwerkt per run hoogstens 25 accounts per regel.
8. "Agents pauzeren" stopt de Verzender direct en zet de volgende mails als taak bij de eigenaar; de Bewaker logt elke blokkade met reden en die staat op de agentpagina.
9. Een mandaat boven het organisatiemaximum geeft 422; een Expert kan zijn eigen mandaat niet boven het organisatiemaximum zetten.
10. De Notulist herkent "Online webgroothandel" (cc-02, Voltvast) in een verslag en zet een signaal op het account; een contactnaam uit de aantekeningen staat niet in de AI-aanroep (Bijlage C.9 punt 9).
11. De Verrijker meldt `dossier-compleet` zodra alle zes criteria een oordeel hebben; hij vult geen telefoonnummer in zonder bron.
12. Een bijgewerkt open inzicht blijft gelezen als het gelezen was.
13. Is de bundel Webonderzoek op, dan start geen externe run en ziet de beheerder de melding; bij 80 procent volgt een melding.
14. Niveau Beginner: ziet "Aanleiding van de dag", het blok "Wat de agents zagen" en "Maak taak"; geen filters op agent, geen "Inzicht met bron", geen signaalkaart op de telefoon; de agentpagina staat in "Nog te ontgrendelen" met uitleg; een directe aanroep van `GET /api/agents` geeft 403 met `reden: 'niveau'`.
15. Niveau Gevorderd: ziet "Door agents gedaan sinds gisteren", filters op agent en bron, kan afwijzen met reden, handmatig toevoegen, "Laat opnieuw onderzoeken" en leest de agentpagina zonder bewerkknoppen.
16. Niveau Expert: ziet "Waarom niet?", kan bronnen per account aanvullen en een Waarnemer-profiel per doelgroep opslaan; ziet regelcode en mandaatletter in de inzichtflyout.
17. Telefoon (375, 390, 412 px): de signaalkaart op Vandaag handelt een inzicht af met één tik ("Gedaan", "Later" of "Weg", 8.7); de inzichtflyout opent als schuifvenster met tikdoelen van minimaal 44 px; geen horizontale scroll; "Gedaan" offline staat in de wachtrij en komt na herstel precies één keer aan.
18. Een nieuw inzicht met hoge urgentie op een eigen account geeft de pushmelding "Hete aanleiding" (8.10) binnen stille uren en dagplafond.
19. Cross-tenant: een Waarnemer-profiel van organisatie A is onzichtbaar voor B; tests in de wegwerp-Postgres.
20. Alle agents en adapters draaien in tests met de mock, zonder netwerk en zonder kosten.

## Definition of Done

Hoofdstuk 19 geldt volledig. Specifiek voor deze prompt:

- Elke agent heeft een mock, een golden master en een databasevrije test die de Bewaker passeert of blokkeert.
- `check:functies` groen met de nieuwe sleutels; elke sleutel heeft het artikel "Inzichten beoordelen" of "Agents en mandaten".
- Eén echte AI-run per agent met kosten in het sprintverslag.
- `docs/HOE-HET-WERKT.md` beschrijft de vier agents, hun bronnen, ouderdom en drempels.
- Regel 19 van Bijlage A afgevinkt in het sprintverslag.
