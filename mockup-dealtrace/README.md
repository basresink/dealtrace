# Dealtrace · klikbare mockup

Statische mockup van Dealtrace, bijgewerkt naar bouwplan versie 1.4: HTML, CSS en een klein beetje vanilla JavaScript. Geen buildstap, geen externe scripts. Alle data is fictief (Testbedrijf Voltvast uit Bijlage C van het bouwplan en verzonnen prospects in Midden- en Noord-Nederland).

## Openen

Open `index.html` in een browser (dubbelklik is genoeg, een server is niet nodig). Vandaar kom je bij alle schermen.

Bovenin staat de strook **Mockup-instellingen** met drie keuzes:

- **Niveau**: Beginner, Gevorderd, Expert (hoofdstuk 4).
- **Werkplek**: binnendienst of buitendienst (2.2, 8.4).
- **Rol**: accountmanager, salesmanager, beheerder, founder (3.1).

De keuze staat in `localStorage` (sleutel `dealtrace-mockup-v1`, met try/catch; in een privévenster geldt hij alleen voor de open pagina). Een salesmanager is minimaal Gevorderd; kies je die rol als Beginner, dan zet de mockup het niveau op Expert.

## Wat er veranderd is (versie 1.4)

- **Tot en met de eerste afspraak (B17).** Het oude menu-item voor verkoopkansen is Funnel geworden (`funnel.html`, F17), in de zijbalk volgens tabel 6.1 op elk niveau (een Beginner heeft nu 11 items) en in het Meer-venster. De Beginner ziet aantallen per fase en waar het stokt; conversie, doorlooptijd, uitval en pogingen tot afspraak komen vanaf Gevorderd. Op de accountkaart staan "Eerstvolgende afspraak" en "Volgende stap" in plaats van de tellers voor verkoopkansen en prijsvoorstellen, en het tabblad Reis in plaats van het tabblad voor verkoopkansen. Bezoek afronden heeft de uitkomst "Vervolg afgesproken" met daaronder de vraag "Overdragen?" (DealDrive, CRM of collega); op Vandaag staan eerste afspraken die nog overgedragen moeten worden. De Voltvast-namen uit Bijlage C die het woord voor een prijsvoorstel bevatten, heten in de mockup "Voorstel · na de overdracht" (winpunt wp-02) en "Verloren na voorstel" (terugkomregel hc-01).
- **Geen voortgang naar een volgend niveau (B19).** Geen niveaukaart met voortgangsbalken, geen criteria en geen verzoekknop. De groep in de zijbalk en in Meer heet "Nog niet aangezet"; de flyout heeft kicker "Gevorderd · nog niet aangezet", "Wat het doet", "Tot die tijd" en "Lees hoe het werkt". Op de coachingkaart staat "Wijzig niveau". Het helpcenter heeft "Voor jou" in plaats van een leerpad per niveau.
- **Features per niveau (B18).** `platform.html`, tabblad Features per niveau (`platform.html#pl-features`): raster met functies als rijen en Beginner, Gevorderd, Expert als kolommen; elke cel is klikbaar; keuze "Alle organisaties" of één organisatie, afwijkende cellen met een gele rand; laatste wijzigingen met "Draai terug".
- **AI-assistent (F26).** Knop "Vraag AI" in de paginakop van elke laptoppagina en in de compacte kop op de telefoon (naast de microfoon), en "AI-assistent" in Meer. Laptop: flyout rechts van 480 px die open blijft; telefoon: schuifvenster. Met contextchip, creditstand, voorstelvragen, een voorbeeldgesprek met bronchips, "Zet als taak klaar", "Maak mailconcept" en "De assistent voert niets uit. Jij beslist." In het helpcenter vervangt "Vraag AI" de knop "Stel je vraag".
- **Credits (11.4).** `platform.html#pl-abonnementen`: 200, 600 en 1.500 credits per gebruiker per maand per pakket; `platform.html#pl-verbruik`: verbruik per AI-soort en de creditmeter zoals de beheerder hem ziet. Op `instellingen-belscripts.html` staat de creditmeter voor de beheerder; de leadgenerator rekent zoekrondes en dossiers in credits. Testbedrijf Voltvast staat in de mockup op Compleet (9 gebruikers, pot 13.500).

## Bestanden

| Bestand | Wat |
|---|---|
| `index.html` | Overzicht met links naar alle schermen |
| `vandaag.html` | Vandaag (F01); onder 768 px de telefoonweergave uit 8.5.1 |
| `prospects.html` | Top deze week en Alle prospects (F03) |
| `account.html` | Accountkaart Brontsma Installatietechniek met Branche, Huidige leverancier met "Zo zeg je het", Terug op (F03, F25); onder 768 px de compacte kaart uit 8.5.5 |
| `belblokken.html` | Belblokken en de belmodus (F07, F08, F25); `belblokken.html#start` opent de belmodus direct |
| `bezoeken.html` | Route en kansen langs de route, tussenstop en bezoek afronden (F10) |
| `leadgenerator.html` | Leadgenerator met Zoeken, Importeren, Koppelingen, Rondes en verbruik (F02); vanaf Gevorderd |
| `richting.html` | Verkoopverhaal met tabbladen Verhaal, Richting, Belofte, Branches, Concurrenten, Winpunten, Terugkomen (F25, Bijlage C) |
| `campagnes.html` | Campagnelijst, bord en wizardstap (F12) |
| `funnel.html` | Funnel van de prospectreis met stokpunt, uitval, pogingen tot afspraak, overdracht en accountlijst (F17); op 390 px verticaal |
| `coaching.html` | Coachingkaart van de salesmanager met "Wijzig niveau" en de trechter naast het team (F20) |
| `instellingen-belscripts.html` | Instellingen, Belscripts met editor (F08) en de creditmeter van de organisatie (11.4); `#fo-editor` opent de editor |
| `helpcenter.html` | Helpcenter met Voor jou, collecties, artikel en Vraag AI (F21, F26) |
| `platform.html` | Platformbeheer met tabbladen Klanten ("Werken in een organisatie", gele balk), Abonnementen (credits per pakket), Features per niveau en AI-verbruik en credits (F23, 4.2, 11.4); `#pl-features`, `#pl-abonnementen` en `#pl-verbruik` openen een tabblad |
| `telefoon.html` | Elf telefoonkaders van 390 bij 844 px (hoofdstuk 8 en de AI-assistent uit F26) |
| `mockup.css` | Aanvulling op `../designsysteem/dealdrive-designsysteem.css`: strook, menugroep "Nog niet aangezet", mobiele schil, telefoonkaders, AI-assistent, funnel, niveauraster, creditmeter |
| `mockup.js` | Schil en bediening: iconen (Lucide-sprite), zijbalk volgens tabel 6.1, mobiele kop en onderbalk, schuifvensters, functies die nog niet aanstaan, AI-assistent, flyouts, tabbladen, toasts, belmodus |
| `shots/` | Schermafbeeldingen van de controle (Playwright, 1440 en 390 px) |

## Schermen per paragraaf

| Paragraaf bouwplan | Scherm |
|---|---|
| 4.2 Features aan en uit per niveau | `platform.html#pl-features` |
| 4.4 Niveau zichtbaar, functies die niet aanstaan | zijbalk op elke pagina, knoppen met slot, `leadgenerator.html` als Beginner, lege staten "Nog niet aangezet" op Vandaag en Funnel |
| 6.1 Zijbalk per niveau met Funnel (Beginner 11 items), groep "Nog niet aangezet", flyout "Gevorderd · nog niet aangezet" | alle laptoppagina's |
| 6.3 Globale elementen (zoeken, Hulp, Vraag AI, organisatie-wissel founder) | zijbalk, Ctrl K, knoppen Hulp en Vraag AI in elke paginakop |
| 7.1, 7.2 Tot en met de eerste afspraak, status overgedragen | `funnel.html`, accountkaart (tabblad Reis), Bezoek afronden met "Overdragen?" |
| 8.3 Mobiele schil met Vraag AI naast de microfoon, 8.4 onderbalk per werkplek | alle laptoppagina's onder 768 px, `telefoon.html` |
| 8.5.1 Vandaag | `telefoon.html#tf-vandaag`, `vandaag.html` op 390 px |
| 8.5.2 Route | `telefoon.html#tf-route` |
| 8.5.3 Bezoek afronden met "Vervolg afgesproken" en "Overdragen?" | `telefoon.html#tf-afronden`, `bezoeken.html#fo-afronden` |
| 8.5.4 Bellen, belmodus, Hoe ging het? | `telefoon.html#tf-bellen`, `telefoon.html#tf-hoe` |
| 8.5.5 Accountkaart compact | `telefoon.html#tf-account`, `account.html` op 390 px |
| 8.5.6 Spraakopdracht | `telefoon.html#tf-spraak`, knop Inspreken in de mobiele kop |
| 8.5.7 Concepten | `telefoon.html#tf-concepten` |
| 8.4 Meer met Funnel en AI-assistent | `telefoon.html#tf-meer`, tab Meer onder 768 px |
| 8.3 en 8.8 Offline strook | `telefoon.html#tf-offline` |
| 14 Designsysteem | stijlbestand uit `designsysteem/`, plus `mockup.css` |
| F01 Vandaag | `vandaag.html` |
| F02 Leadgenerator | `leadgenerator.html` |
| F03 Prospects en accountkaart | `prospects.html`, `account.html` |
| F07 Belblokken en belmodus | `belblokken.html` |
| F08 Belscripts | belmodus, `instellingen-belscripts.html` |
| F10 Bezoeken en kansen langs de route | `bezoeken.html` |
| F09 Afspraak afronden en overdragen | `bezoeken.html#fo-afronden`, `telefoon.html#tf-afronden` |
| F12 Campagnes | `campagnes.html` |
| F17 Funnel van de prospectreis en overdracht | `funnel.html` (laptop en 390 px) |
| F20 Coaching, Wijzig niveau | `coaching.html` |
| F21 Helpcenter | `helpcenter.html` |
| F23 Platformbeheer, Features per niveau | `platform.html`, `platform.html#pl-features` |
| F26 AI-assistent | knop Vraag AI op elke pagina, `telefoon.html#tf-ai`, `helpcenter.html` |
| 11.4 Credits | `platform.html#pl-abonnementen`, `platform.html#pl-verbruik`, creditmeter op `instellingen-belscripts.html` |
| F25 Verkoopverhaal en Richting | `richting.html`, accountkaart, belmodus |
| Bijlage C Voltvast | `richting.html` (branches, concurrenten, winpunten, terugkomregels) |

## Wat werkt

- Wisselen van niveau, werkplek en rol werkt op elke pagina: zijbalkitems en hun volgorde (binnendienst Belblokken boven Bezoeken, buitendienst andersom), de groep "Nog niet aangezet" met teller en slot, het gebruikersblok ("ACCOUNTMANAGER · BEGINNER"), blokken die pas vanaf Gevorderd of Expert verschijnen, de onderbalk en het Meer-venster.
- Een klik op een item dat nog niet aanstaat opent de flyout met kicker "Gevorderd · nog niet aangezet", "Wat het doet", "Tot die tijd" en "Lees hoe het werkt", zonder verzoekknop. Een directe link naar zo'n pagina toont de kop met kicker "Nog niet aangezet", geen foutpagina. Pagina's buiten je rol tonen een uitleg.
- Vraag AI opent de AI-assistent: de contextchip is weg te klikken, een voorstelvraag vult de invoer, de acties zetten alleen een concept klaar.
- Features per niveau: elke cel wisselt tussen Aan en Uit; bij één organisatie krijgt een afwijkende cel een gele rand.
- Funnel: een klik op een fase of uitvalreden zet de lijst onderaan op die fase.
- Belmodus: script met variabelen uit het verkoopverhaal (knop "Toon variabelen" toont de codes, een onbekende variabele is geel met terugvalzin), bezwaren per concurrent die uitklappen en de concurrent vastleggen, uitkomstknoppen die naar het volgende gesprek gaan, blokresultaat.
- Founder: "Werk in deze organisatie" vraagt een reden van minimaal 5 tekens en een modus; daarna staat de gele balk op elke pagina tot "Terug naar platform".
- Flyouts, schuifvensters, tabbladen, filterpillen, schakelaars en toasts reageren. Escape sluit de bovenste laag.

## Bewust niet uitgewerkt

- Agenda, Acties, Contacten, Inzichten, Prospectplanning, Prospectreizen, Mijn resultaten, Team, Analyse, Audit, Mijn instellingen, Roadmap en de overige instellingen- en platformpagina's (Facturen, AI-koppeling, Prompts, Help, Roadmap, Motor, Audit) staan in het menu maar hebben geen eigen scherm; een klik geeft een melding.
- Geen echte data, opslag, spraak, navigatie of telefonie: knoppen tonen een melding. `tel:`-links staan er wel.
- De kaart is de minikaart van het designsysteem met geplaatste pinnen, geen echte kaart.
- Het werkplekprofiel hybride, het pakket (Starter, Plus, Compleet), zonlicht- en handschoenmodus en de tabletschil van 768 tot 1023 px zijn niet als keuze opgenomen.
- Het stijlbestand van het designsysteem laadt Source Serif 4 en Inter via een `@import` van Google Fonts. Zonder internet valt de mockup terug op Georgia en het systeemlettertype; de mockup zelf laadt niets van buiten.
