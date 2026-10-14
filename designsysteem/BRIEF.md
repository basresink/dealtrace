# Brief · Designsysteem DealDrive als stijlbestand en opbouwdocument voor Dealtrace (14 oktober 2026)

## Doel

Dealtrace (new business voor actieve accountmanagers, binnendienst en buitendienst) wordt gebouwd in de huisstijl van
DealDrive. We maken één compleet stijlbestand en één opbouwdocument dat beschrijft hoe elk onderdeel in DealDrive is
opgebouwd: flyouts, vensters, knoppen (opslaan, bewerken, verwijderen, annuleren, filter, weergave, enzovoort), links,
lettertypen, kleuren, en alles wat verder in de app terugkomt. Een bouwer moet met deze twee bestanden Dealtrace in één
keer goed kunnen stylen, zonder DealDrive te openen. Alles wordt afgeleid uit de **hele** DealDrive-app, niet uit een
paar pagina's. Je wijzigt niets in de DealDrive-code.

Er is een eerder, kleiner stijlbestand: `C:\Projecten\Dealtrace\newbusiness-docs\docs\dealdrive-leadgeneratie-stijl.css`
(met klasseprefixen zoals .dd-actie, .dd-act, .pil, .tag, .stat, .rij, .tabel, .veld, .invoer, .fo, .cd, .toast,
.tabbalk, .kanban, .lege-staat, .kaart, .voortgang). Neem die naamgeving over waar ze bestaat, zodat het nieuwe bestand
de opvolger is. Vul aan wat ontbreekt en corrigeer wat niet klopt met de app.

## Bronnen

- `C:\Projecten\dealdrive`: `app/assets/css/tokens.css` (alle CSS-variabelen), `app/assets/css/fonts.css`,
  `tailwind.config.ts`, `.stylelintrc.json`, `nuxt.config.ts` (fonts), en de `<style>`-blokken van alle componenten in
  `app/components` (124) en pagina's in `app/pages` (inclusief `admin`). Belangrijke componenten: AppSidebar, AdminShell,
  MobileShell, de *Flyout.vue-componenten (ongeveer 40), ConfirmDialog, ContextMenu, EditableField, InlineEditChip,
  LegeStaat, NotificationBell, GlobaleZoek, meldingen en toasts, tabellen en rijen (AccountRow), kaarten (LeadCard,
  BriefingCard), pillen en badges (BandBadge). Zoek met grep naar terugkerende klassen en waarden en tel hoe vaak iets
  voorkomt, zodat je de echte standaard pakt en uitzonderingen als uitzondering noemt.
- De draaiende app in mock-modus: http://localhost:3088 (werkplek) en http://localhost:3096 (HQ), cookie
  `dealdrive_session=user-bas`. **Start of stop geen servers.** Gebruik nooit poort 3089 of een andere server; lees
  nooit `.env`; draai geen npm-scripts. Gebruik `getComputedStyle` via Playwright om echte waarden te meten (hoogte van
  knoppen, padding en breedte van flyouts, lettergrootte van koppen, duur van animaties).
- Playwright uit de DealDrive-map in een `.mjs`-script (Write-tool):
  ```js
  import { createRequire } from 'node:module'
  const require = createRequire('C:/Projecten/dealdrive/package.json')
  const { chromium } = require('@playwright/test')
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await ctx.addCookies([{ name: 'dealdrive_session', value: 'user-bas', url: 'http://localhost:3088' }])
  const page = await ctx.newPage()
  await page.goto('http://localhost:3088/taken', { waitUntil: 'networkidle' })
  ```
  Eén browser tegelijk, sluit hem aan het eind. Maak 2 tot 6 schermafbeeldingen per deel (zichtbaar deel of een uitsnede
  met `locator.screenshot`) als PNG in
  `C:\Projecten\Dealtrace\newbusiness-docs\designsysteem\shots\<deel>-<n>-<onderwerp>.png`.

## Wat je oplevert (per deel)

Drie schrijvers werken tegelijk, elk aan één deel. Iedereen gebruikt **dezelfde tokennamen als tokens.css van
DealDrive**, precies zoals ze daar heten. Deel A definieert de tokens; B en C gebruiken ze alleen en definiëren er geen
nieuwe. Heeft B of C een waarde nodig die geen token is, noteer die dan als letterlijke waarde met een opmerking, en zet
hem in je verslag onder "token gewenst".

Alle bestanden komen in `C:\Projecten\Dealtrace\newbusiness-docs\designsysteem\delen\`:

1. `<deel>.css` · jouw stuk van het stijlbestand. Bovenaan per groep een commentaarblok met: waar het in DealDrive
   vandaan komt (bestanden), hoe vaak het voorkomt, en de opbouw in HTML (welke elementen en klassen). Kleuren alleen
   via `var()`, geen box-shadow, hoeken en andere regels zoals `.stylelintrc.json` van DealDrive ze afdwingt. Geen
   gedachtestreepjes in commentaar. Inclusief hover, focus-visible, actief, uitgeschakeld, laden, fout, mobiel (de
   breekpunten van DealDrive) en `prefers-reduced-motion`.
2. `<deel>.md` · jouw hoofdstukken van het opbouwdocument. Per onderdeel: wat het is, wanneer je het gebruikt (en
   wanneer niet), de HTML-opbouw (elementen en klassen), alle varianten en toestanden met maten en kleuren (tabel),
   gedrag (openen, sluiten, Escape, focus, toetsenbord, animatie, toast na opslaan, bevestiging bij verwijderen), de
   teksten die DealDrive gebruikt (bijvoorbeeld de exacte knopteksten "Opslaan", "Annuleren", "Verwijderen"), en waar
   het in DealDrive staat. Opmaak: `# ` alleen voor de deeltitel, `## ` per onderdeel, `### ` subkoppen, `- `
   opsommingen, `1. ` stappen, tabellen `| a | b |` met `|---|`, maximaal 5 kolommen, **vet** binnen een regel,
   afbeeldingen op een eigen regel `![Bijschrift](shots/<bestand>.png)`. Korte HTML-voorbeelden mogen in een codeblok
   met drie backticks.
3. `<deel>.html` · een HTML-fragment (alleen de inhoud van `<body>`, geen `<html>`, `<head>` of `<style>`) dat elk
   onderdeel uit jouw deel toont met alleen de klassen uit het stijlbestand, in alle varianten en toestanden, met
   Nederlandse voorbeeldteksten en fictieve namen. Elk onderdeel in een `<section class="ds-blok" id="<onderdeel>">` met
   een `<h2 class="ds-kop">`. Voor toestanden mag je klassen als `.is-hover` en `.is-focus` gebruiken die in jouw CSS
   dezelfde stijl krijgen als `:hover` en `:focus-visible`. Een flyout of venster toon je open en statisch in een kader
   `<div class="ds-podium">` (position relative, hoogte 560px, overflow hidden), niet over de hele pagina. De klassen
   `.ds-*` schrijf je niet zelf; die levert de voorbeeldpagina.

Schrijf zakelijk Nederlands, zonder gedachtestreepjes (— of –). Feiten uit de code en metingen, geen aannames. Waar
DealDrive inconsistent is (bijvoorbeeld twee knopstijlen voor hetzelfde), kies de meest gebruikte, noem de andere en
zeg waarom.

## Verdeling

- **Deel A · fundament** (`a-fundament`): alle tokens (kleuren met hun rol, semantische kleuren goed, waarschuwing, fout
  en info, merkgeel, eventueel donkere varianten), lettertypen (families, hoe geladen, fallback), typografische schaal
  en rollen (kicker, paginatitel, subtitel, sectiekop, broodtekst, label, cijfers met tabular-nums, mono), links (in
  tekst, in tabellen, navigatielinks, terug-link, extern), iconen (Lucide: maten en lijndikte), spacing, randen en hoeken,
  z-index-lagen, overgangen en animatieduur, breekpunten, reset en basis, focusring, selectie, scrollbalken, en de
  app-schil: zijbalk (AppSidebar en AdminShell: groepen, actief item, inklappen), paginakop (kicker, titel, subtitel,
  knoppen rechtsboven), paginaraster, secties en containers, statkaarten, mobiele schil (MobileShell, onderbalk).
- **Deel B · bediening** (`b-bediening`): knoppen in alle soorten en rollen (primair, secundair, tekstknop, gevaar,
  icoonknop, knoppen in een paginakop, knoppen onderin een flyout of venster, Opslaan, Bewerken, Verwijderen, Annuleren,
  Sluiten, Nieuw, Filter, Weergave, Exporteren, Meer-menu), knopgroepen en volgorde, laadtoestand; formulieren (veld,
  label, hulptekst, foutmelding, verplicht, invoer, tekstvak, select, datum, checkbox, radio, schakelaar, zoekveld,
  inline bewerken met EditableField en InlineEditChip, keuzechips); filters (filterbalk, filterchips, dropdownfilters,
  tellers, reset), weergaveschakelaar (lijst, kaarten, kanban, kaart), segmentknoppen, tabbalk, sorteerkoppen,
  paginering, contextmenu en dropdownmenu, pillen, tags, badges en statuslabels, avatar en portret, scorecirkel,
  voortgangsbalk.
- **Deel C · lagen en data** (`c-lagen-en-data`): flyouts (alle *Flyout.vue: breedtes, kop met kicker en titel,
  sluitknop, tabbladen in de flyout, blokken, voet met knoppen, scrollgedrag, animatie, overlay, mobiel volledig scherm,
  geneste flyouts, Escape, focusval, gedrag bij niet-opgeslagen wijzigingen), bevestigingsvenster (ConfirmDialog),
  andere modals (ConflictResolveModal, IOSInstallModal), toasts en meldingen (succes, fout, ongedaan maken), banners
  (OfflineBanner), notificatiebel en paneel, globale zoek (opbouw van het zoekvenster en de resultaten), tabellen,
  lijstrijen (AccountRow), kaarten (LeadCard, BriefingCard, ResultaatTegel), kanban, tijdlijn en activiteitenfeed, lege
  staten (LegeStaat), laadstaten en skeletten, foutstaten, grafieken (RapportageGrafieken: kleuren, assen), kaart
  (MiniMap), en de afdrukstijl als die bestaat.

## Verslag

Geef in je eindbericht alleen: je drie bestandsnamen met aantal regels en aantal onderdelen, het aantal
schermafbeeldingen, en een lijst "token gewenst" (deel B en C) of het aantal tokens (deel A). Geen samenvatting van de
inhoud.
