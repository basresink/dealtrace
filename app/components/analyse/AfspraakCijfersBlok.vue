<script setup lang="ts">
// Wat leverden de afspraken in de periode op? Een cijferrij (gehouden, vervolg, verslag, niet
// verschenen, doorlooptijd naar vervolg; bij meetings ook transcript en Notulist), de uitkomsten als
// balken en een tabel per bezoek- of meetingsoort. Gedeeld door /bezoek-analyse en /meeting-analyse.
import type { AfspraakCijfers, SoortRij } from '~~/shared/afspraakAnalyse'

const props = defineProps<{ cijfers: AfspraakCijfers; perSoort: SoortRij[]; eenheid: 'bezoeken' | 'meetings'; soortKop: string; metTranscript?: boolean; vensterTekst: string }>()
const VORM: Record<string, string> = { bezoek: 'Bezoek', online: 'Online', telefoon: 'Telefoon' }
const dagen = (n: number | null) => (n === null ? '—' : `${String(n).replace('.', ',')} ${n === 1 ? 'dag' : 'dagen'}`)
const pct = (deel: number, totaal: number) => (totaal ? `${Math.round((deel / totaal) * 100)}%` : '—')
const tegels = computed(() => {
  const c = props.cijfers
  const t = [
    { waarde: c.afgerond, label: `${props.eenheid === 'bezoeken' ? 'Bezoeken' : 'Meetings'} gehouden`, voet: `${c.totaal} gepland in de periode${c.zonderAfronding ? `, ${c.zonderAfronding} nog niet afgerond` : ''}`, test: 'ac-gehouden' },
    { waarde: `${c.conversie}%`, label: 'Conversie naar vervolg', voet: `${c.vervolg} van ${c.afgerond} met een vervolg`, test: 'ac-conversie' },
    { waarde: `${c.verslagProcent}%`, label: 'Met verslag', voet: `${c.metVerslag} van ${c.afgerond} gehouden`, rood: c.afgerond > 0 && c.verslagProcent < 80, test: 'ac-verslag' },
    { waarde: c.nietVerschenen + c.geannuleerd, label: 'Niet verschenen of geannuleerd', voet: `${c.nietVerschenen} niet verschenen · ${c.geannuleerd} geannuleerd`, rood: c.nietVerschenen > 0, test: 'ac-uitval' },
    { waarde: dagen(c.doorlooptijd.mediaan), label: 'Doorlooptijd naar vervolg', voet: c.doorlooptijd.n ? `mediaan over ${c.doorlooptijd.n} · gemiddeld ${dagen(c.doorlooptijd.gemiddeld)}${c.nietIngepland ? ` · ${c.nietIngepland} nog niet ingepland` : ''}` : c.nietIngepland ? `${c.nietIngepland} vervolg nog niet ingepland` : 'nog geen vervolg in de periode', rood: c.nietIngepland > 0, test: 'ac-doorlooptijd' },
  ]
  if (props.metTranscript) t.splice(3, 0, { waarde: c.metTranscript, label: 'Met transcript', voet: `${c.metNotulist} met een analyse van de Notulist`, test: 'ac-transcript' })
  return t
})
const maxUitkomst = computed(() => Math.max(1, ...props.cijfers.uitkomsten.map((u) => u.aantal)))
</script>

<template>
  <div class="ac" data-test="afspraak-cijfers">
    <AnalyseTegels :tegels="tegels" klein />
    <LegeStaat v-if="!cijfers.totaal" class="mt-16" :titel="`Geen ${eenheid} ${vensterTekst}.`" :tekst="`Kies een langere periode of een ander type. ${eenheid === 'bezoeken' ? 'Een bezoek' : 'Een meeting'} telt mee zodra hij in de agenda staat.`" />
    <div v-else class="ac-raster">
      <article class="ac-kaart" data-test="ac-uitkomsten">
        <h3 class="ac-titel">Uitkomsten</h3>
        <p v-if="!cijfers.uitkomsten.length" class="ac-meta">Nog geen {{ eenheid }} afgerond met een uitkomst.</p>
        <ul v-else class="ac-balken">
          <li v-for="u in cijfers.uitkomsten" :key="u.code" class="ac-balk">
            <span class="ac-balk-label">{{ u.label }}<span v-if="u.vervolg" class="pil pil--groen ac-pil">Vervolg</span></span>
            <span class="ac-balk-spoor"><span class="ac-balk-vul" :class="{ 'ac-balk-vul--vervolg': u.vervolg }" :style="{ width: `${(u.aantal / maxUitkomst) * 100}%` }" /></span>
            <span class="ac-balk-n tnum">{{ u.aantal }}</span>
          </li>
        </ul>
      </article>
      <article class="ac-kaart" data-test="ac-per-soort">
        <h3 class="ac-titel">Per {{ soortKop.toLowerCase() }}</h3>
        <div class="tabel-wrap">
          <table class="tabel">
            <thead>
              <tr>
                <th>{{ soortKop }}</th><th class="cel-r">Gepland</th><th class="cel-r">Gehouden</th><th class="cel-r">Uitval</th><th class="cel-r">Verslag</th>
                <template v-if="metTranscript"><th class="cel-r">Transcript</th><th class="cel-r">Notulist</th></template>
                <th class="cel-r">Vervolg</th><th class="cel-r">Doorlooptijd</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in perSoort" :key="s.slug" :data-test="`ac-soort-${s.slug}`">
                <td><strong>{{ s.naam }}</strong><br><span class="ac-meta">{{ VORM[s.vorm] ?? s.vorm }}</span></td>
                <td class="cel-r">{{ s.totaal }}</td><td class="cel-r">{{ s.afgerond }}</td><td class="cel-r">{{ s.nietVerschenen + s.geannuleerd }}</td>
                <td class="cel-r">{{ pct(s.metVerslag, s.afgerond) }}</td>
                <template v-if="metTranscript"><td class="cel-r">{{ s.metTranscript }}</td><td class="cel-r">{{ s.metNotulist }}</td></template>
                <td class="cel-r">{{ pct(s.vervolg, s.afgerond) }}</td><td class="cel-r">{{ dagen(s.doorlooptijd.mediaan) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.ac-raster { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--kaart-gap, 16px); margin-top: var(--kaart-gap, 16px); }
.ac-kaart { min-width: 0; padding: 24px; background: var(--wit); border: 1px solid var(--border); border-radius: var(--radius); }
.ac-titel { margin: 0 0 14px; font-family: var(--font-serif); font-size: 18px; font-weight: 700; }
.ac-meta { margin: 0; font-size: 12px; color: var(--muted); }
.ac-balken { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
.ac-balk { display: grid; grid-template-columns: minmax(0, 1fr) 32px; grid-template-areas: 'label n' 'spoor spoor'; gap: 4px 8px; align-items: center; }
.ac-balk-label { grid-area: label; font-size: 13px; font-weight: 600; }
.ac-pil { margin-left: 6px; }
.ac-balk-spoor { grid-area: spoor; display: block; height: 10px; background: var(--surface); }
.ac-balk-vul { display: block; height: 100%; background: var(--ink-soft); }
.ac-balk-vul--vervolg { background: var(--green); }
.ac-balk-n { grid-area: n; text-align: right; font-weight: 700; }
@media (min-width: 1500px) { .ac-raster { grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); } }
@media (max-width: 719px) { .ac-kaart { padding: 16px; } }
</style>
