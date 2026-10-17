<script setup lang="ts">
// Terugkomen op Richting: de termijnen op een tijdlijn (verlies of nee, slapend) en per lijst de
// regels met de termijn als groot getal, kanaal, rollen, klassen, hercontactritme en aanpak.
import { RICHTING_TEKST, kanaalIcoon, tijdlijn } from '~~/shared/richting'

const props = defineProps<{ regels: any[]; ritmes: { id: string; naam: string }[] }>()
const lijn = computed(() => tijdlijn(props.regels))
const ritmeNaam = (id: string | null) => props.ritmes.find((r) => r.id === id)?.naam ?? 'Nog geen ritme gekoppeld'
const groepen = computed(() => (['verloren', 'slapend'] as const).map((l) => ({
  l,
  titel: l === 'verloren' ? RICHTING_TEKST.verliesUitleg : RICHTING_TEKST.slapendUitleg,
  regels: props.regels.filter((r) => r.lijst === l).sort((a, b) => a.termijnDagen - b.termijnDagen),
})).filter((g) => g.regels.length))
</script>

<template>
  <div>
    <div v-if="regels.length" class="kaart ri-lijn" role="img" :aria-label="`Termijnen op een tijdlijn van direct tot ${Math.round(lijn.max / 30)} maanden`" data-test="ri-tijdlijn">
      <div class="ri-lijn-legenda" aria-hidden="true">
        <span><i class="ri-stip ri-stip--verloren" />{{ RICHTING_TEKST.verliesUitleg }}</span>
        <span><i class="ri-stip ri-stip--slapend" />{{ RICHTING_TEKST.slapendUitleg }}</span>
      </div>
      <div class="ri-lijn-as" aria-hidden="true">
        <span v-for="r in regels" :key="r.id" class="ri-lijn-punt" :class="`ri-lijn-punt--${r.lijst}`" :style="{ left: `${lijn.positie(r.termijnDagen)}%` }" :title="`${r.reden}: ${r.termijn}`" />
      </div>
      <div class="ri-lijn-schaal" aria-hidden="true">
        <span v-for="s in lijn.schaal" :key="s.dagen" class="ri-lijn-label" :style="{ left: `${lijn.positie(s.dagen)}%` }">{{ s.tekst }}</span>
      </div>
    </div>
    <template v-for="g in groepen" :key="g.l">
      <div class="ri-groep-kop"><h3 class="kaart-titel">{{ g.titel }}</h3><span class="meta">{{ g.regels.length }} {{ g.regels.length === 1 ? 'regel' : 'regels' }}</span></div>
      <div class="ri-groep">
        <article v-for="r in g.regels" :key="r.id" class="ri-regel" :data-regel="r.id">
          <div class="ri-termijn"><strong class="tnum">{{ r.termijnDagen === 0 ? 'Direct' : r.termijnDagen }}</strong><span>{{ r.termijnDagen === 0 ? 'meteen' : 'dagen' }}</span></div>
          <div class="ri-regel-tekst">
            <h4 class="ri-regel-titel">{{ r.reden }}</h4>
            <div class="ri-feiten">
              <span><Icoon :naam="kanaalIcoon(r.kanaal)" :grootte="14" />{{ r.kanaal }}</span>
              <span><Icoon naam="User" :grootte="14" />{{ r.rollen?.length ? r.rollen.join(', ') : 'Iedereen' }}</span>
              <span>{{ r.klassen?.length ? `Klassen ${r.klassen.join(', ')}` : 'Alle klassen' }}</span>
              <span><Icoon naam="Repeat" :grootte="14" />{{ ritmeNaam(r.hercontactritmeId) }}</span>
            </div>
            <p v-if="r.aanpak" class="ri-aanpak"><strong>Aanpak:</strong> {{ r.aanpak }}</p>
          </div>
        </article>
      </div>
    </template>
    <LegeStaat v-if="!regels.length" titel="Nog geen bevestigde terugkomregels." tekst="Zodra de regels zijn bevestigd, zie je hier wanneer je iemand opnieuw benadert." />
  </div>
</template>

<style scoped>
.ri-lijn { margin-top: 20px; padding: 18px 20px 14px; }
.ri-lijn-legenda { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: var(--fs-meta); color: var(--muted); }
.ri-lijn-legenda span { display: inline-flex; gap: 6px; align-items: center; }
.ri-stip { display: inline-block; width: 10px; height: 10px; border-radius: 50%; border: 3px solid var(--red); }
.ri-stip--slapend { border-color: var(--blue); }
.ri-lijn-as { position: relative; height: 2px; margin: 28px 8px 0; background: var(--border-strong); }
.ri-lijn-punt { position: absolute; top: -6px; width: 14px; height: 14px; border-radius: 50%; background: var(--wit); border: 3px solid var(--red); transform: translateX(-7px); }
.ri-lijn-punt--slapend { border-color: var(--blue); }
.ri-lijn-schaal { position: relative; height: 22px; margin: 12px 8px 4px; }
.ri-lijn-label { position: absolute; top: 0; transform: translateX(-50%); font-size: var(--fs-label); color: var(--muted); white-space: nowrap; }
.ri-lijn-label:first-child { transform: none; }
.ri-lijn-label:last-child { transform: translateX(-100%); }
.ri-groep-kop { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px 12px; margin-top: 28px; padding-bottom: 8px; border-bottom: 1px solid var(--border); }
.ri-groep { background: var(--wit); border: 1px solid var(--border); border-top: 0; border-radius: 0 0 3px 3px; }
.ri-regel { display: grid; grid-template-columns: 112px minmax(0, 1fr); gap: 12px 20px; padding: 16px 20px; border-top: 1px solid var(--border); }
.ri-regel:first-child { border-top: 0; }
.ri-termijn { align-self: start; padding: 8px 6px; text-align: center; border: 1px solid var(--border-strong); border-radius: 2px; }
.ri-termijn strong { display: block; font-family: var(--font-serif); font-size: 22px; line-height: 1.1; color: var(--ink); }
.ri-termijn span { font-size: var(--fs-label); color: var(--muted); }
.ri-regel-tekst { min-width: 0; }
.ri-regel-titel { margin: 0; font-family: var(--font-serif); font-size: 17px; font-weight: 700; color: var(--ink); }
.ri-feiten { display: flex; flex-wrap: wrap; gap: 6px 18px; margin-top: 6px; font-size: var(--fs-klein); color: var(--muted); }
.ri-feiten span { display: inline-flex; gap: 6px; align-items: center; }
.ri-aanpak { margin: 10px 0 0; padding: 8px 12px; background: var(--surface); border-left: 3px solid var(--yellow); font-size: var(--fs-body); color: var(--ink); }
@media (max-width: 600px) {
  .ri-regel { grid-template-columns: minmax(0, 1fr); padding: 14px 16px; }
  .ri-termijn { display: flex; gap: 8px; align-items: baseline; justify-self: start; }
  .ri-termijn strong { font-size: 18px; }
}
</style>
