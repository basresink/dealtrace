---
titel: Platformbeheer
categorie: Inrichten
collectie: product
samenvatting: Voor de leverancier: klanten, abonnementen, features per niveau, facturen, credits, AI en agentmaxima, prompts, Data en AVG, opzeggen, roadmap, motor en audit.
routes: /platform/klanten,/platform/features,/platform/abonnementen,/platform/verbruik,/platform/roadmap,/platform/ai
---

# Platformbeheer

### Wat Platformbeheer is

Platformbeheer is alleen voor de leverancier van Dealtrace. Daar staan de klanten, hun pakket en contract, en welke functies per niveau aanstaan.

### Wie het ziet

Alleen de rol founder ziet Platformbeheer. De server weigert elke platformroute voor iedereen anders, en de database laat de platformrol alleen tellingen lezen, nooit klantrecords. Gevaarlijke acties (pakket verlagen, een AI-sleutel of platformprompt opslaan, de prijs per handeling wijzigen) vragen je authenticator-code als de laatste bevestiging ouder is dan 15 minuten. Alles wat je doet, staat in de **Platformaudit**.

## De schermen

- **Klanten**: gezondheid, pakket, gebruikers en de klantflyout met contract, gebruikersaanvragen, functievlaggen, de DealDrive-koppeling, de AI-koppeling en prompts van de klant, Data en AVG en Organisatie opzeggen. Zie hieronder.
- **Abonnementen**: per pakket de functies, bronnen, AI-credits per gebruiker en de prijs. Een nieuwe prijs leg je vast met een datum vanaf wanneer hij geldt. "Welke inhoud?" vergelijkt de pakketten, ook met het pakket van een klant.
- **Features per niveau**: zie hieronder.
- **Facturen**: facturen uit Stripe met hun status, de marge per klant en de extra credits die nog op een factuur moeten. Een klant met een achterstallige factuur krijgt de pil **AI gepauzeerd**: AI stopt, de rest van Dealtrace werkt door. Betaalde facturen gaan naar Moneybird.
- **Verbruik en credits**: per klant de pot, het verbruik per soort en per gebruiker, en de geschatte kosten. Hier ken je **extra credits** toe, met reden en of ze op de factuur komen. Op het tabblad **Prijs per handeling** pas je de prijs van een AI-handeling aan; hij geldt vanaf vandaag.
- **AI-koppeling**: de sleutel van Claude (alleen de vingerafdruk is te zien), de verwerkingsregio, "geen training" en het model per soort. **Test verbinding** stelt een kleine vraag. Onder **Agentmaxima** kies je per agent het hoogste mandaat bij alle klanten: A autonoom, B binnen een goedgekeurd kader, C per stuk goedkeuren, D altijd mens. Ruimer dan de standaard kan niet; een klant kiest daarbinnen zijn eigen maximum.
- **Agent-prompts**: per slot de tekst van het platform, met versies (hooguit 10) en **Proefdraai** op voorbeelddata. Het vaste kader eronder is door geen prompt op te heffen.
- **Help-artikelen**: de artikelen voor alle organisaties.
- **Roadmap**: de wensen van alle klanten, met het aantal organisaties en stemmen. **Maak issue** zet een wens op gestart en maakt een issue; dat kan maar één keer.
- **Motor**: de laatste run per klant met de stappen en fouten, en **Draai opnieuw voor deze klant**.
- **Platformaudit**: alles wat founders deden, te filteren op founder, organisatie, handeling en periode.

## Features per niveau vaststellen

Op **Features per niveau** zet je per functie en per niveau een schakelaar aan of uit. Kies bovenaan **Alle organisaties** voor de standaard, of één organisatie voor een afwijking; een afwijking is geel en heeft **Terug naar de standaard**. Een wijziging werkt direct, zonder release, en staat in de audit; met **Draai terug** in de melding zet je hem terug. Een functie buiten het pakket van een klant blijft uit, hoe de schakelaar ook staat. Er zijn geen schakelaars per gebruiker.

## De klantflyout: AI, Data en AVG, opzeggen

### AI-koppeling en prompts

Je ziet of de klant de platformkoppeling, een eigen sleutel of altijd de mock gebruikt. Een eigen sleutel gaat voor die van het platform en vraagt je authenticator-code. Met **Gebruik de platformkoppeling** haal je de eigen koppeling weg. Per promptslot zie je of de klant een eigen laag heeft, met versie en datum; de tekst zelf zie je niet.

### Data en AVG

Alleen aantallen: accounts per bron, contactpersonen (en hoeveel verrijkt of geïmporteerd), leads, activiteiten, verslagen, bijlagen en wie niet benaderd wil worden. Daaronder de bewaartermijnen die de klant koos, de verwerkersovereenkomst (leg versie en datum van ondertekenen vast) en de laatste export door de beheerder. Een export van klantdata maak je als leverancier niet zelf: met **Vraag de beheerder om een export** krijgen de beheerders een melding.

### AVG-verzoeken

Komt er een verzoek binnen (iemand wil verwijderd worden of inzage, of de klant wil alles verwijderd), leg het vast met **Verzoek vastleggen**: de soort, de datum van ontvangst en een kenmerk zoals het ticketnummer. Noteer nooit een naam, e-mailadres of telefoonnummer. Je hebt 30 dagen; daarna staat het verzoek op **Over tijd**. De beheerders krijgen een melding en handelen het af in hun eigen organisatie. Zet het daarna op **Afgehandeld**.

### Organisatie opzeggen

Onderaan de flyout. Je ziet eerst wat er gebeurt, kiest de laatste dag en de reden, en typt de naam van de organisatie over. Pas dan kun je bevestigen, en Dealtrace vraagt je authenticator-code als je die het afgelopen kwartier niet gaf. De klant werkt door tot en met de laatste dag; de beheerders krijgen een melding om te exporteren, en 30 dagen na de laatste dag mogen de gegevens weg. Met **Opzegging intrekken** zet je alles terug zoals het was.

### In de audit

Alles wat je hier doet, staat in de Platformaudit en in de audit van de klant.
