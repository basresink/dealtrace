# Meetings

## Wat het is en waarvoor

Meetings (route /meetings) is het dagscherm voor gesprekken die niet op locatie plaatsvinden: online meetings, online demo's, webinars, belafspraken en intern overleg. Waar Bezoeken de vraag "waar moet ik heen?" beantwoordt, beantwoordt Meetings "wie moet ik spreken?". Voor de binnendienst is dit het primaire werkscherm, want die heeft aan een kaart niets.

De pagina heeft twee delen. Bovenaan staat de planning: je komende meetings per dag, met de vorm als gekleurde chip, een directe link "Deelnemen ↗" en de klantkaart. Daaronder staat de meetinglijst "Wie is er aan de beurt?": voorstellen voor het volgende gesprek, berekend uit de ritmes die de organisatie al heeft ingericht (belmatrix, afspraakmatrix met regiodag, offerte-opvolging). Elk voorstel draagt een advies over de vorm (belafspraak, online meeting, fysiek bezoek of een taak in je belblok) en één knop om het meteen in te plannen.

Voor een accountmanager binnendienst is dit de plek waar hij zijn week aan gesprekken overziet en aanvult. Voor een accountmanager buitendienst is het de tegenhanger van /bezoeken voor alles wat online of telefonisch gaat. Een salesmanager ziet hier geen teamweergave; die kijkt via de meeting-analyse en de Account analyse.

Samenhang met andere features:

- Leest afspraken (dezelfde tabel als /bezoeken, ander type), accounts met hun klasse en contactdatums, contactpersonen, offertes, de belmatrix en afspraakmatrix (Instellingen, accountritme), de offertematrix en de gebiedsindeling.
- Schrijft nieuwe afspraken en wijzigingen via dezelfde afspraakflyouts als /bezoeken, inclusief herinneringen, verslagen en Pitstop-concepten.
- Een voltooide meeting werkt de contactdatums op het account bij, behalve bij intern overleg: dat telt nergens als klantcontact.

## Waar je het vindt

- Zijbalk, groep "Activiteiten", menu-item "Meetings" (camera-icoon), direct onder "Bezoeken" en boven "Belblokken".
- Route /meetings. Met /meetings?id=[afspraak-id] opent meteen de flyout van die meeting, ook als die buiten het periodefilter valt (een meeting van vorige maand is zo nog te openen). De globale zoekoverlay gebruikt dit.
- Functievlag "meetings" (groep Dagritme, standaard aan, afgedwongen). Uit betekent: geen menu-item, en /meetings en /meeting-analyse zijn geblokkeerd. Geen rolbeperking.
- Andere ingangen: de zoekoverlay, de agenda (een meeting openen in de agenda opent dezelfde flyout) en het helpcenter.
- Vanaf deze pagina ga je naar /bezoeken (link in de subtitel), /agenda (knop "Agenda"), /meeting-analyse (knop "Meeting-analyse"), /belblokken (voorstel met advies belblok) en de klantkaart.

## Opbouw van de pagina

![Meetings met de dagrail: belafspraak morgen met accentrand, online meetings met Deelnemen](shots/meetings-1-pagina.png)

### Kop

- Kicker: "Meetings · komende 30 dagen", met de gekozen periode in kleine letters. Bij "Vandaag" staat de datum ("wo 14 okt"), bij een eigen van-tot "eigen periode". Zijn er vandaag meetings, dan volgt "· 2 vandaag".
- Titel (vast): "Elk gesprek op het juiste moment."
- Subtitel: "Online meetings, belafspraken en intern overleg rond je klanten. Voor bezoeken op locatie is er Bezoeken." (met link).
- Knoppen rechtsboven: zoekknop (globale zoekoverlay), "+ Afspraak" (opent de nieuwe-afspraakflyout met "Online meeting" voorgeselecteerd), "Filters" (met teller voor het aantal afwijkingen van de ruststand) en "Agenda". Het handboek noemt de knop "+ Meeting"; op het scherm staat "Afspraak".

### Dagrail

Per dag een kop met "Vandaag", "Morgen" of een korte datum ("vr 16 okt") en het aantal ("1 meeting", "2 meetings"). Daaronder per meeting een kaart:

- links de begintijd en de duur ("10:00", "60 min"); zonder tijd "Tijd" en "nog te plannen";
- een vormchip met het label van het type: "BELAFSPRAAK", "ONLINE MEETING", "ONLINE DEMO", "WEBINAR", "ACCOUNTOVERLEG" of "OVERIG", gekleurd per vormgroep (online, bel, intern);
- de titel van de afspraak;
- een subregel met account en contactnamen, en bij intern overleg de toevoeging "· telt niet als klantcontact";
- de links "Deelnemen ↗" (alleen met meeting-link, opent in een nieuw tabblad) en "Klantkaart" (alleen met account).

De hele kaart is klikbaar (ook met Enter) en opent de afspraakflyout; de twee links openen niet de flyout. De eerstvolgende meeting krijgt een gele accentrand. "Eerstvolgend" is de eerste meeting waarvan de eindtijd nog niet voorbij is, dus een lopende meeting houdt de rand.

### Twee lege staten

- Staat er wel iets in de planning maar niet binnen het filter: kicker "NIETS BINNEN DIT FILTER", titel "Geen meetings binnen dit filter.", de tekst "Er staan wel 6 meetings in de planning, maar niet in de gekozen vorm of periode." en de knop "Filters wissen".
- Staat er echt niets: kicker "NIETS GEPLAND", titel "Geen meetings in de planning.", uitleg over agenda en Outlook of Google Agenda, en de knop "+ Eerste meeting".

![Lege staat binnen een filter met de knop Filters wissen](shots/meetings-3-lege-staat-filter.png)

### Meetinglijst: Wie is er aan de beurt?

![De meetinglijst met voorstellen uit de belmatrix en de knop + Plan belafspraak](shots/meetings-4-wie-is-aan-de-beurt.png)

Kicker "Meetinglijst", titel "Wie is er aan de beurt?", uitleg "Wie je vandaag inplant, hoef je morgen niet achterna. Zet elk gesprek met één klik vast in de vorm die het advies aangeeft." Rechts de knop "Meeting-analyse" met de tooltip "Bekijk de meetingdekking per accountklasse".

Elke rij (witte kaart, groene linkerrand) toont:

- een naam: "contact · account" als er een aanspreekpunt is, anders het account; bij een offerte "Offerte OFF-2026-0119 · IBM Hoofdkantoor NL". De naam linkt naar de klantkaart.
- een reden in gewone taal, bijvoorbeeld "Klasse A (klant): bellen elke 30 dagen. Laatste call 59 dagen geleden."
- een adviesschip: "BELAFSPRAAK", "Taak in belblok", "Online meeting", "Fysiek · dinsdag Regio Oost", "Gesprek aan tafel" of "Belafspraak vandaag".
- rechts één knop die bij het advies hoort: "+ Plan belafspraak", "+ Plan meeting", "+ Plan bezoek" (link naar /bezoeken) of "Naar belblok" (link naar /belblokken).

Maximaal acht rijen. Lege staat: "Niemand loopt achter op zijn ritme en er wacht geen offerte op een gesprek. Zo hoort het." In de demodata komen alle acht voorstellen uit de belmatrix (A-klanten die te lang niet gebeld zijn); er is geen gebiedsindeling, dus het advies "fysiek" via de regiodag verschijnt daar niet.

## Doorklikken: de stappen

### Je komende gesprekken doornemen en deelnemen

1. Klik in de zijbalk op "Meetings". De pagina opent op de komende 30 dagen, alle vormen.
2. De eerstvolgende meeting heeft een gele rand. Klik op "Deelnemen ↗" om de vergaderlink in een nieuw tabblad te openen, zonder de flyout.
3. Of klik op de kaart zelf. De afspraakflyout opent met "Open meeting" als hoofdknop in de voet, en "Volledige briefing" als icoon ernaast.

### Een voorstel inplannen

1. Scrol naar "Wie is er aan de beurt?" en lees de reden en het advies.
2. Klik op "+ Plan belafspraak" (of "+ Plan meeting"). De flyout "Plan een afspraak in" opent met type, klant en, als bekend, contactpersoon voorgevuld.
3. Vul titel, datum en tijd in en klik op "✓ Plan afspraak". Toast "Afspraak ingepland."; de afspraakflyout van de nieuwe meeting opent.
4. Het voorstel verdwijnt uit de lijst zodra het account een geplande afspraak in de toekomst heeft (ook als dat een bezoek is).

![Plan een afspraak in, geopend vanuit een voorstel: type Belafspraak en klant al ingevuld](shots/meetings-5-plan-belafspraak.png)

### Een nieuwe online meeting aanmaken

1. Klik rechtsboven op "+ Afspraak". De flyout opent met "Online meeting" als type.
2. Kies klant en contactpersoon, titel, datum, tijd en duur.
3. Klik onder "Meeting-link" op "Google Meet" of "Microsoft Teams". Dat zet een startlink in het veld; open die link om de vergadering aan te maken en plak daarna het definitieve adres erover.
4. Nodig eventueel collega's uit; zij krijgen elk een eigen kopie in hun agenda.
5. Klik op "✓ Plan afspraak".

### Een herinnering instellen

1. Open de meeting via de kaart en klik in de voet op het potlood ("Bewerken").
2. Vink "Herinnering instellen" aan. Kies bij "Vóór de afspraak" een tijd (standaard 30 minuten) en bij "Versturen via" het kanaal (standaard "In-app notificatie").
3. Klik op "✓ Opslaan". In de detailweergave staat nu "Herinnering" met moment en kanaal.

### Een gevoerd gesprek vastleggen

1. Open de meeting na afloop en plak of upload het transcript in "Transcript & gespreksverslag" (een Teams- of Zoom-transcript als .vtt of .srt kan direct).
2. Klik op "Opslaan en analyseer →". Het verslagvenster opent met samenvatting, actiepunten, koopsignalen en bezwaren.
3. Maak taken van de actiepunten met "+ Taak".
4. Rond de meeting af via het potlood: "Status" op "Voltooid" en "✓ Opslaan". Daarmee verdwijnt hij van /meetings (die toont alleen geplande meetings) en worden de contactdatums op het account bijgewerkt.

## Flyouts, vensters en knoppen

/meetings gebruikt dezelfde twee flyouts als /bezoeken: "Plan een afspraak in" voor nieuw, en de afspraakflyout voor detail en bewerken. De volledige veldbeschrijving staat in het hoofdstuk Bezoeken; hieronder alleen wat voor meetings anders is.

### Plan een afspraak in, vanuit Meetings

![Nieuwe online meeting met de knoppen Google Meet en Microsoft Teams onder Meeting-link](shots/meetings-6-nieuwe-meeting.png)

- Het type is voorgeselecteerd: "Online meeting" via de kopknop, of het type van het voorstel ("Belafspraak" of "Online meeting").
- Bij een type uit de groep "Meeting" zegt de kop "Verschijnt in je agenda en op Meetings." en is de voorbeeldtekst bij "Locatie" "Bv. Zoom / Teams". De afspraak krijgt de online-vlag.
- Het veld "Meeting-link" verschijnt alleen bij Online meeting, Online demo en Webinar, niet bij een belafspraak of accountoverleg. Onder het veld staan "Google Meet" (zet https://meet.google.com/new), "Microsoft Teams" (zet de Teams-link voor een nieuwe vergadering) en, als er iets staat, "Wissen". Er wordt geen echte vergadering aangemaakt; de knoppen zetten alleen een startlink. Een hint legt uit dat je het definitieve adres erover plakt.
- Herhaling (wekelijks, om de week, maandelijks) is hier vooral nuttig voor vaste overleggen; elke herhaling wordt een losse afspraak.

### Afspraakflyout van een meeting

![Afspraakflyout van een online meeting met Open meeting als hoofdknop](shots/meetings-7-flyout.png)

- Kicker met type en status, bijvoorbeeld "ONLINE MEETING · GEPLAND".
- In de definitielijst staat "Meeting" met "Open meeting-link ↗".
- De voet heeft "Open meeting" als hoofdknop (opent de link in een nieuw tabblad); "Volledige briefing" wordt dan een icoon naast "Vraag AI", "Bewerken", "Verwijderen" en "Open klantkaart".
- Pitstop, verslagblok, bewerken en verwijderen werken zoals bij een bezoek.

### Herinnering (in de bewerkstand)

![Bewerkstand van een meeting met Herinnering instellen aangevinkt](shots/meetings-8-herinnering.png)

- Alleen te zetten in de bewerkstand van een bestaande afspraak, niet bij het aanmaken.
- "Herinnering instellen" (vinkje) klapt twee keuzelijsten open. "Vóór de afspraak": 5 minuten, 15 minuten, 30 minuten (standaard), 1 uur, 4 uur, 1 dag, 2 dagen. "Versturen via": In-app notificatie (standaard), E-mail, Beide.
- Opslaan bewaart het absolute moment (begintijd min de voorsprong) en het kanaal. Verandert het moment, dan wordt de verzonden-vlag teruggezet, zodat een nieuwe e-mail weer kan. Vinkje uit wist moment en kanaal.
- Bij opnieuw openen rekent het formulier de voorsprong terug uit het bewaarde moment.

### Wat een herinnering doet

- In-app: zolang DealDrive open staat, kijkt de app 6 seconden na het laden en daarna elke 30 seconden naar je eigen taken en afspraken. Is een herinnering verlopen (maximaal 24 uur geleden), en staat de afspraak niet op voltooid, geannuleerd of niet verschenen, dan verschijnt een pop-up en een melding in de bel: "Herinnering: [titel]" met "Online meeting begint [moment]." De melding wordt in de browser bewaard, zodat hij na verversen niet terugkomt.
- E-mail: een geplande taak op de server draait elke 5 minuten, alleen op de HQ-site, en stuurt een mail naar je eigen gekoppelde postvak, ook als de app dicht is. Eerst wordt de vlag gezet, dan verzonden, zodat er geen dubbele mail komt. Dit werkt alleen bij een via SMTP gekoppelde mailbox (Microsoft- en Google-mail nog niet) en als op de HQ-site het motorgeheim staat.
- Beide sporen respecteren je meldingsvoorkeuren: staat de categorie "Herinnering" uit of zit je in je stille uren, dan komt hij (nog) niet door.
- Herinneringen gaan alleen naar de eigenaar van de afspraak. Een collega met een kopie heeft een eigen afspraak en dus een eigen herinnering, die bij het aanmaken niet wordt meegezet.

## Filters, zoeken, sorteren en weergaven

![Het filterpaneel met Vorm en Periode, Online gekozen](shots/meetings-2-filters-vorm.png)

Het filterpaneel achter "Filters" heeft twee groepen.

| Groep | Pillen | Teller |
|---|---|---|
| Vorm | Alles, Online, Belafspraak, Intern | aantal geplande meetings vanaf vandaag per vorm, zonder periodegrens |
| Periode | Vandaag, Morgen, Komende 7 dagen, Week erna, Komende 14 dagen, Komende 30 dagen, Periode | aantal binnen het venster, binnen de gekozen vorm |

- Vormgroepen: "Online" bevat Online meeting, Online demo, Webinar en Overig; "Belafspraak" alleen belafspraken; "Intern" alleen Accountoverleg.
- De periodes rollen vanaf vandaag, net als op /bezoeken. "Periode" toont "Van" en "Tot" (standaard vandaag tot over dertien dagen, geen teller); een "Van" na "Tot" schuift "Tot" mee.
- Ruststand: "Alles" en "Komende 30 dagen". De teller op de filterknop telt elke afwijking: een andere vorm telt 1, een andere periode (ook een eigen periode) telt 1.
- "Filters wissen" zet beide terug naar de ruststand; die knop staat alleen in de lege staat, niet in het paneel zelf.
- Niets komt in de URL behalve ?id=.
- Sorteren is vast: chronologisch op begintijd, gegroepeerd per dag. De voorstellen staan op gewicht (zie Regels).
- Er is geen zoekveld op de pagina; de zoekknop opent de globale zoekoverlay.
- De vormfilter en periode werken alleen op de dagrail, niet op de voorstellen.

## Regels en berekeningen

### Welke afspraken meetellen

- Types: Online meeting, Belafspraak, Online demo, Webinar, Accountoverleg (intern) en Overig. Lunch telt bij /bezoeken. Daarmee zijn de twee pagina's elkaars complement.
- Alleen status "Gepland" en een begintijd vanaf vandaag 00:00. Een meeting van vanochtend die al voorbij is maar op "Gepland" staat, blijft dus staan tot je hem afrondt; een voltooide verdwijnt meteen. Dat verschilt van /bezoeken, dat ook voltooide bezoeken blijft tonen.
- Bereik: organisatiebreed. De lijst bevat alle afspraken van accounts in jouw organisatie (en afspraken zonder account), niet alleen die van jou.

### Intern overleg

Een Accountoverleg hangt wel aan een account, maar telt bij afronden niet als klantcontact: de contactdatums van het account worden niet bijgewerkt. De kaart zegt dat met "telt niet als klantcontact". In de analyses tellen interne meetings nergens mee. De briefingtelling van contactmomenten telt een voorbije interne afspraak echter wel mee (zie het hoofdstuk Briefings).

### Afronden

Zet je een meeting op "Voltooid", dan wordt laatste actie (lastInteractionAt) de begintijd. Bij een belafspraak wordt ook laatste call (lastCallAt) gezet. Online meetings, demo's en webinars zetten geen laatste bezoek. Annuleren of niet verschenen maakt ook hier een agenda-inzicht "Gat in je agenda", met vervangende bezoekkandidaten, ook als het om een belafspraak ging.

### Wie is er aan de beurt: de drie bronnen

De voorstellen worden in de browser berekend, zonder AI, uit dezelfde gedeelde regels als de motor. Een account doet alleen mee als het een accountklasse heeft en geen geplande afspraak in de toekomst. Per account komt er hoogstens één voorstel uit de ritmes.

1. Belmatrix. Het belritme per accounttype (klant of prospect) en klasse wordt omgerekend naar een interval: 365 gedeeld door het aantal keer per jaar, afgerond. Dagen sinds de laatste call (laatste call, anders laatste actie) groter dan het interval betekent achter. Klasse A of B krijgt het advies "Belafspraak", een lagere klasse "Taak in belblok". Gewicht: dagen achter, plus 100 voor A en B.
2. Afspraakmatrix met regiodag. Alleen als het belritme niet achterloopt. Het ritme komt uit de bezoekrij van de afspraakmatrix voor die klasse; dagen sinds laatste bezoek (anders laatste actie) groter dan het interval betekent achter. Valt het account in een regio met een vaste weekdag, dan is het advies "Fysiek · dinsdag Regio Oost" met de reden "… En dinsdag is je vaste dag in Regio Oost: ga langs in plaats van bellen." (gewicht dagen achter plus 50). Zonder regiodag: "Online meeting" met "Plan een online review." (gewicht dagen achter). De commentaar in de code spreekt van "meeting en bezoek samen", maar alleen de bezoekrij wordt gelezen; de meetingrij van de afspraakmatrix speelt hier geen rol.
3. Offerte-opvolging. Offertes met status verstuurd of gelezen. Het opvolgprofiel hangt aan het bedrag (standaard: tot €10.000 mailen, €10.000 tot €50.000 bellen na 3 dagen, vanaf €50.000 een bezoek na 5 dagen, vanaf €100.000 belt de directeur na 2 dagen). Mailprofielen blijven bij de motor en komen hier niet. Pas als de opvolgtermijn (kalenderdagen sinds verzenden) verstreken is en het account geen geplande afspraak heeft, volgt een voorstel: bij bezoek "Gesprek aan tafel", anders "Belafspraak", en na meer dan 5 dagen "Belafspraak vandaag". Gewicht: 200 + dagen open + het bedrag per €10.000 (maximaal 100). Offertes staan daardoor bijna altijd bovenaan.

Alle voorstellen samen worden op gewicht gesorteerd en afgekapt op acht.

Wat daaruit volgt:

- Een account zonder enige contactdatum (nooit gebeld, nooit bezocht, geen laatste actie) levert nooit een voorstel op, want "dagen sinds" is dan onbekend. Nieuwe prospects zonder historie komen dus niet in deze lijst.
- Een account zonder accountklasse doet niet mee.
- Het advies "fysiek" linkt naar /bezoeken zonder account of type voor te vullen; je moet het account daar zelf opnieuw zoeken. "Naar belblok" linkt naar /belblokken, zonder het account toe te voegen.
- Het aanspreekpunt is het eerste contact van het account met een e-mailadres of telefoonnummer, niet per se de beslisser.

### Pitstop en verslag

Werken zoals bij bezoeken. Voor een Online meeting maakt de Pitstop een meeting-briefing ("wat speelt er, 3 agendapunten, gewenst resultaat"), voor een Belafspraak een belscript ("opening met de concrete aanleiding, 2-3 verdiepende vragen, voorstel voor de vervolgstap"). Online demo en Webinar staan niet in de lijst en krijgen een algemene voorbereiding. De Pitstop vraagt een database en pakket Plus of Compleet.

## Gegevens

Een meeting is een gewone afspraak (tabel appointments) met hetzelfde record als een bezoek; zie het hoofdstuk Bezoeken voor alle velden. Voor meetings zijn vooral van belang:

- type (type: online-meeting, belafspraak, online-demo, webinar, intern, overig);
- online-vlag (online), automatisch gezet bij een type uit de groep Meeting;
- meeting-link (meetingUrl), alleen bewaard bij online meeting, online demo en webinar; verandert het type naar iets anders, dan vervalt de link bij opslaan;
- herinnering: moment (reminderAt), kanaal (reminderChannel) en verzonden-vlag (reminderSent);
- deelnemers (attendees met naam, e-mail en status uitgenodigd, geaccepteerd, afgewezen of voorlopig), getoond als "4 · 2 bevestigd";
- herhalingsreeks (reeksId) en uitnodiger (uitgenodigdDoor) voor collega-kopieën.

De voorstellen lezen van het account: klasse (accountfase), segment en soort (klant of prospect), postcode, plaats en land (voor de regio), en laatste call, laatste bezoek en laatste actie. Van een offerte: status, verzenddatum (sentAt, anders uitgiftedatum), bedrag (totalValue in centen), referentie en contact. De ritmes komen uit de organisatie-instellingen: belmatrix, afspraakmatrix, offertematrix ("offerteOpvolging") en gebieden. Herinneringsmeldingen in de app worden in de browser bewaard; e-mailherinneringen gaan via de koppeling van de gebruiker.

## Wat dit betekent voor Dealtrace

- Overnemen: de splitsing "waar moet ik heen" en "wie moet ik spreken" over twee schermen die samen de agenda zijn. Voor binnendienst new business is een scherm zonder kaart, met de gesprekken van vandaag en een lijst "aan de beurt", precies het juiste werkblad.
- Overnemen: het vormadvies per voorstel (belafspraak, online, fysiek, belblok). Dat dwingt af dat niet elk contact een agendaslot wordt, en dat is voor een volle binnendienstagenda waardevol.
- Anders: laat de lijst ook prospects zonder historie voorstellen. Nu valt elk account zonder laatste actie of laatste call stil weg, terwijl dat voor new business juist de doelgroep is. Neem de prospectplanning, campagnes en de leadgenerator als bron mee.
- Anders: een herinnering instellen bij het aanmaken, niet alleen achteraf in de bewerkstand, en een standaardherinnering per type (bijvoorbeeld 15 minuten bij een belafspraak).
- Anders: echte vergaderingen aanmaken via de agendakoppeling (Teams of Google Meet) in plaats van een startlink die je zelf moet vervangen.
- Anders: maak "+ Plan bezoek" en "Naar belblok" echte overdrachten met het account erbij, zodat een binnendienstmedewerker een fysiek bezoek kan klaarzetten voor de buitendienst op diens regiodag.
- Repareren bij overname: de knop heet "Afspraak" maar het handboek zegt "+ Meeting"; kies één woord. Lees ook de meetingrij van de afspraakmatrix, niet alleen de bezoekrij.
- Ontbreekt: een directe "afronden"-knop na de meeting met uitkomst en vervolgstap, en een teamweergave voor de manager ("welke meetings staan er deze week bij mijn team, en welke zijn niet afgerond").
