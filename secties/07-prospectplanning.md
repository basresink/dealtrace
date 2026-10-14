# Prospectplanning

## Wat het is en waarvoor

Prospectplanning zet de benadering van prospects uit over het verkoopjaar. De gedachte komt uit het Sales Playbook: hoe groter de omzetpotentie, hoe eerder in het jaar je erbij moet zijn. Grote prospects benader je in de eerste twee maanden, middelgrote in maand 1 tot en met 5, kleine doorlopend het hele jaar. Grote trajecten hebben de rest van het jaar nodig om te landen; wie een corporate prospect pas in oktober voor het eerst belt, haalt dat jaar geen omzet meer.

Voor een accountmanager beantwoordt de pagina twee vragen: welke prospects zijn deze maand aan de beurt, en wie had ik al moeten spreken maar ligt nog stil. Voor een salesmanager laat hij zien of de jaarregel gehaald wordt: per groep hoeveel prospects er zijn en hoeveel daarvan benaderd.

De pagina is een leesscherm. Hij rekent alles in de browser uit en slaat zelf niets op. De enige handeling is de knop "Bel" per prospect, die de flyout Nieuwe taak opent met een beltaak al ingevuld. Er is geen motorregel die automatisch beltaken maakt voor prospects waarvan het venster verstreken is; dat staat in de code als vervolgstap genoteerd.

Samenhang met andere features:

- Leest accounts die als prospect gelden, met hun accountklasse (accountfase), score, plaats en branche.
- Leest de accountklassen zoals de beheerder ze heeft ingesteld (Activity Selling-instellingen), zodat de legenda de actuele namen toont.
- Leest contactmomenten: afgeronde contacttaken, gehouden afspraken, communicatie en het veld laatste contact op het account. Dezelfde telling gebruiken de prospectlijst, de contactmatrix en de klantkaart.
- Schrijft via "Bel" een beltaak. Die komt daarna in de bellijst op /belblokken terecht (beltaken staan daar altijd boven de aanvulling).
- Stuurt prospects zonder klasse naar de prospectlijst met het filter "Geen klasse".

## Waar je het vindt

Menu: zijbalk, groep "Activiteiten", item "Prospectplanning" (icoon kalender), tussen "Belblokken" en "Accountplannen". Route: /prospectplanning. De oude route /prospects/jaarplanning bestaat nog als doorverwijzing, zodat oude bladwijzers blijven werken. De browsertitel is "Jaarplanning prospects · DealDrive"; menu en pagina gebruiken dus twee namen ("Prospectplanning" en "Jaarplanning prospects").

Zichtbaarheid hangt aan de functievlag "prospectplanning" (groep Prospectie, label "Prospectplanning", uitleg "De prospectbenadering uitgezet over het verkoopjaar. Optioneel: zet aan per klant."). De vlag staat standaard uit en wordt per organisatie aangezet door DealDrive HQ. Staat hij uit, dan verdwijnt het menu-item en sturen beide routes door naar de startpagina. Er is geen rolbeperking.

Andere ingangen:

- Op /prospects staat rechtsboven de knop "Jaarplanning →" naast "Alle prospects →".
- Vanaf de pagina zelf gaat de link "← Prospects" in de kicker terug naar /prospects en de paarse knop "Alle prospects →" naar /prospects/alle.

## Opbouw van de pagina

Van boven naar beneden: de kop, het blok "Wat knelt er nu", de jaarkalender, het detail van de gekozen maand en, als die er zijn, de prospects buiten de planning.

![De bovenkant van de prospectplanning met de signalering en het begin van de jaarkalender](shots/prospectplanning-1-pagina.png)

### Kop

- Kicker: "← Prospects · Verkoopjaar 2026 · 61 van 86 prospects ingedeeld". Het eerste deel is een link. "Ingedeeld" telt de prospects met een accountklasse, het tweede getal alle prospects.
- Titel: "Jaarplanning prospects".
- Subtitel: "Hoe groter de kans, hoe eerder je erbij wilt zijn: je hoogste accountklassen benader je vooraan het verkoopjaar, de rest volgt in zijn eigen venster. Hieronder zie je per maand wie er aan de beurt is, en wie je nog moet spreken."
- Rechts: een zoekknop (opent de globale zoekoverlay) en de paarse knop "Alle prospects →".

Er zijn geen statkaarten.

### Wat knelt er nu

Kicker "Het is oktober, maand 10 van het verkoopjaar", titel "Wat knelt er nu". Daaronder een lijst signaalregels, elk met een gekleurde linkerrand, een kicker, een zin en rechts een zwarte knop. De volgorde is vast: eerst urgent (rode rand), dan let op (oranje), dan informatief, dan goed.

In de demodata staan er drie:

- "Achterstallig · Groot": "Het is oktober en 36 grote prospects zijn nog niet benaderd. Dat hoorde in januari-februari." Knop "Bekijk de lijst →".
- "Achterstallig · Middel": "Het is oktober en 21 middelgrote prospects zijn nog niet benaderd. Dat hoorde in januari-mei." Knop "Bekijk de lijst →".
- "Buiten de planning": "25 prospects hebben geen accountklasse en vallen daardoor buiten de jaarplanning." Knop "Bekijk de lijst →".

Alle mogelijke signalen staan onder Regels en berekeningen. Lege staat (geen enkel signaal): "Nog geen prospects met een accountklasse. De jaarplanning heeft niets om over te signaleren."

### Jaarkalender

Kicker "Twaalf maanden · klik een maand voor de prospects", titel "Jaarkalender 2026". Daaronder een legenda met per venster een gekleurde pil en een regel:

- "Groot" (paars): "Corporate en Groot MKB · maand 1-2 (38)".
- "Middel" (blauw): "Middenbedrijf · maand 1-5 (23)".
- "Klein" (grijs): "Klein MKB · doorlopend (0)".

De namen komen uit de accountklassen van de organisatie; hernoemt de beheerder een klasse, dan beweegt de legenda mee. Het getal tussen haakjes is het aantal prospects in die groep.

Dan twaalf maandtegels in een raster van zes breed. Elke tegel is een knop met:

- Het maandnummer van het verkoopjaar en de maandnaam ("1 januari").
- Bij de huidige maand het gele label "Nu" en een gele linkerrand.
- De pillen van de groepen die die maand aan de beurt zijn (alleen groepen met minstens één prospect), of een streepje als er niets aan de beurt is.
- "4/61 benaderd": benaderd en totaal van de groepen die aan de beurt zijn.
- Een rode pil "36 te laat": het aantal nog niet benaderde prospects in groepen waarvan het venster vóór deze maand gesloten is.

Voorbije maanden hebben een grijze achtergrond, de gekozen maand een zwarte rand.

![De jaarkalender met de legenda, oktober als huidige maand en de rode te-laat-tellers vanaf maart](shots/prospectplanning-2-jaarkalender.png)

### Maanddetail

Onder de kalender staat het detail van de gekozen maand (bij binnenkomst de huidige).

- Kicker: "Maand 10 van verkoopjaar 2026 · deze maand" (het laatste deel alleen bij de huidige maand).
- Titel die meebeweegt met de inhoud: "Aan de beurt in februari" als er een groep aan de beurt is, "Blijven liggen in oktober" als er alleen achterstand is, "Niets gepland in [maand]" als er niets is.
- Rechts de knop "Toon ook benaderde (4)" (na klikken "Verberg benaderde (4)"), alleen als er in de getoonde groepen benaderde prospects zijn.

Daarna een kaart per groep: eerst de groepen die te laat zijn, dan de groepen die aan de beurt zijn. Elke kaart heeft:

- Een pil: rood "Te laat", of de groepspil ("Groot", "Middel", "Klein").
- De groepsnaam: "Grote prospects", "Middelgrote prospects" of "Kleine prospects".
- Een uitlegregel. Bij te laat: "Het venster (januari-februari) is voorbij en 36 van de 38 zijn nog niet benaderd." Anders de playbookregel, bijvoorbeeld "Benaderen in de eerste twee maanden van het verkoopjaar: grote trajecten hebben de rest van het jaar nodig om te landen."
- Rechts een meter: "2/38 benaderd" met een voortgangsbalk (rood bij te laat).
- De rijen met prospects.

Elke rij toont:

- De accountnaam als link naar de prospectkaart (/accounts/[id]), met eronder "A · Corporate · Madrid · Height safety distributie": klasse, plaats en branche. Zonder klasse zou hier "Geen klasse" staan, maar die prospects staan niet in de planning.
- Een statuspil: "Nog niet benaderd" (grijs) of "Benaderd" (groen).
- "0 contactmomenten" of "2 contactmomenten".
- De knop "Bel".

Staan alle prospects van een groep op benaderd en zijn de benaderde verborgen, dan staat er "Alle 38 zijn benaderd." Is er in de maand niets, dan: "In juli staat geen prospectgroep gepland en is er niets blijven liggen."

![Het maanddetail van oktober: de grote prospects zijn te laat, 2 van de 38 benaderd](shots/prospectplanning-3-maanddetail.png)

![Met "Toon ook benaderde" verschijnen onderaan de groep de twee benaderde prospects in het groen](shots/prospectplanning-4-ook-benaderde.png)

![Februari gekozen: de grote prospects zijn hier aan de beurt in plaats van te laat](shots/prospectplanning-8-maand-februari.png)

### Buiten de planning

Alleen als er prospects zonder accountklasse zijn. Een gestippeld kader met kicker "Buiten de planning", titel "25 prospects zonder accountklasse" en de tekst "Zonder klasse valt er geen omzetpotentie te bepalen, en dus geen maand waarin ze aan de beurt zijn. Stel de klasse in op de prospectkaart onder Accountklasse." Daaronder een raster van links "Consolis · Parijs", elk naar de prospectkaart.

![Het kader met de prospects zonder accountklasse onderaan de pagina](shots/prospectplanning-7-buiten-de-planning.png)

## Doorklikken: de stappen

### Zien wat er nu knelt en naar de lijst gaan

1. Open /prospectplanning via het menu. Het blok "Wat knelt er nu" toont de signalen, urgent bovenaan.
2. Klik bij "Achterstallig · Groot" op "Bekijk de lijst →". De pagina kiest de huidige maand in de kalender, rendert het maanddetail en scrolt vloeiend naar de kaart "Grote prospects" met de rode pil "Te laat".
3. Werk de lijst van boven af: nog niet benaderde prospects staan bovenaan, binnen die groep de hoogste score eerst.

### Een prospect bellen

1. Klik in een rij op "Bel". De flyout "Nieuwe taak" schuift van rechts in beeld, met klant, titel "Bellen: AT Protección", type "Bellen", aanleiding en prioriteit al ingevuld. Prioriteit is "Hoog" als het venster van de groep voorbij is, anders "Middel".
2. Kies eventueel een contactpersoon, pas de vervaldatum en tijd aan (standaard het eerstvolgende hele uur vandaag).
3. Klik "✓ Maak taak". De flyout sluit en er verschijnt "Taak aangemaakt." De taak staat nu op /taken en in de bellijst op /belblokken.
4. De rij op de prospectplanning verandert niet: een prospect wordt pas "Benaderd" als het contact heeft plaatsgevonden (bijvoorbeeld als je de beltaak afrondt).

### Een andere maand bekijken

1. Klik in de jaarkalender op een maandtegel, bijvoorbeeld "6 juni". De tegel krijgt een zwarte rand en het maanddetail eronder wisselt direct (de pagina scrolt niet mee).
2. Lees de titel: in juni is er niets meer aan de beurt, dus "Blijven liggen in juni", met de grote en middelgrote groep als "Te laat".
3. Klik "2 februari" en de titel wordt "Aan de beurt in februari", met de grote en middelgrote groep als gewone groepen.

![Juni gekozen in de kalender: niets aan de beurt, 57 prospects te laat](shots/prospectplanning-5-maand-juni.png)

### Benaderde prospects tonen

1. Klik rechts boven het maanddetail op "Toon ook benaderde (4)".
2. Onderaan elke groep verschijnen de benaderde prospects met de groene pil "Benaderd" en hun aantal contactmomenten.
3. Klik "Verberg benaderde (4)" om terug te gaan.

### Prospects zonder klasse indelen

1. Klik bij het signaal "Buiten de planning" op "Bekijk de lijst →". Je gaat naar /prospects/alle met het filter "Geen klasse" actief.
2. Open een prospect en stel op de prospectkaart de accountklasse in.
3. Terug op de prospectplanning schuift de prospect vanzelf in het venster van zijn klasse. Je kunt ook direct onderaan de pagina in het kader "Buiten de planning" op een naam klikken.

## Flyouts, vensters en knoppen

### Flyout "Nieuwe taak" via "Bel"

Opent via "Bel" in een rij. Het is de algemene taakflyout van DealDrive, met een voorinvulling vanuit de planning. Het paneel schuift van rechts in.

- Kop: kicker "Nieuwe taak · Hoog" (de gekozen prioriteit), titel "Wat moet er gebeuren?", sluitkruisje.
- "Klant": ingevuld met de prospect, te wissen met een kruisje en te vervangen via "Zoek op klantnaam…".
- "Contactpersoon": leeg, optioneel, zoekveld "Zoek op contactnaam…".
- "Titel" (verplicht): "Bellen: [prospect]".
- "Prioriteit": knoppen "Laag", "Middel", "Hoog", "Urgent". Voorgekozen "Hoog" als het venster verstreken is, anders "Middel".
- "Vervaldatum" en "Tijd": standaard vandaag op het eerstvolgende hele uur.
- "Type": "Te doen", "Bellen", "Mailen", "Bericht"; voorgekozen "Bellen" omdat de actiesoort bellen is.
- "Toegewezen aan": standaard jijzelf.
- "Aanleiding": "Jaarplanning 2026: grote prospects, venster januari-februari (venster verstreken)". Het laatste deel alleen als het venster voorbij is.
- "Taak herhalen" (vinkje): frequentie "Elke werkdag", "Wekelijks", "Om de week" of "Maandelijks", en "Herhalen tot" (standaard drie maanden vooruit), met de telling "N taken in totaal".
- "Herinnering instellen" (vinkje): "Vóór vervaldatum" (5 minuten tot 2 dagen) en "Versturen via" ("In-app notificatie", "E-mail", "Beide").
- "Beschrijving": optioneel.
- Alleen bij type Bellen: het blok "Transcript & gespreksverslag" (bestand slepen, tekst plakken of inspreken) met de knop "Opslaan en analyseer →".
- Onderaan: "Annuleren" en "✓ Maak taak" (tijdens opslaan "Opslaan…").

Na opslaan: melding "Taak aangemaakt." (of "N taken aangemaakt." bij herhaling) en de flyout sluit. Bij een fout blijft hij open met "Opslaan mislukt: controleer offline-database." Escape, het kruisje en "Annuleren" sluiten zonder opslaan. Er wordt niets aangemaakt zolang je niet op "✓ Maak taak" klikt; de knop "Bel" belt dus niet en maakt ook niet direct een taak.

![De flyout Nieuwe taak na een klik op Bel, met hoge prioriteit en de aanleiding uit de jaarplanning](shots/prospectplanning-6-bel-flyout.png)

### Signaalknoppen

- "Bekijk de lijst →" bij een groepssignaal: kiest de huidige maand, wacht tot het maanddetail er staat en scrolt naar de kaart van die groep (of naar de kop van het maanddetail als de groep daar niet staat).
- "Naar [maand] →" bij een venster dat nog moet beginnen: kiest die maand en scrolt naar de groep.
- "Bekijk de lijst →" bij "Buiten de planning": een gewone link naar /prospects/alle?filter=geen-fase.

### Overige knoppen

- Maandtegel: kiest de maand voor het detail, zonder te scrollen.
- "Toon ook benaderde" en "Verberg benaderde": schakelt de benaderde rijen in alle groepen van het detail tegelijk.
- Accountnaam in een rij of in "Buiten de planning": gaat naar de prospectkaart.

Er zijn geen bevestigingsvensters en geen eigen meldingen op deze pagina.

## Filters, zoeken, sorteren en weergaven

De pagina heeft geen filters op accountmanager, team, regio, branche of klasse, en geen eigen zoekveld. De zoekknop in de kop opent de globale zoekoverlay.

Er zijn twee keuzes die als weergave werken:

- De gekozen maand (één tegel tegelijk). Standaard de huidige maand.
- "Toon ook benaderde". Standaard uit: het detail toont alleen wie nog benaderd moet worden. De teller tussen haakjes is de som van de benaderde prospects in alle groepen van dat maanddetail.

Sorteren is vast. Groepen staan in de volgorde te laat, dan aan de beurt; binnen beide groot, middel, klein. Rijen binnen een groep: eerst nog niet benaderd, dan aflopend op accountscore, dan op naam (Nederlandse alfabetvolgorde).

Niets komt in de URL. Na herladen staat de huidige maand weer gekozen en zijn de benaderde rijen weer verborgen. De huidige maand ligt vast bij het laden van de pagina en verspringt niet om middernacht.

## Regels en berekeningen

### Van accountklasse naar omzetpotentie

De omzetpotentie is geen bedrag maar een afleiding uit de accountklasse:

| Accountklasse | Omzetpotentie | Venster |
|---|---|---|
| A (Corporate) | Groot | maand 1 tot en met 2 |
| B (Groot MKB) | Groot | maand 1 tot en met 2 |
| C (Middenbedrijf) | Middelgroot | maand 1 tot en met 5 |
| D (Klein MKB) | Klein | doorlopend, maand 1 tot en met 12 |
| Eigen klasse (E, F, ...) | Middelgroot | maand 1 tot en met 5 |
| Geen klasse | Geen | buiten de planning |

De standaardklassen zijn A "Corporate" (250+ medewerkers), B "Groot MKB" (50 tot 250), C "Middenbedrijf" (10 tot 50) en D "Klein MKB" (tot 10). De beheerder kan ze hernoemen en eigen klassen toevoegen. Een eigen klasse telt bewust als middelgroot: als groot zou hij een te krap venster krijgen, als klein nooit een deadline. Een account zonder klasse krijgt geen potentie en geen gok.

### Wie telt als prospect

Een account is prospect als dat expliciet op de kaart is gezet, of anders als het segment hot prospect, warm prospect, prospect of watchlist is. Segmenten strategic, klant en at-risk gelden als klant en staan niet op deze pagina. De lijst is alle prospects van de organisatie; er wordt niet gefilterd op eigenaar of accountmanager.

### Het verkoopjaar

Het verkoopjaar begint in januari en is gelijk aan het kalenderjaar. Dat staat als één constante in de code (startmaand 1) en is nog niet per organisatie in te stellen. Bij een andere startmaand zouden alle maandnummers meeschuiven en zou het jaarlabel "2026/2027" worden.

### Wat "benaderd" is

Een prospect is benaderd als hij minstens één contactmoment heeft. Contactmomenten worden geteld in unieke dagen, uit vier bronnen:

- Communicatierecords op het account.
- Afgeronde taken van type bellen, mailen, bericht of afspraak (een taak "Te doen" telt niet).
- Afspraken met het account die niet geannuleerd zijn en waarvan de start in het verleden ligt.
- Het veld laatste contact (lastInteractionAt) op het account.

Twee belletjes op één dag zijn één contactmoment. De telling is niet begrensd op het verkoopjaar: een prospect die in 2024 één keer gebeld is, geldt nu als benaderd. Dat is bewust gelijk aan de rest van de app, maar het betekent dat de planning voor bestaande, ooit gesproken prospects altijd groen kleurt. Een open beltaak telt niet; pas het afronden telt.

### Groepen, kalender en achterstand

- Per groep: totaal, benaderd, open (totaal min benaderd) en percentage (benaderd gedeeld door totaal, afgerond).
- Een groep is aan de beurt in een maand als die maand binnen het venster valt. Groepen zonder prospects verschijnen niet in de kalender (wel in de legenda, met "(0)").
- Een groep is te laat in een maand als het venster niet doorlopend is, de maand na de laatste maand van het venster ligt en de groep nog open prospects heeft. Een te-late groep blijft in elke latere maand staan, zodat je ook in augustus ziet wie er in januari had gemoeten.
- De tegeltellers: "benaderd/totaal" over de groepen die aan de beurt zijn, "te laat" als de som van de open prospects in de te-late groepen.

Alles wordt met de stand van vandaag berekend. Er is geen historie: de tegel van maart zegt "36 te laat" omdat er vandaag 36 grote prospects open staan, niet omdat dat in maart zo was. Ook toekomstige maanden (november, december) tonen de huidige achterstand.

### De signalen

Per groep met minstens één prospect komt er precies één signaal:

- Venster voorbij en nog open prospects: urgent, kicker "Achterstallig · Groot", tekst "Het is [maand] en N grote prospects zijn nog niet benaderd. Dat hoorde in januari-februari.", knop "Bekijk de lijst".
- Venster voorbij en alles benaderd: goed, kicker "Afgerond · Groot", tekst "Alle N grote prospects zijn benaderd; het venster januari-februari is netjes afgesloten."
- Venster loopt en alles benaderd: goed, kicker "Op schema · Groot", tekst "Alle N grote prospects zijn benaderd."
- Venster loopt, doorlopend (klein): informatief, kicker "Doorlopend · Klein", tekst "N kleine prospects zijn nog niet benaderd. Kleine prospects kennen geen deadline. Plan er wekelijks een paar tussendoor."
- Venster loopt en dit is de laatste maand: let op, kicker "Laatste maand · Middel", tekst "N middelgrote prospects zijn nog niet benaderd en het venster sluit eind mei."
- Venster loopt met meer maanden te gaan: informatief, kicker "Loopt · Groot", tekst "N grote prospects zijn nog te benaderen; nog 2 maanden tot het venster sluit (t/m februari)."
- Venster moet nog beginnen: informatief, kicker "Nog niet aan de beurt · [groep]", knop "Naar [maand]". Met de huidige vensters kan dit niet voorkomen, omdat alle vensters in maand 1 beginnen.

Daarnaast, als er prospects zonder klasse zijn: let op, kicker "Buiten de planning", met een link naar de gefilterde prospectlijst.

### De voorinvulling van "Bel"

Titel "Bellen: [prospect]", type bellen, actiesoort bellen, bron handmatig, account de prospect, prioriteit hoog als het venster van zijn groep voorbij is en anders middel, aanleiding "Jaarplanning [jaar]: [groepsnaam], venster [venster]" plus " (venster verstreken)" als dat zo is. Er wordt geen vervaldatum voorgesteld die past bij het venster; de flyout zet het eerstvolgende hele uur.

### Wat de AI doet

Niets. De pagina gebruikt geen taalmodel; alle indeling en signalering is vaste rekenlogica.

## Gegevens

De pagina heeft geen eigen opslag. Hij leest:

| Bron | Velden | Gebruikt voor |
|---|---|---|
| Account | naam, accountklasse (accountfase), score, plaats (city), branche | indeling, sortering, rijtekst |
| Account | type (accountKind) of segment | prospect of klant |
| Account | laatste contact (lastInteractionAt) | contactmomenten |
| Taak | type, status, afgerond op (completedAt) | contactmomenten |
| Afspraak | account, status, start (startAt) | contactmomenten |
| Communicatie | moment (occurredAt) | contactmomenten |
| Instellingen | accountklassen (code, label, omschrijving) | legenda |

De accountklassen staan in de organisatie-instellingen (org_settings, sleutel accountfases) en worden ook gebruikt door de regelmotor. De vensters en de koppeling klasse naar potentie staan in de code, niet in de database.

Hij schrijft alleen via de flyout een taak: titel, account, optioneel contactpersoon, type (call), actiesoort (actionType bellen), prioriteit, vervaldatum (dueDate), eigenaar, bron (source manual), aanleiding (reason), optioneel herhaling, herinnering, beschrijving en gespreksverslag.

## Wat dit betekent voor Dealtrace

- Overnemen: de jaarregel als zichtbare planning (groot vroeg, middel vóór de zomer, klein doorlopend) met de signalering "wat knelt er nu" in gewone zinnen. Dat is precies de sturing die new business mist.
- Anders: bereken omzetpotentie niet alleen uit de klasse, maar laat de accountmanager of de data (omvang, branche, bestaande klanten van hetzelfde type) een potentiebedrag of score geven, en gebruik de klasse als terugval.
- Anders: begrens "benaderd" op het lopende verkoopjaar en tel alleen echt contact met een beslisser, niet het veld laatste contact uit een import. Nu kleurt een ooit gebelde prospect het hele jaar groen.
- Anders: filter op eigen prospects en maak een teamweergave voor de manager (per accountmanager benaderd tegen totaal). Nu ziet iedereen alle prospects van de organisatie zonder eigenaar.
- Anders: maak van "Bel" een directe koppeling met de belblokken: met één klik de te-late groep in het eerstvolgende acquisitieblok zetten, met een vervaldatum binnen het venster.
- Ontbreekt: de motorregel die bij een verstreken venster zelf een beltaak of inzicht maakt, historie per maand (wie is wanneer benaderd) en een instelbare startmaand van het verkoopjaar.
- Ontbreekt voor de buitendienst: een kaart- of regioweergave van de prospects die aan de beurt zijn, zodat ze te combineren zijn met bezoeken in hetzelfde gebied.
