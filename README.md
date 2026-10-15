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

Open <http://localhost:3000>. Inloggen gaat met een code per mail (geen wachtwoorden):

1. Vul het e-mailadres van een testgebruiker in, bijvoorbeeld `sanne@voltvast.test`, en klik **Stuur mij een code**.
2. Lokaal verstuurt Dealtrace geen echte mail: de mail-mock bewaart de code. Haal hem op met <http://localhost:3000/api/auth/testcode?email=sanne@voltvast.test> (alleen in `AUTH_MODUS=ontwikkel`, nooit online). Gebruik je de Supabase CLI met `RESEND_API_KEY` leeg, dan geldt hetzelfde; een echte mail gaat alleen uit met `RESEND_API_KEY` en nooit naar `.test`-adressen.
3. De founder (`founder@dealtrace.test`) vult daarna een code uit zijn authenticator in. De fictieve testsleutel is `JBSWY3DPEHPK3PXP`; voeg hem toe aan een authenticator-app.

In de ontwikkelmodus staat onder het inlogformulier ook een lijst testgebruikers: klik er een aan om direct in te loggen. Op je telefoon in hetzelfde wifi-netwerk test je met `pnpm dev --host`.

| Testgebruiker | Rol | Niveau | Werkplek |
|---|---|---|---|
| Bram Middelkamp | Accountmanager | Beginner | Buitendienst |
| Anouk Noorderveld, Lieke Nieuwland | Accountmanager | Gevorderd | Buitendienst |
| Sanne Belhuis | Accountmanager | Gevorderd | Binnendienst |
| Eva Ervaren | Accountmanager | Expert | Binnendienst |
| Joost Stuurman | Salesmanager | Expert | Binnendienst |
| Mira Beheer | Beheerder | Expert | Binnendienst |
| Testfounder Dealtrace | Founder (Platformbeheer) | | |
| Tom Tweede (Testorganisatie Tweede) | Beheerder | Expert | Binnendienst |

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

## Online zetten met Netlify en Supabase

Zonder installatie op je laptop: de app draait op Netlify, de database op Supabase (allebei gratis te proberen).

**Wachtwoorden:** gebruik overal alleen letters en cijfers (geen @, #, / of %), anders breken de verbindingsregels.

### 1. Supabase

1. Maak een account op <https://supabase.com> en kies **New project**. Regio: **Central EU (Frankfurt)**. Bedenk een databasewachtwoord en bewaar het.
2. Klik bovenaan op **Connect**. Kies bij *Method* **Session pooler** en kopieer de regel. Die ziet eruit als
   `postgresql://postgres.abcdefgh:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`.
   Vervang `[YOUR-PASSWORD]` door je databasewachtwoord. Dit is **DATABASE_URL_BEHEER**.
3. Maak daarvan **DATABASE_URL** voor de app: vervang `postgres.` door `dealtrace_app.`, het wachtwoord door een nieuw wachtwoord (dat wordt **DATABASE_APP_WACHTWOORD**) en de poort `5432` door `6543`:
   `postgresql://dealtrace_app.abcdefgh:NieuwWachtwoord123@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`

### 2. Netlify

1. Maak een account op <https://netlify.com> en kies **Add new project**, **Import an existing project**, **GitHub**, repository **basresink/dealtrace**, branch **main**. De rest vult `netlify.toml` zelf in.
2. Zet bij **Environment variables**:

| Naam | Waarde |
|---|---|
| `DATABASE_URL_BEHEER` | de Session pooler-regel uit Supabase (scope: alleen *Builds*) |
| `DATABASE_URL` | de regel met `dealtrace_app.` en poort `6543` |
| `DATABASE_APP_WACHTWOORD` | het nieuwe wachtwoord uit die regel |
| `SESSIE_GEHEIM` | een lange willekeurige reeks letters en cijfers (minstens 32 tekens) |
| `TOEGANGSWACHTWOORD` | het wachtwoord dat jij en je testers invullen om de site te openen |
| `ORG_WISSEL_SECRET` | nog een lange willekeurige reeks (minstens 32 tekens), voor "Werk in deze organisatie" |

3. Klik op **Deploy**. Elke deploy werkt de database bij; de fictieve testdata komt er alleen de eerste keer in.

Open daarna de link van Netlify, vul het toegangswachtwoord in en kies een testgebruiker. Elke push naar `main` zet automatisch een nieuwe versie online.

De automatische REST-API van Supabase kan niets met de Dealtrace-tabellen: de migratie ontneemt de rollen `anon` en `authenticated` alle rechten.

## Hoe het werkt

Zie `docs/HOE-HET-WERKT.md` voor rol, niveau, werkplek, features per niveau en de rechtenmatrix.
