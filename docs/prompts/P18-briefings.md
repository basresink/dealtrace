# P18: Briefings, Pitstop, Schrijver, mail

| Onderdeel | Waarde |
|---|---|
| Sprint | 9 |
| Features | F11 Briefings en Pitstop, met de Schrijver (11.5), de concept-inbox (8.5.7) en mail versturen (12) |
| Hangt af van | P01 (rechten, functiecatalogus), P27 (mobiele schil, schuifvensters), P03 (accounts, contacten, buying committee), P05 (reis, Pitstop-accent per fase), P07 (taken, taakflyout, conceptblok), P08 (mandaten, Bewaker, bundel), P10 (belscripts en invulling), P13 (afspraken, meetingsoorten), P17 (deals, offertes), P28 (leesmodel verkoopverhaal), P31 (voorlezen, briefingmelding) |
| Bron in het bouwplan | F11, 11.1 tot en met 11.5, 8.5.7, 8.7, 8.10, 12 (rij Mail), F06 (conceptblok), F08 (opvolgmail, voicemail), F23 (agent-prompts), F25 (briefing en Pitstop), 15.2, 15.3, Bijlage A regels 16, 24, 34 |

## Lees eerst

- `Bouwplan-Dealtrace.md`: 2.1 (geen bewijs, geen inzicht; de mens beslist), 2.3, 4.3 (rij F11), 5.2, 8.5.5 (Pitstop op de compacte kaart), 8.5.7, 8.7, 8.9, 8.10, 8.11, F06 (taakflyout en conceptblok), F08 (scripts, opvolgmail), F09, F11 volledig, F12 (mailreeks), F17, F23 (agent-prompts, AI-verbruik), F25 (Uit het verkoopverhaal, kiesWinpunt), 10.2 (rijen `briefing_teksten`, `agent_runs`, `mailsjablonen`), hoofdstuk 11 volledig, 12 (rij Mail), 15.2, 15.3, 16.4, 19, ADR-007, ADR-009, Bijlage A, Bijlage B (rijen AI, Briefings, Mail), Bijlage C (voor de testgevallen).
- DealDrive op commit 75bee61: `app/pages/briefings.vue`, `app/components/BriefingFlyout.vue`, `app/components/BriefingOverviewFlyout.vue`, `app/components/OfferteBriefingFlyout.vue`, `app/components/BriefingCard.vue`, `app/components/BriefingTekstBlok.vue`, `app/pages/accounts/[id]/briefing.vue`, `app/composables/useQuickBriefing.ts`, `app/composables/useBriefingSoort.ts`, `app/composables/useBriefingAi.ts`, `shared/briefingBlokken.ts`, `server/utils/briefingAi.ts`, `server/utils/agentExecutor.ts`, `server/utils/autoVoorbereiding.ts`, `server/api/agent/prepare-afspraak.post.ts`, `server/api/agent/prepare-deal.post.ts`, `server/utils/promptBibliotheek.ts`, `server/utils/promptStandaarden.ts`, `shared/promptSlots.ts`, `server/utils/llm-provider.ts`, `server/utils/aiVerbruik.ts`, `shared/aiBundel.ts`, `server/utils/mailVersturen.ts`, `server/utils/mailProviders.ts`, `server/utils/mailConnectionStore.ts`, `app/pages/dex/concept.vue`, `app/pages/dex/opvolgmail.vue`, `server/utils/dexConcepten.ts`.

## Deel 1: Functioneel (wat en waarom)

### Wat je bouwt

Je bouwt drie lagen voorbereiding (de berekende briefing, de Pitstop als AI-concept ter goedkeuring en de koppeling naar de verslaganalyse), de Schrijver die boodschappen per kanaal schrijft volgens 11.5, de concept-inbox "Concepten" en het versturen van goedgekeurde mail.

### Waarom

Een briefing maak je niet aan; hij verschijnt omdat er een afspraak of taak is (F11). In DealDrive was de briefing op Vandaag altijd BPO, kregen achterstallige taken geen briefing en fabriceerde een import een contactmoment (Bijlage A regel 34); handboek en code spraken elkaar tegen over de promptcache (regel 24). AI mag voorbereiden en schrijven, maar nooit zelf een eerste bericht versturen (2.1, 11.2). Een accountmanager moet een opvolgmail in vier tikken kunnen versturen (8.7).

### Gebruikers en niveaus

| Rol | Niveau | Wat |
|---|---|---|
| Accountmanager | Beginner | Snelle briefing vanuit afspraak of taak met automatisch gekozen soort; na het gesprek "Doel gehaald?" en volgende stap; concepten goedkeuren en versturen; elk concept per stuk goedkeuren (Schrijver A, Verzender uit) |
| Accountmanager | Gevorderd | Overzicht met filters, soortkiezer, eigen tekst per blok, volledige printbare briefing, Pitstop opnieuw maken, briefing delen met een collega |
| Accountmanager | Expert | Soort vastzetten per gesprek, offertebriefing met bezwaren, eigen briefingsoort |
| Salesmanager | rol | Concepten van het team die op zijn goedkeuring wachten (8.12) |
| Beheerder | rol | SMTP of gekoppelde mailbox van de organisatie, mailsjablonen, agent-prompts van de organisatielaag (vanaf Plus) |
| Founder | rol | Platformlaag van de agent-prompts (F23) |

### Schermen

**Briefing** (vanuit afspraak, taak of account; flyout van 560 px op de laptop, schuifvenster op de telefoon). Kop met soort ("EERSTE GESPREK"), account, wanneer. Per blok een herkomstlabel ("Berekend", "Door AI geschreven", "Eigen tekst"); eigen tekst wint van AI, AI van berekend; eigen tekst wordt per gesprek bewaard. Onderaan na het gesprek "Doel gehaald?" (Ja, Deels, Nee) en "Volgende stap".

| Soort | Wanneer (automatische keuze) | Blokken |
|---|---|---|
| Eerste gesprek | nog geen gesprek met een beslisser | Bedrijf in drie zinnen · Waarom nu (aanleiding met bron) · Wie zit er tegenover je · Wie ontbreekt nog · Openingsvraag (golden circle en aanleiding) · Winpunt en één bewijs · Doel van dit gesprek · Ons verhaal voor deze branche (F25) |
| Behoefte, probleem, oplossing | 1 of 2 gesprekken gevoerd | Pijnpunt (uit het vorige verslag) · Huidige situatie · Gewenste situatie · Onze oplossing en winpunt · Te verwachten bezwaren met antwoord · Doel |
| Verdieping | 3 of meer gesprekken of fase In gesprek | Samenvatting vorige gesprekken · BAND met wat er ontbreekt · Stakeholders · Vergelijkingscriteria · Doel |
| Offerte | fase Offerte uit of meetingsoort Offertebespreking | Stand van de offerte · Verwachte bezwaren gewogen · Beslismoment · Onderhandelruimte · Doel · kernbelofte als voorgestelde offertekop · "Wanneer we verliezen" van de huidige leverancier als risico (F25) |
| Bezoek (buitendienst) | meetingsoort met vorm bezoek | Als eerste gesprek plus: adres, parkeren, wie je bij de receptie vraagt, wat je meeneemt |

De soort volgt eerst de meetingsoort, dan de fase in de reis, dan het aantal gesprekken; een Expert kan hem vastzetten.

**`/briefings`** (Gevorderd; overzicht): Niet vastgelegd in het bouwplan als route of zijbalkitem (6.1 noemt het niet). Voorstel: een tabblad "Briefings" onder `/agenda?weergave=briefings` met filters periode, soort en "Zonder briefing gelezen", omdat 6.1 geen eigen menu-item heeft.

**Pitstop** (op taak, afspraak en deal): knop "Bereid voor" maakt het concept dat bij de actiesoort past (belscript via het gekozen template F08, mailconcept, LinkedIn-bericht, bezoekbriefing, dealvoorbereiding) met het Pitstop-accent van de fase, het winpunt, de top drie bezwaren uit de waarde en de open vragen uit het vorige verslag. Statussen: wacht, bezig, klaar ter goedkeuring, goedgekeurd, mislukt. Tekst onder het concept: "De agent voert niets uit. Jij keurt goed en belt, mailt of bezoekt zelf." Het eerste bericht bouwt de Pitstop in vier stappen: voor wie, welk probleem, welk resultaat, waarom geloofwaardig (één bewijs).

**Conceptblok** (in de taakflyout, F06): concept met stijlscore, winpunt gemarkeerd, gemarkeerde woorden, bronnen en de gebruikte versie van het verkoopverhaal; knoppen "Keur goed", "Kopieer", "Andere toon", "Maak opnieuw". Na "Keur goed" verschijnt bij mail "Verstuur" (via de SMTP van de organisatie, binnen consent en afkoelperiode) en bij LinkedIn "Open profiel" plus "Gedaan".

**Concepten** (inbox, onder "Meer" op de telefoon en bereikbaar via de bel met teller, 8.5.7): alles wat agents klaarzetten (opvolgmail, taak uit verslag, belscript-invulling, LinkedIn-tekst). Per concept maker, aanleiding, tekst, bewijs en de knoppen "Goedkeuren", "Aanpassen", "Verwerpen". Een goedgekeurde mail opent met "Verstuur via je mail" de mailapp met ontvanger, onderwerp en tekst ingevuld (`mailto:`), of via de gekoppelde mailbox direct; een WhatsApp-tekst opent WhatsApp met de tekst ingevuld (`https://wa.me/<nummer>?text=`). Route: Niet vastgelegd in het bouwplan; voorstel `/concepten`. Lege staat (voorstel): "Geen concepten. Wat agents voor je klaarzetten, verschijnt hier."

**Instellingen, Koppelingen, Mail** (beheerder): SMTP met "Test" vóór "Opslaan", controle op SPF, DKIM en DMARC als voorwaarde; of de gekoppelde mailbox via Microsoft Graph of Gmail API via de agendakoppeling (P13). Foutmelding in gewone taal (voorstel): "De mailserver weigert de verbinding. Controleer het wachtwoord van het verzendadres."

**Instellingen, Verkoop, Mailsjablonen** (beheerder): Niet vastgelegd in het bouwplan als scherm; voorstel: lijst van sjablonen met naam, kanaal, onderwerp, tekst met variabelen, gebruikt in campagnesoorten (F12).

**Telefoon (390 px).** De Pitstop staat ingeklapt op de compacte accountkaart: de briefing in vijf regels met "Lees voor" (8.5.5). Concepten onder "Meer". De briefingmelding 30 minuten vooraf bouwt P31; deze prompt levert de drie regels. De Pitstop zit in het dagpakket (8.8).

### Klikpaden met tikken

1. Concept-opvolgmail versturen (8.7): bel (1), concept (2), "Goedkeuren" (3), "Verstuur via je mail" (4).
2. Briefing lezen vóór een gesprek (Beginner): afspraak openen (1), "Pitstop" (2). De briefing staat er altijd, ook zonder AI-bundel, met berekende tekst.
3. Pitstop maken (Gevorderd): taakflyout, "Bereid voor" (1); status "bezig", daarna "klaar ter goedkeuring"; "Keur goed" (2).
4. Eigen tekst: in een blok "Bewerken" (1), tekst, "Bewaar" (2); het label wordt "Eigen tekst".
5. Na het gesprek: "Doel gehaald?" Ja, Deels of Nee (1), "Volgende stap" kiezen (2).

### Regels

- Elke ingang (Vandaag, afspraak, taak, account, telefoon, push) kiest dezelfde soort voor hetzelfde gesprek (regel 34).
- Achterstallige taken krijgen ook een briefing; een import maakt geen contactmoment (regel 34).
- Zonder AI-bundel werkt de briefing volledig met berekende tekst; een Beginner op Starter heeft geen AI-invulling (11.4).
- Schrijven (11.5): volgorde bij een eerste contact waarom, hoe (het winpunt), één vraag; het "wat" niet in de eerste alinea. Precies één argument met bewijs: het winpunt uit `kiesWinpunt` met één bewijs uit `vv_bewijs`, de concurrentregel of een winpuntbijlage; de belofte en kernzin uit de branche van het account met terugval op algemeen. Bericht 2 en verder een ander winpunt. Lengte: mail 120 woorden, LinkedIn 80, WhatsApp 60, belscript 150, kaart 40. Stijlscore `5 + min(5, passende woorden) - 2 × vermeden woorden`, begrensd 1 tot 10; onder 7 één keer opnieuw met de vermeden woorden in de instructie. Toon "Zakelijk", "Persoonlijk", "Kort" verandert de vorm, niet het waarom.
- Alleen bevestigde versies van het verkoopverhaal gaan naar buiten; elk concept bewaart de gebruikte versies (`vvVersies`); bij "Mogelijk verouderd" toont de bronregel het label (F25).
- Een winpunt onder de norm (Voltvast wp-02, weging 0,5) komt niet als eerste winpunt in een concept (Bijlage C.9 punt 4).
- Namenfilter op elke aanroep met verkoopverhaal plus account- of contactgegevens; privémail en privémobiel gemaskeerd (11.2).
- Mandaat (11.3): Schrijver A voor concepten; Verzender C voor de eerste mail en elke mail aan een beslisser, B voor vervolgmails in een goedgekeurde campagne (vanaf Gevorderd, ADR-007); Beginner: Verzender uit, elke mail als concept. Elke verzending via de Bewaker: consent, afkoelperiode, frequentieplafond, dagplafond, werkuren.
- Elke eerste mail bevat de informatieplicht: afmeldlink en verwijzing naar de privacyverklaring; een afmelding gaat gehasht op de onderdrukkingslijst (15.2).
- Meting van overname per concept: ongewijzigd, aangepast of verworpen (11.2); KPI boven 60 procent ongewijzigd of licht aangepast (16.4).
- Automatisch voorbereiden per regel: maximaal 10 per motorrun (F15; de motor roept de Pitstop aan).

### Filters en sorteren

Concepten: filter soort (mail, LinkedIn, taak, belscript), maker (agent), account; standaard nieuwste eerst. Briefingsoverzicht (Gevorderd): periode, soort.

### Helpartikelen

- "Briefing en Pitstop" en "Concepten goedkeuren en versturen" (Dagelijks werk, F21).
- New business: "De eerste mail: waarom, hoe, vraag", "Een opvolgmail na een voicemail", "Eén winpunt per gesprek", "Je verhaal: waarom, hoe, wat".

## Deel 2: Technisch (hoe)

### Datamodel

- Geen aparte briefingtabel: berekend live.
- `briefing_teksten: organisation_id, onderwerp ('afspraak'|'taak'), onderwerp_id, blok, tekst, door, op` (F11).
- `agent_runs` met `draft` voor AI-versies, plus `agent`, `mandaatNiveau`, `bronnen[]`, `kosten` (F14).
- Concepten: Niet vastgelegd in het bouwplan als tabel; voorstel: concepten zijn `agent_runs` met `status ('klaar'|'goedgekeurd'|'verworpen'|'verstuurd')`, `overname ('ongewijzigd'|'aangepast'|'verworpen')`, `vvVersies`, en een verwijzing naar taak, afspraak of deal.
- `mailsjablonen` (F08, 10.2): Niet vastgelegd als kolommen; voorstel `id, organisation_id, naam, kanaal, versie, data {onderwerp, tekst, variabelen[]}`.
- Mailkoppeling: hergebruik `mailConnectionStore.ts`; geheimen AES-256-GCM met eigen geheim per doel (15.3).
- Onderdrukkingslijst: Niet vastgelegd als tabel; voorstel `onderdrukking: organisation_id, hash, kanaal, op`.
- Briefing-uitkomst "Doel gehaald?": voorstel in `appointments.data.briefingUitkomst {doel, volgendeStap}` of `tasks.data`.
- RLS: `org_isolation`; concepten leesbaar voor eigenaar en team-salesmanager.
- Sync-allowlist en offline-mutatiesoort: `concept.besluit` (8.14): goedkeuren kan offline, versturen wacht op verbinding (8.8); `briefing_teksten` schrijven via sync (voorstel).

### Pure functies

| Functie | Invoer | Uitvoer | Randgevallen en tests |
|---|---|---|---|
| `kiesBriefingSoort(context)` | meetingsoort, fase, aantal gesprekken, vastgezette soort | soort | geen beslisser bekend; bezoekvorm; achterstallige taak |
| `vulBriefing(soort, context)` (geen AI) | soort, account, contacten, verslagen, leesmodel | blokken met herkomst "Berekend" | branche zonder eigen verhaal valt terug op algemeen met gat (C.9 punt 1) |
| `gewogenBezwaren(offerte, account)` | offerte, account | bezwaren met gewicht | geen concurrent bekend |
| `stijlScore(tekst, profiel)` | tekst, passende en vermeden woorden | 1 tot 10 | lege tekst; grenzen 1 en 10 |
| `lengteBinnenGrens(tekst, kanaal)` (voorstel) | tekst, kanaal | boolean en aantal woorden | grens precies 120 |
| `mailtoLink(concept)`, `whatsappLink(concept, nummer)` (voorstel) | concept | URL | tekens coderen; geen nummer |
| `pitstopDrieRegels(briefing)` (voorstel) | briefing | drie regels voor de push en "Lees voor" | lege blokken |

`kiesWinpunt`, `verhaalVoor`, `beloftevoor` komen uit `shared/verkoopverhaal.ts` (P28); niet opnieuw bouwen.

### Endpoints

| Methode en route | Recht | Invoer | Uitvoer | Fouten |
|---|---|---|---|---|
| `GET /api/briefing?afspraak=\|taak=\|account=` | lezen | onderwerp | briefing met blokken en herkomst | 404 |
| `PUT /api/briefing/tekst` | Gevorderd | `{onderwerp, id, blok, tekst}` | blok | |
| `POST /api/agent/prepare {taskId\|appointmentId\|dealId}` | functie `pitstop.maken` | onderwerp | run-id, status | 429 bundel op met "Je maandbundel voor concepten is op."; 403 niveau |
| `GET /api/concepten` (voorstel) | eigen; salesmanager team | filters | concepten | |
| `POST /api/concepten/:id/besluit` (voorstel; via sync als `concept.besluit`) | eigenaar | `{besluit, tekst?}` | concept | 409 al besloten |
| `POST /api/mail/verstuur` (voorstel) | eigenaar | conceptId | status | 403 Bewaker met reden ("Afkoelperiode mail tot 3 december"); 502 mailserver |
| `GET/PUT /api/koppelingen/mail`, `POST /api/koppelingen/mail/test` (voorstel, in de lijn van F02) | beheerder | SMTP-gegevens | status | 400 SPF, DKIM of DMARC ontbreekt |

### AI-stappen

| Stap | Agent en mandaat | Materiaal | Schema | Vangrails | Mock | Bundelsoort |
|---|---|---|---|---|---|---|
| Pitstop (concept per actiesoort) | Schrijver, A voor concepten | briefing, Pitstop-accent van de fase, winpunt met één bewijs, top drie bezwaren, open vragen uit het vorige verslag, bevestigd verkoopverhaal | per concepttype (belscript, mail, LinkedIn, bezoekbriefing, dealvoorbereiding) met `additionalProperties false` | bewijsplicht, bronvermelding, lengtegrenzen, stijlcheck, namenfilter, alleen bevestigde versies; één herhaling bij schemafout | vaste fixtures per type | Concept (0 / 1.500 / 1.500) |
| Boodschap per kanaal (ook voor P16) | Schrijver, A | als boven plus toon | `{onderwerp?, tekst, winpuntId, bronnen[], vvVersies}` | 11.5 volledig | idem | Concept |
| AI-blok in de briefing | Schrijver, A | als boven | per blok tekst met bron | als boven | idem | Concept |
| Versturen | Verzender, C (eerste mail, beslisser) of B (vervolg in campagne, Gevorderd en hoger) | goedgekeurd concept | n.v.t. | Bewaker `magHandelen`; afmeldlink; nooit buiten werkuren (11.3) | mock-mailprovider | n.v.t. |

Promptketen: platform, organisatie, code (F23); vast kader dat geen prompt kan opheffen. Golden masters per prompt; de promptcache is beschreven in het handboek en de golden master bewaakt dat handboek en code overeenkomen (regel 24).

### Integraties

- Anthropic API via `llm-provider.ts` met mock; modelkeuze per soort in de AI-koppeling (F23).
- Mail (12): SMTP van de organisatie met test eerst, dan opslaan, AES-256-GCM, SPF, DKIM en DMARC als voorwaarde; of Microsoft Graph en Gmail API via de agendakoppeling. Adapter `mailProviders.ts` met mock; logging in `koppeling_runs`.

### Functiecatalogus

Sleutels niet vastgelegd in het bouwplan; voorstel:

| Sleutel | Niveau | Pakket | Recht | Helpartikel |
|---|---|---|---|---|
| `briefing.lezen` | Beginner | Starter | lezen | "Briefing en Pitstop" |
| `briefing.bewerken` (eigen tekst, soortkiezer, overzicht, delen) | Gevorderd | Starter | taken schrijven | idem |
| `briefing.soortVastzetten`, `briefing.eigenSoort`, `briefing.offerteBezwaren` | Expert | Plus (voorstel) | taken schrijven | idem |
| `pitstop.maken` | Beginner (lezen en goedkeuren); "opnieuw maken" Gevorderd | Plus (bundel Concept) | taken schrijven | idem |
| `concepten.inbox` | Beginner | Starter | eigen | "Concepten goedkeuren en versturen" |
| `mail.versturen` | Beginner | Starter | eigen; koppeling door beheerder | idem |
| `koppeling.mail` | Expert | Starter | beheerder | "Koppelingen" |

### Hergebruik uit DealDrive

- `briefings.vue`, `BriefingFlyout.vue`, `BriefingOverviewFlyout.vue`, `OfferteBriefingFlyout.vue`, `accounts/[id]/briefing.vue`, `useQuickBriefing.ts`, `shared/briefingBlokken.ts`: soorten voor new business, één soortbepaling.
- `agentExecutor.ts`, `autoVoorbereiding.ts`, `briefingAi.ts`, `prepare-afspraak.post.ts`, `prepare-deal.post.ts`: één endpoint `POST /api/agent/prepare`.
- `promptBibliotheek.ts`, `promptStandaarden.ts`, `shared/promptSlots.ts`: promptketen.
- `aiVerbruik.ts`, `shared/aiBundel.ts`: bundel met melding bij 80 procent en blokkade bij 100.
- `mailVersturen.ts`, `mailProviders.ts`, `mailConnectionStore.ts`: aanpassen met consent, afmeldlink en dagplafond.
- `dex/concept.vue`, `dex/opvolgmail.vue`, `dexConcepten.ts`: patroon van de concept-inbox, in de Dealtrace-app zonder aparte build.

### Buiten scope

- Notulist en verslaganalyse (P19); de briefing gebruikt wat er al is.
- WhatsApp versturen via een provider (P26); hier alleen de `wa.me`-link.
- Coaching op "Doel gehaald?" (P21). Belscript-invulling zelf (P10).

## Acceptatiecriteria

1. Bijlage A regel 34: elke ingang kiest dezelfde soort voor hetzelfde gesprek; achterstallige taken krijgen ook een briefing; een import maakt geen contactmoment.
2. Bijlage A regel 24: het handboek beschrijft de promptcache zoals de code werkt; een golden master faalt als ze uiteenlopen.
3. Bijlage A regel 16: soortbepaling, stijlscore en lengtegrenzen staan één keer in `shared/`.
4. Zonder AI-bundel werkt de briefing volledig met berekende tekst.
5. Een concept bevat precies één winpunt met één bewijs, volgt waarom, hoe, vraag, blijft binnen de lengtegrens en heeft een stijlscore van 7 of hoger (of is één keer opnieuw gemaakt).
6. Bijlage C.9: punt 2 (br-01 met huidige leverancier cc-02 geeft kernzin, belofte van br-01, wp-01 en het bezwaar "Online is het goedkoper." met antwoord), punt 3 (fase Signaal: gat getoond, wp-01 als belofte), punt 4 (wp-02 niet als eerste winpunt), punt 8 (verouderd label in de bronregel), punt 9 (een contactnaam in aantekeningen komt niet in de AI-aanroep).
7. Een concept bewaart de gebruikte versies van het verkoopverhaal.
8. Dealtrace verstuurt nooit een eerste bericht zonder goedkeuring; de Verzender wordt door de Bewaker tegengehouden in een afkoelperiode, met reden in de log.
9. Elke eerste mail bevat een afmeldlink; een afgemeld adres krijgt geen mail meer, ook niet na een nieuwe import.
10. Tikdoel (8.7): concept-opvolgmail versturen in vier tikken, geteld in Playwright.
11. Telefoon (8.5.5, 8.5.7, 8.15, 8.16): op 375, 390 en 412 px staat de Pitstop in vijf regels met "Lees voor" op de compacte kaart; Concepten met knoppen van minimaal 44 px; `mailto:` en `wa.me` openen de juiste app met ingevulde tekst.
12. Offline (8.8): een concept goedkeuren slaagt offline; versturen wacht op verbinding en gebeurt daarna precies één keer.
13. AI: elk antwoord met schema, mock en golden master; zonder bewijs geen bewering; verbruik telt in de bundel met melding bij 80 procent.
14. Niveaus: als Beginner briefing lezen en concepten per stuk goedkeuren, zonder eigen tekst en zonder "Maak opnieuw" (vergrendeld met uitleg); als Gevorderd eigen tekst, soortkiezer en opnieuw maken; als Expert soort vastzetten en eigen briefingsoort. Getest per niveau.

## Definition of Done

Hoofdstuk 19 geldt volledig. Specifiek voor deze prompt:

- Golden masters voor Pitstop per concepttype en voor de boodschap per kanaal; één echte AI-run met kosten in het sprintverslag.
- Mailprovider-mock; geen echte mail in tests; SPF, DKIM en DMARC-controle getest met fixtures.
- Testdata: Voltvast (Bijlage C) als leesmodel, met fictieve accounts en contacten.
- Bijlage A regels 24 en 34 afgevinkt in het sprintverslag; helpartikelen "Briefing en Pitstop" en "Concepten goedkeuren en versturen" en het handboek (inclusief de promptcache) bijgewerkt.
