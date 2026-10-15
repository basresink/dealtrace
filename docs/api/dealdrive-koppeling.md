# API-koppeling Dealtrace en DealDrive

> Versie 0.1 · 15 oktober 2026 · **voorbereid, nog niet werkend**
>
> Dit is het contract tussen Dealtrace en DealDrive. Het bouwplan (F17, hoofdstuk 12, ADR-021) is leidend. De machineleesbare versie staat in `dealdrive-koppeling.openapi.yaml`. Geen van beide kanten is gebouwd: Dealtrace bouwt zijn kant in sprint 11 (prompt P23) met een mock van DealDrive; de ontvangende kant in DealDrive is een aparte opdracht voor DealDrive (open vraag 27). Veldnamen aan de DealDrive-kant zijn gecontroleerd tegen `app/types/entities.ts` op commit 75bee61.

## 1. Waarvoor

Dealtrace loopt tot en met de eerste afspraak (B17). Daarna gaat het account naar DealDrive, waar de deal, de offerte en de klantrelatie ontstaan. De koppeling regelt vier dingen:

| # | Richting | Wat | Wanneer |
|---|---|---|---|
| 1 | Dealtrace naar DealDrive | **Overdracht** van een account na een gehouden eerste afspraak met vervolg | "Overdragen" na "Rond af" (F09, F17) |
| 2 | Dealtrace naar DealDrive | **Ontdubbelen**: bestaat dit bedrijf al in DealDrive, als klant of prospect? | bij import, leadgenerator en vóór een overdracht |
| 3 | DealDrive naar Dealtrace | **Terugmelding** over een overgedragen account: overdracht verwerkt, deal gewonnen, deal verloren | wanneer het in DealDrive gebeurt |
| 4 | DealDrive naar Dealtrace | **Winback-signaal**: een klant bestelt al maanden niet | dagelijkse controle in DealDrive |

## 2. Afspraken voor beide kanten

| Onderwerp | Afspraak |
|---|---|
| Basis-URL | DealDrive: `https://<domein-dealdrive>/api/koppelingen/dealtrace/v1`; Dealtrace: `https://<domein-dealtrace>/api/koppelingen/dealdrive/v1` |
| Versie | In het pad (`v1`). Velden toevoegen mag binnen een versie; velden weghalen of betekenis wijzigen vraagt `v2` |
| Formaat | JSON, UTF-8; datums ISO-8601 met tijdzone (`2026-10-15T10:30:00+02:00`); bedragen in eurocenten (zoals `Money` in DealDrive) |
| Koppelen | Per Dealtrace-organisatie één koppeling met: basis-URL van DealDrive, `dealdriveOrganisatieId`, een gedeeld geheim (32 bytes, versleuteld opgeslagen met AES-256-GCM) en de stand aan of uit. De founder richt dit in via Platformbeheer, de beheerder ziet de status op de koppelingenpagina |
| Ondertekenen | Elk verzoek in beide richtingen draagt `X-Koppeling-Handtekening: sha256=<hex>`: HMAC-SHA256 met het gedeelde geheim over `<X-Koppeling-Tijd>.<ruwe body>` |
| Tijd | `X-Koppeling-Tijd` (Unix-seconden); de ontvanger weigert een verschil van meer dan 5 minuten |
| Herkomst | `X-Koppeling-Organisatie`: de `dealdriveOrganisatieId` (naar DealDrive) of de `dealtraceOrganisatieId` (naar Dealtrace) |
| Idempotentie | Schrijvende verzoeken dragen `Idempotentie-Sleutel` (UUID). Dezelfde sleutel binnen 7 dagen geeft hetzelfde antwoord terug zonder iets opnieuw te doen. Bij een overdracht is de sleutel het `overdrachtId` |
| Gebeurtenissen | Elke webhook heeft een uniek `gebeurtenisId`; de ontvanger verwerkt hem hooguit één keer |
| Antwoordtijd | Binnen 5 seconden een 2xx; zware verwerking in een job |
| Opnieuw proberen | Bij een time-out of 5xx opnieuw na 1, 5, 30 minuten, 2 en 12 uur; daarna status `mislukt` en een melding bij de beheerder |
| Fouten | Altijd `{ "fout": { "code": "...", "bericht": "...", "velden": [...] } }` met een Nederlandse melding die de beheerder kan lezen |
| Persoonsgegevens | Alleen zakelijke gegevens (naam, functie, zakelijk nummer en e-mail); nooit privégegevens; logs bewaren geen body, alleen ids en hash |

Foutcodes: `handtekening_ongeldig` (401), `tijd_verlopen` (401), `koppeling_uit` (403), `organisatie_onbekend` (404), `account_onbekend` (404), `ongeldige_invoer` (422), `al_klant` (409), `te_veel_verzoeken` (429), `interne_fout` (500).

## 3. Overdracht (Dealtrace naar DealDrive)

`POST /overdrachten`

Dealtrace stuurt het hele pakket uit F17: wie het account is, met wie je sprak, wat er in de eerste afspraak is gezegd, wat de afgesproken vervolgstap is, en de overdrachtsbriefing. DealDrive maakt of werkt het account bij, voegt de contacten toe, maakt een deal in fase `behoefte` (of een fase die de organisatie in DealDrive kiest) en een vervolgtaak voor de nieuwe eigenaar.

**Verzoek (verkort voorbeeld met de fictieve startset Voltvast)**

```json
{
  "overdrachtId": "5d2f7c1e-0b7a-4c1e-9a55-1f3f0c2b9e10",
  "overgedragenOp": "2026-10-15T14:05:00+02:00",
  "overgedragenDoor": { "email": "jan.wolters@voltvast.test", "naam": "Jan Wolters" },
  "nieuweEigenaar": { "email": "eva.dijkstra@voltvast.test" },
  "account": {
    "dealtraceId": "acc_7Kq2",
    "naam": "Testbrontsma Installatietechniek",
    "statutaireNaam": "Testbrontsma Installatietechniek B.V.",
    "kvkNummer": "99123456",
    "sbiCode": "4321",
    "branche": "Installatiebedrijven woningbouw",
    "klasse": "A",
    "website": "https://testbrontsma.test",
    "telefoon": "+31 6 0000 1001",
    "adres": { "straat": "Testweg 12", "postcode": "9201 AB", "plaats": "Drachten", "land": "NL" },
    "linkedInUrl": null,
    "huidigeLeverancier": "Landelijke groothandelsketen",
    "eigenVelden": { "aantalMonteurs": 24 }
  },
  "contacten": [
    {
      "dealtraceId": "con_31",
      "voornaam": "Hilde",
      "achternaam": "Testbrontsma",
      "functie": "Eigenaar",
      "email": "hilde@testbrontsma.test",
      "telefoon": null,
      "mobiel": "+31 6 0000 1002",
      "rol": "beslisser",
      "beslisser": true
    }
  ],
  "eersteAfspraak": {
    "dealtraceId": "afs_88",
    "datum": "2026-10-15T10:00:00+02:00",
    "soort": "Kennismaking",
    "vorm": "bezoek",
    "uitkomst": "vervolg",
    "verslag": "Twee nieuwe woningbouwprojecten in 2027; monteurs wachten nu vaak op materiaal ...",
    "aanwezigen": ["con_31"]
  },
  "vervolgstap": { "omschrijving": "Gratis projectschouw op het project in Drachten", "datum": "2026-10-22", "soort": "bezoek" },
  "kwalificatie": { "behoefte": "Levering per bouwfase", "autoriteit": "Eigenaar beslist", "noodzaak": "Start project maart 2027", "draagvlak": "Werkvoorbereider is positief" },
  "verkoopverhaal": { "branche": "Installatiebedrijven woningbouw", "winpuntIngezet": "Gratis projectschouw binnen 48 uur", "bezwaren": ["Bij de keten heb ik alles onder één dak."] },
  "briefing": "## Overdracht Testbrontsma Installatietechniek\n\nWie: ...",
  "reis": {
    "naam": "Standaardreis",
    "geschiedenis": [
      { "fase": "Gevonden", "op": "2026-09-02" },
      { "fase": "Gekwalificeerd", "op": "2026-09-09" },
      { "fase": "Afspraak gepland", "op": "2026-10-01" },
      { "fase": "Afspraak gehouden", "op": "2026-10-15" }
    ],
    "pogingenTotAfspraak": 4,
    "bron": "KvK"
  },
  "dossier": { "kernfeiten": ["24 monteurs", "Vacature servicemonteur (12 okt)"], "bronnen": ["https://testbrontsma.test/vacatures"] },
  "dealVoorstel": { "titel": "Projectlevering woningbouw 2027", "fase": "behoefte", "verwachteWaarde": null }
}
```

Verplicht: `overdrachtId`, `overgedragenOp`, `overgedragenDoor.email`, `account.dealtraceId`, `account.naam`, minstens één contact, `eersteAfspraak.datum`, `eersteAfspraak.uitkomst`, `vervolgstap.omschrijving`. De rest is optioneel; `briefing` is Markdown.

**Antwoord 201 (nieuw) of 200 (herhaald verzoek met dezelfde sleutel)**

```json
{
  "status": "ontvangen",
  "dealdrive": {
    "accountId": "acc_dd_5520",
    "accountNieuw": true,
    "dealId": "deal_dd_9041",
    "taakId": "task_dd_7710",
    "eigenaar": "eva.dijkstra@voltvast.test",
    "url": "https://<domein-dealdrive>/accounts/acc_dd_5520"
  },
  "contacten": [ { "dealtraceId": "con_31", "dealdriveId": "con_dd_301", "nieuw": true } ]
}
```

`status` is `ontvangen` (alles nieuw) of `samengevoegd` (account bestond al als prospect; DealDrive vult aan en overschrijft niets dat een gebruiker in DealDrive zelf invulde). Is het account in DealDrive al **klant**, dan antwoordt DealDrive `409 al_klant` met het `accountId`; Dealtrace toont dan "Dit bedrijf is al klant in DealDrive. Overdragen als nieuwe kans bij een bestaande klant?" en stuurt bij "Ja" hetzelfde verzoek met `"alsNieuweKansBijKlant": true`.

**Wat DealDrive ermee doet (voorstel voor de DealDrive-kant)**

| Dealtrace | DealDrive (`app/types/entities.ts`) |
|---|---|
| `account.naam`, `statutaireNaam` | `Account.name`, `Account.legalName` |
| `account.kvkNummer`, `sbiCode`, `branche` | `Account.kvkNumber`, `Account.sbiCode`, `Account.branche` |
| `account.klasse` | `Account.prospectGrade` (en niet het oude veld `tier`, zie Bijlage A gat 2) |
| `account.website`, `telefoon`, `linkedInUrl` | `Account.website`, `Account.phone`, `Account.linkedInUrl` |
| `account.adres` | `Account.addressLine`, `postcode`, `city`, `country` |
| `account.dealtraceId` | `Account.externalIds.dealtrace` |
| (vast) | `Account.accountKind = 'prospect'` tot de deal gewonnen is |
| `account.eigenVelden` | `Account.customFields` voor velden met dezelfde sleutel; de rest in een notitie |
| `contacten[].voornaam`, `achternaam`, `functie`, `email`, `telefoon`, `mobiel` | `Contact.firstName`, `lastName`, `jobTitle`, `email`, `phone`, `mobile` |
| `contacten[].rol`, `beslisser` | `Contact.role` (`beslisser`, `beinvloeder`, `champion`, `gebruiker`, `onbekend`), `Contact.isDecisionMaker` |
| `contacten[].dealtraceId` | `Contact.externalIds.dealtrace` |
| `dealVoorstel.titel`, `fase` | `Deal.title`, `Deal.stage` (standaard `behoefte`) |
| `kwalificatie` | `Deal.band` (`behoefte`, `autoriteit`, `noodzaak`, `draagvlak`) |
| `eersteAfspraak.verslag` en `briefing` | `Deal.description` (samenvatting) en een notitie op het account met de volledige briefing |
| `nieuweEigenaar.email` | `Deal.ownerId` en de vervolgtaak via de gebruiker met dat e-mailadres; onbekend adres: de beheerder van DealDrive |
| `vervolgstap` | een taak (en bij soort bezoek of afspraak een afspraakvoorstel) voor de eigenaar |
| `overdrachtId` | `Deal.externalIds.dealtrace` |

## 4. Ontdubbelen (Dealtrace vraagt DealDrive)

`GET /accounts/zoek?kvk=99123456&domein=testbrontsma.test&naam=Testbrontsma`

Minstens één van de drie parameters. DealDrive zoekt op KvK, dan domein zonder `www.`, dan genormaliseerde naam (zelfde regels als 15.1 van het bouwplan).

```json
{
  "treffers": [
    { "accountId": "acc_dd_5520", "naam": "Testbrontsma Installatietechniek", "soort": "prospect", "eigenaar": "eva.dijkstra@voltvast.test", "zekerheid": "kvk", "laatsteContact": "2026-06-11" }
  ]
}
```

`soort` is `klant` of `prospect`; `zekerheid` is `kvk`, `domein` of `naam`. Dealtrace gebruikt het antwoord om bij import en in de leadgenerator te tonen "Al klant in DealDrive" (niet benaderen tenzij de salesmanager het toestaat) en om vóór een overdracht de 409 te voorkomen. Antwoorden worden 24 uur gecachet per sleutel.

## 5. Terugmeldingen (DealDrive naar Dealtrace)

`POST /webhook` aan de Dealtrace-kant, met dezelfde ondertekening. Body:

```json
{
  "gebeurtenisId": "e2b1c3d4-...",
  "soort": "deal.verloren",
  "op": "2027-01-20T09:12:00+01:00",
  "dealtraceAccountId": "acc_7Kq2",
  "dealdriveAccountId": "acc_dd_5520",
  "gegevens": { "dealId": "deal_dd_9041", "reden": "Prijs", "verlorenAan": "Online webgroothandel" }
}
```

| Soort | Gegevens | Wat Dealtrace doet |
|---|---|---|
| `overdracht.verwerkt` | `overdrachtId`, `accountId`, `dealId` | Overdracht op status `bevestigd`; link naar DealDrive op de accountkaart |
| `deal.gewonnen` | `dealId`, `waarde` (eurocenten, optioneel), `gewonnenOp` | Account blijft `overgedragen`; de funnel en de analyse tellen "gewonnen na overdracht" per doelgroep, campagne en persoon; vraag "Mag dit een bewijs worden?" (F25) |
| `deal.verloren` | `dealId`, `reden`, `verlorenAan` (optioneel) | Reden via `vv_redenmapping` naar een terugkomregel; terugkomdatum, kanaal en rol uit de regel; account weer in een reis op de terugkomdatum (7.3, F25) |
| `klant.slapend` | `maandenNietBesteld` (3, 6 of 12), `laatsteOrder` | Herwinaccount in een winbackreis volgens de lijst "slapend" van de terugkomregels |
| `account.eigenaar-gewijzigd` | `eigenaar` (e-mail) | Alleen bijwerken als informatie op de kaart |
| `ping` | geen | Koppeling testen |

Een gebeurtenis voor een onbekend `dealtraceAccountId` geeft `404 account_onbekend` en wordt niet opnieuw geprobeerd.

## 6. Overige verzoeken

| Richting | Verzoek | Doel |
|---|---|---|
| Dealtrace naar DealDrive | `GET /ping` | Koppeling testen vanuit de koppelingenpagina |
| Dealtrace naar DealDrive | `GET /overdrachten/{overdrachtId}` | Stand van een overdracht opvragen als de terugmelding uitblijft |
| DealDrive naar Dealtrace | `GET /ping` | Koppeling testen vanuit DealDrive |

## 7. Voorbereiding in Dealtrace (zonder werkende DealDrive-kant)

- Adapter `server/utils/dealdriveAdapter.ts` met de interface `DealDriveKoppeling { overdragen(pakket), zoekAccount(sleutels), status(overdrachtId), ping() }` en twee uitvoeringen: `http` (dit contract) en `mock` (vaste antwoorden uit `seed/dealdrive-mock/`).
- Zolang DealDrive de ontvangende kant niet heeft, staat de koppeling op `mock` voor ontwikkeling en tests, en voor klanten op **uit**. Met de koppeling uit maakt Dealtrace bij een overdracht een overdrachtstaak plus de briefing om te mailen of te downloaden (F17), zodat het proces werkt zonder koppeling.
- Tabellen (bouwplan F17 en 10.2): `overdrachten` met `extern_id`, `status` en `pakket`; `koppelingen` met soort `dealdrive`; `koppeling_runs` voor het logboek; `dealdrive_gebeurtenissen` (`gebeurtenis_id` uniek, `soort`, `ontvangen_op`, `verwerkt_op`, `fout`).
- Endpoints in Dealtrace: `POST /api/accounts/:id/overdragen`, `POST /api/koppelingen/dealdrive/v1/webhook`, `GET /api/koppelingen/dealdrive/v1/ping`, `POST /api/koppelingen/dealdrive/test` (beheerder), `GET /api/koppelingen/dealdrive/status`.
- Contracttests: de voorbeelden in dit document en de OpenAPI-specificatie zijn de fixtures; de mock en de echte adapter moeten dezelfde tests halen.

## 8. Opdracht voor de DealDrive-kant (later)

1. Endpoints `POST /overdrachten`, `GET /overdrachten/{id}`, `GET /accounts/zoek`, `GET /ping` onder `/api/koppelingen/dealtrace/v1`, buiten de gewone sessie, met de ondertekening uit hoofdstuk 2 en RLS op de organisatie uit de koppeling.
2. Opslag van het gedeelde geheim per organisatie en een instelling "Dealtrace-koppeling" voor de beheerder.
3. Webhooks naar Dealtrace bij een verwerkte overdracht, een gewonnen of verloren deal met `externalIds.dealtrace`, en de dagelijkse controle op slapende klanten.
4. Tests met dezelfde voorbeelden als Dealtrace.

## 9. Open punten

1. Welke dealfase in DealDrive bij een overdracht hoort (voorstel `behoefte`, per organisatie instelbaar).
2. Of DealDrive bij `samengevoegd` velden mag overschrijven die in DealDrive leeg zijn (voorstel: ja) of nooit (veiliger).
3. Of `deal.gewonnen` de waarde meestuurt; Dealtrace heeft hem niet nodig, maar hij maakt de analyse "opbrengst per doelgroep" mogelijk.
4. Of de dagelijkse controle op slapende klanten in DealDrive komt of dat Dealtrace de besteldata ophaalt.
