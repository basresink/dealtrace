# Accountmatrix: accountklassen, segmenten en het ritme per klasse

## Wat het is en waarvoor

De accountmatrix is de plek waar een organisatie vastlegt hoeveel aandacht elk account verdient. In DealDrive heet de pagina "Accountritme". Op één scherm staan vijf lagen onder elkaar: de accountklassen (A tot en met D), de segmenten, de belmatrix (hoe vaak je belt, apart voor klant en prospect), de afspraakmatrix (hoe vaak je een online meeting of een fysiek bezoek hebt) en de offertematrix (hoe zwaar je een verstuurde offerte opvolgt, afhankelijk van het bedrag).

Voor een accountmanager is dit geen scherm waar hij dagelijks komt. Hij merkt het effect: de motor zet beltaken en bezoektaken op zijn lijst in het tempo dat hier staat, een verstuurde offerte krijgt automatisch een opvolgtaak met het juiste kanaal en de juiste vervaldatum, en schermen als de dagstart, de verdieping, "Wie is er aan de beurt?" op Meetings en het tabblad "Ritme" van een accountplan rekenen met dezelfde getallen. De klasse zelf ziet hij als pil naast de accountnaam op de klantkaart en in lijsten ("A · Corporate").

Voor een salesmanager is de matrix de meetlat. Op de Account analyse rekent hij per matrix af of het team het afgesproken ritme haalt: krijgt elk A-account echt twaalf belmomenten per jaar, is elke offerte boven de €50.000 echt face-to-face opgevolgd.

Het probleem dat de feature oplost: zonder vaste afspraak doet iedere verkoper wat hij zelf belangrijk vindt. Kleine accounts krijgen dan te veel aandacht en grote te weinig, en een grote offerte krijgt hetzelfde mailtje als een kleine. De matrix maakt het beleid expliciet en laat de motor het uitvoeren.

Plek in de week: de beheerder richt het in bij de start van een organisatie en daarna zelden. De motor draait elk uur en leest de matrices bij elke run opnieuw, dus een wijziging werkt bij de volgende run door.

Samenhang met andere features:

- Leest: accounts (veld accountklasse, segment en de schakelaar klant of prospect), offertes (status, bedrag, verzenddatum, titel), gebruikers met hun rol, en de Activity Selling-regels.
- Schrijft: vier organisatie-instellingen (accountklassen, belmatrix, afspraakmatrix, offertematrix) en segmentdefinities. Via de motor ontstaan daaruit taken met een reden en een bewijsregel.
- Wordt gelezen door: de motor, de Account analyse, de meetinganalyse, de dagstart en verdieping van Dex, de voorstellen op Meetings, het tabblad "Ritme" van accountplannen en de segmentregels.

## Waar je het vindt

- Menu: onderin het linkermenu naar Instellingen, dan in het blok "Sub-pagina's" de link "Accountritme →".
- Route: /instellingen/accountritme. Het oude adres /instellingen/accountklassen stuurt permanent door (301) naar de nieuwe route, met eventuele zoekparameters en anker erbij. Ook de vroegere losse pagina /segmenten is hierin opgegaan.
- Browsertitel: "Accountritme · DealDrive".
- Wie het ziet: Instellingen is in principe alleen voor beheerder en superuser, maar deze pagina staat op een uitzonderingslijst: iedere ingelogde gebruiker mag meekijken. Wie geen beheerder is, ziet de pagina in alleen-lezen-stand met de tekst "Je kunt meekijken. Alleen een beheerder wijzigt de inrichting. Dit stuurt de ritme-regels van het hele team."
- Wie wijzigt: klassen, belmatrix, afspraakmatrix en offertematrix alleen beheerder en superuser. Segmenten mag op deze pagina ook een salesmanager beheren (de code geeft het segmentblok de managerrechten mee, terwijl het handboek segmentbeheer beheerderswerk noemt). De server dwingt het opslaan van organisatie-instellingen af op de beheerdersrol, los van wat het scherm toont.
- Geen functievlag op de pagina zelf.
- Vanuit andere schermen: de Account analyse en de meetinganalyse verwijzen in hun voetnoot naar "Accountritme"; de melding "N accounts zonder accountklasse tellen hier niet mee. Ken een klasse toe op de klantkaart of bij Accountritme." staat op de Account analyse. De klasse van één account zet je op de klantkaart via de klasse-pil.

![De kop van Accountritme met de vier accountklassen en het aantal accounts per klasse](shots/matrix-1-pagina-en-klassen.png)

## Opbouw van de pagina

De pagina is één lange kolom met een kop en vijf secties. Er is geen opslaanknop: elke wijziging wordt automatisch bewaard.

### Kop

- Kruimelpad "← Alle instellingen".
- Kicker "Instellingen · Accountritme", titel "Eén pagina voor de hele inrichting."
- Subtitel die de lagen opsomt: accountklassen (hoeveel aandacht een account verdient), segmenten (waar de relatie staat), belmatrix en afspraakmatrix (het ritme van voortgangsgesprekken) en de "offertematrix orderwaarde" (hoe zwaar je een offerte opvolgt).
- Rechtenregel: voor een beheerder "Wijzigingen worden automatisch bewaard voor de hele organisatie.", voor anderen de meekijktekst.
- Rechtsboven een telpil, bijvoorbeeld "4 klassen".

### Sectie 1: Accountklassen

Kicker "Accountklassen", titel "Niet elk account verdient hetzelfde ritme.", rechts de knop "+ Klasse" (alleen beheerder). De uitleg waarschuwt dat de klasse iets anders is dan het segment (waar de relatie staat) en de journey-fase (waar het account in het proces zit).

Per klasse één rij met:

- Code: maximaal twee tekens, wordt bij wijzigen in hoofdletters gezet.
- Naam: bijvoorbeeld "Corporate", placeholder "Naam van de klasse".
- Omschrijving: placeholder "Omschrijving (bv. 250+ medewerkers)".
- Teller "N accounts": het aantal accounts in de organisatie waarvan het veld accountklasse gelijk is aan deze code. In de demo: A 36, B 72, C 40, D 0.
- Knop × om de klasse te verwijderen.

Onder de lijst staat, als dat zo is, "34 accounts hebben nog geen klasse. Die vallen buiten de ritme-regels die op een klasse filteren. Zet de klasse op de klantkaart." Bij twee klassen met dezelfde code verschijnt een waarschuwing dat een account dan in de eerste klasse met die code valt. Het blok "Hoe dit doorwerkt" legt uit dat een naamwijziging overal doorwerkt en dat accounts bij het verwijderen van een klasse hun oude code houden.

Lege staat: "Nog geen klassen. Voeg de eerste toe. De standaardindeling is A Corporate t/m D Klein MKB."

De standaardklassen zijn A Corporate (250+ medewerkers), B Groot MKB (50-250 medewerkers), C Middenbedrijf (10-50 medewerkers) en D Klein MKB (tot 10 medewerkers).

### Sectie 2: Segmenten

Kicker "Segmenten", titel "Waar de relatie stáát.", knop "+ Segment". Een rij tegels toont elk segment met het aantal accounts dat er nu in valt (demo: "A-klant (top-20%)" 24, "Groei-prospect" 10, "Aandacht-klant" 0, "Risico-klant" 161, "Hot signaal" 2). Een klik op een tegel opent eronder een bewerkpaneel met links de definitie en rechts de leden.

Het bewerkpaneel toont "Systeem-segment" of "Eigen segment", de knoppen "Reset" (alleen bij een gewijzigd systeemsegment) en "Verwijderen", de velden "Naam", "Kort label (op de kaart)", "Beschrijving", "Kleur" (Geel, Blauw, Rood, Groen, Paars, Oranje, Zwart) en "Regels combineren" ("Alle regels moeten kloppen" of "Minstens één regel klopt"). Daaronder "Regels" met "+ Regel": per regel een veld, een vergelijking en een waarde. Drie velden komen rechtstreeks uit de matrices: "Belmatrix (belletjes per jaar)", "Bezoekmatrix (bezoeken per jaar)" en "Offertematrix (opvolgkanaal)". Zo maak je een segment "iedereen die maandelijks gebeld hoort te worden" zonder klassen op te sommen. Rechts staat "Leden" met het aantal en de accounts (initialen, naam, klasse, branche, score).

![De segmenten als tegels met het bewerkpaneel en de ledenlijst](shots/matrix-2-segmenten.png)

### Sectie 3: Belmatrix

Kicker "Belmatrix", titel "Het belritme per accounttype en klasse." De uitleg zegt letterlijk "De regels blijven de uitvoering; de matrix is de inrichting." en dat er automatisch een rij verschijnt als je een klasse toevoegt.

De tabel heeft de kolommen "Klasse", "Per maand", "Per kwartaal", "Per halfjaar", "Per jaar" en "Afgeleid belritme". De rijen zijn gegroepeerd in "Klant · bestaande relatie" en "Prospect · nog te winnen", met binnen elke groep één rij per klasse ("A · Corporate"). In elke periodecel staat een getal (minimaal 0, hele getallen). Voor wie alleen mag kijken staat er "1×". De laatste kolom rekent het jaartotaal uit, bijvoorbeeld "12×/jaar = elke 4 weken" of "Geen vast ritme".

De standaardwaarden:

| Klasse | Klant | Prospect |
|---|---|---|
| A | 1 per maand (12 per jaar) | 1 per maand (12 per jaar) |
| B | 1 per kwartaal (4 per jaar) | 1 per maand (12 per jaar) |
| C | 1 per halfjaar (2 per jaar) | 1 per kwartaal (4 per jaar) |
| D | 1 per jaar | 1 per halfjaar (2 per jaar) |

Prospects staan bewust een tandje strakker dan klanten van dezelfde klasse, zodat het contact warm blijft tot de deal rond is.

Onder de tabel: "Het afgeleide ritme telt de periodes op tot een jaartotaal. Zo zie je wat de motor aanhoudt: bij 17×/jaar plant hij elke ~3 weken een belmoment in."

![De belmatrix met de groepen klant en prospect en het afgeleide belritme](shots/matrix-3-belmatrix.png)

### Sectie 4: Afspraakmatrix

Kicker "Afspraakmatrix", titel "Het afspraakritme per klasse en soort." Zelfde tabelvorm, met de groepen "Meeting · online gesprek" en "Bezoek · fysiek langs" en de laatste kolom "Afgeleid afspraakritme".

| Klasse | Meeting | Bezoek |
|---|---|---|
| A | 1 per kwartaal (4 per jaar) | 1 per kwartaal (4 per jaar) |
| B | 1 per halfjaar (2 per jaar) | 1 per halfjaar (2 per jaar) |
| C | 1 per jaar | 1 per jaar |
| D | geen | 1 per jaar |

De bezoekwaarden volgen bewust het oude bezoekritme van de vroegere contactmatrix, zodat het aanzetten van de matrix het gedrag niet verzette. Onder de tabel: "Meetings (online) mogen vaker dan bezoeken (fysiek, duurder). Een leeg ritme betekent: voor die klasse en soort plant de motor niets vast in." Die tweede zin klopt maar half; zie Regels en berekeningen.

![De afspraakmatrix met de rijen voor meeting en bezoek](shots/matrix-4-afspraakmatrix.png)

### Sectie 5: Offertematrix

Kicker "Offertematrix", titel "Hoe zwaar volg je een offerte op?" De uitleg zegt dat de motor kanaal, uitvoerder en opvolgperiode kiest op de offertewaarde en dat contracten face-to-face gaan, herkend aan het offerte- of dealtype of aan een trefwoord in de titel ("contract, overeenkomst, verlenging"). Rechts de knop "+ Waardeklasse"; wie alleen kijkt, ziet "Alleen een beheerder wijzigt de trap."

De tabel heeft de kolommen "Waardeklasse", "Vanaf (€)", "Kanaal", "Uitvoerder", "Opvolgen binnen", "Waarom" en een kolom met ×. De waardeklasse is een afgeleid label: "Tot €10.000" voor de onderste rij, "Vanaf €100.000" voor de bovenste, en daartussen het bereik van de eigen ondergrens tot de ondergrens van de volgende rij.

- "Vanaf (€)": hele euro's, stappen van 500. Intern opgeslagen in centen.
- "Kanaal": "Taak · Mail", "Taak · Bellen", "Afspraak · Gepland bezoek", "Afspraak · Belafspraak", "Afspraak · Online meeting".
- "Uitvoerder": "Accountmanager", "Salesmanager", "Beheerder (directeur)".
- "Opvolgen binnen": 1 tot 60 werkdagen, of leeg (placeholder "regel"); in alleen-lezen-stand staat er dan "volgens de regel".
- "Waarom": vrije toelichting, placeholder "Waarom deze klasse zo wordt opgevolgd".

De standaardtrap:

| Vanaf | Kanaal | Uitvoerder | Opvolgen binnen |
|---|---|---|---|
| €0 | Taak · Mail | Accountmanager | 5 werkdagen |
| €10.000 | Taak · Bellen | Accountmanager | 3 werkdagen |
| €50.000 | Afspraak · Gepland bezoek | Accountmanager | 5 werkdagen |
| €100.000 | Taak · Bellen | Beheerder (directeur) | 2 werkdagen |

Lege staat: "Geen klassen ingesteld. De motor valt terug op de actiesoort van de regel zelf en op de accounteigenaar."

![De offertematrix met de vier waardeklassen van de standaardtrap](shots/matrix-5-offertematrix.png)

## Doorklikken: de stappen

### Een nieuwe klasse toevoegen en een ritme geven

1. Klik in de sectie Accountklassen op "+ Klasse". Er verschijnt onderaan een rij met de eerstvolgende vrije letter (E) en de naam "Nieuwe klasse".
2. Typ een naam en omschrijving. Het wordt automatisch bewaard.
3. Scroll naar de belmatrix. Onder "Klant" en onder "Prospect" staat nu een rij voor klasse E met overal 0 en "Geen vast ritme".
4. Vul bijvoorbeeld bij "Per kwartaal" een 1 in en klik buiten het veld. De rij wordt pas dan echt aangemaakt; de laatste kolom toont "4×/jaar = elke 3 maanden".
5. Ken de klasse toe aan accounts via de klasse-pil op de klantkaart. Let op: in de segmentregels kun je E niet kiezen, die keuzelijst kent vast alleen A tot D.

### Het belritme voor prospects aanscherpen

1. Ga naar de belmatrix, groep "Prospect · nog te winnen".
2. Zet bij "C · Middenbedrijf" de waarde "Per kwartaal" van 1 naar 0 en "Per maand" van 0 naar 1.
3. De laatste kolom springt naar "12×/jaar = elke 4 weken".
4. Bij de volgende motorrun (binnen het uur) gebruikt elke ritme-regel met actiesoort bellen voor C-prospects een interval van 30 dagen.

### Een ritme bewust uitzetten

1. Zet in de afspraakmatrix bij "Bezoek · fysiek langs" voor "D · Klein MKB" de 1 bij "Per jaar" op 0.
2. De rij toont "Geen vast ritme" en blijft in de opslag bestaan met alleen nullen.
3. De motor maakt voor D-accounts geen bezoektaken meer uit een bezoek-ritmeregel; elke poging telt als overgeslagen op cadans.

### Een waardeklasse aan de offertematrix toevoegen

1. Klik op "+ Waardeklasse". Er komt een rij bij met als ondergrens het dubbele van de hoogste drempel (bij de standaardtrap €200.000), kanaal "Afspraak · Gepland bezoek", uitvoerder "Accountmanager" en 3 werkdagen.
2. Pas "Vanaf (€)" aan. Kies je een bedrag dat al bestaat, dan verschijnt de foutmelding "Er bestaat al een klasse vanaf €… Kies een andere ondergrens." en verandert er niets.
3. Kies kanaal en uitvoerder. De rijen sorteren zich vanzelf op bedrag en de labels in de kolom Waardeklasse rekenen opnieuw.

### Een klasse verwijderen

1. Klik op × achter de klasse.
2. Er opent een bevestigingsvenster "Klasse verwijderen?" met de gevolgen.
3. Klik "Verwijderen" of "Annuleren". Na verwijderen verschijnt de melding "Klasse B verwijderd." De accounts houden hun code B, maar er is geen klasse en geen matrixrij meer die ze toont.

### Controleren of het team het ritme haalt

1. Open in het managersmenu "Account analyse".
2. Klik op "Filters" en kies onder "Matrix" de pil "Contact" of "Offerte".
3. Lees de drie cijfers en de tabel per klasse of waardeklasse; "Openen" achter een rij toont de accounts of offertes zelf.

## Flyouts, vensters en knoppen

### Bevestiging "Klasse verwijderen?"

Opent met × achter een klasse. Rode waarschuwingsstijl. Twee teksten:

- Met accounts: "Klasse B (Groot MKB) wordt door 72 accounts gebruikt. Die houden hun code, maar de ritme-regels op deze klasse raken ze kwijt."
- Zonder accounts: "Klasse D (Klein MKB) verdwijnt uit de matrix. Dit kan niet ongedaan worden gemaakt."

Knoppen "Annuleren" en "Verwijderen". Escape sluit het venster zonder iets te doen. Na verwijderen de melding "Klasse … verwijderd."

![Het bevestigingsvenster bij het verwijderen van klasse B, met het aantal geraakte accounts](shots/matrix-6-klasse-verwijderen.png)

### Bevestiging "Rij verwijderen?" in de offertematrix

Opent met × achter een waardeklasse: "De rij "…" verdwijnt uit de offertematrix. Offertes met dat bedrag vallen daarna in de aangrenzende klasse." Knoppen "Annuleren" en "Verwijderen", daarna de melding "Rij verwijderd."

### Foutmeldingen bij invoer

- Opvolgperiode buiten 1 tot 60: "Kies 1 tot 60 werkdagen, of laat het veld leeg voor de regel." Het veld wordt leeg gemaakt in plaats van afgekapt: wie 0 typt bedoelt niet 1.
- Dubbele ondergrens: zie hierboven.
- Belmatrix en afspraakmatrix: negatieve of niet-numerieke waarden worden stil 0, decimalen worden afgerond.
- Een klassecode hernoemen naar een code die al bestaat wordt niet geweigerd; je krijgt alleen de waarschuwing over dubbele codes.

### Klasse-keuzemenu op de klantkaart

De klasse-pil naast de accountnaam is een knop met een potloodje. Een klik opent een menu met de kop "Accountklasse", per klasse een regel met kleurstip, label en omschrijving, een vinkje bij de huidige klasse, en (als er een klasse staat) een regel om de klasse leeg te maken. A tot D hebben elk een eigen kleur; zelf toegevoegde klassen krijgen een neutrale kleur. Een account zonder klasse toont de pil "Geen klasse". Bij het aanmaken van een nieuw account kies je de klasse in een keuzelijst.

### Opslaan

Er is geen opslaanknop en geen bevestigingsmelding. Elke wijziging gaat gedempt naar de server als organisatie-instelling. Mislukt het opslaan, dan blijft de wijziging alleen in het scherm staan en komt bij de volgende keer laden de serverstand terug, zonder melding aan de gebruiker. Zonder database (de demo) blijft alles in het geheugen van de browser.

## Filters, zoeken, sorteren en weergaven

De pagina zelf heeft geen filters, zoekveld of weergaven, en zet niets in de URL. Volgorde:

- Klassen staan in de volgorde waarin ze zijn aangemaakt; de bel- en afspraakmatrix volgen die volgorde.
- De offertematrix sorteert altijd oplopend op ondergrens.
- Segmenttegels staan in de volgorde van de segmentlijst.

De filters om de matrix af te rekenen staan op de Account analyse (route /account-analyse):

- "Matrix": "Contact", "Afspraken · bezoek", "Afspraken · meeting", "Offerte". Ruststand is Contact. Deze keuze telt niet mee in de teller op de knop Filters, omdat het een weergave is en geen filter.
- "Periode": "Week" (7 dagen), "Maand" (30), "Kwartaal" (90, ruststand) of "Periode" met eigen datums "Van" en "Tot".
- "Gebruiker": "Team" of één teamlid.

![De Account analyse met het filterpaneel open en de offertematrix afgerekend per waardeklasse](shots/matrix-7-account-analyse-offerte.png)

## Regels en berekeningen

### Het afgeleide ritme

- Jaartotaal = per maand × 12 + per kwartaal × 4 + per halfjaar × 2 + per jaar × 1. Waarden worden afgerond en negatief wordt 0.
- Interval in dagen = 365 gedeeld door het jaartotaal, afgerond, met een minimum van 1 dag.
- Leesbaar label: bij 330 dagen of meer "jaarlijks"; vanaf 60 dagen "elke N maanden" (dagen gedeeld door 30); vanaf 6 dagen "elke N weken" (dagen gedeeld door 7); daaronder in dagen.
- Voorbeelden: 12 per jaar wordt 30 dagen en "elke 4 weken"; 4 per jaar wordt 91 dagen en "elke 3 maanden"; 17 per jaar wordt 21 dagen en "elke 3 weken".

### Hoe de motor de bel- en afspraakmatrix gebruikt

De matrix maakt zelf geen taken. Hij overrulet alleen de cadans van bestaande Activity Selling-regels met het triggerpatroon "ritme". Per run (elk uur, plus "Draai motor nu" voor een beheerder) gebeurt per ritme-regel en per account dat door de klassevinkjes van de regel wordt geraakt het volgende:

1. Heeft het account geen klasse, dan geldt de cadans van de regel.
2. Is de actiesoort van de regel "bellen", dan zoekt de motor de belmatrix-rij voor het accounttype en de klasse. Het accounttype is de expliciete schakelaar klant of prospect op het account; ontbreekt die, dan telt het segment "strategic", "klant" of "at-risk" als klant en al het andere als prospect.
3. Is de actiesoort "bezoek", dan zoekt de motor de bezoek-rij van de afspraakmatrix voor de klasse.
4. Geen rij gevonden: de cadans van de regel geldt. Rij met jaartotaal 0: het ritme staat uit voor dit account, er komt geen taak. Anders: het interval uit de matrix vervangt de regelcadans.
5. De motor kijkt in zijn runadministratie wanneer deze regel voor dit account voor het laatst iets opleverde. Is het interval verstreken, dan maakt hij een taak of inzicht.
6. De taak krijgt een reden die de keuze uitlegt, bijvoorbeeld "Terugkerend volgens belmatrix (klant, klasse A): 12× per jaar (interval 30 dagen, in plaats van regelcadans Kwartaal)", plus een bewijsregel met bron "CRM (DealDrive)". Heeft het account een lopend accountplan, dan hangt de taak daaraan.

Wat dit in de praktijk betekent:

- De meeting-rij van de afspraakmatrix stuurt de motor niet. Er bestaat geen ritme-regel voor meetings. De rij wordt wel gebruikt door de meetinganalyse en de verdieping.
- De starterset van een nieuwe organisatie bevat twee ritme-regels, beide met actiesoort bezoek: "Kwartaalbezoek A" (alleen klasse A) en "Halfjaarlijks bezoek B" (alleen klasse B). Er zit geen bel-ritmeregel in. Zolang de beheerder die niet maakt, doet de belmatrix in de motor niets, en de bezoek-rijen voor C en D ook niet. De belmatrix werkt dan alleen in analyses en voorstellen.
- Een ritme-regel zonder klassevinkjes raakt alle accounts tegelijk. In het handboek heet dat "de 182-taken-les".
- Leeg is niet hetzelfde als nul. Een rij die nooit is ingevuld (bijvoorbeeld van een nieuwe klasse, of na het hernoemen van een klassecode) bestaat niet in de opslag: de motor volgt dan de regelcadans. Het scherm toont voor die rij toch nullen en "Geen vast ritme", net als voor een rij die bewust op nul staat en het ritme uitzet. De hint "Een leeg ritme betekent: voor die klasse en soort plant de motor niets vast in" klopt dus alleen voor een bewust op nul gezette rij.
- Het hernoemen van een klassecode laat de matrixrijen van de oude code staan. De nieuwe code begint zonder rijen.
- In de motorcode staat bij de lus de opmerking dat bezoek "meeting + bezoek samen" leest; de functie zelf leest alleen de bezoek-rij.

### Hoe de motor de offertematrix gebruikt

Voor elke actieve regel met triggerpatroon "offerte-verstuurd":

1. De motor pakt alle offertes met status verstuurd, een verzenddatum en een account, die niet langer dan 30 dagen geleden verstuurd zijn, en waarvan het account door de regel geraakt wordt.
2. Hij slaat een offerte over als er al een open taak met actiesoort bellen, mailen of bezoek aan die offerte hangt (ook een zelf gemaakte), of als de regel voor deze offerte al eens iets opleverde. Eén offerte krijgt dus één opvolging. Een open taak met actiesoort online meeting telt niet mee in die controle, zodat daar een tweede taak naast kan komen.
3. Profielkeuze: de rij met de hoogste ondergrens die niet boven het bedrag ligt. Een offerte zonder bedrag telt als €0. Ligt het bedrag onder de laagste ondergrens, of is de trap leeg, dan geldt de actiesoort van de regel en de accounteigenaar.
4. Contract: staat er een expliciet type op de offerte, dan beslist dat; anders zoekt de motor de trefwoorden contract, overeenkomst of verlenging in titel of offertenummer. Een contract krijgt altijd het kanaal bezoek, ongeacht het bedrag. De zwaarste combinatie (contract boven €100.000) wordt dus een bezoek door de beheerder.
5. Opvolgperiode: de werkdagen uit de matrix, anders de dagen uit de regel, anders 3. De vervaldatum is verzenddatum plus dat aantal werkdagen; zaterdag en zondag tellen niet, feestdagen wel.
6. Uitvoerder: heeft de accounteigenaar zelf de gevraagde rol, dan hij; anders de eerste gebruiker met die rol op alfabetische naam; is er niemand met die rol, dan de accounteigenaar, en dat staat dan in de taakomschrijving.
7. Taaktitel volgt het kanaal, bijvoorbeeld "Bel na over offerte {offerte} bij {account}" of "Bezoek in plannen voor offerte {offerte} bij {account}". De omschrijving noemt verzenddatum, het aantal werkdagen met de toevoeging "volgens de offertematrix", de offertewaarde en de waardeklasse.
8. Een belafspraak krijgt in de lijsten de actiesoort bellen. Dit patroon levert altijd een taak op, ook als de regel "inzicht" zegt.

### Andere lezers van de matrices

- "Wie is er aan de beurt?" op Meetings: loopt het belritme achter, dan stelt het voor A- en B-accounts een "Belafspraak" voor en voor lagere klassen een "Taak in belblok". Loopt het bezoekritme achter en valt het account in een regio met een vaste dag, dan een fysiek bezoek op die dag; anders een online meeting. Offertes boven de mailklasse worden voorgesteld zodra de opvolgperiode in kalenderdagen voorbij is (de motor rekent in werkdagen).
- Accountplannen: het tabblad "Ritme" verdeelt het jaarritme over de maanden van het plan en bewaart de matrixstand bij aanmaken, zodat een latere matrixwijziging niet met terugwerkende kracht "gemist" oplevert.
- Dagstart en verdieping van Dex tellen de belmomenten uit de belmatrix en de te plannen afspraken uit de afspraakmatrix voor het gekozen venster.
- Segmentregels lezen per account het bel- en bezoekritme per jaar en het opvolgkanaal van de zwaarste open offerte.

### De afrekening op de Account analyse

- Contact: per accounttype en klasse een doel van jaartotaal × (vensterdagen / 365) × aantal accounts, afgerond. Gehaald is het aantal afgeronde taken van het type bellen, mail of bericht in het venster op die accounts. Achter is doel min gehaald, minimaal 0. Dit is een optelling per rij: één account met tien belletjes kan drie stille accounts maskeren. Ook mail en bericht tellen mee tegen de belmatrix. De middelste KPI heet nog "Doel volgens de contactmatrix", de oude naam.
- Offerte: per waardeklasse alle open offertes (verstuurd, gelezen, besproken). Een offerte telt als opgevolgd zodra er op het account een niet-geannuleerde taak bestaat die na de offertedatum is aangemaakt en die de voorgeschreven actiesoort heeft of van het type bellen of mail is. Die controle is ruim: een mailtje telt ook voor een klasse die een bezoek voorschrijft. De contractregel wordt hier niet toegepast, en het periodefilter beperkt de offertes niet, hoewel de voetnoot "volgens de matrix in ≤ 90 dagen" zegt.
- Accounts zonder klasse tellen niet mee en worden apart gemeld.

### AI

Geen. Al het rekenwerk in deze feature is vast en voorspelbaar; de AI komt pas in beeld als een taak later een concept of briefing krijgt.

## Gegevens

Alles staat per organisatie in de tabel met organisatie-instellingen, elk onder een eigen sleutel. De motor leest ze één keer per run.

### Accountklassen (sleutel accountfases)

- Code (code): korte sleutel, bijvoorbeeld A.
- Naam (label): bijvoorbeeld Corporate.
- Omschrijving (omschrijving): optioneel.

In de app heet het "accountklasse", in de opslag nog "accountfase". Dat is bewust zo gelaten om geen datamigratie over alle organisaties te hoeven doen. Op het account staat de code in het veld accountfase.

### Belmatrix (sleutel belmatrix) en afspraakmatrix (sleutel afspraakmatrix)

Een lijst rijen met:

- Accounttype (accounttype): klant of prospect, alleen bij de belmatrix.
- Soort afspraak (afspraaksoort): meeting of bezoek, alleen bij de afspraakmatrix.
- Klasse (klasse): de klassecode.
- Vier aantallen: per maand (maand), per kwartaal (kwartaal), per halfjaar (halfjaar), per jaar (jaar).

Bij het lezen geldt: staat er niets opgeslagen, dan de standaardmatrix; staat er een lijst, dan alleen de geldige rijen. Een kapotte instelling laat de motor nooit omvallen.

### Offertematrix (sleutel offerteOpvolging)

- Ondergrens (drempel): in centen, inclusief.
- Kanaal (kanaal): mailen, bellen, bezoek, belafspraak of online-meeting.
- Uitvoerder (rol): accountmanager, salesmanager of beheerder.
- Opvolgperiode (opvolgDagen): 1 tot 60 werkdagen, of afwezig.
- Toelichting (omschrijving).

Niets opgeslagen betekent de standaardtrap; een lege lijst is een bewuste keuze ("stuur niet op orderwaarde") en wordt niet teruggezet. Dubbele ondergrenzen worden bij het lezen samengevoegd, de laatste wint.

### Overig

- De oude sleutel contactmatrix (jaarevaluaties, kwartaalgesprekken en telefonische rondes per klasse) bestaat nog in de lijst toegestane sleutels maar wordt niet meer gelezen. Het handboek en enkele helpteksten spreken nog van "contactmatrix" en "vier secties".
- Segmentdefinities hebben een eigen opslag met naam, kort label, beschrijving, kleur, combinatiewijze en regels.
- Een nieuwe organisatie krijgt klassen, belmatrix, afspraakmatrix en offertematrix als echte instelling mee, zodat de beheerder vanaf dag één ziet wat hij verzet.
- Wat de motor schrijft: een taak met titel, reden, bewijs, vervaldatum, eigenaar, actiesoort, eventueel de offerte (quoteId) en het lopende accountplan (accountplanId), plus een regel in de runadministratie per regel en onderwerp.

## Wat dit betekent voor Dealtrace

- Neem het principe over dat de matrix inrichting is en de regels uitvoering, met een zichtbaar afgeleid ritme ("12×/jaar = elke 4 weken") naast elke rij. Dat leest snel en voorkomt discussie.
- Maak de matrix voor new business zelfstandig werkend: een ritme dat je invult moet direct taken opleveren, zonder dat er ook nog een losse ritme-regel moet bestaan. In DealDrive doet de belmatrix in de motor niets zolang die regel ontbreekt.
- Splits voor new business niet alleen op klant en prospect, maar op de fase van de prospect (nog niet benaderd, in gesprek, offerte uit) en op binnendienst tegenover buitendienst: de binnendienst belt en mailt, de buitendienst bezoekt.
- Laat het onderscheid tussen "niet ingesteld" en "bewust uit" zichtbaar zijn in het scherm, in plaats van beide als nullen te tonen.
- Neem de offertetrap over (kanaal, uitvoerder en werkdagen op bedrag, contracten altijd face-to-face), maar reken de afrekening even streng als de motor: alleen het voorgeschreven kanaal telt als opgevolgd, en contracten volgen dezelfde uitzondering.
- Reken de afrekening per account in plaats van als optelling per klasse, zodat één veelgebeld account een stil account niet verbergt.
- Voeg een meetingritme toe dat echt taken of afspraakvoorstellen maakt; in DealDrive is de meeting-rij nog inrichting zonder uitvoering.
- Laat zelf toegevoegde klassen overal kiesbaar zijn, ook in segmentregels, en neem bij het hernoemen van een klassecode de matrixrijen mee.
