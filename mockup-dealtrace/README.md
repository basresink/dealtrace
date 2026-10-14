# Dealtrace · klikbare mockup

Statische mockup van Dealtrace: HTML, CSS en een klein beetje vanilla JavaScript. Geen buildstap, geen externe scripts. Alle data is fictief (Testbedrijf Voltvast uit Bijlage C van het bouwplan en verzonnen prospects in Midden- en Noord-Nederland).

## Openen

Open `index.html` in een browser (dubbelklik is genoeg, een server is niet nodig). Vandaar kom je bij alle schermen.

Bovenin staat de strook **Mockup-instellingen** met drie keuzes:

- **Niveau**: Beginner, Gevorderd, Expert (hoofdstuk 4).
- **Werkplek**: binnendienst of buitendienst (2.2, 8.4).
- **Rol**: accountmanager, salesmanager, beheerder, founder (3.1).

De keuze staat in `localStorage` (sleutel `dealtrace-mockup-v1`, met try/catch; in een privévenster geldt hij alleen voor de open pagina). Een salesmanager is minimaal Gevorderd; kies je die rol als Beginner, dan zet de mockup het niveau op Expert.

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
| `coaching.html` | Coachingkaart van de salesmanager (F20) |
| `instellingen-belscripts.html` | Instellingen, Belscripts met editor (F08); `#fo-editor` opent de editor |
| `helpcenter.html` | Helpcenter met leerpad per niveau, artikel en AI-vraag (F21) |
| `platform.html` | Platformbeheer met "Werken in een organisatie" en de gele balk (F23) |
| `telefoon.html` | Tien telefoonkaders van 390 bij 844 px (hoofdstuk 8) |
| `mockup.css` | Aanvulling op `../designsysteem/dealdrive-designsysteem.css`: strook, vergrendelde menugroep, mobiele schil, telefoonkaders, nieuwe componenten |
| `mockup.js` | Schil en bediening: iconen (Lucide-sprite), zijbalk volgens tabel 6.1, mobiele kop en onderbalk, schuifvensters, vergrendelde functies, flyouts, tabbladen, toasts, belmodus |
| `shots/` | Schermafbeeldingen van de controle (Playwright, 1440 en 390 px) |

## Schermen per paragraaf

| Paragraaf bouwplan | Scherm |
|---|---|
| 4.2, 4.5 Vergrendeld, niveau zichtbaar | zijbalk op elke pagina, knoppen met slot, `leadgenerator.html` als Beginner, kaart "Jouw niveau" op Vandaag |
| 6.1 Zijbalk per niveau, "Nog te ontgrendelen", flyout "Gevorderd · vergrendeld" | alle laptoppagina's |
| 6.3 Globale elementen (zoeken, Hulp, organisatie-wissel founder) | zijbalk, Ctrl K, knop Hulp in elke paginakop |
| 8.3 Mobiele schil, 8.4 onderbalk per werkplek | alle laptoppagina's onder 768 px, `telefoon.html` |
| 8.5.1 Vandaag | `telefoon.html#tf-vandaag`, `vandaag.html` op 390 px |
| 8.5.2 Route | `telefoon.html#tf-route` |
| 8.5.3 Bezoek afronden | `telefoon.html#tf-afronden`, flyout op `bezoeken.html` |
| 8.5.4 Bellen, belmodus, Hoe ging het? | `telefoon.html#tf-bellen`, `telefoon.html#tf-hoe` |
| 8.5.5 Accountkaart compact | `telefoon.html#tf-account`, `account.html` op 390 px |
| 8.5.6 Spraakopdracht | `telefoon.html#tf-spraak`, knop Inspreken in de mobiele kop |
| 8.5.7 Concepten | `telefoon.html#tf-concepten` |
| 8.4 Meer | `telefoon.html#tf-meer`, tab Meer onder 768 px |
| 8.3 en 8.8 Offline strook | `telefoon.html#tf-offline` |
| 14 Designsysteem | stijlbestand uit `designsysteem/`, plus `mockup.css` |
| F01 Vandaag | `vandaag.html` |
| F02 Leadgenerator | `leadgenerator.html` |
| F03 Prospects en accountkaart | `prospects.html`, `account.html` |
| F07 Belblokken en belmodus | `belblokken.html` |
| F08 Belscripts | belmodus, `instellingen-belscripts.html` |
| F10 Bezoeken en kansen langs de route | `bezoeken.html` |
| F12 Campagnes | `campagnes.html` |
| F20 Coaching | `coaching.html` |
| F21 Helpcenter | `helpcenter.html` |
| F23 Platformbeheer | `platform.html` |
| F25 Verkoopverhaal en Richting | `richting.html`, accountkaart, belmodus |
| Bijlage C Voltvast | `richting.html` (branches, concurrenten, winpunten, terugkomregels) |

## Wat werkt

- Wisselen van niveau, werkplek en rol werkt op elke pagina: zijbalkitems en hun volgorde (binnendienst Belblokken boven Bezoeken, buitendienst andersom), de groep "Nog te ontgrendelen" met teller en slot, het gebruikersblok ("ACCOUNTMANAGER · BEGINNER"), blokken die pas vanaf Gevorderd of Expert verschijnen, de onderbalk en het Meer-venster.
- Een klik op een vergrendeld item opent de flyout met "Wat het doet", "Wanneer het opengaat" (criteria uit 4.4 met voortgang), "Tot die tijd" en "Vraag je salesmanager". Een directe link naar een vergrendelde pagina toont de kop met kicker "Vergrendeld", geen foutpagina. Pagina's buiten je rol tonen een uitleg.
- Belmodus: script met variabelen uit het verkoopverhaal (knop "Toon variabelen" toont de codes, een onbekende variabele is geel met terugvalzin), bezwaren per concurrent die uitklappen en de concurrent vastleggen, uitkomstknoppen die naar het volgende gesprek gaan, blokresultaat.
- Founder: "Werk in deze organisatie" vraagt een reden van minimaal 5 tekens en een modus; daarna staat de gele balk op elke pagina tot "Terug naar platform".
- Flyouts, schuifvensters, tabbladen, filterpillen, schakelaars en toasts reageren. Escape sluit de bovenste laag.

## Bewust niet uitgewerkt

- Agenda, Acties, Contacten, Pipeline, Inzichten, Prospectplanning, Prospectreizen, Mijn resultaten, Team, Analyse, Audit, Mijn instellingen, Roadmap en de overige instellingen- en platformpagina's staan in het menu maar hebben geen eigen scherm; een klik geeft een melding.
- Geen echte data, opslag, spraak, navigatie of telefonie: knoppen tonen een melding. `tel:`-links staan er wel.
- De kaart is de minikaart van het designsysteem met geplaatste pinnen, geen echte kaart.
- Het werkplekprofiel hybride, het pakket (Starter, Plus, Compleet), zonlicht- en handschoenmodus en de tabletschil van 768 tot 1023 px zijn niet als keuze opgenomen.
- Het stijlbestand van het designsysteem laadt Source Serif 4 en Inter via een `@import` van Google Fonts. Zonder internet valt de mockup terug op Georgia en het systeemlettertype; de mockup zelf laadt niets van buiten.
