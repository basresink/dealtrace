# Roadmap (het wensenbord)

## Wat het is en waarvoor

De Roadmap in DealDrive HQ is het wensenbord: één bord met vier kolommen waarop elk featureverzoek van elke klantorganisatie als kaart staat. Het is de plek waar de founder en het productteam lezen wat gebruikers missen, beslissen wat er gebouwd wordt, een wens desgewenst rechtstreeks als GitHub-issue laten bouwen door Claude Code, en de klant laten zien waar zijn wens staat.

Het probleem dat het oplost: wensen kwamen vroeger binnen in een aparte inbox en werden bij goedkeuring gekopieerd naar een tweede lijst die als roadmap werd getoond. Die kopie liep uit de pas met het origineel (prioriteit, indiener, datums en issuenummer gingen niet mee). Nu is het bord een weergave van de verzoeken zelf. Een kaart verplaatsen is letterlijk de status van dat verzoek wijzigen. Daardoor kan wat de founder ziet niet afwijken van wat de klant op zijn eigen roadmap ziet.

Je gebruikt het scherm wanneer je de wachtrij met nieuwe wensen doorloopt, een wens afwijst of oppakt, een bouwrun start of de uitkomst daarvan bekijkt, een gebouwde wens op Klaar zet, en wanneer je bepaalt welke wensen andere klanten op hun publieke roadmap mogen zien. Je zet er ook je eigen ideeën op, als wens zonder klant.

Samenhang met de klantapp en andere schermen:

- De klant dient wensen in en stemt op wensen van collega's op /roadmap in de werkplek. Die rijen landen in de tabel feature_requests, per organisatie en onder rijbeveiliging (RLS).
- HQ leest alle rijen over organisaties heen en schrijft status, reactie, GitHub-gegevens, bouwstand en publieke teksten terug in dezelfde rij.
- De klant ziet zijn eigen wensen terug in dezelfde vier kolommen, met eigen woorden, en ziet onder "Ook op de planning" wat de founder van andere klanten publiek heeft gezet.
- De GitHub-workflow claude-ontwikkel.yml meldt het resultaat van een bouwrun terug op een eigen HQ-route, en die terugmelding verschijnt op de kaart.
- Bij een bouw en bij oplevering krijgt de indiener een pushmelding in de meldingscategorie "roadmap", die de klant zelf kan uitzetten onder Instellingen, Notificaties.
- Er is geen koppeling met Klanten, Abonnementen of Facturen in HQ: de organisatienaam op een kaart wordt bij het indienen meegeschreven en is geen link.

![Het wensenbord in HQ met de meetlat en de vier kolommen, in voorbeeldmodus](shots/roadmap-1-bord.png)

## Waar je het vindt

In de zijbalk van HQ staat de groep "Bouwen" met als enig item "Roadmap" (kaarticoon). De route is /admin/roadmap, de paginatitel in de browser is "Roadmap · DealDrive HQ".

Alleen de rol superuser (de founder) ziet het scherm. De routebewaking in de app stuurt iedereen zonder die rol weg van alles onder /admin, en elke serverroute onder /api/superuser/feature-requests weigert met 403 "Alleen voor superusers.". HQ is een aparte build van dezelfde codebasis: de routes /api/superuser en /api/hooks/github bestaan alleen in de HQ-build, in de klantbuild zijn ze er niet.

Er zijn geen doorklikken naar dit scherm vanuit andere HQ-schermen. Je komt er alleen via de zijbalk. Ben je als founder ingestapt in een klantomgeving (via Klanten), dan toont het bord een waarschuwing dat je eerst moet uitstappen om het bord van alle klanten te zien.

De klantkant staat in de werkplek op /roadmap. Een gebruiker komt daar via het gebruikersmenu onderaan de zijbalk (klik op je naam, dan "Roadmap", tussen "Playbooks" en "Uitloggen"), en via verwijzingen in het Helpcenter ("Dien een wens in op de roadmap"). Elke rol mag daar indienen en stemmen.

## Opbouw van de pagina

### Kop

- Kicker: "DealDrive HQ · Bouwen · Roadmap", met het gele streepje ervoor.
- Titel: "Wat bouwen we, en wanneer."
- Subtitel: "Elke kaart is een verzoek van een klant. Verplaatsen is hier hetzelfde als de status van dat verzoek wijzigen, dus de indiener ziet het meteen op zijn eigen roadmap."
- Knop rechtsboven: "Eigen wens" met een plusteken. Is het formulier open, dan heet de knop "Sluiten".

### Meetlat

Onder de kop staat een strook met vijf cellen, allemaal berekend uit dezelfde lijst verzoeken:

| Cel | Wat erin staat | Bron |
|---|---|---|
| "Wens" | aantal kaarten in Wens | rijen met status nieuw |
| "Bezig" | aantal kaarten in Bezig | in-behandeling plus de oude status goedgekeurd |
| "Afgewezen" | aantal afgewezen kaarten | status afgewezen |
| "Klaar" | aantal opgeleverde kaarten | status klaar |
| "Oudste open wens" | dagen sinds indienen, met de titel eronder | oudste kaart in Wens |

De oudste open wens rekent het aantal hele dagen tussen nu en de indiendatum (afgerond naar beneden, nooit negatief) en toont dat als bijvoorbeeld "22d". De titel mag over twee regels lopen; de organisatienaam staat alleen in de tooltip. Is er geen kaart in Wens, dan toont de cel een streepje en "geen open verzoeken", of "verzoeken laden…" tijdens het laden.

### Meldingen boven het bord

- Ingestapt in een klant: "Let op: je bent ingestapt in een klantomgeving. Stap uit (Klanten → Stap uit) om het wensenbord van alle klanten te zien."
- Voorbeeldmodus (geen database): "Voorbeeldwensen. Er is geen database verbonden, dus dit zijn zeven verzonnen kaarten om het bord te kunnen bekijken. Verplaatsen kan, maar wordt niet bewaard."
- Laadfout: "De wensen konden niet geladen worden. Dit is dus geen lege wachtrij: het bord weet op dit moment niet wat erin staat." met de knop "Opnieuw proberen". Zo ziet de founder het verschil tussen een lege wachtrij en een kapotte verbinding.
- Tijdens het laden: "Wensen laden…".

### Het bord

Vier kolommen naast elkaar, in de volgorde waarin werk beweegt. Elke kolom heeft een kop met naam en teller, een uitlegregel en de kaarten. Een lege kolom toont "Leeg". De vier kolommen staan alleen naast elkaar als elk minstens ongeveer 240 pixels breed kan zijn; op een smaller venster worden het er twee per rij.

| Kolom | Uitleg onder de kop | Status in de database |
|---|---|---|
| "Wens" | "Binnengekomen, nog niet beoordeeld. Gesorteerd op stemmen." | nieuw |
| "Bezig" | "Beoordeeld en opgepakt; meestal met een issue en een bouwrun van Claude Code." | in-behandeling |
| "Afgewezen" | "Met een reden, en die reden leest de indiener terug." | afgewezen |
| "Klaar" | "Gebouwd en uitgeleverd. De indiener krijgt bericht." | klaar |

![De kaarten op het bord met stemmen, citaat, labels, bouwregel en acties](shots/roadmap-2-kaarten.png)

### De kaart

Van boven naar beneden:

- Stemblok links met het aantal stemmen en "stem" of "stemmen", daarnaast de titel van de wens.
- De toelichting van de indiener als citaat, met daaronder de afzender: naam van de indiener en organisatienaam ("Tom Willems · Regiemakers"). Zonder toelichting staat alleen de afzender er.
- Een rij labels: de prioriteit die de indiener koos ("Laag", "Midden", "Hoog", in kleur), het pad van de pagina waarop de wens slaat (bijvoorbeeld "/bezoeken"), een link "issue #251 ↗" als er een GitHub-issue is, en "op de klant-roadmap" als de wens publiek staat en een publieke titel heeft.
- Een bouwregel, alleen in Wens en Bezig en alleen als er een terugmelding uit GitHub is. Kop "Gebouwd en klaar om te bekijken" (pull request open) met de tekst "De controles draaiden groen. Bekijk de preview, merge, en zet de kaart daarna op Klaar: dat meldt de indiener dat zijn wens er is." en de knoppen "Bekijk de preview ↗" en "Bekijk PR #253 ↗". Of kop "De ontwikkel-run is gestrand" met "Zie de Actions-log in GitHub. De wens blijft staan, dus je kunt hem opnieuw laten oppakken."
- De reactie van de founder als "Jouw reactie: …", rood omrand in de kolom Afgewezen.
- Acties: keuzelijst "Verplaats" met de vier kolommen, knop "Kopieer prompt" (na een klik twee en een halve seconde "Prompt gekopieerd ✓"), en alleen in Wens en Bezig de knoppen "Maak issue" (zolang er geen issue is) en "Laat Claude Code dit oppakken". Loopt er al een bouw of staat er een pull request open, dan staat op de plaats van die laatste knop een grijs vak "Bouwrun loopt" of "PR staat open".
- Een ingeklapt blok "Publieke tekst en herkomst" (zie Flyouts, vensters en knoppen).

Kaarten zijn ook te slepen tussen kolommen. De kolom waar je boven hangt, krijgt een accent.

### Oude roadmaplijst

Onder het bord staat alleen een ingeklapt blok "Oude roadmaplijst (n)" als er nog regels staan in de vroegere aparte lijst (opgeslagen in de organisatie-instellingen onder de sleutel roadmap). De uitleg zegt dat die regels geen indiener en geen stemmen hebben. Per regel staan de knop "Zet om naar wens" en een kruisje om te verwijderen. In de mock is die lijst leeg en is het blok dus niet te zien.

### De klantkant: wat de gebruiker ziet

De werkplekpagina /roadmap heeft kicker "Product", titel "Roadmap" en de subtitel die uitlegt dat het bord hetzelfde bord is als dat van het productteam en dat verschuiven bij het productteam gebeurt.

- Blok "Wens indienen" met de knop "+ Nieuwe wens". Het formulier vraagt "Wat wil je anders of erbij?" (verplicht, 5 tot 120 tekens), "Welke pagina betreft het?" (paginanamen zonder pad), "Hoe urgent?" met "Laag: zou fijn zijn", "Midden: kost nu tijd" (standaard) en "Hoog: blokkeert mijn werk", en "Toelichting". De knop "Verstuur naar het productteam" geeft na succes "Wens verstuurd. Je ziet hier de status zodra het productteam reageert.".
- Blok "Het bord van jouw organisatie" met een teller en de zin "Alleen jullie eigen wensen. Wat er beweegt, beweegt bij ons: stemmen kun je zelf, verplaatsen niet." Vier kolommen: "Ingediend", "In ontwikkeling", "Niet gedaan", "Opgeleverd", elk met een eigen uitleg. Alleen in Ingediend staat een stemknop met pijltje; elders alleen het getal. Een kaart toont prioriteit, paginanaam, indiener en datum, eventueel "Er wordt op dit moment aan gebouwd.", de "Reactie productteam" en in Opgeleverd "Bijgewerkt" met datum.
- Blok "Ook op de planning" met de publieke wensen van andere organisaties. De eigen wensen worden eruit gefilterd, omdat ze hierboven al staan. Onderaan: "Volgorde en timing kunnen wijzigen."

In de werkplek-mock op poort 3088 staan vijf verzonnen wensen van één organisatie, staat de verstuurknop uit met "Voorbeeldmodus: er is geen database verbonden, dus indienen werkt hier niet.", geeft stemmen "Voorbeeldmodus: stemmen wordt niet bewaard." en toont "Ook op de planning" alleen een voorbeeldmelding. In productie is die lijst gevuld.

![De klantroadmap met het bord van de eigen organisatie in klantwoorden](shots/roadmap-6-klant-bord.png)

![Het klantformulier om een wens in te dienen](shots/roadmap-7-klant-formulier.png)

![Het blok Ook op de planning onder het klantbord, in voorbeeldmodus](shots/roadmap-8-klant-planning.png)

Waar het handboek afwijkt van het scherm: de eerste tabel in het handboek noemt de klantwoorden "Nieuw" en "Afgewezen", maar het scherm zegt "Ingediend" en "Niet gedaan". Het handboek noemt de knoppen "+ Eigen wens" en "Maak GitHub-issue"; op het scherm heten ze "Eigen wens" (met plusicoon) en "Maak issue". Volgens het handboek opent een tweede klik op de issueknop het bestaande issue; in werkelijkheid verdwijnt de knop en neemt het label "issue #N ↗" die rol over.

## Doorklikken: de stappen

### Een nieuwe wens beoordelen en oppakken

1. Open Bouwen, Roadmap. De kolom Wens staat gesorteerd op stemmen, de meetlat toont hoe oud de oudste open wens is.
2. Lees het citaat, de afzender, de prioriteit en de pagina op de kaart. Wil je de organisatie, de indiener en de datums zien, klap dan "Publieke tekst en herkomst" open.
3. Kies in "Verplaats" de waarde "Bezig", of sleep de kaart naar Bezig. De kaart schuift direct, de server slaat de status in-behandeling op en je ziet de toast "Verplaatst naar Bezig.".
4. De indiener ziet de wens vanaf nu in zijn kolom "In ontwikkeling". Er gaat bij een handmatige verplaatsing geen melding naar de indiener; die komt pas bij een geslaagde bouwrun of bij Klaar.

### Een wens door Claude Code laten bouwen

1. Klik op een kaart in Wens of Bezig op "Laat Claude Code dit oppakken". De knop toont "Bezig…" en alle GitHub-knoppen op het bord zijn even uitgeschakeld.
2. HQ maakt eerst een GitHub-issue met de ontwikkelprompt als tekst en de labels "wens" en "prio:hoog" (of laag of midden), bewaart het issuenummer op de wens en start daarna de workflow claude-ontwikkel.yml op de branch develop.
3. Gelukt: toast "Issue #N staat klaar en Claude Code is gestart. Zodra er een pull request is, zie je dat op deze kaart." Op de kaart verschijnt "issue #N ↗". Lukt het starten niet terwijl het issue er wel staat, dan volgt een waarschuwing "Issue #N staat klaar, maar Claude Code startte niet: …".
4. De workflow bouwt op een eigen branch, draait lint, typecheck en de rechten- en omgevingscontrole en opent een pull request naar develop. Daarna meldt hij terug aan HQ.
5. Herlaad het bord. De kaart toont nu "Gebouwd en klaar om te bekijken" met de preview en de pull request. Stond de kaart nog in Wens, dan is hij automatisch naar Bezig geschoven en heeft de indiener een melding gekregen.
6. Bekijk de preview, merge de pull request in GitHub en zet de kaart daarna op Klaar.

Wil je alleen een issue zonder bouwrun, klik dan "Maak issue": toast "Issue #N aangemaakt.". Wil je zelf bouwen, klik dan "Kopieer prompt" en plak de tekst in een Claude Code-sessie.

### Een wens afwijzen

1. Kies in "Verplaats" de waarde "Afgewezen", of sleep de kaart naar Afgewezen.
2. Het venster "Wens afwijzen?" opent. De keuzelijst springt terug naar de oude kolom zolang het venster open staat.
3. Typ de reden en klik "Afwijzen". De kaart gaat naar Afgewezen met je reactie erop, toast "Afgewezen, met je reactie erbij.".
4. Annuleer je of sluit je met Escape, dan blijft de kaart staan en zie je "Afwijzen zonder reactie doen we niet. De wens blijft staan.".

![Het venster Wens afwijzen met de verplichte reden en de tekentelling](shots/roadmap-5-afwijzen.png)

### Een wens opleveren

1. Zet de kaart op "Klaar" via de keuzelijst of door slepen.
2. Toast "Op Klaar gezet. De indiener krijgt bericht.". De server stuurt alleen bij de overgang naar Klaar een pushmelding "Je wens staat erin" naar de indiener, niet bij een tweede keer opslaan.
3. De indiener ziet de kaart onder "Opgeleverd" met "Bijgewerkt" en een datum. Stond de wens publiek, dan lezen andere klanten "Uitgebracht".

### Een wens publiek zetten voor alle klanten

1. Klap op de kaart "Publieke tekst en herkomst" open.
2. Vink "Toon op de klant-roadmap" aan. Zonder publieke titel volgt de toast "Vlag staat aan. Geef nog een publieke titel, anders blijft het item verborgen." en een waarschuwing op de kaart.
3. Typ een publieke titel, of klik "Neem interne titel over". Vul eventueel een korte publieke toelichting in. Opslaan gebeurt zodra je het veld verlaat, met de toast "Publieke tekst bijgewerkt.".
4. Onder de velden staat wat andere klanten zien, bijvoorbeeld "Klanten zien: Reistijden meenemen in de routeplanning · In ontwikkeling". Op de kaart verschijnt het label "op de klant-roadmap".

![Een kaart in Bezig met de bouwregel en het opengeklapte blok Publieke tekst en herkomst](shots/roadmap-3-kaart-bouw-publiek.png)

### Een eigen idee op het bord zetten

1. Klik rechtsboven "Eigen wens". Het formulier "Je eigen idee op het bord" opent boven het bord.
2. Vul de titel in, kies eventueel pagina en urgentie en schrijf een toelichting.
3. Klik "Zet op het bord". De wens komt bovenaan in Wens te staan, toast "Staat op het bord, in de kolom Wens.", en het formulier sluit.

## Flyouts, vensters en knoppen

Het scherm heeft geen flyouts. Er zijn een uitklapformulier, een venster, een uitklapblok per kaart en de knoppen op de kaart.

### Formulier "Je eigen idee op het bord"

- Opent met "Eigen wens", sluit met dezelfde knop (dan "Sluiten").
- Subtekst: "Komt in de kolom Wens te staan, net als een verzoek van een klant. Beoordelen doe je daarna, met dezelfde knoppen."
- "Wat wil je bouwen?": verplicht, tekst, minimaal 5 en maximaal 120 tekens, voorbeeldtekst "bv. Lerende relevantie op afgewezen inzichten".
- "Welke pagina betreft het?": optioneel, keuzelijst met "Algemeen of onbekend" en twintig werkplekpagina's met pad (Vandaag, Agenda, Inbox, Inzichten, Taken, Briefings, Bezoeken, Meetings, Belblokken, Prospectplanning, Accountplannen, Campagnes, Pipeline, Klanten, Prospects, Contacten, Offertes, Dashboard, Instellingen, Helpcenter).
- "Hoe urgent?": "Laag", "Midden" (standaard) of "Hoog".
- "Toelichting": optioneel, maximaal 2000 tekens, voorbeeldtekst "Wat moet er beter, en waarom nu?".
- Knop "Zet op het bord", actief vanaf 5 tekens in de titel, tijdens opslaan "Bezig…". Hint ernaast: "Hij begint bij Wens, net als alle andere."
- De server zet de wens in de eigen organisatie van de founder (niet in de klant waarin hij eventueel is ingestapt), met de founder als indiener en zijn eigen automatische stem. Een eigen wens kan niet direct in een andere kolom beginnen.

![Het formulier voor een eigen wens, in voorbeeldmodus met uitgeschakelde knop](shots/roadmap-4-eigen-wens.png)

### Venster "Wens afwijzen?"

- Opent bij verplaatsen naar Afgewezen, via keuzelijst of slepen.
- Tekst: "Waarom wijs je "titel" af? De indiener leest deze reactie terug."
- Eén tekstveld, verplicht, maximaal 1000 tekens, met teller "n / 1000" en voorbeeldtekst "Bijvoorbeeld: past niet bij de richting van het product, of lost een ander onderdeel al op.". Het veld krijgt direct de focus.
- Knoppen "Annuleren" en "Afwijzen". "Afwijzen" is pas actief als er tekst staat (spaties tellen niet).
- Escape en een klik buiten het venster werken als Annuleren.

### Uitklapblok "Publieke tekst en herkomst"

- Herkomstregel: organisatie, indiener, "ingediend" met datum en "bijgewerkt" met datum. Datums als "5 okt", met jaartal als het een ander jaar is.
- Vinkje "Toon op de klant-roadmap": slaat direct op. Uitzetten geeft "Van de klant-roadmap gehaald.".
- Alleen met het vinkje aan: veld "Publieke titel (zo lezen andere klanten het)" (maximaal 120 tekens), knop "Neem interne titel over", veld "Korte publieke toelichting (optioneel)" (maximaal 400 tekens).
- Zonder publieke titel de waarschuwing "Nog niet zichtbaar: zonder publieke titel laat /roadmap dit item weg. Dat is met opzet, zodat een interne titel er niet per ongeluk doorheen glipt."
- Met titel de voorvertoning "Klanten zien: titel · fase", waarbij een afgewezen wens als "Afgewezen (wordt niet getoond)" leest.

### Knoppen op de kaart

- "Kopieer prompt": zet de ontwikkelprompt op het klembord met de toast "Ontwikkelprompt gekopieerd. Plak hem in een Claude Code-sessie.". Weigert de browser het klembord, dan komt de prompt in een tekstvak op de kaart en volgt de fout "Het klembord is geblokkeerd. De prompt staat nu op de kaart; kopieer hem daar zelf.".
- "Maak issue": maakt alleen het GitHub-issue. Verdwijnt zodra er een issue is; daarna is "issue #N ↗" de link naar GitHub.
- "Laat Claude Code dit oppakken": maakt het issue als dat nog niet bestaat en start de workflow.
- "Bekijk de preview ↗" en "Bekijk PR #N ↗": openen de Netlify-preview en de pull request in een nieuw tabblad.
- Bij "Oude roadmaplijst": "Zet om naar wens" maakt een wens met prioriteit midden (titel afgekapt op 120 tekens, omschrijving plus "Doel: …" op 2000) en haalt de oude regel pas weg als dat gelukt is. Het kruisje vraagt eerst bevestiging: "Oude regel verwijderen?" met "dit kan niet ongedaan worden gemaakt".

### Voorbeeldmodus

In de mock op poort 3096 is er geen database. Alle schrijvende knoppen en velden ("Zet op het bord", "Maak issue", "Laat Claude Code dit oppakken", het vinkje en de publieke velden) staan uit met de tooltip "Voorbeeldmodus: zonder database wordt er niets bewaard.". Verplaatsen werkt alleen op het scherm, met de toast "Voorbeeldmodus: verplaatst op het scherm, niet opgeslagen.", en ook dan vraagt Afgewezen om een reden. Na herladen staat alles weer terug.

## Filters, zoeken, sorteren en weergaven

Het bord heeft geen filters, geen zoekveld, geen weergavekeuze en niets in de URL. Je ziet altijd alle verzoeken van alle organisaties. De tellers in de kolomkoppen en de meetlat tellen dus altijd het hele bestand.

Sorteren ligt vast: binnen elke kolom staat de kaart met de meeste stemmen bovenaan, bij gelijke stand de nieuwste eerst. Er is geen handmatige volgorde en de founder kan de prioriteit van een wens niet aanpassen; de prioriteit is de urgentie die de indiener koos. Prioriteren in HQ betekent dus: kiezen welke kaart je naar Bezig haalt, met het aantal stemmen en de urgentie als richting. De prioriteit gaat wel mee als label "prio:…" op het GitHub-issue en als regel in de ontwikkelprompt.

Bij veel organisaties wordt dit een lange kolom zonder manier om op klant, pagina of prioriteit te filteren.

## Regels en berekeningen

### Statussen en overgangen

- Elke nieuwe wens begint als nieuw (kolom Wens), ook een eigen wens van de founder.
- De founder mag elke kolom naar elke andere verplaatsen, ook terug. Alleen naar Afgewezen is een reden verplicht, en die eis zit alleen in het scherm: de serverroute accepteert een afwijzing zonder reactie.
- De oude status goedgekeurd wordt nog gelezen en altijd in Bezig getoond. De server vouwt een binnenkomende goedgekeurd om naar in-behandeling, zodat hij niet meer wordt weggeschreven. In de mock staat zo'n kaart ("Notities bij een contactpersoon") om dat te laten zien.
- De bouwterugmelding verschuift een kaart alleen van Wens naar Bezig, nooit terug en nooit vanuit Afgewezen of Klaar. De mens gaat over de kolom, de workflow alleen over de bouwregel.
- De reactie (adminNotitie) kan in het scherm alleen bij afwijzen worden gezet. De klant ziet hem in elke kolom behalve Opgeleverd. Haal je een afgewezen wens later terug naar Bezig, dan blijft de afwijsreden voor de klant zichtbaar onder "In ontwikkeling".

### Stemmen

- De indiener stemt automatisch op zijn eigen wens; een nieuwe wens begint dus met 1 stem.
- Stemmen is een aan-uitknop per gebruiker en kan alleen binnen de eigen organisatie. De stemmen staan als lijst gebruikers-id's in het gegevensveld; de kolom stemmen is de afgeleide teller.
- Stemmen kan alleen zolang de wens in Ingediend (Wens) staat. Daarna weigert de server met 409 "Deze wens is al opgepakt; stemmen verandert de volgorde niet meer.". Reden: elke stem schrijft de rij opnieuw en verschuift de bijwerkdatum, en daarmee de volgorde van de publieke roadmap.
- Klanten zien en stemmen niet op wensen van andere organisaties. Het stemaantal op het HQ-bord is dus altijd het aantal stemmen binnen één klant.

### GitHub-koppeling

- Het issue komt in de repository uit de instelling GITHUB_REPO (standaard de DealDrive-repository) met een token dat alleen op de HQ-omgeving staat. Zonder token geven de knoppen de fout "GitHub is niet gekoppeld. Zet GITHUB_TOKEN op de HQ-omgeving.".
- Er wordt nooit een tweede issue voor dezelfde wens gemaakt: bestaat er een nummer, dan gebruikt HQ dat.
- Een tweede start terwijl de bouwstand gestart of pr-open is, weigert de server met 409 ("Er staat al een pull request open voor issue #N. Merge of sluit die eerst." of "Er loopt al een bouwrun op issue #N."). Een gestrande run mag opnieuw.
- De workflow opent altijd een pull request en merget nooit. Beide Netlify-sites bouwen uit develop, en een automatische merge zou een fout ook in HQ zelf laten landen. De preview-url wordt voorspeld als deploy-preview-nummer op de stagingsite.
- Claude Code mag in de workflow alleen lezen, schrijven, zoeken en de vijf controlescripts draaien.
- Tegen het binnensmokkelen van instructies: regels in de titel of toelichting van een klant die beginnen met een kopregel in hoofdletters (zoals "NOTITIE VAN DE FOUNDER:") krijgen een spatie ervoor, zodat ze in het issue niet als opdracht van de founder lezen. De workflow leest de issuetitel uit een bestand en zet hem nooit rechtstreeks in een shellcommando.

### De ontwikkelprompt

De prompt begint met "Bouw dit verzoek uit de DealDrive-roadmap:" en bevat de regels WENS, TOELICHTING, PAGINA (of de opdracht zelf de plek te bepalen), PRIORITEIT, INGEDIEND DOOR met organisatie en aantal stemmen, en NOTITIE VAN DE FOUNDER als er een reactie is. Daarna volgt een vaste AANPAK: bestaande patronen aanhouden (optimistisch schrijven met synchronisatiewachtrij, RLS per organisatie, Nederlandse teksten), het handboek bijwerken en in de browser verifiëren.

### Terugmelding uit de bouw

- De laatste workflowstap roept de HQ-route /api/hooks/github/wens aan met issuenummer, status (pr-open of gestrand), pull-requestnummer, pull-request-url en preview-url.
- Geen sessie, maar een gedeeld geheim in de header x-dealdrive-hook dat gelijk moet zijn aan HQ_HOOK_SECRET. De vergelijking gebeurt op een manier die via de responstijd niets prijsgeeft. Zonder geheim: 401 "Geen toegang.".
- Links worden alleen overgenomen als ze https zijn, maximaal 500 tekens, en op github.com (pull request) of netlify.app (preview) staan.
- Een latere gestrande run wist de pull request en de preview van een eerdere geslaagde run niet.
- Is er geen wens bij het issue, dan antwoordt de route met "Geen wens gevonden bij issue #N." zonder fout, zodat de workflow groen blijft.
- Ontbreken HQ_BASE_URL of HQ_HOOK_SECRET op GitHub, dan slaat de stap zichzelf over.

Let op, de code werkt hier anders dan het scherm suggereert: de bouwstatus gestart wordt nergens weggeschreven. HQ zet hem niet na het starten en de workflow meldt alleen pr-open of gestrand. Het grijze vak "Bouwrun loopt" en de kop "Claude Code is gestart" verschijnen daardoor in de praktijk niet, en tussen het starten en de terugmelding blijft "Laat Claude Code dit oppakken" klikbaar. Een tweede klik start dan een tweede run op hetzelfde issue, die GitHub achter de eerste in de wachtrij zet.

### Meldingen aan de indiener

- Twee momenten: "Je wens wordt gebouwd" ("titel" staat in ontwikkeling) bij een terugmelding pr-open terwijl de kaart in Bezig staat, één keer per pull request; en "Je wens staat erin" ("titel" is opgeleverd) bij de overgang naar Klaar. Beide linken naar /roadmap.
- Geen melding bij afwijzen en geen melding bij handmatig naar Bezig zetten.
- De categorie roadmap staat standaard aan, met in-app en push en met respect voor stille uren. In stille uren (tijd in Amsterdam) wordt de melding overgeslagen, niet uitgesteld.
- In de code gaat alleen een pushmelding uit; er wordt geen melding in de app vastgelegd, ook al staat in-app als kanaal aan. Een fout bij melden laat de statuswijziging nooit mislukken.

### Publieke roadmap

- Een databasefunctie levert per publieke wens alleen id, publieke titel, publieke omschrijving, publieke fase en bijwerkdatum. Nooit de interne titel, toelichting, organisatie, indiener, prioriteit of reactie.
- Alleen met vlag aan, niet afgewezen en met een niet-lege publieke titel.
- Fase: Bezig wordt "In ontwikkeling", Klaar wordt "Uitgebracht", Wens wordt "Op de planning". Een publiek gezette wens die nog in Wens staat, lezen andere klanten dus als gepland, terwijl hij nog niet beoordeeld is.
- Volgorde bij de klant: In ontwikkeling, dan Op de planning, dan Uitgebracht, binnen elke fase de meest recent bijgewerkte eerst.

### Rechten en scheiding

- Klanten lezen en schrijven wensen alleen binnen de eigen organisatie onder RLS. De founder leest en wijzigt over organisaties heen via twee beveiligde databasefuncties die uitsluitend de wensentabel raken, en die op de HQ-databaserol draaien.
- De klant krijgt een eigen kale vorm van zijn wens terug: titel, toelichting, pagina, prioriteit, kolom, stemmen, of hij zelf gestemd heeft, indiener, reactie, één bouwfeit ("Er wordt op dit moment aan gebouwd.") en datums. Geen issuenummer, geen pull request, geen preview, geen publieke vlag, geen stemmende collega's.

### Validatie

| Veld | Regel |
|---|---|
| Titel | 5 tot 120 tekens |
| Toelichting | maximaal 2000 tekens |
| Pagina (klantroute) | pad binnen de app, maximaal 120 tekens |
| Reactie | maximaal 1000 tekens |
| Publieke titel en toelichting | maximaal 120 en 400 tekens |

## Gegevens

Eén record per wens in de tabel feature_requests:

- Id (id), opgebouwd als "fr-" plus tijdstempel en vier willekeurige tekens.
- Organisatie (organisationId) en organisatienaam (organisationName, bij indienen meegeschreven in het gegevensveld).
- Indiener (userId) en naam van de indiener (userName).
- Titel (titel) en toelichting (omschrijving, in het gegevensveld).
- Pagina (url), een pad zoals /taken.
- Prioriteit (prioriteit): laag, midden of hoog, standaard midden.
- Status (status): nieuw, in-behandeling, afgewezen of klaar, plus de vervallen waarde goedgekeurd.
- Stemmen (stemmen) als teller en de lijst stemmers (votes) in het gegevensveld.
- Reactie van de founder (adminNotitie).
- GitHub-issue (githubIssue) en de link ernaar (githubIssueUrl).
- Bouwstand (bouw): status gestart, pr-open of gestrand, pull-requestnummer (prNummer), pull-request-link (prUrl), preview-link (previewUrl) en tijdstip van de laatste terugmelding (bijgewerktOp).
- Publiek (publiek), publieke titel (publiekeTitel) en publieke toelichting (publiekeOmschrijving).
- Verwijzing naar een item op het oude bord (roadmapItemId): wordt niet meer geschreven.
- Aangemaakt (createdAt) en bijgewerkt (updatedAt). Bijgewerkt verspringt bij elke wijziging, ook bij elke stem.

Het gegevensveld wordt bij elke founderwijziging volledig opnieuw opgebouwd uit een vaste lijst velden. Een veld dat daar ontbreekt, verdwijnt bij de volgende opslag.

De regels van de oude roadmaplijst staan apart in de organisatie-instellingen van de HQ-organisatie. De meldingsvoorkeuren van de indiener komen uit zijn gebruikersrecord. Push gaat via de aanmeldingen van zijn toestellen.

## Wat dit betekent voor Dealtrace

- Overnemen: één tabel waarin de kolom de status is, met één gedeelde vertaling naar founderwoorden, klantwoorden en publieke fase. Dat voorkomt dat HQ en klant verschillende dingen zeggen.
- Overnemen: de kale klantvorm en de aparte publieke titel. Een wens van een accountmanager bevat al snel namen van prospects of klanten; die mogen nooit via een publieke roadmap bij een andere Dealtrace-klant terechtkomen. Voor Dealtrace is dat ook een AVG-punt.
- Overnemen: de keten wens, issue, bouwrun, pull request met preview, terugmelding op de kaart, en melding aan de indiener. Schrijf wel de status gestart weg bij het starten, zodat dubbele runs niet mogelijk zijn.
- Anders: geef de founder filters op klant, pagina, prioriteit en leeftijd, en een eigen prioriteitsveld naast de urgentie van de indiener. Stemmen per klant zegt bij Dealtrace weinig als één groot binnendienstteam veel stemmers heeft; weeg stemmen per klant of toon het aantal organisaties dat iets vraagt.
- Anders: koppel een wens aan de klantkaart in de founder-console, met abonnement, gebruik en kosten van agents en dataverrijking, zodat je ziet of een wens van een klant komt die veel kost of veel oplevert.
- Anders: verwacht wensen die raken aan LinkedIn-limieten, scraping en herkomst van data. Voeg een vast controlepunt toe (mag dit volgens AVG en de voorwaarden van de bron) voordat een wens naar een bouwrun gaat, en laat de ontwikkelprompt die regels meesturen.
- Ontbreekt: een reactie bij andere statussen dan afwijzen, ontdubbelen of samenvoegen van gelijke wensen van verschillende klanten, een geplande releasedatum, en een melding in de app naast de pushmelding.
