# Bezoeken

## Wat het is en waarvoor

Bezoeken (route /bezoeken) is het dagscherm van de buitendienst. Het beantwoordt de vraag "waar moet ik vandaag heen, en wie neem ik onderweg mee?". Bovenaan staan je geplande fysieke afspraken op een kaart en in een routelijst per dag. Daaronder staan drie werklijsten: een bellijst voor de tijd tussen de bezoeken, de open bezoektaken die nog een afspraak moeten worden, en accounts in de buurt van je route die je als tussenstop kunt meenemen.

Het principe dat in code en handboek steeds terugkomt: de motor (de Activity Selling-regels) weet wie bezocht of gebeld moet worden, want die maakt taken aan; de agenda weet waar je bent. Deze pagina legt die twee over elkaar. Een accountmanager buitendienst opent hem 's ochtends of de avond ervoor om zijn rit te zien, gaten te vullen en te bellen tijdens reistijd. Een salesmanager heeft hier geen teamweergave; die kijkt via de bezoek-analyse en de Account analyse naar dekking.

Een bezoek is in DealDrive een fysieke afspraak. De pagina telt alleen de afspraaktypes uit de groep "Afspraak" (Gepland bezoek, Ongepland bezoek, Demo, Event, Beurs), plus de oude types Bezoek (klantbezoek) en Lunch. Belafspraken, online meetings, online demo's, webinars en intern overleg staan op /meetings. Samen zijn de twee pagina's precies de agenda: geen afspraak staat op beide.

Wat de feature leest en schrijft:

- Leest: afspraken, accounts (plaats, score, trigger, signalen), taken (beltaken en bezoektaken) en contactpersonen.
- Schrijft: nieuwe afspraken (via de afspraakflyout), wijzigingen en statussen van afspraken, gespreksverslagen en Pitstop-concepten op de afspraak.
- Zet je een afspraak op "Voltooid", dan werkt de app de contactdatums op het account bij (laatste actie, laatste bezoek). Gaat een geplande afspraak naar "Geannuleerd" of "Niet verschenen", dan maakt de app meteen een agenda-inzicht met vervangende kandidaten.

## Waar je het vindt

- Zijbalk, groep "Activiteiten", menu-item "Bezoeken" (kaartspeld-icoon), tussen "Briefings" en "Meetings".
- Route /bezoeken. Met /bezoeken?id=[afspraak-id] opent de pagina meteen de flyout van dat bezoek; zo werkt de globale zoekoverlay.
- Functievlag "bezoeken" (groep Dagritme, standaard aan, afgedwongen in menu en routes). Staat hij uit, dan verdwijnen het menu-item, /bezoeken en /bezoek-analyse. Er is geen rolbeperking: elke rol ziet de pagina.
- De werkplek uit Dex (Kantoor of Onderweg) heeft geen invloed op deze pagina; die hangt aan de organisatievlag, niet aan de persoon.
- Andere ingangen: de link "Bezoeken" in de subtitel van /meetings, de knop "+ Plan bezoek" bij een voorstel met advies "fysiek" op /meetings (die opent alleen de pagina, zonder iets voor te vullen), de zoekoverlay en het helpcenter-artikel "Bezoeken plannen en je regiodag".

## Opbouw van de pagina

![Bezoeken met kaart, routelijst van vandaag en de statistiekstrook](shots/bezoeken-1-pagina.png)

### Kop

- Kicker: "Bezoeken · Vandaag". Het tweede deel volgt de gekozen periode ("Komende 7 dagen") of, bij een eigen periode, het bereik ("21 aug t/m 4 sep").
- Titel volgt het aantal bezoeken in de periode: "Geen bezoeken gepland.", "Eén bezoek op de planning." of "3 bezoeken op de planning."
- Subtitel: "Bezoeken op de kaart, geclusterd op locatie en gesorteerd op tijd. Het volgende bezoek pulseert rood, alle andere stops zijn zwart met gele rand."
- Knoppen rechtsboven: een zoekknop (vergrootglas, opent de globale zoekoverlay), "+ Afspraak" (opent de flyout voor een nieuwe afspraak, zonder voorinvulling), "Filters" (klapt het periodepaneel open; toont een gele teller "1" als de periode niet "Vandaag" is) en "Agenda" (link naar /agenda).

### Kaart

Links staat een kaart: een Google Maps-inbedding zonder API-sleutel, met daaroverheen genummerde spelden per stop in tijdvolgorde. De speld staat op het middelpunt van de plaats van het account (een vast coördinatenregister van Nederlandse plaatsen), niet op het adres. Het volgende bezoek is een rode, pulserende speld met het eerste woord van de accountnaam als label; de andere stops zijn zwart met een gele rand. Middelpunt en zoomniveau (tussen 6 en 10) volgen de spelden, zodat de kaart op de route inzoomt. Onder de kaart staat een legenda: "Volgend bezoek (pulserend)" en "Overige stops". Er wordt geen routelijn getekend.

### Routelijst

Rechts staat per kalenderdag een blok. De dagkop toont de datum in hoofdletters ("WOENSDAG 14 OKTOBER") en rechts het aantal stops en de opgetelde duur ("3 STOPS · 3U"). Per stop:

- Begintijd en duur ("09:00", "1u"). Een afspraak zonder tijd toont "Tijd" en "nog te plannen".
- Het label "VOLGENDE" bij het eerstvolgende bezoek in de hele periode (niet per dag).
- Titel van de afspraak, accountnaam met een gekleurd blokje per segment, locatie en de beschrijving in een grijs vak.
- De hele rij is klikbaar en opent de afspraakflyout.

Lege staat: "Geen bezoeken gepland op deze dag." bij Vandaag en Morgen, anders "Geen bezoeken gepland in deze periode."

### Statistiekstrook

Onder de routelijst staat een zwarte strook met vier cijfers, alleen als er bezoeken zijn:

| Kaart | Wat erin staat | Bron |
|---|---|---|
| Bezoeken | aantal bezoeken in de periode | afspraken na filter |
| Klantcontact | opgetelde duur | eindtijd min begintijd |
| Stad / Steden | aantal unieke plaatsen | plaats van het account |
| Geschat km | geschatte rij-afstand | plaats-tot-plaats, zie Regels |

### Bellijst · vandaag

![De bellijst met Top 5, contactgegevens, open taken en de briefinglink](shots/bezoeken-3-bellijst.png)

Kicker "Bellijst · vandaag" (vast, ook bij een andere periode), titel "Bel-prioriteit naast je bezoeken" en uitleg: "Eén gesprek meer per dag is vijf kansen extra per week. Dezelfde lijst als op Belblokken, zonder de accounts die je vandaag al bezoekt." Rechts de schakelaar "Top 5" en "Top 10". Het handboek noemt ook Top 15; die bestaat in de code niet.

Per rij: rangnummer, accountnaam (link naar de klantkaart), de reden, de contactpersoon met functie (link naar de contactkaart), telefoonnummers als belbare links met de labels "tel" en "mob", of "Geen nummer bekend", of zonder contact "Geen contactpersoon. Voeg er een toe op de klantkaart". Daaronder pillen: "Score 87", "4 signalen", de branche en "1 open taak". Tot drie open taken staan als knoppen met prioriteitskleur en vervaldatum; een klik opent de taakflyout. Rechts staat "Briefing →" naar de volledige briefing van het account.

### Bezoeklijst: Te plannen bezoeken

![Te plannen bezoeken met achterstallige taak en de kansen langs de route](shots/bezoeken-4-bezoeklijst-kansen.png)

Kicker "Bezoeklijst", titel "Te plannen bezoeken", uitleg "Aan tafel bij de klant gebeurt het. Plan elk bezoek met één klik als afspraak, of cluster ze per regio en maak van één rit een volle dag." Rechts de knop "Bezoek-analyse" (naar /bezoek-analyse, dekking per regio).

Elke rij heeft een groene linkerrand en toont de accountnaam (link), de titel van de bezoektaak (klik opent de taakflyout), pillen met plaats, vervaldatum of in rood "ACHTERSTALLIG · 11 OKT", en "SCORE 87". Rechts de knop "+ Plan bezoek". Maximaal acht rijen. Lege staat: "Geen open bezoek-taken. Het bezoekritme is bij."

### Kansen langs de route

Alleen zichtbaar als er in de periode minstens één bezoek is en minstens één kans gevonden wordt. Kicker "KANSEN LANGS DE ROUTE", titel "Accounts vlak bij je bezoeken van vandaag" (het laatste woord volgt de periode). Maximaal vier rijen met nummer, accountnaam en een reden als "Open bezoek-taak: "Bezoek Brons & Veer: kantoorautomatisering doorspreken" · ~20 km van je route (Utrecht)" of "Hot signaal: "…" · zelfde stad". Rechts de knop "+ Tussenstop".

## Doorklikken: de stappen

### Je rit van vandaag doornemen

1. Klik in de zijbalk op "Bezoeken". De pagina opent op "Vandaag" met kaart, routelijst en statistiekstrook.
2. Klik op een stop in de routelijst. De afspraakflyout schuift van rechts in met tijd, locatie, klant in context en de Pitstop.
3. Klik in de voet op "Volledige briefing" om de voorbereiding te lezen, of op het pijltje om de klantkaart te openen. De flyout sluit.

### Een bezoek inplannen uit de bezoeklijst

1. Scrol naar "Te plannen bezoeken" en klik bij een rij op "+ Plan bezoek".
2. De flyout "Plan een afspraak in" opent met de klant al ingevuld. Het type staat bewust leeg ("Kies…").
3. Kies "Gepland bezoek", vul titel, datum, begintijd en duur in, en eventueel locatie en aanleiding.
4. Klik op "✓ Plan afspraak". Toast "Afspraak ingepland.", de flyout sluit en de afspraakflyout van het nieuwe bezoek opent. Valt de datum binnen de gekozen periode, dan staat hij direct op de kaart en in de routelijst. De bezoektaak zelf blijft open; die vink je apart af.

### Een tussenstop toevoegen

1. Kijk onder "Kansen langs de route" welke accounts vlak bij je route liggen en waarom.
2. Klik op "+ Tussenstop". Dezelfde flyout opent met alleen de klant voorgevuld; type, tijd en titel kies je zelf.
3. Sla op met "✓ Plan afspraak". Valt de nieuwe afspraak binnen de gekozen periode, dan valt het account uit de kansenlijst, want het staat nu in je route.

### Een bezoek vastleggen en afronden

1. Open het bezoek in de routelijst en scrol in de flyout naar "Transcript & gespreksverslag".
2. Sleep een bestand in het vak, plak tekst of klik op "Spreek je verslag in".
3. Klik op "Opslaan en analyseer →". Het verslag wordt op de afspraak bewaard en het verslagvenster opent met de AI-analyse.
4. Zet actiepunten om met "+ Taak" of "Alle 3 als taak".
5. Het bezoek is daarmee nog niet afgerond. Open het bezoek opnieuw, klik op het potlood ("Bewerken"), zet "Status" op "Voltooid" en klik op "✓ Opslaan". Pas dan worden laatste actie en laatste bezoek op het account bijgewerkt.

### Een afspraak valt uit

1. Open de afspraak, klik op het potlood en zet "Status" op "Geannuleerd" of "Niet verschenen".
2. Klik op "✓ Opslaan". De afspraak verdwijnt bij "Geannuleerd" uit de route (bij "Niet verschenen" blijft hij staan).
3. Op de achtergrond ontstaat het inzicht "Gat in je agenda · [dag en tijd]" met de drie beste vervangende bezoekkandidaten en een voorgestelde taak "Plan vervangend bezoek: [account]". Je vindt het op /inzichten en Vandaag, waar het dezelfde goedkeuringsketen volgt als elk inzicht.

### Een regiodag vooruit voorbereiden

1. Klik op "Filters" en daarna op de pil "Periode".
2. Kies bij "Van" en "Tot" de dag(en) die je wilt zien, ook maanden vooruit.
3. Kaart, routelijst, statistieken en kansen rekenen met dat venster.

## Flyouts, vensters en knoppen

### Nieuwe afspraak (Plan een afspraak in)

![De flyout Plan een afspraak in, geopend via + Plan bezoek met de klant voorgevuld](shots/bezoeken-7-nieuwe-afspraak.png)

Opent via "+ Afspraak" (leeg), "+ Plan bezoek" en "+ Tussenstop" (klant voorgevuld). Het is één globale flyout die ook vanaf de klantkaart, de agenda en /meetings opent. Kop: kicker "Nieuwe afspraak · [type]", titel "Plan een afspraak in" en een uitleg die met het type meeloopt: bij een bezoek "Verschijnt in de agenda en op de route van die dag.", bij een meeting "Verschijnt in je agenda en op Meetings." Beide eindigen met "Voeg een briefing toe vanuit de klantkaart."

| Veld | Verplicht | Standaard | Opmerking |
|---|---|---|---|
| Klant | nee | leeg of voorgevuld | zoekveld, max 8 suggesties |
| Contactpersoon | nee | leeg | binnen de klant, beslissers eerst |
| Type afspraak | ja | leeg ("Kies…") | twee groepen, zie hieronder |
| Titel | ja | leeg | minimaal 3 tekens |
| Datum, Start | ja | eerstvolgende hele uur | |
| Duur | ja | 1 uur | 15 min tot 3 uur |
| Herhaling | nee | Geen | Wekelijks, Om de week, Maandelijks |
| Herhalen tot | bij herhaling | over 3 maanden | teller "N afspraken in totaal" |
| Collega's uitnodigen | nee | geen | kopie in agenda van collega |
| Locatie | nee | leeg | voorbeeld "bv. Industrieweg 12, Zwolle" |
| Meeting-link | nee | leeg | alleen bij online meeting, online demo, webinar |
| Aanleiding / context | nee | leeg | vrije tekst |
| Beschrijving | nee | leeg | doel en agendapunten |
| Gespreksverslag | nee | leeg | uploaden, plakken of inspreken |

Het type kies je uit één keuzelijst met twee groepen. "Afspraak": Gepland bezoek, Ongepland bezoek, Demo, Event, Beurs. "Meeting": Online meeting, Belafspraak, Online demo, Webinar, Accountoverleg. Op /bezoeken staat het type bewust leeg, omdat een voorgeselecteerd bezoek te makkelijk over het hoofd werd gezien. Contact kiezen zonder klant neemt de klant van dat contact over; een andere klant kiezen wist een contact dat er niet bij hoort.

Herhaling maakt elke datum een losse afspraak met een gedeeld reeks-id (maximaal 52). Maandelijks valt op dezelfde dag van de maand, of de laatste dag als die maand korter is. Uitgenodigde collega's krijgen elk een eigen kopie met hun eigen eigenaar.

Knoppen onderaan: "Annuleren" en "✓ Plan afspraak" (grijs tot titel, type, datum en begintijd geldig zijn; tijdens opslaan "Opslaan…"). Na opslaan: toast "Afspraak ingepland." of "4 afspraken ingepland.", de flyout sluit en de afspraakflyout van de nieuwe afspraak opent. Met "Opslaan en analyseer →" in het verslagblok opent in plaats daarvan het verslagvenster. Een gekoppeld account meldt de klantreis-gebeurtenis "eerste afspraak gepland". Escape, het kruisje en een klik naast het paneel sluiten zonder bevestiging; wat je invulde gaat verloren. Een herinnering stel je hier niet in, alleen achteraf in de bewerkstand.

### Afspraakdetail (de afspraakflyout)

![De afspraakflyout van een bezoek met klant in context, Pitstop en verslagblok](shots/bezoeken-5-afspraakflyout.png)

Opent bij een klik op een stop in de routelijst, en elders vanuit de agenda, de klantkaart en /meetings. Kop: een gekleurde stip, type en status als kicker ("BEZOEK · GEHAD"), de titel en "account · branche". De status heet "Gehad" als de afspraak voorbij is en nog op "Gepland" staat; verder "Gepland", "Voltooid", "Niet verschenen" of "Geannuleerd".

Blokken van boven naar beneden:

- Definitielijst: "Wanneer" (dag, tijd en duur), "Toegewezen aan", "Beschrijving", "Locatie", "Meeting" ("Open meeting-link ↗"), "Deelnemers" (aantal en bevestigd) en "Herinnering" (moment en kanaal). Lege velden verdwijnen.
- "Klant in context": initialen, naam, "Score 72 · Contractwaarde €180k/jr" en de trigger van het account.
- "Wie zit erbij": gekoppelde contacten met functie, klikbaar naar de contactkaart.
- "Doel & voorbereiding": de aanleiding, alleen als die is ingevuld.
- "AI-agent · Pitstop": uitleg en de knop "Start pitstop". Na een concept staan de concepttekst, de statuspil "Pitstop klaar, wacht op jouw goedkeuring", en de knoppen "✓ Keur concept goed", "Kopieer tekst" en "Nieuwe pitstop". Onder het concept: "De agent voert niets uit. Jij keurt goed en voert het gesprek zelf."
- "Transcript & gespreksverslag": zie hieronder.

![Onderste deel van de afspraakflyout met Pitstop en het verslagblok](shots/bezoeken-6-pitstop-verslag.png)

Voet: links de hoofdknop "Open meeting" als er een meeting-link is, anders "Volledige briefing". Rechts iconen met tooltip: "Vraag AI" (opent de AI-chat met de afspraak als context), "Volledige briefing" (alleen als de hoofdknop al "Open meeting" is), "Bewerken" (potlood), "Verwijderen" (prullenbak) en "Open klantkaart" (pijl, niet zichtbaar als je al op die klantkaart bent).

Bewerkstand: dezelfde velden als bij aanmaken, plus "Status" (Gepland, Voltooid, Niet verschenen, Geannuleerd), "Einde" in plaats van "Duur" en het blok "Herinnering instellen" (5 minuten tot 2 dagen vooraf, via In-app notificatie, E-mail of Beide). Herhaling en collega's zijn hier niet te wijzigen. Knoppen "Annuleren" en "✓ Opslaan". Ligt de eindtijd vóór of op de begintijd, dan wordt het einde de begintijd plus een uur. Opslaan geeft geen toast; de flyout toont direct de nieuwe waarden. Escape in de bewerkstand verlaat alleen het formulier.

Verwijderen vraagt eerst bevestiging: titel "Afspraak verwijderen?" met de tekst ""[titel]" wordt definitief verwijderd, inclusief het gespreksverslag." Na akkoord sluit de flyout en verschijnt de toast "Afspraak verwijderd."

### Het bezoekverslag

Het blok "Transcript & gespreksverslag" zit in de afspraakflyout en in de aanmaakflyout. Je sleept een bestand in het vak (".txt, .md, .docx, .pdf of een Teams/Zoom-transcript (.vtt, .srt), maximaal 5 MB"), plakt tekst of spreekt in met "Spreek je verslag in" (alleen als de browser spraakherkenning kent). "Opslaan en analyseer →" bewaart het verslag op de afspraak en opent het verslagvenster. Is er al een verslag, dan toont het blok een fragment, het aantal woorden, "Bekijk analyse & inzichten →" en "Verwijder verslag".

Het verslagvenster toont datum, bron, account, contactpersoon en omvang, en daaronder "AI-analyse": sentiment, samenvatting, "Onderwerpen", "Actiepunten" (per punt "+ Taak", bij meer punten "Alle 3 als taak", en "✓ Staat bij Taken" als het al een taak is), "Koopsignalen", "Bezwaren" en "Voorgestelde opvolging". De herkomstregel zegt "Geanalyseerd door [model]" met "Opnieuw analyseren". Een gemaakte taak krijgt type to-do, bron gespreksanalyse en de reden "Uit gespreksverslag: [titel]"; toast "Taak toegevoegd. Staat bij Taken."

### Taakflyout

Een klik op een taak in de bellijst of de bezoeklijst opent de gewone taakflyout, dezelfde als op de klantkaart. Afvinken, wijzigen en de Pitstop voor taken gebeuren daar.

## Filters, zoeken, sorteren en weergaven

![Het filterpaneel met de periodepillen en hun tellers](shots/bezoeken-2-filter-periode.png)

Er is één filter: de periode, in het paneel achter "Filters". De pillen zijn "Vandaag", "Morgen", "Komende 7 dagen", "Week erna", "Komende 14 dagen" en "Komende 30 dagen", elk met een teller van het aantal bezoeken in dat venster. Alle vensters rollen vanaf vandaag en zijn niet kalendergebonden: "Komende 7 dagen" loopt van vandaag tot en met over zes dagen, "Week erna" van dag 7 tot en met dag 13. De zevende pil "Periode" heeft geen teller en toont twee datumvelden "Van" en "Tot", standaard vandaag tot over dertien dagen. Zet je "Van" na "Tot", dan schuift "Tot" mee.

- De ruststand is "Vandaag". Elke andere keuze zet de teller "1" op de filterknop. Er is geen resetknop; je klikt terug op "Vandaag".
- De periode stuurt de titel, de kaart, de routelijst, de statistiekstrook, de kansen langs de route en, onbedoeld, ook de bellijst (zie Regels).
- Bij een periode van meer dan één dag krijgt elke dag een eigen blok in de routelijst; de kaart toont alle stops van de periode genummerd in tijdvolgorde.
- Niets van de filterstand komt in de URL. Alleen ?id= opent een bezoek.
- Zoeken op de pagina zelf kan niet; de zoekknop opent de globale zoekoverlay.
- Sorteren is vast: routelijst en kaart op begintijd, bellijst op rangscore, bezoeklijst op vervaldatum, kansen op kansscore.
- De enige weergavekeuze is "Top 5" of "Top 10" in de bellijst.

## Regels en berekeningen

### Welke afspraken meetellen

- Types: Gepland bezoek, Ongepland bezoek, Demo, Event, Beurs, Bezoek (oud) en Lunch. De lunch telt bewust hier, zodat /bezoeken en /meetings samen de hele agenda dekken.
- Status: alles behalve "Geannuleerd". Voltooide en niet-verschenen bezoeken blijven dus zichtbaar en tellen mee in de statistieken.
- Bereik: de lijst is organisatiebreed, niet per eigenaar. De pagina leest alle afspraken van accounts in jouw organisatie, ook die van collega's. Hetzelfde geldt voor de taken in de bellijst en de bezoeklijst. Een filter op "van mij" bestaat in de code wel (voor persoonlijke schermen), maar deze pagina gebruikt hem niet.

### Volgend bezoek, duur en kilometers

- Volgend bezoek: het eerste bezoek in de hele periode met een begintijd vanaf nu. Is de dag voorbij, dan is er geen volgend bezoek en pulseert er niets. Een bezoek dat al begonnen is, is niet meer "volgende".
- Klantcontact: de som van eindtijd min begintijd van alle getoonde bezoeken, getoond als "3u 30 min".
- Geschat km: de bezoeken op begintijd gesorteerd; per opeenvolgend paar de afstand tussen de plaatsen van de twee accounts. Afstand is hemelsbreed (haversine) maal een wegfactor van 1,3, afgerond; dezelfde plaats is 0 km. Kent het register een van beide plaatsen niet, dan telt het paar als 80 km. Bij een periode van meerdere dagen telt ook de sprong van de laatste stop van de ene dag naar de eerste van de volgende mee. Er is geen thuisadres of startpunt.

### Bellijst

De rangschikking is dezelfde functie als op /belblokken.

- Beltaak: taaktype "call" of actiesoort "bellen", status open of bezig, gekoppeld aan een account.
- Per account telt de taak met de vroegste vervaldatum (bij gelijke datum de hoogste prioriteit). Urgentie: achterstallig 100, vandaag 80, later 50, geen datum 40.
- Rangscore beltaak: 1000 + urgentie × 10 + prioriteit × 20 + accountscore, met prioriteit urgent 4, hoog 3, middel 2, laag 1. De 1000 zorgt dat beltaken altijd boven de aanvulling staan.
- Aanvulling als er te weinig beltaken zijn: accountscore + min(20, signalen × 5) + min(15, open taken × 4) + 15 bij een hot trigger of 5 bij een waarschuwing. De reden is de trigger van het account, of een vaste zin: "At-risk · proactief herstellen", "Hot prospect · opening starten", "Geen contact in 73 dagen · heractiveren" (boven 60 dagen) of "Score 58 · vervolggesprek".
- Contactpersoon: eerst een beslisser of champion, anders iemand met een telefoonnummer, anders de eerste.
- Uitsluiting: de kop belooft "zonder de accounts die je vandaag al bezoekt", maar de code sluit de accounts uit van alle bezoeken in de gekozen periode. Bij "Komende 30 dagen" valt iedereen die je deze maand bezoekt uit de bellijst.

### Bezoeklijst

- Bezoektaak: actiesoort "bezoek" of taaktype "afspraak", status open of bezig, met account. Ze komen uit de bezoekritme-regels van de motor (in het handboek: elk kwartaal voor A, elk halfjaar voor B), uit de regel "A-klant 90 dagen niet fysiek bezocht" (rekent op laatste bezoek) en uit handmatig aangemaakte taken.
- Sortering op vervaldatum, oudste eerst; taken zonder datum achteraan. Achterstallig betekent een vervaldatum vóór vandaag 00:00. Maximaal acht.

### Kansen langs de route

- Routeplaatsen: de unieke plaatsen van de accounts met een bezoek in de periode.
- Kandidaat: een account met een plaats dat niet al in de route zit, binnen 30 km van de dichtstbijzijnde routeplaats, en met een open bezoektaak of een hot trigger.
- Kansscore: accountscore + 100 (bezoektaak) + 20 (hot) min de afstand in km. De vier hoogste worden getoond.
- Let op: de bezoektaak moet in de bezoeklijst van acht staan. Een bezoektaak op plek negen maakt een account in de buurt geen kans.

### Afronden en contactdatums

Gaat een afspraak naar "Voltooid" (en was hij dat nog niet), met een account en niet van type Accountoverleg, dan zet de app op het account:

- laatste actie (lastInteractionAt) op de begintijd van de afspraak;
- laatste bezoek (lastVisitAt) bij alle types uit de afspraakgroep, Bezoek en Lunch;
- laatste call (lastCallAt) bij een belafspraak.

Een verslag opslaan doet dit niet. Er is ook geen knop "Afronden" in de flyout; het kan alleen via de bewerkstand. De datums voeden de motorregels, zoals "45 dagen geen contact" en "A-klant 90 dagen niet fysiek bezocht".

### Uitgevallen afspraak

Gaat een afspraak van "Gepland" naar "Geannuleerd" of "Niet verschenen", en ligt hij vandaag of later, dan maakt de app een inzicht van type agenda, zonder AI. Kandidaten zijn alle andere accounts in de organisatie met een open bezoektaak, een hot trigger of een afstand tot 30 km van de plaats van de uitgevallen afspraak. Score: accountscore + 100 (bezoektaak) + 20 (hot) min afstand. De drie hoogste komen in de tekst ("1. Brons & Veer Notarissen · open bezoek-taak · ~20 km · Utrecht"). Het inzicht heeft relevantie 75, betrouwbaarheid 100 en de voorgestelde taak "Plan vervangend bezoek: [eerste kandidaat]" met prioriteit hoog en actiesoort bezoek. Per afspraak bestaat er één inzicht: nogmaals annuleren ververst het in plaats van een tweede te maken.

### Pitstop (AI-voorbereiding)

"Start pitstop" vraagt de server om een concept. Dat werkt alleen met een database (anders de melding "Zonder database is de agent niet beschikbaar.") en in pakket Plus of Compleet (anders "De AI-agent zit niet in het pakket van deze organisatie (upgrade naar Plus of Compleet)."). Het concepttype hangt aan het afspraaktype: Bezoek en Lunch geven een bezoek-briefing, Online meeting een meeting-briefing, Belafspraak een belscript, Demo een demo-briefing, Accountoverleg en Overig een algemene voorbereiding. De nieuwere types (Gepland bezoek, Ongepland bezoek, Event, Beurs, Online demo, Webinar) staan niet in die lijst en krijgen daardoor ook de algemene voorbereiding, terwijl het juist de gangbare bezoektypes zijn. Het concept wordt op de afspraak bewaard; goedkeuren zet alleen de status op "goedgekeurd", er wordt niets verstuurd.

### Regiodag

Een regio is een naam met postcodereeksen en plaatsen; postcode gaat voor plaats, buitenlandse postcodes tellen niet mee in de reeksen. Aan elke regio kan één vaste weekdag (maandag tot en met vrijdag) hangen, één regio per dag. De indeling staat als organisatie-instelling "gebieden" en geldt voor het hele team; alleen beheerder en superuser kunnen hem wijzigen op /instellingen/gebieden.

Wat de code niet doet, hoewel helpcenter en handboek het beloven: /bezoeken leest de gebiedsindeling niet. De bezoeklijst en de kansen langs de route houden geen rekening met je regiodag, en er is geen weergave "mijn regiodag". De regiodag wordt alleen gebruikt in de voorstellen op /meetings (advies om langs te gaan in plaats van te bellen) en in de dekkingsanalyses. Het handboek zegt verder dat een accountmanager zijn eigen weekdag per regio kiest; in de code is de weekdag één organisatie-instelling die alleen een beheerder zet. In de demodata is er geen gebiedsindeling.

### Wat de AI doet en niet doet

De pagina zelf is volledig regelgebaseerd: kaart, lijsten, kansen en het agenda-inzicht zijn gratis en voorspelbaar. AI zit alleen achter de Pitstop (op verzoek, als concept) en de verslaganalyse (Claude; zonder koppeling een indicatieve analyse die niet wordt bewaard).

## Gegevens

Een afspraak (tabel appointments) heeft in gewone taal:

- eigenaar (ownerId), titel (title), beschrijving (description) en aanleiding (reason);
- type (type) en status (status: gepland, voltooid, niet-verschenen, geannuleerd);
- begin- en eindtijd (startAt, endAt);
- herinnering: moment (reminderAt), kanaal (reminderChannel: in-app, email, beide) en verzonden-vlag (reminderSent);
- locatie (location), online-vlag (online) en meeting-link (meetingUrl);
- koppelingen: account (accountId), contacten (contactIds, een lijst), deal (dealId), accountplan (accountplanId), deelnemers (attendees met naam, e-mail en status);
- herhaling (reeksId) en uitnodiger (uitgenodigdDoor) bij kopieën voor collega's;
- AI-agent: uitvoerder (executor), status (executorStatus) en concept (draft met soort, tekst en tijdstip);
- verslag (verslag), bestandsnaam (verslagBestandsnaam), bewaarde analyse (verslagAnalyse met sentiment, samenvatting, onderwerpen, actiepunten, koopsignalen, bezwaren, opvolging, tekst-hash, model en datum) en het salescoach-oordeel (dexCoach);
- externe agenda-id's (externalIds) voor Google of Outlook.

Van het account gebruikt de pagina plaats (city), postcode, land, score, segment, trigger en het soort trigger (triggerKind), het aantal signalen en open taken, en de drie contactdatums laatste actie, laatste call en laatste bezoek (lastInteractionAt, lastCallAt, lastVisitAt). Van een taak: type, actiesoort (actionType), status, vervaldatum (dueDate), prioriteit en account.

Opslag: offline eerst. Een wijziging gaat naar het geheugen van de app, naar IndexedDB in de browser en naar een synchronisatiewachtrij die hem naar Postgres (Supabase) schrijft. Nieuwe afspraken gaan, als de agendakoppeling actief is, één voor één naar Google Agenda. De bezoektaken komen van de motor, het agenda-inzicht komt in de tabel signals.

## Wat dit betekent voor Dealtrace

- Overnemen: het idee "motor weet wie, agenda weet waar" en de kansen langs de route. Voor new business buitendienst is "welke prospects liggen binnen 30 km van mijn afspraken" de waardevolste lijst op dit scherm; maak er een hoofdblok van in plaats van een staartje onderaan.
- Anders: echte geocodering op adres en reistijd in plaats van plaatsmiddelpunten met een factor 1,3 en een terugval van 80 km. Laat de dag starten en eindigen op een thuis- of kantooradres en teken de route.
- Anders: maak de regiodag echt werkend. Laat bezoeklijst en kansen filteren op de regio van de gekozen dag, en laat de accountmanager zelf zijn dag per regio kiezen. Nu belooft het helpcenter iets wat het scherm niet doet.
- Anders: één knop "Bezoek afronden" met verslag, uitkomst en volgende stap in één handeling. Nu zijn verslag opslaan en status op "Voltooid" zetten twee losse routes, en het verslag rondt niets af.
- Anders: scope standaard op "mijn afspraken en taken" met een teamschakelaar voor de manager. De organisatiebrede lijsten passen niet bij een team met meerdere buitendienstmensen.
- Repareren bij overname: de bellijst moet alleen de accounts van vandaag uitsluiten, de Pitstop moet de nieuwe bezoektypes kennen, en de kansen moeten alle open bezoektaken lezen, niet alleen de top 8.
- Ontbreekt voor new business: koude prospects zonder taak of trigger komen nergens in beeld. Een laag "ongeplande prospects in dit gebied" (uit de leadgenerator of een doelgroeplijst) maakt van een rijdag een prospectiedag.
- Ontbreekt: binnendienst kan vanuit dit scherm niets voor de buitendienst klaarzetten. Een gedeelde "inplannen voor collega" met regiodag erbij zou het samenspel binnendienst en buitendienst direct ondersteunen.
