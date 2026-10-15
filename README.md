# Dealtrace

Werkplek voor new business van accountmanagers binnendienst en buitendienst, tot en met de eerste afspraak.
Het bouwplan staat in `Bouwplan-Dealtrace.md`; de bouwprompts in `docs/prompts/`. Deze code is bouwprompt **P01: fundament, rollen en niveaus**.

## Lokaal draaien op je laptop

### Eenmalig installeren

1. **Node.js 22** of nieuwer: <https://nodejs.org> (kies LTS).
2. **pnpm**: open PowerShell en typ `corepack enable`. Lukt dat niet, dan `npm install -g pnpm`.
3. **Docker Desktop**: <https://www.docker.com/products/docker-desktop>. Start het programma één keer, zodat de walvis rechtsonder staat.
4. **Git**: <https://git-scm.com>.

### Code ophalen

```powershell
cd C:\Projecten
git clone https://github.com/basresink/dealtrace.git Dealtrace
cd Dealtrace
```

Heb je de map al, haal dan de nieuwste stand op met `git pull`.

### Starten

```powershell
copy .env.example .env      # op Mac of Linux: cp .env.example .env
pnpm install
pnpm db:up                  # start Postgres 16 in Docker
pnpm db:migrate             # maakt tabellen, RLS en de rol dealtrace_app
pnpm seed                   # fictieve testdata: Testbedrijf Voltvast
pnpm dev
```

Open <http://localhost:3000>. Je ziet een lijst testgebruikers; klik er een aan om in te loggen. Inloggen met een code per mail komt in P27.

| Testgebruiker | Rol | Niveau | Werkplek |
|---|---|---|---|
| Bram Middelkamp | Accountmanager | Beginner | Buitendienst |
| Anouk Noorderveld, Lieke Nieuwland | Accountmanager | Gevorderd | Buitendienst |
| Sanne Belhuis | Accountmanager | Gevorderd | Binnendienst |
| Eva Ervaren | Accountmanager | Expert | Binnendienst |
| Joost Stuurman | Salesmanager | Expert | Binnendienst |
| Mira Beheer | Beheerder | Expert | Binnendienst |
| Testfounder | Founder | | |

Alle data is fictief (e-mailadressen op `.test`). Gebruik nooit echte klantdata.

### Handige commando's

| Commando | Wat het doet |
|---|---|
| `pnpm db:reset` | Database leeg en opnieuw vullen met testdata |
| `pnpm test` | Unit-tests (rekenregels, zijbalk, feestdagen, rechten) |
| `pnpm test:db` | RLS- en rechtentests op een wegwerpdatabase naast je eigen database |
| `pnpm test:e2e` | Schermtests en API-tests in Chromium, desktop en telefoon (375, 390, 412 px). Eenmalig: `pnpm exec playwright install chromium` |
| `pnpm check` | Bouwchecks op de functiecatalogus en de rechtenmatrix, plus unit-tests |
| `pnpm typecheck` | TypeScript-controle |

### Zonder Docker: Supabase lokaal

Heb je de Supabase CLI, start dan `supabase start` in plaats van `pnpm db:up` en zet in `.env`:

```
DATABASE_URL_BEHEER=postgresql://postgres:postgres@127.0.0.1:54322/postgres
DATABASE_URL=postgresql://dealtrace_app:dealtrace_app@127.0.0.1:54322/postgres
```

Daarna gewoon `pnpm db:migrate`, `pnpm seed` en `pnpm dev`.

### Problemen

- **Poort 5432 bezet**: er draait al een andere Postgres. Stop die, of zet in `docker-compose.yml` en `.env` een andere poort (bijvoorbeeld 5433).
- **`pnpm db:up` faalt**: Docker Desktop draait niet. Start het en probeer opnieuw.
- **Inloggen lukt niet na een reset**: wis de cookies van localhost of log uit via het gebruikersmenu.

## Hoe het werkt

Zie `docs/HOE-HET-WERKT.md` voor rol, niveau, werkplek, features per niveau en de rechtenmatrix.
