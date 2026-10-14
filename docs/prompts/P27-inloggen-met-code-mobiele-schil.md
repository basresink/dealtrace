# P27: Inloggen met code en de mobiele schil

| Onderdeel | Waarde |
|---|---|
| Sprint | 1 (Fundament en één app) |
| Features | F24 Meldingen, zoeken, mobiel en offline (mobiele schil en PWA-basis), hoofdstuk 8 Mobiel en onderweg |
| Hangt af van | P01 (gebruikers, rollen, niveaus, werkplekprofiel, functiecatalogus, sync en offline-indicator) |
| Bron in het bouwplan | 8.2 tot en met 8.4, 8.14 (schil, routes, PWA), 8.15, 8.16, 13.1 (Auth), 15.3, 6.2, 14, ADR-019, ADR-020, beslissing B12 en B13 |

## Lees eerst

- Bouwplan-Dealtrace.md: 0.2 (B12, B13, B15), 6.2, hoofdstuk 8 (vooral 8.1 tot en met 8.4, 8.7, 8.14 tot en met 8.16), 13.1 (rij Auth en Client), hoofdstuk 14, 15.3, ADR-019, ADR-020, hoofdstuk 19.
- DealDrive (commit 75bee61):
  - Inloggen: `app/pages/login.vue`, `app/middleware/auth.global.ts`, `server/api/auth/login.post.ts`, `server/api/auth/logout.post.ts`, `server/api/auth/me.get.ts`, `server/utils/supabaseAuth.ts`, `server/utils/session.ts` (DealDrive logt in met wachtwoord; Dealtrace niet).
  - Schil: `app/components/MobileShell.vue`, `app/components/DexShell.vue`, `app/components/DexKaart.vue`, `app/components/DexNieuw.vue`, `app/components/DexMelding.vue`, `shared/werkplek.ts`, `nuxt.config.ts` (hook `pages:extend` met `DEALDRIVE_APP`, die vervalt).
  - PWA: `app/components/InstallPrompt.vue`, `app/components/IOSInstallModal.vue`, `app/components/PushSoftPrompt.vue`, `app/composables/useWebPush.ts`, `app/components/OfflineBanner.vue`.

## Deel 1: Functioneel (wat en waarom)

### Wat je bouwt

Inloggen met een eenmalige code per mail voor iedereen (met TOTP erbij voor de founder) en de mobiele schil van Dealtrace: compacte kop, onderbalk per werkplekprofiel, schuifvensters, plakkende actiebalk, meldingsstrook en verbindingsstatus, in één app met één build en één manifest.

### Waarom

Beslissing B12: geen wachtwoorden. Beslissing B13: de buitendienst werkt de hele dag vanaf de telefoon; met de icoonstrook van het designsysteem blijft op 390 px maar 302 px over en staat er geen taak boven de vouw (ADR-019). Dex in DealDrive was een aparte build met twee schrijfwegen; Dealtrace neemt de bediening over en niet de knip (8.1, ADR-020). De schil staat er vanaf sprint 1, zodat elke latere functie direct een telefoonweergave krijgt.

### Gebruikers en niveaus

| Rol | Niveau | Wat |
|---|---|---|
| accountmanager | Beginner, Gevorderd, Expert | Inloggen met code; onderbalk volgens werkplekprofiel, op elk niveau gelijk; "Meer" bevat de rest van de zijbalk van zijn niveau met "Nog te ontgrendelen" onderaan |
| salesmanager | Gevorderd, Expert | Zelfde inloggen; zonder eigen portefeuille de onderbalk Team, Coaching, Acties, Prospects, Meer |
| beheerder | Expert | Zelfde inloggen, TOTP optioneel; Instellingen in "Meer" met "Beter op een groot scherm" |
| founder | n.v.t. | Code per mail plus verplichte TOTP; Platformbeheer in "Meer" met "Beter op een groot scherm" |

### Schermen

**Inloggen** (`/login`). Het bouwplan legt de regels vast maar geen schermteksten. Niet vastgelegd in het bouwplan; voorstel:

1. Stap 1: titel "Inloggen bij Dealtrace", veld "E-mailadres", knop "Stuur mij een code" (geel). Onder de knop: "Je krijgt een code van zes cijfers per mail. Hij is 10 minuten geldig."
2. Stap 2: titel "Vul je code in", zes vakken voor de cijfers (op de telefoon `inputmode="numeric"` en `autocomplete="one-time-code"`), knop "Inloggen", tekstknoppen "Andere code sturen" en "Ander e-mailadres".
3. Stap 3 (alleen founder, en beheerder als hij TOTP aanzette): "Code uit je authenticator-app" met zes vakken.
4. Foutteksten: "Deze code klopt niet of is verlopen. Vraag een nieuwe code aan." en bij de limiet "Je hebt te vaak een code aangevraagd. Probeer het over een uur opnieuw." Na stap 1 altijd dezelfde bevestiging, ook als het adres onbekend is: "Als dit adres bij Dealtrace hoort, staat er een code in je mail." (zelfde gedrag als de generieke fout in DealDrive `login.post.ts`).
5. Een gearchiveerde gebruiker krijgt na een geldige code: "Je account is gearchiveerd. Vraag je beheerder om toegang."

**Mijn instellingen, Toestellen en sessies.** Lijst met toestellen waarop je bent ingelogd (naam van het toestel en browser, laatst gezien) en de knop "Uitloggen op alle toestellen" (15.3). Niet vastgelegd hoe de lijst eruitziet; voorstel: deze twee kolommen en een knop "Uitloggen" per toestel.

**Schil per breedte** (8.3)

| Breedte | Schil |
|---|---|
| kleiner dan 768 px | compacte kop 56 px, onderbalk 64 px plus `env(safe-area-inset-bottom)`, vensters als schuifvenster van onderen, schermbreed |
| 768 tot 1023 px | icoonstrook van 64 px zoals in het designsysteem, flyouts van 480 px |
| vanaf 1024 px | zijbalk 240 px, inklapbaar naar 64 px (P01) |

**Compacte kop (56 px, sticky).** Links de paginatitel (16 px, vet) of op een subpagina een terugknop met de naam van het vorige scherm. Rechts drie iconknoppen van 44 bij 44 px: "Zoeken" (vergrootglas), "Inspreken" (microfoon) en "Meldingen" (bel met rode teller, "9+" boven negen). Geen logo, geen kicker, geen snelle acties. De spraakopdracht zelf is P31; tot dan opent "Inspreken" een schuifvenster met "Inspreken komt in een volgende versie." Niet vastgelegd in het bouwplan; voorstel: deze tekst, of de knop pas tonen vanaf P31. Kies het tweede als de founder dat wil; de plek van de andere twee knoppen verandert dan niet.

**Onderbalk (64 px plus veilige zone).** Vijf tabs met icoon van 24 px en label van 11 px; actieve tab in `--geel` met een streep van 3 px erboven. Elke pagina hoort bij precies één tab.

| Profiel | Tab 1 | Tab 2 | Tab 3 | Tab 4 | Tab 5 |
|---|---|---|---|---|---|
| Buitendienst | Vandaag `/` | Route `/onderweg` | Bellen `/bellen` | Prospects `/prospects` | Meer |
| Binnendienst | Vandaag `/` | Belblok `/belblokken` | Acties `/acties` | Prospects `/prospects` | Meer |
| Hybride | Vandaag `/` | Route `/onderweg` | Belblok `/belblokken` | Prospects `/prospects` | Meer |
| Salesmanager zonder eigen portefeuille | Team `/team` | Coaching `/coaching` | Acties `/acties` | Prospects `/prospects` | Meer |

- Niet vastgelegd hoe Dealtrace weet dat een salesmanager geen eigen portefeuille heeft; voorstel: rol salesmanager zonder werkplekprofiel, of een vinkje "Geen eigen portefeuille" in de gebruikersflyout.
- **Meer** opent een schuifvenster met de overige items van de zijbalk van je niveau, in dezelfde groepen en volgorde als op de laptop (6.1): Agenda, Acties of Bezoeken (wat niet in de onderbalk staat), Concepten, Inzichten, Campagnes, Pipeline, Richting, Mijn resultaten, Helpcenter, Mijn instellingen, Uitloggen. Vergrendelde items onderaan in de ingeklapte groep "Nog te ontgrendelen". Instellingen en Platformbeheer staan er met "Beter op een groot scherm" en openen wel.
- Pagina's die een latere prompt bouwt (`/onderweg` in P30, `/bellen` in P10, `/team` en `/coaching` in P21) bestaan nu als lege pagina met de lege staat "Deze pagina komt in een volgende versie." Niet vastgelegd in het bouwplan; voorstel: deze tekst, zodat de onderbalk vanaf dag één klopt.
- Op de laptop stuurt `/onderweg` door naar `/bezoeken` (8.14).

**Schuifvenster.** Schuift van onderen tot maximaal 92 procent van de schermhoogte, greep bovenin, sluiten door omlaag te vegen of "Sluiten", plakkende knoppenrij onderaan met de primaire knop rechts. Na een geslaagde opslag sluit hij pas na 1,2 seconden. Op de laptop is dezelfde component een flyout rechts (8.2 punt 5).

**Plakkende actiebalk.** Component voor de accountkaart, contactkaart en afspraak (gebruikt vanaf P03): vier knoppen van 48 px hoog "Bellen", "Mail", "WhatsApp", "Navigeer", boven de onderbalk. Een knop zonder gegevens is uitgegrijsd met de reden in een tooltip, bijvoorbeeld "Geen mobiel nummer bekend".

**Meldingsstrook.** Boven de onderbalk. Succes verdwijnt na 5 seconden met "Ongedaan maken" erin ("Bezoek vastgelegd"); een fout blijft tot je hem wegtikt. Offline opgeslagen: "Bewaard op je telefoon, wordt verstuurd zodra je verbinding hebt". Op de laptop blijft de toast rechtsonder (14).

**Verbindingsstatus.** Offline onder de kop een gele strook van 28 px: "Offline · 3 wijzigingen wachten"; bij een vastgelopen wachtrij rood met "Opnieuw proberen" (de wachtrij zelf is P01).

**Tokens en modi.** `--touch-target-min` 44 px, 48 px voor knoppen in lijsten, 54 px in handschoenmodus; zijmarge 16 px op de telefoon; 32 px tussen secties; hoeken 2 px; lopende tekst minimaal 15 px op de telefoon. Zonlichtmodus verhoogt het contrast naar AAA en zet grijstinten om naar zwart. Niet vastgelegd waar je handschoen- en zonlichtmodus aanzet; voorstel: Mijn instellingen, blok "Telefoon".

**PWA.** Eén manifest "Dealtrace", `display: standalone`, staand, eigen iconen en iOS-meta's; installatievraag na de tweede dag van gebruik, met iOS-uitleg; `navigator.storage.persist()` na installatie (8.14).

### Klikpaden

1. Accountmanager opent Dealtrace op zijn telefoon, vult zijn e-mailadres in, tikt "Stuur mij een code"; de mail komt binnen; hij vult de zes cijfers in (het toetsenbord stelt de code voor); hij landt op Vandaag met de onderbalk van zijn profiel.
2. Na 30 dagen op hetzelfde toestel moet hij opnieuw een code aanvragen; binnen die 30 dagen niet.
3. Een zesde aanvraag binnen een uur voor hetzelfde adres geeft de limietmelding; er gaat geen mail uit.
4. Founder vult code en daarna TOTP in; zonder geldige TOTP komt hij niet verder dan stap 3.
5. Buitendienstmedewerker tikt "Meer": het schuifvenster toont Agenda, Acties, Concepten, Inzichten en de rest van zijn niveau; als Beginner staat onderaan "Nog te ontgrendelen".
6. Hij opent vanuit "Meer" Agenda: de tab "Meer" licht op (Agenda hoort bij Meer).
7. In Mijn instellingen tikt hij "Uitloggen op alle toestellen": na bevestiging is elke sessie ongeldig, ook op zijn laptop.

### Regels

- Code van zes cijfers, 10 minuten geldig, hooguit 5 codes per uur per adres, sessie 30 dagen per toestel, server-side sessie in httpOnly-cookies, JWKS-validatie (13.1, 15.3).
- TOTP verplicht voor de founder, optioneel voor de beheerder; SSO (Microsoft, Google) komt later en is buiten scope.
- De onderbalk is op elk niveau gelijk; een lager niveau verandert alleen de inhoud van "Meer" (8.3, 8.11).
- Elke pagina hoort bij precies één tab, zodat er altijd één oplicht (8.16).
- Wat iemand ziet volgt uit rol, niveau, pakket en werkplekprofiel, nooit uit welke build hij opent (8.2 punt 1).

### Helpartikelen

- "Je eerste dag in Dealtrace" (leerpad Beginner): inloggen met een code, Vandaag, de onderbalk.
- "Dealtrace op je telefoon en offline" (Aan de slag): installeren op iPhone en Android, de onderbalk per werkplek, "Meer", de offline-strook.

## Deel 2: Technisch (hoe)

### Datamodel

- Supabase Auth met e-mail-OTP beheert codes en sessies. Niet vastgelegd in het bouwplan of Supabase de limiet van 5 per uur per adres zelf afdwingt; voorstel: een eigen tabel `inlog_aanvragen (email_hash, op)` zonder `organisation_id` (vóór het inloggen is er geen organisatie), alleen leesbaar voor de serverrol, opgeruimd na 24 uur.
- Toestellen: voorstel `gebruiker_toestellen (id, organisation_id, gebruiker_id, label, laatst_gezien, sessie_ref, ingetrokken_op)` met RLS op organisatie en eigen gebruiker. Niet vastgelegd in het bouwplan.
- TOTP voor de founder via Supabase MFA; het verificatieniveau (`aal2`) staat in de sessie, zodat P02 het per platformendpoint controleert.
- `users.laatste_inlog` bijgewerkt bij elke geslaagde verificatie.
- Geen nieuwe tabellen in de sync-allowlist.

### Pure functies

| Functie | Invoer | Uitvoer | Randgevallen en tests |
|---|---|---|---|
| `tabsVoor(werkplekprofiel, rol, eigenPortefeuille)` in `shared/onderbalk.ts` | profiel, rol | vijf tabs met label, icoon, route | elk profiel uit 8.4; hybride; salesmanager zonder portefeuille; onbekend profiel valt terug op binnendienst. Niet vastgelegd; voorstel: terugval binnendienst |
| `tabVoorRoute(pad, tabs)` | pad, tabs | index van de actieve tab | elke route uit 6.1 geeft precies één tab; subpagina's (`/accounts/:id`) horen bij Prospects; alles wat niet in de onderbalk staat hoort bij "Meer" |
| `meerItems(zijbalk, tabs)` | uitvoer van `zijbalkVoor` (P01) en tabs | groepen met items | niets dubbel met de onderbalk; vergrendelde items onderaan |
| `schermklasse(breedte, grofAanwijzer)` achter `useSchermklasse()` | breedte, `pointer: coarse` | `telefoon`, `tablet`, `laptop` | grenzen 767, 768, 1023, 1024 |
| `magCodeAanvragen(aanvragen, nu)` | tijdstippen van aanvragen voor één adres | boolean | precies 5 binnen 60 minuten mag, de zesde niet; oude aanvragen tellen niet |

### Endpoints

Het bouwplan noemt geen auth-routes; voorstel:

| Methode en route | Recht | Invoer | Uitvoer | Fouten |
|---|---|---|---|---|
| `POST /api/auth/code` | openbaar | `{email}` | altijd 202 met dezelfde tekst | 429 bij meer dan 5 per uur |
| `POST /api/auth/verifieer` | openbaar | `{email, code}` | sessiecookies, `{totpNodig}` | 401 generiek; 403 gearchiveerd |
| `POST /api/auth/totp` | half ingelogd | `{code}` | sessie op `aal2` | 401 |
| `GET /api/auth/me` | ingelogd | | gebruiker, rol, niveau, werkplek, `aal` | 401 |
| `POST /api/auth/uitloggen` | ingelogd | `{alleToestellen?: boolean}` | 204 | |
| `GET /api/mij/toestellen`, `DELETE /api/mij/toestellen/:id` | eigen | | lijst, 204 | 404 |

### Componenten en routes

- `app/layouts/default.vue` kiest met `useSchermklasse()` tussen `Zijbalk` en `MobieleKop` plus `Onderbalk` (8.14); dezelfde routes, een pagina mag een eigen telefoonopbouw hebben via `<TelefoonWeergave>` en `<LaptopWeergave>`.
- Nieuw: `AppShell.vue`, `MobieleKop.vue`, `Onderbalk.vue`, `MeerVenster.vue`, `RecordVenster.vue` (schuifvenster op telefoon, flyout op laptop), `NieuwVenster.vue`, `Meldingsstrook.vue`, `ActieBalk.vue`, `VerbindingsStrook.vue`.
- Tokens en componenten voor kop, onderbalk en schuifvenster komen erbij in het designsysteem en worden daar gedocumenteerd (ADR-019).
- Service worker: statische bestanden 30 dagen; API-GET netwerk eerst met terugval op de cache (8.14). Het dagpakket via Dexie is P30.
- Web Push: het abonnement (`push_subscriptions`) en `PushSoftPrompt` horen bij de PWA-basis van F24; het versturen van meldingen is P26 en P31. Niet vastgelegd welke sprint-1-prompt het abonnement vraagt; voorstel: deze prompt, na de installatievraag.

### Functiecatalogus

| Sleutel | Niveau | Pakket | Recht | Helpartikel |
|---|---|---|---|---|
| `auth.toestellen` | Beginner | Starter | iedereen | "Dealtrace op je telefoon en offline" |
| `schil.onderbalk` | Beginner | Starter | iedereen | "Dealtrace op je telefoon en offline" |
| `schil.handschoenmodus`, `schil.zonlichtmodus` | Beginner | Starter | iedereen | "Dealtrace op je telefoon en offline" |

Pakket: het bouwplan legt per functie geen pakket vast; voorstel Starter.

### AI-stappen en integraties

Geen AI. Integratie: Supabase Auth (mailverzending van de code). Mock: in de mock-modus logt de server de code in de console en accepteert hij `000000` alleen als `NODE_ENV` test is. Niet vastgelegd in het bouwplan; voorstel.

### Hergebruik uit DealDrive

| Bestand | Wat je aanpast |
|---|---|
| `login.vue`, `login.post.ts`, `supabaseAuth.ts` | wachtwoord eruit, `signInWithOtp` en `verifyOtp` erin; generieke foutmelding behouden |
| `session.ts`, `auth.global.ts` | sessie 30 dagen per toestel, `aal` in de sessie |
| `MobileShell.vue`, `DexShell.vue` | worden `AppShell.vue` met `MobieleKop.vue` en `Onderbalk.vue`; geen aparte build, geen allowlist per functie |
| `DexKaart.vue`, `DexNieuw.vue`, `DexMelding.vue` | worden `RecordVenster.vue`, `NieuwVenster.vue`, `Meldingsstrook.vue`, responsief |
| `shared/werkplek.ts` | werkplekprofiel binnendienst, buitendienst, hybride; de beheerder zet het, niet alleen de founder |
| `InstallPrompt.vue`, `IOSInstallModal.vue`, `PushSoftPrompt.vue`, `useWebPush.ts` | letterlijk, met manifest "Dealtrace" |
| `nuxt.config.ts` hook `pages:extend` met `DEALDRIVE_APP` | vervalt: één build |

### Buiten scope

SSO, de inhoud van Vandaag, Route en Bellen (P32, P30, P10), spraak (P31), het dagpakket en de offline dag (P30), pushmeldingen versturen (P26, P31), Platformbeheer (P02).

## Acceptatiecriteria

1. Inloggen met een code van zes cijfers werkt op desktop en telefoon; de code is na 10 minuten ongeldig; een gebruikte code werkt geen tweede keer.
2. De zesde codeaanvraag binnen een uur voor hetzelfde adres geeft 429 en verstuurt niets.
3. Een onbekend adres krijgt dezelfde bevestiging als een bekend adres; de server verklapt niet of het adres bestaat.
4. De founder komt zonder TOTP niet verder dan de TOTP-stap; een beheerder met TOTP aan ook niet.
5. Een sessie blijft 30 dagen geldig op hetzelfde toestel; "Uitloggen op alle toestellen" maakt elke sessie ongeldig.
6. Er is geen wachtwoordveld, geen wachtwoordherstel en geen wachtwoordendpoint in de app.
7. Op een telefoon (kleiner dan 768 px) staan compacte kop en onderbalk, geen zijbalk en geen icoonstrook; op 820 px staand de icoonstrook van 64 px; vanaf 1024 px de zijbalk.
8. Elke tab van de onderbalk is op elke pagina eenduidig actief; `tabVoorRoute` is getest voor elke route uit 6.1 (8.16).
9. De onderbalk verschuift nooit van plek tussen Beginner, Gevorderd en Expert; alleen "Meer" verandert (8.16). Getest als Beginner, Gevorderd en Expert in de profielen binnendienst, buitendienst en hybride, en als salesmanager zonder portefeuille.
10. Alle iconknoppen in kop en onderbalk en de knoppen van de actiebalk zijn minimaal 44 px (actiebalk 48 px hoog) en liggen binnen duimbereik (8.7, 8.16).
11. Een schuifvenster sluit door omlaag te vegen, met "Sluiten" en met Escape op een toetsenbord; na opslaan sluit hij na 1,2 seconden.
12. Offline toont de strook "Offline · n wijzigingen wachten"; bij herstel verdwijnt hij nadat de wachtrij leeg is.
13. Geen horizontale scroll op 375, 390 en 412 px op alle pagina's die nu bestaan; de inhoud gebruikt zijmarges van 16 px.
14. Er is één manifest, één service worker en één build; `DEALDRIVE_APP` en een tweede domein bestaan niet.
15. Playwright-projecten 375, 390 en 412 px met aanraakmodus draaien de inlogflow en de onderbalktests; handmatig getest op de toestellen uit 8.15 (iPhone SE, iPhone 15 of 16, Samsung Galaxy A, Pixel 7, iPad 10e generatie).
16. Bijlage A, gat 16: onderbalkregels en schermklassen staan één keer in `shared/`.

## Definition of Done

Hoofdstuk 19 geldt volledig. Specifiek voor deze prompt:

- De sprint-1-toestand "een accountmanager logt in met een code op zijn telefoon en ziet de onderbalk" is bevestigd op ten minste één echte iPhone en één echte Android, met schermafbeeldingen in het sprintverslag.
- De nieuwe tokens en componenten (kop, onderbalk, schuifvenster, actiebalk, strook) staan in het designsysteem met uitleg en verwijzing naar ADR-019.
- `docs/HOE-HET-WERKT.md` beschrijft inloggen met code, TOTP, sessies en de schil per breedte.
- Testgebruikers zijn fictief (bijvoorbeeld medewerkers van Testbedrijf Voltvast uit Bijlage C); geen echte e-mailadressen in seeds of tests.
