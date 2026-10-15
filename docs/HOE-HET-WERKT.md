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
