# Campagnes

## Wat het is en waarvoor

Een campagne in DealDrive is één gerichte actie over een groep accounts: een belronde, een mailreeks, een bezoektour, een reeks demo's of een mix van kanalen. Elke campagne heeft een soort, een doel, eventueel een einddatum en een lijst accounts. Per account houdt een bord bij waar dat account staat: "Gespot", "Open", "Bezig" of "Klaar".

Voor een accountmanager is de campagne de brug tussen "deze groep wil ik benaderen" en concreet werk in de takenlijst. Hij kiest een segment als startlijst, trekt de accounts die hij oppakt naar Open, en laat DealDrive per account een taak maken. Die taken verschijnen in /taken, in de bellijst van /bezoeken en /belblokken, en kunnen via de Pitstop een belscript krijgen. Rondt hij een taak af, dan springt het account op het bord vanzelf naar Klaar en loopt de voortgangsbalk mee.

Voor een salesmanager is de campagne een meetbare afspraak: een telbaar doel (aantal of percentage accounts klaar), een einddatum en een tempo-oordeel ("Voor op schema", "Op schema", "Achter op schema"). Loopt een actieve campagne te ver achter, dan maakt de motor een inzicht aan met de cijfers en een advies welke drie accounts eerst moeten. Is de einddatum verstreken, dan sluit de motor de campagne af.

De feature valt in de week: een campagne zet je één keer op (maandag, of bij de start van een maand of kwartaal), en daarna werk je dagelijks vanuit de takenlijst. Het bord gebruik je om te verdelen, bij te sturen en terug te kijken.

Samenhang met andere features:

- Leest segmenten (/instellingen/segmenten) als doelgroep, en de accountlijst (klanten en prospects) voor + Accounts.
- Schrijft taken (tabel tasks) bij "Zet om naar taken" en bij "→ Open + taak", met taaktype en actiesoort afgeleid van de campagnesoort.
- Leest taken terug: een afgeronde gekoppelde taak zet het campagne-item op Klaar.
- De motor (Activity Selling-regels) leest actieve campagnes en schrijft een campagnebreed inzicht (type "campagne") met een advies; dat inzicht staat ook op /inzichten.
- Eigen velden met doel "Campagnekaart" uit /instellingen/custom-fields verschijnen in de detailflyout.
- De accountkaart toont in het tabblad "Campagnes" in welke campagnes het account meeloopt.

## Waar je het vindt

- Menu: zijbalk, groep "Activiteiten", item "Campagnes" (icoon megafoon), tussen "Accountplannen" en "Pipeline".
- Routes: /campagnes (lijst met kaarten) en /campagnes/:id (het campagnebord).
- Functievlag: "campagnes" in de groep "Accounts & campagnes", standaard uit. Staat de vlag uit, dan verdwijnt het menu-item, stuurt de route-guard (app/middleware/auth.global.ts) /campagnes en alles eronder weg, en verdwijnt het tabblad "Campagnes" op de accountkaart. DealDrive zet de vlag per klantorganisatie aan in het eigen beheer (/admin, overzicht op /admin/abonnementen); in lokale mock-modus via de omgevingsvariabele DEALDRIVE_FEATURES=campagnes.
- Rollen: accountmanager, salesmanager en beheerder mogen alle campagnes van de organisatie lezen en schrijven. Verwijderen mag een accountmanager alleen bij eigen campagnes, de andere rollen bij alle. In de interface bestaat geen verwijderknop; afsluiten gaat via de status "Afgerond" of "Archief".
- Ingangen vanuit andere schermen: de kaart in de lijst ("Open campagnebord →"), de detailflyout ("Open campagnebord →"), het tabblad "Campagnes" op de accountkaart ("Bord →" per regel en "Alle campagnes →"), het advies in de inzichtflyout, en de tip in de rapportage ("via Campagnes", alleen als de vlag aanstaat).

## Opbouw van de pagina

### De lijst /campagnes

Van boven naar beneden:

- Kicker: "Campagnes · 4 actief". Het getal telt alle campagnes van de organisatie met status Actief, los van het filter. Wie een status uitvinkt, ziet het getal dus niet veranderen.
- Titel: "Eén lijst, één doel, elke dag een stap."
- Subtitel: "Een campagne is geen lijst om af te vinken maar een reeks gesprekken: elke stap die je vandaag zet, scheelt er morgen twee."
- Rechtsboven drie knoppen: een zoekknop (vergrootglas, opent de algemene zoekoverlay, dezelfde als Ctrl K in de zijbalk), "+ Campagne" (opent de aanmaakflyout) en "Filters" (klapt het statuspaneel open; met een teller "3/4" zodra niet alle statussen aanstaan).
- Het statuspaneel (zie Filters).
- Een raster van kaarten, twee kolommen op een breed scherm, één op een smal scherm. Er zijn geen statkaarten en geen tabel.

Elke kaart toont:

- Links een gekleurde rand naar status: groen Actief, geel Concept, blauw Afgerond, grijs en half doorzichtig Archief.
- Twee pillen: de soort (bijvoorbeeld "BELLEN", "E-MAIL", "GEMENGD") en de status ("ACTIEF", "CONCEPT", "AFGEROND", "ARCHIEF").
- Rechtsboven de naam van de eigenaar, uit de gebruikerslijst; onbekend wordt "Onbekende eigenaar".
- De campagnenaam, de beschrijving en de vrije doeltekst als "Doel: …".
- Drie cijfers: "ACCOUNTS" (aantal items op het bord), "KLAAR" (items in de kolom Klaar) en "VOORTGANG" (klaar gedeeld door totaal, afgerond op hele procenten), met een groene voortgangsbalk.
- Een regel met de tempopil ("VOOR OP SCHEMA", "OP SCHEMA", "ACHTER OP SCHEMA"), het meetbare doel ("Doel: 60% klaar", met een vinkje als het gehaald is) en rechts "nog 10 dgn" of "3 dgn over tijd". Deze regel verschijnt alleen als er een tempo of meetbaar doel is; een afgeronde of gearchiveerde campagne krijgt geen tempo en geen dagen.
- Onder de kaart de link "Open campagnebord →".

Klik op de kaart opent de detailflyout; de link opent het bord. De volgorde is vast: eerst Actief, dan Concept, dan Afgerond, dan Archief. Binnen een status staat de volgorde van de dataset (nieuw aangemaakte bovenaan). Is er niets in het filter, dan toont de pagina de lege staat "Geen campagnes in dit filter."

![De lijst /campagnes met het statusfilter open en Archief uitgevinkt](shots/campagnes-1-lijst-en-filter.png)

### Het campagnebord /campagnes/:id

- Bovenaan "← Alle campagnes".
- Kicker: soort en status, bijvoorbeeld "BELLEN · ACTIEF".
- Titel: de campagnenaam, daaronder de beschrijving en, alleen als er een doeltekst is, een kader "Doel: …" met een gele rand.
- Rechts drie kopcijfers: "ACCOUNTS", "VOORTGANG" (procent klaar) en, alleen als er een tempo is, "VERWACHT" (het percentage van de looptijd dat verstreken is).
- De actieregel: links de tempopil, het meetbare doel ("Doel: 12 accounts klaar ✓ behaald") en "nog 20 dagen" of "5 dagen over tijd"; rechts de knoppen "Zet om naar taken (3)" (alleen als er items zonder taak zijn die niet op Klaar staan, anders de tekst "Alle accounts hebben een taak."), "Voortgang", een potloodknop "Wijzigen" en "+ Accounts" (zwart, primair). Het handboek noemt de volgorde Voortgang, Wijzigen, + Accounts, Zet om naar taken; in de code staat "Zet om naar taken" vooraan.
- Het adviesblok "Begin hier · uitgerekend, geen AI", alleen als de motor een achterstandsinzicht met advies voor deze campagne heeft gemaakt (zie Regels).
- Het bord met vier kolommen in de volgorde van het werk: "Gespot", "Open", "Bezig", "Klaar". Elke kolom heeft een kop met de naam en een teller, en scrolt zelf (maximaal 70 procent van de schermhoogte).

De kolom Gespot heeft bovenaan, zodra er kaarten in staan, een zoekveld "Filter op accountnaam…", een vinkje "Alles selecteren" en de knop "→ Open + taak (n)". Een kaart toont een vierkantje met de initialen van het account (kleur naar accountsegment: zwart strategisch, rood risico, paars hot prospect, oranje warm prospect, blauw prospect, groen klant), de accountnaam als link naar de accountkaart, een eventuele notitie, "Bekijk taak →" als er een gekoppelde taak is (of "✓ taak gekoppeld" als die taak niet in jouw takenlijst staat) en onderaan de knop "Uit campagne". In Gespot staat ook een vinkje per kaart. Een lege kolom zegt "Sleep hier een kaart naartoe."

Heeft het bord nog geen enkel account, dan toont het in plaats van vier lege kolommen één lege staat: "Nog leeg", "Nog geen accounts op dit bord.", "Voeg ze toe met + Accounts; ze komen dan in de kolom Gespot te staan." Een onbekende id toont "Campagne niet gevonden." met "← Terug".

![Het campagnebord met tempo, actieknoppen, het blok Begin hier en de vier kolommen (het advies is in de mockapp nagebootst, want de motor draait daar niet)](shots/campagnes-5-bord.png)

### Het tabblad Campagnes op de accountkaart

Op /accounts/:id staat het tabblad "Campagnes" tussen "Deals" en "Documenten", met als teller het aantal campagnes waarin het account meeloopt (gearchiveerde tellen niet mee). De kop is "Campagnes (3)" met rechts "Alle campagnes →", daaronder de uitleg "De campagnes waarin dit account meeloopt, met de stand van dit account op het campagnebord. Klik een campagne om het bord te openen." Elke regel toont de soortpil, de naam, status en doeltekst, rechts de kolom van dít account ("GESPOT", "OPEN", "BEZIG", "KLAAR") en "Bord →". Zonder campagnes: "Dit account loopt in geen enkele campagne mee. Voeg het toe op een campagnebord onder Campagnes." Het tabblad is ook direct bereikbaar met ?tab=campagnes. Op de contactkaart bestaat bewust geen tabblad Campagnes, omdat een campagne-item aan een account hangt en niet aan een persoon.

Let op: het tabblad gebruikt een eigen labellijst met alleen vijf soorten (Bellen, Bezoek, E-mail, WhatsApp, Gemengd). Een campagne van soort Demo, Meetings, Trainingen, Webinars, Events of SMS toont hier de ruwe code, bijvoorbeeld "demo".

![Het tabblad Campagnes op de accountkaart, met per campagne de kolom van dit account](shots/campagnes-8-accountkaart-tabblad.png)

## Doorklikken: de stappen

### Een campagne aanmaken met een segment als doelgroep

1. Klik op "+ Campagne" rechtsboven op /campagnes. De aanmaakflyout schuift van rechts in; de cursor staat in het veld "Naam".
2. Kies bij 1 "Soort campagne" een soort. Onder de keuzelijst verschijnt de omschrijving en, als de soort verdiepingen heeft, een rij vinkjes "Verdieping (optioneel)".
3. Vul bij 2 een naam in (minimaal 3 tekens) en eventueel een korte beschrijving.
4. Kies bij 3 "Doelgroep" een segment. Onder de keuzelijst staat hoe het segment rekent, bijvoorbeeld "AND-match op 2 regels: Strategische accounts met hoge score en omzet."
5. Vul bij 4 de doeltekst in, kies eventueel een meetbaar doel met een waarde, en een einddatum.
6. Klik "Opslaan als concept". De flyout sluit, de toast meldt "Campagne "…" opgeslagen als concept met 12 accounts uit het segment." en de detailflyout van de nieuwe campagne opent. Alle accounts uit het segment staan op het bord in Gespot.

### Accounts oppakken en er taken van maken

1. Open het bord via "Open campagnebord →".
2. Typ eventueel in "Filter op accountnaam…" in de kolom Gespot, en vink de accounts aan die je wilt oppakken. Vink je niets aan, dan geldt de knop voor alles wat zichtbaar is.
3. Klik "→ Open + taak (n)". Er verschijnt een bevestiging met het aantal taken en de vervaldatum.
4. Klik "Maak n taken". De accounts gaan naar Open, elk krijgt een taak, de toast meldt "3 accounts naar Open, 3 taken aangemaakt." Een conceptcampagne springt daarbij op Actief en krijgt een startdatum.
5. Klik op een kaart "Bekijk taak →" om de taakflyout te openen.

### Alle accounts in één keer omzetten naar taken

1. Klik op het bord "Zet om naar taken (n)". Het getal telt alle items zonder taak die niet op Klaar staan, in welke kolom ook.
2. De bevestiging "Taken aanmaken?" (of "40 taken in één keer?" boven de tien) noemt aantal en vervaldatum.
3. Klik "Maak n taken". Elk item krijgt een taak maar blijft in zijn kolom staan; de toast zegt "3 taken aangemaakt. Afronden zet het item op Klaar." De knop verdwijnt en maakt plaats voor "Alle accounts hebben een taak."

![De bevestiging voor Zet om naar taken, met aantal en vervaldatum](shots/campagnes-6-bevestiging-taken.png)

### De stand bijhouden

1. Sleep een kaart naar Bezig zodra je met het account in gesprek bent, of naar Klaar als het gedaan is. De kaart verhuist meteen en wordt opgeslagen.
2. Of rond de taak af in /taken of in de taakflyout: het item springt vanzelf naar Klaar.
3. Klik "Voortgang" voor het overzicht per account en de taakstand.

### Accounts toevoegen of weghalen

1. Klik "+ Accounts". De flyout "Wie zet je erbij?" toont alle accounts die nog niet in de campagne zitten.
2. Zoek op naam, plaats of branche, vink aan, en klik "+ Voeg toe aan Gespot (n)". De toast meldt "n accounts in Gespot gezet."
3. Om er een weg te halen: klik "Uit campagne" op de kaart, bevestig met "Uit campagne halen". Een gekoppelde taak blijft bestaan.

### Afronden of archiveren

1. Klik op het bord de potloodknop, of op /campagnes de kaart en dan het potlood in de detailflyout.
2. Zet "Status" op "Afgerond" of "Archief" en klik "✓ Opslaan". Tempo en dagen verdwijnen van kaart en bord.

## Flyouts, vensters en knoppen

### Aanmaakflyout "Nieuwe campagne"

Opent met "+ Campagne". Kop: kicker "Nieuwe campagne", titel "Plan een gerichte actie", toelichting "Start als concept en activeer pas wanneer de doelgroep en het doel scherp zijn. Tot dan blijft de campagne onzichtbaar voor het team." Die laatste belofte klopt niet: de lijst toont alle campagnes van de organisatie aan iedereen, ook concepten.

De flyout is één formulier met vier genummerde blokken, geen wizard met volgende en vorige; je scrolt erdoorheen.

| Blok | Veld | Verplicht | Standaard | Regels |
|---|---|---|---|---|
| 1 Soort campagne | Soort | ja | Bellen | elf soorten |
| 1 Soort campagne | Verdieping | nee | niets | vinkjes, alleen bij soorten met verdiepingen |
| 2 Naam & omschrijving | Naam | ja | leeg | minimaal 3, maximaal 80 tekens, teller "0 / 80" |
| 2 Naam & omschrijving | Korte beschrijving | nee | leeg | maximaal 240 tekens |
| 3 Doelgroep | Segment | nee | "Vrije keuze (later toevoegen)" | organisatiesegmenten plus je eigen |
| 4 Doel & planning | Doel / KPI (toelichting) | nee | leeg | vrije tekst |
| 4 Doel & planning | Meetbaar doel | nee | "Geen meetbaar doel" | aantal of percentage, waarde vanaf 1, percentage tot 100 |
| 4 Doel & planning | Geplande einddatum | nee | leeg | vroegst morgen |

Bij blok 1 staat "Kies het hoofdkanaal. Dit bepaalt het taak-template en de KPI." In de code bepaalt de soort het taaktype, de actiesoort en het werkwoord in de taaktitel, maar niet de KPI. De naam en beschrijving krijgen een voorbeeldtekst die meebeweegt met de soort, bijvoorbeeld "Belactie · Bouw-vacatures Q2". Bij het meetbare doel staat "Stuurt de voortgang, de tempo-indicator en de achterstand-regel van de motor." Bij de einddatum: "Optioneel: campagne sluit automatisch na deze datum."

Wissel je van soort, dan vallen verdiepingen weg die niet bij de nieuwe soort horen. Segmenten van collega's zijn niet kiesbaar.

Onderaan: "Annuleren" (sluit zonder opslaan) en "Opslaan als concept" (uitgeschakeld tot de naam 3 tekens heeft). Escape en een klik naast de flyout sluiten hem ook. Bij elke opening is het formulier leeg. De pagina eronder scrolt niet zolang de flyout open is.

Een fout in de code: de gekozen verdiepingen gaan bij het opslaan verloren. De flyout geeft ze mee, maar de opslagfunctie (createCampaign in useOptimisticWrite) neemt het veld niet over. Wie ze wil bewaren, moet ze daarna in de bewerkstand opnieuw aanvinken; daar worden ze wel opgeslagen.

![De aanmaakflyout met soort Gemengd: alle verdiepingen van alle soorten staan open](shots/campagnes-2-nieuwe-campagne-soort.png)

![Blok 3 en 4 van de aanmaakflyout: segment met uitleg, doeltekst, meetbaar doel en einddatum](shots/campagnes-3-nieuwe-campagne-doelgroep-doel.png)

In deze schermafbeelding is ook te zien dat de keuzelijst voor het meetbare doel naast het getalveld te smal wordt en het getalveld buiten de flyout loopt.

### Detailflyout van een campagne

Opent bij een klik op een kaart in de lijst, en direct na het aanmaken. Kop: soortpil en statuspil, de naam en de eigenaar, met een kruisje rechts.

Leesweergave:

- Een lijst met "Doel" (vrije tekst, of een streepje), "Meetbaar doel" (met "✓ behaald"), "Einddatum" (met "(nog 10 dgn)" of "(3 dgn over tijd)"), "Verdieping", "Segment" (de actuele segmentnaam) en "Aangemaakt". Alleen gevulde regels verschijnen, behalve Doel en Aangemaakt.
- Blok "Voortgang" met de tempopil, de cijfers accounts, klaar en voortgang en een balk. Zonder accounts: "Nog geen accounts gekoppeld. Voeg ze toe op het campagnebord."
- Blok "Beschrijving".
- Blok "Extra velden", alleen als de organisatie eigen velden met doel Campagnekaart heeft. Die velden zijn direct bewerkbaar (tekst, getal, datum of keuzelijst) en slaan op zodra je het veld verlaat.
- Onderaan "Open campagnebord →" (primair) en een potloodknop "Wijzigen".

Bewerkstand (via het potlood, of meteen bij "Wijzigen" op het bord): velden "Naam" (verplicht, minimaal 3 tekens), "Soort", "Status" (Concept, Actief, Afgerond, Archief), "Verdieping", "Doelgroep (segment)" met "Geen segment", "Doel / KPI (toelichting)", "Meetbaar doel", "Einddatum" en "Beschrijving". Onderaan "Annuleren" (terug naar de leesweergave) en "✓ Opslaan". Bij een mislukte opslag staat er "Opslaan mislukt: campagne niet gevonden." Een ander segment kiezen verandert alleen het label; het bord krijgt er geen accounts bij en houdt de oude. Een status handmatig op Actief zetten vult geen startdatum in, waardoor het tempo vanaf de aanmaakdatum rekent. Escape sluit de flyout.

![De detailflyout van een actieve belactie in de leesweergave](shots/campagnes-4-detailflyout.png)

### Bevestiging bij taken maken

Beide knoppen die taken maken ("Zet om naar taken" en "→ Open + taak") vragen eerst bevestiging. Titel "Taken aanmaken?", of "40 taken in één keer?" bij meer dan tien taken. Tekst: "Er komen 3 taken in je takenlijst met vervaldatum 3 november. Terugdraaien kan alleen taak voor taak." Bij "→ Open + taak" met accounts die al een taak hebben staat erachter "(5 accounts, waarvan 2 al een taak hebben)". Knoppen "Annuleren" en "Maak 3 taken". Moeten er nul taken komen, dan volgt geen vraag en verhuizen de accounts direct.

### Bevestiging bij Uit campagne

Titel "Account uit campagne halen?", tekst "Acme Consulting uit de campagne halen?" plus "Een gekoppelde taak blijft staan." als die er is. Knop "Uit campagne halen" in de gevarenstijl. Daarna de toast "Acme Consulting uit de campagne gehaald." Er is geen ongedaan maken.

### Flyout "Wie zet je erbij?" (+ Accounts)

Kicker "Campagne · Accounts", titel "Wie zet je erbij?", uitleg "Alle klanten en prospects die nog niet in deze campagne zitten. Wat je toevoegt komt in de kolom Gespot te staan; van daaruit bepaal je zelf wat je oppakt." Daaronder een zoekveld "Zoek een account op naam, plaats of branche…" (krijgt meteen de cursor), een vinkje "Alles in deze lijst" en de teller "n gekozen". De lijst toont per account naam, plaats ("Plaats onbekend" als die ontbreekt) en branche, alfabetisch, maximaal 100 tegelijk; daarboven staat "Eerste 100 van 412 getoond. Typ een paar letters om gerichter te zoeken." Zonder resultaat: "Geen account gevonden voor "…"." of "Alle accounts zitten al in deze campagne." Onderaan "Annuleren" en "+ Voeg toe aan Gespot (n)", uitgeschakeld bij nul. Escape sluit.

### Flyout Voortgang

Kicker "Campagne · Voortgang", titel de campagnenaam. Inhoud:

- Een doelblok: de doeltekst of "Nog geen doel opgeschreven.", en "KPI: 60% klaar · behaald" als er een meetbaar doel is.
- Cijfers "ACCOUNTS", "VOORTGANG" en "VERWACHT".
- Een balk met de behaalde voortgang en een geel streepje op de verwachte stand.
- Een uitlegzin: "Je loopt achter op schema. Het streepje is waar je nu zou moeten staan.", "Je loopt voor op schema.", "Je ligt op schema.", "Zonder einddatum is er geen verwachting om tegen af te zetten. Zet een einddatum op de campagne, dan rekent DealDrive het tempo uit." of "Deze campagne is afgerond; het tempo telt niet meer mee."
- "Per account": per account de kolom en "taak open", "taak afgerond" of "geen taak".
- "Taken uit deze campagne": "Openstaand", "Afgerond" en "Nog zonder taak".
- Onderaan "Nog 20 dagen" of "5 dagen over tijd", en de knop "Sluiten".

![De voortgangsflyout van een campagne die achter loopt, met het streepje op de verwachte stand](shots/campagnes-7-voortgang.png)

## Filters, zoeken, sorteren en weergaven

Op /campagnes is er één filter: status. De knop "Filters" klapt een paneel open met de kop "Status", de links "Alles aan" en "Alles uit", en vier vinkjes "Concept", "Actief", "Afgerond" en "Archief", elk met een teller. De tellers rekenen over alle campagnes van de organisatie, niet over wat zichtbaar is. Standaard staan alle vier aan. Meerdere statussen tegelijk mag; "Alles uit" geeft de lege staat. Het filter staat niet in de URL en is na herladen weer volledig aan. Er is geen filter op soort, eigenaar of einddatum en geen zoekveld binnen de lijst; de zoekknop opent de algemene zoekfunctie van de app.

Sortering is vast: Actief, Concept, Afgerond, Archief. Er is één weergave (kaarten).

Op het bord is er het filter "Filter op accountnaam…" in de kolom Gespot. Het filtert alleen die kolom, op een deel van de naam, zonder hoofdlettergevoeligheid. Het bepaalt ook wat "→ Open + taak" verplaatst als je niets hebt aangevinkt. "Alles selecteren" vinkt alle Gespot-kaarten aan, ook die het filter verbergt. In de flyout "+ Accounts" zoek je op naam, plaats of branche.

Het tabblad op de accountkaart staat in de URL als ?tab=campagnes.

## Regels en berekeningen

### Soorten en verdiepingen

De soort zegt wat je doet, de verdieping hoe. Eén gedeelde lijst (shared/campagneSoorten.ts) voedt de aanmaakflyout, de detailflyout en het bord. Bij Gemengd mag je alle verdiepingen van alle soorten aanvinken, met de soort erachter.

| Soort | Verdiepingen | Taaktype | Actiesoort | Taaktitel begint met |
|---|---|---|---|---|
| Bellen | Koud bellen, Warm bellen | call | bellen | Bel |
| E-mail | Koude mail, Warme mail | mail | mailen | Mail |
| Bezoek | Gepland bezoek, Ongepland bezoek | afspraak | bezoek | Bezoek |
| Meetings | Online meeting, Belafspraak | afspraak | online-meeting | Plan meeting met |
| Demo | Online demo, Offline demo | afspraak | bezoek | Geef demo bij |
| WhatsApp | Tekst, Audio, Video | bericht | bericht | App |
| SMS | geen | bericht | bericht | Sms |
| Trainingen | Online training, Offline training | afspraak | bezoek | Train |
| Webinars | Live, Terugkijken | afspraak | online-meeting | Nodig uit voor webinar |
| Events | Intern event, Extern event | afspraak | bezoek | Nodig uit voor event |
| Gemengd | alle bovenstaande | to-do | geen | Benader |

De verdieping heeft verder geen effect: hij verandert geen taaktype, geen vervaldatum en geen advies. Ook een online demo wordt een taak met actiesoort bezoek.

### Statussen van een campagne

Een nieuwe campagne is altijd "Concept". Ze wordt "Actief" als je dat handmatig kiest, of automatisch zodra een van de taakknoppen minstens één taak maakt; dan wordt ook de startdatum (startedAt) gezet. "Afgerond" en "Archief" kies je handmatig, of de motor zet een actieve campagne op Afgerond na de einddatum. Gearchiveerde campagnes verdwijnen van het tabblad op de accountkaart maar blijven in de lijst als Archief aanstaat.

### Kolommen en overgangen op het bord

- Gespot: de startlijst. Accounts uit het segment en uit "+ Accounts" landen hier.
- Open: je pakt het op. "→ Open + taak" verplaatst en maakt een taak.
- Bezig: je bent in gesprek. Alleen via slepen.
- Klaar: gedaan. Via slepen, of automatisch als de gekoppelde taak op afgerond gaat. Bij Klaar wordt een afrondmoment (completedAt) vastgelegd.

Slepen mag tussen elke twee kolommen, ook terug. Slepen maakt nooit een taak en sluit nooit een taak: een kaart naar Klaar slepen laat de gekoppelde taak open staan, en een kaart naar Open slepen geeft hem geen taak. Een kaart terug uit Klaar slepen wist het afrondmoment niet. "Zet om naar taken" verplaatst niets: de items houden hun kolom, ook Gespot.

### Taken uit een campagne

Per item zonder taak (en bij "Zet om naar taken" alleen als het niet op Klaar staat) maakt DealDrive één taak met:

- Titel: werkwoord, accountnaam en campagnenaam, bijvoorbeeld "Bel Acme Consulting (Belactie · Groei-prospects ICP-match)".
- Reden: "Campagne "…" (doel: …)".
- Taaktype en actiesoort volgens de tabel hierboven, prioriteit medium, bron handmatig.
- Vervaldatum: de einddatum van de campagne, anders zeven dagen na nu. Alle taken krijgen dus dezelfde datum; bij een campagne van drie maanden staan ze allemaal op de laatste dag.
- Eigenaar: de toegewezen accountmanager van het item, en als die er niet is (dat is altijd zo bij segment en + Accounts) de gebruiker die op de knop klikt.

Het item onthoudt de taak (taskId). Wordt die taak afgerond, op welke plek dan ook, dan zet DealDrive elk item met die taak op Klaar. Een taak weer openzetten haalt het item niet terug uit Klaar.

### Voortgang, meetbaar doel en tempo: de formule

Lijstkaart, bord, detailflyout en voortgangsflyout rekenen met één functie (campagneVoortgang in app/composables/useCampagneTempo.ts); de motor heeft een kopie met dezelfde formule (server/utils/campagneTempo.ts).

- Voortgang = items op Klaar gedeeld door alle items, maal 100, afgerond.
- Meetbaar doel "aantal": behaald als het aantal op Klaar minstens de waarde is. Label "12 accounts klaar".
- Meetbaar doel "percentage": behaald als de voortgang minstens de waarde is. Label "60% klaar".
- Startmoment = startdatum, anders aanmaakdatum.
- Verwacht = verstreken deel van de looptijd (nu min start, gedeeld door eind min start), begrensd tussen 0 en 1, maal 100, afgerond.
- Doelpercentage = de waarde bij een percentagedoel; bij een aantaldoel het aantal gedeeld door het aantal accounts maal 100 (hooguit 100); zonder meetbaar doel 100.
- Verwacht behaald = verwacht maal doelpercentage gedeeld door 100, afgerond.
- Tempo: "Voor op schema" als de voortgang minstens 5 punten boven verwacht behaald ligt; "Op schema" als hij hooguit 10 punten eronder ligt; anders "Achter op schema".
- Dagen = einddatum min nu in dagen, naar boven afgerond. Negatief betekent over tijd.

Een tempo bestaat alleen met een einddatum, minstens één account, een einddatum na de start, en een campagne die niet afgerond of gearchiveerd is. De marge is dus niet symmetrisch: 5 punten voor "voor", 10 punten voor "achter". Het handboek noemt alleen de 10.

Voorbeelden uit de demodata:

| Campagne | Looptijd verstreken | Voortgang | Verwacht behaald | Tempo |
|---|---|---|---|---|
| Belactie · Bouw-vacatures Q2 | 3 van 13 dagen (23%) | 25% | 23% | Op schema |
| WhatsApp · Pricing-pagina volgen | 1,5 van 8,5 dagen (18%) | 25% | 18% | Voor op schema |
| Belactie · Groei-prospects ICP-match | 5 van 25 dagen (20%) | 0% | 20% | Achter op schema |

Met een aantaldoel van 12 op 40 accounts is het doelpercentage 30. Halverwege de looptijd is verwacht behaald dan 15 procent; met 6 accounts klaar (15 procent) sta je op schema, met 1 account klaar (3 procent) achter.

### De achterstandregel in de motor

Starterregel SR11 (categorie "Pijplijn/Forecast", subcategorie "Campagne loopt achter", triggerpatroon campagne-achterstand) staat in het startpakket van elke organisatie, met prioriteit Hoog, cadans "2 dagen", activiteit inzicht, deterministisch, marge 10. De omschrijving zegt "Dagelijkse check", maar de cadans is twee dagen. In de regeleditor (/instellingen/activity-selling) is het patroon kiesbaar als "Campagne-achterstand", met een getalveld van 1 tot 100 voor de marge in procentpunten (technisch het veld dagen).

Per motorrun:

1. De motor haalt alle campagnes van de organisatie met status Actief.
2. Per campagne berekent hij de achterstand: verwacht behaald min voortgang. Zonder einddatum of accounts geen oordeel.
3. Is de achterstand minstens de marge, en is de cadans voor deze regel en deze campagne verstreken, dan volgt een inzicht.
4. Bestaat er al een open inzicht (status nieuw of gelezen) van deze regel voor deze campagne, dan werkt hij dat bij in plaats van een tweede te maken.

Het inzicht heeft type "campagne", geen account maar wel een campagne-id, en bevat:

- Titel "Campagne loopt achter · Belactie · Groei-prospects ICP-match".
- Tekst "Voortgang 0% (0/3 accounts klaar) waar 20% verwacht is" met het aantal dagen tot de einddatum.
- Commerciële invalshoek "Pak de 3 open accounts deze week op", met een verwijzing naar "Zet om naar taken".
- Bewijs uit "CRM (DealDrive)" met klaar, totaal, verwacht en de achterstand in punten.
- Relevantie 90 bij prioriteit Kritiek, 80 bij Hoog, 65 anders; zekerheid 100.
- Een voorgestelde taak "Inhaalactie "…": 3 open accounts omzetten naar taken".
- Het advies (zie hieronder).

Klein verschil tussen scherm en motor: de motor maakt een inzicht bij precies 10 punten achterstand, terwijl het scherm dan nog "Op schema" toont (het scherm zegt pas achter boven de 10).

### Het advies "Begin hier"

Bij elk achterstandsinzicht bouwt de motor een advies (server/utils/campagneAdvies.ts):

- Kandidaten: alle accounts op het bord die niet op Klaar staan, ontdubbeld.
- Volgorde: eerst accounts zonder enig vastgelegd contact, dan het langst geleden laatste contact (het recentste van laatste interactie en laatste bezoek). Bij gelijkstand alfabetisch.
- De eerste drie komen in het advies, elk met naam, reden ("Nog geen contactmoment vastgelegd" of "Laatste contact 41 dagen geleden"), accountklasse en journeyfase.
- Aanpak: het voorbereidingsaccent van de journeyfase van het account, zoals de organisatie dat in de customer journey heeft ingesteld. Heeft de fase geen accent, dan een vaste zin per soort, bijvoorbeeld bij Bellen "Bel de vaste contactpersoon en gebruik de campagne-aanleiding als opening." Er zijn vaste zinnen voor Bellen, Bezoek, E-mail, WhatsApp en Gemengd; de andere soorten krijgen "Neem contact op met de vaste contactpersoon en stuur op één concrete vervolgstap."
- De kop luidt "Begin bij deze 3 accounts", gevolgd door "hier is het het langst stil." (in de app met een gedachtestreepje ertussen).
- Herkomst: "deterministisch". Er komt geen taalmodel aan te pas.

Het bord toont het advies van het nieuwste niet afgewezen campagne-inzicht als blok "Begin hier · uitgerekend, geen AI", met drie kaarten waarvan de naam naar de accountkaart linkt. De inzichtflyout toont hetzelfde met de voetnoot "Uitgerekend uit je CRM-data, niet door AI geschreven." Zolang er geen inzicht is (bijvoorbeeld in mock-modus, waar de motor niet draait) staat het blok er niet.

### De afsluiter

Elke motorrun begint met de afsluiter (server/utils/campagneAfsluiter.ts), vóór de regels, zodat er geen inzicht komt over een campagne die in dezelfde run sluit. Hij zet elke campagne met status Actief en een einddatum vóór nu op "Afgerond", zowel in de statuskolom als in de gegevens, en legt het moment vast in afgerondOp. Er komt geen oordeel "gehaald" of "gemist" bij. Een tweede run doet niets meer.

Twee kanttekeningen. Een conceptcampagne met een verstreken einddatum blijft concept, want de afsluiter kijkt alleen naar Actief. En de afsluiter werkt alleen met de database; in mock-modus blijft een verlopen campagne actief en toont "over tijd".

### Wat de AI doet

Niets. Advies, tempo, inzicht en afsluiter zijn rekenregels. De AI komt pas in beeld als een gemaakte taak via de Pitstop een belscript of mail krijgt; dat hoort bij de taakfeature.

## Gegevens

Een campagne staat in de tabel campaigns, afgeschermd per organisatie met rijbeveiliging en gesynchroniseerd via dezelfde mutatiewachtrij als taken. Een paar velden zijn eigen kolommen om op te filteren: soort (kind), status (status), eigenaar (ownerId), doeltekst (goal), segment (sourceSegmentId), startdatum (startedAt) en einddatum (endsAt). Het hele record staat daarnaast in een JSON-veld (data), inclusief de accountlijst.

Velden van een campagne:

- Naam (name), beschrijving (description), maximaal 80 en 240 tekens in de interface.
- Soort (kind) en verdiepingen (varianten).
- Status (status): concept, actief, afgerond of gearchiveerd.
- Segment waaruit de startlijst kwam (sourceSegmentId). Het bord is een momentopname: wie later in het segment valt, komt er niet vanzelf bij.
- Eigenaar (ownerId): wie hem aanmaakte.
- Doeltekst (goal), meetbaar doel (doelType: aantal of percentage) en doelwaarde (doelWaarde).
- Eigen velden (customFields), gevuld vanuit de detailflyout.
- Startdatum (startedAt), einddatum (endsAt), afrondmoment door de motor (afgerondOp), aangemaakt (createdAt) en gewijzigd (updatedAt). Let op: bij aanmaken wordt de einddatum als kale datum opgeslagen (middernacht), bij wijzigen als 23:59 die dag.
- Items (items): per account een regel.

Velden van een item:

- Id (id) en account (accountId).
- Toegewezen accountmanager (assignedTo), optioneel; de interface kan hem niet zetten.
- Kolom (status): gespot, open, bezig of klaar.
- Notitie (note); de interface toont hem maar kan hem niet schrijven.
- Gekoppelde taak (taskId) en afrondmoment (completedAt).

Van andere features komt: de accountlijst en segmentregels (segmenten), contactdata voor het advies (lastInteractionAt en lastVisitAt op het account), journeyfasen en accountklassen voor de aanpak, eigen velden met doel Campagnekaart, en de takenstatus die items op Klaar zet. Het achterstandsinzicht staat in de tabel signals, de cadansadministratie in de tabel ruleRuns met onderwerp campagne.

## Wat dit betekent voor Dealtrace

- Overnemen: de keten segment, bord, taak, afgeronde taak zet het item op Klaar. Het is de kortste weg van "deze groep" naar werk in de takenlijst, en de bevestiging met aantal en vervaldatum voorkomt honderd taken in één klik.
- Overnemen: tempo tegen de looptijd en het advies "begin bij wie het langst stil is", deterministisch en uitlegbaar. Voor new business wel aanvullen met signalen (vacature, nieuws, websitebezoek) als tweede sorteersleutel, want bij koude prospects heeft niemand contact gehad en valt de volgorde terug op het alfabet.
- Anders voor de binnendienst: geen vervaldatum gelijk aan de einddatum voor alle taken, maar taken spreiden over de looptijd in dagdelen (bijvoorbeeld 20 per belblok), zodat de bellijst elke dag gevuld is en het tempo haalbaar blijft.
- Anders voor de buitendienst: bij soort Bezoek de accounts op regio clusteren en direct koppelen aan de routeplanning; nu zegt het advies wel "combineer met accounts in dezelfde regio", maar het bord doet daar niets mee.
- Kolommen laten aansluiten op new business: Gespot, Benaderd, In gesprek, Afspraak, Afgewezen, met uitkomst per account. Klaar zegt nu niet of het iets opleverde, en de conversie (bijvoorbeeld "50% conversie naar afspraak") staat alleen als vrije tekst en wordt nergens gemeten.
- Ontbreekt: toewijzen aan accountmanagers per item, een notitieveld dat je kunt invullen, verdelen van een segment over meerdere verkopers, een dynamisch segment dat nieuwe prospects automatisch toevoegt, en een koppeling van campagne naar deals en pipelinewaarde.
- Repareren bij overname: verdiepingen die bij aanmaken wegvallen, de belofte dat een concept onzichtbaar is voor het team, het tabblad op de accountkaart dat zes soorten niet kent, en het verschil tussen slepen naar Klaar en het sluiten van de taak (die twee moeten elkaar volgen).
