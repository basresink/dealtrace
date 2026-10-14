# Belblokken

## Wat het is en waarvoor

Belblokken maakt van bellen een vast tijdvak in je agenda in plaats van iets wat je tussendoor doet. Het blok is de eenheid: een uur (of langer) waarin je achter elkaar een reeks gesprekken voert. Wie het blok vult is een keuze. Je zet er zelf een Top 5, 10 of 15 uit de bellijst in, je kiest losse accounts, of je laat een vast blok door de motor op de server vullen met de urgentste beltaken.

Voor een accountmanager lost het twee problemen op. Ten eerste de vraag "wie bel ik nu": de pagina zet alle belkandidaten in één rangorde, met per regel de reden en een geschatte gesprekstijd. Ten tweede de vraag "wanneer bel ik": de pagina rekent uit hoe lang je selectie duurt, telt er een marge voor uitloop bij en stelt tijdvakken voor uit je agenda en je vaste ritme. Wat niet in het gekozen blok past, schuift door naar je eerstvolgende vaste blok.

Voor een salesmanager is het vooral een ritmemiddel. Vaste blokken (bijvoorbeeld maandag en woensdag van 09:00 tot 10:00) leggen vast dat er structureel gebeld wordt. Een gepland blok is een gewone afspraak van het type belafspraak, dus het telt mee in de agenda en de rapportage, en een afgewerkt gesprek registreert gewoon een contactmoment op het account. Er is geen aparte belregistratie naast de bestaande.

In de week valt de feature op twee momenten. Wekelijks of eenmalig stel je je vaste blokken in. Dagelijks plan je vanuit de bellijst een blok in, of open je het blokdetail van een vast blok om te zien wie je gaat bellen.

Samenhang met andere features:

- Leest open taken (beltaken), accounts (score, segment, signalen, aanleiding, laatste contact) en contactpersonen. De rangorde komt uit dezelfde rekenfunctie als de bellijst op Bezoeken, zodat een Top 5 op beide pagina's dezelfde vijf accounts zijn.
- Schrijft afspraken van het type belafspraak en wijzigt de vervaldatum (dueDate) van beltaken, of maakt nieuwe beltaken aan voor kandidaten zonder beltaak.
- Leest je vaste blokken en je lunchvoorkeur uit je gebruikersrecord; die worden ook door de vuller op de server en door de agenda-feed (ICS) gelezen.
- De agenda (/agenda) kleurt een belafspraak die op een vast blok valt zwart en een los gepland blok geel.
- Vandaag (de Dex-dagstart) toont bij een beltaak de knop "Start het belblok", en Meetings heeft bij een belvoorstel de knop "Naar belblok". Beide gaan naar /belblokken.

## Waar je het vindt

Menu: zijbalk, groep "Activiteiten", item "Belblokken" (icoon telefoon), tussen "Meetings" en "Prospectplanning". Route: /belblokken. De paginatitel in de browser is "Belblokken · DealDrive".

Zichtbaarheid hangt aan de functievlag "belblokken" (groep Dagritme, label "Belblokken", uitleg "Belblokken plannen vanuit de bellijst."). De vlag staat standaard aan en wordt afgedwongen: staat hij voor een organisatie uit, dan verdwijnt het menu-item en stuurt de routebewaking /belblokken door naar de startpagina. Er is geen rolbeperking: elke gebruiker met de vlag ziet de pagina, ook een buitendienstmedewerker.

Andere ingangen:

- Vandaag (dagstart, laag Dex): als de focus een beltaak is en de vlag aanstaat, staat er "Start het belblok".
- Meetings: bij een voorstel met advies bellen staat de knop "Naar belblok".
- Het helpcentrum heeft een instructie "De bellijst en je belblokken" met de knop "Naar belblokken".
- Vanaf /belblokken zelf linkt "Agenda →" in het planpaneel naar /agenda.

## Opbouw van de pagina

De pagina heeft drie lagen onder elkaar: de kop, het deel "Vanuit de bellijst" (bellijst links, planpaneel rechts) en het deel "Vaste belblokken". Er is geen weekrooster meer op deze pagina; dat is in augustus 2026 verwijderd omdat /agenda het beter toont.

![De paginakop met de bellijst en het planpaneel bij binnenkomst, Top 5 geselecteerd](shots/belblokken-1-pagina.png)

### Kop

- Kicker: "Activiteiten · Bellen".
- Titel: "Een blok is een blok. Wie het vult, kies jij."
- Subtitel: "Vaste belblokken die zichzelf vullen, én de mogelijkheid om er nu een Top 5 in te schuiven. Wat niet past schuift door naar het eerstvolgende blok."
- Rechts, onderaan uitgelijnd: een zoekknop (vergrootglas, opent de globale zoekoverlay), de gele knop "+ Taak" (opent de algemene flyout Nieuwe taak) en de zwarte knop "+ Afspraak" (opent de algemene flyout Nieuwe afspraak).

Er zijn geen statkaarten op deze pagina.

### Bellijst vandaag (links)

Een paneel met de kop "Bellijst vandaag" en rechts vier schakelknoppen: "Top 5", "Top 10", "Top 15" en "Zelf kiezen". Bij binnenkomst staat "Top 5" aan en zijn de eerste vijf geselecteerd.

Er staan altijd maximaal 15 rijen (zodat Top 15 zijn eigen nummers kan tonen). Elke rij is een knop met:

- Een rangnummer (1 tot 15).
- Alleen bij "Zelf kiezen": een vinkvakje.
- De accountnaam, vet.
- Een metaregel: de contactpersoon (beslisser of champion eerst, anders iemand met een telefoonnummer, anders de eerste; zonder contact staat er "geen contactpersoon"), dan de reden, dan de geschatte duur, bijvoorbeeld "Damian Tracey · Kee Safety: bel UK-account-manager over team-uitbreiding · achterstallig sinds 9 okt · 8 min".
- Rechts een pil, alleen als het account open taken heeft: "Urgent" (rood) als een van de eerste drie open taken urgent is, "Kans" (oranje) bij een taak met hoge prioriteit, anders "Opvolging" (grijs).

Geselecteerde rijen hebben een lichtgele achtergrond; bij een Top-keuze worden de niet-geselecteerde rijen grijs weergegeven.

De reden komt uit twee bronnen. Bij een account met een open beltaak is het de titel van de eerste beltaak plus de vervalstatus ("achterstallig sinds 9 okt", "vandaag", "16 okt" of "geen datum"). Bij een aanvullend account zonder beltaak is het de aanleiding op het account (trigger), en anders een zin als "At-risk · proactief herstellen", "Hot prospect · opening starten", "Geen contact in 73 dagen · heractiveren" (bij meer dan 60 dagen) of "Score 88 · vervolggesprek".

Lege staat: "Geen belkandidaten: er staan geen open beltaken en alle accounts zijn recent gesproken." In de praktijk komt die zelden voor, omdat de lijst altijd wordt aangevuld met accounts.

Let op: ondanks de kop "Bellijst vandaag" filtert de lijst niet op vandaag. Beltaken met een latere datum of zonder datum staan er ook in, alleen lager.

### Belblok plannen (rechts)

Een geel omrand paneel met de kop "Belblok plannen", rechtsboven de link "Agenda →" en daaronder de teller "5 gesprekken geselecteerd" (of "1 gesprek geselecteerd").

![Bellijst en planpaneel met de adviezen uit je agenda; het eerstvolgende vaste blok is al gekozen](shots/belblokken-2-bellijst-en-plannen.png)

Blokken in het paneel, van boven naar beneden:

- "Advies uit je agenda": maximaal vijf knoppen, chronologisch. Elke knop toont het moment ("Vandaag 14:30-16:00", "Morgen 08:00-09:30", "vrijdag 16 okt 15:00-16:00") en een toelichting: "vrij in je agenda" of "vast blok · Kantoor (belhok)". Het gekozen advies is zwart met gele tekst. Zonder advies staat er "Geen vrij gat gevonden in de komende dagen. Kies hieronder zelf een tijdstip."
- Daaronder het vinkje "Niet tijdens de lunch (12:00 tot 13:00)", standaard aan. Dit is een persoonlijke voorkeur die direct bewaard wordt.
- "Of kies je eigen tijdstip": een datumveld (niet vóór vandaag) en twee tijdvelden met "tot" ertussen. Een hulpregel zegt "Je volgt een advies. Pas een veld aan en je bepaalt het zelf." of "Je bepaalt het zelf. Klik een advies hierboven om die tijd over te nemen."
- "Waar": keuzelijst met "Thuis (werkkamer)", "Kantoor (belhok)" en "Onderweg (handsfree)".
- Een rekenblok met drie regels: "Geschatte gesprekstijd" (som van de geschatte minuten van de selectie), "Marge voor uitloop" en "Blok" (de lengte van het gekozen tijdvak, of zonder gekozen tijdvak de berekende blokduur).
- Een waarschuwing als iets niet klopt (zie Regels) of als er gesprekken niet passen: "1 gesprek past niet in dit blok en schuift door naar je vaste blok van maandag 19 okt 09:00." of, zonder volgend vast blok, "... en blijft in de bellijst staan: er is geen vast blok om naar door te schuiven."
- Twee vinkjes, allebei standaard aan: "Zet mijn agenda op bezet" en "Onderdruk mijn notificaties tijdens het blok".
- De grote knop "Zet in mijn agenda" (tijdens het opslaan "Bezig…"), grijs zolang er niets geselecteerd is of de tijd niet klopt.
- Een voetregel als er iets geselecteerd is: "De 5 taken worden aan het blok gekoppeld. Afvinken doe je straks in het blok zelf."

Het rekenblok toont bij "Blok" de lengte van het gekozen tijdvak, niet wat de selectie nodig heeft. Met Top 10 staat er bijvoorbeeld 102 minuten gesprek plus 30 minuten marge boven een "Blok" van 60 minuten, met de melding dat 6 gesprekken doorschuiven. De voetregel blijft dan "De 10 taken worden aan het blok gekoppeld", wat niet helemaal klopt: 4 komen in dit blok, 6 in het volgende vaste blok.

![Top 10 gekozen: 102 minuten gesprek past niet in een blok van 60 minuten, 6 gesprekken schuiven door](shots/belblokken-3-top10-doorschuiven.png)

### Vaste belblokken

Een tweede sectie met hetzelfde kop-patroon als de pagina:

- Kicker "Vaste belblokken", titel "Ritme dat zichzelf vult.", subtitel "Wie zijn belmomenten vastlegt, hoeft er niet elke dag opnieuw over te beslissen. Het ritme doet het werk."
- Rechts de gele knop "+ Vast blok".

Per vast blok een kaart met:

- Een klikbare kop met het moment, bijvoorbeeld "Maandag & woensdag 09:00-10:00", en eronder soort en plek: "Opvolging en ritme · Thuis (werkkamer)".
- Rechts een schakelaar met de tekst "Vult zichzelf" (aan) of "Ik vul zelf" (uit), en de tekstknop "Verwijderen".
- Een uitlegregel die met de schakelaar meeverandert. Aan: "De motor vult dit blok met de urgentste beltaken die erin passen: achterstallig eerst, dan op prioriteit. Wat jij er zelf inzet blijft staan, en een blok zonder kandidaten wordt niet aangemaakt." Uit: "Blijft leeg tot jij hem vult. De app zet er wel kandidaten bij, maar plant niets in."

Een nieuwe gebruiker begint niet leeg maar met twee standaardblokken: maandag en woensdag van 09:00 tot 10:00, "Opvolging en ritme", "Thuis (werkkamer)", vult zichzelf; en vrijdag van 15:00 tot 16:00, "Koude acquisitie", "Kantoor (belhok)", ik vul zelf.

Lege staat zonder vaste blokken: "Nog geen vaste blokken. Dat mag. Dan werkt alleen de bellijst hierboven: kies een Top 5 en plan hem in wanneer het uitkomt."

### Blokdetail

Klik je op de kop van een vast blok, dan klapt eronder het blokdetail open (nog een klik klapt het dicht; er is er maar één tegelijk open). Het detail zoekt de belafspraak van deze week (maandag tot en met zondag) op dezelfde weekdag en dezelfde starttijd, bij voorkeur de eerstvolgende vanaf nu en anders de laatste van deze week.

Vindt het geen afspraak, dan staat er: "Deze week staat er nog geen afspraak op dit blok. Zodra de motor hem vult (of jij hem via de bellijst hierboven vult), zie je hier wie je moet bellen."

![De vaste blokken met het opengeklapte detail van een blok waar deze week nog niets op staat](shots/belblokken-4-vaste-blokken-detail.png)

Met een afspraak toont het detail:

- Kop: "Vrijdag 15:00-16:00 · Belblok".
- Subregel: plek, "agenda op bezet" of "agenda vrij", "notificaties stil" of "notificaties aan", en "2 van de 5 plekken gevuld".
- Een vulbalk met "20 van 60 min".
- Per gesprek een regel met een tijd (de starttijd, dan steeds 10 minuten later), de accountnaam als link naar de klantkaart, contactpersoon en reden, en rechts de pil "Urgent" of "Kans" als de taak die prioriteit heeft.
- Een stippellijnregel voor de vrije ruimte: "40 minuten vrij", "Er staan 4 kandidaten klaar die hier in passen." en de zwarte knop "Vul aan". Past er geen enkele kandidaat meer, dan staat er "Nog 10 minuten vrij, maar geen kandidaat die daar in past: het kortste gesprek duurt langer."
- Een voetregel: "Dit blok vult zichzelf: de motor zet er de urgentste gesprekken in zodra er ruimte is. Wat jij er zelf inzet blijft staan." of "Dit blok vult zichzelf niet. Zet er gesprekken in via de bellijst hierboven."

![Het blokdetail na het inplannen van twee gesprekken, met 40 minuten vrij en de knop Vul aan](shots/belblokken-7-blokdetail-gevuld.png)

## Doorklikken: de stappen

### Een Top 5 in je agenda zetten

1. Open /belblokken. "Top 5" staat aan en de eerste vijf rijen zijn geel gemarkeerd. Rechts staat "5 gesprekken geselecteerd" en het eerstvolgende vaste blok is al als advies gekozen; datum, begin- en eindtijd en plek zijn ingevuld.
2. Kijk naar het rekenblok. Bij de demodata is dat 54 minuten gesprek plus 15 minuten marge tegen een blok van 60 minuten, dus verschijnt "1 gesprek past niet in dit blok en schuift door naar je vaste blok van maandag 19 okt 09:00."
3. Kies eventueel een ander advies (bijvoorbeeld "Vandaag 14:30-16:00 · vrij in je agenda", dat al op de benodigde 90 minuten is berekend). De velden worden overschreven en de melding verdwijnt als alles past.
4. Laat "Zet mijn agenda op bezet" en "Onderdruk mijn notificaties tijdens het blok" aan of zet ze uit.
5. Klik "Zet in mijn agenda". De knop toont "Bezig…". Eerst krijgt elke beltaak die past de blokstart als vervaldatum, en voor kandidaten zonder beltaak wordt een nieuwe beltaak "Bellen: [account]" gemaakt. Daarna wordt de belafspraak aangemaakt, bijvoorbeeld "Belblok · 4 gesprekken · bezet". Wat niet past krijgt de start van het volgende vaste blok als vervaldatum.
6. Een melding rechtsonder bevestigt: "Blok gepland met 4 gesprekken. 1 schuift door naar je vaste blok van maandag 19 okt 09:00." De selectie wordt leeggemaakt en de keuze springt op "Zelf kiezen".

### Zelf een paar accounts kiezen

1. Klik "Zelf kiezen". De selectie wordt leeg en elke rij krijgt een vinkvakje. (Klik je in een Top-selectie op een rij, dan schakelt de pagina ook naar "Zelf kiezen", maar houdt de bestaande selectie vast en haalt de aangeklikte rij eruit of erbij.)
2. Klik de rijen aan die je wilt bellen. De teller en het rekenblok werken direct bij.
3. Klik een advies, of vul zelf datum, begin- en eindtijd in. Zodra je een veld aanraakt, laat het advies los en zegt de hulpregel "Je bepaalt het zelf."
4. Klik "Zet in mijn agenda". De melding is "Blok gepland met 2 gesprekken."

### Een vast blok aanmaken

1. Klik in de sectie "Vaste belblokken" op "+ Vast blok". De flyout "Vast blok plannen" schuift van rechts in beeld.
2. Klik een of meer dagen aan ("ma" tot en met "vr"). Zonder dag blijft de knop "Vast blok toevoegen" grijs.
3. Kies starttijd en duur. Loopt het blok door de lunch heen terwijl je lunch vrij wilt houden, dan verschijnt "Dit blok loopt door de lunch heen (12:00 tot 13:00)." Dat is een melding, geen blokkade.
4. Kies "Soort gesprekken" en "Plek".
5. Klik "Vast blok toevoegen". Bij succes sluit de flyout, verschijnt "Vast blok toegevoegd." en staat het blok in de lijst met de schakelaar op "Vult zichzelf". Bij een fout blijft de flyout open met "Vast blok kon niet worden bewaard."

### Zien wie je in een vast blok belt en aanvullen

1. Klik op de kop van een vast blok, bijvoorbeeld "Vrijdag 15:00-16:00". Het blokdetail klapt open.
2. Lees de gesprekken met hun tijden. Klik op een accountnaam om naar de klantkaart te gaan.
3. Is er ruimte en passen er kandidaten, klik dan "Vul aan". De hoogst gerangschikte kandidaten die nog niet in het blok zitten en samen in de vrije minuten passen, krijgen de blokstart als vervaldatum. Melding: "3 gesprekken toegevoegd aan het blok."

### Een vast blok uitzetten of verwijderen

1. Klik de schakelaar "Vult zichzelf" om er "Ik vul zelf" van te maken. De wijziging gaat direct naar de server; lukt dat niet, dan springt de schakelaar terug met "Wijziging kon niet worden bewaard."
2. Klik "Verwijderen". Er verschijnt een bevestigingsvenster; pas na "Verwijderen" is het blok weg ("Vast blok verwijderd.").

## Flyouts, vensters en knoppen

### Flyout "Vast blok plannen"

Opent via "+ Vast blok" rechts van de sectiekop. Het paneel schuift van rechts in over een donkere achtergrond; de pagina eronder scrolt niet mee.

- Kop: kicker "Vaste belblokken", titel "Vast blok plannen", regel "Komt elke gekozen dag terug en vult zichzelf met beltaken." Rechtsboven een sluitkruisje.
- "Dagen" (verplicht): vijf knoppen "ma", "di", "wo", "do", "vr", meerdere tegelijk mogelijk. Standaard geen dag gekozen. Hulpregel: "Kies één of meer dagen. Het blok komt daar elke week terug."
- "Starttijd": keuzelijst in halfuurstappen van 08:00 tot en met 19:00, standaard 09:00. Met het lunchvinkje aan vallen 12:00 en 12:30 weg.
- "Duur": keuzelijst "30 min", "60 min", "90 min", "120 min (2 uur)", "180 min (3 uur)", "240 min (4 uur)", standaard 60.
- Lunchmelding (alleen als van toepassing): "Dit blok loopt door de lunch heen (12:00 tot 13:00)."
- "Soort gesprekken": "Opvolging en ritme" (standaard), "Koude acquisitie", "Gemengd".
- "Plek": "Thuis (werkkamer)" (standaard), "Kantoor (belhok)", "Onderweg (handsfree)".
- Knoppen onderaan: "Annuleren" (sluit zonder opslaan) en "Vast blok toevoegen" (tijdens opslaan "Bezig…").

Sluiten kan met het kruisje, "Annuleren", een klik naast het paneel of Escape. Er is geen veld voor de schakelaar: een nieuw blok staat altijd op "Vult zichzelf". Na succes wordt het formulier teruggezet op de standaardwaarden.

![De flyout Vast blok plannen met dinsdag gekozen en de lunchmelding bij 11:30 en 90 minuten](shots/belblokken-5-flyout-vast-blok.png)

### Bevestiging "Vast blok verwijderen?"

Opent via "Verwijderen" op een vaste-blokkaart. Een rood gemarkeerd venster in het midden met de titel "Vast blok verwijderen?" en de tekst "Vast blok maandag & woensdag 09:00-10:00 verwijderen? De motor plant er dan geen beltaken meer in." Knoppen "Annuleren" en een rode "Verwijderen". Na bevestigen: "Vast blok verwijderd." of "Blok kon niet worden verwijderd." Bestaande belafspraken en taken blijven staan; alleen het ritme verdwijnt.

![Het bevestigingsvenster bij het verwijderen van een vast blok](shots/belblokken-6-bevestiging-verwijderen.png)

### Knop "Zet in mijn agenda"

Actief zodra er minstens één gesprek geselecteerd is, de tijdvelden kloppen en er niet al iets wordt opgeslagen. Mogelijke meldingen:

- Succes: "Blok gepland met N gesprekken.", eventueel aangevuld met "N schuift door naar je vaste blok van [dag] [tijd]." en "N gesprekken zijn niet ingepland: er is geen vast blok om naar door te schuiven."
- Fout: "Geen enkel gesprek kon aan het blok worden gekoppeld.", "Blok kon niet worden aangemaakt." of "Inplannen mislukte."

### Knop "Vul aan" in het blokdetail

Alleen zichtbaar als er vrije minuten zijn en minstens één kandidaat past. Meldingen: "N gesprekken toegevoegd aan het blok.", "Geen kandidaat die nog in de vrije ruimte past." (informatief) of "Er kon geen gesprek aan het blok worden toegevoegd."

### Vinkje "Niet tijdens de lunch"

Wordt direct bewaard bij je vaste blokken. Lukt dat niet, dan springt het vinkje terug met "Voorkeur kon niet worden bewaard." Het geldt voor de vrije adviezen in het planpaneel en voor de starttijden in de flyout.

### Algemene flyouts "+ Taak" en "+ Afspraak"

Dit zijn de algemene flyouts van DealDrive, hier alleen voor het gemak bereikbaar. "+ Taak" opent "Nieuwe taak" met de vraag "Wat moet er gebeuren?" en zonder voorinvulling; de velden staan beschreven bij de prospectplanning (knop "Bel"). "+ Afspraak" opent de flyout Nieuwe afspraak.

### De belafspraak in de agenda

Een gepland blok verschijnt op /agenda in het weekrooster. Valt het op de dag en starttijd van een van je vaste blokken, dan is het zwart met gele tekst ("Vast belblok"); anders geel ("Los belblok"). Overlapt het met een andere afspraak, dan staat er "CONFLICT" op. Lege vaste blokken zie je op /agenda niet, omdat een vast blok pas een afspraak wordt als er gesprekken in staan. In de persoonlijke agenda-feed (ICS) voor Google Agenda of Outlook staan vaste blokken wel, als wekelijks herhalende afspraak met "Belblok" en de soort in de titel (opvolging, koude acquisitie of gemengd), met de omschrijving "Vast belblok uit DealDrive (...). Wordt automatisch gevuld met beltaken." of "Vul je zelf."

![De agenda met het geplande belblok op vrijdag 15:00 als zwart vast belblok, met conflictmelding](shots/belblokken-8-agenda.png)

## Filters, zoeken, sorteren en weergaven

De pagina heeft geen filters en geen eigen zoekveld. De zoekknop in de kop opent de globale zoekoverlay van de app, die niets op deze pagina filtert.

De enige weergavekeuze is de selectie in de bellijst: "Top 5", "Top 10", "Top 15" of "Zelf kiezen". Die bepaalt welke accounts geselecteerd zijn, niet welke rijen zichtbaar zijn: er staan altijd 15 rijen. De volgorde is vast (de rangorde hieronder) en niet om te draaien.

Niets van de keuze komt in de URL. Na het herladen van de pagina staat de selectie weer op Top 5 en is het eerstvolgende vaste blok weer als advies gekozen.

## Regels en berekeningen

### De rangorde van de bellijst

De bellijst wordt in de browser opgebouwd uit twee lagen. Beltaken staan altijd boven de aanvulling.

Laag 1 is open beltaken (taaktype bellen of actiesoort bellen, status open of bezig, met een account). Per account worden de beltaken gebundeld en gesorteerd op vervaldatum, dan op prioriteit. De bovenste bepaalt de score:

- Urgentie: 100 als de taak achterstallig is (vóór vandaag), 80 als hij vandaag vervalt, 50 als hij later vervalt, 40 zonder datum.
- Prioriteitsgewicht: urgent 4, hoog 3, middel 2, laag 1.
- Score = 1000 + urgentie x 10 + prioriteitsgewicht x 20 + accountscore.

Laag 2 is de aanvulling: alle overige accounts (klanten en prospects) zonder open beltaak, zodat de lijst nooit halfleeg staat.

- Score = accountscore + signaalbonus (5 per signaal, maximaal 20) + takenbonus (4 per open taak, maximaal 15) + 15 bij een "hete" aanleiding of 5 bij een waarschuwing.

Beide lagen worden aflopend op score gesorteerd. Op /belblokken worden accounts die vandaag bezocht worden niet overgeslagen (op /bezoeken wel).

### De geschatte gesprekstijd

Per kandidaat: 8 minuten, of 12 als een van de taken urgent is; plus 2 bij een accountscore van 70 of hoger; plus 2 als er meer dan één taak is. Een kandidaat duurt dus 8 tot 16 minuten.

### Marge, blokduur en wat past

- Marge voor uitloop = een kwart van de gesprekstijd, naar boven afgerond op 5 minuten. Bij 54 minuten is dat 15, bij 102 minuten 30.
- Benodigde blokduur (voor de vrije adviezen) = gesprekstijd plus marge, naar boven afgerond op een half uur, minimaal 30 minuten. 54 + 15 = 69 wordt 90; 102 + 30 = 132 wordt 150.
- Wat past: de kandidaten worden in volgorde opgeteld, en bij elke stap telt de marge over het opgetelde deel mee. De eerste kandidaat waarbij gesprek plus marge de bloklengte overschrijdt, en alles daarna, schuift door. Past zelfs de eerste niet, dan wordt die er toch in gezet (minimaal één gesprek per blok).

### Adviezen uit je agenda

- Vaste adviezen: de eerstvolgende drie momenten van je vaste blokken binnen 14 dagen, vanaf nu.
- Vrije adviezen: per werkdag in de komende 10 dagen het eerste gat waarin de benodigde blokduur past, met een maximum van drie. Bezet zijn de afspraken die de app lokaal kent (elke afspraak minimaal 15 minuten), je vaste blokken op die weekdag en, als je lunch vrij wilt houden, 12:00 tot 13:00. Zoeken begint om 08:00 (vandaag op het eerstvolgende kwartier) en een blok mag uiterlijk om 19:00 beginnen en niet over middernacht lopen.
- De twee lijsten worden samengevoegd, chronologisch gesorteerd en afgekapt op vijf.
- Bij binnenkomst wordt één keer het eerstvolgende vaste blok gekozen, ook als er eerder een vrij gat is. Daarna verandert de pagina je velden niet meer zelf.

Wat niet meetelt: bezet-tijden uit een gekoppelde externe agenda (Google of Microsoft), geannuleerde afspraken worden niet uitgezonderd, en de afspraken worden niet op eigenaar gefilterd. Het advies kan dus een gat voorstellen dat in Outlook al bezet is.

### Controles op het tijdvak

De meldingen boven de knop, in deze volgorde: "Kies een datum voor het blok.", "Vul een begin- en een eindtijd in." en "De eindtijd moet minstens een kwartier na de begintijd liggen." Zolang een van deze geldt, is "Zet in mijn agenda" grijs. Er is geen controle op een datum of tijd in het verleden: vandaag om 09:00 mag ook als het al middag is.

### Wat het inplannen schrijft

- Per kandidaat in het blok: heeft hij een open beltaak, dan krijgt die de blokstart als vervaldatum (dueDate). Heeft hij er geen, dan wordt een nieuwe taak gemaakt: titel "Bellen: [account]", type bellen, actiesoort bellen, bron handmatig, de contactpersoon en de reden uit de bellijst, vervaldatum de blokstart.
- Daarna één afspraak: titel "Belblok · N gesprekken", met " · bezet" erachter als het vinkje aanstaat; type belafspraak; start en eind uit de velden; locatie de gekozen plek; status gepland; omschrijving een regel per account ("[account]: [reden]"); reden "Belblok · agenda: bezet · notificaties: stil" (of "agenda: vrij" en "notificaties: aan").
- De kandidaten die niet passen, krijgen de start van het eerstvolgende vaste blok na het gekozen tijdvak als vervaldatum (of een nieuwe beltaak met die datum). Is er geen volgend vast blok, dan gebeurt er niets met ze.

De twee vinkjes hebben verder geen werking. "Zet mijn agenda op bezet" staat alleen in titel en reden. "Onderdruk mijn notificaties tijdens het blok" wordt alleen vastgelegd: de pushmeldingen bestaan nog niet en niets leest dit veld.

### Hoe het blokdetail rekent

- Een taak hoort bij het blok als het een open beltaak is waarvan de vervaldatum binnen een uur vóór of na de blokstart ligt. Er is geen echte koppeling tussen taak en afspraak; het is een tijdvergelijking.
- Elk gesprek telt in het detail voor 10 minuten, ongeacht de schatting. De tijden lopen dus 15:00, 15:10, 15:20.
- Plekken = de bloklengte gedeeld door 12, naar beneden afgerond (een uur geeft 5), of het aantal gesprekken als dat hoger is.
- Vrije minuten = bloklengte min 10 per gesprek. "Kandidaten die hier in passen" telt de kandidaten die nog niet in het blok zitten, op volgorde, zolang hun geschatte minuten (zonder marge) samen in de vrije minuten passen.
- Alleen deze week wordt gezocht. Een blok dat je voor maandag over een week vult, zie je hier niet.

Dit wijkt af van de planning: daar telt een gesprek 8 tot 16 minuten plus marge, hier vast 10 minuten zonder marge.

### De vuller op de server

Vaste blokken met de schakelaar op "Vult zichzelf" worden gevuld door de motor. De geplande motorrun draait elk uur (alleen op de beheeromgeving van DealDrive, en alleen met database). Per organisatie draait eerst de regelmotor, die nieuwe beltaken kan opleveren, en daarna de vuller. Een fout bij de ene organisatie stopt de andere niet.

Per run:

- Op zaterdag en zondag gebeurt niets.
- Per gebruiker worden de geldige vaste blokken gelezen waarvan de schakelaar aanstaat en die vandaag op de weekdag vallen. Blokken die vandaag al afgelopen zijn, worden overgeslagen; een blok dat al begonnen is maar nog loopt, wordt nog wel gevuld.
- De vuller zoekt een bestaande belafspraak van die gebruiker op precies de starttijd. Alleen belafspraken tellen: een klantgesprek op hetzelfde tijdstip wordt niet omgedoopt.
- Taken van die gebruiker met precies de blokstart als vervaldatum gelden als al ingepland. Hun geschatte minuten (8 of 12, plus 2 bij score 70 of hoger) gaan van de bloklengte af. Blijft er minder dan 8 minuten over, dan stopt het voor dat blok.
- Kandidaten zijn de open beltaken van die gebruiker met een account dat nog niet in het blok zit, en die niet al binnen een uur van deze starttijd vallen. Rang = 1000 als de taak achterstallig is + prioriteitsgewicht x 100 + accountscore.
- De vuller loopt de kandidaten af en neemt elke kandidaat die nog in de resterende ruimte past (een te lange kandidaat wordt overgeslagen, een kortere daarna kan nog). Er wordt geen marge gerekend.
- Komt er niemand bij, dan maakt de vuller geen afspraak (regel "geen leeg blok").
- Anders wordt de bestaande afspraak hernoemd naar "Belblok · N gesprekken" (totaal), of een nieuwe gemaakt met een voorspelbaar id (gebruiker, datum, blok), de plek van het vaste blok en de reden "Automatisch gevuld vast blok (09:00-10:00)". De gekozen taken krijgen de blokstart als vervaldatum.

Drie regels sturen dit: nooit een tweede afspraak (bestaat hij al, dan wordt hij aangevuld), handmatig wint (wat al in het blok staat blijft staan) en geen leeg blok. Een regressietest controleert 11 gevallen, waaronder dubbel draaien, andere dagen, handmatig behouden en binnen de blokduur blijven.

Verschillen met de pagina: de vuller kijkt alleen naar beltaken van de gebruiker zelf (de pagina toont alle taken die de app kent en vult aan met accounts zonder beltaak), negeert taken met status bezig, telt de bonus voor meerdere taken niet mee en rekent geen marge. De "Soort gesprekken" van een vast blok (opvolging, koude acquisitie, gemengd) wordt nergens gebruikt bij het kiezen van kandidaten: een blok "Koude acquisitie" wordt gevuld met dezelfde urgentste beltaken als een opvolgblok. Een door de vuller gemaakte afspraak heeft geen bezet- of stiltevlag, dus het detail toont "agenda vrij · notificaties aan". Het handboek spreekt van een ochtendrun; in de code is het een uurlijkse run.

### Lunch

De lunch ligt vast op 12:00 tot 13:00 en is niet instelbaar, wel uit te zetten. Met lunch vrij schuiven vrije adviezen om dat uur heen en vallen de starttijden 12:00 en 12:30 weg bij een nieuw vast blok. Een bestaand blok om 12:00 blijft staan.

### Opslag zonder database

In de mockmodus bewaart de server vaste blokken en de lunchvoorkeur in het geheugen van het proces, per gebruiker en organisatie. Na een herstart staan de standaardblokken er weer. De vuller draait in de mockmodus niet. Ingeplande blokken en taken leven in de mockmodus alleen in de browser.

## Gegevens

### Vast blok (in het gebruikersrecord, veld belblokken)

| Veld | Betekenis | Waarden |
|---|---|---|
| id | Sleutel van het blok | "vb-" plus tijdstempel |
| dagen | Weekdagen | 1 maandag tot 5 vrijdag, minimaal één |
| start | Starttijd | 08:00 tot 19:00 |
| minuten | Duur | 30, 60, 90, 120, 180 of 240 |
| plek | Waar je belt | vrije tekst, in de app drie keuzes |
| soort | Soort gesprekken | opvolging, koud, gemengd |
| automatisch | Vult de motor hem | ja of nee |

Ze staan per gebruiker in de JSON-kolom van de gebruikerstabel (users.data.belblokken), niet in een eigen tabel. Daarnaast staat daar de voorkeur belblokVoorkeuren met één veld, lunchVrij (standaard aan). De server accepteert maximaal 20 blokken en weigert ongeldige blokken met "Een of meer blokken zijn ongeldig: kies een dag, een starttijd tussen 08:00 en 19:00 en een duur van 30, 60, 90, 120, 180, 240 minuten." Plek en soort worden bij opslaan niet gecontroleerd. Lezen en schrijven gaat via /api/mij/belblokken; de gebruiker komt altijd uit de sessie, nooit uit het verzoek.

### Belafspraak (afsprakentabel)

Een gewone afspraak met: titel ("Belblok · N gesprekken", eventueel " · bezet"), type (belafspraak), start (startAt) en eind (endAt), locatie (location, de plek), status (gepland), omschrijving (description, een regel per account) en reden (reason, met de vlaggen "agenda: bezet/vrij" en "notificaties: stil/aan"). De vlaggen staan bewust als tekst in de reden en niet in eigen velden.

### Beltaak (takentabel)

Gebruikt: type (call) of actiesoort (actionType bellen), status, prioriteit, vervaldatum (dueDate, die bepaalt in welk blok de taak valt), account, contactpersoon, titel en reden. Een nieuwe taak vanuit de bellijst heeft titel "Bellen: [account]", bron handmatig (source manual) en de reden uit de bellijst.

### Van andere features

- Accounts: score, segment (at-risk, hot-prospect), laatste contact (lastInteractionAt), aantal signalen (signalCount), aantal open taken (openTasks), aanleiding en soort aanleiding (trigger, triggerKind).
- Contactpersonen: rol (beslisser, champion), beslisser-vlag, telefoon en mobiel.
- Taken komen uit de motor (regels die beltaken maken), uit inzichten, uit de flyout Nieuwe taak en uit andere schermen zoals de prospectplanning.

## Wat dit betekent voor Dealtrace

- Overnemen: het blok als eenheid met een vaste plek in de agenda, de rekensom gesprekstijd plus marge, en het doorschuiven van wat niet past naar het volgende vaste blok. Dat maakt acquisitie planbaar voor de binnendienst.
- Anders: laat de "soort" van een blok echt sturen. Een blok "Koude acquisitie" moet gevuld worden met prospects uit de prospectplanning (venster open, nog niet benaderd), niet met de urgentste opvolgtaken van bestaande klanten. Nu verdringt opvolging altijd new business.
- Anders: één rangorde voor pagina en vuller. Nu wijken bron (alle taken tegen alleen eigen taken), duurschatting en marge af, waardoor de pagina iets anders belooft dan de motor doet.
- Anders: koppel taak en blok echt (een blok-id op de taak) in plaats van een tijdvergelijking binnen een uur, en reken in het detail met dezelfde duur als bij het plannen.
- Ontbreekt: externe agendabezetting in de adviezen. Voor een buitendienstmedewerker die tussen bezoeken belt, moet het advies weten waar hij die dag rijdt en wanneer hij in de auto zit ("Onderweg (handsfree)").
- Ontbreekt: uitvoering in het blok. Er is geen belmodus die gesprek na gesprek opent, geen uitkomstregistratie per gesprek (bereikt, voicemail, afspraak, geen interesse) en geen blokresultaat. Voor new business is juist het bereikpercentage per blok de stuurgetal.
- Ontbreekt: managerzicht. Er is geen overzicht van geplande en gehouden belblokken per teamlid; de vlaggen "bezet" en "notificaties stil" doen nu niets en zouden echt moeten werken.
