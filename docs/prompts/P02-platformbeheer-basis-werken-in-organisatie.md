# P02: Platformbeheer basis en werken in een organisatie

| Onderdeel | Waarde |
|---|---|
| Sprint | 1 (Fundament en één app) |
| Features | F23 Platformbeheer in de app (basis) |
| Hangt af van | P01 (organisaties, gebruikers, rollen, audit, instellingen), P27 (inloggen met code en TOTP) |
| Bron in het bouwplan | F23, 15.3, 3.1 (rol founder), 6.3 (organisatie-wissel), 13.3 flow 4, ADR-011, open vragen 3 en 4, Bijlage A gat 48 |

## Lees eerst

- Bouwplan-Dealtrace.md: 0.2 (B4), 3.1 en 3.3 (kolom founder), 4.2 (pakket als plafond), 6.3, F22 (Gebruikers), F23 volledig, 13.3 (flow 4 "Werken in een organisatie"), 15.2 (rij "Leverancier kijkt mee"), 15.3, 17 (sprint 1 en 12), ADR-011, 21 (risico "Founder-functies lekken"), 22 (vragen 3 en 4), Bijlage A gat 48 en 49.
- DealDrive (commit 75bee61):
  - `app/pages/admin/index.vue` (klanten), `app/pages/admin/abonnementen.vue` (pakketten, alleen als voorbeeld van de matrix).
  - `server/api/superuser/organisations.get.ts`, `organisations.post.ts`, `organisations/[id]/index.put.ts`, `organisations/[id]/users.get.ts`, `users.post.ts`, `users/[userId].put.ts`, `users/[userId]/archief.post.ts`, `gebruikersaanvragen.get.ts`, `gebruikersaanvragen/afhandelen.post.ts`, `impersonate.post.ts` (alleen om te zien wat vervalt).
  - `server/utils/superuser.ts`, `server/utils/gebruikersAanvraagStore.ts`, `server/utils/orgStarter.ts`, `server/utils/pakketten.ts`, `server/utils/featureFlags.ts`.
  - Vervalt: `app/components/AdminShell.vue`, `server/utils/impersonatieToken.ts`.

## Deel 1: Functioneel (wat en waarom)

### Wat je bouwt

De basis van Platformbeheer als afgeschermde sectie in dezelfde app: de klantenlijst met gezondheid, een nieuwe klant met startset, gebruikers en gebruikersaanvragen, het pakket per klant, en "Werken in een organisatie" met reden, modus, tijdslimiet, gele balk en audit; plus de spiegel voor de beheerder (gebruikers, abonnement lezen, audit, toegang leverancier).

### Waarom

Beslissing B4 en ADR-011: geen aparte HQ, één app, één domein, één build. De founder moet organisaties kunnen aanmaken en erin kunnen werken voor support, zonder dat founderfuncties naar klanten lekken (risico in 21). De scheiding zit daarom volledig op de server: de client verbergt, de server weigert, de database zegt nee.

### Gebruikers en niveaus

| Rol | Niveau | Wat |
|---|---|---|
| founder | n.v.t. | Alle organisaties, nieuwe klant, pakket zetten, stand "Aanvragen via ons" of "Zelf toevoegen binnen de seats", gebruikersaanvragen afhandelen, werken in een organisatie, platformaudit |
| beheerder | Expert (standaard) | Eigen gebruikers toevoegen binnen de seats of aanvragen; eigen pakket in gewone woorden lezen, "Upgrade aanvragen"; eigen auditlog inclusief wat de leverancier deed; "Toegang leverancier: altijd" of "Alleen na toestemming" en verzoeken goedkeuren |
| salesmanager | Gevorderd, Expert | Audit van eigen teams (de Audit-pagina zelf is P21); geen platformfuncties |
| accountmanager | Beginner, Gevorderd, Expert | Niets uit deze prompt; Platformbeheer bestaat voor hem niet (404) |

### Schermen

**Klanten** (`/platform/klanten`). Na inloggen landt de founder hier zolang hij niet in een organisatie werkt.

1. Paginakop: kicker "PLATFORMBEHEER", titel "Klanten", knop "+ Nieuwe klant" (geel). Niet vastgelegd welke kicker en titel; voorstel: deze.
2. Meetlat: "Klanten" (verdeling Gezond, Let op, Risico, Leeg), "Gebruikers" (met login), "Maandomzet" (alleen actieve contracten), "AI-kostprijs deze maand", "Aandacht" (aantal signalen). Maandomzet en AI-kostprijs zijn in sprint 1 nul of leeg; Stripe en het AI-verbruik komen in P24 en P08. Niet vastgelegd hoe ze er in sprint 1 uitzien; voorstel: tegel met "Nog geen gegevens".
3. Tabel: Klant, Pakket, Gebruikers ("8/9 met login"), Laatst actief, AI-kosten, Stand (redenen bij hover), knoppen "Openen" en "Werk in deze organisatie".
4. Lege staat: "Nog geen klanten. Maak de eerste klant aan met Nieuwe klant." Niet vastgelegd; voorstel.

**Gezondheid** (vaste regels, geen score):

| Stand | Regel |
|---|---|
| Leeg | 0 gebruikers |
| Risico | niemand met login, nooit activiteit, meer dan 30 dagen geen activiteit, of 0 accounts |
| Let op | minder dan de helft met login, 15 tot 30 dagen stil, taken zonder afronding in 30 dagen, motor 14 dagen zonder resultaat, of minder dan de afgesproken eerste gesprekken per verkoper per week |
| Gezond | geen van bovenstaande |

Activiteit telt breed: pogingen, berichten, nieuwe prospects, afspraken (gat 48). Tel wat in deze sprint bestaat (inloggen, accounts, activiteiten) en voeg de andere bronnen toe zodra ze er zijn. Vooraf berekend in `org_gezondheid`, elk uur.

**Nieuwe klant** (flyout): organisatienaam, pakket (standaard Starter, of proefperiode met einddatum), contact en adres, eerste beheerder (naam en e-mail). Knop "Klant aanmaken". De server maakt de organisatie met de startset en stuurt de uitnodiging (inloggen met code, P27). Toast: "Van Dijk Installatie is aangemaakt. De uitnodiging is verstuurd." Niet vastgelegd; voorstel voor de toast. Gebruik in tests alleen Testbedrijf Voltvast (Bijlage C).

**Startset.** F23 noemt: klassen, standaardreis, 23 regels, 6 belscripts, 4 hercontactritmes, 7 meetingsoorten, 8 campagnesoorten, redenen voor nee met afkoelperiodes, signaalregels, voorbeelden van eigen velden, help-artikelen. De meeste onderdelen bouwen latere prompts. Niet vastgelegd hoe de startset groeit; voorstel: `orgStarter` als register waar elke prompt zijn onderdeel aan toevoegt, idempotent per onderdeel, met een herstart voor bestaande organisaties ("Startset aanvullen" in de klantflyout).

**Klantflyout** (eigen URL `?klant=<id>`), in deze prompt met:

- Contactgegevens.
- Contract en abonnement: status Proef, Actief, Opgezegd; prijs, start, looptijd, opzegtermijn, "Loopt tot … · opzeggen vóór …". Pakketkeuze Starter, Plus, Compleet.
- Gebruikers en aanvragen: lijst met rol, niveau, login; stand "Aanvragen via ons" of "Zelf toevoegen binnen de seats"; aanvragen goedkeuren of afwijzen.
- Functievlaggen per groep ("live", "voorbereid", "pakket te laag").
- Gebruik en gezondheid: de stand met redenen.
- AI-koppeling, agent-prompts, AI-kosten en "Data en AVG" komen in P24; niet tonen tot dan.

**Pakketwissel**: bevestiging met wat de klant wint of verliest (uit de functiecatalogus van P01) en een auditregel (gat 48). Bevestigingstitel: "Pakket van Van Dijk Installatie wijzigen naar Starter?" met de lijst "Verliest: …" en knop "Pakket wijzigen". Niet vastgelegd; voorstel voor de teksten. Verlagen geldt als gevaarlijke actie en vraagt herbevestiging (TOTP) binnen 15 minuten.

**Werken in een organisatie** (13.3 flow 4)

1. "Werk in deze organisatie" in de tabel, of de organisatiekeuze bovenin de zijbalk (alleen founder, 6.3).
2. Venster "Werken in Van Dijk Installatie" met verplichte reden (minimaal 5 tekens, bijvoorbeeld een ticketnummer) en de keuze "Alleen meekijken" (standaard) of "Ook wijzigen".
3. De server controleert rol en tweestapsverificatie, schrijft een auditregel bij het platform en bij de klant, en zet een ondertekende httpOnly-cookie met organisatie, modus, reden en vervaltijd (hooguit 8 uur).
4. Gele balk bovenaan elke pagina: "Je werkt in Van Dijk Installatie als founder · alleen meekijken · nog 7 uur 42 · Terug naar platform".
5. In "Alleen meekijken" weigert de server elke schrijfactie in klantdata met "Je kijkt mee in deze organisatie; schakel over naar wijzigen om iets aan te passen." Overschakelen vraagt opnieuw een reden en herbevestiging.
6. De beheerder van de klant krijgt bij elke start een melding met naam, reden en modus.
7. Staat de klant op "Alleen na toestemming", dan maakt stap 3 een verzoek; de beheerder keurt het goed of af; pas daarna gaat stap 3 verder. Niet vastgelegd hoe lang een verzoek geldig is; voorstel: 24 uur.

Op de telefoon staat de gele balk onder de compacte kop; Platformbeheer opent in "Meer" met "Beter op een groot scherm" (8.4, 8.12).

**Spiegel voor de beheerder**

- `/instellingen/gebruikers` (P01) met "Gebruiker toevoegen" binnen de seats of "Gebruiker aanvragen", volgens de stand die de founder zette. Een aanvraag geeft de founder een melding (gat 48).
- `/instellingen/abonnement`: pakket in gewone woorden, seats in gebruik, contract, knop "Upgrade aanvragen". Facturen en betalen komen in P24.
- `/instellingen/audit`: eigen auditlog inclusief wat de leverancier deed.
- Instelling "Toegang leverancier": "Altijd" of "Alleen na toestemming".

### Klikpaden

1. Founder klikt "+ Nieuwe klant", vult Testbedrijf Voltvast in met pakket Plus en de eerste beheerder; "Klant aanmaken" maakt organisatie, startset en uitnodiging; de rij staat op Leeg tot de beheerder inlogt.
2. Founder klikt "Werk in deze organisatie", vult reden "Ticket 1042" in, kiest "Alleen meekijken"; de gele balk verschijnt; de beheerder krijgt een melding.
3. Founder probeert een account te bewerken: de server weigert met de meekijktekst; de client toont hem in de meldingsstrook.
4. Founder klikt "Terug naar platform": de cookie vervalt, auditregel "einde", landing op `/platform/klanten`.
5. Beheerder van Voltvast vraagt een tiende gebruiker aan bij negen seats: de aanvraag verschijnt bij de founder met een melding; de founder keurt goed; de gebruiker krijgt de uitnodiging.

### Regels

- Geen enkel API-schema accepteert de rol `founder`; een databasetrigger weigert een update naar founder behalve door de migratierol. Founders zitten in de systeemorganisatie "Dealtrace" zonder klantdata.
- TOTP verplicht; elk platformendpoint controleert het verificatieniveau; gevaarlijke acties (organisatie verwijderen, pakket verlagen, AI-sleutel wijzigen, platformprompt opslaan, wisselen naar "Ook wijzigen") vragen herbevestiging binnen 15 minuten; platformsessies vervallen na 12 uur inactiviteit.
- Klantdata lees je alleen door te werken in de organisatie; dat staat in de audit.
- Open vraag 3: een beheerder mag binnen de seats zelf gebruikers toevoegen als de founder die stand zet (voorstel uit 22 overgenomen).
- Open vraag 4: "Alleen meekijken" is de standaard en een klant mag "Alleen na toestemming" kiezen (voorstel uit 22 overgenomen).
- Proefperiode: automatische afwaardering en een melding 7 dagen vooraf (F23 Abonnementen). Niet vastgelegd of dit in sprint 1 of 12 hoort; voorstel: in deze prompt, zonder Stripe.

### Helpartikelen

- "Abonnement en verbruik" (Inrichten, beheerder): pakket lezen, upgrade aanvragen, seats.
- "Gebruikers, rollen en niveaus" (Inrichten): uitbreiden met aanvragen binnen of boven de seats.
- Nieuw, niet in de lijst van F21; voorstel: "Als Dealtrace meekijkt in je organisatie" (Inrichten): wat de leverancier ziet, de melding, "Alleen na toestemming", de audit.

## Deel 2: Technisch (hoe)

### Datamodel

Migratie `0002_platform`.

| Tabel | Kolommen |
|---|---|
| `organisations` | uitbreiden: `pakket`, `features`, `contract` (jsonb: status, prijs, start, looptijd, opzegtermijn, proefTot), `stripe_customer_id` (leeg tot P24), `status`; `data.toegangLeverancier` (`altijd`, `na_toestemming`), `data.gebruikersStand` (`aanvragen`, `zelf`) |
| `gebruikersaanvragen` | `organisation_id`, `aangevraagd_door`, `data {naam, email, rol, niveau}`, `status` (`open`, `goedgekeurd`, `afgewezen`), `afgehandeld_door`, `afgehandeld_op` |
| `org_gezondheid` | `organisation_id`, `stand`, `redenen[]`, `gebruikers`, `met_login`, `laatst_actief`, `berekend_op` |
| `platform_audit` | append-only: `actor_id`, `actieve_organisatie`, `handeling`, `object`, `voor`, `na`, `reden`, `ip`, `op` |
| `toegangsverzoeken` | voorstel, niet vastgelegd: `organisation_id`, `founder_id`, `reden`, `modus`, `status`, `aangevraagd_op`, `besloten_door`, `besloten_op` |

- Kopie van elke platformhandeling in `audit_events` van de klant.
- `platform_audit`: geen update of delete voor welke rol ook (trigger).
- **Databaserollen**: de app verbindt als `dealtrace_app` zonder `bypassrls`; `dealtrace_platform` (ook zonder `bypassrls`) is de enige rol die de security-definer-functies mag uitvoeren die over organisaties heen kijken (lijst organisaties, gezondheid, verbruik per organisatie, roadmap, motor run-all). Die functies geven geaggregeerde getallen, nooit klantrecords.
- **Trigger** op `users.role`: weigert de waarde `founder` behalve voor de migratierol.
- Sync-allowlist: geen platformtabellen.
- Geheimen: `ORG_WISSEL_SECRET` voor de werk-in-cookie, eigen geheim per doel, rotatie elk half jaar.

### Pure functies

| Functie | Invoer | Uitvoer | Randgevallen en tests |
|---|---|---|---|
| `gezondheid(telling, nu, instellingen)` in `shared/gezondheid.ts` | gebruikers, met login, laatste activiteit, accounts, open taken, motorresultaat | `{stand, redenen[]}` | 0 gebruikers is Leeg ook met accounts; precies 15 en 30 dagen; Risico gaat boven Let op |
| `pakketVerschil(van, naar, catalogus)` | twee pakketten | `{wint[], verliest[]}` | gelijk pakket geeft twee lege lijsten |
| `werkInGeldig(cookie, nu)` | ondertekende cookie | `{organisatie, modus, resterend}` of null | verlopen na 8 uur, ongeldige handtekening, andere founder |
| `magSchrijvenInOrganisatie(sessie)` | sessie met werk-in | boolean | meekijken nee, wijzigen ja, gewone gebruiker ja |

### Endpoints

Het bouwplan noemt de routes van de schermen maar geen API-routes; voorstel:

| Methode en route | Recht | Invoer | Uitvoer | Fouten |
|---|---|---|---|---|
| `GET /api/platform/klanten` | founder, `aal2` | | klanten met gezondheid (via `dealtrace_platform`) | 404 voor iedereen zonder founderrol |
| `POST /api/platform/klanten` | founder | naam, pakket, proefTot?, contact, eerste beheerder | organisatie | 400 bij ontbrekende velden, 409 bij bestaand e-mailadres |
| `GET /api/platform/klanten/:id` | founder | | klantflyout (geaggregeerd) | 404 |
| `PUT /api/platform/klanten/:id/pakket` | founder, herbevestiging bij verlagen | `{pakket, bevestigd: true}` | nieuw pakket | 428 zonder herbevestiging |
| `PUT /api/platform/klanten/:id/gebruikersstand` | founder | `{stand}` | | |
| `GET /api/platform/aanvragen`, `POST /api/platform/aanvragen/:id/afhandelen` | founder | `{besluit}` | | |
| `POST /api/platform/werk-in` | founder, `aal2` | `{organisatieId, reden, modus}` | cookie of `{verzoekId}` bij "Alleen na toestemming" | 400 reden korter dan 5 tekens |
| `POST /api/platform/werk-in/modus` | founder | `{modus, reden}` | nieuwe cookie | 428 zonder herbevestiging bij "Ook wijzigen" |
| `DELETE /api/platform/werk-in` | founder | | 204 | |
| `POST /api/instellingen/gebruikersaanvragen` | beheerder | `{naam, email, rol, niveau}` | aanvraag | |
| `GET /api/instellingen/abonnement` | beheerder | | pakket in gewone woorden, seats | |
| `GET/POST /api/instellingen/toegangsverzoeken/:id` | beheerder | `{besluit}` | | |
| `GET /api/instellingen/audit` | beheerder | filters | auditregels | |

- **Twee lagen**: middleware weigert `/api/platform/**` voor iedereen zonder founderrol met 404, en elk endpoint roept zelf `requireFounder(event)` aan. Bouwcheck `check:platform` faalt als een platformendpoint die aanroep mist of een gewoon scherm een platformroute aanroept.
- **Organisatie uit de sessie**: gewone endpoints nemen de organisatie nooit uit de payload; de werk-in-cookie bepaalt de actieve organisatie voor de founder; in meekijkmodus weigert de server elke schrijfactie (ook via `POST /api/sync/mutations`) met 403 en de meekijktekst.
- **Bundel**: de platformschermen zitten in een eigen, lui geladen deel van de bundel met een routebewaker (gemak, geen beveiliging).

### Functiecatalogus

| Sleutel | Niveau | Pakket | Recht | Helpartikel |
|---|---|---|---|---|
| `platform.klanten` | n.v.t. | n.v.t. | founder | geen; platformdocumentatie in `docs/HOE-HET-WERKT.md` |
| `platform.werkIn` | n.v.t. | n.v.t. | founder | idem |
| `instellingen.abonnement` | Expert | Starter | beheerder | "Abonnement en verbruik" |
| `instellingen.audit` | Expert | Starter | beheerder | "Als Dealtrace meekijkt in je organisatie" |
| `instellingen.gebruikersAanvragen` | Expert | Starter | beheerder | "Gebruikers, rollen en niveaus" |

Niet vastgelegd of founderfuncties in de catalogus staan; voorstel: wel, met niveau en pakket n.v.t., zodat `check:functies` ze kent; `check:functies` slaat het helpartikel over voor recht `founder`.

### AI-stappen en integraties

Geen AI. De mail met de uitnodiging gaat via Supabase Auth (P27). Stripe, Moneybird, GitHub en de AI-koppeling zijn P24.

### Hergebruik uit DealDrive

| Bestand | Wat je aanpast |
|---|---|
| `admin/index.vue` | wordt `/platform/klanten` binnen de gewone schil; geen `AdminShell.vue` |
| `server/api/superuser/organisations*`, `users*`, `gebruikersaanvragen*` | verhuizen naar `/api/platform/**` met `requireFounder` en `aal2`-controle |
| `server/utils/superuser.ts` | wordt `requireFounder`; plus middleware met 404 |
| `server/utils/gebruikersAanvraagStore.ts` | plus melding aan de founder bij een nieuwe aanvraag (gat 48) |
| `server/utils/orgStarter.ts` | register per onderdeel, idempotent |
| `server/utils/pakketten.ts`, `featureFlags.ts` | pakketwissel met `pakketVerschil`, bevestiging en audit (gat 48) |
| `impersonate.post.ts`, `impersonatieToken.ts`, `AdminShell.vue`, `DEALDRIVE_APP=hq`, het tweede domein | vervallen; vervangen door de werk-in-cookie |

### Buiten scope

Abonnementenmatrix, facturen, Stripe, Moneybird, AI-verbruik in euro's, AI-koppeling, agent-prompts, roadmap, motor, help-artikelen beheren en "Data en AVG" in de klantflyout (P24); de pagina Audit voor de salesmanager (P21).

## Acceptatiecriteria

1. Een accountmanager, salesmanager of beheerder krijgt op elke `/api/platform/**`-route 404; de route `/platform/klanten` toont voor hen geen platformscherm.
2. `check:platform` faalt als een platformendpoint `requireFounder` mist, getest met een opzettelijk fout endpoint in de testset.
3. Een API-aanroep die een gebruiker de rol `founder` geeft, wordt geweigerd door het schema en, als die controle ontbreekt, door de databasetrigger.
4. De founder zonder `aal2` krijgt op platformendpoints 401; "Ook wijzigen" en pakket verlagen zonder herbevestiging binnen 15 minuten geven 428.
5. Werken in een organisatie zonder reden of met minder dan 5 tekens faalt; met reden verschijnt de gele balk met organisatie, modus en resterende tijd; na 8 uur vervalt de cookie.
6. In "Alleen meekijken" faalt elke schrijfactie in klantdata met de meekijktekst, ook via de sync-queue (cross-tenanttest in de wegwerp-Postgres).
7. Elke start, modewissel en stop staat in `platform_audit` en in `audit_events` van de klant; de beheerder krijgt een melding met naam, reden en modus.
8. Met "Alleen na toestemming" ontstaat eerst een verzoek; zonder goedkeuring van de beheerder geen toegang.
9. `dealtrace_platform`-functies geven alleen geaggregeerde getallen; een test bevestigt dat ze geen kolommen uit `accounts` of `contacts` teruggeven.
10. Een beheerder kan pakket, bundel, functievlaggen en platformprompts niet via `PUT /api/settings/:key` schrijven (403).
11. Bijlage A, gat 48: een pakketwissel vraagt bevestiging met wat de klant wint en verliest en wordt geaudit; gezondheid telt activiteit breed (pogingen, berichten, nieuwe prospects, afspraken, voor zover die tabellen bestaan) en niet alleen taakwijzigingen; een gebruikersaanvraag geeft de founder een melding.
12. Bijlage A, gat 16: gezondheidsregels en pakketverschil staan één keer in `shared/`.
13. Een nieuwe klant krijgt bij aanmaken alle startsetonderdelen die op dat moment geregistreerd zijn; "Startset aanvullen" is idempotent.
14. Getest als beheerder op niveau Expert, en met een accountmanager als Beginner, Gevorderd en Expert (die nergens platformfuncties zien); de spiegel voor de beheerder klopt.
15. Op 390 px: de gele balk is leesbaar zonder horizontale scroll, "Terug naar platform" is een tikdoel van minimaal 44 px; Platformbeheer staat in "Meer" met "Beter op een groot scherm".

## Definition of Done

Hoofdstuk 19 geldt volledig. Specifiek voor deze prompt:

- De sprint-1-toestand "een founder maakt een organisatie en werkt erin met reden en gele balk" is in de browser en op een echte telefoon bevestigd.
- `check:platform` draait in de bouwketen; de cross-tenanttests op platformscheiding (beheerder kan geen platformfunctie uitvoeren, founder in meekijkmodus schrijft niets) zijn groen.
- `docs/HOE-HET-WERKT.md` beschrijft de drie lagen (client verbergt, server weigert, database zegt nee), de werk-in-cookie en de databaserollen.
- Testorganisaties zijn fictief (Testbedrijf Voltvast); "Van Dijk Installatie" komt alleen als schermtekst uit het bouwplan voor, niet als seed.
