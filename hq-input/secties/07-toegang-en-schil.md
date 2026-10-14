# Toegang en schil

## Wat het is en waarvoor

Deze feature is het fundament onder alle andere HQ-schermen: hoe je in DealDrive HQ binnenkomt, hoe je je erin beweegt, hoe HQ technisch gescheiden is van de klantapp, en hoe je vanuit HQ veilig bij een klant naar binnen stapt. Daarnaast hoort de geplande motorrun voor alle organisaties erbij, omdat die alleen op de HQ-uitrol bestaat.

Het probleem dat hij oplost: de founder heeft rechten die geen klant mag hebben (alle organisaties zien, organisaties aanmaken, wensen van alle klanten lezen), terwijl de klantapp en HQ uit dezelfde code komen. DealDrive kiest er niet voor om dat alleen met een rolcontrole af te vangen. HQ is een aparte uitrol op een eigen domein, met een eigen paginaset, een eigen lijst toegestane serverroutes en een eigen databaserol. Een fout in de rolcontrole van de klantapp kan zo niets openzetten wat in die build niet bestaat.

Je gebruikt de feature elke keer dat je HQ opent: je logt in, de zijbalk brengt je naar Klanten, Abonnementen, Facturen, LLM-connector, Agent-prompts of Roadmap, en met "Instappen" ga je naar de werkomgeving van een klant om mee te kijken of support te geven. De motorrun draait elk uur vanzelf, zonder scherm.

Samenhang met de klantapp: inloggen gebruikt hetzelfde Supabase-account en dezelfde gebruikerstabel als de klantapp. De founder is een gewone gebruiker met de rol superuser (op het scherm "Founder") in de eigen organisatie "DealDrive HQ", die zelf geen klantdata heeft. Instappen zet op het domein van de klantapp een cookie waardoor die superuser tijdelijk in de gekozen organisatie werkt, en elke start en stop komt in het auditlog van die organisatie. De motorrun schrijft inzichten, taken en gevulde belblokken in elke klantorganisatie; HQ leest daarvan alleen het moment van de laatste run terug, in de gezondheidskolom en de klantflyout.

## Waar je het vindt

| Onderdeel | Route of plek | Wie ziet het |
|---|---|---|
| Zijbalk (de schil) | om elke pagina onder /admin | alleen de rol superuser |
| Inloggen | /login op het HQ-domein | iedereen zonder sessie |
| Wachtwoord instellen | /wachtwoord-instellen op het HQ-domein | iedereen met een herstel-link |
| Instappen | knop "Instappen" per rij op /admin | superuser |
| Overdracht | /impersonatie op het domein van de klantapp | superuser met sessie op de klantapp |
| Uitstappen | knop "Stap uit" op /instellingen in de klantapp | superuser |
| Motor voor alle organisaties | POST /api/motor/run-all, geen scherm | de uurlijkse wekker met een gedeeld geheim |

De kale root van HQ ("/") is een doorverwijzing naar /admin. Wie zonder sessie een HQ-pagina opent, komt op /login met het gevraagde pad als "returnTo" in de adresbalk en landt na inloggen weer op dat pad. Wie ingelogd /login opent, gaat direct door naar /admin.

Lokaal draait de mock van HQ op localhost:3096 (het script dev:hq:mock) en de bijbehorende mock van de klantapp op poort 3097. De echte lokale HQ zit op 3089 en op staging op dealdrive-hq-staging.netlify.app; de beoogde productiedomeinen zijn hq.dealdrive.nl en app.dealdrive.nl.

## Opbouw van de pagina

### De schil: de zijbalk links

De schil (AdminShell) staat om elke pagina die met /admin begint. De klantapp gebruikt een andere schil (AppSidebar); de keuze valt in app.vue op het pad. De zijbalk is donker (de inktkleur) met een gele rand van 3 pixels rechts, 210 pixels breed, en staat vast bij het scrollen.

![De HQ-schil uitgeklapt, met de vier groepen en onderaan de gebruiker en Uitloggen](shots/toegang-1-schil-uitgeklapt.png)

Van boven naar beneden:

- **Kop.** Een geel blokje met "DD" en de tekst "DealDrive HQ" (HQ in geel). Beide zijn een link naar /admin. Rechts daarvan de klapknop met een paneelicoon, met als tooltip "Menu inklappen" of "Menu uitklappen".
- **Navigatie** (schermlezerlabel "Founder-navigatie"), in vier groepen met een klein grijs groepslabel in hoofdletters:

| Groep | Item | Route | Icoon |
|---|---|---|---|
| Portfolio | Klanten | /admin | gebouw |
| Geld | Abonnementen | /admin/abonnementen | betaalkaart |
| Geld | Facturen | /admin/facturen | bon |
| AI | LLM-connector | /admin/llm | stekker |
| AI | Agent-prompts | /admin/prompts | document |
| Bouwen | Roadmap | /admin/roadmap | kaart |

De volgorde volgt hoe de founder denkt volgens de code: eerst de klanten, dan het geld, dan de AI, dan wat er gebouwd wordt. De eerste groep heet bewust "Portfolio" en niet "Klanten", omdat het enige item eronder al zo heet.

- **Actief item.** Gele tekst op een zachte gele tint met een smal geel streepje links. Klanten is alleen actief op precies /admin; de andere items zijn actief zodra het pad ermee begint (dus ook op onderliggende pagina's).
- **Badge op Klanten.** Een geel blokje met het aantal aandachtsignalen uit het klantenbestand, met als tooltip "1 aandachtsignaal" of "3 aandachtsignalen". Het getal komt uit de pagina Klanten zelf (de signalenlijst daar, onder meer contracten in de opzegtermijn) en wordt gedeeld via een gedeelde status. De schil haalt het niet zelf op: zolang je de pagina Klanten in deze sessie nog niet hebt geopend, staat er geen badge in plaats van een verzonnen nul. Bij nul signalen staat er ook geen badge.
- **Onderblok.** Een geel vierkantje met je initialen (de eerste letter van de eerste twee woorden van je naam, anders "DD"), je naam en eronder "FOUNDER". Dat label staat vast in de schil en komt niet uit de rol. Daaronder de knop "Uitloggen" met een uitgangsicoon.

![De zijbalk ingeklapt tot een strook met alleen iconen](shots/toegang-2-schil-ingeklapt.png)

**Ingeklapt** is de zijbalk 60 pixels breed. Groepslabels, itemlabels, de tekst naast het logo en je naam verdwijnen; de klapknop schuift onder het logo. Elk icoon krijgt de naam als tooltip, het gebruikersblok de tooltip met naam en "Founder". Het badge blijft staan, nu als getal in de hoek van het Klanten-icoon. De stand wordt niet bewaard: hij blijft staan zolang je binnen HQ klikt, maar na een herlaad of nieuwe tab is de zijbalk weer uitgeklapt.

![Het actieve item LLM-connector in de groep AI](shots/toegang-3-schil-actief-item.png)

**Smal scherm.** Onder 720 pixels breed staat de zijbalk vast op de icoonstrook en verdwijnt ook de klapknop, omdat uitklappen daar niets zichtbaars zou doen. Een mobiele variant is er bewust niet: de code noemt de console desktopwerk.

![HQ op een scherm van 700 pixels breed: de zijbalk staat vast op iconen](shots/toegang-8-schil-smal.png)

Wat bewust ontbreekt: een link "Naar de app". Die stond er eerder en is weggehaald, omdat de klantapp op een eigen domein met een eigen sessie draait. De enige weg naar een klantomgeving is "Instappen" op de pagina Klanten.

### De inlogpagina (/login)

Dezelfde pagina als in de klantapp, zonder schil. Bovenaan een zwarte balk met het DealDrive-logo en rechts de datum van vandaag voluit. Links het formulier, rechts een zwart welkomstblok.

- Kicker "Inloggen", titel "Welkom terug.".
- Met echte authenticatie (Supabase): de zin "Log in met je DealDrive-account.", de velden "E-mailadres" (verplicht, placeholder "naam@bedrijf.nl") en "Wachtwoord" (verplicht), de knop "Inloggen →" (uitgeschakeld tot beide velden gevuld zijn; tijdens het wachten "Bezig met inloggen…"), eventuele SSO-knoppen en de link "Inloggegevens kwijt?".
- Op HQ ontbreekt de regel "Geen account? Vraag toegang aan", omdat /signup in de HQ-build niet bestaat.
- Rechts het blok "Welkom bij DealDrive" met de titel "Verkopen begint bij weten wat er speelt." en vier genummerde punten over inzichten, taken, AI en ritme. Dit is de verkooptekst van de klantapp; HQ heeft geen eigen welkomsttekst, geen eigen logo op deze pagina en de browsertab heet ook op HQ "Inloggen · DealDrive".

In de mock (geen Supabase) staat er in plaats van het formulier een demokiezer: "Demo-modus: ga verder als de demo-gebruiker hieronder. Op test- en productieomgevingen staat hier een inlogformulier.", een kaart met de enige demo-gebruiker (Bas Resink, Founder, Eyecatcher) en de knop "Verder als Bas Resink →". De link "Inloggegevens kwijt?" en de SSO-knoppen bestaan in de mock niet.

![De inlogpagina van HQ in mock-modus, na een poging om /admin/abonnementen zonder sessie te openen](shots/toegang-4-login.png)

### Wachtwoord instellen (/wachtwoord-instellen)

Een losse pagina met alleen het logo bovenaan en één kaart. Kicker "Wachtwoord instellen", titel "Kies een nieuw wachtwoord.". Er zijn drie standen:

- **Formulier** (er zit een geldig token in de link): de zin "Minimaal 8 tekens. Kies er een die je nergens anders gebruikt.", de velden "Nieuw wachtwoord" en "Nogmaals" (beide verplicht, minimaal 8 tekens) en de knop "Wachtwoord opslaan", die pas actief wordt als beide velden gelijk zijn en minstens 8 tekens hebben. Tijdens het opslaan "Bezig…".
- **Geen token**: "Deze link werkt niet meer." met "Een herstel-link is eenmalig en verloopt. Vraag op het inlogscherm een nieuwe aan." en de link "← Naar inloggen".
- **Klaar**: "Gelukt." met "Je wachtwoord is ingesteld. Je kunt nu inloggen." en "Naar inloggen →".

![Wachtwoord instellen zonder geldig token in de link](shots/toegang-5-wachtwoord-instellen.png)

### De foutpagina's van HQ

HQ toont geen schil op een foutpagina; er is één kaart met een kicker, een titel, een zin en één knop.

- **403, geen founder-rol.** "403 · Geen toegang", titel "Hier kun je met jouw rol niet bij.", tekst "DealDrive HQ is alleen voor de founder-rol. Log in op de klantapp voor je werkomgeving." en de knop "Naar de klantapp" (naar het adres in APP_BASE_URL). Is dat adres niet ingesteld, dan wordt de knop "Uitloggen".
- **404, een pad dat in de HQ-build niet bestaat**, bijvoorbeeld /pipeline. "404 · Niet gevonden", titel "Deze pagina bestaat niet.", tekst "Er is niets te vinden op /pipeline. Controleer het adres, of ga terug naar een pagina die wel bestaat." en de knop "Naar HQ".

![De 403-pagina voor een beheerder die HQ opent; rechtsonder de foutmelding van de ontwikkelserver, die alleen lokaal verschijnt](shots/toegang-6-geen-toegang.png)

![Een klantpagina op het HQ-domein bestaat niet en geeft een 404](shots/toegang-7-niet-gevonden.png)

### De overdrachtspagina in de klantapp (/impersonatie)

Deze pagina hoort niet bij HQ maar bij de klantapp; hier komt de founder na "Instappen" terecht. Een kaart met de kicker "DealDrive HQ · overdracht" en vier standen:

- "Organisatie overnemen…" met "Even geduld, we controleren de overdracht."
- "Je werkt nu in ...". met "Alles wat je hier doet wordt vastgelegd in het auditlog van deze organisatie. Je gaat door naar de werkplek." Na 0,9 seconde volgt een volledige herlaad naar de startpagina van de klantapp. Let op: op de plek van de naam staat het technische organisatie-id, niet de naam; de code vult hier het id uit het antwoord in.
- "Je bent uit de klantomgeving." met "Je ziet weer je eigen omgeving." en "Terug naar HQ →"; na 1,2 seconde een herlaad.
- "Overdracht mislukt." met de reden van de server en "Terug naar HQ →" (of "Naar de werkplek →" als HQ_BASE_URL ontbreekt).

Deze pagina is in de mock niet gefotografeerd: dat zou een echte overdracht vragen.

## Doorklikken: de stappen

Inloggen op HQ (echte omgeving):

1. Open het HQ-domein. Zonder sessie stuurt de route-bewaker je naar /login met "returnTo".
2. Vul "E-mailadres" en "Wachtwoord" in en klik "Inloggen →". De server stuurt het wachtwoord rechtstreeks naar Supabase, zoekt de bijbehorende DealDrive-gebruiker op en zet twee httpOnly-cookies.
3. Je landt op "returnTo" of anders op "/", wat op HQ doorverwijst naar /admin.
4. Heb je de rol superuser niet, dan ben je wel ingelogd maar toont HQ direct de 403-pagina met "Naar de klantapp".

Wachtwoord kwijt:

1. Klik op /login op "Inloggegevens kwijt?". Er klapt een paneel open met twee blokken.
2. Vul bovenaan je e-mailadres in en klik "Stuur mij een herstel-link" (uitgeschakeld zolang het e-mailveld leeg is).
3. Het paneel toont altijd "Als er een account bij dit e-mailadres hoort, is er een herstel-link naartoe gestuurd.", ook bij een onbekend adres.
4. Open de link uit de mail. Die landt op /wachtwoord-instellen op het domein waar je de aanvraag deed, dus voor HQ op het HQ-domein.
5. Kies twee keer hetzelfde wachtwoord en klik "Wachtwoord opslaan". Bij "Gelukt." ga je via "Naar inloggen →" terug.

Instappen bij een klant:

1. Ga naar Klanten (/admin) en klik in de rij van de organisatie op "Instappen". Er volgt geen bevestigingsvraag; onder de tabel staat wel de uitleg "Instappen is geen inloggen als iemand anders." met de toevoeging dat elke impersonatie wordt geaudit.
2. HQ vraagt een ondertekend overdrachtsbewijs aan en stuurt je browser naar /impersonatie op het domein van de klantapp. Lukt dat niet, dan staat de fout als rode regel onder de tabel en wordt de knop weer actief.
3. Ben je op het domein van de klantapp niet ingelogd, dan stuurt de klantapp je eerst naar haar eigen /login en daarna terug. Dat moet binnen twee minuten, anders is het bewijs verlopen.
4. De klantapp controleert het bewijs, zet haar eigen cookie en schrijft een auditregel. Je ziet "Je werkt nu in ..." en na 0,9 seconde de werkplek van de klant.

Uitstappen:

1. Open in de klantapp /instellingen. Bovenaan staat voor een superuser het blok "Superuser" met "Je werkt in een klantomgeving." en "Actief in:" met de organisatienaam.
2. Klik "Stap uit". De cookie gaat weg, er komt een auditregel bij en de pagina herlaadt in je eigen, lege organisatie.
3. Klik "Naar HQ →" in hetzelfde blok om terug te gaan naar de console. HQ zelf heeft geen uitstapknop.

Uitloggen uit HQ:

1. Klik onderaan de zijbalk op "Uitloggen". De knop toont "Bezig…" en is even uitgeschakeld.
2. De server maakt het refresh-token bij Supabase ongeldig en wist de cookies; je komt op /login. Er is geen bevestigingsvraag. Je sessie op het domein van de klantapp blijft bestaan.

## Flyouts, vensters en knoppen

Deze feature heeft geen flyouts of dialoogvensters. De interactieve onderdelen zijn knoppen en één openklappend paneel.

### Klapknop van de zijbalk

Opent en sluit de zijbalk (zie Opbouw). Hij heeft een schermlezerlabel en meldt of het menu uitgeklapt is. Escape of een sneltoets is er niet.

### Uitloggen

Een knop zonder bevestiging. Bij dubbelklikken gebeurt er niets extra: zolang hij bezig is, negeert hij nieuwe klikken. Ook als de server faalt, wordt de sessie in de browser leeggemaakt en ga je naar /login.

### Paneel "Inloggegevens kwijt?"

Opent onder het inlogformulier met een gele rand links. Blok "Wachtwoord vergeten" met de uitleg "Vul hierboven je e-mailadres in en vraag een herstel-link aan. Die is eenmalig en verloopt." en de knop "Stuur mij een herstel-link" ("Bezig…" tijdens het versturen). De server weigert een leeg of ongeldig adres met "Vul een geldig e-mailadres in."; elke andere fout wordt "Aanvragen mislukte. Probeer het opnieuw.". Na een geslaagde aanvraag vervangt de bevestiging met een groene rand het blok. Blok "E-mailadres vergeten" legt uit dat dat niet automatisch kan en verwijst naar de beheerder van de organisatie onder "Instellingen → Team". Onderaan "Sluiten", dat het paneel dichtklapt en de melding wist.

### SSO-knoppen

"Inloggen met Microsoft" en "Inloggen met Google", onder een scheidingslijn met "of". Ze verschijnen alleen als de omgevingsvariabele NUXT_PUBLIC_SSO_PROVIDERS de provider noemt (azure of google) en het adres van Supabase bekend is. Een klik is een volledige doorverwijzing naar Supabase, geen achtergrondverzoek.

### Meldingen bij inloggen

- "E-mailadres en wachtwoord zijn verplicht."
- Bij een verkeerd wachtwoord een algemene melding, zonder te zeggen of het adres bestaat.
- "Dit account is nog niet gekoppeld aan een organisatie. Vraag je beheerder om toegang." als er een Supabase-account is zonder DealDrive-gebruiker.
- "Dit account is gearchiveerd. Vraag je beheerder of de leverancier om je toegang te herstellen." als de gebruiker in HQ is gearchiveerd.
- "Supabase Auth is niet geconfigureerd op deze omgeving." als er geen authenticatie is ingericht.

### Meldingen bij instappen

| Waar | Melding | Oorzaak |
|---|---|---|
| HQ | "Alleen een superuser kan een organisatie kiezen." | verkeerde rol |
| HQ | "Overdracht niet geconfigureerd: IMPERSONATIE_SECRET en APP_BASE_URL ontbreken." | geheim of adres ontbreekt |
| Klantapp | "Geen overdrachtstoken in de link. Kies de organisatie opnieuw in HQ." | link zonder bewijs |
| Klantapp | "Deze overdracht is verlopen. Kies de organisatie opnieuw in HQ." | ouder dan twee minuten |
| Klantapp | "Ongeldige overdracht." | handtekening of vorm klopt niet |
| Klantapp | "Deze overdracht is voor een andere gebruiker uitgegeven." | andere superuser ingelogd |

## Filters, zoeken, sorteren en weergaven

Filters, zoeken en sorteren zijn er in deze feature niet; de enige weergavekeuze is uitgeklapt of ingeklapt. Wel komen er drie dingen in de adresbalk:

- **returnTo** op /login: het pad dat je zonder sessie probeerde te openen, inclusief eigen parameters. Na inloggen ga je daarheen.
- **toegang=geweigerd**: als de server je wegstuurt van een pagina waar je niet mag komen, reist deze melding in de URL mee. De browser toont daarna de melding "Je hebt geen toegang tot deze pagina." en haalt de parameter weer uit de adresbalk. Op HQ zelf zie je bij een ontbrekende founder-rol de 403-pagina in plaats van deze melding.
- **token** of **stop=1** op /impersonatie in de klantapp: het overdrachtsbewijs of de opdracht om uit te stappen. Het bewijs staat in de gewone queryparameter en wordt, anders dan bij wachtwoord instellen en SSO, niet uit de adresbalk gehaald. Dat is te verdedigen omdat het bewijs zonder eigen sessie niets oplevert en na twee minuten verloopt, maar het belandt zo wel in de serverlog en de browsergeschiedenis van de klantapp.

Bij wachtwoord instellen en SSO staan de tokens juist achter een "#" in de URL. Dat deel gaat nooit mee naar de server; de pagina leest het in de browser en haalt het meteen uit de adresbalk.

## Regels en berekeningen

### Eén repository, drie uitrollen

De omgevingsvariabele DEALDRIVE_APP bepaalt wat er gebouwd wordt: leeg of "app" geeft de klantapp, "hq" de founder-console, "dex" de mobiele assistent Dex. De klantapp is de standaard, zodat een vergeten variabele nooit een console op een klantdomein oplevert. De lijsten met paden staan in één gedeeld bestand (shared/omgeving.ts) dat de bouwconfiguratie, de server en de browser alle drie lezen.

De scheiding zit op vier plekken:

1. **Pagina's** (nuxt.config.ts, de stap pages:extend). De HQ-build houdt alleen /admin en alles daaronder plus /login en /wachtwoord-instellen over (HQ_PAGINA_PREFIXEN en HQ_EXTRA_PAGINAS) en voegt de doorverwijzing van "/" naar /admin toe. De klantbuild gooit /admin en /dex eruit. Wat niet in de router zit, zit ook niet in de bundel.
2. **Serverroutes bij het bouwen.** In elke build behalve HQ worden de mappen uit HQ_API_PREFIXEN niet meegebouwd: /api/superuser en alles daaronder, /api/motor/run-all en /api/hooks/github.
3. **Serverroutes tijdens het draaien** (server/middleware/omgeving.ts). Op HQ geldt een toegestane lijst (HQ_API_TOEGESTAAN): /api/superuser, /api/motor/run-all, /api/auth, /api/session, /api/_nuxt, /api/settings (voor het roadmapbord), /api/config/status (om te zien of de koppelsleutels gezet zijn) en /api/hooks/github (de terugmelding van de ontwikkelketen). Alles daarbuiten krijgt 404 met "Niet gevonden.". In de klantapp krijgen de HQ-routes 404. Bewust 404 en geen 403, omdat een 403 verklapt dat er iets te vinden is. Een toegestane lijst en geen verboden lijst, omdat een vergeten nieuw klant-endpoint dan veilig dicht blijft op HQ.
4. **Een controle in de bouwstraat** (npm run check:omgeving). Die faalt als een HQ-pagina een endpoint aanroept dat niet op de HQ-lijst staat, of als een klantpagina een HQ-endpoint aanroept.

Binnen HQ geldt daarbovenop de rol. Elke pagina onder /admin eist in de route-bewaker de rol superuser; elk van de 31 endpoints onder /api/superuser controleert zelf de rol en geeft anders 403 (zonder sessie 401). In de mock bevestigd: een beheerder krijgt op HQ voor /api/superuser/organisations een 403, een bezoeker zonder sessie een 401, en /api/bootstrap of /api/accounts geeft 404.

Elke build heeft een eigen bouwmap (.nuxt voor de klantapp, .nuxt-hq voor HQ), zodat twee dev-servers tegelijk kunnen draaien zonder elkaars uitvoer te overschrijven.

### Twee databaserollen

Beide uitrollen verbinden met dezelfde Supabase-database (EU-Frankfurt), maar met een andere rol. Beide rollen hebben geen superrechten en vallen onder de rijbeveiliging per organisatie: elke query draait in de context van één organisatie.

| Rol | Gebruikt door | Extra functies |
|---|---|---|
| dealdrive_app | klantapp | geen cross-tenant functies na fase 2 |
| dealdrive_hq | HQ | list_organisation_ids, list_feature_requests, update_feature_request |

Die drie functies draaien met de rechten van hun eigenaar (security definer) en zijn de enige manier om over organisaties heen te kijken. De functies die beide rollen nodig hebben, zoals het opzoeken van een gebruiker bij het inloggen (lookup_app_user en link_app_user), de agendafeed en de publieke roadmap, houden beide rollen.

Rechten worden in twee fasen verplaatst. Fase 1 (npm run db:rls) maakt de HQ-rol aan en geeft beide rollen de functies; dat neemt niets af. Fase 2 (npm run db:rls:intrekken) haalt de drie functies weg bij de klantrol, en mag pas als de HQ-site met de HQ-rol draait en de klantenlijst en de motorrun daar werken. In één stap zou er een gat vallen waarin niemand de klantenlijst kan lezen en de uurlijkse motorrun faalt.

Op Netlify staat per site een eigen DB_URL met de juiste rol. Lokaal delen beide dev-servers één configuratie; daarom kiest de databaseverbinding (server/db/client.ts) op een HQ-build DB_URL_HQ als die gezet is, en anders DB_URL. Zonder die splitsing draait lokale HQ als de klantrol en werkt de klantenlijst niet meer zodra fase 2 gedraaid is. De databasetests openen hun HQ-stappen ook via DB_URL_HQ en weigeren te starten als dat adres niet naar de eigen machine wijst.

### Sessie en rol

De server bepaalt per verzoek wie er is ingelogd (server/middleware/session.ts). Met Supabase leest hij het toegangstoken uit een httpOnly-cookie; is dat verlopen, dan ververst hij stil met het refresh-token. Daarna zoekt hij de DealDrive-gebruiker op. Zonder gekoppelde gebruiker of bij een gearchiveerde gebruiker is er geen sessie. Zonder Supabase (lokaal) bevat een gewone cookie simpelweg het id van een demo-gebruiker; dat pad werkt alleen als er geen Supabase-adres is ingesteld, dus het is geen achterdeur op test of productie.

Superuser is geen rang boven beheerder maar een aparte as. In een klantomgeving heeft hij precies de rechten van de beheerder van die klant. Wat hem onderscheidt, staat buiten de rechtenmatrix: HQ, instappen en de audit. Je kunt de rol niet via een formulier uitdelen.

Inloggen zelf werkt op HQ voor iedere gebruiker met een account, ook voor een accountmanager van een klant: de sessiecookie wordt gezet en pas daarna weigert de route-bewaker /admin met de 403-pagina. Op API-niveau kan zo'n gebruiker op het HQ-domein alleen de routes van de toegestane lijst bereiken, en daarvan alleen /api/settings met zijn eigen organisatie; de code noemt dat bewust geen nieuwe opening.

### Wachtwoord kwijt

Het herstel-endpoint (/api/auth/herstel) antwoordt altijd hetzelfde, zodat het inlogscherm niet verraadt welke adressen een account hebben. Het vraagt de herstelmail aan bij Supabase met als terugkeeradres /wachtwoord-instellen op het domein van het verzoek. Weigert Supabase de mail (bijvoorbeeld door de maillimiet van de ingebouwde afzender), dan verschijnt alleen in de serverlog een waarschuwing. Het nieuwe wachtwoord gaat vanuit de browser rechtstreeks naar Supabase en nooit via de eigen server. Zonder Supabase (mock) geeft het endpoint dezelfde zin terug zonder iets te versturen.

### Inloggen met Microsoft of Google

De knop stuurt de browser naar Supabase; die stuurt na de provider terug naar /sso-afronden met de tokens achter een "#". Die pagina stuurt ze in de body naar /api/auth/sso, dat ze controleert en dezelfde httpOnly-cookies zet als bij wachtwoord-login. SSO maakt nooit een account aan: is er geen DealDrive-gebruiker met dat e-mailadres, dan volgt een weigering en wordt de achtergebleven Supabase-sessie opgeruimd. Bestaat de gebruiker wel, dan wordt het Microsoft- of Google-account eraan gekoppeld.

Twee kanttekeningen uit de code. Ten eerste staat /sso-afronden niet in de paginalijst van HQ. Zou NUXT_PUBLIC_SSO_PROVIDERS ook op de HQ-site gezet worden, dan toont de inlogpagina van HQ de knoppen, maar landt de terugkeer op een 404. Het handboek zegt dat de knoppen op de loginpagina kunnen verschijnen zonder dat onderscheid; SECRETS.md noemt alleen het terugkeeradres van de klantapp. Ten tweede is SSO volgens de roadmap nog niet ingericht (de app-registraties ontbreken), dus op dit moment is er nergens een knop.

### Instappen over twee domeinen

1. HQ controleert de rol en of het gedeelde geheim (IMPERSONATIE_SECRET) en het adres van de klantapp (APP_BASE_URL) bestaan, anders 503.
2. Met een database schrijft HQ de auditregel "superuser-impersonate-uitgegeven" in het log van de gekozen organisatie, met de naam van de superuser en "via: hq".
3. HQ maakt een bewijs met daarin het id van de superuser, het id van de organisatie, het uitgiftemoment en een willekeurig uniek nummer, ondertekend met HMAC-SHA256 over het gedeelde geheim. Beide sites moeten hetzelfde geheim hebben.
4. De klantapp eist een eigen geldige sessie met de rol superuser, controleert de handtekening in constante tijd, controleert dat het bewijs niet ouder is dan twee minuten, en dat de superuser in het bewijs dezelfde is als die van de sessie.
5. Pas dan zet de klantapp de cookie dd_impersonate_org (httpOnly, 8 uur geldig, "een werkdag") en schrijft "superuser-impersonate-start" met "via: overdracht-hq".
6. Vanaf dat moment werkt de sessie van de superuser in de gekozen organisatie; zijn eigen gebruikersrij blijft in zijn eigen organisatie staan, zodat persoonlijke instellingen daar blijven. Zonder cookie zit hij in zijn eigen organisatie zonder data en ziet hij niets.
7. Uitstappen wist de cookie en schrijft "superuser-impersonate-stop". Daarvoor is geen bewijs nodig, omdat het rechten wegneemt.

Waar code en handboek verschillen: het handboek spreekt van een kaartje dat 60 seconden geldig is en eenmalig. In de code is het twee minuten geldig en bewust herbruikbaar binnen die tijd. De toelichting in de code: het bewijs geeft zonder eigen sessie van dezelfde superuser niets, dus hergebruik betekent alleen dat dezelfde persoon dezelfde keuze nog eens maakt, en een administratie van gebruikte bewijzen over meerdere serverinstanties zou complexiteit toevoegen zonder iets af te schermen. DEPLOY.md beschrijft het wel zoals de code werkt.

Verder valt op:

- De HQ-route kan ook een uitstap-adres teruggeven (met organisatie leeg), maar geen enkele knop in HQ gebruikt dat.
- Op de pagina Roadmap staat een hint "Let op: je bent ingestapt in een klantomgeving. Stap uit (Klanten → Stap uit) ...". Die verschijnt nooit: hij leunt op een veld "current" dat de klantenroute niet meer teruggeeft, en HQ kan de cookie op het klantdomein ook niet zien. "Klanten → Stap uit" bestaat in HQ evenmin.
- Het blok "Superuser" met "Stap uit" op /instellingen in de klantapp staat er voor elke superuser, ook als hij niet is ingestapt.
- In nuxt.config.ts staat dat HQ_BASE_URL de HQ-link in de zijbalk van de klantapp voedt; in werkelijkheid gebruiken alleen /impersonatie en /instellingen dat adres.

### De motor voor alle organisaties

Een geplande Netlify-functie (motor-schedule) draait elk uur. Alleen op de HQ-site doet hij iets: op een andere uitrol schrijft hij een regel in de log en stopt. Hij heeft het eigen site-adres en MOTOR_SECRET nodig en roept met een POST /api/motor/run-all aan, met het geheim in de header x-motor-secret. Hij logt de status en de eerste 500 tekens van het antwoord.

Het endpoint zelf:

- Zonder ingesteld geheim: 503 met "Motor-scheduler niet geconfigureerd (MOTOR_SECRET ontbreekt)." Een open endpoint dat databasewerk doet, bestaat dus nooit.
- Met een verkeerd geheim: 403 "Ongeldig motor-secret.".
- Zonder database: een antwoord met "Geen database.".
- Anders haalt het alle organisatie-id's op via list_organisation_ids(), de cross-tenant functie die alleen de HQ-rol heeft. Daarom woont dit endpoint op HQ: stond het in de klantbuild, dan zou de klantrol die functie houden en leverde de rolsplitsing niets op.
- Per organisatie draait eerst de regelmotor en daarna de belblokvuller, die nieuwe beltaken in de blokken van vandaag zet. Elke stap vangt zijn eigen fout op. Sinds 14 september 2026 sleept een fout in één organisatie de rest niet meer mee; de vuller draait ook als de motor voor die organisatie stukliep.
- Het antwoord bevat het aantal organisaties, de fouten vooraan (organisatie, stap, melding), en per organisatie de tellingen: gecontroleerde regels, gematchte accounts, nieuwe en bijgewerkte inzichten, nieuwe taken, overgeslagen door het ritme, de AI-tellingen (beoordeeld, niet relevant, fouten, overgeslagen door het pakket, geblokkeerd door het maandplafond) en voorbereide of overgeslagen concepten. Voor de belblokken: bekeken gebruikers, gevulde blokken en ingeplande gesprekken.

HQ heeft geen knop om deze run met de hand te starten en geen scherm met het antwoord. Wat de founder ziet, is indirect: in de klantflyout "Laatste motorrun" (het laatste moment uit de tabel rule_runs) en het gezondheidsoordeel, dat meeweegt of de motor bij die klant draait. In de mock antwoordt het endpoint met 503, omdat er geen geheim is gezet.

### Verschillen tussen de mock en productie

- De mock heeft geen Supabase: de inlogpagina toont de demokiezer, "Inloggegevens kwijt?" en SSO ontbreken, en herstel verstuurt niets.
- Er is geen database: Klanten toont "Geen database actief op deze omgeving, dus geen klanten te tonen.", organisaties aanmaken geeft 503, er worden geen auditregels geschreven en het badge op Klanten blijft weg.
- De mock wijst voor instappen naar de klantapp-mock op poort 3097 en heeft een lokaal geheim. Omdat browsers cookies per hostnaam en niet per poort scheiden, delen localhost:3096 en localhost:3097 hun cookies. Het "twee keer inloggen" van productie is lokaal dus niet te zien.

## Gegevens

Deze feature heeft geen eigen tabel. Wat er wordt bewaard en verstuurd:

| Wat | Waar | Inhoud |
|---|---|---|
| Toegangscookie (dd_access_token) | browser, httpOnly | Supabase-token, geldig zolang Supabase opgeeft |
| Verversingscookie (dd_refresh_token) | browser, httpOnly | 30 dagen geldig |
| Democookie (dealdrive_session) | browser, alleen mock | id van de demogebruiker, 30 dagen |
| Instapcookie (dd_impersonate_org) | browser op klantdomein | id van de organisatie, 8 uur |
| Overdrachtsbewijs | queryparameter, 2 minuten | superuser, organisatie, uitgiftemoment, uniek nummer, handtekening |

De sessie op de server bevat het id van de gebruiker (userId), de organisatie waarin hij werkt (organisationId), de organisatie waar zijn eigen gebruikersrij staat (eigenOrganisationId, alleen anders bij een ingestapte superuser), de rol (role) en de naam (name). Het endpoint /api/auth/me geeft daarbovenop de modus (authMode: supabase of mock), de organisatienaam, de werkplek, de werkwijze en de stand van de feature-vlaggen terug, altijd zonder browsercache.

Inlogaccounts staan in Supabase Auth; de koppeling met de DealDrive-gebruiker loopt via de functies lookup_app_user en link_app_user, die op id zoeken en bij een eerste login op e-mailadres terugvallen en dan koppelen. Of iemand gearchiveerd is, komt uit het gebruikersbeheer van de klantflyout op de pagina Klanten.

Auditregels gaan naar audit_events in de betrokken organisatie, met de organisatie, de handelende gebruiker (actorId), de handeling (action: superuser-impersonate-uitgegeven, -start of -stop), het type "organisation", het id van de organisatie en extra gegevens (de naam van de superuser en "via").

Configuratie per site (alleen de namen; de waarden staan in Netlify en horen nergens anders): DEALDRIVE_APP, DB_URL (met de rol van die site), DB_URL_HQ (lokaal en in tests), APP_BASE_URL, HQ_BASE_URL, IMPERSONATIE_SECRET (gelijk op beide sites), MOTOR_SECRET (alleen HQ), SUPABASE_URL en de publieke Supabase-sleutel, en NUXT_PUBLIC_SSO_PROVIDERS. De motorrun leest en schrijft de gewone motortabellen (onder meer rule_runs, inzichten, taken en belblokken) in elke organisatie.

## Wat dit betekent voor Dealtrace

- **Overnemen zoals het is:** één codebasis met een bouwvlag waarvan de veilige standaard de klantapp is, een toegestane lijst van serverroutes op de console met 404 in plaats van 403, en een controle in de bouwstraat die faalt als een scherm een endpoint aanroept dat in zijn build niet bestaat. Voor Dealtrace, met verrijkings- en agentendpoints die geld kosten, is "bestaat niet" sterker dan "mag niet".
- **Overnemen, met eigen functies:** een aparte databaserol voor de console met een paar security-definer-functies voor het overzicht over klanten, en de twee-fasen-intrekking. Voeg voor Dealtrace functies toe die het verbruik per klant optellen (agentkosten, verrijkingscredits, LinkedIn-acties) zonder de klantdata zelf te openen.
- **Instappen sterker maken:** het principe "bewijs zonder eigen sessie is waardeloos" is goed. Voeg toe: een verplichte reden of ticketnummer bij elke instap, een zichtbare balk in de klantapp zolang je ingestapt bent, de organisatienaam in plaats van het id, een uitstapknop in de console, en een melding aan de beheerder van de klant. Bij een new business-tool kijk je mee in prospectdata van mensen die nog geen klant zijn; onder de AVG wil je per instap kunnen verantwoorden waarom je die persoonsgegevens inzag.
- **De motor per klant zichtbaar maken:** het isoleren van fouten per organisatie is goed. Wat ontbreekt, is een scherm in de console met de laatste runs, fouten per klant en een knop om één klant opnieuw te draaien. Voor Dealtrace hoort daar per run bij wat het kostte aan agents en dataverrijking, hoeveel LinkedIn-acties er per gebruiker zijn verbruikt ten opzichte van de limiet, en een stopkraan als een klant zijn maandbudget raakt.
- **Schaal:** run-all loopt alle organisaties na elkaar af binnen één aanroep. Voor Dealtrace, met trage externe verrijking, is een wachtrij per organisatie met eigen tijdslimiet verstandiger dan één lange lus.
- **Inloggen voor de console:** Dealtrace zou voor de founder-rol tweestapsverificatie moeten afdwingen; DealDrive heeft dat niet. Kies bewust of de console SSO heeft; zo ja, neem de terugkeerpagina op in de console-build (DealDrive mist die), zo nee, verberg de knoppen daar. Geef de inlogpagina van de console een eigen merk en tekst, zodat niemand hem voor de verkoopapp aanziet.
- **Schil:** de vier groepen en de ingeklapte icoonstrook werken goed. Voor Dealtrace ligt een extra groep "Data" voor de hand (bronnen, herkomst van verrijkte gegevens, verwerkersovereenkomsten, verwijderverzoeken) en een groep "Kosten" naast "Geld". Onthoud de ingeklapte stand per gebruiker en laat het badge ook zonder bezoek aan de klantenpagina tellen.
- **Ontbreekt in beide:** een rol tussen founder en niets, bijvoorbeeld een supportmedewerker die mag instappen maar geen abonnementen of prompts mag wijzigen, en een overzicht van actieve sessies van de console met de mogelijkheid ze in te trekken.
