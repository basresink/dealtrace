# Hoe Dealtrace werkt (P01)

## Drie dingen bepalen wat iemand ziet

1. **Rol**: accountmanager, salesmanager, beheerder of founder. De rol bepaalt wat je mag (rechtenmatrix).
2. **Niveau**: Beginner, Gevorderd of Expert. Het niveau bepaalt welke functies voor je aanstaan.
3. **Werkplek**: binnendienst, buitendienst of hybride. De werkplek bepaalt de volgorde (buitendienst ziet Bezoeken voor Belblokken), nooit wat je mag.

## Is een functie beschikbaar?

`shared/functies.ts`, functie `beschikbaar()`:

```
beschikbaar = pakket bevat de functie  EN  rol mag de functie  EN  functie staat aan voor het niveau
```

Staat hij uit, dan krijg je een reden terug: `pakket`, `rol` of `niveau`.

- Reden **niveau**: de functie staat in de zijbalk onder "Nog niet aangezet" met een slotje. Een klik opent de uitleg (Wat het doet, Tot die tijd). Een directe link toont dezelfde uitleg.
- Reden **pakket** of **rol**: de functie is onzichtbaar; een directe link geeft "Geen toegang".
- De API weigert met 403 en `data.reden`, zodat de server dezelfde regel volgt als het scherm.

## Features per niveau

Welke functie bij welk niveau aanstaat, staat niet in de code maar in de tabel `functies_per_niveau` (functie, niveau, aan, organisatie). De migratie vult hem met een startindeling (kolom `startNiveau` in de catalogus). Daarna zet de founder functies aan of uit op `/platform/features` (P09). Een regel voor één organisatie gaat voor de algemene regel; zonder regel staat een functie uit.

De app-rol kan deze tabel niet wijzigen; alleen de platformlaag van de founder.

**Iedereen ziet alles** (Instellingen, Niveaus) zet voor de hele organisatie alles uit het pakket aan, los van het niveau. Pakket en rol blijven gelden.

**Toon minder** (Mijn instellingen) verbergt functies voor jezelf. Je kunt er nooit iets mee aanzetten.

## Niveau wijzigen

Beheerder voor iedereen, salesmanager alleen binnen de eigen teams (anders 403). Verlagen vraagt een reden. Functies die door een hoger niveau aangaan, krijgen een week de pil "nieuw" en één melding. Elke wijziging komt in de audit.

## Rechtenmatrix

`shared/permissions.ts` geeft per onderdeel, rol en actie (lezen, schrijven, verwijderen, beheren) een bereik: geen, eigen, team of alles. De founder ziet organisatiedata alleen als hij is ingestapt, en dan alleen lezend.

## Gescheiden organisaties (RLS)

Elke tabel heeft `organisation_id` en een RLS-regel `organisation_id = current_org_id()`. De app verbindt als `dealtrace_app` (geen superuser, omzeilt RLS niet) en zet per transactie de organisatie (`metOrganisatie()` in `server/utils/db.ts`). Zonder organisatie ziet de app niets. `pnpm test:db` bewijst dit.

## Offline

Wijzigingen die offline moeten werken (meldingen gelezen of verbergen, persoonlijke instellingen) gaan eerst in een wachtrij in de browser (IndexedDB) en dan naar `POST /api/sync/mutations`. Elke wijziging heeft een idempotentiesleutel, zodat dubbel versturen niets dubbel doet. Is de stand op de server intussen veranderd, dan opent het conflictvenster: "Houd mijn versie" of "Neem de andere over".

## Platformbeheer en werken in een organisatie (P02)

Er is geen aparte HQ: Platformbeheer zit in dezelfde app, alleen voor de founder. De scheiding zit in drie lagen.

1. **De client verbergt.** Gewone gebruikers zien geen Platformbeheer; `/platform/klanten` toont voor hen "Niet gevonden". Dit is gemak, geen beveiliging.
2. **De server weigert.** De middleware `server/middleware/10.platform.ts` geeft 404 op elke `/api/platform/**`-route voor iedereen zonder founderrol, en elk platformendpoint roept zelf `requireFounder(event)` aan. De bouwcheck `pnpm check:platform` faalt als een platformendpoint dat vergeet of als een gewoon scherm een platformroute aanroept.
3. **De database zegt nee.**
   - De app verbindt als `dealtrace_app`. Die is lid van `dealtrace_platform` maar erft niets (`noinherit`): alleen na `set local role dealtrace_platform` (in `alsPlatform()`, na `requireFounder`) werkt hij over organisaties heen.
   - `dealtrace_platform` mag organisaties, gebruikers, teams, instellingen, aanvragen, toegangsverzoeken, gezondheid en `platform_audit`. Klantdata (activiteiten, meldingen lezen, later accounts en contacten) mag hij niet; daarover krijgt hij alleen getallen via `dealtrace_platform_tellingen()`.
   - Een trigger weigert de rol `founder` voor iedereen behalve de migratierol.
   - `platform_audit` is alleen toevoegen, voor iedere rol.

**Verificatie.** Platformendpoints vragen `aal2` (tweestapsverificatie, P27; in de ontwikkelmodus geldt de founder als geverifieerd). Gevaarlijke acties (pakket verlagen, overschakelen naar "Ook wijzigen") vragen een herbevestiging binnen 15 minuten, anders 428 en het venster "Bevestig dat jij het bent". Een platformsessie vervalt na 12 uur stilte.

**Werken in een organisatie.** De founder kiest "Werk in deze organisatie", geeft een reden (minstens 5 tekens) en kiest "Alleen meekijken" (standaard) of "Ook wijzigen". De server zet het cookie `dt_werkin`, ondertekend met `ORG_WISSEL_SECRET` (eigen geheim), met organisatie, modus, reden en vervaltijd (hooguit 8 uur). Daarna:

- is de actieve organisatie die uit het cookie, nooit uit de payload;
- werkt de founder met de rechten van een beheerder, maar in "Alleen meekijken" weigert `server/middleware/20.meekijken.ts` elke schrijfactie in klantdata (ook de sync-wachtrij) met de meekijktekst;
- staat elke start, modewissel en stop in `platform_audit` en in `audit_events` van de klant, en krijgen de beheerders een melding;
- staat bovenaan elke pagina de gele balk met organisatie, modus, resterende tijd en "Terug naar platform".

Kiest de klant "Alleen na toestemming", dan maakt de founder eerst een toegangsverzoek (24 uur geldig); pas na goedkeuring door de beheerder kan hij erin.

**Spiegel voor de beheerder.** Abonnement (pakket in gewone woorden, seats, contract, "Upgrade aanvragen"), Audit en toegang leverancier, en bij Gebruikers "Gebruiker toevoegen" binnen de seats of "Gebruiker aanvragen", volgens de stand die de founder zet. Een aanvraag of upgrade geeft de founder een melding.

**Gezondheid** (`shared/gezondheid.ts`): Leeg, Risico, Let op of Gezond, met vaste regels. Berekend in `org_gezondheid` zodra de stand ouder is dan een uur. Daar ook de proefperiode: melding 7 dagen vooraf en daarna automatisch naar Starter.

**Startset** (`server/utils/orgStarter.ts`): register van onderdelen voor een nieuwe klant; elke latere prompt voegt zijn onderdeel toe. "Startset aanvullen" in de klantflyout draait alles opnieuw en is idempotent.

## Waar staat wat

| Map | Inhoud |
|---|---|
| `shared/` | Rekenregels die server en scherm delen: functies, zijbalk, rechten, feestdagen |
| `server/db/` | Migraties, rollen, seed |
| `server/api/` | API-endpoints |
| `server/utils/` | Sessie, database, audit, zoekbronnen |
| `app/` | Schermen, componenten, composables |
| `tests/unit`, `tests/db`, `tests/e2e` | Tests |
| `tools/checks` | Bouwchecks op catalogus en rechten |
