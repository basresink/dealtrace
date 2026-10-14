# P23: Suggesties naar SalesDNA en overdracht naar DealDrive

| Onderdeel | Waarde |
|---|---|
| Sprint | 11 (Sturen en maatwerk) |
| Features | F25 Verkoopverhaal en Richting: suggesties terug naar SalesDNA (kader 2); hoofdstuk 12: integraties SalesDNA (uitgaand) en DealDrive (overdracht van een gewonnen klant, klantstatus terug voor winback) |
| Hangt af van | P01 (rechten, audit), P17 (deal gewonnen in één transactie, `overdrachtPakket`, verlorenredenen, "Mag dit een bewijs worden?"), P19 (Notulist herkent concurrenten en bezwaren), P21 (Team, Goedkeuringen; afgeleide tabellen `nb_*`; Coach), P28 (leesmodel `vv_*`, eigen aanvullingen, `vv_redenmapping`), P29 (SalesDNA-koppeling, webhook-ontvanger met HMAC, `salesdna_koppeling`), P12 (terugkomregels, slapende klanten) |
| Bron in het bouwplan | F25 ("Suggesties terug naar SalesDNA", "Per niveau", "Eigen aanvullingen", technisch deel "Uitgaand" en "Suggesties"); hoofdstuk 12 (rijen SalesDNA en DealDrive); F17 (Deal gewonnen, overdracht); F03 (Promoveren tot klant); F13 (terugkomregels, slapende klanten, "Stel wijziging voor"); F14 (Coach bundelt wekelijks); F20 ("de wekelijkse bundel suggesties naar SalesDNA vrijgeven"); 7.2 (klant, winback); 11.2 (namenfilter); 15.2 (AVG); ADR-002; open vragen 22 en 23; Bijlage C.9 punt 9 |

## Lees eerst

- Bouwplan-Dealtrace.md: F25 volledig (vooral de alinea "Suggesties terug naar SalesDNA", de tabel "Per niveau" en de technische punten Uitgaand, Suggesties en Webhook-ontvanger), hoofdstuk 12 (rijen SalesDNA en DealDrive, en de slotalinea), F17 (Regels: Deal gewonnen, "Mag dit een bewijs worden?"), F03 (Promoveren tot klant), F13 (Terugkomregels, rapport per ritme met "Stel wijziging voor"), F14 ("Uit het verkoopverhaal"), F20 ("Uit het verkoopverhaal"), 7.2, 11.2, 15.2 (rij Suggesties naar SalesDNA), 15.3 (webhooks met HMAC, tijdvenster en replay-bescherming), ADR-002, ADR-017, open vragen 22 en 23, Bijlage C.
- DealDrive op commit 75bee61: er is geen ontvangend endpoint voor een overdracht vanuit Dealtrace. Lees ter oriëntatie op het datamodel van de ontvanger:
  - `server/utils/appStore.ts` (accounts, contacten, deals in `data` jsonb)
  - `app/pages/pipeline.vue`, `app/composables/useDealStages.ts` (dealfases aan de DealDrive-kant)
  - `server/api/hooks/github/wens.post.ts` (voorbeeld van een gesigneerde inkomende hook)

## Deel 1: Functioneel (wat en waarom)

### Wat je bouwt

Twee uitgaande stromen: een wekelijkse bundel suggesties met bewijs van Dealtrace naar kader 2 van de juiste SalesDNA-sublaag, die de salesmanager vrijgeeft, en de overdracht van een gewonnen klant naar DealDrive met het externe id terug en de klantstatus terug voor winback.

### Waarom

Wat Dealtrace in de praktijk leert (een concurrent die vaak voorkomt maar ontbreekt, een bezwaarantwoord dat aantoonbaar werkt, een branche zonder eigen belofte) hoort terug te gaan naar de bron van het verkoopverhaal, zonder dat Dealtrace zelf in SalesDNA schrijft (ADR-002: alleen suggesties in kader 2). En Dealtrace is geen tweede CRM voor bestaande klanten (1.2): een gewonnen klant gaat over naar DealDrive, en als hij daar slapend of verloren raakt, komt hij in Dealtrace terug als winback-kandidaat (7.2).

### Gebruikers en niveaus

| Rol | Niveau | Wat |
|---|---|---|
| accountmanager | Beginner | Ziet na "Markeer gewonnen" de toast over de overdracht; geen suggesties |
| accountmanager | Gevorderd | Beantwoordt na een gewonnen deal "Mag dit een bewijs worden?" |
| accountmanager | Expert | Draagt voorstellen aan (nieuw bezwaar of antwoord, context per branche, winpunt per branche, nieuw bewijs, persoonlijke variant); elk voorstel gaat eerst naar de salesmanager |
| salesmanager | Gevorderd of Expert | Beoordeelt de wekelijkse bundel suggesties, past tekst aan, geeft vrij of wijst af; ziet de status uit SalesDNA |
| beheerder | Expert | Ziet de stand van de uitgaande suggesties en de overdrachtskoppeling in Instellingen, Koppelingen |
| founder | n.v.t. | Richt de DealDrive-koppeling in (hoofdstuk 12: "Wie richt in: founder"), per organisatie |

### Schermen

**1. Suggesties naar SalesDNA.** Het bouwplan legt vast dat de salesmanager de wekelijkse bundel vrijgeeft (F20, F25), niet waar. Niet vastgelegd; voorstel: in `/team` onder "Goedkeuringen" een regel "Suggesties naar SalesDNA · week 46 · 7 suggesties" die een flyout (640 px) opent.

Opbouw van de flyout van boven naar beneden (voorstel):

1. Kop: kicker "SUGGESTIES NAAR SALESDNA · WEEK 46", titel "7 suggesties wachten op je besluit.", meta "Hooguit 10 per sublaag per week. Zonder namen van personen of prospects."
2. Per sublaag een groep (Concurrenten, Winpunten, Waarde en belofte, Terugkomregels, Branches) met per suggestie: soort, tekst, bewijs (aantallen en geanonimiseerde citaten), het veld en de regel in SalesDNA waar hij hoort, en de knoppen "Geef vrij", "Pas aan", "Wijs af".
3. Voet: "Geef alles vrij" (geel), "Later".

Voorbeelden van suggesties uit F25: een concurrent die vaak in verslagen voorkomt maar ontbreekt; een antwoord op een bezwaar dat aantoonbaar werkt; "38 gesprekken in Utiliteitsinstallateurs dit kwartaal, nog geen eigen belofte"; opbrengst per terugkomregel; winpuntresultaten.

Statussen per suggestie (voorstel, de waarden van `salesdna_suggesties.status` zijn niet vastgelegd): "Concept", "Vrijgegeven", "Verstuurd", "Overgenomen in SalesDNA", "Afgewezen in SalesDNA", "Afgewezen", "Mislukt".

**2. Stand in Instellingen.** In Instellingen, Verkoop, Verkoopverhaal per onderdeel een regel "Suggesties: 3 verstuurd, 1 overgenomen" met link naar de lijst (voorstel). Lege staat: "Er zijn deze week geen suggesties. Dealtrace stelt pas iets voor als er genoeg bewijs is." (voorstel).

**3. Zonder SalesDNA-koppeling.** Niet vastgelegd in het bouwplan wat er dan met suggesties gebeurt; voorstel: dezelfde bundel verschijnt als voorstel voor de eigen inrichting (taak voor de beheerder met link naar het onderdeel), zonder verzenden.

**4. Overdracht naar DealDrive.**

- Pipeline en dealflyout (P17): "Markeer gewonnen" met bevestiging "… wordt klant"; daarna toast "Teeuwen Bouw is klant. De overdracht staat klaar." Op de accountkaart een regel in het blok Ritme of de statstrook: "Overgedragen aan DealDrive op 2026-11-04" met het externe id als link (plaats niet vastgelegd; voorstel).
- Lukt de overdracht niet, dan een taak voor de eigenaar "Overdracht naar DealDrive mislukt" met de reden in gewone taal en "Opnieuw proberen" (voorstel).
- Promoveren tot klant vanuit de accountkaart (F03): altijd met bevestiging, optioneel "Draag over aan DealDrive".
- Na een gewonnen deal de vraag "Mag dit een bewijs worden?" ("Ja", "Nee"); "Ja" maakt een klantcase-voorstel voor de kennisbank of als suggestie naar SalesDNA (F17).

**5. Koppeling DealDrive inrichten.** Niet vastgelegd waar; voorstel: in Platformbeheer, klantflyout (P24), blok "Koppelingen" met endpoint, gedeeld geheim (schrijf-alleen, vingerafdruk van acht tekens), "Test verbinding" en status; de beheerder ziet in Instellingen, Koppelingen alleen de stand ("Gekoppeld met DealDrive · laatste overdracht 2026-11-04").

**6. Telefoonweergave op 390 px.** De suggestieflyout opent als schuifvenster tot 92 procent van de schermhoogte met de knoppen plakkend onderaan; de salesmanager kan per suggestie "Geef vrij" of "Wijs af" met één tik (8.12: goedkeuringen van het team op de telefoon). De toast na "Markeer gewonnen" verschijnt als meldingsstrook boven de onderbalk. Het inrichten van de DealDrive-koppeling hoort bij Platformbeheer en toont "Beter op een groot scherm".

### Klikpaden

1. **Bundel maken.** De wekelijkse job (`netlify/functions/week`) leest de afgeleide tabellen en verslagen, maakt per sublaag hooguit 10 suggesties, haalt ze door het namenfilter en zet ze op "Concept". De salesmanager krijgt een melding (soort niet vastgelegd; voorstel: soort "Concept klaar ter goedkeuring").
2. **Vrijgeven.** De salesmanager opent de flyout, past een tekst aan, klikt "Geef vrij" bij vijf en "Wijs af" bij twee; daarna "Verstuur" of automatisch bij het sluiten (voorstel: versturen direct na "Geef alles vrij" of per suggestie na "Geef vrij").
3. **Versturen.** Dealtrace stuurt de vrijgegeven suggesties met HMAC naar SalesDNA; status "Verstuurd".
4. **Status terug.** SalesDNA stuurt `suggestie.status`; de webhook-ontvanger uit P29 zet "Overgenomen in SalesDNA" of "Afgewezen in SalesDNA". Wordt een sublaag daarna bevestigd, dan komt de nieuwe versie via `sublaag.bevestigd` binnen (P29).
5. **Overdracht.** Een accountmanager sleept een deal naar Gewonnen; in één transactie wordt het account klant, status klant, fase "Klant", een overdrachtstaak; daarna stuurt Dealtrace het overdrachtspakket naar DealDrive en bewaart het externe id.
6. **Winback.** DealDrive meldt dat de klant 6 maanden niet heeft besteld; Dealtrace maakt er een herwinaccount van met de terugkomregel "6 maanden niet besteld" (Voltvast hc-04) en de motor start op de terugkomdatum het hercontactritme.

### Regels

**Suggesties**

- Altijd met aantallen; citaten alleen na het namenfilter en geanonimiseerd; nooit namen van personen of prospects (F25, 11.2, 15.2).
- Hooguit 10 suggesties per sublaag per week (hoofdstuk 12, open vraag 23).
- Vrijgave door de salesmanager; SalesDNA verandert niets zonder besluit.
- Alleen naar kader 2 van de juiste sublaag; Dealtrace schrijft nooit elders in SalesDNA (ADR-002).
- Alles wat een Expert aandraagt, is eerst een voorstel aan de salesmanager (F25 "Per niveau").
- AI schrijft nooit een winpunt; een suggestie over winpunten is een resultaat met cijfers of een vraag, nooit een nieuwe winpunttekst (11.2).
- Drempels voor "aantoonbaar werkt" en "vaak voorkomt" zijn niet vastgelegd; voorstel: een bezwaarantwoord pas bij minimaal 30 gesprekken met dat bezwaar en een hogere afspraakconversie dan zonder het antwoord; een ontbrekende concurrent pas bij minimaal 5 verslagen in 90 dagen; een branche zonder belofte bij minimaal 20 gesprekken in het kwartaal.
- Bijlagen van winpunten: eerst alleen metadata (open vraag 22).

**Overdracht**

- Deal gewonnen zet in één transactie type, status, fase, klasse-rij en audit (Bijlage A regel 1, P17); de overdracht naar DealDrive volgt daarna als aparte stap, zodat een storing bij DealDrive de winst niet terugdraait (volgorde niet vastgelegd; voorstel).
- Pakket: account, contacten, deal, offertes, dossier, brief en reisgeschiedenis (F17); antwoord met het externe id.
- HMAC met gedeeld geheim per organisatie (hoofdstuk 12), tijdvenster en replay-bescherming (15.3); idempotent: een tweede overdracht van hetzelfde account maakt in DealDrive geen tweede klant.
- Klantstatus terug voor winback: een verloren klant komt terug als winback-kandidaat (7.2); slapend bij 3, 6 of 12 maanden niet besteld (F13).
- Privégegevens gaan niet mee; zakelijke contactgegevens wel, met herkomst per veld.

### Helpartikelen

- "Wanneer we iemand terugbellen" (F25, leerpad) aanvullen met winback uit DealDrive.
- "De overdracht naar de klantrelatie" (academie, categorie Afsluiten): wat er na "Markeer gewonnen" gebeurt en wat DealDrive ontvangt.
- "Verbetervoorstellen beoordelen" (voor de salesmanager) aanvullen met de suggesties naar SalesDNA.

## Deel 2: Technisch (hoe)

### Datamodel

- `salesdna_suggesties (id, organisation_id, onderwerp_id, veld, regel_extern_id, soort, tekst, bewijs, status, verstuurd_op)` (F25). Voorstel aanvullend: `week` (ISO-week, bijvoorbeeld `2026-W46`), `vrijgegeven_door`, `vrijgegeven_op`, `extern_status_op`, `fout`.
- Overdracht: niet vastgelegd; voorstel `overdrachten (id, organisation_id, account_id, deal_id, doel ('dealdrive'|'crm'), status ('wacht'|'verstuurd'|'bevestigd'|'mislukt'), extern_id, pakket_hash, pogingen, laatste_fout, op)` en `accounts.data.extern.dealdrive {id, overgedragenOp}`.
- Koppeling: `koppelingen.soort = 'dealdrive'` met `geheimen` (gedeeld geheim, AES-256-GCM) en `instellingen {endpoint}`. De soortlijst in F02 noemt `dealdrive` niet; toevoegen is een voorstel, het bouwplan noemt DealDrive wel bij Koppelingen in F22.
- RLS `org_isolation` op beide tabellen; uitgaande suggesties en overdrachten alleen via de server.
- Rechtenmatrix: suggesties lezen en vrijgeven salesmanager voor zijn teams en beheerder; overdracht starten iedereen met schrijfrecht op deals (via "Markeer gewonnen"); koppeling inrichten founder.
- Sync-allowlist: geen van beide tabellen in de sync.

### Pure functies

| Functie | Invoer | Uitvoer | Randgevallen en tests |
|---|---|---|---|
| `overdrachtPakket(account)` | account met contacten, deal, offertes, dossier, brief, reisgeschiedenis | pakket | vastgelegd in F17; geen offertes; privémobiel weggelaten; deterministische volgorde voor de hash |
| `bundelSuggesties(kandidaten, max)` | kandidaten per sublaag | hooguit 10 per sublaag, sterkste bewijs eerst | precies 10 en 11; lege sublaag |
| `filterNamen(tekst, namen)` | vrije tekst, namen van contacten en accounts | tekst zonder namen | vastgelegd als vangrail in 11.2; naam als deel van een woord; hoofdletters; Bijlage C.9 punt 9 |
| `kandidatenConcurrent(verslagen, concurrenten)` | verslagen, leesmodel | ontbrekende concurrenten met aantal | drempel; naam al bekend |
| `kandidatenBezwaar(bezwaren, conversies)` | `nb_bezwaren`, conversies | antwoorden die werken | minder dan 30 gesprekken |
| `kandidatenBrancheBelofte(brancheStand, leesmodel)` | `nb_branche_stand` | branches zonder eigen belofte | Voltvast br-02 heeft geen eigen blok in L0.4 (C.5) |
| `tekenVerzoek(body, geheim, tijd)` en `controleerHandtekening(...)` | ruwe body | HMAC-SHA256 | tijdverschil 5 minuten; zelfde event-id tweemaal |

Namen van `bundelSuggesties` en `kandidaten*` zijn niet vastgelegd; voorstel.

### Endpoints

| Methode en route | Recht | Invoer | Uitvoer | Fouten |
|---|---|---|---|---|
| `GET /api/salesdna/suggesties?week=` | salesmanager, beheerder | week | suggesties per sublaag | niet vastgelegd; voorstel |
| `PUT /api/salesdna/suggesties/:id` | salesmanager | `{tekst?, besluit}` met besluit `vrij` of `af` | suggestie | 422 als de tekst na aanpassen een naam bevat (namenfilter opnieuw) |
| `POST /api/salesdna/suggesties/verstuur` | salesmanager | `{ids}` | aantallen | 409 zonder koppeling; 429 boven 10 per sublaag per week |
| `POST {salesdna}/api/koppelingen/dealtrace/suggesties` | uitgaand, HMAC | bundel | ontvangstbevestiging | vastgelegd in F25 |
| `POST /api/koppelingen/salesdna/webhook` (P29) | SalesDNA, HMAC | `suggestie.status` | 2xx binnen 5 seconden | 401 bij ongeldige handtekening of te oud tijdstip |
| `POST /api/integraties/overdracht/:accountId` | schrijfrecht op het account; motor | geen | `{status, externId?}` | vastgelegd in F17; 409 bij lopende overdracht |
| `POST /api/integraties/dealdrive/status` | DealDrive, HMAC | `{externId, klantstatus, laatsteOrder?}` | 2xx | niet vastgelegd; voorstel voor "klantstatus terug" |
| Ontvanger in DealDrive | DealDrive | pakket | `{externId}` | niet vastgelegd; voorstel: `POST /api/koppelingen/dealtrace/overdracht` in DealDrive, buiten deze repository, als aparte opdracht voor DealDrive |

### AI-stappen

- Geen generatie van suggestieteksten nodig: kandidaten komen uit pure functies op de afgeleide tabellen. De Coach bundelt wekelijks (F14); niet vastgelegd of de Coach de teksten formuleert. Voorstel: de Coach (mandaat A voor voorstellen) formuleert per kandidaat één zin met schema `{tekst, onderbouwing {cijfers[], citaten[]}}`, daarna `filterNamen`; mock met fixtures uit Voltvast; bundelsoort "Coach en verbetervoorstel".
- Vangrails: namenfilter (11.2) vóór de aanroep en op de uitvoer; geen winpunttekst; citaten letterlijk uit verslagen na anonimiseren.

### Integraties

- **SalesDNA uitgaand**: adapter `server/utils/bronnen/salesdna.ts` (uit P29) krijgt `stuurSuggesties(bundel)`; HMAC-SHA256 met hetzelfde geheim als de koppeling; mock die "ontvangen" en daarna een `suggestie.status` teruggeeft.
- **DealDrive**: adapter `server/utils/bronnen/dealdrive.ts` met `draagOver(pakket)` en een mock die een vast extern id teruggeeft; HMAC met gedeeld geheim per organisatie; opnieuw proberen bij een fout (aantal en wachttijd niet vastgelegd; voorstel 3 pogingen na 1, 5 en 30 minuten), logging in `koppeling_runs`.
- Geen netwerk in tests.

### Functiecatalogus

Niet vastgelegd in het bouwplan welke sleutels; voorstel:

| Sleutel | Niveau | Pakket | Recht | Helpartikel |
|---|---|---|---|---|
| `salesdna.suggesties.vrijgeven` | Gevorderd | Plus | salesmanager | Verbetervoorstellen beoordelen |
| `verkoopverhaal.voorstellen` | Expert | Starter | accountmanager | Eén winpunt per gesprek |
| `deal.bewijsVoorstel` | Gevorderd | Starter | schrijven deals | De overdracht naar de klantrelatie |
| `overdracht.dealdrive` | Beginner | Starter | schrijven deals | De overdracht naar de klantrelatie |

### Hergebruik uit DealDrive

- `server/api/hooks/github/wens.post.ts`: patroon voor een gesigneerde inkomende hook (controle van de handtekening vóór verwerking).
- `appStore.ts`: vorm van accounts, contacten en deals aan de ontvangende kant, zodat het pakket zonder vertaling past.
- Voor de SalesDNA-kant is er geen DealDrive-code; de vorm komt uit F25 en de bijlage `bijlagen/SalesDNA-sublagen-voor-Dealtrace.docx`.

### Buiten scope

Schrijven in SalesDNA buiten suggesties; de tien weergaven, kaders, meekijkronde en Kwartaal check van SalesDNA; de overdracht naar een ander CRM dan via P20 en P17; het ontvangende endpoint in DealDrive zelf (aparte opdracht); bijlagen van winpunten als download (open vraag 22).

## Acceptatiecriteria

1. Een contactnaam uit aantekeningen komt niet in een suggestie of in een AI-aanroep (Bijlage C.9 punt 9); een aangepaste tekst met een naam geeft 422.
2. Per sublaag gaan er hooguit 10 suggesties per week uit; de elfde blijft op "Concept" voor de volgende week.
3. Zonder vrijgave van de salesmanager wordt niets verstuurd.
4. Een uitgaand verzoek draagt een geldige HMAC-SHA256 met event-id en tijd; een `suggestie.status` met ongeldige handtekening of een tijdverschil boven 5 minuten geeft 401 en verandert niets; een dubbel event verandert niets.
5. Voltvast: met 38 gesprekken in br-02 "Utiliteitsinstallateurs" in het kwartaal en geen eigen blok in L0.4 verschijnt de suggestie "38 gesprekken in Utiliteitsinstallateurs dit kwartaal, nog geen eigen belofte".
6. Deal gewonnen maakt in één transactie een klant (regel 1 uit P17 blijft groen); de overdracht naar DealDrive (mock) geeft een extern id dat op het account wordt bewaard; de toast "Teeuwen Bouw is klant. De overdracht staat klaar." verschijnt.
7. Een tweede overdracht van hetzelfde account maakt geen tweede klant in DealDrive (idempotent, test met de mock).
8. Een mislukte overdracht draait de winst niet terug, maakt een taak met de reden en is opnieuw te proberen.
9. Een klantstatus "6 maanden niet besteld" uit DealDrive maakt een herwinaccount met de terugkomregel hc-04 en een taak op de terugkomdatum.
10. Niveau Beginner: ziet geen suggesties en geen vraag "Mag dit een bewijs worden?"; de overdracht werkt na "Markeer gewonnen" als de deal er is.
11. Niveau Gevorderd: beantwoordt "Mag dit een bewijs worden?"; kan geen verhaalvoorstel indienen (slot met uitleg).
12. Niveau Expert: dient een nieuw bezwaarantwoord in; het verschijnt als voorstel bij de salesmanager, niet direct in de bundel naar SalesDNA.
13. Een salesmanager ziet alleen suggesties uit zijn teams; cross-tenant: suggesties en overdrachten van organisatie A zijn onzichtbaar voor B.
14. Telefoon (375, 390, 412 px): de suggestieflyout opent als schuifvenster, "Geef vrij" kost één tik per suggestie, tikdoelen minimaal 44 px, geen horizontale scroll; de toast na "Markeer gewonnen" verschijnt boven de onderbalk.
15. Alle adapters draaien met een mock; geen netwerk in tests.
16. Bijlage A: geen regel noemt P23 in de kolom Prompt; regel 1 (P17, deal gewonnen in één transactie) blijft groen met de overdracht erachter.

## Definition of Done

Hoofdstuk 19 geldt volledig. Specifiek voor deze prompt:

- Unit-tests voor `filterNamen`, `bundelSuggesties`, `overdrachtPakket` en de HMAC-functies (tijdgrens, replay, idempotentie).
- Wegwerp-Postgres: dubbele `suggestie.status`, dubbele overdracht, cross-tenant.
- AVG-check uit 15.2 (rij Suggesties naar SalesDNA) afgevinkt; de verwerkersafspraak met DealDrive en SalesDNA genoemd in `docs/HOE-HET-WERKT.md`.
- De opdracht voor het ontvangende endpoint in DealDrive staat als open punt in het sprintverslag.
