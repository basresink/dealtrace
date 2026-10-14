# Deel C · Lagen en data

Dit deel beschrijft alles wat over de pagina heen komt (flyouts, vensters, toasts, banners, zoeken) en alles wat data toont (tabellen, rijen, kaarten, kanban, tijdlijn, grafieken, kaart), met de lege, laad- en foutstaten en de afdrukstijl. Alle klassen staan in `c-lagen-en-data.css`. Knoppen, pillen, velden en menu's komen uit deel B, tokens, lettertypen en de app-schil uit deel A.

Bronnen: de 41 `*Flyout.vue`-componenten in `C:\Projecten\dealdrive\app\components`, ConfirmDialog, ConflictResolveModal, IOSInstallModal, ToastContainer, OfflineBanner, NotificationBell, GlobaleZoek, AccountRow, LeadCard, BriefingCard, ResultaatTegel, LegeStaat, HydratieLijst, RapportageGrafieken, MiniMap, de composables `useFlyoutA11y`, `useBodyScrollLock`, `useConfirm` en `useToast`, en de pagina's pipeline, campagnes/[id], accounts/[id] en notificaties. Maten zijn gemeten met `getComputedStyle` in de mockapp op localhost:3088 (viewport 1440 bij 900 en 375 bij 812).

Overal geldt: kleuren alleen via tokens uit deel A, ook wit (`--wit`), wit op donker (`--wit-70` en verwant) en de overlays (`--overlay`, `--overlay-donker`); geen schaduw, hoeken hooguit `var(--radius)` (2px), focus is een omlijning van 2px `var(--ink)` met 2px afstand (17x in de app, 6x geel).

## Flyout

### Wat het is

Een paneel dat van rechts over de pagina schuift, over de volle hoogte, met daaronder een donkere laag. Het is in DealDrive het venster voor alles: een record bekijken (taak, afspraak, deal, inzicht), een record aanmaken (Nieuwe taak, Nieuwe afspraak, Nieuwe deal), een cijfer uitdiepen (rapportage) en AI-werk (Dex, transcriptanalyse). Er zijn 41 flyoutcomponenten en 8 pagina's die er zelf een bouwen. Er is geen gedeelde basiscomponent: elke flyout heeft een eigen prefix (`tk-`, `nt-`, `ap-`) met steeds dezelfde opbouw. Dealtrace gebruikt die opbouw één keer, als `.fo-*`.

### Wanneer wel en wanneer niet

- Wel: een record openen vanuit een lijst, kaart, kanban of tijdlijn, zonder de pagina te verlaten.
- Wel: een record aanmaken vanuit een paginakop (+ Taak, + Afspraak, + Deal).
- Wel: een cijfer uit een rapportage uitdiepen tot de lijst erachter.
- Niet voor een ja-of-neevraag: daarvoor is het bevestigingsvenster.
- Niet voor een melding achteraf: daarvoor is de toast.
- Niet voor navigatie naar een volledige pagina: de flyout heeft daarvoor een knop "Open klantkaart" (pijl naar rechts) in de voet.

![TaakFlyout open op /taken: grijze kop met kicker, serif titel en sluitkruis, gegevenslijst, blokken met linkerrand, voet met Afronden en vijf iconen](shots/c-1-taakflyout.png)

### Opbouw in HTML

```html
<div class="fo-overlay">
  <aside class="fo-panel" role="dialog" aria-modal="true" aria-labelledby="fo-titel" tabindex="-1">
    <header class="fo-head">
      <div class="fo-head-tekst">
        <span class="fo-kicker"><span class="fo-stip fo-stip--urgent"></span>Urgent · Open</span>
        <h2 class="fo-titel" id="fo-titel">Bel met Van Dijk over verlenging</h2>
        <p class="fo-meta">Van Dijk Installatietechniek · Installatie</p>
      </div>
      <button type="button" class="fo-sluit" aria-label="Sluiten">×</button>
    </header>
    <div class="fo-body">
      <dl class="defs">
        <div class="def-rij"><dt>Vervaldatum</dt><dd>wo 14 okt</dd></div>
      </dl>
      <article class="fo-blok">
        <header class="fo-blok-kop"><h3 class="fo-blok-titel">Klant in context</h3></header>
        <p class="fo-tekst">...</p>
      </article>
    </div>
    <footer class="fo-foot dd-acties">
      <button class="dd-act dd-act--primair">Afronden</button>
      <span class="dd-acties-vul"></span>
      <button class="dd-act dd-act--icoon" aria-label="Bewerken" title="Bewerken">...</button>
    </footer>
  </aside>
</div>
```

De volgorde is altijd: overlay, paneel, kop, inhoud, voet. Kop en voet staan vast; alleen `.fo-body` scrolt. Zonder record toont het paneel `.fo-leeg` met één zin ("Geen taak geselecteerd.").

### Gemeenschappelijke opbouw (gemeten op TaakFlyout, geteld over 41 componenten)

| Onderdeel | Standaard | Telling | Afwijking |
|---|---|---|---|
| Overlay | `--overlay` (inkt op 0.45), z-index `--z-modal` (40) | 27x | `--overlay-donker` (0.55) bij 11 analyseflyouts, 0.35 bij DealFlyout |
| Paneel | wit, border-left 1px `--ink`, 100% breed tot max-width | 37x wit, 36x rand | var(--bg) bij AI-flyouts en DealFlyout |
| Kop | padding 24px 28px 16px, `--surface`, onderrand 1px `--border` | 19x (plus 9x met 18px onder) | wit zonder vlak 8x, inkt 2x |
| Kicker | 11px (`--fs-label`), 700, 0.1em (1.1px), kapitalen, `--muted` | 26x | 800 en 0.12em in 5 compacte flyouts |
| Titel | `--font-serif`, 22px (`--fs-venstertitel`), 700, regelhoogte 1.25, marge 6px 0 4px | 32x | sans 18px 800 in 4 compacte flyouts |
| Metaregel | 12px, `--muted` | gemeten | |
| Sluitknop | teken × 28px, `--muted`, vlak 44 bij 44, hover `--ink` | 20x | Lucide X 20px in omlijst vlak 32 bij 32: 12x |
| Inhoud | padding 18px 28px 28px, overflow-y auto | 12x (plus 9x zonder onderruimte) | scroll met vaste balk in Taak en Inzicht |
| Voet | padding 16px 28px, `--surface`, bovenrand 1px `--border`, gap 8px | 14x | wit 10x, geen voet 6x |
| Knoppen in voet | `.dd-act` 37px hoog, primair inkt met geel; icoon 34 bij 34 | gemeten | zie deel B |

### Breedtes

| Breedte (token) | Klasse | Aantal | Voor |
|---|---|---|---|
| 520px (`--venster-w`) | `.fo-panel` | 15 | detail en aanmaken: taak, afspraak, deal, inzicht, briefing |
| 560px (`--venster-w-breed`) | `.fo-panel--breed` | 12 | analyse, accountplan, verslag, document, upload, dagstart |
| 480px (`--venster-w-smal`) | `.fo-panel--smal` | 6 | gegevens, contacten, historie, campagne |
| 640px (`--venster-w-ruim`) | `.fo-panel--analyse` | 2 | AI-analyse van transcript en gesprek |
| 900px (`--venster-w-vol`) | `.fo-panel--vol` | 2 | organisatiebeheer, meeting-achterstand |
| 460, 580, 620px | geen klasse | 4 | uitzonderingen: kies 480 of 560 |

Op een telefoon is elk paneel schermbreed (gemeten 375px bij een scherm van 375px). Er is geen apart volledig-scherm-ontwerp: kop, inhoud en voet blijven gelijk. Zes analyseflyouts verkleinen onder 560px de binnenmarge naar 18px; `.fo-panel` doet dat in Dealtrace altijd.

### Inventaris van alle flyouts

Kop **S** is de standaardkop (grijs vlak, kicker, serif 22px, ×). **A** is de analysekop (grijs vlak, 18px onderruimte, omlijste X van 32px, witte voet, overlay `--overlay-donker`). **C** is de compacte kop (geen vlak, padding 20px 24px, sans 18px 800). **D** is donker (inkt met gele kicker). **W** is wit zonder vlak met serif 22px. Iconen in de voet staan tussen haken; hun naam is het aria-label en de tooltip.

| Flyout | Breedte | Kop | Voetknoppen | Gebruikt op |
|---|---|---|---|---|
| AccountplanFlyout | 560 | A | Nieuw: Annuleren, Plan aanmaken. Bewerken: Annuleren, Opslaan. Bekijken: Verwijderen, Wijzigen, Open accountplan, Sluiten | accountplannen, klantkaart |
| ActiviteitFlyout | 560 | W | Sluiten, Vraag AI | app.vue |
| AfspraakAnalyseFlyout | 640 | D | Sluiten, Open AI-chat over dit transcript | MobileShell |
| AfspraakFlyout | 520 | S | Lezen: Open meeting of Volledige briefing, [Vraag AI] [Volledige briefing] [Bewerken] [Verwijderen] [Open klantkaart]. Bewerken: Annuleren, ✓ Opslaan | app.vue, taken, accountplannen |
| AiChatFlyout | 520 | D | invoerveld met [Verstuur] | app.vue |
| BriefingFlyout | 520 | S | Volledige briefing, Klaar met wijzigen, [Wijzigen] [Open contact] [Open klantkaart] | app.vue, Vandaag |
| BriefingOverviewFlyout | 520 | S | Alle briefings →, Volledige briefing | app.vue, klantkaart |
| CampagneAccountsFlyout | 460 | C | Annuleren, + Voeg toe aan Gespot (n) | campagnebord |
| CampagneFlyout | 480 | S | Lezen: Open campagnebord →, [Wijzigen]. Bewerken: Annuleren, ✓ Opslaan | campagnes, campagnebord |
| CampagneVoortgangFlyout | 460 | C | Sluiten | campagnebord |
| ContactenFlyout | 480 | S | Alle contacten → (tekstlink) | klantkaart |
| ContactInfoFlyout | 480 | S | geen voet; Verwijder contact onderaan de inhoud | contactkaart |
| DagstartFlyout | 560 | A | Bekijk je week, maand en kwartaal → (tekstlink) | Vandaag |
| DashboardKpiFlyout | 580 | A | lijstlink (bijvoorbeeld Open pipeline), Vraag Dex over deze KPI | verdieping, rapportages |
| DealFlyout | 520 | eigen | Markeer gewonnen of Heropen deal, Markeer verloren of Verliesreden, [Vraag AI] [Wijzigen] [Verwijderen] [Open klantkaart] | app.vue |
| DekkingFlyout | 560 | A | Open klantenlijst of Open prospects-lijst | rapportages |
| DocumentDetailFlyout | 560 | A | Verwijderen, Openen | kennisbank, klantkaart, contactkaart |
| DownloadFlyout | 520 | A | Download | 5 analysepagina's |
| FaseDealsFlyout | 560 | A | Open pipeline | rapportages |
| GespreksanalyseFlyout | 640 | W | geen voet | app.vue |
| GespreksverslagFlyout | 520 | S | Open in klantkaart, + Taak hieruit | niet in gebruik |
| HistorieFlyout | 480 | S (titel 28px) | + Taak, + Afspraak, Hele kaart in DealDrive → | dagstart, verdieping |
| InfoFlyout | 480 | S | geen voet; Verwijder account onderaan de inhoud | klantkaart |
| InzichtFlyout | 520 | S | Lezen: Maak taak, [Vraag AI] [Bewerken] [Markeer als gelezen] [Wijs af]. Bewerken: Annuleren, ✓ Opslaan | 8 plekken |
| KennisbankUploadFlyout | 560 | A, laag boven | Annuleren, ↑ Upload n | DealFlyout, klantkaart, contactkaart, kennisbank |
| MeetingAchterFlyout | 900 | A | geen voet | meetingritme |
| NieuwAccountFlyout | 520 | C | Annuleren, Klant aanmaken of Prospect aanmaken | klanten, prospects |
| NieuwContactFlyout | 480 | C | Annuleren, Contact aanmaken | contacten |
| NieuweActiviteitFlyout | 560 | S | Annuleren, + Regel toevoegen | instellingen |
| NieuweAfspraakFlyout | 520 | S | Annuleren, ✓ Plan afspraak | app.vue, accountplannen |
| NieuweCampagneFlyout | 560 | S (32px zijmarge, titel 24px) | Annuleren, Opslaan als concept | campagnes |
| NieuweDealFlyout | 520 | W | Annuleren, Deal toevoegen of Wijzigingen opslaan | app.vue |
| NieuweTaakFlyout | 520 | S | Annuleren, ✓ Maak taak | app.vue, accountplannen |
| NieuwVerslagFlyout | 560 | S | Annuleren, ✨ Analyseer; daarna ↺ Reset, ✓ Keur n goed | niet in gebruik |
| OfferteBriefingFlyout | 520 | S | Open klantkaart →, + Opvolg-taak | 5 plekken |
| OrganisatieFlyout | 900 | A (witte kop op grijs paneel) | geen voet; Opslaan en Annuleren per blok | admin (HQ) |
| RegelsImportFlyout | 560 | S | Samenvoegen, Alles vervangen, Annuleren | instellingen |
| ResultaatVerdiepFlyout | 560 | A | Sluiten | team |
| StartplanArchiefFlyout | 620 | A | Download als tekst, Afdrukken of opslaan als PDF | instellingen |
| TaakFlyout | 520 | S | Lezen: Afronden, [Vraag AI] [Snooze 1 dag] [Bewerken] [Verwijderen] [Open klantkaart]. Leesstand: Open op Taken, [Open klantkaart]. Bewerken: Afronden, Afronden en volgende taak, Annuleren, ✓ Opslaan | 12 plekken |
| VerslagFlyout | 520 | S, laag boven | Vraag AI, Open klantkaart → | app.vue |

### De voet: welke knoppen en in welke volgorde

- **Detailflyout, lezen.** Eén actie houdt het woord: de reden waarom je het venster opende (Afronden, Maak taak, Markeer gewonnen, Open meeting). Die staat links, primair (inkt met geel). Daarna een vuller en de rest als icoonknop van 34 bij 34 met tooltip, altijd in deze volgorde: helpen (Vraag AI), uitstellen (Snooze 1 dag), wijzigen (Bewerken), weggooien (Verwijderen, rood icoon), weggaan (Open klantkaart, pijl). Zo staat het in TaakFlyout, AfspraakFlyout, InzichtFlyout en DealFlyout.
- **Detailflyout, bewerken.** Dezelfde flyout schakelt naar een formulier; de voet wordt Annuleren (secundair) en "✓ Opslaan" (primair). Tijdens opslaan staat er "Opslaan…" en is de knop uitgeschakeld.
- **Aanmaakflyout.** Annuleren links, primaire knop rechts met het werkwoord: "✓ Maak taak", "✓ Plan afspraak", "Contact aanmaken", "Deal toevoegen". Tijdens opslaan "Opslaan…" of "Aanmaken…".
- **Analyseflyout.** Eén of twee knoppen die verder leiden: een lijst openen ("Open pipeline") en eventueel "Vraag Dex over deze KPI". Witte voet.
- **Geen voet** bij flyouts die alleen tonen of die per blok opslaan (ContactInfo, Info, Gespreksanalyse, MeetingAchter, Organisatie). Verwijderen staat daar als laatste blok in de inhoud.
- Uitzondering: RegelsImportFlyout gebruikt de kopknoppen `.dd-actie` in de voet en HistorieFlyout zet + Taak en + Afspraak als gekleurde actieknoppen in de voet. Dealtrace gebruikt in een voet alleen `.dd-act`.

### Blokken in de inhoud

| Klasse | Rand links | Achtergrond | Gebruik |
|---|---|---|---|
| `.fo-blok` | 3px `--border-strong` | wit | gewoon blok (Klant in context, Volgende stap) |
| `.fo-blok--accent` | 3px `--yellow` | `--yellow-zacht` (geel op 0.06) | aanbeveling, belangrijkste blok |
| `.fo-blok--agent` | 3px `--ink` | `--surface` | AI-voorzet, Pitstop |
| `.fo-blok--gevaar` | 3px `--red` | `--red-zacht` (rood op 0.08) | risico, verloren deal |
| `.defs` | geen | `--surface`, padding 14px 16px | gegevenslijst: label 110px breed, 11px kapitalen 0.06em |

Bloktitel: serif 14px 700. Bloktekst: 13px, regelhoogte 1.55. Blokkicker: 11px 800 0.15em. Een link in een flyout is inkt 600 met een gele onderstreep van 2px (`.fo-link`), hover `--yellow-dark`. Te laat is rood 600 (`.fo-over-tijd`). DealFlyout zet bovenaan drie cijfers op een rij (`.fo-cijfers`: Waarde, Kans, Gewogen).

### Gedrag

1. **Openen.** De pagina zet `open` op true. De overlay vervaagt in `var(--transition-base)` (200ms ease-out, gemeten). In de code schuift het paneel met `translateX(100%)` in, maar omdat de binnenste `<Transition>` geen `appear` heeft, verschijnt het paneel in de praktijk zonder schuiven. Geef in Dealtrace de binnenste Transition `appear` mee, dan schuift het paneel in 200ms in.
2. **Focus.** `useFlyoutA11y` (41 van 41) onthoudt welk element de flyout opende, zet `aria-modal="true"` en `tabindex="-1"` op het paneel en zet de focus op het paneel (gemeten: `aside.tk-panel`). Formulieren die zelf hun eerste veld focussen geven `initialFocus: false` mee (6x).
3. **Focusval.** Tab en Shift+Tab blijven binnen het paneel (gemeten: na 60 keer Tab staat de focus nog in het paneel). Alleen de bovenste open laag vangt Tab.
4. **Scrollen.** De pagina eronder scrolt niet mee: `useBodyScrollLock` zet `overflow: hidden` op body (40 van 41, gemeten). Alleen `.fo-body` scrolt; kop en voet staan vast. De voet krimpt nooit (`flex-shrink: 0`).
5. **Sluiten.** Drie wegen, alle drie gelijk: het kruis, een klik op de overlay (`@click.self`) en Escape. Bij sluiten gaat de focus terug naar het element dat de flyout opende.
6. **Escape.** Alleen de bovenste laag sluit. Met `onEscape` in `useFlyoutA11y` (14x) werkt dat via een gedeelde stapel; 25 flyouts luisteren zelf op `keydown`, 2 kennen geen Escape (ActiviteitFlyout, GespreksanalyseFlyout). Gemeten: Escape met een bevestigingsvenster open sluit alleen dat venster, de tweede Escape sluit de flyout. Een veld dat Escape zelf gebruikt (een zoeklijst) stopt het event en houdt de flyout open. Dealtrace gebruikt altijd de stapel.
7. **Geneste flyouts.** Een flyout uit een flyout (upload vanuit de deal, verslag vanuit de afspraak) ligt op `--z-modal-boven` (45) met een eigen overlay (`.fo-overlay--boven`). Dex (AiChatFlyout) en de globale zoek liggen op `--z-toast` (50), zodat ze over elke flyout openen. HistorieFlyout ligt één laag onder `--z-modal`.
8. **Na opslaan.** Een aanmaakflyout sluit en toont een toast: "Taak aangemaakt.", "Afspraak ingepland.", "Deal bijgewerkt.". Een detailflyout in bewerkstand gaat terug naar lezen, zonder toast: de nieuwe waarden staan meteen in beeld. Mislukt opslaan, dan blijft de flyout open en staat er boven de voet een `.fo-fout` ("Opslaan mislukt: taak niet gevonden.").
9. **Verwijderen.** Altijd eerst het bevestigingsvenster ("Taak verwijderen?" met "Verwijderen" in rood). Na ja sluit de flyout en volgt een toast in de infokleur: "Taak verwijderd.", "Deal verwijderd.", "Afspraak verwijderd.".
10. **Niet-opgeslagen wijzigingen.** De meeste flyouts sluiten zonder vraag en gooien een half ingevuld formulier weg. Alleen AccountplanFlyout vraagt het: bij Escape of een klik op de overlay met onbewaarde tekst verschijnt "Wijzigingen weggooien?" met de knop "Weggooien" (rood). De knop Annuleren vraagt niets, want die indrukken is een keuze. Neem dat gedrag in Dealtrace over voor elk formulier met vrije tekst.
11. **Bewegingsgevoeligheid.** Bij `prefers-reduced-motion: reduce` vallen alle overgangen weg (globaal in tokens.css en per groep in dit bestand).

### Varianten en toestanden

| Variant of toestand | Klasse | Maat en kleur |
|---|---|---|
| Standaard | `.fo-panel` | 520px, wit, rand links 1px inkt |
| Donkere AI-kop | `.fo-panel--ai` met `.fo-head--donker` | kop inkt, padding 20px 24px 16px, kicker geel 0.18em, paneel `--bg` |
| Analyse | `.fo-overlay--donker`, `.fo-sluit--kader`, `.fo-foot--wit` | overlay 0.55, X 32 bij 32 met rand `--border`, witte voet |
| Bovenop een flyout | `.fo-overlay--boven` | z-index `--z-modal-boven` (45) |
| Formulier | `.fo-body--formulier` | kolom met gap 14px |
| Lijst tot de rand | `.fo-body--vlak` | padding 0 |
| Geen record | `.fo-leeg` | padding 40px 28px, 14px, `--muted`, gecentreerd |
| Sluitknop hover en focus | `.fo-sluit:hover`, `:focus-visible` | kleur `--ink`; omlijning 2px inkt |
| Fout na opslaan | `.fo-fout` | rand links 3px rood, `--red-zacht`, 13px rood |
| Telefoon onder 560px | media query | kop 18px 18px 14px, inhoud 14px 18px 18px, voet 12px 18px plus veilige zone |

### Teksten

- Sluitknop: teken ×, aria-label "Sluiten".
- Kicker: soort en status met een middenpunt: "Urgent · Open", "Nieuwe taak · Middel", "Kennisbank · upload", "Verdieping · Team · Deze maand".
- Voet: "Annuleren", "✓ Opslaan", "Opslaan…", "Afronden", "Bewerken", "Wijzigen", "Verwijderen", "Vraag AI", "Open klantkaart", "Sluiten".
- Leeg: "Geen taak geselecteerd.", "Geen campagne geselecteerd.", "Dit account bestaat niet in jouw organisatie."

### Waar in DealDrive

`app/components/*Flyout.vue` (41), `app/composables/useFlyoutA11y.ts`, `useBodyScrollLock.ts`, `useScrollLock.ts`. Pagina-eigen flyouts met dezelfde opbouw: `pages/belblokken.vue` (440px), `pages/bezoek-analyse.vue` (900px), `pages/rapportage-activiteiten.vue` (560px), `pages/team.vue` (560px), `pages/team-weekrapport.vue` (560px), `pages/instellingen/pipelines.vue` (520px), `components/MatrixAnalyse.vue` (900px), `components/MailOpstellen.vue` (560px). Die gebruiken `--bg` als paneelkleur en een rand `--border-strong`; kies in Dealtrace de standaard van de componenten.

![DealFlyout op /pipeline: de uitzondering zonder grijs kopvlak, met fasepil, titel, drie cijfers en de actierij](shots/c-2-dealflyout.png)

DealFlyout wijkt af: geen kopvlak, het hele paneel scrolt (padding 24px 28px 28px op `--bg`, gap 14px) en de actierij staat in de inhoud in plaats van in een vaste voet. Gebruik dat niet als voorbeeld.

## Bevestigingsvenster

### Wat het is

Een klein venster in het midden van het scherm dat één vraag stelt met twee antwoorden. Het vervangt `window.confirm()`. Eén exemplaar staat in app.vue; elke vraag loopt via `useConfirm().ask(bericht, opties)` en geeft een belofte met ja of nee terug.

### Wanneer wel en wanneer niet

- Wel: vóór alles wat niet terug kan (verwijderen, overschrijven, een deal op gewonnen zetten, ingevulde tekst weggooien).
- Niet als bevestiging achteraf (dat is een toast) en niet voor keuzes met meer dan twee uitkomsten (dat is een flyout).

![Bevestigingsvenster "Taak verwijderen?" met waarschuwingsicoon, de zin en de knoppen Annuleren en Verwijderen](shots/c-3-bevestiging.png)

### Opbouw in HTML

```html
<div class="cd-overlay">
  <div class="cd-dialog" role="alertdialog" aria-modal="true" aria-labelledby="cd-titel" aria-describedby="cd-tekst">
    <header class="cd-head">
      <svg class="cd-icon cd-icon--gevaar" aria-hidden="true"><!-- AlertTriangle --></svg>
      <h3 class="cd-title" id="cd-titel">Taak verwijderen?</h3>
    </header>
    <p class="cd-message" id="cd-tekst">"Bel met Van Dijk over verlenging" wordt definitief verwijderd.</p>
    <footer class="cd-foot">
      <button class="cd-btn cd-btn--ghost">Annuleren</button>
      <button class="cd-btn cd-btn--danger">Verwijderen</button>
    </footer>
  </div>
</div>
```

### Maten en kleuren (gemeten)

| Onderdeel | Waarde |
|---|---|
| Overlay | `--overlay-donker` (inkt op 0.55), z-index `--z-toast` (50), padding 24px, inhoud gecentreerd |
| Venster | 460px breed, wit, padding 22px 24px 18px, gap 12px, hoek 2px |
| Icoon | 22px; vraag (HelpCircle) `--blue`, gevaar (AlertTriangle) `--red` |
| Titel | `--font-serif`, 18px (`--fs-kaarttitel`), 700, `--ink` |
| Tekst | 14px, regelhoogte 1.55, `--ink-soft` |
| Voet | rechts uitgelijnd, gap 8px, bovenrand 1px `--border`, padding-top 12px |
| Knoppen | 44px hoog, padding 10px 18px, 13px 700 |
| Annuleren | transparant, rand `--border-strong`, hover rand `--ink` |
| Bevestigen | geel met inkt, hover `--yellow-dark` |
| Gevaar | rood met wit, hover `--red-dark` |

### Gedrag

1. Openen: overlay vervaagt in 180ms (`--duur-uit`); het venster springt op van 92% naar 100% in 220ms (`--duur-in`) met een lichte overshoot (`--curve-opveer`, `cubic-bezier(0.18, 0.89, 0.32, 1.28)`). Sluiten 150ms (`--duur-kort`).
2. De focus start op **Annuleren** (gemeten), zodat Enter nooit per ongeluk iets verwijdert.
3. Escape, een klik naast het venster en Annuleren geven nee. Escape sluit alleen het venster, niet de flyout eronder (gemeten).
4. Dezelfde focusval als de flyouts.
5. Op een telefoon (onder 560px) staan de knoppen in Dealtrace onder elkaar, bevestigen bovenaan. DealDrive laat ze naast elkaar staan.

### Teksten

- Titel is een vraag met vraagteken: "Taak verwijderen?", "Deal verwijderen?", "Contact verwijderen?", "Account verwijderen?", "Gebruiker verwijderen?", "Deal gewonnen?", "Wijzigingen weggooien?".
- Tekst noemt het record tussen aanhalingstekens en zegt wat er blijft: "wordt definitief verwijderd. Offertes en documenten van het account blijven staan."
- Knoppen: "Annuleren" en het werkwoord: "Verwijderen", "Weggooien", "Markeer gewonnen". Zonder label wordt het "Verwijderen" als de vraag over verwijderen gaat, anders "Bevestigen".
- Standaardtitel zonder opgave: "Bevestigen".

### Waar in DealDrive

`app/components/ConfirmDialog.vue`, `app/composables/useConfirm.ts`. De knoppen houden de DealDrive-namen `cd-btn--ghost`, `cd-btn--primary` en `cd-btn--danger` en staan in deel B; dit deel regelt overlay, venster, kop, tekst en voet.

## Overige vensters

### Wat het is

Een venster in het midden (vanaf 768px) of van onderen (telefoon), voor een taak die geen record is: een synchronisatieconflict oplossen (ConflictResolveModal, 760px) of uitleggen hoe je de app installeert (IOSInstallModal, 420px).

### Wanneer wel en wanneer niet

- Wel: een korte, losse taak die de gebruiker moet afmaken of wegklikken, zonder relatie met een record.
- Niet voor recordwerk: dat is een flyout. Niet voor ja of nee: dat is het bevestigingsvenster.

### Opbouw in HTML

```html
<div class="venster-overlay">
  <aside class="venster" role="dialog" aria-modal="true" aria-labelledby="v-titel">
    <header class="venster-kop">
      <div><span class="venster-kicker">Conflict-resolutie</span>
        <h2 class="venster-titel" id="v-titel">Server heeft een nieuwere versie</h2></div>
      <button class="fo-sluit" aria-label="Sluiten">×</button>
    </header>
    <div class="venster-body">...</div>
    <footer class="venster-voet">knoppen uit deel B</footer>
  </aside>
</div>
```

### Varianten en toestanden

| Variant | Klasse | Maat |
|---|---|---|
| Breed venster | `.venster` | max 760px, max 92vh hoog, rand 1px inkt |
| Klein venster | `.venster--klein` | max 420px |
| Kop | `.venster-kop` | padding 18px 22px 14px, kicker 11px 0.08em, titel serif 20px |
| Voet | `.venster-voet` | `--surface`, padding 14px 22px, knoppen rechts, mag afbreken |
| Telefoon | onder 768px | van onderen, schuift met `translateY(100%)` in |
| Groot scherm | vanaf 768px | gecentreerd, padding 32px rondom, schaalt van 96% naar 100% |
| Notitie in venster | `.venster-noot` | `--surface`, rand links 3px `--border-strong` |

### Gedrag

Overlay `--overlay-donker` (0.55) op `--z-modal`. Sluiten via het kruis, de overlay of de knop Annuleren. IOSInstallModal heeft een vervaagde achtergrond (`backdrop-filter: blur(4px)`, 0.65) en één knop "Begrepen". ConflictResolveModal heeft knoppen in kapitalen (12px) van 48px hoog; Dealtrace gebruikt in vensters de gewone knoppen uit deel B.

### Waar in DealDrive

`app/components/ConflictResolveModal.vue` (op `pages/sync.vue`), `app/components/IOSInstallModal.vue` (in MobileShell).

## Toasts

### Wat het is

Een korte melding rechtsonder die na een actie bevestigt wat er gebeurde of wat misging. Zwart vlak, witte tekst, gekleurde rand links en een icoon in dezelfde kleur.

### Wanneer wel en wanneer niet

- Wel: na aanmaken ("Taak aangemaakt."), verwijderen ("Deal verwijderd."), een achtergrondactie ("Weekrapport als tekst gekopieerd.") of een fout zonder vaste plek ("Opslaan mislukt. Probeer het opnieuw.").
- Niet na opslaan in een open detailflyout: daar zie je het resultaat al.
- Niet voor een fout bij een veld of formulier dat open staat: die staat bij het veld of boven de voet.
- Niet om iets te vragen: een toast heeft geen knoppen. Er is geen "Ongedaan maken"; wat niet terug kan, krijgt vooraf een bevestiging.

![Vier toasts gestapeld: succes groen, info geel, let op oranje, fout rood](shots/c-5-toasts.png)

### Opbouw in HTML

```html
<div class="toast-stack" role="status" aria-live="polite">
  <div class="toast toast--succes">
    <svg class="toast-icoon" aria-hidden="true"><!-- CheckCircle2 --></svg>
    <span class="toast-tekst">Taak aangemaakt.</span>
    <button class="toast-sluit" aria-label="Sluiten">×</button>
  </div>
</div>
```

### Varianten en toestanden

| Soort | Klasse | Rand en icoon | Icoon (Lucide) | Duur |
|---|---|---|---|---|
| Succes | `.toast--succes` | `--green` | CheckCircle2 | 4 s |
| Info | `.toast` | `--yellow` | Info | 4 s |
| Let op | `.toast--let-op` | `--orange` | AlertTriangle | 4 s |
| Fout | `.toast--fout` | `--red` (icoon in Dealtrace `--red-light` voor contrast op inkt) | XCircle | 6 s |

Gemeten: 280 tot 420px breed, 48px hoog, padding 12px 14px, 13px 500, rand links 3px, sluitknop 24 bij 24 in `--wit-55` (DealDrive: wit op 50%). Stapel rechtsonder op 16px van de rand, gap 8px, z-index `--z-melding` (100, boven `--z-toast`). In de app: 57x succes, 31x info, 38x fout, 3x let op.

### Gedrag

1. Nieuwe toasts komen onderaan de stapel; maximaal 5, de oudste valt weg.
2. Verschijnen en verdwijnen in 220ms (`--duur-in`): vervagen en 12px omhoog of omlaag. De rest schuift mee (`.toast-move`).
3. Een klik op de toast of op × sluit hem. Na 4 seconden (fout 6) gaat hij vanzelf.
4. Staat er een install- of pushprompt rechtsonder, dan begint de stapel erboven.
5. Op een telefoon (Dealtrace) loopt de stapel van rand tot rand.

### Teksten

Korte zin met punt, in de verleden tijd of als feit: "Taak aangemaakt.", "Afspraak ingepland.", "Deal bijgewerkt.", "Verliesreden vastgelegd.", "Accountplan opgeslagen.", "Taak verwijderd.". Fout: wat er misging en wat je kunt doen: "Vastleggen mislukt. Probeer het opnieuw.".

### Waar in DealDrive

`app/components/ToastContainer.vue`, `app/composables/useToast.ts` (API: `toast.success`, `info`, `warn`, `error`). DealDrive heet de soorten `success`, `info`, `warn`, `error`; Dealtrace houdt `--succes`, `--let-op`, `--fout`.

## Banner

### Wat het is

Een balk over de volle breedte bovenaan de pagina die een toestand van de hele app meldt. In DealDrive is dat alleen de OfflineBanner: offline (rood) of wijzigingen die niet konden worden opgeslagen (inkt, met een knop).

### Wanneer wel en wanneer niet

- Wel: een toestand die blijft tot hij voorbij is en die alles op de pagina raakt.
- Niet voor een melding over één actie (toast) of één blok (`.fout-blok`).
- Geen sluitknop: de banner verdwijnt zodra de toestand voorbij is.

### Opbouw in HTML

```html
<div class="banner banner--offline" role="status" aria-live="polite">
  <div class="banner-inner">
    <span class="banner-icoon"><svg>...</svg></span>
    <span class="banner-tekst"><strong>Offline.</strong> Je werk wordt lokaal opgeslagen.</span>
  </div>
</div>
```

### Varianten en toestanden

| Variant | Klasse | Kleur | Knop |
|---|---|---|---|
| Offline | `.banner--offline` | `--red`, witte tekst | geen |
| Vastgelopen | `.banner--sync` | `--ink`, witte tekst | "Opnieuw proberen" |
| Bezig | `.banner-icoon--draait` | icoon draait in 1.2s | knop "Bezig…", uitgeschakeld, cursor wachten |

Maten: binnenkant max `--container-w`, padding 10px 16px, 13px, icoon 20px, gap 12px. Knop geel, 44px hoog, 12px 700 in kapitalen 0.02em, hover `--yellow-dark`. Plakt bovenaan (`position: sticky`) op `--z-fixed`, met de veilige zone van een telefoon erboven. Komt binnen door 100% omhoog te schuiven en te vervagen in 200ms.

### Teksten

"**Offline.** Je werk wordt lokaal opgeslagen en gesynchroniseerd zodra je weer verbinding hebt.", "**Offline.** 3 wijzigingen wachten op sync.", "**2 wijzigingen** konden niet worden opgeslagen · sinds 10 minuten." met de knop "Opnieuw proberen".

### Waar in DealDrive

`app/components/OfflineBanner.vue`, ingezet in `MobileShell.vue`.

## Meldingen: notificatielijst en belpaneel

### Wat het is

Notificaties (dealrisico, hot prospect, dagstart, herinnering, inzicht) staan op een eigen pagina als rijen met een kleurbalk links. De bel zelf is een regel onderin de zijbalk met een rode teller (deel A) die naar `/notificaties` leidt. Het uitklappaneel van NotificationBell bestaat in de code maar wordt nergens gebruikt; het staat hier voor het geval Dealtrace een bel in een bovenbalk krijgt.

### Opbouw in HTML

```html
<ul class="melding-lijst" role="list">
  <li class="melding melding--ongelezen">
    <span class="melding-balk melding-balk--kritiek"></span>
    <div class="melding-body">
      <div class="melding-meta">
        <span class="pil pil--rood-vol">Kritiek</span>
        <span class="melding-tijd">2 uur geleden</span>
        <span class="melding-stip" aria-label="Ongelezen"></span>
      </div>
      <h3 class="melding-titel">Deal Van Dijk staat 21 dagen stil</h3>
      <p class="melding-tekst">Geen contact sinds de offerte.</p>
    </div>
    <div class="melding-acties">Openen · Markeer gelezen · Verberg</div>
  </li>
</ul>
```

### Varianten en toestanden

| Onderdeel | Klasse | Waarde |
|---|---|---|
| Rij | `.melding` | wit, rand `--border`, hover rand `--ink` |
| Ongelezen | `.melding--ongelezen` | achtergrond `--surface`, gele stip 8px met inktrand |
| Kleurbalk | `.melding-balk--kritiek`, `--hot`, `--dagstart`, `--herinnering`, `--inzicht` | rood, paars, blauw, geel, groen |
| Titel | `.melding-titel` | serif 17px 700 |
| Acties | `.melding-acties` | op telefoon onder de tekst, vanaf 768px rechts in een kolom |
| Belpaneel | `.bel-paneel` | 360px, rand 1px inkt, kop serif 18px, lijst max 360px hoog |
| Belitem ongelezen | `.bel-item--ongelezen` | titel 700, categorie in inkt |

### Gedrag en teksten

Knoppen per rij: "Openen" (primair, markeert ook gelezen), "Markeer gelezen", "Verberg". Kop van de pagina: "Alles gelezen". Lege lijst: "Geen notificaties". Het belpaneel opent met een schaal van 96% naar 100% in 120ms vanaf rechtsboven en sluit bij een klik erbuiten; kop "Notificaties" met "Alles bijgewerkt" of "3 ongelezen", knop "Alle gelezen", voet "Alle notificaties →" en "Voorkeuren".

### Waar in DealDrive

`app/pages/notificaties.vue`, de belregel in `app/components/AppSidebar.vue`, `app/components/NotificationBell.vue` (niet in gebruik).

## Globale zoek

### Wat het is

Een zoekvenster (command palette) dat overal opent met Ctrl+K of Cmd+K, of via de zoekregel in de zijbalk. Eén invoer zoekt tegelijk in klanten, contacten, taken, agenda, deals, offertes, inzichten, mail en documenten; resultaten staan per soort gegroepeerd.

### Wanneer wel en wanneer niet

- Wel: snel naar een record springen zonder te weten in welke lijst het staat.
- Niet als filter op een lijstpagina: dat is het zoekveld in de filterbalk (deel B).

![Globale zoek met de term "ver": invoerregel, groepen met teller, actieve rij in inkt met gele titel](shots/c-4-globale-zoek.png)

### Opbouw in HTML

```html
<div class="zoek-overlay">
  <div class="zoek-paneel" role="dialog" aria-modal="true" aria-label="Zoeken in Dealtrace">
    <div class="zoek-veld">
      <svg class="zoek-veld-icoon">...</svg>
      <input class="zoek-invoer" type="text" enterkeyhint="search" aria-label="Zoekterm">
      <button class="zoek-filterknop" aria-label="Kies waarin gezocht wordt">...</button>
      <button class="zoek-sluit" aria-label="Sluiten">...</button>
    </div>
    <div class="zoek-lijst" role="listbox" aria-label="Zoekresultaten">
      <section class="zoek-groep">
        <header class="zoek-groep-kop"><span class="zoek-groep-label">Klanten</span><span class="zoek-groep-telling">3</span></header>
        <button class="zoek-rij zoek-rij--actief" role="option" aria-selected="true">
          <span class="zoek-rij-titel">Van Dijk Installatietechniek</span>
          <span class="zoek-rij-detail">Zwolle · Installatie</span>
        </button>
      </section>
    </div>
  </div>
</div>
```

### Maten en kleuren (gemeten)

| Onderdeel | Waarde |
|---|---|
| Overlay | `--overlay` (inkt op 0.45), z-index `--z-toast` (50), padding 12vh 16px 24px (108px boven bij 900px) |
| Paneel | 640px breed (`--venster-w-ruim`), max 560px hoog, `--bg`, rand 1px `--border-strong` |
| Invoer | 16px, 44px hoog, zonder rand, placeholder `--muted-light` |
| Groepslabel | 11px 800, 0.14em, kapitalen, `--muted` |
| Rij | min 44px, padding 8px 10px, titel 14px 600, detail 12px `--muted` |
| Rij hover | `--surface` |
| Actieve rij | `--ink`, titel `--yellow`, detail `--wit-70` (DealDrive: wit op 68%) |
| Sluitknop | 32 bij 32, rand `--border`, hover rand en icoon `--ink` |
| Filter | balk op `--surface` met een checkbox per soort |

### Gedrag

1. Ctrl+K of Cmd+K opent en sluit. Escape sluit. Een klik op de overlay sluit.
2. Pijl omhoog en omlaag kiezen een rij, Enter opent hem. Hover licht een rij alleen op en verandert de keuze niet.
3. De filterknop opent de balk met soorten; een teller op geel toont hoeveel soorten aan staan zolang niet alles aan staat. Knop "Alles weer aan".
4. Overlay vervaagt in 120ms.
5. Telefoon: paneel van boven tot onder (padding 12px 10px), de toetsenhint verdwijnt.

### Teksten

Placeholder: "Zoek in klanten, contacten, taken, agenda, deals, offertes, inzichten, mail en documenten…". Hint: "↑ ↓ kiezen · Enter openen · Esc sluiten". Niets gevonden: "Niets gevonden voor **term**.". Meer: "nog 4, verfijn de zoekterm".

### Waar in DealDrive

`app/components/GlobaleZoek.vue`, `app/composables/useGlobaleZoek.ts`.

## Tabellen

### Wat het is

Een tabel voor cijfers en vergelijkingen: rapportages, analyses, instellingen. Kopcellen klein in kapitalen, rijen gescheiden door een lijn, getallen rechts met tabelcijfers.

### Wanneer wel en wanneer niet

- Wel: meer dan drie kolommen die je naast elkaar wilt vergelijken, of getallen die je optelt.
- Niet voor een lijst van accounts of contacten die je opent: dat is een lijstrij.

### Opbouw in HTML

```html
<div class="tabel-wrap">
  <table class="tabel">
    <thead><tr><th>Account</th><th class="cel-r">Waarde</th><th class="cel-r">Kans</th></tr></thead>
    <tbody>
      <tr><td class="cel-naam"><a class="tabel-link" href="#">Van Dijk Installatietechniek</a></td>
          <td class="cel-r">€ 48.000</td><td class="cel-r">60%</td></tr>
      <tr class="somrij"><td>Totaal</td><td class="cel-r">€ 48.000</td><td></td></tr>
    </tbody>
  </table>
</div>
```

### Varianten en toestanden

| Variant | Klasse | Kop | Cel |
|---|---|---|---|
| Standaard | `.tabel` | 11px 800 0.08em kapitalen `--muted` op `--surface` | 12px, padding 9px 11px, lijn `--border` |
| Rapport | `.tabel--rapport` | geen vlak, onderlijn 2px `--ink` | 14px, padding 10px 12px |
| Plakkende laatste kolom | `.tabel--plak` | idem | laatste kolom plakt rechts met lijn links |
| Rij hover | `tr:hover` | | `--bg` |
| Open rij | `tr.is-open` | | `--yellow-licht` (geel op 10%) |
| Somrij | `tr.somrij` | | `--bg`, bovenlijn `--border-strong`, 700 |
| Telefoon | onder 768px | padding 8px | naamcel breekt af |

Telling over 73 kopcelregels in 26 bestanden: 11px 27x, kapitalen 27x, `--muted` 28x, gewicht 800 17x tegen 700 11x, onderrand 1px `--border` 22x, 2px `--ink` 7x. De letterafstand varieert (0.06em tot 0.12em); 0.08em komt het vaakst voor. De klasse `.tabel` staat in 11 bestanden; 21 andere tabellen hebben een eigen naam met dezelfde opbouw.

### Gedrag

Een tabel scrolt horizontaal binnen `.tabel-wrap`. Een link in een tabel is `.tabel-link` uit deel A: inkt 600 zonder onderstreep, met een gele onderlijn bij hover. Sorteren staat in deel B.

### Waar in DealDrive

`pages/bezoek-analyse.vue`, `evaluaties.vue`, `rapportage-activiteiten.vue`, `startplannen.vue`, `instellingen/gebieden.vue`, `instellingen/verbruik.vue`, `components/MatrixAnalyse.vue`, `MeetingRitmeAnalyse.vue`, `AccountplanRitme.vue`, `EvaluatieBlokken.vue`, `WeekrapportFunnel.vue`.

## Lijstrijen

### Wat het is

Een rij in een lijst van accounts (of contacten) die als geheel klikbaar is: logo of initialen links, naam met fasepil, een regel met kanalen en feiten, de aanleiding met een gekleurde rand, en rechts de contactpersonen.

### Wanneer wel en wanneer niet

- Wel: lijsten van records die je opent (klanten, prospects, contacten).
- Niet voor cijfers die je vergelijkt (tabel) en niet in een kanban (kanbankaart).

![Drie accountrijen op /klanten/alle: logo, serif naam met fasepil, kanaaliconen en feiten, contactvakjes rechts](shots/c-6-accountrijen.png)

### Opbouw in HTML

```html
<div class="lijst">
  <article class="rij" role="button" tabindex="0">
    <span class="initialen">VD</span>
    <div class="rij-info">
      <h3 class="rij-titel">Van Dijk Installatietechniek <span class="pil pil--zwart">A</span></h3>
      <div class="rij-sub"><a class="kanaal" href="#" aria-label="Website">...</a> Zwolle · Installatie · 48 fte</div>
      <p class="rij-aanleiding">Nieuwe vestiging in Deventer geopend.</p>
    </div>
    <div class="rij-rechts">...</div>
  </article>
</div>
```

### Varianten en toestanden (gemeten op /klanten/alle)

| Onderdeel | Klasse | Waarde |
|---|---|---|
| Rij | `.rij` | padding 20px 24px, raster 56px 1fr auto, gap 14px, min 48px, wit, lijn onder `--border` |
| Hover | `.rij:hover` | `--surface`, overgang 150ms (`--duur-kort`) |
| Focus | `.rij:focus-visible` | omlijning 2px inkt binnen de rij |
| Compact | `.rij--compact` | padding 12px 16px |
| Ongelezen of nieuw | `.rij--ongelezen` | `--surface` |
| Titel | `.rij-titel` | serif 18px 700, -0.005em |
| Subregel | `.rij-sub` | 12px `--muted`, gap 12px |
| Aanleiding | `.rij-aanleiding`, `--heet`, `--let-op` | rand links 3px geel, rood of oranje, 13px `--ink-soft` |
| Kanaal | `.kanaal`, `.kanaal--leeg` | 26 bij 26, rand `--border`; zonder adres 35% en niet klikbaar |
| Telefoon | onder 800px | twee kolommen, rechterdeel onder de tekst |

### Gedrag

Klik, Enter of spatie opent het record (flyout of pagina). Rechtsklik opent het contextmenu (deel B). Een klik op een kanaal of contact opent alleen dat en niet de rij. Ontbrekende gegevens laten hun plek leeg in plaats van een streepje te tonen.

### Waar in DealDrive

`app/components/AccountRow.vue` op `pages/klanten/alle.vue` en `pages/prospects/alle.vue`; logo uit `AccountLogo.vue`, fasepil `acct-fase` (in Dealtrace een pil uit deel B).

## Kaarten

### Wat het is

Een afgebakend blok inhoud. DealDrive kent vier soorten: de basiskaart (wit met rand, op elke pagina eigen geschreven), de LeadCard (krantenopening met beeld en grote kop), de BriefingCard (vlak in donker, geel of licht) en de ResultaatTegel (klikbare cijfertegel). Statkaarten staan in deel A.

### Wanneer wel en wanneer niet

- Basiskaart: losse blokken naast elkaar in een raster, met `--kaart-gap` (16px) ertussen.
- LeadCard: de opening van een pagina (Vandaag, klantkaart, inzichten) met het belangrijkste inzicht. Eén per pagina.
- BriefingCard: een uitgelicht advies. Staat in de code maar wordt niet gebruikt.
- ResultaatTegel: een rij cijfers waarvan elke tegel een paneel eronder opent (team).

### Opbouw in HTML

```html
<article class="kaart kaart--klik">
  <header class="kaart-kop"><h3 class="kaart-titel">Kwartaalbezoek De Vries</h3><span class="pil">Bezoek</span></header>
  <div class="kaart-meta"><span>do 15 okt</span><span>Zwolle</span></div>
  <footer class="kaart-voet">...</footer>
</article>

<button class="tegel tegel--actief" aria-pressed="true">
  <span class="tegel-label">Afspraken</span>
  <span class="tegel-getal">23</span>
  <span class="tegel-onder tegel-onder--op">+4 op vorige week</span>
</button>
```

### Varianten en toestanden

| Kaart | Klasse | Maten en kleuren |
|---|---|---|
| Basis | `.kaart` | wit, rand `--border`, padding 16px; titel serif 18px |
| Vlak | `.kaart--vlak` | `--surface` |
| Accent | `.kaart--accent` | rand links 3px geel |
| Klikbaar | `.kaart--klik` | hover rand `--ink`, focus omlijning |
| LeadCard | `.lead-kaart` | padding 56px 0 40px; titel serif clamp(28px, 4vw, 48px); intro 18px; beeld 4:3 |
| LeadCard compact | `.lead-kaart--compact` | padding 20px 0 16px, geen beeld, titel clamp(20px, 2.4vw, 26px) |
| Kicker LeadCard | `.lead-kicker`, `--standaard`, `--opinie` | 11px 0.18em met streep van 24 bij 2; rood, inkt met geel, blauw |
| BriefingCard | `.briefing-kaart--donker`, `--geel`, `--licht` | padding 36px 40px, streep 60 bij 4, titel serif clamp(24px, 3vw, 34px) |
| Tegel | `.tegel` | `--surface`, rand `--border-strong`, label 11px 800, getal serif 21px |
| Tegel actief | `.tegel--actief` | rand 2px `--ink`, padding 1px kleiner zodat de tekst niet verspringt |
| Tegel alert | `.tegel--alert` | rand links 3px rood, getal rood |

### Waar in DealDrive

`app/components/LeadCard.vue`, `BriefingCard.vue` (niet in gebruik), `ResultaatTegel.vue` (`pages/team.vue`).

## Kanban

### Wat het is

Een bord met kolommen waarin kaarten door slepen van stap naar stap gaan. DealDrive heeft er twee: het campagnebord (Gespot, Open, Bezig, Klaar) en het pipelinebord (een kolom per fase).

### Wanneer wel en wanneer niet

- Wel: werk dat door vaste stappen gaat en waarbij je de verdeling over de stappen wilt zien.
- Niet als enige weergave: een kanban is een keuze in de weergaveschakelaar (deel B) naast een lijst.

### Opbouw in HTML

```html
<div class="kanban">
  <div class="kanban-col kanban-col--bezig">
    <header class="col-head"><h3 class="col-title">Bezig</h3><span class="col-count">4</span></header>
    <div class="col-items">
      <article class="kanban-kaart" draggable="true" role="button" tabindex="0">
        <h5 class="kanban-kaart-titel">Uitbreiding service-contract</h5>
        <div class="kanban-kaart-noot">Van Dijk Installatietechniek</div>
        <div class="kanban-kaart-voet"><span>€ 48.000</span><span>60%</span></div>
      </article>
    </div>
  </div>
</div>
```

### Varianten en toestanden

| Onderdeel | Campagnebord `.kanban` | Pipelinebord `.kanban--fase` (gemeten) |
|---|---|---|
| Kolommen | 4 gelijk, onder 960px één | 2, vanaf 700px 3, vanaf 1024px één per fase van minimaal 200px, bord scrolt opzij |
| Kolom | `--surface`, rand `--border`, bovenrand 4px in de stapkleur | wit, rand `--border` |
| Kop | padding 12px 14px, titel serif 14px, teller inkt met geel | padding 10px 12px op `--bg`, bovenrand 3px fasekleur, titel 11px 800 kapitalen, teller 12px `--muted` |
| Som | geen | `.col-som`: 12px 700 op `--surface` |
| Kaart | wit, padding 10px 12px, rand `--border` | `--bg`, padding 12px 14px, titel serif 14px 700 |
| Kaart hover | rand `--ink` | rand `--ink` |
| Slepen | kaart 40% doorzichtig, cursor grijpen | idem |
| Doelkolom | gestippelde omlijning 2px `--yellow-dark`, `--yellow-licht` (geel op 10%; DealDrive 8%) | idem |
| Lege kolom | "Sleep hier een kaart naartoe." 12px cursief | idem |

Stapkleuren campagne: Gespot rood, Open `--muted`, Bezig geel, Klaar groen. Fasekleuren pipeline: identificatie `--border-strong`, kwalificatie `--ink-soft`, behoefte blauw, voorstel geel, onderhandeling oranje, gewonnen groen.

### Gedrag

Slepen met HTML5 drag and drop; loslaten in een kolom verplaatst de kaart en schrijft de nieuwe stap weg. Klik, Enter of spatie op een kaart opent de flyout van het record. Een kolom in het campagnebord scrolt zelf (max 70vh). De kolom Gespot heeft bovenaan een filter en "Alles selecteren" met een knop "→ Open + taak (n)".

### Waar in DealDrive

`app/pages/campagnes/[id].vue` (campagnebord), `app/pages/pipeline.vue` (pipelinebord).

## Tijdlijn en activiteitenfeed

### Wat het is

Een verticale lijst van wat er met een account gebeurde: taken, afspraken, inzichten, deals, contactmomenten en notities, nieuwste boven. Elk item heeft links een spoor van 4px in de kleur van de soort en rechts een kaart.

### Wanneer wel en wanneer niet

- Wel: de geschiedenis van één account of contact (tabblad Tijdlijn, HistorieFlyout).
- Niet voor taken die nog moeten gebeuren: dat is de takenlijst.

### Opbouw in HTML

```html
<ol class="tijdlijn" role="list">
  <li class="tijdlijn-item">
    <span class="tijdlijn-spoor tijdlijn-spoor--afspraak" aria-hidden="true"></span>
    <button class="tijdlijn-kaart">
      <div class="tijdlijn-kop">
        <span class="tijdlijn-soort tijdlijn-soort--afspraak">Afspraak</span>
        <span class="tijdlijn-type">Bezoek</span>
        <span class="tijdlijn-datum">12 okt</span>
      </div>
      <h4 class="tijdlijn-titel">Kwartaalbezoek met Sanne Mulder</h4>
      <p class="tijdlijn-tekst">Uitbreiding besproken.</p>
      <span class="tijdlijn-status tijdlijn-status--klaar">Afgerond</span>
    </button>
  </li>
</ol>
```

### Varianten en toestanden

| Soort | Spoor en pil | Pil tekst |
|---|---|---|
| Inzicht | `--yellow` | inkt |
| Taak | `--blue` | wit |
| Afspraak | `--green` | wit |
| Deal | `--purple` (in DealDrive alleen de pil; het spoor valt terug op `--border-strong`) | wit |
| Contact | `--muted`, pil grijs met rand | `--muted` |
| Notitie | `--ink`, kaart zonder klik (`.tijdlijn-kaart--stil`) | geen pil |

Kaart: wit, rand `--border`, padding 12px 16px, hover `--surface` met rand `--ink`. Titel serif 15px 700, tekst 13px `--ink-soft`, datum 11px rechts. Status: `--klaar` groen op `--green-zacht` (12%), `--laat` rood op `--red-pil` (12%; DealDrive 10%). Items staan 8px uit elkaar.

### Waar in DealDrive

`app/pages/accounts/[id]/index.vue` (klassen `tl-*`), `app/components/HistorieFlyout.vue`, `app/composables/useTijdslijn.ts`. `ActivityFeed.vue` bestaat maar wordt niet gebruikt.

## Lege staten

### Wat het is

Wat je ziet als een lijst, kolom of blok niets bevat. Twee vormen: de LegeStaat (blok met kicker, kop en zin, voor een hele lijst) en de lege regel (één zin in een blok of kolom).

### Wanneer wel en wanneer niet

- LegeStaat: een lijstpagina zonder resultaat (pipeline, campagnes, kennisbank, offertes).
- Lege regel: een blok, kolom of flyoutsectie zonder inhoud.
- LegeStaat heeft in DealDrive geen knop. De actie staat al in de paginakop; herhaal hem niet. (Het vorige stijlbestand had `.lege-staat-actie`; die is vervallen.)

### Opbouw in HTML

```html
<div class="lege-staat">
  <span class="lege-staat-kicker">Niets hier</span>
  <h3 class="lege-staat-titel">Geen fases geselecteerd in het filter.</h3>
  <p class="lege-staat-tekst">Zet een fase aan of reset het filter.</p>
</div>
<p class="lege-regel">Nog niets vastgelegd voor dit account.</p>
```

### Varianten

| Variant | Klasse | Maten |
|---|---|---|
| Blok | `.lege-staat` | wit, rand `--border`, padding 48px 24px, gecentreerd; kicker 11px 0.2em; titel serif 22px; tekst 14px `--muted` |
| Regel | `.lege-regel` | 13px cursief `--muted`, padding 12px 0 |
| Regel midden | `.lege-regel--midden` | idem, gecentreerd |
| In een flyout | `.fo-leeg` | padding 40px 28px, 14px `--muted`, gecentreerd |
| In een kanbankolom | `.col-empty` | 12px cursief, gecentreerd |

Telling van de eigen leeg-regels (91 in 80 bestanden): `--muted` 82x, gecentreerd 37x, 13px 27x, 14px 21x, cursief 15x.

### Teksten

Kicker standaard "Niets hier". Zin zegt wat er niet is en, als het kan, waarom: "Nog niets vastgelegd voor dit account.", "Niets van deze soort vastgelegd voor dit account. Kies een andere soort of reset het filter.", "Geen notificaties.", "Alle accounts zitten al in deze campagne.".

### Waar in DealDrive

`app/components/LegeStaat.vue`; regels met klassen die eindigen op `-leeg` of `-empty`.

## Laden en skeletten

### Wat het is

Wat je ziet terwijl data nog komt. Een lijst die pas in de browser compleet is, toont een skelet met dezelfde vorm en hoogte als de lijst, zodat de pagina niet verspringt. Een blok dat laadt, toont een regel tekst.

### Wanneer wel en wanneer niet

- Skelet: een lijst waarvan de rijen pas na het laden bekend zijn (contacten). Geef het echte aantal rijen mee; bij nul geen skelet.
- Laadregel: een blok of venster dat iets ophaalt ("Server-versie ophalen…").
- Een knop die bezig is toont zelf "Opslaan…" (deel B); geen apart laadteken.
- Geen draaiende cirkel; het enige draaiende teken is het synchronisatie-icoon in de banner.

### Opbouw in HTML

```html
<div class="skelet" role="status" aria-busy="true" aria-label="Contacten laden">
  <div class="skelet-rij">
    <span class="skelet-avatar"></span>
    <span class="skelet-tekst"><span class="skelet-balk"></span><span class="skelet-balk"></span><span class="skelet-balk"></span></span>
  </div>
</div>
```

### Maten

| Onderdeel | Waarde |
|---|---|
| Rij | min 90px, padding 14px 18px, gap 16px, lijn onder `--border` |
| Avatar | 56 bij 56 |
| Balken | 12px hoog; eerste 15px hoog en 42% breed, dan 66%, 54%, verder 48% |
| Glans | verloop `--surface` naar `--border` naar `--surface`, 1400ms ease-in-out, oneindig |
| Bewegingsgevoelig | geen glans, effen `--surface` |
| Laadregel | 12px cursief `--muted` |

### Waar in DealDrive

`app/components/HydratieLijst.vue` (contacten/alle), `pages/contacten/index.vue` (`skelet-balk`), laadregels in `OrganisatieFlyout.vue` en `ConflictResolveModal.vue`.

## Foutstaten

### Wat het is

Een fout staat op de plek waar hij ontstond: boven de voet van een flyout, in een blok, of als pagina als het record niet bestaat. Rode tekst met een rode rand links op een lichtrode ondergrond.

### Wanneer wel en wanneer niet

- `.fout-blok` of `.fo-fout`: opslaan of ophalen mislukt binnen een flyout of blok. De invoer blijft staan.
- `.fout-pagina`: een record dat niet (meer) bestaat of niet van jouw organisatie is.
- Toast `--fout`: een fout na een actie zonder vaste plek.
- Fout bij één veld: deel B.

### Opbouw in HTML

```html
<p class="fout-blok" role="alert">Opslaan mislukt: taak niet gevonden. <button class="fout-blok-actie">Opnieuw proberen</button></p>
```

### Maten

| Onderdeel | Waarde | Telling |
|---|---|---|
| Tekst | 13px `--red` | rood 36x, 13px 19x |
| Rand | links 3px `--red` | 16x |
| Ondergrond | `--red-zacht` (rood op 0.08) | 16x |
| Padding | 10px 12px | 14x |
| Pagina | wit, rand `--border`, links 3px rood, padding 48px 24px, kicker rood | |

### Teksten

Wat er misging, dan wat je kunt doen: "Opslaan mislukt: taak niet gevonden.", "Vastleggen mislukt. Probeer het opnieuw.", "Dit account bestaat niet in jouw organisatie.". Noem nooit een medewerker bij naam in een foutzin.

### Waar in DealDrive

45 foutregels in 41 bestanden met klassen op `-error`, `-fout` en `-foutmelding`, bijvoorbeeld `tk-error` in TaakFlyout; `AccountNietGevonden.vue` voor de pagina.

## Grafieken

### Wat het is

Rapportagegrafieken zonder grafiekbibliotheek: een gestapelde staafgrafiek van activiteiten per dag of week, een trechter per pipelinefase en een dekkingsraster dat toont hoe lang geleden het laatste contact was. Alles is HTML en CSS.

### Wanneer wel en wanneer niet

- Staafgrafiek: aantallen over tijd, met maximaal zes soorten gestapeld.
- Trechter: aantal en waarde per fase; een klik op een fase opent de deals erachter (FaseDealsFlyout).
- Dekking: verdeling van accounts over leeftijd van het laatste contact; een klik opent de lijst (DekkingFlyout).
- Een cijfer zonder verdieping is geen knop: dan geen hover en geen cursor.

### Kleuren

| Reeks | Token |
|---|---|
| Calls | `--blue` |
| Afspraken | `--yellow` |
| Meetings | `--orange` |
| Mails | `--green` |
| Berichten | `--purple` |
| To-do's | `--ink-soft` |

Dekking van vers naar koud: `--green`, groen gemengd met `--bg` op 45% (`color-mix`), `--yellow`, `--orange`, `--red`, `--red-dark`. Lege vakken op 55%.

### Assen en maten

| Onderdeel | Waarde |
|---|---|
| Blok | wit, rand `--border`, padding 16px, titel serif 18px, meta 12px `--muted` |
| Plotvlak | 200px hoog, nullijn 2px `--ink`, staven gap 6px, minimaal 24px breed |
| Y-as | twee ticks (hoogste waarde en 0), 11px 700 `--muted`, even hoog als het vlak |
| X-as | dag of week, 11px `--muted`, tabelcijfers |
| Segment | min 2px, scheidingslijn `--wit-55` (DealDrive: wit op 50%) |
| Legenda | chips op `--surface`, blokje 10px, 12px 600 |
| Trechter | raster 110px 1fr 80px, baan 30px op `--bg`, staaf in fasekleur met het getal op een witte chip (serif 16px), groeit in 600ms |
| Dekking | 3 kolommen (prospects 6), getal serif 24px, label 11px |
| Hover en focus | omlijning 2px `--ink` om baan of vak |

### Waar in DealDrive

`app/components/RapportageGrafieken.vue` via `RapportagePagina.vue`.

## Minikaart

### Wat het is

Een kaart van de dagroute op de bezoekenpagina: een Google Maps-embed in een vak van 4 bij 5, met daaroverheen genummerde pinnen per stop. De volgende stop is rood en pulseert.

### Opbouw in HTML

```html
<div class="minikaart">
  <iframe class="minikaart-iframe" title="Routekaart" loading="lazy"></iframe>
  <div class="minikaart-laag" aria-hidden="true">
    <div class="minikaart-pin minikaart-pin--volgende" style="left: 42%; top: 38%">
      <span class="minikaart-druppel"><span class="minikaart-num">1</span></span>
      <span class="minikaart-label">09:30 Van Dijk</span>
    </div>
  </div>
</div>
```

### Varianten en toestanden

| Onderdeel | Waarde |
|---|---|
| Vak | 4:5, rand `--border`, achtergrond `--kaart-water` (#e6f0f5, zoals DealDrive) tot de kaart laadt |
| Pin | druppel 22px, inkt met gele rand 2px en geel cijfer 11px 800, hoeken 2px 50% 50% 0, 45 graden gedraaid |
| Volgende stop | rood met witte rand en wit cijfer, pulseert 1.8s tot 118% |
| Label | inkt met geel, 11px 800, 0.04em, rechts naast de pin |
| Bewegingsgevoelig | geen puls |

De pinnen zijn decoratie (`aria-hidden`); de route staat ook als lijst naast de kaart.

### Waar in DealDrive

`app/components/MiniMap.vue` op `app/pages/bezoeken.vue`.

## Afdrukken

### Wat het is

Drie pagina's hebben een knop die `window.print()` aanroept (briefing, team, team-weekrapport) en StartplanArchiefFlyout drukt een eigen venster af. Voor die gevallen is er een afdrukstijl.

### Regels

1. Bediening en navigatie gaan van het blad: toasts, banner, zoek, knoppenrijen, de voet en het sluitkruis van een flyout.
2. Donkere vlakken worden wit met een inktlijn van 2px links (weekrapport, briefinghero).
3. Grijze vlakken worden transparant met een rand `--border-strong` en een inktlijn links.
4. Blokken, kaarten, tegels en rijen breken niet over een pagina (`break-inside: avoid`).
5. Een flyout die je afdrukt wordt het document: geen overlay, geen eigen scrollgebied, volle breedte. Zet daarvoor op body een klasse (in DealDrive `dd-team-weekfly`, in Dealtrace `druk-flyout`) en verberg de rest van de app.
6. Tabellen in 11pt.

### Waar in DealDrive

`@media print` in `pages/accounts/[id]/briefing.vue`, `pages/team-weekrapport.vue`, `pages/team.vue`, `components/WeekrapportFunnel.vue`, `components/WeekrapportKansen.vue`.
