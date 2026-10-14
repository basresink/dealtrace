# Facturen

## Wat het is en waarvoor

Facturen is in DealDrive HQ bedoeld als de plek waar de founder per klantorganisatie ziet wat er openstaat, wat betaald is en wat nog geïncasseerd moet worden. De subtitel op het scherm zegt het zelf: "Komt tot leven met de betaalkoppeling (Stripe of Mollie)." Die koppeling bestaat niet. Er staat geen regel betaalcode in de repository, er is geen factuurtabel in de database en er is geen endpoint dat facturen maakt, ophaalt of verstuurt.

Wat de pagina vandaag doet, is drie dingen eerlijk laten zien:

- Een lege staat "Nog geen facturen" met de verwijzing naar Abonnementen, waar je tot die tijd pakketten en contracten beheert.
- De werkelijke contractstand van alle klanten in één zin, bijvoorbeeld "5 klanten: 2 pilot · 2 actief · 1 opgezegd.". Die komt uit dezelfde klantenlijst als Klanten en Abonnementen.
- Een gedimde, gearceerde voorbeeldtabel met het label "Voorbeeld", die het ontwerp van een toekomstige factuur vastlegt. De belangrijkste beslissing daarin is de kolom "AI-meerwerk": koopt een klant AI-handelingen bij boven zijn bundel, dan komt dat op dezelfde factuur als het abonnement, en niet op een aparte rekening.

Voor de founder is de pagina daarmee vooral een herinnering en een ontwerpbesluit, geen werkinstrument. Het werkelijke geldbeeld (wat een klant per maand betaalt volgens contract) staat op Abonnementen en op Klanten. De pagina leest alleen; ze schrijft niets.

Samenhang met andere schermen:

- Leest GET /api/superuser/organisations, dezelfde lijst als Klanten en Abonnementen, en gebruikt daarvan alleen de contractstatus per klant.
- Verwijst naar Abonnementen voor pakketten en contracten.
- De kolom "AI-meerwerk" in het voorbeeld hoort bij de AI-bundel en het maandplafond per klant, die in de klantflyout op Klanten staan (blok "AI-kosten") en bij de klant op /instellingen/verbruik.

![Facturen in de mock: lege staat en de gelabelde voorbeeldtabel](shots/facturen-1-pagina-mock.png)

## Waar je het vindt

In de linker zijbalk van HQ, groep "Geld", tweede item "Facturen", met een bonnetje-icoon. De route is /admin/facturen en de paginatitel in het tabblad is "Facturen · DealDrive HQ".

Alleen de rol superuser (de founder) ziet de pagina. De routebewaker stuurt andere rollen weg van alles onder /admin en het endpoint dat de pagina leest geeft zonder superuser-rol 403 "Alleen voor superusers.". HQ is een aparte uitrol met een eigen domein, een eigen databaserol en een vaste lijst toegestane API-paden; de /api/superuser-endpoints bestaan in de klantapp niet (404).

Er linkt geen ander scherm naar Facturen. Je komt er alleen via de zijbalk. Andersom linkt Facturen naar Abonnementen.

![De groep Geld in de zijbalk met Facturen actief](shots/facturen-4-menu-geld.png)

## Opbouw van de pagina

### Kop

Kicker "DEALDRIVE HQ · GELD · FACTUREN" met een geel streepje ervoor, titel "Facturatie." en subtitel "Wat er per organisatie openstaat, betaald is en geïncasseerd moet worden. Komt tot leven met de betaalkoppeling (Stripe of Mollie)." Er zijn geen knoppen rechtsboven en geen statkaarten.

### Blok "Zo staat het nu"

Een wit blok met rechts in de kop de grijze tekst "geen betaalkoppeling". Daarin een kader met een gestippelde rand:

- Titel "Nog geen facturen".
- Tekst "Er is nog geen betaalkoppeling; facturen verschijnen hier zodra Stripe of Mollie gekoppeld is. Tot die tijd beheer je pakketten en contracten op Abonnementen." Het woord "Abonnementen" is een link naar /admin/abonnementen.
- Een grijze regel met de contractstand, maar alleen als er een database is en minstens één klant: "{n} klanten: {a} pilot · {b} actief · {c} opgezegd." (bij één klant "1 klant: …"). In de mock zonder database ontbreekt deze regel.

Er staat bewust geen knop in dit blok. Het handboek vermeldt dat de knop "Betaalkoppeling instellen" is weggehaald omdat hij nooit iets kon doen, en een tweede knop deed hetzelfde als de link in de zin.

![De lege staat met de contractstand van vijf fictieve klanten](shots/facturen-3-contractstand.png)

### Blok "Zo ziet het eruit zodra het loopt"

Een blok met een licht gearceerde achtergrond en een gedimde tabel (80 procent dekking), zodat niemand het voor echte facturen aanziet. In de kop staan de titel, een geel label "VOORBEELD" en rechts "voorbeeld ter illustratie, geen echte facturen".

De tabel heeft zeven kolommen. Hieronder de eerste vijf met de drie voorbeeldrijen; de kolommen "TOTAAL" en "STATUS" volgen daarna.

| Factuur | Organisatie | Periode | Abonnement | AI-meerwerk |
|---|---|---|---|---|
| 2026-08-001 | Voorbeeldklant A | aug | € 1.800,00 | € 45,00 |
| 2026-08-002 | Voorbeeldklant B | aug | € 720,00 | € 0,00 |
| 2026-08-003 | Voorbeeldklant C | aug | € 150,00 | € 0,00 |

| Factuur | Totaal | Status |
|---|---|---|
| 2026-08-001 | € 1.845,00 | "betaald" (groen) |
| 2026-08-002 | € 720,00 | "verstuurd" (blauw) |
| 2026-08-003 | € 150,00 | "open" (oranje) met grijs "14 dagen" ernaast |

Onderaan de somrij "Samen": abonnement € 2.670,00, AI-meerwerk € 45,00, totaal € 2.715,00.

Wat het voorbeeld vastlegt:

- Factuurnummer in de vorm jaar-maand-volgnummer (2026-08-001).
- Eén factuur per organisatie per periode, met het abonnement en het AI-meerwerk als aparte bedragen en een totaal.
- Drie statussen: "betaald", "verstuurd" en "open". Bij "open" staat de looptijd naast het label en niet erin: de code zegt "'open' is de stand, '14 dagen' hoe lang al".
- Bedragen met centen en een euroteken, rechts uitgelijnd.

Alle getallen en namen in deze tabel staan vast in de paginacode. Er worden geen echte organisatienamen gebruikt, met opzet.

![De voorbeeldtabel met de kolom AI-meerwerk en de slotnoot](shots/facturen-2-voorbeeldtabel.png)

### Slotnoot

Onder het voorbeeld staat een kader met een gele rand links: "De kolom AI-meerwerk is de ontwerpbeslissing die dit voorbeeld vastlegt. Koopt een klant boven zijn bundel bij, dan hoort dat op dezelfde factuur en niet in een apart potje. Twee administraties naast elkaar levert een gesprek per factuur op."

## Doorklikken: de stappen

Er zijn op deze pagina maar twee handelingen mogelijk, omdat er nog geen facturatie is.

### De contractstand bekijken

1. Klik in de zijbalk op "Facturen".
2. De pagina haalt de klantenlijst op. Lukt dat en is er minstens één klant, dan verschijnt onder de lege staat de regel met het aantal klanten per contractstatus.
3. Lukt het ophalen niet, dan gebeurt er zichtbaar niets: de fout wordt stil opgevangen en de lege staat blijft staan zonder contractregel.

### Naar Abonnementen voor pakketten en contracten

1. Klik in de tekst van de lege staat op "Abonnementen".
2. Je komt op /admin/abonnementen, waar je per klant het pakket kiest en de maandbedragen van actieve contracten ziet.
3. Om een contract of maandbedrag te wijzigen ga je daarvandaan naar Klanten, klik je "Openen" bij de klant en vul je het blok "Contract en abonnement" in (status, prijs per maand, startdatum, looptijd, opzegtermijn, notitie).

## Flyouts, vensters en knoppen

Facturen heeft geen flyouts, geen vensters, geen formulieren, geen knoppen en geen meldingen. Het enige klikbare element is de link "Abonnementen" in de lege staat (en de zijbalk). Er is niets te bevestigen of te sluiten, en Escape doet niets.

## Filters, zoeken, sorteren en weergaven

Er zijn geen filters, geen zoekveld, geen sortering en geen weergavekeuzes, en niets komt in de URL. De enige teller is de contractregel: per status telt de pagina het aantal klanten in de lijst met precies die status. Omdat de server een ontbrekende of ongeldige status als "pilot" leest, tellen de drie getallen altijd op tot het totaal.

## Regels en berekeningen

### Wat er in de code zit

- De pagina roept één endpoint aan: GET /api/superuser/organisations. Ze gebruikt daarvan alleen per klant contract.status en of totalen gevuld is.
- De contractregel verschijnt alleen als totalen niet leeg is (dus een database bestaat) en er minstens één klant is. Zonder database geeft het endpoint een lege lijst met totalen null terug.
- Een fout bij het ophalen wordt zonder melding opgevangen; de code noemt dat bewust: "zonder lijst geen stand; de lege staat blijft kloppen". Abonnementen toont in hetzelfde geval wel een rode foutstrook.
- De voorbeeldtabel is vaste tekst in de pagina. Er wordt niets in uitgerekend.

### Wat er niet in de code zit

- Geen betaalkoppeling. De pagina noemt Stripe en Mollie; Moneybird komt nergens in de code of documentatie voor. Er is geen pakket voor een betaaldienst geïnstalleerd en er zijn geen webhooks, geen klant-id's bij een betaaldienst en geen geheime sleutels voor betalingen.
- Geen factuurtabel, geen factuurnummering, geen btw-berekening, geen pdf, geen verzending per mail, geen herinneringen en geen incasso.
- Geen koppeling tussen contract en factuur: het maandbedrag op het contract (prijsPerMaandCent) wordt nergens omgezet in een factuurregel.
- Geen berekening van AI-meerwerk. De AI-bundel en het verbruik in handelingen bestaan wel (zie hieronder), maar er is geen prijs per handeling en geen aankoopstroom voor extra tegoed. Het handboek zegt bij het verbruiksscherm: "Wat er nog niet is: een melding bij 80 procent en een aankoopstroom voor extra tegoed." en adviseert bijkopen als een losse aankoop die minstens een kwartaal geldig blijft, geen verhoging van het abonnement.

### De bouwstenen die al bestaan

Een toekomstige factuur kan leunen op gegevens die er nu al zijn:

- Het contract per klant: status, startdatum, looptijd, prijs per maand in centen en opzegtermijn. Alleen status "actief" telt als omzet (maandOmzetCent in server/utils/klantstatus.ts), dezelfde regel als op Klanten en Abonnementen.
- Het pakket per klant (Starter, Plus, Compleet).
- De AI-bundel per klant in handelingen, met een standaard per pakket (bij Plus en Compleet onder meer 8.000 accountbeoordelingen, 1.500 Pitstop-concepten en 2.000 vragen aan de assistent per maand; Compleet ook 3.000 webonderzoeken; Starter overal nul) en het werkelijke verbruik per soort handeling, gemeten uit het logboek van AI-aanroepen. Verbruik boven de bundel is precies wat in het voorbeeld "AI-meerwerk" heet.
- De AI-kostprijs per klant in dollars, die op Klanten staat ("AI-kostprijs"). De code houdt kostprijs (dollars, voor HQ) en klantbedragen (euro's) bewust gescheiden; op Klanten ontbreekt daarom ook een margegrens.

### Plannen in de documentatie

- De roadmap noemt de "Stripe/Mollie-koppeling" met een rode prioriteitsmarkering: "Brengt de admin-tabs Abonnementen en Facturen tot leven. Nu zet HQ het pakket per organisatie handmatig via een keuzelijst; er staat nog geen regel betaalcode in de repo."
- De roadmap noemt ook het splitsen van de rol superuser in een founder en een verhoogde beheerder, juist omdat een supportmedewerker klanten moet kunnen helpen "maar niet bij facturatie hoort te kunnen".
- Een ouder ontwerpdocument (docs/Feature-Aanvullingen-2026Q3.md) beschrijft een abonnements- en factuurmodel met Stripe Checkout, Stripe Billing, Stripe Tax en het Stripe-klantportaal, een proefperiode van drie dagen en factuurstatussen concept, open, betaald en oninbaar. Dat ontwerp gebruikt andere pakketnamen (starter, pro, team, enterprise) dan de huidige code en is niet gebouwd.

### Mock tegenover productie

In de mock is er geen database. De pagina ziet er dan uit als op de eerste schermafbeelding: de lege staat zonder contractregel en het voorbeeld. In productie is het verschil alleen de contractregel. Voor de schermafbeelding met de contractregel zijn vijf fictieve klanten alleen in de browser ingevoegd als antwoord op het ophalen van de klantenlijst, omdat de mock geen organisaties kan opslaan. Er is niets aangeroepen bij een betaaldienst; er bestaat ook niets om aan te roepen.

### Verschillen tussen handboek en code

- Het handboek geeft als voorbeeld van de contractregel "4 klanten: 3 pilot · 1 actief · 0 opgezegd." en dat klopt met de code.
- Het voorbeeld in de pagina gebruikt maandbedragen van € 1.800, € 720 en € 150. Die passen niet op de voorgestelde richtprijzen uit het handboek (€ 50, € 90 en € 150 per gebruiker per maand); het zijn illustratiebedragen, geen afgeleide prijzen.

## Gegevens

Facturen heeft geen eigen gegevens. Er is geen record "factuur" en niets wordt opgeslagen. De pagina gebruikt per klant uit de klantenlijst alleen de contractstatus (contract.status: pilot, actief of opgezegd), opgeslagen in de JSON-kolom data van de rij in de tabel organisations, plus het veld totalen van het antwoord om te weten of er een database is.

Het voorbeeld legt wel vast welke velden een factuur straks moet hebben: factuurnummer, organisatie, periode, abonnementsbedrag, AI-meerwerk, totaal en status (betaald, verstuurd of open, met het aantal dagen dat hij openstaat).

Wat van andere features komt of zou moeten komen: het contract en het pakket (Klanten en Abonnementen), de AI-bundel en het verbruik in handelingen (org_settings, sleutel aiBundel, en het logboek van AI-aanroepen) en de AI-kostprijs per klant.

## Wat dit betekent voor Dealtrace

- Overnemen: de eerlijke lege staat. Geen knop die niets doet, wel de werkelijke contractstand in één zin en een duidelijk gelabeld voorbeeld van het factuurontwerp.
- Overnemen: het besluit om meerverbruik op dezelfde factuur te zetten als het abonnement. Bij een new business-tool is meerverbruik waarschijnlijker dan bij DealDrive: dataverrijking, webonderzoek en berichtgeneratie schalen met het aantal prospects, niet met het aantal gebruikers.
- Anders doen: bouw de factuurregel uit dezelfde bron als het contract. Leg prijs per pakket, aantal betaalde gebruikers en prijs per extra handeling vast als gegevens, en laat de factuur daaruit rekenen in plaats van een vrij maandbedrag.
- Anders doen: kies vroeg tussen een betaaldienst die zelf factureert (Stripe Billing, Mollie) en een boekhoudpakket dat factureert (bijvoorbeeld Moneybird), en koppel er maar één. Twee administraties naast elkaar is precies wat de slotnoot wil voorkomen.
- Toevoegen: per klant de kostprijs (AI-tokens, verrijkingscredits, webzoekopdrachten) naast het gefactureerde bedrag, met een marge per klant en een signaal als die onder een drempel zakt. In DealDrive staan kostprijs en omzet nog op verschillende plekken en in verschillende valuta.
- Toevoegen: btw-behandeling (21 procent, verlegd voor zakelijke klanten binnen de EU), betaaltermijn, herinneringen en een status "achterstallig" die terugkoppelt naar het pakket, bijvoorbeeld AI-werk pauzeren bij een factuur die lang openstaat.
- Toevoegen voor AVG: een verwerkersovereenkomst en de afspraken over databronnen per klant als onderdeel van het contract dat de factuur draagt, zodat zichtbaar is welke verrijking een klant contractueel mag gebruiken.
- Ontbreekt: wie bij facturen mag. Splits de rol founder van een supportrol, zodat support klanten kan helpen zonder bij bedragen en facturen te kunnen.
