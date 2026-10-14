# Brief voor schrijvers · Featurebeschrijvingen DealDrive als input voor Dealtrace (14 oktober 2026)

## Doel

Dealtrace wordt een tool voor new business door actieve accountmanagers, binnendienst én buitendienst. Om die gericht
te bouwen, beschrijven we hoe de bestaande features van DealDrive werken, zo volledig dat een ontwerper en een bouwer
die DealDrive nooit zagen, de feature kunnen begrijpen, beoordelen en verbeteren. Jij beschrijft de feature(s) uit je
opdracht. Je wijzigt niets in de code.

Lezer: een productowner en een bouwer van Dealtrace. Schrijf zakelijk Nederlands in de je-vorm, concreet, zonder
gedachtestreepjes (— of –) en zonder Engelse termen waar een Nederlandse bestaat. Noem knoppen, kolommen, filters en
teksten letterlijk zoals ze op het scherm staan (tussen aanhalingstekens).

## Bronnen

- De app: `C:\Projecten\dealdrive` (Nuxt 4). Lees de pagina's (`app/pages`), componenten (`app/components`), composables
  (`app/composables`), gedeelde logica (`shared`), server (`server/api`, `server/utils`) en het handboek
  `docs/HOE-DEALDRIVE-WERKT.md` (zoek de hoofdstukken van je feature). Het onderzoek in
  `C:\Projecten\newbusiness-docs\prompts\dealdrive-leadgeneratie-bouwprompts.md` heeft veel regels met bestandsnamen en
  regelnummers: gebruik het als startpunt, maar controleer in de code.
- De draaiende app in mock-modus (demodata, geen echte gegevens): http://localhost:3088 met cookie
  `dealdrive_session=user-bas` (beheerder). **Start of stop de server niet.** Andere schrijvers gebruiken hem tegelijk.
- Schermafbeeldingen: Playwright uit de DealDrive-map in een `.mjs`-script dat je met de Write-tool schrijft:
  ```js
  import { createRequire } from 'node:module'
  const require = createRequire('C:/Projecten/dealdrive/package.json')
  const { chromium } = require('@playwright/test')
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await ctx.addCookies([{ name: 'dealdrive_session', value: 'user-bas', url: 'http://localhost:3088' }])
  const page = await ctx.newPage()
  await page.goto('http://localhost:3088/prospects/alle', { waitUntil: 'networkidle' })
  await page.screenshot({ path: '<pad>.png' })            // alleen het zichtbare deel, niet fullPage
  ```
  Wacht na een klik op een flyout tot hij zichtbaar is (`await page.waitForTimeout(600)`). Eén browser tegelijk, sluit
  hem aan het eind. Maak per feature 3 tot 8 schermafbeeldingen: de pagina, de belangrijkste flyouts of vensters, een
  filter- of keuzemenu dat open staat, en een detailscherm. Sla ze op als PNG in
  `C:\Projecten\newbusiness-docs\dealtrace-input\shots\<feature>-<n>-<onderwerp>.png` (kleine letters, geen spaties).
- Je mag in de mockapp klikken, filteren, flyouts openen en formulieren invullen. Opslaan in de mock mag ook (er is geen
  database), maar het hoeft niet.

## Wat je per feature beschrijft (vaste opbouw)

Gebruik voor elke feature precies deze kopjes, in deze volgorde. Laat een kopje weg alleen als het echt niet van toepassing
is, en zeg dan waarom in één zin onder het vorige kopje.

1. **Wat het is en waarvoor** · wat de feature betekent voor een accountmanager en een salesmanager, welk probleem hij
   oplost, waar hij in de dag of week valt, en hoe hij samenhangt met andere features (welke data hij leest en schrijft).
2. **Waar je het vindt** · menu, route(s), wie het ziet (rol, functievlag), hoe je er vanuit andere schermen komt.
3. **Opbouw van de pagina** · van boven naar beneden: kop (kicker, titel, subtitel), knoppen rechtsboven, statkaarten,
   filters en weergaven, lijsten, kaarten, tabellen, kolommen, lege staten. Bij elke kolom of kaart wat erin staat en
   waar het getal vandaan komt.
4. **Doorklikken: de stappen** · genummerde klikpaden voor de 3 tot 6 belangrijkste taken ("1. Klik op …, 2. In de flyout
   … 3. …"), met wat er na elke klik gebeurt.
5. **Flyouts, vensters en knoppen** · per flyout of venster: hoe hij opent, kop, blokken, velden (met verplicht/optioneel,
   standaardwaarde, validatie), knoppen onderaan en wat ze doen, bevestigingen, toasts, Escape en sluiten.
6. **Filters, zoeken, sorteren en weergaven** · elke filter en zijn waarden, hoe tellers rekenen, combinaties, reset,
   wat in de URL komt.
7. **Regels en berekeningen** · de logica achter de schermen: formules, drempels, statussen en overgangen, prioriteiten,
   cadansen, wat automatisch gebeurt (motor, jobs), wat de AI doet en wat niet. Met concrete getallen uit de code.
8. **Gegevens** · welke velden een record heeft (in gewone taal, met de veldnaam tussen haakjes), waar het opgeslagen
   wordt, wat van andere features komt.
9. **Wat dit betekent voor Dealtrace** · 4 tot 8 bullets: wat je zo zou overnemen, wat je anders zou doen voor new
   business door binnendienst en buitendienst, en wat ontbreekt. Wees concreet en kort.

Schrijf ruim: een feature krijgt doorgaans 1.500 tot 3.000 woorden. Feiten uit de code, geen aannames. Waar iets in de
code anders werkt dan het scherm of het handboek belooft, zeg dat.

## Uitvoerformaat (verplicht, voor de omzetting naar Word)

Schrijf één bestand per feature: `C:\Projecten\newbusiness-docs\dealtrace-input\secties\<nr>-<feature>.md` met de
Write-tool. Gebruik alleen deze opmaak, zodat de omzetter het begrijpt:

- `# <Naam van de feature>` als eerste regel (precies één `#` per bestand).
- `## ` voor de negen vaste kopjes, `### ` voor subkopjes (bijvoorbeeld per flyout).
- Gewone alinea's: één alinea per regel, lege regel ertussen.
- Opsommingen met `- ` aan het begin; genummerde stappen met `1. `, `2. ` (geen geneste lijsten).
- **vet** met dubbele sterretjes is toegestaan binnen een regel; geen cursief, geen links, geen code-blokken, geen HTML.
- Tabellen: een kopregel `| a | b |`, dan `|---|---|`, dan rijen. Maximaal 5 kolommen, korte cellen.
- Afbeelding: een eigen regel `![Bijschrift in één zin](shots/<bestandsnaam>.png)`.

Controleer aan het eind: geen gedachtestreepjes, alle afbeeldingsbestanden bestaan, één `#`.
