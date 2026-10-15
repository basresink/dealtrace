# Bouwprompts Dealtrace

Elke prompt is uitvoerbaar in één Claude Code-sessie en bestaat uit een functioneel deel (wat en waarom, sjabloon 18.1 van het bouwplan) en een technisch deel (hoe, sjabloon 18.2), met acceptatiecriteria per niveau, de telefoon-eisen uit hoofdstuk 8 en de gaten uit Bijlage A die de prompt oplost.

**Leidend** is `Bouwplan-Dealtrace.md`. Waar een prompt "Niet vastgelegd in het bouwplan; voorstel: ..." zegt, beslist de founder vóór de sprint; het voorstel geldt tot er een besluit is. Testdata komt uit `seed/` (de fictieve startset Voltvast, Bijlage C). Hergebruik uit DealDrive gaat uit van de commit in `docs/HERGEBRUIK.md`.

**Werkwijze per prompt**: lees de paragrafen onder "Lees eerst", bouw, draai de checks uit hoofdstuk 19, test op desktop en telefoon (375, 390 en 412 px) en, per sprint, op een echte iPhone en Android; daarna een adversariële review vóór de commit naar `develop`.

De nummers P01 tot en met P26 zijn gelijk aan versie 1.0 van het bouwplan; P27 tot en met P33 zijn nieuw. De volgorde hieronder is de bouwvolgorde.

| Sprint | Prompt | Naam |
|---|---|---|
| 1 | [P01](P01-fundament-rollen-niveaus.md) | Fundament, rollen, niveaus en functiecatalogus |
| 1 | [P27](P27-inloggen-met-code-mobiele-schil.md) | Inloggen met code en de mobiele schil |
| 1 | [P02](P02-platformbeheer-basis-werken-in-organisatie.md) | Platformbeheer basis en werken in een organisatie |
| 2 | [P03](P03-accounts-contacten-eigen-velden.md) | Accounts, contacten, eigen velden |
| 2 | [P04](P04-import-datakwaliteit.md) | Import en datakwaliteit |
| 3 | [P28](P28-verkoopverhaal-leesmodel-richting.md) | Verkoopverhaal: leesmodel, eigen inrichting en Richting |
| 3 | [P29](P29-salesdna-koppeling-webhooks-spiegel.md) | SalesDNA-koppeling: webhooks, spiegel en projectie |
| 4 | [P05](P05-standaard-prospectreis-statusmachine.md) | Standaard prospectreis, statusmachine en terugkomregels |
| 4 | [P06](P06-motor-regels-accountmatrix.md) | Motor, regels en accountmatrix |
| 5 | [P07](P07-taken-inzichten-vandaag-hercontactritme.md) | Taken, inzichten, Vandaag en hercontactritme |
| 5 | [P32](P32-dagritme-kern-vandaag-telefoon.md) | Dagritme-kern en Vandaag op de telefoon |
| 5 | [P08](P08-mandaten-bewaker-planner.md) | Mandaten, Bewaker, Planner |
| 5 | [P09](P09-helpcenter-basis-features-per-niveau.md) | Helpcenter basis en features per niveau |
| 5 | [P33](P33-ai-assistent-credits.md) | AI-assistent en credits |
| 6 | [P10](P10-belblokken-belmodus-belscripts.md) | Belblokken, belmodus en belscripts |
| 6 | [P12](P12-prospectplanning-terugkomregels.md) | Prospectplanning en terugkomregels in de planning |
| 7 | [P11](P11-leadgenerator-ai-zoeker-kvk.md) | Leadgenerator, AI-zoeker en KvK |
| 7 | [P15](P15-datacollectief.md) | Datacollectief |
| 8 | [P13](P13-agenda.md) | Agenda, meetingsoorten, agendakoppeling |
| 8 | [P14](P14-bezoeken.md) | Bezoeken, kansen langs de route, gebieden |
| 8 | [P30](P30-onderweg.md) | Onderweg: route, bezoek afronden, inloop, in de buurt, offline dag |
| 8 | [P31](P31-spraak.md) | Spraak, visitekaartje en onderweg-meldingen |
| 9 | [P16](P16-campagnes.md) | Campagnes |
| 9 | [P17](P17-funnel-overdracht.md) | Funnel van de prospectreis en overdracht |
| 9 | [P18](P18-briefings.md) | Briefings, Pitstop, Schrijver, mail |
| 10 | [P19](P19-agents.md) | Agents voor interne en externe bronnen |
| 10 | [P20](P20-crm-koppeling.md) | CRM-koppeling |
| 11 | [P21](P21-team-coaching-analyse.md) | Team, coaching, analyse |
| 11 | [P22](P22-maatwerk-prospectreizen.md) | Maatwerk prospectreizen |
| 11 | [P23](P23-salesdna-suggesties-en-overdracht.md) | Suggesties naar SalesDNA en overdracht naar DealDrive |
| 12 | [P24](P24-platformbeheer-compleet.md) | Platformbeheer compleet |
| 12 | [P25](P25-helpcenter-academie.md) | Helpcenter compleet en academie |
| 12 | [P26](P26-kanalen-push-whatsapp-toestellen.md) | Kanalen, push, WhatsApp en tests op echte toestellen |

## Lokaal bouwen

Je bouwt en test Dealtrace op je eigen computer: de Nuxt-ontwikkelserver (`pnpm dev`), Supabase lokaal via de Supabase CLI in Docker Desktop, de startset Voltvast met `pnpm seed`, AI op de mock-provider (`AI_PROVIDER=mock`) en alle koppelingen op hun mock (`seed/dealdrive-mock/`, `seed/webhooks/`). Geheimen staan alleen in `.env.local`. Zie 13.5 van het bouwplan voor de volledige lijst en wat je nodig hebt.
