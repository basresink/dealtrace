# Abonnementen

## Wat het is en waarvoor

Abonnementen is de plek in DealDrive HQ waar de founder per klantorganisatie het pakket kiest: "Starter", "Plus" of "Compleet". Het pakket is de commerciële knop van het product. Het bepaalt welke AI-functies een klant krijgt, en de server dwingt dat af: niet alleen de knoppen in de klantapp verdwijnen, ook de motor en de agent weigeren werk dat niet in het pakket zit.

De pagina beantwoordt drie vragen tegelijk. Welk pakket heeft elke klant en wat levert dat volgens de contracten per maand op? Welke functies zitten in welk pakket? En wat heeft één bepaalde klant werkelijk aan staan, als je pakket en losse functievlaggen bij elkaar optelt? Die laatste vraag is de belangrijkste in de praktijk: als een klant belt dat hij een functie niet ziet, zie je hier of de vlag uit staat of dat het pakket te laag is. Dat verschil bepaalt of je een vlag omzet of een upgrade verkoopt.

Abonnementen is geen facturatiescherm. Er bestaat geen prijslijst in de code, er is geen betaalkoppeling en er wordt niets geïncasseerd. Het maandbedrag dat je hier ziet, is het bedrag dat de founder met de hand in het contract van een klant heeft gezet. Het commentaar in de code zegt het letterlijk: er bestaat nog geen pakketprijs in code, dus een bedrag "gebruikers maal pakketprijs" staat hier bewust niet.

Samenhang met de rest van HQ en de klantapp:

- De pagina leest dezelfde klantenlijst als het scherm "Klanten" (het endpoint GET /api/superuser/organisations). Pakket, contract, gebruikersaantal en vlaggen komen daar vandaan.
- De pagina schrijft maar één ding: het pakket (veld pakket op de organisatie). Het contract (status, prijs, startdatum, looptijd, opzegtermijn) zet je in de klantflyout op "Klanten", blok "Contract en abonnement". De losse functievlaggen zet je ook daar, in het blok "Features".
- In de klantapp leest de server het pakket af op het moment dat de motor draait, de agent een concept maakt of Dex wordt aangeroepen. De klant ziet het pakket nergens als instelling die hij zelf kan wijzigen.
- Het pakket bepaalt ook de standaard AI-bundel van een klant (het maandelijkse aantal AI-handelingen), die in de klantflyout bij "AI-kosten" en bij de klant op /instellingen/verbruik staat.
- Het scherm "Facturen" verwijst terug naar deze pagina zolang er geen betaalkoppeling is.

![Abonnementen met vijf fictieve klanten: meetlat per pakket en de tabel Welk abonnement?](shots/abonnementen-4-gevuld.png)

## Waar je het vindt

In de linker zijbalk van HQ staat het menu in vier groepen: "Portfolio", "Geld", "AI" en "Bouwen". Abonnementen staat onder "Geld", als eerste van twee items ("Abonnementen" en "Facturen"), met een creditcard-icoon. De route is /admin/abonnementen en de paginatitel in het tabblad is "Abonnementen · DealDrive HQ".

Wie het ziet: alleen de rol superuser (in HQ heet die persoon de founder; onderaan de zijbalk staat "Bas Resink" met "FOUNDER"). De routebewaker van de app stuurt iedereen zonder superuser-rol weg van alles onder /admin, en elk endpoint dat de pagina gebruikt controleert de rol zelf nog eens en geeft anders 403 "Alleen voor superusers.".

HQ is een aparte uitrol uit dezelfde code (DEALDRIVE_APP=hq, op een eigen domein). In die uitrol bestaan alleen de pagina's onder /admin plus /login en /wachtwoord-instellen, en een middleware laat alleen een vaste lijst API-paden toe (onder meer /api/superuser, /api/auth en /api/settings). Omgekeerd bestaan de /api/superuser-endpoints niet in de klantapp: daar geeft de middleware een 404, met opzet geen 403, zodat het klantdomein niet eens verraadt dat ze bestaan. HQ verbindt met de database als een eigen databaserol (dealdrive_hq), de klantapp als dealdrive_app.

Hoe je er vanuit andere schermen komt:

- Vanuit de klantflyout op "Klanten": in het blok "Contract en abonnement" staat het pakket als leesveld met de tekst "Het pakket bepaal je op de abonnementenpagina; hier zie je dezelfde waarde staan." en de link "Wijzig op Abonnementen".
- Vanuit "Facturen": in de lege staat staat de link "Abonnementen".
- Op de pagina zelf linkt "Klanten" (in de legenda en de slotnoot) terug naar /admin.

![De zijbalk van HQ met de groep Geld](shots/facturen-4-menu-geld.png)

## Opbouw van de pagina

### Kop

Bovenaan staat de kicker "DEALDRIVE HQ · GELD · ABONNEMENTEN" met een geel streepje ervoor, dan de titel "Pakketten per klant." en de subtitel "Welk abonnement elke klant heeft, wat dat volgens de contracten oplevert, en welke functies er los van het pakket aan staan. De server dwingt het pakket af, niet alleen de knoppen." Er zijn geen knoppen rechtsboven.

### Meetlat (statkaarten)

Onder de subtitel staat een strook van vier tegels, maar alleen als er minstens één klant is. In de mock zonder klanten ontbreekt hij dus helemaal.

| Tegel | Groot getal | Onderschrift |
|---|---|---|
| "STARTER" | aantal klanten op Starter | gebruikers en maandbedrag van die klanten |
| "PLUS" | aantal klanten op Plus | idem |
| "COMPLEET" | aantal klanten op Compleet | idem |
| "MAANDOMZET" | som van alle actieve contracten | "uit 2 actieve contracten" |

Het onderschrift van een pakkettegel rekent zo: zijn er geen klanten op dat pakket, dan "geen klanten". Anders het aantal gebruikers ("3 gebruikers", bij één "1 gebruiker") gevolgd door het maandbedrag ("· € 720 per maand") of, als geen van die klanten een actief contract heeft, "· geen actief contract". De tegel "MAANDOMZET" toont "geen actieve contracten" of "uit 1 actief contract" of "uit n actieve contracten". Bedragen staan in hele euro's zonder centen.

### Blok "Welk abonnement?"

Een wit blok met rechts in de kop de grijze tekst "een wijziging gaat per direct in". Daaronder een tabel met één rij per klant, op naam gesorteerd (de server sorteert alfabetisch).

| Kolom | Wat erin staat | Bron |
|---|---|---|
| "KLANT" | naam van de organisatie, vet | organisatierij |
| "PAKKET" | keuzelijst Starter, Plus, Compleet | veld pakket |
| "GEBRUIKERS" | aantal gebruikersrijen | telling in de database |
| "PER MAAND" | contractprijs in euro's | contract, alleen bij status Actief |
| "SINDS" | startdatum, bijvoorbeeld "1 nov 2025" | contract |

Daarnaast nog twee kolommen. "CONTRACT" toont een label: "Pilot" (grijs), "Actief" (groen) of "Opgezegd" (rood). "LOSSE VLAGGEN" toont een label per functievlag die voor deze klant expliciet aan is gezet. Een groen label betekent dat de vlag aan staat en werkt. Een oranje label betekent dat de vlag aan staat maar door het pakket wordt tegengehouden; de tooltip zegt dan "Staat aan, maar blijft uit zolang het pakket onder Plus zit." (of "Compleet"). Bij een groen label is de tooltip de uitleg van de vlag uit de functiecatalogus. Staat er geen enkele vlag expliciet aan, dan staat er een grijs label "geen". Vlaggen die alleen hun standaard volgen, tellen hier niet mee: de code noemt dat bewust "geen nieuws".

Waar een waarde ontbreekt (geen actief contract, geen startdatum) toont de cel een streepje. Onderaan staat de somrij "Samen" met het totaal aan gebruikers en het totaal aan maandbedragen van actieve contracten.

De kolom "GEBRUIKERS" telt alle gebruikersrijen van de organisatie, ook gebruikers die nooit hebben ingelogd. Het scherm "Klanten" toont hetzelfde getal als "11/12" (met login van totaal); Abonnementen toont alleen het totaal.

### Lege en foutstaten

Het blok kent drie standen die elk iets anders betekenen, en de code houdt ze bewust uit elkaar:

- Ophalen mislukt (server antwoordt niet, 403, 500): een rode strook boven de tabel met vetgedrukt "De klantenlijst kon niet geladen worden." gevolgd door de foutmelding van de server en de knop "Opnieuw proberen".
- Geen database op deze omgeving: één rij "Geen database op deze omgeving, dus geen klanten te tonen.". Dit is wat je in de mock ziet.
- Database aanwezig maar nul klanten: één rij "Nog geen klanten.".

![De pagina in de mock: geen database, dus geen klanten en geen meetlat](shots/abonnementen-1-pagina-mock-leeg.png)

### Blok "Welke inhoud?"

Het tweede blok is een matrix van alle functies tegen de drie pakketten. In de kop staat naast de titel een keuzelijst "Vergelijk met klant" met als lege stand "Kies een klant" en daarna alle klanten alfabetisch, elk met het pakket erachter, bijvoorbeeld "Proefklant Bouwmaterialen BV (Starter)". Zonder klanten is de keuzelijst uitgeschakeld met de tooltip "Nog geen klanten om mee te vergelijken.". Rechts in de kop staat "22 functies · de poort zit in de code, niet in de prijslijst".

Onder de kop staat een legenda met drie labels: "ja" (groen) "zit erin, niets aan te zetten", "losse vlag" (oranje) "per klant aan of uit, op Klanten", en "nee" (grijs) "dit pakket is te laag".

De matrix heeft de kolommen "FUNCTIE", "STARTER", "PLUS" en "COMPLEET". Elke functieregel heeft een vette naam en een grijze regel eronder. De regels staan in negen groepen, elk met een grijze groepskop:

- "DE KERN: IN ELK PAKKET" (onderschrift "geen poort, geen vlag"): vijf regels die overal "ja" zijn: "CRM, pipeline, agenda en taken", "Deterministische motor en customer journey", "Agendakoppeling Google en Microsoft 365", "Offline doorwerken" en "Keuze van AI-aanbieder en model".
- "WAT HET PAKKET BESLIST" (onderschrift "afgedwongen door de server"): de drie echte pakketpoorten, zie de tabel hieronder.
- Zeven groepen met losse vlaggen, elk met onderschrift "losse vlag per klant": "DAGRITME", "PROSPECTIE", "ACCOUNTS & CAMPAGNES", "COMMUNICATIE", "DATA", "RAPPORTAGE" en "DEX". De regels komen rechtstreeks uit de functiecatalogus in de code en kunnen dus niet uit de pas lopen.

| Pakketpoort | Starter | Plus | Compleet |
|---|---|---|---|
| "AI-kansanalyse op eigen CRM-data" | nee | ja | ja |
| "AI-agent bereidt taken voor" | nee | ja | ja |
| "Webonderzoek: vacatures en nieuws" | nee | nee | ja |

Bij een vlagregel staat onder de naam "Staat standaard aan bij een nieuwe klant." of "Staat standaard uit; per klant aan te zetten.". De cel is "losse vlag" in elk pakket, behalve onder de pakket-ondergrens van die vlag: daar is de cel "nee". Elke regel heeft een tooltip die zegt waar het gedrag in de code zit.

![De matrix Welke inhoud? met de kern en de drie pakketpoorten](shots/abonnementen-2-matrix-welke-inhoud.png)

![Het tweede deel van de matrix met de losse vlaggen en de slotnoot](shots/abonnementen-3-matrix-vlaggen.png)

### De klantkolom

Kies je een klant in "Vergelijk met klant", dan veranderen er vier dingen. De pakketkolom van die klant krijgt een lichte achtergrond. Rechts verschijnt een vijfde kolom met de klantnaam en eronder "werkelijke stand". Onder de legenda komt een tweede regel: "In de klantkolom staat de wérkelijke stand: aan · uit de vlag staat uit · pakket te laag de vlag staat aan maar wordt tegengehouden". En de tekst rechts in de kop wordt een telling, bijvoorbeeld "13 van de 22 staan aan · 1 tegengehouden door het pakket".

De klantkolom kent drie labels: "aan" (groen), "uit" (grijs) en "pakket te laag" (oranje). De tooltip per cel legt uit waarom: "Zit in elk pakket.", "Zit in Plus.", "Zit niet in Starter; hiervoor is een hoger pakket nodig.", "Vlag aan (expliciet gezet voor deze klant)." of "Vlag uit (volgt de standaard).".

![Vergelijk met klant: de fictieve klant Proefklant Bouwmaterialen BV op Starter naast de pakketkolommen](shots/abonnementen-5-vergelijk-met-klant.png)

![Onderaan de matrix: de Dex-vlag staat aan bij een Starter-klant en krijgt het label pakket te laag](shots/abonnementen-6-pakket-te-laag.png)

### Slotnoot

Onder de matrix staat een kader met een gele rand links: "Pakket en vlag zijn twee assen, en die horen naast elkaar." gevolgd door uitleg dat het pakket zegt wat een klant commercieel heeft en dat een vlag een functie los daarvan aanzet, bijvoorbeeld om met één klant te testen. De laatste zin wordt uit de catalogus berekend en luidt nu: "Wat opvalt zodra je de hele lijst ziet: 2 vlaggen dragen een pakket-ondergrens (Lead generator, Dex: sales-assistent); de rest is puur een schakelaar, dus commercieel verschillen de pakketten verder alleen op de drie AI-poorten hierboven."

## Doorklikken: de stappen

### Het pakket van een klant wijzigen

1. Klik in de zijbalk op "Abonnementen". De pagina haalt de klantenlijst op en vult de tabel "Welk abonnement?".
2. Zoek de rij van de klant en open de keuzelijst in de kolom "PAKKET".
3. Kies het nieuwe pakket. Er komt geen bevestigingsvraag: de wijziging gaat direct naar de server (PUT /api/superuser/organisations/{id} met alleen het pakket).
4. Gaat het goed, dan verschijnt rechtsonder een groene melding "Pakket van {klantnaam} gewijzigd naar {pakket}." die na vier seconden verdwijnt. Gaat het mis, dan een rode melding met de foutmelding van de server, of anders "Pakket van {klantnaam} wijzigen mislukte."; die blijft zes seconden staan.
5. In beide gevallen laadt de pagina de lijst opnieuw. Bij een fout springt de keuzelijst terug naar het oude pakket. De melding is er juist voor dat dat terugspringen niet als "gelukt" wordt gelezen.
6. De nieuwe stand werkt direct: de server leest het pakket bij elke motorrun en bij elke agent- of Dex-aanroep vers uit de database. De klant hoeft niet opnieuw in te loggen. De meetlat, de somrij en de klantkolom in de matrix rekenen na het herladen mee.

![Pakket wijzigen in de mock: de server antwoordt dat organisatiebeheer zonder database niet beschikbaar is](shots/abonnementen-7-pakket-wijzigen-melding.png)

### Zien wat één klant werkelijk heeft

1. Scrol naar "Welke inhoud?".
2. Kies de klant in "Vergelijk met klant".
3. Lees de klantkolom: "aan", "uit" of "pakket te laag". De telling rechts in de kop vat het samen.
4. Staat er "pakket te laag", dan staat de vlag aan maar is het pakket te laag: verhoog het pakket in de tabel erboven. Staat er "uit" bij een vlagregel, dan zet je de vlag aan in de klantflyout op "Klanten".
5. Kies "Kies een klant" om de klantkolom weer te verbergen.

### Contract en maandbedrag vastleggen (op Klanten)

1. Ga naar "Klanten" en klik in de rij van de klant op "Openen". Er schuift een brede flyout open.
2. In het blok "Contract en abonnement" staat het pakket als grijs leesveld "Type abonnement" met de link "Wijzig op Abonnementen".
3. Vul "Status", "Prijs per maand (€)", "Startdatum", "Looptijd (mnd)", "Opzegtermijn" en eventueel "Notitie" in en klik op "Contract opslaan".
4. Terug op Abonnementen staan "PER MAAND", "SINDS", "CONTRACT" en de meetlat bijgewerkt. Een bedrag telt pas mee als de status "Actief" is.

![Het blok Contract en abonnement in de klantflyout, met het pakket als leesveld](shots/abonnementen-8-klantflyout-contract.png)

### Een functie voor één klant aanzetten

1. Op Abonnementen zie je in "LOSSE VLAGGEN" welke vlaggen al expliciet aan staan.
2. Aanzetten doe je op "Klanten": klik "Openen", ga naar het blok "Features" en zet de schuifknop van de functie om.
3. Draagt de functie een pakket-ondergrens (Lead generator vanaf Compleet, Dex vanaf Plus) en zit de klant daaronder, dan toont de flyout bij die vlag "pakket te laag" en blijft de functie uit tot je op Abonnementen het pakket verhoogt.

## Flyouts, vensters en knoppen

De pagina Abonnementen heeft zelf geen flyouts, vensters of bevestigingsvragen. De bedieningselementen zijn:

- De keuzelijst per klant in de kolom "PAKKET" (opties "Starter", "Plus", "Compleet"). Wijzigen slaat direct op, zonder bevestiging en zonder knop "Opslaan". Toegankelijke naam: "Pakket van {klantnaam}".
- De keuzelijst "Vergelijk met klant": puur weergave, schrijft niets.
- De knop "Opnieuw proberen" in de rode foutstrook: haalt de lijst opnieuw op.
- De links "Klanten" in de legenda en de slotnoot.
- Meldingen (rechtsonder, met een sluitkruisje): groen bij succes (vier seconden), rood bij fout (zes seconden). Op de schermafbeelding van de mock staat de rode melding "Zonder database is organisatiebeheer niet beschikbaar.".

Escape en sluiten zijn hier niet van toepassing. Het enige formulier dat bij deze feature hoort, het contractformulier, zit in de klantflyout op "Klanten" en staat hieronder beschreven omdat de getallen op Abonnementen eruit komen.

### Het blok "Contract en abonnement" in de klantflyout

| Veld | Soort | Standaard en validatie |
|---|---|---|
| "Type abonnement" | leesveld | het pakket, niet te wijzigen |
| "Status" | keuzelijst | "Pilot", "Actief", "Opgezegd"; ongeldig wordt Pilot |
| "Prijs per maand (€)" | getal, hele euro's | leeg mag; 0 tot € 100.000 |
| "Startdatum" | datum | leeg mag; formaat jjjj-mm-dd |
| "Looptijd (mnd)" | getal | leeg mag; 0 tot 120, placeholder 12 |

Verder "Opzegtermijn" (keuzelijst "Niet vastgelegd", "1 maand", "2 maanden", "3 maanden"; een afwijkende opgeslagen waarde zoals 6 komt er als extra optie bij, zodat opslaan hem niet wegpoetst; de server accepteert 0 tot 24) en "Notitie" (tekst, optioneel, maximaal 500 tekens, placeholder "Optioneel, bv. jaarcontract met korting").

Onder de velden rekent de flyout: "Loopt tot 1 nov 2026 · opzeggen vóór 1 okt 2026" met een geel label "OPZEGTERMIJN LOOPT" als je in het opzegvenster zit, of "verlopen" als de einddatum voorbij is. Zonder startdatum of looptijd staat er "Vul startdatum en looptijd om einddatum en opzegmoment te berekenen.". De knop "Contract opslaan" toont tijdens het opslaan "Bezig…", daarna drie seconden "Opgeslagen" of een rode foutregel ("Opslaan mislukt." als de server geen tekst geeft).

## Filters, zoeken, sorteren en weergaven

Abonnementen heeft geen filters, geen zoekveld en geen sorteerknoppen. De tabel staat altijd alfabetisch op klantnaam (de server sorteert zo). De enige weergavekeuze is "Vergelijk met klant", die een kolom toevoegt aan de matrix maar niets filtert. Niets van de pagina komt in de URL: wie de pagina herlaadt, ziet de klantkolom weer verborgen.

Tellers: de meetlat telt per pakket het aantal klanten, de som van hun gebruikers en de som van hun actieve contractbedragen. De telling bij "Vergelijk met klant" telt over alle 22 matrixregels hoeveel er "aan" staan en hoeveel "pakket te laag"; "uit" is het verschil.

Het scherm "Klanten" heeft wel een zoekveld ("Zoek op naam of pakket") dat ook op pakketlabel filtert. Wie alle Plus-klanten wil zien, typt daar "Plus".

## Regels en berekeningen

### De drie pakketten

De pakketten zijn vastgelegd in de code (PAKKETTEN in server/utils/pakketten.ts), niet in de database en niet in een prijslijst:

| Pakket | aiInzichten | agentConcepten | webBronnen |
|---|---|---|---|
| Starter | nee | nee | nee |
| Plus | ja | ja | nee |
| Compleet | ja | ja | ja |

Omschrijvingen in de code: Starter is "De kern: CRM, pipeline, agenda en de deterministische motor", Plus is "Starter + AI: wekelijkse AI-kansanalyse op je CRM-data en de agent die taken voorbereidt", Compleet is "100% toegang: alles uit Plus + externe webbronnen (vacatures en nieuws, automatisch met bewijs)".

### Hoe de server het pakket afdwingt

- De motor (server/utils/ruleEngine.ts) haalt per run het pakket op. Zonder aiInzichten worden alle AI-regels overgeslagen en geteld als aiSkippedByPakket. Met aiInzichten maar zonder webBronnen vallen alleen de webregels (vacatures, nieuws) weg. De deterministische regels draaien altijd.
- De agent (POST /api/agent/prepare, prepare-deal en prepare-afspraak) geeft zonder agentConcepten een 403: "De AI-agent zit niet in het pakket van deze organisatie (upgrade naar Plus of Compleet).". Ook het automatisch voorbereiden van taken na een motorrun slaat over zonder dat recht.
- Dex (alle /api/dex-endpoints) controleert de vlag dexAssistent, en die vlag valt onder Plus altijd uit, ook als hij aan staat.
- Zonder geldig pakket op de organisatie geldt Starter: "commercieel de veilige kant: features geef je bewust, niet per ongeluk".

### Pakket en vlag: de effectieve stand

Een functievlag heeft drie lagen, die de server in deze volgorde combineert (resolveOrgFeatures in server/utils/featureFlags.ts):

1. De standaard uit de catalogus (shared/features.ts): aan of uit voor een nieuwe klant.
2. De override per klant (veld features op de organisatie), alleen door HQ te schrijven.
3. De pakket-ondergrens: staat de vlag aan maar zit de klant onder het minimumpakket, dan is de functie toch uit.

Kan de server de organisatie niet lezen, dan valt hij terug op de standaard: "een gemiste flag is een ongemak; een dichtgeslagen app is een storing". De klantapp krijgt de effectieve stand mee via /api/auth/me en verbergt daarmee menu-items en routes; de echte poort zit op de server-endpoints.

De veertien vlaggen in de catalogus, met standaard en ondergrens:

| Vlag (label) | Groep | Standaard | Ondergrens |
|---|---|---|---|
| Bezoeken, Meetings, Belblokken, Briefings | Dagritme | aan | geen |
| Startplannen | Dagritme | uit | geen |
| Prospectplanning | Prospectie | uit | geen |
| Lead generator | Accounts & campagnes | uit | Compleet |
| Accountplannen, Campagnes | Accounts & campagnes | uit | geen |
| Inbox | Communicatie | aan | geen |
| Import & dataverrijking | Data | aan | geen |
| Team-rapportage | Rapportage | aan | geen |
| Evaluaties | Rapportage | uit | geen |
| Dex: sales-assistent | Dex | uit | Plus |

### Omzet en contract

- Maandomzet telt alleen contracten met status "Actief". Een pilot of een opgezegd contract levert nul op, ook als er een prijs in staat. Dezelfde regel staat op de server (maandOmzetCent) en op het scherm "Klanten" ("uit actieve contracten").
- Bedragen staan in centen in de database (prijsPerMaandCent) en worden in hele euro's getoond.
- Einddatum is startdatum plus looptijd in maanden. Uiterste opzegdatum is einddatum min opzegtermijn (zonder opzegtermijn: de einddatum zelf). Een klant zit in het opzegvenster als vandaag op of na de opzegdatum ligt en de einddatum nog niet voorbij is. Zonder startdatum of looptijd wordt er niets berekend.
- Op "Klanten" levert een contract in het opzegvenster een signaal op ("Contract van {klant} zit in de opzegtermijn") dat meetelt in het gele getal achter "Klanten" in de zijbalk (het aantal aandachtsignalen). Abonnementen zelf toont het opzegvenster niet.

### Wat er niet is

- Geen seats of gebruikerslimiet. Het aantal gebruikers is informatie; er is geen maximum per pakket en het bedrag wordt niet per gebruiker berekend.
- Geen prijs per pakket in de code. In het handboek staat een voorstel van € 50, € 90 en € 150 per gebruiker per maand voor Starter, Plus en Compleet, nadrukkelijk als "richtbedragen als voorstel, geen vastgestelde tarieven".
- Geen proefperiode, geen automatische afwaardering, geen geschiedenis van pakketwijzigingen.
- Geen auditregel bij een pakket- of contractwijziging. Het endpoint schrijft de organisatierij bij en zet updatedAt, maar legt niet vast wie wat van welk naar welk pakket zette. (Een werkplekwijziging van een gebruiker wordt in HQ wel geaudit.)
- Geen koppeling met Stripe, Mollie of Moneybird. Er staat geen regel betaalcode in de repository; de roadmap noemt de Stripe/Mollie-koppeling als openstaand werk dat "de admin-tabs Abonnementen en Facturen tot leven" brengt.

### Rechten en scheiding

- Alleen superuser mag lezen en schrijven; elk endpoint controleert dat zelf.
- Pakket en vlaggen staan bewust op de organisatierij en niet in de klantinstellingen (org_settings), want die zijn door de beheerder van de klant zelf te schrijven, "en niemand geeft zichzelf een upgrade".
- De AI-bundel van een klant staat wel in org_settings (sleutel aiBundel), maar die sleutel staat niet op de lijst die de klant via /api/settings mag schrijven. Alleen HQ zet hem, via PUT /api/superuser/organisations/{id}/bundel.

### Het pakket en de AI-bundel

Elke klant heeft een maandelijkse AI-bundel in handelingen, niet in tokens. Zonder eigen bundel geldt de standaard van het pakket:

| Soort handeling | Starter | Plus | Compleet |
|---|---|---|---|
| Accountbeoordelingen door de motor | 0 | 8.000 | 8.000 |
| Webonderzoek (vacatures, nieuws) | 0 | 0 | 3.000 |
| Pitstop-concepten | 0 | 1.500 | 1.500 |
| Vragen aan de assistent | 0 | 2.000 | 2.000 |

Verder per maand bij Plus en Compleet: 100 Dex-gespreksvoorbereidingen, 200 Dex-opvolgmails en 300 geanalyseerde gespreksverslagen. Het maandplafond (de rem) staat standaard uit en pauzeert alleen het automatische werk van de motor. Wijzig je op Abonnementen het pakket, dan verandert de standaardbundel mee voor een klant zonder eigen bundel. De code waarschuwt dat deze getallen een eerste schatting zijn en geen meting.

### Mock tegenover productie

- In de mock (geen database) geeft de klantenlijst een lege lijst met totalen null terug. De pagina toont "Geen database op deze omgeving, dus geen klanten te tonen.", de meetlat ontbreekt en "Vergelijk met klant" is uitgeschakeld. De matrix staat er wel volledig, want die komt uit de code.
- Organisaties aanmaken geeft in de mock 503 "Zonder database is organisaties aanmaken niet mogelijk." en een pakketwijziging 503 "Zonder database is organisatiebeheer niet beschikbaar.". De schermafbeeldingen met gevulde tabellen zijn daarom gemaakt met vijf fictieve klanten die alleen in de browser als antwoord op het ophalen van de klantenlijst zijn ingevoegd; de wijziging naar de server ging wel echt naar de mock en gaf de rode melding.
- Zonder database behandelt de server elke organisatie als Compleet ("lokale dev zonder DB: niets blokkeren") en geeft hij de standaardvlaggen plus wat in DEALDRIVE_FEATURES staat. In de mock wordt dus niets door het pakket tegengehouden.

### Waar scherm en handboek afwijken van de code

- Het handboek noemt Abonnementen "pakket per organisatie + de drie pakket-kaarten". Die kaarten bestaan niet meer op de pagina. De teksten ervoor (omschrijving en een lijstje functies per pakket, zoals "AI-kostenrapportage per regel" en "Eerste toegang tot nieuwe bronnen (KvK, aanbestedingen)") staan nog in app/composables/usePakketten.ts, maar alleen het label wordt gebruikt.
- Het handboek spreekt van "eenentwintig functies in negen groepen" en "één van de dertien" vlaggen. Het scherm toont 22 functies, want er zijn nu veertien vlaggen, waarvan twee met een ondergrens. De groepen kloppen (negen).
- De matrixregel "Keuze van AI-aanbieder en model" staat als "ja" in elk pakket, maar alleen de superuser kan die keuze maken; de klant ziet hem niet.

## Gegevens

Een organisatie is één rij in de tabel organisations. De velden die bij deze feature horen, staan in de JSON-kolom data van die rij:

- Pakket (pakket): "starter", "plus" of "compleet". Ontbreekt het, dan geldt Starter. Bij aanmaken op "Klanten" kies je het pakket al, standaard Starter.
- Functievlaggen (features): een lijst met per vlagnaam aan of uit, alleen voor vlaggen die je expliciet hebt gezet. Onbekende namen of waarden die geen ja of nee zijn worden genegeerd. Bij opslaan worden nieuwe vlaggen samengevoegd met de bestaande, per sleutel.
- Contract (contract): status (status: pilot, actief of opgezegd), startdatum (startDatum, jjjj-mm-dd), looptijd in maanden (looptijdMaanden), prijs per maand in centen (prijsPerMaandCent), opzegtermijn in maanden (opzegtermijnMaanden) en een notitie (notitie). Het contract wordt bij elke opslag als geheel overschreven, zodat een leeggemaakt veld ook echt leeg wordt.
- Naam (name) en contactgegevens (contact) horen bij "Klanten".

Afgeleide gegevens die de server per verzoek uitrekent en niet opslaat:

- Gezondheid (gezondheid): aantal gebruikers, gebruikers met login, accounts, taken en inzichten van de laatste 30 dagen, laatste activiteit en laatste motorrun. Abonnementen gebruikt hiervan alleen het aantal gebruikers.
- Contractberekening (contractAfgeleid): einddatum, uiterste opzegdatum, dagen tot einde en of het opzegvenster loopt.
- Effectieve functiestand: standaard plus override plus ondergrens.

Van andere features komen: de functiecatalogus (shared/features.ts), de pakketdefinitie (server/utils/pakketten.ts), de AI-bundel (org_settings, sleutel aiBundel) en het gebruik uit de klantapp (gebruikers, taken, signalen, motorruns).

## Wat dit betekent voor Dealtrace

- Overnemen: pakket en functievlag als twee aparte assen, met de pakketdefinitie en de vlaggencatalogus in de code en alleen de afwijking per klant in de database. De matrix met een klantkolom "werkelijke stand" en het onderscheid tussen "uit" en "pakket te laag" is direct bruikbaar voor support.
- Overnemen: de server als poortwachter op elk endpoint dat geld kost (AI, web), met Starter als veilige standaard en een duidelijke foutmelding die naar een upgrade wijst.
- Anders doen: voor een new business-tool zijn de dure dingen niet alleen AI-beoordelingen maar vooral dataverrijking (contactgegevens, bedrijfsdata), webonderzoek en eventueel LinkedIn-acties. Leg per pakket een bundel vast in herkenbare handelingen (verrijkte contacten, onderzochte bedrijven, gegenereerde berichten) en toon per klant verbruik tegenover bundel en kostprijs op dezelfde pagina.
- Anders doen: maak een prijs per pakket en per gebruiker een echt gegeven in de code of database, met seats en een gebruikerslimiet. Nu is het maandbedrag een vrij invulveld en kun je niet zien of een klant meer gebruikers heeft dan hij betaalt.
- Toevoegen: een auditregel bij elke pakket-, vlag- en contractwijziging (wie, wanneer, van, naar) en een geschiedenis per klant. Bij een commerciële knop die per direct ingaat zonder bevestiging is dat het minimum.
- Toevoegen: een bevestiging bij afwaarderen ("Deze klant verliest Dex en de lead generator") en een melding wat er met lopende AI-taken gebeurt.
- Toevoegen voor AVG en LinkedIn: per pakket vastleggen welke databronnen een klant mag gebruiken (bijvoorbeeld wel KvK en bedrijfswebsites, geen persoonsgegevens van LinkedIn zonder grondslag), met herkomst per verrijkt record en dagelijkse LinkedIn-limieten per gebruiker die de server afdwingt en HQ laat zien.
- Ontbreekt nog: een proefperiode met einddatum en automatische afwaardering, en een koppeling naar facturatie zodat het pakket en het gefactureerde bedrag uit één bron komen.
