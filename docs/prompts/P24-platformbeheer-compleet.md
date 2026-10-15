# P24: Platformbeheer compleet

| Onderdeel | Waarde |
|---|---|
| Sprint | 12 (Platform en afronding) |
| Features | F23 Platformbeheer in de app (geen aparte HQ), compleet: abonnementen met AI-credits per pakket, features per niveau (`/platform/features`), facturen, AI-verbruik en credits (extra credits, prijs per handeling), AI-koppeling, agent-prompts, help-artikelen (beheer), roadmap, motor, platformaudit, gezondheid; de spiegels voor de beheerder |
| Hangt af van | P01 (rollen, functiecatalogus, pakket), P02 (Platformbeheer basis: klanten met startset, gebruikers en aanvragen, werken in een organisatie, pakket, platformaudit, `requireFounder`, `check:platform`), P06 (motor en runs), P08 (Bewaker en dagplafonds van de agents), P09 Helpcenter basis en features per niveau (tabel `functies_per_niveau`, `beschikbaar()`, help-artikelen in de database), P18 (promptketen en slots), P27 (inloggen met code, TOTP voor de founder), P33 AI-assistent en credits (`shared/credits.ts`, `creditsVoor`, `ai_credits`, meter en meldingen) |
| Bron in het bouwplan | F23 volledig; ADR-011; 3.3 (rijen Abonnement, facturen, verbruik en Platformbeheer); 4.1, 4.2 en 4.5 (pakket, features per niveau, `functies_per_niveau`); 4.3 (startindeling); 11.4 (credits per handeling, pot per pakket, `llm_prijzen`); F26 (credits); ADR-012; ADR-022; hoofdstuk 12 (Stripe, Moneybird, GitHub); 13.1; 15.2 (leverancier kijkt mee); 15.3; F21 (beheer van artikelen); F22 (`VERBORGEN_KEYS`); 13.5 (lokaal bouwen); open vragen 9, 10, 16, 24 en 25; Bijlage A regels 14, 48, 49, 50 |

## Lees eerst

- Bouwplan-Dealtrace.md: F23 volledig (functioneel en technisch), ADR-011, ADR-012, ADR-022, 0.2 (B4, B18, B19, B20), 3.1 en 3.3, 4.1 tot en met 4.5, 11.2 (plafond in credits), 11.4, F26, hoofdstuk 12 (rijen Stripe en Moneybird, GitHub), 13.1 (Auth, Checks), 13.3 punt 4, 15.2 (rij Leverancier kijkt mee, bewaartermijn audit 7 jaar), 15.3, F21 (Beheer van artikelen), F22 (Regels voor instellingen), 13.5, hoofdstuk 21 (risico's "Founder-functies lekken", "De indeling van functies per niveau klopt niet" en "AI-credits zijn te snel op of te duur"), open vragen 9, 10, 16, 24, 25, Bijlage A regels 14, 48, 49, 50.
- DealDrive op commit 75bee61:
  - `app/pages/admin/index.vue` (klanten), `admin/abonnementen.vue`, `admin/facturen.vue`, `admin/llm.vue`, `admin/prompts.vue`, `admin/roadmap.vue`
  - `server/api/superuser/*` (organisaties, ai-kosten, bundel als basis voor de credits, llm-connector, agent-prompts met test, feature-requests met GitHub, gebruikersaanvragen)
  - `server/utils/promptBibliotheek.ts`, `server/utils/promptStandaarden.ts`, `shared/promptSlots.ts`, `server/utils/llm-provider.ts`, `server/utils/llmInstellingen.ts`, `server/utils/pakketten.ts`, `server/utils/featureRequestStore.ts`, `server/utils/github.ts`, `server/utils/aiVerbruik.ts`, `shared/aiBundel.ts`, `server/utils/orgStarter.ts`
  - `.github/workflows/claude-ontwikkel.yml` (bouwketen die een pull request opent)
  - Vervalt: `AdminShell.vue`, `server/utils/impersonatieToken.ts`, `server/api/superuser/impersonate.post.ts`, `DEALDRIVE_APP=hq`

## Deel 1: Functioneel (wat en waarom)

### Wat je bouwt

De rest van Platformbeheer in de app: abonnementen met AI-credits per pakket, de pagina Features per niveau (`/platform/features`), facturen via Stripe met Moneybird, AI-verbruik en credits (extra credits per klant, de prijs per handeling aanpassen), AI-koppeling, agent-prompts, help-artikelen van het platform, roadmap met GitHub, motor en platformaudit, plus de spiegels voor de beheerder van een klant en de roadmap voor iedereen.

### Waarom

Beslissing B4: geen aparte HQ. De founder beheert organisaties, geld, AI en roadmap in dezelfde app en hetzelfde domein; wat hij ziet is wat de klant krijgt (ADR-011). De klant krijgt een eigen, kleinere spiegel. DealDrive had gaten: een pakketwissel zonder bevestiging en audit, gezondheid die alleen taakwijzigingen telde, geen melding bij een gebruikersaanvraag (regel 48), een sleutelvingerafdruk met de eerste vier tekens en een agendageheim gedeeld met AI-sleutels (regel 49), een roadmap-bouwrun die twee keer kon starten (regel 50) en een AI-plafond dat standaard uit stond (regel 14). Daarnaast legt de founder hier per sprint vast welke functie bij welk niveau aanstaat (B18) en stuurt hij de AI-credits die voor alle AI gelden (B20).

### Gebruikers en niveaus

Niveaus spelen hier geen rol: Platformbeheer staat voor elk niveau op "Geen" behalve voor de rol founder (4.3). De rol bepaalt alles.

| Rol | Niveau | Wat |
|---|---|---|
| founder | n.v.t. | Alle organisaties; pakket en abonnement per klant zetten; features per niveau aan en uit zetten, voor alle organisaties of als afwijking voor één organisatie; credits per pakket, extra credits per klant en de prijs per handeling; alle facturen en marge; verbruik en plafond; AI-koppeling platform en per klant; platformprompts en afwijkingen per klant; platformartikelen; roadmapbord over alle klanten; motorruns; platformaudit |
| beheerder | Expert (standaard) | Eigen gebruikers en aanvragen; eigen pakket lezen en "Upgrade aanvragen"; eigen facturen, betalen, factuurgegevens; eigen verbruik in credits per soort en per gebruiker, plafond per gebruiker, "Extra credits aanvragen"; één leesregel AI-koppeling; eigen promptlaag (vanaf Plus); eigen artikelen; roadmap indienen, stemmen, samenvoegen; eigen audit inclusief wat de leverancier deed |
| salesmanager | Gevorderd of Expert | Verbruik van de eigen organisatie lezen; roadmap indienen en stemmen; audit van eigen teams (P21) |
| accountmanager | elk niveau | Roadmap indienen en stemmen; eigen creditstand zien (meter uit P33) |

### Schermen

Platformschermen (founder), elk in een eigen, lui geladen deel van de app-bundel: `/platform/klanten`, `/platform/abonnementen`, `/platform/features`, `/platform/facturen`, `/platform/verbruik`, `/platform/ai`, `/platform/prompts`, `/platform/help`, `/platform/roadmap`, `/platform/motor`, `/platform/audit`. Spiegels voor de beheerder: `/instellingen/gebruikers`, `/instellingen/abonnement`, `/instellingen/verbruik`, `/instellingen/prompts`, `/instellingen/audit`. Voor iedereen: `/roadmap`. Na inloggen landt de founder op `/platform/klanten` zolang hij niet in een organisatie werkt.

**1. Klanten** (`/platform/klanten`, aanvulling op P02)

- Meetlat: "Klanten" (verdeling Gezond, Let op, Risico, Leeg), "Gebruikers" (met login), "Maandomzet" (alleen actieve contracten), "AI-kostprijs deze maand", "Aandacht" (aantal signalen).
- Tabel: Klant, Pakket, Gebruikers ("8/9 met login"), Laatst actief, AI-kosten, Stand (redenen bij hover), knoppen "Openen" en "Werk in deze organisatie".
- **Gezondheid** (vaste regels, geen score): 0 gebruikers is Leeg; niemand met login, nooit activiteit, meer dan 30 dagen geen activiteit of 0 accounts is Risico; minder dan de helft met login, 15 tot 30 dagen stil, taken zonder afronding in 30 dagen, motor 14 dagen zonder resultaat, of minder dan de afgesproken eerste gesprekken per verkoper per week is Let op. Activiteit telt breed: pogingen, berichten, nieuwe prospects, afspraken.
- **Klantflyout** (eigen URL `?klant=`): contactgegevens; contract en abonnement (status Proef, Actief, Opgezegd; prijs, start, looptijd, opzegtermijn, "Loopt tot … · opzeggen vóór …"); gebruikers en aanvragen (stand "Aanvragen via ons" of "Zelf toevoegen binnen de seats"); AI-koppeling; agent-prompts; functievlaggen per groep ("live", "voorbereid", "pakket te laag"); AI-kosten; gebruik en gezondheid; **Data en AVG** (gebruikte bronnen, verrijkte contacten, bewaartermijnen, verwerkersovereenkomst, verwijderverzoeken).

**2. Abonnementen** (`/platform/abonnementen`): pakketten Starter, Plus, Compleet met per pakket de functies en databronnen (AI-zoeker, KvK, Datacollectief, webonderzoek), seats en **AI-credits per gebruiker per maand** (voorlopig Starter 200, Plus 600, Compleet 1.500, samen in één pot per organisatie; open vraag 24); welke AI-soorten per pakket aanstaan (kolom "Aan in pakket" in 11.4); matrix "Welke inhoud?" met "Vergelijk met klant"; prijzen per pakket en per seat als gegeven met geldig-vanaf; proefperiode met automatische afwaardering en melding 7 dagen vooraf. Een pakketwissel vraagt bevestiging met wat de klant wint of verliest (bevestiging als vraag: "Pakket van Van Dijk Installatie naar Starter zetten?", tekst met de functies die wegvallen, knop "Pakket wijzigen").

**3. Features per niveau** (`/platform/features`, B18): een raster met alle functies uit de catalogus als rijen (gegroepeerd per feature F01 tot en met F26, met naam, pakket en recht als meta) en Beginner, Gevorderd en Expert als kolommen; per cel een schakelaar aan of uit. Bovenaan de keuze "Alle organisaties" of één organisatie; bij één organisatie krijgt elke afwijkende cel een gele markering en de knop "Terug naar de standaard". Elke wijziging werkt direct, zonder release, met een auditregel en de knop "Draai terug" in de toast. Kop met kicker "FEATURES PER NIVEAU" en de stand als zin ("Beginner heeft 18 van 64 functies aan."). Er zijn geen schakelaars per gebruiker; een functie buiten het pakket blijft uit, hoe de cel ook staat (4.2). Hiermee legt de founder per sprint de indeling uit 4.3 vast; het fundament (tabel, `beschikbaar()`, de lezing in server en client) komt uit P09 Helpcenter basis en features per niveau.

**4. Facturen** (`/platform/facturen`): facturen uit Stripe Billing met status; marge per klant (gefactureerd tegen AI- en datakosten); extra credits als factuurregel; achterstallige klanten met de pil "AI gepauzeerd". Synchronisatie met Moneybird als job met status.

**5. Verbruik en credits** (`/platform/verbruik`): elke AI-aanroep in het logboek met de credits die hij kostte; per klant de pot AI-credits en het verbruik per soort en per gebruiker (vragen aan de AI-assistent, zoekrondes, dossiers, webonderzoek, inzichten, concepten, belscript-invullingen, verslagen, spraak, coach); los daarvan de externe databronnen (KvK-bevragingen, Datacollectief-records), die geen credits kosten; kosten in euro's per model en soort. Per klant: **extra credits** toekennen voor deze maand (aantal, reden, als factuurregel of kosteloos) en het plafond zetten. Tabblad **Prijs per handeling**: de tabel uit 11.4 (soort, model, credits per handeling, aan in pakket) met de standaard uit `shared/credits.ts` en per soort een aangepaste prijs met geldig-vanaf; een wijziging werkt zonder release, met bevestiging en audit.

**6. AI-koppeling** (`/platform/ai`): oplosketen organisatie, platform, omgeving, mock; provider Claude als standaard (webonderzoek alleen via Claude vanwege de broncontrole), andere providers per functie mogelijk; sleutel versleuteld en schrijf-alleen, getoond als vingerafdruk van acht tekens; "Test verbinding"; verwerkingsregio en "geen training" per provider; modelkeuze per soort en de tabel `llm_prijzen` met peildatum (11.4).

**7. Agent-prompts** (`/platform/prompts`): per slot (belscript-invulling, mailconcept, LinkedIn-bericht, briefing per soort, beoordelingsvraag, verbetervoorstel, coachvoorstel, helpvraag) de keten organisatie, platform, code; een vast kader dat geen prompt kan opheffen (zichtbaar, niet bewerkbaar); versies met auteur, maximaal 10 per slot; "Proefdraai" op voorbeelddata uit de startset Voltvast.

**8. Help-artikelen** (`/platform/help`): platformartikelen beheren met versies (editor uit P25). Deze prompt levert de route, de rechten en de versies; de editor en de inhoud komen uit P25.

**9. Roadmap** (`/platform/roadmap` en `/roadmap`): iedereen dient wensen in en stemt binnen de eigen organisatie; statussen "Ingediend", "In ontwikkeling", "Niet gedaan", "Opgeleverd"; de founder ziet het bord over alle klanten met aantal organisaties per wens, prioriteit, link naar de klantflyout, en "Maak issue" (GitHub) met de bouwketen die altijd een pull request opent, nooit een merge. Na "Maak issue" staat de wens op "gestart" en is de knop niet nogmaals te gebruiken.

**10. Motor** (`/platform/motor`): laatste runs per organisatie, fouten per stap, AI-tellingen, kosten per run, "Draai opnieuw voor deze klant".

**11. Platformaudit** (`/platform/audit`): append-only lijst met actor, actieve organisatie, handeling, object, voor en na, reden, ip, tijd; filters op founder, organisatie, handeling, periode.

**12. Spiegels voor de beheerder**

- `/instellingen/abonnement`: pakket in gewone woorden, seats in gebruik, AI-credits per maand, contract, "Upgrade aanvragen"; facturen met pdf, betaalknop, factuuradres en btw-nummer.
- `/instellingen/verbruik`: de pot AI-credits van deze maand met meter, verbruik in credits per soort en per gebruiker, melding bij 80 procent; plafond per gebruiker en dagplafond per AI-soort voor de agents (11.4); "Extra credits aanvragen"; nooit euro's of modellen.
- `/instellingen/prompts` (vanaf Plus): de eigen laag per slot, met de platformtekst als alleen-lezen voorbeeld en "Proefdraai".
- `/instellingen/audit`: eigen auditlog inclusief wat de leverancier deed (werken in de organisatie, met reden en modus).
- In Instellingen, AI-koppeling: één leesregel "Claude, verwerking in de EU".

**13. Telefoonweergave op 390 px.** Platformbeheer en de spiegels staan in "Meer" met "Beter op een groot scherm" en openen wel (8.4, 8.12). Op 390 px: tabellen worden lijsten met één regel per klant en een schuifvenster met de klantflyout; geen horizontale scroll; de gele balk "Je werkt in …" blijft zichtbaar onder de compacte kop; gevaarlijke acties vragen ook op de telefoon herbevestiging. `/roadmap` is volledig bruikbaar op de telefoon (indienen en stemmen).

### Klikpaden

1. **Pakket wijzigen.** Founder opent de klantflyout, kiest bij Abonnement "Plus" naar "Starter"; de bevestiging toont wat wegvalt; herbevestiging van de tweede factor als die ouder is dan 15 minuten; na "Pakket wijzigen" auditregel bij platform en klant, toast in verleden tijd, de beheerder krijgt een melding.
2. **Credits op 80 procent.** De beheerder en de gebruikers krijgen de melding "AI-credits op 80 procent" (F24); onder 10 procent stoppen de automatische AI-handelingen; bij 0 blokkeert de server elke AI-aanroep vóór de aanroep met "De AI-credits van deze maand zijn op. Je beheerder kan extra credits aanvragen." en werkt al het werk zonder AI door.
3. **Extra credits.** De beheerder klikt "Extra credits aanvragen"; de founder krijgt een melding, kent in de klantflyout of op `/platform/verbruik` 1.000 extra credits toe met reden; de pot groeit direct, de factuurregel volgt; audit bij platform en klant.
4. **Features per niveau.** Founder opent `/platform/features`, zet bij Beginner de functie "Leadgenerator: zoeken in KvK" aan; de wijziging werkt direct voor alle organisaties; gebruikers op dat niveau krijgen de toast "Leadgenerator staat nu voor je aan." met het helpartikel (4.4); auditregel; "Draai terug" zet de cel terug.
5. **Prijs per handeling.** Founder zet op het tabblad Prijs per handeling "Dossier" van 10 naar 8 credits met geldig-vanaf vandaag; bevestiging als vraag; vanaf dat moment rekent `creditsVoor` met 8.
6. **Achterstallige factuur.** Stripe meldt een mislukte incasso via de webhook; de klant krijgt de pil "AI gepauzeerd", AI-aanroepen worden geweigerd, de app blijft werken; na betaling vervalt de pauze.
7. **Prompt wijzigen.** Founder opent slot "mailconcept", past de platformlaag aan, klikt "Proefdraai" (resultaat op Voltvast-data), dan "Opslaan"; herbevestiging; nieuwe versie met auteur; de elfde versie verdringt de oudste.
8. **Wens naar issue.** Founder klikt "Maak issue" bij een wens; status wordt "gestart", GitHub-issue met link; een tweede klik is niet mogelijk; de bouwketen opent een pull request.
9. **Gebruikersaanvraag.** Een beheerder in de stand "Aanvragen via ons" vraagt een gebruiker aan; de founder krijgt een melding; hij handelt hem af in de klantflyout.
10. **AI-sleutel wijzigen.** Founder plakt een nieuwe sleutel, "Test verbinding", "Opslaan" met herbevestiging; de pagina toont alleen de vingerafdruk van acht tekens.

### Filters en sorteren

- Klanten: zoeken op naam; filter Stand (Gezond, Let op, Risico, Leeg), Pakket, Status contract; sorteren op Laatst actief, AI-kosten, naam. In de URL.
- Features per niveau: zoeken op functie, groep (feature), pakket, "Alleen afwijkingen", organisatie.
- Verbruik: klant, soort, model, gebruiker, maand.
- Roadmap: status, aantal organisaties, prioriteit; sorteren op stemmen.
- Audit: founder, organisatie, handeling, periode.

### Regels

- De client verbergt, de server weigert, de database zegt nee (F23).
- Pakketwissel: bevestiging en audit (regel 48).
- Gezondheid telt brede activiteit (pogingen, berichten, nieuwe prospects, afspraken), vooraf berekend in `org_gezondheid` elk uur (regel 48).
- Melding aan de founder bij elke gebruikersaanvraag (regel 48).
- Sleutels alleen als vingerafdruk van acht tekens; een eigen geheim per doel (`LLM_KEY_SECRET`, `ORG_WISSEL_SECRET`, `MOTOR_SECRET`, `STRIPE_WEBHOOK_SECRET`, `PLATFORM_HOOK_SECRET`, `GITHUB_TOKEN`, `MONEYBIRD_TOKEN`); rotatie elk half jaar (regel 49).
- Roadmap-bouwrun: de status "gestart" voorkomt een tweede run (regel 50).
- AI-plafond in credits op alle AI-soorten, standaard aan: reservering en blokkade vóór de aanroep, melding bij 80 procent, automatische AI stopt bij 10 procent, bij 0 stopt alle AI en werkt de rest door (regel 14, 11.2, 11.4).
- De prijs per handeling staat op één plek: `creditsVoor(soort, context)` in `shared/credits.ts` (P33) met de standaard uit 11.4; een aangepaste prijs van de founder gaat via dezelfde functie, nooit via een tweede tabel in een feature.
- Features per niveau: de stand komt uit `functies_per_niveau` (null = alle organisaties, anders een afwijking voor één organisatie); de afwijking wint; elke wijziging werkt direct en heeft een auditregel; alleen de founder schrijft. Er zijn geen schakelaars per gebruiker, geen verzoeken om functies en geen niveauvoorstellen (B18, B19); het pakket blijft het plafond.
- Agent-prompts: maximaal 10 versies per slot; het vaste kader is door geen prompt op te heffen.
- Facturen: achterstallig pauzeert automatisch AI-werk, niet de app; Stripe-webhook idempotent op event-id.
- Proefperiode: automatische afwaardering op de einddatum met melding 7 dagen vooraf.
- Gevaarlijke acties (organisatie verwijderen, pakket verlagen, AI-sleutel wijzigen, platformprompt opslaan, wisselen naar "Ook wijzigen") vragen herbevestiging binnen 15 minuten; platformsessies vervallen na 12 uur inactiviteit.
- Sleutels die de leverancier beheert (pakket, credits per pakket en prijs per handeling, functievlaggen, features per niveau, platformprompts) zijn nooit via Instellingen te schrijven (`VERBORGEN_KEYS`, F22).

### Helpartikel

"Abonnement, verbruik en AI-credits" (categorie Inrichten, beheerder): pakket in gewone woorden, seats, de pot AI-credits en wat een handeling kost, wat er bij 80 procent, 10 procent en 0 gebeurt, extra credits aanvragen, facturen betalen, upgrade aanvragen, wat de leverancier in je organisatie mag en hoe je dat in de audit ziet. Voor de founder is een intern artikel niet vastgelegd; voorstel: een platformartikel "Platformbeheer" alleen zichtbaar voor de rol founder, met een sectie "Features per niveau vaststellen".

## Deel 2: Technisch (hoe)

### Datamodel

- `organisations` met `pakket`, `features`, `contract`, `stripe_customer_id`, `status`.
- `functies_per_niveau: functie, niveau, aan boolean, organisation_id (null = alle organisaties), gewijzigd_door, gewijzigd_op` (4.5; de tabel komt uit P09 Helpcenter basis en features per niveau, deze prompt levert het scherm en de schrijfendpoints).
- `ai_credits` (pot, reserveringen en boekingen per organisatie en maand; uit P33). Uit F26: `ai_credits: organisation_id, maand, toegekend, extra, verbruikt`, `ai_credit_plafonds: organisation_id, gebruiker_id, plafond` en credits per pakket in `pakketprijzen` (F23). Niet vastgelegd waar de reden van extra credits en de aangepaste prijs per handeling staan; voorstel: `extra_credits_log (id, organisation_id, maand, aantal, reden, factureren boolean, door, op)` naast `ai_credits.extra`, en `credit_prijzen (soort, credits, geldig_vanaf, door)`.
- `pakketprijzen` (prijs per pakket en per seat met geldig-vanaf), `facturen`, `gebruikersaanvragen`, `llm_connections`, `prompt_versies`, `feature_requests`, `org_gezondheid`, `platform_audit` (F23); `llm_prijzen` met peildatum (11.4).
- Kolommen die het bouwplan niet noemt; voorstel: `facturen (id, organisation_id, stripe_invoice_id uniek, nummer, bedrag_cent, btw_cent, status, vervalt_op, betaald_op, pdf_url, moneybird_id?, data)`; `feature_requests.status` met de waarden "ingediend", "gestart", "in_ontwikkeling", "niet_gedaan", "opgeleverd" en `github_issue_url`; `prompt_versies (slot, laag ('platform'|'organisatie'), organisation_id?, versie, tekst, auteur_id, op)`; `stripe_events (event_id primaire sleutel, soort, ontvangen_op)` voor idempotentie.
- `platform_audit` is append-only (geen update of delete voor de app-rol); kopie in `audit_events` van de klant; bewaartermijn 7 jaar.
- Database: app-rol `dealtrace_app` zonder `bypassrls`; rol `dealtrace_platform` (ook zonder `bypassrls`) mag alleen de security-definer-functies uitvoeren die over organisaties heen kijken (lijst organisaties, gezondheid, verbruik per organisatie, roadmap, motor run-all); die geven geaggregeerde getallen, nooit klantrecords.
- Een databasetrigger weigert een update naar rol founder behalve door de migratierol; founders zitten in de systeemorganisatie "Dealtrace" zonder klantdata.
- Rechtenmatrix (3.3): abonnement, facturen, verbruik: accountmanager geen, salesmanager verbruik team lezen, beheerder lezen en abonnement wijzigen, founder alles; Platformbeheer alleen founder.
- Sync-allowlist: geen platformtabellen in de sync.

### Pure functies

| Functie | Invoer | Uitvoer | Randgevallen en tests |
|---|---|---|---|
| `gezondheid(org, tellingen, nu)` | organisatie, tellingen | `{stand, redenen[]}` met stand `gezond`, `let_op`, `risico` of `leeg` | precies 15 en 30 dagen; 0 accounts; helft met login; motor 14 dagen |
| `pakketVerschil(van, naar, catalogus)` | twee pakketten | functies die erbij komen en wegvallen | gelijk pakket; onbekend pakket |
| `prijsOp(pakketprijzen, pakket, datum)` | prijzen, datum | geldende prijs | twee prijzen met dezelfde geldig-vanaf; datum vóór de eerste |
| `creditStand(verbruik, pot, extra)` | verbruik, pot, extra credits | percentage en status (`normaal`, `melding`, `agents_stop`, `op`) | 79, 80, 90 en 100 procent; pot 0; extra credits halverwege de maand |
| `featureRaster(catalogus, standen, organisatieId)` | catalogus, rijen uit `functies_per_niveau` | per functie en niveau aan of uit, met afwijking | afwijking wint van de standaard; functie zonder rij valt terug op de startindeling; onbekende functie in de tabel wordt genegeerd en gemeld |
| `vingerafdruk(sleutel)` | sleutel | acht tekens | korte sleutel; nooit het begin van de sleutel (regel 49) |
| `marge(facturen, kosten)` | per klant | bedrag in centen | geen facturen; via `formatteerCenten` |
| `promptKeten(slot, org, platform, code)` | lagen | uiteindelijke prompt met vast kader | lege laag valt terug; kader altijd aan het eind |

Namen van de functies zijn niet vastgelegd in het bouwplan; voorstel. De regels van `gezondheid` zijn wel vastgelegd (F23).

### Endpoints

Alle routes onder `/api/platform/**`: middleware weigert ze met 404 voor iedereen zonder founderrol en elk endpoint roept zelf `requireFounder(event)` aan; TOTP-niveau gecontroleerd. Niet vastgelegd welke routes precies; voorstel:

| Methode en route | Recht | Invoer | Uitvoer | Fouten |
|---|---|---|---|---|
| `GET /api/platform/klanten`, `GET /api/platform/klanten/:id` | founder | filters | lijst met gezondheid, flyout | 404 zonder founderrol |
| `PUT /api/platform/klanten/:id/pakket` | founder, herbevestiging | `{pakket, reden}` | organisatie | 428 zonder recente herbevestiging |
| `GET/PUT /api/platform/pakketprijzen` | founder | prijs, geldig-vanaf | prijzen | 422 bij geldig-vanaf in het verleden |
| `GET /api/platform/facturen`, `GET /api/platform/verbruik` | founder | filters | lijsten | |
| `PUT /api/platform/klanten/:id/credits` | founder | `{extra, reden, factureren}` of `{plafond}` | stand van de pot | 422 zonder reden |
| `GET /api/platform/features?organisatie=` | founder | organisatie (leeg = alle) | raster met afwijkingen | |
| `PUT /api/platform/features` | founder | `{functie, niveau, aan, organisatieId?}` | cel | 422 bij een onbekende functie; audit verplicht |
| `DELETE /api/platform/features/afwijking` | founder | `{functie, niveau, organisatieId}` | cel terug naar de standaard | |
| `GET/PUT /api/platform/credits/prijzen` | founder, herbevestiging | `{soort, credits, geldigVanaf}` | prijstabel | 422 bij onbekende soort of credits onder 0 |
| `PUT /api/platform/pakketten/:pakket/credits` | founder | `{creditsPerGebruiker}` | pakket | |
| `GET/PUT /api/platform/ai`, `POST /api/platform/ai/test` | founder, herbevestiging bij sleutel | provider, sleutel | stand met vingerafdruk | sleutel nooit in de respons |
| `GET/PUT /api/platform/prompts/:slot`, `POST /api/platform/prompts/:slot/proefdraai` | founder | tekst | versie | 422 als het vaste kader ontbreekt |
| `GET/PUT /api/platform/roadmap/:id`, `POST /api/platform/roadmap/:id/issue` | founder | status | wens | 409 als de status al "gestart" is |
| `GET /api/platform/motor`, `POST /api/platform/motor/:orgId/run` | founder | geen | runs | |
| `GET /api/platform/audit` | founder | filters | regels | |
| `POST /api/stripe/webhook` | Stripe met handtekening | event | 2xx | 400 bij ongeldige handtekening; dubbel event-id doet niets |
| `GET /api/instellingen/abonnement`, `POST /api/instellingen/abonnement/upgrade` | beheerder | `{pakket, toelichting}` | aanvraag | |
| `GET /api/instellingen/verbruik` | beheerder, salesmanager (lezen) | maand | credits per soort en per gebruiker | nooit euro's |
| `POST /api/abonnement/extra-credits` (F26) | beheerder | `{aantal, toelichting}` | aanvraag | melding aan de founder |
| `PUT /api/instellingen/credits/plafond` (F26) | beheerder | `{gebruikerId, plafond}` | plafond | 422 bij een plafond onder 0 |
| `GET/PUT /api/instellingen/prompts/:slot` | beheerder vanaf Plus | tekst | versie | 403 met `reden: 'pakket'` op Starter |
| `GET /api/instellingen/audit` | beheerder | filters | regels | |
| `GET/POST /api/roadmap`, `POST /api/roadmap/:id/stem` | iedereen | wens | wens | stemmen alleen binnen de eigen organisatie |

### AI-stappen

Geen nieuwe agent. "Proefdraai" draait het gekozen slot met de mock-provider of de echte provider op voorbeelddata uit de startset Voltvast, telt in de credits van de systeemorganisatie en wordt niet opgeslagen als concept.

### Integraties

- **Stripe Billing**: abonnementen, seats, facturen, incasso (SEPA, iDEAL, kaart); webhook idempotent op event-id; adapter met mock en vaste events. Open vraag 9: Stripe als bron, Moneybird als boekhouding.
- **Moneybird**: betaalde facturen als synchronisatie (job); adapter met mock.
- **GitHub**: `github.ts`, token van het platform; de workflow opent altijd een pull request, nooit een merge.
- **Anthropic API**: via de providerlaag met mock; `LLM_KEY_SECRET` voor versleuteling.
- Alle adapters loggen in `koppeling_runs` van de systeemorganisatie (voorstel) en draaien in tests zonder netwerk. Lokaal (13.5) draaien Stripe, Moneybird, GitHub en de AI-provider op hun mock (`AI_PROVIDER=mock`); geheimen staan lokaal alleen in `.env.local`.

### Functiecatalogus

Niet vastgelegd in het bouwplan welke sleutels; voorstel (niveau n.v.t. betekent: alleen rol):

| Sleutel | Niveau | Pakket | Recht | Helpartikel |
|---|---|---|---|---|
| `platform.*` (klanten, abonnementen, features, facturen, verbruik en credits, ai, prompts, help, roadmap, motor, audit) | n.v.t. | n.v.t. | founder | Platformbeheer (voorstel) |
| `instellingen.abonnement` | Expert | Starter | beheerder | Abonnement, verbruik en AI-credits |
| `instellingen.verbruik` | Gevorderd | Starter | beheerder; salesmanager lezen | Abonnement, verbruik en AI-credits |
| `instellingen.prompts` | Expert | Plus | beheerder | Abonnement, verbruik en AI-credits |
| `instellingen.audit` | Expert | Starter | beheerder | Abonnement, verbruik en AI-credits |
| `roadmap` | Beginner | Starter | iedereen | Je eerste dag (voorstel: een sectie "Een wens indienen") |

`check:platform` faalt als een platformendpoint `requireFounder` mist of een gewoon scherm een platformroute aanroept.

### Hergebruik uit DealDrive

- `admin/index.vue`, `abonnementen.vue`, `facturen.vue`, `llm.vue`, `prompts.vue`, `roadmap.vue`: schermen overnemen in de gewone schil (geen `AdminShell.vue`), routes naar `/platform/*`.
- `server/api/superuser/*`: logica naar `/api/platform/**` met twee lagen beveiliging; `impersonate.post.ts` en `impersonatieToken.ts` vervallen (werken in een organisatie uit P02).
- `promptBibliotheek.ts`, `promptStandaarden.ts`, `shared/promptSlots.ts`: keten en slots; maximaal 10 versies.
- `llm-provider.ts`, `llmInstellingen.ts`: oplosketen; vingerafdruk naar acht tekens; eigen geheim per doel.
- `pakketten.ts`, `aiVerbruik.ts`, `shared/aiBundel.ts`: basis voor credits per pakket en het plafond, standaard aan op alle AI-soorten; de rekenregels zelf staan in `shared/credits.ts` (P33).
- `featureRequestStore.ts`, `github.ts`: status "gestart" toevoegen.

### Buiten scope

Een supportrol zonder geld en prompts (open vraag 16, na de eerste drie klanten); een aparte HQ-build of tweede domein; klantrecords lezen buiten "Werken in een organisatie"; de editor en inhoud van help-artikelen (P25); prijsbedragen zelf (open vraag 10: vastleggen als gegeven met geldig-vanaf).

## Acceptatiecriteria

1. Bijlage A regel 14: het plafond in AI-credits staat standaard aan op alle AI-soorten; bij 80 procent een melding aan beheerder en gebruikers, onder 10 procent stoppen de agents, bij 0 blokkeert de server vóór de aanroep en werkt de app zonder AI door.
2. Bijlage A regel 48: een pakketwissel vraagt bevestiging met wat de klant wint of verliest en schrijft een auditregel bij platform en klant; gezondheid telt pogingen, berichten, nieuwe prospects en afspraken; een gebruikersaanvraag geeft een melding aan de founder.
3. Bijlage A regel 49: een sleutel verschijnt alleen als vingerafdruk van acht tekens, nooit met de eerste tekens van de sleutel; AI-sleutels, agendatokens en de andere doelen hebben elk een eigen geheim.
4. Bijlage A regel 50: "Maak issue" zet de status op "gestart"; een tweede aanroep geeft 409 en start geen tweede run.
5. Een beheerder kan geen platformfunctie uitvoeren (404 op `/api/platform/**`) en kan pakket, credits, prijs per handeling, features per niveau of prompts niet via de instellingen schrijven (wegwerp-Postgres).
6. Een founder in "Alleen meekijken" kan niets schrijven in klantdata.
7. De rol `dealtrace_platform` kan via de security-definer-functies alleen geaggregeerde getallen lezen; een poging om klantrecords te lezen faalt.
8. Een update naar rol founder door de app-rol faalt op de databasetrigger.
9. Een dubbel Stripe-event verandert niets; een mislukte incasso pauzeert AI-werk en laat de app werken; na betaling vervalt de pauze.
10. Een gevaarlijke actie zonder herbevestiging binnen 15 minuten wordt geweigerd.
11. Agent-prompts: de elfde versie van een slot verdringt de oudste; een prompt zonder het vaste kader wordt geweigerd.
12. Gezondheid: testgevallen op de grenzen 15 en 30 dagen, 0 gebruikers, 0 accounts, motor 14 dagen.
13. De beheerder ziet verbruik in credits per soort en per gebruiker en nooit euro's of modellen; de salesmanager leest het verbruik van zijn organisatie.
14. Niveau Beginner, Gevorderd en Expert (accountmanager): geen menu-item Platformbeheer, ook niet in de groep "Nog niet aangezet" (rol, geen niveau); `/roadmap` werkt op elk niveau.
15. Telefoon (375, 390, 412 px): Platformbeheer opent via Meer met "Beter op een groot scherm", zonder horizontale scroll; de klantflyout opent als schuifvenster; de gele balk blijft zichtbaar; `/roadmap` is met één duim bruikbaar (tikdoelen minimaal 44 px).
16. De platformschermen zitten in een eigen, lui geladen deel van de app-bundel; de app-bundel zonder platformdeel blijft onder 400 kB gezipt (13.4).
17. `check:platform` en `check:rechten` zijn groen.
18. Features per niveau: een cel aanzetten voor alle organisaties werkt direct, zonder release, voor elke gebruiker op dat niveau (de server geeft geen 403 met `reden: 'niveau'` meer en de client toont de functie bij de volgende `GET /api/me`); een afwijking voor één organisatie wint en is geel gemarkeerd; elke wijziging staat in de platformaudit; een functie buiten het pakket blijft uit; er bestaat nergens een schakelaar per gebruiker.
19. Prijs per handeling: een aangepaste prijs met geldig-vanaf vandaag wordt door `creditsVoor` gebruikt bij de volgende aanroep; een aanroep van gisteren houdt zijn oude boeking.
20. Extra credits: toegekende extra credits verhogen de pot van deze maand direct, verschijnen als factuurregel als `factureren` aan staat en vervallen aan het einde van de maand (F26); een tweede toekenning met dezelfde idempotentiesleutel telt niet dubbel.

## Definition of Done

Hoofdstuk 19 geldt volledig. Specifiek voor deze prompt:

- Cross-tenant- en platformscheidingstests in de wegwerp-Postgres groen (F23 Tests).
- Adapters voor Stripe, Moneybird en GitHub met mock; geen netwerk in tests; alles draait lokaal (13.5).
- Playwright-flow: de founder zet op `/platform/features` een functie aan voor Beginner en een Beginner ziet hem na verversen, op desktop.
- De startindeling uit 4.3 staat als seed in `functies_per_niveau`; de vastgestelde indeling per sprint staat in het sprintverslag (open vraag 25).
- Regels 14, 48, 49 en 50 van Bijlage A afgevinkt in het sprintverslag.
- `docs/HOE-HET-WERKT.md` beschrijft de geheimen per doel, rotatie en de twee databaserollen.
