# P29: SalesDNA-koppeling: webhooks, spiegel en projectie

| Onderdeel | Waarde |
|---|---|
| Sprint | 3 (Verkoopverhaal) |
| Features | F25 Verkoopverhaal en Richting (koppeling met SalesDNA) |
| Hangt af van | P01 (instellingen, audit, versleutelde geheimen), P28 (leesmodel `vv_*`, eigen inrichting, `vvProjectie`, Voltvast-seed) |
| Bron in het bouwplan | F25 (Technisch: Spiegel, Webhook-ontvanger, Projectie; Functioneel: Statussen en versies, Overstappen tussen bronnen), 12 (rij SalesDNA en de regels onder de tabel), ADR-002, ADR-017, 13.5 (lokaal bouwen met mocks), 15.3, 21, 22 (vragen 19 tot en met 21), Bijlage C |

## Lees eerst

- Bouwplan-Dealtrace.md: 0.2 (B16), 0.3 (rij SalesDNA), F25 volledig, 12 (rij SalesDNA en de alinea onder de tabel), 15.3 (webhooks met HMAC, tijdvenster en replay-bescherming; sleutels met AES-256-GCM), ADR-002, ADR-017, 21 (risico's "SalesDNA-webhooks vallen weg of komen dubbel" en "Verkoopverhaal is leeg of verouderd"), 22 (vragen 19, 20, 21), Bijlage C (en C.9 punten 6, 7, 8, 10).
- `bijlagen/SalesDNA-sublagen-voor-Dealtrace.docx`: leidend voor de vorm van de sublagen en de inhoud van de payloads.
- P28 (`docs/prompts/P28-verkoopverhaal-leesmodel-richting.md`).
- DealDrive (commit 75bee61): `server/utils/calendarCrypto.ts` als voorbeeld van versleutelde geheimen; de HubSpot-koppeling (`server/api/integrations/hubspot/status.get.ts`, `sync.post.ts`) als voorbeeld van koppelingsstatus en handmatige synchronisatie. Let op: die HubSpot-endpoints missen sessiecontrole (Bijlage A gat 21); neem dat niet over.

## Deel 1: Functioneel (wat en waarom)

### Wat je bouwt

De koppeling met SalesDNA: een gesigneerde webhook-ontvanger, een alleen-lezen spiegel van de bevestigde sublagen, een projectie van spiegel naar het leesmodel, volledige synchronisatie bij een gat in de versies, de bronkeuze per onderdeel met overstappen in beide richtingen, en de koppelingsstatus voor de beheerder.

### Waarom

ADR-002 (gewijzigd): SalesDNA is de voorkeursbron per sublaag via gesigneerde webhooks; Dealtrace spiegelt alleen bevestigde versies en schrijft nooit in SalesDNA (behalve suggesties in kader 2, P23). Zonder koppeling werkt alles met de eigen inrichting (P28). ADR-017: de projectie vult hetzelfde leesmodel, zodat geen enkele functie weet of de inhoud uit SalesDNA of uit de eigen inrichting komt. Een koppeling die stil wegvalt of dubbel binnenkomt maakt het verhaal verouderd (risico in 21).

### Gebruikers en niveaus

| Rol | Niveau | Wat |
|---|---|---|
| accountmanager | Beginner, Gevorderd, Expert | Ziet op `/richting` de bron ("Uit SalesDNA · bijgewerkt 12 okt") en het label "Mogelijk verouderd in SalesDNA"; ziet bij een gespiegeld onderdeel geen "Bewerken" |
| salesmanager | Gevorderd, Expert | Idem; kan bij gespiegelde onderdelen alleen de eigen aanvullingen bewerken |
| beheerder | Expert | Koppelt SalesDNA, kiest per onderdeel de bron, vergelijkt, ontkoppelt, start een volledige synchronisatie, ziet de koppelingsstatus en fouten, handelt taken af voor een nieuwe branche of fase zonder mapping |

### Schermen

**Instellingen, Data en AI, Koppelingen, SalesDNA** (`/instellingen/koppelingen/salesdna`). Het bouwplan noemt de onderdelen maar geen scherm. Niet vastgelegd in het bouwplan; voorstel van boven naar beneden:

1. Kop: kruimelpad "Instellingen · Koppelingen", kicker "KOPPELING", titel "SalesDNA".
2. Status: "Gekoppeld · laatste bericht 14 okt 09:12 · laatste volledige synchronisatie 13 okt 02:00", of "Niet gekoppeld", of een fout in gewone taal ("De handtekening van SalesDNA klopt niet. Controleer het geheim en koppel opnieuw.").
3. Koppelen: veld "Adres van SalesDNA", veld "Geheim" (schrijf-alleen, na opslaan alleen een vingerafdruk van acht tekens; Bijlage A gat 49 is P24 maar de regel geldt voor elk geheim), knop "Test verbinding" (stuurt en verwacht `ping`), knop "Koppelen".
4. Per onderdeel een rij: onderdeel, actieve bron ("SalesDNA" of "Eigen inrichting"), status en versie in SalesDNA, knop "SalesDNA wordt de bron" of "Eerst vergelijken" (bij eigen), of "Terug naar eigen inrichting" (bij SalesDNA).
5. Knop "Nu volledig synchroniseren".
6. Logboek: de laatste 50 berichten met tijd, soort, onderdeel, versie, resultaat (verwerkt, dubbel genegeerd, geweigerd met reden).
7. Knop "Ontkoppelen" met bevestiging: "SalesDNA ontkoppelen? De laatst bevestigde inhoud wordt gekopieerd naar jullie eigen inrichting. Daarna kun je hem zelf bewerken." en knop "Ontkoppelen".

**Vergelijken** (flyout breed, 560 px): links de eigen inrichting, rechts de laatst bevestigde versie uit SalesDNA, per veld; onderaan de controlelijst van de verwijzingen ("Accounts met branche Utiliteitsinstallateurs: 14 · gekoppeld op naam aan br-02"), knoppen "SalesDNA wordt de bron" en "Annuleren". Niet vastgelegd; voorstel.

**Gespiegeld onderdeel in Instellingen, Verkoopverhaal**: geen knop "Bewerken"; tekst "Wijzigen doe je in SalesDNA, Salesbasis, Branches." (met de naam van het onderdeel). De eigen aanvullingen (SBI-mapping, termijn als datum, concurrentcontext, winpunt per branche, eigen bewijs, termijn in dagen, redenmapping) blijven bewerkbaar.

**Op `/richting`** (uit P28): bron rechts in de kop "Uit SalesDNA · bijgewerkt 12 okt"; voor de beheerder "Wijzigen doe je in SalesDNA" in plaats van "Inrichten"; per onderdeel "Mogelijk verouderd in SalesDNA" als dat zo is. In de bronregel van elk concept, script en bericht hetzelfde label (de concepten zelf komen in P10 en P18).

**Verwijderd uit SalesDNA**: een verwijzing op een account of afspraak naar een branche, concurrent of winpunt dat in SalesDNA verdween, toont "Verwijderd uit SalesDNA" naast de naam.

**Telefoon.** Koppelingen staan onder Instellingen en openen met "Beter op een groot scherm" (8.12). Op `/richting` zijn bron en labels op 390 px leesbaar zonder horizontale scroll.

### Klikpaden

1. Beheerder vult adres en geheim in, klikt "Test verbinding": SalesDNA stuurt `ping`, de status wordt "Verbinding werkt". Hij klikt "Koppelen"; Dealtrace start een volledige synchronisatie; het logboek toont per sublaag een `sublaag.bevestigd`.
2. Bij Branches staat "Eigen inrichting"; hij klikt "Eerst vergelijken", ziet de verschillen en de controlelijst, klikt "SalesDNA wordt de bron": de eigen inhoud gaat naar het archief, verwijzingen op accounts worden via naam gemapt, `/richting` toont "Uit SalesDNA".
3. SalesDNA bevestigt een nieuwe versie van Concurrenten; de webhook komt binnen; binnen een minuut toont `/richting` versie 4; concepten gebruiken voortaan versie 4.
4. SalesDNA stuurt `sublaag.verouderd` voor Concurrenten (L0.8): `/richting` toont "Mogelijk verouderd in SalesDNA"; concepten werken door met de laatst bevestigde versie.
5. Er komt versie 6 binnen terwijl Dealtrace versie 4 heeft: Dealtrace start zelf een volledige synchronisatie.
6. SalesDNA stuurt een nieuwe branche zonder SBI-mapping: de beheerder krijgt een taak "Nieuwe branche Installatie industrie heeft nog geen SBI-koppeling." Niet vastgelegd welke tekst; voorstel.
7. Beheerder klikt "Ontkoppelen": de laatst bevestigde spiegel wordt gekopieerd naar de eigen inrichting met herkomst `salesdna`; vanaf dan bewerkbaar.

### Regels

- **Alleen bevestigde versies** worden gespiegeld; Dealtrace schrijft nooit in SalesDNA (suggesties zijn P23).
- **Mengvorm per onderdeel** mag: een onderdeel dat in SalesDNA leeg is (`sublaag.leeg`) of overgeslagen (`sublaag.overgeslagen`), blijft eigen.
- **Verouderd**: bij `sublaag.verouderd` werkt Dealtrace door met de laatst bevestigde versie en toont het label; `sublaag.verouderd-gesloten` haalt het label weg.
- **Versie boven vlag**: SalesDNA zet bij een gewijzigd blok per branche niets op verouderd; Dealtrace kijkt daarom naar versienummer en `bijgewerkt_op`, niet alleen naar de vlag (C.9 punt 7: alleen een gewijzigd blok in L0.4 geeft geen verouderd-melding, wel een nieuwe versie).
- **Idempotent** op `event_id` en op `(onderwerp_id, versie)`: een dubbel event verandert niets.
- **Gat in de versies** (bijvoorbeeld 4 naar 6): volledige synchronisatie van die sublaag.
- **Projectie**: upsert op `extern_id`; verdwenen ids op `actief=false`; verwijzingen in accounts en afspraken blijven op id met "Verwijderd uit SalesDNA"; een nieuwe branche of fase zonder mapping maakt een taak voor de beheerder; scripts die een verdwenen winpunt of concurrent noemen gaan op "Controleren" (vanaf P10).
- **Overstappen**: eigen naar SalesDNA per onderdeel met archief en naammapping via een controlelijst; SalesDNA naar eigen bij ontkoppelen met kopie en herkomst `salesdna`.
- **Fasen**: SalesDNA-fasen koppelen aan een hoofdfase van de reis via `vv_fasen.reis_hoofdfase`. Open vraag 20: fasen als eigen event of meegestuurd met Winpunten; voorstel uit 22: meesturen met Winpunten, mapping in Instellingen.
- **Golden circle** (L0.11): open vraag 19, de veldnamen haal je uit SalesDNA vóór de projectie. Tot dat antwoord er is: Niet vastgelegd in het bouwplan; voorstel: velden `waarom`, `hoe`, `wat` zoals in de eigen inrichting.
- **Klassen en rollen**: open vraag 21, mapping op naam met controlelijst (voorstel uit 22); Bijlage C.8 heeft lege klassen, wat "alle klassen" betekent.

### Helpartikelen

- "Koppelingen" (Inrichten, beheerder): uitbreiden met SalesDNA koppelen, bron per onderdeel, vergelijken, ontkoppelen, wat "Mogelijk verouderd in SalesDNA" betekent.
- "Ons verhaal" (P28): alinea over de bron en het label "Mogelijk verouderd in SalesDNA".

## Deel 2: Technisch (hoe)

### Datamodel

Migratie `0006_salesdna`. RLS `org_isolation` op alle tabellen. De spiegeltabellen worden alleen geschreven door de webhook-ontvanger en de volledige synchronisatie (een eigen serverfunctie), nooit door gebruikersendpoints.

| Tabel | Kolommen |
|---|---|
| `salesdna_koppeling` | `status`, `endpoint`, `geheim` (versleuteld, AES-256-GCM met een eigen geheim per doel), `laatste_event`, `laatste_volledige_sync`, `actieve_sublagen[]` |
| `salesdna_events` | `event_id` (uniek), `soort`, `onderwerp_id`, `versie`, `ontvangen_op`, `verwerkt_op`, `fout`, `payload_hash` |
| `salesdna_sublagen` | `onderwerp_id`, `status`, `versie`, `bevestigd_op`, `bijgewerkt_op`, `verouderd`, `verouderd_door`, `inhoud` (ongewijzigd) |
| `salesdna_sublaag_versies` | alle ontvangen bevestigde versies, alleen-lezen |
| `koppelingen`, `koppeling_runs` | uit hoofdstuk 12: rij `soort = 'salesdna'` en een run per volledige synchronisatie |
| `vv_*` | uit P28; de projectie schrijft met `bron = 'salesdna'` en `extern_id` = SalesDNA `_id` |
| `vv_sublagen.bron` | per onderdeel de actieve bron |
| archief eigen inhoud | Niet vastgelegd in het bouwplan; voorstel: `vv_versies` uit P28 met status `gearchiveerd` |

- Sync-allowlist: geen van deze tabellen.
- Rechten: lezen van koppelingsstatus en logboek alleen beheerder; schrijven alleen via de endpoints hieronder.

### Webhook-ontvanger

`POST /api/koppelingen/salesdna/webhook`:

1. Lees de ruwe body. Controleer `X-SalesDNA-Signature` (HMAC-SHA256 over de ruwe body met het geheim van de organisatie), `X-SalesDNA-Event-Id` en `X-SalesDNA-Tijd` (hooguit 5 minuten verschil met de servertijd).
2. De organisatie komt uit de koppeling waarvan het geheim de handtekening geeft, nooit uit de payload. Niet vastgelegd hoe de ontvanger de organisatie vindt; voorstel: een organisatiespecifiek pad (`/api/koppelingen/salesdna/webhook/:koppelingId`) of een header met het koppelings-id, en daarna de HMAC-controle met het geheim van die koppeling.
3. Bij een ongeldige handtekening of een te oud tijdstip: 401, niets bewaren behalve een geweigerde regel in het logboek zonder payload.
4. Bestaat `event_id` al, of `(onderwerp_id, versie)`: 200 en niets doen.
5. Bewaar het event in `salesdna_events` en antwoord binnen 5 seconden met 2xx; de verwerking loopt in een job.
6. Gebeurtenissen: `sublaag.bevestigd` (volledige inhoud), `sublaag.verouderd`, `sublaag.verouderd-gesloten`, `sublaag.leeg`, `sublaag.overgeslagen`, `ping`.

### Volledige synchronisatie

Bij koppelen, bij een gat in de versienummers en op verzoek ("Nu volledig synchroniseren"). Dealtrace haalt per sublaag de laatst bevestigde versie op bij SalesDNA. Het bouwplan noemt de volledige synchronisatie maar geen route aan de kant van SalesDNA. Niet vastgelegd in het bouwplan; voorstel: `GET {salesdna}/api/koppelingen/dealtrace/sublagen` en `GET {salesdna}/api/koppelingen/dealtrace/sublagen/:onderwerpId`, met dezelfde HMAC op het verzoek, af te stemmen met SalesDNA. Elke run in `koppeling_runs` met gelezen, geschreven en fouten.

### Pure functies

| Functie | Invoer | Uitvoer | Randgevallen en unit-tests |
|---|---|---|---|
| `controleerHandtekening(rauweBody, header, geheim)` in `server/utils/salesdnaWebhook.ts` | bytes, header, geheim | boolean | lege body, andere codering, constante-tijdvergelijking |
| `binnenTijdvenster(tijd, nu)` | ISO-tijd, nu | boolean | precies 5 minuten; toekomst |
| `isDubbel(event, bekend)` | event, bekende ids en versies | boolean | zelfde event_id, zelfde versie met ander event_id |
| `heeftGat(huidigeVersie, nieuweVersie)` | twee versies | boolean | 4 naar 5 nee, 4 naar 6 ja, lager dan huidig (oud event) nee en negeren |
| `isInhoudelijkGewijzigd(oud, nieuw)` | twee sublagen | boolean | alleen `bijgewerkt_op` of blok per branche gewijzigd (C.9 punt 7) |
| `projecteerSublaag(soort, inhoud, bestaand)` in `server/utils/vvProjectie.ts` | spiegelinhoud, bestaand leesmodel | upserts, deactivaties, taken | id verdwenen, id hernoemd (C.9 punt 6), nieuwe branche zonder mapping |
| `mapOpNaam(eigen, salesdna)` | twee lijsten | voorstel per eigen rij plus controlelijst | gelijke naam, hoofdletterverschil, geen match |

### Endpoints

| Methode en route | Recht | Invoer | Uitvoer | Fouten |
|---|---|---|---|---|
| `POST /api/koppelingen/salesdna/webhook` | HMAC, geen sessie | ruwe body en headers | 2xx binnen 5 s | 401 handtekening of tijd; 200 bij dubbel |
| `POST /api/koppelingen/salesdna/koppel` | beheerder | `{endpoint, geheim}` | status | 400 test mislukt, met reden in gewone taal |
| `POST /api/koppelingen/salesdna/sync` | beheerder | `{onderwerpId?}` | run-id | 409 als er al een run loopt |
| `POST /api/koppelingen/salesdna/bron` | beheerder | `{onderdeel, bron, mapping?}` | nieuwe bron | 409 als SalesDNA voor dat onderdeel leeg is; 422 zonder bevestigde controlelijst |
| `GET /api/config/status` | beheerder | | of een sleutel bestaat, nooit de sleutel (12) | |

Niet vastgelegd in het bouwplan; voorstel: `GET /api/koppelingen/salesdna` (status en logboek), `POST /api/koppelingen/salesdna/test` (ping), `POST /api/koppelingen/salesdna/ontkoppel` (kopie naar eigen inrichting), `GET /api/koppelingen/salesdna/vergelijk/:onderdeel`.

Elk endpoint behalve de webhook controleert de sessie en het recht (Bijlage A gat 21 voor de HubSpot-variant; hier dezelfde les).

### Integraties

Adapter `server/utils/bronnen/salesdna.ts` met dezelfde interface voor echt en mock: `ping()`, `haalSublagen()`, `haalSublaag(onderwerpId)`. De mock levert de Voltvast-inhoud uit Bijlage C als payloads van `sublaag.bevestigd`, plus een testset met `sublaag.verouderd` voor L0.8, een gewijzigd blok in L0.4 en een hernoemde br-02; de payloads staan als fixtures in `seed/webhooks/` (met `seed/webhooks/testgevallen/`). Lokaal (13.5) draait de koppeling altijd op deze mock; er is geen SalesDNA-omgeving nodig en het gedeelde geheim staat alleen in `.env.local`. Foutmeldingen in gewone taal op de koppelingenpagina; logging in `koppeling_runs`; geen kosten in het verbruik (SalesDNA rekent niet per bericht). Het geheim staat niet in logs.

### AI-stappen

Geen. Het namenfilter (P28) geldt voor suggesties naar SalesDNA in P23.

### Functiecatalogus

| Sleutel | Niveau | Pakket | Recht | Helpartikel |
|---|---|---|---|---|
| `koppeling.salesdna` | Expert | Starter | beheerder | "Koppelingen" |
| `koppeling.salesdna.bronPerOnderdeel` | Expert | Starter | beheerder | "Koppelingen" |

Pakket: het bouwplan legt voor de SalesDNA-koppeling geen pakket vast; voorstel Starter.

### Hergebruik uit DealDrive

| Bestand | Wat je aanpast |
|---|---|
| `server/utils/calendarCrypto.ts` | patroon voor AES-256-GCM met een eigen geheim per doel (`SALESDNA_KEY_SECRET`, niet vastgelegd als naam; voorstel) |
| `server/api/integrations/hubspot/status.get.ts`, `sync.post.ts` | patroon voor status en handmatige synchronisatie, met sessiecontrole erbij |

### Buiten scope

Suggesties naar SalesDNA en `suggestie.status` terug (P23); bijlagen van winpunten (open vraag 22, P23); de tien weergaven, kaders, meekijkronde en Kwartaal check van SalesDNA; scripts op "Controleren" zetten (de koppeling markeert, het effect zie je vanaf P10).

## Acceptatiecriteria

1. Een organisatie met SalesDNA ontvangt het verhaal via een webhook en `/richting` toont hetzelfde als bij de eigen inrichting met dezelfde inhoud (sprint-3-toestand).
2. Een webhook met een ongeldige handtekening of een tijdstip van meer dan 5 minuten oud geeft 401 en verandert niets.
3. Een dubbel event (zelfde `event_id`, of zelfde onderwerp en versie) verandert niets en geeft 200.
4. De ontvanger antwoordt binnen 5 seconden; de verwerking loopt in een job.
5. Een gat in de versienummers start een volledige synchronisatie; na afloop is de spiegel gelijk aan de mock.
6. Bijlage C.9, punt 6: br-02 hernoemd in SalesDNA; koppelingen op accounts blijven, de naam verandert overal.
7. Bijlage C.9, punt 7: alleen een gewijzigd blok in L0.4 geeft geen verouderd-melding, wel een nieuwe versie in het leesmodel.
8. Bijlage C.9, punt 8: `sublaag.verouderd` voor L0.8 zet het label op `/richting`; `kiesWinpunt` en `verhaalVoor` werken door met de laatst bevestigde versie.
9. Bijlage C.9, punt 10: dezelfde Voltvast-seed als eigen inrichting (P28) en als spiegel via de mock geeft voor de testgevallen 1 tot en met 4 exact dezelfde uitkomst van de functies in `shared/verkoopverhaal.ts`.
10. Een verdwenen concurrent staat op `actief=false`; een account met die huidige leverancier toont "Verwijderd uit SalesDNA".
11. Een nieuwe branche zonder SBI-mapping maakt een taak of melding voor de beheerder.
12. "SalesDNA wordt de bron" archiveert de eigen inhoud en mapt verwijzingen op naam na bevestiging van de controlelijst; "Ontkoppelen" kopieert de spiegel naar de eigen inrichting met herkomst `salesdna`.
13. Bij een gespiegeld onderdeel is "Bewerken" niet zichtbaar en weigert `PUT /api/instellingen/verkoopverhaal/:onderdeel` met 409; de eigen aanvullingen blijven bewerkbaar.
14. Zonder koppeling werkt alles met de eigen inrichting; geen foutmeldingen voor gebruikers.
15. Alle tests draaien lokaal zonder netwerk tegen de mock met de fixtures uit `seed/webhooks/` (13.5); het geheim komt niet in logs en de koppelingenpagina toont alleen een vingerafdruk.
16. Getest als accountmanager Beginner, Gevorderd en Expert (lezen, labels, geen bewerken), als salesmanager en als beheerder (koppelen, bron kiezen); cross-tenant: een webhook met het geheim van organisatie A schrijft nooit in B.
17. Bijlage A, gat 16: handtekening, tijdvenster, idempotentie en projectie staan elk één keer in `server/utils/` of `shared/`.

## Definition of Done

Hoofdstuk 19 geldt volledig. Specifiek voor deze prompt:

- Wegwerp-Postgres-tests voor idempotentie, gat in versies, projectie, overstappen en cross-tenant op de webhook.
- Playwright (kernflow uit 19 "verkoopverhaal via webhook naar script", voor zover er nu scripts zijn): webhook via de mock, `/richting` toont de nieuwe versie, op desktop en 390 px.
- `docs/HOE-HET-WERKT.md` beschrijft de webhookcontrole, de spiegel, de projectie en de bronkeuze per onderdeel.
- De antwoorden op open vragen 19, 20 en 21 zijn met de founder vastgelegd of als voorstel in het sprintverslag benoemd.
- Testdata alleen uit Bijlage C.
