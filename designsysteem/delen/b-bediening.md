# Deel B · bediening

Dit deel beschrijft alles waarmee je in DealDrive iets doet: knoppen in elke rol, de werkbalk in de paginakop, de actiebalk onderin een flyout, formulieren, inline bewerken, filters, menu's, tabs, paginering, en de kleine labels en meters die een stand laten zien. Alle maten komen uit de code van `C:\Projecten\dealdrive` (commit 75bee61) en uit metingen met `getComputedStyle` in de draaiende app (werkplek op poort 3088, HQ op 3096). De klassen staan in `b-bediening.css`, de voorbeelden in `b-bediening.html`.

Vaste regels voor dit deel:

- Kleuren alleen met tokens uit deel A: de 47 uit `tokens.css` van DealDrive en de aanvulling voor Dealtrace (onder meer `--wit`, `--overlay-zacht`, `--red-pil`, `--yellow-teller`). Letterlijke kleuren staan alleen in de tokendefinities. Maten zonder token staan letterlijk in de CSS met de opmerking "geen token".
- Hoeken 2 px (`--radius`), geen schaduw, nooit rond (stylelint verbiedt `border-radius: 50%`).
- Elk klikbaar element is minimaal 44 px hoog (`--touch-target-min`). Uitzonderingen zijn alleen de knoppen in de actiebalk van een flyout (34 px, `--knop-h-compact`, en 37 px), de kleine knop in een rij en de knoppen van inline bewerken (32 px, `--knop-h-klein`) en het potlood (28 px, `--knop-h-mini`).
- Tekst nooit kleiner dan 11 px (`--fs-label`). Compact maken doe je met letterafstand en kapitalen, niet met een kleiner corps.
- Geel is de enige accentkleur. Rood alleen voor verwijderen, fout en urgent.

Waar DealDrive twee stijlen voor hetzelfde heeft, staat hieronder de meest gebruikte als standaard en de andere als uitzondering, met de telling.

## Knoppen in een paginakop

### Wat het is

De knop rechtsboven op een lijst- of analysepagina: + Klant, + Taak, + Afspraak, Download. In DealDrive is dit de globale klasse `.dd-actie` uit `tokens.css`, gebruikt in 23 bestanden (71 knoppen).

### Wanneer

- Gebruik `.dd-actie` voor elke knop in de paginakop en voor een losse knop op een pagina (Meer laden, Exporteer CSV).
- Niet in een flyoutvoet: daar staat `.dd-act` (kleiner, zie Actiebalk).
- Niet in een tabelrij: daar `.dd-actie--klein`.

### Opbouw

```html
<button type="button" class="dd-actie dd-actie--primair">
  <svg class="dd-actie-icoon">...</svg> Klant
</button>
```

Het plusteken is een Lucide-icoon `Plus` van 16 px, geen tekst "+". De tekst is alleen het zelfstandig naamwoord: "Klant", "Taak", "Afspraak", "Deal", "Campagne", "Prospect", "Accountplan", "Mail".

### Varianten

| Variant | Gebruik | Vlak en tekst | Hover | Telling |
|---|---|---|---|---|
| `--primair` | Hoofdactie van de pagina (+ Klant, + Prospect, + Campagne) | `--ink`, tekst `--yellow` | `--ink-soft` | 11x |
| `--secundair` | Andere acties naast de hoofdactie (+ Taak op een klantenlijst, Meer laden) | `--bg`, rand `--border-strong` | rand `--ink` | 9x |
| `--taak`, `--mail` | Werk dat je zelf doet | `--yellow`, tekst `--ink` | `--yellow-dark` | 21x en 6x |
| `--afspraak`, `--deal` | Werk dat je met een ander afspreekt | `--ink`, tekst `--yellow` | `--ink-soft` | 18x en 4x |
| `--download` | Download, achteraan | gelijk aan primair | `--ink-soft` | 4x (lokaal) |
| `--gevaar` | Verwijderen op een pagina | transparant, rand en tekst `--red` | vlak `--red`, tekst wit | uit `.hq-btn--gevaar` |
| `--icoon` | Alleen een icoon, zoals Zoeken | `--bg`, rand `--border-strong`, 44 x 44 | rand `--ink` | 16x als `.btn-zoek` |
| `--klein` | In een tabelrij | 32 px hoog (`--knop-h-klein`), padding 5px 10px, 11 px | per kleur | uit `.hq-btn--klein` (33x) |

### Maten (gemeten)

| Eigenschap | Waarde |
|---|---|
| Hoogte | 44 px (`--touch-target-min`) |
| Padding | 8px 14px |
| Letter | 13 px, gewicht 700, letterafstand 0.01em, gewone kast |
| Icoon | 16 px, gap 6 px |
| Rand en hoek | 1 px, 2 px (`--radius`) |
| Overgang | achtergrond en rand, `--transition-fast` (120 ms) |

### Toestanden

| Toestand | Uiterlijk |
|---|---|
| Hover | primair en zwart naar `--ink-soft`; geel naar `--yellow-dark`; secundair krijgt rand `--ink` |
| Focus | 2 px `--ink` met 2 px afstand (de focusstijl van 21 van 28 knopregels in de code; `.dd-actie` zelf heeft in DealDrive geen eigen focusstijl en valt terug op de browser) |
| Uitgeschakeld | opacity 0.5, cursor not-allowed |
| Laden | uitgeschakeld en de tekst wordt "Opslaan…" of "Bezig…"; cursor wait. Er is geen draaiend icoon (alleen in 3 Dex-bestanden). |

### Uitzonderingen in DealDrive

- **`.btn-action` in kapitalen** (48 knoppen in 15 bestanden: instellingen, mail-koppeling, inbox, sync): 12 px, kapitalen, letterafstand 0.02em, zwart met geel. Ouder; de opmerking in `tokens.css` zegt dat de hoofdactie op elke pagina dezelfde knop is. Gebruik `.dd-actie`.
- **`.hq-btn`** in HQ (52 knoppen in 6 bestanden): zelfde opbouw als `.dd-actie`, maar 12 px en wit vlak (`--wit`). Alleen voor beheerschermen.
- **Klasse `.dd-actie--secundair` voor + Taak**: op klanten/alle en prospects/alle staan + Taak en + Afspraak secundair, omdat de klant zelf de hoofdactie is. Op /taken zijn ze geel en zwart.

![Werkbalk en filterstrook op Alle klanten](shots/b-1-werkbalk-en-filterbalk.png)

## Knoppen per rol

Deze tabel zegt per rol welke tekst, plek en stijl DealDrive gebruikt. Tellingen komen uit alle `.vue`-bestanden.

| Rol | Tekst in DealDrive | Stijl | Plek en volgorde | Telling |
|---|---|---|---|---|
| Nieuw | "Klant", "Taak", "Afspraak", "Deal" met plus-icoon | `.dd-actie--primair`, of `--taak` en `--afspraak` | Paginakop, direct na Zoeken | 71 knoppen `.dd-actie` |
| Opslaan (nieuw) | Werkwoord met object: "✓ Maak taak", "✓ Plan afspraak", "Deal toevoegen", "Contact aanmaken", "Klant aanmaken" | `.dd-act--primair` | Uiterst rechts in de voet | 34 voeten geteld |
| Opslaan (bewerken) | "✓ Opslaan" (4x) of "Opslaan" (7x); tijdens opslaan "Opslaan…" (12x) | `.dd-act--primair` | Uiterst rechts, Annuleren er direct voor of uiterst links | |
| Annuleren | "Annuleren" (36 knoppen; 1x "Annuleer" in DealFlyout) | `.dd-act` (wit met rand) | Links in de voet (17 van 19), in bewerkstand direct links van Opslaan (2 van 19) | 36 |
| Bewerken | Potlood-icoon, tooltip "Bewerken" (7x) of "Wijzigen" (6x) | `.dd-act--icoon` | In de icoonrij, na Vraag AI en Snooze | 13 |
| Verwijderen | Prullenbak-icoon, tooltip "Verwijderen"; vraagt altijd bevestiging met knop "Verwijderen" | `.dd-act--icoon.dd-act--gevaar`; in de dialoog `.cd-btn--danger` | Voorlaatste in de icoonrij, voor Open klantkaart | 7 in voeten, 16x confirmLabel "Verwijderen" |
| Sluiten | Kruis "×" met aria-label "Sluiten"; in een alleen-lezen venster de knop "Sluiten" | `.dd-sluit`; als woord `.dd-act` | Rechtsboven in de flyoutkop; als woord links in de voet | 57 kruisjes |
| Filter | "Filters" met schuifjes-icoon en teller | `.vd-toggle`, zwart zodra een filter aan staat | Paginakop, na Weergave en Sortering | 30 `.vd-toggle` |
| Weergave | "Weergave" met het icoon van de huidige weergave | `.vd-toggle` met menu | Paginakop, na de + knoppen | 5 pagina's |
| Sortering | Label van de huidige sortering ("Naam") met pijltjes-icoon | `.vd-toggle` met menu | Direct na Weergave | 2 pagina's |
| Exporteren | "Download" (4x, opent DownloadFlyout) of "Exporteer CSV" (1x) | `.dd-actie--download` (zwart) of `--secundair` | Achteraan in de werkbalk | 5 |
| Zoeken | Vergrootglas, aria-label en title "Zoeken" | `.dd-actie--icoon` (in DealDrive `.btn-zoek`) | Eerste knop van de werkbalk, opent de globale zoek | 16 in 12 bestanden |
| Meer-menu | Geen drie-puntjesknop in DealDrive; meer acties via rechtsklik of lang drukken | `.ctx-menu` | Op een rij | 7 |
| Toon meer | "Toon meer" of "Meer laden" | `.meer-knop` of `.dd-actie--secundair` | Onder de lijst, gecentreerd | 3 |
| Reset | "Reset filters" (11x), "Reset filter" (2x), "Wis filters" (1x) | `.dd-tekstknop` | Rechts in de filterstrook | 14 |

### Teksten

- Knoppen zeggen wat er gebeurt: werkwoord plus object ("Deal toevoegen", "Plan afspraak"), of alleen het object als het een + knop is.
- Het vinkje "✓ " voor de primaire knop staat in 7 voeten (Maak taak, Plan afspraak, Opslaan). Het is optioneel; gebruik het voor afronden en opslaan, niet voor navigeren.
- Een bevestiging zonder eigen label heet "Bevestigen"; bij een vraag over verwijderen "Verwijderen" (`useConfirm`, standaardLabel). Een rode knop heet nooit "OK".
- Een pijl "→" achter een knoptekst betekent dat je naar een andere pagina gaat ("Open campagnebord →", "Hele kaart in DealDrive →").
- Laden: "Opslaan…" (10x in een ternary), "Bezig…" (44x, vooral HQ), "Aanmaken…" (3x), "Versturen…" (2x). Altijd met het teken "…", niet met drie punten.

## Werkbalk in de paginakop

### Wat het is

De rij knoppen rechts naast titel en subtitel van een lijstpagina. In DealDrive `.toolbar-buttons`, 21 werkbalken in 15 pagina's. De klasse `.toolbar-buttons` zelf en de plaats in de paginakop staan in deel A; dit hoofdstuk gaat over de knoppen erin.

### Volgorde (vast)

1. Zoeken (icoonknop)
2. De primaire + knop van de pagina
3. Andere + knoppen (+ Taak, + Afspraak, + Mail)
4. Weergave
5. Sortering
6. Filters
7. Download of Exporteer

Elke werkbalk in DealDrive volgt deze volgorde. Een pagina laat weg wat ze niet heeft (offertes: Zoeken en + Deal; rapportage-activiteiten: Filters en Download).

### Opbouw

```html
<div class="toolbar-buttons">
  <button class="dd-actie dd-actie--icoon" aria-label="Zoeken" title="Zoeken">...</button>
  <button class="dd-actie dd-actie--primair">... Klant</button>
  <button class="dd-actie dd-actie--secundair">... Taak</button>
  <div class="vd-wrap"><button class="vd-toggle">... Weergave ...</button></div>
  <div class="vd-wrap"><button class="vd-toggle">... Naam ...</button></div>
  <button class="vd-toggle">... Filters ...</button>
</div>
```

### Maten

| Eigenschap | Waarde |
|---|---|
| Gap | 8 px (11x) of 10 px (10x); gebruik 8 px |
| Uitlijning | onderkant (`align-items: flex-end`) |
| Plaats | rechts naast de kop, onder elkaar als de ruimte op is (`.sec-head` met wrap, deel A); alleen klanten/alle zet de werkbalk op een eigen regel (`flex: 1 0 100%`) |
| Telefoon | knoppen lopen door naar de volgende regel; op 375 px gemeten: Zoeken, + Klant, + Taak op regel 1, + Afspraak op 2, Weergave op 3, Sortering en Filters op 4 |

![Tabbalk op de klantkaart en de werkbalk op 375 px](shots/b-6-tabbalk-en-mobiel.png)

## Dropdownknop met menu: Weergave, Sortering, Filters

### Wat het is

Een witte knop met icoon, label en pijltje. Weergave en Sortering openen een menu eronder; Filters klapt de filterstrook open. In DealDrive `.vd-toggle` (30x in 17 bestanden) met `.vd-menu` en `.vd-item` (5 bestanden).

### Opbouw

```html
<div class="vd-wrap">
  <button class="vd-toggle" aria-expanded="true">
    <svg class="vd-icoon"/> <span class="vd-toggle-value">Weergave</span> <svg class="vd-caret rotate"/>
  </button>
  <ul class="vd-menu">
    <li><button class="vd-item vd-item--active"><svg class="vd-icoon"/> Lijst</button></li>
    <li><button class="vd-item"><svg class="vd-icoon"/> Compact</button></li>
  </ul>
</div>
<button class="vd-toggle vd-toggle--active" aria-expanded="false">
  <svg class="vd-icoon"/> Filters <span class="vd-toggle-count">2</span> <svg class="vd-caret"/>
</button>
```

### Maten en kleuren (gemeten)

| Onderdeel | Waarde |
|---|---|
| Knop | 44 px hoog, padding 8px 14px, 13 px gewicht 700, gap 7 px, vlak `--wit`, rand `--border-strong` |
| Hover | rand `--ink` |
| Actief (Filters open of filter aan) | vlak `--ink`, tekst `--yellow` |
| Teller | 18 px hoog (`--teller-h`), padding 0 7px, 11 px gewicht 800, vlak `--yellow`, tekst `--ink` |
| Pijltje | ChevronDown 14 px, draait 180 graden in 150 ms (`--duur-kort`) als het menu open is |
| Menu | 180 px breed, 4 px van de knop, padding 4 px, vlak `--wit`, rand `--border-strong`, rechts uitgelijnd met de knop |
| Item | 37 px hoog, padding 8px 10px, 13 px gewicht 600, icoon 16 px; hover `--surface`; gekozen zwart met geel |
| Animatie | menu schuift 4 px in en vervaagt, 120 ms |

### Weergaven in DealDrive

| Pagina | Keuzes in het menu |
|---|---|
| Klanten en prospects | Lijst, Compact, Kaarten |
| Taken | Horizon, Lijst |
| Pipeline | Kanban, Lijst |
| Agenda | Werkweek, Week, Maand |

Het knoplabel blijft "Weergave"; het icoon wisselt mee met de gekozen weergave (List, Rows3, LayoutGrid, Kanban, CalendarRange). Een kaartweergave (MiniMap) zit niet in dit menu.

### Sortering

DealDrive heeft geen klikbare kolomkoppen (geen `aria-sort` in de code). Sorteren gaat via de tweede dropdownknop met icoon ArrowUpDown. Het label is de huidige keuze. Opties op klanten en prospects: "Naam" (standaard), "Laatste activiteit", "Score", "Accountklasse".

### Filterteller

- De teller telt het aantal filtergroepen dat afwijkt van de standaard, plus 1 als er een zoekterm staat ("anders staat er een lege lijst onder een knop die zegt dat er niets aan staat").
- Bij nul verdwijnt de teller.
- Op pipeline en campagnes staat "5/7": zichtbare fasen van het totaal.
- De knop is zwart zodra de strook open is of er een filter aan staat.

### Gedrag

1. Klik opent het menu; `aria-expanded` volgt.
2. Een keuze sluit het menu en past de lijst direct aan.
3. Klik naast het menu (mousedown buiten) sluit het.
4. DealDrive sluit dit menu niet met Escape; voeg dat in Dealtrace toe.
5. Een nieuwe weergave of sortering zet "Toon meer" terug op 25 rijen.

![Weergavemenu en contextmenu](shots/b-2-menus.png)

## Actiebalk onderin een flyout of venster

### Wat het is

De rij knoppen onderin een flyout. Deel C beschrijft de voet als onderdeel van de flyout (vlak, rand, plakken); hier staan de knoppen. In DealDrive `.dd-acties` en `.dd-act` uit `tokens.css`: `.dd-act` 82x in 20 bestanden, `--primair` 28x, `--icoon` 25x, `--gevaar` 7x. Van de 34 voeten in de code gebruiken er 16 `.dd-acties`; de andere 18 hebben een eigen klasse met dezelfde volgorde.

### Drie standen

| Stand | Links | Midden | Rechts |
|---|---|---|---|
| Nieuw | Annuleren | vulling | primaire actie ("✓ Maak taak") |
| Lezen | primaire actie met woord ("Afronden", "Open meeting", "Markeer gewonnen") | vulling | iconen: Vraag AI, Snooze 1 dag, Bewerken, Verwijderen, Open klantkaart |
| Bewerken | nevenactie ("Afronden", "Afronden en volgende taak") of Annuleren | vulling | Annuleren (als links iets anders staat) en "✓ Opslaan" |

De volgorde van de iconen is overal gelijk, zoals de code zegt: primair, helpen, uitstellen, wijzigen, weggooien, weggaan. Een venster van 520 px heeft geen ruimte voor zes woorden, daarom houdt alleen de actie waarvoor je het venster opende het woord.

### Opbouw

```html
<footer class="dd-acties">
  <button type="button" class="dd-act">Annuleren</button>
  <span class="dd-acties-vul"></span>
  <button type="submit" class="dd-act dd-act--primair" disabled>✓ Maak taak</button>
</footer>
```

```html
<footer class="dd-acties">
  <button class="dd-act dd-act--primair"><svg class="dd-act-icoon"/> Afronden</button>
  <span class="dd-acties-vul"></span>
  <button class="dd-act dd-act--icoon" title="Vraag AI" aria-label="Vraag AI">...</button>
  <button class="dd-act dd-act--icoon" title="Bewerken" aria-label="Bewerken">...</button>
  <button class="dd-act dd-act--icoon dd-act--gevaar" title="Verwijderen" aria-label="Verwijderen">...</button>
  <a class="dd-act dd-act--icoon" title="Open klantkaart" aria-label="Open klantkaart">...</a>
</footer>
```

Een icoonknop heeft altijd `title` en `aria-label` met hetzelfde woord.

### Maten (gemeten in TaakFlyout en NieuweTaakFlyout)

| Knop | Hoogte | Padding | Letter | Kleuren |
|---|---|---|---|---|
| `.dd-act` | 37 px | 8px 12px | 12 px, 700 | vlak `--bg`, rand `--border-strong`; hover rand `--ink` |
| `--primair` | 37 px | 8px 12px | 12 px, 700 | `--ink`, tekst `--yellow`; hover `--ink-soft` |
| `--icoon` | 34 x 34 | 0 | icoon 16 px | als `.dd-act` |
| `--gevaar` | 34 of 37 px | | | tekst `--red`; hover rand `--red` |
| Rij | | gap 8 px | | geen terugloop, horizontaal scrollen bij te veel knoppen |

Let op: in de bewerkstand van een taak (vier knoppen) is de rij breder dan het venster en valt "✓ Opslaan" half buiten beeld (zie de schermafbeelding). Houd in Dealtrace maximaal drie tekstknoppen in een voet.

### Gedrag

- De primaire knop staat uitgeschakeld (opacity 0.5) tot de verplichte velden gevuld zijn (`:disabled="!canSubmit || submitting"`).
- Tijdens opslaan: uitgeschakeld en de tekst wordt "Opslaan…".
- Na opslaan sluit de flyout en volgt een toast, bijvoorbeeld "Taak toegevoegd. Staat bij Taken." of "Deal bijgewerkt." (deel C).
- Annuleren sluit zonder vragen; die knop indrukken is een keuze. Sluiten met Escape of een klik naast de flyout vraagt eerst bevestiging als er niet opgeslagen invoer is (AccountplanFlyout, deel C).
- Verwijderen opent altijd eerst het bevestigingsvenster.

![Knoppen onderin een flyout in drie standen en het bevestigingsvenster](shots/b-4-knoppen-onderin.png)

## Knoppen in het bevestigingsvenster

### Wat het is

De twee knoppen in ConfirmDialog. Het venster zelf staat in deel C. Opgeroepen met `useConfirm().ask(...)`, 48x met `variant: 'danger'`.

### Opbouw en volgorde

```html
<footer class="cd-foot">
  <button class="cd-btn cd-btn--ghost">Annuleren</button>
  <button class="cd-btn cd-btn--danger">Verwijderen</button>
</footer>
```

Annuleren links, bevestigen rechts, beide rechts uitgelijnd. De focus start op Annuleren, zodat Enter nooit per ongeluk iets verwijdert (gemeten: `document.activeElement` is `.cd-btn--ghost` direct na openen).

### Varianten

| Klasse | Gebruik | Vlak en tekst | Hover |
|---|---|---|---|
| `--ghost` | Annuleren | transparant, rand `--border-strong`, tekst `--ink` | rand `--ink` |
| `--primary` | Bevestigen zonder gevaar ("Zet in agenda", "Afronden") | `--yellow`, tekst `--ink` | `--yellow-dark` |
| `--danger` | Verwijderen, Verwerpen, Ontkoppelen, Uitschakelen | `--red`, tekst wit | `--red-dark` |

Maten: 44 px hoog, padding 10px 18px, 13 px gewicht 700.

Teksten op de bevestigknop (tellingen): "Verwijderen" 16, "Verwerpen" 3, "Standaardset terugzetten" 3, "Weggooien" 2, "Afronden" 2, en 12 andere eenmalig. De vraag is de titel ("Taak verwijderen?"), de zin eronder zegt wat er gebeurt ("… wordt definitief verwijderd.").

## Tekstknop en sluitknop

### Tekstknop

Een knop die eruitziet als een onderstreepte link, voor een lichte actie die niets aanmaakt: "Reset filters", "Toon alles". In DealDrive `.filter-reset` (14x in 11 bestanden).

| Eigenschap | Waarde |
|---|---|
| Letter | 12 px, gewicht 600, `--muted`, onderstreept |
| Padding | 4px 8px, geen rand, geen vlak |
| Hover | `--ink` |

Niet gebruiken voor navigatie: een link naar een andere pagina is een `<a>` (deel A, links).

### Sluitknop

Het kruis rechtsboven in een flyout of melding: "×" met `aria-label="Sluiten"` (57 knoppen). 44 x 44, teken 28 px, `--muted`, hover `--ink`. De plek in de flyoutkop staat in deel C. In een alleen-lezen venster zonder formulier staat onderin ook een knop "Sluiten" (`.dd-act`, 5 voeten).

## Formulier: veld, label, invoer

### Wat het is

Het formulier in een flyout (nieuwe taak, nieuwe deal, nieuw contact) en op instellingenpagina's. DealDrive heeft geen gedeelde formulierklasse: elke flyout heeft eigen klassen (`.nt-field`, `.nd-field`, `.na-veld`), allemaal met dezelfde opbouw. 122 invoerregels in 71 bestanden; hieronder de meest gebruikte waarden.

### Opbouw

```html
<form class="formulier">
  <label class="veld">
    <span class="veld-label">Titel <span class="veld-verplicht">*</span></span>
    <input class="invoer" type="text" required placeholder="bv. Bel Henk de Vries terug">
  </label>
  <div class="veld veld--rij">
    <label class="veld"><span class="veld-label">Vervaldatum</span><input class="invoer" type="date"></label>
    <label class="veld"><span class="veld-label">Tijd</span><input class="invoer" type="time"></label>
  </div>
  <p class="veld-fout">Opslaan mislukt: taak niet gevonden.</p>
  <footer class="dd-acties">...</footer>
</form>
```

Een groep keuzeknoppen staat in `<fieldset class="veld">` met `<legend class="veld-label">`.

### Maten en kleuren

| Onderdeel | Waarde | Bron |
|---|---|---|
| Label | 11 px, gewicht 800, kapitalen, letterafstand 0.1em, `--muted` | 63x kapitalen in `--muted` |
| Verplicht | rood sterretje "*" achter het label, gewicht 800 | 7 bestanden |
| Invoer | 44 px hoog, padding 10px 12px, 14 px, vlak `--wit`, rand `--border-strong`, hoek 2 px | rand 75x, 44 px 33x |
| Placeholder | `--muted-light`; begint met "bv." (28x) of "Zoek" (24x) of "Optioneel" (3x) | |
| Focus | 2 px `--yellow`, offset -1 px (de lijn valt over de rand) | 31x |
| Uitgeschakeld | vlak `--surface`, tekst `--muted` | |
| Fout in een veld | rand `--red`, regel eronder 12 px `--red` gewicht 600 | zeldzaam (dex/profiel) |
| Foutmelding formulier | blok boven de voet: 13 px `--red`, vlak `--red-zacht` (rood op 8 procent), linkerrand 3 px `--red`, padding 10px 12px | 16x |
| Hulptekst | 11 tot 13 px `--muted` | 57x `--muted` |
| Tekstvak | minimaal 84 px, verticaal te vergroten, regelafstand 1.45 | |
| Keuzelijst | native `<select>` met de pijl van de browser | 137 selects, 3x `appearance: none` |
| Datum en tijd | native `type="date"` (47x) en `type="time"` (13x), naast elkaar met gap 12 px | |
| Compact | 34 px (`--knop-h-compact`), padding 6px 10px, 13 px (panelen en instellingen) | 13 px komt 36x voor |
| Afstand | label en invoer 6 px; velden onder elkaar 14 px | |

### Uitzondering

Instellingenpagina's en kleine panelen gebruiken 13 px en soms `var(--bg)` als vlak (31x). In een flyout is het 14 px op wit (gemeten in NieuweTaakFlyout). Kies 14 px op wit; gebruik `.invoer--klein` voor een compact paneel.

### Gedrag

- Het belangrijkste tekstveld krijgt `autofocus` (3 flyouts, waaronder Nieuwe taak: het veld Titel). Doe dat in Dealtrace in elk formulier dat met een + knop opent.
- De primaire knop is uitgeschakeld tot de verplichte velden gevuld zijn; er is geen rode melding vooraf.
- Een fout van de server komt als `.veld-fout` boven de voet, in een zin: "Opslaan mislukt: taak niet gevonden.", "Vastleggen mislukt. Probeer het opnieuw."
- `aria-invalid` komt in DealDrive niet voor; zet het in Dealtrace wel op een veld met `.invoer--fout`.

![Formulier in de flyout Nieuwe taak](shots/b-3-formulier-in-flyout.png)

## Vinkje, keuzerondje en schakelaar

### Vinkje en keuzerondje

Native `<input type="checkbox">` (30x) en `type="radio"` (5x) met `accent-color: var(--yellow-dark)` (15x; `--ink` 5x). Het label staat rechts. In een flyout staat een vinkje dat een blok openklapt in de stijl van een veldlabel: 11 px, kapitalen, letterafstand 0.12em, `--muted` ("Taak herhalen", "Herinnering instellen"). Als het vinkje aan staat, krijgt het blok eronder een kader (`.veld-klap--open`: vlak `--surface`, rand `--border`, padding 12 px); uit is er geen kader.

### Schakelaar

Voor een instelling die direct ingaat, zonder Opslaan (meldingen, automatisering). In DealDrive `Toggle.vue`, 8x in 4 bestanden.

```html
<button type="button" class="schakelaar schakelaar--aan" role="switch" aria-checked="true" aria-label="Dagstart per mail">
  <span class="schakelaar-spoor"></span><span class="schakelaar-duim"></span>
</button>
```

| Onderdeel | Uit | Aan |
|---|---|---|
| Knop | 48 x 44 (klikvlak) | |
| Spoor | 44 x 22, `--border-strong` | `--ink` |
| Duim | 16 x 16, wit, rand `--ink`, links | `--yellow`, rechts |
| Focus | 2 px `--ink`, 4 px afstand | |
| Uitgeschakeld | opacity 0.5 | |
| Animatie | spoor en duim schuiven in `--transition-fast` | |

Geef altijd een naam mee met `aria-label` of `aria-labelledby`; de schermlezer hoort verder "Aan" of "Uit".

## Keuzeknoppen in een formulier

### Keuzeraster

Een raster van vier knoppen waarvan er één aan staat, met een icoon boven het woord: type taak "Te doen", "Bellen", "Mailen", "Bericht" (NieuweTaakFlyout, TaakFlyout, NieuweActiviteitFlyout).

| Eigenschap | Waarde |
|---|---|
| Raster | 4 kolommen, gap 6 px; onder 600 px 3 kolommen |
| Knop | 60 px hoog (minimaal 56, `--keuzeknop-h`), padding 10px 8px, 11 px gewicht 700, icoon 16 px |
| Uit | `--wit`, rand `--border-strong`, tekst `--muted`; hover rand en tekst `--ink` |
| Aan | `--ink`, tekst `--yellow` |

Geen hover op de actieve knop: anders wordt het label zwart op zwart (opmerking in de code).

### Prioriteit

Vier knoppen naast elkaar met een gekleurde stip van 8 px: "Laag" (`--border-strong`), "Middel" (`--yellow`), "Hoog" (`--orange`), "Urgent" (`--red`). 44 px hoog, 12 px gewicht 700, letterafstand 0.02em. Aan: zwart met gele tekst; de stip houdt zijn kleur. De gekozen prioriteit staat ook in de kicker van de flyout ("Nieuwe taak · Middel").

## Zoekvelden en keuzechips

### Zoekveld in een filterstrook

`<input type="search">` (20x), eerste element in de filterstrook. 48 px hoog (`--touch-target-comfortable`), minimaal 280 px breed (`--zoekveld-min-w`), padding 8px 14px, 14 px, wit. Focus: 2 px `--ink` met 2 px afstand. Het filtert terwijl je typt; het kruisje van de browser wist de term. Placeholder noemt waarop je zoekt: "Zoek naam, plaats of branche…".

### Type-ahead in een flyout

Voor klant en contactpersoon (6 flyouts). Typen filtert de namen, een klik kiest.

```html
<div class="zoekveld">
  <input class="invoer" placeholder="Zoek op klantnaam…" autocomplete="off">
  <ul class="zoeklijst">
    <li><button class="zoeklijst-item">Bakker Bouw B.V. <span class="zoeklijst-sub">· Bouw</span></button></li>
  </ul>
</div>
```

- Lijst direct onder de invoer, rand `--border-strong` zonder bovenrand, vlak `--bg`, maximaal 240 px hoog.
- Item: padding 10px 12px, 13 px, scheidingslijn `--border`, hover `--surface`. Aanvulling in `--muted` na " · ".
- Niets gevonden: "Geen klant gevonden." in 12 px `--muted` op dezelfde plek.
- Gebruik `mousedown` met `preventDefault` op een item, anders verliest de invoer de focus voor de klik telt.
- Na een keuze wordt het veld een keuzechip.

### Gekozen waarde

```html
<div class="zoek-keuze">
  <span class="zoek-keuze-tekst">Henk de Vries <span class="zoek-keuze-sub">· Inkoper</span></span>
  <button class="zoek-keuze-wis" aria-label="Wis gekozen contactpersoon">×</button>
</div>
```

44 px hoog, vlak `--surface`, rand `--border-strong`, naam 14 px gewicht 600. Het kruisje is 32 x 32, `--muted`, hover `--red`.

### Keuzechips

Een lijst gekozen waarden die je los weghaalt (contactpersonen in een accountplan): `.keuzechip`, padding 4px 8px, 12 px gewicht 600, vlak `--surface`, rand `--border`, met een kruisje in `--muted`.

## Inline bewerken

### EditableField

Een gegeven dat je op zijn plek wijzigt, zonder formulier: telefoon, website, adres in de flyout Bedrijfsgegevens. 43x gebruikt.

```html
<div class="ef">
  <span class="ef-label">Telefoon</span>
  <div class="ef-display">
    <a class="ef-value ef-value--link" href="tel:...">020 123 45 67</a>
    <button class="ef-pencil" aria-label="Bewerk Telefoon">...</button>
  </div>
</div>
```

| Toestand | Uiterlijk |
|---|---|
| Lezen | raster 110 px label en waarde, label 11 px kapitalen `--muted`, waarde 14 px; rij 49 px |
| Hover | stippellijn `--border` onder de rij; potlood 28 x 28 verschijnt rechts |
| Leeg | "+ Voeg postcode toe" (het label in kleine letters) cursief 13 px `--muted-light`; potlood half zichtbaar (0.6) |
| Link | telefoon, e-mail en website als link met lijn `--border-strong`; website met "↗" |
| Bewerken | invoer 36 px met zwarte rand en gele focus; rechts kruis (Annuleren) en vinkje (Opslaan), elk 32 x 32 |
| Opslaan-knop | `--ink` met geel vinkje; Annuleren wit, hover rood |

Gedrag:

1. Klik op de waarde of het potlood opent de invoer met de tekst geselecteerd.
2. Enter of het vinkje slaat op; ongewijzigd opslaan doet niets.
3. Escape of het kruis annuleert.
4. Een keuzelijst met 8 of meer opties wordt een invoer met suggesties (datalist).
5. Op een aanraakscherm is het potlood altijd zichtbaar (`@media (hover: none)`, 4x in de code).

### InlineEditChip

Een woord in een kicker dat je aanklikt om te wijzigen: branche, plaats, land en functie bovenaan de klantkaart (4x). Het neemt de letter van de omgeving over. Onder de muis verschijnt een geel potlood van 11 px. Klik maakt er een kleine invoer van (padding 2px 6px, rand `--border-strong`, focus rand `--ink`). Verlaten van het veld slaat op, Escape annuleert.

![InlineEditChip en EditableField, hover en bewerken](shots/b-5-inline-bewerken.png)

## Filters

### Wat het is

De strook onder de paginakop die openklapt met de knop Filters. Per groep een label in kapitalen en een rij filterpillen; rechts "Reset filters". In DealDrive `.filter-pill` (68x in 18 bestanden), `.filter-group` (78x), `.filter-label` (71x), `.section--filter` (22x in 19).

### Opbouw

```html
<section class="section section--filter">
  <div class="container">
    <div class="filters">
      <div class="filter-groep"><input class="zoekinvoer" type="search" placeholder="Zoek naam, plaats of branche…"></div>
      <div class="filter-groep">
        <span class="filter-label">Accountklasse</span>
        <button class="filter-pil filter-pil--aan">Alle klanten <span class="pil-teller">96</span></button>
        <button class="filter-pil">A · Corporate <span class="pil-teller">27</span></button>
      </div>
      <div class="filter-groep filter-groep--eind"><button class="dd-tekstknop">Reset filters</button></div>
    </div>
  </div>
</section>
```

### Maten en kleuren (gemeten op Alle klanten)

| Onderdeel | Waarde |
|---|---|
| Strook | padding 16px 0, vlak `--bg` (13x; `--surface` 7x), onderrand `--border` |
| Groepen | gap 24 px tussen groepen, 6 px binnen een groep |
| Label | 11 px, gewicht 800, kapitalen, letterafstand 0.1em, `--muted`, 4 px rechts |
| Pil | 44 px hoog, padding 6px 12px, 12 px gewicht 600, tekst `--muted`, transparant, rand `--border-strong` |
| Pil hover | tekst en rand `--ink` |
| Pil aan | `--ink`, tekst `--yellow` |
| Pil uit (0 resultaten) | opacity 0.45, geen hover |
| Teller in pil | padding 1px 6px, 11 px gewicht 800, `--surface` met `--ink-soft`; in een actieve pil geel op `--yellow-teller` (geel op 20 procent) |
| Animatie | openklappen met max-height 220 ms (`--duur-in`) en opacity 160 ms (`--duur-vervaag`) |

### Gedrag

- Elke groep heeft een pil "Alle …" die de groep uitzet.
- Binnen een groep staat er één aan; tussen groepen combineren de filters.
- Een pil met teller 0 is uitgeschakeld, niet verborgen.
- "Eigen periode" opent twee datumvelden (Van, Tot) in dezelfde strook, met het filterlabel als label.
- "Reset filters" zet alle groepen terug en wist ook de zoekterm; staat alleen als er iets aan staat.
- Een lege lijst door filters toont een lege staat met de knop "Toon alles" (deel C).

### Uitzondering

`bezoek-analyse.vue` en enkele rapportages gebruiken `--surface` als strookvlak en padding 14px 0. Gebruik `--bg`.

## Segmentknoppen

Een vaste rij van twee tot vier standen in één kader, waarvan er één aan staat. Zeldzaam in DealDrive: het venster op Verdieping (`.vd-seg`) en de periode in een kaartkop in de organisatieflyout (`.ak-per`). Periodes en weergaven kies je in DealDrive meestal met filterpillen of het menu Weergave; gebruik segmentknoppen alleen als de keuze altijd zichtbaar moet zijn en de lijst kort is.

```html
<div class="keuzegroep" role="group" aria-label="Venster">
  <button class="keuzegroep-knop keuzegroep-knop--aan" aria-pressed="true">Maand</button>
  <button class="keuzegroep-knop" aria-pressed="false">Kwartaal</button>
</div>
```

| Onderdeel | Waarde |
|---|---|
| Kader | rand `--border-strong`, hoek 2 px |
| Knop | 44 px hoog, padding 8px 16px, 13 px gewicht 700, vlak `--bg`, tekst `--muted`, scheidingslijn `--border-strong` |
| Hover | tekst `--ink` |
| Aan | `--ink`, tekst `--yellow`, ook onder de muis |
| Klein (kaartkop) | padding 4px 11px, 11 px |

## Tabbalk

### Wat het is

Tabs binnen een detailpagina: klantkaart en contactkaart (tien tabs), instellingen, accountplan. Onderstreept, geen blokken.

```html
<nav class="tabbalk" aria-label="Klantkaart-tabs">
  <button class="tab tab--actief" aria-current="page">Tijdslijn <span class="tab-teller">5</span></button>
  <button class="tab">Inzichten <span class="tab-teller">1</span></button>
  <button class="tab">Notities</button>
</nav>
```

### Maten (gemeten op de klantkaart)

| Onderdeel | Waarde |
|---|---|
| Balk | wit, onderrand `--border`, plakt bovenaan (sticky, `--z-sticky`) |
| Tab | 47 px hoog, padding 12px 2px, 13 px gewicht 600, `--muted`, afstand 14 px |
| Hover | `--ink` |
| Actief | `--ink`, onderstreep 2 px `--yellow` |
| Teller | padding 1px 6px, 11 px gewicht 700, `--surface` met `--ink-soft`; alleen als het aantal groter is dan 0 |
| Overgang | kleur en rand 150 ms (`--duur-kort`) |

Te veel tabs voor de breedte lopen door naar een tweede regel; geen horizontale scroll ("Documenten stond afgekapt" volgens de code).

Uitzonderingen: accountplan gebruikt gewicht 700 en `--yellow-dark` voor de onderstreep; drie pagina's (bezoeken, playbooks, rechten) hebben tabs als blokknoppen in de stijl van een filterpil. Gebruik de onderstreepte tab.

Tabs in een flyout staan in deel C.

## Paginering: Toon meer

DealDrive bladert niet met paginanummers. Een lange lijst toont 25 rijen, daaronder het aantal en een knop.

```html
<div class="meer-rij">
  <span class="meer-tekst">25 van 96 getoond</span>
  <button class="meer-knop">Toon meer</button>
</div>
```

| Onderdeel | Waarde |
|---|---|
| Rij | gecentreerd, gap 16 px, 16 px onder de lijst |
| Tekst | 12 px `--muted`, tabulaire cijfers, "x van y getoond" |
| Knop | 44 px, padding 8px 20px, 13 px gewicht 700, wit, rand `--border-strong`; hover rand `--ink` |
| Stap | 25 (klanten, prospects); 50 in de auditlog ("Meer laden") |

Een andere filter, zoekterm, sortering of weergave zet de lijst terug op 25. Knop en tekst verdwijnen als alles getoond is.

Paginanummers ("← Vorige", "Pagina 2 / 5", "Volgende →") komen alleen voor in de klantomgeving Eyecatcher, met een eigen huisstijl. Niet overnemen.

## Contextmenu

### Wat het is

Het menu met snelle acties op een rij: rechtsklik op desktop, lang drukken op een telefoon. DealDrive heeft geen knop met drie puntjes; dit is het meer-menu. `ContextMenu.vue`, 7x gebruikt (taken, klanten, prospects).

### Opbouw

```html
<div class="ctx-overlay"></div>
<div class="ctx-menu" role="menu">
  <header class="ctx-head">
    <span class="ctx-head-kicker">Klant</span>
    <span class="ctx-head-title">Bakker Bouw B.V.</span>
  </header>
  <ul class="ctx-list" role="none">
    <li role="none"><button class="ctx-item" role="menuitem">
      <span class="ctx-item-icon"><svg class="ctx-item-svg"/></span>
      <span class="ctx-item-label">Open kaart</span>
    </button></li>
  </ul>
</div>
```

### Maten (gemeten)

| Onderdeel | Waarde |
|---|---|
| Menu | 240 px breed (maximaal 360), wit, rand 1 px `--ink`, geen hoek |
| Kop | `--ink`, padding 14px 18px 12px; kicker 11 px kapitalen `--yellow`; titel `--font-serif` 16 px `--wit` |
| Item | 48 px hoog (`--touch-target-comfortable`), padding 0 18px, raster 24 px icoon en label, gap 12 px |
| Label | 14 px gewicht 600 `--ink`; icoon 16 px `--ink-soft` |
| Meta rechts | 11 px kapitalen `--muted` |
| Hover | `--surface` |
| Gevaar | label en icoon `--red` |
| Overlay | `--overlay-zacht` (inkt op 32 procent), `--z-modal` |

### Gedrag

1. Desktop: het menu opent bij de muis en blijft 12 px binnen het scherm; past het niet onder de muis, dan opent het erboven.
2. Telefoon (onder 768 px): onderblad over de volle breedte, schuift van onder in; ruimte voor de veilige zone onderaan.
3. Een keuze voert de actie uit en sluit het menu.
4. Escape of een klik op de overlay sluit het.
5. Animatie: vervagen in `--transition-fast`; desktop schaalt van 0.96.

Teksten op klanten: "Open kaart", "Bel primaire contact", "Stuur e-mail", "Nieuwe taak", "Plan bezoek". Kicker is het soort ding ("Klant", "Taak"), titel de naam.

## Pillen, klasse, tags, statuslabels en tellers

### Pil

Een klein label in kapitalen voor een stand. 11 px, gewicht 800, letterafstand 0.06em, padding 2px 8px, gemeten 22 px hoog, hoek 2 px.

| Soort | Klasse | Kleuren | Wanneer |
|---|---|---|---|
| Neutraal | `.pil`, `.pil--grijs` | `--surface`, `--muted` | concept, onbekend |
| Accent | `.pil--geel`, `.pil--zwart` | geel met inkt, inkt met geel | nieuw, actief |
| Zacht | `.pil--rood`, `--oranje`, `--groen`, `--blauw`, `--paars` | `--red-pil`, `--orange-zacht`, `--green-zacht`, `--blue-zacht`, `--purple-zacht` (kleur op 12 procent, oranje op 10), tekst in de kleur | stand in een lijst |
| Gevuld | `.pil--rood-vol` en verder | kleur met witte tekst | status die opvalt |
| Leeg | `.pil--leeg` | gestippelde rand `--border-strong` | nog niet gezet ("Geen fase") |

Kleurbetekenis: rood urgent of risico, oranje let op, groen gewonnen of voor op schema, blauw klant of info, paars prospect of social, geel signaal.

### Accountklasse

Op elke lijst en kaart dezelfde kleur per klasse (AccountRow, kaarten, toplijsten). Tekst altijd "A · Corporate" via `labelFor`; zonder klasse "Geen klasse".

| Klasse | Vlak | Tekst |
|---|---|---|
| A | `--ink` | `--yellow` (5x; wit 1x) |
| B | `--blue` | wit |
| C | `--orange` | wit |
| D | `--muted` | wit |
| Overig | `--purple` | wit |
| Geen | transparant, gestippelde rand | `--muted` |

Uitzondering: AccountfasePicker en HistorieFlyout kleuren A rood en overig `--ink-soft` (3x), terwijl de code zegt "zelfde kleurcodering als de fase-pil". Volg de lijst (A zwart). De pil in de klantkaartkop is klikbaar en opent een keuzemenu (`.pil--knop`, helderder onder de muis).

### Signaaltag

Op een inzicht (SignalTag, 15x). Geen hoek, rand 1 px, padding 2px 7px, 11 px gewicht 800, kapitalen 0.06em. Bron: "Intern" zwart met geel, "Extern" geel met zwart, "Overig" grijs. Soort: vacature paars, nieuws zwart, social blauw, website groen, concurrent en directiewissel rood, KvK-mutatie en omzetdaling oranje, kans groen.

### Statuslabel

Status van een account (StatusTag): strategisch rood, klant blauw, at-risk oranje, hot prospect paars, warm prospect groen, prospect grijs met rand, watchlist grijs gestippeld. Geen hoek, padding 2px 8px, letterafstand 0.04em.

### Bandbadge

Drie standen van een dealband (BandBadge): `--red-pil` (rood op 12 procent), `--yellow-dark-zacht` (`--yellow-dark` op 24 procent) met inkt, `--green-zacht` (groen op 12 procent; BandBadge schrijft 14). Geen kapitalen, letterafstand 0.06em. Compact: padding 1px 5px.

### Tellers

| Teller | Waar | Uiterlijk |
|---|---|---|
| `.pil-teller` | in een filterpil, naast een groepskop | `--surface`, `--ink-soft`, 11 px 800 |
| `.pil-teller--zwart` | kolomkop, paneelkop | `--ink`, wit |
| `.pil-teller--geel` | iets dat aandacht vraagt | `--yellow`, `--ink` |
| `.vd-toggle-count` | op de knop Filters | `--yellow`, 18 px hoog |
| `.tab-teller` | achter een tab | `--surface`, 11 px 700 |

Cijfers in een teller zijn tabulair. Een teller met 0 laat je weg, behalve in een filterpil (daar zegt 0 dat de pil uit staat).

## Avatar en portret

### Avatar

Initialen in een vierkant van 32 x 32 met hoek 2 px; nooit rond (stylelint). 11 px, gewicht 800, wit op een vaste kleur per persoon: blauw, groen, paars, oranje of rood, gekozen uit de som van de tekencodes van het id, zodat iemand overal dezelfde kleur houdt. In een rij (AccountRow) maximaal drie, 8 px over elkaar, witte rand 2 px; de rest als "+2" op `--surface` in `--muted`. Zonder contact: "Geen contactpersoon" cursief 11 px `--muted-light`.

Gedrag: klik opent de contactkaart; onder de muis 2 px omhoog; title "Naam · Functie". Focus 2 px `--yellow`.

```html
<div class="initialen-stapel">
  <a class="initialen initialen--blauw" href="/contacten/c-12" title="Henk de Vries · Inkoper">HV</a>
  <span class="initialen initialen--rest" title="Nog 2 contactpersonen">+2</span>
</div>
```

### Portret

Een contactkaart met foto (Portrait.vue, 1x): foto 4:3 met rollabel linksboven (beslisser zwart met geel, beïnvloeder geel, champion groen, gebruiker grijs), zonder foto een donker verloop (`.portret-foto--zonder`, DealDrive kiest per naam een donkere tint) met de initialen in `--font-serif` 56 px `--yellow-op-donker`. Naam Source Serif 22 px, functie 13 px `--muted`. Onder de muis rand `--yellow` en 2 px omhoog in 200 ms.

## Scorecirkel

Een ring met een getal van 0 tot 100 voor de prioriteit van een account (AccountScoreCircle, 10x, meestal lg).

```html
<div class="scorecirkel scorecirkel--lg" title="Score 82 / 100 · Hoge prioriteit">
  <svg class="scorecirkel-svg" viewBox="0 0 100 100">
    <circle class="scorecirkel-baan" cx="50" cy="50" r="46.5" stroke-width="7"/>
    <circle class="scorecirkel-ring scorecirkel-ring--groen" cx="50" cy="50" r="46.5" stroke-width="7"
            stroke-dasharray="239.6 292.2" transform="rotate(-90 50 50)"/>
  </svg>
  <div class="scorecirkel-inhoud"><span class="scorecirkel-getal">82</span><span class="scorecirkel-label">Score</span></div>
</div>
```

| Maat | Doorsnede | Lijndikte (viewBox 100) | Getal |
|---|---|---|---|
| sm | 40 px | 12 | 14 px |
| md | 64 px | 9 | 20 px |
| lg | 96 px | 7 | 28 px |
| xl | 128 px | 6 | 38 px |

- Kleur van de ring: onder 40 `--red` ("Lage prioriteit"), 40 tot 69 `--orange` ("Aandacht waard"), vanaf 70 `--green` ("Hoge prioriteit"). Achterring `--border`.
- Straal = (100 min lijndikte) gedeeld door 2; lengte van de boog = score / 100 maal de omtrek.
- De ring begint bovenaan, recht afgesneden, en groeit in 600 ms (`--duur-lang`).
- Getal in `--font-serif` gewicht 700, tabulair; label "Score" 11 px kapitalen `--muted`, alleen bij lg en xl.

## Voortgangsbalk

Een dunne balk voor voortgang van een plan, campagne of playbook.

```html
<div class="voortgang" role="progressbar" aria-valuenow="62" aria-valuemin="0" aria-valuemax="100">
  <span class="voortgang-vul voortgang-vul--groen" style="width: 62%"></span>
</div>
```

| Onderdeel | Waarde |
|---|---|
| Baan | 6 px hoog (6x), `--surface` (13x), geen rand |
| Vulling | groen voor een plan of campagne, `--ink` voor een playbook, geel voor een meter, rood als je achterloopt |
| Tempostreep | 2 px `--yellow-dark` op de plek waar je volgens schema had moeten zijn (evaluaties) |
| Met rand | 8 px, rand `--border-strong` (meter op de generator) |
| Animatie | breedte in `--transition-base` |

De breedte is data en staat als `style="width: …"` op de vulling. Zet het getal ernaast in tekst ("3 van 8 stappen"); de balk alleen is niet genoeg.

## Telefoon en minder beweging

- Breekpunten van DealDrive: telefoon onder 768 px (`max-width: 767px`), smalle rasters onder 600 px. `var()` werkt niet in een media query; de getallen staan letterlijk in de CSS.
- Onder 768 px: de werkbalk loopt door naar meer regels, het zoekveld in de filterstrook krijgt de volle breedte, "Reset filters" schuift niet meer naar rechts, het contextmenu wordt een onderblad.
- Onder 600 px: het keuzeraster gaat naar drie kolommen, velden naast elkaar gaan onder elkaar.
- Knoppen blijven 44 px hoog; met de handschoenstand (`data-glove-mode`) wordt `--touch-target-min` 54 px en groeien ze mee.
- Op een aanraakscherm zijn potloden van inline bewerken altijd zichtbaar.
- `prefers-reduced-motion`: overgangen en de hover-verschuiving van avatar en portret vallen weg. `tokens.css` zet daarnaast alle animaties op 0.01 ms (deel A).
