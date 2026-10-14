# Contacten

## Wat het is en waarvoor

Een contact is een persoon bij een klant of prospect. In DealDrive hangt een contact altijd onder precies één account: zonder account bestaat er geen contact, en verwijder je een account, dan gaan de contactpersonen mee. Elk contact heeft een rol in de koopbeslissing (Beslisser, Champion, Beïnvloeder, Gebruiker of Onbekend) en kanalen om hem te bereiken (e-mail, telefoon, mobiel, LinkedIn, Instagram, Facebook).

Voor een accountmanager in new business beantwoordt deze feature de vraag "wie bel of mail ik bij dit bedrijf, en wat speelt er met die persoon?". De contactkaart verzamelt wat aan die ene persoon hangt: taken op zijn naam, afspraken waarvoor hij is uitgenodigd, deals waar hij betrokkene is, mail en notities. Een salesmanager ziet op de overzichtspagina hoeveel beslissers en champions er in beeld zijn en bij hoeveel accounts.

In de week: de landingspagina toont zes personen die deze week aandacht vragen; tijdens het werk open je de contactkaart vanuit de accountkaart, een taak, een afspraak of de zoekfunctie om te bellen, te mailen of iets vast te leggen.

Samenhang. Contacten lezen het account (naam, type klant of prospect, stuurvelden, eigenaar), taken, afspraken, deals, offertes, communicatie, inzichten en documenten. Ze schrijven contactvelden en, via de knoppen op de kaart, nieuwe taken, afspraken, deals, notities en mail met het contact vooringevuld. De rol voedt de keuze van het primaire contact op de accountkaart (eerste beslisser of champion), dat weer wordt voorgevuld bij nieuwe taken en deals.

## Waar je het vindt

In de zijbalk onder "Accounts" staat "Contacten" (/contacten). Er is geen functievlag en geen rolbeperking: elke rol ziet en bewerkt alle contacten van de organisatie. Verwijderen staat op de server alleen open voor beheerder en superuser (server/utils/permissions.ts), terwijl de knop "Verwijder contact" voor iedereen zichtbaar is.

| Route | Wat het is |
|---|---|
| /contacten | Zes contacten die deze week spelen |
| /contacten/alle | Volledige lijst met zoeken en filters |
| /contacten/:id | De contactkaart |

Andere ingangen: de knop "Contacten" op de accountkaart (de flyout met contactpersonen), de initialen rechts op een accountrij in /klanten/alle en /prospects/alle, de bedrijfsnaam en contactnaam in taken en afspraken, de globale zoekfunctie en "Alle contacten →" onderaan de contactpersonenflyout. Het tabblad op de contactkaart staat in de URL (?tab=acties, ?tab=offertes, ?tab=deals), zodat een tabblad in een nieuw venster te openen is.

## Opbouw van de pagina

### Top deze week (/contacten)

Kop: kicker "Top deze week" met de datums van maandag en zondag van de huidige week, titel "Beslissers en beïnvloeders deze week", subtitel "De zes belangrijkste beslissers en beïnvloeders van deze week. Klik een kaart voor de contactkaart." Rechts de knop "Alle contacten →".

Daaronder zes portretten in drie kolommen. Elk portret heeft een gekleurd fotovlak met de rol als tag ("BESLISSER") en de initialen (of de foto), de naam, de regel functie · bedrijf, de regel "Inzichten: 4 · Laatste activiteit: 10 okt" (beide van het account), een citaat als dat is ingevuld, en een voetregel met "12 jr in rol", "LinkedIn ↗" en een segmentwoord van het account ("Strategisch", "Klant", "Warm prospect", "Prospect"). Een klik opent de contactkaart. De kaarten verschijnen pas na het laden in de browser; tot dan staat er een skelet. Lege staat: "GEEN BESLISSERS", "Nog geen beslissers in beeld.", "Zodra je contacten toevoegt aan klanten, verschijnen ze hier."

![De landingspagina Contacten met zes portretten van deze week](shots/contacten-1-top-deze-week.png)

### Alle contacten (/contacten/alle)

Kop: kicker "← Contacten · 85 contacten totaal", titel "Alle contacten", subtitel "Zoek op naam, functie of bedrijf. Filter op rol om snel beslissers, champions of beïnvloeders te vinden."

Werkbalk: zoekknop (globale zoekoverlay), "+ Contact", "+ Taak", "+ Afspraak" en "Filters" met teller. Er is geen weergavekeuze en geen sorteerkeuze.

De lijst toont alle contacten zonder paginering. Een rij bevat:

- Een vierkante avatar met initialen in een kleur die uit de naam wordt afgeleid, of de foto. Zonder naam: een vraagteken.
- De naam (of "Naam onbekend") met de rol als tag.
- Functie · bedrijfsnaam (functie leeg: een streepje).
- Een bereikregel met alleen wat gevuld is: iconen voor LinkedIn, Instagram en Facebook (klik opent het profiel), het e-mailadres, telefoon, mobiel, "Inzichten: n" (live geteld over het account) en "Laatste activiteit: 11 okt 2026", "vandaag" of "nog geen".

Een klik op de rij opent de contactkaart. Onder de lijst staat een strook met vier getallen: "Beslissers", "Champions", "Beïnvloeders" en "Accounts" (aantal accounts met minstens één contact). In de demo: 81, 2, 2 en 81.

Lege staat: "GEEN RESULTATEN", "Niets gevonden.", met Geen contact met "x" in naam, functie of bedrijf. of "Geen contacten binnen deze filters.", en "Toon alles", dat ook de zoekterm wist.

![Alle contacten met de filterstrook open: zoekveld, Rol en Accounts](shots/contacten-2-alle-contacten-filters.png)

### De contactkaart (/contacten/:id)

Van boven naar beneden:

1. Kruimel "← Alle contacten".
2. Links een groot portretvlak met de rol als gekleurde tag en de initialen of foto. Klikken op het vlak opent "Profielfoto wijzigen" (URL instellen of weghalen).
3. Naam, functie, en een regel met de bedrijfsnaam als link naar de accountkaart, telefoon en mobiel als bellink en "LinkedIn ↗".
4. Een stuurstrook van het account, alleen lezen: "Account · laatste actie", "Account · laatste call", "Account · laatste bezoek". Het woord "Account" staat erbij omdat deze datums niet over de persoon gaan.
5. Rechtsboven "Info" (contactgegevens) en "Briefing →".
6. Een statstrook: "Open taken" (met "n achterstallig"), "Inzichten" (met "n ongezien"), "Open offertes", "Open deals", "Laatste contact" en "Eigenaar" (de eigenaar van het account).
7. Tabbladen, alle met een teller (ook nul): "Tijdslijn", "Inzichten", "Taken", "Notities", "E-mails", "Afspraken", "Gespreksverslagen", "Deals" en "Documenten". Er is bewust geen tabblad Campagnes, omdat een campagne-item aan een account hangt en niet aan een persoon.

![De contactkaart met portret, stuurstrook van het account, statstrook en de tijdslijn](shots/contacten-4-contactkaart.png)

Wat de tabbladen tonen en waar ze hun gegevens vandaan halen:

| Tabblad | Inhoud | Niveau |
|---|---|---|
| Tijdslijn | inzichten, taken, contactmomenten met dit contactId; afspraken en deals waar hij in de deelnemers staat | persoon |
| Inzichten | alle niet-afgewezen inzichten van het account | account |
| Taken | taken met dit contactId, in dezelfde groepen als de accountkaart | persoon |
| Notities | notities met dit contactId | persoon |
| E-mails | mail met dit contactId, zonder concepten en geplande mail | persoon |
| Afspraken | afspraken waarvoor hij is uitgenodigd | persoon |
| Gespreksverslagen | verslagen op zijn beltaken en op zijn afspraken | persoon |
| Deals | deals waar hij betrokkene is en offertes met hem als contact | persoon |
| Documenten | documenten van het account | account |

Op het tabblad Taken staat een voetnoot als het account open taken zonder contactpersoon heeft, bijvoorbeeld: "Daarnaast 2 openstaande taken op accountniveau zonder contactpersoon: bekijk ze op de klantkaart." Op het tabblad Deals staat een vergelijkbare noot: "1 andere deal bij Bouwbedrijf De Vries zonder Henk als betrokkene: zie de klantkaart." Zulke deals worden genoemd maar niet meegeteld. De teller van Deals telt unieke kansen: een offerte die bij een getoonde deal hoort, telt niet nog eens.

![Het tabblad Deals met een deal, de bijbehorende offerte en de noot over andere deals van het account](shots/contacten-6-contactkaart-deals.png)

Koppen gebruiken de voornaam ("Tijdslijn met Henk", "Deals met Henk"); zonder voornaam staat er "dit contact". Een onbekend ID toont "404 · niet gevonden", "Contact niet gevonden." en "← Terug naar alle contacten".

## Doorklikken: de stappen

### Een contact toevoegen vanaf de accountkaart (snelste weg)

1. Klik op de accountkaart op "Contacten". De flyout "Contactpersonen · n" opent met de bestaande personen.
2. Klik onderaan op "+ Snel contactpersoon aanmaken". Het formulier klapt open met de cursor in "Voornaam".
3. Vul voornaam en achternaam in (allebei verplicht), en waar bekend functie, e-mail, telefoon, mobiel en rol.
4. Klik "✓ Contactpersoon toevoegen". Het formulier sluit en de persoon staat direct in de lijst, gesorteerd op rol. Er verschijnt geen melding en je blijft op de accountkaart.

### Een contact toevoegen vanuit het overzicht

1. Klik op /contacten/alle op "+ Contact". De flyout "Nieuw contact" opent.
2. Vul "Voornaam" en "Achternaam" in en kies onder "Klant of prospect" het bedrijf (alle drie verplicht).
3. Kies optioneel rol, vink "Beslist mee over de aankoop" aan, en vul bereik en eigen velden in.
4. Klik "Contact aanmaken". De melding "Voornaam Achternaam staat erbij." verschijnt en je gaat direct naar de nieuwe contactkaart.

![De flyout Nieuw contact met Persoon, Bedrijf en Bereik](shots/contacten-3-nieuw-contact.png)

### Een beslisser vinden en bellen

1. Open /contacten/alle en klik "Filters".
2. Kies "Beslissers" en daarnaast "Bij prospects".
3. Typ eventueel een deel van de bedrijfsnaam of functie in "Zoek naam, functie of bedrijf…".
4. Klik op de rij. Op de contactkaart klik je het telefoon- of mobiele nummer onder de naam; dat opent een tel-link.
5. Leg na het gesprek het resultaat vast met "+ Taak" (beltaak, met het veld Gespreksverslag) of op het tabblad "Notities".

### De rol of gegevens van een contact aanpassen

1. Open de contactkaart en klik "Info". De flyout "Contactgegevens" opent.
2. Wijs een veld aan, klik op het potlood, pas aan en bevestig. Escape annuleert.
3. De wijziging staat direct op de kaart, in de lijsten en in de contactpersonenflyout van het account.

### Vanaf de contactkaart iets plannen of sturen

1. Klik op de tijdslijn "+ Taak": de taakflyout opent met account en contact ingevuld en als reden "Voor Naam bij Bedrijf".
2. "+ Afspraak": de afspraakflyout opent met account en contact ingevuld.
3. "+ Mail" (alleen als het contact een e-mailadres heeft): het mailvenster opent met het adres en de naam voor de sjabloonvelden.
4. "+ Deal" op het tabblad Deals: de dealflyout opent met account en contact ingevuld.

## Flyouts, vensters en knoppen

### Contactpersonen op de accountkaart (ContactenFlyout)

Opent met "Contacten" op de accountkaart. Kicker "Contactpersonen · 2", titel de bedrijfsnaam, tekst "Alle contacten gekoppeld aan dit account. Klik een naam voor de contactpersoonkaart."

Een kaart per persoon met avatar, naam, roltag, functie en e-mail · telefoon (of mobiel). Volgorde: beslissers, dan champions, beïnvloeders, gebruikers en onbekend; binnen een rol de laatst bijgewerkte eerst. Een klik gaat naar de contactkaart en sluit de flyout. Zonder contacten: "Nog geen contactpersonen aan dit account gekoppeld."

Het snelformulier "Nieuwe contactpersoon" heeft "Voornaam" en "Achternaam" (verplicht), "Functie" (voorbeeldtekst "bv. Inkoopmanager"), "E-mail", "Telefoon", "Mobiel" en "Rol" met de keuzes "Contact", "Beslisser", "Champion", "Beïnvloeder" en "Gebruiker" (standaard "Contact", opgeslagen als onbekend). Rechtsboven "Annuleren". Kies je Beslisser, dan slaat het formulier ook "beslist mee" (isDecisionMaker) op; bij andere rollen niet. Een vinkje daarvoor staat niet in dit formulier. Eigen velden ontbreken in dit formulier. Onderaan de flyout "Alle contacten →". Escape en een klik naast het paneel sluiten; bij sluiten wordt een half ingevuld formulier gewist.

![De flyout Contactpersonen op de accountkaart met het snelformulier open](shots/contacten-7-contactpersonen-flyout.png)

### Nieuw contact (NieuwContactFlyout)

Opent met "+ Contact" op /contacten/alle. Kicker "Nieuw contact", titel "Wie voeg je toe?".

| Blok | Velden | Regels |
|---|---|---|
| Persoon | "Voornaam", "Achternaam", "Functie", "Rol", "Beslist mee over de aankoop" | voor- en achternaam verplicht; rol standaard "Onbekend" |
| Bedrijf | "Klant of prospect" | verplicht; alle accounts op alfabet; hint "Een contact hangt altijd onder een bedrijf. Staat het er nog niet bij? Maak dan eerst het account aan." |
| Bereik | "E-mail", "Telefoon", "Mobiel", "LinkedIn-profiel" | optioneel, geen opmaakcontrole |
| Eigen velden | de velden die de beheerder inrichtte, bijvoorbeeld "Voorkeurskanaal" | optioneel |

Knoppen: "Annuleren" en "Contact aanmaken" (uit zolang een verplicht veld leeg is; tijdens opslaan "Aanmaken…"). Fout: "Aanmaken mislukt. Probeer het opnieuw." Er is geen dubbelcheck op naam of e-mail en het bedrijf kun je niet vanuit de flyout aanmaken.

### Contactgegevens (ContactInfoFlyout)

Opent met "Info" op de contactkaart. Kicker "Contactgegevens", titel de naam, daaronder de functie. Elk veld is bewerkbaar met potlood, opslaan en annuleren; leeg maken wist het veld.

- "Persoon": "Voornaam", "Achternaam", "Functie", "Rol" (Beslisser, Champion, Beïnvloeder, Gebruiker, Onbekend), "Jaren in rol" (geheel getal; een ongeldige invoer wordt genegeerd).
- "Bereik": "E-mail", "Telefoon", "Mobiel", "LinkedIn", "Instagram", "Facebook", "Bron (publieke verificatie)" (een URL waar naam en functie publiek staan, zoals een over-ons-pagina of persbericht).
- "Context": "Uitspraak" (het citaat op het portret) en "Avatar URL".
- Eigen velden per sectie, in de demo "Voorkeurskanaal" en "Hobby's / interesses".
- Onderaan "Verwijder contact". De bevestiging "Contact verwijderen?" zegt dat de persoon overal uit DealDrive verdwijnt en dat mails en afspraken uit het verleden blijven staan. Daarna de melding "Naam is verwijderd." en terug naar /contacten/alle.

Het bedrijf waaronder het contact hangt en het vinkje "beslist mee" staan niet in deze flyout. Een contact verhuizen naar een ander account kan nergens in het scherm.

![De flyout Contactgegevens met Persoon, Bereik, Context en eigen velden](shots/contacten-5-contactgegevens-flyout.png)

### Briefing vanaf de contactkaart

"Briefing →" opent altijd de briefing van het soort "Behoefte-probleem-oplossing" voor het account met dit contact, ongeacht waar het account in het verkoopproces staat. Op de accountkaart kies je zelf uit vijf soorten.

## Filters, zoeken, sorteren en weergaven

| Groep | Waarden | Werking |
|---|---|---|
| Zoekveld | vrije tekst | naam, functie of bedrijfsnaam bevat de term |
| Rol | "Alle", "Beslissers", "Champions", "Beïnvloeders", "Gebruikers" | een rolpil verschijnt alleen als er minstens één contact met die rol is; er is geen pil voor Onbekend |
| Accounts | "Alle", "Bij klanten", "Bij prospects" | volgt het type van het account |

De tellers op de pillen rekenen altijd over alle contacten, los van de andere filters en de zoekterm. Kies je "Bij prospects", dan blijft er bij "Beslissers" 81 staan, ook als er bij prospects minder zijn. Dat werkt anders dan op /prospects/alle, waar de tellers met de andere filters meerekenen. De strook onderaan ("Beslissers", "Champions", "Beïnvloeders", "Accounts") telt ook altijd alles.

De teller op "Filters" telt rol, accounts en een niet-lege zoekterm. "Reset filters" zet alle drie terug. Niets van de filters komt in de URL.

Sorteren is vast: eerst op rol (beslisser, champion, beïnvloeder, gebruiker, onbekend), dan op achternaam. Er is geen paginering; alle contacten staan op één pagina.

Op de contactkaart heeft de tijdslijn een filter "Soort" met "Alles" en alleen de soorten die voorkomen ("Inzichten", "Taken", "Afspraken", "Deals", "Contactmomenten"), elk met teller, en "Reset filter".

## Regels en berekeningen

Rollabel. Eén bron (useContactRol): beslisser wordt "Beslisser", champion "Champion", beinvloeder "Beïnvloeder", gebruiker "Gebruiker", onbekend "Onbekend". Dezelfde volgorde stuurt sorteren en filters. Uitzondering: het snelformulier in de contactpersonenflyout noemt onbekend "Contact", terwijl het handboek stelt dat alle plekken nu dezelfde bron gebruiken.

Beslisser. Naast de rol bestaat het vinkje isDecisionMaker. Het formulier "Nieuw contact" zet het los van de rol, het snelformulier zet het alleen bij de rol Beslisser, en in "Contactgegevens" is het niet te wijzigen; een rolwijziging past het vinkje ook niet aan. De accountrij gebruikt het vinkje om beslissers vooraan te zetten, de rest van de app de rol.

Naam. Zonder voor- en achternaam heet een contact overal "Naam onbekend" met een vraagteken als initialen.

Top deze week. DealDrive telt per contact wat er deze week speelt: open taken met een vervaldatum vóór komende maandag (achterstallige tellen mee), geplande afspraken in deze week waarvoor hij is uitgenodigd, open offertes met hem als contact waarvan de geldigheid voor het einde van de week afloopt, en open deals met hem als betrokkene met een verwachte sluitdatum voor het einde van de week. Contacten met de hoogste telling komen eerst. De rest wordt aangevuld tot zes: eerst beslissers en champions (rol of vinkje), daarbinnen de laatst bijgewerkte; contacten zonder naam vullen niet aan. De titel spreekt van beïnvloeders, maar beïnvloeders krijgen geen voorrang.

Laatste activiteit in de lijsten. Dit is de laatste activiteit van het account, niet van de persoon: dezelfde berekening als op de accountrij (communicatie, afgeronde contacttaken, gehouden afspraken en het stuurveld lastInteractionAt). Op de contactkaart betekent "Laatste contact" iets anders: het jongste moment uit communicatie met dit contactId, niet-geannuleerde afspraken waarvoor hij is uitgenodigd en afgeronde beltaken op zijn naam, alleen momenten in het verleden. Daardoor kan dezelfde persoon in de lijst "Laatste activiteit: 11 okt 2026" hebben en op de kaart een streepje.

Open taken. Op de contactkaart tellen alleen taken met status open of bezig. Op de accountkaart telt alles wat niet afgerond of geannuleerd is. De accountkaart is op dat punt eerder bewust aangepast; de contactkaart gebruikt nog de oude regel. In de praktijk vangt de takenlijst het meeste op, omdat die een taak zonder status bij het inlezen op open zet.

Inzichten. Het tabblad Inzichten en het statvak tonen alle inzichten van het account (bij Henk de Vries 4), terwijl de tijdslijn alleen inzichten met zijn contactId toont (daar 0). De kop van het tabblad zegt dat ook: "Inzichten voor Bouwbedrijf De Vries".

Notities. Op de contactkaart kun je notities toevoegen maar niet bewerken of verwijderen; op de accountkaart wel. Het handboek beschrijft bewerken en verwijderen voor beide kaarten.

Opslaan. Aanmaken en wijzigen gaan eerst naar het geheugen en IndexedDB op het apparaat, daarna via de synchronisatiewachtrij naar de server; de versieteller zorgt dat lijsten, kaart en flyouts direct bijwerken. Een notitie gaat rechtstreeks naar de server als communicatie van soort notitie; lukt dat niet, dan blijft hij op het apparaat staan met een waarschuwing.

Wat de AI doet: niets met contacten zelf. Er is geen verrijking van functie of e-mail, geen rolvoorspelling en geen controle op de bron-URL. AI zit in de gespreksverslagen (sentiment, onderwerpen, koopsignalen, actiepunten), de briefing en de inzichten op contactniveau (bijvoorbeeld een directiewissel).

## Gegevens

Een contact (tabel contacts; vaste kolommen voor id, organisatie, account, voornaam, achternaam, e-mail en beslisser, de rest in jsonb data):

- Persoon: voornaam (firstName), achternaam (lastName), functie (jobTitle), jaren in rol (yearsInRole).
- Bedrijf: account (accountId), verplicht.
- Bereik: e-mail (email), telefoon (phone), mobiel (mobile), LinkedIn (linkedInUrl), Instagram (instagramUrl), Facebook (facebookUrl).
- Verkoopcontext: rol (role), beslist mee (isDecisionMaker), bron voor publieke verificatie (sourceUrl).
- Profiel: foto (avatarUrl), uitspraak (quote).
- Externe ID's (externalIds) en eigen velden (customFields), ingericht door de beheerder onder Instellingen.
- Aangemaakt en bijgewerkt (createdAt, updatedAt). Het laatste bepaalt de volgorde in de contactpersonenflyout en de aanvulling op de landingspagina.

Van andere features komen: taken (contactId), afspraken (contactIds), deals (contactIds), offertes (contactId), communicatie (contactId), inzichten (contactId) en, op accountniveau, documenten en de stuurvelden. Contacten kunnen ook in bulk binnenkomen via /import (soort "Contactpersonen"): "Achternaam" en "Bedrijf" zijn daar verplicht, het bedrijf wordt op naam bij een bestaand account gezocht, en een duplicaat wordt herkend op e-mailadres of anders op exacte naam binnen hetzelfde bedrijf.

## Wat dit betekent voor Dealtrace

- Overnemen: het contact altijd onder een account, met de rol als vaste set en één labelbron. Voor new business is de vraag "hebben we de beslisser al?" de kern van de kwalificatie.
- Overnemen: de contactkaart die alleen toont wat echt aan de persoon hangt, met een noot naar het account voor de rest. Dat voorkomt dat andermans werk als zijn dossier leest.
- Anders: maak "beslist mee" en de rol één begrip, of leid het ene uit het andere af. Nu bestaan er twee velden die drie formulieren verschillend vullen.
- Anders: één definitie van "laatste contact" per niveau, en laat in de lijst zowel persoon als account zien. Voor binnendienst bepaalt dat wie je vandaag belt.
- Toevoegen: een buying-center-overzicht per prospect (welke rollen ontbreken nog), plus filters "zonder e-mail", "zonder telefoon" en "zonder contact in X dagen" op de lijst. De lijst kent nu alleen rol en klant of prospect.
- Toevoegen: dubbelcheck op e-mail en naam bij handmatig aanmaken, verhuizen naar een ander account, en verrijking met bron (LinkedIn of website), zodat de bron-URL echt gevuld raakt.
- Anders: tellers op de filterpillen laten meerekenen met de andere filters, paginering of virtueel scrollen, en een sorteerkeuze (laatste contact, account, rol).
- Voor buitendienst: het contact op de kaart koppelen aan het bezoekadres en de afspraak, met bellen en navigeren als vaste knoppen op de telefoon.
