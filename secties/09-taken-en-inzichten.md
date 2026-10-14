# Taken en inzichten als één keten

## Wat het is en waarvoor

DealDrive behandelt inzichten en taken niet als twee losse lijsten, maar als één keten met vier schakels: een **inzicht** (er is iets gebeurd bij een account), de **goedkeuring** (de knop "Maak taak"), de **taak** (werk met een vervaldatum en een eigenaar) en de **uitvoering** (de accountmanager belt, mailt of bezoekt zelf, eventueel met een voorbereid concept van de AI-agent Pitstop). Het handboek vat het samen als: regel, taak of afspraak, voorbereiding, mens keurt, uitvoering.

Een inzicht is een observatie: "contract loopt af over 41 dagen", "5 nieuwe vacatures voor monteurs", "de klant zei in het gesprek: stuur die offerte maar". Het is nog geen werk. Pas als de accountmanager op "Maak taak" klikt, ontstaat er een taak die de herkomst meeneemt (welk inzicht, welke regel, welke actiesoort). Die klik is de goedkeuring; het inzicht gaat daarna naar de status "Omgezet". Regels die direct een taak maken (gepland werk zoals een kwartaalbezoek) slaan de goedkeuring over.

Voor de accountmanager is /inzichten de plek voor "wat speelt er bij mijn accounts", /taken de werklijst met wat er vandaag, deze week en later moet gebeuren, en Vandaag (/) de samenvatting van beide aan het begin van de dag. Voor de salesmanager is de keten de basis van de rapportage per regel: elk inzicht en elke taak draagt de regel die hem voortbracht (ruleId), zodat te zien is welke regels werk opleveren en welke ruis.

De feature leest de accountgegevens die de motor stuurt (contract-einddatum, laatste bestelling, laatste contactmoment, laatste bezoek, accountklasse, journey-fase), de Activity Selling-regels, de afspraken (die staan mee op de horizon van /taken) en de gespreksverslagen. Hij schrijft taken, de status van inzichten, het contactmoment op het account bij afronden, de status van gekoppelde campagne-items en de regels in het kostenlogboek van de AI.

## Waar je het vindt

In de zijbalk staan beide onder de groep **Activiteiten**, als eerste twee items: "Inzichten" (/inzichten) en "Taken" (/taken). De volgorde is bewust de keten zelf: inzicht, taak, briefing, bezoek, meeting. Er hangt geen functievlag en geen rolbeperking aan deze twee pagina's; elke rol ziet ze. Het pakket bepaalt wel wat erachter draait: de deterministische motor zit in Starter, de AI-beoordeling en de Pitstop zitten in Plus en Compleet, de webbronnen (vacatures, nieuws) alleen in Compleet.

Andere ingangen:

- Vandaag (/) toont het inzicht van de dag, de kolommen Taken en Prio en twee rijen recente inzichten; alles klikt door naar dezelfde flyouts.
- De knoppen "+ Taak" op Vandaag en op /taken openen dezelfde globale flyout voor een nieuwe taak (één exemplaar, gemonteerd in de app-schil, aangestuurd via een gedeelde status).
- De globale zoekfunctie (Ctrl K) springt naar /taken?zoek=… (de lijst opent gefilterd op die term) of naar /inzichten?id=… (het inzicht opent direct in de flyout).
- De links "Inzichten klanten →" en "Inzichten prospects →" op Vandaag openen /inzichten?kindFilter=klant of =prospect.
- Rapportages openen een taak in de taakflyout in leesstand, met de knop "Open op Taken".
- De klantkaart heeft eigen tabbladen voor inzichten en taken; gelezen inzichten blijven daar terugvindbaar.

## Opbouw van de pagina

### /taken

**Kop.** Kicker "Taken & opvolging". De titel telt wat eronder staat. In de horizonweergave bijvoorbeeld "30 taken en 21 afspraken op de planning.", in de lijstweergave "5 taken over tijd." (bij de periode Achterstallig) of "12 taken op de planning.", en "Niets te doen." als de lijst leeg is. De ondertitel is rood als er achterstand is: "5 taken zijn achterstallig. Loop ze door, of pas de vervaldatum aan." Zonder achterstand staat er "Geen achterstallige taken. Netjes gehouden." met eventueel "Vandaag 2.".

**Knoppen rechtsboven**, van links naar rechts: een vergrootglas (opent de globale zoekfunctie), "+ Taak", "+ Afspraak", "Weergave" (keuzemenu met "Horizon" en "Lijst") en "Filters" (klapt het filterpaneel open, met een teller van actieve filters).

**Statkaarten.** Vier kaarten die altijd de ongefilterde stand van alle open taken tonen (status open of bezig):

| Kaart | Wat hij telt | Voetregel |
|---|---|---|
| "Vandaag" | vervaldatum vandaag | "taken" |
| "Komende 7 dagen" | vervaldatum vandaag tot en met dag 6 | "taken" |
| "Achterstallig" | vervaldatum vóór vandaag | "aandacht nodig" |
| "Alles open" | alle open taken | "taken totaal" |

Een klik op een kaart kiest die periode en schakelt over naar de lijstweergave, omdat de horizon geen periodekeuze kent.

**Horizonweergave (standaard).** Kicker "Planning · drie horizonnen", titel "Jouw taken op één rij", rechts een samenvatting zoals "5 vandaag · 26 komende week · 20 in week 2 en 3". Daaronder drie kolommen met taken én afspraken door elkaar:

| Kolom | Kicker | Venster |
|---|---|---|
| "Vandaag" | "Horizon 1" | vandaag |
| "Komende week" | "Horizon 2" | morgen tot en met dag 7 |
| "Week 2 en 3" | "Horizon 3" | dag 8 tot en met dag 21 |

Binnen een kolom staan de items per dag ("woensdag 14 oktober") en op tijd gesorteerd. Elk item heeft een icoon, de titel, een metaregel (de aanleiding, anders de klantnaam; bij een afspraak klant en locatie), een label (het taaktype zoals "Bellen" of "Te doen", of het afspraaktype zoals "Bezoek") en rechts de tijd. Een taak om 00:00 toont geen tijd. Het icoon wordt grof bepaald: urgent geeft een waarschuwingsdriehoek, een titel met "bel", "bellen" of "tel" een telefoon, een titel met "mail" een envelop, een afspraak een auto (belafspraak en online meeting een telefoon), de rest een notitie. Een lege kolom zegt "Niets gepland."; als alle drie leeg zijn staat er "Geen taken of afspraken in de komende 3 weken.". Belangrijk: achterstallige taken en taken zonder vervaldatum staan niet op de horizon. Geannuleerde afspraken ook niet.

![De takenpagina in de standaard horizonweergave: statkaarten bovenaan, daaronder drie kolommen met taken en afspraken.](shots/taken-1-horizon.png)

**Lijstweergave.** Toont alleen taken (geen afspraken), gegroepeerd in "Achterstallig", "Vandaag", "Morgen", "Deze week", "Later" en "Geen vervaldatum", elke groep met een teller. Binnen de gekozen periode is gesorteerd op prioriteit (urgent, hoog, middel, laag). Een taakkaart bevat:

- links een afvinkknop (rondt direct af);
- labels voor type ("Te doen", "Bellen", "Mailen", "Bericht", "Afspraak"), prioriteit ("Urgent", "Hoog", "Middel", "Laag") en "AI" voor elke taak die niet handmatig is gemaakt;
- rechts de vervaldatum als tekst ("Vandaag", "3 dagen over tijd", of een datum vanaf zeven dagen, met jaartal buiten het lopende jaar);
- de titel, de beschrijving, de klantnaam met een gekleurd blokje per segment en de aanleiding.

Een achterstallige taak heeft een gekleurde linkerrand. De lege staat zegt "NIETS TE DOEN", "Geen taken in dit filter." en "Wissel van bucket of filter, of geniet van de rust.".

Let op: /taken toont alle open taken van de organisatie. De functie heet in de code useMyTasks, maar filtert alleen op organisatie, niet op eigenaar. Een accountmanager ziet dus ook de taken van collega's.

### /inzichten

**Kop.** Kicker "Accounts · Inzichten", titel "Wat speelt er bij je accounts?", ondertitel "Externe inzichten uit nieuws, vacatures, LinkedIn, KvK en bedrijfssites, gefilterd op de accounts. Elk inzicht bevat een AI-context-blokje en directe acties." Die ondertitel klopt maar half: de feed bevat ook interne inzichten uit het CRM (contract, bestelritme, gespreksverslagen, agenda).

**Knoppen rechtsboven:** vergrootglas, een schakelaar "Alle", "Klanten", "Prospects" en "Filters". Het filterpaneel klapt open tussen de kop en de statkaarten.

**Statkaarten.** Alle vier tellen binnen de gekozen filters (gelezen, bronnen, periode, klant of prospect):

| Kaart | Wat hij telt | Voetregel |
|---|---|---|
| "Nieuw" | gemaakt in de laatste 24 uur | "vandaag binnen" |
| "Hot" | relevantie 75 of hoger | "relevantie ≥ 75" |
| "Deze week" | gemaakt in de laatste 7 maal 24 uur | "afgelopen 7 dagen" |
| "Totaal open" | alles binnen de filters | "inzichten totaal" of "in deze periode" |

Een kaart is ook een filter: klikken zet hem aan, nog eens klikken zet hem uit.

**Inzicht van de dag.** Een groot blok met de tag "Aanleiding", de kicker "Vers · vandaag actie" (inzicht jonger dan 48 uur) of "Aanleiding van de dag", de titel, de AI-context als inleiding, de bron, het tijdstip en de knoppen "Open inzicht" en "Markeer als gelezen". Dit inzicht staat niet nog eens in de feed en telt niet mee in de statkaarten.

**Feed.** Kop met het aantal ("27 inzichten") en "Klik op een kaart voor de volledige context". Daaronder een raster van kaarten. Boven elke kaart een zwarte balk met de accountnaam en een label "KLANT" of "PROSPECT" ("Campagne-breed" zonder label als het inzicht aan een campagne hangt). De kaart zelf toont:

- een badge "EXTERN" (geel) of "INTERN" (donker) uit de regel, of het signaaltype ("Vacature", "Nieuws", "KvK-mutatie") als er geen regel is;
- de specifieke bron van de regel (bijvoorbeeld "Klantwebsite/Indeed"), de ouderdom ("2u", "gisteren", "3 dgn") en rechts de relevantiescore op geel;
- titel, beschrijving en het blok "AI-context";
- de knoppen "+ Maak taak" en "Markeer als gelezen". Een gelezen kaart is grijs en toont "✓ Gelezen".

De lege staat zegt "NIETS GEVONDEN", "Geen inzichten in dit filter." en een hint naar een breder filter.

![De inzichtenpagina met het filterpaneel open: bronnengroep Extern gekozen met de verfijning per specifieke bron, daaronder de statkaarten.](shots/taken-5-inzichten-filters.png)

### Vandaag (/)

Vandaag is de startpagina van de klassieke werkwijze. Van boven naar beneden:

1. Een groet met dagquote en de knoppen "+ Taak", "+ Afspraak" en (met de vlag startplannen) "Startplan".
2. Het inzicht van de dag, dezelfde keuze als op /inzichten, maar met één knop: "Open klantkaart".
3. Het Vandaag-paneel met drie kolommen: "Taken", "Afspraken" en "Prio", elk met een teller in de kop.
4. "Voorbereiding voor de dag": briefingkaarten voor de afspraken van vandaag.
5. Het KPI-blok met onder meer inzichten en afgeronde taken.
6. "Inzichten klanten · laatste 48 uur" (titel "Wat gebeurt bij je klanten vandaag?") en hetzelfde voor prospects, elk maximaal zes kaarten, met de links "Inzichten klanten →" en "Inzichten prospects →".

De kolom **Taken** toont open taken die vandaag of eerder vervallen, plus alle taken met prioriteit hoog of urgent ongeacht de datum. Sortering: eerst vervaldatum (oudste bovenaan), dan prioriteit. Per rij: links de tijd (vandaag) of de datum met "over tijd", "gisteren", "morgen" of "over 7 dgn"; rechts de klantnaam als kop, de aanleiding als metaregel en een label "BEL", "AFSPRAAK", "MAIL", "BERICHT", "TAAK" of rood "URGENT". Er staan maximaal acht rijen; de rest zit achter "nog 14 meer →" naar /taken. De teller telt de hele lijst. Leeg: "Geen taken vandaag.".

De kolom **Afspraken** toont de niet-geannuleerde afspraken van vandaag met tijd, duur en een segmentlabel ("KLANT", "RISICO", "STRATEGISCH", "PROSPECT"). De kolom **Prio** toont accounts met segment at-risk ("RISICO") of open offertes ("OFFERTE"), maximaal vier, de rest achter "nog 17 meer →" naar /klanten/alle. Een RISICO-rij opent het meest relevante open inzicht van dat account in de inzichtflyout; een OFFERTE-rij opent de offertebriefing.

De twee inzichtrijen onderaan tonen alleen ongelezen inzichten waarvan het brontijdstip binnen 48 uur valt. Een klik opent de inzichtflyout.

![Het Vandaag-paneel: de kolom Taken met achterstallige en hoog geprioriteerde taken, de afspraken van vandaag en de Prio-kolom met risico- en offerte-accounts.](shots/taken-8-vandaag.png)

## Doorklikken: de stappen

### Een inzicht omzetten in een taak

1. Ga naar "Inzichten" en klik op de titel van een kaart. De inzichtflyout schuift van rechts in.
2. Lees "Wat is er gebeurd?", "Waarom is dit relevant?", het blok "Bewijs" en "Klant in context". Onderaan staat "Voorgestelde taak" als de regel of de AI een voorstel deed, anders "Volgende stap" met een vaste tip per signaaltype.
3. Klik op "Maak taak". De inzichtflyout sluit en de flyout "Nieuwe taak" opent, al ingevuld: klant, contactpersoon, titel (het voorstel, anders "Volg op: Vacature bij Bouwbedrijf De Vries"), prioriteit (uit het voorstel, anders Hoog bij relevantie 80 of meer en anders Middel), aanleiding (de AI-context) en beschrijving (de tekst van het inzicht).
4. Pas aan wat je wilt (datum, tijd, type, eigenaar, herhaling, herinnering) en klik op "✓ Maak taak".
5. De taak staat direct op /taken en Vandaag. Het inzicht krijgt status "Omgezet" en geldt als gelezen. De toast zegt "Taak aangemaakt, inzicht gemarkeerd als omgezet.". Heeft de regel van het inzicht het vinkje voor automatische voorbereiding aan, dan zet de server bij de synchronisatie meteen een Pitstop-concept op de nieuwe taak (Plus en Compleet).

Hetzelfde kan vanaf de kaart in de feed met "+ Maak taak", zonder de flyout te openen.

![De inzichtflyout met het voorstel onderaan: "Maak taak" neemt dit voorstel over.](shots/taken-6-inzichtflyout.png)

![Na "Maak taak": de nieuwe taak is vooraf ingevuld met klant, voorgestelde titel, prioriteit Hoog en de AI-context als aanleiding.](shots/taken-7-maak-taak-uit-inzicht.png)

### Een taak afronden

1. Klik in de lijstweergave op het vinkje links op de taakkaart. De taak krijgt status "done" en verdwijnt uit alle open lijsten.
2. Of open de taak (klik op de kaart of op een item in de horizon) en klik in de flyout op "Afronden".
3. Of klik met de rechtermuisknop op de kaart en kies "Markeer als afgerond". Op een telefoon kan het met een veeg naar links ("Afronden").
4. Wil je iets bijwerken en daarna afvinken, klik dan in de flyout op het potlood en vervolgens op "Afronden" of "Afronden en volgende taak". De tweede knop slaat op, rondt af en opent direct een nieuwe taak voor dezelfde klant en contactpersoon.

Bij afronden zet DealDrive op het account het laatste contactmoment op nu, bij een bezoektaak ook het laatste bezoek en bij een beltaak het laatste belmoment. Daarmee rekent de motor bij de volgende run met verse datums. Gekoppelde campagne-items springen naar "Klaar".

### Een taak uitstellen

1. Klik met de rechtermuisknop op een taakkaart in de lijst en kies "Snooze 1 dag" of "Snooze 1 week".
2. Of veeg op een telefoon naar rechts ("Snooze 1d"), of klik in de taakflyout op het klokje ("Snooze 1 dag").
3. De vervaldatum wordt nu plus 1 of 7 dagen. Let op: gerekend vanaf dit moment, niet vanaf de oude vervaldatum, dus ook het tijdstip schuift naar het huidige uur.

### Een taak laten voorbereiden door Pitstop

1. Open een taak. Onderaan de flyout staat het blok "Pitstop · AI-agent" met de uitleg en de knop "Start pitstop".
2. Klik op "Start pitstop". De knop toont "Pitstop bezig…". De server maakt een concept op basis van de actiesoort van de taak (belscript, mailconcept, bezoekbriefing, enzovoort).
3. Het concept verschijnt als platte tekst in het blok, met het label "Pitstop klaar, wacht op jouw goedkeuring".
4. Klik op "✓ Keur concept goed" (status wordt "Goedgekeurd"), "Kopieer tekst" of "Nieuwe pitstop". Daarna bel, mail of bezoek je zelf. Onder de knoppen staat: "De agent voert niets uit. Jij keurt goed en belt, mailt of bezoekt zelf."

In de demo-omgeving draait geen database; dan meldt het blok "Zonder database is de agent niet beschikbaar.".

![De taakflyout met het Pitstop-blok; in de demo zonder database meldt de agent dat hij niet beschikbaar is.](shots/taken-3-taakflyout-pitstop.png)

### Een terugkerende beltaak met herinnering aanmaken

1. Klik op "+ Taak". De flyout "Nieuwe taak" opent met vervaldatum en tijd op het eerstvolgende hele werkuur (tussen 9 en 18 uur, weekend overgeslagen).
2. Kies een klant en eventueel een contactpersoon via de zoekvelden, typ een titel van minimaal 3 tekens en kies type "Bellen".
3. Vink "Taak herhalen" aan, kies een frequentie en een einddatum. Eronder staat het aantal taken dat ontstaat, bijvoorbeeld "14 taken in totaal".
4. Vink "Herinnering instellen" aan en kies hoe lang vooraf en via welk kanaal.
5. Klik op "✓ Maak taak". De toast zegt "14 taken aangemaakt.".

![De flyout Nieuwe taak met type Bellen, Taak herhalen (wekelijks, 14 taken) en Herinnering instellen (30 minuten vooraf, in-app).](shots/taken-4-nieuwe-taak.png)

### Een inzicht afhandelen zonder taak

1. Klik op "Markeer als gelezen" op de kaart of op het vinkje in de flyout. Het inzicht verdwijnt uit de standaardlijst (filter "Ongelezen") en uit de tellers, maar is terug te vinden met het filter "Gelezen" of "Beide".
2. Of klik in de flyout op het rode kruisje "Wijs af". Het inzicht krijgt status "Afgewezen" en verdwijnt uit elke lijst in de app; het blijft in de database voor de rapportage per regel.

## Flyouts, vensters en knoppen

Alle drie de flyouts schuiven van rechts in over een donkere overlay, blokkeren het scrollen van de pagina en sluiten met het kruisje rechtsboven, een klik op de overlay of Escape. Escape sluit alleen de bovenste laag, zodat een rapportage eronder blijft staan.

### InzichtFlyout

**Opent** vanuit een kaart op /inzichten, het inzicht van de dag ("Open inzicht"), de inzichtrijen en de Prio-kolom op Vandaag, en via /inzichten?id=….

**Kop:** een gekleurd blokje per signaaltype, de kicker "Extern · Klantwebsite/Indeed" (groep en specifieke bron), de titel en daaronder klant en branche.

**Blokken in de leesstand:**

- Scoreregel: "Relevantie" met het getal op geel, "Bron", "Gezien" (bijvoorbeeld "2u geleden") en "Status" met een label "Nieuw", "Gelezen", "Omgezet" of "Afgewezen".
- "Wat is er gebeurd?": de tekst van het inzicht.
- "AI-context" met de kop "Waarom is dit relevant?".
- "Bewijs": per bewijsstuk de bron en het citaat, klikbaar als er een URL is. Alleen zichtbaar als het inzicht bewijs draagt (motor, AI en koopsignalen doen dat; de demo-inzichten niet).
- "Begin hier": alleen bij een campagne-inzicht, met maximaal drie accounts, hun reden en aanpak, en de voetnoot "Uitgerekend uit je CRM-data, niet door AI geschreven." als de motor het advies berekende.
- "Klant in context": initialen, klantnaam (link naar de klantkaart), score, contractwaarde, plaats en de korte aanleiding van het account.
- "Voorgestelde taak" met de voorgestelde titel en de zin ""Maak taak" neemt dit voorstel over. Je kunt alles nog aanpassen.", of anders "Volgende stap" met een vaste tip per type (bijvoorbeeld bij een vacature: "Vacature wijst op groei of vervanging. Vraag door naar de aanleiding en koppel je aanbod.").
- Een link "Open originele bron op …" als het inzicht een bron-URL heeft.

**Knoppen onderaan:** links "Maak taak" (alleen als er een klant is en het inzicht nog niet is omgezet), rechts als iconen "Vraag AI" (opent de AI-chat met dit inzicht als context), "Bewerken" (potlood), "Markeer als gelezen" (vinkje, alleen als het nog niet gelezen, omgezet of afgewezen is) en "Wijs af" (rood kruisje). Gelezen en afwijzen sluiten de flyout direct, zonder bevestiging en zonder toast.

**Bewerkstand** (potlood): velden "Titel" (verplicht, minimaal 3 tekens), "Type" (keuzelijst met twaalf signaaltypes), "Relevantie" (0 tot 100, wordt afgerond en begrensd), "Wat is er gebeurd?", "AI-context: waarom relevant?" en "Voorgestelde taak" met de plaatshouder "bv. Bel de klant over contractverlenging (leeg = geen voorstel)". Een leeg voorstel verwijdert het voorstel. Knoppen "Annuleren" en "✓ Opslaan". Fout: "Opslaan mislukt: inzicht niet gevonden.".

### TaakFlyout

**Opent** vanuit een taakkaart of horizonitem op /taken, de kolom Taken op Vandaag, de klantkaart en (in leesstand) vanuit rapportages.

**Kop:** een prioriteitsbolletje met "Hoog · Open" (prioriteit en status: "Open", "Bezig", "Klaar", "Geannuleerd"), de titel en klant met branche.

**Leesstand, van boven naar beneden:**

- Een definitielijst met "Type" (label met icoon), "Vervaldatum" (bijvoorbeeld "zo 11 okt (3 dagen over tijd)", rood als hij verlopen is), "Toegewezen aan", "Contactpersoon" (link naar de contactkaart), "Herinnering" (tijdstip en kanaal), "Aanleiding" en "Beschrijving".
- "Klant in context", zoals in de inzichtflyout.
- Bij een beltaak het blok "Transcript & gespreksverslag" met "Opslaan en analyseer →": het verslag gaat naar het tabblad Gespreksverslagen van de klantkaart en opent meteen de AI-analyse.
- "Volgende stap": een vaste tip op volgorde van urgentie. Urgent: "Pak deze nu op. Urgent vlag betekent niet doorschuiven."; verlopen: "Deze taak is verlopen. Beslis nu: doen, herplannen, of afsluiten met reden."; uit een gesprek, AI-suggestie, at-risk-klant en een algemene tip.
- Het blok "Pitstop · AI-agent" (zie hieronder).

**Knoppen onderaan (leesstand):** "Afronden" (sluit de flyout), en als iconen "Vraag AI", "Snooze 1 dag" (niet bij een taak van type afspraak, want een afspraak met een ander mens verschuif je niet stil), "Bewerken", "Verwijderen" en "Open klantkaart". Verwijderen vraagt eerst "Taak verwijderen?" met de tekst dat de taak definitief verwijderd wordt, en meldt daarna "Taak verwijderd.".

**Bewerkstand:** zoekvelden "Klant" en "Contactpersoon" (typen filtert, maximaal acht suggesties, het kruisje wist; kies je eerst een contact, dan springt de klant mee), "Titel", "Prioriteit" (vier knoppen), "Vervaldatum" en "Tijd", "Type" ("Te doen", "Bellen", "Mailen", "Bericht"), "Toegewezen aan" (gebruikers van de organisatie), "Aanleiding", "Herinnering instellen" en "Beschrijving". Opslaan kan vanaf 3 tekens titel. Verandert het herinneringsmoment, dan wordt de herinnering opnieuw verstuurbaar. Knoppen: "Afronden", "Afronden en volgende taak", "Annuleren" en "✓ Opslaan".

**Leesstand vanuit rapportages:** geen afronden, snoozen, bewerken of verwijderen, alleen "Open op Taken" en "Open klantkaart". Een verwijderknop onder een rapportagecijfer zou dat cijfer stil veranderen.

### NieuweTaakFlyout

**Opent** met "+ Taak" (Vandaag, /taken), met "Maak taak" (inzichtkaart en inzichtflyout), met "Afronden en volgende taak" en vanaf een accountplan. Kicker "Nieuwe taak · Middel" (de prioriteit loopt mee), titel "Wat moet er gebeuren?".

| Veld | Verplicht | Standaard | Opmerking |
|---|---|---|---|
| "Klant" | nee | uit de voorzet | zoekveld |
| "Contactpersoon" | nee | uit de voorzet | beslissers eerst |
| "Titel" | ja, 3 tekens | uit de voorzet | anders foutmelding |
| "Prioriteit" | ja | Middel | Laag, Middel, Hoog, Urgent |
| "Vervaldatum" en "Tijd" | nee | volgend heel werkuur | zonder tijd 09:00 |
| "Type" | ja | Te doen | uit de actiesoort bij een voorzet |
| "Toegewezen aan" | ja | jijzelf | collega's in de organisatie |
| "Aanleiding" | nee | AI-context bij een inzicht | vrije tekst |
| "Taak herhalen" | nee | uit | zie Regels |
| "Herinnering instellen" | nee | uit | zie Regels |
| "Beschrijving" | nee | tekst van het inzicht | vrije tekst |

Bij type "Bellen" verschijnt het blok "Transcript & gespreksverslag" met de knop "Opslaan en analyseer →", die de taak opslaat en direct de AI-analyse van het verslag opent. Onderaan "Annuleren" en "✓ Maak taak" (tijdens opslaan "Opslaan…"). Foutmeldingen: "Geef de taak eerst een titel van minimaal 3 tekens." en "Opslaan mislukt: controleer offline-database.". Toasts: "Taak aangemaakt.", "14 taken aangemaakt." of "Taak aangemaakt, inzicht gemarkeerd als omgezet.". Het type "Afspraak" is hier bewust niet kiesbaar; afspraken zijn een eigen record via "+ Afspraak".

### Contextmenu en veegacties op /taken

Alleen in de lijstweergave. Rechtsklik (of lang drukken op een telefoon) opent een menu met kicker "TAAK" en de titel, en de keuzes "Markeer als afgerond", "Snooze 1 dag", "Snooze 1 week", "Open klantkaart" (alleen met klant) en rood "Taak verwijderen". Verwijderen vraagt "Deze taak verwijderen?" en zet de taak op status geannuleerd; dat is dus geen echte verwijdering, anders dan de prullenbak in de flyout. Op een telefoon kun je de kaart naar links vegen ("Afronden") of naar rechts ("Snooze 1d").

### De Pitstop: een concept dat nooit zelf iets doet

Het blok staat op elke taak (en ook op afspraken en deals). Zonder concept: kicker "Pitstop · AI-agent", kop "Pitstop", de uitleg "Pitstop: de agent zet je voorbereiding klaar (een belscript, mailconcept of briefing) op basis van de aanleiding en de CRM-feiten. Jij keurt goed en rijdt." en de knop "Start pitstop". Met concept: de kop wordt het concepttype ("Belscript", "Mailconcept", "Bezoek-briefing", "Meeting-briefing", "Berichtconcept", "LinkedIn-actie", "Research-notitie", "Voorbereiding"), rechts een statuslabel, daaronder de tekst en de knoppen "✓ Keur concept goed" (alleen bij concept klaar), "Kopieer tekst" (wordt twee seconden "Gekopieerd ✓") en "Nieuwe pitstop". Er is bewust geen verstuurknop. Foutmeldingen komen van de server, bijvoorbeeld "Het AI-tegoed is op.", "De AI-sleutel is ongeldig of ingetrokken.", "De AI is tijdelijk overbelast." of dat het pakket de agent niet dekt.

## Filters, zoeken, sorteren en weergaven

### /taken

Het filterpaneel staat boven de lijst en blijft bij scrollen bovenaan plakken. Vier groepen:

- **"Periode":** "Vandaag", "Morgen", "Komende 7 dagen" (vandaag tot en met dag 6), "Week erna" (dag 7 tot en met 13), "Komende 14 dagen", "Komende 30 dagen", "Eigen periode" (toont dan de velden "Van" en "Tot", standaard vandaag tot plus 13 dagen), "Achterstallig" en "Alles open". Elke pil telt het aantal taken dat na de overige filters overblijft. Standaard staat de periode op "Achterstallig" zodra er iets te laat is, anders op "Vandaag"; jouw eigen keuze wint daarna.
- **"Prioriteit":** "Alle", "Urgent", "Hoog", "Middel", "Laag" (zonder tellers).
- **"Type":** "Alle", "Te doen", "Bellen", "Mailen", "Bericht", "Bezoek", "Meeting", met tellers. Bezoek telt taken van type afspraak plus (alleen in de horizon) fysieke afspraken; Meeting telt alleen online afspraken en staat in de lijst dus altijd op 0.
- **"Bronnen":** "Alle", "Extern", "Intern", "Overig", alleen gevulde groepen, met tellers. Kies je Extern of Intern, dan verschijnt een tweede rij met de specifieke bronnen van die groep. Is er maar één groep, dan staat alleen "Alle" er met de hint "Alles uit één bron, niets te verfijnen.". Handmatige taken en afspraken vallen onder Overig.

Combinaties werken als EN. De periode geldt alleen voor de lijst; de horizon heeft zijn eigen vaste drie vensters en tellers rekenen in de horizon over die drie weken. Een prioriteitsfilter of specifieke bron laat geen afspraken door. De knop "Reset filters" verschijnt bij minstens één actief filter en zet prioriteit, type, bronnen en zoekterm terug, maar niet de periode. De teller op de knop "Filters" telt de periode ook niet mee. Een zoekterm uit de globale zoekfunctie staat als chip in het paneel ("Zoekt op "…"", met een kruisje) en zoekt in taaktitel en klantnaam. Alleen ?zoek= staat in de URL; de andere filters en de weergave niet.

![De lijstweergave met het filterpaneel open: periode Achterstallig met tellers per periode, prioriteit, type en bronnen.](shots/taken-2-lijst-filters.png)

### /inzichten

- **"Gelezen":** "Ongelezen" (standaard), "Gelezen", "Beide".
- **"Bronnen":** "Alle", "Extern", "Intern", "Overig" met tellers, plus de verfijning per specifieke bron bij Extern of Intern (in de demo bijvoorbeeld "Google Alerts/persbureaus 8" en "Klantwebsite/Indeed 4"). Een gekozen groep blijft zichtbaar, ook op 0.
- **"Periode":** "Vandaag", "Gisteren", "Afgelopen 7 dagen", "Week ervoor" (dag 13 tot 7 terug), "Afgelopen 14 dagen", "Afgelopen 30 dagen", "Alles" (standaard) en "Eigen periode" met "Van" en "Tot" (standaard de afgelopen week). Elke pil telt wat je krijgt als je hem kiest. De periode rekent op de aanmaakdatum van het inzicht.
- **Klant of prospect:** de schakelaar in de kop. Inzichten zonder account blijven in alle drie de standen staan. Deze keuze staat als ?kindFilter= in de URL en werkt in beide richtingen (terugknop).
- **Statkaarten:** werken als extra filter bovenop de rest.

Daarnaast geldt altijd een verborgen filter: een inzicht verschijnt alleen als zijn regel bestaat, of als het een systeeminzicht is (agenda, campagne, koopsignaal), of als een actieve regel zijn signaaltype dekt. "Reset filters" zet gelezen, bronnen, periode en de statkaart terug; de teller op "Filters" telt bronnen, periode en een afwijkende gelezen-stand. De feed staat op volgorde nieuwste eerst; er is geen sorteerkeuze.

## Regels en berekeningen

### Hoe inzichten ontstaan

| Bron | Wanneer | Relevantie | Voorstel |
|---|---|---|---|
| Motor, deterministisch | elk uur of "Draai motor nu" | Kritiek 90, Hoog 80, anders 65 | als de regel een taaksjabloon heeft |
| Motor, AI-beoordeling | wekelijks, Plus en Compleet | zekerheid van het model | alleen bij zekerheid 60 of meer |
| Webbronnen | wekelijks, alleen Compleet | zekerheid van het model | alleen bij zekerheid 60 of meer |
| Koopsignaal uit gesprek | direct bij opslaan van de analyse | 80, plus 5 per bonus, max 95 | altijd een belafspraak, Hoog |
| Gat in de agenda | bij annuleren of niet verschenen | 75 | vervangend bezoek, Hoog |

**De motor.** Elke Activity Selling-regel heeft een triggerpatroon: datum-drempel (een datumveld valt binnen X dagen, standaard 60, bijvoorbeeld contract-einddatum), inactiviteit (een datumveld ligt meer dan X dagen terug, standaard 30, bijvoorbeeld laatste contactmoment), ritme (puur de cadans) of gebeurtenis (direct bij een journey-gebeurtenis). Een deterministische regel zonder patroon draait niet; een AI-regel heeft geen patroon nodig. De regel richt zich op accountklassen en eventueel een journey-fase; een lege klassenkeuze raakt alle accounts. De cadans (van "Dagelijks" tot "Jaarlijks") bepaalt hoe vaak een regel per account mag vuren; de cadans-administratie van de motor voorkomt dubbel werk. Voor bel- en bezoekritmes overrulet de contactmatrix van de organisatie de cadans per accountklasse. De Netlify-scheduler draait elk uur over alle organisaties; open sessies zien nieuwe inzichten binnen ongeveer 3 minuten.

Een regel met activiteit "inzicht" maakt een inzicht met de titel "subcategorie · accountnaam", de reden als tekst, het taakvoorbeeld als AI-context en het rekenbewijs als bewijs (bijvoorbeeld "contract-einddatum: 2026-11-24, nog 41 dagen"). Bestaat er al een open inzicht (nieuw of gelezen) van dezelfde regel voor hetzelfde account, dan wordt dat bijgewerkt in plaats van een tweede gemaakt. In de code zet die bijwerking de status en de gelezen-vlag in de gegevens weer op nieuw en ongelezen; een gelezen inzicht dat blijft gelden komt dus bij de volgende cadans terug als ongelezen.

Een regel met activiteit "taak" slaat de goedkeuring over en maakt direct een taak: titel uit het sjabloon ({account} wordt de klantnaam), vervaldatum 7 dagen na de run, prioriteit uit de regel (Kritiek wordt urgent, Hoog hoog, Midden middel, Laag laag), type uit de actiesoort (bellen wordt Bellen, bezoek wordt Afspraak), bron "ai" en de eigenaar van het account.

Daarnaast maakt de motor gerichte taken en inzichten voor offertes (opvolgtaak na 3 werkdagen, zwaarder naarmate het bedrag hoger is; contracten altijd face-to-face), deals die na twee weken onvoldoende gekwalificeerd zijn en campagnes met achterstand.

**AI-beoordeling.** Eerst verzamelt de code zonder AI de CRM-feiten van het account (accountfase, contract-einddatum, laatste bestelling, laatste contact en bezoek, elk met bron en citaat). Daarna beoordeelt het model in een vast schema of het relevant is, hoe zeker, wat de commerciële hoek is en welk bewijs het gebruikt. Elk citaat wordt gecontroleerd tegen het aangeleverde materiaal; wat niet herleidbaar is wordt geschrapt. Onder zekerheid 60 komt er wel een inzicht, maar geen taakvoorstel. Vangrails: AI-regels draaien hooguit wekelijks, maximaal 25 beoordelingen per regel per run, en het maandplafond van de klant kan het automatische werk stilzetten. Webregels zoeken zelf met maximaal 3 zoekopdrachten; links die de zoektool niet echt vond worden geschrapt.

**Koopsignalen.** Als een gespreksverslag bij een beltaak of afspraak geanalyseerd is en koopsignalen bevat, maakt de server direct één inzicht per verslag (niet per signaal) van type upsell-kans. Titel "Koopsignaal uit gesprek: …", de citaten als bewijs, zekerheid 90, en als voorstel "Bel [klant] over: …" met prioriteit Hoog. Basisrelevantie 80, plus 5 bij twee of meer signalen, plus 5 bij een positief gesprek, plus 5 als de opvolging vandaag moet, nooit boven 95. Bezwaren komen bewust niet in de feed. Opnieuw analyseren werkt dezelfde kaart bij.

### Statussen van een inzicht

Een inzicht loopt van **nieuw** naar **gelezen** naar **omgezet** of **afgewezen**. Gelezen zet de vlag (wie, wanneer) en de status gelezen, tenzij het inzicht al omgezet of afgewezen was; die eindstatus wint. Omgezet ontstaat alleen door een taak aan te maken met het inzicht als bron. Afgewezen haalt het inzicht uit alle lijsten in de app, maar het blijft bewaard voor de rapportage per regel. Een omgezet inzicht blijft onder "Gelezen" zichtbaar met het label "Omgezet".

### Taken: datums, afronden, snooze

Een taak heeft de statussen open, bezig, klaar en geannuleerd. In deze schermen zet niets een taak op bezig; geannuleerd ontstaat via "Taak verwijderen" in het contextmenu. Achterstallig betekent: vervaldatum vóór vandaag 00:00, op kalenderdagen, dus een taak van vandaag is 's avonds niet verlopen. Snooze zet de status op open en de vervaldatum op nu plus 1 of 7 dagen. Afronden zet klaar en het afrondmoment, werkt de stuurvelden van het account bij en markeert gekoppelde campagne-items als klaar. Alle wijzigingen gaan direct naar de lokale opslag en een synchronisatiewachtrij, zodat de app ook offline werkt.

### Herhaling

Herhaling bestaat alleen bij het aanmaken. DealDrive maakt de hele reeks in één keer als losse taken, zodat je ze stuk voor stuk kunt afvinken. Frequenties: "Elke werkdag" (zaterdag en zondag overgeslagen), "Wekelijks" (standaard), "Om de week" en "Maandelijks" (zelfde dag van de maand; valt die weg, dan de laatste dag van de maand). "Herhalen tot" staat standaard op drie maanden vooruit. Maximaal 52 taken als noodrem. Er is geen koppeling tussen de taken van een reeks: wijzigen of stoppen gaat per taak. De vervolgtaken krijgen de herkomst (inzicht, regel, actiesoort) en een gespreksverslag niet mee; alleen de eerste taak draagt die.

### Herinnering

Een herinnering vraagt een vervaldatum en ligt een gekozen tijd ervoor: 5, 15 of 30 minuten, 1 of 4 uur, 1 of 2 dagen (standaard 30 minuten). Kanalen: "In-app notificatie" (standaard), "E-mail" of "Beide". In-app: de browser controleert elke 30 seconden de taken van de ingelogde eigenaar en toont bij een afgelopen herinnering een toast van 8 seconden ("Herinnering: [titel]") en een item in de bel. E-mail: een server-taak draait elke 5 minuten en stuurt een mail vanuit en naar het eigen gekoppelde postvak van de eigenaar. Beide kanalen respecteren stille uren en de aan-uitstand van de categorie herinneringen, en laten herinneringen die meer dan 24 uur oud zijn stil verlopen. Afgeronde en geannuleerde taken krijgen geen herinnering.

### Pitstop

De agent bereidt voor en voert nooit uit; dat staat in de code vast en is niet instelbaar. De prompt bestaat uit vier lagen: een vast veiligheidskader ("je voert niets uit", "verzin niets buiten de bekende feiten"), de centrale instructie per concepttype uit de promptbibliotheek van HQ (met een ingebouwde standaard), het accent van de journey-fase van het account, en het item zelf (titel, aanleiding, contactpersoon, broninzicht gemarkeerd als interpretatie, CRM-feiten). Het concepttype volgt de actiesoort: bellen wordt belscript, mailen mailconcept, bezoek bezoekbriefing, online meeting meetingbriefing, research researchnotitie; zonder actiesoort een algemene voorbereiding. Uitvoer is platte tekst, maximaal 1.024 tokens. Elke aanroep, ook een mislukte, komt in het kostenlogboek. Automatisch voorbereiden kan per regel met een vinkje: maximaal 10 per motorrun en 3 per synchronisatie. Zonder AI-sleutel levert een vaste sjabloontekst hetzelfde soort concept.

### Inzicht van de dag

De kandidaten zijn ongelezen inzichten met een account en relevantie 85 of hoger. Een inzicht jonger dan 48 uur wint altijd. Anders rouleert de keuze per kalenderdag (Nederlandse tijd) door de kandidaten, zodat iedereen in het team dezelfde aanleiding ziet en er geen vast gezicht blijft staan. Gelezen markeren haalt hem uit de pool.

### Waar code en scherm uiteenlopen

- De ondertitel van /inzichten spreekt van externe inzichten, maar de feed bevat ook interne.
- Het label "AI" op een taakkaart staat bij elke taak die niet handmatig is; ook een taak die een mens via "Maak taak" uit een inzicht maakte draagt het.
- De knop "+ Maak taak" op een kaart in de feed staat er ook bij een al omgezet inzicht en bij inzichten zonder klant; in de flyout is hij dan verborgen. Zo kan één inzicht twee taken krijgen.
- Snoozen kan via het contextmenu en de veegactie ook bij een taak van type afspraak, terwijl de flyout dat bewust weigert.
- "Taak verwijderen" in het contextmenu annuleert, de prullenbak in de flyout verwijdert echt.
- De lijstgroep "Deze week" loopt tot en met dag 7, de periode "Komende 7 dagen" tot en met dag 6.
- In de demodata hebben inzichten geen bewijs en geen voorstel, en taken geen regel; de blokken "Bewijs" en "Voorgestelde taak" en de bronverfijning op /taken zijn daar dus niet te zien.

## Gegevens

**Inzicht** (tabel signals, met de volledige inhoud in een JSON-veld en een paar velden los voor filters):

- id, organisatie, account (accountId), optioneel contactpersoon (contactId), campagne (campaignId) en lopend accountplan (accountplanId);
- signaaltype (type: vacature, nieuws, social, website-change, branche, concurrent, kvk-mutatie, directiewissel, aflopend-contract, omzetdaling, cross-sell-kans, upsell-kans, campagne, agenda);
- bron (source: soort, provider zoals "DealDrive-motor", optionele URL, tijdstip);
- titel (title), tekst (body), relevantie 0 tot 100 (relevanceScore), commerciële hoek (commercialAngle);
- regel (ruleId), herkomst (generatedBy: deterministisch, ai, manual), zekerheid (confidence);
- bewijs (evidence: lijst van bron, citaat, optionele URL);
- taakvoorstel (voorgesteldeTaak: titel, prioriteit, actiesoort, uitvoerder);
- campagne-advies (advies), herkomst uit een verslag (verslagBron);
- status (nieuw, gelezen, omgezet, afgewezen), gelezen-vlag met wie en wanneer (acknowledged, acknowledgedBy, acknowledgedAt), aangemaakt en bijgewerkt.

**Taak** (tabel tasks, idem):

- id, eigenaar (ownerId), organisatie, account, contactpersoon, deal, accountplan, offerte (quoteId);
- titel, beschrijving, type (to-do, call, afspraak, mail, bericht), status, prioriteit (low, medium, high, urgent), vervaldatum (dueDate), afrondmoment (completedAt);
- herinnering (reminderAt, reminderChannel, reminderSent);
- herkomst (source: manual, ai, signal, gesprek-analyse), broninzicht (sourceSignalId), regel (ruleId), aanleiding (reason), salesmeeting;
- uitvoering: uitvoerder (executor: self, cowork, ai-agent), voortgang (executorStatus: wacht, bezig, concept-klaar, goedgekeurd, uitgevoerd, mislukt), actiesoort (actionType: bellen, mailen, bericht, bezoek, online-meeting, linkedin-volgen, research), concept (draft: soort, tekst, tijdstip);
- gespreksverslag (verslag) en de bewaarde analyse daarvan (verslagAnalyse).

In de browser staan taken en inzichten in een lokale database (IndexedDB) met een synchronisatiewachtrij; op de server in Postgres per organisatie, afgeschermd met row level security. AI-aanroepen staan in het kostenlogboek, de vuurmomenten per regel en account in de cadans-administratie van de motor. Van andere features komen de regels (Activity Selling), de contactmatrix en offertematrix (accountritme), het journey-accent (Customer Journey), de promptbibliotheek (HQ), afspraken en gespreksverslagen.

## Wat dit betekent voor Dealtrace

- **Overnemen:** de keten met "Maak taak" als goedkeuring. Het systeem stelt voor, de accountmanager beslist met één klik, en de taak erft titel, prioriteit, actiesoort en herkomst. Dat houdt AI-output bruikbaar zonder dat er ongevraagd werk ontstaat.
- **Overnemen:** bewijsplicht op elk inzicht en de Pitstop die alleen concepten levert. Voor new business, waar een verkeerde aanname bij een prospect duur is, is "geen bewijs, geen inzicht" de juiste lat.
- **Anders doen:** inzichten zijn nu vooral accountgedreven (contract, bestelling, contactstilte). Voor new business moeten triggers op prospectniveau leidend zijn: vacatures, nieuwe vestiging, directiewissel, aanbesteding, bezoek aan de website, met een voorstel per kanaal (bellen voor de binnendienst, bezoek in de regio voor de buitendienst).
- **Anders doen:** /taken toont alle taken van de organisatie zonder eigenaarfilter, en de horizon laat achterstallige en ongedateerde taken weg. Dealtrace heeft een standaard "mijn werk" nodig, met een teamweergave voor de manager, en achterstand die nooit uit beeld verdwijnt.
- **Anders doen:** maak herhaling een echte reeks (één regel, vervolg pas na afronden) in plaats van 52 losse kopieën, en snooze vanaf de oude vervaldatum met behoud van het tijdstip. Voor een belritme bij prospects is "volgende poging na X werkdagen" logischer dan een vaste kalender.
- **Anders doen:** maak de status van een inzicht leidend in elke ingang (kaart en flyout), zodat één inzicht niet twee keer omgezet kan worden, en laat de motor een gelezen inzicht niet stil terugzetten naar ongelezen.
- **Ontbreekt:** een leerlus. Afwijzingen en omzettingen per regel worden opgeslagen maar sturen niets. Dealtrace kan de relevantie per triggersoort en per verkoper bijstellen op basis van wat werkelijk tot een gesprek of afspraak leidde.
- **Ontbreekt:** een uitkomst bij afronden. Een taak gaat naar klaar zonder resultaat (bereikt, niet bereikt, afspraak gemaakt). Voor new business is dat de kern van de meting en de basis voor de volgende poging.
