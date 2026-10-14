# Klanten

## Wat het is en waarvoor

Klanten is het startscherm van DealDrive HQ en het enige scherm onder de menugroep "Portfolio". Het is het klantenbestand van de founder: elke klantorganisatie die DealDrive gebruikt staat er als één rij, met wat hij afneemt, of hij de app echt gebruikt en wat hij aan AI kost. De ondertitel op het scherm zegt het zelf: "Alles wat je over een organisatie moet weten voordat je hem opent: wat hij afneemt, of hij leeft, en wat hij je kost."

Het scherm lost twee problemen op. Het eerste is administratief: een nieuwe klant moet ergens ontstaan, met een werkende basisinrichting en een eerste beheerder die kan inloggen. Het tweede is commercieel: een klant die opzegt, is meestal al maanden gestopt met werken in de app. Daarom staat er per klant een oordeel ("Gezond", "Let op", "Risico" of "Leeg") met de reden erbij, en een apart blok "Wat vraagt aandacht" met klanten die stil vallen of in hun opzegtermijn zitten. De code noemt dit zelf het verschil tussen administreren en aansturen.

Je gebruikt het scherm in vier situaties:

- Je hebt een deal gesloten en wilt de klant aanmaken, met starterspakket en eerste beheerder.
- Je doet je wekelijkse ronde langs het klantenbestand: wie is stil, wie zit in de opzegtermijn, wat kost de AI deze maand.
- Een beheerder bij een klant heeft een nieuwe gebruiker aangevraagd en jij moet goedkeuren of afwijzen.
- Je wilt in de app van een klant meekijken of hem helpen; dan stap je in met de knop "Instappen".

Samenhang met de klantapp en andere HQ-schermen:

- Leest uit de klantdatabase per organisatie: gebruikers, accounts, taken, inzichten (signals) en motorruns (rule_runs). Daar komen het oordeel en de kolommen "Gebr." en "Laatst actief" vandaan.
- Leest het AI-kostenlogboek (agent_runs) voor de kolom "AI-kosten" en het blok AI-kosten in de flyout. Dat is dezelfde prijslogica als het kostenscherm in de klantapp.
- Leest de gebruikersaanvragen die beheerders in de klantapp indienen op hun instellingenpagina (tabblad gebruikers). Goedkeuren maakt de gebruiker aan in de klantapp en het loginaccount in Supabase Auth.
- Schrijft naar de organisatierij: contract, contactgegevens en feature-vlaggen. Het pakket toont het scherm alleen; dat wijzig je op Abonnementen (menugroep Geld, item Abonnementen), dat dezelfde waarde leest.
- In de flyout van een klant staan ook de LLM-connector en de agent-prompts van die ene klant. De platformkant daarvan staat op LLM-connector en Agent-prompts onder de menugroep "AI"; die schermen hebben een eigen hoofdstuk.
- "Instappen" stuurt je naar de klantapp, in de organisatie van die klant. Hoe die overdracht technisch werkt (ondertekend kaartje, cookie op het app-domein, audit), staat in hoofdstuk 07, toegang en schil.

## Waar je het vindt

- Menu: zijbalk links, groep "Portfolio", item "Klanten" (icoon van een gebouw). Het logo "DealDrive HQ" linksboven linkt ook naar dit scherm.
- Route: /admin. De paginatitel in de browser is "Klanten · DealDrive HQ".
- Wie het ziet: alleen de rol superuser (in de zijbalk onderaan getoond als "Founder"). De routebewaking in de app (middleware auth.global.ts) weigert /admin voor elke andere rol, en elk server-endpoint onder /api/superuser controleert de rol opnieuw en geeft anders 403 "Alleen voor superusers.".
- HQ is een aparte build van dezelfde code (DEALDRIVE_APP=hq) op een eigen domein, met alleen de routes onder /admin plus /login en /wachtwoord-instellen. Op HQ is de hoofdroute een doorverwijzing naar /admin, dus na inloggen kom je hier.
- Badge: zodra dit scherm geladen is, staat achter "Klanten" in de zijbalk een geel getal met het aantal aandachtsignalen (titel bij hover "1 aandachtsignaal" of "3 aandachtsignalen"). Het getal wordt alleen op dit scherm berekend. Open je HQ direct op een ander scherm, dan staat er nog geen badge tot je Klanten één keer hebt bezocht.
- Vanuit andere schermen: de flyout van een klant linkt naar Abonnementen ("Wijzig op Abonnementen"). Andersom is er geen directe link vanaf andere schermen naar de flyout van een bepaalde klant.

![De lege staat in de mock: zonder database toont het scherm alleen de kop, de knop Nieuwe klant en een uitleg.](shots/klanten-1-leeg.png)

## Opbouw van de pagina

### Kop

- Kicker: "DealDrive HQ · Klanten" (met een geel streepje ervoor).
- Titel: "Je klantenbestand."
- Ondertitel: "Alles wat je over een organisatie moet weten voordat je hem opent: wat hij afneemt, of hij leeft, en wat hij je kost."
- Er staan geen knoppen rechtsboven in de kop. De enige actieknop, "Nieuwe klant", staat in de kop van het blok Klanten.

### Meetlat (statkaarten)

Onder de ondertitel staat een rij van vier of vijf tegels. De rij verschijnt alleen als de server totalen meestuurt; zonder database (zoals in de mock) ontbreekt hij helemaal.

| Tegel | Groot getal | Onderschrift | Bron |
|---|---|---|---|
| "Klanten" | aantal organisaties | "2 gezond · 1 let op · 1 risico · 1 leeg" | totalen uit het organisaties-endpoint |
| "Gebruikers" | som van alle gebruikers | "16 met een login" | opgeteld in de browser uit de rijen |
| "Maandomzet" | euro's zonder decimalen | "uit actieve contracten" | som van prijs per maand van contracten met status Actief |
| "AI-kostprijs" | dollars | "deze maand, in dollars" | AI-kostenlogboek, lopende maand |
| "Aandacht" | aantal signalen, oranje als het meer dan nul is | "niets dat aandacht vraagt", "signaal onder de tabel" of "signalen onder de tabel" | berekend in de browser |

Het deel "1 leeg" in het onderschrift van Klanten verschijnt alleen als er organisaties zonder gebruikers zijn; zo telt het onderschrift altijd op tot het getal erboven. De tegel "AI-kostprijs" verschijnt pas als het kostenendpoint geantwoord heeft en er een totaal is. Staat er een sterretje achter het bedrag, dan zit er een geschat tarief in (hovertekst: "Bevat een geschat tarief: model niet in de prijstabel of niet vastgelegd.").

### Blok Klanten

De kop van het blok bevat, van links naar rechts: de titel "Klanten", een zoekveld met placeholder "Zoek op naam of pakket", de grijze tekst "gesorteerd op laatste activiteit" en de knop "Nieuwe klant". Zoekveld en sorteertekst verschijnen alleen als er minstens één organisatie is.

Klik je "Nieuwe klant", dan klapt direct onder de kop het aanmaakformulier open en heet de knop "Annuleren" (zie Flyouts, vensters en knoppen). Na een geslaagde aanmaak staat op dezelfde plek een geel resultaatblok.

Daaronder de tabel, één rij per organisatie:

| Kolom | Inhoud | Waar het vandaan komt |
|---|---|---|
| "Klant" | naam van de organisatie | organisations.data.name |
| "Pakket" | "Starter", "Plus" of "Compleet" | organisations.data.pakket, standaard Starter |
| "Gebr." | met login / totaal, bijvoorbeeld "8/9" | telling op de gebruikerstabel van die organisatie |
| "Laatst actief" | "vandaag actief", "gisteren actief", "19 dagen stil" of "nooit actief" | laatste wijziging van een taak (max van tasks.updated_at) |
| "AI-kosten" | dollars deze maand, of een streepje | agent_runs van de lopende Nederlandse kalendermaand |
| "Stand" | gekleurd label "Gezond", "Let op", "Risico" of "Leeg" | regels in server/utils/klantstatus.ts |
| (geen kop) | knoppen "Openen" en "Instappen" | |

Bij hover over het label in "Stand" zie je de redenen achter het oordeel, achter elkaar. Onder de rijen staat een somrij "Samen" met de totale "Gebr." en de totale AI-kosten. Die somrij verdwijnt zodra je iets in het zoekveld typt, omdat hij bij het geheel hoort.

Onder de tabel staat een gele notitie: "Instappen is geen inloggen als iemand anders. Elke impersonatie wordt geauditeerd en de klant kan het terugzien. Daarom staat de knop hier open en bloot: wie hem gebruikt, hoort te weten dat het zichtbaar is." De notitie verschijnt alleen als er organisaties zijn.

![Het klantenbestand gevuld met vijf fictieve klanten: meetlat, zoekveld, tabel met oordelen en de somrij.](shots/klanten-4-klantenlijst.png)

### Lege staten en fouten van de tabel

- Ophalen mislukt (fout van de server of geen netwerk): "De klantenlijst kon niet worden opgehaald: " gevolgd door de foutmelding, met de link "Opnieuw proberen".
- Database actief maar nog geen organisaties: "Nog geen klanten."
- Geen database op deze omgeving: "Geen database actief op deze omgeving, dus geen klanten te tonen." Dit is wat de mock toont.
- Zoekterm zonder resultaat: "Geen klant of pakket gevonden voor deze zoekterm." met de link "Wis de zoekterm".

### Blok Wat vraagt aandacht

Staat onder de tabel, op een iets donkerdere band, en verschijnt alleen als er minstens één signaal is. Kop: "Wat vraagt aandacht", rechts "uit activiteit en contracten". Elk signaal is een kaart met een gekleurde streep links (oranje of rood), een vetgedrukte titel, een toelichting en een knop "Openen" die de flyout van die klant opent. De drie soorten signalen staan bij Regels en berekeningen.

### Blok gebruikersaanvragen

Staat onderaan en verschijnt altijd zodra er een database is, ook als er niets te beoordelen valt. Zo is duidelijk dat dit de wachtrij is, en dat "geen aanvragen" iets anders is dan "werkt niet". Zonder database (de mock) ontbreekt het blok.

- Kop: "2 gebruikersaanvragen te beoordelen" (enkelvoud "gebruikersaanvraag" bij één), rechts "goedkeuren maakt de gebruiker aan en nodigt hem uit".
- Lege staat: "Geen open aanvragen. Zodra een klantbeheerder op zijn instellingen-pagina een gebruiker aanvraagt, verschijnt die hier."
- Per open aanvraag een rij met de naam, daaronder e-mailadres en rol ("Accountmanager", "Salesmanager" of "Beheerder"), daaronder de organisatie, wie hem aanvroeg en de datum ("Voorbeeld Installatietechniek BV · aangevraagd door Anna de Proef op 13 okt"). Rechts de knoppen "Goedkeuren + uitnodigen" en "Afwijzen".
- Onder de open aanvragen een inklapbaar onderdeel "2 afgehandeld" met de tien meest recente afgehandelde aanvragen en een label "Goedgekeurd" (groen) of "Afgewezen" (rood).

![Aandachtsignalen en gebruikersaanvragen met fictieve gegevens, met het afgehandelde deel opengeklapt.](shots/klanten-5-signalen-aanvragen.png)

## Doorklikken: de stappen

### Een nieuwe klant aanmaken

1. Klik "Nieuwe klant" in de kop van het blok Klanten. Het formulier klapt open; de knop heet nu "Annuleren".
2. Vul "Organisatienaam" in (verplicht) en kies een "Pakket" (standaard Starter).
3. Vul optioneel de contactgegevens en de eerste beheerder in (naam en e-mailadres).
4. Klik "Aanmaken". De knop toont "Bezig…". De server maakt de organisatie aan met het starterspakket en, als je beide beheerdervelden invulde, de beheerder met rol Beheerder plus een loginaccount.
5. Het formulier sluit en leegt zich, de tabel ververst, en er verschijnt een geel resultaatblok: "Demo Klimaattechniek BV is aangemaakt met het starterspakket." Met uitnodigingslink of melding dat de mail verstuurd is.
6. Klik "Openen" in het resultaatblok om meteen de flyout van de nieuwe klant te openen, of "Sluiten" om het blok weg te halen.

### Een klant beoordelen en openen

1. Kijk naar de meetlat en het badge in de zijbalk: hoeveel signalen zijn er.
2. Scan de tabel: de bovenste rijen zijn het meest recent actief, de stille klanten zakken naar onderen.
3. Hover over het label in "Stand" voor de redenen, of scroll naar "Wat vraagt aandacht".
4. Klik "Openen" in de rij of op de signaalkaart. De brede flyout schuift van rechts in en de klantenlijst wordt op de achtergrond opnieuw opgehaald, zodat bijvoorbeeld een pakketwijziging van Abonnementen meteen klopt.
5. Lees onderaan de flyout het blok "Gebruik" voor het oordeel met alle redenen en de cijfers.

### Een gebruikersaanvraag afhandelen

1. Scroll naar het blok gebruikersaanvragen.
2. Klik "Goedkeuren + uitnodigen" of "Afwijzen". Beide knoppen van die rij worden uitgeschakeld en de goedkeurknop toont "Bezig…".
3. Bij goedkeuren maakt de server de gebruiker aan in de organisatie van de aanvraag, maakt het loginaccount en stuurt de uitnodiging (of geeft de link terug). Bij afwijzen wordt alleen de status van de aanvraag gewijzigd.
4. Onder de lijst verschijnt een resultaatblok "Aanvraag voor sanne@…: goedgekeurd" met eventueel de uitnodigingslink, en de aanvragenlijst en de klantenlijst worden opnieuw geladen. De aanvraag schuift naar "afgehandeld".
5. Mislukt het, dan staat de foutmelding in rood onder de rij van die aanvraag, bijvoorbeeld "Dit e-mailadres is al in gebruik in deze organisatie."

### Een gebruiker toevoegen of beheren bij een klant

1. Klik "Openen" bij de klant en scroll in de flyout naar "Gebruikers".
2. Onderaan het blok, bij "Gebruiker toevoegen", vul je naam, e-mailadres en rol in en klik je "Toevoegen". De gebruiker en zijn loginaccount ontstaan meteen; er verschijnt een uitnodigingsblok.
3. Om een rol te wijzigen, kies je een andere waarde in de keuzelijst in de rij. Dat wordt direct opgeslagen.
4. Om naam, functie, e-mailadres, telefoon of werkplek te wijzigen, klik je "Bewerk", pas je de velden aan en klik je "Opslaan".
5. Kan iemand niet inloggen of is zijn link verlopen, klik dan "Login aanmaken" of "Nieuwe link".
6. Gaat iemand weg, klik "Archiveer" (omkeerbaar) of, in het bewerkformulier, "Verwijder" (definitief, met bevestiging).

### Instappen bij een klant

1. Klik "Instappen" in de rij van de klant. Alle Instappen-knoppen worden uitgeschakeld zolang het verzoek loopt.
2. HQ vraagt een overdrachtsadres aan en de browser gaat naar de klantapp, die je in de organisatie van die klant zet. Je werkt daarna in de gewone klantapp; uitstappen doe je ook daar, niet in HQ.
3. Mislukt het aanvragen, dan staat de fout in rood onder de tabel, bijvoorbeeld "Overdracht niet geconfigureerd: IMPERSONATIE_SECRET en APP_BASE_URL ontbreken." HQ toont niet bij welke klant je nu ingestapt bent: die cookie staat op het domein van de klantapp en HQ kan hem niet lezen.

Voor het inloggen op de klantapp, het kaartje en de controle aan de app-kant: zie hoofdstuk 07, toegang en schil.

## Flyouts, vensters en knoppen

### Formulier Nieuwe klant

Opent met "Nieuwe klant" en sluit met "Annuleren" (dezelfde knop). Annuleren gooit alle ingevulde velden en een eerdere foutmelding weg. Elk veld heeft een label erboven.

| Veld | Verplicht | Standaard of placeholder | Validatie |
|---|---|---|---|
| "Organisatienaam" | ja | "bv. Bouwmaat Nederland" | minstens 2 tekens, anders "Organisatienaam is verplicht." |
| "Pakket" | ja | Starter | Starter, Plus of Compleet; onbekend wordt Starter |
| "Contactpersoon" | nee | leeg | |
| "E-mailadres" (contact) | nee | "naam@bedrijf.nl" | browsercontrole op e-mailvorm |
| "Telefoonnummer" | nee | "0612345678" | |
| "Straatnaam en huisnummer" | nee | "Voorbeeldstraat 1" | |
| "Postcode" | nee | "1234 AB" | |
| "Plaats" | nee | "Amsterdam" | |
| "Naam" (beheerder) | nee | leeg | |
| "E-mailadres" (beheerder) | nee | "naam@bedrijf.nl" | moet op een e-mailadres lijken, anders "Beheerder-e-mailadres is ongeldig." |

De contactvelden staan in een grijs kader "Contactgegevens (optioneel)", de beheerdervelden in een kader "Eerste beheerder (optioneel)". Onder de knop "Aanmaken" staat de uitleg: "Start met het starterspakket: accountklassen A-D, customer journey met overgangen en tien werkende activity-regels (incl. Web: vacatures en Web: nieuws). Vul je een beheerder in, dan krijgt die meteen een uitnodiging, of een link die je zelf stuurt. Logins beheer je daarna in de organisatie onder Gebruikers."

Een beheerder ontstaat alleen als zowel naam als e-mailadres zijn ingevuld. Vul je alleen het e-mailadres in, dan wordt het wel gecontroleerd maar komt er geen beheerder. Een fout staat in rood naast de knop "Aanmaken".

![Het formulier Nieuwe klant ingevuld met fictieve gegevens; in de mock eindigt Aanmaken met de melding dat het zonder database niet kan.](shots/klanten-2-nieuwe-klant.png)

### Resultaatblok na Aanmaken

Een geel kader direct onder de blokkop. Inhoud:

- "[naam] is aangemaakt met het starterspakket."
- Als er iets misging met het loginaccount: een notitie, bijvoorbeeld "Geen loginaccount aangemaakt: SUPABASE_SERVICE_ROLE_KEY ontbreekt in deze omgeving."
- Met mail aan: "De uitnodigingsmail voor [e-mail] is verstuurd."
- Met mail uit: een alleen-lezen veld met de uitnodigingslink (klik erin en alles wordt geselecteerd) en "Er is geen mail verstuurd (SMTP-vlag uit): stuur deze aanmeldlink zelf naar [e-mail]."
- Zonder beheerder: "Er is nog geen beheerder; logins maak je in de organisatie onder Gebruikers."
- Knoppen "Openen" (flyout van de nieuwe klant) en "Sluiten".

Anders dan in de flyout staat hier geen knop "Kopieer"; je selecteert en kopieert de link zelf.

![Resultaatblok na Aanmaken met een fictieve uitnodigingslink, zoals het verschijnt als de SMTP-vlag uit staat.](shots/klanten-3-resultaat-aanmaken.png)

### Flyout van een klant

Opent met "Openen" in een tabelrij, op een signaalkaart of in het resultaatblok. Het is een breed paneel dat van rechts inschuift over een donkere achtergrond. De pagina erachter scrollt niet mee; de focus blijft in het paneel.

Kop: kicker "Klant", de naam van de organisatie als titel en een regel met pakket, logins en oordeel ("Compleet · 8/9 met een login · Gezond"). Rechtsboven een kruisje "Sluiten".

Sluiten gaat met het kruisje, met Escape of met een klik op de donkere achtergrond. Staat er binnen de flyout een bewerkpaneel open (een contactpersoon, een gebruiker of een promptconcept), dan sluit Escape of een klik naast het paneel eerst dat bewerkpaneel, zodat ingetypte tekst niet in één klap verdwijnt. Staat er een bevestigingsvenster open, dan is Escape voor dat venster.

Er zijn acht blokken, van boven naar beneden.

**1. Contactgegevens.** Een lijst "Contactpersonen" met per persoon naam en een regel met functie, e-mail en telefoon, plus knoppen "Bewerk" en "Verwijder". Lege staat: "Nog geen contactpersonen. Voeg hieronder de eerste toe." Daaronder het kader "Contactpersoon toevoegen" met "Naam" (verplicht), "Functie", "E-mailadres", "Telefoonnummer" en de knoppen "Opslaan" en "Annuleren" (Annuleren is alleen actief als er iets is ingevuld), met de uitleg "Opslaan zet deze persoon in de lijst hierboven." Verwijderen vraagt eerst bevestiging in een venster "Contactpersoon verwijderen?" met de tekst dat het niet ongedaan kan worden. Onder "Adres" staan straat, postcode en plaats met een eigen knop "Adres opslaan", die alleen actief is als je iets wijzigde; na opslaan staat er kort "Opgeslagen".

![De flyout van een fictieve klant, met bovenaan de contactpersonen en het adres.](shots/klanten-6-flyout-contact-contract.png)

**2. Contract en abonnement.** "Type abonnement" is een leesveld (het pakket), met de uitleg "Het pakket bepaal je op de abonnementenpagina; hier zie je dezelfde waarde staan." en de link "Wijzig op Abonnementen". Daarnaast:

- "Status": "Pilot", "Actief" of "Opgezegd".
- "Prijs per maand (€)": heel getal, minimaal 0.
- "Startdatum": datumkiezer.
- "Looptijd (mnd)": 0 tot 120, placeholder 12.
- "Opzegtermijn": "Niet vastgelegd", "1 maand", "2 maanden" of "3 maanden". Een afwijkende opgeslagen waarde, zoals 6, komt er als extra keuze bij.
- "Notitie": maximaal 500 tekens, placeholder "Optioneel, bv. jaarcontract met korting".

Onder de velden een berekende regel: "Loopt tot 1 mrt 2027 · opzeggen vóór 1 jan 2027", met een vlag "opzegtermijn loopt" of "verlopen". Zonder startdatum en looptijd staat er "Vul startdatum en looptijd om einddatum en opzegmoment te berekenen." Knop "Contract opslaan", daarna kort "Opgeslagen".

**3. Gebruikers.** Per actieve gebruiker een rij met initialen, naam, een label "Login actief" of "Nog geen login", en een regel met e-mail, functie, telefoon en werkplek ("Kantoor" of "Onderweg"). Rechts:

- een rolkeuze ("Accountmanager", "Salesmanager", "Beheerder"), of het label "Founder" bij een superuser;
- "Bewerk" (niet bij een superuser);
- "Login aanmaken" als er nog geen login is, anders "Nieuwe link";
- "Archiveer" (niet bij een superuser en niet bij jezelf).

"Bewerk" opent een formulier met "Naam" (verplicht), "Functie", "E-mailadres" (verplicht), "Telefoonnummer" en "Werkplek" (Kantoor of Onderweg, met de uitleg "Onderweg toont in Dex de route en de kansen langs de weg. Kantoor laat die weg."). Knoppen "Opslaan", "Annuleren" en rechts de rode knop "Verwijder". Onderaan: "Het e-mailadres wijzigt het app-account. De inloglink blijft op het oude adres staan tot de gebruiker opnieuw een login-uitnodiging krijgt."

"Verwijder" opent het venster "Gebruiker verwijderen?" met de tekst dat de gebruiker definitief wordt verwijderd inclusief het loginaccount, dat records waarvan hij eigenaar is blijven staan, en "Liever omkeerbaar? Gebruik dan Archiveer." De bevestigknop heet "Verwijderen", de andere "Annuleren".

Gearchiveerde gebruikers staan ingeklapt onder "Gearchiveerd (1)", met een label "Gearchiveerd" en de knoppen "Herstel" en "Verwijder".

Na "Toevoegen", "Login aanmaken" of "Nieuwe link" verschijnt een uitnodigingsblok "Uitnodiging voor [e-mail]". Met mail aan staat er dat de mail verstuurd is, met de tip om in de spammap te kijken of "Nieuwe link" te klikken. Met mail uit staat er de link met een knop "Kopieer" (daarna "Gekopieerd ✓") en de uitleg dat de link eenmalig is en verloopt.

Onderaan het blok staat "Gebruiker toevoegen" met "Naam", "E-mailadres", "Rol" (standaard Accountmanager) en de knop "Toevoegen", met de uitleg "Toevoegen maakt meteen een login aan en nodigt de gebruiker uit." Fouten van een rolwissel of loginaanmaak staan in rood onder de betreffende rij; fouten bij archiveren of verwijderen onder de lijst.

![Het gebruikersblok in de flyout met fictieve gebruikers en het bewerkformulier van één gebruiker open.](shots/klanten-7-flyout-gebruikers.png)

**4. LLM-connector.** Hier stel je voor deze ene klant een eigen AI-aanbieder en sleutel in, of laat je hem de platformstandaard volgen. Het paneel toont wat er nu geldt en waarschuwt dat de meting op HQ niet hoeft te zeggen wat de klantapp krijgt. De werking staat in het hoofdstuk over de LLM-connector.

**5. Agent-prompts.** Per agent en per concepttype kun je voor deze klant een eigen instructie zetten die afwijkt van de platformbibliotheek. De kop telt "x van de 18 wijken af van het platform", elke rij heeft een label "eigen", "platform" of "standaard" en een knop "Bewerken". Leeg opslaan of "Platform volgen" zet de klant terug op het platform. Zonder database staat er "Geen database actief op deze omgeving, dus geen promptbibliotheek." De promptketen zelf staat in het hoofdstuk over agent-prompts.

**6. Features.** Veertien schakelaars in zeven groepen (onder meer "Dagritme", "Accounts & campagnes" en "Rapportage"). Per rij een schakelaar, "Aan" of "Uit" en de naam. Staat een feature aan, dan staat erachter "live" (de app dwingt hem af), "voorbereid" (de vlag staat om maar de app doet er nog niets mee) of "pakket te laag" (aan, maar de klant zit onder het minimumpakket, dus server-side toch uit). Een klik op de schakelaar of de tekst slaat direct op.

**7. AI-kosten.** Periodeknoppen "Vandaag", "Deze week" en "Deze maand" (standaard). Groot bedrag in dollars met "1 okt t/m 14 okt · 412 runs · alle AI-aanroepen van deze organisatie". Vier posten: "Invoer", "Uitvoer", "Promptcache" (of "niet gemeten") en "Webzoeken". Een staafjesstrook "Verloop, laatste 30 dagen" met "Hoogste dag", gele staven voor dagen waarop vooral de wekelijkse motorrun draaide en zwarte voor door mensen aangezet werk. Twee tabellen: per model en per "Soort aanroep" (bijvoorbeeld "Inzicht-beoordeling", "Concept", "Assistent-chat"). Een kader "Maandplafond" dat zegt of de rem aan of uit staat, met de knop "Rem aanzetten" of "Rem uitzetten". Een voetnoot legt uit waarom de bedragen in dollars staan. Het plafond en de prijslogica beschrijft het hoofdstuk over AI-verbruik.

![Het blok AI-kosten in de flyout met fictieve cijfers: posten, verloop over dertig dagen, model en soort aanroep, en het maandplafond.](shots/klanten-8-flyout-ai-kosten.png)

**8. Gebruik.** Twee kolommen. Links "Oordeel: Gezond" met de redenen als lijst. Rechts "Cijfers": gebruikers (totaal, met login, zonder), laatste activiteit, taken in 30 dagen (aangemaakt en afgerond), inzichten in 30 dagen, laatste motorrun ("vandaag", "3 dagen geleden" of "nog nooit gedraaid") en AI-kosten deze maand met het aantal runs.

Na elke geslaagde opslag in de flyout (contact, contract, feature, gebruiker toevoegen, archiveren, verwijderen) vraagt de flyout de pagina om de klantenlijst opnieuw op te halen, en toont hij de verse rij.

## Filters, zoeken, sorteren en weergaven

- Zoeken: één zoekveld "Zoek op naam of pakket". Het filtert direct tijdens het typen, zonder hoofdlettergevoeligheid, op de naam van de organisatie en op het pakketlabel. "plus" toont dus alle klanten op Plus, maar ook een klant met "plus" in zijn naam.
- Tellers: de meetlat en het badge rekenen altijd over alle organisaties, ook als er een zoekterm actief is. Alleen de somrij "Samen" verdwijnt tijdens het zoeken.
- Sorteren: vast op laatste activiteit, nieuwste bovenaan. Klanten zonder activiteit staan onderaan, onderling op naam. Er zijn geen klikbare kolomkoppen. De server levert de lijst op naam gesorteerd; de browser sorteert opnieuw.
- Reset: zoekveld leegmaken, of de link "Wis de zoekterm" in de lege staat.
- URL: de zoekterm en een geopende flyout komen niet in de URL. Herladen sluit de flyout en wist de zoekterm; je kunt geen link naar een bepaalde klant delen.
- Weergaven: er is één weergave, de tabel. Het afgehandelde deel van de aanvragen is in- en uitklapbaar.
- In de flyout zijn de periodeknoppen van AI-kosten de enige filter; het verloop van dertig dagen verandert daar bewust niet mee.

## Regels en berekeningen

### Het oordeel per klant

Het oordeel is geen score maar een handvol vaste regels, elk met een zin die je met de klant kunt bespreken (server/utils/klantstatus.ts):

| Regel | Gevolg | Reden op het scherm |
|---|---|---|
| 0 gebruikers | "Leeg", verder niets | "Nog geen gebruikers aangemaakt." |
| niemand met login | Risico | "Niemand heeft ooit ingelogd." |
| minder dan de helft met login | Let op | "3 van 7 gebruikers hebben een inlog gebruikt." |
| nooit een taak gewijzigd | Risico | "Geen enkele activiteit vastgelegd." |
| meer dan 30 dagen geen taakwijziging | Risico | "45 dagen geen activiteit." |
| 15 tot en met 30 dagen | Let op | "19 dagen geen activiteit." |
| 0 accounts | Risico | "Geen accounts in de CRM: de app is nooit gevuld." |
| taken aangemaakt in 30 dagen, geen afgerond | Let op | "12 taken aangemaakt, geen enkele afgerond." |
| motor meer dan 14 dagen niets opgeleverd | Let op | "Motor leverde 16 dagen niets op." |

Eén risicoregel maakt het oordeel Risico; anders maakt één let-op-regel het Let op; anders is het Gezond met de reden "Gebruikers zijn actief en taken worden afgerond."

Let op het verschil tussen scherm en code. "Met een login" betekent in de code: de gebruiker heeft een gekoppeld loginaccount (auth_user_id is gevuld). Sinds de koppeling direct bij het uitnodigen wordt gelegd, telt een gebruiker die zijn uitnodiging nooit opende al als "met login". De reden "Niemand heeft ooit ingelogd" en "hebben een inlog gebruikt" beloven dus meer dan de code meet. Ook "Laatst actief" meet geen inlog maar de laatste wijziging van een taak. Een team dat dagelijks inlogt maar geen taken aanraakt, heet stil. Het handboek noemt "laatste inlog" als bron van het oordeel; dat zit niet in de code.

### Aandachtsignalen

Berekend in de browser uit de klantenlijst:

- Klant met gebruikers maar nooit een taakwijziging: rood, "[naam] heeft nog geen activiteit".
- Klant met gebruikers en meer dan 14 dagen stil: "[naam] is 19 dagen stil", oranje tot en met 30 dagen, rood daarboven.
- Contract in de opzegtermijn: oranje, "Contract van [naam] zit in de opzegtermijn", met "Loopt tot [datum]. Nu verlengen of laten lopen."

Klanten zonder gebruikers krijgen geen signaal: dat is de normale staat van een net aangemaakte klant. Een signaal voor een te lage marge (AI-kosten tegen de contractprijs) is bewust weggelaten, omdat de kosten in dollars en de prijzen in euro's staan en de code geen wisselkoers wil verzinnen.

### Contract en omzet

- Einddatum = startdatum plus looptijd in maanden. Zonder startdatum of met looptijd 0 is er geen einddatum (doorlopend).
- Opzeggen vóór = einddatum min opzegtermijn; zonder opzegtermijn is dat de einddatum zelf.
- In de opzegtermijn = vandaag op of na "opzeggen vóór" en de einddatum nog niet bereikt. Voorbeeld: start 1 november 2025, 12 maanden, 1 maand opzegtermijn: einddatum 1 november 2026, opzeggen vóór 1 oktober 2026, dus op 14 oktober 2026 in de opzegtermijn.
- Maandomzet telt alleen contracten met status Actief; pilot en opgezegd tellen als nul.
- De server begrenst invoer: looptijd 0 tot 120 maanden, prijs tot 100.000 euro per maand, opzegtermijn tot 24 maanden, notitie 500 tekens, datum in de vorm jjjj-mm-dd. Ongeldige waarden worden stil weggelaten, niet geweigerd. Het contract wordt bij elke opslag als geheel overschreven, zodat een leeggemaakt veld ook echt leeg wordt.

### Het starterspakket

Een nieuwe organisatie krijgt een id van de vorm org, gevolgd door de naam in kleine letters (maximaal 24 tekens) en vier tekens uit de tijd, bijvoorbeeld org-demo-klimaattechniek-bv-1a2b. Ze krijgt zes instellingen: accountklassen A tot en met D (Corporate, Groot MKB, Middenbedrijf, Klein MKB), vijf fasen van de customer journey (Awareness, Overweging, Beslissing, Onboarding, Retentie), vier automatische overgangen daartussen, de opvolgtrap voor offertes, de belmatrix en de afspraakmatrix.

Daarnaast krijgt ze actieve activity-regels: in de code zijn dat er veertien (onder meer aflopend contract, bestelstilte, contactstilte, kwartaalbezoek A, AI-kansanalyse, vacatures, nieuws, offerte opvolging). Het scherm en het handboek zeggen "tien werkende activity-regels"; dat klopt niet meer met de code. Ook het antwoord van de server meldt vast "instellingen: 3", terwijl het er zes zijn. Het scherm gebruikt dat getal niet.

### Gebruikers en loginaccounts

- Rollen binnen een klant: Accountmanager, Salesmanager en Beheerder. De rol superuser is via HQ nooit uit te delen en superuser-gebruikers zijn hier niet te wijzigen, archiveren of verwijderen.
- Een e-mailadres mag één keer voorkomen per organisatie ("Dit e-mailadres is al in gebruik in deze organisatie.").
- Eerst ontstaat de app-gebruiker, daarna buiten die transactie het loginaccount. Mislukt het loginaccount, dan blijft de gebruiker bestaan en meldt HQ waarom er geen login is, zodat je het met "Login aanmaken" kunt herstellen.
- Mail of link hangt af van de vlag SUPABASE_SMTP_INGERICHT. Aan: Supabase verstuurt de uitnodiging zelf en HQ meldt alleen dat hij verstuurd is. Uit (standaard): HQ vraagt een eenmalige link op en toont die, zodat jij hem stuurt. De link brengt de gebruiker naar /wachtwoord-instellen.
- Bestaat er al een loginaccount met dat adres, dan wordt het niet aangeraakt en volgt een herstelmail of herstellink, met een notitie die dat zegt.
- Voor dit alles heeft HQ de service-sleutel van Supabase nodig (SUPABASE_SERVICE_ROLE_KEY). Die staat alleen op HQ, niet in de klantapp; daarom loopt het aanmaken van gebruikers via HQ.
- Archiveren zet een vlag gearchiveerd in de gebruikersrij. De sessielaag weigert die gebruiker daarna, maar het loginaccount blijft bestaan, zodat "Herstel" met één klik werkt.
- Verwijderen haalt de gebruikersrij weg. Records waarvan hij eigenaar was blijven staan en tonen daarna een eigenaar zonder login. Het loginaccount gaat alleen mee als geen andere organisatie hetzelfde account of e-mailadres gebruikt; anders volgt "Het loginaccount blijft bestaan: een andere organisatie gebruikt hetzelfde account."
- Vangrails bij archiveren en verwijderen: niet jezelf, en niet de laatste actieve beheerder ("Dit is de laatste actieve beheerder van deze organisatie; maak eerst iemand anders beheerder.").
- Een e-mailwijziging past alleen het app-account aan, niet het inlogadres in Supabase Auth.

### Gebruikersaanvragen

- Een beheerder bij de klant dient de aanvraag in op zijn instellingenpagina (naam, e-mailadres, rol). Er mag geen open aanvraag voor hetzelfde adres bestaan en het adres mag nog niet in de organisatie voorkomen.
- HQ verzamelt de aanvragen van alle organisaties. Open aanvragen eerst, daarbinnen de nieuwste bovenaan.
- Een al afgehandelde aanvraag nogmaals afhandelen geeft "Deze aanvraag is al afgehandeld."
- Goedkeuren loopt hetzelfde pad als "Gebruiker toevoegen" in de flyout. Een probleem met het loginaccount wordt als notitie bij de aanvraag bewaard.
- De founder krijgt geen melding of mail van een nieuwe aanvraag; hij ziet hem alleen als hij dit scherm opent. Het badge in de zijbalk telt aanvragen niet mee, alleen aandachtsignalen.

### Rechten, scheiding en audit

- Elk endpoint controleert de rol superuser.
- De lijst van organisaties komt via een speciale databasefunctie (list_organisation_ids) die over de afscherming per organisatie heen mag kijken. Alles daarna wordt per organisatie binnen de gewone afscherming (row level security) gelezen, in blokken van acht tegelijk. Volgens de code schaalt dat tot een paar honderd klanten; daarboven zou het een vooraf berekende tabel moeten worden.
- Instappen, archiveren, herstellen, verwijderen en een wijziging van de werkplek komen in het auditlog van de betrokken organisatie, met de naam van de superuser en de herkomst HQ. Wijzigingen aan contract, contact, features, rol, naam, functie en telefoon worden niet geauditeerd.
- Het instap-endpoint controleert niet of de organisatie bestaat: in de mock gaf het een geldig overdrachtsadres terug voor een niet-bestaand id. De controle ligt bij de klantapp.

### Mock tegenover productie

De mock op localhost:3096 draait zonder database. Daardoor:

- is de klantenlijst leeg met "Geen database actief op deze omgeving, dus geen klanten te tonen.", en ontbreken de meetlat, het aandachtblok en het aanvragenblok;
- eindigt "Aanmaken" met "Zonder database is organisaties aanmaken niet mogelijk." (503), net als alle opslagacties in de flyout ("Zonder database is organisatiebeheer niet beschikbaar.", "Zonder database is gebruikersbeheer niet beschikbaar.").

De gevulde schermafbeeldingen in dit hoofdstuk zijn daarom gemaakt met fictieve klanten die in de browser in de antwoorden van de server zijn gezet. Er is niets opgeslagen en er is niets naar een externe dienst gegaan. Op "Instappen", "Goedkeuren + uitnodigen", "Login aanmaken" en "Nieuwe link" is niet geklikt; die zijn beschreven uit de code.

## Gegevens

### Organisatie (tabel organisations, veld data)

- Id (id) en naam (name).
- Pakket (pakket): starter, plus of compleet.
- Contactgegevens (contact): een lijst personen (personen: naam, functie, email, telefoon) en het adres (straat, postcode, plaats). De eerste persoon wordt gespiegeld naar de oudere platte velden contactpersoon, email en telefoon.
- Contract (contract): status (pilot, actief, opgezegd), startdatum (startDatum), looptijd in maanden (looptijdMaanden), prijs per maand in centen (prijsPerMaandCent), opzegtermijn in maanden (opzegtermijnMaanden) en notitie.
- Feature-vlaggen (features): alleen de expliciet gezette waarden; de rest volgt de standaard uit het register.
- Koppelingen (integrations), bij aanmaak een lege lijst, en de aanmaakdatum (createdAt).

### Afgeleid, niet opgeslagen

- Gezondheid: gebruikers, gebruikers met login, accounts, taken aangemaakt en afgerond in 30 dagen, inzichten in 30 dagen, laatste activiteit (laatste taakwijziging) en laatste motorrun. Bij elk openen opnieuw geteld.
- Oordeel en redenen, contractafleiding (einddatum, opzeggen vóór, dagen tot einde, in opzegtermijn), maandomzet en de aandachtsignalen.

### Gebruiker (tabel users)

- Id, organisatie (organisationId), e-mailadres (email), naam (name), rol (role) en de koppeling met het loginaccount (authUserId).
- In het veld data: functie, telefoon, werkplek (kantoor of onderweg, standaard onderweg), gearchiveerd en gearchiveerd op (gearchiveerdOp).

### Gebruikersaanvraag (org_settings, sleutel gebruikersaanvragen)

Een lijst per organisatie, geen eigen tabel: id, naam, email, rol, status (open, goedgekeurd, afgewezen), aangevraagd door (aangevraagdDoor en aangevraagdDoorNaam), aangevraagd op (aangevraagdOp), afgehandeld op (afgehandeldOp) en notitie.

### Van andere features

- AI-kosten uit het logboek agent_runs: tokens voor invoer, uitvoer, cache lezen en cache schrijven, webzoekopdrachten, model en soort aanroep. Omgerekend naar dollars met de prijstabel van het kostenscherm in de klantapp.
- Het maandplafond en de bundel per klant (zelfde bron als het verbruiksscherm van de klant).
- De LLM-instelling en de eigen prompts per klant, beschreven in hun eigen hoofdstukken.
- Starterinstellingen in org_settings en starterregels in activity_rules, bij aanmaak geschreven.
- Auditregels in het auditlog van de organisatie.

## Wat dit betekent voor Dealtrace

- Overnemen: het oordeel per klant als handvol regels met een leesbare reden in plaats van een score, en het aandachtblok dat alleen toont wat de data draagt. Voor Dealtrace moeten de regels new business meten: aantal nieuwe prospects, eerste gesprekken en afspraken per verkoper per week, niet de afronding van taken op bestaande klanten.
- Anders meten: "met login" en "laatst actief" moeten echte inlogs en echte activiteit meten. Leg een laatste inlogmoment per gebruiker vast en meet activiteit over meer dan taken alleen (gelogde calls, verstuurde berichten, toegevoegde prospects).
- Kosten per klant uitbreiden: naast AI-tokens ook de kosten van dataverrijking (credits van verrijkingsdiensten per opgevraagd bedrijf of contact) en van agentruns per klant, in één bedrag en met marge tegen het contract. Leg daarvoor wel een wisselkoers of een europrijs per eenheid vast, anders blijft het margesignaal ontbreken zoals in DealDrive.
- LinkedIn en andere kanalen: toon per klant en per verkoper het gebruik tegen de limieten van LinkedIn (verzoeken en berichten per week) en signaleer wie tegen de grens aanloopt. Dat hoort bij aandacht net zo goed als stilte.
- AVG en herkomst: een new business-tool verwerkt persoonsgegevens van mensen die nog geen klant zijn. Geef de flyout een blok met de herkomst van de data per klant (welke bronnen, hoeveel contacten, bewaartermijn) en een plek voor de verwerkersovereenkomst. Audit ook contract- en featurewijzigingen, niet alleen gebruikers en instappen.
- Overnemen: de aanvraagroute voor gebruikers via de founder, met het loginaccount alleen op de console. Voeg wel een melding toe bij een nieuwe aanvraag en tel open aanvragen mee in het badge.
- Ontbreekt nu: zoekterm en open flyout in de URL, sorteren op kolom, filteren op oordeel of pakket, een export, en een klantpagina die je kunt delen. Bij veel klanten (Dealtrace mikt op teams van accountmanagers) is ook de telling per klant bij elk openen te zwaar; plan een vooraf berekende tabel.
- Overnemen met correctie: het starterspakket bij aanmaak is sterk, maar laat de uitleg op het scherm uit dezelfde bron komen als de code, zodat "tien regels" niet blijft staan als het er veertien zijn. Voor Dealtrace past een starterspakket met ideaal klantprofiel, doelgroepsegmenten en een eerste prospectiecadans.
