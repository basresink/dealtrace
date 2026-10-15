# P17: Funnel van de prospectreis en overdracht

| Onderdeel | Waarde |
|---|---|
| Sprint | 9 |
| Features | F17 Funnel van de prospectreis (de funnel `/funnel` en de overdracht na de eerste afspraak) |
| Hangt af van | P01 (rechten, audit, functiecatalogus), P09 (`functies_per_niveau`, "Nog niet aangezet"), P27 (mobiele schil, schuifvenster), P03 (accounts, contacten, buying committee, eigen velden), P05 (reis, `reisgeschiedenis`, gebeurtenissen en melders, statusmachine, terugkomregels), P06 (motor, regels SR08, SR12, SR13 en "Afspraak niet overgedragen"), P07 (taken, `rondTaakAf`), P13 (agenda, meetingsoorten, "Rond af", `meetingUitkomst`), P16 (campagnes als filter), P28 (leesmodel: branches, concurrenten, winpunten, redenen) |
| Bron in het bouwplan | 0.2 (B17, B21), 7.1 tot en met 7.3, F05 (standaardreis, overgangen, gebeurtenissen en melders), F09 (uitkomsten van de eerste afspraak, "Rond af"), F11 (briefing "Overdracht"), F15 (SR08, SR12, SR13, "Afspraak niet overgedragen"), F17 volledig, F25 (Verloren aan, terugkomregels), 3.3 (rij Afspraken en overdrachten), 4.3 (rij F17), 6.1, 10.2, 12 (rijen CRM en DealDrive), 13.4, 19, 21 (risico overdracht blijft liggen), 22 (open vraag 27), ADR-021, `docs/api/dealdrive-koppeling.md`, Bijlage A (gat 1 en 27) |

## Lees eerst

- `Bouwplan-Dealtrace.md`: 0.2 (B17, B21), 2.1, 3.3, 4.3 (rij F17), 6.1, 7.1 tot en met 7.3, 8.4 (Meer), 8.5.3 (volgende stap en overdracht bij bezoek afronden), F03 ("Overdragen"), F05 (standaardreis, overgangen, gebeurtenissencatalogus, melders), F09, F11 (soort Overdracht), F15 (starterset), F17 volledig, F25 (redenen, Verloren aan, terugkomregels), 10.2, 12, 13.4, 19, 21, 22, ADR-013, ADR-021, Bijlage A.
- `docs/api/dealdrive-koppeling.md` volledig en `docs/api/dealdrive-koppeling.openapi.yaml`: het contract voor de overdracht, foutcodes, ondertekening en idempotentie.
- `seed/dealdrive-mock/README.md` en de fixtures in `seed/dealdrive-mock/`.
- DealDrive op commit 75bee61 (alleen lezen): de trechter uit de analysepagina's als vorm. `pipeline.vue`, `DealFlyout.vue` en `offertes.vue` neem je **niet** over (F17).

## Deel 1: Functioneel (wat en waarom)

### Wat je bouwt

Je bouwt de funnel van de prospectreis op `/funnel` (hoeveel accounts per fase, conversie, doorlooptijd, uitval met reden, tot en met de overdracht) en de overdracht na een gehouden eerste afspraak naar DealDrive, het CRM of een collega, met status `overgedragen`, de tabel `overdrachten` en de adapter `server/utils/dealdriveAdapter.ts` met de uitvoering `mock`.

### Waarom

Dealtrace stopt bij de eerste afspraak (B17, ADR-021). Deals, offertes en de klantrelatie horen in DealDrive of het CRM; twee plekken voor dezelfde deal geven dubbel werk en verschillende cijfers. De vraag van de accountmanager en de salesmanager is daarom niet "wat zit er in de pipeline?" maar "waar lekt mijn new business weg?". De funnel beantwoordt die vraag uit de reisgeschiedenis, zonder dat iemand iets apart invult. De overdracht zorgt dat een gehouden eerste afspraak met vervolg niet blijft liggen (risico in 21) en dat het ontvangende systeem alles krijgt wat er al bekend is. In DealDrive maakte een gewonnen deal de prospect geen klant (Bijlage A, gat 1) en kon je vanuit Info promoveren zonder bevestiging of melding (gat 27); in Dealtrace bestaan deals en promoveren niet, en overdragen gaat altijd met bevestiging en audit.

### Gebruikers en niveaus

| Rol | Niveau | Wat |
|---|---|---|
| Accountmanager | Beginner | Eigen funnel: aantallen per fase, de fase waar het meest stokt, doorklikken naar de accounts; na "Rond af" van een eerste afspraak met vervolg overdragen |
| Accountmanager | Gevorderd | Plus: funnel per doelgroep, reis en campagne; conversie en doorlooptijd per fase; uitval met reden; pogingen tot afspraak |
| Accountmanager | Expert | Plus: reizen en reisversies naast elkaar, eigen weergaven, "Download CSV" |
| Salesmanager | rol | Funnel per team en per persoon naast elkaar, vergelijking met de vorige periode, teamschakelaar, "Download CSV"; overdrachten van zijn teams zien |
| Beheerder | rol | Normen per fase in Instellingen; stand van de DealDrive-koppeling lezen |
| Founder | rol | Zet de DealDrive-koppeling per organisatie op `uit`, `mock` of `http` (de uitvoering `http` komt in P23) |

De startindeling volgt 4.3. Het zijbalkitem "Funnel" verschijnt zodra een funnelfunctie voor de gebruiker aanstaat (zie P09 over de afwijking tussen 4.3 en 6.1). Overdragen is geen aparte functie per niveau: wie een eerste afspraak afrondt, kan overdragen.

### Schermen

**Funnel** (`/funnel`, zijbalk Werk; op de telefoon onder "Meer"), van boven naar beneden:

1. **Kop**: kicker "FUNNEL · DEZE MAAND", titel als zin ("Van 214 prospects kwamen er 11 tot een eerste afspraak."), daaronder de regel "Hier stokt het: van Benaderd naar In gesprek 18 procent, norm 30 procent." (klikbaar). Keuzes: Periode (deze maand, kwartaal, verkoopjaar, eigen periode), Doelgroep, Reis, Campagne, Persoon of team (salesmanager), Kanaal. Knoppen "Weergave" en "Download CSV" (Expert en salesmanager).
2. **De funnel**, horizontaal op de laptop, gegroepeerd in de hoofdfases Vinden, Bewerken en Verbinden, met per fase een balk:

   | Fase | Wat de balk toont |
   |---|---|
   | Gevonden | aantal accounts dat in de periode binnenkwam |
   | Dossier compleet | aantal en conversie vanaf Gevonden |
   | Gekwalificeerd | aantal en conversie |
   | Benaderd | aantal, gemiddeld aantal pogingen |
   | In gesprek | aantal, aandeel beslisser bereikt |
   | Afspraak gepland | aantal eerste afspraken |
   | Afspraak gehouden | aantal, aandeel no-show |
   | Overgedragen | aantal overgedragen aan DealDrive, het CRM of een collega |

   Per fase: aantal, conversie naar de volgende fase in procent, gemiddelde doorlooptijd in dagen, en een oranje markering bij de fase met de laagste conversie ten opzichte van de norm.
3. **Uitval** (Gevorderd): naast elke fase het aantal accounts dat daar naar nee, geparkeerd of afgekoeld ging, met de top drie redenen ("Tevreden met huidige leverancier 14 · Geen budget 6 · Verkeerd moment 5"). Bij een gekoppeld verkoopverhaal ook "Verloren aan" per concurrent (F25).
4. **Pogingen tot afspraak** (Gevorderd): bij welke poging de eerste afspraak ontstaat (1, 2, 3, 4, 5 of later), als staafjes.
5. **Lijst**: een klik op een fase of uitvalreden opent de accounts die daar staan, met fase sinds, laatste poging en volgende stap; per rij "Maak taak" en "Open account".

Bij Expert met twee gekozen reizen of versies staan twee funnels naast elkaar, vergeleken op hoofdfase (ADR-013). Lege staat: Niet vastgelegd in het bouwplan; voorstel: "Nog geen accounts in deze periode. Kies een langere periode of haal leads binnen via de Leadgenerator." Te weinig voor een vergelijking: "Te weinig accounts om te vergelijken" (minder dan 20 per reis of versie, F17).

**Overdragen na "Rond af"** (venster vanuit de afspraakflyout van F09, ook vanuit "Bezoek afronden" op de telefoon, 8.5.3):

1. Je rondt een eerste afspraak af met de uitkomst `vervolg` ("Vervolg afgesproken"). In hetzelfde venster verschijnt het blok **"Overdragen?"** met drie keuzes: "DealDrive", "Het CRM", "Een collega". Een keuze die niet kan, staat er met de reden ("DealDrive is nog niet gekoppeld. Je krijgt een overdrachtstaak met de briefing.").
2. Velden: Naar (verplicht), Nieuwe eigenaar (bij collega: keuze uit de gebruikers van de organisatie; bij DealDrive of CRM: e-mailadres van de ontvanger, voorgevuld met de vaste ontvanger uit Instellingen als die er is), Vervolgstap (omschrijving verplicht, datum, soort), voorgevuld uit "Rond af".
3. Een voorbeeld van wat er meegaat: account, contacten en buying committee, dossier, reisgeschiedenis in vijf regels, verslag van de eerste afspraak, vervolgstap en de briefing "Overdracht" (F11), met "Bekijk briefing".
4. Knoppen: "Draag over" (geel), "Later" (maakt de taak "Overdracht afronden" voor jezelf, binnen 1 werkdag), "Annuleren".
5. **Bevestiging** (14: vraag als titel, record en gevolg in de tekst, werkwoord op de knop): titel "Testinstallatie Vonkenburg overdragen?", tekst "Het account gaat naar DealDrive en verdwijnt uit je actieve reis. De deal ontstaat in DealDrive.", knop "Draag over". Niet vastgelegd in het bouwplan als volledige tekst; voorstel.
6. Toast: "Testinstallatie Vonkenburg is overgedragen aan DealDrive." Zonder koppeling: "Testinstallatie Vonkenburg is overgedragen. De overdrachtstaak met briefing staat klaar." (voorstel).

**DealDrive meldt "al klant"** (409 `al_klant`): venster "Dit bedrijf is al klant in DealDrive. Overdragen als nieuwe kans bij een bestaande klant?" met "Ja, draag over" en "Nee"; bij "Ja" gaat hetzelfde verzoek opnieuw met `alsNieuweKansBijKlant: true` (contract, hoofdstuk 3).

**Accountkaart** (F03, ook op 390 px): bij status `overgedragen` een regel in de statstrook "Overgedragen aan DealDrive op 15 oktober 2026 door Anouk Noorderveld" met de link naar DealDrive als die bekend is, en de stand ("verstuurd", "bevestigd", "mislukt"). Niet vastgelegd in het bouwplan waar precies; voorstel: in de statstrook bovenaan. De knop "Overdragen" op de kaart (F03) opent hetzelfde venster en is er alleen bij een gehouden eerste afspraak met vervolg.

**Telefoon (390 px).** `/funnel` staat onder "Meer". De funnel is verticaal: één fase per rij met aantal, conversie en doorlooptijd, de oranje fase bovenaan in de kop; een tik op een rij opent de lijst als schuifvenster. Vergelijken van reizen staat bewust niet op de telefoon: "Beter op een groot scherm". Overdragen werkt volledig op de telefoon in "Bezoek afronden" (8.5.3), met de keuzes als tegels van minimaal 56 px en "Draag over" in de plakkende knoppenrij. Offline gaat een overdracht in de wachtrij met "Bewaard op je telefoon, wordt verstuurd zodra je verbinding hebt"; het versturen naar DealDrive gebeurt pas op de server.

### Klikpaden

1. **Zien waar het stokt.** Open Funnel; de oranje fase staat in de kop; klik erop; de lijst toont de accounts die daar staan; "Maak taak" bij een account opent Nieuwe taak met het account ingevuld.
2. **Een campagne beoordelen** (Gevorderd). Kies de campagne; de funnel toont alleen de accounts uit die campagne, met afspraken en uitval.
3. **Reizen vergelijken** (Expert). Kies twee reizen of twee versies; de funnels staan naast elkaar op hoofdfase; met minder dan 20 accounts per reis de melding.
4. **Overdragen aan DealDrive.** Open de afspraak, "Rond af", kies "Vervolg afgesproken", vul het verslag in; in "Overdragen?" kies DealDrive, controleer de vervolgstap, "Draag over", bevestig. In één transactie: overdracht `klaar`, gebeurtenissen `eerste-afspraak-gehouden` en `overgedragen`, status `overgedragen`, fase "Overgedragen", activiteit en audit. Daarna stuurt een job het pakket via de adapter; het externe id komt op de overdracht en de accountkaart.
5. **Overdragen aan een collega.** Kies "Een collega" en Joost Stuurman; het account krijgt hem als eigenaar, hij krijgt een taak met de vervolgstap en de briefing; status `overgedragen`.
6. **Overdragen zonder koppeling.** Kies "Het CRM" terwijl er geen CRM-koppeling is; je krijgt de taak "Overdracht naar het CRM" met de briefing om te mailen ("Mail briefing") of te downloaden ("Download briefing"); status `overgedragen`.
7. **Geen vervolg.** "Rond af" met "Geen vervolg" vraagt een reden voor nee; gebeurtenissen `eerste-afspraak-gehouden` en `geen-vervolg`; status nee met afkoelperiode en terugkomregel (7.2, 7.3).
8. **No-show.** De afspraak krijgt status "niet verschenen"; gebeurtenis `afspraak-niet-verschenen`; fase terug naar In gesprek, status `in reis`; regel SR13 maakt "No-show opnieuw inplannen".
9. **Later overdragen.** "Later" maakt de taak "Overdracht afronden"; na 1 werkdag zonder overdracht vuurt de regel "Afspraak niet overgedragen" (F15).

### Filters en sorteren

- `/funnel?periode=&doelgroep=&reis=&versie=&campagne=&gebruiker=&team=&kanaal=` in de URL; standaard periode deze maand, scope "mijn".
- Lijst onder een fase: sortering op "fase sinds" (oudste eerst), daarna naam.
- "Download CSV" exporteert precies wat er op het scherm staat, met de filters in de bestandsnaam (Niet vastgelegd in het bouwplan; voorstel).

### Regels

- De funnel leest alleen `reisgeschiedenis` en `activiteiten`; er is niets apart in te vullen.
- Een account telt in elke fase die het in de periode bereikte; een account dat een fase overslaat, telt in de overgeslagen fase niet mee.
- Per fase klopt: binnengekomen = doorgestroomd + uitgevallen + nog aanwezig.
- Uitval is nee, geparkeerd of afgekoeld, met de vaste redenen uit 7.2; "Verloren aan" alleen als een concurrent bekend is.
- **Normen** per fase (conversie en doorlooptijd) staan in Instellingen met een standaard per reis. Het bouwplan noemt alleen het voorbeeld 30 procent voor Benaderd naar In gesprek; Niet vastgelegd in het bouwplan; voorstel voor de standaard conversienormen: Gevonden naar Dossier compleet 80, Dossier compleet naar Gekwalificeerd 60, Gekwalificeerd naar Benaderd 90, Benaderd naar In gesprek 30, In gesprek naar Afspraak gepland 35, Afspraak gepland naar Afspraak gehouden 85, Afspraak gehouden naar Overgedragen 60 procent; doorlooptijdnormen gelijk aan het verwachte verblijf uit de standaardreis (F05: 5, 5, 10, 21, 21 dagen, tot de afspraak, 2 dagen).
- Standaardscope is "mijn"; de salesmanager heeft een teamschakelaar en ziet alleen zijn teams (server-side).
- **Overdracht**: alleen na een gehouden eerste afspraak met een uitkomst met vervolg; altijd met bevestiging, wie en wanneer gelogd en de gebeurtenis `overgedragen` (F03). Dealtrace maakt nooit een klant van een prospect; er is geen status `klant` en geen promoveren (B17, gat 27).
- Status, fase, overdracht, gebeurtenis en audit gaan in één transactie (gat 1). Het versturen naar DealDrive of het CRM is een aparte stap daarna, zodat een storing bij de ontvanger de overdracht in Dealtrace niet terugdraait.
- Mislukt het versturen, dan probeert de job opnieuw na 1, 5 en 30 minuten, 2 en 12 uur (contract, hoofdstuk 2); daarna status `mislukt`, een melding bij de beheerder en een taak voor de eigenaar "Overdracht naar DealDrive mislukt" met de reden in gewone taal en "Opnieuw proberen".
- Een tweede overdracht van hetzelfde account terwijl er één loopt, geeft een melding en geen tweede verzoek; de idempotentiesleutel is het `overdrachtId`.
- De deal en een eventuele offerte maakt het ontvangende systeem; Dealtrace stuurt alleen een `dealVoorstel` (titel en fase) mee (contract, hoofdstuk 3).
- Alleen zakelijke gegevens gaan mee; privémail en privémobiel nooit (contract, hoofdstuk 2; 15.2).
- Komt een account later terug uit DealDrive of het CRM (verloren deal, slapende klant), dan gebeurt dat via de terugkomregels (F25); de ontvangst van die terugmeldingen bouw je in P23.

### Helpartikelen

- "De funnel van je prospectreis" (Hoe werkt Dealtrace, Plannen en sturen): de fases, conversie, doorlooptijd, de oranje markering, uitval.
- "Een afspraak plannen, afronden en overdragen" (Aan de slag): de uitkomsten van de eerste afspraak, "Overdragen?" en wat er meegaat. Dit artikel staat in "Aan de slag" (P09); schrijf hier de inhoud over overdragen.
- "Een goede overdracht" (New business, Van afspraak naar overdracht): waarom binnen 24 uur, wat de collega nodig heeft.
- "Koppelingen" (Inrichten): de stand van de DealDrive-koppeling en wat er gebeurt zonder koppeling.

## Deel 2: Technisch (hoe)

### Datamodel

- `overdrachten: id, organisation_id, account_id, naar ('dealdrive'|'crm'|'collega'), naar_gebruiker_id?, extern_id?, status ('klaar'|'verstuurd'|'bevestigd'|'mislukt'), pakket jsonb, op, door` (F17). Niet vastgelegd in het bouwplan; voorstel voor aanvullingen: `afspraak_id`, `pogingen int`, `laatste_fout text`, `volgende_poging_op`.
- `nb_funnel_stand` (afgeleid, F17): per dag, organisatie, reis, versie, doelgroep, campagne, gebruiker en fase: `binnengekomen`, `doorgestroomd`, `uitgevallen jsonb` (per reden), `doorlooptijd_som`, `doorlooptijd_aantal`. Nachtelijk opgebouwd uit `reisgeschiedenis` en `activiteiten` en bij opvragen bijgewerkt voor de lopende dag.
- `accounts.nb_status` krijgt de waarde `overgedragen`; er is geen waarde `klant` in de statusmachine (7.2). Een migratie zet bestaande seedaccounts met `account_kind = 'klant'` niet om; die blijven klant buiten de reis.
- `koppelingen` (10.2) met soort `dealdrive`: `stand ('uit'|'mock'|'http')`, basis-URL, `dealdriveOrganisatieId`, geheim (versleuteld). In deze prompt alleen `uit` en `mock`; `http` en het geheim in P23. `koppeling_runs` voor het logboek van elk verzoek (ids en hash, geen body).
- Normen: Niet vastgelegd in het bouwplan; voorstel: `reistemplates.data.normen {faseId: {conversie, doorlooptijd}}` met de standaard uit de regels hierboven.
- RLS `org_isolation` op `overdrachten`, `nb_funnel_stand`, `koppelingen`, `koppeling_runs`.
- Rechtenmatrix (3.3): Afspraken en overdrachten: accountmanager lezen alles, schrijven alles, verwijderen eigen; salesmanager alles in team; beheerder alles; founder alleen na instappen. De stand van de koppeling zet alleen de founder.
- Sync-allowlist: mutatie `afspraak.afronden` met `overdracht {naar, naarGebruikerId?, ontvanger?, vervolgstap}` als onderdeel, zodat offline afronden en overdragen samen in de wachtrij gaan; idempotent op de afspraak.

### Pure functies

Alle in `shared/funnel.ts` (F17):

| Functie | Invoer en uitvoer | Randgevallen en unit-tests |
|---|---|---|
| `funnelStand(geschiedenis, periode, filters)` | reisgeschiedenis naar stand per fase | account dat fases overslaat; account dat twee keer door een fase gaat (telt één keer per periode); lege periode |
| `conversie(van, naar)` | percentage | nul in de noemer geeft "n.v.t." |
| `doorlooptijd(geschiedenis, fase)` | gemiddelde in dagen | account nog in de fase telt niet mee; werkdagen of kalenderdagen (Niet vastgelegd in het bouwplan; voorstel: kalenderdagen, zoals het verwachte verblijf in F05) |
| `stokpunt(stand, normen)` | fase met de grootste achterstand op de norm | twee fases even ver; geen norm; alles boven de norm geeft geen markering |
| `pogingTotAfspraak(activiteiten)` | verdeling 1, 2, 3, 4, 5, later | afspraak zonder voorafgaande poging telt als 1 |
| `uitvalPerReden(geschiedenis, activiteiten)` | top drie per fase | reden "Anders" met toelichting |
| `overdrachtPakket(account, context)` | pakket volgens `docs/api/dealdrive-koppeling.md`, hoofdstuk 3 | geen contact geeft een fout (minstens één contact verplicht); privégegevens weggelaten; geen offertes of deals; deterministische volgorde voor de hash |
| `magOverdragen(account, afspraak)` | `{ja}` of `{nee, reden}` | geen eerste afspraak; afspraak niet gehouden; uitkomst zonder vervolg; overdracht loopt al |

`meetingUitkomst` (P13) roept bij `vervolg` de overdrachtsvraag aan en meldt `eerste-afspraak-gehouden`; bij `geen-vervolg` meldt hij `eerste-afspraak-gehouden` en `geen-vervolg`. Alle fasewijzigingen lopen via `POST /api/reis/gebeurtenis` of dezelfde serverfunctie (F05). De briefing "Overdracht" (F11) is berekende tekst: Niet vastgelegd in het bouwplan welke prompt hem bouwt; voorstel: P17 maakt `vulBriefing('overdracht', context)` zonder AI, P18 neemt hem op in de briefingschermen.

### Endpoints

| Methode en route | Recht | Invoer | Uitvoer | Fouten |
|---|---|---|---|---|
| `GET /api/funnel?periode=&reis=&doelgroep=&campagne=&gebruiker=&team=&kanaal=` | iedere gebruiker met `funnel.eigen`; team alleen salesmanager | | stand, stokpunt, uitval, pogingen | 403 met reden `niveau` voor filters boven het niveau |
| `GET /api/funnel/accounts?fase=&reden=` | idem | | accounts met fase sinds, laatste poging, volgende stap | |
| `GET /api/funnel/export` | Expert of salesmanager | dezelfde filters | CSV | 403 |
| `POST /api/accounts/:id/overdragen` | schrijfrecht op het account | `{naar, naarGebruikerId?, ontvanger?, vervolgstap, alsNieuweKansBijKlant?, idempotentieSleutel}` | overdracht | 409 als er al een overdracht loopt; 422 zonder gehouden eerste afspraak met vervolg of zonder vervolgstap |
| `POST /api/overdrachten/:id/opnieuw` | eigenaar, salesmanager van het team, beheerder | | overdracht | 409 als de status niet `mislukt` is |
| `GET /api/koppelingen/dealdrive/status` | beheerder | | stand en laatste overdracht | |

Job `overdracht-versturen` (motor of `pnpm motor` lokaal, 13.5): pakt overdrachten met status `klaar` of een verstreken `volgende_poging_op`, roept de adapter aan, zet `verstuurd` met `extern_id` bij 201 of 200, verwerkt 409 `al_klant` (status terug naar `klaar` met een taak voor de eigenaar met de vraag uit het contract), en zet na de laatste poging `mislukt`.

### Integraties

- **Adapter** `server/utils/dealdriveAdapter.ts` met de interface uit het contract (hoofdstuk 7): `DealDriveKoppeling { overdragen(pakket), zoekAccount(sleutels), status(overdrachtId), ping() }`. In deze prompt bouw je de interface en de uitvoering **`mock`**, die de fixtures uit `seed/dealdrive-mock/` teruggeeft (`overdracht-antwoord.json` bij succes, `fout-al-klant.json` bij 409). Niet vastgelegd in het bouwplan wanneer de mock 409 geeft; voorstel: als de KvK of de naam van het account overeenkomt met een account met `account_kind = 'klant'` in de Voltvast-seed. De uitvoering `http` (ondertekening, tijdvenster, opnieuw proberen over het netwerk) en de ontvangst van terugmeldingen (`overdracht.verwerkt`, `deal.gewonnen`, `deal.verloren`, `klant.slapend`) komen in P23 (sprint 11); ontdubbelen met `zoekAccount` bij import en leadgenerator ook.
- In de mock zet een geslaagde overdracht direct `bevestigd` alsof `overdracht.verwerkt` binnenkwam (Niet vastgelegd in het bouwplan; voorstel), zodat de hele stroom lokaal te testen is.
- Stand `uit` (standaard voor klanten zolang DealDrive de ontvangende kant niet heeft, open vraag 27): geen verzoek; Dealtrace maakt een overdrachtstaak plus de briefing om te mailen of te downloaden; status van de overdracht `klaar` en blijft zo.
- **CRM**: zonder CRM-koppeling (die komt in P20) altijd de overdrachtstaak met briefing. Niet vastgelegd in het bouwplan hoe P20 hierop aansluit; voorstel: P20 voegt een uitvoering toe aan dezelfde overdrachtsstap, met `naar = 'crm'`.
- **Contracttests**: de voorbeelden in `docs/api/dealdrive-koppeling.md` en de OpenAPI-specificatie zijn de fixtures. `overdrachtPakket` voor het fixture-account moet valideren tegen het schema van `POST /overdrachten`; de mock en later de echte adapter halen dezelfde tests.
- Geen netwerk in tests; lokaal draait de koppeling op `mock` (13.5).

### AI-stappen

Geen nieuwe AI-stap. De funnel en de overdracht werken volledig zonder AI en zonder credits; de briefing "Overdracht" is berekende tekst. Een AI-samenvatting van het verslag komt van de Notulist (P13, P19) en kost daar credits via `creditsVoor` (P33).

### Functiecatalogus

Niet vastgelegd in het bouwplan; voorstel (startindeling uit 4.3, alle in Starter):

| Sleutel | Startniveau | Recht | Helpartikel |
|---|---|---|---|
| `funnel.eigen` | Beginner | iedereen | De funnel van je prospectreis |
| `funnel.filters` (doelgroep, reis, campagne, uitval, pogingen) | Gevorderd | iedereen | De funnel van je prospectreis |
| `funnel.vergelijken`, `funnel.export` | Expert | iedereen | De funnel van je prospectreis |
| `funnel.team` | Beginner | salesmanager | De funnel van je prospectreis |
| `overdracht.basis` | Beginner | schrijven afspraken | Een afspraak plannen, afronden en overdragen |

### Hergebruik uit DealDrive

- De trechter uit de analysepagina's van DealDrive als vorm van de horizontale funnel.
- **Niet** overnemen: `pipeline.vue`, `DealFlyout.vue`, `NieuweDealFlyout.vue`, `offertes.vue`, `useDealStages.ts`, `shared/offerteStatus.ts`, `shared/offerteOpvolging.ts`, `instellingen/pipelines.vue` (F17, ADR-021).

### Buiten scope

- Deals, offertes, pipeline, kanban, pipelinewaarde, kans op winst, forecast van omzet (F17, B17).
- De uitvoering `http` van de adapter, de webhook-ontvanger voor terugmeldingen, ontdubbelen tegen DealDrive en het inrichten van het gedeelde geheim (P23).
- De ontvangende kant in DealDrive (aparte opdracht voor DealDrive, open vraag 27).
- Overdracht via de CRM-adapter (P20).
- Teamanalyse en coaching op funnelcijfers (P21).

## Acceptatiecriteria

1. Een account dat van Gevonden naar Afspraak gepland gaat, telt in elke tussenliggende fase die het bereikte en niet in een fase die het oversloeg.
2. Per fase klopt de som: binnengekomen = doorgestroomd + uitgevallen + nog aanwezig (unit-test en wegwerp-Postgres op `nb_funnel_stand`).
3. Het stokpunt is de fase met de grootste achterstand op de norm en staat oranje gemarkeerd en in de kop; met alle fases boven de norm is er geen markering.
4. Bijlage A, gat 1: na "Draag over" zijn in één transactie de overdracht (`klaar`), de gebeurtenissen `eerste-afspraak-gehouden` en `overgedragen`, status `overgedragen`, fase "Overgedragen", de activiteit en de audit geschreven; een fout halverwege laat niets achter (wegwerp-Postgres).
5. Bijlage A, gat 27: Dealtrace heeft geen promoveren en geen status `klant` in de statusmachine; overdragen kan alleen via het venster met bevestiging en staat in de audit met wie en wanneer.
6. Met de koppeling op `mock` geeft de overdracht van Testinstallatie Vonkenburg (pr-02) een extern id uit `overdracht-antwoord.json`, zet de overdracht op `verstuurd` en daarna `bevestigd`, en toont de accountkaart de regel met de link.
7. De mock geeft 409 `al_klant` voor een prospect met dezelfde KvK of naam als een klant in de seed (testaccount in de fixture van de test); Dealtrace toont de vraag uit het contract en stuurt bij "Ja" `alsNieuweKansBijKlant: true`.
8. Met de koppeling op `uit` ontstaat een overdrachtstaak met de briefing (mailen en downloaden werken); er gaat geen verzoek de deur uit.
9. Een tweede "Draag over" voor hetzelfde account geeft 409; dezelfde idempotentiesleutel twee keer geeft één overdracht.
10. Een mislukte verzending draait status en fase niet terug, wordt opnieuw geprobeerd volgens het schema en eindigt na de laatste poging op `mislukt` met een taak "Overdracht naar DealDrive mislukt" en "Opnieuw proberen".
11. `overdrachtPakket` voor het fixture-account valideert tegen het schema van `POST /overdrachten` uit de OpenAPI-specificatie en bevat geen privégegevens, deals of offertes.
12. "Geen vervolg" meldt `eerste-afspraak-gehouden` en `geen-vervolg` en zet status nee met reden en afkoelperiode; "niet verschenen" meldt `afspraak-niet-verschenen` en zet de fase terug naar In gesprek.
13. Overdragen aan een collega maakt die collega eigenaar met een taak met vervolgstap en briefing.
14. `GET /api/funnel` voor een organisatie met 10.000 accounts en een kwartaal geschiedenis antwoordt binnen 1 seconde (13.4).
15. Er bestaat geen route, tabel of component voor deals, offertes, pipeline, kanban of forecast (codezoektocht en routelijst).
16. Telefoon (375, 390, 412 px): `/funnel` verticaal zonder horizontale scroll; de lijst opent als schuifvenster; overdragen in "Bezoek afronden" met tegels van minimaal 56 px; offline afronden met overdracht komt na herstel precies één keer aan.
17. Per niveau getest met de Voltvast-seed: Beginner (Bram Middelkamp) ziet zijn eigen funnel met aantallen en stokpunt en kan na een eerste afspraak overdragen, maar geen filters op doelgroep, reis of campagne (403 met reden `niveau`, in de weergave "Nog niet aangezet"); Gevorderd (Anouk Noorderveld) ziet daarnaast conversie, doorlooptijd, uitval met reden en pogingen tot afspraak; Expert ziet daarnaast reizen naast elkaar en "Download CSV"; de salesmanager (Joost Stuurman) ziet de teamfunnel alleen voor zijn eigen teams.

## Definition of Done

Hoofdstuk 19 geldt volledig. Specifiek voor deze prompt:

- Unit-tests voor alle functies in `shared/funnel.ts` met grenzen, lege invoer en idempotentie; contracttests van `overdrachtPakket` en de mock tegen `docs/api/dealdrive-koppeling.openapi.yaml`.
- Wegwerp-Postgres voor de transactie van de overdracht, RLS op `overdrachten` en `nb_funnel_stand`, en dubbele mutaties uit de offline wachtrij.
- Playwright desktop en telefoon voor `/funnel`, "Rond af" met "Overdragen?" en de accountkaart met een overgedragen account.
- Bijlage A, gat 1 en 27 afgevinkt in het sprintverslag.
- Helpartikelen "De funnel van je prospectreis", het deel over overdragen in "Een afspraak plannen, afronden en overdragen" en "Een goede overdracht" in `content/help/`.
- `docs/HOE-HET-WERKT.md` beschrijft de funnel, de overdrachtsstroom, de standen `uit` en `mock` van de koppeling en het opnieuw proberen.
