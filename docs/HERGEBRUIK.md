# Hergebruik van DealDrive in Dealtrace

Dit bestand pint de versie van DealDrive waarop het hergebruik in het bouwplan (Bijlage B en hoofdstuk 8.13) is gebaseerd.

| Gegeven | Waarde |
|---|---|
| Repository | `basresink/dealdrive` |
| Branch | `develop` |
| Commit | `75bee614caf45a399f7f2f7ea077c7a520b00e51` (kort `75bee61`) |
| Datum | 2026-10-14 |
| Laatste commitbericht | "Demo-afspraak om het inspreken te laten zien" |

## Toegang voor de bouwer

De bouwer van Dealtrace (mens of Claude Code) krijgt **leestoegang** tot `basresink/dealdrive`. In een Claude Code-sessie voeg je de repository toe als tweede bron en lees je bestanden op de gepinde commit:

```
git -C ../dealdrive fetch origin develop
git -C ../dealdrive show 75bee61:shared/dexDag.ts
```

Waar leestoegang niet kan, zijn de beschrijvingen in `secties/`, het bouwplan en de bouwprompts in `docs/prompts/` de specificatie.

## Werkwijze

1. Kopieer logica met de tests, niet blind de bestanden. Dealtrace heeft een andere reis, rollen en niveaus, en één build voor telefoon en laptop (ADR-020).
2. Gedeelde pure functies houden waar mogelijk dezelfde bestandsnaam, zodat een fix in de ene repository in de andere te herhalen is.
3. Elk kwartaal een vergelijking met `git diff --no-index` op `shared/` en de gedeelde `server/utils/`; resultaat in het sprintverslag.
4. Wordt een nieuwere commit van DealDrive gebruikt, dan werk je dit bestand bij en controleer je Bijlage B van het bouwplan opnieuw (bestaan de genoemde bestanden nog, zijn ze hernoemd).

## Wat bij deze commit is gecontroleerd

- Alle bestandsnamen die het bouwplan als hergebruik noemt (Bijlage B), waarvan 109 bestaan; hernoemingen staan in Bijlage B.
- De telefoonapp Dex (`app/pages/dex/*`, `app/components/Dex*.vue`, `shared/dex*.ts`, `shared/werkplek.ts`, `shared/werkwijze.ts`), beschreven in hoofdstuk 8.1 en 8.13 van het bouwplan.
