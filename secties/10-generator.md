# Generator (leadgenerator)

## Wat het is en waarvoor

De Generator, op het scherm "Leadgenerator", zoekt bedrijven die lijken op de klanten die je al hebt en zet per bedrijf het bewijs eronder: waarom hij past, waar dat vandaan komt en hoe oud die bron is. Het idee is dat je je ideale klant niet hoeft te beschrijven. De zoekopdracht wordt afgeleid uit je eigen klantenbestand (accountklasse, branche, werkgebied), en jij voegt hoogstens een aanleiding toe, zoals "werft servicemonteurs".

Voor een accountmanager is het een bron van nieuwe namen voor de prospectlijst: je beoordeelt een korte lijst, klikt "Neem over" bij een bedrijf dat past (er komt een prospect in je CRM) of "Niet relevant" bij een bedrijf dat je niet wilt zien. Voor een salesmanager is het een manier om de prospectie te voeden met bedrijven die aantoonbaar op het bestaande klantenbestand lijken, met een harde grens op wat het per maand kost. In de week past het als een vast moment waarop je een ronde draait en de lijst leegwerkt, vergelijkbaar met een belblok.

**Belangrijk: de Generator werkt vandaag niet met echte zoekresultaten.** De webzoeker is niet aangesloten. Er is geen server-endpoint en geen databasetabel voor leads. Een klik op "Nieuwe ronde zoeken" beoordeelt vijf vaste voorbeeldbedrijven tegen jouw zoekopdracht van dat moment. Het scherm zegt dat zelf: "Voorbeeldronde: de webzoeker is nog niet aangesloten. Deze bedrijven zijn voorbeelden, beoordeeld tegen de zoekopdracht hierboven." Wat wel echt werkt: het afleiden van de zoekopdracht uit je echte accounts, de matchlogica met bewijsregels, de indeling in groepen, de ontdubbeling tegen je CRM, en "Neem over", dat een echte prospect aanmaakt.

Samenhang met andere features:

- Leest: je accountlijst (klasse via het veld tier, SBI-code, postcode, KvK-nummer, website) en de accountklassen uit de instellingen (A Corporate, B Groot MKB, C Middenbedrijf, D Klein MKB).
- Schrijft: een nieuwe prospect via dezelfde schrijfroute als een handmatig aangemaakt account, met als herkomst "Gevonden door de leadgenerator". Die prospect verschijnt daarna onder "Prospects" en heeft een gewone klantkaart.
- Deelt met de inzichtenmotor: de houdbaarheidsgrenzen voor vacaturebewijs (30 en 120 dagen) en de opzet van de webzoeker in server/utils/webBron.ts. Die webzoeker draait vandaag wel, maar alleen voor inzichten op bestaande accounts, niet voor de Generator.

## Waar je het vindt

- Menu: in de zijbalk onder "Accounts", als vierde item na "Klanten", "Prospects" en "Contacten", met de naam "Generator" en een radaricoon.
- Route: /generator. Er zijn geen subroutes en de pagina zet niets in de URL.
- Paginatitel in de browser: "Leadgenerator · DealDrive".
- Functievlag: leadGenerator, groep "Accounts & campagnes", standaard uit, met pakketondergrens Compleet. De uitleg in HQ: de module gebruikt de webzoeker, dus alleen zinvol vanaf Compleet. Zet je de vlag aan bij een lager pakket, dan blijft de module uit.
- Wie het ziet: iedere gebruiker van een organisatie waar de vlag effectief aanstaat. Er is geen rolbeperking; een accountmanager ziet hetzelfde als een beheerder.
- Zonder vlag: het menu-item verdwijnt en een directe navigatie naar /generator wordt geweigerd door de route-middleware, die je terugstuurt naar je startpagina met een melding.
- Vanuit andere schermen is er geen ingang: geen knop op klantkaarten, prospectlijsten of het dashboard. Andersom leidt "Open klantkaart" vanaf de Generator naar /accounts/[id].

![De Generator voordat je een ronde hebt gezocht: kop, zoekopdracht in vier vakken, lege staat en de twee meters.](shots/generator-1-start.png)

## Opbouw van de pagina

### Kop

- Kicker: "Leadgenerator · nog niet gezocht" zolang je in deze sessie nog geen ronde deed, daarna "Leadgenerator · 5 gevonden". Het getal is het aantal voorbeeldleads dat niet is afgewezen, dus na één keer "Niet relevant" staat er "4 gevonden".
- Titel: "Leadgenerator".
- Subtitel: "Bedrijven die lijken op de klanten die je al hebt, met per bedrijf het bewijs erbij: waarom hij past, waar dat vandaan komt en hoe oud die bron is. De zoekopdracht leidt DealDrive af uit je eigen klantenbestand, dus je begint niet bij een leeg formulier."
- Knoppen rechtsboven: "Zoekopdracht aanpassen" (wisselt naar "Zoekopdracht verbergen" als het paneel open is) en de primaire knop "Nieuwe ronde zoeken" (tijdens het zoeken "Bezig met zoeken…"). De primaire knop staat uit als de maandbundel van 120 rondes op is, met de tooltip "Je maandbundel voor zoekrondes is op".

### De zoekopdracht in vier vakken

Onder de kop staat de zoekopdracht als een strook van vier vakken. Elk vak heeft een label, een waarde en een kleine regel eronder die zegt waar de waarde vandaan komt.

| Label | Waarde | Regel eronder |
|---|---|---|
| "Accountklasse" | de gekozen klassen, standaard "A en B" | omschrijving uit de instellingen, bijvoorbeeld "250+ medewerkers en 50-250 medewerkers" |
| "Branche" | hoogstens drie SBI-codes, gescheiden door " · " | "Uit je 142 klanten in deze klassen" |
| "Werkgebied" | bijvoorbeeld "Postcode 80, 10, 38, 31" | "Waar je klanten zitten" |
| "Aanleiding" | je vrije tekst, of "geen" | "Vrij in te vullen" |

In de demo staat bij Branche "4120: Algemene burgerlijke en utiliteitsbouw". Zonder SBI-codes staat er "nog niet af te leiden", zonder postcodes "heel Nederland". Let op: het getal "142 klanten" telt alle accounts in de gekozen klassen, dus ook prospects. Het profiel wordt dus niet alleen uit betalende klanten afgeleid, terwijl de tekst dat suggereert.

### Het paneel "Zoekopdracht aanpassen"

Opent onder de vier vakken, niet als flyout. Twee velden: "Op welke klassen zoek je?" met een vinkje per klasse ("A · Corporate", "B · Groot MKB", "C · Middenbedrijf", "D · Klein MKB") en "Aanleiding" met de voorbeeldtekst "bijvoorbeeld: werft servicemonteurs". Elke wijziging werkt direct door in de vier vakken en, na een ronde, in de beoordeling van de lijst.

![Het paneel "Zoekopdracht aanpassen" open, met de klassen A en B aangevinkt en een leeg veld Aanleiding.](shots/generator-2-zoekopdracht.png)

### De uitkomst

Het middendeel heeft drie lege staten:

- Geen klasse gekozen: "Kies minstens één accountklasse." met de uitleg dat branche en werkgebied uit je klanten in de gekozen klassen komen.
- Nog niet gezocht: "Nog geen bedrijven gezocht." met de zin dat je op "Nieuwe ronde zoeken" klikt en dat de zoekopdracht al is ingevuld op basis van je eigen klanten.
- Een ronde zonder resultaat: "Deze ronde leverde niets op." met "Pas de zoekopdracht aan en zoek opnieuw." Met de voorbeelddata komt die staat in de praktijk niet voor.

Na een ronde staat bovenaan de noot over de voorbeeldronde, en daaronder de groepen in vaste volgorde: "Passend", "Nog niet te beoordelen", "Verlopen", "Al in je CRM", "Valt af". Een groep zonder bedrijven wordt niet getoond. Elke groepskop toont de naam en het aantal; bij "Passend" staat erachter "van de 5 gevonden bedrijven".

### Een leadrij

Elke lead is een rij met links de inhoud en rechts de score en de knoppen.

- Titelregel: bedrijfsnaam, plaats, een gele pil "Klasse B" (berekend uit het medewerkersaantal, ontbreekt als dat aantal onbekend is) en een dossierpil. De dossierpil is groen met "Dossier 2 dagen oud" (of "Dossier van vandaag") tot en met 30 dagen, en oranje daarboven. Een lead zonder dossierdatum krijgt geen pil: die is niet oud maar onbekeken.
- Reden: alleen bij "Verlopen", "Al in je CRM" en "Valt af" een zin onder de titel, bijvoorbeeld "Het dossier is 64 dagen oud; het bewijs eronder is niet meer vers." of "Staat al in je klantenbestand als Van Dijk Bouw en Installatie BV."
- Bewijsregels: per criterium een regel met links "ja" (groen), "nee" (rood) of "?" (grijs), dan de bewijszin en in kleine letters de bron en, waar het bewijs veroudert, de datum. Voorbeeld: "Drie vacatures voor servicemonteur open. Indeed, 2 okt". De tooltip op het oordeel is "Voldoet", "Voldoet niet" of "Niet te achterhalen".
- Rechts: de score "5/6" (aantal ja-oordelen tegen zes criteria) en daaronder "5 beoordeeld" (aantal regels dat niet onbekend is).
- Knoppen per groep: bij "Passend" de primaire knop "Neem over" en "Niet relevant"; bij "Verlopen" de uitgeschakelde knop "Opnieuw uitzoeken" met "Kost 1 dossier · nog niet aangesloten"; bij "Nog niet te beoordelen" de uitgeschakelde knop "Toch uitzoeken" met "Nog niet aangesloten"; bij "Al in je CRM" de knop "Open klantkaart"; bij "Valt af" geen knop. De twee uitgeschakelde knoppen hebben de tooltip "Een dossier ophalen vraagt de webzoeker, en die is nog niet aangesloten."
- Rijen in "Al in je CRM" en "Valt af" staan in een grijze tint met een grijze bedrijfsnaam.

![Na de eerste voorbeeldronde: de noot over de voorbeeldronde, de groep Passend met twee bedrijven en de toast "Ronde klaar: 5 bedrijven beoordeeld, 2 passend."](shots/generator-3-ronde.png)

![De groepen Nog niet te beoordelen, Verlopen en Valt af, met de uitgeschakelde knoppen en de meters eronder.](shots/generator-4-groepen.png)

### De meters onderaan

Twee balken met een teller:

- "Zoekrondes deze maand", bijvoorbeeld "1 / 120".
- "Dossiers deze maand", bijvoorbeeld "3 / 240".

Daaronder: "Een ronde levert hoogstens 25 bedrijven op en doet drie zoekopdrachten. Dezelfde opdracht binnen 24 uur geeft het bewaarde resultaat en kost dus geen ronde."

Waar de getallen vandaan komen: de rondeteller is een teller in de browsersessie die bij elke klik op "Nieuwe ronde zoeken" één omhoog gaat en bij herladen terug naar 0 springt. De dossierteller is geen verbruik maar het aantal niet-afgewezen voorbeeldleads met een dossierdatum. Daardoor staat er al "3 / 240" voordat je iets hebt gedaan, en zakt hij naar "2 / 240" als je een bedrijf met dossier "Niet relevant" geeft. De uitleg over 25 bedrijven, drie zoekopdrachten en 24 uur hergebruik komt uit de grenzen in de code; geen van die drie wordt nu afgedwongen of gemeten.

![De meters Zoekrondes deze maand en Dossiers deze maand met de uitleg over de grenzen.](shots/generator-6-meters.png)

## Doorklikken: de stappen

### Een ronde zoeken met de voorgestelde zoekopdracht

1. Klik in de zijbalk onder "Accounts" op "Generator". De pagina opent met "nog niet gezocht" in de kicker en de lege staat "Nog geen bedrijven gezocht."
2. Controleer de vier vakken. Ze zijn al gevuld uit je accounts in klasse A en B.
3. Klik op "Nieuwe ronde zoeken". De knop toont ongeveer 0,4 seconde "Bezig met zoeken…".
4. De noot over de voorbeeldronde verschijnt, de groepen worden gevuld, de kicker wordt "5 gevonden", de rondeteller gaat één omhoog en rechtsonder verschijnt de toast "Ronde klaar: 5 bedrijven beoordeeld, 2 passend."

### De zoekopdracht aanscherpen met een aanleiding

1. Klik op "Zoekopdracht aanpassen". Het paneel opent onder de vier vakken.
2. Typ in "Aanleiding" bijvoorbeeld "werft servicemonteurs". Het vak "Aanleiding" bovenin toont de tekst direct.
3. Na een eerdere ronde wordt de lijst meteen opnieuw beoordeeld. Een nieuwe ronde is niet nodig; klik je toch op "Nieuwe ronde zoeken", dan telt die als extra ronde.
4. Bij elk bedrijf verschijnt een regel voor de aanleiding. Bij Van Dijk Bouw staat nu "ja" met de zin dat "werft servicemonteurs" terugkomt in "Drie vacatures voor servicemonteur open." Bij de andere bedrijven staat "?" met "Geen bewijs gevonden voor "werft servicemonteurs"."

![Met de aanleiding "werft servicemonteurs": de treffer bij Van Dijk Bouw en "Geen bewijs gevonden" bij Bouwgroep Thermiek.](shots/generator-5-aanleiding.png)

### Een bedrijf overnemen als prospect

1. Klik bij een bedrijf in "Passend" op "Neem over".
2. DealDrive maakt een account aan met soort prospect, met naam, KvK-nummer, plaats, website en, als de klasse A, B of C is, die klasse. Als herkomst staat erbij "Gevonden door de leadgenerator".
3. De toast meldt "Van Dijk Bouw en Installatie BV staat nu als prospect in je CRM, klasse B."
4. Het bedrijf verhuist naar "Al in je CRM", omdat de ontdubbeling hem nu op zijn KvK-nummer herkent, met de reden "Staat al in je klantenbestand als …" en de knop "Open klantkaart".
5. Klik op "Open klantkaart". Je gaat naar /accounts/[id] van de nieuwe prospect.

![Na Neem over bij Van Dijk Bouw en Niet relevant bij Bouwgroep Thermiek: Passend is leeg, Van Dijk staat onder Al in je CRM, met de toasts rechtsonder.](shots/generator-7-overgenomen.png)

![De klantkaart van de overgenomen prospect: "Geen klasse" in de kop en geen branche, terwijl de toast "klasse B" meldde.](shots/generator-8-klantkaart.png)

Let op bij stap 5: de klantkaart toont "Geen klasse". De Generator schrijft de klasse in het veld tier, terwijl de kop van de klantkaart het veld accountfase toont. De toast belooft dus een klasse die je op de klantkaart niet terugziet. Ook branche (SBI) en medewerkersaantal worden niet meegeschreven, hoewel de lead ze kent; de klantkaart toont "+ branche".

### Een bedrijf afwijzen

1. Klik bij een bedrijf in "Passend" op "Niet relevant".
2. Er is geen bevestiging. De lead krijgt status afgewezen en verdwijnt uit de lijst.
3. De toast meldt "Bouwgroep Thermiek BV is uit de lijst gehaald en komt in een volgende ronde niet terug."
4. De kicker telt één minder en de dossierteller zakt als het bedrijf een dossier had.

Wat de toast belooft, geldt alleen tot je de pagina herlaadt: de status staat in het geheugen van de browser en de vijf voorbeeldbedrijven komen na herladen allemaal terug.

### Zoeken op andere klassen

1. Klik op "Zoekopdracht aanpassen" en vink "D · Klein MKB" aan.
2. De vakken "Branche" en "Werkgebied" worden opnieuw berekend uit je accounts in A, B en D. In de demo blijft het "Uit je 142 klanten in deze klassen", omdat er geen accounts in klasse D zijn.
3. Aannemersbedrijf Kraaijeveld (8 medewerkers, klasse D) valt niet meer af op klasse en komt in "Passend".
4. Vink je alle klassen uit, dan verdwijnt de lijst en staat er "Kies minstens één accountklasse."; klik je dan toch op "Nieuwe ronde zoeken", dan meldt een fouttoast "Kies eerst minstens één accountklasse."

## Flyouts, vensters en knoppen

De Generator heeft geen flyouts en geen vensters. Alles gebeurt op de pagina zelf; Escape doet niets.

### Paneel "Zoekopdracht aanpassen"

- Opent en sluit met de knop "Zoekopdracht aanpassen" of "Zoekopdracht verbergen".
- "Op welke klassen zoek je?": vinkjes per klasse uit de accountklassen van de organisatie. Standaard A en B aangevinkt. Geen minimum in het formulier, maar zonder klasse is er geen lijst.
- "Aanleiding": optioneel vrij tekstveld, standaard leeg, geen validatie. Spaties aan begin en eind worden genegeerd.
- Er is geen knop om op te slaan of te annuleren: elke wijziging geldt direct. De zoekopdracht wordt nergens bewaard; na herladen staan de klassen weer op A en B en is de aanleiding leeg.

### Knoppen en toasts

| Knop | Waar | Wat er gebeurt | Toast |
|---|---|---|---|
| "Nieuwe ronde zoeken" | kop | beoordeelt de voorbeeldleads, ronde +1 | "Ronde klaar: 5 bedrijven beoordeeld, 2 passend." |
| "Neem over" | Passend | maakt een prospect, lead naar Al in je CRM | "… staat nu als prospect in je CRM, klasse B." |
| "Niet relevant" | Passend | lead afgewezen, weg uit de lijst | "… is uit de lijst gehaald en komt in een volgende ronde niet terug." |
| "Open klantkaart" | Al in je CRM | naar /accounts/[id] | zonder treffer: "De klantkaart is niet gevonden." |
| "Opnieuw uitzoeken", "Toch uitzoeken" | Verlopen, Nog niet te beoordelen | altijd uitgeschakeld | geen |

Mislukt het aanmaken van de prospect, dan meldt een fouttoast "… kon niet als prospect worden aangemaakt." en blijft de lead in "Passend".

"Open klantkaart" zoekt het account alleen op KvK-nummer, terwijl de ontdubbeling ook op domein matcht. Een bedrijf dat via zijn website als bekend is herkend, geeft dus "De klantkaart is niet gevonden."

## Filters, zoeken, sorteren en weergaven

Er zijn geen filters, geen zoekveld, geen sorteerkeuze en geen weergaven. De enige bediening die de lijst stuurt, zijn de klassen en de aanleiding in de zoekopdracht. Niets daarvan komt in de URL.

- Groepen: vaste volgorde Passend, Nog niet te beoordelen, Verlopen, Al in je CRM, Valt af. Lege groepen worden weggelaten.
- Sortering binnen een groep: eerst op score (meeste ja-oordelen bovenaan), bij gelijke score op het aantal beoordeelde criteria. Zo staat 5 uit 6 boven 2 uit 2, omdat je van het tweede bedrijf bijna niets weet.
- Tellers: het getal bij een groepskop is het aantal leads in die groep; "van de 5 gevonden bedrijven" is het totaal aantal niet-afgewezen leads.
- Reset: herladen zet alles terug (klassen A en B, aanleiding leeg, nog niet gezocht, rondes 0, afgewezen en overgenomen leads weer op nieuw).

## Regels en berekeningen

### De zoekopdracht afleiden

- Alleen accounts met een klasse (tier) in de gekozen klassen tellen mee. Zoek je op A en B, dan bepaalt je D-bestand je branche en werkgebied niet.
- Branche: de SBI-codes van die accounts, geteld en gesorteerd op hoe vaak ze voorkomen; de drie meest voorkomende blijven over, omdat meer de zoekopdracht vaag maakt.
- Werkgebied: de eerste twee cijfers van de postcode, geteld en gesorteerd; de zes meest voorkomende blijven over, omdat dat de schaal is waarop iemand rijdt.
- Aanleiding: telt alleen als je hem invult.
- Zonder accounts komt er een lege opdracht en geen verzonnen profiel.

### Van medewerkers naar accountklasse

A vanaf 250 medewerkers, B vanaf 50, C vanaf 10, D daaronder. Precies op de grens telt naar boven (250 is A). Zonder medewerkersaantal blijft de klasse onbekend. De Generator gebruikt deze vaste standaardindeling, ook als een organisatie haar klassen in de instellingen anders heeft ingericht; de rekenfunctie kan een eigen indeling krijgen, maar de pagina geeft die niet mee.

### De zes criteria en het bewijs

De score staat altijd als "x/6": de code kent zes criteria. Welke dat zijn, is niet vastgelegd als vaste lijst. In de praktijk rekent DealDrive er twee zelf uit, één komt uit je aanleiding, en de rest komt uit het dossier van de zoeker.

| Criterium | Wie beoordeelt | Ja | Nee | Onbekend |
|---|---|---|---|---|
| Accountklasse | DealDrive, uit medewerkers | klasse in je keuze | klasse erbuiten | geen medewerkersaantal |
| Branche | DealDrive, uit SBI | zelfde SBI als je klanten | andere SBI | geen SBI, of je klanten hebben er geen |
| Aanleiding | DealDrive, uit je tekst | trefwoord in een bewijszin | komt niet voor | geen trefwoord gevonden |
| Werkgebied | dossier van de zoeker | volgens dossier | volgens dossier | volgens dossier |
| Groeisignaal, Omvang in omzet, Huidige leverancier, Vindbaarheid | dossier van de zoeker | volgens dossier | volgens dossier | volgens dossier |

Details die ertoe doen:

- Klasse en branche worden alleen berekend als het dossier ze niet al zelf gaf. Zo praten de zoekopdracht en het bewijs altijd over dezelfde klassen en SBI-codes.
- SBI wordt op de code vergeleken: "4120: Algemene bouw" en "4120" zijn gelijk.
- Aanleiding: DealDrive knipt je tekst in woorden van vier letters of meer, in kleine letters, en voegt de stam zonder meervouds-s of -en toe ("servicemonteurs" wordt ook "servicemonteur"). Staat een van die woorden in een bestaande bewijszin, dan wordt de aanleiding "ja" met een verwijzing naar die zin, en neemt hij de bron en datum ervan over. Een aanleidingsregel uit het dossier wordt vervangen, niet aangevuld. Een aanleiding levert dus nooit "nee" op.
- Werkgebied wordt niet getoetst aan de postcodes in de zoekopdracht. Het is een vaste regel in het voorbeelddossier. Gevolg in de demo: bij Van Dijk Bouw staat "Apeldoorn valt in je gebied Oost.", terwijl Apeldoorn (postcode 73) niet in "Postcode 80, 10, 38, 31" voorkomt.
- De score telt de ja-regels zonder maximum. Een dossier met meer dan zes regels kan in theorie boven de 6 uitkomen.

### De drie regels van de match

1. Onbekend is geen nee. Een bedrijf zonder gepubliceerde jaarrekening wordt niet afgestraft; onbekend telt niet mee in de score en blokkeert niets.
2. Een nee blokkeert. Eén "nee" op welk criterium ook laat het bedrijf naar "Valt af" gaan, met de bewijszin als reden.
3. Elk oordeel draagt zijn bewijs, met bron en, waar het veroudert, een datum.

### De volgorde van de groepen

Per lead beslist DealDrive in deze volgorde, en de eerste treffer wint:

1. "Al in je CRM": er bestaat een account met hetzelfde KvK-nummer, of anders met hetzelfde domein (zonder "www." en ongeacht hoofdletters). Dat gaat vóór "Valt af", zodat je bij een eigen klant geen "valt af" leest.
2. "Valt af": minstens één criterium staat op "nee".
3. "Verlopen": het dossier is ouder dan 30 dagen. Een lead zonder dossierdatum kan niet verlopen zijn.
4. "Nog niet te beoordelen": geen enkel criterium heeft een oordeel (0 beoordeeld).
5. "Passend": al het andere.

"Passend" betekent dus: niet bekend, geen nee, niet verlopen en minstens één oordeel. Een bedrijf met één ja en vijf onbekend is passend. Er is geen minimumscore.

### Dossierhoudbaarheid

| Grens | Dagen | Wat de code zegt | Werkt nu? |
|---|---|---|---|
| zacht | 30 | daarna zakt de lead naar "Verlopen" en wordt de pil oranje | ja |
| hard | 120 | daarna is het bewijs niet meer bruikbaar | alleen vastgelegd |
| opruimen | 60 | zonder actie gaat de lead daarna weg, dossier en al | alleen vastgelegd |

De zachte en harde grens zijn bewust gelijk aan de vacaturegrenzen van de webzoeker (30 en 120 dagen), omdat een leaddossier in de praktijk op vacatures stoelt, het kortst levende bewijs. Een controle in de testsuite (npm run test:leadgenerator) faalt als die twee uit elkaar lopen. Opruimen na 60 dagen is nergens gebouwd.

### De grenzen van de bundel

| Grens | Waarde | Afgedwongen? |
|---|---|---|
| Zoekrondes per organisatie per maand | 120 | alleen in de browser: knop uit bij 0 over, teller weg na herladen |
| Dossiers per organisatie per maand | 240 | nee, alleen weergave |
| Rondes per gebruiker per dag | 10 | nee |
| Bedrijven per ronde | 25 | nee, alleen genoemd in de uitleg |
| Hergebruik van dezelfde opdracht | 24 uur | nee, alleen genoemd in de uitleg |

De redenering in de code: een ronde doet drie vaste zoekopdrachten, wat er ook uitkomt, en telt dus per ronde. Een dossier is zoeken en lezen voor één bedrijf en telt dus per bedrijf. Zou je per gevonden bedrijf tellen, dan wordt een rake zoekopdracht duurder dan een misser terwijl hij evenveel kost. De limiet van 25 bedrijven per ronde maakt een ronde te beprijzen, omdat het model anders onbeperkt tekst moet lezen. De daggrens van 10 voorkomt dat één gebruiker de maand op één middag opmaakt.

### Wat voorbeelddata is

- De vijf leads zijn verzonnen bouwbedrijven in SBI 4120, zo gekozen dat elke groep één keer voorkomt: Van Dijk Bouw en Installatie BV (passend, 5/6), Bouwgroep Thermiek BV (passend, 4/6), Elektro Nederveen BV (nog niet te beoordelen, 0/6), Bouwbedrijf Salland BV (verlopen, dossier 64 dagen), Aannemersbedrijf Kraaijeveld (valt af, 8 medewerkers).
- Hun datums staan relatief ten opzichte van vandaag (2, 5, 12, 64 en 66 dagen geleden), zodat de demo niet veroudert.
- De bronnen ("Indeed", "Installatie.nl", "Eigen website", "Jouw postcodegebieden") en het werkgebied ("gebied Oost") zijn vaste tekst.
- De status overgenomen of afgewezen leeft alleen in de browser. De voorbeeldleads mogen volgens de code nooit de database in.
- Echt zijn: de zoekopdracht uit je accounts, de klasse- en branchetoets, de aanleidingtoets, de ontdubbeling tegen je echte accounts, en de prospect die "Neem over" aanmaakt.

### Wat de webzoeker zou doen (server/utils/webBron.ts)

De webzoeker bestaat al, maar wordt vandaag alleen gebruikt door de inzichtenmotor voor AI-regels met bron "Extern" (vacatures en nieuws over bestaande accounts), en alleen in het pakket Compleet. Voor de Generator is hij niet aangesloten. Wat hij doet, en wat de Generator dus zou erven:

- Eén aanroep naar Claude per bedrijf, met de zoektool van Anthropic en hoogstens 3 zoekopdrachten per beoordeling. Het model zoekt en beoordeelt in dezelfde beurt en antwoordt in een vast formaat: relevant, zekerheid (0 tot 100), titel, wat er gevonden is, de commerciële hoek, bewijsstukken (bron, URL, letterlijk citaat, publicatiedatum) en een voorgestelde taak.
- Bewijsplicht: elke URL die het model noemt, wordt gecontroleerd tegen de URL's die de zoektool echt heeft teruggegeven. Een URL die daar niet in staat, of een bewijsstuk zonder citaat, wordt geschrapt. Blijft er geen bewijs over, dan is er geen oordeel.
- Datumcontrole: de publicatiedatum telt alleen als het model een kale datum (jaar-maand-dag) teruggeeft die niet in de toekomst ligt en niet meer dan een week na de laatste wijziging van de pagina valt. Anders valt hij terug op de paginaleeftijd die de zoektool meelevert. Datums worden altijd in UTC gelezen.
- Houdbaarheid per soort: vacatures zacht 30 en hard 120 dagen, nieuws zacht 90 en hard 365 dagen. Boven hard gaat het bewijsstuk eruit; boven zacht blijft het staan maar vervalt het taakvoorstel. Een onbekende ouderdom wordt nooit weggegooid.
- Een taakvoorstel komt er alleen bij een zekerheid van minstens 60 en zonder bewijs boven de zachte grens.
- Kosten: per aanroep worden tokens en het aantal werkelijk uitgevoerde zoekopdrachten gelogd als "web-beoordeling", omdat zoeken per opdracht wordt afgerekend.
- Zonder Anthropic-sleutel geeft de webzoeker niets terug in plaats van verzonnen bronnen.

Voor de Generator ontbreken nog: een brede zoekronde die nieuwe bedrijven vindt (de huidige webzoeker beoordeelt één bekend bedrijf, hij zoekt geen nieuwe), het ophalen van KvK-nummer, SBI-code en medewerkersaantal, een endpoint, een tabel voor leads, de meting van rondes en dossiers op de server, het hergebruik binnen 24 uur en het opruimen na 60 dagen.

## Gegevens

### Een lead

| Veld | Betekenis |
|---|---|
| id, organisatie (organisationId) | sleutel en eigenaar |
| naam (naam), plaats (plaats) | bedrijfsnaam en vestigingsplaats |
| KvK-nummer (kvk) | eerste ontdubbelsleutel |
| domein (domein) | tweede ontdubbelsleutel, voor bedrijven zonder gevonden KvK-nummer |
| medewerkers (medewerkers), SBI-code (sbi) | basis voor de klasse- en branchetoets |
| gevonden op (gevondenOp) | datum van de vondst; bepaalt de volgorde in de lijst |
| dossier op (dossierOp) | datum van het dossier; leeg zolang niet uitgediept |
| bewijs (bewijs) | lijst bewijsregels |
| status (status) | nieuw, overgenomen of afgewezen |

### Een bewijsregel

Criterium (criterium) in de woorden van de gebruiker, oordeel (oordeel: ja, nee of onbekend), de bewijszin met de getallen erin (bewijs), de bron (bron, leeg bij een oordeel uit je eigen CRM) en de brondatum (bronDatum, alleen bij bewijs dat veroudert).

### De zoekopdracht

Klassen (klassen), SBI-codes (sbi), tweecijferige postcodegebieden (postcodes) en de vrije aanleiding (aanleiding). Wordt niet opgeslagen.

### Opslag

- Leads: alleen in het geheugen van de browser, als vaste voorbeeldlijst. Er is geen tabel en geen endpoint.
- Rondeteller en de stand "gezocht": sessiestatus in de browser, weg na herladen.
- Prospect na "Neem over": een echt account via de gewone schrijfroute (wachtrij naar de server), met naam, soort prospect, KvK-nummer, plaats, website, klasse in tier (alleen A, B of C) en herkomst "Gevonden door de leadgenerator".
- Van andere features: accounts (klasse, SBI-code, postcode, KvK-nummer, website), accountklassen uit de instellingen, de functievlag en het pakket uit HQ.

## Wat dit betekent voor Dealtrace

- Overnemen: de zoekopdracht uit het eigen klantenbestand afleiden, met onder elk veld waar de waarde vandaan komt. Dat haalt de drempel van een leeg formulier weg. Leid hem wel alleen uit echte klanten af (niet uit prospects) en laat de accountmanager kiezen uit welk deel van zijn bestand.
- Overnemen: de drie matchregels (onbekend is geen nee, een nee blokkeert, elk oordeel met bron en datum) en de vijf groepen met "Al in je CRM" vóór "Valt af". Voeg wel een minimumscore toe; nu is één ja met vijf onbekend al "Passend".
- Anders: toets het werkgebied echt, aan postcodes of aan een straal rond de thuisbasis van de buitendienstmedewerker, en laat de binnendienst op regio of heel Nederland zoeken. Voor de buitendienst hoort er een kaart of routevolgorde bij.
- Anders: "Neem over" moet alles meenemen wat de lead weet (SBI, medewerkers, bron, het bewijs als notitie) en de klasse in hetzelfde veld zetten dat de klantkaart toont. Maak er direct een eerste taak bij, bellen voor de binnendienst en een bezoek voor de buitendienst, op basis van de aanleiding.
- Anders: "Niet relevant" met een reden (te klein, verkeerde branche, al een leverancier, geen budget) die terugvloeit in de volgende zoekopdracht, en bewaard op de server zodat een afgewezen bedrijf echt niet terugkomt.
- Ontbreekt: de brede zoekronde zelf, met het KvK-handelsregister als ruggengraat (KvK-nummer, SBI, medewerkersklasse, adres) en de webzoeker alleen voor het dossier. De bewijsplicht en datumcontrole uit webBron.ts zijn daarvoor direct bruikbaar.
- Ontbreekt: echte bundelmeting op de server (rondes, dossiers, daggrens, hergebruik binnen 24 uur), het opruimen van verlopen leads, en een contactpersoon per lead (functie, telefoon, LinkedIn), want een bedrijf zonder aanspreekpunt is voor een accountmanager nog geen lead.
- Ontbreekt: een overzicht voor de salesmanager van rondes, overgenomen leads en omzetting naar afspraken per accountmanager, zodat zichtbaar wordt of de generator nieuwe business oplevert.
