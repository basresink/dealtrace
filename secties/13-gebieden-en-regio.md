# Gebieds- en regio-indeling met de regio-analyse

## Wat het is en waarvoor

De gebiedsindeling verdeelt het werkgebied van een organisatie in regio's. Een regio is een naam plus postcodereeksen en plaatsnamen, en optioneel één vaste weekdag waarop het team in dat gebied is (de regiodag). Accounts wijs je niet los toe: een account valt vanzelf in de regio waar zijn postcode of plaats bij hoort. Verhuist een klant, dan verschuift hij mee.

De regio-analyse is de keerzijde: per regio zie je hoeveel klanten en prospects er liggen, hoeveel open dealwaarde, en hoe lang het geleden is dat er iemand langs was. De vraag in de kop is "Waar laat je omzet liggen?". Het antwoord staat gesorteerd op wat er stil ligt, niet op alfabet.

Voor een accountmanager in de buitendienst betekent dit: hij weet welke dag hij in welk gebied is, en hij ziet per gebied welke accounts al maanden of nooit bezocht zijn. Op de meetingpagina gebruikt de app de regiodag om voor te stellen een account fysiek te bezoeken in plaats van online te spreken. Voor een salesmanager is de analyse over het hele team het overzicht van onbenutte potentie per gebied, met een filter op één teamlid.

Plek in de week: de beheerder tekent de regio's bij de inrichting en daarna zelden. De accountmanager kijkt in de analyse als hij zijn week of een regiodag voorbereidt; de salesmanager in zijn periodieke review.

Samenhang met andere features:

- Leest: accounts (plaats, postcode, land, eigenaar, klant of prospect, klasse, het veld laatste bezoek), afspraken (type, status, starttijd), open deals (bedrag) en de gebiedsindeling zelf.
- Schrijft: alleen de organisatie-instelling met de regio's. De analyse rekent en richt niets in.
- Wordt gelezen door: de bezoekanalyse, de meetinganalyse (blok "Combineer met een regiodag"), de Account analyse voor het team en de voorstellen "Wie is er aan de beurt?" op Meetings.

## Waar je het vindt

### De gebiedsindeling

- Menu: Instellingen, blok "Sub-pagina's", link "Gebiedsindeling & regiodagen →".
- Route: /instellingen/gebieden. Browsertitel "Gebiedsindeling · DealDrive".
- Wie het ziet: iedereen mag meekijken; de pagina staat op de uitzonderingslijst van Instellingen. Alleen beheerder en superuser wijzigen. Voor anderen staat in de actiebalk "Je kunt meekijken. Alleen een beheerder tekent de regio's: dit gaat over het werkgebied van het hele team." De server weigert het opslaan zonder beheerdersrol.
- Geen functievlag.

### De regio-analyse

Het adres /regio-analyse uit de opdracht bestaat niet meer en geeft een 404 (het staat nog wel in de lijst managerroutes van de toegangscontrole). De analyse is één pagina die op drie routes draait; de route bepaalt welke afspraken tellen en over wie het gaat:

| Route | Voor wie | Telt | Ingang |
|---|---|---|---|
| /bezoek-analyse | iedereen, eigen accounts | klantbezoeken | knop "Bezoek-analyse" op Bezoeken |
| /meeting-analyse | iedereen, eigen accounts | online meetings en belafspraken | knop in de kop van Meetings |
| /account-analyse | salesmanager en hoger, team | keuze uit vier matrices | managersmenu "Account analyse" |

- /bezoek-analyse hangt aan de functievlag "bezoeken", /meeting-analyse aan "meetings". /account-analyse vraagt de rol salesmanager, beheerder of superuser; het hele managersmenu hangt bovendien aan de vlag "team-rapportage".
- Elke regio op de gebiedsindeling heeft een link "Bekijk de dekking →" naar /bezoek-analyse met een anker op die regio.
- Een accountmanager krijgt nooit het teambeeld, ook niet door de URL aan te passen: de server negeert dat.

![De lege gebiedsindeling in de demo, met de knoppen voor een voorstel en een nieuwe regio](shots/gebieden-1-leeg.png)

## Opbouw van de pagina

### Gebiedsindeling: kop en actiebalk

- Kruimelpad "← Alle instellingen", kicker "Instellingen · Gebiedsindeling", titel "Je week ligt vast, je route volgt."
- Subtitel: "Een regio is een naam plus postcodereeksen en plaatsen. Accounts wijs je niet los toe: ze vallen vanzelf in de regio waar hun postcode of plaats bij hoort."
- Rechts telpillen: "5 regio's" en, als er accounts buiten elke regio vallen, een oranje pil "N buiten regio".
- Een plakkende actiebalk met links de rechtentekst en rechts de knoppen "↯ Voorstel uit je accounts" (alleen zichtbaar zolang er nog geen regio is) en "+ Regio".

### Overlapwaarschuwing

Alleen zichtbaar bij overlap: "Let op: overlap. Een account hoort bij één regio, dus bij overlap bepaalt de volgorde in de lijst wie hem krijgt. Dat is zelden wat je bedoelt." Daaronder per probleem een regel, bijvoorbeeld "Hilversum" staat zowel bij Randstad Noord als bij Utrecht en Gooi, of postcodes 3400 tot 3449 vallen in Randstad Zuid én Utrecht en Gooi.

### Blok "Je week"

Vijf dagkaarten, maandag tot en met vrijdag ("Koppel je een regio aan een weekdag, dan weet de app dat je die dag in dat gebied bent."). Per kaart:

- De dag en de regio, met daaronder de postcodereeksen of, als die er niet zijn, de plaatsen.
- Vier tellers: "Klanten", "Prospects", "Nooit bezocht" en ">90d niet bezocht" (rood als groter dan 0).
- Een keuzelijst onderaan met "Geen regio" en alle regio's, om de dag direct te koppelen.
- Een dag zonder regio toont "Nog niet ingedeeld" en "Zonder regio blijft deze dag vrij. Bezoektaken vallen terug op de gewone routeplanning."

![De gebiedsindeling met vier regiodagen en een overlapwaarschuwing](shots/gebieden-2-week-en-overlap.png)

### Blok "Regio's"

Uitleg: een regio bestaat uit postcodereeksen (bijvoorbeeld 3701-3799, 3800-3829) en/of plaatsnamen. Per regio een kaart met:

- Kop: naamveld (placeholder "Naam van de regio"), teller "N accounts", keuzelijst vaste bezoekdag ("Geen vaste dag", Maandag tot Vrijdag) en de knop "Verwijderen". Voor wie alleen kijkt staat de dag als pil.
- Veld "Postcodereeksen" met placeholder "3701-3799, 3800-3829" en de hint "Vier cijfers, met een streepje ertussen. Alleen Nederlandse postcodes: België gebruikt dezelfde cijferreeks, dus buitenlandse accounts worden op plaatsnaam ingedeeld."
- Veld "Plaatsen" met placeholder "De Bilt, Bilthoven, Amersfoort" en de hint "Vangnet voor accounts zonder postcode. Postcode gaat altijd voor."
- Voetregel: "N klanten · N prospects", in rood "N nooit bezocht", en de link "Bekijk de dekking →".

Onder de lijst staat "N van M accounts vallen buiten elke regio." met de knop "Bekijk welke →". Die klapt een tabel open met "Account", "Plaats", "Postcode" en "Land" (maximaal 50 rijen, met "Eerste 50 van N getoond."). Daaronder: "Daarvan hebben er N geen postcode. Zolang die ontbreekt kan een account alleen op plaatsnaam worden ingedeeld."

Onderaan het blok "Hoe dit werkt" met de verdeling: de beheerder tekent, iedereen kijkt mee, en een account dat in geen regio valt blijft zichtbaar.

Lege staten:

- "Nog geen regio's." met, als er een voorstel mogelijk is, de verwijzing naar "Voorstel uit je accounts".
- Zonder database of zonder rechten op de accountlijst: "Tellingen niet beschikbaar: zonder database weet DealDrive niet welke accounts in een regio vallen. Regio's inrichten kan wel." De regiokaarten tonen dan "Telling niet beschikbaar". De dagkaarten in "Je week" tonen in die situatie toch overal 0, wat leest als "geen accounts".

![De regiokaarten met postcodereeksen, plaatsen, vaste dag en de link naar de dekking](shots/gebieden-3-regios.png)

### Regio-analyse: kop en knoppen

- Op de eigen routes een kruimelpad terug ("← Terug naar Bezoeken" of "← Terug naar Meetings"), kicker "Rapportage · Bezoek-analyse" en titel "Waar laat je omzet liggen?". Op het teambeeld kicker "Rapportage · Teambeeld", titel "Account analyse" en de gekozen matrix als subkop. Filter je op één teamlid, dan staat zijn naam in de kicker.
- Intro: "Per regio: hoeveel accounts, wat er open staat, en wanneer je er voor het laatst was. De regio's staan gesorteerd op wat er stil ligt, niet op alfabet."
- Rechts drie knoppen: "+ Afspraak" (opent de gewone afspraakflyout), "Filters" (met teller) en "Download".

### Regio-analyse: vier cijfers

1. "Accounts in beeld", met de voetregel "N in een regio · N zonder postcode".
2. "Stil of nooit bezocht" (rood als groter dan 0), voetregel "N nooit · N langer dan 90 dagen".
3. "Open dealwaarde in stille accounts": de som van open deals op accounts die stil liggen of nooit bezocht zijn.
4. "Bezocht in 90 dagen" als percentage, met de vaste voetregel "doel: 80%". Bij een eigen periode heet hij "Laatste bezoek in periode" met de datums eronder.

### Regio-analyse: de dekkingstabel

Kolommen:

- "Regio": naam en daaronder de postcodereeksen of de eerste drie plaatsen.
- "Vaste dag": gele pil met de dag, of grijs "Geen".
- "Klanten" en "Prospects": aantallen accounts in de regio.
- "Open deals": som van open dealwaarde, afgekort als "€ 492k" of "€ 2,1M".
- "Bezoekdekking": een balk in drie kleuren: groen gezien binnen het venster, rood daarbuiten, grijs nooit.
- "Stil / nooit": het aantal; rood vanaf de helft van de regio, oranje vanaf een kwart.
- Knop "Openen".

Onderaan altijd de rij "Zonder regio" ("valt buiten elke postcodereeks en plaatsnaam", in de dekkingskolom "niet toe te wijzen") zodra daar accounts in vallen. Onder de tabel een legenda die het venster volgt ("≤ 90 dagen", "> 90 dagen", "nooit bezocht"). Op de meetingroute heten de labels "Meetingdekking", "Stil of nooit gesproken" en "nooit gesproken".

Lege staten:

- Eigen route zonder accounts op je naam: "Er staan nog geen accounts op jouw naam." met de knop "Naar Klanten →".
- Geen regio's: "Er is nog geen gebiedsindeling." met "Deze pagina rekent, hij richt niets in." en voor een beheerder de knop "Gebiedsindeling instellen →", anders de verwijzing naar de beheerder.
- Tijdens laden: "Bezig met rekenen…".

![De bezoekanalyse met het filterpaneel open, de vier cijfers en de dekking per regio](shots/gebieden-5-bezoek-analyse.png)

## Doorklikken: de stappen

### Regio's tekenen vanaf nul

1. Ga naar Instellingen en klik op "Gebiedsindeling & regiodagen →".
2. Klik op "+ Regio". Onderaan verschijnt een kaart "Nieuwe regio" zonder reeksen en plaatsen.
3. Typ de naam, bijvoorbeeld "Randstad Zuid".
4. Typ in "Postcodereeksen" bijvoorbeeld 2500-2599, 3000-3449. Alleen stukken van precies vier cijfers, een streepje en vier cijfers worden opgepakt; een losse postcode of een onvolledige reeks wordt stil genegeerd.
5. Typ in "Plaatsen" de plaatsnamen, gescheiden door komma's.
6. Kies een vaste dag. De dagkaart in "Je week" vult zich direct. Alles wordt automatisch bewaard.

### Beginnen met een voorstel uit de portefeuille

1. Klik bij een lege indeling op "↯ Voorstel uit je accounts".
2. De app groepeert alle Nederlandse accounts met een postcode per eerste cijfer (1000 tot 1999, 2000 tot 2999, enzovoort) en maakt daar regio's van. De naam is de eerste twee plaatsen in die groep, anders "Gebied 3000".
3. De vijf grootste groepen krijgen maandag tot en met vrijdag als vaste dag, de rest geen dag.
4. Schaaf daarna de reeksen en namen bij. In de demo staat de knop uit: zonder database levert de server geen accountlijst, en de tooltip zegt dan "Niet beschikbaar: de accounts zijn in deze omgeving niet te lezen".

### Een overlap oplossen

1. Lees de regels in de oranje waarschuwing bovenaan.
2. Pas in een van beide regio's de reeks of de plaatsnaam aan.
3. De waarschuwing verdwijnt zodra er geen dubbele plaats of overlappende reeks meer is.

### Een regio verwijderen

1. Klik op "Verwijderen" in de kop van de regiokaart.
2. Het bevestigingsvenster noemt de gevolgen.
3. Klik "Verwijderen" of "Annuleren".

### Zien waar het stil ligt

1. Klik bij een regio op "Bekijk de dekking →", of op Bezoeken op de knop "Bezoek-analyse".
2. Klik op "Filters" en kies een periode of een type bezoek.
3. Klik achter een regio op "Openen". Rechts schuift een paneel in met de accounts van die regio, nooit bezocht bovenaan.
4. Klik op een accountnaam om de klantkaart te openen, of plan via "+ Afspraak" direct een bezoek.

### Het teambeeld per regio bekijken

1. Open in het managersmenu "Account analyse".
2. Klik "Filters" en kies onder "Matrix" de pil "Afspraken · bezoek".
3. Kies eventueel onder "Gebruiker" een teamlid; zijn naam verschijnt in de kicker.

## Flyouts, vensters en knoppen

### Bevestiging "Regio verwijderen?"

Opent met "Verwijderen" op een regiokaart. Tekst: "Regio "Oost" verwijderen?" gevolgd door de gevolgen, bijvoorbeeld "12 accounts vallen dan buiten elke regio en donderdag komt vrij." Zijn er geen gevolgen, dan alleen de vraag. Knoppen "Annuleren" en "Verwijderen". Er is geen ongedaan maken.

![Het bevestigingsvenster bij het verwijderen van de regio Oost](shots/gebieden-4-regio-verwijderen.png)

### Een dag koppelen

Kiezen kan op twee plekken: in de keuzelijst onderaan een dagkaart of in de keuzelijst op de regiokaart. Koppel je een regio aan een dag waar al een andere regio staat, dan laat die andere regio de dag los, zonder melding. "Geen regio" op een dagkaart maakt de dag vrij.

### Lijstpaneel van een regio

Opent met "Openen" achter een regio of achter "Zonder regio". Kicker de dekkingskolom ("Bezoekdekking"), titel de regionaam, subregel "18 accounts, langst stil eerst. Klik een naam om de klantkaart te openen." Tabel met "Account" (link naar de klantkaart), "Soort" (Klant of Prospect), "Fase" (de accountklasse), "Plaats", "Open deals" en "Laatste bezoek" ("nooit" in rood, "vandaag", "8 dagen", met een pil voor het type afspraak als dat bekend is). Sortering: nooit bovenaan, dan langst geleden, bij gelijke stand hoogste dealwaarde. Maximaal 200 rijen. Sluiten met het kruisje of door naast het paneel te klikken; Escape sluit dit paneel niet. De pagina eronder scrollt niet mee zolang het open is.

![Het lijstpaneel van de regio Randstad Zuid met de accounts langst stil eerst](shots/gebieden-6-lijst-flyout.png)

### Download

De knop "Download" opent de gedeelde downloadflyout met kop "Download rapportage", de gekozen scope (matrix, periode, gebruiker, type bezoek) en drie blokken: "Totalen" (de vier cijfers), "Regiotabel" (één regel per regio) en "Accountlijst" (elk account met regio en dagen sinds laatste bezoek; standaard uit). De bestandsnaam volgt pagina, matrix, gebruiker en periode.

## Filters, zoeken, sorteren en weergaven

### Gebiedsindeling

Geen filters of zoekveld. Regio's staan in de volgorde waarin ze zijn aangemaakt, en die volgorde telt: bij overlap krijgt de bovenste het account.

### Regio-analyse

Het filterpaneel opent onder de kop:

- "Matrix" (alleen teambeeld): "Contact", "Afspraken · bezoek", "Afspraken · meeting", "Offerte". Alleen "Afspraken · bezoek" toont de regiotabel; meeting toont een analyse per klasse met onderaan het regioblok "Combineer met een regiodag", contact en offerte tonen de matrixafrekening per klasse. Ruststand is Contact; de keuze telt niet mee in de filterteller.
- "Periode": "Week" (7 dagen), "Maand" (30), "Kwartaal" (90, ruststand), "Periode" met "Van" en "Tot". Het venster bepaalt wat "gezien" is en stuurt alle cijfers: de stil- en nooit-KPI, de stille dealwaarde, de balken en de legenda.
- "Type bezoek" (alleen bij bezoek): "Alles", "Gepland", "Ongepland", "Demo", "Event", "Beurs". Bij een gekozen type telt alleen de agenda, want het veld laatste bezoek op het account heeft geen type.
- "Gebruiker" (alleen teambeeld): "Team" of één naam.

De teller op "Filters" telt een afwijkende periode, een gekozen gebruiker en een gekozen type bezoek. Er komt niets in de URL; alleen de route bepaalt eigen of team. Sortering van de tabel staat vast: meeste stil plus nooit bovenaan, bij gelijke stand de grootste regio.

![De Account analyse voor het team met de matrix Afspraken bezoek en het filter op gebruiker](shots/gebieden-7-account-analyse-bezoek.png)

## Regels en berekeningen

### In welke regio valt een account

1. Is het land leeg, NL, NLD of Nederland, en begint de postcode met precies vier cijfers zonder vijfde cijfer erachter, dan zoekt de app de eerste regio waarvan een reeks die vier cijfers bevat (grenzen inclusief).
2. Geen treffer, of buitenlands: de eerste regio met een plaatsnaam die exact overeenkomt, hoofdletterongevoelig.
3. Anders valt het account in "Zonder regio".

Gevolgen: Antwerpen 2000 valt nooit in een Nederlandse reeks, en een Duitse postcode 45678 wordt niet als 4567 gelezen. "Amersfoort" en "amersfoort" zijn gelijk, maar "Den Bosch" en "'s-Hertogenbosch" niet. Postcode gaat altijd voor plaats, ook als de plaats in een andere regio staat.

### Overlap

Twee soorten worden gemeld: dezelfde plaatsnaam in twee regio's, en twee reeksen uit verschillende regio's die elkaar raken. De app lost het niet op; de volgorde in de lijst beslist.

### Validatie van een regio

Een regio telt mee als hij een id, een niet-lege naam, een lijst plaatsen en een lijst reeksen heeft, en een dag van 1 tot en met 5 of geen dag. Een reeks waarvan het begin groter is dan het eind wordt genegeerd. Een regio met een lege naam doet tijdelijk niet mee in de indeling.

### Wat telt als bezocht

- De laatste afspraak op het account die niet geannuleerd is, al begonnen is en van een bezoektype is: klantbezoek, gepland bezoek, ongepland bezoek, demo, event of beurs.
- Of het veld laatste bezoek op het account (gezet als een bezoek-, demo- of lunchafspraak op voltooid gaat, of uit een import). De recentste van de twee wint.
- Op de meetingroute tellen online meeting, belafspraak, online demo en webinar, en telt het veld laatste bezoek niet.
- Interne overleggen tellen nergens mee.

### Tellingen

- Dagen geleden is het aantal hele dagen sinds het laatste bezoek. Vaste emmers aan serverkant: recent onder 30 dagen, oplopend 30 tot en met 90, stil boven 90, nooit zonder bezoek.
- Met het venster: gezien als het laatste bezoek binnen 7, 30 of 90 dagen viel (of bij een eigen periode op een kalenderdag tussen van en tot), stil als er wel een bezoek is maar daarbuiten, nooit zonder bezoek. Omdat alleen het laatste bezoek bekend is, telt een account dat in de periode én daarna bezocht is niet als gezien in die periode.
- Dekking = gezien gedeeld door alle accounts in beeld, afgerond op hele procenten.
- Open dealwaarde = som van deals die niet gewonnen of verloren zijn. Bewust geen jaaromzet: die bestaat niet in het model.
- Klant of prospect volgt de schakelaar op het account, anders het segment.
- Scope: een accountmanager ziet alleen accounts waarvan hij eigenaar is; een manager op het teambeeld alles, of één teamlid.
- Op de gebiedsindeling rekenen de tellers per regio en per dag met dezelfde indelingsfunctie in de browser, zodat ze meebewegen terwijl de beheerder typt. ">90d niet bezocht" is daar altijd 90 dagen.

### Zonder database

De server antwoordt dan met "niet beschikbaar" en lege lijsten. De analysepagina rekent in dat geval zelf dezelfde uitkomst uit de lijsten in de browser (accounts, afspraken, deals) met dezelfde regels. De gebiedsindeling doet dat niet: daar blijven de tellingen leeg en staat de voorstelknop uit. In de demo zie je dus wel een volledige analyse, maar geen tellingen op de instellingenpagina.

### Wat de regiodag wel en niet doet

- Wel: de weekkalender, de pil "Vaste dag" in de analyse, het regioblok op de meetinganalyse, en in "Wie is er aan de beurt?" het advies om een achterlopend account fysiek te bezoeken op de vaste dag van zijn regio ("Fysiek · dinsdag Randstad Zuid") in plaats van een online meeting.
- Niet: de motor gebruikt de regiodag nergens. De vervaldatum van een bezoektaak wordt niet naar de regiodag geschoven, en de lijsten op Bezoeken ("Te plannen bezoeken", "Accounts vlak bij je bezoeken") lezen de gebiedsindeling niet. De helpteksten beloven "Bezoek-taken en de kansen langs de route volgen de regiodag"; dat klopt in de code niet.
- Het handboek zegt dat een accountmanager een eigen weekdag per regio kiest. In de code is er één dag per regio voor de hele organisatie, en alleen een beheerder zet die.

### AI

Geen. De indeling en de analyse zijn volledig regelgebaseerd.

## Gegevens

### Regio (organisatie-instelling met sleutel gebieden)

- Id (id): bijvoorbeeld regio- gevolgd door een tijdcode, of regio-3xxx bij een voorstel.
- Naam (naam).
- Plaatsen (plaatsen): lijst plaatsnamen.
- Postcodereeksen (reeksen): lijst van begin (van) en eind (tot), vier cijfers.
- Vaste dag (dag): 1 is maandag tot en met 5 is vrijdag, of leeg.

De hele lijst wordt als één waarde opgeslagen en gedempt teruggeschreven bij elke wijziging. Er is geen versiegeschiedenis.

### Wat de analyse per account gebruikt (van andere features)

- Uit het account: naam, plaats (city), postcode, land (country), eigenaar (ownerId), klasse (accountfase), soort klant of prospect, laatste bezoek (lastVisitAt).
- Uit afspraken: type, status, starttijd, account.
- Uit deals: fase en bedrag.

### Antwoord van de analyse

Per regio: id, naam, dag, reeksen, plaatsen, klanten, prospects, totaal, dealwaarde (in centen), recent, oplopend, stil, nooit. Per account: id, naam, plaats, postcode, land, fase, soort, dealwaarde, dagen geleden, tijdstip laatste bezoek en type laatste bezoek. Daarnaast totalen: accounts, in een regio, zonder postcode, stil, stille dealwaarde en dekking.

In de demodata hebben bijna alle accounts geen postcode (175 van 181), en een groot deel ligt in het buitenland. Indelen gaat daar dus vooral op plaatsnaam. Voor de database bestaat een script dat Nederlandse accounts op basis van hun plaats een postcode geeft.

## Wat dit betekent voor Dealtrace

- Neem het model over: een regio is een regel (postcodereeks plus plaatsnaam als vangnet), geen lijst toegewezen accounts. Dat schaalt en volgt verhuizingen vanzelf. Ook de Belgische en Duitse postcodebescherming is direct bruikbaar.
- Laat de regiodag echt werken voor de buitendienst: bezoektaken en nieuwe prospects in een regio horen op de vaste dag van die regio te landen, met een dagroute. In DealDrive is de regiodag vooral weergave.
- Maak de regiodag persoonlijk: twee buitendienstmedewerkers kunnen hetzelfde gebied op verschillende dagen rijden. DealDrive kent één dag per regio voor het hele team.
- Voor new business telt potentie, niet alleen dekking: toon per regio ook het aantal nog niet benaderde prospects en de geschatte waarde (bijvoorbeeld uit branche en grootte), naast open dealwaarde.
- Geef de binnendienst dezelfde regio-analyse op contactniveau (gebeld, gemaild, gesproken) zodat binnendienst de regiodag van de buitendienst kan voorbereiden met afspraken.
- Zorg dat tellingen overal hetzelfde bronpad volgen: in DealDrive rekent de analyse zonder database zelf, maar de instellingenpagina niet, en de dagkaarten tonen dan nullen.
- Los overlap op bij het invoeren (bijvoorbeeld door de kortste reeks te laten winnen of het opslaan te blokkeren) in plaats van alleen te waarschuwen, en accepteer ook een losse postcode als reeks.
- Houd het eerlijke vak "nooit" en de rij "Zonder regio" apart in beeld; juist daar zit voor new business het werk.
