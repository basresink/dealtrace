# Brief voor schrijvers · Featurebeschrijvingen DealDrive HQ (founder-console) (14 oktober 2026)

## Doel

Dealtrace wordt een tool voor new business door actieve accountmanagers, binnendienst en buitendienst. Naast de
werkplek voor verkopers heeft Dealtrace een founder-console nodig, zoals DealDrive HQ: klanten (organisaties) en
gebruikers beheren, abonnementen en facturen, de AI-koppeling en agent-prompts, en de roadmap. Om die gericht te
bouwen, beschrijven we hoe DealDrive HQ werkt, zo volledig dat een ontwerper en een bouwer die HQ nooit zagen, de
feature kunnen begrijpen, beoordelen en verbeteren. Jij beschrijft de feature(s) uit je opdracht. Je wijzigt niets in
de code.

Lezer: een productowner en een bouwer van Dealtrace. Schrijf zakelijk Nederlands in de je-vorm, concreet, zonder
gedachtestreepjes (— of –) en zonder Engelse termen waar een Nederlandse bestaat. Noem knoppen, kolommen, filters en
teksten letterlijk zoals ze op het scherm staan (tussen aanhalingstekens).

## Bronnen

- De code: `C:\Projecten\dealdrive` (Nuxt 4). HQ is een aparte build van dezelfde repo (`DEALDRIVE_APP=hq`): alleen de
  routes onder `/admin` plus `/login` en `/wachtwoord-instellen` (zie `shared/omgeving.ts` en `nuxt.config.ts`).
  Schermen: `app/pages/admin/*.vue`, `app/components/AdminShell.vue` en de componenten die zij gebruiken. Server:
  `server/api/superuser/**` en wat die aanroepen in `server/utils`. Handboek: `docs/HOE-DEALDRIVE-WERKT.md`, hoofdstuk 3
  "De founder-console (DealDrive HQ)" (vanaf regel 1471).
- De draaiende HQ in mock-modus (geen database, geen echte gegevens): http://localhost:3096 met cookie
  `dealdrive_session=user-bas` (founder). **Start of stop de server niet.** Andere schrijvers gebruiken hem tegelijk.
  De mock begint zonder klanten. Maak in de mock zelf fictieve klanten of gegevens aan (bijvoorbeeld "Voorbeeld
  Installatietechniek BV") als je gevulde schermen nodig hebt. Gebruik alleen fictieve namen.
- **Verboden:** poort 3089, de echte HQ, en elke andere server dan localhost:3096 (en voor de werkplek alleen
  localhost:3088, ook mock). De `.env` en de echte servers wijzen naar productie. Open, lees of source `.env` nooit.
  Draai geen `npm run`-scripts en geen database- of migratiescripts.
- Schermafbeeldingen: Playwright uit de DealDrive-map in een `.mjs`-script dat je met de Write-tool schrijft:
  ```js
  import { createRequire } from 'node:module'
  const require = createRequire('C:/Projecten/dealdrive/package.json')
  const { chromium } = require('@playwright/test')
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await ctx.addCookies([{ name: 'dealdrive_session', value: 'user-bas', url: 'http://localhost:3096' }])
  const page = await ctx.newPage()
  await page.goto('http://localhost:3096/admin', { waitUntil: 'networkidle' })
  await page.screenshot({ path: '<pad>.png' })            // alleen het zichtbare deel, niet fullPage
  ```
  Wacht na een klik op een flyout tot hij zichtbaar is (`await page.waitForTimeout(600)`). Eén browser tegelijk, sluit
  hem aan het eind. Maak per feature 3 tot 8 schermafbeeldingen: de pagina, de belangrijkste flyouts of vensters, een
  filter- of keuzemenu dat open staat, en een detailscherm. Sla ze op als PNG in
  `C:\Projecten\Dealtrace\newbusiness-docs\hq-input\shots\<feature>-<n>-<onderwerp>.png` (kleine letters, geen spaties).
- Je mag in de mock klikken, filteren, flyouts openen en formulieren invullen en opslaan (er is geen database).
  Klik niet op dingen die een externe dienst aanroepen (mail versturen, GitHub, Stripe, Moneybird, een echte LLM-test):
  beschrijf die uit de code.

## Wat je per feature beschrijft (vaste opbouw)

Gebruik voor elke feature precies deze kopjes, in deze volgorde. Laat een kopje weg alleen als het echt niet van
toepassing is, en zeg dan waarom in één zin onder het vorige kopje.

1. **Wat het is en waarvoor** · wat de feature betekent voor de founder en het team achter het product, welk probleem
   hij oplost, wanneer je hem gebruikt, en hoe hij samenhangt met de klantapp en andere HQ-schermen (welke data hij
   leest en schrijft).
2. **Waar je het vindt** · menu, route(s), wie het ziet (rol), hoe je er vanuit andere schermen komt.
3. **Opbouw van de pagina** · van boven naar beneden: kop (kicker, titel, subtitel), knoppen rechtsboven, statkaarten,
   filters en weergaven, lijsten, kaarten, tabellen, kolommen, lege staten. Bij elke kolom of kaart wat erin staat en
   waar het getal vandaan komt.
4. **Doorklikken: de stappen** · genummerde klikpaden voor de 3 tot 6 belangrijkste taken, met wat er na elke klik
   gebeurt.
5. **Flyouts, vensters en knoppen** · per flyout of venster: hoe hij opent, kop, blokken, velden (verplicht/optioneel,
   standaardwaarde, validatie), knoppen onderaan en wat ze doen, bevestigingen, toasts, Escape en sluiten.
6. **Filters, zoeken, sorteren en weergaven** · elke filter en zijn waarden, hoe tellers rekenen, combinaties, reset,
   wat in de URL komt.
7. **Regels en berekeningen** · de logica achter de schermen: formules, drempels, statussen en overgangen, rechten en
   beveiliging (wie mag wat, hoe HQ van de klantapp gescheiden is), koppelingen met externe diensten, wat automatisch
   gebeurt. Met concrete getallen uit de code.
8. **Gegevens** · welke velden een record heeft (in gewone taal, met de veldnaam tussen haakjes), waar het opgeslagen
   wordt, wat van andere features komt.
9. **Wat dit betekent voor Dealtrace** · 4 tot 8 bullets: wat je zo zou overnemen in de founder-console van Dealtrace,
   wat je anders zou doen voor een new business-tool (bijvoorbeeld kosten van agents en dataverrijking per klant,
   LinkedIn-limieten, AVG en herkomst van data), en wat ontbreekt.

Schrijf ruim: een feature krijgt doorgaans 1.500 tot 3.000 woorden. Feiten uit de code, geen aannames. Waar iets in de
code anders werkt dan het scherm of het handboek belooft, zeg dat. Waar de mock anders werkt dan productie (bijvoorbeeld
lege lijsten of nepkoppelingen), zeg dat ook.

## Uitvoerformaat (verplicht, voor de omzetting naar Word)

Schrijf één bestand per feature: `C:\Projecten\Dealtrace\newbusiness-docs\hq-input\secties\<nr>-<feature>.md` met de
Write-tool. Gebruik alleen deze opmaak, zodat de omzetter het begrijpt:

- `# <Naam van de feature>` als eerste regel (precies één `#` per bestand).
- `## ` voor de negen vaste kopjes, `### ` voor subkopjes (bijvoorbeeld per flyout).
- Gewone alinea's: één alinea per regel, lege regel ertussen.
- Opsommingen met `- ` aan het begin; genummerde stappen met `1. `, `2. ` (geen geneste lijsten).
- **vet** met dubbele sterretjes is toegestaan binnen een regel; geen cursief, geen links, geen code-blokken, geen HTML.
- Tabellen: een kopregel `| a | b |`, dan `|---|---|`, dan rijen. Maximaal 5 kolommen, korte cellen.
- Afbeelding: een eigen regel `![Bijschrift in één zin](shots/<bestandsnaam>.png)`.

Controleer aan het eind: geen gedachtestreepjes, alle afbeeldingsbestanden bestaan, één `#`.
