# P07: Taken, inzichten, Vandaag en hercontactritme

| Onderdeel | Waarde |
|---|---|
| Sprint | 5 |
| Features | F01 Vandaag (laptop), F06 Acties: taken en inzichten, F13 Hercontactritme (de ritme-engine en het tabblad Hercontactritme) |
| Hangt af van | P01 (fundament, functiecatalogus, sync), P27 (mobiele schil, schuifvenster), P03 (accounts en contacten), P05 (statusmachine, gebeurtenissen, terugkomregels), P28 (verkoopverhaal: aanpak van een terugkomregel, branche), P06 (motor die taken en inzichten maakt) |
| Bron in het bouwplan | F01, F06, F13 (Hercontactritme, Regels, Technisch), 2.3, 5.1, 7.2, 7.3, 10.2 (`tasks`, `signals`, `hercontactritmes`), 13.3 (flow 2), 13.4, 15.1 (datakwaliteit in de dag), 8.2, ADR-018, Bijlage A (gat 11, 12, 16, 39, 40) |

## Lees eerst

- `Bouwplan-Dealtrace.md`: 2.1 tot en met 2.3, 4.3 (rijen F01, F06, F13), 5.1 tot en met 5.3, 6.1 en 6.3, 7.2 en 7.3, 8.2 (één venster per soort), 8.3 (schuifvenster, meldingsstrook), F01, F06, F13, F15 (regels met activiteit "taak", "Waarom krijg ik dit?"), F25 (terugkomregel), 10.1, 10.2, 13.3, 13.4, 14, 15.1, 19, ADR-018, Bijlage A.
- DealDrive op commit 75bee61 (alleen lezen): `app/pages/index.vue`, `app/components/VandaagPanel.vue`, `app/components/BriefingCard.vue`, `app/components/ActivityFeed.vue`, `app/pages/taken.vue`, `app/pages/inzichten.vue`, `app/components/TaakFlyout.vue`, `app/components/NieuweTaakFlyout.vue`, `app/components/InzichtFlyout.vue`, `app/components/SignalCard.vue`, `app/components/SwipeActions.vue`, `app/composables/useLongPress.ts`, `app/composables/useQuickCreateTask.ts`, `shared/datum.ts` (`volgendWerkmoment`, `vervalLabel`), `shared/periodeFilter.ts`.

## Deel 1: Functioneel (wat en waarom)

### Wat je bouwt

Je bouwt Vandaag op de laptop, de pagina Acties met taken en inzichten, één afrondfunctie voor elk pad en de hercontactritme-engine die na elke uitkomst de volgende poging plant of het account parkeert.

### Waarom

"Vandaag is het product" (2.1): de gebruiker begint elke werkdag hier en ziet wat hij nu moet doen, waarom, en wat er voor hem klaarstaat. De meeste afspraken ontstaan pas na de vierde of vijfde poging; het hercontactritme haalt die beslissing uit het hoofd van de verkoper (F13). In DealDrive registreerde afronden het contactmoment maar op één pad, erfden vervolgtaken de herkomst niet, vielen achterstallige taken weg uit de horizonweergave en zette de motor een bijgewerkt inzicht terug op ongelezen (Bijlage A, gat 11, 12, 39, 40).

### Gebruikers en niveaus

| Rol | Niveau | Wat |
|---|---|---|
| Accountmanager | Beginner | Vandaag blok 1 tot en met 5; taken in een lijst (achterstallig, vandaag, morgen, deze week, later), afronden met uitkomst, uitstellen, nieuwe taak met minimale velden, inzicht lezen en "Maak taak"; volgende poging zien ("poging 3 van 5") |
| Accountmanager | Gevorderd | Plus Vandaag blok 6 tot en met 8 en eigen volgorde van de blokken; horizonweergave, alle filters, herhaling, herinnering, contextmenu en vegen, "Afronden en volgende", inzichten bewerken en afwijzen met reden, bulkacties, eigen ingang `/inzichten`; tabblad Hercontactritme lezen |
| Accountmanager | Expert | Plus eigen weergaven en filters op de takenkolom van Vandaag, eigen taaksjablonen, persoonlijke automatische voorbereiding; ritme kiezen per campagne en parkeerregels per reis (bij F12 en F05) |
| Salesmanager | Gevorderd of Expert | Eigen Vandaag plus blok "Team vandaag"; teamweergave met filter per persoon, achterstand per persoon, acceptatiegraad van inzichten per regel; ritmes beheren en rapport per ritme |
| Beheerder | Expert | Alles; echt verwijderen van taken |

Een Beginner krijgt motorvoorstellen altijd als inzicht ter goedkeuring, behalve ritmepogingen in een lopend hercontactritme (die zijn al goedgekeurd met de campagne of reis).

### Schermen

**Vandaag op de laptop** (`/`, eerste item in de zijbalk). De telefoonweergave van Vandaag bouw je in P32; deze prompt levert de gegevens via `GET /api/vandaag` die beide gebruiken. Van boven naar beneden:

1. **Kop.** Groet met naam ("Goedemorgen, Sanne."), kicker met datum en week ("VANDAAG · DINSDAG 13 OKTOBER · WEEK 42"), samenvattende regel ("6 taken · 3 uit campagnes · koude norm 3 van 5 deze maand · volgende koude actie 10:00"). Rechts "+ Taak" (geel), "+ Afspraak", "+ Prospect", "AI".
2. **Aanleiding van de dag.** Eén kaart met het belangrijkste inzicht voor een van jouw accounts (ongelezen, relevantie 85 of hoger, jonger dan 48 uur wint), met bron, citaat en de knoppen "Maak taak" en "Open kaart".
3. **Drie kolommen.** "TAKEN n": maximaal 8, eerst achterstallig, dan vandaag, dan hoog en urgent; per taak tijd, account, actiesoort als label ("BEL", "MAIL", "LINKEDIN", "BEZOEK", "TAAK"), regel "poging 2 van 5 · vorige: voicemail", winpunt of script, label "AI" als er een concept klaarstaat; "nog N meer →" naar Acties. "AFSPRAKEN n": vandaag, met meetingsoort, plaats of "online", link "Pitstop →". "PRIO n": maximaal 4: nieuwe aanleidingen, offertes die op opvolging wachten, geparkeerde accounts die vandaag terugkomen, partnerleads te laat.
4. **Werkblok** volgens het werkplekprofiel. Binnendienst: "BELBLOK 10:00 tot 11:00 · 6 gesprekken · 48 min" met "Start belblok" (geel) en "Vul aan". Buitendienst: "BEZOEKDAG · REGIO OOST · 3 bezoeken · 4 kansen langs de route" met "Open route" (geel).
5. **Klaargezet door AI.** "4 concepten wachten op je goedkeuring", elk met "Bekijk".
6. **Door agents gedaan sinds gisteren** (Gevorderd): "12 dossiers ververst · 3 nieuwe aanleidingen · 2 accounts geparkeerd · 5 mails verstuurd binnen campagne X"; klik opent de activiteitenlog gefilterd op agents.
7. **Datakwaliteit** (Gevorderd): de drie grootste gaten ("12 actieve prospects zonder telefoonnummer") met één knop ("Verrijk" of "Maak taak").
8. **Jouw week** (Gevorderd): vijf dagkolommen met aantallen taken, afspraken, belblokken en regiodagen.
9. Salesmanager: blok **"Team vandaag"** (wie loopt achter, wat wacht op goedkeuring).

Uit het verkoopverhaal (F25): taken op accounts in een branche met focus primair of prioriteit hoog krijgen voorrang; een terugkomregel die vandaag afloopt, verschijnt als taak met de aanpak als aanleiding.

Blokken die op latere prompts wachten: belblok en bezoekdag (P10 en P14), concepten (P18), dossiers en mails van agents (P19 en P16). Niet vastgelegd in het bouwplan; voorstel: een blok zonder bron toont geen lege kaart maar wordt weggelaten; alleen "Klaargezet door AI" toont bij nul de regel "Er wachten geen concepten op je." Lege takenkolom: "Niets te doen. De motor zet nieuwe pogingen klaar zodra ze aan de beurt zijn." (voorstel).

**Acties** (`/acties`, tabbladen "Taken" en "Inzichten"; vanaf Gevorderd ook `/inzichten`).

Taken, van boven naar beneden:

1. Kop: kicker "ACTIES", titel die telt ("12 taken vandaag, 3 over tijd." of "Niets te doen."), rode subtitel bij achterstand. Knoppen "+ Taak" (geel), "+ Afspraak", "Weergave" (Lijst, Horizon), "Filters".
2. Statkaarten, klikbaar als filter: "Vandaag", "Komende 7 dagen", "Achterstallig", "Alles open".
3. Lijst in groepen "Achterstallig", "Vandaag", "Morgen", "Deze week", "Later", "Geen vervaldatum". Taakkaart: afvinkknop, actiesoortlabel, prioriteit, herkomstlabel ("Uit regel", "Uit inzicht", "Campagne", "Ritme", "Handmatig"), "poging 3 van 5", vervaldatum als tekst ("3 dagen over tijd"), titel, account met fasepil, aanleiding.
4. Horizon (Gevorderd): kolommen "Vandaag", "Komende week", "Week 2 en 3"; achterstallige taken staan bovenaan in "Vandaag" met rode rand.
5. Contextmenu (Gevorderd): "Afronden", "Uitstellen 1 werkdag", "Uitstellen 1 week", "Open kaart", "Annuleer met reden".

Inzichten, van boven naar beneden:

1. Kop "Wat speelt er bij je prospects?", schakelaar "Alle", "Prospects", "Klanten".
2. Statkaarten: "Nieuw" (24 uur), "Hot" (relevantie 75 of hoger), "Deze week", "Totaal open".
3. Feed: kaart met accountbalk, badge "EXTERN" (geel) of "INTERN" (donker), specifieke bron ("KvK-mutatie", "Web: vacatures", "Verslag 1 okt"), ouderdom, relevantie, titel, beschrijving, AI-context, knoppen "+ Maak taak" en "Markeer als gelezen".

Lege staten: Niet vastgelegd in het bouwplan; voorstel: Taken met filter: "Geen taken die aan deze filters voldoen." met "Toon alles"; Inzichten: "Er zijn geen nieuwe inzichten bij je prospects."

**Hercontactritme** (`/planning`, tabblad "Hercontactritme", vanaf Gevorderd lezen). Per ritme een kaart met de stappen als ritmestrook (vakken per dag: 0 bellen, 3 bellen, 7 LinkedIn, 12 bellen, 21 mail, parkeren 180 dagen), bron (koud, warm, winback), parkeerduur en waar het gebruikt wordt. Rapport per ritme: afspraken per poging, percentage geparkeerd, gemiddelde pogingen tot afspraak; knop "Stel wijziging voor" (wordt een voorstel voor de salesmanager). Het tabblad Jaarplanning en Terugkomregels komen in P12. Niet vastgelegd in het bouwplan; voorstel voor deze knip: P07 maakt de route `/planning` met alleen dit tabblad, P12 voegt Jaarplanning (standaardtabblad) en Terugkomregels toe.

**Telefoon (390 px).** Acties is de derde tab van de onderbalk voor de binnendienst (8.4). De lijst toont één kolom; vegen naar links rondt af, vegen naar rechts stelt uit. De taakflyout en de inzichtflyout openen als schuifvenster van onderen (8.2, punt 5) met de plakkende knoppenrij onderaan en "Afronden" rechts. Het uitkomstraster staat in twee kolommen met knoppen van 56 px. Afronden toont de meldingsstrook boven de onderbalk ("Afgerond. Volgende poging donderdag 16 oktober, bellen." met "Ongedaan maken", 5 seconden). Offline gaat afronden in de wachtrij met de tekst "Bewaard op je telefoon, wordt verstuurd zodra je verbinding hebt".

### Flyouts en knoppen

**Taakflyout** (520 px; op de telefoon schuifvenster):

- Kop: prioriteitsbolletje, status, titel, account met fasepil, pogingregel "poging 3 van 5 · LinkedIn · vorige: bellen, geen gehoor (3 okt)".
- Blok **Aanleiding** (geel accent): waarom deze taak, met bron en citaat; bij een regel ook "Waarom krijg ik dit?" (F15).
- Blok **Concept** als er een is: belscript, mailconcept of LinkedIn-bericht met stijlscore, winpunt gemarkeerd, bronnen; knoppen "Keur goed", "Kopieer", "Andere toon", "Maak opnieuw". Na "Keur goed" bij mail "Verstuur" en bij LinkedIn "Open profiel" plus "Gedaan". De conceptinhoud komt uit P10 en P18; deze prompt bouwt het blok en de goedkeuring.
- Blok **Klant in context**: score, klasse, laatste uitkomsten, primair contact met bel- en mailknop.
- Blok **Uitkomst**: de knoppen uit 7.3 ("Gesproken, afspraak", "Gesproken, later" met datumveld, "Geen gehoor" of "Geen reactie", "Voicemail ingesproken", "Doorverbonden, nieuwe contactpersoon", "Niet geschikt", "Geen interesse" met reden: "Geen behoefte", "Tevreden met huidige leverancier", "Geen budget", "Verkeerd moment", "Niet de beslisser", "Niet geschikt", "Anders" met verplichte toelichting).
- Voet: "Afronden" (geel), "Afronden en volgende", iconen "Vraag AI", "Uitstellen", "Bewerken", "Annuleren", "Open kaart".
- Bewerkstand: Klant, Contactpersoon, Titel, Prioriteit, Vervaldatum en tijd, Actiesoort, Toegewezen aan, Aanleiding, Herinnering, Beschrijving, Belscript (bij bellen).

**Nieuwe taak** ("Wat moet er gebeuren?"): Beginner ziet Klant, Titel (minimaal 3 tekens), Actiesoort, Vervaldatum. Gevorderd ziet daarnaast Contactpersoon, Prioriteit, Toegewezen aan, Herhaling (elke werkdag, wekelijks, om de week, maandelijks; maximaal 52; vervolg pas na afronden), Herinnering (5 minuten tot 2 dagen; in-app, e-mail, beide), Beschrijving. Standaard vervaldatum: volgend heel werkuur (9 tot 18, geen weekend of feestdag).

**Inzichtflyout**: "Wat is er gebeurd?", "Waarom is dit relevant?" (gemarkeerd als beoordeling), "Bewijs" (citaat met bron, datum, link), "Voorgesteld winpunt", "Voorgestelde taak", "Klant in context"; knoppen "Maak taak" (geel), "Vraag AI", "Bewerken", "Markeer als gelezen", "Wijs af" met reden ("Niet relevant", "Al bekend", "Verkeerd account", "Te oud").

Bevestiging alleen bij onomkeerbaar: echt verwijderen (beheerder). Toasts in verleden tijd, 4 seconden.

### Klikpaden

1. **Taak afronden.** Klik op een taak; de taakflyout opent met aanleiding, concept en uitkomstknoppen. Kies "Geen reactie"; de volgende poging verschijnt in de lijst met datum en kanaal; toast "Afgerond. Volgende poging donderdag 16 oktober, bellen."
2. **Laatste poging.** Bij poging 5 van 5 kies "Geen gehoor"; het account gaat naar status wachtend met terugkomdatum; toast "Afgerond. Geparkeerd tot 2027-04-12." (Niet vastgelegd in het bouwplan; voorstel voor de tekst.)
3. **Inzicht omzetten.** Op Vandaag "Maak taak" bij de aanleiding van de dag; de taak erft titel, prioriteit, actiesoort, broninzicht en regel, krijgt het label "Uit inzicht"; het inzicht gaat op omgezet.
4. **Concept goedkeuren.** "Bekijk" bij een mailconcept opent de taakflyout met het concept; "Keur goed" maakt "Verstuur" beschikbaar; na versturen is de taak afgerond met uitkomst "verstuurd".
5. **Afronden en volgende** (Gevorderd): rondt af en opent de volgende taak uit dezelfde groep.
6. **Uitstellen.** "Uitstellen 1 werkdag" houdt het tijdstip en telt vanaf de oude vervaldatum als die in de toekomst ligt.
7. **Bulk** (Gevorderd): selecteer taken, kies "Uitstellen 1 week" of "Wijs toe aan"; toast met het aantal.
8. **Snel een prospect toevoegen.** "+ Prospect" op Vandaag opent de flyout "Nieuwe prospect" (F03).

### Filters en sorteren

- Taken: Periode, Eigenaar ("Van mij" standaard; teamleden voor de salesmanager), Prioriteit, Actiesoort (Bellen, Mailen, LinkedIn, Bezoek, Bericht, Te doen), Herkomst, Campagne, Reis en fase. Zoekterm en filters in de URL.
- Inzichten: Gelezen (standaard Ongelezen), Bronnen (Intern, Extern, per specifieke bron), Agent, Periode, Reis en fase.
- Sorteren: `ordenTaken` (achterstallig, vandaag, prioriteit, tijd), overal dezelfde volgorde.

### Regels

- Vandaag toont alleen eigen werk; maximaal 8 taken en 4 prioriteiten; achterstallige taken staan altijd bovenaan en nooit uit beeld.
- Statussen inzicht: nieuw, gelezen, omgezet, afgewezen. Bijwerken van een open inzicht door de motor zet hem niet terug op ongelezen.
- "Maak taak" erft titel (voorstel, anders "Volg op: {type} bij {account}"), prioriteit (voorstel, anders Hoog bij relevantie 80 of meer, anders Middel), actiesoort, broninzicht, regel.
- Statussen taak: open, bezig, klaar, geannuleerd. Annuleren met reden is de standaard; echt verwijderen alleen voor de beheerder.
- **Eén afrondfunctie** `rondTaakAf` voor alle paden (flyout, lijst, belmodus, campagnebord, offline sync): status klaar, uitkomst verplicht bij contacttaken, stuurvelden bijwerken (laatste actie, laatste call bij bellen, laatste bezoek bij bezoek), activiteit loggen, campagne-item bijwerken, `verwerkUitkomst`, journeygebeurtenis waar van toepassing.
- **Hercontactritme**: startset Koud (bellen dag 0, bellen dag 3, LinkedIn dag 7, bellen dag 12, mail dag 21; parkeren 180 dagen), Warm (bellen 0, mail 3, bellen 10; parkeren 90 dagen), Winback (bellen 0, mail 28; parkeren 365 dagen), Buitendienst koud (bezoek op regiodag, bellen dag 2, mail dag 7, bezoek volgende regiodag; parkeren 180 dagen).
- Uitkomst "Voicemail ingesproken" geeft een korte volgende stap: mail binnen 1 werkdag. "Niet geschikt" zet status nee met afkoelperiode 365 dagen voor alle kanalen. "Geen interesse" zet status nee met reden en de afkoelperiode per kanaal (bellen 90, mail 60, LinkedIn 90, WhatsApp 180, bezoek 180, kaart 365).
- Een account zit nooit in twee ritmes; idempotent per item en stap; een poging overslaan kan niet zonder uitkomst. De afkoelperiode wordt vóór elke poging gecontroleerd.
- Herhaalde en vervolgtaken erven de herkomst (inzicht, regel, actiesoort, uitvoerder).

### Helpartikelen

- "Vandaag" (Dagelijks werk): de blokken, wat er per niveau bij komt.
- "Een taak afronden met een uitkomst" (Dagelijks werk): de uitkomsten uit 7.3 en wat er daarna gebeurt.
- "Wat betekent poging 3 van 5" (Dagelijks werk) en "Hercontactritme" (Plannen en sturen).
- "Vandaag lezen en afronden" en "Waarom vijf pogingen werken" staan in het leerpad Beginner (F21); schrijf de inhoud hier, P09 zet ze in het leerpad.

## Deel 2: Technisch (hoe)

### Datamodel

- `tasks` (10.2): `owner_id`, `account_id`, `contact_id`, `signal_id`, `rule_id`, `campaign_id`, `belblok_id`, `action_type`, `title`, `status`, `priority`, `due_date`, `uitkomst`, `later_op`, `executor`, `executor_status`; `data.poging {n, van, kanaal, vorige}`, `data.herkomst {inzichtId?, regelId?, actiesoort, uitvoerder, bron: 'regel'|'inzicht'|'campagne'|'ritme'|'handmatig'}`, `data.herhaling?`, `data.herinnering?`, `data.annuleerReden?`.
- `signals` (10.2): `account_id`, `contact_id`, `rule_id`, `agent`, `type`, `relevance_score`, `confidence`, `status`; `data.agent`, `data.afwijsReden`, `data.bron {soort, naam, url?, datum}`, `data.evidence[]`.
- `hercontactritmes: id, organisation_id, naam, bron, status, versie, data { stappen [{volgnummer, dagOffset, kanaal, instructie?, scriptId?}], parkeerDagen }`; startset van vier ritmes via de organisatiestartset (P02).
- `accounts.data.reis.ritme {ritmeId, stap, volgendeOp, gepauzeerdTot, geparkeerdTot, geschiedenis[]}`.
- `activiteiten` (alleen toevoegen): elke afronding één rij met `uitvoerder`, `kanaal`, `soort`, `uitkomst`, `op`.
- Migratie: kolommen en indexen op `(organisation_id, owner_id, status, due_date)` voor tasks en `(organisation_id, status, relevance_score)` voor signals; RLS `org_isolation`.
- Rechtenmatrix (3.3): taken en inzichten accountmanager lezen alles, schrijven alles, verwijderen eigen (vanaf sprint 5 server-side); salesmanager alles in team; beheerder alles. Echt verwijderen van een taak alleen beheerder (F06).
- Sync-allowlist: `tasks` (aanmaken, bijwerken, mutatie `taak.afronden`), `signals` (status, afwijsreden). Mutatie `belpoging.uitkomst` hergebruikt `rondTaakAf`. Elke mutatie draagt een `idempotentie_sleutel`; afronden is idempotent op `(itemId, stap)`.

### Pure functies

| Functie | Plek | Invoer en uitvoer | Randgevallen en tests |
|---|---|---|---|
| `rondTaakAf(taak, uitkomst, context, nu)` | `shared/taken.ts` (Niet vastgelegd in het bouwplan; voorstel voor de bestandsnaam) | taak en uitkomst naar `{taakPatch, accountPatch, activiteit, gebeurtenis?, vervolgtaak?}` | elke uitkomst uit 7.3; contacttaak zonder uitkomst geeft fout; tweede keer met dezelfde sleutel verandert niets; vervolgtaak erft herkomst |
| `verwerkUitkomst(stand, ritme, uitkomst, nu, laterOp?)` | `shared/hercontact.ts` | ritmestand naar nieuwe stand, volgende poging of parkeren | laatste stap; "later" met datum; voicemail binnen 1 werkdag; account al in ander ritme; idempotent per stap |
| `magBenaderen(account, kanaal, nu)` | `shared/nbStatus.ts` (P05) | boolean met reden | afkoeling precies op de grens; status nee per kanaal |
| `ordenTaken(taken, nu)` | `shared/taken.ts` | gesorteerde lijst | achterstallig altijd eerst; zonder datum; gelijke tijd |
| `horizon(taken, nu)` | `shared/taken.ts` | drie kolommen | achterstallig en ongedateerd bovenaan in Vandaag (gat 39) |
| `voorinvullingUitInzicht(inzicht)` | `shared/taken.ts` | taakvoorstel | zonder voorstel; relevantie precies 80 |
| `volgendWerkmoment(nu, feestdagen)` | `shared/datum.ts` | datum en tijd | vrijdag 17:30; feestdag; weekend |
| `kiesAanleidingVanDeDag(signals, gebruiker, nu)` | `shared/vandaag.ts` (voorstel) | één inzicht of null | relevantie 84 tegen 85; 48 uur grens; alleen eigen accounts |
| `samenvattingsregel(...)` | `shared/vandaag.ts` | tekst | nul taken; geen campagne |
| `uitstellen(taak, periode, nu)` | `shared/taken.ts` | nieuwe vervaldatum | oude datum in de toekomst; tijdstip blijft |

### Endpoints

| Methode en route | Recht | Invoer | Uitvoer | Fouten |
|---|---|---|---|---|
| `GET /api/vandaag` | iedere gebruiker | `?dag=` | alle blokken van Vandaag in één antwoord | onder 1,0 s warm op desktop |
| `POST /api/tasks/:id/afronden` | eigenaar of salesmanager van het team | `{uitkomst, laterOp?, reden?, idempotentieSleutel}` | taak, vervolgpoging, nieuwe status | 422 zonder uitkomst bij contacttaak; 409 bij versieconflict |
| `POST /api/signals/:id/omzetten` | iedere gebruiker | optionele patch | taak | 409 als al omgezet |
| `POST /api/signals/:id/afwijzen` | Gevorderd en hoger | `{reden}` | inzicht | 422 zonder reden |
| `POST /api/tasks/bulk` | Gevorderd en hoger | `{ids, actie}` | aantallen | 403 buiten scope |
| `POST /api/motor/reminders-sweep` | geplande functie, elke 5 minuten | | aantal herinneringen | 401 zonder geheim |
| `GET\|POST\|PUT /api/ritmes` | lezen Gevorderd; schrijven salesmanager | ritme | ritme | 422 bij stap zonder kanaal |
| `GET /api/ritmes/:id/rapport` | Gevorderd en hoger | periode | afspraken per poging, geparkeerd, gemiddeld | |
| `POST /api/sync/mutations` | iedere gebruiker | mutaties | resultaat per mutatie | per mutatie rechtencheck |

### AI-stappen

Geen nieuwe AI-stap. Het label "AI" en het conceptblok tonen wat P10 en P18 later klaarzetten; "Vraag AI" en "Andere toon" roepen in deze prompt de mock aan.

### Integraties

Geen.

### Functiecatalogus

Niet vastgelegd in het bouwplan; voorstel voor de sleutels (niveaus uit 4.3, alle in Starter):

| Sleutel | Niveau | Recht | Helpartikel |
|---|---|---|---|
| `vandaag.basis` | Beginner | iedereen | Vandaag |
| `vandaag.agentsGedaan`, `vandaag.week`, `vandaag.indeling` | Gevorderd | iedereen | Vandaag |
| `vandaag.eigenWeergaven` | Expert | iedereen | Vandaag |
| `vandaag.team` | Gevorderd | salesmanager | Vandaag |
| `taken.basis` | Beginner | iedereen | Een taak afronden met een uitkomst |
| `taken.horizon`, `taken.bulk`, `taken.herhaling`, `inzichten.afwijzen` | Gevorderd | iedereen | Een taak afronden met een uitkomst |
| `taken.sjablonen` | Expert | iedereen | Een taak afronden met een uitkomst |
| `ritme.lezen` | Gevorderd | iedereen | Hercontactritme |
| `ritme.beheer` | Gevorderd | salesmanager | Hercontactritme |

### Hergebruik uit DealDrive

- `index.vue`, `VandaagPanel.vue`, `BriefingCard.vue`, `ActivityFeed.vue`: opbouw van Vandaag; pas aan naar de blokken hierboven en het werkplekprofiel.
- `taken.vue`, `inzichten.vue`, `TaakFlyout.vue`, `NieuweTaakFlyout.vue`, `InzichtFlyout.vue`, `SignalCard.vue`: lijst, feed en flyouts; voeg het uitkomstraster, de pogingregel en de herkomstlabels toe. Flyouts worden de responsieve `RecordVenster.vue` (schuifvenster op de telefoon).
- `SwipeActions.vue`, `useLongPress.ts`, `useQuickCreateTask.ts`: vegen en snel aanmaken.
- `shared/datum.ts`: `volgendWerkmoment`, `vervalLabel`, met Nederlandse feestdagen (P01).
- DealDrive heeft geen hercontactritme-engine; `shared/hercontact.ts` is nieuw (Bijlage B, Controle).

### Buiten scope

- Vandaag op de telefoon, focuskaart, signalen en recap (P32).
- Belblok en belmodus (P10), bezoekdag en route (P14, P30), conceptinhoud en versturen (P18), Verzender en mails van agents (P16, P19).
- Tabbladen Jaarplanning en Terugkomregels (P12); ritme kiezen per campagne (P16).
- Groeipad en de kaart "Jouw niveau" op Vandaag (P09).

## Acceptatiecriteria

1. Met 30 open taken toont Vandaag er 8 en "nog 22 meer"; een achterstallige taak staat altijd bovenaan.
2. Een binnendienstprofiel toont het belblokvak, een buitendienstprofiel het bezoekdagvak (met de terugval uit dit document zolang P10 en P14 er niet zijn).
3. Bijlage A, gat 11: afronden via flyout, lijst, vegen, bulk en offline sync roept één functie `rondTaakAf` aan en geeft dezelfde stuurvelden, dezelfde activiteitenregel en dezelfde volgende poging (één test die alle paden vergelijkt).
4. Bijlage A, gat 12: een herhaalde taak en een vervolgtaak erven `data.herkomst` (inzicht, regel, actiesoort, uitvoerder).
5. Bijlage A, gat 39: achterstallige en ongedateerde taken staan in de horizonweergave bovenaan in "Vandaag", met rode rand bij achterstallig.
6. Bijlage A, gat 40: een motorrun die een open inzicht bijwerkt, laat de status gelezen staan.
7. Bijlage A, gat 16: uitkomsten, redenen voor nee, afkoelperiodes en de startset van ritmes staan elk één keer in `shared/`.
8. Een account met ritme Koud doorloopt vijf stappen met "geen reactie", wordt geparkeerd met terugkomdatum (180 dagen) en komt bij een nieuwe aanleiding terug als de afkoelperiode voorbij is (F13; sprint 5 "klaar als").
9. Een offline afgeronde poging telt bij synchronisatie precies één keer en verschijnt niet dubbel op Vandaag.
10. Een afgewezen inzicht telt in de rapportage per regel; afwijzen zonder reden geeft 422.
11. "Maak taak" geeft de taak het label "Uit inzicht", niet "AI".
12. Een Beginner krijgt motorvoorstellen als inzicht ter goedkeuring, behalve ritmepogingen in een lopend ritme.
13. `GET /api/vandaag` onder 1,0 s warm op desktop met de Voltvast-seed plus 600 fictieve accounts (13.4).
14. Telefoon (375, 390, 412 px): Acties zonder horizontale scroll; vegen links rondt af, vegen rechts stelt uit; de taakflyout opent als schuifvenster; alle knoppen en uitkomsttegels minimaal 44 px (8.7, 8.16); afronden werkt offline met zichtbare status en komt na herstel precies één keer aan.
15. De stapels en lijsten tonen standaard alleen het werk van de ingelogde gebruiker ("Van mij").
16. Per niveau getest: Beginner ziet Vandaag blok 1 tot en met 5, de lijstweergave en de minimale velden van Nieuwe taak, en geen horizon of bulk (vergrendeld met uitleg); Gevorderd ziet blok 6 tot en met 8, horizon, filters, bulk en `/inzichten`; Expert ziet daarnaast eigen weergaven en taaksjablonen.
17. Salesmanager ziet "Team vandaag" en in Acties de teamweergave alleen voor zijn eigen teams (server-side).

## Definition of Done

Hoofdstuk 19 geldt volledig. Specifiek voor deze prompt:

- Unit-tests voor `rondTaakAf`, `verwerkUitkomst`, `ordenTaken`, `horizon` met grenzen, lege invoer en idempotentie; wegwerp-Postgres voor synchronisatieconflicten en dubbele mutaties.
- Playwright desktop en telefoon voor `/`, `/acties`, `/inzichten` en het tabblad Hercontactritme, inclusief een offline afrondtest met `context.setOffline(true)`.
- Bijlage A, gat 11, 12, 16, 39 en 40 afgevinkt in het sprintverslag.
- Helpartikelen "Vandaag", "Een taak afronden met een uitkomst", "Wat betekent poging 3 van 5" en "Hercontactritme" in `content/help/`.
