# P08: Mandaten, Bewaker, Planner

| Onderdeel | Waarde |
|---|---|
| Sprint | 5 |
| Features | 11.3 Agents en mandaten (fundament voor alle agents), met de Bewaker en de Planner als eerste twee agents; de toets op AI-credits vóór elke AI-handeling van een agent (11.2, 11.4) |
| Hangt af van | P01 (rollen, niveaus, functiecatalogus, audit, instellingen), P02 (pakket per organisatie, platformmaxima), P05 (statusmachine, afkoelperiodes, `magBenaderen`), P06 (motorrun, `landingsmoment`, capaciteit), P07 (taken, hercontactritme, `rondTaakAf`) |
| Bron in het bouwplan | Hoofdstuk 11 (11.1 tot en met 11.4), 3.3 (rij Agentmandaten), 4.3 (rij F14), F14 (agentpagina, "Agents pauzeren", "Vandaag tegengehouden door de Bewaker"), F15 (capaciteit en landing), F23 (AI-verbruik, platformmaxima), F26 (Credits), 13.3 (flow 5), 15.2, 19, ADR-005, ADR-007, Bijlage A (gat 14, 16, 22) |

## Lees eerst

- `Bouwplan-Dealtrace.md`: 0.2 (B20), 1 (drie harde principes), 2.1, 3.3, 4.2 en 4.3, 7.2, hoofdstuk 11 volledig, F14 (Agentpagina en Regels), F15 (Regels van de motor), F16 (afkoelperiodes en frequentieplafond), F23 (AI-verbruik, AI-koppeling), F26 (Credits en Technisch), 10.2 (`agent_runs`, `tasks.executor`, `tasks.executor_status`), 13.3, 15.2, 19, ADR-005 en ADR-007, Bijlage A, Bijlage B (rij AI).
- DealDrive op commit 75bee61 (alleen lezen): `server/utils/llm-provider.ts`, `server/utils/agentExecutor.ts` (`executorStatus` en `bereidTaakVoor`), `server/utils/aiVerbruik.ts` (`leesVerbruik`, `plafondStand`), `shared/aiBundel.ts` (`BUNDEL_SOORTEN`, `LET_OP_VANAF`, `OVER_VANAF`, `standVoor`; basis voor de credits in P33), `server/utils/promptBibliotheek.ts`, `server/utils/promptStandaarden.ts`, `shared/promptSlots.ts`, `server/utils/aiInsight.ts`, `server/utils/autoVoorbereiding.ts`, `server/utils/ruleEngine.ts` (`logAgentRun`), `server/utils/belblokVuller.ts`, `server/utils/dexPlafond.ts`, `server/utils/dexKaart.ts` (de zes `executorStatus`-waarden in `PITSTOP_STATUS`).

## Deel 1: Functioneel (wat en waarom)

### Wat je bouwt

Je bouwt het mandaatmodel in vier niveaus, de Bewaker die elke agenthandeling vooraf toetst, de Planner die pogingen plant en taken laat landen binnen de capaciteit, en de toets op AI-credits die vóór elke AI-handeling van een agent blokkeert. De credits zelf (`shared/credits.ts` met `creditsVoor`, `magVragen` en `creditsStand`) levert P33 AI-assistent en credits in dezelfde sprint (B20).

### Waarom

Een van de drie harde principes van Dealtrace is: AI handelt nooit buiten zijn mandaat en verstuurt nooit een eerste bericht zonder goedkeuring (1). Elke latere agent (Zoeker, Verrijker, Waarnemer, Schrijver, Verzender) loopt door dezelfde poort, dus die poort moet er eerst zijn. In DealDrive stond het AI-plafond standaard uit, gold het alleen op de motor en kwam er geen melding bij 80 procent (Bijlage A, gat 14), en had `executorStatus` vier waarden die nergens werden gezet (gat 22).

### Gebruikers en niveaus

| Rol | Niveau | Wat |
|---|---|---|
| Accountmanager | Beginner | Ziet resultaten van agents met de mandaatletter (alleen in de flyout bij Expert zichtbaar als code, 4.4). Schrijver: elk concept per stuk goedkeuren; Verzender uit (elke mail als concept, C) |
| Accountmanager | Gevorderd | Agentpagina alleen lezen; Verzender B binnen een door de salesmanager goedgekeurde campagne |
| Accountmanager | Expert | Verzender B met eigen dagplafond tot het organisatiemaximum; ziet "Waarom niet?" (handelingen die de Bewaker tegenhield) bij inzichten; eigen mandaat binnen het organisatiemaximum |
| Salesmanager | Gevorderd of Expert | Agentmandaten lezen (3.3); keurt campagnes goed die mandaat B mogelijk maken; verbruik van het team lezen |
| Beheerder | Expert | Mandaten per agent zetten binnen de platformmaxima; "Agents pauzeren"; ziet "Vandaag tegengehouden door de Bewaker" |
| Founder | n.v.t. | Zet de platformmaxima (F23); credits per pakket en de prijs per handeling zet hij in Platformbeheer (P33, P24); ziet AI-kosten in euro's per model en soort |

### Mandaat per agent en per gebruikersniveau

Mandaatniveaus: **A** autonoom (doet het zelf, logt het, de mens ziet het achteraf), **B** autonoom binnen een goedgekeurd kader, **C** per stuk goedkeuren, **D** altijd mens. Harde grenzen: D blijft D; nooit zonder consent of in een afkoelperiode; nooit buiten het ritme; nooit een template, regel of verhaal wijzigen; alles herleidbaar; stopknop "Agents pauzeren".

| Agent | Organisatiemaximum | Beginner | Gevorderd | Expert |
|---|---|---|---|---|
| Zoeker, Verrijker, Waarnemer, Profielbouwer, Planner, Notulist, Coach, Gids | A | A | A | A |
| Schrijver | A voor concepten | A (concept); elk concept per stuk goedkeuren | A | A |
| Verzender | B voor vervolgmails, C voor de eerste mail en elke mail aan een beslisser | uit; elke mail als concept (C) | B binnen een door de salesmanager goedgekeurde campagne | B met eigen dagplafond tot het organisatiemaximum |
| Berichtgever, LinkedIn-assistent | C (LinkedIn-assistent C en D) | C | C | C |
| Bewaker | A, kan alleen blokkeren en melden | altijd aan | altijd aan | altijd aan |

### Schermen

**Agents en mandaten** (`/instellingen/agents`; beheerder, alleen lezen voor Gevorderd en hoger). De volledige pagina met Waarnemer-instellingen hoort bij F14 (P19). Niet vastgelegd in het bouwplan; voorstel voor de knip: P08 bouwt de onderdelen die over mandaten en de Bewaker gaan, P19 voegt het instellen van de Waarnemer en de bronnen toe. Van boven naar beneden:

1. Kop met kruimelpad "Instellingen · Data en AI", titel "Agents en mandaten". Rechts de gevaarknop **"Agents pauzeren"** (rood, met bevestiging).
2. Kaart **"Mandaten in vier niveaus"**: A autonoom, B binnen een goedgekeurd kader, C per stuk goedkeuren, D altijd mens, met de harde grenzen eronder. Mandaatpillen volgens 14: A zwart met geel, B geel met inkt, C wit met inktrand, D gestippeld.
3. **Tabel van agents**: agent, mandaat (keuze tot het platformmaximum), dagplafond, vandaag gedaan, aan of uit. Een agent waarvan de feature nog niet gebouwd is, staat er met "Komt later" (Niet vastgelegd in het bouwplan; voorstel).
4. Kaart **"Vandaag tegengehouden door de Bewaker"** met per regel de reden ("Geen consent voor WhatsApp", "Afkoelperiode mail tot 3 december", "Dagplafond bereikt").
5. Kaart **AI-credits van de agents deze maand**: per AI-soort de credits die agents verbruikten tegen hun dagplafond, en de stand van de pot uit `creditsStand` (P33) met "let op" vanaf 80 procent; onder 10 procent van de pot staan de agents stil (11.4). De beheerder ziet credits, geen euro's (F23).

Bevestiging bij "Agents pauzeren": titel als vraag ("Alle agents pauzeren?"), in de tekst het gevolg ("Alle B-handelingen stoppen direct. Lopende ritmes gaan als taak naar de mens."), knop "Pauzeren" in rood. Daarna een gele strook bovenaan de pagina "Agents staan op pauze sinds 2026-10-14 10:12" met "Hervat". Niet vastgelegd in het bouwplan; voorstel voor de teksten van de strook en "Hervat".

Lege staat van "Vandaag tegengehouden": Niet vastgelegd in het bouwplan; voorstel: "De Bewaker heeft vandaag niets tegengehouden."

**Creditsmeldingen.** De melding bij 80 procent aan beheerder en gebruikers (F24, soort "AI-credits op 80 procent") en de blokkade bij 0 met "De AI-credits van deze maand zijn op. Je beheerder kan extra credits aanvragen." bouwt P33. Deze prompt zorgt dat agents en motorrondes stoppen bij 10 procent van de pot, zodat er credits overblijven voor wat gebruikers zelf vragen (11.4), en dat een tegengehouden handeling als taak naar de mens gaat met de reden ("Tegengehouden door de Bewaker: minder dan 10 procent AI-credits over"). Niet vastgelegd in het bouwplan; voorstel voor de tekst van de reden.

**Op een record.** Elke handeling van een agent op een taak of inzicht toont wie het deed met mandaatletter (F14). Een taak die de Bewaker naar de mens zette, toont in de aanleiding de reden ("Tegengehouden door de Bewaker: afkoelperiode mail tot 3 december").

**Telefoon (390 px).** Instellingen staan bewust niet op de telefoon (8.12): `/instellingen/agents` opent met "Beter op een groot scherm" in één kolom. De creditsmelding en de reden van de Bewaker op een taak zijn op de telefoon volledig leesbaar.

### Klikpaden

1. **Mandaat verlagen.** De beheerder kiest bij de Schrijver mandaat C in plaats van A; opslaan na 600 ms; auditregel; vanaf nu wacht elk concept op goedkeuring per stuk.
2. **Mandaat boven het platformmaximum.** De keuzelijst toont alleen niveaus tot het platformmaximum; een directe API-aanroep met een hoger niveau geeft 422.
3. **Agents pauzeren.** Klik de rode knop, bevestig; de Verzender stopt direct, de volgende mails komen als taak bij de mens; toast "Agents gepauzeerd."
4. **Bewaker houdt tegen.** De Planner wil een belpoging plannen voor een account in afkoeling; de Bewaker weigert met reden; de handeling verschijnt in "Vandaag tegengehouden" en in `agent_runs`; er komt geen taak.
5. **Credits op.** Een gebruiker vraagt een belscript-invulling (1 credit, 11.4) als de pot op 0 staat; de server weigert vóór de aanroep met "De AI-credits van deze maand zijn op. Je beheerder kan extra credits aanvragen." en het script valt terug op vaste teksten (F08).
6. **Planner landt een taak.** De motor maakt een beltaak voor de binnendienst; de Planner zet de vervaldatum op het eerstvolgende passende belblok of, zonder belblok, op het volgende werkmoment; boven het dagplafond van 40 schuift hij naar de volgende werkdag met een melding.

### Regels

- **Hoe een agent werkt** (11.3): 1. voorstel (uit een regel, ritme, trigger of job), 2. Bewaker `magHandelen(agent, handeling, account, contact, nu)`, 3. uitvoering: A en B direct met een rij in `activiteiten` en `agent_runs`, C als taak met concept, D als taak met voorbereiding.
- **De Bewaker toetst** mandaat, consent, afkoeling, ritme, capaciteit, AI-credits en werkuren. Hij kan alleen blokkeren en melden; hij voert zelf nooit iets uit. Elke blokkade wordt gelogd met reden.
- **Mandaat effectief** = het laagste van platformmaximum, organisatiemaximum, gebruikersniveau en eventueel eigen mandaat (Expert). D blijft D; een gepauzeerde organisatie zet alles van B naar de mens.
- **Werkuren**: Niet vastgelegd in het bouwplan; voorstel: de werkdag uit 8.13 (08:00 tot 18:00) en de werkdagen met feestdagen uit `shared/datum.ts`; buiten werkuren schuift een B-handeling naar het volgende werkmoment.
- **Planner** (mandaat A): plant pogingen volgens het ritme, vult belblokken, landt taken op regiodagen, bewaakt capaciteit. Capaciteit per uitvoerder: binnendienst 40 beltaken per dag, buitendienst 6 bezoeken per regiodag; wat erboven valt schuift naar de volgende werkdag en wordt gemeld (F15). Landing: binnendienst het eerstvolgende passende belblok, buitendienst de regiodag van het account. Belblokken (P10) en regiodagen (P14) bestaan nog niet; tot dan landt de Planner op `volgendWerkmoment`.
- **Plafond in credits** (11.2, 11.4, gat 14): één pot AI-credits per organisatie per maand voor alle AI; standaard aan voor elke AI-soort; reservering vóór de aanroep en definitief na afloop; een mislukte aanroep kost niets. Elke handeling kost een vast aantal credits, ongeacht het model: AI-assistent gewone vraag 1, met accountgegevens of lang antwoord 2 tot 5, webonderzoek 10; zoekronde 20; dossier 10; inzicht-beoordeling 1; concept (Pitstop, boodschap) 2; belscript-invulling 1; Notulist 5; brief en buying committee 3; coach en verbetervoorstel 20; spraakopdracht 1 en visitekaartje 2; transcriptie 1 per begonnen minuut. Die prijzen staan alleen in `creditsVoor(soort, context)` in `shared/credits.ts` (P33); de founder past ze aan zonder release.
- **Agents en credits** (11.4): automatische AI (agents, motorrondes) stopt bij 10 procent van de pot; de beheerder kan per AI-soort een dagplafond voor de agents zetten. De pot per pakket (Starter 200, Plus 600, Compleet 1.500 credits per gebruiker per maand, samen in één pot) en welke AI-soorten per pakket aanstaan, staan in 11.4 en komen met P33. KvK-bevragingen en Datacollectief-records zijn geen AI en vallen buiten de credits (P11, P15).
- **Meting van overname**: per concept ongewijzigd, aangepast of verworpen; KPI per agent (11.2).
- **Geen privégegevens**: privémail en privémobiel worden gemaskeerd vóór elke aanroep (11.2, 15.2).

### Helpartikelen

- "Agents en mandaten" (collectie Hoe werkt Dealtrace, categorie Inrichten): de vier niveaus, de harde grenzen, mandaat per niveau, de Bewaker, pauzeren.
- "Abonnement, verbruik en AI-credits" (Inrichten): de credits zelf beschrijft P33, het abonnement P24. Niet vastgelegd in het bouwplan; voorstel: P08 levert de alinea over agents (stoppen bij 10 procent van de pot, dagplafond per AI-soort).

## Deel 2: Technisch (hoe)

### Datamodel

- `agent_runs` (10.2, F14): Niet vastgelegd in het bouwplan in kolommen; voorstel: `id, organisation_id, agent, handeling, mandaat_niveau ('A'|'B'|'C'|'D'), gebruiker_id?, account_id?, contact_id?, task_id?, uitkomst ('uitgevoerd'|'als_taak'|'geblokkeerd'|'fout'), reden?, bronnen jsonb, kosten jsonb {soort, credits, cent?}, op`. Bewaartermijn 13 maanden (15.2).
- `tasks.executor` (`'mens'|'ai'` plus de agentnaam in `data.agent`) en `tasks.executor_status`: alleen waarden die gebruikt worden (gat 22). DealDrive kende `wacht`, `bezig`, `concept-klaar`, `goedgekeurd`, `uitgevoerd`, `mislukt`, waarvan alleen `concept-klaar` werd gezet. Niet vastgelegd in het bouwplan; voorstel: `concept-klaar`, `goedgekeurd`, `uitgevoerd`, `tegengehouden`, elk met precies één schrijver in de code, en `tasks.data.mandaat` met de letter per handeling.
- Mandaatinstellingen: Niet vastgelegd in het bouwplan; voorstel: instellingssleutel `agentmandaten` in `org_settings` (`{agent: {mandaat, dagplafond, aan}}`), `agentCreditsPerSoort` (dagplafond in credits per AI-soort) en `agentenGepauzeerd {sinds, door}`; platformmaxima in een platformtabel die alleen de founder schrijft (F23) en die als `VERBORGEN_KEYS` nooit via de klantinstellingen te schrijven is (F22).
- `users.data.mandaat` voor het eigen mandaat van een Expert (voorstel).
- Credits: de tabellen `ai_credits` en `ai_credit_plafonds` (F26) en de boeking maakt P33; deze prompt schrijft per agenthandeling de AI-soort en de credits in `agent_runs`. `lead_verbruik` (F02) blijft voor KvK en Datacollectief, buiten de credits. `llm_prijzen` (11.4) houdt de kosten in euro's per model bij.
- RLS `org_isolation` op alle nieuwe tabellen; `agent_runs` alleen toevoegen.
- Rechtenmatrix (3.3): agentmandaten accountmanager lezen, salesmanager lezen, beheerder schrijven binnen platformmaxima, founder platformmaxima zetten.
- Sync-allowlist: geen nieuwe mutatie; mandaten en pauzeren alleen via de endpoints.

### Pure functies

| Functie | Invoer | Uitvoer | Randgevallen en unit-tests |
|---|---|---|---|
| `effectiefMandaat(agent, platform, organisatie, niveau, eigen?, gepauzeerd)` | | A, B, C of D | Beginner met Verzender geeft C; gepauzeerd zet B naar C; D blijft D; eigen mandaat boven organisatie wordt afgekapt |
| `magHandelen(agent, handeling, account, contact, nu, context)` | context met mandaat, consent, afkoeling, ritmestand, capaciteit, creditsstand, werkuren | `{mag, uitvoering: 'direct'|'als_taak_concept'|'als_taak_mens'|'geblokkeerd', reden?}` | afkoeling precies op de grens; geen consent voor WhatsApp; account in ander ritme; credits onder 10 procent voor een agent; zaterdag; dagplafond bereikt |
| `agentMagAi(creditsStand, soort, dagplafond, verbruiktVandaag)` | stand uit `creditsStand` (P33), AI-soort | `{mag, reden?}` | precies 10 procent van de pot; 9,9 procent; dagplafond per soort bereikt; AI-soort niet aan in het pakket; pot 0 |
| `landingsmoment(taak, gebruiker, blokken, regiodagen)` | uit P06 | datum en tijd | hier hergebruiken, niet kopiëren |
| `verdeelCapaciteit(taken, plafonds, nu)` | uit P06 | `{geland, geschoven}` | hier hergebruiken |
| `planPoging(stand, ritme, nu)` | ritmestand | taakvoorstel met kanaal en datum | laatste stap; account in afkoeling |
| `maskeerPrive(materiaal)` | tekst en velden | gemaskeerd materiaal | privémobiel, privémail, zakelijk nummer blijft |

Bestanden: `server/utils/agents/bewaker.ts`, `server/utils/agents/planner.ts` met `draai(context)` (11.3), de rekenfuncties in `shared/mandaat.ts` (Niet vastgelegd in het bouwplan; voorstel voor de naam). De credits komen uit `shared/credits.ts` van P33; bouw tegen de functies uit F26 (`creditsVoor`, `magVragen`, `creditsStand`) en gebruik tot P33 klaar is een stub met dezelfde handtekening.

### Endpoints

| Methode en route | Recht | Invoer | Uitvoer | Fouten |
|---|---|---|---|---|
| `GET /api/agents` | Gevorderd en hoger | | stand per agent, tellers, tegengehouden vandaag | 403 bij Beginner |
| `PUT /api/agents/:agent/mandaat` | beheerder; Expert voor het eigen mandaat | `{mandaat, dagplafond?, aan?}` | agent | 422 boven het maximum of bij Bewaker uit; 403 |
| `POST /api/agents/pauzeer` | beheerder | `{pauze: boolean}` | stand | |
| `GET /api/agents/credits` | beheerder, salesmanager (team lezen) | maand | per AI-soort de credits van de agents en het dagplafond | (Niet vastgelegd in het bouwplan; voorstel voor de route) |
| `GET /api/agents/tegengehouden?datum=` | beheerder; Expert voor eigen accounts | | blokkades met reden | (voorstel) |

De providerlaag (`server/utils/llm-provider.ts`) roept vóór elke aanroep `magVragen` uit `shared/credits.ts` (P33) aan, voor agents ook `agentMagAi`, en weigert met 402 en de melding uit 11.4; de motor roept voor elke agenthandeling `magHandelen` aan. Een endpoint dat de Bewaker omzeilt, bestaat niet: een bouwcheck faalt als een module in `server/utils/agents/` een schrijfactie doet zonder voorafgaande `magHandelen` (Niet vastgelegd in het bouwplan; voorstel, naar het voorbeeld van `check:platform`).

### AI-stappen

Bewaker en Planner gebruiken geen AI. Wel geldt voor elke AI-stap die vanaf nu gebouwd wordt: schema op elk antwoord (tool-use met JSON-schema, `additionalProperties false`, één keer opnieuw, daarna fout zonder opslag), bewijsplicht, bronvermelding, namenfilter, mock met vaste fixtures (11.2). Deze prompt levert de gemeenschappelijke schil: `voerAiStapUit(soort, prompt, schema, materiaal)` in de providerlaag met creditscheck (reservering en boeking via P33), maskering, schemavalidatie en logging in `agent_runs` (Niet vastgelegd in het bouwplan; voorstel voor de naam).

### Integraties

Geen nieuwe. De AI-provider loopt via `llm-provider.ts` met mock-provider (13.1).

### Functiecatalogus

Niet vastgelegd in het bouwplan; voorstel:

| Sleutel | Startindeling: aan vanaf | Pakket | Recht | Helpartikel |
|---|---|---|---|---|
| `agents.lezen` | Gevorderd | Starter | iedereen | Agents en mandaten |
| `agents.eigenMandaat` | Expert | Plus | accountmanager | Agents en mandaten |
| `agents.beheer` | Expert | Starter | beheerder | Agents en mandaten |
| `agents.waaromNiet` | Expert | Plus | iedereen | Agents en mandaten |
| `verbruik.lezen` | Gevorderd | Starter | salesmanager | Abonnement, verbruik en AI-credits |

### Hergebruik uit DealDrive

- `server/utils/llm-provider.ts`: providerlaag met mock; voeg de creditscheck en maskering toe vóór elke aanroep.
- `server/utils/aiVerbruik.ts` en `shared/aiBundel.ts`: zijn de basis voor `shared/credits.ts` in P33 (F26); neem hier alleen het patroon over dat het plafond standaard aan staat op alle soorten (gat 14). Bundels en handelingen-tellingen vervallen (B20).
- `server/utils/agentExecutor.ts`: de manier waarop een concept aan een taak hangt; vervang `executorStatus` door de beperkte set waarden (gat 22) en voeg de mandaatletter toe.
- `server/utils/ruleEngine.ts` (`logAgentRun`): basis voor `agent_runs`.
- `server/utils/autoVoorbereiding.ts`: stap "automatisch voorbereiden" in de motorrun, nu achter `magHandelen`.
- `server/utils/dexPlafond.ts`: patroon voor dagplafonds.

### Buiten scope

- De andere agents zelf: Zoeker (P11), Verrijker, Waarnemer, Profielbouwer, Notulist (P19), Schrijver en Verzender (P16, P18), Coach (P21), Gids (P25).
- Belblokvuller (P10) en regiodagen (P14); de Planner gebruikt ze zodra ze bestaan.
- De credits zelf: pot per organisatie, reservering en boeking, melding bij 80 procent, plafond per gebruiker en de AI-assistent (P33 AI-assistent en credits, sprint 5).
- Platformbeheer van credits per pakket, extra credits, prijs per handeling en platformmaxima in de founderschermen (P24); deze prompt leest de waarden en levert de founder alleen een endpoint achter `requireFounder`. Niet vastgelegd in het bouwplan; voorstel.
- Achterstallige facturen die AI-werk pauzeren (F23, P24).

## Acceptatiecriteria

1. Bijlage A, gat 14: elke AI-aanroep van een agent of motorronde loopt vóór de aanroep door de creditscheck, standaard aan voor alle AI-soorten uit 11.4; agents stoppen onder 10 procent van de pot; getest met een stub van `shared/credits.ts` tot P33 klaar is, daarna met de echte functies (de melding bij 80 procent toetst P33).
2. Bijlage A, gat 22: `tasks.executor_status` kent alleen waarden die de code zet; een test zoekt per waarde de schrijver en faalt bij een waarde zonder schrijver; elke agenthandeling draagt de mandaatletter.
3. Bijlage A, gat 16: mandaatniveaus en AI-soorten staan elk één keer in `shared/`; de prijs per handeling staat alleen in `shared/credits.ts`.
4. `magHandelen` weigert in elk van deze gevallen met de juiste reden: geen consent, afkoelperiode, buiten het ritme, capaciteit vol, credits onder 10 procent of dagplafond per AI-soort bereikt, buiten werkuren, mandaat D. Elke weigering staat in `agent_runs` met `uitkomst='geblokkeerd'`.
5. Een Beginner heeft voor de Verzender effectief mandaat C, ook als de organisatie B toestaat; een Gevorderde krijgt B alleen binnen een goedgekeurde campagne; een Expert met een eigen dagplafond kan niet boven het organisatiemaximum.
6. "Agents pauzeren" stopt alle B-handelingen direct; een daarna geplande vervolgmail wordt een taak voor de mens (test met de mock-Verzender).
7. De Planner houdt het dagplafond van 40 beltaken aan: 45 taken voor één gebruiker geven 40 op vandaag en 5 op de volgende werkdag met één melding; een tweede run verandert niets.
8. Mandaat boven het platformmaximum via de API geeft 422; een beheerder kan de platformmaxima niet via `PUT /api/settings` schrijven (wegwerp-Postgres).
9. Privémobiel en privémail staan nooit in het materiaal van een AI-aanroep (test op de opgeslagen promptinvoer van de mock).
10. Elke AI-aanroep zonder geldig schema-antwoord wordt één keer herhaald en daarna als fout gelogd zonder opslag.
11. Op Starter staat de AI-soort belscript-invulling niet aan (11.4): het script werkt met vaste teksten en terugvalzinnen zonder AI-aanroep (F08); met een pot op 0 geeft de server 402 met "De AI-credits van deze maand zijn op. Je beheerder kan extra credits aanvragen."
12. Cross-tenant: `agent_runs` en mandaten van organisatie A zijn onzichtbaar voor B; een founder in "Alleen meekijken" kan geen mandaat wijzigen.
13. Per niveau getest: Beginner ziet `/instellingen/agents` met kicker "Nog niet aangezet" en uitleg en krijgt 403 op `GET /api/agents`; Gevorderd ziet de pagina alleen lezen; Expert kan zijn eigen mandaat zetten binnen het maximum en ziet "Waarom niet?".
14. Telefoon (375, 390, 412 px): `/instellingen/agents` opent met "Beter op een groot scherm" zonder horizontale scroll; de reden van de Bewaker op een taak is in het schuifvenster leesbaar; knoppen minimaal 44 px.
15. Testdata: Voltvast-startset (Bijlage C). Niet vastgelegd in het bouwplan; voorstel: een fictieve prospect in br-02 met status nee (reden "Geen interesse", afkoeling mail 60 dagen) als vast geval voor de Bewaker.

## Definition of Done

Hoofdstuk 19 geldt volledig. Specifiek voor deze prompt:

- Elke agenthandeling loopt via de Bewaker (19: "elke agenthandeling via de Bewaker"); de bouwcheck op `server/utils/agents/` is groen.
- Databasevrije suite voor `magHandelen`, `effectiefMandaat`, `agentMagAi` en de Planner met de mock-provider; wegwerp-Postgres voor RLS, `agent_runs` en de rechten op mandaten.
- Golden master voor de gemeenschappelijke AI-schil (schema, herhaling, maskering).
- Bijlage A, gat 14, 16 en 22 afgevinkt in het sprintverslag; helpartikel "Agents en mandaten" in `content/help/`.
