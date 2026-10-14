# Deel A · Fundament

Dit deel beschrijft het fundament waarop elk scherm van Dealtrace staat: lettertypen, alle tokens, de typografie, links, iconen, maten, lagen en tijd, de reset, focus en scrollbalken, en de app-schil met zijbalk, paginakop, paginaraster, statkaarten en mobiele schil. Alles is afgeleid uit de hele DealDrive-app (`C:\Projecten\dealdrive`, commit 75bee61 van 14 oktober 2026): `tokens.css`, `fonts.css`, `tailwind.config.ts`, `.stylelintrc.json`, `nuxt.config.ts`, `app.vue` en de style-blokken van 232 componenten en pagina's (11.300 CSS-regels geteld). Maten zijn gemeten met `getComputedStyle` op de draaiende app (werkplek op poort 3088, HQ op 3096) op 1440 bij 900 en 390 bij 844.

Het stijlbestand is `a-fundament.css`; het voorbeeld met alle varianten is `a-fundament.html`. Knoppen, formulieren en filters staan in deel B; flyouts, vensters, toasts, tabellen, kaarten en lege staten in deel C.

## Tokens

### Wat het is

Eén set CSS-variabelen op `:root` waar alle kleuren, maten, tijden en lagen vandaan komen. Dealtrace neemt de 47 variabelen van DealDrive (`app/assets/css/tokens.css`) letterlijk over, met dezelfde naam en waarde. Daarnaast staan er 57 aanvullende variabelen in het bestand: waarden die DealDrive overal letterlijk schrijft (lettertypen, corpsen, wit, wit op donker, overlays, zachte tinten, duren, flyout- en knopmaten). Totaal 104. tokens.css bevat daarnaast drie herdefinities voor de zonlicht- en handschoenmodus; die staan er ook in.

### Wanneer

- Altijd. Een kleur, afstand, hoek, duur of laag schrijf je als `var(--naam)`.
- Ook wit en tinten gaan via een token. stylelint van DealDrive laat `#fff` en `rgba()` letterlijk toe (DealDrive schrijft 519 keer `background: #fff`), maar in Dealtrace staat een letterlijke kleur alleen in het tokenblok: wit is `--wit`, wit op donker `--wit-06` tot `--wit-85`, overlays `--overlay-zacht`, `--overlay` en `--overlay-donker`, tinten `--*-zacht` en verwanten. `transparent`, `currentColor` en `inherit` blijven gewoon toegestaan.
- Deel B en C definiëren geen tokens; ze gebruiken alleen wat hier staat. Een maat zonder token (een losse padding, een uitzonderlijke breedte) staat daar letterlijk met de opmerking "geen token".
- Bestaat er een DealDrive-naam voor een waarde, gebruik dan die; de aanvulling vult aan wat tokens.css niet heeft.

### De 47 DealDrive-tokens per groep

| Groep | Tokens | Aantal |
|---|---|---|
| Inkt | --ink, --ink-soft, --muted, --muted-light | 4 |
| Achtergrond en oppervlak | --bg, --surface, --border, --border-strong | 4 |
| Accent | --yellow, --yellow-dark | 2 |
| Semantisch | --red, --red-dark, --red-light, --green, --blue, --orange, --orange-dark, --purple | 8 |
| Typografie | --fs-label | 1 |
| Afstanden en hoek | --pagina-marge, --sectie-padding, --kaart-gap, --kaart-padding, --radius | 5 |
| Aanraakdoelen | --touch-target-min, --touch-target-comfortable, --touch-target-glove | 3 |
| Veilige zones | --safe-area-top, --safe-area-right, --safe-area-bottom, --safe-area-left | 4 |
| Mobiele hoogtes | --bottom-nav-h, --mobile-cta-h | 2 |
| Breekpunten | --bp-mobile, --bp-tablet | 2 |
| Animatie | --transition-fast, --transition-base, --transition-slow | 3 |
| Containers | --container-w, --container-narrow | 2 |
| Lagen | --z-base, --z-sticky, --z-fixed, --z-overlay, --z-modal, --z-modal-boven, --z-toast | 7 |

### Aanvulling voor Dealtrace (niet in tokens.css)

Getal tussen haakjes: hoe vaak de waarde letterlijk in DealDrive staat (components en pages).

| Token | Waarde | Rol en herkomst |
|---|---|---|
| --font-serif | 'Source Serif 4', Georgia, serif | koppen en cijfers (515) |
| --font-sans | Inter, system-ui, -apple-system, sans-serif | body in tokens.css |
| --font-mono | 'IBM Plex Mono', ui-monospace, monospace | mono (18), niet geladen |
| --fs-meta / --fs-klein / --fs-body | 12px / 13px / 14px | meta, kaarttekst en knoppen, leestekst (721, 672, 334) |
| --fs-lees / --fs-kaarttitel / --fs-venstertitel | 16px / 18px / 22px | body, kaarttitel, bloktitel en venstertitel |
| --fs-paginatitel / --fs-cijfer | 32px / 32px | instellingentitel, statkaart op taken |
| --wit | #fff | kaarten, velden, menu's, tekst op zwart (519 keer als achtergrond) |
| --wit-06 / --wit-10 / --wit-16 | wit op 0,06 / 0,1 / 0,16 | hover-vlak, scheiding en knoprand op donker |
| --wit-30 / --wit-40 | wit op 0,3 / 0,4 | rand bij hover, scrollbalk, uitgeschakeld op donker |
| --wit-55 / --wit-70 / --wit-78 / --wit-85 | wit op 0,55 / 0,7 / 0,78 / 0,85 | gedempte, zachte, navigatie- en gewone tekst op donker |
| --overlay | inkt (10, 10, 10) op 0,45 | achter een flyout en de globale zoek (29) |
| --overlay-donker | inkt op 0,55 | achter een bevestigingsvenster of modal (14) |
| --overlay-zacht | inkt op 0,32 | achter een contextmenu (ContextMenu) |
| --yellow-zacht | geel op 0,06 | uitgelicht blok: AI-blok, vandaag, voorstel (11) |
| --yellow-licht | geel op 0,1 | open of gekozen rij (10, plus 3 keer 0,08) |
| --yellow-actief | geel op 0,12 | actief item op de zwarte zijbalk (AppSidebar, AdminShell) |
| --yellow-teller | geel op 0,2 | teller in een actieve filterpil, hover op geel (0,18 en 0,2: 18) |
| --yellow-op-donker | geel op 0,85 | gedempte gele tekst op zwart (3) |
| --yellow-dark-zacht | --yellow-dark op 0,24 | bandbadge geel (BandBadge) |
| --red-zacht / --red-pil | rood op 0,08 / 0,12 | hover en foutvlak (28) / pil en badge (6) |
| --green-zacht / --orange-zacht | groen op 0,12 / oranje op 0,1 | pil en zachte achtergrond (elk 6) |
| --blue-zacht / --purple-zacht | op 0,12 | geen vaste waarde in DealDrive, uit de voorganger |
| --kaart-water | #e6f0f5 | kaartvak voor het laden (MiniMap) |
| --z-melding | 100 | toasts boven alles (ToastContainer) |
| --duur-kort | 150ms | hover op statkaart, pil, rij; draaien van een pijl (74) |
| --duur-vervaag | 160ms | vervagen in een uitklapper, zijbalk inklappen (20) |
| --duur-uit | 180ms | sluiten en uitvagen van overlay en venster (19) |
| --duur-in | 220ms | openen van flyout, venster en toast; uitklappen (35) |
| --duur-lang | 600ms | voortgang van scorecirkel en trechter (4) |
| --curve-opveer | cubic-bezier(0.18, 0.89, 0.32, 1.28) | opveren van het bevestigingsvenster (ConfirmDialog) |
| --sidebar-w / --sidebar-w-smal | 240px / 64px | DealDrive zet --sidebar-w op .app-shell in app.vue |
| --venster-w-smal / --venster-w | 480px / 520px | flyout smal (6) en standaard (15); deel C |
| --venster-w-breed / --venster-w-ruim / --venster-w-vol | 560px / 640px / 900px | analyse en verslag (12), AI-analyse en zoekpaneel (2), organisatiebeheer (2) |
| --knop-h-compact / --knop-h-klein / --knop-h-mini | 34px / 32px / 28px | icoonknop in een flyoutvoet; kleine knop, sluitknop, inline bewerken; potlood |
| --teller-h / --keuzeknop-h / --zoekveld-min-w | 18px / 56px / 280px | teller op Filters, knop in een keuzeraster, minimale breedte zoekveld |

De wit-op-donkerschaal brengt ruim twintig verschillende transparanties uit DealDrive samen; elke waarde is afgerond naar de dichtstbijzijnde stap (0,07 naar 0,06, 0,08 en 0,12 naar 0,1, 0,18 en 0,22 naar 0,16, 0,28 tot 0,35 naar 0,3, 0,38 naar 0,4, 0,5 naar 0,55, 0,62 tot 0,72 naar 0,7). Het verschil is op zwart niet te zien.

### Correcties ten opzichte van de voorganger

- `--z-dialoog: 60` is vervallen. Het bevestigingsvenster van DealDrive staat op `var(--z-toast)` (50); een losse z-index 60 komt alleen voor bij zes lokale vensters.
- `--touch-target-glove` en `--bottom-nav-h` ontbraken en staan er nu in.
- `--orange-zacht` was 0,15; DealDrive gebruikt 0,1 (6 keer; 0,15 eenmaal in belblokken). De oranje pil gebruikt nu ook 0,1.
- `--yellow-zacht` was 0,12; de meest gebruikte gele tint in DealDrive is 0,06 (11 keer). De 0,12 van het actieve zijbalkitem heet nu `--yellow-actief`; daarnaast zijn er `--yellow-licht` (0,1, open rij) en `--yellow-teller` (0,2).
- Rood heeft twee tinten met een eigen rol: `--red-zacht` (0,08, hover en foutvlak, 28 keer) en `--red-pil` (0,12, pil en badge, 6 keer).
- De groene bandbadge (0,14 in BandBadge) gebruikt `--green-zacht` (0,12).

### Waar in DealDrive

`app/assets/css/tokens.css`, geladen via `nuxt.config.ts` onder `css`. `tailwind.config.ts` verwijst naar dezelfde variabelen en heeft een vergrendeld thema zonder Tailwind-standaardkleuren, zodat `bg-red-500` of `rounded-2xl` niet bestaan.

## Kleuren

### Wat het is

Een krantenpalet: zwart en warm wit, één accent (krantgeel) en vijf semantische kleuren die spaarzaam gebruikt worden. Diepte komt van randen en vlakken, nooit van schaduw.

### Wanneer en wanneer niet

- Geel is het enige accent: primaire actie, actief item, kickerstreep, focus in een veld, signaal. Geel nooit als tekst op wit in klein corps; gebruik dan `--yellow-dark` en alleen groot of vet.
- Rood alleen voor fout, urgent, risico, verwijderen en de teller op de bel.
- Groen voor goed, positief en gewonnen; oranje voor waarschuwing; blauw voor info en klantstatus; paars voor hot prospect en social signaal.
- De paginakleur is `--bg` (warm wit), nooit `--wit`. Kaarten, velden, menu's en statkaarten zijn wel `--wit` (#fff), op `--bg` of `--surface`.

### Rollen

| Token | Waarde | Rol | Gebruik |
|---|---|---|---|
| --ink | #0a0a0a | primaire tekst, zwarte vlakken | 2582 |
| --ink-soft | #2a2a2a | secundaire tekst, hover op zwart | 559 |
| --muted | #6b6b6b | meta, kickers, labels | 1730 |
| --muted-light | #a0a0a0 | placeholder, uitgeschakeld | 28 |
| --bg | #fafaf7 | paginakleur | 313 |
| --surface | #f1f1ee | afwisselende sectie, hover op licht | 694 |
| --border | #e3e1da | rand van kaarten, scheidingslijn | 911 |
| --border-strong | #c8c5bc | rand van knop en veld | 703 |
| --yellow | #fed800 | accent | 943 |
| --yellow-dark | #d4b400 | hover op geel, gele tekst op licht | 180 |
| --red | #c0392b | fout, urgent, verwijderen | 458 |
| --red-dark | #a02f24 | hover op een rode knop | 7 |
| --red-light | #ff8a80 | rode tekst op donker | 4 |
| --green | #1e7c4a | goed, gewonnen | 274 |
| --blue | #194c8f | info, klant | 172 |
| --orange | #d97706 | waarschuwing, at-risk | 100 |
| --orange-dark | #b45309 | oranje tekst op een lichte pil | 24 |
| --purple | #4c1d95 | hot prospect, social | 108 |

### Semantische kleuren

| Betekenis | Kleur | Zachte achtergrond | Tekst op licht |
|---|---|---|---|
| Goed | --green | --green-zacht | --green |
| Waarschuwing | --orange | --orange-zacht | --orange-dark |
| Fout | --red | --red-zacht | --red |
| Info | --blue | --blue-zacht | --blue |
| Merk en actief | --yellow | --yellow-zacht | --yellow-dark (groot of vet) |

### Op donker

DealDrive heeft geen donkere modus. Wel zijn de zijbalk, de actieve statkaart, de toast en enkele koppen zwart. Daarop gelden vaste transparanties van wit, als token:

| Rol | Token | Voorbeeld |
|---|---|---|
| Tekst | --wit-85 | zijbalk algemeen |
| Navigatietekst | --wit-78 | item in de zijbalk, tekst in een donkere briefingkaart |
| Zachte tekst | --wit-70 | meta in een donkere flyoutkop, detail in de actieve zoekregel |
| Gedempt, groepskop | --wit-55 | groepskop, datum, rol, sluitknop van een toast |
| Scrollbalk bij hover | --wit-40 | duim van de scrollbalk in de zijbalk |
| Rand bij hover, uitgeschakeld | --wit-30 | zoekknop bij hover, uitgeschakeld item |
| Rand van een knop | --wit-16 | zoekknop, inklapknop |
| Scheiding | --wit-10 | onder het merk, streep ingeklapt |
| Hover-vlak | --wit-06 | item bij hover |

Rode tekst op donker is `--red-light`. De focusring op donker is geel.

### Zonlichtmodus

`html[data-sunlight-mode='on']` maakt `--muted` donkerder (#4a4a4a) voor buiten werken. Staat in tokens.css en is in Dealtrace overgenomen.

### Waar in DealDrive

`tokens.css`; de tellingen komen uit `var(--naam)` in alle componenten en pagina's.

## Lettertypen

### Wat het is

Twee families: **Source Serif 4** voor koppen, titels en cijfers, en **Inter** voor al het andere. Mono wordt gedeclareerd maar niet geladen.

### Hoe geladen

1. In de head twee preconnects: `https://fonts.googleapis.com` en `https://fonts.gstatic.com` met `crossorigin` (uit `nuxt.config.ts`).
2. Als eerste regel van het stijlbestand dezelfde `@import` als `app/assets/css/fonts.css`: Source Serif 4 met optische as 8 tot 60 in 400, 600 en 700, en Inter in 400, 500, 600, 700 en 800, met `display=swap`.
3. De browser haalt een gewicht pas op als een pagina het gebruikt. Gemeten op /taken: Inter 400, 600, 700 en 800 en Source Serif 4 400 en 700.

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
```

### Families en terugval

| Rol | Familie | Terugval | Gewichten in gebruik |
|---|---|---|---|
| Koppen en cijfers | Source Serif 4 | Georgia, serif | 700 (bijna altijd) |
| Tekst en bediening | Inter | system-ui, -apple-system, sans-serif | 700, 600, 800, 500, 400 |
| Tijden, tellers | IBM Plex Mono (niet geladen) | ui-monospace, monospace | 600, 700 |

### Mono

DealDrive schrijft 18 keer `'IBM Plex Mono', ui-monospace, monospace` (HistorieFlyout, dagstart, Dex) en 3 keer JetBrains Mono, maar laadt geen van beide. Het resultaat is het systeemlettertype (Consolas op Windows, SF Mono op macOS). De Tailwind-preflight geeft `code` en `kbd` de mono uit `tailwind.config.ts` (JetBrains Mono, Consolas). Dealtrace laadt ook geen mono, zodat het er hetzelfde uitziet. Wie mono echt wil laden, voegt `IBM+Plex+Mono:wght@500;600` aan de import toe; dat wijkt dan af van DealDrive.

### Waar in DealDrive

`app/assets/css/fonts.css`, `nuxt.config.ts` (regel 102 tot 107), `tailwind.config.ts` (fontFamily).

![Paginakop van /taken: serif titel en Inter kicker en subtitel](shots/a-2-paginakop-werkpagina.png)

## Typografische schaal en rollen

### Wat het is

Een vaste set rollen met elk één klasse. Koppen en cijfers in serif 700, al het andere in Inter. De ondergrens is 11 px (`--fs-label`): kleiner mag niet, compact maak je met letterafstand.

### Schaal en rollen

| Rol | Klasse | Maat en gewicht | Kleur en afstand |
|---|---|---|---|
| Kicker | .kicker | Inter 11 px 700, kapitalen | --muted, 0,08em |
| Kicker met streep | .kicker--streep | idem, gele streep 24 bij 2 px | 0,2em, 8 px tussenruimte |
| Paginatitel | .title | serif 32 px 700, regel 1,15 | --ink, marge 4 px boven |
| Grote paginatitel | .title--groot | serif clamp(28px, 4vw, 44px), regel 1,1 | -0,01em, marge 12 px |
| Kleine paginatitel | .title--klein | serif 28 px | agenda, campagnedetail |
| Subtitel | .subtitle | Inter 14 px, regel 1,6 | --ink-soft, max 620 px, marge 8 px |
| Subtitel bij grote titel | .subtitle--groot | Inter 15 px, regel 1,55 | --muted, marge 0 |
| Sectiekop | .sec-title | serif clamp(28px, 3.4vw, 40px), regel 1,1 | -0,01em |
| Ondertitel sectie | .sec-sub | Inter 13 px, regel 1,55 | --ink-soft, max 560 px |
| Bloktitel | .kop-blok | serif 22 px 700, regel 1,2 | --ink |
| Kaarttitel | .kop-kaart | serif 18 px 700, regel 1,25 | -0,005em |
| Kleine kop | .kop-klein | serif 16 px 700 | --ink |
| Broodtekst | .tekst | Inter 13 px, regel 1,55 | --ink-soft |
| Leestekst | .tekst--lees | Inter 14 px, regel 1,6 | --ink-soft |
| Meta | .meta | Inter 12 px, regel 1,5 | --muted |
| Label | .label | Inter 11 px 700, kapitalen | --muted, 0,08em |
| Cijfer | .cijfer | serif 22 px 700, tnum | --ink |
| Groot cijfer | .cijfer--groot | serif 32 px 700, tnum | --ink |
| Mono | .mono | mono 12 px 600, tnum | erft |

### Waarom deze keuzes

- **Twee paginakoppen.** DealDrive heeft twee vormen die elk veel voorkomen. Instellingen-, analyse- en detailpagina's: kicker zonder streep (0,08em, 34 regels) en titel 32 px (27 pagina's). Werkpagina's in de navigatie (Taken, Pipeline, Inzichten, Bezoeken, Briefings, Campagnes): kicker met gele streep (0,2em, 25 regels plus 9 keer `.sec-eyebrow`) en titel clamp(28px, 4vw, 44px) of clamp(28px, 4vw, 40px) (19 pagina's). De 44-variant is hier gekozen omdat /taken hem gebruikt en hij gemeten is; de 40-variant (pipeline, offertes, team) is een uitzondering.
- **Broodtekst 13 px in --ink-soft**: de meest voorkomende combinatie in kaarten en lijsten (29 plus 23 regels); in --ink 32 regels. Voor nadruk `.tekst--inkt`.
- **Labels**: 11 px 700 kapitalen met 0,06em tot 0,12em in honderden regels. 0,08em is het midden en gelijk aan de kicker.
- **Gewichten**: 700 (1564 keer), 600 (402), 800 (371). 400 en 500 zijn zeldzaam.
- **Cijfers** altijd met tabellaire cijfers: `.tnum` staat 738 keer op een element.

### HTML

```html
<span class="kicker kicker--streep">Taken en opvolging</span>
<h1 class="title title--groot">30 taken en 21 afspraken op de planning.</h1>
<p class="subtitle subtitle--groot">Geen achterstallige taken. Netjes gehouden.</p>
```

### Toestanden

| Toestand | Klasse | Effect |
|---|---|---|
| Alert in subtitel | .subtitle--alert | tekst en strong in --red |
| Alert in kicker | .kicker--alert | --red |
| Cijfer negatief of urgent | .cijfer--alert | --red |
| Cijfer positief | .cijfer--positief | --green |

### Waar in DealDrive

`.kicker` in 62 bestanden, `.title` in 52, `.subtitle` in 51, `.sec-title` in 11, `.block-title` in 10. Bijvoorbeeld `pages/taken.vue`, `pages/instellingen/werkwijze.vue`, `pages/klanten/index.vue`.

## Links

### Wat het is

Een kale `a` heeft geen stijl: kleur erft en er is geen onderstreping (Tailwind-preflight plus tokens.css). Elke link krijgt daarom een klasse die zegt wat voor link het is.

### Wanneer

- In lopende tekst: `.inline-link`.
- Naam in een tabel of lijst: `.tabel-link` (de hele rij is vaak al klikbaar; de link valt pas op bij hover).
- Terug naar een bovenliggende pagina boven de kicker: `.breadcrumb-link` in `nav.breadcrumb`.
- Terug in een metaregel onder een lijsttitel: `.back-link`.
- Naar een volledige lijst vanuit een sectiekop: `.sec-link`.
- Niet: een link die een actie uitvoert (opslaan, openen van een flyout). Dat is een knop, zie deel B.

### Varianten en toestanden

| Klasse | Rust | Hover | Gebruik in DealDrive |
|---|---|---|---|
| .inline-link | --ink 600, 1 px geel eronder | tekst --yellow-dark | 7 keer, plus .tekst-link 3 keer |
| .tabel-link | --ink 600, geen streep | 1 px gele streep | 4 keer |
| .breadcrumb-link | 12 px 700 kapitalen 0,04em, --muted | --ink | 28 keer |
| .back-link | --ink 700 | --yellow-dark | 8 keer |
| .sec-link | zwart vlak, geel 12 px kapitalen, 44 px | vlak --ink-soft | 7 keer |
| .subtitle-link | onderstreept, 4 px afstand | ongewijzigd | 2 keer |

Focus: 2 px inkt met 2 px afstand (globale focusring). Uitgeschakeld (`aria-disabled="true"`): `--muted-light`, geen streep, niet klikbaar. Overgang 120 ms.

### Extern

Zelfde klasse als intern, met de pijl ↗ achter het label in een `span.link-extern` met `aria-hidden="true"`, en altijd `target="_blank" rel="noopener noreferrer"` (33 keer in DealDrive, steeds met noopener). Voorbeelden van teksten: "LinkedIn ↗", "Deelnemen ↗", "Open meeting-link ↗", "Bekijk de preview ↗". Eén plek gebruikt een Lucide-icoon ExternalLink (DocumentDetailFlyout); de pijl is de standaard.

### HTML

```html
<p class="tekst">Lees de <a class="inline-link" href="/briefings/12">briefing van Bouwgroep Lek</a>.</p>
<nav class="breadcrumb" aria-label="Kruimelpad">
  <a class="breadcrumb-link" href="/mijn-instellingen">← Mijn instellingen</a>
</nav>
<span class="meta"><a class="back-link" href="/klanten">← Klanten</a> · 128 klanten totaal</span>
<a class="inline-link" href="https://linkedin.com/in/henkdevries" target="_blank" rel="noopener noreferrer">LinkedIn<span class="link-extern" aria-hidden="true">↗</span></a>
```

### Teksten

Kruimelpad en terug-link beginnen met "← " gevolgd door de naam van de bestemming ("← Mijn instellingen", "← Klanten", "← Alle klanten"); alleen waar de bestemming niet te noemen is "← Terug". Een sectielink eindigt op " →" ("Alle klanten →").

### Navigatielinks

De links in de zijbalk staan bij het onderdeel Zijbalk.

### Waar in DealDrive

158 regels met een klasse op `-link` in 105 bestanden, onder meer `pages/klanten/index.vue` (.sec-link), `pages/klanten/alle.vue` (.back-link), alle instellingenpagina's (.breadcrumb-link), `components/EditableField.vue` (extern met ↗).

## Iconen

### Wat het is

Lucide (`lucide-vue-next` 0.577, in 104 bestanden). Elk icoon is een svg van 24 bij 24 met `stroke="currentColor"`, lijndikte 2, ronde uiteinden en geen vulling. De kleur volgt dus de tekst eromheen.

### Maten

| Klasse | Maat | Gebruik | Aantal in DealDrive |
|---|---|---|---|
| .icoon--12 | 12 px | in pillen en kleine labels | 19 (:size 12) |
| .icoon--14 | 14 px | naast 12 tot 13 px tekst, pijl in een knop | 20 (:size 14) |
| .icoon | 16 px | standaard naast tekst en in knoppen | 183 (w-4 h-4) |
| .icoon--18 | 18 px | navigatie in de zijbalk | 27 gemeten |
| .icoon--20 | 20 px | los icoon, icoonknop | 18 (:size 20) |
| .icoon--groot | 56 px, lijn 1,5 | lege staat, illustratie | 3 |

### Regels

- Lijndikte 2 (72 keer expliciet, en de standaard van Lucide). Alleen grote illustratieve iconen 1,5 tot 1,75.
- Een icoon naast tekst krijgt `aria-hidden="true"`. Een knop met alleen een icoon krijgt een `aria-label` en een `title` met hetzelfde woord.
- Gedempte iconen (naast meta) met `.icoon--gedempt` (--muted).
- **Let op:** DealDrive schrijft 41 keer `w-3.5 h-3.5`, maar die klasse bestaat niet in de vergrendelde Tailwind-schaal. Gemeten: zulke iconen worden 24 px (bijvoorbeeld de pijl in het gebruikersblok en in de weergaveknop). Bedoeld is 14 px; Dealtrace gebruikt `.icoon--14`.

### HTML

```html
<svg class="icoon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
</svg>
```

### Iconen per onderdeel in de schil

| Plek | Lucide-icoon |
|---|---|
| Inklappen en uitklappen | PanelLeftClose, PanelLeftOpen |
| Zoeken | Search |
| Notificaties | Bell |
| Gebruikersmenu | UserCog, LifeBuoy, BookOpen, BookMarked, Map, LogOut, ChevronUp |
| Navigatie | Home, Calendar, Inbox, BarChart3, CheckSquare, ClipboardList, MapPin, Video, PhoneCall, CalendarRange, ClipboardCheck, Megaphone, GitBranch, FileText, Briefcase, Users, Contact, Radar, FileBarChart, Settings |

### Waar in DealDrive

`AppSidebar.vue`, `composables/useNavigatie.ts`, `AdminShell.vue` en alle componenten met een import uit `lucide-vue-next`.

## Afstanden

### Wat het is

Eén schaal voor de hele app, vastgelegd in tokens.css (audit van 18 september 2026): 24 px buitenmarge, 16 px tussen kaarten, 16 px binnen een kaart, 32 px boven en onder een sectie.

### Waarden

| Token of stap | Waarde | Gebruik |
|---|---|---|
| --pagina-marge | 24 px | zijmarge van de container, padding van een venster, statstrook boven en onder |
| --sectie-padding | 32 px | boven en onder een sectie |
| --kaart-gap | 16 px | tussen kaarten in een raster |
| --kaart-padding | 16 px | binnen een kaart of statkaart |
| Tussenruimte binnen componenten | 8 px (442), 6 px (327), 12 px (244), 10 px (202), 4 px (124) | gap in flex-rijen |
| Tailwind-schaal | 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 48, 56, 64, 80, 96 | spacing in tailwind.config.ts |

### Regels

- Buitenmarge altijd 24 px, ook op mobiel (gemeten op 390 px). Zes analysepagina's gaan onder 860 px naar 16 px; dat is een uitzondering.
- Knoppen in een rij: 8 px tussenruimte (zie deel B).
- Geen losse pixels buiten de schaal; DealDrive weert ze via de Tailwind-schaal.

## Randen en hoeken

### Wat het is

Diepte komt van randen, niet van schaduw. Hoeken zijn 2 px.

### Waarden

| Element | Rand | Hoek |
|---|---|---|
| Kaart, statkaart, menu | 1 px --border (402 keer) | 2 px |
| Knop, veld, keuzelijst | 1 px --border-strong (476 keer) | 2 px |
| Scheiding onder een sectie of rij | 1 px --border onderaan (293 keer) | geen |
| Nadruk, actief | 1 px --ink (63 keer) of 2 px --ink onderaan (40 keer) | 2 px |
| Kleurstreep links op een kaart | 3 px in de semantische kleur | 2 px |
| Leeg vlak, sleepdoel | 1 px gestippeld --border-strong (30 keer) | 2 px |

### Regels van stylelint

- `border-radius`: nooit 5 px of meer, nooit 9999, nooit 50%. Praktijk: 742 keer 2px, 186 keer var(--radius). Tailwind kent alleen `rounded-sm` (2 px) en `rounded` (4 px).
- `box-shadow`: verboden, in elke vorm.
- Randkleur alleen via `var()`, `transparent`, `currentColor`, `#fff` of `rgba()`. In Dealtrace altijd via `var()`: ook wit is een token (`--wit`).
- Avatars en stippen zijn vierkant met 2 px hoek, geen cirkels. Het enige ronde element is het merklogo (svg).

## Z-index-lagen

### Wat het is

Een vaste volgorde van lagen zodat zijbalk, flyouts, menu's en meldingen elkaar nooit verkeerd overlappen.

### Lagen

| Token | Waarde | Wat erop staat |
|---|---|---|
| --z-base | 1 | element boven zijn buren in een blok |
| --z-sticky | 10 | plakkende filterstrook (.section--filter), tabelkoppen |
| --z-fixed | 20 | OfflineBanner |
| --z-overlay | 30 | zijbalk (letterlijk 30 in AppSidebar), notificatiepaneel |
| --z-modal | 40 | flyouts, vensters, contextmenu, gebruikersmenu |
| --z-modal-boven | 45 | flyout die op een andere flyout opent |
| --z-toast | 50 | bevestigingsvenster, globale zoek, installatiemelding |
| --z-melding | 100 | toasts, boven alles (aanvulling) |

### Uitzonderingen in DealDrive

- ToastContainer staat op letterlijk 100, boven alles. In Dealtrace is dat het token `--z-melding`.
- Zes lokale vensters op pagina's (pipelines, automatisering, bezoek-analyse, MatrixAnalyse, DexKaart, DexNieuw) gebruiken 60.
- Plakkende koppen binnen een flyout gebruiken 5.

Gebruik in Dealtrace alleen de tokens; de uitzonderingen staan hier om te begrijpen wat je in DealDrive ziet.

## Overgangen en animatie

### Wat het is

Korte, rustige overgangen met `ease-out`. Geen stuiters; de enige uitzondering is het bevestigingsvenster, dat licht opveert (`--curve-opveer`).

### Duur

| Token | Duur | Gebruik | Aantal |
|---|---|---|---|
| --transition-fast | 120 ms ease-out | hover op kleur, rand, achtergrond | 232 plus 44 keer letterlijk |
| --duur-kort | 150 ms | hover op een statkaart, pil of rij, draaien van een pijl | 74 |
| --duur-vervaag | 160 ms | vervagen binnen een uitklapper, in- en uitklappen van de zijbalk | 20 |
| --duur-uit | 180 ms | sluiten en uitvagen van overlay en venster | 19 |
| --transition-base | 200 ms ease-out | transform, opacity, breedte | 64 |
| --duur-in | 220 ms | openen van flyout, venster en toast, uitklappen van de filterstrook | 35 |
| --transition-slow | 500 ms ease-out | voortgang | 2 |
| --duur-lang | 600 ms | ring van de scorecirkel, trechterbalk | 4 |
| --curve-opveer | cubic-bezier(0.18, 0.89, 0.32, 1.28) | bevestigingsvenster springt op | 1 |

De `--duur-*`-tokens zijn alleen een tijd; schrijf de curve erbij: `transition: opacity var(--duur-in) ease-out`.

### Animaties in de schil

- LIVE-stip in de zijbalk: knippert in 1,4 s (opacity 1 naar 0,35), stopt bij OFFLINE.
- Gebruikersmenu: verschijnt in 120 ms vanuit 4 px lager met opacity 0.
- Statkaart bij hover: 1 px omhoog in 150 ms (`--duur-kort`).

### Minder beweging

`@media (prefers-reduced-motion: reduce)` zet alle animatie- en overgangsduren op 0,01 ms en `scroll-behavior` op auto (tokens.css, globaal). Vier componenten zetten daarnaast hun eigen animatie op `none`.

## Breekpunten

### Wat het is

DealDrive schrijft breekpunten letterlijk in media queries; de tokens `--bp-mobile` en `--bp-tablet` zijn er alleen voor JavaScript (`useViewport` via `matchMedia`).

### Breekpunten

| Grens | Query | Wat verandert |
|---|---|---|
| Mobiel | max-width 767px | zijbalk vast als icoonstrook van 64 px; body krijgt ruimte onderaan |
| Tablet | max-width 1023px | alleen in JavaScript (useViewport) |
| Twee kolommen | min-width 700px en 720px | statkaarten naar 4 kolommen (700), rasters naar 2 kolommen (720) |
| Drie of meer | min-width 900px en 1000px | rasters naar 3 kolommen, statstrook naar 6 |
| Smal telefoon | max-width 560px | componentniveau, bijvoorbeeld kaarten onder elkaar |

### Andere media queries

- `(hover: none)`: bediening die normaal pas bij hover verschijnt, is altijd zichtbaar (4 bestanden; `.hover-doel`).
- `(max-width: 767px), (hover: none) and (pointer: coarse)`: de toetsaanduiding in de globale zoek verdwijnt.
- `print`: zie deel C.

### Regel

Tailwind-schermen zijn hernoemd (sm 700, md 800, lg 900, xl 1000, 2xl 1100, 3xl 1180) maar worden in templates nauwelijks gebruikt; de componenten schrijven hun eigen query. Dealtrace houdt de getallen uit de tabel aan.

## Reset en basis

### Wat het is

De basis onder elk element: box-sizing, marges op nul, lettertype en kleur van de pagina. DealDrive krijgt dit van twee bronnen: de basisregels in tokens.css en de Tailwind-preflight via `@nuxtjs/tailwindcss`. Dealtrace heeft geen Tailwind nodig; de preflight staat daarom uitgeschreven in groep 3 van het stijlbestand.

### Wat de basis doet

| Element | Regel | Bron |
|---|---|---|
| alles | box-sizing border-box, rand 0 solid currentColor | tokens.css en preflight |
| html | regelhoogte 1,5, smooth scroll, text-size-adjust 100% | preflight en tokens.css |
| body | --bg, --ink, Inter 16 px, regel 1,6, antialiased, padding op de veilige zones | tokens.css |
| h1 tot h6, p, figure | marge 0; koppen erven corps en gewicht | preflight |
| ul, ol | geen opsommingsteken, geen marge | preflight |
| a | kleur erft, geen onderstreping | tokens.css |
| img, svg | display block | preflight en tokens.css |
| button, input, select | lettertype, corps en kleur erven; knop transparant | preflight |
| placeholder | --muted-light | zie hieronder |
| code, kbd | --font-mono | preflight |

### Gemeten bijzonderheden

- Placeholder in DealDrive is #9ca3af: de standaard van de preflight, geen token. tokens.css wijst `--muted-light` (#a0a0a0) aan voor placeholders; Dealtrace gebruikt die, het verschil is niet te zien.
- Knoppen hebben in DealDrive `cursor: pointer` via de preflight; uitgeschakelde elementen `cursor: default`.
- `body[data-mobile-shell='on']` krijgt onder 768 px ruimte onderaan van `--bottom-nav-h` plus de veilige zone; omdat de onderbalk weg is, is dat alleen de veilige zone.
- Handschoenmodus: `html[data-glove-mode='on']` zet beide aanraakdoelen op 54 px.

### Hulpklassen

| Klasse | Doet |
|---|---|
| .tnum, time, .num | tabellaire cijfers |
| .afkap | één regel met puntjes; zet de volle tekst in title |
| .breekbaar | lange woorden en URL's breken |
| .visueel-verborgen | alleen voor schermlezers |
| .hover-bron en .hover-doel | bediening die bij hover verschijnt, op aanraakschermen altijd |
| .op-donker | zwarte ondergrond met witte tekst en gele focusring |
| .scrollvak | scrollvak met smalle balk (zie Scrollbalken) |
| .staal | kleurvlak voor legenda en documentatie |

## Focusring

### Wat het is

De zichtbare rand om het element dat toetsenbordfocus heeft.

### Regels

| Waar | Ring | Bron in DealDrive |
|---|---|---|
| Knoppen, links, kaarten op licht | 2 px massief --ink, 2 px afstand | 21 van 36 :focus-visible-regels |
| Velden (input, select, textarea) | 2 px --yellow, -1 px afstand (binnen de rand), rand --ink | 37 :focus-regels |
| Op donker (zijbalk, .op-donker) | 2 px --yellow | 7 regels |

### Waarom

DealDrive heeft geen globale focusregel: 24 bestanden zetten er zelf een. Elementen zonder eigen regel tonen de ring van de browser (gemeten: `outline: auto`, bijvoorbeeld op de knoppen in de paginakop en de statkaarten). Dealtrace maakt de meest gebruikte regel globaal, zodat elk element dezelfde ring heeft. De voorganger gebruikte geel voor alles; dat is gecorrigeerd naar inkt op licht, omdat geel op warm wit te weinig contrast heeft en DealDrive het zo meestal doet.

### Gedrag

- Alleen bij toetsenbordfocus (`:focus-visible`), niet bij een muisklik.
- Gebruik nooit `outline: none` zonder vervanging. DealDrive doet dat 18 keer, steeds met een gekleurde rand als vervanging.
- In het voorbeeld toont `.is-focus` dezelfde ring.

## Selectie

DealDrive definieert geen `::selection`; tekstselectie heeft de standaardkleur van de browser (gemeten: geen eigen achtergrond). Dealtrace houdt dat zo en definieert hem ook niet. Geel als selectiekleur zou botsen met de gele markering van actieve items.

## Scrollbalken

### Wat het is

De pagina gebruikt de scrollbalk van de browser. Twee vaste patronen voor scrollvakken binnen een scherm.

### Varianten

| Plek | Breedte | Duim | Baan |
|---|---|---|---|
| Lange flyout-inhoud (.scrollvak) | 10 px | --border-strong, hover --muted, 2 px rand in baankleur | --surface |
| Navigatie in de zijbalk (.sb-nav) | 8 px | wit op 22 procent, hover 40 procent | transparant |

Firefox: `scrollbar-width: thin` met `scrollbar-color` in dezelfde kleuren. Een los scrollvak buiten een flyout krijgt een vaste hoogte met `.scrollvak--beperkt` (160 px).

### Waar in DealDrive

`TaakFlyout.vue` (.tk-body), `InzichtFlyout.vue` (.iz-body), `AppSidebar.vue` (.sb-nav). De overige flyouts gebruiken de standaardbalk; deel C beschrijft hun scrollgedrag.

## Zijbalk

### Wat het is

De vaste zwarte navigatiebalk links op elke pagina van de werkplek (AppSidebar). Hij bevat het merk, de verbindingsstatus, de zoek-ingang, de hoofdnavigatie in groepen, de notificaties en het gebruikersblok met menu.

### Wanneer

- Op elke ingelogde pagina van de werkplek. Niet op login, signup, wachtwoord instellen en SSO afronden: die hebben een eigen kop zonder navigatie.
- HQ heeft een eigen variant (zie Zijbalk HQ).

### Opbouw

```html
<div class="app-shell">
  <aside class="app-sidebar" aria-label="Hoofdmenu">
    <div class="sb-merk">
      <a class="sb-merk-link" href="/">
        <svg class="sb-merk-icoon" viewBox="0 0 32 32" aria-hidden="true">
          <circle class="merk-geel" cx="16" cy="16" r="14"/>
          <circle class="merk-inkt" cx="16" cy="16" r="8"/>
          <circle class="merk-geel" cx="16" cy="16" r="3"/>
        </svg>
        <span class="sb-merk-naam">Dealtrace</span>
      </a>
      <button class="sb-inklap" type="button" aria-label="Zijbalk inklappen" title="Zijbalk inklappen">..</button>
    </div>
    <div class="sb-meta">
      <span class="sb-live"><span class="sb-live-stip"></span><span class="sb-live-tekst">LIVE</span></span>
      <span class="sb-datum tnum">14 okt</span>
    </div>
    <div class="sb-zoek-vak">
      <button class="sb-zoek" type="button" aria-label="Zoeken">
        <svg class="sb-link-icoon">..</svg><span class="sb-zoek-tekst">Zoeken</span><kbd class="sb-kbd">Ctrl K</kbd>
      </button>
    </div>
    <nav class="sb-nav" aria-label="Hoofdnavigatie">
      <div class="sb-groep">
        <div class="sb-groep-kop">Start</div>
        <div class="sb-scheiding"></div>
        <a class="sb-link sb-link--actief" href="/" aria-current="page">
          <svg class="sb-link-icoon">..</svg><span class="sb-link-tekst">Vandaag</span>
        </a>
      </div>
    </nav>
    <div class="sb-voet">
      <button class="sb-bel" type="button">
        <span class="sb-bel-icoon"><svg class="icoon">..</svg><span class="sb-bel-teller tnum">6</span></span>
        <span class="sb-bel-tekst">Notificaties</span>
      </button>
      <div class="sb-gebruiker">
        <button class="sb-gebruiker-knop" type="button" aria-expanded="false">
          <span class="sb-avatar">SB</span>
          <span class="sb-gebruiker-info"><span class="sb-gebruiker-naam">Sanne de Boer</span><span class="sb-gebruiker-rol">Accountmanager</span></span>
          <svg class="sb-gebruiker-pijl">..</svg>
        </button>
        <div class="sb-menu" role="menu">..</div>
      </div>
    </div>
  </aside>
  <main class="app-shell-main">..</main>
</div>
```

De klassenamen zijn die van de voorganger en de Dealtrace-mock-ups. In DealDrive heten ze anders: sb-merk is `.sb-brand`, sb-inklap `.sb-collapse`, sb-groep-kop `.sb-nav-section`, sb-scheiding `.sb-nav-divider`, sb-link `.sb-nav-item`, sb-voet `.sb-bottom`, sb-bel `.sb-bell-row`, sb-gebruiker `.sb-user`, sb-menu `.sb-dropdown`. De voorganger had een geel vierkantje als merk (`.sb-merk-stip`); DealDrive gebruikt het gele cirkellogo uit MerkLogo.vue, en dat is hier overgenomen.

### Maten en kleuren (gemeten)

| Onderdeel | Maat | Tekst | Kleur |
|---|---|---|---|
| Zijbalk | 240 px, ingeklapt 64 px | erft 16 px | --ink, tekst wit 85 procent |
| Merkstrook | 56 px hoog, padding 14 12 12 | logo 28 px, naam serif 18 px 700 | naam --yellow, lijn wit 8 procent |
| Inklapknop | 28 bij 28 px | icoon 16 px | rand wit 16 procent, hover geel |
| LIVE-strook | 31 px, padding 6 14 | 11 px 700, 0,12em | --yellow; OFFLINE wit 55 procent |
| Zoekknop | 40 px, padding 8 10 | 13 px 600 | rand wit 16 procent; hover 32 procent |
| Groepskop | 28 px, padding 8 10 2 | 11 px 700 kapitalen 0,18em | wit 55 procent |
| Navigatie-item | 33 px, padding 6 10 | 13 px 600, icoon 18 px | wit 78 procent |
| Actief item | idem, streep 3 px links | idem | --yellow op --yellow-actief |
| Notificaties | padding 8 10 | 13 px 600 | teller --red, 16 px hoog |
| Avatar | 30 bij 30 px | 12 px 800 initialen | --yellow vlak, --ink tekst |
| Naam en rol | | 12 px 700 en 11 px kapitalen | wit en wit 55 procent |
| Gebruikersmenu | 208 px breed, items 39 px | 13 px 500 | wit vlak, rand --border |

### Toestanden

| Toestand | Klasse | Effect |
|---|---|---|
| Hover op item | :hover, .is-hover | vlak wit 6 procent, tekst wit |
| Actief item | .sb-link--actief, aria-current="page" | --yellow-actief, tekst geel, gele streep links |
| Focus | :focus-visible, .is-focus | 2 px gele ring |
| Uitgeschakeld item | aria-disabled="true" | wit 35 procent, niet klikbaar |
| Offline | .sb-live--offline | OFFLINE in wit 55 procent, stip stil |
| Menu open | .sb-gebruiker--open | knop krijgt vlak en rand, pijl omhoog |
| Op een menupagina | .sb-gebruiker--actief | blok --yellow-actief, naam geel |
| Ingeklapt | .app-sidebar--ingeklapt | alleen iconen, groepskop wordt een streep |

### Gedrag

1. **Inklappen**: de knop rechts van het merk wisselt tussen "Zijbalk inklappen" en "Zijbalk uitklappen" (title en aria-label). De breedte animeert in 160 ms (`--duur-vervaag`); het hoofdvlak schuift mee via `--sidebar-w`. De keuze staat in de cookie `dealdrive_sidebar_collapsed` en blijft over pagina's heen.
2. **Ingeklapt**: merk en knop staan onder elkaar, alle labels verdwijnen, elk item krijgt zijn naam in `title`. Het gebruikersmenu opent rechts van de strook (220 px breed).
3. **Actief item**: een item is actief als het pad gelijk is of eronder valt (`/klanten/12` maakt Klanten actief); Vandaag (`/`) alleen op exact `/`.
4. **Scrollen**: 25 items passen niet op 900 px hoogte. De lijst scrollt met een dunne balk en een vervaging van 28 px onderaan laat zien dat er meer staat.
5. **Zoeken**: de zoekknop en Ctrl K (Cmd K op Mac) openen de globale zoek (deel C).
6. **Notificaties**: de rij gaat naar /notificaties; de rode teller toont het aantal ongelezen.
7. **Gebruikersmenu**: opent naar boven bij klik. Sluit bij klik buiten het menu, bij Escape (de focus gaat terug naar de knop) en 250 ms nadat de muis het blok verlaat; terugkeren binnen die tijd houdt het open.
8. **LIVE**: volgt de verbinding (dezelfde bron als de OfflineBanner), zodat strook en banner nooit tegenspreken.

### Teksten

- Merk: "DealDrive" (in Dealtrace de productnaam), nooit de naam van de klantorganisatie.
- "LIVE" of "OFFLINE", datum als "14 okt".
- "Zoeken", toets "Ctrl K".
- Groepen: "Start", "Activiteiten", "Accounts", "Rapportages", "Manager", "Beheer".
- "Notificaties".
- Menu: "Mijn instellingen", "Helpcenter", "Kennisbank", "Playbooks", "Roadmap", scheiding, "Uitloggen" (rood).
- Rol onder de naam in kapitalen, bijvoorbeeld "ACCOUNTMANAGER", "FOUNDER".

### Waar in DealDrive

`app/components/AppSidebar.vue`, `app/components/MerkLogo.vue`, `app/composables/useNavigatie.ts`, `app/composables/useSidebarCollapse.ts`, `.app-shell` in `app/app.vue`.

![Zijbalk van de werkplek op /taken, uitgeklapt, met Taken actief](shots/a-1-zijbalk.png)

![Zijbalk ingeklapt tot de icoonstrook van 64 px](shots/a-3-zijbalk-ingeklapt.png)

## Zijbalk HQ

### Wat het is

De zijbalk van de founder-console (AdminShell). Zelfde gebaar als de werkplek, zodat je niet twee manieren van navigeren hoeft te leren, maar met eigen maten en een gele rand.

### Wanneer

Alleen in een beheeromgeving voor de eigenaar van het product (in Dealtrace: een eventuele HQ). Niet in de werkplek van de verkoper.

### Opbouw

```html
<div class="app-shell app-shell--hq">
  <aside class="app-sidebar app-sidebar--hq" aria-label="Founder-navigatie">
    <div class="sb-merk">
      <a class="sb-merk-link" href="/admin"><span class="sb-merk-teken">DD</span><span class="sb-merk-tekst">DealDrive <strong>HQ</strong></span></a>
      <button class="sb-inklap" type="button" aria-label="Menu inklappen" aria-expanded="true">..</button>
    </div>
    <nav class="sb-nav" aria-label="Founder-navigatie">
      <div class="sb-groep"><p class="sb-groep-kop">Portfolio</p>
        <a class="sb-link sb-link--actief" href="/admin">.. Klanten <span class="sb-link-teller">2</span></a>
      </div>
    </nav>
    <div class="sb-voet">..gebruiker.. <button class="sb-link">.. Uitloggen</button></div>
  </aside>
  <main class="app-shell-main">..</main>
</div>
```

### Verschillen met de werkplek

| Onderdeel | Werkplek | HQ |
|---|---|---|
| Breedte | 240 px, ingeklapt 64 px | 210 px, ingeklapt 60 px |
| Rand rechts | geen | 3 px --yellow |
| Merk | geel cirkellogo en naam in serif | geel vierkant "DD" 28 px en "DealDrive HQ" 13 px |
| Item | 13 px 600, 33 px hoog, hoek 2 px | 12 px 700, 0,03em, minimaal 44 px, geen hoek |
| Groepskop | 700, 0,18em, wit 55 procent | 800, 0,14em, wit 38 procent |
| Teller op item | rood op de bel | geel vlak met zwart getal op Klanten |
| Inhoud | --bg | --surface |

### Gedrag

- Inklappen met "Menu inklappen" en "Menu uitklappen"; aria-expanded volgt.
- Ingeklapt blijft de teller staan als getal op het icoon.
- Uitloggen toont tijdens het uitloggen "Bezig…" en is dan uitgeschakeld (opacity 0,6).
- Op smal scherm vast op de icoonstrook zonder inklapknop. DealDrive doet dat tot en met 720 px; Dealtrace gebruikt voor beide zijbalken 767 px, zodat er één mobiele regel is.

### Teksten

Groepen "Portfolio", "Geld", "AI", "Bouwen"; items "Klanten", "Abonnementen", "Facturen", "LLM-connector", "Agent-prompts", "Roadmap"; rol "Founder"; "Uitloggen".

### Waar in DealDrive

`app/components/AdminShell.vue`.

![HQ-schil op /admin met gele rand en actief item Klanten](shots/a-6-hq-schil.png)

## Paginakop

### Wat het is

De kop bovenaan elke pagina: eventueel een kruimelpad, een kicker, de titel, een subtitel, en rechts de knoppen van de pagina. Altijd in een eigen sectie met een lijn eronder.

### Wanneer

- **Werkpagina** (een lijst of bord uit de navigatie, zoals Taken, Pipeline, Prospects, Campagnes): kicker met streep, `.title--groot`, `.subtitle--groot`, knoppen rechts.
- **Instellingen-, analyse- en detailpagina**: kruimelpad terug, kicker zonder streep, `.title` (32 px), `.subtitle`.
- Niet voor een sectie halverwege de pagina: daar gebruik je `.sec-title` met `.kicker--streep`.

### Opbouw

```html
<section class="section">
  <div class="container">
    <div class="sec-head">
      <div>
        <span class="kicker kicker--streep">Taken en opvolging</span>
        <h1 class="title title--groot">30 taken en 21 afspraken op de planning.</h1>
        <p class="subtitle subtitle--groot">Geen achterstallige taken. Netjes gehouden.</p>
      </div>
      <div class="toolbar-buttons">
        <button class="dd-actie dd-actie--taak" type="button">+ Taak</button>
        <button class="dd-actie dd-actie--afspraak" type="button">+ Afspraak</button>
      </div>
    </div>
  </div>
</section>
```

### Maten (gemeten)

| Onderdeel | Werkpagina (/taken) | Instellingen (/instellingen/werkwijze) |
|---|---|---|
| Sectie | 32 px boven en onder, lijn --border | idem |
| Kruimelpad | geen | 12 px 700 kapitalen, 8 px eronder |
| Kicker | 11 px, 0,2em, streep 24 bij 2 px geel | 11 px, 0,08em |
| Titel | 44 px op 1440, 28 px op 390, marge 12 px | 32 px, marge 4 px boven |
| Subtitel | 15 px --muted, marge 0 | 14 px --ink-soft, max 620 px, marge 8 px |
| Knoppen | 44 px hoog, rechts onderaan uitgelijnd | meestal geen |

### Opbouw van de kop

- `.sec-head` is flex met wrap, tekst links en knoppen rechts, onderaan uitgelijnd, 24 px tussenruimte (32 bestanden). 17 bestanden gebruiken een grid (1fr auto vanaf 720 px) met hetzelfde beeld; de voorganger had die grid, Dealtrace volgt de meerderheid.
- `.toolbar-buttons` houdt de knoppen bij elkaar met 8 px tussenruimte en loopt door op een nieuwe regel als het smal wordt. DealDrive noemt dit `.toolbar-buttons` (21 keer) en soms `.header-actions` (3); beide namen werken.
- Volgorde van de knoppen op /taken: zoeken (icoon), + Taak, + Afspraak, Weergave, Filters. De knoppen zelf staan in deel B.
- Op smal scherm vallen de knoppen onder de tekst.

### Kopniveau

DealDrive zet `.title` op een h2 (46 pagina's) en soms een h1 (5). Gebruik in Dealtrace één h1 per pagina met `.title`; de stijl hangt aan de klasse, niet aan het element.

### Toestanden

- Iets vraagt aandacht: `.subtitle--alert` maakt de subtitel rood, met het getal in strong ("5 taken zijn achterstallig. Loop ze door, of pas de vervaldatum aan.").
- Niets aan de hand: een korte geruststelling ("Geen achterstallige taken. Netjes gehouden.").
- De titel is een zin met de stand van zaken, niet alleen het woord van de pagina ("30 taken en 21 afspraken op de planning."). Instellingenpagina's gebruiken wel de naam ("Werkwijze").

### Sectiekop met navigatielink

Een sectie verderop op de pagina gebruikt `.kicker--streep`, `.sec-title`, `.sec-sub` en rechts een `.sec-link` ("Alle klanten →").

### Waar in DealDrive

`.sec-head` in 49 bestanden, onder meer `pages/taken.vue`, `pages/pipeline.vue`, `pages/klanten/index.vue`, `pages/instellingen/*.vue`.

![Paginakop van een werkpagina met statkaarten eronder (/taken)](shots/a-2-paginakop-werkpagina.png)

![Paginakop van een instellingenpagina met kruimelpad (/instellingen/werkwijze)](shots/a-4-paginakop-instellingen.png)

## Paginaraster, secties en containers

### Wat het is

Een pagina is een stapel volle-breedte secties. Elke sectie heeft één container van maximaal 1180 px met 24 px zijmarge. Binnen de container leggen rasters de kaarten neer.

### Opbouw

```html
<main class="app-shell-main">
  <section class="section">            paginakop </section>
  <section class="section section--stats"> statkaarten </section>
  <section class="section section--filter"> filterbalk (deel B) </section>
  <section class="section section--alt">
    <div class="container">
      <div class="raster raster--3"> kaarten (deel C) </div>
    </div>
  </section>
</main>
```

### Secties

| Klasse | Padding | Achtergrond en rand | Gebruik |
|---|---|---|---|
| .section | 32 px boven en onder | lijn --border onderaan | elke sectie (70 van 84 regels) |
| .section--alt | idem | --surface | afwisselend blok (46 bestanden) |
| .section--stats | 24 px boven en onder | lijn onderaan | strook met statkaarten |
| .section--filter | 16 px boven en onder | --bg, plakt bovenaan op --z-sticky | filterbalk (22 bestanden, 7 plakkend) |
| .section--lijst | 32 boven, 56 onder | geen lijn | lange lijst onderaan |
| .section--laatste | 32 px | geen lijn | laatste sectie |

### Containers

| Klasse | Breedte | Zijmarge |
|---|---|---|
| .container | --container-w, 1180 px | 24 px (79 van 86 regels) |
| .container--smal | --container-narrow, 920 px | 24 px |

Gemeten op 1440 breed: het hoofdvlak is 1200 px (1440 min 240 zijbalk), de container 1180 px gecentreerd, de inhoud 1132 px.

### Rasters

| Klasse | Smal | Vanaf 700 of 720 px | Vanaf 1000 px |
|---|---|---|---|
| .raster | 1 kolom | 1 kolom | 1 kolom |
| .raster--2 | 1 | 2 (720) | 2 |
| .raster--3 | 1 | 2 (720) | 3 |
| .raster--4 | 2 | 4 (700) | 4 |

Tussenruimte altijd `--kaart-gap` (16 px). In DealDrive komen `repeat(2, 1fr)` (32), `repeat(3, 1fr)` (30) en `repeat(4, 1fr)` (22) het meest voor.

### Waar in DealDrive

`.section` in 78 bestanden, `.container` in 80, `.section--alt` in 46, `.section--filter` in 22.

## Statkaarten

### Wat het is

Een rij cijferkaarten direct onder de paginakop. Elke kaart toont een label, een groot cijfer en een korte voet, en werkt als filter op de lijst eronder.

### Wanneer

- Op werkpagina's met een lijst die je op een paar emmers kunt filteren (Vandaag, Komende 7 dagen, Achterstallig, Alles open).
- Niet voor cijfers zonder filterfunctie op een detailpagina: gebruik daar de statstrook (`.stat-strip`) zonder kaarten.

### Opbouw

```html
<section class="section section--stats">
  <div class="container">
    <div class="stat-grid">
      <button class="stat-card" type="button" aria-pressed="false">
        <span class="stat-label">Vandaag</span>
        <span class="stat-num tnum">2</span>
        <span class="stat-foot">taken</span>
      </button>
      <button class="stat-card stat-card--alert stat-card--actief" type="button" aria-pressed="true">
        <span class="stat-label">Achterstallig</span>
        <span class="stat-num tnum">5</span>
        <span class="stat-foot">aandacht nodig</span>
      </button>
    </div>
  </div>
</section>
```

### Maten (gemeten op /taken)

| Onderdeel | Maat | Tekst | Kleur |
|---|---|---|---|
| Kaart | 271 bij 111 px, padding 16, tussenruimte 4 | | --wit, rand --border, hoek 2 px |
| Label | 18 px hoog | 11 px 700 kapitalen 0,15em | --muted |
| Cijfer | 34 px hoog | serif 32 px 700, regel 1,05, tnum | --ink |
| Voet | 18 px hoog | 11 px | --muted |
| Raster | 2 kolommen, 4 vanaf 700 px | | 16 px tussenruimte |

### Toestanden

| Toestand | Klasse | Effect |
|---|---|---|
| Hover | :hover, .is-hover | rand --ink, 1 px omhoog in 150 ms (--duur-kort) |
| Focus | :focus-visible, .is-focus | 2 px inkt-ring |
| Actief (filter aan) | .stat-card--actief, aria-pressed="true" | vlak --ink, label, cijfer en voet --yellow |
| Alert | .stat-card--alert | cijfer --red; actief weer geel |
| Laden | .stat-card--laden, aria-busy="true" | cijfer wordt een grijs vlak, voet --muted-light |
| Uitgeschakeld | disabled | opacity 0,5, geen hover |
| Soort | --urgent, --let-op, --positief, --accent, --info, --hot | streep van 3 px links in rood, oranje, groen, geel, blauw, paars |
| Zes kaarten | .stat-grid--6 | 6 kolommen vanaf 720 px (notificaties) |

### Gedrag

1. Klik op een kaart zet het filter op die emmer; de kaart wordt zwart. Nog een keer klikken of een andere kaart kiezen wisselt.
2. De lijst eronder volgt direct, zonder laadscherm.
3. Gebruik `aria-pressed` zodat een schermlezer weet welke kaart aan staat.

### Inconsistentie in DealDrive

Het cijfer is 24 px (pipeline, offertes), 26 px (notificaties), 32 px (taken) of 36 px (inzichten); de letterafstand van het label 0,08em tot 0,16em; de actieve kaart is meestal zwart met geel en op notificaties zwart met wit. Dealtrace volgt /taken: 32 px, 0,15em, zwart met geel. Taken is de pagina die het vaakst open staat en de enige met alle toestanden (actief, alert, actief plus alert). De voorganger gebruikte `--actief`; DealDrive `--active`; beide werken.

### Statstrook (detailpagina)

`.stat-strip` met `.stat-item`: 2 kolommen, 3 vanaf 700 px, 6 vanaf 1000 px. Label als hierboven, waarde serif 22 px (`.stat-value`) of tekst 14 px 600 (`.stat-value-tekst`), voet 11 px, met `.stat-foot--alert` in rood en vet. Gebruikt op de klant- en contactdetailpagina.

### Teksten

Labels in enkelvoud of als periode ("Vandaag", "Komende 7 dagen", "Achterstallig", "Alles open"); voet als eenheid of duiding ("taken", "aandacht nodig", "taken totaal").

### Waar in DealDrive

`pages/taken.vue`, `pages/inzichten.vue`, `pages/notificaties.vue`, `pages/pipeline.vue`, `pages/offertes.vue`; statstrook in `pages/accounts/[id]/index.vue` en `pages/contacten/[id]/index.vue`.

## Mobiele schil

### Wat het is

Wat er op een telefoon anders is. MobileShell wikkelt elke pagina met OfflineBanner, InstallPrompt, IOSInstallModal en PushSoftPrompt (deel C), zet `data-mobile-shell="on"` op body en haalt de offline gegevens op.

### Wat er verandert onder 768 px (gemeten op 390 bij 844)

| Onderdeel | Desktop | Mobiel |
|---|---|---|
| Zijbalk | 240 px of 64 px naar keuze | altijd de icoonstrook van 64 px |
| Hoofdvlak | padding links 240 px | 64 px |
| Container | 24 px zijmarge | 24 px zijmarge (blijft) |
| Paginatitel werkpagina | 44 px | 28 px |
| Knoppen in de kop | rechts naast de tekst | onder de tekst, doorlopend op meerdere regels |
| Statkaarten | 4 kolommen | 2 kolommen |
| Aanraakdoel | 44 px | 44 px, in handschoenmodus 54 px |

### Onderbalk

DealDrive had een menu onderin met vijf ingangen. Dat is vervallen: navigeren gaat via de icoonstrook, zodat alle pagina's bereikbaar blijven en niet alleen de vijf hoofdbestemmingen. `--bottom-nav-h` staat daarom op 0. De klasse `.onderbalk` van de voorganger is in Dealtrace uitgezet; gebruik hem niet in nieuwe schermen.

### Regels

- Elk klikbaar element minimaal `--touch-target-min` (44 px). Uitzondering in DealDrive: de navigatie-items in de zijbalk (33 px), bewust krap om alle items op het scherm te krijgen.
- Bediening die op desktop pas bij hover verschijnt, is op aanraakschermen altijd zichtbaar (`.hover-doel` met `(hover: none)`).
- Veilige zones via `--safe-area-*` op body; de notch en home-indicator dekken geen inhoud af.
- Geen horizontaal scrollen van de pagina; brede inhoud blijft binnen het hoofdvlak (`min-width: 0`).
- Voorbeelden en mock-ups tonen een telefoon in `.kader-telefoon` (390 px) met de schil op `.app-shell--ingeklapt`, omdat een media query op het venster reageert en niet op het kader.

### Waar in DealDrive

`app/components/MobileShell.vue`, `app/composables/useViewport.ts`, `tokens.css` (§16.5), `app.vue` (media query op 767 px).

![Taken op een telefoon van 390 px: icoonstrook, titel 28 px, statkaarten in twee kolommen](shots/a-5-mobiel.png)
