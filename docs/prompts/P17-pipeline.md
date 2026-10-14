# P17: Pipeline, deals, offertes, overdracht

| Onderdeel | Waarde |
|---|---|
| Sprint | 9 |
| Features | F17 Pipeline, deals en offertes |
| Hangt af van | P01 (rechten, audit, functiecatalogus), P27 (mobiele schil), P03 (accounts, contacten, eigen velden, BAND op het account), P05 (reis, meldpunt gebeurtenissen, statusmachine, terugkomregels), P06 (motor, offertematrix, regels SR09, SR10, SR12, SR13), P07 (taken), P12 (terugkomregels in de planning), P13 (meetingsoort-uitkomsten die deals maken), P28 (leesmodel: concurrenten, winpunten, `vv_redenmapping`) |
| Bron in het bouwplan | F17, F25 (pipeline, verloren aan, winpunt ingezet), 7.2, 7.3 (terugkomregel), F05 (gebeurtenissen), F09 (uitkomsten met dealgevolg), F16 (offertematrix), F15 (SR09, SR10, SR12, SR13), 12 (rijen CRM en DealDrive), 13.3, Bijlage A regels 1, 16, 17, Bijlage C.9 punt 5 |

## Lees eerst

- `Bouwplan-Dealtrace.md`: 3.3 (rij Afspraken, deals, offertes), 4.3 (rij F17), 6.1, 7.1 tot en met 7.3, 8.5.1 (stapel deals zonder vervolgstap), 8.12, 8.13 (deal zonder vervolg na 7 dagen), F05 (gebeurtenissen en melders), F09, F11 (Pitstop dealvoorbereiding, offertebriefing), F15, F16, F17 volledig, F25 (gebruik in deals, terugkomregels), 10.2, 12, 13.3, 15.1, 19, Bijlage A, Bijlage B (rij Pipeline), Bijlage C.6 tot en met C.9.
- DealDrive op commit 75bee61: `app/pages/pipeline.vue`, `app/pages/offertes.vue`, `app/components/DealFlyout.vue`, `app/components/NieuweDealFlyout.vue`, `app/components/FaseDealsFlyout.vue`, `app/composables/useDealStages.ts`, `app/composables/useDealStageChange.ts`, `app/composables/usePipelines.ts`, `app/composables/useDealDetail.ts`, `app/composables/useNieuweDeal.ts`, `app/composables/useOfferteOpvolging.ts`, `shared/offerteStatus.ts`, `shared/offerteOpvolging.ts`, `app/pages/instellingen/pipelines.vue`.

## Deel 1: Functioneel (wat en waarom)

### Wat je bouwt

Je bouwt de pipeline met deals en offertes, waarin een gewonnen deal in één transactie de prospect klant maakt en de overdracht klaarzet, een verloren deal een terugkomregel krijgt, en de offertestatus een eigen schrijfpad met historie heeft.

### Waarom

Fase 3 van het proces is Verbinden: van gesprek naar klant (7.1). In DealDrive maakte een gewonnen deal de prospect geen klant (Bijlage A regel 1), had de offertestatus geen schrijfpad en maakte een upload geen offerte (regel 17), en stonden offertestatussen vier keer gedefinieerd (regel 16). Een verloren deal moet een reden en een terugkomdatum krijgen, zodat nee een datapunt is (2.1).

### Gebruikers en niveaus

| Rol | Niveau | Wat |
|---|---|---|
| Accountmanager | Beginner | Deal zien op de kaart als hij er is |
| Accountmanager | Gevorderd | Deals en offertes maken, kanban, opvolging, BAND per deal, "Verloren aan", "Winpunt ingezet" |
| Accountmanager | Expert | Forecast, eigen pipeline-indeling |
| Salesmanager | rol | Deals van zijn teams (alles in team, 3.3) |
| Beheerder | rol | Dealfases, pipelines en offertematrix inrichten (F16, F22) |

### Schermen

**`/pipeline`** (Gevorderd; zijbalk Werk), weergave Kanban of Lijst, offertes als tabblad:

1. Kop: titel "9 kansen in beeld.", subtitel "Slepen naar Gewonnen maakt de prospect klant en start de overdracht." Knoppen "+ Deal" (geel), "Weergave" (Kanban, Lijst), "Filters", "Hulp".
2. Statkaarten: Aantal kansen, Pipelinewaarde, Gewogen waarde, Tot sluiting deze maand.
3. Kanban: Kwalificatie 25 procent, Behoefte 40, Voorstel 60, Onderhandeling 80, Gewonnen, Verloren. Kaart met account, waarde, kans, sluitdatum, BAND-pil, eigenaar.
4. Lege staat: Niet vastgelegd in het bouwplan; voorstel: "Nog geen kansen. Een deal ontstaat bij een offerteaanvraag of een inventarisatie met vervolg."

**Dealflyout** (op de telefoon een schuifvenster): waarde, kans, gewogen, sluitdatum, account, contactpersonen, BAND (gespiegeld met het account), offertes met "+ Offerte" (titel, bedrag, geldig tot, pdf uploaden), eigen velden, Pitstop "Dealvoorbereiding" (inhoud in P18), "Winpunt ingezet" en "gebeurd" (F25). Knoppen "Markeer gewonnen" (bevestiging "... wordt klant"), "Markeer verloren" met reden (Prijs, Timing, Concurrent, Geen budget, Geen besluit, Anders), "Heropen". Bij reden "Concurrent" de vraag "Verloren aan" (keuze uit de concurrenten van het leesmodel). Bij winnen en verliezen de redenen met winpunten eerst.

Bevestiging "Markeer gewonnen" volgens 14: vraag als titel, record en gevolg in de tekst, werkwoord op de knop. Niet vastgelegd als volledige tekst; voorstel: titel "Deal winnen?", tekst "Bakker Bouw wordt klant. De reis gaat naar fase Klant en de overdracht wordt klaargezet.", knop "Markeer gewonnen".

Na winnen: toast "Teeuwen Bouw is klant. De overdracht staat klaar." en de vraag "Mag dit een bewijs worden?" (wordt een klantcase-voorstel voor de kennisbank of SalesDNA).

**Tabblad Offertes**: tabel met status (Concept, Verstuurd, Gelezen, Besproken, Goedgekeurd, Verloren, Vervallen), urgentie ("VERLOPEN", "3 D RESTEREN", "NIET GELEZEN"), bedrag, geldig tot, opvolging volgens de offertematrix, statusknop. Lege staat (voorstel): "Nog geen offertes. Voeg een offerte toe vanuit een deal."

**Accountkaart** (F03, ook op 390 px): blok "Open taken en deals" toont de deal met fase en waarde (Beginner leest).

**Vandaag op de telefoon** (8.5.1, gebouwd in P32): stapel "deals zonder vervolgstap" met "Vervolgstap toevoegen"; deze prompt levert de functie `heeftVervolg` met de grens van 7 dagen stilte.

**Telefoon (390 px).** Pipeline staat onder "Meer" voor Gevorderd en Expert. De lijstweergave is de standaard op de telefoon (voorstel, niet vastgelegd). Offertes opbouwen staat bewust niet op de telefoon (8.12): "+ Offerte" met pdf-upload opent met "Beter op een groot scherm". Een offertestatus wijzigen en een deal als gewonnen of verloren markeren kan wel.

### Klikpaden

1. Deal winnen via de kanban (Gevorderd): kaart slepen naar Gewonnen (1), bevestiging "Markeer gewonnen" (2). In één transactie: account naar klant, status klant, fase "Klant", overdrachtstaak, audit; toast.
2. Deal verliezen: dealflyout, "Markeer verloren" (1), reden "Prijs" (2), "Bewaar" (3). De reden mapt via `vv_redenmapping` op de terugkomreden "Prijs te hoog"; de terugkomdatum wordt gezet en er komt een bezoektaak over 182 dagen op de eerstvolgende regiodag (Bijlage C.9 punt 5).
3. Offerte versturen: tabblad Offertes, statusknop (1), "Verstuurd" (2). Gebeurtenis `offerte-verstuurd`, fase "Offerte uit", opvolging volgens de offertematrix.
4. Offerte uploaden: dealflyout, "+ Offerte" (1), pdf kiezen, titel, bedrag, geldig tot, "Bewaar" (2). Er ontstaat een offerte met status Concept (regel 17).
5. Deal uit een meetinguitkomst: in "Rond af" bij Kennismaking `offerte-aanvraag` maakt een deal in fase Behoefte; bij Inventarisatie `offerte` gaat de deal naar Voorstel met taak "Offerte maken" (F09).

### Regels

- Een deal ontstaat bij een offerteaanvraag of een inventarisatie met vervolg; offertes hangen aan een deal; de offertematrix bepaalt de opvolging.
- Fasewissel zet de kans, de historie, en bij gewonnen of verloren de sluitdatum en de gebeurtenis (`deal-gewonnen`, `deal-verloren`, `onderhandeling-gestart`), ook via slepen.
- Deal gewonnen: in één transactie account naar klant, status klant, fase "Klant", overdrachtstaak, en (als ingericht) overdracht naar DealDrive of het CRM met account, contacten, deal, offertes, dossier, brief en reisgeschiedenis; antwoord met het externe id.
- Deal verloren: fase Verloren. F17 zegt: heropvolgtaak over 90 dagen met uitkomst "weer actief" (terug naar Gekwalificeerd) of "definitief weg" (Geparkeerd). F25 zegt: de reden mapt via `vv_redenmapping` op een terugkomreden en zet de terugkomdatum. Niet vastgelegd in het bouwplan hoe die twee samengaan; voorstel: bestaat er een mapping, dan bepaalt de terugkomregel datum, kanaal en rol; anders geldt de heropvolgtaak over 90 dagen (regel SR13). In beide gevallen is de afkoelperiode per kanaal de ondergrens (7.3).
- Offertestatus alleen vooruit; "Verstuurd" meldt `offerte-verstuurd` en start de opvolging; vervallen na geldig tot (dagelijkse sweep).
- Offertematrix (F16, standaard): 0 euro mail binnendienst 5 werkdagen, 10.000 euro bellen 3, 50.000 euro bezoek buitendienst 5, 100.000 euro salesmanager belt binnen 2; contracten altijd face-to-face.
- Een deal zonder vervolgstap na 7 dagen stilte verschijnt in de stapel op Vandaag (8.13).
- Regel SR10: open deal boven een bedrag, ouder dan N dagen, BAND 1 of minder geeft "Deal onvoldoende gekwalificeerd" (parameters uit de motor).
- Een gewonnen klant die later verloren gaat, komt terug als winbackkandidaat (7.2).

### Filters en sorteren

Filters: eigenaar ("Van mij" standaard), fase, sluitdatum (deze maand, dit kwartaal), BAND, waarde, eigen velden (F19); in de URL (`/pipeline?weergave=lijst&eigenaar=mij`). Sorteren in de lijst: sluitdatum, waarde, gewogen waarde, laatste wijziging (Expert, 4.5). Offertes: status, urgentie, geldig tot.

### Helpartikelen

- "Pipeline en offertes" (Plannen en sturen, F21).
- New business: "Van gesprek naar offerte", "Een offerte opvolgen", "Onderhandelen zonder korting", "De overdracht naar de klantrelatie".

## Deel 2: Technisch (hoe)

### Datamodel

- `deals`, `quotes` "als in hoofdstuk 10"; hoofdstuk 10.2 verwijst naar F17 en legt de kolommen niet vast. Niet vastgelegd in het bouwplan; voorstel:

```ts
deals: id, organisation_id, account_id, owner_id, pipeline_id, fase, kans, waarde_cent, sluitdatum, status
       ('open'|'gewonnen'|'verloren'), gesloten_op, data jsonb
  data: contactIds[], band {b, a, n, d}, historie[{van, naar, op, door}], verliesReden?, verlorenAan?,
        winpuntIngezet[], winpuntGebeurd[], overdracht {status, externId?, op?}, customFields, vvVersies?
quotes: id, organisation_id, deal_id, account_id, titel, bedrag_cent, geldig_tot, status, verstuurd_op?, data jsonb
  data: bestand {bijlageId?, pad}, statushistorie[{van, naar, op, door}], opvolging {kanaal, rol, termijnWerkdagen}
```

- Bedragen in centen (`formatteerCenten`, 8.14).
- `deals.data.verlorenAan`, `deals.data.winpuntIngezet[]` (F25, 10.2).
- `accounts.terug_op`, `accounts.terug_regel_id` worden gezet bij verlies (F25).
- Instellingen `dealStages`, `pipelines`, `offerteOpvolging` (F17, F16).
- Migratie: beide tabellen en de instellingen met standaardwaarden.
- RLS: `org_isolation`.
- Rechtenmatrix (3.3): accountmanager lezen alles, schrijven alles, verwijderen eigen; salesmanager alles in team; beheerder alles; founder alleen na instappen.
- Sync-allowlist: `deals` en `quotes` (F17). Offline: deal-fase en offertestatus wijzigen gaan via de wachtrij. Niet vastgelegd in het bouwplan of "Markeer gewonnen" offline mag; voorstel: nee, omdat het een transactie over account, reis en overdracht is; de knop toont offline "Kan alleen met verbinding".

### Pure functies

| Functie | Invoer | Uitvoer | Randgevallen en tests |
|---|---|---|---|
| `verplaatsDeal(deal, naarFase, nu, reden?)` | deal, fase | mutaties (kans, historie, sluitdatum, gebeurtenis) | naar Gewonnen vanuit Kwalificatie; dubbele wissel is idempotent |
| `gewogenWaarde(deals)` | deals | centen | lege lijst; kans 0 |
| `offerteUrgentie(offerte, nu)` | offerte | "VERLOPEN", "3 D RESTEREN", "NIET GELEZEN" of null | geldig tot vandaag; zonder datum |
| `volgendeOfferteStatus(huidig, nieuw)` (voorstel) | twee statussen | toegestaan of fout | alleen vooruit; Vervallen alleen door de sweep |
| `offerteProfiel(bedrag, matrix, soort)` (F16) | bedrag | kanaal, rol, termijn | grens precies 10.000 euro |
| `overdrachtPakket(account)` | account met contacten, deals, offertes, dossier, brief, reisgeschiedenis | pakket | account zonder contacten |
| `heeftVervolg(deal, taken, afspraken, nu)` (uit `dexDag.ts`) | | boolean | 7 dagen stilte |
| `terugkomNaVerlies(reden, mapping, regels, afkoeling, nu)` (voorstel, gebruikt `terugkomDatum` uit `shared/verkoopverhaal.ts`) | verliesreden | datum, kanaal, rol, aanpak | geen mapping: 90 dagen; datum binnen afkoeling schuift op |

Eén definitie van offertestatussen in `shared/offerteStatus.ts` (regel 16).

### Endpoints

| Methode en route | Recht | Invoer | Uitvoer | Fouten |
|---|---|---|---|---|
| `POST /api/sync/mutations` (`deals`, `quotes`) | afspraken en deals schrijven | record | versie | 409 conflict |
| `POST /api/deals/:id/gewonnen` | eigenaar, team, beheerder | geen | account, deal, overdracht-status | 409 al gewonnen; alles of niets in één transactie |
| `POST /api/deals/:id/verloren` (voorstel; F17 noemt alleen gewonnen) | idem | `{reden, verlorenAan?, toelichting?}` | deal, terugkomdatum | 400 reden ontbreekt; "Anders" zonder toelichting |
| `POST /api/quotes/:id/status` | idem | `{status}` | offerte met historie | 400 terug in de tijd |
| `POST /api/quotes` met upload (voorstel) | Gevorderd | pdf, titel, bedrag, geldig tot, dealId | offerte | 413 bestand te groot |
| `POST /api/integraties/overdracht/:accountId` | eigenaar, beheerder | geen | `{externId}` | 502 doelsysteem; overdracht blijft "klaar" en wordt opnieuw geprobeerd |
| `POST /api/motor/offertes-sweep` | systeem (dagelijks) | geen | vervallen offertes en opvolgtaken | |

### AI-stappen

Geen nieuwe AI in deze prompt. De Pitstop "Dealvoorbereiding" en de offertebriefing komen in P18; "Mag dit een bewijs worden?" maakt een voorstel zonder AI (voorstel: een taak voor de salesmanager met de deal als bron).

### Integraties

- Overdracht via een adapter `server/utils/overdracht.ts` (naam voorstel) met één interface `draagOver(pakket): {externId}` en een mock. De echte doelen: DealDrive (HMAC met gedeeld geheim per organisatie, sprint 11, P23) en het CRM (P20). In deze prompt: alleen de mock en de knop; zonder ingericht doel blijft de overdrachtstaak een taak voor de mens.
- Bestandsopslag van de pdf in Supabase Storage EU (zoals `bijlagen`, P30) met RLS.

### Functiecatalogus

Sleutels niet vastgelegd in het bouwplan; voorstel:

| Sleutel | Niveau | Pakket | Recht | Helpartikel |
|---|---|---|---|---|
| `pipeline.lezen` (deal op de kaart) | Beginner | Starter | deals lezen | "Pipeline en offertes" |
| `pipeline.deals` (maken, kanban, opvolging, BAND) | Gevorderd | Starter | deals schrijven | idem |
| `pipeline.offertes` | Gevorderd | Starter | deals schrijven | idem |
| `pipeline.forecast`, `pipeline.eigenIndeling` | Expert | Plus (voorstel) | deals lezen | idem |
| `pipeline.overdracht` | Gevorderd | Plus (voorstel) | deals schrijven; doel ingericht door beheerder of founder | "De overdracht naar de klantrelatie" |

### Hergebruik uit DealDrive

- `pipeline.vue`, `DealFlyout.vue`, `NieuweDealFlyout.vue`, `offertes.vue`, `useDealStages.ts`, `useDealStageChange.ts`, `usePipelines.ts`: aanpassen met overdracht, reden en terugkomregel.
- `shared/offerteStatus.ts`: de enige definitie van statussen en labels.
- `shared/offerteOpvolging.ts`, `useOfferteOpvolging.ts`: offertematrix.
- `shared/dexDag.ts` (`heeftVervolg`): deals zonder vervolgstap.

### Buiten scope

- Echte overdracht naar DealDrive (P23) en schrijven naar het CRM (P20).
- Pitstop "Dealvoorbereiding", offertebriefing met gewogen bezwaren (P18).
- Winpunt- en concurrentresultaten in Analyse (P21).

## Acceptatiecriteria

1. Bijlage A regel 1: `deal-gewonnen` zet in één transactie type, status, fase, klasse-rij en audit; faalt één stap, dan verandert niets.
2. Bijlage A regel 17: er is een statusendpoint met historie en een upload maakt een offerte.
3. Bijlage A regel 16: offertestatussen en labels staan één keer in `shared/offerteStatus.ts`.
4. Een gewonnen deal maakt een klant (hoofdstuk 17, sprint 9); de toast "... is klant. De overdracht staat klaar." verschijnt; de overdracht met de mock geeft een extern id.
5. "Markeer verloren" met reden "Prijs" geeft bij Voltvast de terugkomreden "Prijs te hoog" en een bezoektaak over 182 dagen op de eerstvolgende regiodag (Bijlage C.9 punt 5).
6. Reden "Concurrent" vraagt "Verloren aan" en bewaart de concurrent-id.
7. Offertestatus kan niet terug; "Verstuurd" meldt `offerte-verstuurd`, zet de fase op "Offerte uit" en maakt de opvolgtaak volgens de offertematrix; een offerte voorbij geldig tot gaat naar Vervallen door de sweep.
8. Slepen op de kanban meldt dezelfde gebeurtenissen als de knoppen.
9. Een deal zonder vervolgstap na 7 dagen stilte staat in de stapel op Vandaag.
10. Telefoon (8.3, 8.12, 8.15, 8.16): op 375, 390 en 412 px opent een deal als schuifvenster met plakkende knoppenrij; de pipeline is als lijst te gebruiken zonder horizontale scroll; tikdoelen minimaal 44 px; "+ Offerte" met upload toont "Beter op een groot scherm".
11. Offline (8.8): een offertestatus wijzigen slaagt offline en komt één keer aan; "Markeer gewonnen" vraagt verbinding (voorstel).
12. Niveaus: als Beginner geen menu-item Pipeline, wel de deal op de kaart; als Gevorderd deals en offertes; als Expert forecast en eigen indeling. Getest per niveau.
13. Team en tenant: een salesmanager ziet alleen deals van zijn teams; deals van organisatie A zijn onzichtbaar voor B.

## Definition of Done

Hoofdstuk 19 geldt volledig. Specifiek voor deze prompt:

- Playwright-kernflow "afspraak naar klant" (19) groen.
- Wegwerp-Postgres-test op de transactie van "deal gewonnen" (alles of niets).
- Testdata: Voltvast (Bijlage C) met concurrenten cc-01 tot en met cc-05, terugkomregels hc-01 tot en met hc-06 en fictieve deals.
- Bijlage A regels 1 en 17 afgevinkt in het sprintverslag; helpartikel "Pipeline en offertes" en het handboek bijgewerkt.
