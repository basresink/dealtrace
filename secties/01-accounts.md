# Accounts: prospects en klanten

## Wat het is en waarvoor

Een account is in DealDrive een bedrijf waar je aan verkoopt of wilt verkopen. Er is één soort record: of het een prospect of een klant is, is een eigenschap van het account (het accounttype), geen aparte tabel en geen aparte URL. Daardoor blijft een link naar een account werken als een prospect klant wordt, en hangen taken, inzichten, afspraken, deals, notities, e-mails en documenten aan hetzelfde account-ID, voor en na de promotie.

Voor een accountmanager is de prospectlijst de werkvoorraad voor new business: welke bedrijven staan er, in welke accountklasse vallen ze, is er een aanleiding om nu te bellen, wanneer was het laatste contact en wie zijn de contactpersonen. De accountkaart is daarna de plek waar al het werk rond één bedrijf samenkomt: de tijdslijn, de open taken, de inzichten uit de regelmotor, de deals en offertes en de briefing voor het volgende gesprek. Een salesmanager gebruikt dezelfde lijsten om te zien hoeveel prospects per accountklasse er zijn, hoeveel er een aanleiding hebben en wie eigenaar is.

In de week valt de feature op twee momenten. Aan het begin van de week geeft de landingspagina "Belangrijkste prospects van deze week" zes kaarten om mee te beginnen. Gedurende de dag open je accountkaarten vanuit taken, de agenda, de zoekfunctie of de lijst, en leg je vast wat er gebeurde.

Samenhang met andere features. De accountlijst leest inzichten (uit de Activity Selling-regels), taken, afspraken, communicatie (e-mails en notities) en deals om tellers en "Laatste activiteit" te berekenen. Ze schrijft zelf alleen accountvelden: nieuw account, accounttype, accountklasse, functie, adres en bereik, contract- en orderdatum en eigen velden. De accountklasse (A tot en met D) is ook de stuur-as van de regelmotor: welke regels op een account vuren, hangt af van die klasse. Prospectplanning en accountplannen lezen dezelfde klasse.

## Waar je het vindt

In de zijbalk staat de groep "Accounts" met drie items: "Klanten" (/klanten), "Prospects" (/prospects) en "Contacten" (/contacten), met daaronder "Generator" als de functievlag leadGenerator aanstaat. De accountpagina's zelf hebben geen functievlag en geen rolbeperking: accountmanager, salesmanager, beheerder en superuser zien en bewerken alle accounts van de organisatie. De rechtenmatrix op de server (server/utils/permissions.ts) geeft accountmanagers en salesmanagers lezen en schrijven op alle accounts, maar verwijderen alleen aan beheerder en superuser.

De routes:

| Route | Wat het is |
|---|---|
| /prospects | Top zes prospects van deze week |
| /prospects/alle | Volledige prospectlijst met filters |
| /klanten | Top zes klanten van deze week |
| /klanten/alle | Volledige klantenlijst met filters |
| /klanten/per-functie | Klanten in twee kolommen per functie |
| /accounts/:id | De accountkaart, voor klant en prospect |

De oude paden /prospects/:id en /klanten/:id (en hun /briefing) sturen permanent door (301) naar /accounts/:id, met behoud van de query. /prospects/jaarplanning stuurt door naar /prospectplanning.

Je komt op de accountkaart vanuit een rij of kaart in de lijsten, de globale zoekfunctie (knop "Zoeken" of Ctrl K), een taak of afspraak (link naar het account), de contactkaart (bedrijfsnaam onder de naam), de prospectplanning en de deal- en offerteflyouts. Prospectplanning kan naar /prospects/alle?filter=geen-fase linken; de lijst opent dan met het filter "Geen klasse" actief en de filterstrook open.

## Opbouw van de pagina

### Prospects: Top deze week (/prospects)

Kop: kicker "Top deze week" gevolgd door de datums van maandag en zondag van de huidige week (bijvoorbeeld 12 okt tot 18 okt), titel "Belangrijkste prospects van deze week", subtitel "Hoge score, verse signalen en actieve aanleidingen: deze prospects verdienen nu een eerstvolgend contactmoment." Rechts twee knoppen: "Jaarplanning →" (naar /prospectplanning) en "Alle prospects →".

Daaronder zes kaarten in een raster van drie kolommen. Elke kaart toont het rangnummer ("#1"), de accountklasse als pil ("A · Corporate", of "Geen klasse" met stippelrand), de naam, branche en plaats, de aanleidingstekst (het veld trigger) in een grijs blok met paarse rand, en onderaan het aantal inzichten ("1 inzicht", "2 inzichten") en "Open →". De kleur van de bovenrand volgt de prospectgraad (hot rood, warm oranje, lauw geel, koud blauw). Een klik opent de accountkaart. Lege staat: "GEEN PROSPECTS", "Nog geen prospects in beeld.", "Voeg accounts toe of importeer leads om je pipeline op te bouwen."

![De landingspagina Prospects met de zes prospects van deze week](shots/accounts-1-prospects-top-deze-week.png)

/klanten is dezelfde opbouw met titel "Belangrijkste klanten van deze week" en één knop "Alle klanten →"; de rangschikking verschilt (zie Regels en berekeningen).

### Alle prospects (/prospects/alle)

Kop: kicker met terugknop "← Prospects · 86 prospects totaal", titel "Alle prospects", subtitel "Alle prospects van jouw organisatie, te filteren op accountklasse en functie. Klanten zie je op Klanten →".

Werkbalk op een eigen regel onder de kop, van links naar rechts: een zoekknop (opent de globale zoekoverlay), de primaire knop "+ Prospect", de secundaire knoppen "+ Taak" en "+ Afspraak", de keuze "Weergave" (Lijst, Compact, Kaarten), de sorteerkeuze met als label de actieve sortering ("Naam") en de knop "Filters" met een teller van het aantal actieve filters.

De filterstrook klapt open onder de werkbalk (zie Filters, zoeken, sorteren en weergaven).

De lijst toont standaard 25 rijen. Daaronder staat "25 van 86 getoond" met de knop "Toon meer", die er telkens 25 bij zet.

Een rij in de weergave Lijst bevat:

- Links het logo van het bedrijf (een ingesteld logo, anders het logo bij het websitedomein, anders de initialen in de kleur van de prospectgraad).
- De naam met de accountklasse als pil ("B · Groot MKB", "Geen klasse").
- Een metaregel: icoon website en icoon LinkedIn (grijs als ze ontbreken, klikbaar als ze er zijn), branche, plaats, telefoonnummer als bellink, "Inzichten: n" (live geteld) en "Laatste activiteit: 4 sep" of "Laatste activiteit: geen".
- Als er een aanleiding is: de aanleidingstekst eronder, rood gemarkeerd bij een hete aanleiding en oranje bij een waarschuwing.
- Rechts tot drie contactpersonen als gekleurde initialen (beslissers eerst, dan op achternaam), met "+n" als er meer zijn en anders "Geen contactpersoon". Een klik op initialen opent de contactkaart.

Een rechtermuisklik op een rij of kaart opent het contextmenu (zie Flyouts, vensters en knoppen).

De weergave Compact gebruikt dezelfde rijen, dichter op elkaar. De weergave Kaarten toont een raster van vier kaarten per regel met de klassepil, rechtsboven "Aanleiding" als de aanleiding heet is, de naam, branche en plaats, de aanleidingstekst, en in de voet "Score 58" en "1 inzichten". Op de prospectkaarten staat altijd "inzichten", ook bij één; op /klanten/alle is dat wel "1 inzicht", en daar staat de maandomzet (mrrFormatted) op de plek van de score.

![Alle prospects met de filterstrook open: zoekveld, Accountklasse, Signaal en Functie](shots/accounts-2-alle-prospects-filters.png)

Lege staat: "GEEN RESULTATEN", met als titel "Niets gevonden." bij een zoekterm (tekst: Geen prospect met "x" in naam, plaats of branche.) of "Niets in deze filter." zonder zoekterm, en de knop "Toon alles", die alle filters én de zoekterm wist.

### Alle klanten (/klanten/alle) ter vergelijking

Gelijk aan de prospectlijst, met deze verschillen: titel "Alle klanten", kicker "← Klanten · 96 klanten totaal", primaire knop "+ Klant", signaalfilter "Aandacht nodig" in plaats van "Aanleiding", een link "Naast elkaar →" in de functiegroep naar /klanten/per-functie, in het contextmenu "Plan bezoek" in plaats van "Genereer briefing" en "Promoveer tot klant", en een lege staat zonder zoektermtekst. /klanten/alle leest geen ?filter= uit de URL. /klanten/per-functie toont twee kolommen (verkoopkanaal en eigen gebruik) met compacte rijen: naam, plaats en klassepil.

### De accountkaart (/accounts/:id)

Van boven naar beneden:

1. Kruimel: "← Alle prospects" of "← Alle klanten", afhankelijk van het accounttype. Hij gaat naar de volledige lijst, niet naar de top zes.
2. Kop met links het logo (klikbaar: "Logo wijzigen", met weghalen), daarnaast een regel met vier bewerkbare chips: branche, plaats, land en functie ("Distributeur", "Eindklant" of leeg). Daaronder de naam in grote letters met rechts de accountklasse als pil met potlood; een klik opent het keuzemenu "Accountklasse" met de klassen van de organisatie, hun omschrijving (bijvoorbeeld "250+ medewerkers") en "Geen klasse".
3. Een contactstrook die alleen verschijnt als er iets in staat: website (verkort, opent in nieuw tabblad), telefoon (bellink), LinkedIn, Instagram en Facebook.
4. De stuurstrook, alleen lezen: "Laatste actie", "Laatste call", "Laatste bezoek" (datum of een streepje), en als ze er zijn "Journey" (de journeyfase) en "Ritme" (de stand van het lopende accountplan, alleen met de vlag accountplannen; klik opent het plan op het tabblad Ritme).
5. Rechtsboven de knoppen "Info", "Contacten" met het aantal contactpersonen, "Briefing" (zwart, primair) en "Accountplan" (alleen als er een plan is en de vlag aanstaat).
6. Een statstrook met zes vakken: "Open acties" (met "n achterstallig" in rood), "Inzichten" (met "n ongezien"), "Open offertes", "Open deals", "Laatste contact" (relatief: "vandaag", "gisteren", "5 dgn", "3 wkn", "2 mnd" of een streepje) en "Eigenaar" (naam van de accounteigenaar, of "Geen eigenaar").
7. Als er inzichten zijn: een strook met het nieuwste inzicht, met kicker "Vandaag actie" (hete aanleiding), "Waarschuwing · binnen 7 dagen" (waarschuwing) of "Aanleiding · deze week" (overig) en het label "Aanleiding".
8. De tabbladen, elk met een teller als die boven nul is: "Tijdslijn", "Inzichten", "Taken", "Notities", "E-mails", "Afspraken", "Gespreksverslagen", "Deals", "Campagnes" (alleen met de vlag campagnes) en "Documenten".
9. Op smalle schermen een vaste balk onderin met "Bellen" (mobiel of vast nummer van het primaire contact, anders het bedrijfsnummer) en "Mail".

![De accountkaart van een prospect met kop, stuurstrook, statstrook, nieuwste inzicht en tabbladen](shots/accounts-6-accountkaart.png)

De tabbladen:

| Tabblad | Inhoud | Knoppen |
|---|---|---|
| Tijdslijn | Inzichten, taken, afspraken, deals en contactmomenten, nieuwste eerst | "+ Taak", "+ Afspraak", "+ Mail", "Filters" |
| Inzichten | Inzichtkaarten met acties | geen |
| Taken | Taken in groepen per vervaldatum | "+ Taak" |
| Notities | Vrije aantekeningen, bewerken en verwijderen | "+ Notitie" |
| E-mails | Verstuurde en ontvangen mail | "+ Mail" |
| Afspraken | Alle afspraken van het account | "+ Afspraak" |
| Gespreksverslagen | Verslagen uit beltaken en afspraken met AI-analyse | geen |
| Deals | Deals met fase, waarde, kans en sluitdatum; offertes eronder | "+ Deal", "Open pipeline →" |
| Campagnes | Campagnes waarin het account meeloopt, met de status op het bord | "Alle campagnes →" |
| Documenten | Gekoppelde documenten uit de kennisbank | "+ Document", "Naar Kennisbank →" |

Het tabblad Taken groepeert in "Achterstallig", "Vandaag", "Morgen", "Deze week", "Later", "Geen vervaldatum" en "Klaar (laatste 5)", binnen een groep op prioriteit (urgent, hoog, middel, laag). Een taak toont type, prioriteit, herkomst ("AI", "Signaal", "Gesprek"; handmatig wordt niet getoond), de vervaldatum ("Over 2 dagen") en de reden.

![Het tabblad Taken op de accountkaart met de groepering per vervaldatum](shots/accounts-8-tabblad-taken.png)

Lege staten per tabblad zijn concreet, bijvoorbeeld "Nog niets vastgelegd voor dit account." (tijdslijn), "Nog geen acties voor dit account. Klik op + Taak hierboven." (taken) en "Nog geen notities. Wat je hier schrijft staat ook op de tijdslijn." Een onbekend account-ID toont een eigen pagina "niet gevonden".

## Doorklikken: de stappen

### Een nieuwe prospect aanmaken

1. Klik op /prospects/alle op "+ Prospect". De flyout "Nieuwe prospect" opent rechts met de cursor in "Bedrijfsnaam".
2. Vul de bedrijfsnaam in (verplicht) en zo veel van de rest als je weet. "Soort" staat op "Prospect".
3. Klik op "Prospect aanmaken". De knop toont "Aanmaken…", daarna verschijnt de melding "Naam staat erbij." en ga je direct naar de nieuwe accountkaart.
4. Op de kaart vul je de rest aan via de chips in de kop of via "Info", en voeg je contactpersonen toe via "Contacten".

### Een prospect promoveren tot klant

1. Klik op /prospects/alle met de rechtermuisknop op de rij.
2. Kies "Promoveer tot klant". Er verschijnt een bevestiging "Promoveren tot klant" met de tekst "Naam promoveren tot klant? Het account verhuist naar Klanten." en de knop "Promoveren".
3. Na bevestigen zet DealDrive het accounttype op klant en wist een handmatige prospectgraad. De melding "Naam staat nu bij Klanten." verschijnt en de rij verdwijnt uit de prospectlijst.
4. Alternatief: open de accountkaart, klik "Info" en zet "Accounttype" op "Klant". Dat gebeurt zonder bevestiging en zonder melding.

![Het contextmenu op een prospectrij met Promoveer tot klant](shots/accounts-3-contextmenu-promoveren.png)

### De prospectlijst terugbrengen tot een belbare selectie

1. Klik op "Filters". De strook opent.
2. Kies een klasse, bijvoorbeeld "A · Corporate 9". De tellers bij Signaal en Functie rekenen direct opnieuw met die klasse.
3. Zet "Aanleiding" aan om alleen prospects met een hete aanleiding te zien, of kies "Distributeurs" of "Eindklanten".
4. Typ eventueel in "Zoek naam, plaats of branche…". De lijst filtert tijdens het typen.
5. Kies via de sorteerknop "Laatste activiteit" of "Score". De lijst begint weer bij 25 rijen.
6. "Reset filters" (rechts in de strook) zet alles terug.

### Vanaf de accountkaart een taak, afspraak of mail starten

1. Klik op het tabblad Tijdslijn op "+ Taak". De taakflyout opent met het account en het primaire contact (eerste beslisser of champion, anders het eerste contact) al ingevuld.
2. Of klik "+ Afspraak": de afspraakflyout opent met het account ingevuld.
3. Of klik "+ Mail": het mailvenster opent met het e-mailadres van het eerste contact met een adres. Na versturen staat de mail op de tijdslijn en verschijnt "Mail verstuurd naar adres."; een concept of geplande mail gaat naar de Inbox.

### Een inzicht omzetten in een taak

1. Open het tabblad Inzichten en klik op de taakactie van een inzichtkaart.
2. De taakflyout opent met de voorgestelde titel van de regel (anders "Volg op: type bij Naam"), de commerciële invalshoek als reden, de prioriteit en het uitvoeringstype uit het voorstel.
3. Bij opslaan wordt het inzicht "omgezet". De gezien-actie markeert het inzicht als gelezen; de teller "n ongezien" daalt.

## Flyouts, vensters en knoppen

### Nieuwe prospect (NieuwAccountFlyout)

Opent met "+ Prospect" op /prospects/alle (soort Prospect) of "+ Klant" op /klanten/alle (soort Klant). Kicker "Nieuwe prospect" of "Nieuwe klant", titel "Wie ga je erbij zetten?". De velden volgen de Info-flyout:

| Blok | Velden | Standaard |
|---|---|---|
| Stamgegevens | "Bedrijfsnaam" (verplicht), "Soort", "Accountklasse", "Officiële naam", "KvK", "Branche", "Accountfunctie" | Soort volgt de pagina; klasse "Nog niet bepaald"; functie "Niet bepaald" |
| Adres | "Adres", "Postcode", "Plaats", "Land" | Land "NL" |
| Bereik | "Telefoon", "Website", "LinkedIn-pagina" | leeg |
| Contract & order | "Contract tot", "Laatste order" (datum) | leeg |
| Eigen velden | de velden die de beheerder heeft ingericht, per sectie | leeg |

Validatie: alleen de bedrijfsnaam is verplicht; de knop "Prospect aanmaken" (of "Klant aanmaken", hij volgt de gekozen soort) blijft uit zolang die leeg is. Er is geen controle op dubbele namen of KvK-nummers. Mislukt het aanmaken, dan staat onder het formulier "Aanmaken mislukt. Controleer de bedrijfsnaam en probeer het opnieuw." Onderaan "Annuleren". Escape en een klik naast het paneel sluiten de flyout.

![De flyout Nieuwe prospect met Stamgegevens, Adres en Bereik](shots/accounts-5-nieuwe-prospect.png)

### Info (InfoFlyout, Bedrijfsgegevens)

Opent met "Info" op de accountkaart. Kicker "Bedrijfsgegevens", titel de bedrijfsnaam, daaronder officiële naam, branche en plaats. Elk veld is een bewerkbaar dataveld: bij aanwijzen verschijnt een potlood, een klik opent een invoerveld met opslaan en annuleren, Escape annuleert. Leeg maken wist het veld.

- "Adres": "Adres", "Postcode", "Plaats", "Land".
- "Bereik": "Telefoon", "Website", "Logo" (eigen logo-URL, anders automatisch), "LinkedIn", "Instagram", "Facebook".
- "Stamgegevens": "Account-ID" (alleen lezen, met kopieerknop), "Accounttype" (Klant of Prospect), "Accountklasse", "Accountfunctie", "Bedrijfsnaam" (leeg opslaan wordt genegeerd), "Officiële naam", "KvK", "Branche".
- "Contract & order": "Contract tot" en "Laatste order". Deze datums voeden de regels "aflopend contract" en "X dagen niets besteld".
- Eigen velden onder hun sectie, in de demo onder "Eigen velden": "KvK-inschrijfdatum", "Rechtsvorm", "Aantal medewerkers".
- Onderaan "Verwijder account". De bevestiging "Account verwijderen?" zegt dat het account uit alle lijsten verdwijnt met de contactpersonen eronder, en dat taken en afspraken uit het verleden blijven staan. Na bevestigen verschijnt "Naam is verwijderd." en ga je naar /klanten/alle, ook als het een prospect was.

![De Info-flyout met adres, bereik en stamgegevens van het account](shots/accounts-7-info-flyout.png)

### Contextmenu op de lijst

Rechtermuisklik op een rij of kaart. Kop met kicker "Prospect" en de bedrijfsnaam. Items op /prospects/alle: "Open kaart", "Genereer briefing" (naar /accounts/:id/briefing), "Bel primaire contact" (alleen als er een nummer is: eerst een contact met telefoon of mobiel, anders het bedrijfsnummer; opent een tel-link), "Stuur e-mail" (opent de accountkaart met het mailvenster al open), "Nieuwe taak" (taakflyout met het account ingevuld) en "Promoveer tot klant".

### Overige vensters op de accountkaart

- "Contacten" opent de flyout met contactpersonen (beschreven in het hoofdstuk Contacten).
- "Briefing" opent "Briefings · 5 soorten" met vijf kaarten: "1e gesprek", "Behoefte-probleem-oplossing", "2e gesprek", "Offerte" en "After sales", elk met "n gepland" als er de komende 14 dagen iets gepland staat. Onderaan "Alle briefings →" en "Volledige briefing" (naar /accounts/:id/briefing).
- Klikken op een tijdslijnitem opent de flyout van dat soort: taak, inzicht, afspraak, deal of contactmoment.
- Notitie verwijderen vraagt "Notitie verwijderen?" met "Deze notitie verdwijnt ook van de tijdslijn." Lukt de serveropslag niet, dan zegt een waarschuwing dat de notitie alleen op dit apparaat staat.

### Import van klanten en prospects (kort)

Grote aantallen prospects komen via /import binnen, niet via de lijst. De pagina is alleen voor beheerder en superuser en hangt aan de functievlag import; je bereikt hem via Instellingen. Vier stappen: "Uploaden" (CSV of TSV, eerste rij kolomnamen, maximaal 10.000 rijen, keuze "Klanten en prospects" of "Contactpersonen", met een voorbeeldbestand), "Koppelen" (elke kolom aan een DealDrive-veld of eigen veld; "Klantnaam" is verplicht), "Duplicaten" en "Bevestiging". De dubbelcheck normaliseert de naam (B.V., N.V., Holding en Group tellen niet mee) en vergelijkt lettercombinaties: boven 80 procent is het een duplicaat dat standaard wordt samengevoegd, 60 tot 80 procent een mogelijk duplicaat dat je zelf beoordeelt, daaronder nieuw. Zonder kolom "Account type" komt een nieuwe rij binnen als prospect. Bij samenvoegen mag de import een prospect naar klant zetten, maar nooit een klant terug naar prospect.

## Filters, zoeken, sorteren en weergaven

Filters op /prospects/alle, elk een eigen dimensie die je kunt combineren:

| Groep | Waarden | Werking |
|---|---|---|
| Zoekveld | vrije tekst | naam, plaats en branche bevatten de term (hoofdletterongevoelig) |
| Accountklasse | "Alle prospects", de klassen van de organisatie, "Geen klasse" | één keuze tegelijk |
| Signaal | "Aanleiding" | aan of uit; alleen accounts met een hete aanleiding |
| Functie | "Alle", "Distributeurs", "Eindklanten" | plus de tekst "n zonder functie"; de groep verschijnt alleen als er accounts met een functie zijn |

Tellers rekenen per groep met alle andere actieve dimensies, maar niet met de eigen dimensie. Op elke pil staat dus het aantal dat je krijgt als je hem kiest. In de demo: 86 prospects, waarvan "A · Corporate 9", "B · Groot MKB 29", "C · Middenbedrijf 23", "D · Klein MKB 0", "Geen klasse 25", "Aanleiding 5", "Distributeurs 57", "Eindklanten 29". Een klassepil met nul blijft staan maar is uitgeschakeld, behalve als hij actief is.

De teller op "Filters" telt de afwijkingen van de standaard: klasse, functie, signaal en een niet-lege zoekterm, elk één. "Reset filters" verschijnt bij een teller boven nul.

Sorteren: "Naam" (standaard, Nederlandse alfabetvolgorde), "Laatste activiteit" (veld lastInteractionAt, nieuwste eerst), "Score" (hoogste eerst) en "Accountklasse" (A eerst, zonder klasse onderaan). Bij gelijke waarde wint de naam. Let op: de sortering "Laatste activiteit" gebruikt het opgeslagen stuurveld, terwijl de tekst "Laatste activiteit" op de rij uit een bredere berekening komt (zie hieronder); de volgorde kan dus afwijken van de getoonde datums.

Weergaven: "Lijst", "Compact" en "Kaarten". Elke wissel van filter, zoekterm, sortering of weergave zet de lijst terug op 25 rijen.

URL: alleen ?filter= wordt bij het openen gelezen (geen-fase, fase-A en zo verder, of de oude waarde trigger-hot die het signaal aanzet). Filterkeuzes worden niet terug in de URL geschreven, dus een gefilterde lijst is niet te delen of te bewaren. Op de accountkaart staat het actieve tabblad wel in de URL (?tab=acties, ?tab=offertes; ?tab=deals wordt offertes) en ?action=mail opent het mailvenster en verdwijnt daarna uit de URL.

![De weergave Kaarten met het sorteermenu open](shots/accounts-4-kaarten-en-sorteren.png)

## Regels en berekeningen

Klant of prospect. Het effectieve type is het veld accountKind als dat gezet is; anders volgt het uit het segment: strategic, klant en at-risk zijn klant, hot-prospect, warm-prospect, prospect en watchlist zijn prospect. Promoveren verandert alleen accountKind; het segment blijft staan als historische graad.

Prospectgraad. Hot, Warm, Lauw of Koud. Het veld prospectGrade wint; anders hot-prospect wordt hot, warm-prospect warm, watchlist lauw en prospect koud. De graad bepaalt alleen de kleur van het logoblok en de kaartrand. In het scherm is hij nergens meer te wijzigen: de kiezer is niet meer gemonteerd en de code in de Info-flyout wordt niet gebruikt.

Rangschikking Top deze week (prospects): score van het account, plus 5 per live inzicht met een maximum van 20, plus 18 bij een hete aanleiding of 6 bij een waarschuwing, plus 10 voor segment hot-prospect of 4 voor warm-prospect, plus 4 als het laatste stuurveldcontact minder dan 7 dagen geleden is. De zes hoogste komen bovenaan. Voor klanten: score plus maximaal 20 voor inzichten, plus 15 of 5 voor de aanleiding, plus 6 bij contact binnen 7 dagen of 3 binnen 14 dagen, plus 8 voor at-risk en 4 voor strategic.

Score. Het type beschrijft score als een AI-bepaald getal van 0 tot 100 met een opbouw (versheid van signalen 30, bereikbaarheid 25, productfit 20, dealmomentum 15, recentheid 10). In de code berekent niets die score: de demowaarden komen uit de testdata, en elk nieuw account (formulier, import, generator) krijgt vast 50. De sortering "Score" en de ranglijst rusten dus op een waarde die in de praktijk niet beweegt.

Aanleiding. De velden trigger (tekst) en triggerKind (standard, hot of warn) voeden het filter "Aanleiding", het label op de kaart en de rode markering op de rij. In de code zet geen regel of motor deze velden. Ze komen uit de testdata, uit de import (tekst "Geïmporteerd via /import", soort standard) en uit de generator ("Gevonden door de leadgenerator"). Een prospect die je zelf aanmaakt heeft nooit een aanleiding. Het klantfilter "Aandacht nodig" gebruikt precies dezelfde test (triggerKind is hot) als "Aanleiding".

Laatste activiteit en Laatste contact. Beide komen uit laatsteContactmoment: het jongste moment uit de communicatie van het account (mail, notities), afgeronde taken van het type bellen, mail, bericht of afspraak, afspraken die niet geannuleerd zijn en al begonnen zijn, en het stuurveld lastInteractionAt. Open taken en toekomstige afspraken tellen niet. Op de rij staat een datum ("4 sep", met jaar als het een ander jaar is) of "geen"; op de kaart een relatieve tijd.

Stuurvelden. Een afgeronde taak met een account zet lastInteractionAt op nu, plus lastCallAt bij een beltaak en lastVisitAt bij een bezoek of afspraaktaak. Een bezoek- of demoafspraak op Voltooid werkt lastVisitAt bij. De stuurstrook is daarom bewust alleen lezen.

Open tellingen op de kaart. Open acties: alle taken behalve afgerond of geannuleerd. Achterstallig: vervaldatum op kalenderdag vóór vandaag. Open offertes: status niet goedgekeurd, verloren of vervallen. Open deals: fase niet gewonnen of verloren. Inzichten: alle niet-afgewezen inzichten van het account, inclusief inzichten op contactpersonen van het account.

Primair contact. De eerste contactpersoon met rol beslisser of champion, anders de eerste in de lijst. Die wordt voorgevuld bij een nieuwe taak en deal, en zijn nummer zit achter "Bellen".

Opslaan. Elke wijziging gaat eerst in het geheugen en in IndexedDB op het apparaat, en daarna via de synchronisatiewachtrij naar de server. Leeg gemaakte velden gaan als null mee, zodat ze ook op de server leeg worden.

Accountklassen. Standaard "A · Corporate" (250+ medewerkers), "B · Groot MKB" (50 tot 250), "C · Middenbedrijf" (10 tot 50) en "D · Klein MKB" (tot 10). De beheerder kan ze hernoemen en klassen toevoegen (E, F en verder); die opslag zit in de organisatie-instellingen.

Wat de AI hier doet: niets op de lijst en de kaart zelf. AI zit in de inzichten die de regelmotor levert, in de analyse van gespreksverslagen en in de briefings. Er is geen AI-score, geen AI-prioritering en geen automatische verrijking van nieuwe accounts.

## Gegevens

Een account (tabel accounts; vaste kolommen voor id, organisatie, naam, segment, accounttype, functie, klasse, journeyfase, contractdatum, orderdatum, plaats en eigenaar, de rest in een jsonb-veld data):

- Stamgegevens: naam (name), officiële naam (legalName), KvK-nummer (kvkNumber), SBI-code (sbiCode), branche (branche), tier A/B/C (tier).
- Adres: adres (addressLine), postcode, plaats (city), land (country).
- Bereik: telefoon (phone), website, LinkedIn (linkedInUrl), Instagram (instagramUrl), Facebook (facebookUrl), logo (logoUrl) en bewust geen logo (logoUit).
- Verkoopcontext: segment, accounttype (accountKind), klantgraad (klantGrade), prospectgraad (prospectGrade), functie (accountFunction), accountklasse (accountfase), journeyfase (journeyStageId), eigenaar (ownerId), score en scoreopbouw, maandomzet (mrr).
- Stuurvelden: contract tot (contractEndDate), laatste order (lastOrderDate), laatste bezoek (lastVisitAt), laatste call (lastCallAt), laatste interactie (lastInteractionAt).
- Aanleiding: trigger, triggerKind, en gedenormaliseerde tellers signalCount, openTasks, openDeals en openQuotes (de schermen tellen live en gebruiken deze tellers niet meer).
- Briefing: eigen overschreven teksten (briefingTeksten) en door Claude geschreven briefings (briefingAi).
- Externe ID's (externalIds) en eigen velden (customFields).

Van andere features komen: inzichten (regelmotor), taken, afspraken, communicatie (mail en notities), deals en offertes (pipeline), campagne-items, accountplannen en documenten (kennisbank). Een nieuw account krijgt van het systeem: ID, eigenaar is de ingelogde gebruiker, segment klant of warm-prospect, score 50 en land NL.

## Wat dit betekent voor Dealtrace

- Overnemen: één accountrecord met een type klant of prospect, één URL en promoveren als veldwijziging. Dat houdt de historie intact bij de overgang naar klant.
- Overnemen: de filterstrook met tellers die rekenen met de andere actieve filters, uitgeschakelde pillen bij nul en "Toon alles" in de lege staat.
- Anders: de score en de aanleiding moeten echt berekend worden, uit inzichten, bereikbaarheid en recent contact, en zichtbaar uitgelegd. Nu sorteert DealDrive op een vaste 50 en hangt "Aanleiding" aan seeddata.
- Anders: filters en sortering in de URL zetten, en bewaarde selecties ("mijn A-prospects zonder contact in 30 dagen") mogelijk maken. Voor binnendienst is dat de bellijst; voor buitendienst hoort er een filter op regio of afstand bij.
- Toevoegen: een eigenaarfilter ("Mijn prospects") en een filter op "laatste contact ouder dan X dagen". De lijst toont nu alle prospects van de organisatie zonder onderscheid naar eigenaar.
- Toevoegen: dubbelcheck bij aanmaken (naam, KvK, domein) en verrijking uit KvK of website; de import kent dat al, het formulier niet.
- Anders: promoveren altijd met dezelfde bevestiging en vastlegging (wie, wanneer), ook vanuit Info, zodat new business-resultaat meetbaar wordt.
- Kort houden: de accountkaart heeft tien tabbladen. Voor new business volstaan tijdslijn, taken, contacten, deals en notities; de rest kan achter een menu.
