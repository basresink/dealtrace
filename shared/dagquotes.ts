// De quote van de dag op Vandaag: korte, eigen zinnen over new business, prospecten, discipline en
// doorzetten. Elke dag een andere, deterministisch gekozen op het dagnummer van de Nederlandse datum,
// zodat iedereen in de organisatie op dezelfde dag dezelfde zin ziet en de laptop en de telefoon gelijk lopen.

export const DAGQUOTES: readonly string[] = [
  'Elke nieuwe klant begon als een onbekend nummer.',
  'Het eerste gesprek van de dag maakt de rest lichter.',
  'Een volle pijplijn begint met een lege agenda die je zelf vult.',
  'Discipline is bellen als je er geen zin in hebt.',
  'Een nee van vandaag is informatie voor morgen.',
  'Wie elke dag zaait, hoeft nooit op geluk te wachten.',
  'De beste prospect is degene die je vandaag nog belt.',
  'Kleine stappen, elke dag gezet, worden grote deals.',
  'Je ritme verkoopt meer dan je talent.',
  'Een goede vraag opent meer deuren dan een goede pitch.',
  'Niet de eerste poging, maar de vijfde maakt het verschil.',
  'Vandaag bellen is morgen oogsten.',
  'Nieuwsgierigheid is je sterkste openingszin.',
  'Een afspraak in de agenda is meer waard dan tien plannen in je hoofd.',
  'Doorzetten is gewoon nog één keer de telefoon pakken.',
  'Een klant kiest niet het beste product, maar de beste opvolging.',
  'Wie luistert, hoort waar de kans zit.',
  'Prospecteren is geen klus, het is een gewoonte.',
  'Geen reactie is nog geen nee.',
  'Je pijplijn van volgend kwartaal bouw je deze week.',
  'De moeilijkste beller is de eerste. Daarna rolt het.',
  'Elke dag een beetje beter is genoeg.',
  'Een sterke dag begint met een duidelijke eerste zet.',
  'Wie de reden van bellen kent, belt met vertrouwen.',
  'Afwijzing gaat over het moment, niet over jou.',
  'Focus op de activiteit, de resultaten volgen vanzelf.',
  'Een goed verslag is een cadeau aan je toekomstige zelf.',
  'De deal die je niet opvolgt, sluit een ander.',
  'Vraag meer, vertel minder.',
  'Ook een kort gesprek kan een lange relatie starten.',
  'Volhouden wint het van slim zijn.',
  'Een warme aanleiding maakt een koud telefoontje warm.',
  'Je beste uur van de dag verdient je beste prospects.',
  'Wie plant, hoeft niet te haasten.',
  'Elke beslisser was ooit een naam op een lijst.',
  'Een volgende stap is beter dan een perfecte stap.',
  'Rust in je hoofd begint met orde in je agenda.',
  'Tempo houden is moeilijker dan snel starten. Doe het toch.',
  'Een goede dag is een dag waarop je deed wat je had gepland.',
  'Het verschil zit in de opvolging.',
  'Vertrouwen bouw je per gesprek, niet per presentatie.',
  'Bel eerst, twijfel later.',
  'Wie vaak genoeg aanklopt, wordt herkend.',
  'Een prospect die nee zegt, kan over een half jaar ja zeggen.',
  'Zorg dat ze je naam kennen voordat ze je nodig hebben.',
  'Elke dag prospecteren is nooit hoeven beginnen bij nul.',
  'Maak het makkelijk om ja te zeggen tegen een eerste afspraak.',
  'Jouw energie aan de telefoon is hoorbaar.',
  'Klein beginnen is ook beginnen.',
  'Wie meet, weet waar de winst zit.',
  'Een gemiste kans is een les, geen eindpunt.',
  'De markt beweegt elke dag. Beweeg mee.',
  'Goede verkopers zijn vooral goede onderzoekers.',
  'Een duidelijke belofte is beter dan een mooi verhaal.',
  'Herhaling bouwt herkenning, herkenning bouwt vertrouwen.',
  'Plan je bellen zoals je een afspraak met een klant plant.',
  'Wat je vandaag uitstelt, staat morgen nog steeds op je lijst.',
  'De sterkste reden om te bellen is een echte aanleiding.',
  'Moed is de telefoon pakken voordat je klaar bent.',
  'Elk gesprek maakt het volgende beter.',
  'Wees de verkoper die terugbelt wanneer hij dat belooft.',
  'Successen komen zelden toevallig, ze komen uit gewoontes.',
  'Een kort contactmoment is beter dan geen contactmoment.',
  'Investeer vandaag in de klanten van volgend jaar.',
  'Wie doorvraagt, hoeft minder te overtuigen.',
  'Elke week een paar nieuwe namen houdt je pijplijn gezond.',
  'Een lege middag is een uitnodiging om te prospecteren.',
  'Kies je doelgroep scherp en je gesprekken worden makkelijker.',
  'Vandaag is een goede dag voor een eerste afspraak.',
  'Niet harder werken, maar vaker beginnen.',
]

/** Dagnummer van een datum (JJJJ-MM-DD) sinds 1 januari 1970. */
export function dagnummer(datum: string): number {
  const [j, m, d] = datum.split('-').map(Number)
  return Math.floor(Date.UTC(j!, (m ?? 1) - 1, d ?? 1) / 864e5)
}

/** De quote van de dag: opeenvolgende dagen krijgen opeenvolgende quotes uit de lijst. */
export function quoteVanDeDag(datum: string, lijst: readonly string[] = DAGQUOTES): string {
  if (!lijst.length) return ''
  const n = dagnummer(datum)
  return lijst[((n % lijst.length) + lijst.length) % lijst.length]!
}
