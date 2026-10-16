# Sprintverslag P26: kanalen, push, WhatsApp en toestellen

## Gebouwd en getest in deze omgeving

- **Unit-tests** (`tests/unit/kanalen.test.ts`): `magMelden` op de grenzen (18:59 en 19:00, zaterdag, zesde en zevende onderweg-melding, belblok en rijmodus), `bundel`, `kanalenVoor`, `houdtVast`, `magWhatsapp` (opt-in, sjabloon, afkoeling dag 179 en 180, frequentieplafond met Kerst 2026), `waLink`, `staatOpBelMeNiet`, `controleerSjabloon`, de webhookhandtekening en de opt-out.
- **Db-tests** (`tests/db/kanalen.test.ts`): de verzender (mail per soort, in de app uit wordt verborgen, stille uren, rijmodus en daarna één gebundelde push), WhatsApp zonder opt-in (geblokkeerd en gelogd), met opt-in (via de mock, in de activiteitenlog), het frequentieplafond, de opt-out via de webhook, een uitgezet kanaal en RLS op sjablonen en de bel-me-niet-lijst.
- **Rooktest**: schermafbeeldingen van `/meldingen`, Mijn instellingen en `/instellingen/kanalen` op laptop en op 390 px.

## Nog niet uitgevoerd (vraagt echte toestellen of staging)

| Onderdeel (8.15, 8.14, 13.4) | Stand |
|---|---|
| Toestelmatrix: iPhone SE, iPhone 15 of 16, Samsung Galaxy A, Pixel 7, iPad | Niet getest; deze omgeving heeft geen echte toestellen |
| Push op iPhone (geïnstalleerde PWA) en Android, met stille uren en dagplafond | Niet getest; VAPID-sleutels staan nog niet in Netlify |
| Vijf handmatige scenario's (buitendienstdag, vliegtuigmodus, zon en handschoenen, carkit, accu) | Niet uitgevoerd |
| VoiceOver, TalkBack, tekstvergroting tot 200 procent | Niet uitgevoerd |
| Prestatiebudgetten op staging (LCP 2,5 s, interactief 3,5 s, bundel 250 KB, 13.4) | Niet gemeten |
| Playwright op 375, 390 en 412 px met referentieschermafbeeldingen | De projecten staan klaar; de volledige ronde draait in de e2e-eindronde |

Deze punten horen bij de Definition of Done van sprint 12 en vragen iemand met de toestellen in de hand.
