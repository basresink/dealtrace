# Startset Testbedrijf Voltvast

Seed voor Dealtrace volgens Bijlage C van het bouwplan (C.1 tot en met C.9), met de veldnamen uit F25 en de bijlage "SalesDNA-sublagen voor Dealtrace".

## Alles is fictief

Testbedrijf Voltvast is een fictieve demo-organisatie: een technische groothandel voor installateurs in Midden- en Noord-Nederland. Alle bedrijven, personen en gegevens in deze map zijn verzonnen:

- bedrijfsnamen beginnen met "Test" (Testinstallatie, Testtechniek, Teststichting, Testzon);
- achternamen van contactpersonen beginnen met "Test", gebruikers heten "Testgebruiker ...";
- KvK-nummers beginnen met 99, e-mailadressen eindigen op `.test`, telefoonnummers zijn `+31 6 0000 ....`;
- plaatsen en postcodes zijn echt (voor regio's en routes), adressen niet.

Er staan geen gegevens van Sales Legends of van een bestaand bedrijf in.

## Wat er in staat

| Pad | Inhoud |
|---|---|
| `voltvast.json` | De hele startset: organisatie, verkoopverhaal per leesmodeltabel, testvarianten, accounts, contacten, notities, deals en een campagne |
| `webhooks/*.bevestigd.json` | Per sublaag een voorbeeld van `sublaag.bevestigd` (L0.1, L0.2, L0.4, L0.6, L0.8, L2.1, L3.14) met inhoud in SalesDNA-vorm |
| `webhooks/L0.8-concurrenten.verouderd.json` | Voorbeeld van `sublaag.verouderd` voor L0.8 |
| `webhooks/testgevallen/` | Twee vervolgpayloads voor C.9 punt 6 (L0.6 versie 2, br-02 hernoemd) en punt 7 (L0.4 versie 3, alleen het blok van br-01 gewijzigd) |

### `voltvast.json`

- `_meta`: seedversie, referentiedatum (14 oktober 2026), uitleg van `herkomst`.
- `organisatie` (C.1): naam, werkgebied, teams, rollen, accountklassen, kwartaal. Daarnaast `gebruikers` (vijf fictieve medewerkers) en `gebieden` (Regio Noord met regiodag dinsdag, Regio Midden met regiodag donderdag) in de vorm van F18.
- `verkoopverhaal`, ingedeeld naar de tabellen van het leesmodel uit F25:
  - `vv_sublagen`: per onderdeel status `bevestigd`, versienummer, `bevestigd_op` en `bijgewerkt_op` (L0.1 v3, L0.2 v2, L0.4 v2, L0.6 v1, L0.8 v1, L2.1 v2, L3.14 v2).
  - `vv_branches` (C.2): br-01 tot en met br-04 met focus, horizon, termijn, prioriteit en `termijn_vanaf`.
  - `vv_teksten` (C.3 tot en met C.5): bedrijfsverhaal algemeen met kernzin, verhaal br-01 en br-02; ambitie, visie, missie; kernbelofte en waardestatement algemeen en voor br-01.
  - `vv_concurrenten` (C.6): cc-01 tot en met cc-05 met de negen velden.
  - `vv_fasen` en `vv_winpunten` (C.7): vijf fasen met `reis_hoofdfase`, wp-01 tot en met wp-03 met `context` en `weging` (wp-02 = 0,5).
  - `vv_terugkomregels` (C.8): hc-01 tot en met hc-06 met `termijn_dagen`, kanaal, rollen en aanpak.
  - `vv_eigen_opties`: de eigen termijn "direct".
  - `eigen_aanvullingen`: `vv_branche_mapping` (SBI-codes en trefwoorden), `vv_ambitiedoelen` (status voorstel), `vv_redenmapping` (Dealtrace-reden naar terugkomregel).
  - `context`: dekking, "Komt terug in", jaarkeuzes in het Plan, kader 5-taak, Prospectmix-idee, fasen zonder winpunt, lokale stand van L3.14.
- `testvarianten`: apart te laden, niet standaard actief: wp-01 met concurrenten cc-01 en cc-02, en hc-03 alleen voor klasse "A · Aantal monteurs (Prospects)".
- `accounts`: twaalf prospects (pr-01 tot en met pr-12, verdeeld over br-01 tot en met br-04, vijf met een huidige leverancier uit de concurrenten) en twee slapende klanten (kl-01, kl-02) voor de lijst slapend.
- `contacten`, `notities`, `deals`, `campagnes`: precies genoeg om C.9 te draaien.

### Herkomst

Elke regel heeft `herkomst`: `bron` (Bijlage C markeert het als bron) of `aangevuld` (voor de seed aangevuld in dezelfde lijn). Binnen een regel kan het verschillen:

- `aangevuld_velden` noemt velden die binnen een bronregel zijn aangevuld (bijvoorbeeld hc-01: aanpak, kanaal, rollen; elke branche: `termijn_vanaf`).
- `bron_velden` noemt velden die binnen een aangevulde regel uit de bron komen (bijvoorbeeld cc-01: naam en soort).
- `herkomst_toelichting` legt het in een zin uit.

Let op: dit seedveld `herkomst` is iets anders dan de herkomst `salesdna` die F25 gebruikt bij ontkoppelen.

Een bekend verschil: de bron noemt voor "Wie zijn wij" 64 woorden; de aangevulde tekst uit C.3 telt er minder. De seed bewaart beide (`woorden_bron`, `woorden_tekst`).

### Webhooks

Elk bestand heeft `methode`, `pad` (`POST /api/koppelingen/salesdna/webhook`), `headers` en `body`.

- Headers: `X-SalesDNA-Event-Id`, `X-SalesDNA-Tijd` en `X-SalesDNA-Signature`. De handtekening is een plaatshouder: de mock berekent HMAC-SHA256 over de ruwe body met zijn eigen geheim en past het tijdstip zo nodig aan, want het venster is 5 minuten.
- Body: `eventId`, `soort`, `tijd`, `organisatie`, `onderwerpId`, `versie`, `status`, `verouderd`, `bevestigdOp`, `bijgewerktOp` en `inhoud`.
- `inhoud` in SalesDNA-vorm: `velden` (sleutel en tekst) en `perBranche` voor L0.1, L0.2 en L0.4; `rijen` voor L0.6, L0.8 en L2.1; `rijen` (verloren), `extra` (slapend) en `eigenOpties` voor L3.14. Keuzes staan als sleutel (`concurrent-direct`, `prijs-te-hoog`, `over-een-halfjaar`), rollen als komma-gescheiden ids.
- L2.1 stuurt de fasen mee in `context.fasen`, zodat de projectie `vv_fasen` kan vullen.
- De verouderd-melding voor L0.8 volgt op de hernoeming in L0.6 versie 2 (`verouderdDoor`).

## Laden als spiegel en als eigen inrichting

Dezelfde data moet op twee manieren laden en overal hetzelfde resultaat geven (C.9 punt 10):

1. **Spiegel** (bron `salesdna`): stuur de zeven `*.bevestigd.json` naar de webhook-ontvanger. De projectie (`server/utils/vvProjectie.ts`) vult `salesdna_sublagen` en daarna het leesmodel `vv_*`, met `extern_id` gelijk aan de SalesDNA-`_id`. De eigen aanvullingen (SBI-mapping, `termijn_vanaf`, `termijn_dagen`, ambitiedoelen, redenmapping, weging) komen uit `voltvast.json`, want SalesDNA kent ze niet.
2. **Eigen inrichting** (bron `eigen`): `db/seed/voltvast.ts` schrijft `verkoopverhaal` uit `voltvast.json` rechtstreeks in de eigen inrichting en projecteert naar hetzelfde leesmodel. Dit is ook de inhoud achter de knop "Kopieer uit startset".

De kolom `bron` staat niet in de seed; de lader zet hem. Daarna moeten `GET /api/richting`, `verhaalVoor`, `beloftevoor`, `kiesWinpunt`, `dekking` en `terugkomDatum` voor elk account hetzelfde teruggeven; alleen de herkomst in de kop verschilt ("Uit SalesDNA" of "Eigen inrichting").

## Testgevallen uit C.9

| # | Testgeval | Records | Verwacht |
|---|---|---|---|
| 1 | Prospect in br-03: verhaal en belofte vallen terug op algemeen; campagne op br-03 geeft dekkingsmelding | pr-08, pr-09, pr-10; cp-01; `vv_teksten` zonder blok voor br-03 | Algemeen verhaal en algemene belofte met melding "Voor Woningcorporaties (via installateurs) is nog geen eigen verhaal"; cp-01 toont de dekking (L0.1 2 van 4, L0.4 1 van 4) |
| 2 | Prospect in br-01 met huidige leverancier cc-02 | pr-01, ct-01; tx-l01-algemeen, tx-l04-br01-*, wp-01, cc-02 | Kernzin, belofte br-01 "Binnen 48 uur een gratis projectschouw, daarna levering per bouwfase.", winpunt wp-01, bezwaar "Online is het goedkoper." met antwoord |
| 3 | Fase Signaal zonder winpunt | pr-03 (fase fa-01) | Dealtrace toont het gat "Geen winpunt in Signaal en Kennismaking" en gebruikt wp-01 als belofte |
| 4 | wp-02 onder de norm | pr-02 (fase fa-04 Offerte), dl-02; wp-02 met `weging` 0,5 en klantfeedback 3,3 tegen 4,0 | wp-02 komt in een concept niet als eerste winpunt |
| 5 | Deal verloren met "Prijs" | dl-01 bij pr-05 (Regio Midden, eigenaar u-02); `vv_redenmapping` Prijs naar hc-03 | Reden "Prijs te hoog", 182 dagen na 12 oktober 2026 is 12 april 2027; eerstvolgende regiodag (donderdag) geeft een bezoektaak op 15 april 2027 voor u-02 |
| 6 | br-02 hernoemd in L0.6 | `webhooks/testgevallen/L0.6-branches-v2-hernoemd.bevestigd.json`; pr-05, pr-06, pr-07, kl-02, tx-l01-br02 | Koppelingen op br-02 blijven, de naam wordt overal "Installateurs utiliteitsbouw" |
| 7 | Alleen een gewijzigd blok in L0.4 | `webhooks/testgevallen/L0.4-waarde-belofte-v3-blok.bevestigd.json` | Geen verouderd-melding, wel versie 3 in `vv_sublagen` en in `vvVersies` van nieuwe concepten |
| 8 | `sublaag.verouderd` voor L0.8 | `webhooks/L0.8-concurrenten.verouderd.json` | Label "Mogelijk verouderd in SalesDNA" op `/richting`; concepten gebruiken L0.8 versie 1 |
| 9 | Contactnaam in aantekeningen | nt-01 bij pr-01 (noemt Jorien Testkolk en Ruud Testbeek) | Geen van beide namen in een AI-aanroep of suggestie naar SalesDNA |
| 10 | Dezelfde seed als eigen inrichting | heel `verkoopverhaal` | Zie hierboven: zelfde uitkomst voor 1 tot en met 9, alleen een andere herkomst |

Overige records: pr-04 (cc-01, Overstappers van de Landelijke groothandelsketen), pr-07 (cc-05, wachtend met terugkomregel hc-06), pr-11 (cc-04) en pr-12 voor br-04 met trefwoord "zonnepanelen", kl-01 (slapend, hc-04 direct) en kl-02 (contactpersoon vertrokken, hc-05 over een maand). De testvarianten in `testvarianten` horen bij de keuzeregel "Tegen wie we hier winnen" (wp-01 tegen cc-01 en cc-02, samen met pr-01 en pr-04) en bij een terugkomregel per klasse (hc-03 alleen voor klasse A).
