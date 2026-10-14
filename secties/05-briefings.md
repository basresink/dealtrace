# Briefings

## Wat het is en waarvoor

Een briefing is gespreksvoorbereiding: wat je twee tot vijf minuten vóór een gesprek leest om te weten met wie je praat, waarom, wat er openstaat en wat je eruit wilt halen. Het uitgangspunt in DealDrive is dat je een briefing niet aanmaakt. Hij verschijnt, omdat er een reden is om te praten: een afspraak in de agenda of een open taak met een vervaldatum, gekoppeld aan een account.

De inhoud wordt bij het openen live berekend uit de gegevens van het account (taken, offertes, signalen, contactmomenten, klasse, branche, plaats, trigger en het laatste geanalyseerde gespreksverslag). Er wordt niets opgeslagen behalve wat jij zelf herschrijft: dezelfde gegevens geven dezelfde briefing, en een briefing veroudert dus niet. Over de berekende tekst kan een AI-tekst liggen en daarover jouw eigen tekst.

Elke briefing krijgt automatisch één van vijf soorten, in gespreksvolgorde: "1e gesprek", "Behoefte-probleem-oplossing" (BPO), "2e gesprek", "Offerte" en "After sales". Elke soort heeft eigen blokken. Daarnaast bestaan een volledige briefingpagina per account (één vaste opbouw) en een aparte offerte-briefing per offerte.

Voor een accountmanager zit de briefing tussen de taak (wat je doet) en het gesprek: 's ochtends kijk je wat er vandaag aan gesprekken staat, vlak voor het gesprek open je de snelle briefing. Voor een salesmanager is het een stille standaard: elke verkoper komt met dezelfde structuur het gesprek in, en de BPO-briefing dwingt de volgorde pijn, situatie, oplossing af.

Samenhang:

- Leest afspraken en taken (welke gesprekken er komen), accounts, contactpersonen, offertes, signalen, communicatie en gespreksverslagen met hun AI-analyse.
- Schrijft alleen de eigen teksten per blok (op het account) en, vroeger, AI-versies per soort (op het account).
- De BPO-briefing vult zich met de analyse van het vorige gespreksverslag; het verslag komt uit de afspraakflyout of de beltaak (zie Bezoeken en Meetings).
- De Pitstop (AI-agent op een afspraak of taak) is een aparte, aanvullende voorbereiding.

## Waar je het vindt

- Zijbalk, groep "Activiteiten", menu-item "Briefings" (klembord-icoon), direct onder "Taken": de taak is wat je doet, de briefing hoe je eraan verschijnt.
- Route /briefings (het overzicht) en /accounts/[id]/briefing (de volledige briefing per account).
- Functievlag "briefings" (groep Dagritme, standaard aan, afgedwongen). Uit betekent geen menu-item en /briefings geblokkeerd. De volledige briefingpagina en de flyouts hangen niet aan die vlag. Geen rolbeperking.

De briefing opent op meer plekken, met verschillend gedrag:

| Plek | Wat opent | Soort |
|---|---|---|
| /briefings, kaart | snelle briefing (flyout) | automatisch bepaald |
| Vandaag, blok "Briefings · vandaag in agenda" | snelle briefing | altijd BPO (zie Regels) |
| Klantkaart, knop "Briefing" | soortkiezer met vijf kaarten | zelf kiezen |
| Contactkaart, knop "Briefing →" | soortkiezer, contact centraal | zelf kiezen |
| Dagstart (Dex) | snelle briefing met contact | automatisch bepaald |
| Klantkaart tab Deals, offerte | offerte-briefing | per offerte |
| Afspraakflyout, bellijst, flyoutvoet | volledige briefingpagina | geen soort |

## Opbouw van de pagina

![Het overzicht Alle briefings met kaarten per dag en hun soortlabel](shots/briefings-1-pagina.png)

### Kop

- Kicker: "Voorbereiding · 27 briefings", met het aantal na alle filters.
- Titel: "Alle briefings".
- Subtitel: "Vijf minuten vooraf bepalen of jij het gesprek stuurt of het gesprek jou. Wie de aanleiding, de cijfers en de namen paraat heeft, hoeft niet te improviseren."
- Knoppen rechtsboven: zoekknop (globale zoekoverlay), "+ Taak" (globale taakflyout), "+ Afspraak" (nieuwe-afspraakflyout, leeg) en "Filters" (met teller). Een nieuwe taak met vervaldatum of een nieuwe afspraak met account levert direct een nieuwe briefingkaart op.

### Dagblokken en kaarten

De kaarten staan per kalenderdag onder een kop als "Vandaag · woensdag 14 oktober", "Morgen · donderdag 15 oktober" of "vrijdag 16 oktober", met rechts het aantal ("5 briefings"). Binnen een dag staan ze op tijd; taken zonder tijd (00:00) staan daardoor vóór de afspraken van die dag.

Een kaart toont:

- de tijd (leeg bij een taak zonder tijd);
- het soortlabel in de kleur van de soort ("OFFERTE", "BEHOEFTE-PROBLEEM-OPLOSSING", "1E GESPREK", "2E GESPREK", "AFTER SALES");
- de accountnaam;
- de relevantste contactpersoon van het account (beslisser of champion, anders de eerste contactpersoon), niet het contact van de afspraak;
- de context: de titel van de afspraak of taak;
- in de voet "Klant" of "Prospect" en "Snelle briefing →";
- onder de kaart de link "Volledige briefing →".

De kaart zelf opent de snelle briefing; de link gaat naar de volledige pagina. Eén account kan meerdere kaarten op één dag hebben: in de demodata staat IBM vandaag twee keer, voor de taak "Bel met IBM over contract-verlenging" en de afspraak "Contract-verlenging IBM".

Lege staat: kicker "NIETS GEPLAND", titel "Geen briefings in dit filter." en "Geen afspraken of openstaande taken voor klanten en prospects in deze periode."

### Het blok op Vandaag

Op de startpagina staat "Briefings · vandaag in agenda" met de titel "Voorbereiding voor de dag", de teller "3 klanten · 2 prospects" en de link "Alle briefings →". Maximaal zes kaarten, alleen voor vandaag. Het blok verdwijnt als er vandaag niets is. Het is niet dezelfde lijst als /briefings: per account komt er hoogstens één afspraak- en één taakkaart, een taak valt weg als hetzelfde account al een afspraak heeft, en de kaart toont het segment in plaats van de soort.

## Doorklikken: de stappen

### Je gesprekken van vandaag voorbereiden

1. Klik in de zijbalk op "Briefings". Het overzicht opent op "Komende 7 dgn".
2. Kijk onder "Vandaag" welke gesprekken er zijn en welk soortlabel ze hebben.
3. Klik op een kaart. De snelle briefing schuift van rechts in, met de blokken van die soort en de contactpersoon in de kop.
4. Wil je meer, klik dan in de voet op "Volledige briefing". De flyout sluit en de briefingpagina van het account opent.

### Een briefing naar je hand zetten

1. Open de snelle briefing en klik in de voet op het potlood ("Wijzigen").
2. Alle tekstblokken worden tegelijk tekstvelden met de huidige tekst erin. Pas aan wat je wilt.
3. Klik buiten een veld: dat blok wordt meteen bewaard. Onder het blok verschijnt "Eigen tekst" met de knop "herstel berekende tekst".
4. Klik op "Klaar met wijzigen". Op de volledige pagina werkt het per blok met het potlood naast het blok, en de knoppen "Opslaan" en "Annuleren".

![De snelle briefing in de bewerkstand: alle blokken zijn tekstvelden](shots/briefings-4-bewerkstand.png)

### Zelf een soort kiezen vanaf de klantkaart

1. Open een klantkaart en klik in de kop op "Briefing".
2. De soortkiezer "Briefings · 5 soorten" opent met vijf kaarten in gespreksvolgorde. Een kaart toont "4 gepland" als er voor dat account de komende 14 dagen zoveel gesprekken van die soort staan.
3. Klik op een kaart. De snelle briefing van die soort opent.

![De soortkiezer vanaf de klantkaart met de vijf soorten](shots/briefings-8-soortkiezer-klantkaart.png)

### Een offertegesprek voorbereiden

1. Op /briefings: filter op soort "Offerte" en open de kaart. De snelle briefing toont offerte-context, verwachte bezwaren, beslissingscriteria en het doel.
2. Voor de diepere voorbereiding per offerte: open de klantkaart, tab "Deals", en klik onder "Offertes" op de offerte. De offerte-briefing opent met stand van zaken, bezwaren met antwoorden, een checklist, onderhandeltips en een doel.
3. Klik op "+ Opvolg-taak" om direct een taak "Opvolgen offerte [titel]" aan te maken.

### Een BPO-briefing laten vullen met het vorige gesprek

1. Leg na het eerste gesprek het verslag vast op de afspraak of beltaak en klik op "Opslaan en analyseer →".
2. Laat de analyse draaien (Claude). De analyse wordt op het record bewaard.
3. Open daarna de briefing van het volgende gesprek met dat account. Staat de soort op BPO, dan zegt een bronregel "Gevuld met het gespreksverslag van "[titel]" · [datum]" en zijn pijnpunt, huidige en gewenste situatie en doel gevuld uit die analyse.
4. Met het filter "Alleen met gespreksverslag" zie je welke briefings al zo gevuld kunnen worden.

## Flyouts, vensters en knoppen

### Filterpaneel

![Het filterpaneel met Periode, Soort, Doelgroep en Verslag, soort Offerte gekozen](shots/briefings-2-filters.png)

Zie het hoofdstuk Filters hieronder. Het paneel blijft bovenaan staan als je scrolt.

### Snelle briefing (de briefingflyout)

![Snelle briefing van soort Behoefte-probleem-oplossing zonder vorig verslag](shots/briefings-3-flyout-bpo.png)

Opent via een kaart op /briefings of Vandaag, de soortkiezer of de dagstart. Kop: het soortlabel, de accountnaam, een regel met klasse, branche en plaats ("A · Bouw · Zwolle") en "Contact: Henk de Vries · Directeur-eigenaar" als link naar de contactkaart. Komt de flyout van een contactkaart, dan staat dat contact in de kop; anders kiest de briefing de relevantste contactpersoon. Bestaat er een AI-versie voor deze soort, dan staat er "Door AI geschreven op [datum]".

De blokken per soort, genummerd (een blok zonder gegevens verdwijnt):

| Soort | Blokken |
|---|---|
| 1e gesprek | Bedrijfssamenvatting · Wie zit er tegenover je? · Aanleiding tot het gesprek · Openingsvraag · Doel van dit gesprek |
| Behoefte-probleem-oplossing | Pijnpunt: wat doet pijn? · Huidige situatie · Gewenste situatie · Onze oplossing · Doel van dit gesprek |
| 2e gesprek | Samenvatting vorig gesprek · Concrete behoeften (BANT/MEDDIC) · Stakeholders (DMU) · Doel van dit gesprek |
| Offerte | Offerte-context · Verwachte bezwaren · Beslissingscriteria · Doel van dit gesprek |
| After sales | Implementatie-status · Tevredenheid & NPS · Recente signalen bij klant · Uitbreidingskansen |

Onder een blok staat "Eigen tekst" (met "herstel berekende tekst" of "terug naar de AI-tekst") of "Door AI geschreven"; zonder label is het de berekende tekst.

Voet: "Volledige briefing" (hoofdknop, naar de pagina), en als iconen "Wijzigen" (potlood; wordt de knop "Klaar met wijzigen" zolang de bewerkstand aanstaat), "Open contact" en "Open klantkaart". Sluiten met het kruisje, Escape of een klik naast het paneel; sluiten zet de bewerkstand uit. Escape in een tekstveld verlaat alleen dat veld.

![Snelle briefing van soort Offerte met de vaste bezwaren en criteria](shots/briefings-5-flyout-offerte.png)

### Soortkiezer

Kop "Briefings · 5 soorten", accountnaam en "Kies het soort briefing dat past bij je volgende contactmoment." Vijf kaarten met label, kop en uitleg: "Verkennend gesprek", "Behoefte → probleem → oplossing", "Verdiepingsgesprek", "Offerte bespreken", "After sales / QBR", elk met "Open briefing →" en eventueel "4 gepland". Voet: "Alle briefings →" en "Volledige briefing". De kiezer markeert niet welke soort de app zelf zou kiezen. De kaarttekst bij "Offerte bespreken" belooft onderhandeltips; die staan alleen in de aparte offerte-briefing, niet in de snelle briefing.

### Volledige briefing (/accounts/[id]/briefing)

![De volledige briefingpagina van IBM met klantsamenvatting, openstaande punten en signalen](shots/briefings-6-volledige-briefing.png)

Een printbare pagina met een terugregel "← Klantkaart [naam]", de titel "Briefing: [naam]" en de knop "Print briefing" (printdialoog van de browser). De pagina heeft geen soort: hij is voor elk gesprek hetzelfde. Negen blokken, doorlopend genummerd over de zichtbare blokken:

1. Klantsamenvatting: naam, plaats en branche, accountklasse en functie (distributeur of eindklant), contractwaarde en "2 openstaande taken, 1 lopende offerte, 1 recente signaal."
2. Laatste contactmoment: datum, soort en richting van de laatste communicatie, sentiment en een citaat. Alleen zichtbaar als er communicatierecords zijn; afgeronde taken en afspraken tellen hier niet, dus in de demodata ontbreekt dit blok.
3. Openstaande punten: open taken met vervaldatum en lopende offertes met status en bedrag.
4. Recente signalen: maximaal vijf, met bron, datum en tekst.
5. Gesprekspunten: maximaal vijf, uit de trigger, het eerste signaal, de eerste open offerte en het segment.
6. Mogelijke bezwaren + tegenargumenten: alleen bezwaren uit gespreksanalyses van dit account, plus een vaste regel bij een at-risk account.
7. Cross-sell / upsell-kansen: alleen bij een klant zonder open offerte of een A-account.
8. Doel voor dit gesprek.
9. Voorgestelde volgende stap.

Elk blok heeft een eigen potlood met "Opslaan" en "Annuleren" en de hint "Leeg opslaan zet het blok terug op de berekende tekst." Een blok dat alleen bij gegevens verschijnt, blijft staan zolang er een eigen of AI-tekst voor is. Onderaan staat: "Samengesteld op [moment] uit de gegevens van dit account. … Klopt een blok niet? Klik op het potlood en schrijf het zelf. Je tekst wint van de rest en blijft bij dit account bewaard." De vroegere knoppen "Schrijf met AI" en "Mail naar mezelf" zijn weggehaald.

### Offerte-briefing (per offerte)

![De offerte-briefing vanaf de klantkaart met bezwaren, kans en antwoord](shots/briefings-7-offerte-briefing.png)

Opent vanaf de offerteregel op de klantkaart (tab "Deals"), de contactkaart, de dagstart, de verdieping en Vandaag. Kop: "Offerte briefing · [status]", titel van de offerte, referentie, bedrag en account. Vijf blokken:

1. Stand van zaken: status, "Verstuurd" (dagen geleden), "Gelezen" (aantal keer, laatst), "Geldig tot" (met "nog 12 dgn" of "3 dgn verlopen").
2. Verwachte bezwaren: de vier zwaarste uit een vaste bibliotheek van zeven, elk met citaat, kansaanduiding ("Vaak" of "Soms"), "Antwoord:" en een tip.
3. Voorbereiding: een checklist van maximaal zeven punten.
4. Onderhandelen: tips & tricks: zes vaste tips.
5. Doel voor dit gesprek: per offertestatus.

Voet: "Open klantkaart →" (naar de tab Deals) en "+ Opvolg-taak" (sluit en opent de taakflyout met account en titel "Opvolgen offerte [titel]"). Let op: het handboek zegt dat /offertes per offerte deze flyout opent. In de code opent een regel op /offertes de klantkaart; de offerte-briefing zit één klik verder.

## Filters, zoeken, sorteren en weergaven

| Groep | Waarden | Teller |
|---|---|---|
| Periode | Vandaag, Komende 7 dgn (standaard), Komende 14 dgn, Komende 60 dgn | geen |
| Soort | Alle, 1e gesprek, Behoefte-probleem-oplossing, 2e gesprek, Offerte, After sales | aantal in de periode |
| Doelgroep | Alle, Klanten, Prospects | aantal in de periode |
| Verslag | Alleen met gespreksverslag (aan of uit) | aantal in de periode |

- De vensters rekenen vanaf vandaag 00:00: Vandaag is 24 uur, de andere 7, 14 of 60 dagen. Verleden telt niet mee.
- De tellers bij Soort, Doelgroep en Verslag tellen alle kaarten in de periode, los van de andere filters. "Offerte 5" blijft 5, ook als je Prospects kiest.
- De filters combineren met EN.
- De teller op de knop "Filters" telt alleen Soort, Doelgroep en Verslag. "Reset filters" (alleen zichtbaar als die teller boven nul is) zet die drie terug; de periode blijft staan. In de code staat dat de periodeknoppen bewust buiten het paneel blijven, maar ze staan erin.
- Naast "Alleen met gespreksverslag" staat "Deze briefings vullen zichzelf met de analyse van het vorige gesprek."
- Niets komt in de URL. Er is geen zoekveld op de pagina en geen sorteerkeuze; de volgorde is per dag op tijd. De keuze tussen kaart-, horizon- en lijstweergave is in augustus 2026 weggehaald; alleen de kaartweergave bestaat nog.

## Regels en berekeningen

### Welke gesprekken een briefing krijgen

- Afspraken met een account, niet geannuleerd, met een begintijd in het venster. Alle types tellen mee: ook intern overleg, voltooide en niet-verschenen afspraken van vandaag.
- Open taken (niet afgerond, niet geannuleerd) met een account en een vervaldatum in het venster. Achterstallige taken (vervaldatum vóór vandaag) krijgen geen briefing, ook al moeten ze nog gebeuren.
- Bereik: organisatiebreed, net als /bezoeken en /meetings. De afspraken en taken van collega's in dezelfde organisatie staan er ook tussen.

### Welke soort: de volgorde

De soort komt uit één gedeelde functie en wordt bepaald door de titel van de afspraak of taak plus de historie van het account, in deze volgorde:

1. Titel bevat "offerte", "voorstel" of "contract" → Offerte.
2. Titel bevat "after sales", "aftersales", "evaluatie", "qbr" of "jaarplan" → After sales.
3. Het account heeft een goedgekeurde offerte met een besluitdatum in de afgelopen 90 dagen → After sales.
4. Nul contactmomenten → 1e gesprek.
5. Eén of twee contactmomenten → Behoefte-probleem-oplossing.
6. Drie of meer → 2e gesprek.

Wat in de agenda staat wint van de historie: een offertegesprek bij een nieuwe klant is een offertegesprek. Het afspraaktype speelt geen rol, alleen de titel. "Kwartaalbespreking" valt dus niet onder After sales, "kwartaalreview" ook niet, maar "QBR" wel. Sinds augustus 2026 staat BPO vóór het 2e gesprek: het eerste gesprek levert een pijnpunt op, het volgende toetst dat.

### Wat een contactmoment is

Geteld in unieke kalenderdagen met contact, uit vier bronnen:

- communicatierecords van het account (mail, telefoon, notitie);
- afgeronde taken van het type bellen, mailen, bericht of afspraak (een to-do telt niet);
- afspraken met een begintijd in het verleden die niet geannuleerd zijn;
- het veld laatste actie (lastInteractionAt) van het account.

Twee kanttekeningen uit de code. Een voorbije afspraak telt mee ongeacht status en type: ook "Niet verschenen" en intern Accountoverleg, terwijl de rest van de app intern overleg uitdrukkelijk niet als klantcontact telt. En een geïmporteerd account met alleen een laatste actie heeft één contactmoment en krijgt daardoor meteen de BPO-briefing.

### Hoe de blokken gevuld worden

Alles is regelwerk, geen AI, behalve als er een bewaarde AI-versie is.

- 1e gesprek: de bedrijfssamenvatting is "[naam] is een [branche]-bedrijf in [plaats]. Segment: [segment]. Contractwaarde per jaar: …". De openingsvraag citeert de trigger: 'Ik las over "[trigger]". Vertel eens, wat betekent dat voor jullie in de dagelijkse praktijk?'; zonder trigger een vraag uit de branche, anders een algemene vraag. Het doel is vast: 1 pijnpunt, 1 stakeholder en 1 vervolgafspraak.
- BPO met geanalyseerd verslag: de bezwaren uit de analyse worden het pijnpunt ("Genoemd in het vorige gesprek: … Toets of dit nog steeds de echte pijn is"), de samenvatting de huidige situatie, de koopsignalen de gewenste situatie, het afgesproken vervolg het doel. Zonder verslag: het pijnpunt citeert de trigger of geeft een at-risk-opening, de rest zijn vaste vragen. "Onze oplossing" is altijd een vaste tekst.
- 2e gesprek: de samenvatting van het vorige gesprek komt alleen uit communicatierecords (niet uit taken of verslagen), BANT is een vaste lijst met als enige variabele het aantal beslissers, de DMU-lijst toont maximaal vier beslissers of champions.
- Offerte (flyout): de offerte-context toont maximaal vier offertes die niet verloren of vervallen zijn. Verwachte bezwaren, criteria en doel zijn vaste teksten ("Te duur", "Nog niet beslissen", "Andere offerte ligt voor", "Moet intern bespreken"; doel "Sluit."). Het handboek beschrijft bezwaren uit gespreksanalyses en het doel "beslissing krijgen op offerte X"; dat geldt voor de volledige pagina, niet voor de flyout.
- After sales: vaste checklist voor implementatie en NPS, maximaal drie recente signalen, vaste tekst over uitbreiding.
- Volledige pagina, doel: met open offerte "Beslissing krijgen op offerte [referentie], concrete deadline afspreken."; at-risk "Vertrouwen herstellen …"; hot prospect "Volgende afspraak met beslisser inplannen."; anders "Inzicht krijgen in actuele behoeften en de relatie versterken." Volgende stap: bij een open offerte een bevestigingsmail, anders "Plan een follow-up over 2 weken om voortgang te bewaken."
- Volledige pagina, bezwaren: uit de analyses van beltaken en afspraken met een verslag, alleen als de analyse bij de huidige verslagtekst hoort (dezelfde tekst-hash). Geen tegenargument; dat schrijft de verkoper zelf.

### Offerte-briefing: weging van de bezwaren

Elke bezwaar uit de bibliotheek krijgt een gewicht; de vier zwaarste staan er. Prijs: 10, +4 bij at-risk, +3 boven €5.000. Timing: 8, +4 bij gelezen, +2 bij verstuurd. Mandaat ("Ik moet dit nog intern bespreken."): 9, +3 bij besproken. Concurrent: 6, +3 bij drie of meer signalen. Status quo: 5, +3 bij een hot trigger. Risico: 4, +2 bij hot prospect, +2 boven €10.000. Budget: 4, +3 boven €20.000. De checklist begint met extra punten bij een verlopen offerte, een offerte die twee keer of vaker gelezen is, of een at-risk account. Het doel per status: concept "Verfijn de offerte …", verstuurd "Bevestig dat de offerte is aangekomen … binnen 5 werkdagen", gelezen "Neem nu zelf het initiatief …", besproken "Maak commitments concreet …", goedgekeurd "Verzilver direct …", verloren "Bel toch na …".

### Weergavehiërarchie en opslag van eigen tekst

Per blok wint de eigen tekst van de AI-tekst, en de AI-tekst van de berekende tekst. Een eigen tekst wordt per veldsleutel op het account bewaard (bijvoorbeeld "bpo-pijn" of "pagina-doel"), niet per gesprek. Wie voor het gesprek van dinsdag het pijnpunt herschrijft, ziet die tekst ook bij het gesprek van volgende maand terug, tot hij op "herstel berekende tekst" klikt. Bewaar je een tekst die gelijk is aan de berekende of AI-tekst, dan wordt niets bewaard, zodat het blok de gegevens blijft volgen.

### De AI-laag

Er bestaat een AI-versie per soort (plus "volledig" voor de pagina), geschreven door Claude met de volledige accounthistorie als context, bewaard op het account met een vingerafdruk van de gegevens. De knop "Schrijf met AI" is op 6 augustus 2026 bewust weggehaald; het endpoint bestaat nog, maar niets in de app roept het aan. Al geschreven AI-versies blijven zichtbaar met hun label en datum.

### Inconsistenties tussen ingangen

- Vandaag geeft een oude waarde (klant of prospect) als soort door; de flyout zet die om naar BPO. Elke briefing vanaf Vandaag opent daardoor als "Behoefte-probleem-oplossing", ook als /briefings voor hetzelfde gesprek "Offerte" of "1e gesprek" toont.
- De gespreksanalyse wordt alleen bewaard als er een echte AI-koppeling is. In de mockomgeving telt "Alleen met gespreksverslag" daarom 0 en vult geen BPO-briefing zich.

### Gespreksvoorbereiding naast de briefing

DealDrive heeft drie lagen van voorbereiding die naast elkaar bestaan:

- De briefing: regelgebaseerd, gratis, altijd aanwezig, per account en soort.
- De Pitstop: de AI-agent op een afspraak of taak schrijft op verzoek een concept (bezoek-briefing, meeting-briefing, demo-briefing of belscript) dat je goedkeurt. Vraagt database en pakket Plus of Compleet (zie Bezoeken).
- De verslaganalyse: na het gesprek de grondstof voor de volgende BPO-briefing en voor de bezwaren op de volledige pagina.

## Gegevens

Een briefing heeft geen eigen record. Wat er wel bewaard wordt, staat op het account:

- eigen teksten (briefingTeksten): een lijst van veldsleutel naar tekst; wissen van één blok betekent de hele lijst opnieuw zetten zonder dat blok;
- AI-versies (briefingAi): per soort de blokteksten (blokken), de vingerafdruk van de context (contextHash), het model en de datum (gemaaktOp).

Gelezen gegevens:

- afspraak en taak: titel, begintijd of vervaldatum, status, account, en het verslag (verslag) met de bewaarde analyse (verslagAnalyse: sentiment, samenvatting, onderwerpen, actiepunten, koopsignalen, bezwaren, opvolging, tekst-hash, model, datum);
- account: naam, juridische naam, branche, plaats, segment, klasse (accountfase), functie, tier, contractwaarde, trigger, laatste actie;
- contactpersoon: naam, functie, rol (beslisser, champion), beslisser-vlag, jaren in de rol;
- offerte: titel, referentie, status, bedrag, verzonden, gelezen (aantal en laatst), geldig tot, besluitdatum;
- signalen en communicatierecords van het account.

Er is een veld briefingId op de afspraak, maar de briefings in dit hoofdstuk gebruiken het niet. Alles leeft in de accounttabel via de gewone synchronisatie; er is geen aparte briefingtabel.

## Wat dit betekent voor Dealtrace

- Overnemen: "een briefing maak je niet aan, hij verschijnt" en de vaste volgorde handmatig, AI, sjabloon per blok. Dat is voorspelbaar, gratis en eerlijk over herkomst.
- Overnemen: de BPO-briefing die zich vult met het verslag van het vorige gesprek. Voor new business is dat de kern: het eerste gesprek levert het pijnpunt, het tweede toetst het.
- Anders: bepaal de soort niet alleen op titelwoorden. Gebruik het afspraaktype, de dealfase en de prospectstatus, en laat de verkoper de soort per gesprek vastzetten.
- Anders: bewaar eigen teksten per gesprek (afspraak of taak), niet per account, met de vorige versie als startpunt. Een pijnpunt van maart hoort niet stil in de briefing van oktober te staan.
- Anders: één briefing, één soortbepaling, op elke ingang. Nu geeft Vandaag een andere soort dan /briefings en kent de volledige pagina helemaal geen soort.
- Anders voor new business: een echte "1e gesprek"-briefing voor koude prospects, gevuld met bedrijfsgegevens, triggers en de vraag waarom nu, en een belscript-variant voor de binnendienst naast een bezoekvariant voor de buitendienst.
- Repareren: achterstallige taken krijgen nu geen briefing, en intern overleg en niet-verschenen afspraken tellen als contactmoment. Beide vertekenen de soort.
- Ontbreekt: een moment ná het gesprek in de briefing zelf (doel gehaald of niet, volgende stap), zodat de briefing ook de terugkoppeling stuurt in plaats van alleen de voorbereiding.
